import { verify } from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";

import AppError from "../errors/AppError";
import authConfig from "../config/auth";
import User from "../models/User";

interface TokenPayload {
  id: string;
  username: string;
  profile: string;
  tenantId: string | number;
  iat: number;
  exp: number;
}

const isAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const [, token] = authHeader.split(" ");

  try {
    const decoded = verify(token, authConfig.secret);
    const { id, profile, tenantId } = decoded as TokenPayload;

    const user = await User.findByPk(id);
    if (!user) {
      throw new AppError("ERR_INVALID_TOKEN", 401);
    }

    req.user = {
      id,
      profile,
      tenantId: user.tenantId
    };
  } catch (err) {
    console.log("DEBUG: isAuth failed for token:", token.slice(-6), "Error:", err.message);
    throw new AppError(
      "Invalid token. We'll try to assign a new one on next request",
      401
    );
  }

  return next();
};

export default isAuth;
