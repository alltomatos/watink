import React, { createContext, useState, useContext, useMemo, useEffect } from "react";
import PropTypes from "prop-types";
import { createMuiTheme, ThemeProvider as MUIThemeProvider } from "@material-ui/core/styles";
import { CssBaseline } from "@material-ui/core";
import { zhCN, ptBR, esES } from "@material-ui/core/locale";

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
	const [darkMode, setDarkMode] = useState(false);
	const [appTheme, setAppTheme] = useState("whaticket");
	const [locale, setLocale] = useState(ptBR);

	useEffect(() => {
		const storedTheme = localStorage.getItem("appTheme");
		if (storedTheme) {
			setAppTheme(storedTheme);
		}
		const i18nlocale = localStorage.getItem("i18nextLng");
		const browserLocale = i18nlocale?.substring(0, 2) + i18nlocale?.substring(3, 5);

		if (browserLocale === "ptBR") {
			setLocale(ptBR);
		} else if (browserLocale === "esES") {
			setLocale(esES);
		} else if (browserLocale === "zhCN") {
			setLocale(zhCN);
		}
	}, []);

	const toggleTheme = () => {
		setDarkMode(prevMode => !prevMode);
	};

	const handleSetAppTheme = (newTheme) => {
		setAppTheme(newTheme);
		localStorage.setItem("appTheme", newTheme);
	};

	const theme = useMemo(() => {
		if (appTheme === "saas") {
			return createMuiTheme({
				palette: {
					type: darkMode ? "dark" : "light",
					primary: { main: "#2563EB", contrastText: "#FFFFFF" }, // Royal Blue
					secondary: { main: "#0F172A" }, // Midnight Slate
					success: { main: "#22c55e" },
					warning: { main: "#f59e0b" },
					error: { main: "#ef4444" },
					background: {
						default: darkMode ? "#0f172a" : "#f1f5f9", // Slate 900 / Slate 100
						paper: darkMode ? "#1e293b" : "#ffffff", // Slate 800 / White
					},
					text: {
						primary: darkMode ? "#f8fafc" : "#334155", // Slate 50 / Slate 700
						secondary: darkMode ? "#94a3b8" : "#64748b", // Slate 400 / Slate 500
					},
					divider: darkMode ? "#334155" : "#e2e8f0",
				},
				typography: {
					fontFamily: "'Inter', sans-serif",
					h1: { fontWeight: 700 },
					h2: { fontWeight: 700 },
					h3: { fontWeight: 600 },
					h4: { fontWeight: 600 },
					h5: { fontWeight: 600 },
					h6: { fontWeight: 600, fontSize: "1.1rem" },
					body1: { fontSize: "0.925rem", lineHeight: 1.5 },
					body2: { fontSize: "0.875rem", lineHeight: 1.43 },
					button: { fontWeight: 600, textTransform: "none" },
				},
				shape: { borderRadius: 16 },
				overrides: {
					MuiCssBaseline: {
						"@global": {
							body: {
								backgroundColor: darkMode ? "#0f172a" : "#f1f5f9",
							},
						},
					},
					MuiButton: {
						root: {
							textTransform: "none",
							fontWeight: 600,
							borderRadius: 12,
							boxShadow: "none",
							"&:hover": { boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)" },
						},
						containedPrimary: {
							background: "linear-gradient(to right, #6366f1, #4f46e5)",
							"&:hover": { background: "linear-gradient(to right, #4f46e5, #4338ca)" },
						},
					},
					MuiPaper: {
						root: { backgroundImage: "none" },
						elevation1: { boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)" },
						rounded: { borderRadius: 16 },
					},
					MuiCard: {
						root: {
							borderRadius: 16,
							border: darkMode ? "1px solid #334155" : "1px solid #e2e8f0",
							boxShadow: "none",
						},
					},
					MuiDrawer: {
						paper: {
							// Sidebar escura estilo Linear/Stripe - SEMPRE escura
							backgroundColor: "#0F172A",
							color: "#94A3B8",
							borderRight: "1px solid #1E293B",
						},
					},
					MuiAppBar: {
						colorPrimary: {
							backgroundColor: darkMode ? "#1e293b" : "#ffffff",
							color: darkMode ? "#f8fafc" : "#334155",
							boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
						},
					},
					MuiListItem: {
						root: {
							borderRadius: 8,
							marginBottom: 4,
							marginLeft: 8,
							marginRight: 8,
							transition: "all 0.15s ease-in-out",
							// Para sidebar escura estilo Linear/Stripe
							"&.Mui-selected": {
								backgroundColor: "#1E293B",
								color: "#3B82F6",
								"& .MuiListItemIcon-root": { color: "#3B82F6" },
								"& .MuiListItemText-primary": { color: "#F8FAFC", fontWeight: 600 },
								"&:hover": { backgroundColor: "#334155" },
							},
						},
						button: {
							"&:hover": {
								backgroundColor: "#1E293B",
							},
						},
					},
					MuiListItemIcon: {
						root: {
							// Ícones da sidebar escura
							color: "#94A3B8",
							minWidth: 40,
						},
					},
					MuiListItemText: {
						primary: {
							fontWeight: 500,
							fontSize: "0.875rem",
							// Texto da sidebar escura
							color: "#94A3B8",
						},
						secondary: {
							color: "#64748B",
						},
					},
					MuiDialog: {
						paper: {
							backgroundColor: darkMode ? "rgba(30, 41, 59, 0.95)" : "rgba(255, 255, 255, 0.95)",
							backdropFilter: "blur(16px)",
							borderRadius: 24,
						},
					},
					MuiTableHead: {
						root: {
							backgroundColor: darkMode ? "#1e293b" : "#f8fafc",
							"& .MuiTableCell-head": {
								fontWeight: 600,
								color: darkMode ? "#94a3b8" : "#64748b",
								textTransform: "uppercase",
								fontSize: "0.75rem",
								letterSpacing: "0.05em",
							},
						},
					},
					MuiTableCell: {
						root: {
							borderBottom: darkMode ? "1px solid #334155" : "1px solid #e2e8f0",
						},
					},
					MuiOutlinedInput: {
						root: {
							borderRadius: 12,
							backgroundColor: darkMode ? "#0f172a" : "#f8fafc",
							"&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#6366f1" },
							"&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#6366f1", borderWidth: 2 },
						},
						notchedOutline: {
							borderColor: darkMode ? "#334155" : "#e2e8f0",
						},
					},
					MuiChip: {
						root: {
							borderRadius: 8,
							fontWeight: 500,
						},
						colorPrimary: {
							background: "linear-gradient(to right, #6366f1, #4f46e5)",
							color: "#ffffff",
						},
					},
					MuiTooltip: {
						tooltip: {
							backgroundColor: "#1e293b",
							color: "#f8fafc",
							fontSize: "0.75rem",
							borderRadius: 8,
						},
					},
					MuiFab: {
						primary: {
							background: "linear-gradient(to right, #6366f1, #4f46e5)",
							"&:hover": { background: "linear-gradient(to right, #4f46e5, #4338ca)" },
						},
					},
					MuiAvatar: {
						colorDefault: {
							backgroundColor: darkMode ? "#334155" : "#e2e8f0",
							color: darkMode ? "#94a3b8" : "#64748b",
						},
					},
				},
			}, locale);
		}

		// Corporate Theme
		if (appTheme === "corporate") {
			return createMuiTheme({
				palette: {
					type: darkMode ? "dark" : "light",
					primary: { main: "#1e40af" }, // Corporate Blue
					secondary: { main: "#0f172a" }, // Navy Dark
					success: { main: "#16a34a" },
					warning: { main: "#d97706" },
					error: { main: "#dc2626" },
					background: {
						default: darkMode ? "#0f172a" : "#f1f5f9", // Slate 100
						paper: darkMode ? "#1e293b" : "#ffffff",
					},
					text: {
						primary: darkMode ? "#f8fafc" : "#1e293b", // Slate 800
						secondary: darkMode ? "#94a3b8" : "#64748b", // Slate 500
					},
					divider: darkMode ? "#334155" : "#e2e8f0",
				},
				typography: {
					fontFamily: "'Inter', sans-serif",
					h1: { fontWeight: 700, letterSpacing: "-0.025em" },
					h2: { fontWeight: 700, letterSpacing: "-0.025em" },
					h3: { fontWeight: 600 },
					h4: { fontWeight: 600 },
					h5: { fontWeight: 600 },
					h6: { fontWeight: 600, fontSize: "1.1rem" },
					body1: { fontSize: "0.925rem", lineHeight: 1.6 },
					body2: { fontSize: "0.875rem", lineHeight: 1.5 },
					button: { fontWeight: 600 },
				},
				shape: { borderRadius: 8 },
				overrides: {
					MuiCssBaseline: {
						"@global": {
							body: {
								backgroundColor: darkMode ? "#0f172a" : "#f1f5f9",
							},
						},
					},
					MuiButton: {
						root: {
							textTransform: "none",
							fontWeight: 600,
							borderRadius: 8,
							boxShadow: "none",
							"&:hover": { boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)" },
						},
						containedPrimary: {
							backgroundColor: "#1e40af",
							"&:hover": { backgroundColor: "#1d4ed8" },
						},
					},
					MuiPaper: {
						root: { backgroundImage: "none" },
						elevation1: { boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)" },
						rounded: { borderRadius: 12 },
					},
					MuiCard: {
						root: {
							borderRadius: 12,
							border: darkMode ? "1px solid #334155" : "1px solid #e2e8f0",
							boxShadow: "none",
						},
					},
					MuiDrawer: {
						paper: {
							backgroundColor: "#4f46e5",
							color: "#ffffff",
							borderRight: "none",
						},
					},
					MuiAppBar: {
						colorPrimary: {
							backgroundColor: darkMode ? "#1e293b" : "#ffffff",
							color: darkMode ? "#f8fafc" : "#1e293b",
							boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1)",
						},
					},
					MuiListItem: {
						root: {
							borderRadius: 8,
							marginBottom: 4,
							"&.Mui-selected": {
								backgroundColor: "rgba(255, 255, 255, 0.2)",
								color: "#ffffff",
								"& .MuiListItemIcon-root": { color: "#ffffff" },
								"&:hover": { backgroundColor: "rgba(255, 255, 255, 0.25)" },
							},
						},
						button: {
							color: "#ffffff",
							"&:hover": {
								backgroundColor: "rgba(255, 255, 255, 0.15)",
								color: "#ffffff",
							},
						},
					},
					MuiListItemIcon: {
						root: {
							color: "inherit",
							minWidth: 40,
						},
					},
					MuiListItemText: {
						primary: {
							fontWeight: 500,
						},
					},
					MuiDialog: {
						paper: {
							borderRadius: 16,
							boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.25)",
						},
					},
					MuiTableHead: {
						root: {
							backgroundColor: darkMode ? "#1e293b" : "#f8fafc",
							"& .MuiTableCell-head": {
								fontWeight: 600,
								color: darkMode ? "#94a3b8" : "#475569",
								textTransform: "uppercase",
								fontSize: "0.75rem",
								letterSpacing: "0.05em",
							},
						},
					},
					MuiTableCell: {
						root: {
							borderBottom: darkMode ? "1px solid #334155" : "1px solid #e2e8f0",
						},
					},
					MuiOutlinedInput: {
						root: {
							borderRadius: 8,
							"&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#1e40af" },
							"&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#1e40af", borderWidth: 2 },
						},
					},
					MuiChip: {
						root: {
							borderRadius: 6,
							fontWeight: 500,
						},
					},
					MuiTooltip: {
						tooltip: {
							backgroundColor: "#1e293b",
							color: "#f8fafc",
							fontSize: "0.75rem",
							borderRadius: 6,
						},
					},
					MuiFab: {
						primary: {
							backgroundColor: "#1e40af",
							"&:hover": { backgroundColor: "#1d4ed8" },
						},
					},
					MuiAvatar: {
						colorDefault: {
							backgroundColor: darkMode ? "#334155" : "#e2e8f0",
							color: darkMode ? "#94a3b8" : "#64748b",
						},
					},
				},
			}, locale);
		}

		// WhatsApp Theme
		if (appTheme === "whatsapp") {
			return createMuiTheme({
				palette: {
					type: darkMode ? "dark" : "light",
					primary: { main: "#25D366" },  // Verde WhatsApp
					secondary: { main: "#128C7E" }, // Teal secundário
					success: { main: "#25D366" },
					warning: { main: "#FFB300" },
					error: { main: "#F15C6D" },
					background: {
						default: darkMode ? "#0B141A" : "#ECE5DD",  // Fundo bege clássico
						paper: darkMode ? "#1F2C34" : "#FFFFFF",
					},
					text: {
						primary: darkMode ? "#E9EDEF" : "#303030",
						secondary: darkMode ? "#8696A0" : "#667781",
					},
					divider: darkMode ? "#2A3942" : "#E9EDEF",
				},
				typography: {
					fontFamily: "'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif",
					h1: { fontWeight: 600 },
					h2: { fontWeight: 600 },
					h3: { fontWeight: 600 },
					h4: { fontWeight: 600 },
					h5: { fontWeight: 600 },
					h6: { fontWeight: 600, fontSize: "1.1rem" },
					body1: { fontSize: "0.9375rem", lineHeight: 1.5 },
					body2: { fontSize: "0.875rem", lineHeight: 1.43 },
					button: { fontWeight: 500, textTransform: "none" },
				},
				shape: { borderRadius: 8 },
				overrides: {
					MuiCssBaseline: {
						"@global": {
							body: {
								backgroundColor: darkMode ? "#0B141A" : "#ECE5DD",
							},
						},
					},
					MuiButton: {
						root: {
							textTransform: "none",
							fontWeight: 500,
							borderRadius: 8,
							boxShadow: "none",
							"&:hover": { boxShadow: "none" },
						},
						containedPrimary: {
							backgroundColor: "#25D366",
							"&:hover": { backgroundColor: "#1DA851" },
						},
					},
					MuiPaper: {
						root: { backgroundImage: "none" },
						elevation1: { boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)" },
						rounded: { borderRadius: 8 },
					},
					MuiCard: {
						root: {
							borderRadius: 8,
							border: darkMode ? "1px solid #2A3942" : "1px solid #E9EDEF",
							boxShadow: "none",
						},
					},
					MuiDrawer: {
						paper: {
							backgroundColor: darkMode ? "#111B21" : "#FFFFFF",
							color: darkMode ? "#E9EDEF" : "#303030",
							borderRight: darkMode ? "1px solid #2A3942" : "1px solid #E9EDEF",
						},
					},
					MuiAppBar: {
						colorPrimary: {
							backgroundColor: darkMode ? "#1F2C34" : "#075E54",
							color: "#FFFFFF",
							boxShadow: "none",
						},
					},
					MuiListItem: {
						root: {
							borderRadius: 0,
							"&.Mui-selected": {
								backgroundColor: darkMode ? "#2A3942" : "#F0F2F5",
								borderLeft: "4px solid #25D366",
								"& .MuiListItemIcon-root": { color: "#25D366" },
								"&:hover": { backgroundColor: darkMode ? "#3B4A54" : "#E9EDEF" },
							},
						},
						button: {
							"&:hover": {
								backgroundColor: darkMode ? "#202C33" : "#F5F6F6",
							},
						},
					},
					MuiListItemIcon: {
						root: {
							color: darkMode ? "#8696A0" : "#54656F",
							minWidth: 40,
						},
					},
					MuiListItemText: {
						primary: {
							fontWeight: 500,
							color: darkMode ? "#E9EDEF" : "#303030",
						},
						secondary: {
							color: darkMode ? "#8696A0" : "#667781",
						},
					},
					MuiDialog: {
						paper: {
							borderRadius: 12,
							backgroundColor: darkMode ? "#1F2C34" : "#FFFFFF",
						},
					},
					MuiTableHead: {
						root: {
							backgroundColor: darkMode ? "#1F2C34" : "#F0F2F5",
							"& .MuiTableCell-head": {
								fontWeight: 600,
								color: darkMode ? "#8696A0" : "#54656F",
								textTransform: "uppercase",
								fontSize: "0.75rem",
								letterSpacing: "0.05em",
							},
						},
					},
					MuiTableCell: {
						root: {
							borderBottom: darkMode ? "1px solid #2A3942" : "1px solid #E9EDEF",
						},
					},
					MuiOutlinedInput: {
						root: {
							borderRadius: 8,
							backgroundColor: darkMode ? "#2A3942" : "#F0F2F5",
							"&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#25D366" },
							"&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#25D366", borderWidth: 2 },
						},
						notchedOutline: {
							borderColor: darkMode ? "#3B4A54" : "#E9EDEF",
						},
					},
					MuiChip: {
						root: {
							borderRadius: 16,
							fontWeight: 500,
						},
						colorPrimary: {
							backgroundColor: "#25D366",
							color: "#FFFFFF",
						},
					},
					MuiTooltip: {
						tooltip: {
							backgroundColor: "#1F2C34",
							color: "#E9EDEF",
							fontSize: "0.8125rem",
							borderRadius: 6,
						},
					},
					MuiFab: {
						primary: {
							backgroundColor: "#25D366",
							"&:hover": { backgroundColor: "#1DA851" },
						},
					},
					MuiAvatar: {
						colorDefault: {
							backgroundColor: darkMode ? "#2A3942" : "#DFE5E7",
							color: darkMode ? "#8696A0" : "#54656F",
						},
					},
				},
			}, locale);
		}

		// Dark Mode Theme - Tema escuro profissional WCAG AA
		if (appTheme === "dark") {
			return createMuiTheme({
				palette: {
					type: "dark",
					// Cor primária mais clara para contraste no dark mode
					primary: { main: "#60A5FA", contrastText: "#0F172A" }, // Sky 400
					secondary: { main: "#A78BFA" }, // Violet 400
					success: { main: "#34D399" }, // Emerald 400
					warning: { main: "#FBBF24" }, // Amber 400
					error: { main: "#F87171" }, // Red 400
					background: {
						default: "#0F172A", // Slate 900 - Fundo principal
						paper: "#1E293B", // Slate 800 - Cards/Modais
					},
					text: {
						primary: "#F8FAFC", // Slate 50 - Texto principal (WCAG AA)
						secondary: "#94A3B8", // Slate 400 - Subtítulos
					},
					divider: "#334155", // Slate 700
					action: {
						active: "#E2E8F0",
						hover: "rgba(248, 250, 252, 0.08)",
						selected: "rgba(96, 165, 250, 0.16)",
					},
				},
				typography: {
					fontFamily: "'Inter', 'Segoe UI', 'Roboto', sans-serif",
					h1: { fontWeight: 700, color: "#F8FAFC" },
					h2: { fontWeight: 700, color: "#F8FAFC" },
					h3: { fontWeight: 600, color: "#F8FAFC" },
					h4: { fontWeight: 600, color: "#F8FAFC" },
					h5: { fontWeight: 600, color: "#F8FAFC" },
					h6: { fontWeight: 600, fontSize: "1rem", color: "#F8FAFC" },
					body1: { fontSize: "0.9375rem", lineHeight: 1.6, color: "#F8FAFC" },
					body2: { fontSize: "0.875rem", lineHeight: 1.5, color: "#CBD5E1" },
					button: { fontWeight: 600, textTransform: "none" },
					caption: { color: "#94A3B8" },
				},
				shape: { borderRadius: 8 },
				overrides: {
					MuiCssBaseline: {
						"@global": {
							body: {
								backgroundColor: "#0F172A",
								color: "#F8FAFC",
								// Scrollbar estilizada para dark mode
								"&::-webkit-scrollbar": {
									width: "8px",
									height: "8px",
								},
								"&::-webkit-scrollbar-track": {
									background: "#1E293B",
								},
								"&::-webkit-scrollbar-thumb": {
									background: "#475569",
									borderRadius: "4px",
								},
								"&::-webkit-scrollbar-thumb:hover": {
									background: "#64748B",
								},
							},
							"*": {
								scrollbarWidth: "thin",
								scrollbarColor: "#475569 #1E293B",
							},
							// Fix para autofill do navegador
							"input:-webkit-autofill, input:-webkit-autofill:hover, input:-webkit-autofill:focus, input:-webkit-autofill:active": {
								"-webkit-box-shadow": "0 0 0 30px #0F172A inset !important",
								"-webkit-text-fill-color": "#F8FAFC !important",
								"caret-color": "#F8FAFC !important",
							},
						},
					},
					MuiButton: {
						root: {
							textTransform: "none",
							fontWeight: 600,
							borderRadius: 8,
							padding: "8px 16px",
							boxShadow: "none",
							transition: "all 0.2s ease-in-out",
							"&:hover": {
								boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
							},
						},
						containedPrimary: {
							backgroundColor: "#60A5FA",
							color: "#0F172A",
							"&:hover": { backgroundColor: "#3B82F6" },
						},
						outlinedPrimary: {
							borderColor: "#60A5FA",
							color: "#60A5FA",
							"&:hover": {
								backgroundColor: "rgba(96, 165, 250, 0.08)",
								borderColor: "#3B82F6",
							},
						},
						textPrimary: {
							color: "#60A5FA",
							"&:hover": { backgroundColor: "rgba(96, 165, 250, 0.08)" },
						},
					},
					MuiPaper: {
						root: {
							backgroundImage: "none",
							backgroundColor: "#1E293B",
							color: "#F8FAFC",
						},
						elevation1: {
							boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.3), 0 1px 2px 0 rgba(0, 0, 0, 0.2)",
							border: "1px solid #334155",
						},
						elevation2: {
							boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3), 0 2px 4px -1px rgba(0, 0, 0, 0.2)",
						},
						rounded: { borderRadius: 12 },
					},
					MuiCard: {
						root: {
							borderRadius: 12,
							border: "1px solid #334155",
							backgroundColor: "#1E293B",
							boxShadow: "none",
						},
					},
					MuiDrawer: {
						paper: {
							// Sidebar mais escura que o conteúdo
							backgroundColor: "#020617",
							color: "#E2E8F0",
							borderRight: "1px solid #334155",
						},
					},
					MuiAppBar: {
						colorPrimary: {
							backgroundColor: "#1E293B",
							color: "#F8FAFC",
							boxShadow: "none",
							borderBottom: "1px solid #334155",
						},
					},
					MuiListItem: {
						root: {
							borderRadius: 8,
							marginBottom: 4,
							marginLeft: 8,
							marginRight: 8,
							transition: "all 0.15s ease-in-out",
							"&.Mui-selected": {
								backgroundColor: "#1E293B",
								color: "#60A5FA",
								"& .MuiListItemIcon-root": { color: "#60A5FA" },
								"& .MuiListItemText-primary": {
									color: "#F8FAFC",
									fontWeight: 600,
								},
								"&:hover": { backgroundColor: "#334155" },
							},
						},
						button: {
							"&:hover": {
								backgroundColor: "#1E293B",
							},
						},
					},
					MuiListItemIcon: {
						root: {
							// Ícones claros - NUNCA escuros
							color: "#E2E8F0",
							minWidth: 40,
						},
					},
					MuiListItemText: {
						primary: {
							fontWeight: 500,
							fontSize: "0.875rem",
							color: "#E2E8F0",
						},
						secondary: {
							color: "#94A3B8",
						},
					},
					MuiListSubheader: {
						root: {
							backgroundColor: "transparent",
							color: "#64748B",
							fontSize: "0.6875rem",
							fontWeight: 600,
							textTransform: "uppercase",
							letterSpacing: "0.1em",
						},
					},
					MuiDialog: {
						paper: {
							backgroundColor: "#1E293B",
							borderRadius: 16,
							border: "1px solid #334155",
							boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
						},
					},
					MuiDialogTitle: {
						root: {
							color: "#F8FAFC",
						},
					},
					MuiDialogContent: {
						root: {
							color: "#CBD5E1",
						},
					},
					MuiTableHead: {
						root: {
							backgroundColor: "#0F172A",
							"& .MuiTableCell-head": {
								fontWeight: 600,
								color: "#94A3B8",
								textTransform: "uppercase",
								fontSize: "0.75rem",
								letterSpacing: "0.05em",
								borderBottom: "1px solid #334155",
							},
						},
					},
					MuiTableBody: {
						root: {
							"& .MuiTableRow-root:hover": {
								backgroundColor: "#334155",
							},
						},
					},
					MuiTableCell: {
						root: {
							borderBottom: "1px solid #334155",
							color: "#E2E8F0",
						},
					},
					MuiOutlinedInput: {
						root: {
							borderRadius: 8,
							// Inputs com background escuro
							backgroundColor: "#020617",
							color: "#F8FAFC",
							"&:hover .MuiOutlinedInput-notchedOutline": {
								borderColor: "#60A5FA",
							},
							"&.Mui-focused .MuiOutlinedInput-notchedOutline": {
								borderColor: "#60A5FA",
								borderWidth: 2,
							},
						},
						notchedOutline: {
							borderColor: "#334155",
						},
						input: {
							color: "#F8FAFC",
							"&::placeholder": {
								color: "#64748B",
								opacity: 1,
							},
						},
					},
					MuiInputLabel: {
						root: {
							color: "#94A3B8",
							"&.Mui-focused": {
								color: "#60A5FA",
							},
						},
					},
					MuiInputBase: {
						input: {
							color: "#F8FAFC",
							"&::placeholder": {
								color: "#64748B",
								opacity: 1,
							},
						},
					},
					MuiSelect: {
						icon: {
							color: "#94A3B8",
						},
					},
					MuiMenuItem: {
						root: {
							color: "#E2E8F0",
							"&:hover": {
								backgroundColor: "#334155",
							},
							"&.Mui-selected": {
								backgroundColor: "#1E293B",
								"&:hover": {
									backgroundColor: "#334155",
								},
							},
						},
					},
					MuiChip: {
						root: {
							borderRadius: 6,
							fontWeight: 500,
							fontSize: "0.75rem",
							backgroundColor: "#334155",
							color: "#E2E8F0",
						},
						colorPrimary: {
							backgroundColor: "rgba(96, 165, 250, 0.16)",
							color: "#60A5FA",
						},
						colorSecondary: {
							backgroundColor: "rgba(167, 139, 250, 0.16)",
							color: "#A78BFA",
						},
					},
					MuiTooltip: {
						tooltip: {
							backgroundColor: "#334155",
							color: "#F8FAFC",
							fontSize: "0.75rem",
							fontWeight: 500,
							borderRadius: 6,
							border: "1px solid #475569",
						},
					},
					MuiFab: {
						primary: {
							backgroundColor: "#60A5FA",
							color: "#0F172A",
							"&:hover": { backgroundColor: "#3B82F6" },
						},
					},
					MuiAvatar: {
						colorDefault: {
							backgroundColor: "#334155",
							color: "#E2E8F0",
						},
					},
					MuiTabs: {
						indicator: {
							backgroundColor: "#60A5FA",
							height: 3,
							borderRadius: "3px 3px 0 0",
						},
					},
					MuiTab: {
						root: {
							textTransform: "none",
							fontWeight: 500,
							fontSize: "0.875rem",
							color: "#94A3B8",
							"&.Mui-selected": {
								color: "#60A5FA",
							},
						},
					},
					MuiSwitch: {
						switchBase: {
							color: "#64748B",
							"&.Mui-checked": {
								color: "#60A5FA",
								"& + .MuiSwitch-track": {
									backgroundColor: "#60A5FA",
								},
							},
						},
						track: {
							backgroundColor: "#475569",
						},
					},
					MuiCheckbox: {
						root: {
							color: "#64748B",
							"&.Mui-checked": {
								color: "#60A5FA",
							},
						},
					},
					MuiRadio: {
						root: {
							color: "#64748B",
							"&.Mui-checked": {
								color: "#60A5FA",
							},
						},
					},
					MuiDivider: {
						root: {
							backgroundColor: "#334155",
						},
					},
					MuiAlert: {
						root: {
							borderRadius: 8,
						},
						standardSuccess: {
							backgroundColor: "rgba(52, 211, 153, 0.16)",
							color: "#34D399",
						},
						standardError: {
							backgroundColor: "rgba(248, 113, 113, 0.16)",
							color: "#F87171",
						},
						standardWarning: {
							backgroundColor: "rgba(251, 191, 36, 0.16)",
							color: "#FBBF24",
						},
						standardInfo: {
							backgroundColor: "rgba(96, 165, 250, 0.16)",
							color: "#60A5FA",
						},
					},
					MuiBadge: {
						colorPrimary: {
							backgroundColor: "#60A5FA",
							color: "#0F172A",
						},
						colorSecondary: {
							backgroundColor: "#F87171",
							color: "#0F172A",
						},
					},
				},
			}, locale);
		}

		// Google Like Theme - Material Design 3
		if (appTheme === "google") {
			// MD3 Color Tokens baseado em Seed Color: #1A73E8 (Google Enterprise Blue)
			const md3Colors = {
				light: {
					// Primary (Blue)
					primary: "#1A73E8",
					onPrimary: "#FFFFFF",
					primaryContainer: "#D3E3FD",
					onPrimaryContainer: "#041E49",
					// Secondary (Teal)
					secondary: "#00897B",
					onSecondary: "#FFFFFF",
					secondaryContainer: "#B2DFDB",
					onSecondaryContainer: "#00251A",
					// Tertiary (Purple)
					tertiary: "#7C4DFF",
					onTertiary: "#FFFFFF",
					tertiaryContainer: "#EDE7F6",
					onTertiaryContainer: "#21005D",
					// Error
					error: "#D93025",
					onError: "#FFFFFF",
					errorContainer: "#F9DEDC",
					onErrorContainer: "#8C1D18",
					// Success
					success: "#1E8E3E",
					onSuccess: "#FFFFFF",
					// Warning
					warning: "#F9AB00",
					onWarning: "#1F1F1F",
					// Surface Levels (MD3 Tonal Elevation)
					surface: "#FEFEFE",
					surfaceContainerLowest: "#FFFFFF",
					surfaceContainerLow: "#F8F9FA",
					surfaceContainer: "#F1F3F4",
					surfaceContainerHigh: "#E8EAED",
					surfaceContainerHighest: "#DFE1E5",
					onSurface: "#1F1F1F",
					onSurfaceVariant: "#5F6368",
					// Inverse
					inverseSurface: "#303134",
					inverseOnSurface: "#E8EAED",
					inversePrimary: "#A8C7FA",
					// Outline
					outline: "#747775",
					outlineVariant: "#DADCE0",
					// Sidebar (Google Style)
					sidebarBg: "#F8F9FA",
					sidebarSelected: "#E8F0FE",
					sidebarSelectedText: "#1967D2",
					sidebarHover: "#E8EAED",
				},
				dark: {
					// Primary (Blue - Lighter for dark)
					primary: "#8AB4F8",
					onPrimary: "#062E6F",
					primaryContainer: "#0842A0",
					onPrimaryContainer: "#D3E3FD",
					// Secondary (Teal)
					secondary: "#80CBC4",
					onSecondary: "#003731",
					secondaryContainer: "#005048",
					onSecondaryContainer: "#B2DFDB",
					// Tertiary (Purple)
					tertiary: "#B388FF",
					onTertiary: "#381E72",
					tertiaryContainer: "#4F378B",
					onTertiaryContainer: "#EDE7F6",
					// Error
					error: "#F28B82",
					onError: "#601410",
					errorContainer: "#8C1D18",
					onErrorContainer: "#F9DEDC",
					// Success
					success: "#81C995",
					onSuccess: "#003915",
					// Warning
					warning: "#FDD663",
					onWarning: "#1F1F1F",
					// Surface Levels (MD3 Tonal Elevation - Dark)
					surface: "#1F1F1F",
					surfaceContainerLowest: "#0E0E0E",
					surfaceContainerLow: "#1F1F1F",
					surfaceContainer: "#282A2C",
					surfaceContainerHigh: "#333537",
					surfaceContainerHighest: "#3C4043",
					onSurface: "#E3E3E3",
					onSurfaceVariant: "#C4C7C5",
					// Inverse
					inverseSurface: "#E3E3E3",
					inverseOnSurface: "#303030",
					inversePrimary: "#1A73E8",
					// Outline
					outline: "#8E918F",
					outlineVariant: "#444746",
					// Sidebar (Google Style - Dark)
					sidebarBg: "#28292C",
					sidebarSelected: "rgba(138, 180, 248, 0.16)",
					sidebarSelectedText: "#8AB4F8",
					sidebarHover: "rgba(232, 234, 237, 0.08)",
				}
			};

			const colors = darkMode ? md3Colors.dark : md3Colors.light;

			return createMuiTheme({
				palette: {
					type: darkMode ? "dark" : "light",
					primary: {
						main: colors.primary,
						contrastText: colors.onPrimary,
					},
					secondary: {
						main: colors.secondary,
						contrastText: colors.onSecondary,
					},
					success: {
						main: colors.success,
						contrastText: colors.onSuccess,
					},
					warning: {
						main: colors.warning,
						contrastText: colors.onWarning,
					},
					error: {
						main: colors.error,
						contrastText: colors.onError,
					},
					background: {
						default: colors.surface,
						paper: colors.surfaceContainerLow,
					},
					text: {
						primary: colors.onSurface,
						secondary: colors.onSurfaceVariant,
					},
					divider: colors.outlineVariant,
				},
				typography: {
					fontFamily: "'Google Sans', 'Roboto', 'Helvetica Neue', 'Arial', sans-serif",
					// Display
					h1: { fontWeight: 400, fontSize: "3.5rem", lineHeight: 1.12, letterSpacing: "-0.25px" },
					h2: { fontWeight: 400, fontSize: "2.8rem", lineHeight: 1.16, letterSpacing: "0" },
					// Headline
					h3: { fontWeight: 400, fontSize: "2rem", lineHeight: 1.22 },
					h4: { fontWeight: 400, fontSize: "1.75rem", lineHeight: 1.28 },
					// Title
					h5: { fontWeight: 500, fontSize: "1.375rem", lineHeight: 1.33 },
					h6: { fontWeight: 500, fontSize: "1rem", lineHeight: 1.5, letterSpacing: "0.15px" },
					// Body
					body1: { fontWeight: 400, fontSize: "1rem", lineHeight: 1.5, letterSpacing: "0.25px" },
					body2: { fontWeight: 400, fontSize: "0.875rem", lineHeight: 1.43, letterSpacing: "0.25px" },
					// Label
					button: { fontWeight: 500, fontSize: "0.875rem", lineHeight: 1.43, letterSpacing: "0.1px", textTransform: "none" },
					caption: { fontWeight: 400, fontSize: "0.75rem", lineHeight: 1.33, letterSpacing: "0.4px" },
					overline: { fontWeight: 500, fontSize: "0.6875rem", lineHeight: 1.45, letterSpacing: "0.5px", textTransform: "uppercase" },
				},
				// MD3 Shape (M=12, L=16, XL=28)
				shape: { borderRadius: 12 },
				overrides: {
					MuiCssBaseline: {
						"@global": {
							body: {
								backgroundColor: colors.surface,
								color: colors.onSurface,
							},
						},
					},
					MuiButton: {
						root: {
							textTransform: "none",
							fontWeight: 500,
							fontSize: "0.875rem",
							letterSpacing: "0.1px",
							borderRadius: 20, // MD3 Full (Pill) for buttons
							padding: "10px 24px",
							boxShadow: "none",
							transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
							"&:hover": {
								boxShadow: "none",
							},
						},
						contained: {
							boxShadow: "none",
							"&:hover": {
								boxShadow: "0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)",
							},
						},
						containedPrimary: {
							backgroundColor: colors.primary,
							color: colors.onPrimary,
							"&:hover": {
								backgroundColor: darkMode ? "#9EC3FA" : "#1557B0",
							},
						},
						outlinedPrimary: {
							borderColor: colors.outline,
							color: colors.primary,
							"&:hover": {
								backgroundColor: colors.primaryContainer,
								borderColor: colors.primary,
							},
						},
						textPrimary: {
							color: colors.primary,
							"&:hover": {
								backgroundColor: `${colors.primary}14`, // 8% opacity
							},
						},
					},
					MuiPaper: {
						root: {
							backgroundImage: "none",
							backgroundColor: colors.surfaceContainerLow,
						},
						elevation0: { boxShadow: "none" },
						elevation1: {
							boxShadow: "none",
							backgroundColor: colors.surfaceContainerLow,
						},
						elevation2: {
							boxShadow: "0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)",
							backgroundColor: colors.surfaceContainer,
						},
						elevation3: {
							boxShadow: "0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)",
							backgroundColor: colors.surfaceContainerHigh,
						},
						rounded: { borderRadius: 12 },
					},
					MuiCard: {
						root: {
							borderRadius: 12,
							border: `1px solid ${colors.outlineVariant}`,
							backgroundColor: colors.surfaceContainerLow,
							boxShadow: "none",
							transition: "box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
							"&:hover": {
								boxShadow: "0 1px 2px 0 rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)",
							},
						},
					},
					MuiDrawer: {
						paper: {
							backgroundColor: colors.sidebarBg,
							color: colors.onSurface,
							borderRight: "none",
							boxShadow: darkMode ? "none" : "0 0 0 1px rgba(0,0,0,0.05)",
						},
					},
					MuiAppBar: {
						colorPrimary: {
							backgroundColor: colors.surfaceContainerLowest,
							color: colors.onSurface,
							boxShadow: "none",
							borderBottom: `1px solid ${colors.outlineVariant}`,
						},
					},
					MuiListItem: {
						root: {
							borderRadius: "0 28px 28px 0", // MD3 XL radius
							marginRight: 12,
							marginLeft: 0,
							paddingTop: 8,
							paddingBottom: 8,
							transition: "background-color 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
							"&.Mui-selected": {
								backgroundColor: colors.sidebarSelected,
								color: colors.sidebarSelectedText,
								fontWeight: 600,
								"& .MuiListItemIcon-root": {
									color: colors.sidebarSelectedText,
								},
								"& .MuiListItemText-primary": {
									fontWeight: 600,
									color: colors.sidebarSelectedText,
								},
								"&:hover": {
									backgroundColor: darkMode
										? "rgba(138, 180, 248, 0.24)"
										: "#D2E3FC",
								},
							},
						},
						button: {
							"&:hover": {
								backgroundColor: colors.sidebarHover,
							},
						},
					},
					MuiListItemIcon: {
						root: {
							color: colors.onSurfaceVariant,
							minWidth: 40,
						},
					},
					MuiListItemText: {
						root: {
							margin: 0,
						},
						primary: {
							fontWeight: 500,
							fontSize: "0.875rem",
							letterSpacing: "0.1px",
							color: colors.onSurface,
						},
						secondary: {
							fontSize: "0.75rem",
							color: colors.onSurfaceVariant,
						},
					},
					MuiDialog: {
						paper: {
							borderRadius: 28, // MD3 XL
							backgroundColor: colors.surfaceContainerHigh,
							boxShadow: "0 11px 15px -7px rgba(0,0,0,0.2), 0 24px 38px 3px rgba(0,0,0,0.14), 0 9px 46px 8px rgba(0,0,0,0.12)",
						},
					},
					MuiDialogTitle: {
						root: {
							fontSize: "1.5rem",
							fontWeight: 400,
							padding: "24px 24px 16px",
						},
					},
					MuiDialogContent: {
						root: {
							padding: "0 24px 24px",
						},
					},
					MuiDialogActions: {
						root: {
							padding: "8px 24px 24px",
						},
					},
					MuiTableHead: {
						root: {
							backgroundColor: colors.surfaceContainer,
							"& .MuiTableCell-head": {
								fontWeight: 500,
								color: colors.onSurfaceVariant,
								fontSize: "0.75rem",
								letterSpacing: "0.1px",
								borderBottom: `1px solid ${colors.outlineVariant}`,
							},
						},
					},
					MuiTableBody: {
						root: {
							"& .MuiTableRow-root:hover": {
								backgroundColor: colors.surfaceContainerHigh,
							},
						},
					},
					MuiTableCell: {
						root: {
							borderBottom: `1px solid ${colors.outlineVariant}`,
							padding: "16px",
							fontSize: "0.875rem",
						},
					},
					MuiOutlinedInput: {
						root: {
							borderRadius: 8, // MD3 S
							backgroundColor: "transparent",
							transition: "border-color 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
							"&:hover .MuiOutlinedInput-notchedOutline": {
								borderColor: colors.onSurface,
							},
							"&.Mui-focused .MuiOutlinedInput-notchedOutline": {
								borderColor: colors.primary,
								borderWidth: 2,
							},
						},
						notchedOutline: {
							borderColor: colors.outline,
						},
					},
					MuiInputLabel: {
						outlined: {
							color: colors.onSurfaceVariant,
							"&.Mui-focused": {
								color: colors.primary,
							},
						},
					},
					MuiChip: {
						root: {
							borderRadius: 8, // MD3 S
							fontWeight: 500,
							fontSize: "0.8125rem",
							letterSpacing: "0.1px",
							height: 32,
						},
						colorPrimary: {
							backgroundColor: colors.primaryContainer,
							color: colors.onPrimaryContainer,
						},
						colorSecondary: {
							backgroundColor: colors.secondaryContainer,
							color: colors.onSecondaryContainer,
						},
						outlined: {
							borderColor: colors.outline,
						},
					},
					MuiTooltip: {
						tooltip: {
							backgroundColor: colors.inverseSurface,
							color: colors.inverseOnSurface,
							fontSize: "0.75rem",
							fontWeight: 500,
							borderRadius: 4,
							padding: "8px 12px",
							letterSpacing: "0.25px",
						},
						arrow: {
							color: colors.inverseSurface,
						},
					},
					MuiFab: {
						root: {
							boxShadow: "0 3px 5px -1px rgba(0,0,0,0.2), 0 6px 10px 0 rgba(0,0,0,0.14), 0 1px 18px 0 rgba(0,0,0,0.12)",
							borderRadius: 16, // MD3 L
						},
						primary: {
							backgroundColor: colors.primaryContainer,
							color: colors.onPrimaryContainer,
							"&:hover": {
								backgroundColor: darkMode ? "#4C8DF6" : "#B5D1FD",
							},
						},
					},
					MuiAvatar: {
						colorDefault: {
							backgroundColor: colors.primaryContainer,
							color: colors.onPrimaryContainer,
						},
					},
					MuiTabs: {
						root: {
							minHeight: 48,
						},
						indicator: {
							backgroundColor: colors.primary,
							height: 3,
							borderRadius: "3px 3px 0 0",
						},
					},
					MuiTab: {
						root: {
							textTransform: "none",
							fontWeight: 500,
							fontSize: "0.875rem",
							letterSpacing: "0.1px",
							minWidth: 90,
							padding: "12px 16px",
							color: colors.onSurfaceVariant,
							"&.Mui-selected": {
								color: colors.primary,
							},
						},
					},
					MuiSwitch: {
						root: {
							width: 52,
							height: 32,
							padding: 0,
						},
						switchBase: {
							padding: 4,
							"&.Mui-checked": {
								transform: "translateX(20px)",
								color: colors.onPrimary,
								"& + .MuiSwitch-track": {
									backgroundColor: colors.primary,
									opacity: 1,
								},
							},
						},
						thumb: {
							width: 24,
							height: 24,
							boxShadow: "0 2px 4px 0 rgba(0,0,0,0.2)",
						},
						track: {
							borderRadius: 16,
							backgroundColor: colors.surfaceContainerHighest,
							opacity: 1,
						},
					},
					MuiCheckbox: {
						root: {
							color: colors.onSurfaceVariant,
							"&.Mui-checked": {
								color: colors.primary,
							},
						},
					},
					MuiRadio: {
						root: {
							color: colors.onSurfaceVariant,
							"&.Mui-checked": {
								color: colors.primary,
							},
						},
					},
					MuiDivider: {
						root: {
							backgroundColor: colors.outlineVariant,
						},
					},
					MuiSnackbar: {
						root: {
							borderRadius: 8,
						},
					},
					MuiAlert: {
						root: {
							borderRadius: 12,
						},
						standardSuccess: {
							backgroundColor: `${colors.success}1A`,
							color: colors.success,
						},
						standardError: {
							backgroundColor: colors.errorContainer,
							color: colors.onErrorContainer,
						},
						standardWarning: {
							backgroundColor: `${colors.warning}1A`,
							color: darkMode ? colors.warning : "#5F4B00",
						},
						standardInfo: {
							backgroundColor: colors.primaryContainer,
							color: colors.onPrimaryContainer,
						},
					},
				},
			}, locale);
		}

		return createMuiTheme({
			scrollbarStyles: {
				"&::-webkit-scrollbar": {
					width: "8px",
					height: "8px",
				},
				"&::-webkit-scrollbar-thumb": {
					boxShadow: "inset 0 0 6px rgba(0, 0, 0, 0.3)",
					backgroundColor: darkMode ? "#4a5568" : "#e8e8e8",
				},
			},
			palette: {
				type: darkMode ? "dark" : "light",
				primary: { main: "#2576d2" },
				secondary: { main: "#7c3aed" },
				success: { main: "#22c55e" },
				warning: { main: "#f59e0b" },
				error: { main: "#ef4444" },
				background: {
					default: darkMode ? "#1a202c" : "#f7fafc",
					paper: darkMode ? "#2d3748" : "#ffffff",
				},
				text: {
					primary: darkMode ? "#f7fafc" : "#2d3748",
					secondary: darkMode ? "#a0aec0" : "#718096",
				},
				divider: darkMode ? "#4a5568" : "#e2e8f0",
			},
			typography: {
				fontFamily: "'Roboto', 'Helvetica', 'Arial', sans-serif",
				h1: { fontWeight: 600 },
				h2: { fontWeight: 600 },
				h3: { fontWeight: 600 },
				h4: { fontWeight: 600 },
				h5: { fontWeight: 600 },
				h6: { fontWeight: 600, fontSize: "1.1rem" },
				body1: { fontSize: "0.9375rem", lineHeight: 1.5 },
				body2: { fontSize: "0.875rem", lineHeight: 1.43 },
				button: { fontWeight: 500, textTransform: "none" },
			},
			shape: { borderRadius: 8 },
			overrides: {
				MuiCssBaseline: {
					"@global": {
						body: {
							backgroundColor: darkMode ? "#1a202c" : "#f7fafc",
						},
					},
				},
				MuiButton: {
					root: {
						textTransform: "none",
						fontWeight: 500,
						borderRadius: 8,
						boxShadow: "none",
						"&:hover": { boxShadow: "0 2px 4px 0 rgba(0,0,0,0.1)" },
					},
					containedPrimary: {
						backgroundColor: "#2576d2",
						"&:hover": { backgroundColor: "#1e63b5" },
					},
				},
				MuiPaper: {
					root: { backgroundImage: "none" },
					elevation1: { boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)" },
					rounded: { borderRadius: 8 },
				},
				MuiCard: {
					root: {
						borderRadius: 8,
						border: darkMode ? "1px solid #4a5568" : "1px solid #e2e8f0",
						boxShadow: "none",
					},
				},
				MuiDrawer: {
					paper: {
						backgroundColor: darkMode ? "#2d3748" : "#ffffff",
						color: darkMode ? "#f7fafc" : "#2d3748",
						borderRight: darkMode ? "1px solid #4a5568" : "1px solid #e2e8f0",
					},
				},
				MuiAppBar: {
					colorPrimary: {
						backgroundColor: darkMode ? "#2d3748" : "#2576d2",
						color: "#ffffff",
						boxShadow: "0 1px 3px 0 rgba(0,0,0,0.1)",
					},
				},
				MuiListItem: {
					root: {
						borderRadius: 4,
						"&.Mui-selected": {
							backgroundColor: darkMode ? "#4a5568" : "#e3f2fd",
							borderLeft: "4px solid #2576d2",
							"& .MuiListItemIcon-root": { color: "#2576d2" },
							"&:hover": { backgroundColor: darkMode ? "#4a5568" : "#bbdefb" },
						},
					},
					button: {
						"&:hover": {
							backgroundColor: darkMode ? "#4a5568" : "#f0f4f8",
						},
					},
				},
				MuiListItemIcon: {
					root: {
						color: darkMode ? "#a0aec0" : "#718096",
						minWidth: 40,
					},
				},
				MuiListItemText: {
					primary: {
						fontWeight: 500,
						color: darkMode ? "#f7fafc" : "#2d3748",
					},
					secondary: {
						color: darkMode ? "#a0aec0" : "#718096",
					},
				},
				MuiDialog: {
					paper: {
						borderRadius: 12,
						backgroundColor: darkMode ? "#2d3748" : "#ffffff",
					},
				},
				MuiTableHead: {
					root: {
						backgroundColor: darkMode ? "#2d3748" : "#f7fafc",
						"& .MuiTableCell-head": {
							fontWeight: 600,
							color: darkMode ? "#a0aec0" : "#718096",
							textTransform: "uppercase",
							fontSize: "0.75rem",
							letterSpacing: "0.05em",
						},
					},
				},
				MuiTableCell: {
					root: {
						borderBottom: darkMode ? "1px solid #4a5568" : "1px solid #e2e8f0",
					},
				},
				MuiOutlinedInput: {
					root: {
						borderRadius: 8,
						backgroundColor: darkMode ? "#1a202c" : "#ffffff",
						"&:hover .MuiOutlinedInput-notchedOutline": { borderColor: "#2576d2" },
						"&.Mui-focused .MuiOutlinedInput-notchedOutline": { borderColor: "#2576d2", borderWidth: 2 },
					},
					notchedOutline: {
						borderColor: darkMode ? "#4a5568" : "#e2e8f0",
					},
				},
				MuiChip: {
					root: {
						borderRadius: 8,
						fontWeight: 500,
					},
					colorPrimary: {
						backgroundColor: "#2576d2",
						color: "#ffffff",
					},
				},
				MuiTooltip: {
					tooltip: {
						backgroundColor: "#2d3748",
						color: "#f7fafc",
						fontSize: "0.8125rem",
						borderRadius: 6,
					},
				},
				MuiFab: {
					primary: {
						backgroundColor: "#2576d2",
						"&:hover": { backgroundColor: "#1e63b5" },
					},
				},
				MuiAvatar: {
					colorDefault: {
						backgroundColor: darkMode ? "#4a5568" : "#e2e8f0",
						color: darkMode ? "#a0aec0" : "#718096",
					},
				},
			},
		}, locale);
	}, [darkMode, appTheme, locale]);

	const contextValue = useMemo(() => ({
		darkMode,
		toggleTheme,
		appTheme,
		setAppTheme: handleSetAppTheme
	}), [darkMode, appTheme]);

	return (
		<ThemeContext.Provider value={contextValue}>
			<MUIThemeProvider theme={theme}>
				<CssBaseline />
				{children}
			</MUIThemeProvider>
		</ThemeContext.Provider>
	);
};

ThemeProvider.propTypes = {
	children: PropTypes.node.isRequired,
};

export const useThemeContext = () => useContext(ThemeContext);
