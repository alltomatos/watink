import { Contact } from "./Ticket";

/**
 * A single WhatsApp reaction entry as returned by the backend.
 * The backend may send either `text` or `emoji` depending on the WA version.
 */
export interface Reaction {
  /** Emoji character — field name used by the Go backend. */
  reaction?: string;
  /** Emoji character (newer WA protobuf format). */
  emoji?: string;
  /** Emoji character (legacy WA format). */
  text?: string;
  /** Sender JID (Go backend). */
  sender?: string;
  /** Sender key hash (legacy format). */
  senderKeyHash?: string;
  fromMe?: boolean;
  timestamp?: number;
}

export interface Message {
  id: string;
  body: string;
  fromMe: boolean;
  read: boolean;
  createdAt: string;
  updatedAt: string;
  ticketId: number;
  contactId: number;
  contact?: Contact;
  mediaType?: string;
  mediaUrl?: string;
  ack?: number;
  isDeleted?: boolean;
  quotedMsg?: Message;
  /**
   * Reaction list. The backend may persist reactions as a JSON string or as a
   * pre-parsed array. Consumers must normalise via JSON.parse when the value is
   * a string before iterating.
   */
  reactions?: Reaction[] | string;
  /**
   * Raw WhatsApp protobuf data serialised as JSON. Stored as a string in the
   * database and optionally pre-parsed by the backend before delivery.
   */
  dataJson?: string | Record<string, unknown>;
  participant?: string;
  /**
   * Text transcribed on-demand from an audio message (operator clicks
   * "Transcrever áudio"). Only ever shown in the Watink UI — never sent to
   * WhatsApp.
   */
  transcription?: string | null;
}
