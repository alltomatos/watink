import { Server as SocketIO } from "socket.io";
import { Server } from "http";
import { verify } from "jsonwebtoken";
import AppError from "../errors/AppError";
import { logger } from "../utils/logger";
import authConfig from "../config/auth";

let io: SocketIO;

export const initIO = (httpServer: Server): SocketIO => {
  io = new SocketIO(httpServer, {
    cors: {
      origin: (origin, callback) => {
        callback(null, true);
      },
      credentials: true
    }
  });

  io.on("connection", socket => {
    const { token } = socket.handshake.query;
    logger.info(`[Socket Debug] Connection attempt. Token provided: ${token ? "YES" : "NO"}`);

    let tokenData = null;
    try {
      tokenData = verify(token, authConfig.secret);
      logger.debug(JSON.stringify(tokenData), "io-onConnection: tokenData");
    } catch (err) {
      logger.error(`[Socket Debug] Token verification failed: ${err.message}`);
      if (err.name === "TokenExpiredError") {
        logger.warn(`Socket authentication failed: Token expired at ${err.expiredAt}`);
      } else {
        logger.error(JSON.stringify(err), "Error decoding token");
      }
      socket.disconnect();
      return io;
    }

    logger.info("Client Connected");
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

    socket.on("disconnect", () => {
      logger.info("Client disconnected");
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
