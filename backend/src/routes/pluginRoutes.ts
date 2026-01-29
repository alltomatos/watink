
import { Router } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import isAuth from "../middleware/isAuth";
import checkPermission from "../middleware/checkPermission";

const pluginRoutes = Router();

pluginRoutes.use(
    "/plugins",
    isAuth,
    checkPermission("marketplace:read"),
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
            } catch (err) {
                console.error("Error in onProxyReq:", err);
            }
        },
        onError: (err: any, req: any, res: any) => {
            console.error("[PluginProxy] Proxy Error:", err);
            res.status(502).json({ error: "Plugin Manager Unavailable" });
        }
    } as any)
);

export default pluginRoutes;
