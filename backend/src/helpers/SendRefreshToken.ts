import { Response } from "express";

export const SendRefreshToken = (res: Response, token: string, expires?: Date): void => {
  const frontendUrl = process.env.FRONTEND_URL || "";
  const isHttps = frontendUrl.startsWith("https://");

  // Extract base domain for cookie sharing between subdomains
  // e.g., "http://app.localhost" -> ".localhost"
  // e.g., "https://app.example.com" -> ".example.com"
  let domain: string | undefined;
  try {
    const url = new URL(frontendUrl);
    const hostname = url.hostname;
    const hostParts = hostname.split(".");
    
    // Do not set domain for IP addresses (e.g. 100.123.62.90)
    // or for single-word hostnames (e.g. localhost)
    const isIpAddress = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(hostname);
    
    if (hostParts.length >= 2 && !isIpAddress) {
      // For localhost subdomains (app.localhost), we should NOT set domain
      if (hostParts[hostParts.length - 1] === "localhost") {
        domain = undefined;
      } else {
        domain = "." + hostParts.slice(-2).join(".");
      }
    }
  } catch (e) {
    // If URL parsing fails, don't set domain
    domain = undefined;
  }

  // For cross-subdomain cookies on HTTP (localhost dev), we need to relax sameSite
  // Browsers treat different subdomains as cross-site for sameSite purposes
  const cookieOptions: any = {
    httpOnly: true,
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
    path: "/",
  };

  if (expires) {
    cookieOptions.expires = expires;
  }

  // Set domain for subdomain sharing (e.g., app.localhost <-> api.localhost)
  if (domain) {
    cookieOptions.domain = domain;
  }

  res.cookie("jrt", token, cookieOptions);
};

