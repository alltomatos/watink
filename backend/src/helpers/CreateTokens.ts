import { sign } from "jsonwebtoken";
import authConfig from "../config/auth";
import User from "../models/User";

export const createAccessToken = (user: User): string => {
  const { secret, expiresIn } = authConfig;

  // Determine profile based on roles for legacy compatibility
  const isAdmin = user.roles?.some(role => role.name === "Admin") || user.email === "admin@admin.com";
  const profile = isAdmin ? "admin" : "user";

  return sign(
    { username: user.name, id: user.id, tenantId: user.tenantId, profile },
    secret,
    {
      expiresIn
    }
  );
};

export const createRefreshToken = (user: User): string => {
  const { refreshSecret, refreshExpiresIn } = authConfig;

  return sign({ id: user.id, tokenVersion: user.tokenVersion }, refreshSecret, {
    expiresIn: refreshExpiresIn
  });
};
