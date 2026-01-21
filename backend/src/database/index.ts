import { Sequelize } from "sequelize-typescript";
import User from "../models/User";
import Setting from "../models/Setting";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import ContactCustomField from "../models/ContactCustomField";
import Message from "../models/Message";
import Queue from "../models/Queue";
import WhatsappQueue from "../models/WhatsappQueue";
import UserQueue from "../models/UserQueue";
import UserGroup from "../models/UserGroup";
import QuickAnswer from "../models/QuickAnswer";
import Tenant from "../models/Tenant";
import Pipeline from "../models/Pipeline";
import PipelineStage from "../models/PipelineStage";
import Deal from "../models/Deal";
import Flow from "../models/Flow";
import FlowSession from "../models/FlowSession";
import FlowTrigger from "../models/FlowTrigger";
import KnowledgeBase from "../models/KnowledgeBase";
import KnowledgeSource from "../models/KnowledgeSource";
import KnowledgeVector from "../models/KnowledgeVector";
import Group from "../models/Group";
import GroupPermission from "../models/GroupPermission";
import Permission from "../models/Permission";
import UserPermission from "../models/UserPermission";
import Client from "../models/Client";
import ClientAddress from "../models/ClientAddress";
import ClientContact from "../models/ClientContact";
import Protocol from "../models/Protocol";
import ProtocolHistory from "../models/ProtocolHistory";
import ProtocolAttachment from "../models/ProtocolAttachment";
import ConversationEmbedding from "../models/ConversationEmbedding";
import Plugin from "../models/Plugin";
import PluginInstallation from "../models/PluginInstallation";
import TenantSmtpSettings from "../models/TenantSmtpSettings";
import Step from "../models/Step";
import EmailTemplate from "../models/EmailTemplate";

// eslint-disable-next-line
const dbConfig = require("../config/database");

const sequelize = new Sequelize(dbConfig);

const models = [
  User,
  Contact,
  Ticket,
  Message,
  Whatsapp,
  ContactCustomField,
  Setting,
  Queue,
  WhatsappQueue,
  UserQueue,
  UserGroup,
  QuickAnswer,
  Tenant,
  Pipeline,
  PipelineStage,
  Deal,
  Flow,
  FlowSession,
  FlowTrigger,
  KnowledgeBase,
  KnowledgeSource,
  KnowledgeVector,
  Group,
  GroupPermission,
  Permission,
  UserPermission,
  Client,
  ClientAddress,
  ClientContact,
  Protocol,
  ProtocolHistory,
  ProtocolAttachment,
  ConversationEmbedding,
  TenantSmtpSettings,
  Plugin,
  PluginInstallation,
  Step,
  EmailTemplate
];

sequelize.addModels(models);

export default sequelize;
