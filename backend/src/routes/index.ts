import { Router } from "express";

import userRoutes from "./userRoutes";
import authRoutes from "./authRoutes";
import settingRoutes from "./settingRoutes";
import contactRoutes from "./contactRoutes";
import ticketRoutes from "./ticketRoutes";
import whatsappRoutes from "./whatsappRoutes";
import messageRoutes from "./messageRoutes";
import whatsappSessionRoutes from "./whatsappSessionRoutes";
import queueRoutes from "./queueRoutes";
import quickAnswerRoutes from "./quickAnswerRoutes";
import apiRoutes from "./apiRoutes";
import microserviceRoutes from "./microserviceRoutes";
import tenantSmtpSettingsRoutes from "./tenantSmtpSettingsRoutes";
import tenantRoutes from "./tenantRoutes";
import versionRoutes from "./versionRoutes";
import postgresVersionRoutes from "./postgresVersionRoutes";
import rabbitmqVersionRoutes from "./rabbitmqVersionRoutes";
import redisVersionRoutes from "./redisVersionRoutes";
import engineVersionRoutes from "./engineVersionRoutes";
import flowVersionRoutes from "./flowVersionRoutes";

import pipelineRoutes from "./pipelineRoutes";
import dealRoutes from "./dealRoutes";
import flowRoutes from "./flowRoutes";

import groupRoutes from "./groupRoutes";
import knowledgeRoutes from "./knowledgeRoutes";
import clientRoutes from "./clientRoutes";
import protocolRoutes from "./protocolRoutes";

import pluginRoutes from "./pluginRoutes";
import aiRoutes from "./aiRoutes";
import webchatRoutes from "./WebchatRoutes";
import stepRoutes from "./stepRoutes";
import emailTemplateRoutes from "./emailTemplateRoutes";
import saasRoutes from "./saasRoutes";

import mobileRoutes from "./mobileRoutes";
import tagRoutes from "./tagRoutes";

const routes = Router();

// routes.use(userRoutes); // Moved to bottom
routes.use("/auth", authRoutes);
routes.use("/mobile/v1", mobileRoutes);
routes.use(settingRoutes);
routes.use(contactRoutes);
routes.use(ticketRoutes);
routes.use(whatsappRoutes);
routes.use(messageRoutes);
routes.use(whatsappSessionRoutes);
routes.use(queueRoutes);
routes.use(quickAnswerRoutes);
routes.use(apiRoutes);
routes.use(microserviceRoutes);
routes.use(tenantRoutes);
routes.use(groupRoutes);
routes.use("/version", versionRoutes);
routes.use(postgresVersionRoutes);
routes.use(rabbitmqVersionRoutes);
routes.use(redisVersionRoutes);
routes.use(engineVersionRoutes);
routes.use(flowVersionRoutes);
routes.use(pipelineRoutes);
routes.use(dealRoutes);
routes.use(flowRoutes);
routes.use(knowledgeRoutes);
routes.use(clientRoutes);
routes.use(protocolRoutes);
// routes.use(pluginRoutes); // Moved to app.ts to bypass body parser
routes.use(aiRoutes);
routes.use(tenantSmtpSettingsRoutes);
routes.use(emailTemplateRoutes);
routes.use(webchatRoutes);
routes.use(stepRoutes);
routes.use(saasRoutes);
routes.use(tagRoutes);
routes.use("/users", userRoutes);

export default routes;

