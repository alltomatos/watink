
import { Router } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import isAuth from "../middleware/isAuth";

const pluginRoutes = Router();

pluginRoutes.use(
    "/plugins",
    isAuth,
    createProxyMiddleware({
        // The target is the internal docker service name of the go plugin manager
        target: process.env.PLUGIN_MANAGER_URL || "http://plugin-manager:3005",
        changeOrigin: true,
        pathRewrite: {
            "^/plugins": "", // remove /plugins prefix when forwarding
        },
        onProxyReq: (proxyReq: any, req: any) => {
            try {
                const tenantId = req.user?.tenantId;
                const profile = req.user?.profile;
                if (tenantId) {
                    proxyReq.setHeader("x-tenant-id", tenantId.toString());
                }
                if (profile) {
                    proxyReq.setHeader("x-user-profile", profile.toString());
                }
            } catch (_) {
                // no-op
            }
        },
        onError: (err: any, req: any, res: any) => {
            console.error("Proxy Error:", err);
            res.status(502).json({ error: "Plugin Manager Unavailable" });
        }
    } as any)
);

export default pluginRoutes;
