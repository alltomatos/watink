import Queue from "../models/Queue";
import User from "../models/User";
import Whatsapp from "../models/Whatsapp";

interface SerializedUser {
  id: number;
  name: string;
  email: string;
  profile: string;
  queues: Queue[];
  whatsapp: Whatsapp;
  permissions: string[];
  tenantId: number | string;
}

export const SerializeUser = (user: User): SerializedUser => {
  const groupPermissions = user.group?.permissions?.map(p => p.name) || [];
  const individualPermissions = user.permissions?.map(p => p.name) || [];
  const allPermissions = [...new Set([...groupPermissions, ...individualPermissions])];

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    profile: user.profile,
    queues: user.queues,
    whatsapp: user.whatsapp,
    permissions: allPermissions,
    tenantId: user.tenantId
  };
};
