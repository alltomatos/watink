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

	api.interceptors.request.use(
		config => {
			const token = localStorage.getItem("token") || sessionStorage.getItem("token");
			if (token) {
				config.headers["Authorization"] = `Bearer ${JSON.parse(token)}`;
				setIsAuth(true);
			}
			return config;
		},
		error => {
			Promise.reject(error);
		}
	);

	api.interceptors.response.use(
		response => {
			return response;
		},
		async error => {
			const originalRequest = error.config;
			if (error?.response?.status === 403 && !originalRequest._retry) {
				originalRequest._retry = true;

				try {
					const { data } = await api.post("/auth/refresh_token");
					if (data) {
						// Detect where the token was and update it there
						if (localStorage.getItem("token")) {
							localStorage.setItem("token", JSON.stringify(data.token));
						} else {
							sessionStorage.setItem("token", JSON.stringify(data.token));
						}

						api.defaults.headers.Authorization = `Bearer ${data.token}`;
					}
					return api(originalRequest);
				} catch (err) {
					console.error("RefreshToken failed", err);
				}
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

	useEffect(() => {
		const token = localStorage.getItem("token") || sessionStorage.getItem("token");
		(async () => {
			if (token) {
				try {
					const { data } = await api.post("/auth/refresh_token");
					api.defaults.headers.Authorization = `Bearer ${data.token}`;
					setIsAuth(true);
					setUser(data.user);
				} catch (err) {
					toastError(err);
					// Robust Login Failure: Redirect immediately if validation fails
					localStorage.removeItem("token");
					sessionStorage.removeItem("token");
					api.defaults.headers.Authorization = undefined;
					setIsAuth(false);
					history.push("/login"); // Force redirect
				}
			}
			setLoading(false);
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
			const { data } = await api.post("/auth/login", userData);

			const tokenStr = JSON.stringify(data.token);
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
