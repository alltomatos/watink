import axios from "axios";
import { getBackendUrl } from "../config";

// Construct the plugin-manager URL based on backend URL
// Backend URL is like: http://api.localhost/api
// Plugin-manager URL should be: http://api.localhost/plugins
const getPluginApiBaseUrl = () => {
  const backendUrl = getBackendUrl();

  if (backendUrl) {
    try {
      const url = new URL(backendUrl);
      // Append /plugins to the backend URL path
      // Ensure we don't duplicate if path already contains /plugins
      let cleanPath = url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
      if (cleanPath.endsWith('/plugins')) {
        cleanPath = cleanPath.replace(/\/plugins$/, '');
      }
      const baseUrl = `${url.protocol}//${url.host}${cleanPath}/plugins`;
      return baseUrl;
    } catch (e) {
      console.error("[pluginApi] Error parsing backendUrl:", e);
    }
  }

  // Fallback: assume same host as current page
  return `${window.location.protocol}//${window.location.host.replace('app.', 'api.')}/plugins`;
};

const pluginApi = axios.create({
  baseURL: getPluginApiBaseUrl(),
  withCredentials: true,
});

// Add request interceptor to include JWT token from localStorage
pluginApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default pluginApi;
