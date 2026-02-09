import React, { useState, useCallback, useContext, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { useHistory } from "react-router-dom";

import { makeStyles, useTheme } from "@material-ui/core/styles";
import { green, red, orange } from "@material-ui/core/colors";
import {
	Button,
	Typography,
	CircularProgress,
	Grid,
	Box,
	Chip,
	IconButton,
	Menu,
	MenuItem,
	ListItemIcon,
	Avatar,
	Tooltip,
	Paper,
	List,
	ListItem,
	ListItemText,
	Drawer,
	Hidden,
	useMediaQuery,
	Fade,
	Grow
} from "@material-ui/core";
import {
	CheckCircle,
	SignalCellularConnectedNoInternet0Bar,
	SignalCellular4Bar,
	Add,
	MoreVert,
	Edit,
	DeleteOutline,
	Autorenew,
	WhatsApp,
	Chat,
	Menu as MenuIcon,
	AllInclusive
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";

import WhatsAppModal from "../../components/WhatsAppModal";
import WebchatModal from "../../components/WebchatModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import api from "../../services/api";
import pluginApi from "../../services/pluginApi";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import { getBackendUrl } from "../../helpers/urlUtils";
import TagChip from "../../components/TagChip";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		height: "100%",
		overflow: "hidden",
		backgroundColor: theme.palette.background.default,
	},
	sidebar: {
		width: 280,
		flexShrink: 0,
		borderRight: `1px solid ${theme.palette.divider}`,
		backgroundColor: theme.palette.background.paper,
		display: "flex",
		flexDirection: "column",
		height: "100%",
		zIndex: 10,
	},
	sidebarHeader: {
		padding: theme.spacing(2),
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		borderBottom: `1px solid ${theme.palette.divider}`,
		minHeight: 64,
	},
	sidebarContent: {
		flex: 1,
		overflowY: "auto",
		padding: theme.spacing(2),
	},
	mainContent: {
		flexGrow: 1,
		display: "flex",
		flexDirection: "column",
		height: "100%",
		overflow: "hidden",
		position: "relative",
	},
	scrollableContent: {
		flexGrow: 1,
		overflowY: "auto",
		padding: theme.spacing(3),
		...theme.scrollbarStyles,
	},
	engineItem: {
		borderRadius: 12,
		marginBottom: theme.spacing(1),
		transition: "all 0.3s ease",
		"&:hover": {
			backgroundColor: theme.palette.action.hover,
			transform: "translateX(5px)",
		},
	},
	engineItemSelected: {
		backgroundColor: `${theme.palette.primary.main} !important`,
		color: "#fff",
		boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
		"& .MuiListItemIcon-root": {
			color: "#fff",
		},
		"& .MuiTypography-root": {
			fontWeight: 600,
		},
	},
	// Premium Card Styles
	premiumCard: {
		height: "100%",
		borderRadius: 16,
		background: theme.palette.type === "dark"
			? "linear-gradient(145deg, #2b2b2b, #1e1e1e)"
			: "linear-gradient(145deg, #ffffff, #f0f2f5)",
		boxShadow: theme.palette.type === "dark"
			? "0 4px 20px rgba(0,0,0,0.4)"
			: "0 4px 20px rgba(0,0,0,0.05)",
		transition: "transform 0.3s ease, box-shadow 0.3s ease",
		border: `1px solid ${theme.palette.divider}`,
		position: "relative",
		overflow: "hidden",
		"&:hover": {
			transform: "translateY(-5px)",
			boxShadow: theme.palette.type === "dark"
				? "0 12px 30px rgba(0,0,0,0.5)"
				: "0 12px 30px rgba(0,0,0,0.1)",
		},
	},
	cardHeader: {
		padding: theme.spacing(2),
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		borderBottom: `1px solid ${theme.palette.divider}`,
		background: "rgba(0,0,0,0.02)",
	},
	cardBody: {
		padding: theme.spacing(2),
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		minHeight: 180,
	},
	cardFooter: {
		padding: theme.spacing(1.5),
		borderTop: `1px solid ${theme.palette.divider}`,
		display: "flex",
		justifyContent: "space-between",
		alignItems: "center",
		background: "rgba(0,0,0,0.02)",
	},
	statusBadge: {
		padding: "4px 12px",
		borderRadius: 20,
		fontSize: "0.75rem",
		fontWeight: 600,
		display: "flex",
		alignItems: "center",
		gap: 6,
		boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
	},
	pulsingDot: {
		width: 8,
		height: 8,
		borderRadius: "50%",
		position: "relative",
		"&::before": {
			content: '""',
			position: "absolute",
			top: -1,
			left: -1,
			width: "100%",
			height: "100%",
			borderRadius: "50%",
			border: "1px solid currentColor",
			animation: "$pulse 2s infinite",
			opacity: 0.5,
			padding: 2,
		},
	},
	"@keyframes pulse": {
		"0%": { transform: "scale(1)", opacity: 1 },
		"100%": { transform: "scale(3)", opacity: 0 },
	},
	emptyState: {
		display: "flex",
		flexDirection: "column",
		alignItems: "center",
		justifyContent: "center",
		height: "100%",
		padding: theme.spacing(4),
		opacity: 0.7,
	},
	hamburgerBtn: {
		marginRight: theme.spacing(2),
	},
	addButton: {
		borderRadius: 20,
		padding: "8px 20px",
		textTransform: "none",
		fontWeight: 600,
		boxShadow: "0 4px 10px rgba(0,0,0,0.15)",
		"&:hover": {
			boxShadow: "0 6px 15px rgba(0,0,0,0.2)",
		}
	}
}));

const Connections = () => {
	const classes = useStyles();
	const history = useHistory();
	const theme = useTheme();
	const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

	const { whatsApps, loading } = useContext(WhatsAppsContext);
	const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
	const [webchatModalOpen, setWebchatModalOpen] = useState(false);
	const [confirmationOpen, setConfirmationOpen] = useState(false);
	const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
	const [anchorEl, setAnchorEl] = useState(null);
	const [menuTargetId, setMenuTargetId] = useState(null);
	const [activePlugins, setActivePlugins] = useState([]);

	// New State for Layout
	const [selectedEngine, setSelectedEngine] = useState("all");
	const [mobileOpen, setMobileOpen] = useState(false);
	const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
	const [contactModalOpen, setContactModalOpen] = useState(false);
	const [selectedContactId, setSelectedContactId] = useState(null);

	// Engine Type State for Modal
	const [selectedEngineType, setSelectedEngineType] = useState(null);

	useEffect(() => {
		const fetchPlugins = async () => {
			try {
				const { data } = await pluginApi.get("/api/v1/plugins/installed");
				setActivePlugins(data.active || []);
			} catch (err) {
				if (err?.response?.status !== 502 && err?.code !== "ERR_NETWORK") {
					console.warn("Failed to fetch plugins", err);
				}
			}
		};
		fetchPlugins();
	}, []);

	const handleDrawerToggle = () => {
		setMobileOpen(!mobileOpen);
	};

	const engines = [
		{ id: "all", name: "Todos", icon: <AllInclusive /> },
		{ id: "whatsapp", name: "Whaileys", icon: <WhatsApp /> },
		...(activePlugins.includes("whatsmeow") ? [{ id: "whatsmeow", name: "WhatsMeow", icon: <WhatsApp style={{ color: "#00E676" }} /> }] : []),
		...(activePlugins.includes("engine-papi") ? [{ id: "papi", name: "Engine PAPI", icon: <WhatsApp style={{ color: "#128c7e" }} /> }] : []),
		...(activePlugins.includes("webchat") ? [{ id: "webchat", name: "Webchat", icon: <Chat /> }] : []),
	];

	const handleOpenWhatsAppModal = (engineType = null) => {
		setSelectedWhatsApp(null);
		setSelectedEngineType(engineType);
		setWhatsAppModalOpen(true);
	};

	const handleOpenWebchatModal = () => {
		setSelectedWhatsApp(null);
		setWebchatModalOpen(true);
	};

	const handleCloseWhatsAppModal = useCallback(() => {
		setWhatsAppModalOpen(false);
		setSelectedWhatsApp(null);
		setSelectedEngineType(null); // Reset
	}, [setSelectedWhatsApp, setWhatsAppModalOpen]);

	const handleCloseWebchatModal = useCallback(() => {
		setWebchatModalOpen(false);
		setSelectedWhatsApp(null);
	}, [setSelectedWhatsApp, setWebchatModalOpen]);

	const handleOpenConfirmationModal = () => {
		setConfirmationOpen(true);
		setAnchorEl(null);
	};

	const handleCloseConfirmationModal = () => {
		setConfirmationOpen(false);
		setMenuTargetId(null);
	};

	const handleDeleteWhatsApp = async () => {
		if (!menuTargetId) return;
		const whatsapp = whatsApps.find(w => w.id === menuTargetId);

		try {
			if (whatsapp && whatsapp.status !== "DISCONNECTED" && whatsapp.status !== "TIMEOUT") {
				try {
					await api.delete(`/whatsappsession/${menuTargetId}`);
				} catch (err) {
					console.warn("Could not stop session before deleting:", err);
				}
			}

			await api.delete(`/whatsapp/${menuTargetId}`);
			toast.success(i18n.t("whatsappModal.success"));
		} catch (err) {
			toastError(err);
		}
		setConfirmationOpen(false);
		setMenuTargetId(null);
	};

	const handleMenuOpen = (event, whatsappId) => {
		event.stopPropagation();
		setAnchorEl(event.currentTarget);
		setMenuTargetId(whatsappId);
	};

	const handleMenuClose = () => {
		setAnchorEl(null);
		setMenuTargetId(null);
	};

	const getStatusColor = (status, type) => {
		if (type === 'webchat') return green[600];
		switch (status) {
			case "CONNECTED": return green[600];
			case "DISCONNECTED": return red[600];
			case "qrcode": return orange[600];
			case "PAIRING": return orange[400];
			default: return "#9ca3af";
		}
	};

	const getStatusBackgroundColor = (status, type) => {
		if (type === 'webchat') return "#E8F5E9";
		switch (status) {
			case "CONNECTED": return "#E8F5E9";
			case "DISCONNECTED": return "#FFEBEE";
			case "qrcode": return "#FFF3E0";
			default: return "#F3F4F6";
		}
	};

	const renderStatusIcon = (status, type) => {
		if (type === 'webchat') return <Chat />;
		return <SignalCellular4Bar fontSize="default" />;
	};

	const renderStatusLabel = (status, type) => {
		if (type === 'webchat') return "Online";
		switch (status) {
			case "DISCONNECTED": return "Desconectado";
			case "OPENING": return "Iniciando...";
			case "qrcode": return "Escanear QR Code";
			case "CONNECTED": return "Conectado";
			case "TIMEOUT": return "Tempo Esgotado";
			case "PAIRING": return "Pareando";
			default: return "Desconhecido";
		}
	};

	const handleCardClick = (whatsappId) => {
		const whatsapp = whatsApps.find(w => w.id === whatsappId);
		if (!anchorEl) {
			if (whatsapp?.type === 'webchat') {
				history.push(`/connections/webchat/${whatsappId}`);
			} else {
				history.push(`/connections/${whatsappId}`);
			}
		}
	};

	const handleEditWhatsApp = () => {
		const whatsapp = whatsApps.find(w => w.id === menuTargetId);
		if (whatsapp) {
			if (whatsapp.type === 'webchat') {
				history.push(`/connections/webchat/${whatsapp.id}`);
			} else {
				setSelectedWhatsApp(whatsapp);
				setWhatsAppModalOpen(true);
			}
		}
		handleMenuClose();
	};

	const handleRestartWhatsApp = async (whatsappId) => {
		try {
			await api.put(`/whatsappsession/${whatsappId}`);
			toast.success(i18n.t("whatsappModal.success"));
		} catch (err) {
			toastError(err);
		}
		handleMenuClose();
	};

	const handleRestartAllWhatsApp = async () => {
		try {
			await api.post("/whatsappsession/all");
			toast.success(i18n.t("whatsappModal.success"));
		} catch (err) {
			toastError(err);
		}
	};

	const filteredWhatsApps = whatsApps?.filter(whats => {
		if (whats.type === 'webchat') {
			if (!activePlugins.includes("webchat")) return false;
			if (selectedEngine === "all" || selectedEngine === "webchat") return true;
			return false;
		}

		// Logic for WhatsApp Engines (Whaileys vs WhatsMeow)
		if (selectedEngine === "all") return true;

		if (selectedEngine === "whatsapp") { // Whaileys
			// Show if engineType is null, undefined, or 'whaileys'
			return !whats.engineType || whats.engineType === "whaileys";
		}

		if (selectedEngine === "whatsmeow") { // WhatsMeow
			return whats.engineType === "whatsmeow";
		}

		if (selectedEngine === "papi") { // Engine PAPI
			return whats.engineType === "papi";
		}

		return false;
	});

	const drawerContent = (
		<div className={classes.sidebar}>
			<div className={classes.sidebarHeader}>
				<Typography variant="h6" color="primary" style={{ fontWeight: 700 }}>
					Motores
				</Typography>
			</div>
			<div className={classes.sidebarContent}>
				<List component="nav">
					{engines.map((engine) => (
						<ListItem
							button
							key={engine.id}
							selected={selectedEngine === engine.id}
							onClick={() => {
								setSelectedEngine(engine.id);
								if (isMobile) setMobileOpen(false);
							}}
							className={`${classes.engineItem} ${selectedEngine === engine.id ? classes.engineItemSelected : ''}`}
						>
							<ListItemIcon style={{ minWidth: 40 }}>
								{engine.icon}
							</ListItemIcon>
							<ListItemText primary={engine.name} />
							{selectedEngine === engine.id && (
								<Fade in>
									<CheckCircle fontSize="small" style={{ color: "white" }} />
								</Fade>
							)}
						</ListItem>
					))}
				</List>
			</div>
		</div>
	);

	return (
		<MainContainer>
			<div className={classes.root}>
				<ConfirmationModal
					title={i18n.t("whatsappModal.deleteTitle")}
					open={confirmationOpen}
					onClose={handleCloseConfirmationModal}
					onConfirm={handleDeleteWhatsApp}
				>
					{i18n.t("whatsappModal.deleteMessage")}
					<Typography variant="body2" color="error" style={{ marginTop: 8 }}>
						Esta ação não pode ser desfeita.
					</Typography>
				</ConfirmationModal>
				<WhatsAppModal
					open={whatsAppModalOpen}
					onClose={handleCloseWhatsAppModal}
					whatsAppId={selectedWhatsApp?.id}
					engineType={selectedEngineType}
				/>
				<WebchatModal
					open={webchatModalOpen}
					onClose={handleCloseWebchatModal}
					whatsAppId={selectedWhatsApp?.id}
				/>

				{/* Sidebar for Desktop */}
				<Hidden smDown implementation="css">
					{drawerContent}
				</Hidden>

				{/* Sidebar for Mobile */}
				<Hidden mdUp implementation="css">
					<Drawer
						variant="temporary"
						anchor="left"
						open={mobileOpen}
						onClose={handleDrawerToggle}
						classes={{
							paper: classes.sidebarMobile,
						}}
						ModalProps={{
							keepMounted: true,
						}}
					>
						{drawerContent}
					</Drawer>
				</Hidden>

				<div className={classes.mainContent}>
					<MainHeader>
						{isMobile && (
							<IconButton
								color="inherit"
								aria-label="open drawer"
								edge="start"
								onClick={handleDrawerToggle}
								className={classes.hamburgerBtn}
							>
								<MenuIcon />
							</IconButton>
						)}
						<Title>{i18n.t("connections.title")}</Title>
						<MainHeaderButtonsWrapper>
							{(selectedEngine === "all" || selectedEngine === "whatsapp") && (
								<Button
									variant="contained"
									color="primary"
									onClick={() => handleOpenWhatsAppModal()}
									startIcon={<WhatsApp />}
									className={classes.addButton}
								>
									{i18n.t("connections.buttons.add")}
								</Button>
							)}
							{(selectedEngine === "all" || selectedEngine === "whatsmeow") && activePlugins.includes("whatsmeow") && (
								<Button
									variant="contained"
									style={{ backgroundColor: "#00E676", color: "#fff", marginLeft: 8 }}
									onClick={() => handleOpenWhatsAppModal("whatsmeow")}
									startIcon={<WhatsApp />}
									className={classes.addButton}
								>
									{i18n.t("connections.buttons.addWhatsmeow")}
								</Button>
							)}
							{(selectedEngine === "all" || selectedEngine === "papi") && activePlugins.includes("engine-papi") && (
								<Button
									variant="contained"
									style={{ backgroundColor: "#128c7e", color: "#fff", marginLeft: 8 }}
									onClick={() => handleOpenWhatsAppModal("papi")}
									startIcon={<WhatsApp />}
									className={classes.addButton}
								>
									Add PAPI
								</Button>
							)}
							{(selectedEngine === "all" || selectedEngine === "webchat") && activePlugins.includes("webchat") && (
								<Button
									variant="contained"
									color="primary"
									onClick={handleOpenWebchatModal}
									startIcon={<Chat />}
									style={{ marginLeft: 8 }}
									className={classes.addButton}
								>
									Webchat
								</Button>
							)}
							<Button
								variant="outlined"
								color="primary"
								onClick={handleRestartAllWhatsApp}
								startIcon={<Autorenew />}
								style={{ marginLeft: 8 }}
								className={classes.addButton}
							>
								Reiniciar
							</Button>
						</MainHeaderButtonsWrapper>
					</MainHeader>

					<Box className={classes.scrollableContent}>
						{loading ? (
							<Box display="flex" justifyContent="center" mt={4}>
								<CircularProgress />
							</Box>
						) : (
							<>
								{filteredWhatsApps?.length === 0 ? (
									<Fade in>
										<div className={classes.emptyState}>
											<SignalCellularConnectedNoInternet0Bar style={{ fontSize: 60, color: "#ccc", marginBottom: 16 }} />
											<Typography variant="h6" color="textSecondary">
												Nenhuma conexão encontrada para este motor.
											</Typography>
										</div>
									</Fade>
								) : (
									<Grid container spacing={3}>
										{filteredWhatsApps.map((whatsApp, index) => {
											const statusColor = getStatusColor(whatsApp.status, whatsApp.type);
											const bgColor = getStatusBackgroundColor(whatsApp.status, whatsApp.type);

											return (
												<Grow in timeout={300 * (index + 1)} key={whatsApp.id}>
													<Grid item xs={12} sm={6} md={6} lg={4}>
														<Paper
															className={classes.premiumCard}
															elevation={0}
															onClick={() => handleCardClick(whatsApp.id)}
															style={{ cursor: "pointer" }}
														>
															<div className={classes.cardHeader}>
																<Box display="flex" alignItems="center" gap={1}>
																	{whatsApp.type === 'whatsapp' ? (
																		<WhatsApp style={{ color: "#25D366" }} />
																	) : (
																		<Chat style={{ color: "#9c27b0" }} />
																	)}
																	<Typography variant="subtitle1" style={{ fontWeight: 600 }}>
																		{whatsApp.name}
																	</Typography>
																</Box>
																<IconButton
																	size="small"
																	onClick={(e) => handleMenuOpen(e, whatsApp.id)}
																>
																	<MoreVert fontSize="small" />
																</IconButton>
															</div>

															<div className={classes.cardBody}>
																<Box position="relative" display="inline-flex">
																	{whatsApp.status === "CONNECTED" && whatsApp.profilePicUrl ? (
																		<Avatar
																			src={getBackendUrl(whatsApp.profilePicUrl)}
																			alt={whatsApp.name}
																			style={{ width: 80, height: 80, border: `2px solid ${statusColor}` }}
																		/>
																	) : (
																		<Avatar style={{ width: 80, height: 80, backgroundColor: bgColor }}>
																			{React.cloneElement(renderStatusIcon(whatsApp.status, whatsApp.type), { style: { color: statusColor, fontSize: 40 } })}
																		</Avatar>
																	)}
																	{whatsApp.isDefault && (
																		<Tooltip title="Padrão">
																			<CheckCircle
																				style={{
																					position: "absolute",
																					bottom: 0,
																					right: 0,
																					color: theme.palette.primary.main,
																					backgroundColor: "#fff",
																					borderRadius: "50%"
																				}}
																			/>
																		</Tooltip>
																	)}
																</Box>

																<Box mt={2} textAlign="center">
																	{whatsApp.status === "CONNECTED" && whatsApp.number && (
																		<Typography variant="body2" color="textSecondary" style={{ fontWeight: 500 }}>
																			{whatsApp.number}
																		</Typography>
																	)}
																	<Typography variant="caption" color="textSecondary" display="block" style={{ marginTop: 4 }}>
																		Última atualização: {whatsApp.updatedAt ? format(parseISO(whatsApp.updatedAt), "dd/MM HH:mm") : "N/A"}
																	</Typography>
																</Box>

																{whatsApp.tags?.length > 0 && (
																	<Box mt={2} display="flex" flexWrap="wrap" justifyContent="center" gap={0.5}>
																		{whatsApp.tags.map(tag => (
																			<TagChip key={tag.id} tag={tag} size="small" />
																		))}
																	</Box>
																)}
															</div>

															<div className={classes.cardFooter}>
																<div
																	className={classes.statusBadge}
																	style={{ backgroundColor: bgColor, color: statusColor }}
																>
																	<div
																		className={classes.pulsingDot}
																		style={{ color: statusColor, backgroundColor: statusColor }}
																	/>
																	{renderStatusLabel(whatsApp.status, whatsApp.type)}
																</div>

																<Tooltip title={i18n.t("connections.buttons.restart")}>
																	<IconButton
																		size="small"
																		onClick={(e) => {
																			e.stopPropagation();
																			handleRestartWhatsApp(whatsApp.id);
																		}}
																		disabled={whatsApp.status === "CONNECTED" || whatsApp.type === 'webchat'}
																	>
																		<Autorenew fontSize="small" />
																	</IconButton>
																</Tooltip>
															</div>
														</Paper>
													</Grid>
												</Grow>
											);
										})}
									</Grid>
								)}
							</>
						)}
					</Box>
				</div>
			</div>

			<Menu
				anchorEl={anchorEl}
				keepMounted
				open={Boolean(anchorEl)}
				onClose={handleMenuClose}
				elevation={2}
				getContentAnchorEl={null}
				anchorOrigin={{
					vertical: 'bottom',
					horizontal: 'right',
				}}
				transformOrigin={{
					vertical: 'top',
					horizontal: 'right',
				}}
			>
				<MenuItem onClick={() => handleRestartWhatsApp(menuTargetId)} disabled={whatsApps.find(w => w.id === menuTargetId)?.status === "CONNECTED"}>
					<ListItemIcon style={{ minWidth: 32 }}>
						<Autorenew fontSize="small" />
					</ListItemIcon>
					<Typography variant="body2">{i18n.t("connections.buttons.restart")}</Typography>
				</MenuItem>
				<MenuItem onClick={handleEditWhatsApp}>
					<ListItemIcon style={{ minWidth: 32 }}>
						<Edit fontSize="small" />
					</ListItemIcon>
					<Typography variant="body2">Editar</Typography>
				</MenuItem>
				<MenuItem onClick={() => {
					const whatsapp = whatsApps.find(w => w.id === menuTargetId);
					if (whatsapp && whatsapp.status === "CONNECTED") {
						toast.error("Não é possível excluir uma conexão ativa. Desconecte-se primeiro.");
						handleMenuClose();
					} else {
						handleOpenConfirmationModal();
					}
				}}>
					<ListItemIcon style={{ minWidth: 32 }}>
						<DeleteOutline fontSize="small" color="secondary" />
					</ListItemIcon>
					<Typography variant="body2" color="error">Excluir</Typography>
				</MenuItem>
			</Menu>
		</MainContainer>
	);
};

export default Connections;
