function getConfig(name, defaultValue = null) {
  if (typeof window !== "undefined") {
    const runtimeEnv = window.ENV;
    if (runtimeEnv && runtimeEnv[name] !== undefined) {
      return runtimeEnv[name];
    }
  }
  const value = import.meta.env[name];
  return value !== undefined ? value : defaultValue;
}

export function getBackendUrl() {
  return getConfig("VITE_BACKEND_URL") || "/";
}

export function getHoursCloseTicketsAuto() {
  return getConfig("VITE_HOURS_CLOSE_TICKETS_AUTO");
}

export function getPluginManagerUrl() {
  return getConfig("VITE_PLUGIN_MANAGER_URL") || getBackendUrl();
}
