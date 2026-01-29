import { verify } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import AppError from "../errors/AppError";
import authConfig from "../config/auth";

interface TokenPayload {
  id: string;
  username: string;
  tenantId: string | number;
  iat: number;
  exp: number;
}

const isSaasAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const [, token] = authHeader.split(" ");

  try {
    const decoded = verify(token, authConfig.secret);
    const { id, tenantId } = decoded as TokenPayload;

    console.log(`[SaaS Auth] Authenticated SaaS request for user ${id} (Tenant: ${tenantId})`);

    // SaaS Token usually has ID 999999 or similar, which might not exist in DB.
    // Since we verified the signature with our secret, we trust the claims.

    req.user = {
      id,
      tenantId: tenantId.toString()
    };
  } catch (err) {
    console.error(`[SaaS Auth] Token verification failed:`, err);
    throw new AppError("ERR_INVALID_TOKEN", 401);
  }

  return next();
};

export default isSaasAuth;
