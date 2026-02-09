export interface Envelope<T = any> {
  id: string;
  timestamp: number;
  tenantId: string | number; // Support legacy number IDs if needed, but prefer UUID
  type: string;
  payload: T;
}

// --- COMMANDS (Backend -> Engine) ---

export type CommandType =
  | "session.start"
  | "session.stop"
  | "message.send.text"
  | "message.send.media"
  | "message.send.buttons"
  | "message.send.list"
  | "message.send.poll"
  | "message.send.template"
  | "message.send.interactive"
  | "message.send.carousel"
  | "message.markAsRead"
  | "contact.sync"
  | "history.sync";

export interface StartSessionPayload {
  sessionId: number;
  sessionInstanceId?: number; // [NEW] Unique ID per start attempt
  webchatId?: number;         // [NEW] For compatibility with Webchat
  sessionToken?: string;
  usePairingCode?: boolean;  // true = usar código, false = usar QR
  phoneNumber?: string;       // Formato E.164 sem +: 5511999999999
  name?: string;
  syncHistory?: boolean;
  syncPeriod?: string;
  keepAlive?: boolean;
  force?: boolean;
}

export interface StopSessionPayload {
  sessionId: number;
}

export interface SendTextPayload {
  sessionId: number;
  messageId?: string;
  to: string;
  body: string;
  options?: {
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
  };
}

export interface SendMediaPayload {
  sessionId: number;
  messageId?: string;
  to: string;
  lid?: string;
  caption?: string;
  media: {
    mimetype: string;
    filename: string;
    data: string; // Base64
  };
}

export interface SendButtonsPayload {
  sessionId: number;
  messageId?: string;
  to: string;
  text: string;
  footer?: string;
  buttons: Array<{
    buttonId: string;
    buttonText: string;
  }>;
  imageUrl?: string;
}

export interface SendListPayload {
  sessionId: number;
  messageId?: string;
  to: string;
  text: string;
  footer?: string;
  buttonText: string;
  sections: Array<{
    title: string;
    rows: Array<{
      rowId: string;
      title: string;
      description?: string;
    }>;
  }>;
}

export interface SendPollPayload {
  sessionId: number;
  messageId?: string;
  to: string;
  name: string;
  options: string[];
  selectableCount?: number;
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
}




export interface SyncContactPayload {
  sessionId: number;
  contactId: number;
  number: string;
  lid?: string;
  isGroup?: boolean;
}

// --- EVENTS (Engine -> Backend) ---

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
  | "contact.update"
  | "message.revoke";


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
  status: "CONNECTED" | "DISCONNECTED" | "QRCODE" | "OPENING" | "PAIRING" | "TIMEOUT" | "SESSION_EXPIRED";
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
    mediaData?: string; // Base64
    mimetype?: string;
    // Interactive fields
    selectedButtonId?: string;
    selectedRowId?: string;
    pollVotes?: string[];
    participant: string;
    profilePicUrl: string;
    pushName?: string;
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
    status?: number;
    ack?: number;
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

export interface MessageRevokePayload {
  sessionId: number;
  messageId: string;
  participant?: string; // Quem deletou
}

export interface MarkAsReadPayload {
  sessionId: number;
  to: string;
  messageIds: string[];
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
