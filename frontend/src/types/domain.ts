export interface User {
  id?: number | string;
  name?: string;
  email?: string;
  profile?: string;
  role?: string;
  permissions?: string[];
  profileImage?: string;
}

export interface Queue {
  id: number;
  name: string;
  color: string;
  greetingMessage?: string;
  distributionStrategy: string;
  prioritizeWallet: boolean;
}

/** Shape of a WhatsApp connection returned by GET /whatsapp/:id */
export interface WhatsAppConnection {
  id: number;
  name: string;
  status: string;
  isDefault: boolean;
  keepAlive: boolean;
  syncHistory: boolean;
  qrcode?: string;
  pairingCode?: string;
  retries?: number;
  updatedAt?: string;
  queues?: Queue[];
  engineType?: string;
  proxyMode?: string;
  proxyId?: number | null;
  proxyGroupId?: number | null;
  connectionGroupId?: number | null;
}

/** Form values managed by Formik inside WhatsAppModal */
export interface WhatsAppFormValues {
  name: string;
  isDefault: boolean;
  keepAlive: boolean;
  syncHistory: boolean;
  engineType?: string;
  proxyMode?: string;
  proxyId?: number | null;
  proxyGroupId?: number | null;
  connectionGroupId?: number | null;
}

/** Proxy record returned by GET /proxies (password never serialized) */
export interface Proxy {
  id: number;
  label: string;
  scheme: string;
  host: string;
  port: number;
  username: string;
  status: string;
  proxyGroupId?: number | null;
  healthy: boolean;
  country?: string;
  countryCode?: string;
  city?: string;
  hasPassword: boolean;
  notes?: string;
  lastUsedAt?: string | null;
  lastCheckedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

/** Proxy group (pool with rotation) returned by GET /proxy-groups */
export interface ProxyGroup {
  id: number;
  name: string;
  rotationStrategy: string; // sticky | rotate
  proxyCount?: number;
  activeProxyCount?: number;
}

/** Connection group returned by GET /connection-groups */
export interface ConnectionGroup {
  id: number;
  name: string;
  connectionCount?: number;
}

/** Minimal queue stub embedded in user API responses */
export interface UserQueue {
  id: number;
  name: string;
}

/** Full user record returned by GET /users/:id (ver ShowUser em user.go) */
export interface UserDetail {
  id: number;
  name: string;
  email: string;
  password?: string;
  whatsappId?: number | null;
  cargoId?: number | null;
  alcance?: string;
  queues?: UserQueue[];
  cargo?: { id: number; name: string };
}

/**
 * Payload de POST /users e PUT /users/:id (ver createUserRequest em
 * user_mutation.go — ADR 0022, RBAC Cargo/Setor/Alcance). "queueIds"/"roleIds"/
 * "groupIds" legados (Group/Role) não existem mais neste contrato.
 */
export interface UserSavePayload {
  name: string;
  email: string;
  password?: string;
  whatsappId: number | null;
}

export interface PipelineStage {
  id?: number;
  name: string;
  order?: number;
}

export type PipelineType = "kanban" | "funnel";

export interface Pipeline {
  id: number;
  name: string;
  description?: string;
  type: PipelineType;
  stages: PipelineStage[];
  createdAt?: string;
  updatedAt?: string;
}
