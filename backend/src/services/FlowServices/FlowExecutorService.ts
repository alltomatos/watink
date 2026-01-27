import axios from "axios";
import Flow from "../../models/Flow";
import FlowSession from "../../models/FlowSession";
import AppError from "../../errors/AppError";
import { logger } from "../../utils/logger";
import SendWhatsAppMessage from "../WbotServices/SendWhatsAppMessage";
import SendWhatsAppInteractive from "../WbotServices/SendWhatsAppInteractive";
import SendWhatsAppMedia from "../WbotServices/SendWhatsAppMedia";
import fs from "fs";
import path from "path";
import uploadConfig from "../../config/upload";
import { v4 as uuidv4 } from "uuid";
import ShowTicketService from "../TicketServices/ShowTicketService";
import UpdateTicketService from "../TicketServices/UpdateTicketService";

// Models para Database Node
import Contact from "../../models/Contact";
import Ticket from "../../models/Ticket";
import Message from "../../models/Message";
import User from "../../models/User";
import Queue from "../../models/Queue";
import Whatsapp from "../../models/Whatsapp";
import QuickAnswer from "../../models/QuickAnswer";
import Pipeline from "../../models/Pipeline";
import Deal from "../../models/Deal";
import PipelineStage from "../../models/PipelineStage";
import Protocol from "../../models/Protocol";
import VectorService from "../VectorService";
import { Op } from "sequelize";

interface FlowContext {
  ticketId?: number;
  contactId?: number;
  messageBody?: string; // Last received message body
  [key: string]: any;
}

interface FlowNode {
  id: string;
  type: string;
  data: any;
}

interface FlowEdge {
  source: string;
  target: string;
  sourceHandle?: string | null;
}

class FlowExecutorService {
  public async start(flowId: number, context: FlowContext): Promise<FlowSession> {
    const flow = await Flow.findByPk(flowId);
    if (!flow) throw new AppError("Flow not found", 404);

    const nodes = flow.nodes as unknown as FlowNode[];

    // 1. Create Session
    const session = await FlowSession.create({
      flowId,
      status: "active",
      context,
      entityId: context.ticketId,
      entityType: "ticket"
    });

    // 2. Find Start Node
    const startNode = nodes.find((n) => n.type === "input" || n.type === "trigger");
    if (!startNode) {
      await session.update({ status: "failed" });
      throw new AppError("Flow has no start node", 400);
    }

    // 3. Execute Start Node
    return this.runNode(session, flow, startNode);
  }

  public async next(sessionId: number, input: string): Promise<FlowSession> {
    const session = await FlowSession.findByPk(sessionId);
    if (!session || session.status !== "active") {
      throw new AppError("Session not active", 400);
    }

    const flow = await Flow.findByPk(session.flowId);
    if (!flow) throw new AppError("Flow not found", 404);

    const nodes = flow.nodes as unknown as FlowNode[];
    const edges = flow.edges as unknown as FlowEdge[];

    const currentNode = nodes.find((n) => n.id === session.currentStepId);
    if (!currentNode) {
      await session.update({ status: "failed" });
      return session;
    }

    // Update context with input
    const newContext = { ...session.context, lastInput: input };
    await session.update({ context: newContext });

    // Determine Logic Next Step
    // If it was a menu, we need to match the input to the correct option index or id to find the right handle
    let selectedHandle: string | null = null;

    if (currentNode.type === "menu") {
      const options = currentNode.data.options || [];
      // Try to find exact match on label or id (for list/buttons)
      // Input can be the text of the button or the ID if we parse correctly upstream. Assuming text for now.
      const match = options.find((o: any) => o.label.toLowerCase() === input.toLowerCase() || o.id === input);

      if (match) {
        selectedHandle = match.id;
      } else {
        // Fallback: Check if input is a number matching the index (1, 2, 3...)
        const index = parseInt(input) - 1;
        if (!isNaN(index) && options[index]) {
          selectedHandle = options[index].id;
        }
      }
    }

    // Find next node via edges
    let nextEdges = edges.filter((e) => e.source === currentNode.id);

    if (selectedHandle) {
      // If we have a specific handle (option chosen), filter edges by sourceHandle
      const specificEdge = nextEdges.find(e => e.sourceHandle === selectedHandle);
      if (specificEdge) {
        nextEdges = [specificEdge];
      }
    }

    if (nextEdges.length === 0) {
      await session.update({ status: "completed", currentStepId: null });
      return session;
    }

    const nextNodeId = nextEdges[0].target;
    // Default to first edge if no specific handle matched or logic not implemented for other types

    const nextNode = nodes.find((n) => n.id === nextNodeId);
    return this.runNode(session, flow, nextNode);
  }

  private async runNode(session: FlowSession, flow: Flow, node: any): Promise<FlowSession> {
    logger.info(`FlowExecutor: Running node ${node.id} (${node.type}) for Session ${session.id}`);

    // Update Session Pointer
    await session.update({ currentStepId: node.id });

    // Execute Logic based on Type
    try {
      switch (node.type) {
        case "input":
        case "trigger":
          // Start node, just proceed
          return this.proceedToNext(session, flow, node);

        case "output":
          // End node
          await session.update({ status: "completed", currentStepId: null });
          return session;

        case "default": // "Mensagem"
        case "message":
        case "textUpdater": // "Pergunta"
          // Passar node.data para sendMessage processar contentType e variáveis
          await this.sendMessage(session, node.data.content || node.data.label || '', node.data);

          if (node.type === "textUpdater" || node.data.waitForInput) {
            return session; // Stop and wait for user reply
          } else {
            return this.proceedToNext(session, flow, node);
          }

        case "menu":
          await this.sendMenu(session, node.data);
          return session; // Stop and wait for user reply

        case "knowledge":
          // Integração com RAG (VectorService)
          const knowledgeQuery = (session.context as any).lastInput || "";
          await this.processKnowledgeNode(session, node.data, knowledgeQuery);
          return this.proceedToNext(session, flow, node);

        // Integração Kanban/CRM
        case "pipeline":
          await this.processKanbanAction(session, node.data);
          return this.proceedToNext(session, flow, node);

        case "ticket":
          await this.updateTicket(session, node.data);
          return this.proceedToNext(session, flow, node);

        case "webhook":
          await this.processWebhookNode(session, node.data);
          return this.proceedToNext(session, flow, node);

        case "switch":
          return this.evaluateSwitch(session, flow, node);

        case "database":
          return this.executeDatabase(session, flow, node);

        case "filter":
          return this.executeFilter(session, flow, node);

        case "api":
          await this.processAPINode(session, node.data);
          return this.proceedToNext(session, flow, node);

        case "helpdesk":
          await this.processHelpdeskNode(session, node.data);
          return this.proceedToNext(session, flow, node);

        default:
          logger.warn(`Unknown node type: ${node.type}`);
          return this.proceedToNext(session, flow, node);
      }
    } catch (err) {
      logger.error(`Error executing node ${node.id}: ${err}`);
      await session.update({ status: "failed" });
      throw err;
    }
  }

  private async proceedToNext(session: FlowSession, flow: Flow, currentNode: any, sourceHandle?: string): Promise<FlowSession> {
    const nodes = flow.nodes as unknown as FlowNode[];
    const edges = flow.edges as unknown as FlowEdge[];

    // Filter edges by source and optionally sourceHandle
    const nextEdges = edges.filter((e) => {
      if (e.source !== currentNode.id) return false;
      if (sourceHandle && e.sourceHandle !== sourceHandle) return false;
      return true;
    });

    if (nextEdges.length === 0) {
      await session.update({ status: "completed", currentStepId: null });
      return session;
    }

    const nextNodeId = nextEdges[0].target;
    const nextNode = nodes.find((n) => n.id === nextNodeId);

    // Recursive call
    return this.runNode(session, flow, nextNode);
  }

  private async sendMessage(session: FlowSession, text: string, nodeData?: any) {
    const context = session.context as FlowContext;
    if (!context.ticketId) return;

    const ticket = await ShowTicketService(context.ticketId);
    if (!ticket) return;

    // Se não houver nodeData ou o tipo for texto, usar lógica simples
    const contentType = nodeData?.contentType || 'text';

    if (contentType === 'text') {
      // Substituir variáveis no texto
      const processedText = this.replaceVariables(text, context);
      await SendWhatsAppMessage({
        body: processedText,
        ticket: ticket,
        quotedMsg: null
      });
    } else {
      // Processar mídia (image, video, audio, file)
      const mediaUrl = nodeData?.mediaUrl;
      if (!mediaUrl) {
        logger.warn(`FlowExecutor: Media node without mediaUrl`);
        return;
      }

      const processedUrl = this.replaceVariables(mediaUrl, context);
      const caption = nodeData?.content ? this.replaceVariables(nodeData.content, context) : undefined;

      try {
        // Baixar mídia da URL e criar arquivo temporário
        const mediaFile = await this.downloadMedia(processedUrl, Number(ticket.tenantId));
        if (mediaFile) {
          await SendWhatsAppMedia({
            media: mediaFile,
            ticket: ticket,
            body: caption
          });
        }
      } catch (err) {
        logger.error(`FlowExecutor: Error sending media: ${err}`);
      }
    }
  }

  private async downloadMedia(url: string, tenantId: number): Promise<Express.Multer.File | null> {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const contentType = response.headers['content-type'] || 'application/octet-stream';
      const extension = this.getExtensionFromMimetype(contentType);
      const filename = `${uuidv4()}.${extension}`;

      // Criar diretório temporário se não existir
      const tempDir = path.join(uploadConfig.directory, 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const filePath = path.join(tempDir, filename);
      fs.writeFileSync(filePath, response.data);

      // Retornar objeto compatível com Multer
      return {
        fieldname: 'medias',
        originalname: filename,
        encoding: '7bit',
        mimetype: contentType,
        destination: tempDir,
        filename: filename,
        path: filePath,
        size: response.data.length,
        buffer: response.data,
        stream: null as any
      };
    } catch (err) {
      logger.error(`FlowExecutor: Failed to download media from ${url}: ${err}`);
      return null;
    }
  }

  private getExtensionFromMimetype(mimetype: string): string {
    const mimeMap: { [key: string]: string } = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/gif': 'gif',
      'image/webp': 'webp',
      'video/mp4': 'mp4',
      'video/webm': 'webm',
      'audio/mpeg': 'mp3',
      'audio/ogg': 'ogg',
      'audio/wav': 'wav',
      'application/pdf': 'pdf',
      'application/msword': 'doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx'
    };
    return mimeMap[mimetype] || 'bin';
  }

  private async sendMenu(session: FlowSession, nodeData: any) {
    const context = session.context as FlowContext;
    if (!context.ticketId) return;
    const ticket = await ShowTicketService(context.ticketId);
    if (!ticket) return;

    const options = nodeData.options || [];
    const text = nodeData.label || "Escolha uma opção:";

    if (options.length === 0) {
      await this.sendMessage(session, text);
      return;
    }

    // Determine Buttons vs List
    if (options.length <= 3) {
      await SendWhatsAppInteractive({
        body: text,
        ticket,
        buttons: options.map((o: any) => ({ label: o.label, id: o.id }))
      });
    } else {
      await SendWhatsAppInteractive({
        body: text,
        ticket,
        list: {
          title: "Opções",
          buttonText: "Abrir Menu",
          sections: [
            {
              title: "Escolha uma opção",
              rows: options.map((o: any) => ({
                id: o.id,
                title: o.label,
                description: ""
              }))
            }
          ]
        }
      });
    }
  }

  private async updateTicket(session: FlowSession, nodeData: any) {
    const context = session.context as FlowContext;
    if (!context.ticketId) return;

    const updateData: any = {};

    // Map nodeData fields to Ticket fields
    if (nodeData.queueId) updateData.queueId = nodeData.queueId;
    if (nodeData.status) updateData.status = nodeData.status; // open, pending, closed
    // if (nodeData.userId) updateData.userId = nodeData.userId; 

    if (Object.keys(updateData).length > 0) {
      await UpdateTicketService({
        ticketData: updateData,
        ticketId: context.ticketId
      });
      logger.info(`Flow: Ticket ${context.ticketId} updated via Ticket Node`, updateData);
    }
  }

  private async processTagNode(session: FlowSession, nodeData: any) {
    const context = session.context as FlowContext;
    if (!context.ticketId) return;

    const { tagAction, tagId } = nodeData;

    if (!tagId) {
      logger.warn("FlowExecutor: Tag Node missing tagId");
      return;
    }

    try {
      const ticket = await ShowTicketService(context.ticketId);
      if (!ticket) return;

      // Import dinâmico ou estático do EntityTagService?
      // Como estou no arquivo, vou adicionar import no topo se não tiver, ou usar require se necessário pra evitar circular?
      // Vou assumir que EntityTagService pode ser importado.
      const EntityTagService = require("../TagServices/EntityTagService").default;

      if (tagAction === 'remove') {
        await EntityTagService.RemoveTagFromEntity({
          tagId: parseInt(tagId),
          entityType: 'ticket', // Por padrão aplica no ticket. Opcional: permitir selecionar 'contact'
          entityId: ticket.id,
          tenantId: ticket.tenantId
        });
        // Opcional: remover do contato também? Por enquanto manter só ticket.
        // Se fosse para o contato:
        // await EntityTagService.RemoveTagFromEntity({ tagId, entityType: 'contact', ...});
      } else {
        await EntityTagService.ApplyTagToEntity({
          tagId: parseInt(tagId),
          entityType: 'ticket',
          entityId: ticket.id,
          tenantId: ticket.tenantId
        });
      }
      logger.info(`FlowExecutor: Tag ${tagAction} tagId:${tagId} on ticket:${ticket.id}`);

    } catch (err) {
      logger.error(`FlowExecutor: Error processing Tag Node: ${err}`);
    }
  }

  private async processAPINode(session: FlowSession, nodeData: any) {
    const context = session.context as FlowContext;
    let { url, method, headers, body, resultVariable } = nodeData;

    try {
      if (!url) {
        logger.warn("FlowExecutor: API Node missing URL");
        return;
      }

      url = this.replaceVariables(url, context);
      method = method || 'GET';

      let parsedHeaders = {};
      if (headers) {
        try {
          const headersStr = this.replaceVariables(headers, context);
          parsedHeaders = JSON.parse(headersStr);
        } catch (e) {
          logger.warn("FlowExecutor: Invalid API Node headers JSON", e);
        }
      }

      let parsedBody = undefined;
      if (body) {
        const bodyStr = this.replaceVariables(body, context);
        try {
          parsedBody = JSON.parse(bodyStr);
        } catch (e) {
          parsedBody = bodyStr; // Send as string if not valid JSON
        }
      }

      logger.info(`FlowExecutor: Executing API Node ${method} ${url}`);

      const response = await axios({
        method,
        url,
        headers: parsedHeaders,
        data: parsedBody
      });

      logger.info(`FlowExecutor: API Node success status: ${response.status}`);

      if (resultVariable) {
        // Store full response data or just data? Usually data is what users want.
        // Let's store data.
        const newContext = { ...context, [resultVariable]: response.data };
        await session.update({ context: newContext });
        logger.info(`FlowExecutor: API Result stored in variable ${resultVariable}`);
      }

    } catch (err: any) {
      logger.error(`FlowExecutor: API Node failed: ${err.message}`);
      // Store error info if possible so flow can verify success/fail if needed?
      // For now, let's store null or error message in the variable so user knows it failed?
      if (resultVariable) {
        const newContext = {
          ...context,
          [resultVariable]: { error: true, message: err.message, status: err.response?.status }
        };
        await session.update({ context: newContext });
      }
    }
  }

  private async processWebhookNode(session: FlowSession, nodeData: any) {
    const context = session.context as FlowContext;
    let { url, method, headers, body } = nodeData;

    try {
      url = this.replaceVariables(url, context);
      method = method || 'POST';

      let parsedHeaders = {};
      if (headers) {
        try {
          const headersStr = this.replaceVariables(headers, context);
          parsedHeaders = JSON.parse(headersStr);
        } catch (e) {
          logger.warn("FlowExecutor: Invalid headers JSON", e);
        }
      }

      let parsedBody = {};
      if (body) {
        try {
          const bodyStr = this.replaceVariables(body, context);
          parsedBody = JSON.parse(bodyStr);
        } catch (e) {
          // If not JSON, send as string or ignore? simpler to assume JSON for now or just log warning
          logger.warn("FlowExecutor: Body is not valid JSON, sending as is or empty", e);
          // Fallback: try to send as raw string if useful, but axios data usually expects object for JSON
        }
      }

      // Injeção de Dados do Sistema
      // Injeção de Dados do Sistema
      if (nodeData.fullData && context.ticketId) {
        const ticket = await ShowTicketService(context.ticketId);
        if (ticket) {
          parsedBody = { ...parsedBody, ticket };
          if (ticket.contact) {
            parsedBody = { ...parsedBody, contact: ticket.contact };
          }
          try {
            const deal = await Deal.findOne({
              where: { ticketId: context.ticketId },
              include: [
                { model: Pipeline, as: 'pipeline' },
                { model: PipelineStage, as: 'stage' }
              ]
            });
            if (deal) parsedBody = { ...parsedBody, pipeline: deal };
          } catch (err) { }
        }
      } else {
        // Granular Fields Logic
        if (nodeData.contactFields && nodeData.contactFields.length > 0 && context.ticketId) {
          const ticket = await ShowTicketService(context.ticketId);
          if (ticket && ticket.contact) {
            const filteredContact: any = {};
            nodeData.contactFields.forEach((field: string) => {
              if ((ticket.contact as any)[field] !== undefined) filteredContact[field] = (ticket.contact as any)[field];
            });
            parsedBody = { ...parsedBody, contact: filteredContact };
          }
        } else if (nodeData.includeContact && context.ticketId) {
          const ticket = await ShowTicketService(context.ticketId);
          if (ticket && ticket.contact) {
            parsedBody = { ...parsedBody, contact: ticket.contact };
          }
        }

        if (nodeData.ticketFields && nodeData.ticketFields.length > 0 && context.ticketId) {
          const ticket = await ShowTicketService(context.ticketId);
          const filteredTicket: any = {};
          nodeData.ticketFields.forEach((field: string) => {
            if ((ticket as any)[field] !== undefined) filteredTicket[field] = (ticket as any)[field];
          });
          parsedBody = { ...parsedBody, ticket: filteredTicket };
        } else if (nodeData.includeTicket && context.ticketId) {
          const ticket = await ShowTicketService(context.ticketId);
          parsedBody = { ...parsedBody, ticket };
        }

        // Injeção de Dados do Pipeline (CRM)
        if (nodeData.pipelineFields && nodeData.pipelineFields.length > 0 && context.ticketId) {
          try {
            const deal = await Deal.findOne({
              where: { ticketId: context.ticketId },
              include: [
                { model: Pipeline, as: 'pipeline' },
                { model: PipelineStage, as: 'stage' }
              ]
            });

            if (deal) {
              const filteredPipeline: any = {};
              nodeData.pipelineFields.forEach((field: string) => {
                if (field === 'dealTitle') filteredPipeline.dealTitle = deal.title;
                if (field === 'dealValue') filteredPipeline.dealValue = deal.value;
                if (field === 'priority') filteredPipeline.priority = deal.priority;
                if (field === 'dealId') filteredPipeline.dealId = deal.id;
                if (field === 'pipelineName' && deal.pipeline) filteredPipeline.pipelineName = deal.pipeline.name;
                if (field === 'stageName' && deal.stage) filteredPipeline.stageName = deal.stage.name;
              });
              parsedBody = { ...parsedBody, pipeline: filteredPipeline };
            }
          } catch (err) {
            logger.warn(`FlowExecutor: Error fetching deal for webhook injection: ${err}`);
          }
        }
      }

      if (nodeData.includeContext) {
        parsedBody = { ...parsedBody, context };
      }

      logger.info(`FlowExecutor: Sending Webhook ${method} ${url}`);

      const response = await axios({
        method,
        url,
        headers: parsedHeaders,
        data: parsedBody
      });

      logger.info(`FlowExecutor: Webhook success`, response.data);
      // Optional: Store response in context? context.webhookResponse = response.data;
      // await session.update({ context }); // if we want to persist

    } catch (err) {
      logger.error(`FlowExecutor: Webhook failed`, err.message);
    }
  }

  private async processKanbanAction(session: FlowSession, nodeData: any) {
    const context = session.context as FlowContext;
    if (!context.ticketId) return;

    // Recuperar Ticket para obter TenantId (necessário para Deal)
    const ticket = await ShowTicketService(context.ticketId);
    if (!ticket) {
      logger.warn(`FlowExecutor: Ticket ${context.ticketId} not found for Kanban action`);
      return;
    }

    const { kanbanAction, pipelineId, stageId, dealTitle, dealValue, dealPriority } = nodeData;

    try {
      const pId = this.replaceVariables(pipelineId, context);
      const sId = this.replaceVariables(stageId, context);

      if (!pId || !sId) {
        logger.warn(`FlowExecutor: Missing PipelineID or StageID for Kanban action`);
        return;
      }

      if (kanbanAction === 'createDeal') {
        const title = this.replaceVariables(dealTitle || 'Nova Oportunidade', context);
        const valStr = this.replaceVariables(dealValue || '0', context);
        const value = parseFloat(valStr.replace(',', '.')); // Tratamento básico de float
        const priority = parseInt(this.replaceVariables(dealPriority || '1', context));

        await Deal.create({
          title,
          value,
          priority,
          pipelineId: parseInt(pId),
          stageId: parseInt(sId),
          contactId: ticket.contactId,
          ticketId: ticket.id,
          tenantId: ticket.tenantId
        });
        logger.info(`FlowExecutor: Deal created for ticket ${ticket.id} in pipeline ${pId}`);

      } else if (kanbanAction === 'moveDeal') {
        // Busca deal associado ao ticket
        const deal = await Deal.findOne({ where: { ticketId: ticket.id } });
        if (deal) {
          await deal.update({ stageId: parseInt(sId) });
          logger.info(`FlowExecutor: Deal ${deal.id} moved to stage ${sId}`);
        } else {
          logger.warn(`FlowExecutor: No deal found for ticket ${ticket.id} to move`);
        }
      }
    } catch (err) {
      logger.error(`FlowExecutor: Error processing Kanban action: ${err}`);
    }
  }

  private async evaluateSwitch(session: FlowSession, flow: Flow, node: any): Promise<FlowSession> {
    // NOCODE: Processamento seguro de condições estruturadas
    const context = session.context as FlowContext;
    const conditionsA = node.data.conditionsA || [];

    let matchedHandle = 'b'; // Default to B (False/Fail)

    if (conditionsA.length === 0) {
      // Se não há condições, vai para A se houver input
      const lastInput = context.lastInput || "";
      if (lastInput && lastInput.length > 0) {
        matchedHandle = 'a';
      }
    } else {
      // Avalia condições NOCODE
      const result = this.evaluateNoCodeConditions(conditionsA, context);
      if (result) {
        matchedHandle = 'a';
      }
    }

    logger.info(`FlowExecutor: Switch evaluated to handle ${matchedHandle}`);
    return this.proceedToNext(session, flow, node, matchedHandle);
  }

  // NOCODE: Avaliador seguro de condições
  private evaluateNoCodeConditions(conditions: any[], context: FlowContext): boolean {
    if (!conditions || conditions.length === 0) return true;

    let result = true;
    let currentLogic = 'AND';

    for (const cond of conditions) {
      const fieldValue = this.getContextValue(cond.field, context);
      const condValue = this.replaceVariables(cond.value || '', context);
      const condResult = this.evaluateSingleCondition(fieldValue, cond.operator, condValue);

      if (cond.logic === 'OR') {
        result = result || condResult;
      } else {
        result = result && condResult;
      }
      currentLogic = cond.logic || 'AND';
    }

    return result;
  }

  // NOCODE: Obtém valor do contexto por nome do campo
  private getContextValue(fieldName: string, context: FlowContext): string {
    const valueMap: { [key: string]: any } = {
      'lastInput': context.lastInput || context.messageBody || '',
      'contactName': context.contactName || '',
      'contactNumber': context.contactNumber || '',
      'ticketStatus': context.ticketStatus || '',
      'queueName': context.queueName || '',
      'tagName': context.tagName || '',
      'dayOfWeek': new Date().getDay().toString(),
      'currentHour': new Date().getHours().toString()
    };
    return String(valueMap[fieldName] || context[fieldName] || '');
  }

  // NOCODE: Avalia uma única condição com whitelist de operadores
  private evaluateSingleCondition(fieldValue: string, operator: string, condValue: string): boolean {
    const normalizedField = (fieldValue || '').toLowerCase().trim();
    const normalizedCond = (condValue || '').toLowerCase().trim();

    // Whitelist de operadores seguros
    switch (operator) {
      case 'equals':
        return normalizedField === normalizedCond;
      case 'notEquals':
        return normalizedField !== normalizedCond;
      case 'contains':
        return normalizedField.includes(normalizedCond);
      case 'notContains':
        return !normalizedField.includes(normalizedCond);
      case 'startsWith':
        return normalizedField.startsWith(normalizedCond);
      case 'endsWith':
        return normalizedField.endsWith(normalizedCond);
      case 'isEmpty':
        return normalizedField.length === 0;
      case 'isNotEmpty':
        return normalizedField.length > 0;
      case 'greaterThan':
        return parseFloat(fieldValue) > parseFloat(condValue);
      case 'lessThan':
        return parseFloat(fieldValue) < parseFloat(condValue);
      default:
        logger.warn(`FlowExecutor: Unknown operator ${operator}, defaulting to false`);
        return false;
    }
  }

  private getModelByName(tableName: string): any {
    const models: { [key: string]: any } = {
      'Contacts': Contact,
      'Contact': Contact,
      'Tickets': Ticket,
      'Ticket': Ticket,
      'Messages': Message,
      'Message': Message,
      'Users': User,
      'User': User,
      'Queues': Queue,
      'Queue': Queue,
      'Whatsapps': Whatsapp,
      'Whatsapp': Whatsapp,
      'QuickAnswers': QuickAnswer,
      'QuickAnswer': QuickAnswer,
      'Pipelines': Pipeline,
      'Pipeline': Pipeline
    };
    return models[tableName] || null;
  }

  private replaceVariables(str: string, context: FlowContext): string {
    if (!str) return str;
    return str.replace(/\{\{([\w\.]+)\}\}/g, (match, key) => {
      const keys = key.split('.');
      let value: any = context;

      for (const k of keys) {
        if (value && typeof value === 'object' && k in value) {
          value = value[k];
        } else {
          return match; // Variable not found or path invalid
        }
      }

      return value !== undefined && value !== null ? String(value) : match;
    });
  }

  // NOCODE: Parser seguro de filtros estruturados
  private parseNoCodeFilters(filters: any[], tableName: string, context: FlowContext): any {
    if (!filters || filters.length === 0) return {};

    // Whitelist de campos por tabela
    const allowedFields: { [key: string]: string[] } = {
      'Contacts': ['id', 'name', 'number', 'email', 'isGroup', 'profilePicUrl', 'createdAt'],
      'Tickets': ['id', 'status', 'queueId', 'userId', 'contactId', 'isGroup', 'createdAt', 'updatedAt'],
      'Messages': ['id', 'body', 'fromMe', 'mediaType', 'ticketId', 'createdAt'],
      'Users': ['id', 'name', 'email', 'profile', 'createdAt'],
      'Queues': ['id', 'name', 'color', 'createdAt'],
      'Whatsapps': ['id', 'name', 'status', 'isDefault', 'createdAt'],
      'QuickAnswers': ['id', 'shortcut', 'message', 'createdAt'],
      'Pipelines': ['id', 'name', 'createdAt']
    };

    // Whitelist de operadores
    const allowedOperators = ['=', '!=', '>', '<', '>=', '<=', 'like'];

    const tableFields = allowedFields[tableName] || [];
    const where: any = {};

    for (const filter of filters) {
      // Validar campo está na whitelist
      if (!tableFields.includes(filter.field)) {
        logger.warn(`FlowExecutor: Field ${filter.field} not allowed for table ${tableName}`);
        continue;
      }

      // Validar operador está na whitelist
      if (!allowedOperators.includes(filter.operator)) {
        logger.warn(`FlowExecutor: Operator ${filter.operator} not allowed`);
        continue;
      }

      // Resolver variáveis no valor
      let cleanValue = this.replaceVariables(filter.value || '', context);

      // Sanitizar valor - remover caracteres perigosos
      cleanValue = this.sanitizeValue(cleanValue);

      switch (filter.operator) {
        case '=':
          where[filter.field] = cleanValue;
          break;
        case '!=':
          where[filter.field] = { [Op.ne]: cleanValue };
          break;
        case '>':
          where[filter.field] = { [Op.gt]: cleanValue };
          break;
        case '<':
          where[filter.field] = { [Op.lt]: cleanValue };
          break;
        case '>=':
          where[filter.field] = { [Op.gte]: cleanValue };
          break;
        case '<=':
          where[filter.field] = { [Op.lte]: cleanValue };
          break;
        case 'like':
          where[filter.field] = { [Op.like]: `%${cleanValue}%` };
          break;
      }
    }

    return where;
  }

  // NOCODE: Sanitiza valores para prevenir injection
  private sanitizeValue(value: string): string {
    if (!value) return '';
    // Remove caracteres perigosos para SQL injection
    return value
      .replace(/[;'"\\]/g, '')  // Remove aspas, ponto-vírgula, barra
      .replace(/--/g, '')        // Remove comentários SQL
      .replace(/\/\*/g, '')      // Remove comentários bloco
      .replace(/\*\//g, '')
      .trim()
      .substring(0, 500);        // Limita tamanho
  }

  // NOCODE: Construir dados para CREATE/UPDATE a partir de estrutura NOCODE
  private buildNoCodeData(dataFields: any[], tableName: string, context: FlowContext): any {
    if (!dataFields || dataFields.length === 0) return null;

    // Whitelist de campos editáveis por tabela
    const editableFields: { [key: string]: string[] } = {
      'Contacts': ['name', 'email', 'profilePicUrl'],
      'Tickets': ['status', 'queueId', 'userId'],
      'Messages': ['body', 'read'],
      'Users': ['name', 'email'],
      'Queues': ['name', 'color'],
      'Whatsapps': ['name', 'isDefault'],
      'QuickAnswers': ['shortcut', 'message'],
      'Pipelines': ['name']
    };

    const tableEditableFields = editableFields[tableName] || [];
    const result: any = {};

    for (const df of dataFields) {
      // Validar campo está na whitelist de editáveis
      if (!tableEditableFields.includes(df.field)) {
        logger.warn(`FlowExecutor: Field ${df.field} not editable for table ${tableName}`);
        continue;
      }

      let value = df.value;

      // Resolver variáveis
      if (df.useVariable || (typeof value === 'string' && value.startsWith('{{'))) {
        value = this.replaceVariables(value, context);
      }

      // Sanitizar
      value = this.sanitizeValue(String(value));

      result[df.field] = value;
    }

    return Object.keys(result).length > 0 ? result : null;
  }

  // Mantém parseFilter para compatibilidade (deprecated)
  private parseFilter(filterStr: string, context: FlowContext): any {
    if (!filterStr || filterStr.trim() === '') return {};
    const resolvedFilter = this.replaceVariables(filterStr, context);
    const where: any = {};
    const conditions = resolvedFilter.split(/\s+and\s+/i);
    for (const condition of conditions) {
      const match = condition.match(/(\w+)\s*(=|!=|>|<|>=|<=|like)\s*["']?([^"']+)["']?/i);
      if (match) {
        const [, field, operator, value] = match;
        const cleanValue = this.sanitizeValue(value.trim());
        switch (operator.toLowerCase()) {
          case '=':
            where[field] = cleanValue;
            break;
          case '!=':
            where[field] = { [Op.ne]: cleanValue };
            break;
          case '>':
            where[field] = { [Op.gt]: cleanValue };
            break;
          case '<':
            where[field] = { [Op.lt]: cleanValue };
            break;
          case '>=':
            where[field] = { [Op.gte]: cleanValue };
            break;
          case '<=':
            where[field] = { [Op.lte]: cleanValue };
            break;
          case 'like':
            where[field] = { [Op.like]: `%${cleanValue}%` };
            break;
        }
      }
    }
    return where;
  }

  private async executeDatabase(session: FlowSession, flow: Flow, node: any): Promise<FlowSession> {
    const nodeData = node.data;
    const context = session.context as FlowContext;
    const {
      operation,
      tableName,
      // NOCODE: Novos campos estruturados
      filters,          // Array de filtros NOCODE
      dataFields,       // Array de campos para CREATE/UPDATE
      selectedFields,   // Array de campos para READ
      limit,
      orderByField,
      orderByDir,
      outputVariable,
      // Legacy (deprecated)
      filter,
      data,
      fields,
      orderBy
    } = nodeData;

    logger.info(`FlowExecutor: Database node - ${operation} on ${tableName}`);

    // Validar tabela está na whitelist
    const allowedTables = ['Contacts', 'Tickets', 'Messages', 'Users', 'Queues', 'Whatsapps', 'QuickAnswers', 'Pipelines'];
    if (!allowedTables.includes(tableName)) {
      logger.error(`FlowExecutor: Table ${tableName} not allowed`);
      await this.sendMessage(session, `Erro: Tabela "${tableName}" não permitida.`);
      return this.proceedToNext(session, flow, node);
    }

    const Model = this.getModelByName(tableName);
    if (!Model) {
      logger.error(`FlowExecutor: Unknown table ${tableName}`);
      await this.sendMessage(session, `Erro: Tabela "${tableName}" não encontrada.`);
      return this.proceedToNext(session, flow, node);
    }

    let result: any = null;

    try {
      switch (operation) {
        case 'read': {
          // NOCODE: Usa filtros estruturados se disponíveis, senão legacy
          const where = Array.isArray(filters) && filters.length > 0
            ? this.parseNoCodeFilters(filters, tableName, context)
            : this.parseFilter(filter || '', context);

          const queryOptions: any = { where };

          // NOCODE: Campos selecionados via checkbox
          if (Array.isArray(selectedFields) && selectedFields.length > 0) {
            queryOptions.attributes = selectedFields;
          } else if (fields && fields.trim()) {
            queryOptions.attributes = fields.split(',').map((f: string) => f.trim());
          }

          // Limit com validação
          const parsedLimit = parseInt(limit) || 10;
          queryOptions.limit = Math.min(parsedLimit, 100); // Máximo 100 registros

          // NOCODE: Ordenação via selects
          if (orderByField) {
            queryOptions.order = [[orderByField, (orderByDir || 'DESC').toUpperCase()]];
          } else if (orderBy && orderBy.trim()) {
            const [field, direction] = orderBy.trim().split(/\s+/);
            queryOptions.order = [[field, (direction || 'ASC').toUpperCase()]];
          }

          result = await Model.findAll(queryOptions);
          logger.info(`FlowExecutor: Database READ returned ${result.length} records`);
          break;
        }

        case 'update': {
          // NOCODE: Usa filtros estruturados
          const where = Array.isArray(filters) && filters.length > 0
            ? this.parseNoCodeFilters(filters, tableName, context)
            : this.parseFilter(filter || '', context);

          if (Object.keys(where).length === 0) {
            logger.error(`FlowExecutor: UPDATE without filter is not allowed`);
            await this.sendMessage(session, `Erro: UPDATE sem filtro não é permitido.`);
            return this.proceedToNext(session, flow, node);
          }

          // NOCODE: Usa dataFields estruturados se disponíveis
          let updateData: any;
          if (Array.isArray(dataFields) && dataFields.length > 0) {
            updateData = this.buildNoCodeData(dataFields, tableName, context);
          } else if (typeof data === 'string') {
            const resolvedData = this.replaceVariables(data, context);
            try {
              updateData = JSON.parse(resolvedData);
            } catch (e) {
              logger.error(`FlowExecutor: Invalid JSON for UPDATE: ${data}`);
              await this.sendMessage(session, `Erro: JSON inválido para atualizar registro.`);
              return this.proceedToNext(session, flow, node);
            }
          } else {
            updateData = data;
          }

          if (!updateData || Object.keys(updateData).length === 0) {
            await this.sendMessage(session, `Erro: Nenhum dado para atualizar.`);
            return this.proceedToNext(session, flow, node);
          }

          const [affectedRows] = await Model.update(updateData, { where });
          result = { affectedRows };
          logger.info(`FlowExecutor: Database UPDATE - ${affectedRows} records affected`);
          break;
        }

        default:
          logger.warn(`FlowExecutor: Unknown/disabled database operation: ${operation}`);
          await this.sendMessage(session, `Operação ${operation} não permitida no modo NOCODE.`);
      }

      // Store result in context variable (sanitizado)
      const sanitizedOutputVar = (outputVariable || 'dbResult').replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50);
      if (result !== null) {
        const newContext = {
          ...context,
          [sanitizedOutputVar]: Array.isArray(result)
            ? result.map(r => r.get ? r.get({ plain: true }) : r)
            : (result.get ? result.get({ plain: true }) : result)
        };
        await session.update({ context: newContext });
        logger.info(`FlowExecutor: Result stored in context.${sanitizedOutputVar}`);
      }

    } catch (err: any) {
      logger.error(`FlowExecutor: Database error - ${err.message}`);
      await this.sendMessage(session, `Erro na operação de banco de dados: ${err.message}`);
    }

    return this.proceedToNext(session, flow, node);
  }

  // NOCODE: Executor do Filter Node - filtra dados de uma variável
  private async executeFilter(session: FlowSession, flow: Flow, node: any): Promise<FlowSession> {
    const nodeData = node.data;
    const context = session.context as FlowContext;
    const { inputVariable, filterConditions, outputVariable } = nodeData;

    logger.info(`FlowExecutor: Filter node - filtering ${inputVariable}`);

    // Sanitizar nome das variáveis
    const sanitizedInput = (inputVariable || '').replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50);
    const sanitizedOutput = (outputVariable || 'filtrado').replace(/[^a-zA-Z0-9_]/g, '').substring(0, 50);

    // Obter dados da variável de entrada
    const inputData = context[sanitizedInput];

    if (!inputData) {
      logger.warn(`FlowExecutor: Filter node - input variable '${sanitizedInput}' is empty or not found`);
      // Armazena array vazio
      const newContext = { ...context, [sanitizedOutput]: [] };
      await session.update({ context: newContext });
      return this.proceedToNext(session, flow, node);
    }

    // Garantir que temos um array para filtrar
    let dataToFilter = Array.isArray(inputData) ? inputData : [inputData];

    // Se não há condições, passa os dados sem filtrar
    if (!filterConditions || filterConditions.length === 0) {
      const newContext = { ...context, [sanitizedOutput]: dataToFilter };
      await session.update({ context: newContext });
      logger.info(`FlowExecutor: Filter node - no conditions, passed ${dataToFilter.length} items`);
      return this.proceedToNext(session, flow, node);
    }

    // Aplicar filtros
    const filteredData = dataToFilter.filter(item => {
      return this.evaluateFilterConditions(filterConditions, item, context);
    });

    // Armazenar resultado
    const newContext = { ...context, [sanitizedOutput]: filteredData };
    await session.update({ context: newContext });
    logger.info(`FlowExecutor: Filter node - filtered ${dataToFilter.length} -> ${filteredData.length} items`);

    return this.proceedToNext(session, flow, node);
  }

  // NOCODE: Avalia condições de filtro em um item
  private evaluateFilterConditions(conditions: any[], item: any, context: FlowContext): boolean {
    if (!conditions || conditions.length === 0) return true;

    let result = true;

    for (let i = 0; i < conditions.length; i++) {
      const cond = conditions[i];
      const itemValue = String(item[cond.field] || '');
      const condValue = this.replaceVariables(cond.value || '', context);
      const condResult = this.evaluateSingleCondition(itemValue, cond.operator, condValue);

      if (i === 0) {
        result = condResult;
      } else if (cond.logic === 'OR') {
        result = result || condResult;
      } else {
        result = result && condResult;
      }
    }

    return result;
  }

  // Simulador de fluxo - executa sem enviar mensagens reais
  public async simulateFlow(flow: Flow, testMessage: string): Promise<any> {
    const nodes = flow.nodes as unknown as FlowNode[];
    const edges = flow.edges as unknown as FlowEdge[];
    const simulationLog: any[] = [];
    const responses: any[] = []; // Mensagens para exibir no chat
    const simulatedContext: FlowContext = {
      ticketId: 9999,
      contactId: 1234,
      contactName: "Contato Simulado",
      contactNumber: "5511999999999",
      lastInput: testMessage,
      messageBody: testMessage
    };

    // Encontrar nó inicial para detectar tipo de fluxo
    const startNode = nodes.find(n => n.type === "input" || n.type === "start" || n.type === "trigger");
    const triggerType = startNode?.data?.triggerType || "message";

    // Detectar tipo de fluxo baseado no gatilho
    const chatTriggers = ["message", "keyword", "firstContact"];
    const flowType = chatTriggers.includes(triggerType) ? "chat" : "automation";

    logger.info(`FlowExecutor: Starting simulation for flow ${flow.id} (type: ${flowType})`);

    // Adicionar mensagem do usuário simulado
    if (flowType === "chat") {
      responses.push({
        type: "user",
        content: testMessage,
        timestamp: new Date().toISOString()
      });
    }

    simulationLog.push({
      step: 0,
      type: "start",
      status: "success",
      nodeLabel: "Gatilho",
      message: `Tipo: ${triggerType}`,
      timestamp: new Date().toISOString()
    });

    if (!startNode) {
      return {
        success: false,
        flowType,
        error: "Nenhum nó inicial encontrado no fluxo",
        log: simulationLog,
        responses
      };
    }

    let currentNodeId = startNode.id;
    let step = 1;
    const maxSteps = 50; // Limite para evitar loops infinitos
    const visitedNodes: string[] = [];

    while (currentNodeId && step <= maxSteps) {
      const node = nodes.find(n => n.id === currentNodeId);
      if (!node) {
        simulationLog.push({
          step,
          type: "error",
          status: "error",
          nodeLabel: "Desconhecido",
          message: `Nó ${currentNodeId} não encontrado`,
          timestamp: new Date().toISOString()
        });
        break;
      }

      // Checar loop infinito
      if (visitedNodes.filter(v => v === currentNodeId).length > 3) {
        simulationLog.push({
          step,
          type: "warning",
          status: "warning",
          nodeLabel: node.data?.label || node.type,
          message: `Possível loop detectado`,
          timestamp: new Date().toISOString()
        });
        break;
      }
      visitedNodes.push(currentNodeId);

      // Simular execução do nó
      const nodeResult = this.simulateNode(node, simulatedContext);

      simulationLog.push({
        step,
        type: node.type,
        status: nodeResult.error ? "error" : "success",
        nodeId: node.id,
        nodeLabel: node.data?.label || node.type,
        action: nodeResult.action,
        message: nodeResult.message,
        timestamp: new Date().toISOString()
      });

      // Adicionar resposta ao chat se houver
      if (nodeResult.wouldSend && flowType === "chat") {
        responses.push({
          type: "bot",
          content: nodeResult.message,
          nodeType: node.type,
          options: nodeResult.options,
          timestamp: new Date().toISOString()
        });
      }

      // Atualizar contexto simulado
      if (nodeResult.contextUpdate) {
        Object.assign(simulatedContext, nodeResult.contextUpdate);
      }

      // Encontrar próximo nó
      const sourceHandle = nodeResult.sourceHandle || null;
      const edge = edges.find(e => {
        if (sourceHandle) {
          return e.source === currentNodeId && e.sourceHandle === sourceHandle;
        }
        return e.source === currentNodeId;
      });

      if (!edge) {
        simulationLog.push({
          step: step + 1,
          type: "end",
          status: "success",
          nodeLabel: "Fim",
          message: "Fluxo concluído",
          timestamp: new Date().toISOString()
        });
        break;
      }

      currentNodeId = edge.target;
      step++;
    }

    if (step > maxSteps) {
      simulationLog.push({
        step,
        type: "error",
        status: "error",
        nodeLabel: "Sistema",
        message: "Limite de passos atingido (possível loop infinito)",
        timestamp: new Date().toISOString()
      });
    }

    return {
      success: true,
      flowId: flow.id,
      flowName: flow.name,
      flowType,
      triggerType,
      totalSteps: step,
      testMessage,
      log: simulationLog,
      responses,
      finalContext: simulatedContext
    };
  }

  // Simula execução de um nó individual
  private simulateNode(node: FlowNode, context: FlowContext): any {
    switch (node.type) {
      case "start":
      case "input":
      case "trigger":
        return {
          action: "Gatilho disparado",
          message: `Tipo: ${node.data?.triggerType || 'message'}`,
          contextUpdate: {}
        };

      case "message":
        const msgContent = this.replaceVariables(node.data?.content || "Mensagem", context);
        return {
          action: "Enviar mensagem",
          message: msgContent,
          wouldSend: true
        };

      case "menu":
        const menuOptions = node.data?.options || [];
        return {
          action: "Exibir menu",
          message: node.data?.menuTitle || "Menu",
          options: menuOptions.map((o: any) => o.label),
          wouldSend: true
        };

      case "switch":
        const conditionsA = node.data?.conditionsA || [];
        const result = this.evaluateNoCodeConditions(conditionsA, context);
        return {
          action: "Avaliar condição",
          message: `Condições: ${conditionsA.length}, Resultado: ${result ? 'A (verde)' : 'B (vermelho)'}`,
          sourceHandle: result ? 'a' : 'b'
        };

      case "database":
        return {
          action: `Database ${node.data?.operation || 'read'}`,
          message: `Tabela: ${node.data?.tableName || 'N/A'}`,
          contextUpdate: node.data?.outputVariable ? { [node.data.outputVariable]: "[Dados simulados]" } : {}
        };

      case "filter":
        const inputVar = node.data?.inputVariable || 'dados';
        const outputVar = node.data?.outputVariable || 'filtrado';
        const filterCount = (node.data?.filterConditions || []).length;
        return {
          action: "Filtrar dados",
          message: `Entrada: ${inputVar}, Saída: ${outputVar}, Filtros: ${filterCount}`,
          contextUpdate: { [outputVar]: "[Dados filtrados simulados]" }
        };

      case "pipeline":
        return {
          action: `Pipeline: ${node.data?.pipelineAction || 'ação'}`,
          message: `Status: ${node.data?.newStatus || 'N/A'}`,
          wouldUpdate: true
        };

      case "knowledge":
        return {
          action: "Consultar conhecimento (IA)",
          message: `Modo: ${node.data?.responseMode || 'auto'}`,
          wouldSend: true
        };

      case "end":
      case "output":
        return {
          action: "Finalizar fluxo",
          message: `Ação: ${node.data?.endAction || 'none'}`
        };

      default:
        return {
          action: `Nó desconhecido: ${node.type}`,
          message: "Não simulado"
        };
    }
  }

  // Processamento do Nó de Conhecimento (RAG)
  private async processKnowledgeNode(session: FlowSession, nodeData: any, query: string) {
    const context = session.context as FlowContext;
    if (!context.ticketId) return;

    const ticket = await ShowTicketService(context.ticketId);
    if (!ticket) return;

    const tenantId = String(ticket.tenantId);
    const knowledgeBaseId = nodeData.knowledgeBaseId;
    const responseMode = nodeData.responseMode || 'auto';

    try {
      if (!query || query.trim().length === 0) {
        await this.sendMessage(session, "Desculpe, não recebi sua pergunta. Poderia reformular?");
        return;
      }

      // Buscar chunks relevantes via VectorService
      const results = await VectorService.similaritySearch(query, tenantId, 5);

      if (results.length === 0) {
        await this.sendMessage(session, "Não encontrei informações relevantes sobre sua pergunta. Gostaria de falar com um atendente?");
        return;
      }

      // Montar contexto a partir dos chunks encontrados
      const contextText = results.map(r => r.content).join("\n\n---\n\n");

      if (responseMode === 'search') {
        // Apenas retornar os trechos encontrados (sem LLM)
        await this.sendMessage(session, `📚 *Informações encontradas:*\n\n${contextText.substring(0, 1000)}...`);
      } else {
        // Modo 'auto' ou 'suggest': Enviar resposta baseada no contexto
        // Em produção, chamaria um LLM aqui para gerar uma resposta humanizada
        // Por agora, enviar o contexto diretamente
        await this.sendMessage(session, `Com base nas informações disponíveis:\n\n${contextText.substring(0, 1500)}`);
      }

      // Atualizar contexto com resultado
      const newContext = { ...context, knowledgeResult: contextText.substring(0, 500) };
      await session.update({ context: newContext });

    } catch (err) {
      logger.error(`FlowExecutor: Error in Knowledge Node: ${err}`);
      await this.sendMessage(session, "Houve um erro ao consultar a base de conhecimento. Tente novamente.");
    }
  }

  // Processamento do Nó de Helpdesk (Criar/Consultar Protocolo)
  private async processHelpdeskNode(session: FlowSession, nodeData: any) {
    const context = session.context as FlowContext;
    if (!context.ticketId) return;

    const ticket = await ShowTicketService(context.ticketId);
    if (!ticket) return;

    const action = nodeData.helpdeskAction || 'createProtocol';
    const tenantId = ticket.tenantId;

    try {
      if (action === 'createProtocol') {
        // Gerar número de protocolo único
        const timestamp = Date.now();
        const random = Math.floor(Math.random() * 1000);
        const protocolNumber = `${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, '0')}${timestamp.toString().slice(-6)}${random}`;

        // Criar protocolo
        const protocol = await Protocol.create({
          tenantId: tenantId,
          protocolNumber: protocolNumber,
          ticketId: context.ticketId,
          contactId: ticket.contactId,
          subject: this.replaceVariables(nodeData.subject || "Protocolo via Fluxo", context),
          description: this.replaceVariables(nodeData.description || context.lastInput || "", context),
          status: "open",
          priority: nodeData.priority || "medium",
          category: nodeData.category || "Fluxo Automatizado"
        });

        logger.info(`FlowExecutor: Protocol ${protocolNumber} created for ticket ${context.ticketId}`);

        // Atualizar contexto com número do protocolo
        const newContext = {
          ...context,
          protocol: protocolNumber,
          protocolId: protocol.id
        };
        await session.update({ context: newContext });

        // Mensagem de confirmação (se configurado)
        if (nodeData.sendConfirmation !== false) {
          await this.sendMessage(session, `✅ Protocolo criado com sucesso!\n\n📋 *Número:* ${protocolNumber}`);
        }

      } else if (action === 'checkStatus') {
        // Buscar protocolo mais recente do contato
        const existingProtocol = await Protocol.findOne({
          where: {
            contactId: ticket.contactId,
            tenantId: tenantId
          },
          order: [['createdAt', 'DESC']]
        });

        if (existingProtocol) {
          const statusMap: { [key: string]: string } = {
            'open': 'Aberto',
            'in_progress': 'Em Andamento',
            'pending': 'Pendente',
            'resolved': 'Resolvido',
            'closed': 'Fechado'
          };
          await this.sendMessage(session, `📋 *Protocolo:* ${existingProtocol.protocolNumber}\n📊 *Status:* ${statusMap[existingProtocol.status] || existingProtocol.status}`);
        } else {
          await this.sendMessage(session, "Não encontrei protocolos anteriores associados ao seu contato.");
        }
      }

    } catch (err) {
      logger.error(`FlowExecutor: Error in Helpdesk Node: ${err}`);
      await this.sendMessage(session, "Houve um erro ao processar sua solicitação de protocolo.");
    }
  }
}

export default new FlowExecutorService();

