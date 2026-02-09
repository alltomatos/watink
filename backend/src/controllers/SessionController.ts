import { Request, Response } from "express";
import AppError from "../errors/AppError";

import AuthUserService from "../services/UserServices/AuthUserService";
import { SendRefreshToken } from "../helpers/SendRefreshToken";
import { RefreshTokenService } from "../services/AuthServices/RefreshTokenService";

export const store = async (req: Request, res: Response): Promise<Response> => {
  const { email, password, rememberMe } = req.body;

  const { token, serializedUser, refreshToken } = await AuthUserService({
    email,
    password
  });

  const expires = rememberMe
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    : undefined;

  SendRefreshToken(res, refreshToken, expires);

  return res.status(200).json({
    token,
    user: serializedUser
  });
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  // DEBUG: Log all cookies received
  console.log("[DEBUG refresh_token] Cookies received:", JSON.stringify(req.cookies));
  console.log("[DEBUG refresh_token] Cookie header:", req.headers.cookie);

  const token: string = req.cookies.jrt;

  if (!token) {
    console.log("[DEBUG refresh_token] No jrt cookie found!");
    throw new AppError("ERR_SESSION_EXPIRED", 401);
  }

  const { user, newToken, refreshToken } = await RefreshTokenService(
    res,
    token
  );

  SendRefreshToken(res, refreshToken);

  return res.json({ token: newToken, user });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const frontendUrl = process.env.FRONTEND_URL || "";
  const isHttps = frontendUrl.startsWith("https://");

  // Extract domain for cookie clearing (must match how it was set)
  let domain: string | undefined;
  try {
    const url = new URL(frontendUrl);
    const hostParts = url.hostname.split(".");
    if (hostParts.length >= 2) {
      if (hostParts[hostParts.length - 1] === "localhost") {
        domain = undefined;
      } else {
        domain = "." + hostParts.slice(-2).join(".");
      }
    }
  } catch (e) {
    domain = undefined;
  }

  const clearOptions: any = {
    httpOnly: true,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
    path: "/"
  };

  if (domain) {
    clearOptions.domain = domain;
  }

  res.clearCookie("jrt", clearOptions);

  return res.send();
};
