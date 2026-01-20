import React, { useState, useCallback, useContext, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
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
	Tooltip
} from "@material-ui/core";
import {
	CheckCircle,
	SignalCellularConnectedNoInternet0Bar,
	SignalCellular4Bar,
	CropFree,
	SignalCellularConnectedNoInternet2Bar,
	Add,
	MoreVert,
	Edit,
	FiberManualRecord,
	DeleteOutline,
	Autorenew,
	WhatsApp,
	Chat
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import BaseCard from "../../components/BaseCard";

import WhatsAppModal from "../../components/WhatsAppModal";
import WebchatModal from "../../components/WebchatModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import api from "../../services/api";
import { toast } from "react-toastify";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";
import { WhatsAppsContext } from "../../context/WhatsApp/WhatsAppsContext";
import { getBackendUrl } from "../../helpers/urlUtils";

const useStyles = makeStyles(theme => ({
	mainPaper: {
		flex: 1,
		padding: theme.spacing(1),
		overflowY: "scroll",
		...theme.scrollbarStyles,
	},
	customCard: {
		cursor: "pointer",
		height: "100%",
	},
	pulsingDot: {
		width: 10,
		height: 10,
		borderRadius: "50%",
		marginRight: 8,
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
			padding: 1,
		},
	},
	"@keyframes pulse": {
		"0%": {
			transform: "scale(1)",
			opacity: 1,
		},
		"100%": {
			transform: "scale(2.5)",
			opacity: 0,
		},
	},
	chipRoot: {
		fontWeight: 600,
		borderRadius: 8,
		height: 28,
		padding: "4px 0",
		"& .MuiChip-label": {
			paddingLeft: 8,
			paddingRight: 8,
			display: 'flex',
			alignItems: 'center',
			width: "100%"
		}
	}
}));

const Connections = () => {
	const classes = useStyles();
	const history = useHistory();

	const { whatsApps, loading } = useContext(WhatsAppsContext);
	const [whatsAppModalOpen, setWhatsAppModalOpen] = useState(false);
	const [webchatModalOpen, setWebchatModalOpen] = useState(false);
	const [confirmationOpen, setConfirmationOpen] = useState(false);
	const [selectedWhatsApp, setSelectedWhatsApp] = useState(null);
	const [anchorEl, setAnchorEl] = useState(null);
	const [menuTargetId, setMenuTargetId] = useState(null);
	const [activePlugins, setActivePlugins] = useState([]);

	useEffect(() => {
		const fetchPlugins = async () => {
			try {
				const { data } = await api.get("/plugins/api/v1/plugins/installed");
				setActivePlugins(data.active || []);
			} catch (err) {
				if (err?.response?.status !== 502 && err?.code !== "ERR_NETWORK") {
					console.warn("Failed to fetch plugins", err);
				}
			}
		};
		fetchPlugins();
	}, []);

	const handleOpenWhatsAppModal = () => {
		setSelectedWhatsApp(null);
		setWhatsAppModalOpen(true);
	};

	const handleOpenWebchatModal = () => {
		setSelectedWhatsApp(null);
		setWebchatModalOpen(true);
	};

	const handleCloseWhatsAppModal = useCallback(() => {
		setWhatsAppModalOpen(false);
		setSelectedWhatsApp(null);
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
				// For Unknown or other non-disconnected states (that passed the Connected check), try to stop session first
				try {
					await api.delete(`/whatsappsession/${menuTargetId}`);
				} catch (err) {
					// Ignore error if session doesn't exist or can't be stopped, proceed to delete record
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
		if (type === 'webchat') return green[600]; // Webchat sempre online
		switch (status) {
			case "CONNECTED": return green[600];
			case "DISCONNECTED": return red[600];
			case "qrcode": return orange[600];
			case "PAIRING": return orange[400];
			default: return "#9ca3af";
		}
	};

	const getStatusBackgroundColor = (status, type) => {
		if (type === 'webchat') return "#E8F5E9"; // Webchat sempre verde
		switch (status) {
			case "CONNECTED": return "#E8F5E9";
			case "DISCONNECTED": return "#FFEBEE";
			case "qrcode": return "#FFF3E0";
			default: return "#F3F4F6";
		}
	};

	const renderStatusIcon = status => {
		return <SignalCellular4Bar fontSize="default" />;
	};

	const renderStatusLabel = (status, type) => {
		if (type === 'webchat') return "Online"; // Webchat sempre disponível
		switch (status) {
			case "DISCONNECTED": return "Desconectado";
			case "OPENING": return "Iniciando...";
			case "qrcode": return "Escanear QR Code";
			case "CONNECTED": return "Conectado";
			case "TIMEOUT": return "Tempo Esgotado";
			case "PAIRING": return "Pareando";
			default: return "Desconhecido";
		}
	}

	const handleCardClick = (whatsappId) => {
		const whatsapp = whatsApps.find(w => w.id === whatsappId);
		if (!anchorEl) {
			if (whatsapp?.type === 'webchat') {
				// Para webchat, abrir página de configuração dedicada
				history.push(`/connections/webchat/${whatsappId}`);
			} else {
				// Para WhatsApp, redirecionar para página de detalhes
				history.push(`/connections/${whatsappId}`);
			}
		}
	};

	const handleEditWhatsApp = () => {
		const whatsapp = whatsApps.find(w => w.id === menuTargetId);
		if (whatsapp) {
			if (whatsapp.type === 'webchat') {
				// Redirect to config page instead of opening modal
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

	return (
		<MainContainer>
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
			/>
			<WebchatModal
				open={webchatModalOpen}
				onClose={handleCloseWebchatModal}
				whatsAppId={selectedWhatsApp?.id}
			/>

			<MainHeader>
				<Title>{i18n.t("connections.title")}</Title>
				<MainHeaderButtonsWrapper>
					<Button
						variant="contained"
						color="primary"
						onClick={handleOpenWhatsAppModal}
						startIcon={<Add />}
					>
						{i18n.t("connections.buttons.add")}
					</Button>
					{activePlugins.includes("webchat") && (
						<Button
							variant="contained"
							color="primary"
							onClick={handleOpenWebchatModal}
							startIcon={<Add />}
							style={{ marginLeft: 8 }}
						>
							Adicionar Webchat
						</Button>
					)}
					<Button
						variant="contained"
						color="primary"
						onClick={handleRestartAllWhatsApp}
						startIcon={<Autorenew />}
						style={{ marginLeft: 8 }}
					>
						Reiniciar Todas
					</Button>
				</MainHeaderButtonsWrapper>
			</MainHeader>

			<Box className={classes.mainPaper}>
				{loading ? (
					<Box display="flex" justifyContent="center" mt={4}>
						<CircularProgress />
					</Box>
				) : (
					<Grid container spacing={3}>
						{whatsApps?.length > 0 &&
							whatsApps
								.filter(whats => {
									if (whats.type === 'webchat' && !activePlugins.includes("webchat")) return false;
									return true;
								})
								.map(whatsApp => {
									const statusColor = getStatusColor(whatsApp.status, whatsApp.type);
									const bgColor = getStatusBackgroundColor(whatsApp.status, whatsApp.type);

									return (
										<Grid item xs={12} sm={6} md={4} lg={3} key={whatsApp.id}>
											<BaseCard
												className={classes.customCard}
												title={whatsApp.name}
												subtitle={
													<Box>
														<span style={{ fontSize: 13, fontWeight: 400, color: '#8e8e8e', display: 'flex', gap: 4 }}>
															Atualizado em {whatsApp.updatedAt
																? format(parseISO(whatsApp.updatedAt), "dd/MM")
																: "N/A"
															}
														</span>
														{whatsApp.type === 'whatsapp' && (
															<Typography variant="body2" color="textSecondary" style={{ marginTop: 4, display: 'flex', alignItems: 'center' }}>
																<WhatsApp style={{ fontSize: 16, marginRight: 4, color: "#25D366" }} /> WhatsApp
															</Typography>
														)}
														{whatsApp.type === 'webchat' && (
															<Typography variant="body2" color="textSecondary" style={{ marginTop: 4, display: 'flex', alignItems: 'center' }}>
																<Chat style={{ fontSize: 16, marginRight: 4, color: "#9c27b0" }} /> Webchat
															</Typography>
														)}
														{whatsApp.status === "CONNECTED" && whatsApp.number && (
															<Typography variant="body2" color="textSecondary" style={{ marginTop: 4 }}>
																+{whatsApp.number}
															</Typography>
														)}
													</Box>
												}
												iconColor={bgColor}
												icon={
													whatsApp.status === "CONNECTED" && whatsApp.profilePicUrl ? (
														<Avatar
															src={getBackendUrl(whatsApp.profilePicUrl)}
															alt={whatsApp.name}
															style={{ width: 56, height: 56 }}
														/>
													) : (
														React.cloneElement(renderStatusIcon(whatsApp.status), { style: { color: statusColor, fontSize: 24 } })
													)
												}

												actions={
													<>
														<Tooltip title={i18n.t("connections.buttons.restart")}>
															<span>
																<IconButton
																	size="small"
																	onClick={() => handleRestartWhatsApp(whatsApp.id)}
																	disabled={whatsApp.status === "CONNECTED" || whatsApp.type === 'webchat'}
																>
																	<Autorenew fontSize="small" style={{ color: whatsApp.status === "CONNECTED" ? '#bdbdbd' : '#94a3b8' }} />
																</IconButton>
															</span>
														</Tooltip>
														<IconButton
															size="small"
															onClick={(e) => handleMenuOpen(e, whatsApp.id)}
														>
															<MoreVert fontSize="small" style={{ color: '#94a3b8' }} />
														</IconButton>
													</>
												}
												hoverEffect={true}
												onClick={() => handleCardClick(whatsApp.id)}
											>

												<Box mt={2} display="flex" alignItems="center">
													<Chip
														classes={{ root: classes.chipRoot }}
														style={{
															backgroundColor: bgColor,
															color: statusColor,
															width: "100%",
														}}
														label={
															<Box display="flex" alignItems="center" width="100%">
																<Box
																	className={classes.pulsingDot}
																	style={{
																		backgroundColor: statusColor,
																		color: statusColor
																	}}
																/>
																<Typography variant="body2" style={{ fontWeight: 600, fontSize: '0.8125rem' }}>
																	{renderStatusLabel(whatsApp.status, whatsApp.type)}
																</Typography>

																{whatsApp.isDefault && (
																	<Box ml="auto">
																		<CheckCircle style={{ fontSize: 16 }} />
																	</Box>
																)}
															</Box>
														}
													/>
												</Box>
											</BaseCard>
										</Grid>
									)
								})}
					</Grid>
				)}
			</Box>

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
