import { Reaction } from "../../types/Message";

export interface Contact {
  name?: string;
  number?: string;
  isGroup?: boolean;
  client?: { id: number; socialName?: string | null } | null;
}

export interface QuotedMsg {
  id: number | string;
  fromMe?: boolean;
  body?: string;
  mediaType?: string;
  participant?: string;
  dataJson?: string | Record<string, unknown>;
  contact?: Contact;
}

export interface Message {
  id: number | string;
  body: string;
  fromMe: boolean;
  mediaUrl?: string;
  mediaType?: string;
  isDeleted?: boolean;
  ack?: number;
  createdAt: string;
  quotedMsg?: QuotedMsg;
  participant?: string;
  dataJson?: string | Record<string, unknown>;
  contact?: Contact;
  reactions?: Reaction[] | string;
  transcription?: string | null;
  [key: string]: unknown;
}

export type MessagesAction =
  | { type: "LOAD_MESSAGES"; payload: Message[] }
  | { type: "ADD_MESSAGE"; payload: Message }
  | { type: "UPDATE_MESSAGE"; payload: Message }
  | { type: "RESET" };
