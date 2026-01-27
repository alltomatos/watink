import { Request, Response } from "express";
import ListSettingsService from "../../services/SettingServices/ListSettingsService";

/**
 * GET /mobile/v1/branding
 * Returns branding info for the mobile app (logo, title)
 */
export const getBranding = async (req: Request, res: Response): Promise<Response> => {
    // Branding is now public. We list all settings to find the branding keys.
    const settings = await ListSettingsService() || [];

    const mobileLogo = settings.find(s => s.key === "mobileLogo")?.value || "";
    const systemTitle = settings.find(s => s.key === "systemTitle")?.value || "Watink";
    const systemLogo = settings.find(s => s.key === "systemLogo")?.value || "";

    // If no mobile logo is set, fallback to system logo
    const logo = mobileLogo || systemLogo;

    return res.json({
        mobileLogo: logo,
        systemTitle,
        backendUrl: process.env.BACKEND_URL || "",
        frontendUrl: process.env.FRONTEND_URL || ""
    });
};
