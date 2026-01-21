import "./bootstrap";
import "reflect-metadata";
import "express-async-errors";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import * as Sentry from "@sentry/node";
import swaggerUi from "swagger-ui-express";
import swaggerDocs from "./config/swagger";

import "./database";
import uploadConfig from "./config/upload";
import AppError from "./errors/AppError";
import routes from "./routes";
import { logger } from "./utils/logger";

Sentry.init({ dsn: process.env.SENTRY_DSN });



const app = express();

const protectedRoutesCors = cors({
  credentials: true,
  origin: (origin, callback) => {
    let frontendUrl = process.env.FRONTEND_URL || "http://app.localhost";
    if (frontendUrl.endsWith("/")) {
      frontendUrl = frontendUrl.slice(0, -1);
    }
    const allowedOrigins = [
      frontendUrl,
      frontendUrl.replace("http://", "https://"),
      frontendUrl.replace("https://", "http://"),
      "http://localhost:3000",
      "http://app.localhost"
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log(`[CORS Blocked] Origin: ${origin}, Allowed: ${allowedOrigins.join(", ")}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "Cache-Control",
    "Pragma",
    "x-tenant-id",
    "x-user-profile"
  ],
});

app.use((req, res, next) => {
  // Configurações de CORS permissivas para webchat e versionamento
  // Permitir que /webchat e /api/webchat passem sem o CORS restrito (protectedRoutesCors)
  // MAS, rotas como /webchat/version (que são internas/monitoramento) devem passar pelo CORS restrito
  // para garantir que headers corretos (Origin) sejam retornados em vez de * ou nada.
  const isWebchat = req.url.startsWith("/webchat") || req.url.startsWith("/api/webchat");
  const isVersionCheck = req.url.includes("/version");

  if (isWebchat && !isVersionCheck) {
    return next();
  }
  protectedRoutesCors(req, res, next);
});
import pluginRoutes from "./routes/pluginRoutes"; // Import plugin routes

// ... imports ...

// MOUNT PLUGIN ROUTES BEFORE BODY PARSER
// This ensures http-proxy-middleware receives the raw request stream
app.use(pluginRoutes);

app.use(cookieParser());
app.use(express.json());
app.use(Sentry.Handlers.requestHandler());
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));
app.use("/public", express.static(uploadConfig.directory));
app.use((req, res, next) => {
  console.log(`[DEBUG] ${new Date().toISOString()} - ${req.method} ${req.url}`);
  logger.info(`${req.method} ${req.url}`);
  next();
});

app.get("/test", (req, res) => {
  res.send("Backend is working!");
});

app.use(routes);

app.use(Sentry.Handlers.errorHandler());

app.use(async (err: Error, req: Request, res: Response, _: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(err);
    return res.status(err.statusCode).json({ error: err.message });
  }

  logger.error(err);
  return res.status(500).json({ error: "Internal server error" });
});

export default app;
