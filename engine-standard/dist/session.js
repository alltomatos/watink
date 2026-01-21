"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const logger_1 = require("./logger");
const uuid_1 = require("uuid");
const whaileys_1 = __importStar(require("whaileys"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
class SessionManager {
    constructor(rabbitmq) {
        this.sessions = new Map();
        this.retries = new Map();
        this.manuallyDisconnected = new Set();
        this.recentlySent = new Set();
        this.avatarCache = new Map();
        this.rabbitmq = rabbitmq;
        this.sessionsDir = path_1.default.resolve(__dirname, "..", ".sessions_auth");
        if (!fs_1.default.existsSync(this.sessionsDir)) {
            fs_1.default.mkdirSync(this.sessionsDir, { recursive: true });
        }
    }
    async handleCommand(envelope) {
        logger_1.logger.info(`Received command: ${envelope.type}`);
        switch (envelope.type) {
            case "session.start":
                await this.startSession(envelope.payload, envelope.tenantId);
                break;
            case "session.stop":
                await this.stopSession(envelope.payload.sessionId, envelope.tenantId);
                break;
            case "message.send.text":
                await this.sendText(envelope.payload);
                break;
            case "message.send.media":
                await this.sendMedia(envelope.payload, envelope.tenantId);
                break;
            case "message.send.buttons":
                await this.sendButtons(envelope.payload);
                break;
            case "message.send.list":
                await this.sendList(envelope.payload);
                break;
            case "message.send.poll":
                await this.sendPoll(envelope.payload);
                break;
            case "message.send.template":
                await this.sendTemplate(envelope.payload);
                break;
            case "message.send.interactive":
                await this.sendInteractive(envelope.payload);
                break;
            case "message.send.carousel":
                await this.sendCarousel(envelope.payload);
                break;
            case "contact.sync":
                await this.syncContact(envelope.payload, envelope.tenantId);
                break;
            case "message.markAsRead":
                await this.markAsRead(envelope.payload);
                break;
            case "contact.import":
                await this.importContacts(envelope.payload, envelope.tenantId);
                break;
            case "history.sync":
                await this.syncHistory(envelope.payload, envelope.tenantId);
                break;
            default:
                logger_1.logger.warn(`Unknown command type: ${envelope.type}`);
        }
    }
    async syncContact(payload, tenantId) {
        const session = this.sessions.get(payload.sessionId);
        if (!session) {
            logger_1.logger.error(`Session ${payload.sessionId} not found for syncing contact`);
            return;
        }
        try {
            logger_1.logger.info(`Syncing contact ${payload.number} for session ${payload.sessionId}`);
            let jid = payload.lid || (payload.number.includes("@") ? payload.number : `${payload.number}@s.whatsapp.net`);
            const isGroup = payload.isGroup || jid.endsWith("@g.us");
            let profilePicUrl = undefined;
            let pushName = undefined;
            let foundLid = payload.lid;
            if (isGroup) {
                // Force correct JID format for groups
                if (!jid.endsWith("@g.us"))
                    jid = `${payload.number}@g.us`;
                try {
                    // 1. Fetch Group Metadata for Subject
                    const groupMetadata = await session.socket.groupMetadata(jid);
                    if (groupMetadata && groupMetadata.subject) {
                        pushName = groupMetadata.subject;
                    }
                }
                catch (err) {
                    logger_1.logger.warn(`Error fetching group metadata for ${jid}: ${err}`);
                }
                try {
                    // 2. Fetch Group Profile Picture
                    profilePicUrl = await session.socket.profilePictureUrl(jid, "image").catch(() => null);
                }
                catch (err) { }
            }
            else {
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
                                if (result.lid)
                                    foundLid = result.lid;
                                // Tenta buscar foto com JID confirmado
                                if (!profilePicUrl) {
                                    profilePicUrl = await session.socket.profilePictureUrl(result.jid, "image").catch(() => "");
                                }
                            }
                        }
                    }
                    catch (err) {
                        logger_1.logger.warn(`Error checking onWhatsApp for ${payload.number}:`, err);
                    }
                    // B. Se ainda não temos LID e é um número de telefone, tenta USync
                    if (!foundLid && !jid.includes("@lid")) {
                        try {
                            logger_1.logger.info(`Attempting USync to resolve LID for ${payload.number}`);
                            const query = new whaileys_1.USyncQuery()
                                .withMode("query")
                                .withUser(new whaileys_1.USyncUser().withPhone(payload.number))
                                .withLIDProtocol();
                            const result = await session.socket.executeUSyncQuery(query);
                            if (result && result.list && result.list.length > 0) {
                                const record = result.list[0];
                                // @ts-ignore
                                if (record.lid) {
                                    foundLid = record.lid;
                                    logger_1.logger.info(`USync resolved LID for ${payload.number}: ${foundLid}`);
                                }
                            }
                        }
                        catch (err) {
                            logger_1.logger.warn(`Error executing USync for ${payload.number}:`, err);
                        }
                    }
                }
                // Se descobrimos um LID e não tínhamos foto, tenta buscar foto pelo LID
                if (foundLid && !profilePicUrl) {
                    profilePicUrl = await session.socket.profilePictureUrl(foundLid, "image").catch(() => "");
                }
            }
            const updateEvent = {
                id: (0, uuid_1.v4)(),
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
        }
        catch (error) {
            logger_1.logger.error(`Error syncing contact ${payload.number}:`, error);
        }
    }
    async stopSession(sessionId, tenantId) {
        logger_1.logger.info(`Stopping session ${sessionId} for tenant ${tenantId}`);
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
        }
        catch (err) {
            logger_1.logger.error(`Error stopping session ${sessionId}`, err);
        }
        const statusEvent = {
            id: (0, uuid_1.v4)(),
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
    async startSession(payload, tenantId) {
        logger_1.logger.info(`Starting session ${payload.sessionId}`);
        try {
            if (this.sessions.has(payload.sessionId) && !payload.force) {
                logger_1.logger.info(`Session ${payload.sessionId} already exists`);
                const session = this.sessions.get(payload.sessionId);
                const currentStatus = session?.status === "CONNECTED" ? "CONNECTED" : "OPENING";
                logger_1.logger.info(`Session ${payload.sessionId} status is ${session?.status}, sending ${currentStatus}`);
                const statusEvent = {
                    id: (0, uuid_1.v4)(),
                    timestamp: Date.now(),
                    tenantId,
                    type: "session.status",
                    payload: {
                        sessionId: payload.sessionId,
                        status: currentStatus
                    }
                };
                await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.session.status`, statusEvent);
                return;
            }
            // Notify backend that session is opening (only if we are actually starting a new one)
            const openingEvent = {
                id: (0, uuid_1.v4)(),
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
                logger_1.logger.info(`Forcing session start for ${payload.sessionId}, stopping existing session...`);
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
                logger_1.logger.info(`Pairing code requested for session ${payload.sessionId}, cleaning up old auth files...`);
                await this.cleanupSession(payload.sessionId);
            }
            const { state, saveCreds } = await (0, whaileys_1.useMultiFileAuthState)(path_1.default.join(this.sessionsDir, `session-${payload.sessionId}`));
            const { version, isLatest } = await (0, whaileys_1.fetchLatestBaileysVersion)();
            logger_1.logger.info(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);
            // Adjust browser config for pairing code to avoid 401 and "Unable to connect"
            // Using Ubuntu signature is often more stable for Pairing Code
            const browserConfig = payload.usePairingCode ? ["Ubuntu", "Chrome", "20.0.04"] : ["Mac OS", "Chrome", "121.0.6167.85"];
            logger_1.logger.info(`Session ${payload.sessionId} starting with browser config: ${JSON.stringify(browserConfig)} (usePairingCode: ${payload.usePairingCode})`);
            const sock = (0, whaileys_1.default)({
                version,
                auth: state,
                printQRInTerminal: false,
                logger: logger_1.logger.child({ level: "warn" }),
                browser: browserConfig,
                syncFullHistory: false, // Histórico sempre desativado - busca sob demanda via history.sync
                connectTimeoutMs: 60000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 2000,
                generateHighQualityLinkPreview: true,
            });
            // Salva o socket e o status inicial
            this.sessions.set(payload.sessionId, { socket: sock, status: "OPENING", tenantId });
            sock.ev.on("creds.update", saveCreds);
            // Variables for pairing code flow
            let pairingCodeRequested = false;
            const requestPairingCodeWithRetry = async () => {
                if (!payload.usePairingCode || !payload.phoneNumber)
                    return;
                const MAX_RETRIES = 5;
                const RETRY_DELAY_MS = 5000;
                const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
                let lastError = null;
                for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
                    try {
                        if (sock.authState.creds.registered) {
                            logger_1.logger.info(`Session ${payload.sessionId} already registered, skipping pairing code.`);
                            return;
                        }
                        logger_1.logger.info(`Requesting pairing code for session ${payload.sessionId} - Phone: ${payload.phoneNumber} (attempt ${attempt}/${MAX_RETRIES})`);
                        // Removing aggressive check for ws.readyState as it causes issues with some Baileys versions
                        // We rely on the fact that we received a QR code event or are in a state to request it.
                        const code = await sock.requestPairingCode(payload.phoneNumber);
                        // Format code as XXXX-XXXX
                        const formattedCode = code ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
                        logger_1.logger.info(`Pairing code generated for session ${payload.sessionId}: ${formattedCode}`);
                        const pairingEvent = {
                            id: (0, uuid_1.v4)(),
                            timestamp: Date.now(),
                            tenantId,
                            type: "session.pairingcode",
                            payload: {
                                sessionId: payload.sessionId,
                                pairingCode: formattedCode
                            }
                        };
                        logger_1.logger.info(`Publishing pairing code event for session ${payload.sessionId} code ${formattedCode}`);
                        await this.rabbitmq.publishEvent(`wbot.${tenantId}.${payload.sessionId}.session.pairingcode`, pairingEvent);
                        return; // Success, exit function
                    }
                    catch (error) {
                        lastError = error;
                        logger_1.logger.warn(`Attempt ${attempt}/${MAX_RETRIES} failed for pairing code: ${error.message}`);
                        // Rate limit - don't retry
                        if (error.message?.includes("rate-overlimit")) {
                            logger_1.logger.error(`Rate limit reached for session ${payload.sessionId}, not retrying.`);
                            break;
                        }
                        // Connection Closed or Failure - wait and retry
                        if ((error.message?.includes("Connection Closed") || error.message?.includes("Connection Failure")) && attempt < MAX_RETRIES) {
                            logger_1.logger.info(`Connection issue (${error.message}), waiting ${RETRY_DELAY_MS}ms before retry...`);
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
                    logger_1.logger.error(`Failed to generate pairing code for session ${payload.sessionId} after ${MAX_RETRIES} attempts. Last error: ${lastError.message}`);
                }
                pairingCodeRequested = false; // Reset on error to allow retry
            };
            // Fallback: Se não recebermos QR em 10s, tentar pedir o código
            if (payload.usePairingCode && payload.phoneNumber && !sock.authState.creds.registered) {
                setTimeout(async () => {
                    if (!pairingCodeRequested && !sock.authState.creds.registered) {
                        logger_1.logger.info(`Fallback: Requesting pairing code for session ${payload.sessionId} after timeout`);
                        pairingCodeRequested = true;
                        await requestPairingCodeWithRetry();
                    }
                }, 10000);
            }
            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect, qr } = update;
                if (qr && !payload.usePairingCode) {
                    logger_1.logger.info(`QR Code generated for session ${payload.sessionId}`);
                    const qrEvent = {
                        id: (0, uuid_1.v4)(),
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
                }
                else if (qr && payload.usePairingCode) {
                    logger_1.logger.info(`QR Code received for session ${payload.sessionId}, triggering pairing code flow...`);
                    if (!pairingCodeRequested && !sock.authState.creds.registered) {
                        pairingCodeRequested = true;
                        await requestPairingCodeWithRetry();
                    }
                }
                if (connection === "close") {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const currentRetries = this.retries.get(payload.sessionId) || 0;
                    const wasManuallyDisconnected = this.manuallyDisconnected.has(payload.sessionId);
                    // Status codes that should NOT trigger auto-reconnect
                    const noRetryCodes = [
                        whaileys_1.DisconnectReason.loggedOut, // 401 - User logged out
                        whaileys_1.DisconnectReason.forbidden, // 403 - Banned
                        whaileys_1.DisconnectReason.badSession // 500 - Auth file corrupted
                    ];
                    const shouldReconnect = statusCode === undefined || !noRetryCodes.includes(statusCode);
                    logger_1.logger.warn(`Connection closed for session ${payload.sessionId}, statusCode: ${statusCode}, reconnecting: ${shouldReconnect}, manual: ${wasManuallyDisconnected}, attempt: ${currentRetries}`);
                    // Skip reconnection if manually disconnected
                    if (wasManuallyDisconnected) {
                        this.manuallyDisconnected.delete(payload.sessionId);
                        this.retries.delete(payload.sessionId);
                        this.sessions.delete(payload.sessionId);
                        logger_1.logger.info(`Session ${payload.sessionId} was manually disconnected, skipping reconnection.`);
                        return;
                    }
                    // Cleanup auth on badSession to allow fresh start
                    if (statusCode === whaileys_1.DisconnectReason.badSession) {
                        logger_1.logger.warn(`Bad session detected for session ${payload.sessionId}, cleaning up auth files.`);
                        await this.cleanupSession(payload.sessionId);
                    }
                    // Special handling for Pairing Code flow: Treat 401 as retryable if using pairing code and not registered
                    if (payload.usePairingCode && !sock.authState.creds.registered && statusCode === whaileys_1.DisconnectReason.loggedOut) {
                        logger_1.logger.warn(`401 Logged Out during Pairing Code flow for session ${payload.sessionId} - Cleaning up and Retrying`);
                        // ... (cleanup logic same as before) ...
                        try {
                            sock.end(undefined);
                            this.sessions.delete(payload.sessionId);
                        }
                        catch (e) {
                            logger_1.logger.warn(`Error closing socket for session ${payload.sessionId}`, e);
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
                        logger_1.logger.info(`Session ${payload.sessionId} reconnecting in ${delay}ms... (Attempt ${currentRetries + 1}/${payload.keepAlive ? "∞" : maxRetries})`);
                        setTimeout(() => this.startSession(payload, tenantId), delay);
                    }
                    else {
                        // Max retries reached or permanent error
                        logger_1.logger.error(`Session ${payload.sessionId} failed to connect after ${currentRetries} attempts or permanent error (code: ${statusCode}). KeepAlive: ${payload.keepAlive}`);
                        this.retries.delete(payload.sessionId);
                        this.sessions.delete(payload.sessionId);
                        const statusEvent = {
                            id: (0, uuid_1.v4)(),
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
                }
                else if (connection === "open") {
                    logger_1.logger.info(`Session ${payload.sessionId} opened`);
                    this.retries.delete(payload.sessionId);
                    const session = this.sessions.get(payload.sessionId);
                    if (session)
                        session.status = "CONNECTED";
                    let number = "";
                    let profilePicUrl = "";
                    try {
                        const userJid = sock.user?.id;
                        if (userJid) {
                            number = userJid.split(":")[0]; // Handle JID format
                            profilePicUrl = (await sock.profilePictureUrl(userJid, "image").catch(() => "")) || "";
                        }
                    }
                    catch (error) {
                        logger_1.logger.warn(`Failed to fetch profile info for session ${payload.sessionId}`, error);
                    }
                    const statusEvent = {
                        id: (0, uuid_1.v4)(),
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
                    logger_1.logger.info(`[HYDRATION] Group hydration disabled for session ${payload.sessionId}`);
                }
            });
            sock.ev.on("messages.upsert", async ({ messages, type }) => {
                if (type === "notify" || type === "append") {
                    const syncStartTimestamp = payload.syncHistory && payload.syncPeriod ? new Date(payload.syncPeriod).getTime() / 1000 : 0;
                    for (const msg of messages) {
                        if (!msg.message)
                            continue;
                        // Strict History Sync Logic: Filter by Date
                        if (payload.syncHistory && syncStartTimestamp > 0) {
                            const msgTimestamp = typeof msg.messageTimestamp === "number" ? msg.messageTimestamp : msg.messageTimestamp?.low;
                            if (msgTimestamp && msgTimestamp < syncStartTimestamp) {
                                // Ignore messages older than requested start date
                                continue;
                            }
                        }
                        // Dedup logic: If we recently sent this message (fromMe), ignore it in upsert
                        // because we already handled it with context in sendText/sendMedia
                        if (msg.key.fromMe && msg.key.id && this.recentlySent.has(msg.key.id)) {
                            logger_1.logger.info(`Ignoring upsert for recently sent message ${msg.key.id}`);
                            continue;
                        }
                        await this.handleMessage(msg, sock, payload.sessionId, tenantId);
                    }
                }
            });
            // Listen for message ACK (read receipts)
            sock.ev.on("messages.update", async (updates) => {
                for (const update of updates) {
                    if (update.update?.status) {
                        // Mapping Baileys status to our status
                        // Baileys: 0=ERROR, 1=PENDING, 2=SERVER_ACK, 3=DELIVERY_ACK, 4=READ, 5=PLAYED
                        // Our UI: 0=Clock, 1=Sent, 2=Received, 3=Read, 4=Played, 5=Error
                        const baileystatus = update.update?.status || update.status;
                        let status = 0;
                        if (baileystatus === 0) {
                            status = 5; // Error
                        }
                        else if (baileystatus === 1) {
                            status = 0; // Pending
                        }
                        else if (baileystatus === 2) {
                            status = 1; // Sent (Server ACK)
                        }
                        else if (baileystatus === 3) {
                            status = 2; // Received (Delivery ACK)
                        }
                        else if (baileystatus === 4) {
                            status = 3; // Read
                        }
                        else if (baileystatus === 5) {
                            status = 4; // Played
                        }
                        // Only emit if status changed to meaningful value
                        // Ignore if baileystatus is undefined
                        if (typeof baileystatus !== 'undefined') {
                            logger_1.logger.info(`[Ack] Message ${update.key?.id} status update: ${baileystatus} -> ${status}`);
                            const ackEvent = {
                                id: (0, uuid_1.v4)(),
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
                    else if (update.status) {
                        // Fallback for top-level status
                        const baileystatus = update.status;
                        let status = 0;
                        if (baileystatus === 4)
                            status = 3;
                        else if (baileystatus === 3)
                            status = 2;
                        else if (baileystatus === 2)
                            status = 1;
                        logger_1.logger.info(`[Ack] Message ${update.key?.id} status update (fallback): ${baileystatus} -> ${status}`);
                        const ackEvent = {
                            id: (0, uuid_1.v4)(),
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
            sock.ev.on("messages.reaction", async (reactions) => {
                for (const reaction of reactions) {
                    logger_1.logger.info(`[Reaction] Received reaction for message ${reaction.key.id}`);
                    const reactionEvent = {
                        id: (0, uuid_1.v4)(),
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
            sock.ev.on("contacts.update", async (updates) => {
                for (const update of updates) {
                    if (!update.id)
                        continue;
                    if (typeof update.imgUrl !== "undefined") {
                        const jid = update.id;
                        let profilePicUrl = undefined;
                        try {
                            profilePicUrl = await sock.profilePictureUrl(jid, "image").catch(() => null);
                        }
                        catch (e) { }
                        const updateEvent = {
                            id: (0, uuid_1.v4)(),
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
            sock.ev.on("groups.update", async (updates) => {
                for (const group of updates) {
                    if (!group.id)
                        continue;
                    const jid = group.id;
                    let profilePicUrl = undefined;
                    try {
                        profilePicUrl = await sock.profilePictureUrl(jid, "image").catch(() => null);
                    }
                    catch (e) { }
                    const updateEvent = {
                        id: (0, uuid_1.v4)(),
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
        }
        catch (err) {
            logger_1.logger.error(`Error starting session ${payload.sessionId}`, err);
            const statusEvent = {
                id: (0, uuid_1.v4)(),
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
    async cleanupSession(sessionId) {
        const sessionPath = path_1.default.join(this.sessionsDir, `session-${sessionId}`);
        logger_1.logger.info(`Attempting cleanup of session ${sessionId} at path: ${sessionPath}`);
        if (fs_1.default.existsSync(sessionPath)) {
            try {
                fs_1.default.rmSync(sessionPath, { recursive: true, force: true });
                logger_1.logger.info(`Successfully cleaned up session files for ${sessionId}`);
            }
            catch (err) {
                logger_1.logger.error(`Error cleaning up session ${sessionId}:`, err);
            }
        }
        else {
            logger_1.logger.info(`No existing session files to cleanup for session ${sessionId}`);
        }
    }
    async validateAndCorrectJid(session, jid, lid, tenantId) {
        if (jid.endsWith("@g.us"))
            return jid;
        try {
            const results = await session.socket.onWhatsApp(jid);
            const result = results?.[0];
            if (result && result.exists) {
                const correctJid = result.jid;
                if (correctJid !== jid) {
                    logger_1.logger.warn(`[validateJid] JID Mismatch: ${jid} -> ${correctJid}`);
                    if (lid) {
                        const updateEvent = {
                            id: (0, uuid_1.v4)(),
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
                }
                else {
                    logger_1.logger.info(`[validateJid] JID Verified: ${jid}`);
                    return jid;
                }
            }
            else {
                logger_1.logger.error(`[validateJid] JID ${jid} invalid or not on WhatsApp!`);
                throw new Error(`JID ${jid} is not valid on WhatsApp`);
            }
        }
        catch (error) {
            logger_1.logger.error(`[validateJid] Validation failed for ${jid}: ${error}`);
            throw error;
        }
    }
    generateWAMessageId() {
        return "3EB0" + Math.random().toString(36).slice(2).toUpperCase() + Math.random().toString(36).slice(2).toUpperCase().substring(0, 12);
    }
    // Re-writing the entire method to better handle try-catch and ID availability
    async sendText(payload) {
        const session = this.sessions.get(payload.sessionId);
        if (!session) {
            // If session not found, try to emit error if we have messageId
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
            logger_1.logger.error(`Session ${payload.sessionId} not found for sending message`);
            return;
        }
        try {
            const jid = await this.validateAndCorrectJid(session, payload.to, payload.lid, session.tenantId);
            logger_1.logger.info(`[sendText] Sending text to ${jid}: ${payload.body} (Ref Message ID: ${payload.messageId})`);
            const waMsgId = (payload.messageId && payload.messageId.startsWith("3EB0"))
                ? payload.messageId
                : this.generateWAMessageId();
            this.recentlySent.add(waMsgId);
            setTimeout(() => this.recentlySent.delete(waMsgId), 10000);
            const msg = await session.socket.sendMessage(jid, {
                text: payload.body
            }, {
                quoted: payload.options?.quotedMsgId ? { key: { id: payload.options.quotedMsgId } } : undefined,
                messageId: waMsgId
            });
            if (msg) {
                logger_1.logger.info(`[sendText] Message sent successfully. WA Msg ID: ${msg.key.id}. Ref Message ID: ${payload.messageId}`);
                // We still trigger handleMessage to ensure standard flow works (saving self-message)
                // Ideally handleMessage should maybe UPDATE the existing message if we could link them, 
                // but currently handleMessage creates a new record or upserts based on WA ID.
                await this.handleMessage(msg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
            }
            else {
                throw new Error("Message rejected (msg undefined)");
            }
        }
        catch (error) {
            logger_1.logger.error(`[sendText] Error sending message to ${payload.to}: ${error}`);
            if (payload.messageId) {
                // Emit failure ACK using the backend's message ID
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
                logger_1.logger.info(`[sendText] Emitted ACK 5 (Error) for Message ID: ${payload.messageId}`);
            }
            else {
                logger_1.logger.warn(`[sendText] Failed to send. Cannot emit ACK 5 because I don't have the context message ID.`);
            }
        }
    }
    async handleMessage(msg, sock, sessionId, tenantId, originalMessageId) {
        logger_1.logger.info(`[handleMessage] RAW ENTRY msg.key.id: ${msg?.key?.id} msg.message defined? ${!!msg?.message}`);
        if (!msg.message) {
            logger_1.logger.warn(`[handleMessage] Message ignored because msg.message is undefined. Msg ID: ${msg?.key?.id}`);
            return;
        }
        logger_1.logger.info(`[handleMessage] Processing message ${msg.key.id} fromMe: ${msg.key.fromMe}`);
        // Check for media types
        const hasMedia = !!(msg.message.imageMessage ||
            msg.message.videoMessage ||
            msg.message.audioMessage ||
            msg.message.documentMessage ||
            msg.message.stickerMessage);
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
                const buffer = await (0, whaileys_1.downloadMediaMessage)(msg, "buffer", {});
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
            }
            catch (err) {
                logger_1.logger.warn(`Error downloading media for msg ${msg.key.id}: ${err}`);
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
        // 3.1 Interactive Response (Native Flow / Carousel)
        else if (msg.message.interactiveResponseMessage) {
            const interactiveResp = msg.message.interactiveResponseMessage;
            if (interactiveResp.nativeFlowResponseMessage) {
                const params = JSON.parse(interactiveResp.nativeFlowResponseMessage.paramsJson || "{}");
                selectedButtonId = params.id;
            }
            body = interactiveResp.body?.text || "";
            msgType = "interactive_response";
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
                }
                else {
                    const fetched = await sock.profilePictureUrl(senderJid, "image").catch(() => "");
                    if (fetched) {
                        profilePicUrl = fetched;
                        this.avatarCache.set(senderJid, fetched);
                    }
                }
            }
        }
        catch (e) { }
        // Enhanced Contact Identification (LID/JID)
        let senderLid = undefined;
        const senderJid = msg.key.participant || msg.key.remoteJid || "";
        if (senderJid && !senderJid.includes("@lid")) {
            try {
                // If it's a standard JID (PN based), try to fetch the LID which is permanent
                // This answers the requirement: "todo contato tem LID mas podem haver casos de contatos antigos... sistema deve buscar o LID"
                const results = await sock.onWhatsApp(senderJid);
                const result = results?.[0];
                if (result && result.lid) {
                    senderLid = result.lid;
                }
            }
            catch (err) {
                // Ignore errors during LID fetch to not block message processing
            }
        }
        else if (senderJid && senderJid.includes("@lid")) {
            senderLid = senderJid;
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
                    logger_1.logger.info(`[handleMessage] Extracted Link Preview: ${title} - ${canonicalUrl}`);
                }
            }
        }
        catch (err) {
            logger_1.logger.warn(`[handleMessage] Error extracting quota/preview: ${err}`);
        }
        const msgEvent = {
            id: (0, uuid_1.v4)(),
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
                    timestamp: typeof msg.messageTimestamp === 'number' ? msg.messageTimestamp : 0,
                    hasMedia: hasMedia,
                    mediaData,
                    mimetype,
                    selectedButtonId,
                    selectedRowId,
                    pollVotes,
                    pushName: msg.pushName || "",
                    participant: msg.key.participant || "",
                    profilePicUrl,
                    senderLid,
                    originalId: originalMessageId,
                    quotedMsgId: quotedMsgId,
                    quotedMsg: quotedMsgObj,
                    urlPreview: urlPreviewObj
                }
            }
        };
        logger_1.logger.info(`[handleMessage] Publishing received event for ${msg.key.id} (fromMe: ${msgEvent.payload.message.fromMe})`);
        await this.rabbitmq.publishEvent(`wbot.${tenantId}.${sessionId}.message.received`, msgEvent);
    }
    async sendMedia(payload, tenantId) {
        const session = this.sessions.get(payload.sessionId);
        if (!session) {
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
            logger_1.logger.error(`Session ${payload.sessionId} not found for sending media`);
            return;
        }
        try {
            const jid = await this.validateAndCorrectJid(session, payload.to, payload.lid, session.tenantId);
            logger_1.logger.info(`Sending media to ${jid}: ${payload.media.filename}`);
            // Convert base64 to buffer
            const mediaBuffer = Buffer.from(payload.media.data, 'base64');
            const mimetype = payload.media.mimetype;
            const filename = payload.media.filename;
            let content = {};
            // Determine media type based on mimetype
            if (mimetype.startsWith('image/')) {
                content = {
                    image: mediaBuffer,
                    caption: payload.caption || '',
                    mimetype: mimetype
                };
            }
            else if (mimetype.startsWith('video/')) {
                content = {
                    video: mediaBuffer,
                    caption: payload.caption || '',
                    mimetype: mimetype
                };
            }
            else if (mimetype.startsWith('audio/')) {
                content = {
                    audio: mediaBuffer,
                    mimetype: mimetype,
                    ptt: mimetype === 'audio/ogg' // Voice note if ogg
                };
            }
            else {
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
            const msg = await session.socket.sendMessage(jid, content, { messageId: waMsgId });
            if (msg) {
                await this.handleMessage(msg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error sending media to ${payload.to}: ${error}`);
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
    async markAsRead(payload) {
        const session = this.sessions.get(payload.sessionId);
        if (!session) {
            logger_1.logger.error(`Session ${payload.sessionId} not found for marking messages as read`);
            return;
        }
        try {
            logger_1.logger.info(`Marking ${payload.messageIds.length} messages as read for ${payload.to}`);
            const keys = payload.messageIds.map(id => ({
                remoteJid: payload.to,
                id: id,
                fromMe: false // Usually we mark received messages as read
            }));
            await session.socket.readMessages(keys);
        }
        catch (err) {
            logger_1.logger.error(`Error marking messages as read for ${payload.to}:`, err);
        }
    }
    async importContacts(payload, tenantId) {
        const session = this.sessions.get(payload.sessionId);
        if (!session) {
            logger_1.logger.error(`Session ${payload.sessionId} not found for importing contacts`);
            return;
        }
        logger_1.logger.info(`[importContacts] Starting contact import for session ${payload.sessionId}`);
        // User instruction: Do not scan groups or force create contacts.
        // Contacts/Tickets should be created only when messages arrive.
        // This method is kept for architectural compatibility but currently performs no active scanning
        // to avoid creating unwanted group contacts/tickets.
        logger_1.logger.info(`[importContacts] Manual import disabled. Contacts are synced automatically via incoming messages.`);
    }
    // Busca de histórico de mensagens sob demanda para um contato/ticket específico
    async syncHistory(payload, tenantId) {
        const session = this.sessions.get(payload.sessionId);
        if (!session) {
            logger_1.logger.error(`Session ${payload.sessionId} not found for history sync`);
            return;
        }
        try {
            const jid = payload.contactNumber.includes("@")
                ? payload.contactNumber
                : `${payload.contactNumber}@s.whatsapp.net`;
            logger_1.logger.info(`[HistorySync] Fetching messages for ${jid} from ${payload.fromDate} for ticket ${payload.ticketId}`);
            const fromTimestamp = new Date(payload.fromDate).getTime() / 1000;
            const toTimestamp = payload.toDate ? new Date(payload.toDate).getTime() / 1000 : Date.now() / 1000;
            // Nota: O Baileys não possui um método direto para buscar histórico de mensagens de um chat específico
            // O histórico é sincronizado automaticamente quando syncFullHistory está ativo
            // Para busca sob demanda, precisamos usar a store local se disponível
            // ou re-sincronizar a sessão com syncFullHistory:true temporariamente
            // Por enquanto, emitimos um evento de status informando que a busca foi iniciada
            // e dependemos do mecanismo existente de messages.upsert para receber as mensagens
            // quando o WhatsApp as envia como parte de qualquer cache/sync
            logger_1.logger.info(`[HistorySync] History sync requested for ${jid}. Note: Baileys does not support on-demand history fetch.`);
            logger_1.logger.info(`[HistorySync] Messages will be captured via normal upsert flow if WhatsApp sends them.`);
            // Emitir evento de status para o backend
            const statusEvent = {
                id: (0, uuid_1.v4)(),
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
        }
        catch (error) {
            logger_1.logger.error(`[HistorySync] Error syncing history for ${payload.contactNumber}:`, error);
            const errorEvent = {
                id: (0, uuid_1.v4)(),
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
    async sendButtons(payload) {
        const session = this.sessions.get(payload.sessionId);
        if (!session) {
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
            logger_1.logger.error(`Session ${payload.sessionId} not found for sending buttons`);
            return;
        }
        try {
            const jid = await this.validateAndCorrectJid(session, payload.to, undefined, session.tenantId);
            const buttons = payload.buttons.map(btn => ({
                buttonId: btn.buttonId,
                buttonText: { displayText: btn.buttonText },
                type: 1
            }));
            const buttonMessage = {
                text: payload.text,
                footer: payload.footer,
                buttons: buttons,
                headerType: 1
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
            const msg = await session.socket.sendMessage(jid, buttonMessage, { messageId: waMsgId });
            if (msg) {
                await this.handleMessage(msg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error sending buttons to ${payload.to}: ${error}`);
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
    async sendList(payload) {
        const session = this.sessions.get(payload.sessionId);
        if (!session) {
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
            logger_1.logger.error(`Session ${payload.sessionId} not found for sending list`);
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
            const msg = await session.socket.sendMessage(jid, listMessage, { messageId: waMsgId });
            if (msg) {
                await this.handleMessage(msg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error sending list to ${payload.to}: ${error}`);
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
    async sendPoll(payload) {
        const session = this.sessions.get(payload.sessionId);
        if (!session) {
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
            logger_1.logger.error(`Session ${payload.sessionId} not found for sending poll`);
            return;
        }
        try {
            const jid = await this.validateAndCorrectJid(session, payload.to, undefined, session.tenantId);
            const waMsgId = (payload.messageId && payload.messageId.startsWith("3EB0"))
                ? payload.messageId
                : this.generateWAMessageId();
            this.recentlySent.add(waMsgId);
            setTimeout(() => this.recentlySent.delete(waMsgId), 10000);
            const msg = await session.socket.sendMessage(jid, {
                poll: {
                    name: payload.name,
                    values: payload.options,
                    selectableCount: payload.selectableCount || 1
                }
            }, { messageId: waMsgId });
            if (msg) {
                await this.handleMessage(msg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error sending poll to ${payload.to}: ${error}`);
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
    async sendTemplate(payload) {
        const session = this.sessions.get(payload.sessionId);
        if (!session) {
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
            logger_1.logger.error(`Session ${payload.sessionId} not found for sending template`);
            return;
        }
        try {
            const jid = await this.validateAndCorrectJid(session, payload.to, undefined, session.tenantId);
            const templateButtons = payload.buttons.map((btn, index) => {
                const base = { index: index + 1 };
                if (btn.type === 'url') {
                    return { ...base, urlButton: { displayText: btn.text, url: btn.url } };
                }
                else if (btn.type === 'call') {
                    return { ...base, callButton: { displayText: btn.text, phoneNumber: btn.phoneNumber } };
                }
                else {
                    return { ...base, quickReplyButton: { displayText: btn.text, id: btn.buttonId } };
                }
            });
            const message = {
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
            const msg = await session.socket.sendMessage(jid, message, { messageId: waMsgId });
            if (msg) {
                await this.handleMessage(msg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error sending template to ${payload.to}: ${error}`);
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
    async sendInteractive(payload) {
        const session = this.sessions.get(payload.sessionId);
        if (!session) {
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
            logger_1.logger.error(`Session ${payload.sessionId} not found for sending interactive message`);
            return;
        }
        try {
            const jid = await this.validateAndCorrectJid(session, payload.to, undefined, session.tenantId);
            const buttons = payload.buttons.map((btn) => {
                if (btn.type === 'url') {
                    return {
                        name: "cta_url",
                        buttonParamsJson: JSON.stringify({
                            display_text: btn.text,
                            url: btn.url,
                            merchant_url: btn.url
                        })
                    };
                }
                else {
                    return {
                        name: "quick_reply",
                        buttonParamsJson: JSON.stringify({
                            display_text: btn.text,
                            id: btn.buttonId
                        })
                    };
                }
            });
            const interactiveMessage = {
                interactiveMessage: {
                    body: { text: payload.text },
                    footer: { text: payload.footer },
                    header: payload.mediaUrl ? {
                        title: "",
                        subtitle: "",
                        hasMediaAttachment: true,
                        imageMessage: { url: payload.mediaUrl } // Simplified
                    } : { hasMediaAttachment: false },
                    nativeFlowMessage: {
                        buttons: buttons
                    }
                }
            };
            // Relay message is often safer for complex interactive messages
            const waMsgId = (payload.messageId && payload.messageId.startsWith("3EB0"))
                ? payload.messageId
                : this.generateWAMessageId();
            this.recentlySent.add(waMsgId);
            setTimeout(() => this.recentlySent.delete(waMsgId), 10000);
            const msg = await session.socket.sendMessage(jid, interactiveMessage, { messageId: waMsgId });
            if (msg) {
                await this.handleMessage(msg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error sending interactive message to ${payload.to}: ${error}`);
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
    async sendCarousel(payload) {
        const session = this.sessions.get(payload.sessionId);
        if (!session) {
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
            logger_1.logger.error(`Session ${payload.sessionId} not found for sending carousel`);
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
                                display_text: btn.text,
                                url: btn.url,
                                merchant_url: btn.url
                            })
                        };
                    }
                    else {
                        return {
                            name: "quick_reply",
                            buttonParamsJson: JSON.stringify({
                                display_text: btn.text,
                                id: btn.buttonId
                            })
                        };
                    }
                });
                const cardObj = {
                    body: { text: card.body },
                    footer: { text: card.footer || "" },
                    nativeFlowMessage: {
                        buttons: buttons
                    }
                };
                if (card.headerUrl) {
                    // Prepare media for card header
                    const media = await (0, whaileys_1.prepareWAMessageMedia)({ image: { url: card.headerUrl } }, { upload: session.socket.waUploadToServer });
                    cardObj.header = {
                        hasMediaAttachment: true,
                        ...media
                    };
                }
                else {
                    cardObj.header = { hasMediaAttachment: false };
                }
                return cardObj;
            }));
            const messageContent = {
                viewOnceMessage: {
                    message: {
                        interactiveMessage: {
                            body: { text: payload.text },
                            footer: { text: payload.footer || "" },
                            header: { hasMediaAttachment: false },
                            carouselMessage: {
                                cards: cards,
                                messageVersion: 1
                            }
                        }
                    }
                }
            };
            const msg = (0, whaileys_1.generateWAMessageFromContent)(jid, messageContent, {
                userJid: session.socket.user?.id || "",
            });
            if (msg.key.id) {
                this.recentlySent.add(msg.key.id);
                setTimeout(() => this.recentlySent.delete(msg.key.id), 10000);
            }
            await session.socket.relayMessage(jid, msg.message, {
                messageId: msg.key.id
            });
            // Manually trigger handleMessage because relayMessage doesn't return a full message object
            // and we want to store it. But we need to construct a fake message object.
            // Or we can just trust the relay was successful if no error.
            // But handleMessage expects a full WAMessage.
            // Let's try to construct a minimal one.
            const fakeMsg = {
                key: msg.key,
                message: msg.message,
                messageTimestamp: Math.floor(Date.now() / 1000)
            };
            await this.handleMessage(fakeMsg, session.socket, payload.sessionId, session.tenantId, payload.messageId);
        }
        catch (error) {
            logger_1.logger.error(`Error sending carousel to ${payload.to}: ${error}`);
            if (payload.messageId) {
                const ackEvent = {
                    id: (0, uuid_1.v4)(),
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
exports.SessionManager = SessionManager;
