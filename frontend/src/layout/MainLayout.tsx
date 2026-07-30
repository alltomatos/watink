/* @jsxImportSource react */
import React, { useState, useContext, useEffect, useCallback } from "react";
import { useLocation } from "react-router";
import { AuthContext } from "../context/Auth/AuthContext";
import api from "../services/api";
import { getBackendUrl } from "../helpers/urlUtils";
import { subscribeToSocket } from "../services/sse-client";
import type { SettingSocketEvent } from "../types/api";

import MainSidebar from "../components/MainSidebar";
import MainTopBar from "../components/MainTopBar";
import UserModal from "../components/UserModal";
import BackdropLoading from "../components/BackdropLoading";
import PageTransition from "../components/PageTransition";
import { TooltipProvider } from "../components/ui/tooltip";
import { useThemeContext } from "../context/DarkMode";

// Mapeamento dos valores DB → ThemeContext (espelhado de Settings/index.tsx)
const DB_THEME_MAP: Record<string, { appTheme: string; darkMode?: boolean }> = {
  whaticket: { appTheme: "google" },
  whatsapp:  { appTheme: "whatsapp" },
  dark:      { appTheme: "apple", darkMode: true },
};

const MainLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(() => {
    if (window.innerWidth < 1024) return false;
    const saved = localStorage.getItem("wt:sidebar:collapsed");
    return saved !== null ? saved !== "true" : true; // default: aberto no desktop
  });
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [_systemLogo, setSystemLogo] = useState("");
  const [systemTitle, setSystemTitle] = useState("Watink");
  const [_logoEnabled, setLogoEnabled] = useState(true);
  const [frontendVersion, setFrontendVersion] = useState("");

  const { user, handleLogout, loading } = useContext(AuthContext);
  const { setAppTheme, setDarkMode } = useThemeContext();

  // Fecha a barra lateral ao mudar de rota em telas pequenas (mobile/tablet)
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setDrawerOpen(false);
    }
  }, [location]);

  // Adapta o drawer automaticamente com base no redimensionamento da janela
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setDrawerOpen(true);
      } else {
        setDrawerOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // ── Fetch system settings ──
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get("/settings");
        const settings = Array.isArray(data) ? data : [];
        const logo = settings.find((s) => s.key === "systemLogo");
        const title = settings.find((s) => s.key === "systemTitle");
        const enabled = settings.find((s) => s.key === "systemLogoEnabled");
        const favicon = settings.find((s) => s.key === "systemFavicon");

        if (logo?.value) setSystemLogo(logo.value);
        if (title?.value) {
          setSystemTitle(title.value);
          document.title = title.value;
        }
        if (enabled) setLogoEnabled(enabled.value === "true");

        // Aplicar tema do tenant ao ThemeContext
        const themeSetting = settings.find((s) => s.key === "theme");
        if (themeSetting?.value) {
          const mapped = DB_THEME_MAP[themeSetting.value];
          if (mapped) {
            setAppTheme(mapped.appTheme);
            setDarkMode(mapped.darkMode ?? false);
          }
        }
        if (favicon?.value) {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = getBackendUrl(favicon.value) ?? "";
        }
      } catch {
        // Silent settings fetch
      }
    };
    fetchSettings();
    // setAppTheme/setDarkMode come from context — stable refs, intentionally omitted to run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Frontend version ──
  useEffect(() => {
    const loadVersion = async () => {
      try {
        const res = await fetch("/version.json", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setFrontendVersion(data?.version || "");
        }
      } catch {
        // version.json unavailable
      }
    };
    loadVersion();
  }, []);

  // ── Socket listener ──
  useEffect(() => {
    const handleSettings = (data: SettingSocketEvent) => {
      if (data.action === "update") {
        if (data.setting.key === "systemLogo") setSystemLogo(data.setting.value);
        if (data.setting.key === "systemTitle") {
          setSystemTitle(data.setting.value);
          document.title = data.setting.value;
        }
        if (data.setting.key === "systemLogoEnabled") setLogoEnabled(data.setting.value === "true");
        if (data.setting.key === "theme") {
          const mapped = DB_THEME_MAP[data.setting.value];
          if (mapped) {
            setAppTheme(mapped.appTheme);
            setDarkMode(mapped.darkMode ?? false);
          }
        }
        if (data.setting.key === "systemFavicon") {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          link.href = getBackendUrl(data.setting.value) ?? "";
        }
      }
    };

    return subscribeToSocket({ settings: handleSettings });
    // setAppTheme/setDarkMode are stable context refs; socket listener is intentionally mount-only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleDrawer = useCallback(() => {
    setDrawerOpen((prev) => {
      const next = !prev;
      // Persiste preferência apenas no desktop
      if (window.innerWidth >= 1024) {
        localStorage.setItem("wt:sidebar:collapsed", String(!next));
      }
      return next;
    });
  }, []);

  if (loading) return <BackdropLoading />;

  return (
    <TooltipProvider>
      <div className="flex h-screen w-full bg-background overflow-hidden">
        {/* Sidebar */}
        <MainSidebar
          collapsed={!drawerOpen}
          onToggle={toggleDrawer}
        />

        {/* Main Content Area */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden relative">
          <MainTopBar
            user={user}
            systemTitle={systemTitle}
            frontendVersion={frontendVersion}
            onOpenUserModal={() => setUserModalOpen(true)}
            onLogout={handleLogout}
          />

          <main className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-background/50 relative">
            <PageTransition>
              {children}
            </PageTransition>
          </main>
        </div>

        {/* Modals */}
        <UserModal
          open={userModalOpen}
          onClose={() => setUserModalOpen(false)}
          userId={user?.id}
        />
      </div>
    </TooltipProvider>
  );
};

export default MainLayout;
