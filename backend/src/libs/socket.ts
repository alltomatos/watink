import { Server as SocketIO } from "socket.io";
import { Server } from "http";
import { verify } from "jsonwebtoken";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import authConfig from "../config/auth";
import UserOnlineService from "../services/UserServices/UserOnlineService";

let io: SocketIO;

// Define token payload interface
interface TokenPayload {
  id: number;
  username: string;
  profile: string;
  iat: number;
  exp: number;
}

export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, true);
      },
      credentials: true
    }
  });

  io.on("connection", async socket => {
    const { token } = socket.handshake.query;
    logger.info(`[Socket Debug] Connection attempt. Token provided: ${token ? "YES" : "NO"}`);

    let tokenData: TokenPayload | null = null;
    try {
      tokenData = verify(token as string, authConfig.secret) as TokenPayload;
      logger.debug(JSON.stringify(tokenData), "io-onConnection: tokenData");
    } catch (err: any) {
      logger.error(`[Socket Debug] Token verification failed: ${err.message}`);
      if (err.name === "TokenExpiredError") {
        logger.warn(`Socket authentication failed: Token expired at ${err.expiredAt}`);
      } else {
        logger.error(JSON.stringify(err), "Error decoding token");
      }
      socket.disconnect();
      return io;
    }

    // Extract userId from token
    const userId = tokenData?.id;

    // Track user as online in Redis
    if (userId) {
      await UserOnlineService.setUserOnline(userId, socket.id);

      // Store userId in socket data for disconnect handler
      socket.data = socket.data || {};
      socket.data.userId = userId;
    }

    logger.info(`Client Connected (userId: ${userId || "unknown"}, socketId: ${socket.id})`);

    socket.on("joinChatBox", (ticketId: string) => {
      logger.info("A client joined a ticket channel");
      socket.join(ticketId);
    });

    socket.on("joinNotification", () => {
      logger.info("A client joined notification channel");
      socket.join("notification");
    });

    socket.on("joinTickets", (status: string) => {
      logger.info(`A client joined to ${status} tickets channel.`);
      socket.join(status);
    });

    socket.on("joinHelpdeskKanban", () => {
      logger.info("A client joined helpdesk kanban channel");
      socket.join("helpdesk-kanban");
    });

    // Heartbeat event to refresh online status (optional client-side ping)
    socket.on("heartbeat", async () => {
      if (socket.data.userId) {
        await UserOnlineService.refreshUserOnline(socket.data.userId);
      }
    });

    socket.on("disconnect", async () => {
      const disconnectedUserId = socket.data.userId;

      if (disconnectedUserId) {
        await UserOnlineService.setUserOffline(disconnectedUserId, socket.id);
      }

      logger.info(`Client disconnected (userId: ${disconnectedUserId || "unknown"}, socketId: ${socket.id})`);
    });

    return socket;
  });
  return io;
};

export const getIO = (): SocketIO => {
  if (!io) {
    throw new AppError("Socket IO not initialized");
  }
  return io;
};

