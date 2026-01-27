import { getBackendUrl as getBackendUrlFromConfig } from "../config";

export const getBackendUrl = (url) => {
    // Use runtime config from window.ENV or build config
    const backendUrl = getBackendUrlFromConfig() || '/';
    const safeBackendUrl = backendUrl.endsWith('/') ? backendUrl : `${backendUrl}/`;

    if (!url) return safeBackendUrl;

    // Check if URL contains '/public/' and fix it to be relative to root of backend
    if (url.includes('/public/')) {
        const parts = url.split('/public/');
        const relativePath = `public/${parts[1]}`;
        return `${safeBackendUrl}${relativePath}`;
    }

    // New Logic: If it's a relative path (starts with /), prepend backendUrl
    if (url.startsWith('/') && !url.startsWith('http')) {
        // Remove leading slash to avoid double slash
        const cleanUrl = url.substring(1);
        return `${safeBackendUrl}${cleanUrl}`;
    }

    // If it's a relative path but doesn't start with / (e.g. "public/...")
    if (!url.startsWith('http')) {
        return `${safeBackendUrl}${url}`;
    }

    return url;
};
