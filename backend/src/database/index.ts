import { Sequelize } from "sequelize-typescript";
import User from "../models/User";
import Setting from "../models/Setting";
import Contact from "../models/Contact";
import ContactCustomField from "../models/ContactCustomField";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import TagGroup from "../models/TagGroup";
import Tag from "../models/Tag";
import EntityTag from "../models/EntityTag";
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
import Permission from "../models/Permission";
import Client from "../models/Client";
import ClientAddress from "../models/ClientAddress";
import ClientContact from "../models/ClientContact";
import ConversationEmbedding from "../models/ConversationEmbedding";
import Plugin from "../models/Plugin";
import PluginInstallation from "../models/PluginInstallation";
import TenantSmtpSettings from "../models/TenantSmtpSettings";
import Role from "../models/Role";
import RolePermission from "../models/RolePermission";
import UserRole from "../models/UserRole";
import GroupRole from "../models/GroupRole";
import GroupPermission from "../models/GroupPermission";
import Step from "../models/Step";
import EmailTemplate from "../models/EmailTemplate";


// eslint-disable-next-line
const dbConfig = require("../config/database");

const sequelize = new Sequelize(dbConfig);

const models = [
  User,
  Contact,
  ContactCustomField,
  Ticket,
  Message,
  Whatsapp,
  TagGroup,
  Tag,
  EntityTag,
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
  Permission,
  Client,
  ClientAddress,
  ClientContact,
  ConversationEmbedding,
  TenantSmtpSettings,
  Plugin,
  PluginInstallation,
  Role,
  RolePermission,
  UserRole,
  GroupRole,
  GroupPermission,
  Step,
  EmailTemplate,

];

sequelize.addModels(models);

sequelize.addHook("beforeFind", async (options: any) => {
  if (options.tenantId && options.transaction) {
    await sequelize.query(`SET app.current_tenant = '${options.tenantId}'`, {
      transaction: options.transaction
    });
  }
});

sequelize.addHook("beforeCreate", async (instance: any, options: any) => {
  if (instance.tenantId && options.transaction) {
    await sequelize.query(`SET app.current_tenant = '${instance.tenantId}'`, {
      transaction: options.transaction
    });
  }
});

sequelize.addHook("beforeUpdate", async (instance: any, options: any) => {
  if (instance.tenantId && options.transaction) {
    await sequelize.query(`SET app.current_tenant = '${instance.tenantId}'`, {
      transaction: options.transaction
    });
  }
});

sequelize.addHook("beforeDestroy", async (instance: any, options: any) => {
  if (instance.tenantId && options.transaction) {
    await sequelize.query(`SET app.current_tenant = '${instance.tenantId}'`, {
      transaction: options.transaction
    });
  }
});

export default sequelize;
