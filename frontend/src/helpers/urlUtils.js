import { getBackendUrl as getBackendUrlFromConfig } from "../config";

export const getBackendUrl = (url) => {
    if (!url) return url;

    // Use runtime config from window.ENV or build config
    const backendUrl = getBackendUrlFromConfig() || '/';

    // Check if URL contains '/public/' and fix it to be relative to root of backend
    if (url.includes('/public/')) {
        const parts = url.split('/public/');
        const relativePath = `public/${parts[1]}`;
        const safeBackendUrl = backendUrl.endsWith('/') ? backendUrl : `${backendUrl}/`;
        return `${safeBackendUrl}${relativePath}`;
    }

    // New Logic: If it's a relative path (starts with /), prepend backendUrl
    if (url.startsWith('/') && !url.startsWith('http')) {
        const safeBackendUrl = backendUrl.endsWith('/') ? backendUrl : `${backendUrl}/`;
        // Remove leading slash to avoid double slash
        const cleanUrl = url.substring(1);
        return `${safeBackendUrl}${cleanUrl}`;
    }

    return url;
};
