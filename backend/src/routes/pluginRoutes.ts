
import { Router } from "express";
import { createProxyMiddleware } from "http-proxy-middleware";
import isAuth from "../middleware/isAuth";
import * as WhatsAppController from "../controllers/WhatsAppController";
import checkPermission from "../middleware/checkPermission";
import Plugin from "../models/Plugin";
import PluginInstallation from "../models/PluginInstallation";
import express from "express";

const pluginRoutes = Router();

pluginRoutes.post("/plugins/papi/test", express.json(), isAuth, WhatsAppController.testPapiConnection);

pluginRoutes.get("/plugins/api/v1/plugins/installed", isAuth, async (req, res) => {
    try {
        const tenantId = req.user.tenantId;
        console.log(`[PluginRoutes] Fetching installed plugins for tenant: ${tenantId}`);

        const installations = await PluginInstallation.findAll({
            where: {
                tenantId,
                status: "active"
            },
            include: [
                {
                    model: Plugin,
                    attributes: ["slug"]
                }
            ]
        });

        console.log(`[PluginRoutes] Found ${installations.length} active installations`);
        installations.forEach(inst => {
            console.log(`[PluginRoutes] - Plugin: ${inst.plugin?.slug}, Status: ${inst.status}`);
        });

        const activeSlugs = installations.map(inst => inst.plugin?.slug).filter(Boolean);
        console.log(`[PluginRoutes] Returning active slugs: ${JSON.stringify(activeSlugs)}`);

        // Also check if engine-papi is active via legacy check or other means if needed
        // For now, trust the DB.

        return res.json({ active: activeSlugs });
    } catch (err) {
        console.error("Failed to fetch installed plugins locally:", err);
        return res.status(500).json({ error: "Failed to fetch plugins" });
    }
});

// Proxy for Helpdesk Service
const helpdeskProxy = createProxyMiddleware({
    target: process.env.HELPDESK_URL || "http://localhost:3003",
    changeOrigin: true,
    on: {
        proxyReq: (proxyReq: any, req: any) => {
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
        error: (err: any, req: any, res: any) => {
            console.error("[HelpdeskProxy] Proxy Error:", err);
            res.status(502).json({ error: "Helpdesk Service Unavailable" });
        }
    }
});

// Helpdesk Routes - Robust Regex to handle both /protocols and /api/protocols
// Matches: /protocols, /api/protocols, /activities, /api/activities, etc.
// Using .all instead of .use to prevent Express from stripping the matched path into req.baseUrl
// which causes path duplication when we modify req.url manually.
pluginRoutes.all(/^\/(api\/)?(protocols|activities|my-activities|activity-templates)/, (req, res, next) => {
    // Reconstruct the URL for the proxy to ensure we send the correct path to Helpdesk
    // req.originalUrl contains the full path (e.g. /protocols?foo=bar or /api/protocols?foo=bar)
    // We want to ensure we send /protocols... or /activities... without /api prefix
    
    let targetUrl = req.originalUrl;
    
    // If the path starts with /api/, strip it
    if (targetUrl.startsWith('/api/')) {
        targetUrl = targetUrl.replace(/^\/api/, "");
    }
    
    // Force req.url to be this new path so proxy uses it
    req.url = targetUrl;
    
    next();
}, isAuth, helpdeskProxy);

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
        on: {
            proxyReq: (proxyReq: any, req: any) => {
                try {
                    // DEBUG LOGS
                    console.log("[PluginProxy] onProxyReq - User:", JSON.stringify(req.user));
                    console.log("[PluginProxy] onProxyReq - Headers:", JSON.stringify(req.headers));

                    let tenantId = req.user?.tenantId;
                    const profile = req.user?.profile;

                    // For Super Admin without tenant context, use Default Tenant
                    if (!tenantId && profile === "admin") {
                        // Try to get from header first (if frontend sends it)
                        const headerTenant = req.headers["x-tenant-id"] || req.headers["tenantid"];
                        if (headerTenant) {
                            tenantId = headerTenant;
                        } else {
                            // Fallback to Default Tenant UUID
                            tenantId = process.env.DEFAULT_TENANT_UUID || "550e8400-e29b-41d4-a716-446655440000";
                        }
                    }

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
            error: (err: any, req: any, res: any) => {
                console.error("[PluginProxy] Proxy Error:", err);
                res.status(502).json({ error: "Plugin Manager Unavailable" });
            }
        }
    } as any)
);

export default pluginRoutes;
