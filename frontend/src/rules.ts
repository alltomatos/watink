export type RuleKey =
  | "drawer-admin-items:view"
  | "tickets-manager:showall"
  | "user-modal:editProfile"
  | "user-modal:editQueues"
  | "ticket-options:deleteTicket"
  | "ticket-options:transferWhatsapp"
  | "contacts-page:deleteContact"
  | "dashboard:read"
  | "pipelines:read"
  | "tickets:read"
  | "contacts:read"
  | "quick_answers:read"
  | "flows:read"
  | "clients:read"
  | "activities:read"
  | "activities:manage"
  | "helpdesk:read"
  | "tags:read"
  | "connections:read"
  | "users:read"
  | "roles:read"
  | "queues:read"
  | "knowledge_bases:read"
  | "settings:read"
  | "swagger:read"
  | string;

export interface ProfileRules {
  static: RuleKey[];
  dynamic?: Record<string, (data: unknown) => boolean>;
}

export type Rules = Record<string, ProfileRules>;

const rules: Rules = {
  user: {
    static: [],
  },

  admin: {
    static: [
      "drawer-admin-items:view",
      "tickets-manager:showall",
      "user-modal:editProfile",
      "user-modal:editQueues",
      "ticket-options:deleteTicket",
      "ticket-options:transferWhatsapp",
      "contacts-page:deleteContact",
    ],
  },
};

export default rules;
