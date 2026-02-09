import { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import openSocket from "../../services/socket-io";

import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";

const useAuth = () => {
	const history = useHistory();
	const [isAuth, setIsAuth] = useState(false);
	const [loading, setLoading] = useState(true);
	const [user, setUser] = useState({});

	useEffect(() => {
		const requestInterceptor = api.interceptors.request.use(
			config => {
				const token = localStorage.getItem("token") || sessionStorage.getItem("token");
				if (token) {
					config.headers["Authorization"] = `Bearer ${token}`;
					setIsAuth(true);
				}
				return config;
			},
			error => {
				Promise.reject(error);
			}
		);

		const responseInterceptor = api.interceptors.response.use(
			response => {
				return response;
			},
			async error => {
				const originalRequest = error.config;

				if (error?.response?.status === 403) {
					toast.error("Você não tem permissão para acessar este recurso.", {
						autoClose: 7000,
					});
				}

				if (error?.response?.status === 401) {
					localStorage.removeItem("token");
					sessionStorage.removeItem("token");
					api.defaults.headers.Authorization = undefined;
					setIsAuth(false);
				}
				return Promise.reject(error);
			}
		);

		return () => {
			api.interceptors.request.eject(requestInterceptor);
			api.interceptors.response.eject(responseInterceptor);
		};
	}, [history]);

	useEffect(() => {
		const token = localStorage.getItem("token") || sessionStorage.getItem("token");
		(async () => {
			try {
				const { data } = await api.get("/auth/refresh_token");

				const tokenStr = data.token;
				if (!tokenStr) return; // Prevent setting undefined/null token

				// If we have a stored token preference (localStorage vs sessionStorage), respect it.
				// If neither, default to localStorage (or keep in memory only, but existing logic uses storage).
				// We'll update the storage to keep the fresh token available for other tabs/logic.
				if (sessionStorage.getItem("token")) {
					sessionStorage.setItem("token", tokenStr);
				} else {
					// Default to localStorage if previously there OR if completely new (fallback)
					localStorage.setItem("token", tokenStr);
				}

				api.defaults.headers.Authorization = `Bearer ${data.token}`;
				setIsAuth(true);
				setUser(data.user);
			} catch (err) {
				// Only if we HAD a token but refresh failed, we clear it and redirect.
				// If we didn't have a token and refresh failed (no cookie), it's just a normal unauthenticated state.
				if (token) {
					toastError(err);
					localStorage.removeItem("token");
					sessionStorage.removeItem("token");
					api.defaults.headers.Authorization = undefined;
					setIsAuth(false);
					history.push("/login");
				} else {
					// Silent fail - user just isn't logged in
					setIsAuth(false);
				}
			} finally {
				setLoading(false);
			}
		})();
	}, []);

	useEffect(() => {
		const socket = openSocket();

		if (!socket) return;

		socket.on("user", data => {
			if (data.action === "update" && data.user.id === user.id) {
				setUser(data.user);
			}
		});

		return () => {
			socket.disconnect();
		};
	}, [user]);

	const handleLogin = async (userData, rememberMe) => {
		setLoading(true);

		try {
			const { data } = await api.post("/auth/login", { ...userData, rememberMe });

			const tokenStr = data.token; // JSON.stringify removed
			if (rememberMe) {
				localStorage.setItem("token", tokenStr);
				sessionStorage.removeItem("token"); // Cleanup
			} else {
				sessionStorage.setItem("token", tokenStr);
				localStorage.removeItem("token"); // Cleanup
			}

			api.defaults.headers.Authorization = `Bearer ${data.token}`;
			setUser(data.user);
			setIsAuth(true);
			toast.success(i18n.t("auth.toasts.success"));
			history.push("/tickets");
			setLoading(false);
		} catch (err) {
			toastError(err);
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
			api.defaults.headers.Authorization = undefined;
			setLoading(false);
			history.push("/login");
		} catch (err) {
			toastError(err);
			setLoading(false);
		}
	};

	return { isAuth, user, loading, handleLogin, handleLogout };
};

export default useAuth;
