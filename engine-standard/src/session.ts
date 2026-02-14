import {
  Envelope, StartSessionPayload, SendTextPayload, SendMediaPayload,
  SendButtonsPayload, SendListPayload, SendPollPayload,
  SendTemplatePayload, SendInteractivePayload, SendCarouselPayload,
  CommandType, SyncContactPayload, MarkAsReadPayload, ImportContactPayload,
  HistorySyncPayload, SendOptions
} from "./contracts";
import { logger } from "./logger";
import { RabbitMQ } from "./rabbitmq";
import { v4 as uuidv4 } from "uuid";
import makeWASocket, {
  DisconnectReason,
  prepareWAMessageMedia,
  generateWAMessageFromContent,
  downloadMediaMessage,
  fetchLatestBaileysVersion,
  USyncQuery,
  USyncUser,
  jidNormalizedUser,
  proto
} from "whaileys";
import { Boom } from "@hapi/boom";
import path from "path";
import fs from "fs";
import Redis from "ioredis";
import { useRedisAuthState } from "./helpers/useRedisAuthState";

interface WhaileysSession {
  socket: ReturnType<typeof makeWASocket>;
  status: string;
  tenantId: string | number;
}

class SessionManager {
  private sessions: Map<number, WhaileysSession> = new Map();
  private retries: Map<number, number> = new Map();
  private manuallyDisconnected: Set<number> = new Set();
  private recentlySent: Set<string> = new Set();
  private avatarCache: Map<string, string> = new Map();
  private lidCache: Map<string, string> = new Map();
  private rabbitmq: RabbitMQ;
  private sessionsDir: string;
  private redis: Redis;

  constructor(rabbitmq: RabbitMQ) {
    this.rabbitmq = rabbitmq;
    this.sessionsDir = path.resolve(__dirname, "..", ".sessions_auth");
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
    this.redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");
    this.redis.on("error", (err) => logger.error("Redis Error:", err));
    this.redis.on("connect", () => logger.info("Connected to Redis"));
  }

  async handleCommand(envelope: Envelope) {
    logger.info(`Received command: ${envelope.type}`);

    switch (envelope.type as CommandType) {
      case "session.start":
        await this.startSession(envelope.payload as StartSessionPayload, envelope.tenantId);
        break;
      case "session.stop":
        await this.stopSession(envelope.payload.sessionId, envelope.tenantId);
        break;
      case "message.send.text":
        await this.sendText(envelope.payload as SendTextPayload);
        break;
      case "message.send.media":
        await this.sendMedia(envelope.payload as SendMediaPayload, envelope.tenantId);
        break;
      case "message.send.buttons":
        await this.sendButtons(envelope.payload as SendButtonsPayload);
        break;
      case "message.send.list":
        await this.sendList(envelope.payload as SendListPayload);
        break;
      case "message.send.poll":
        await this.sendPoll(envelope.payload as SendPollPayload);
        break;
      case "message.send.template":
        await this.sendTemplate(envelope.payload as SendTemplatePayload);
        break;
      case "message.send.interactive":
        await this.sendInteractive(envelope.payload as SendInteractivePayload);
        break;
      case "message.send.carousel":
        await this.sendCarousel(envelope.payload as SendCarouselPayload);
        break;
      case "contact.sync":
        await this.syncContact(envelope.payload as SyncContactPayload, envelope.tenantId);
        break;
      case "message.markAsRead":
        await this.markAsRead(envelope.payload as MarkAsReadPayload);
        break;
      case "contact.import":
        await this.importContacts(envelope.payload as ImportContactPayload, envelope.tenantId);
        break;
      case "history.sync":
        await this.syncHistory(envelope.payload as HistorySyncPayload, envelope.tenantId);
        break;
      default:
        logger.warn(`Unknown command type: ${envelope.type}`);
    }
  }

  private async syncContact(payload: SyncContactPayload, tenantId: string | number) {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      logger.error(`Session ${payload.sessionId} not found for syncing contact`);
      return;
    }

    try {
      logger.info(`Syncing contact ${payload.number} for session ${payload.sessionId}`);

      let jid = payload.lid || (payload.number.includes("@") ? payload.number : `${payload.number}@s.whatsapp.net`);
      const isGroup = payload.isGroup || jid.endsWith("@g.us");

      let profilePicUrl: string | undefined | null = undefined;
      let pushName = undefined;
      let foundLid = payload.lid;

      if (isGroup) {
        // Force correct JID format for groups
        if (!jid.endsWith("@g.us")) jid = `${payload.number}@g.us`;

        try {
          // 1. Fetch Group Metadata for Subject
          const groupMetadata = await session.socket.groupMetadata(jid);
          if (groupMetadata && groupMetadata.subject) {
            pushName = groupMetadata.subject;
          }
        } catch (err) {
          logger.warn(`Error fetching group metadata for ${jid}: ${err}`);
        }

        try {
          // 2. Fetch Group Profile Picture
          profilePicUrl = await session.socket.profilePictureUrl(jid, "image").catch(() => null);
        } catch (err) { }

      } else {
        // Individual Contact Logic

        // 1. Tenta buscar a foto diretamente (Otimista)
        profilePicUrl = await session.socket.profilePictureUrl(jid, "image").catch(() => null);

        // 2. Se não encontrar, ou se não temos LID, tenta resolver
        if (!profilePicUrl || (!foundLid && !payload.number.includes("@lid"))) {
          // A. Verifica onWhatsApp (para PNs)
          try {
            // Só roda onWhatsApp se não for LID (LIDs não funcionam no onWhatsApp geralmente)
            if (!jid.includes("@lid")) {
              const results = await session.socket.onWhatsApp(jid);
              const result = results?.[0];
              if (result && result.exists) {
                // Se retornou LID (algumas versões retornam), usa
                if (result.lid) foundLid = result.lid as string;

                // Tenta buscar foto com JID confirmado
                if (!profilePicUrl) {
                  profilePicUrl = await session.socket.profilePictureUrl(result.jid, "image").catch(() => "");
                }
              }
            }
          } catch (err) {
            logger.warn(`Error checking onWhatsApp for ${payload.number}:`, err);
          }

          // B. Se ainda não temos LID e é um número de telefone, tenta USync
          if (!foundLid && !jid.includes("@lid")) {
            try {
              logger.info(`Attempting USync to resolve LID for ${payload.number}`);
              const query = new USyncQuery()
                .withMode("query")
                .withUser(new USyncUser().withPhone(payload.number))
                .withLIDProtocol();

              const result = await (session.socket as any).executeUSyncQuery(query);
              if (result && result.list && result.list.length > 0) {
                const record = result.list[0];
                // @ts-ignore
                if (record.lid) {
                  foundLid = record.lid as string;
                  logger.info(`USync resolved LID for ${payload.number}: ${foundLid}`);
                }
              }
            } catch (err) {
              logger.warn(`Error executing USync for ${payload.number}:`, err);
            }
          }
        }

        // Se descobrimos um LID e não tínhamos foto, tenta buscar foto pelo LID
        if (foundLid && !profilePicUrl) {
          profilePicUrl = await session.socket.profilePictureUrl(foundLid, "image").catch(() => "");
        }
      }

      const updateEvent: Envelope = {
        id: uuidv4(),
        timestamp: Date.now(),
        tenantId,
        type: "contact.update",
        payload: {
          sessionId: payload.sessionId,
          contactId: payload.contactId,
          number: payload.number,
          profilePicUrl: profilePicUrl || undefined,
          lid: foundLid || undefined,
          pushName: pushName
        }
      };

      await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.contact.update`, updateEvent);
    } catch (error) {
      logger.error(`Error syncing contact ${payload.number}:`, error);
    }
  }

  private async stopSession(sessionId: number, tenantId: string | number) {
    logger.info(`Stopping session ${sessionId} for tenant ${tenantId}`);
    const session = this.sessions.get(sessionId);

    // Mesmo se não encontrar a sessão em memória (pode ter caído), forçamos a limpeza do diretório
    try {
      // Mark as manually disconnected to prevent auto-reconnect
      this.manuallyDisconnected.add(sessionId);

      if (session) {
        await session.socket.end(undefined);
        this.sessions.delete(sessionId);
      }

      // Cleanup auth files is critical to ensure clean state
      await this.cleanupSession(sessionId);
    } catch (err) {
      logger.error(`Error stopping session ${sessionId}`, err);
    }

    const statusEvent: Envelope = {
      id: uuidv4(),
      timestamp: Date.now(),
      tenantId: tenantId,
      type: "session.status",
      payload: {
        sessionId,
        status: "DISCONNECTED"
      }
    };
    await this.rabbitmq.publishEvent(`wbot.${tenantId}.${sessionId}.session.status`, statusEvent);
  }



  private async startSession(payload: StartSessionPayload, tenantId: string | number) {
    logger.info(`[SessionManager] startSession called for ${payload.sessionId}`);

    try {
      logger.info(`[SessionManager] Checking existing sessions...`);
      if (this.sessions.has(payload.sessionId) && !payload.force) {
        logger.info(`Session ${payload.sessionId} already exists`);

        const session = this.sessions.get(payload.sessionId);
        const currentStatus = session?.status === "CONNECTED" ? "CONNECTED" : "OPENING";

        logger.info(`Session ${payload.sessionId} status is ${session?.status}, sending ${currentStatus}`);

        const statusEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId,
          type: "session.status",
          payload: {
            sessionId: payload.sessionId,
            status: currentStatus as any
          }
        };
        await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.session.status`, statusEvent);
        return;
      }

      // Notify backend that session is opening (only if we are actually starting a new one)
      const openingEvent: Envelope = {
        id: uuidv4(),
        timestamp: Date.now(),
        tenantId,
        type: "session.status",
        payload: {
          sessionId: payload.sessionId,
          status: "OPENING"
        }
      };
      await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.session.status`, openingEvent);

      // If force is true, we need to stop the existing session first if it exists

      if (this.sessions.has(payload.sessionId) && payload.force) {
        logger.info(`Forcing session start for ${payload.sessionId}, stopping existing session...`);
        await this.stopSession(payload.sessionId, tenantId);
        // Add a small delay to ensure cleanup is processed
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Initialize retry counter if not present
      if (!this.retries.has(payload.sessionId)) {
        this.retries.set(payload.sessionId, 0);
      }

      // If using pairing code, always start with clean auth to avoid 401 errors
      if (payload.usePairingCode && payload.phoneNumber) {
        logger.info(`Pairing code requested for session ${payload.sessionId}, cleaning up old auth files...`);
        await this.cleanupSession(payload.sessionId);
      }

      // [MODIFIED] Use Redis Auth State
      logger.info(`[SessionManager] Initializing Redis Auth State for ${payload.sessionId}`);
      const { state, saveCreds } = await useRedisAuthState(
        this.redis,
        payload.sessionId
      );
      logger.info(`[SessionManager] Redis Auth State initialized for ${payload.sessionId}`);

      const { version, isLatest } = await fetchLatestBaileysVersion();
      logger.info(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);

      // Adjust browser config for pairing code to avoid 401 and "Unable to connect"
      // Using Ubuntu signature is often more stable for Pairing Code
      const browserConfig = payload.usePairingCode ? ["Ubuntu", "Chrome", "20.0.04"] : ["Mac OS", "Chrome", "121.0.6167.85"];

      logger.info(`Session ${payload.sessionId} starting with browser config: ${JSON.stringify(browserConfig)} (usePairingCode: ${payload.usePairingCode})`);

      const sock = makeWASocket({
        version,
        auth: state,
        printQRInTerminal: false,
        logger: logger.child({ level: "warn" }) as any,
        browser: browserConfig as any,
        syncFullHistory: false, // Histórico sempre desativado - busca sob demanda via history.sync
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 2000,
        generateHighQualityLinkPreview: true,
        getMessage: async (key) => {
          if (!key.remoteJid || !key.id) return undefined;
          try {
            // Retrieve message from Redis
            // Pattern: wbot:msg:{jid}:{id}
            const data = await this.redis.get(`wbot:msg:${key.remoteJid}:${key.id}`);
            if (data) {
              return JSON.parse(data).message || undefined;
            }
          } catch (err) {
            logger.error(`Error retrieving message from Redis for ${key.remoteJid}:${key.id}`, err);
          }
          return undefined;
        }
      });

      // Save incoming messages to Redis for retry mechanism
      sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type === "notify" || type === "append") {
          for (const msg of messages) {
            if (!msg.key.id || !msg.key.remoteJid) continue;
            try {
              const key = `wbot:msg:${msg.key.remoteJid}:${msg.key.id}`;
              // Save with 24h TTL (86400 seconds)
              await this.redis.set(key, JSON.stringify(msg), "EX", 86400);
            } catch (err) {
              logger.error("Failed to save message to Redis", err);
            }
          }
        }
      });

      // Salva o socket e o status inicial
      this.sessions.set(payload.sessionId, { socket: sock, status: "OPENING", tenantId });

      sock.ev.on("creds.update", saveCreds);


      // Variables for pairing code flow
      let pairingCodeRequested = false;
      const requestPairingCodeWithRetry = async () => {
        if (!payload.usePairingCode || !payload.phoneNumber) return;

        const MAX_RETRIES = 5;
        const RETRY_DELAY_MS = 5000;
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

        let lastError: any = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          try {
            if (sock.authState.creds.registered) {
              logger.info(`Session ${payload.sessionId} already registered, skipping pairing code.`);
              return;
            }

            logger.info(`Requesting pairing code for session ${payload.sessionId} - Phone: ${payload.phoneNumber} (attempt ${attempt}/${MAX_RETRIES})`);

            // Removing aggressive check for ws.readyState as it causes issues with some Baileys versions
            // We rely on the fact that we received a QR code event or are in a state to request it.

            const code = await sock.requestPairingCode(payload.phoneNumber!);

            // Format code as XXXX-XXXX
            const formattedCode = code ? `${code.slice(0, 4)}-${code.slice(4)}` : code;

            logger.info(`Pairing code generated for session ${payload.sessionId}: ${formattedCode}`);

            const pairingEvent: Envelope = {
              id: uuidv4(),
              timestamp: Date.now(),
              tenantId,
              type: "session.pairingcode",
              payload: {
                sessionId: payload.sessionId,
                pairingCode: formattedCode
              }
            };
            logger.info(`Publishing pairing code event for session ${payload.sessionId} code ${formattedCode}`);
            await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.session.pairingcode`, pairingEvent);
            return; // Success, exit function

          } catch (error: any) {
            lastError = error;
            logger.warn(`Attempt ${attempt}/${MAX_RETRIES} failed for pairing code: ${error.message}`);

            // Rate limit - don't retry
            if (error.message?.includes("rate-overlimit")) {
              logger.error(`Rate limit reached for session ${payload.sessionId}, not retrying.`);
              break;
            }

            // Connection Closed or Failure - wait and retry
            if ((error.message?.includes("Connection Closed") || error.message?.includes("Connection Failure")) && attempt < MAX_RETRIES) {
              logger.info(`Connection issue (${error.message}), waiting ${RETRY_DELAY_MS}ms before retry...`);
              await delay(RETRY_DELAY_MS);
              continue;
            }

            // Last attempt - break
            if (attempt === MAX_RETRIES) {
              break;
            }

            // Other errors - wait shorter and retry
            await delay(3000);
          }
        }

        if (lastError) {
          logger.error(`Failed to generate pairing code for session ${payload.sessionId} after ${MAX_RETRIES} attempts. Last error: ${lastError.message}`);
        }

        pairingCodeRequested = false; // Reset on error to allow retry
      };

      // Fallback: Se não recebermos QR em 10s, tentar pedir o código
      if (payload.usePairingCode && payload.phoneNumber && !sock.authState.creds.registered) {
        setTimeout(async () => {
          if (!pairingCodeRequested && !sock.authState.creds.registered) {
            logger.info(`Fallback: Requesting pairing code for session ${payload.sessionId} after timeout`);
            pairingCodeRequested = true;
            await requestPairingCodeWithRetry();
          }
        }, 10000);
      }

      sock.ev.on("connection.update", async (update: any) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr && !payload.usePairingCode) {
          logger.info(`QR Code generated for session ${payload.sessionId}`);
          const qrEvent: Envelope = {
            id: uuidv4(),
            timestamp: Date.now(),
            tenantId,
            type: "session.qrcode",
            payload: {
              sessionId: payload.sessionId,
              qrcode: qr,
              attempt: 1 // Logic to track attempts could be added
            }
          };
          await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.session.qrcode`, qrEvent);
        } else if (qr && payload.usePairingCode) {
          logger.info(`QR Code received for session ${payload.sessionId}, triggering pairing code flow...`);
          if (!pairingCodeRequested && !sock.authState.creds.registered) {
            pairingCodeRequested = true;
            await requestPairingCodeWithRetry();
          }
        }

        if (connection === "close") {
          const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;
          const currentRetries = this.retries.get(payload.sessionId) || 0;
          const wasManuallyDisconnected = this.manuallyDisconnected.has(payload.sessionId);

          // Status codes that should NOT trigger auto-reconnect
          const noRetryCodes = [
            DisconnectReason.loggedOut,      // 401 - User logged out
            DisconnectReason.forbidden,      // 403 - Banned
            DisconnectReason.badSession      // 500 - Auth file corrupted
          ];

          const shouldReconnect = statusCode === undefined || !noRetryCodes.includes(statusCode);

          logger.warn(`Connection closed for session ${payload.sessionId}, statusCode: ${statusCode}, reconnecting: ${shouldReconnect}, manual: ${wasManuallyDisconnected}, attempt: ${currentRetries}`);

          // Skip reconnection if manually disconnected
          if (wasManuallyDisconnected) {
            this.manuallyDisconnected.delete(payload.sessionId);
            this.retries.delete(payload.sessionId);
            this.sessions.delete(payload.sessionId);
            logger.info(`Session ${payload.sessionId} was manually disconnected, skipping reconnection.`);
            return;
          }

          // Cleanup auth on badSession to allow fresh start
          if (statusCode === DisconnectReason.badSession) {
            logger.warn(`Bad session detected for session ${payload.sessionId}, cleaning up auth files.`);
            await this.cleanupSession(payload.sessionId);
          }


          // Special handling for Pairing Code flow: Treat 401 as retryable if using pairing code and not registered
          if (payload.usePairingCode && !sock.authState.creds.registered && statusCode === DisconnectReason.loggedOut) {
            logger.warn(`401 Logged Out during Pairing Code flow for session ${payload.sessionId} - Cleaning up and Retrying`);

            // ... (cleanup logic same as before) ...
            try {
              sock.end(undefined);
              this.sessions.delete(payload.sessionId);
            } catch (e) {
              logger.warn(`Error closing socket for session ${payload.sessionId}`, e);
            }

            // Wait a bit before cleanup to ensure file locks are released
            await new Promise(resolve => setTimeout(resolve, 1000));

            await this.cleanupSession(payload.sessionId);

            // Allow reconnect with more retries
            // Use keepAlive or default 10 for pairing flow
            const maxRetries = payload.keepAlive ? 999999 : 10;
            if (currentRetries < maxRetries) {
              this.retries.set(payload.sessionId, currentRetries + 1);
              setTimeout(() => this.startSession(payload, tenantId), 2000);
              return;
            }
          }

          // Check if we should retry based on KeepAlive or standard retry limit
          const maxRetries = payload.keepAlive ? 999999 : 5;

          if (shouldReconnect && currentRetries < maxRetries) {
            this.retries.set(payload.sessionId, currentRetries + 1);
            this.sessions.delete(payload.sessionId);

            // Calculate delay: Exponential backoff with cap
            // If keepAlive is true, we might want a capped delay to avoid waiting too long
            const delay = Math.min(3000 * (currentRetries + 1), 60000); // Max 60s

            logger.info(`Session ${payload.sessionId} reconnecting in ${delay}ms... (Attempt ${currentRetries + 1}/${payload.keepAlive ? "∞" : maxRetries})`);

            setTimeout(() => this.startSession(payload, tenantId), delay);
          } else {
            // Max retries reached or permanent error
            logger.error(`Session ${payload.sessionId} failed to connect after ${currentRetries} attempts or permanent error (code: ${statusCode}). KeepAlive: ${payload.keepAlive}`);
            this.retries.delete(payload.sessionId);
            this.sessions.delete(payload.sessionId);

            const statusEvent: Envelope = {
              id: uuidv4(),
              timestamp: Date.now(),
              tenantId,
              type: "session.status",
              payload: {
                sessionId: payload.sessionId,
                status: "DISCONNECTED"
              }
            };
            await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.session.status`, statusEvent);
          }
        } else if (connection === "open") {
          logger.info(`Session ${payload.sessionId} opened`);
          this.retries.delete(payload.sessionId);
          const session = this.sessions.get(payload.sessionId);
          if (session) session.status = "CONNECTED";

          let number = "";
          let profilePicUrl = "";

          try {
            const userJid = sock.user?.id;
            if (userJid) {
              number = userJid.split(":")[0]; // Handle JID format
              profilePicUrl = (await sock.profilePictureUrl(userJid, "image").catch(() => "")) || "";
            }
          } catch (error) {
            logger.warn(`Failed to fetch profile info for session ${payload.sessionId}`, error);
          }

          const statusEvent: Envelope = {
            id: uuidv4(),
            timestamp: Date.now(),
            tenantId,
            type: "session.status",
            payload: {
              sessionId: payload.sessionId,
              status: "CONNECTED",
              number,
              profilePicUrl
            }
          };
          await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.session.status`, statusEvent);

          // [HYDRATION] Disabled per user instruction.
          // Groups/Contacts should only be created/updated when a message arrives.
          logger.info(`[HYDRATION] Group hydration disabled for session ${payload.sessionId}`);
        }
      });

      sock.ev.on("messages.upsert", async ({ messages, type }: any) => {
        if (type === "notify" || type === "append") {
          const syncStartTimestamp = payload.syncHistory && payload.syncPeriod ? new Date(payload.syncPeriod).getTime() / 1000 : 0;

          for (const msg of messages) {
            if (!msg.message) continue;

            // Strict History Sync Logic: Filter by Date
            if (payload.syncHistory && syncStartTimestamp > 0) {
              const msgTimestamp = typeof msg.messageTimestamp === "number" ? msg.messageTimestamp : (msg.messageTimestamp as any)?.low;
              if (msgTimestamp && msgTimestamp < syncStartTimestamp) {
                // Ignore messages older than requested start date
                continue;
              }
            }

            // Dedup logic: If we recently sent this message (fromMe), ignore it in upsert
            // because we already handled it with context in sendText/sendMedia
            if (msg.key.fromMe && msg.key.id && this.recentlySent.has(msg.key.id)) {
              logger.info(`Ignoring upsert for recently sent message ${msg.key.id}`);
              continue;
            }

            await this.handleMessage(msg, sock, payload.sessionId, tenantId);
          }
        }
      });

      // Listen for message ACK (read receipts)
      sock.ev.on("messages.update", async (updates: any[]) => {
        for (const update of updates) {
          if (update.update?.status) {

            // Mapping Baileys status to our status
            // Baileys: 0=ERROR, 1=PENDING, 2=SERVER_ACK, 3=DELIVERY_ACK, 4=READ, 5=PLAYED
            // Our UI: 0=Clock, 1=Sent, 2=Received, 3=Read, 4=Played, 5=Error

            const baileystatus = update.update?.status || update.status;
            let status = 0;
            
            // Ensure numeric comparison
            const bStatus = Number(baileystatus);

            if (bStatus === 0) {
              status = 5; // Error
            } else if (bStatus === 1) {
              status = 0; // Pending
            } else if (bStatus === 2) {
              status = 1; // Sent (Server ACK)
            } else if (bStatus === 3) {
              status = 2; // Received (Delivery ACK)
            } else if (bStatus === 4) {
              status = 3; // Read
            } else if (bStatus === 5) {
              status = 4; // Played
            }

            // Only emit if status changed to meaningful value
            // Ignore if baileystatus is undefined
            if (typeof baileystatus !== 'undefined') {
              logger.info(`[Ack] Message ${update.key?.id} status update: ${baileystatus} -> ${status}`);

              const ackEvent: Envelope = {
                id: uuidv4(),
                timestamp: Date.now(),
                tenantId,
                type: "message.ack",
                payload: {
                  sessionId: payload.sessionId,
                  messageId: update.key?.id || "",
                  ack: status
                }
              };
              await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.message.ack`, ackEvent);
            }
          } else if (update.status) {
            // Fallback for top-level status
            const baileystatus = update.status;
            let status = 0;
            if (baileystatus === 4) status = 3;
            else if (baileystatus === 3) status = 2;
            else if (baileystatus === 2) status = 1;

            logger.info(`[Ack] Message ${update.key?.id} status update (fallback): ${baileystatus} -> ${status}`);

            const ackEvent: Envelope = {
              id: uuidv4(),
              timestamp: Date.now(),
              tenantId,
              type: "message.ack",
              payload: {
                sessionId: payload.sessionId,
                messageId: update.key?.id || "",
                ack: status
              }
            };
            await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.message.ack`, ackEvent);
          }
        }
      });

      // Listen for message reactions
      sock.ev.on("messages.reaction", async (reactions: any[]) => {
        for (const reaction of reactions) {
          logger.info(`[Reaction] Received reaction for message ${reaction.key.id}`);

          const reactionEvent: Envelope = {
            id: uuidv4(),
            timestamp: Date.now(),
            tenantId,
            type: "message.reaction",
            payload: {
              sessionId: payload.sessionId,
              messageId: reaction.key.id || "",
              reaction: reaction.reaction.text || "",
              sender: reaction.key.participant || reaction.key.remoteJid || "",
              timestamp: reaction.reaction.key?.timestamp || Date.now()
            }
          };

          await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.message.reaction`, reactionEvent);
        }
      });

      // Listen for Contacts Update (Profile Pics, etc)
      sock.ev.on("contacts.update", async (updates: any[]) => {
        for (const update of updates) {
          if (!update.id) continue;

          if (typeof update.imgUrl !== "undefined") {
            const jid = update.id;
            let profilePicUrl = undefined;

            try {
              profilePicUrl = await sock.profilePictureUrl(jid, "image").catch(() => null);
            } catch (e) { }

            const updateEvent: Envelope = {
              id: uuidv4(),
              timestamp: Date.now(),
              tenantId,
              type: "contact.update",
              payload: {
                sessionId: payload.sessionId,
                contactId: 0, // 0 or undefined, backend should handle
                number: jid.split("@")[0],
                profilePicUrl: profilePicUrl || undefined,
                pushName: update.notify || undefined,
                isGroup: jid.endsWith("@g.us")
              }
            };
            await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.contact.update`, updateEvent);
          }
        }
      });

      // Listen for Group Updates (Name changes, etc)
      sock.ev.on("groups.update", async (updates: any[]) => {
        for (const group of updates) {
          if (!group.id) continue;

          const jid = group.id;
          let profilePicUrl = undefined;

          try {
            profilePicUrl = await sock.profilePictureUrl(jid, "image").catch(() => null);
          } catch (e) { }

          const updateEvent: Envelope = {
            id: uuidv4(),
            timestamp: Date.now(),
            tenantId,
            type: "contact.update",
            payload: {
              sessionId: payload.sessionId,
              contactId: 0,
              number: jid.split("@")[0],
              profilePicUrl: profilePicUrl || undefined,
              pushName: group.subject || undefined,
              isGroup: true
            }
          };
          await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.contact.update`, updateEvent);
        }
      });

    } catch (err) {
      logger.error(`Error starting session ${payload.sessionId}`, err);
      const statusEvent: Envelope = {
        id: uuidv4(),
        timestamp: Date.now(),
        tenantId,
        type: "session.status",
        payload: {
          sessionId: payload.sessionId,
          status: "DISCONNECTED"
        }
      };
      await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.session.status`, statusEvent);
      this.sessions.delete(payload.sessionId);
    }
  }

  private async cleanupSession(sessionId: number) {
    logger.info(`Attempting cleanup of session ${sessionId} in Redis`);
    try {
      // Use SCAN in production for better performance, but KEYS is okay for now
      // Pattern: wbot:auth:{sessionId}:*
      const keys = await this.redis.keys(`wbot:auth:${sessionId}:*`);

      if (keys.length > 0) {
        const pipeline = this.redis.pipeline();
        keys.forEach(key => pipeline.del(key));
        await pipeline.exec();
        logger.info(`Successfully cleaned up ${keys.length} keys for session ${sessionId}`);
      } else {
        logger.info(`No Redis keys found for session ${sessionId}`);
      }
    } catch (err) {
      logger.error(`Error cleaning up session ${sessionId}:`, err);
    }
  }

  private async validateAndCorrectJid(session: WhaileysSession, jid: string, lid: string | undefined, tenantId: string | number): Promise<string> {
    if (jid.endsWith("@g.us")) return jid;

    try {
      const results = await session.socket.onWhatsApp(jid);
      const result = results?.[0];

      if (result && result.exists) {
        const correctJid = result.jid;
        if (correctJid !== jid) {
          logger.warn(`[validateJid] JID Mismatch: ${jid} -> ${correctJid}`);

          if (lid) {
            const updateEvent: Envelope = {
              id: uuidv4(),
              timestamp: Date.now(),
              tenantId,
              type: "contact.update",
              payload: {
                sessionId: -1,
                contactId: 0,
                lid: lid,
                number: correctJid.split("@")[0]
              }
            };
            await this.rabbitmq.publishEvent(`wbot.${tenantId}.${tenantId}.contact.update`, updateEvent);
          }

          return correctJid;
        } else {
          logger.info(`[validateJid] JID Verified: ${jid}`);
          return jid;
        }
      } else {
        logger.error(`[validateJid] JID ${jid} invalid or not on WhatsApp!`);
        throw new Error(`JID ${jid} is not valid on WhatsApp`);
      }
    } catch (error) {
      logger.error(`[validateJid] Validation failed for ${jid}: ${error}`);
      throw error;
    }
  }

  private generateWAMessageId(): string {
    return "3EB0" + Math.random().toString(36).slice(2).toUpperCase() + Math.random().toString(36).slice(2).toUpperCase().substring(0, 12);
  }

  private createQuoted(options?: SendOptions) {
    if (!options) return undefined;
    if (options.quoted) {
      return {
        key: options.quoted.key,
        message: options.quoted.message
      };
    }
    if (options.quotedMsgId) {
      return { key: { id: options.quotedMsgId } };
    }
    return undefined;
  }

  // Re-writing the entire method to better handle try-catch and ID availability
  private async sendText(payload: SendTextPayload) {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      // If session not found, try to emit error if we have messageId
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: "1", // Fallback if session missing
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error - Session not found
          }
        };
        await this.rabbitmq.publishEvent(`wbot.*.${payload.sessionId}.message.ack`, ackEvent);
      }
      logger.error(`Session ${payload.sessionId} not found for sending message`);
      return;
    }

    try {
      const jid = await this.validateAndCorrectJid(session, payload.to, payload.lid, session.tenantId);

      logger.info(`[sendText] Sending text to ${jid}: ${payload.body} (Ref Message ID: ${payload.messageId})`);

      const waMsgId = (payload.messageId && payload.messageId.startsWith("3EB0"))
        ? payload.messageId
        : this.generateWAMessageId();

      this.recentlySent.add(waMsgId);
      setTimeout(() => this.recentlySent.delete(waMsgId), 10000);

      const quotedMsg = this.createQuoted(payload.options);

      const msg = await session.socket.sendMessage(jid, {
        text: payload.body,
        mentions: payload.mentions // Pass mentions array
      }, {
        quoted: quotedMsg,
        messageId: waMsgId
      });

      if (msg) {
        logger.info(`[sendText] Message sent successfully. WA Msg ID: ${msg.key.id}. Ref Message ID: ${payload.messageId}`);
        // We still trigger handleMessage to ensure standard flow works (saving self-message)
        // Ideally handleMessage should maybe UPDATE the existing message if we could link them, 
        // but currently handleMessage creates a new record or upserts based on WA ID.
        await this.handleMessage(msg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
      } else {
        throw new Error("Message rejected (msg undefined)");
      }
    } catch (error) {
      logger.error(`[sendText] Error sending message to ${payload.to}: ${error}`);

      if (payload.messageId) {
        // Emit failure ACK using the backend's message ID
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: session.tenantId,
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.${session.tenantId}.${payload.sessionId}.message.ack`, ackEvent);
        logger.info(`[sendText] Emitted ACK 5 (Error) for Message ID: ${payload.messageId}`);
      } else {
        logger.warn(`[sendText] Failed to send. Cannot emit ACK 5 because I don't have the context message ID.`);
      }
    }
  }

  private async handleMessage(msg: any, sock: any, sessionId: number, tenantId: string | number, originalMessageId?: string) {
    logger.info(`[handleMessage] RAW ENTRY msg.key.id: ${msg?.key?.id} msg.message defined? ${!!msg?.message}`);

    if (!msg.message) {
      logger.warn(`[handleMessage] Message ignored because msg.message is undefined. Msg ID: ${msg?.key?.id}`);
      return;
    }
    logger.info(`[handleMessage] Processing message ${msg.key.id} fromMe: ${msg.key.fromMe}`);

    // --- Technical Message Handling (Revoke/Reactions) ---

    // 1. Handle Protocol Messages (Revoke/Delete)
    if (msg.message.protocolMessage) {
      const protocolMsg = msg.message.protocolMessage;

      // 0 = REVOKE (Delete for everyone)
      if (protocolMsg.type === 0 && protocolMsg.key) {
        logger.info(`[handleMessage] Detected Revoke for msg ${protocolMsg.key.id} by ${msg.key.participant || msg.key.remoteJid}`);

        const revokeEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId,
          type: "message.revoke",
          payload: {
            sessionId,
            messageId: protocolMsg.key.id || "",
            participant: msg.key.participant || msg.key.remoteJid || ""
          }
        };
        await this.rabbitmq.publishEvent(`wbot.${tenantId}.${sessionId}.message.revoke`, revokeEvent);
        return; // Stop processing to prevent empty bubble
      } else {
        logger.info(`[handleMessage] Ignored other ProtocolMsg type: ${protocolMsg.type}`);
        return; // Ignore other technical types
      }
    }

    // 2. Handle Reaction Messages (via Upsert)
    if (msg.message.reactionMessage) {
      const reactionMsg = msg.message.reactionMessage;
      logger.info(`[handleMessage] Detected Reaction via Upsert for ${reactionMsg.key?.id}`);
      if (reactionMsg.key?.id) {
        const reactionEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId,
          type: "message.reaction",
          payload: {
            sessionId,
            messageId: reactionMsg.key.id,
            reaction: reactionMsg.text || "",
            sender: msg.key.participant || msg.key.remoteJid || "",
            timestamp: reactionMsg.senderTimestampMs || Date.now()
          }
        };
        await this.rabbitmq.publishEvent(`wbot.${tenantId}.${sessionId}.message.reaction`, reactionEvent);
      }
      return; // Stop processing to prevent empty bubble
    }

    // Check for media types
    const hasMedia = !!(
      msg.message.imageMessage ||
      msg.message.videoMessage ||
      msg.message.audioMessage ||
      msg.message.documentMessage ||
      msg.message.stickerMessage
    );

    let body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    let selectedButtonId = undefined;
    let selectedRowId = undefined;
    let pollVotes = undefined;
    let msgType = hasMedia ? "media" : "chat";
    let mediaData = undefined;
    let mimetype = undefined;

    // --- Media Handling ---
    if (hasMedia) {
      try {
        const buffer = await downloadMediaMessage(msg, "buffer", {});
        mediaData = buffer.toString("base64");
        mimetype = msg.message.imageMessage?.mimetype ||
          msg.message.videoMessage?.mimetype ||
          msg.message.audioMessage?.mimetype ||
          msg.message.documentMessage?.mimetype ||
          msg.message.stickerMessage?.mimetype;

        // Extract caption if available and body is empty
        if (!body) {
          body = msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption ||
            msg.message.documentMessage?.caption || "";
        }
      } catch (err) {
        logger.warn(`Error downloading media for msg ${msg.key.id}: ${err}`);
      }
    }

    // --- Interactive Responses ---

    // 1. Buttons Response
    if (msg.message.buttonsResponseMessage) {
      selectedButtonId = msg.message.buttonsResponseMessage.selectedButtonId;
      body = msg.message.buttonsResponseMessage.selectedDisplayText || "";
      msgType = "button_response";
    }
    // 2. Template Button Response
    else if (msg.message.templateButtonReplyMessage) {
      selectedButtonId = msg.message.templateButtonReplyMessage.selectedId;
      body = msg.message.templateButtonReplyMessage.selectedDisplayText || "";
      msgType = "button_response";
    }
    // 3. List Response
    else if (msg.message.listResponseMessage) {
      selectedRowId = msg.message.listResponseMessage.singleSelectReply?.selectedRowId;
      body = msg.message.listResponseMessage.title || "";
      msgType = "list_response";
    }
    // 3.1 Interactive Response (Native Flow / Carousel - Received Response)
    else if (msg.message.interactiveResponseMessage) {
      const interactiveResp = msg.message.interactiveResponseMessage;
      if (interactiveResp.nativeFlowResponseMessage) {
        const params = JSON.parse(interactiveResp.nativeFlowResponseMessage.paramsJson || "{}");
        selectedButtonId = params.id;
      }
      body = interactiveResp.body?.text || "";
      msgType = "interactive_response";
    }
    // 3.2 Interactive Message (Native Flow - Sent Message)
    else if (msg.message.interactiveMessage) {
      body = msg.message.interactiveMessage.body?.text || "";
      msgType = "interactive";
    }
    // 3.3 ViewOnce with Interactive (Carousel)
    else if (msg.message.viewOnceMessage?.message?.interactiveMessage) {
      body = msg.message.viewOnceMessage.message.interactiveMessage.body?.text || "";
      msgType = "interactive";
    }
    // 4. Poll Response
    else if (msg.message.pollUpdateMessage) {
      msgType = "poll_response";
    }

    let profilePicUrl = "";
    try {
      const senderJid = msg.key.participant || msg.key.remoteJid || "";
      const isGroupMsg = (msg.key.remoteJid?.endsWith("@g.us") || false) && !msg.key.fromMe;
      if (isGroupMsg && senderJid) {
        const cached = this.avatarCache.get(senderJid);
        if (cached) {
          profilePicUrl = cached;
        } else {
          const fetched = await sock.profilePictureUrl(senderJid, "image").catch(() => "");
          if (fetched) {
            profilePicUrl = fetched;
            this.avatarCache.set(senderJid, fetched);
          }
        }
      }
    } catch (e) { }

    // Enhanced Contact Identification (LID/JID)
    let senderLid = undefined;
    const senderJid = msg.key.participant || msg.key.remoteJid || "";

    if (senderJid && !senderJid.includes("@lid")) {
      try {
        // If it's a standard JID (PN based), try to fetch the LID which is permanent
        // This answers the requirement: "todo contato tem LID mas podem haver casos de contatos antigos... sistema deve buscar o LID"

        // 1. Check Cache
        const cachedLid = this.lidCache.get(senderJid);
        if (cachedLid) {
          senderLid = cachedLid;
        } else {
          // 2. Fetch from API
          const results = await sock.onWhatsApp(senderJid);
          const result = results?.[0];
          if (result && result.lid) {
            senderLid = result.lid;
            this.lidCache.set(senderJid, senderLid);
          }
        }
      } catch (err) {
        // Ignore errors during LID fetch to not block message processing
      }
    } else if (senderJid && senderJid.includes("@lid")) {
      senderLid = senderJid;
    }

    // Determine participant (especially for groups)
    let participant = msg.key.participant || "";
    if (msg.key.fromMe && !participant && sock.user?.id) {
       participant = jidNormalizedUser(sock.user.id);
    }

    // --- Quoted Message & Link Preview Extraction ---
    let quotedMsgId = undefined;
    let quotedMsgObj = undefined;
    let urlPreviewObj = undefined;

    try {
      // 1. Find Context Info
      const content = msg.message?.extendedTextMessage ||
        msg.message?.imageMessage ||
        msg.message?.videoMessage ||
        msg.message?.documentMessage ||
        msg.message?.stickerMessage ||
        msg.message?.buttonsResponseMessage ||
        msg.message?.listResponseMessage ||
        msg.message?.templateButtonReplyMessage ||
        msg.message?.interactiveResponseMessage?.nativeFlowResponseMessage;

      // Note: direct 'conversation' usually doesn't have contextInfo
      const contextInfo = content?.contextInfo;

      if (contextInfo?.quotedMessage) {
        quotedMsgId = contextInfo.stanzaId;
        const qMsg = contextInfo.quotedMessage;

        const qBody = qMsg.conversation ||
          qMsg.extendedTextMessage?.text ||
          qMsg.imageMessage?.caption ||
          qMsg.videoMessage?.caption ||
          (qMsg.imageMessage ? "Imagem" : null) ||
          (qMsg.videoMessage ? "Vídeo" : null) ||
          (qMsg.documentMessage ? "Arquivo" : null) ||
          (qMsg.stickerMessage ? "Sticker" : null) ||
          "";

        quotedMsgObj = {
          id: contextInfo.stanzaId,
          body: qBody,
          participant: contextInfo.participant || "",
          type: Object.keys(qMsg)[0] || "unknown"
        };
      }

      // 2. Link Preview (Only in extendedTextMessage)
      if (msg.message?.extendedTextMessage) {
        const { title, description, canonicalUrl, jpegThumbnail, previewType } = msg.message.extendedTextMessage;

        // Only consider it a preview if we have at least a URL or Title
        if (canonicalUrl || title) {
          urlPreviewObj = {
            title,
            description,
            canonicalUrl,
            thumbnail: jpegThumbnail ? Buffer.from(jpegThumbnail).toString("base64") : undefined,
            previewType
          };
          logger.info(`[handleMessage] Extracted Link Preview: ${title} - ${canonicalUrl}`);
        }
      }

    } catch (err) {
      logger.warn(`[handleMessage] Error extracting quota/preview: ${err}`);
    }

    const msgEvent: Envelope = {
      id: uuidv4(),
      timestamp: Date.now(),
      tenantId,
      type: "message.received",
      payload: {
        sessionId: sessionId,
        message: {
          id: msg.key.id || "",
          from: msg.key.remoteJid || "",
          to: msg.key.remoteJid || "",
          body: body,
          fromMe: msg.key.fromMe || false,
          isGroup: msg.key.remoteJid?.endsWith("@g.us") || false,
          type: msgType,
          timestamp: typeof msg.messageTimestamp === "number"
            ? msg.messageTimestamp
            : (msg.messageTimestamp as any)?.low || (msg.messageTimestamp as any)?.toNumber?.() || Math.floor(Date.now() / 1000),
          hasMedia: hasMedia,
          mediaData,
          mimetype,
          selectedButtonId,
          selectedRowId,
          pollVotes,
          pushName: msg.pushName || "",
          participant: participant,
          profilePicUrl,
          senderLid,
          originalId: originalMessageId,
          quotedMsgId: quotedMsgId,
          quotedMsg: quotedMsgObj,
          urlPreview: urlPreviewObj
        }
      }
    };
    logger.info(`[handleMessage] Publishing received event for ${msg.key.id} (fromMe: ${msgEvent.payload.message.fromMe})`);
    await this.rabbitmq.publishEvent(`wbot.${tenantId}.${sessionId}.message.received`, msgEvent);
  }

  private async sendMedia(payload: SendMediaPayload, tenantId: string | number) {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: tenantId,
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.message.ack`, ackEvent);
      }
      logger.error(`Session ${payload.sessionId} not found for sending media`);
      return;
    }

    try {
      const jid = await this.validateAndCorrectJid(session, payload.to, payload.lid, session.tenantId);

      logger.info(`Sending media to ${jid}: ${payload.media.filename}`);

      // Convert base64 to buffer
      const mediaBuffer = Buffer.from(payload.media.data, 'base64');
      const mimetype = payload.media.mimetype;
      const filename = payload.media.filename;

      let content: any = {};

      // Determine media type based on mimetype
      if (mimetype.startsWith('image/')) {
        content = {
          image: mediaBuffer,
          caption: payload.caption || '',
          mimetype: mimetype
        };
      } else if (mimetype.startsWith('video/')) {
        content = {
          video: mediaBuffer,
          caption: payload.caption || '',
          mimetype: mimetype
        };
      } else if (mimetype.startsWith('audio/')) {
        content = {
          audio: mediaBuffer,
          mimetype: mimetype,
          ptt: mimetype === 'audio/ogg' // Voice note if ogg
        };
      } else {
        // Document (PDF, etc)
        content = {
          document: mediaBuffer,
          caption: payload.caption || '',
          fileName: filename,
          mimetype: mimetype
        };
      }

      const waMsgId = (payload.messageId && payload.messageId.startsWith("3EB0"))
        ? payload.messageId
        : this.generateWAMessageId();

      this.recentlySent.add(waMsgId);
      setTimeout(() => this.recentlySent.delete(waMsgId), 10000);

      const quotedMsg = this.createQuoted(payload.options);
      const msg = await session.socket.sendMessage(jid, content, { quoted: quotedMsg, messageId: waMsgId });

      if (msg) {
        await this.handleMessage(msg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
      }
    } catch (error) {
      logger.error(`Error sending media to ${payload.to}: ${error}`);
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: session.tenantId,
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.${session.tenantId}.${payload.sessionId}.message.ack`, ackEvent);
      }
    }
  }

  private async markAsRead(payload: MarkAsReadPayload) {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      logger.error(`Session ${payload.sessionId} not found for marking messages as read`);
      return;
    }

    try {
      logger.info(`Marking ${payload.messageIds.length} messages as read for ${payload.to}`);
      const keys = payload.messageIds.map(id => ({
        remoteJid: payload.to,
        id: id,
        fromMe: false // Usually we mark received messages as read
      }));

      await session.socket.readMessages(keys);
    } catch (err) {
      logger.error(`Error marking messages as read for ${payload.to}:`, err);
    }
  }

  private async importContacts(payload: ImportContactPayload, tenantId: string | number) {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      logger.error(`Session ${payload.sessionId} not found for importing contacts`);
      return;
    }

    logger.info(`[importContacts] Starting contact import for session ${payload.sessionId}`);

    // User instruction: Do not scan groups or force create contacts.
    // Contacts/Tickets should be created only when messages arrive.
    // This method is kept for architectural compatibility but currently performs no active scanning
    // to avoid creating unwanted group contacts/tickets.

    logger.info(`[importContacts] Manual import disabled. Contacts are synced automatically via incoming messages.`);
  }

  // Busca de histórico de mensagens sob demanda para um contato/ticket específico
  private async syncHistory(payload: HistorySyncPayload, tenantId: string | number) {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      logger.error(`Session ${payload.sessionId} not found for history sync`);
      return;
    }

    try {
      const jid = payload.contactNumber.includes("@")
        ? payload.contactNumber
        : `${payload.contactNumber}@s.whatsapp.net`;

      logger.info(`[HistorySync] Fetching messages for ${jid} from ${payload.fromDate} for ticket ${payload.ticketId}`);

      const fromTimestamp = new Date(payload.fromDate).getTime() / 1000;
      const toTimestamp = payload.toDate ? new Date(payload.toDate).getTime() / 1000 : Date.now() / 1000;

      // Nota: O Baileys não possui um método direto para buscar histórico de mensagens de um chat específico
      // O histórico é sincronizado automaticamente quando syncFullHistory está ativo
      // Para busca sob demanda, precisamos usar a store local se disponível
      // ou re-sincronizar a sessão com syncFullHistory:true temporariamente

      // Por enquanto, emitimos um evento de status informando que a busca foi iniciada
      // e dependemos do mecanismo existente de messages.upsert para receber as mensagens
      // quando o WhatsApp as envia como parte de qualquer cache/sync

      logger.info(`[HistorySync] History sync requested for ${jid}. Note: Baileys does not support on-demand history fetch.`);
      logger.info(`[HistorySync] Messages will be captured via normal upsert flow if WhatsApp sends them.`);

      // Emitir evento de status para o backend
      const statusEvent: Envelope = {
        id: uuidv4(),
        timestamp: Date.now(),
        tenantId,
        type: "history.status",
        payload: {
          sessionId: payload.sessionId,
          ticketId: payload.ticketId,
          contactId: payload.contactId,
          status: "requested",
          message: "Busca de histórico solicitada. Mensagens serão sincronizadas conforme disponíveis."
        }
      };

      await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.history.status`, statusEvent);

    } catch (error) {
      logger.error(`[HistorySync] Error syncing history for ${payload.contactNumber}:`, error);

      const errorEvent: Envelope = {
        id: uuidv4(),
        timestamp: Date.now(),
        tenantId,
        type: "history.status",
        payload: {
          sessionId: payload.sessionId,
          ticketId: payload.ticketId,
          status: "error",
          message: `Erro ao buscar histórico: ${error}`
        }
      };

      await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.history.status`, errorEvent);
    }
  }
  private async sendButtons(payload: SendButtonsPayload) {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: "1",
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.*.${payload.sessionId}.message.ack`, ackEvent);
      }
      logger.error(`Session ${payload.sessionId} not found for sending buttons`);
      return;
    }

    try {
      const jid = await this.validateAndCorrectJid(session, payload.to, undefined, session.tenantId);

      const buttons = payload.buttons.map(btn => ({
        buttonId: btn.buttonId,
        buttonText: { displayText: btn.buttonText },
        type: 1
      }));

      const buttonMessage: any = {
        text: payload.text,
        footer: payload.footer,
        buttons: buttons,
        headerType: 1,
        mentions: payload.mentions
      };

      if (payload.imageUrl) {
        buttonMessage.image = { url: payload.imageUrl };
        buttonMessage.headerType = 4;
      }

      const waMsgId = (payload.messageId && payload.messageId.startsWith("3EB0"))
        ? payload.messageId
        : this.generateWAMessageId();

      this.recentlySent.add(waMsgId);
      setTimeout(() => this.recentlySent.delete(waMsgId), 10000);

      const quotedMsg = this.createQuoted(payload.options);
      const msg = await session.socket.sendMessage(jid, buttonMessage as any, { quoted: quotedMsg, messageId: waMsgId });

      if (msg) {
        await this.handleMessage(msg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
      }
    } catch (error) {
      logger.error(`Error sending buttons to ${payload.to}: ${error}`);
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: session.tenantId,
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.${session.tenantId}.${payload.sessionId}.message.ack`, ackEvent);
      }
    }
  }

  private async sendList(payload: SendListPayload) {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: "1",
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.*.${payload.sessionId}.message.ack`, ackEvent);
      }
      logger.error(`Session ${payload.sessionId} not found for sending list`);
      return;
    }

    try {
      const jid = await this.validateAndCorrectJid(session, payload.to, undefined, session.tenantId);

      const listMessage = {
        text: payload.text,
        footer: payload.footer,
        title: payload.text.split('\n')[0], // Use first line as title if not provided
        buttonText: payload.buttonText,
        sections: payload.sections
      };

      const waMsgId = (payload.messageId && payload.messageId.startsWith("3EB0"))
        ? payload.messageId
        : this.generateWAMessageId();

      this.recentlySent.add(waMsgId);
      setTimeout(() => this.recentlySent.delete(waMsgId), 10000);

      const quotedMsg = this.createQuoted(payload.options);
      const msg = await session.socket.sendMessage(jid, listMessage as any, { quoted: quotedMsg, messageId: waMsgId });

      if (msg) {
        await this.handleMessage(msg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
      }
    } catch (error) {
      logger.error(`Error sending list to ${payload.to}: ${error}`);
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: session.tenantId,
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.${session.tenantId}.${payload.sessionId}.message.ack`, ackEvent);
      }
    }
  }

  private async sendPoll(payload: SendPollPayload) {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: "1",
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.*.${payload.sessionId}.message.ack`, ackEvent);
      }
      logger.error(`Session ${payload.sessionId} not found for sending poll`);
      return;
    }

    try {
      const jid = await this.validateAndCorrectJid(session, payload.to, undefined, session.tenantId);

      const waMsgId = (payload.messageId && payload.messageId.startsWith("3EB0"))
        ? payload.messageId
        : this.generateWAMessageId();

      this.recentlySent.add(waMsgId);
      setTimeout(() => this.recentlySent.delete(waMsgId), 10000);

      const quotedMsg = this.createQuoted(payload.sendOptions);
      const msg = await session.socket.sendMessage(jid, {
        poll: {
          name: payload.name,
          values: payload.options,
          selectableCount: payload.selectableCount || 1
        }
      } as any, { quoted: quotedMsg, messageId: waMsgId });

      if (msg) {
        await this.handleMessage(msg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
      }
    } catch (error) {
      logger.error(`Error sending poll to ${payload.to}: ${error}`);
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: session.tenantId,
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.${session.tenantId}.${payload.sessionId}.message.ack`, ackEvent);
      }
    }
  }

  private async sendTemplate(payload: SendTemplatePayload) {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: "1",
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.*.${payload.sessionId}.message.ack`, ackEvent);
      }
      logger.error(`Session ${payload.sessionId} not found for sending template`);
      return;
    }

    try {
      const jid = await this.validateAndCorrectJid(session, payload.to, undefined, session.tenantId);

      const templateButtons = payload.buttons.map((btn: any, index: number) => {
        const base = { index: index + 1 };
        if (btn.type === 'url') {
          return { ...base, urlButton: { displayText: btn.text, url: btn.url } };
        } else if (btn.type === 'call') {
          return { ...base, callButton: { displayText: btn.text, phoneNumber: btn.phoneNumber } };
        } else {
          return { ...base, quickReplyButton: { displayText: btn.text, id: btn.buttonId } };
        }
      });

      const message: any = {
        text: payload.text,
        footer: payload.footer,
        templateButtons: templateButtons
      };

      if (payload.mediaUrl) {
        // Logic for image/video in template header
        message.image = { url: payload.mediaUrl }; // Simplification, could check extension
      }

      const waMsgId = (payload.messageId && payload.messageId.startsWith("3EB0"))
        ? payload.messageId
        : this.generateWAMessageId();

      this.recentlySent.add(waMsgId);
      setTimeout(() => this.recentlySent.delete(waMsgId), 10000);

      const quotedMsg = this.createQuoted(payload.options);
      const msg = await session.socket.sendMessage(jid, message as any, { quoted: quotedMsg, messageId: waMsgId });

      if (msg) {
        await this.handleMessage(msg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
      }
    } catch (error) {
      logger.error(`Error sending template to ${payload.to}: ${error}`);
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: session.tenantId,
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.${session.tenantId}.${payload.sessionId}.message.ack`, ackEvent);
      }
    }
  }

  private async sendInteractive(payload: SendInteractivePayload) {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: "1",
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.*.${payload.sessionId}.message.ack`, ackEvent);
      }
      logger.error(`Session ${payload.sessionId} not found for sending interactive message`);
      return;
    }

    try {
      const jid = await this.validateAndCorrectJid(session, payload.to, undefined, session.tenantId);

      // Native Flow implementation for Interactive Message (Robust for URL buttons)
      const buttons = payload.buttons.map((btn: any) => {
        if (btn.type === 'url') {
          return {
            name: "cta_url",
            buttonParamsJson: JSON.stringify({
              display_text: btn.text,
              url: btn.url,
              merchant_url: btn.url
            })
          };
        } else {
          return {
            name: "quick_reply",
            buttonParamsJson: JSON.stringify({
              display_text: btn.text,
              id: btn.buttonId || `btn_${Math.random().toString(36).substring(7)}`
            })
          };
        }
      });

      const interactiveMessage = {
        viewOnceMessage: {
          message: {
            interactiveMessage: {
              body: { text: payload.text },
              footer: { text: payload.footer },
              header: payload.mediaUrl ? {
                title: "",
                subtitle: "",
                hasMediaAttachment: true,
                imageMessage: { url: payload.mediaUrl }
              } : { hasMediaAttachment: false },
              nativeFlowMessage: {
                buttons: buttons,
                messageParamsJson: "",
                messageVersion: 1
              }
            }
          }
        }
      };

      const waMsgId = (payload.messageId && payload.messageId.startsWith("3EB0"))
        ? payload.messageId
        : this.generateWAMessageId();

      this.recentlySent.add(waMsgId);
      setTimeout(() => this.recentlySent.delete(waMsgId), 10000);

      const quotedMsg = this.createQuoted(payload.options);
      const msg = await session.socket.sendMessage(jid, interactiveMessage as any, { quoted: quotedMsg, messageId: waMsgId });

      if (msg) {
        if (!msg.message) msg.message = {};
        // Ensure structure for correct parsing in handleMessage or frontend display
        if (!msg.message.viewOnceMessage) msg.message.viewOnceMessage = { message: {} };
        if (!msg.message.viewOnceMessage.message) msg.message.viewOnceMessage.message = {};
        if (!msg.message.viewOnceMessage.message.interactiveMessage) msg.message.viewOnceMessage.message.interactiveMessage = {};
        if (!msg.message.viewOnceMessage.message.interactiveMessage.body) msg.message.viewOnceMessage.message.interactiveMessage.body = {};

        msg.message.viewOnceMessage.message.interactiveMessage.body.text = payload.text;

        await this.handleMessage(msg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
      }
    } catch (error) {
      logger.error(`Error sending interactive message to ${payload.to}: ${error}`);
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: session.tenantId,
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.${session.tenantId}.${payload.sessionId}.message.ack`, ackEvent);
      }
    }
  }

  private async sendCarousel(payload: SendCarouselPayload) {
    const session = this.sessions.get(payload.sessionId);
    if (!session) {
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: "1",
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.*.${payload.sessionId}.message.ack`, ackEvent);
      }
      logger.error(`Session ${payload.sessionId} not found for sending carousel`);
      return;
    }

    try {
      const jid = await this.validateAndCorrectJid(session, payload.to, undefined, session.tenantId);

      const cards = await Promise.all(payload.cards.map(async (card) => {
        const buttons = card.buttons.map(btn => {
          if (btn.type === 'url') {
            return {
              name: "cta_url",
              buttonParamsJson: JSON.stringify({
                display_text: btn.displayText,
                url: btn.url,
                merchant_url: btn.url
              })
            };
          } else {
            return {
              name: "quick_reply",
              buttonParamsJson: JSON.stringify({
                display_text: btn.displayText,
                id: btn.id
              })
            };
          }
        });

        const cardObj: any = {
          body: { text: card.body },
          footer: { text: card.footer || "" },
          nativeFlowMessage: {
            buttons: buttons
          }
        };

        if (card.header && card.header.imageUrl) {
          // Prepare media for card header
          const media = await prepareWAMessageMedia(
            { image: { url: card.header.imageUrl } },
            { upload: session.socket.waUploadToServer }
          );
          cardObj.header = {
            title: card.header.title || "",
            subtitle: card.header.subtitle || "",
            hasMediaAttachment: true,
            ...media
          };
        } else {
          cardObj.header = {
            title: card.header?.title || "",
            subtitle: card.header?.subtitle || "",
            hasMediaAttachment: false
          };
        }

        return cardObj;
      }));

      // UPDATED: Strictly match ichat-2 structure: No top-level body/footer/header for Carousel
      const messageContent = {
        interactiveMessage: {
          carouselMessage: {
            cards: cards,
            messageVersion: 1
          }
        }
      };

      const quotedMsg = this.createQuoted(payload.options);
      const msg = generateWAMessageFromContent(jid, messageContent as any, {
        userJid: session.socket.user?.id || "",
        quoted: quotedMsg
      });

      if (msg.key.id) {
        this.recentlySent.add(msg.key.id);
        setTimeout(() => this.recentlySent.delete(msg.key.id!), 10000);
      }

      await session.socket.relayMessage(jid, msg.message!, {
        messageId: msg.key.id!
      });

      // Manually trigger handleMessage because relayMessage doesn't return a full message object
      // and we want to store it. But we need to construct a fake message object.
      // Or we can just trust the relay was successful if no error.
      // But handleMessage expects a full WAMessage.
      // Let's try to construct a minimal one.
      const fakeMsg: any = {
        key: msg.key,
        message: msg.message,
        messageTimestamp: Math.floor(Date.now() / 1000)
      };
      await this.handleMessage(fakeMsg, session.socket, payload.sessionId, session.tenantId, payload.messageId);

    } catch (error) {
      logger.error(`Error sending carousel to ${payload.to}: ${error}`);
      if (payload.messageId) {
        const ackEvent: Envelope = {
          id: uuidv4(),
          timestamp: Date.now(),
          tenantId: session.tenantId,
          type: "message.ack",
          payload: {
            sessionId: payload.sessionId,
            messageId: payload.messageId,
            ack: 5 // Error
          }
        };
        await this.rabbitmq.publishEvent(`wbot.${session.tenantId}.${payload.sessionId}.message.ack`, ackEvent);
      }
    }
  }
}

export { SessionManager };
