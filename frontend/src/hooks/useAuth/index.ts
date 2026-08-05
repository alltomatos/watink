import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { subscribeToSocket } from "../../services/sse-client";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

export interface AuthUser {
  id?: number;
  name?: string;
  email?: string;
  profile?: string;
  [key: string]: unknown;
}

interface UseAuthResult {
  isAuth: boolean;
  user: AuthUser;
  loading: boolean;
  handleLogin: (
    userData: { email: string; password: string },
    rememberMe?: boolean
  ) => Promise<void>;
  handleLogout: () => Promise<void>;
}

const useAuth = (): UseAuthResult => {
  const navigate = useNavigate();
  const [isAuth, setIsAuth] = useState(false);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AuthUser>({});

  const clearSession = useCallback(() => {
    localStorage.removeItem("token");
    sessionStorage.removeItem("token");
    delete api.defaults.headers.common["Authorization"];
    setUser({});
    setIsAuth(false);
  }, []);

  // Axios interceptors: attach token + refresh on 401
  useEffect(() => {
    // Várias chamadas de API disparam em paralelo na montagem (sidebar,
    // tickets, whatsapp, settings, plugins) — sem um token ainda em
    // memória (ex.: recarregou a página, só resta o cookie httpOnly de
    // refresh), todas batem 401 ao mesmo tempo. Sem esta variável
    // compartilhada, CADA requisição 401 disparava seu próprio
    // POST /auth/refresh_token independente (visto ao vivo: 4 chamadas
    // paralelas e redundantes para uma única sessão) — round-trips
    // desperdiçados que pesam justamente na primeira carga, quando a
    // rede já está mais lenta. Agora todas as 401 concorrentes aguardam
    // a MESMA promise de refresh em vez de cada uma renovar sozinha.
    let refreshPromise: Promise<string> | null = null;
    const refreshToken = () => {
      if (!refreshPromise) {
        refreshPromise = api
          .post<{ token: string }>("/auth/refresh_token")
          .then(({ data }) => {
            const store = localStorage.getItem("token") ? localStorage : sessionStorage;
            store.setItem("token", JSON.stringify(data.token));
            api.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
            return data.token;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      return refreshPromise;
    };

    const requestInterceptor = api.interceptors.request.use(
      (config) => {
        const token =
          localStorage.getItem("token") || sessionStorage.getItem("token");
        if (token) {
          config.headers["Authorization"] = `Bearer ${JSON.parse(token)}`;
          setIsAuth(true);
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    const responseInterceptor = api.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config || {};
        const status = error?.response?.status as number | undefined;
        const isRefreshRequest = originalRequest.url?.includes(
          "/auth/refresh_token"
        );

        if (status === 401 && isRefreshRequest) {
          clearSession();
          navigate("/login");
          return Promise.reject(error);
        }

        if (status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            await refreshToken();
            return api(originalRequest);
          } catch (err) {
            console.error("RefreshToken failed", err);
            clearSession();
            navigate("/login");
          }
        } else if (status === 401 && originalRequest._retry) {
          clearSession();
          navigate("/login");
        }
        return Promise.reject(error);
      }
    );

    return () => {
      api.interceptors.request.eject(requestInterceptor);
      api.interceptors.response.eject(responseInterceptor);
    };
  }, [clearSession, navigate]);

  // Initial token check + refresh
  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    (async () => {
      if (token) {
        try {
          const { data } = await api.post<{ token: string; user: AuthUser }>(
            "/auth/refresh_token"
          );
          api.defaults.headers.common[
            "Authorization"
          ] = `Bearer ${data.token}`;
          setIsAuth(true);
          setUser(data.user);
        } catch (err) {
          toastError(err);
          clearSession();
          navigate("/login");
        }
      }
      setLoading(false);
    })();
  }, [clearSession, navigate]);

  // Socket — live user updates
  useEffect(() => {
    const handleUser = (data: { action: string; user: AuthUser }) => {
      if (data.action === "update" && data.user.id === user.id) {
        setUser(data.user);
      }
    };

    return subscribeToSocket({ user: handleUser });
  }, [user]);

  const handleLogin = async (
    userData: { email: string; password: string },
    rememberMe = false
  ) => {
    setLoading(true);
    try {
      const { data } = await api.post<{ token: string; user: AuthUser }>(
        "/auth/login",
        { ...userData, rememberMe }
      );
      const tokenStr = JSON.stringify(data.token);
      if (rememberMe) {
        localStorage.setItem("token", tokenStr);
        sessionStorage.removeItem("token");
      } else {
        sessionStorage.setItem("token", tokenStr);
        localStorage.removeItem("token");
      }
      api.defaults.headers.common["Authorization"] = `Bearer ${data.token}`;
      setUser(data.user);
      setIsAuth(true);
      toast.success(i18n.t("auth.toasts.success"));
      navigate("/tickets");
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await api.delete("/auth/logout");
      setIsAuth(false);
      setUser({});
      localStorage.removeItem("token");
      sessionStorage.removeItem("token");
      delete api.defaults.headers.common["Authorization"];
      navigate("/login");
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  };

  return { isAuth, user, loading, handleLogin, handleLogout };
};

export default useAuth;
