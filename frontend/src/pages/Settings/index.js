import React, { useState, useEffect, useContext } from "react";
import openSocket from "../../services/socket-io";
import MemoryIcon from "@material-ui/icons/Memory";

import ExtensionIcon from "@material-ui/icons/Extension";
import HeadsetMicIcon from "@material-ui/icons/HeadsetMic";
import AddIcon from "@material-ui/icons/Add";
import Chip from "@material-ui/core/Chip";
import Grid from "@material-ui/core/Grid";
import IconButton from "@material-ui/core/IconButton";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import Box from "@material-ui/core/Box";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Select from "@material-ui/core/Select";
import TextField from "@material-ui/core/TextField";
import Button from "@material-ui/core/Button";
import Divider from "@material-ui/core/Divider";
import SettingsIcon from "@material-ui/icons/Settings";
import PaletteIcon from "@material-ui/icons/Palette";
import CloudUploadIcon from "@material-ui/icons/CloudUpload";
import DeleteIcon from "@material-ui/icons/Delete";
import Switch from "@material-ui/core/Switch";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import { toast } from "react-toastify";

import api from "../../services/api";
import { i18n } from "../../translate/i18n.js";
import toastError from "../../errors/toastError";
import { useThemeContext } from "../../context/DarkMode";
import { getBackendUrl } from "../../helpers/urlUtils";
import { AuthContext } from "../../context/Auth/AuthContext";
import SmtpSettingsForm from "../Marketplace/SmtpSettingsForm";

const AI_MODELS = {
	openai: [
		{ value: "gpt-4o-mini", name: "GPT-4o Mini", price: "$0.15 / 1M tokens (Recomendado)" },
		{ value: "gpt-4o", name: "GPT-4o", price: "$2.50 / 1M tokens" },
		{ value: "gpt-4-turbo", name: "GPT-4 Turbo", price: "$10.00 / 1M tokens" },
		{ value: "gpt-3.5-turbo", name: "GPT-3.5 Turbo", price: "$0.50 / 1M tokens" },
		{ value: "o1-mini", name: "o1-mini", price: "$3.00 / 1M tokens" },
		{ value: "o1-preview", name: "o1-preview", price: "$15.00 / 1M tokens" }
	],
	grok: [
		{ value: "grok-beta", name: "Grok Beta", price: "Gratuito (Beta)" },
		{ value: "grok-2", name: "Grok 2", price: "Preço a definir" }
	]
};

const useStyles = makeStyles((theme) => ({
	root: {
		display: "flex",
		height: "calc(100vh - 64px)",
		backgroundColor: theme.palette.background.default,
	},
	sidebar: {
		width: 240,
		minWidth: 240,
		backgroundColor: theme.palette.background.paper,
		borderRight: `1px solid ${theme.palette.divider}`,
		padding: theme.spacing(2, 0),
	},
	sidebarTitle: {
		padding: theme.spacing(0, 2, 2, 2),
		fontWeight: 600,
	},
	menuItem: {
		borderRadius: 8,
		margin: theme.spacing(0.5, 1),
		color: theme.palette.text.primary,
		"& .MuiListItemIcon-root": {
			color: theme.palette.text.secondary,
		},
		"&:hover": {
			backgroundColor: theme.palette.action.hover,
		},
		"&.Mui-selected": {
			backgroundColor: theme.palette.primary.main,
			color: "#ffffff",
			"& .MuiListItemIcon-root": {
				color: "#ffffff",
			},
			"&:hover": {
				backgroundColor: theme.palette.primary.dark,
			},
		},
	},
	content: {
		flex: 1,
		padding: theme.spacing(4),
		overflow: "auto",
	},
	sectionTitle: {
		marginBottom: theme.spacing(3),
		fontWeight: 600,
	},
	paper: {
		padding: theme.spacing(2),
		display: "flex",
		alignItems: "center",
		marginBottom: theme.spacing(2),
		borderRadius: 12,
	},
	settingOption: {
		marginLeft: "auto",
	},
	uploadBox: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		border: `2px dashed ${theme.palette.divider}`,
		borderRadius: 12,
		padding: theme.spacing(4),
		marginTop: theme.spacing(2),
		cursor: "pointer",
		transition: "all 0.2s ease",
		"&:hover": {
			borderColor: theme.palette.primary.main,
			backgroundColor: theme.palette.action.hover,
		},
	},
	logoPreview: {
		maxWidth: 200,
		maxHeight: 80,
		objectFit: "contain",
		marginBottom: theme.spacing(2),
	},
	hiddenInput: {
		display: "none",
	},
}));

const Settings = () => {
	const classes = useStyles();
	const { appTheme, setAppTheme } = useThemeContext();
	const history = useHistory();
	const { user } = useContext(AuthContext);

	// Check if Plugin Manager is online to show/hide Marketplace
	const [marketplaceVisible, setMarketplaceVisible] = useState(false);

	useEffect(() => {
		const checkMarketplace = async () => {
			try {
				// Use authenticated 'api' instance that includes session cookies
				// The route /plugins/version requires authentication via isAuth middleware
				const { data } = await api.get("/plugins/version");
				if (data && data.version) {
					setMarketplaceVisible(true);
				} else {
					setMarketplaceVisible(false);
				}
			} catch (err) {
				setMarketplaceVisible(false);
			}
		};

		checkMarketplace();
	}, []);


	const [activeSection, setActiveSection] = useState("general");
	const [settings, setSettings] = useState([]);
	const [activePlugins, setActivePlugins] = useState([]); // New state for plugins
	const [systemTitle, setSystemTitle] = useState("");
	const [logoPreview, setLogoPreview] = useState(null);
	const [logoEnabled, setLogoEnabled] = useState(true);
	const [faviconPreview, setFaviconPreview] = useState(null);
	const [mobileLogoPreview, setMobileLogoPreview] = useState(null);

	const [loginImagePreview, setLoginImagePreview] = useState(null);
	const [loginLayout, setLoginLayout] = useState("split_left");

	// AI Settings
	const [aiProvider, setAiProvider] = useState("openai");
	const [aiApiKey, setAiApiKey] = useState("");
	const [aiModel, setAiModel] = useState("");
	const [aiGuidePrompt, setAiGuidePrompt] = useState("");
	const [aiEnabled, setAiEnabled] = useState(false);
	// Toggles granulares de IA
	const [aiPipelineEnabled, setAiPipelineEnabled] = useState(false);
	const [aiFlowBuilderEnabled, setAiFlowBuilderEnabled] = useState(false);
	const [aiAssistantEnabled, setAiAssistantEnabled] = useState(false);

	// Helpdesk Settings
	const [helpdeskEnabled, setHelpdeskEnabled] = useState(false);
	const [helpdeskSla, setHelpdeskSla] = useState({ low: 24, medium: 12, high: 4, urgent: 1 });
	const [helpdeskCategories, setHelpdeskCategories] = useState([]);
	const [newCategory, setNewCategory] = useState("");



	useEffect(() => {
		const fetchPlugins = async () => {
			try {
				const { data } = await api.get("/plugins/api/v1/plugins/installed");
				setActivePlugins(data.active || []);
			} catch (err) {
				console.error("Failed to fetch plugins", err);
			}
		};
		fetchPlugins();
	}, []);

	useEffect(() => {
		const fetchSession = async () => {
			try {
				const { data } = await api.get("/settings");
				const settingsData = Array.isArray(data) ? data : [];
				setSettings(settingsData);

				// ... existing checks ...

				// Helpdesk Settings Load
				const helpdeskEnabledSetting = settingsData.find(s => s.key === "helpdesk_settings_enabled");
				if (helpdeskEnabledSetting) setHelpdeskEnabled(helpdeskEnabledSetting.value === "true");

				const helpdeskSlaSetting = settingsData.find(s => s.key === "helpdesk_sla_config");
				if (helpdeskSlaSetting) {
					try {
						setHelpdeskSla(JSON.parse(helpdeskSlaSetting.value));
					} catch (e) {
						console.error("Error parsing SLA config", e);
					}
				}

				const helpdeskCategoriesSetting = settingsData.find(s => s.key === "helpdesk_categories");
				if (helpdeskCategoriesSetting) {
					try {
						setHelpdeskCategories(JSON.parse(helpdeskCategoriesSetting.value));
					} catch (e) {
						// Default if new or error
						setHelpdeskCategories(["Incidente", "Requisição de Serviço", "Problema", "Mudança"]);
					}
				} else {
					setHelpdeskCategories(["Incidente", "Requisição de Serviço", "Problema", "Mudança"]);
				}


				const titleSetting = settingsData.find(s => s.key === "systemTitle");
				if (titleSetting) setSystemTitle(titleSetting.value);

				const logoSetting = settingsData.find(s => s.key === "systemLogo");
				if (logoSetting && logoSetting.value) setLogoPreview(logoSetting.value);

				const mobileLogoSetting = settingsData.find(s => s.key === "mobileLogo");
				if (mobileLogoSetting && mobileLogoSetting.value) setMobileLogoPreview(mobileLogoSetting.value);

				const logoEnabledSetting = settingsData.find(s => s.key === "systemLogoEnabled");
				if (logoEnabledSetting) setLogoEnabled(logoEnabledSetting.value === "true");

				const faviconSetting = settingsData.find(s => s.key === "systemFavicon");
				if (faviconSetting && faviconSetting.value) setFaviconPreview(faviconSetting.value);

				// Login Settings
				const loginImageSetting = settingsData.find(s => s.key === "login_backgroundImage");
				if (loginImageSetting && loginImageSetting.value) setLoginImagePreview(loginImageSetting.value);

				const loginLayoutSetting = settingsData.find(s => s.key === "login_layout");
				if (loginLayoutSetting) setLoginLayout(loginLayoutSetting.value || "split_left");

				// AI Settings Load
				const aiProviderSetting = settingsData.find(s => s.key === "aiProvider");
				if (aiProviderSetting) setAiProvider(aiProviderSetting.value);

				const aiApiKeySetting = settingsData.find(s => s.key === "aiApiKey");
				if (aiApiKeySetting) setAiApiKey(aiApiKeySetting.value);

				const aiModelSetting = settingsData.find(s => s.key === "aiModel");
				if (aiModelSetting) setAiModel(aiModelSetting.value);

				const aiGuidePromptSetting = settingsData.find(s => s.key === "aiGuidePrompt");
				if (aiGuidePromptSetting) setAiGuidePrompt(aiGuidePromptSetting.value);

				const aiEnabledSetting = settingsData.find(s => s.key === "aiEnabled");
				if (aiEnabledSetting) setAiEnabled(aiEnabledSetting.value === "true");

				// Toggles granulares de IA
				const aiPipelineSetting = settingsData.find(s => s.key === "aiPipelineEnabled");
				if (aiPipelineSetting) setAiPipelineEnabled(aiPipelineSetting.value === "true");

				const aiFlowBuilderSetting = settingsData.find(s => s.key === "aiFlowBuilderEnabled");
				if (aiFlowBuilderSetting) setAiFlowBuilderEnabled(aiFlowBuilderSetting.value === "true");

				const aiAssistantSetting = settingsData.find(s => s.key === "aiAssistantEnabled");
				if (aiAssistantSetting) setAiAssistantEnabled(aiAssistantSetting.value === "true");

			} catch (err) {
				toastError(err);
			}
		};
		fetchSession();
	}, []);

	useEffect(() => {
		const socket = openSocket();

		if (!socket) return;

		socket.on("settings", (data) => {
			if (data.action === "update") {
				setSettings((prevState) => {
					const aux = [...prevState];
					const settingIndex = aux.findIndex((s) => s.key === data.setting.key);
					if (settingIndex >= 0) {
						aux[settingIndex].value = data.setting.value;
					}
					return aux;
				});
			}
		});

		return () => {
			socket.disconnect();
		};
	}, []);

	const handleChangeSetting = async (e) => {
		const selectedValue = e.target.value;
		const settingKey = e.target.name;

		try {
			await api.put(`/settings/${settingKey}`, {
				value: selectedValue,
			});
			toast.success(i18n.t("settings.success"));
		} catch (err) {
			toastError(err);
		}
	};

	const handleSaveTitle = async () => {
		try {
			await api.put("/settings/systemTitle", { value: systemTitle });
			toast.success("Título atualizado com sucesso!");
		} catch (err) {
			toastError(err);
		}
	};

	const handleLogoUpload = async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		const formData = new FormData();
		formData.append("logo", file);

		try {
			const { data } = await api.post("/settings/logo", formData, {
				headers: { "Content-Type": "multipart/form-data" },
			});
			setLogoPreview(data.logoUrl);
			toast.success("Logo atualizada com sucesso!");
		} catch (err) {
			toastError(err);
		}
	};

	const handleToggleLogo = async () => {
		const newValue = !logoEnabled;
		setLogoEnabled(newValue);
		try {
			await api.put("/settings/systemLogoEnabled", { value: newValue ? "true" : "false" });
			toast.success(newValue ? "Logo ativada!" : "Logo desativada!");
		} catch (err) {
			toastError(err);
		}
	};

	const handleRemoveLogo = async () => {
		try {
			await api.put("/settings/systemLogo", { value: "" });
			setLogoPreview(null);
			toast.success("Logo removida com sucesso!");
		} catch (err) {
			toastError(err);
		}
	};

	const handleFaviconUpload = async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		const formData = new FormData();
		formData.append("favicon", file);

		try {
			const { data } = await api.post("/settings/favicon", formData, {
				headers: { "Content-Type": "multipart/form-data" },
			});
			setFaviconPreview(data.faviconUrl);
			toast.success("Favicon atualizado com sucesso!");
			const link = document.querySelector("link[rel~='icon']") || document.createElement('link');
			link.rel = 'icon';
			link.href = getBackendUrl(data.faviconUrl);
			document.head.appendChild(link);
		} catch (err) {
			toastError(err);
		}
	};

	const handleRemoveFavicon = async () => {
		try {
			await api.put("/settings/systemFavicon", { value: "" });
			setFaviconPreview(null);
			toast.success("Favicon removido com sucesso!");
		} catch (err) {
			toastError(err);
		}
	};

	// Mobile Logo Handlers
	const handleMobileLogoUpload = async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		const formData = new FormData();
		formData.append("mobileLogo", file);

		try {
			const { data } = await api.post("/settings/mobileLogo", formData, {
				headers: { "Content-Type": "multipart/form-data" },
			});
			setMobileLogoPreview(data.mobileLogoUrl);
			toast.success("Logo mobile atualizada com sucesso!");
		} catch (err) {
			toastError(err);
		}
	};

	const handleRemoveMobileLogo = async () => {
		try {
			await api.put("/settings/mobileLogo", { value: "" });
			setMobileLogoPreview(null);
			toast.success("Logo mobile removida com sucesso!");
		} catch (err) {
			toastError(err);
		}
	};

	// New Handlers for Login Settings
	const handleLoginImageUpload = async (e) => {
		const file = e.target.files[0];
		if (!file) return;

		const formData = new FormData();
		formData.append("loginImage", file);

		try {
			const { data } = await api.post("/settings/loginImage", formData, {
				headers: { "Content-Type": "multipart/form-data" },
			});
			setLoginImagePreview(data.imageUrl);
			toast.success("Imagem de fundo atualizada com sucesso!");
		} catch (err) {
			toastError(err);
		}
	};

	const handleRemoveLoginImage = async () => {
		try {
			await api.put("/settings/login_backgroundImage", { value: "" });
			setLoginImagePreview(null);
			toast.success("Imagem de fundo removida!");
		} catch (err) {
			toastError(err);
		}
	};

	const handleLoginLayoutChange = async (e) => {
		const layout = e.target.value;
		setLoginLayout(layout);
		try {
			await api.put("/settings/login_layout", { value: layout });
			toast.success("Layout de login atualizado!");
		} catch (err) {
			toastError(err);
		}
	};

	const getSettingValue = (key) => {
		const setting = settings.find((s) => s.key === key);
		return setting ? setting.value : "";
	};

	const renderGeneralSection = () => (
		<>
			<Typography variant="h5" className={classes.sectionTitle}>
				Configurações Gerais
			</Typography>



			<Paper className={classes.paper}>
				<Typography variant="body1">Fuso Horário</Typography>
				<Select
					margin="dense"
					variant="outlined"
					native
					id="timezone-setting"
					name="timezone"
					value={settings && settings.length > 0 && getSettingValue("timezone")}
					className={classes.settingOption}
					onChange={handleChangeSetting}
				>
					<option value="">Selecione um fuso horário</option>
					{Array.from({ length: 27 }, (_, i) => i - 12).map((offset) => {
						const sign = offset >= 0 ? "+" : "-";
						const absOffset = Math.abs(offset);
						const formattedOffset = `${sign}${absOffset.toString().padStart(2, "0")}:00`;
						return (
							<option key={formattedOffset} value={formattedOffset}>
								UTC {formattedOffset}
							</option>
						);
					})}
					{/* Adicionando alguns meios-fusos comuns se necessário, mas mantendo simples como solicitado */}
					<option value="-03:30">UTC -03:30</option>
					<option value="+03:30">UTC +03:30</option>
					<option value="+04:30">UTC +04:30</option>
					<option value="+05:30">UTC +05:30</option>
					<option value="+05:45">UTC +05:45</option>
					<option value="+06:30">UTC +06:30</option>
					<option value="+09:30">UTC +09:30</option>
				</Select>
			</Paper>

			<Paper className={classes.paper}>
				<Typography variant="body1">Tema</Typography>
				<Select
					margin="dense"
					variant="outlined"
					native
					id="theme-setting"
					name="theme"
					value={appTheme}
					className={classes.settingOption}
					onChange={(e) => setAppTheme(e.target.value)}
				>
					<option value="whaticket">Whaticket (Padrão)</option>
					<option value="saas">SaaS Premium</option>
					<option value="corporate">Corporate Theme</option>
					<option value="whatsapp">WhatsApp Theme</option>
					<option value="google">Google Like Theme</option>
					<option value="dark">Dark Mode Theme</option>
				</Select>
			</Paper>

			<Paper className={classes.paper}>
				<Typography variant="body1">{i18n.t("settings.settings.language.name")}</Typography>
				<Select
					margin="dense"
					variant="outlined"
					native
					id="language-setting"
					name="language"
					value={i18n.language}
					className={classes.settingOption}
					onChange={(e) => {
						i18n.changeLanguage(e.target.value);
						localStorage.setItem("i18nextLng", e.target.value);
						// Reload page to apply translations everywhere
						window.location.reload();
					}}
				>
					<option value="pt">{i18n.t("settings.settings.language.options.pt")}</option>
					<option value="en">{i18n.t("settings.settings.language.options.en")}</option>
					<option value="es">{i18n.t("settings.settings.language.options.es")}</option>
				</Select>
			</Paper>

			{settings && settings.length > 0 && settings.find(s => s.key === "allowTenantControl")?.value === "true" && (
				<Paper className={classes.paper}>
					<Typography variant="body1">
						{i18n.t("settings.settings.userCreation.name")}
					</Typography>
					<Select
						margin="dense"
						variant="outlined"
						native
						id="userCreation-setting"
						name="userCreation"
						value={settings && settings.length > 0 && getSettingValue("userCreation")}
						className={classes.settingOption}
						onChange={handleChangeSetting}
					>
						<option value="enabled">
							{i18n.t("settings.settings.userCreation.options.enabled")}
						</option>
						<option value="disabled">
							{i18n.t("settings.settings.userCreation.options.disabled")}
						</option>
					</Select>
				</Paper>
			)}

			<Paper className={classes.paper}>
				<TextField
					id="api-token-setting"
					InputProps={{ readOnly: true }}
					label="Token Api"
					margin="dense"
					variant="outlined"
					fullWidth
					value={settings && settings.length > 0 && getSettingValue("userApiToken")}
				/>
			</Paper>
		</>
	);

	const renderCustomizeSection = () => (
		<>
			<Typography variant="h5" className={classes.sectionTitle}>
				Personalização
			</Typography>

			{/* System Title */}
			<Paper className={classes.paper} style={{ flexDirection: "column", alignItems: "stretch" }}>
				<Typography variant="body1" gutterBottom>
					Título do Sistema
				</Typography>
				<Box display="flex" alignItems="center" gap={2}>
					<TextField
						id="system-title"
						variant="outlined"
						margin="dense"
						fullWidth
						placeholder="Ex: Minha Empresa"
						value={systemTitle}
						onChange={(e) => setSystemTitle(e.target.value)}
					/>
					<Button
						variant="contained"
						color="primary"
						onClick={handleSaveTitle}
						style={{ marginLeft: 16, whiteSpace: "nowrap" }}
					>
						Salvar
					</Button>
				</Box>
			</Paper>

			{/* Logo and Favicon */}
			<Box display="flex" gap={2} flexWrap="wrap">
				<Paper className={classes.paper} style={{ flexDirection: "column", alignItems: "stretch", flex: 1, minWidth: 280 }}>
					<Box display="flex" justifyContent="space-between" alignItems="center">
						<Box>
							<Typography variant="body1" gutterBottom>
								Logo do Sistema
							</Typography>
							<Typography variant="body2" color="textSecondary">
								Exibida no topo do menu lateral
							</Typography>
						</Box>
						<FormControlLabel
							control={
								<Switch
									checked={logoEnabled}
									onChange={handleToggleLogo}
									color="primary"
									disabled={!logoPreview}
								/>
							}
							label={logoEnabled ? "Ativa" : "Inativa"}
						/>
					</Box>
					<input
						accept="image/*"
						className={classes.hiddenInput}
						id="logo-upload"
						type="file"
						onChange={handleLogoUpload}
					/>
					<label htmlFor="logo-upload">
						<Box className={classes.uploadBox}>
							{logoPreview ? (
								<img
									src={getBackendUrl(logoPreview)}
									alt="Logo"
									className={classes.logoPreview}
								/>
							) : (
								<CloudUploadIcon style={{ fontSize: 48, color: "#9ca3af" }} />
							)}
							<Typography variant="body2" color="textSecondary">
								{logoPreview ? "Clique para alterar" : "Clique para upload"}
							</Typography>
						</Box>
					</label>
					{logoPreview && (
						<Box mt={2} display="flex" justifyContent="center">
							<Button variant="outlined" color="secondary" startIcon={<DeleteIcon />} onClick={handleRemoveLogo}>
								Remover Logo
							</Button>
						</Box>
					)}
				</Paper>

				<Paper className={classes.paper} style={{ flexDirection: "column", alignItems: "stretch", flex: 1, minWidth: 280 }}>
					<Typography variant="body1" gutterBottom>
						Favicon do Sistema
					</Typography>
					<Typography variant="body2" color="textSecondary">
						Ícone da aba do navegador
					</Typography>
					<input
						accept="image/*"
						className={classes.hiddenInput}
						id="favicon-upload"
						type="file"
						onChange={handleFaviconUpload}
					/>
					<label htmlFor="favicon-upload">
						<Box className={classes.uploadBox}>
							{faviconPreview ? (
								<img
									src={getBackendUrl(faviconPreview)}
									alt="Favicon"
									style={{ maxWidth: 64, maxHeight: 64, objectFit: 'contain' }}
								/>
							) : (
								<CloudUploadIcon style={{ fontSize: 48, color: "#9ca3af" }} />
							)}
							<Typography variant="body2" color="textSecondary">
								{faviconPreview ? "Clique para alterar" : "Clique para upload"}
							</Typography>
						</Box>
					</label>
					{faviconPreview && (
						<Box mt={2} display="flex" justifyContent="center">
							<Button variant="outlined" color="secondary" startIcon={<DeleteIcon />} onClick={handleRemoveFavicon}>
								Remover Favicon
							</Button>
						</Box>
					)}
				</Paper>
			</Box>

			{/* Mobile Logo Card */}
			<Box display="flex" gap={2} flexWrap="wrap" mt={2}>
				<Paper className={classes.paper} style={{ flexDirection: "column", alignItems: "stretch", flex: 1, minWidth: 280 }}>
					<Typography variant="body1" gutterBottom>
						Logo Mobile
					</Typography>
					<Typography variant="body2" color="textSecondary">
						Logo exibida no aplicativo Android/iOS
					</Typography>
					<input
						accept="image/*"
						className={classes.hiddenInput}
						id="mobile-logo-upload"
						type="file"
						onChange={handleMobileLogoUpload}
					/>
					<label htmlFor="mobile-logo-upload">
						<Box className={classes.uploadBox}>
							{mobileLogoPreview ? (
								<img
									src={getBackendUrl(mobileLogoPreview)}
									alt="Logo Mobile"
									style={{ maxWidth: 120, maxHeight: 120, objectFit: 'contain' }}
								/>
							) : (
								<CloudUploadIcon style={{ fontSize: 48, color: "#9ca3af" }} />
							)}
							<Typography variant="body2" color="textSecondary">
								{mobileLogoPreview ? "Clique para alterar" : "Clique para upload"}
							</Typography>
						</Box>
					</label>
					{mobileLogoPreview && (
						<Box mt={2} display="flex" justifyContent="center">
							<Button variant="outlined" color="secondary" startIcon={<DeleteIcon />} onClick={handleRemoveMobileLogo}>
								Remover Logo Mobile
							</Button>
						</Box>
					)}
				</Paper>
			</Box>

			{/* Login Customization Card */}
			<Typography variant="h5" className={classes.sectionTitle} style={{ marginTop: 24 }}>
				Tela de Login
			</Typography>
			<Paper className={classes.paper} style={{ flexDirection: "column", alignItems: "stretch" }}>
				<Box display="flex" flexDirection="column" gap={2}>

					{/* Layout Selector */}
					<Box mb={2}>
						<Typography variant="body1" gutterBottom style={{ fontWeight: 600 }}>
							Posição do Formulário
						</Typography>
						<Select
							margin="dense"
							variant="outlined"
							native
							id="login-layout-setting"
							value={loginLayout}
							onChange={handleLoginLayoutChange}
							fullWidth
						>
							<option value="split_left">Formulário à Esquerda / Imagem à Direita</option>
							<option value="split_right">Formulário à Direita / Imagem à Esquerda</option>
							<option value="centered">Formulário Centralizado / Fundo Completo</option>
						</Select>
					</Box>

					<Divider />

					{/* Image Upload */}
					<Box mt={2}>
						<Typography variant="body1" gutterBottom style={{ fontWeight: 600 }}>
							Imagem de Destaque / Fundo
						</Typography>
						<Typography variant="body2" color="textSecondary">
							Escolha uma imagem para ser o destaque da tela de login.
							<br />
							<strong>Recomendado:</strong> 1920x1080px (Full HD), máximo 2MB.
						</Typography>

						<input
							accept="image/*"
							className={classes.hiddenInput}
							id="login-image-upload"
							type="file"
							onChange={handleLoginImageUpload}
						/>
						<label htmlFor="login-image-upload">
							<Box className={classes.uploadBox}>
								{loginImagePreview ? (
									<img
										src={`${getBackendUrl()}${loginImagePreview.startsWith('/') ? loginImagePreview.slice(1) : loginImagePreview}`}
										alt="Login Background"
										style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain' }}
									/>
								) : (
									<CloudUploadIcon style={{ fontSize: 48, color: "#9ca3af" }} />
								)}
								<Typography variant="body2" color="textSecondary" style={{ marginTop: 8 }}>
									{loginImagePreview ? "Clique para trocar a imagem" : "Clique para fazer upload da imagem de fundo"}
								</Typography>
							</Box>
						</label>
						{loginImagePreview && (
							<Box mt={2} display="flex" justifyContent="center">
								<Button variant="outlined" color="secondary" startIcon={<DeleteIcon />} onClick={handleRemoveLoginImage}>
									Remover Imagem
								</Button>
							</Box>
						)}
					</Box>
				</Box>
			</Paper>
		</>
	);

	const handleAddCategory = () => {
		if (newCategory.trim() && !helpdeskCategories.includes(newCategory.trim())) {
			const updatedCategories = [...helpdeskCategories, newCategory.trim()];
			setHelpdeskCategories(updatedCategories);
			setNewCategory("");
			saveHelpdeskCategories(updatedCategories);
		}
	};

	const handleDeleteCategory = (categoryToDelete) => {
		const updatedCategories = helpdeskCategories.filter((category) => category !== categoryToDelete);
		setHelpdeskCategories(updatedCategories);
		saveHelpdeskCategories(updatedCategories);
	};

	const saveHelpdeskCategories = async (categories) => {
		try {
			await api.put("/settings/helpdesk_categories", {
				value: JSON.stringify(categories),
			});
			toast.success("Categorias atualizadas!");
		} catch (err) {
			toast.error("Erro ao salvar categorias.");
		}
	};

	const handleSlaChange = (priority, value) => {
		setHelpdeskSla(prev => ({ ...prev, [priority]: value }));
	};

	const saveSlaConfig = async () => {
		try {
			await api.put("/settings/helpdesk_sla_config", {
				value: JSON.stringify(helpdeskSla),
			});
			toast.success("Configuração de SLA salva!");
		} catch (err) {
			toast.error("Erro ao salvar SLA.");
		}
	};

	const renderHelpdeskSection = () => (
		<>
			<Typography variant="h5" className={classes.sectionTitle}>
				Configurações de Helpdesk
			</Typography>

			{/* Enable Toggle */}
			<Paper className={classes.paper} style={{ justifyContent: 'space-between' }}>
				<div>
					<Typography variant="body1">Habilitar Funcionalidades Avançadas</Typography>
					<Typography variant="caption" color="textSecondary">
						Ativa o gerenciamento automático de SLA e controle de categorias.
					</Typography>
				</div>
				<Switch
					checked={helpdeskEnabled}
					onChange={async (e) => {
						const newValue = e.target.checked;
						setHelpdeskEnabled(newValue);
						await api.put("/settings/helpdesk_settings_enabled", { value: newValue ? "true" : "false" });
						toast.success(`Helpdesk ${newValue ? "ativado" : "desativado"}!`);
					}}
					color="primary"
				/>
			</Paper>

			{/* Check if enabled to show other settings */}
			{helpdeskEnabled && (
				<Box style={{ transition: 'opacity 0.3s' }}>

					{/* SLA Configuration */}
					<Typography variant="h6" className={classes.sectionTitle} style={{ marginTop: 24, fontSize: '1.1rem' }}>
						SLA (Acordo de Nível de Serviço) - Horas para Resolução
					</Typography>
					<Paper className={classes.paper} style={{ display: 'block' }}>
						<Grid container spacing={2}>
							<Grid item xs={12} sm={6} md={3}>
								<TextField
									label="Baixa Prioridade (Horas)"
									type="number"
									variant="outlined"
									fullWidth
									value={helpdeskSla.low}
									onChange={(e) => handleSlaChange('low', e.target.value)}
								/>
							</Grid>
							<Grid item xs={12} sm={6} md={3}>
								<TextField
									label="Média Prioridade (Horas)"
									type="number"
									variant="outlined"
									fullWidth
									value={helpdeskSla.medium}
									onChange={(e) => handleSlaChange('medium', e.target.value)}
								/>
							</Grid>
							<Grid item xs={12} sm={6} md={3}>
								<TextField
									label="Alta Prioridade (Horas)"
									type="number"
									variant="outlined"
									fullWidth
									value={helpdeskSla.high}
									onChange={(e) => handleSlaChange('high', e.target.value)}
								/>
							</Grid>
							<Grid item xs={12} sm={6} md={3}>
								<TextField
									label="Urgente (Horas)"
									type="number"
									variant="outlined"
									fullWidth
									value={helpdeskSla.urgent}
									onChange={(e) => handleSlaChange('urgent', e.target.value)}
								/>
							</Grid>
							<Grid item xs={12} style={{ display: 'flex', justifyContent: 'flex-end' }}>
								<Button variant="contained" color="primary" onClick={saveSlaConfig}>
									Salvar SLA
								</Button>
							</Grid>
						</Grid>
					</Paper>

					{/* Categories Management */}
					<Typography variant="h6" className={classes.sectionTitle} style={{ marginTop: 24, fontSize: '1.1rem' }}>
						Categorias de Protocolo (ITIL)
					</Typography>
					<Paper className={classes.paper} style={{ display: 'block' }}>
						<Box display="flex" alignItems="center" mb={2}>
							<TextField
								label="Nova Categoria"
								variant="outlined"
								size="small"
								value={newCategory}
								onChange={(e) => setNewCategory(e.target.value)}
								style={{ marginRight: 8 }}
								onKeyPress={(e) => {
									if (e.key === 'Enter') handleAddCategory();
								}}
							/>
							<IconButton onClick={handleAddCategory} color="primary">
								<AddIcon />
							</IconButton>
						</Box>
						<Box display="flex" flexWrap="wrap" gap={1}>
							{helpdeskCategories.map((data) => (
								<Chip
									key={data}
									label={data}
									onDelete={() => handleDeleteCategory(data)}
									color="primary"
									variant="outlined"
								/>
							))}
						</Box>
					</Paper>
				</Box>
			)}
		</>
	);

	return (
		<Box className={classes.root}>
			<Box className={classes.sidebar}>
				<Typography variant="h6" className={classes.sidebarTitle}>
					Configurações
				</Typography>
				<Divider />
				<List>
					<ListItem
						button
						selected={activeSection === "general"}
						onClick={() => setActiveSection("general")}
						className={classes.menuItem}
					>
						<ListItemIcon>
							<SettingsIcon />
						</ListItemIcon>
						<ListItemText primary="Geral" />
					</ListItem>
					{activePlugins.includes("smtp") && (
						<ListItem
							button
							selected={activeSection === "smtp"}
							onClick={() => setActiveSection("smtp")}
							className={classes.menuItem}
						>
							<ListItemIcon>
								<SettingsIcon />
							</ListItemIcon>
							<ListItemText primary="SMTP" />
						</ListItem>
					)}
					<ListItem
						button
						selected={activeSection === "customize"}
						onClick={() => setActiveSection("customize")}
						className={classes.menuItem}
					>
						<ListItemIcon>
							<PaletteIcon />
						</ListItemIcon>
						<ListItemText primary="Personalizar" />
					</ListItem>
					<ListItem
						button
						selected={activeSection === "ai"}
						onClick={() => setActiveSection("ai")}
						className={classes.menuItem}
					>
						<ListItemIcon>
							<MemoryIcon />
						</ListItemIcon>
						<ListItemText primary="Inteligência Artificial" />
					</ListItem>

					{activePlugins.includes("helpdesk") && (
						<ListItem
							button
							selected={activeSection === "helpdesk"}
							onClick={() => setActiveSection("helpdesk")}
							className={classes.menuItem}
						>
							<ListItemIcon>
								<HeadsetMicIcon />
							</ListItemIcon>
							<ListItemText primary="Helpdesk" />
						</ListItem>
					)}

					{["admin", "superadmin"].includes(user?.profile) && marketplaceVisible && (
						<ListItem
							button
							onClick={() => history.push("/admin/settings/marketplace")}
							className={classes.menuItem}
						>
							<ListItemIcon>
								<ExtensionIcon />
							</ListItemIcon>
							<ListItemText primary="Marketplace" />
						</ListItem>
					)}
				</List>
			</Box>
			<Box className={classes.content}>
				{activeSection === "general" && renderGeneralSection()}
				{activeSection === "customize" && renderCustomizeSection()}
				{activeSection === "helpdesk" && activePlugins.includes("helpdesk") && renderHelpdeskSection()}
				{activeSection === "ai" && (
					<>
						<Typography variant="h5" className={classes.sectionTitle}>
							Inteligência Artificial (IA)
						</Typography>
						<Paper className={classes.paper} style={{ display: 'block' }}>
							<Box mb={2}>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
									<div>
										<Typography variant="body1">Habilitar Uso de IA</Typography>
										<Typography variant="caption" color="textSecondary">
											Ative para disponibilizar recursos de IA em todo o sistema (Pipelines, Flow Builder, etc).
										</Typography>
									</div>
									<Switch
										checked={aiEnabled}
										onChange={async (e) => {
											const newValue = e.target.checked;
											setAiEnabled(newValue);
											await api.put("/settings/aiEnabled", { value: newValue ? "true" : "false" });
											toast.success(`IA ${newValue ? "ativada" : "desativada"} com sucesso!`);
										}}
										color="primary"
									/>
								</div>
								<Divider />
							</Box>
							<Box mb={2} style={{ opacity: aiEnabled ? 1 : 0.5, pointerEvents: aiEnabled ? 'auto' : 'none', transition: 'opacity 0.3s' }}>
								<Typography variant="body1">Provedor de IA</Typography>
								<Select
									margin="dense"
									variant="outlined"
									native
									fullWidth
									value={aiProvider}
									onChange={async (e) => {
										const newProvider = e.target.value;
										setAiProvider(newProvider);
										await api.put("/settings/aiProvider", { value: newProvider });

										// Auto-select first model available for the new provider
										const defaultModel = AI_MODELS[newProvider]?.[0]?.value || "";
										setAiModel(defaultModel);
										await api.put("/settings/aiModel", { value: defaultModel });

										toast.success("Provedor atualizado!");
									}}
								>
									<option value="openai">OpenAI (ChatGPT)</option>
									<option value="grok">xAI (Grok)</option>
								</Select>
							</Box>
							<Box mb={2}>
								<Typography variant="body1">API Key</Typography>
								<TextField
									fullWidth
									variant="outlined"
									margin="dense"
									type="password"
									value={aiApiKey}
									onChange={(e) => setAiApiKey(e.target.value)}
									onBlur={async () => {
										await api.put("/settings/aiApiKey", { value: aiApiKey });
										toast.success("API Key salva!");
									}}
									helperText="Sua chave será armazenada com segurança."
								/>
							</Box>


							<Box mb={2}>
								<Typography variant="body1">Modelo de IA</Typography>
								<Select
									margin="dense"
									variant="outlined"
									native
									fullWidth
									value={aiModel}
									onChange={async (e) => {
										setAiModel(e.target.value);
										await api.put("/settings/aiModel", { value: e.target.value });
										toast.success("Modelo atualizado!");
									}}
								>
									<option value="" disabled>Selecione um modelo</option>
									{AI_MODELS[aiProvider]?.map((model) => (
										<option key={model.value} value={model.value}>
											{model.name} — {model.price}
										</option>
									))}
								</Select>
								<Typography variant="caption" color="textSecondary">
									Selecione o modelo desejado. Os preços são estimativas para tokens de entrada.
								</Typography>
							</Box>
							<Box mb={2}>
								<Typography variant="body1">Prompt Guia (Contexto do Negócio)</Typography>
								<TextField
									fullWidth
									variant="outlined"
									margin="dense"
									multiline
									rows={4}
									placeholder="Ex: Somos uma imobiliária de alto padrão. Sempre use linguagem formal e foque em etapas de qualificação de leads."
									value={aiGuidePrompt}
									onChange={(e) => setAiGuidePrompt(e.target.value)}
									onBlur={async () => {
										await api.put("/settings/aiGuidePrompt", { value: aiGuidePrompt });
										toast.success("Prompt guia atualizado!");
									}}
									helperText="Esse texto será enviado para a IA como contexto global para entender melhor o seu negócio."
								/>
							</Box>

							<Divider style={{ margin: '16px 0' }} />

							<Typography variant="subtitle1" style={{ fontWeight: 600, marginBottom: 12 }}>
								Funcionalidades de IA
							</Typography>
							<Typography variant="caption" color="textSecondary" style={{ display: 'block', marginBottom: 16 }}>
								Ative ou desative funcionalidades específicas de IA no sistema.
							</Typography>

							<Box mb={2} style={{ opacity: aiEnabled ? 1 : 0.5, pointerEvents: aiEnabled ? 'auto' : 'none' }}>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
									<div>
										<Typography variant="body2" style={{ fontWeight: 500 }}>IA no Pipeline</Typography>
										<Typography variant="caption" color="textSecondary">
											Assistente de IA para criar etapas do funil
										</Typography>
									</div>
									<Switch
										checked={aiPipelineEnabled}
										onChange={async (e) => {
											const newValue = e.target.checked;
											setAiPipelineEnabled(newValue);
											await api.put("/settings/aiPipelineEnabled", { value: newValue ? "true" : "false" });
											toast.success(`IA no Pipeline ${newValue ? "ativada" : "desativada"}!`);
										}}
										color="primary"
									/>
								</div>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #eee' }}>
									<div>
										<Typography variant="body2" style={{ fontWeight: 500 }}>IA no Flow Builder</Typography>
										<Typography variant="caption" color="textSecondary">
											Geração de fluxos automatizados via IA
										</Typography>
									</div>
									<Switch
										checked={aiFlowBuilderEnabled}
										onChange={async (e) => {
											const newValue = e.target.checked;
											setAiFlowBuilderEnabled(newValue);
											await api.put("/settings/aiFlowBuilderEnabled", { value: newValue ? "true" : "false" });
											toast.success(`IA no Flow Builder ${newValue ? "ativada" : "desativada"}!`);
										}}
										color="primary"
									/>
								</div>
								<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
									<div>
										<Typography variant="body2" style={{ fontWeight: 500 }}>Assistente IA em Conversas</Typography>
										<Typography variant="caption" color="textSecondary">
											Análise e insights de conversas com contatos
										</Typography>
									</div>
									<Switch
										checked={aiAssistantEnabled}
										onChange={async (e) => {
											const newValue = e.target.checked;
											setAiAssistantEnabled(newValue);
											await api.put("/settings/aiAssistantEnabled", { value: newValue ? "true" : "false" });
											toast.success(`Assistente IA ${newValue ? "ativado" : "desativado"}!`);
										}}
										color="primary"
									/>
								</div>
							</Box>
						</Paper>
					</>
				)}
				{activeSection === "smtp" && activePlugins.includes("smtp") && (
					<>
						<Typography variant="h5" className={classes.sectionTitle}>
							{i18n.t("smtp.settingsTitle")}
						</Typography>
						<SmtpSettingsForm active={true} />
					</>
				)}
			</Box>
		</Box>
	);
};

export default Settings;
