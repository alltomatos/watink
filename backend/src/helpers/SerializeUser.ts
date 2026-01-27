import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  profileImage?: string;
  queues: Queue[];
  whatsapp: Whatsapp;
  permissions: string[];
  tenantId: number | string;
  emailVerified?: boolean;
}

export const SerializeUser = (user: User): SerializedUser => {
  // Enterprise RBAC: Permissions are resource:action
  // We map them to strings for frontend compatibility
  const groupRoles = user.groups?.flatMap(g => g.roles?.flatMap(r => r.permissions?.map(p => `${p.resource}:${p.action}`))) || [];
  // Direct roles
  const directRoles = user.roles?.flatMap(r => r.permissions?.map(p => `${p.resource}:${p.action}`)) || [];
  // Direct permissions (overrides)
  const directPermissions = user.permissions?.map(p => `${p.resource}:${p.action}`) || [];

  const allPermissions = [...new Set([...groupRoles, ...directRoles, ...directPermissions])];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    profileImage: user.profileImage,
    queues: user.queues,
    whatsapp: user.whatsapp,
    permissions: allPermissions,
    tenantId: user.tenantId,
    emailVerified: user.emailVerified
  };
};
