export interface Envelope<T = any> {
  id: string;
  timestamp: number;
  tenantId: string | number;
  type: string;
  payload: T;
}

export type CommandType =
  | "session.start"
  | "session.stop"
  | "message.send.text"
  | "message.send.media"
  | "message.send.buttons"   // NOVO: Botões simples
  | "message.send.list"      // NOVO: Lista de opções
  | "message.send.poll"      // NOVO: Enquete
  | "message.send.template"  // NOVO: Template (URL/Call)
  | "message.send.interactive" // NOVO: Native Flow (Interativo)
  | "message.send.carousel"    // NOVO: Carrossel Nativo
  | "message.markAsRead"       // NOVO: Marcar mensagens como lidas
  | "contact.sync"             // NOVO: Sincronização de Contato
  | "contact.import"           // NOVO: Importação de Contatos
  | "history.sync";            // NOVO: Busca de histórico sob demanda

export interface StartSessionPayload {
  proxy?: string;
  sessionId: number;
  sessionInstanceId?: number; // [NEW] Unique ID per start attempt
  sessionToken?: string;
  usePairingCode?: boolean;
  phoneNumber?: string;
  name?: string;
  syncHistory?: boolean;
  syncPeriod?: string;
  keepAlive?: boolean;
  force?: boolean;
}

export interface StopSessionPayload {
  sessionId: number;
}

// Busca de histórico sob demanda para um ticket/contato específico
export interface HistorySyncPayload {
  sessionId: number;
  ticketId: number;
  contactId: number;
  contactNumber: string;
  fromDate: string; // ISO date - obrigatório (seleção do usuário)
  toDate?: string;  // ISO date, default now
}

export interface SendOptions {
  quotedMsgId?: string;
  quoted?: {
    key: {
      id: string;
      fromMe?: boolean;
      participant?: string;
      remoteJid?: string;
    };
    message?: any;
  };
}

export interface SendTextPayload {
  sessionId: number;
  messageId?: string;
  to: string;
  lid?: string; // NOVO: LID do destinatário para validação cruzada
  body: string;
  mentions?: string[]; // Array of JIDs to be mentioned
  options?: SendOptions;
}

export interface SendMediaPayload {
  sessionId: number;
  messageId?: string;
  to: string;
  lid?: string; // NOVO
  caption?: string;
  media: {
    mimetype: string;
    filename: string;
    data: string;
  };
  options?: SendOptions;
}

// Botões simples (até 3 botões)
export interface SendButtonsPayload {
  sessionId: number;
  messageId?: string;
  to: string;
  text: string;
  footer?: string;
  mentions?: string[];
  buttons: Array<{
    buttonId: string;
    buttonText: string;
  }>;
  imageUrl?: string;  // Opcional: adiciona imagem ao header
  options?: SendOptions;
}

// Lista de opções com seções
export interface SendListPayload {
  sessionId: number;
  messageId?: string;
  to: string;
  text: string;
  footer?: string;
  buttonText: string;  // Texto do botão "Ver opções"
  sections: Array<{
    title: string;
    rows: Array<{
      rowId: string;
      title: string;
      description?: string;
    }>;
  }>;
  options?: SendOptions;
}

// Enquete/Poll
export interface SendPollPayload {
  sessionId: number;
  messageId?: string;
  to: string;
  name: string;           // Pergunta
  options: string[];      // Opções (2-12)
  selectableCount?: number; // Quantas podem ser selecionadas (padrão: 1)
  sendOptions?: SendOptions;
}

// Mensagem Template (URL, Call, Reply)
export interface SendTemplatePayload {
  sessionId: number;
  messageId?: string;
  to: string;
  text: string;
  footer?: string;
  buttons: Array<{
    type: 'url' | 'call' | 'reply';
    text: string;
    url?: string;
    phoneNumber?: string;
    buttonId?: string;
  }>;
  mediaUrl?: string; // Imagem ou vídeo opcional no header
  options?: SendOptions;
}

// Mensagem Interativa (Native Flow)
export interface SendInteractivePayload {
  sessionId: number;
  messageId?: string;
  to: string;
  text: string;
  footer?: string;
  buttons: Array<{
    type: 'url' | 'reply';
    text: string;
    url?: string;
    buttonId?: string;
  }>;
  mediaUrl?: string;
  options?: SendOptions;
}

// Carrossel Nativo
export interface SendCarouselPayload {
  sessionId: number;
  messageId?: string;
  to: string;
  text: string;
  footer?: string;
  cards: Array<{
    header: {
      title: string;
      subtitle?: string;
      imageUrl?: string;
      hasMedia?: boolean;
    };
    body: string;
    footer?: string;
    buttons: Array<{
      type: 'url' | 'reply';
      displayText: string;
      url?: string;
      id?: string;
    }>;
  }>;
  options?: SendOptions;
}

export interface SyncContactPayload {
  sessionId: number;
  contactId: number;
  number: string;
  lid?: string;
  isGroup?: boolean;
}

export interface ImportContactPayload {
  sessionId: number;
}

export type EventType =
  | "session.qrcode"
  | "session.pairingcode"
  | "session.status"
  | "message.received"
  | "message.ack"
  | "message.response.button"
  | "message.response.list"
  | "message.response.poll"
  | "message.response.poll"
  | "message.response.interactive"
  | "message.reaction"
  | "contact.update";


export interface QrCodePayload {
  sessionId: number;
  qrcode: string;
  attempt: number;
}

export interface PairingCodePayload {
  sessionId: number;
  pairingCode: string;
}

export interface SessionStatusPayload {
  sessionId: number;
  status: "CONNECTED" | "DISCONNECTED" | "QRCODE" | "OPENING";
  number?: string;
  profilePicUrl?: string;
}

export interface MessageReceivedPayload {
  sessionId: number;
  message: {
    id: string;
    from: string;
    to: string;
    body: string;
    fromMe: boolean;
    isGroup: boolean;
    type: string;
    timestamp: number;
    hasMedia: boolean;
    mediaUrl?: string;
    mediaData?: string; // Base64 do conteúdo baixado
    mimetype?: string;
    participant?: string;
    // Novos campos para respostas interativas
    selectedButtonId?: string;
    selectedRowId?: string;
    pollVotes?: string[];
    pushName?: string;
    profilePicUrl?: string; // Avatar URL of the sender
    senderLid?: string;
    originalId?: string; // UUID from Backend
    // Quoted Message
    quotedMsgId?: string;
    quotedMsg?: {
      id: string;
      body: string;
      participant: string;
      type: string;
    };
    // Link Preview
    urlPreview?: {
      title?: string;
      description?: string;
      canonicalUrl?: string;
      thumbnail?: string; // Base64
      previewType?: string;
    };
  };
}

export interface MessageAckPayload {
  sessionId: number;
  messageId: string;
  ack: number;
}

export interface MessageReactionPayload {
  sessionId: number;
  messageId: string;
  reaction: string;
  sender: string;
  timestamp: number;
}

export interface ContactUpdatePayload {
  sessionId: number;
  contactId: number;
  number: string;
  profilePicUrl?: string;
  pushName?: string;
  lid?: string;
  isGroup?: boolean;
}

export interface MarkAsReadPayload {
  sessionId: number;
  to: string;
  messageIds: string[];
}

