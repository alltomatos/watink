import React, { useState, useCallback, useContext, useEffect } from "react";
import { useParams, useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import {
    Paper,
    Typography,
    Button,
    Grid,
    CircularProgress,
    Box,
    Divider,
    IconButton,
    Card,
    CardContent,
    Avatar,
    Tooltip,
    LinearProgress
} from "@material-ui/core";
import {
    ArrowBack,
    SignalCellular4Bar,
    CropFree,
    PowerSettingsNew,
    Edit,
    CheckCircle,
    ErrorOutline,
    EventAvailable,
    AccessTime
} from "@material-ui/icons";
import { green, red, orange, blue } from "@material-ui/core/colors";
import QRCode from "qrcode.react";
import { format, parseISO } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";

import MainContainer from "../../components/MainContainer";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import WhatsAppModal from "../../components/WhatsAppModal";
import openSocket from "../../services/socket-io";
import ConfirmationModal from "../../components/ConfirmationModal";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
    root: {
        padding: theme.spacing(3),
        background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
        minHeight: "100vh",
    },
    header: {
        marginBottom: theme.spacing(3),
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
    },
    // Glassmorphism Card Style
    glassCard: {
        background: "rgba(255, 255, 255, 0.7)",
        backdropFilter: "blur(10px)",
        borderRadius: "20px",
        border: "1px solid rgba(255, 255, 255, 0.3)",
        boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.15)",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        transition: "transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out",
        "&:hover": {
            transform: "translateY(-5px)",
            boxShadow: "0 12px 40px 0 rgba(31, 38, 135, 0.25)",
        },
        padding: theme.spacing(3),
    },
    statusContainer: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: theme.spacing(3),
    },
    statusBadge: {
        padding: "8px 16px",
        borderRadius: "50px",
        fontWeight: "bold",
        fontSize: "0.9rem",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
    },
    actionButton: {
        borderRadius: "12px",
        padding: "10px 24px",
        fontWeight: 600,
        textTransform: "none",
        boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
        transition: "all 0.2s",
        "&:hover": {
            transform: "scale(1.02)",
            boxShadow: "0 6px 12px rgba(0,0,0,0.15)",
        }
    },
    disconnectButton: {
        background: "linear-gradient(45deg, #FF512F 30%, #DD2476 90%)",
        color: "white",
    },
    connectButton: {
        background: "linear-gradient(45deg, #2193b0 30%, #6dd5ed 90%)",
        color: "white",
    },
    gridContainer: {
        marginTop: theme.spacing(2),
    },
    qrCodeContainer: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: theme.spacing(4),
        background: "rgba(255,255,255,0.5)",
        borderRadius: "16px",
        marginTop: theme.spacing(2),
    },
    detailItem: {
        display: "flex",
        alignItems: "center",
        marginBottom: theme.spacing(2),
        padding: theme.spacing(1.5),
        borderRadius: "12px",
        background: "rgba(255,255,255,0.4)",
    },
    detailIcon: {
        marginRight: theme.spacing(2),
        color: theme.palette.text.secondary,
    }
}));

const ConnectionConfig = () => {
    const classes = useStyles();
    const history = useHistory();
    const { whatsappId } = useParams();

    const [whatsapp, setWhatsapp] = useState(null);
    const [loading, setLoading] = useState(true);
    const [whatsappModalOpen, setWhatsAppModalOpen] = useState(false);
    const [confirmationOpen, setConfirmationOpen] = useState(false);
    const [confirmationAction, setConfirmationAction] = useState(null);
    const [connecting, setConnecting] = useState(false);
    const [showQrCode, setShowQrCode] = useState(false);

    const fetchWhatsapp = useCallback(async () => {
        try {
            const { data } = await api.get(`/whatsapp/${whatsappId}`);
            setWhatsapp(data);
            setLoading(false);
        } catch (err) {
            toastError(err);
            setLoading(false);
        }
    }, [whatsappId]);

    useEffect(() => {
        fetchWhatsapp();
    }, [fetchWhatsapp]);

    useEffect(() => {
        const socket = openSocket();

        if (!socket) return;

        socket.on("whatsappSession", (data) => {
            if (data.action === "update" && data.session.id === parseInt(whatsappId)) {
                setWhatsapp(prev => ({ ...prev, ...data.session }));

                if (data.session.status === "CONNECTED") {
                    setShowQrCode(false);
                    setConnecting(false);
                }

                if (data.session.status === "DISCONNECTED" || data.session.status === "SESSION_EXPIRED") {
                    setShowQrCode(false);
                    setConnecting(false);
                }
            }
        });

        socket.on("whatsapp", (data) => {
            if (data.action === "update" && data.whatsapp.id === parseInt(whatsappId)) {
                setWhatsapp(prev => ({ ...prev, ...data.whatsapp }));
            }
        });

        return () => {
            socket.disconnect();
        };
    }, [whatsappId]);

    useEffect(() => {
        if (whatsapp?.status === "QRCODE") {
            setShowQrCode(true);
        }
    }, [whatsapp?.status]);

    const handleStartSession = async () => {
        try {
            if (whatsapp.status === "QRCODE") {
                setShowQrCode(true);
                return;
            }
            setConnecting(true);
            await api.post(`/whatsappsession/${whatsappId}`, { usePairingCode: false });
        } catch (err) {
            toastError(err);
            setConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        try {
            await api.delete(`/whatsappsession/${whatsappId}`);
        } catch (err) {
            toastError(err);
        }
        setConfirmationOpen(false);
    };

    const handleDelete = async () => {
        try {
            await api.delete(`/whatsapp/${whatsappId}`);
            history.push("/connections");
        } catch (err) {
            toastError(err);
        }
        setConfirmationOpen(false);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case "CONNECTED": return green[600];
            case "DISCONNECTED": return red[600];
            case "SESSION_EXPIRED": return red[600]; // Vermelho para chamar atenção
            case "QRCODE": return blue[600];
            case "OPENING": return blue[600];
            default: return orange[600];
        }
    };

    const getStatusText = (status) => {
        const map = {
            CONNECTED: "Conectado",
            DISCONNECTED: "Desconectado",
            SESSION_EXPIRED: "Sessão Expirada",
            QRCODE: "Aguardando Leitura",
            OPENING: "Iniciando...",
            TIMEOUT: "Tempo Esgotado"
        };
        return map[status] || status;
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <MainContainer>
            <ConfirmationModal
                title={confirmationAction === "disconnect" ? i18n.t("connections.confirmationModal.disconnectTitle") : i18n.t("connections.confirmationModal.deleteTitle")}
                open={confirmationOpen}
                onClose={() => setConfirmationOpen(false)}
                onConfirm={confirmationAction === "disconnect" ? handleDisconnect : handleDelete}
            >
                {confirmationAction === "disconnect" ? i18n.t("connections.confirmationModal.disconnectMessage") : i18n.t("connections.confirmationModal.deleteMessage")}
            </ConfirmationModal>

            <WhatsAppModal
                open={whatsappModalOpen}
                onClose={() => { setWhatsAppModalOpen(false); fetchWhatsapp(); }}
                whatsAppId={whatsappId}
            />

            <div className={classes.header}>
                <Box display="flex" alignItems="center">
                    <IconButton onClick={() => history.push("/connections")} style={{ marginRight: 10 }}>
                        <ArrowBack />
                    </IconButton>
                    <Title>{whatsapp.name}</Title>
                    <Tooltip title="Editar Nome/Fila">
                        <IconButton size="small" onClick={() => setWhatsAppModalOpen(true)} style={{ marginLeft: 10 }}>
                            <Edit />
                        </IconButton>
                    </Tooltip>
                </Box>
            </div>

            <Grid container spacing={4} className={classes.gridContainer}>
                {/* Visual Status Card */}
                <Grid item xs={12} md={8}>
                    <Paper className={classes.glassCard} elevation={0}>
                        <Box className={classes.statusContainer}>
                            <Box display="flex" alignItems="center">
                                <Avatar
                                    src={whatsapp.profilePicUrl}
                                    style={{ width: 80, height: 80, marginRight: 20, border: `2px solid ${getStatusColor(whatsapp.status)}` }}
                                />
                                <Box>
                                    <Typography variant="h5" style={{ fontWeight: 700 }}>
                                        {whatsapp.name}
                                    </Typography>
                                    <Typography variant="body1" color="textSecondary">
                                        {whatsapp.number ? `+${whatsapp.number}` : "Sem número vinculado"}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box className={classes.statusBadge} style={{ backgroundColor: getStatusColor(whatsapp.status), color: "#fff" }}>
                                {whatsapp.status === "CONNECTED" ? <CheckCircle /> : <ErrorOutline />}
                                {getStatusText(whatsapp.status)}
                            </Box>
                        </Box>

                        <Divider style={{ margin: "20px 0" }} />

                        <Box flexGrow={1} display="flex" flexDirection="column" justifyContent="center">
                            {whatsapp.status === "CONNECTED" ? (
                                <Box textAlign="center" py={5}>
                                    <SignalCellular4Bar style={{ fontSize: 80, color: green[500], marginBottom: 20 }} />
                                    <Typography variant="h6" color="primary">
                                        Tudo pronto! Sua conexão está ativa e funcionando perfeitamente.
                                    </Typography>
                                </Box>
                            ) : whatsapp.status === "QRCODE" && showQrCode ? (
                                <Box className={classes.qrCodeContainer}>
                                    <Typography variant="h6" gutterBottom style={{ fontWeight: 600 }}>
                                        Abra o WhatsApp e escaneie o código
                                    </Typography>
                                    <Box my={2}>
                                        {whatsapp.qrcode ? (
                                            <QRCode value={whatsapp.qrcode} size={280} />
                                        ) : (
                                            <CircularProgress />
                                        )}
                                    </Box>
                                    <Typography variant="body2" color="textSecondary">
                                        Aguardando leitura...
                                    </Typography>
                                </Box>
                            ) : (
                                <Box textAlign="center" py={5}>

                                    {whatsapp.status === "SESSION_EXPIRED" && (
                                        <Typography variant="h6" color="error" gutterBottom style={{ fontWeight: bold => 600, marginBottom: 20 }}>
                                            Sua sessão expirou por segurança. Por favor, conecte-se novamente.
                                        </Typography>
                                    )}

                                    <Typography variant="body1" color="textSecondary" paragraph>
                                        Para começar a enviar e receber mensagens, precisamos estabelecer uma conexão segura com seu WhatsApp.
                                    </Typography>
                                </Box>
                            )}
                        </Box>

                        <Box mt={3} display="flex" justifyContent="flex-end">
                            {(whatsapp.status === "CONNECTED") ? (
                                <Button
                                    variant="contained"
                                    className={`${classes.actionButton} ${classes.disconnectButton}`}
                                    onClick={() => { setConfirmationAction("disconnect"); setConfirmationOpen(true); }}
                                >
                                    Desconectar
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        variant="outlined"
                                        color="secondary"
                                        className={classes.actionButton}
                                        onClick={() => { setConfirmationAction("delete"); setConfirmationOpen(true); }}
                                        style={{ marginRight: 15 }}
                                    >
                                        Excluir
                                    </Button>

                                    {!showQrCode && (
                                        <Button
                                            variant="contained"
                                            className={`${classes.actionButton} ${classes.connectButton}`}
                                            onClick={handleStartSession}
                                            disabled={connecting}
                                        >
                                            {connecting ? <CircularProgress size={24} color="inherit" /> : "Gerar QR Code"}
                                        </Button>
                                    )}

                                    {showQrCode && (
                                        <Button
                                            variant="text"
                                            color="primary"
                                            onClick={() => { setConfirmationAction("disconnect"); setConfirmationOpen(true); }}
                                        >
                                            Cancelar
                                        </Button>
                                    )}
                                </>
                            )}
                        </Box>
                    </Paper>
                </Grid>

                {/* Details Card */}
                <Grid item xs={12} md={4}>
                    <Paper className={classes.glassCard} elevation={0}>
                        <Typography variant="h6" gutterBottom style={{ fontWeight: 600, display: "flex", alignItems: "center" }}>
                            <Box component="span" mr={1} role="img" aria-label="info">ℹ️</Box> Detalhes da Sessão
                        </Typography>

                        <Box mt={3}>
                            <Box className={classes.detailItem}>
                                <AccessTime className={classes.detailIcon} />
                                <Box>
                                    <Typography variant="caption" color="textSecondary">Última Atualização</Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                        {whatsapp.updatedAt ? format(parseISO(whatsapp.updatedAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "N/A"}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box className={classes.detailItem}>
                                <EventAvailable className={classes.detailIcon} />
                                <Box>
                                    <Typography variant="caption" color="textSecondary">Data da 1ª Conexão</Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                        {whatsapp.createdAt ? format(parseISO(whatsapp.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "N/A"}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box className={classes.detailItem}>
                                <Box style={{ marginRight: 16 }}>📤</Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary">Mensagens Enviadas</Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                        {whatsapp.messagesSent || 0}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box className={classes.detailItem}>
                                <Box style={{ marginRight: 16 }}>📥</Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary">Mensagens Recebidas</Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                        {whatsapp.messagesReceived || 0}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box className={classes.detailItem}>
                                <Box style={{ marginRight: 16 }}>🔄</Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary">Padrão do Sistema</Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                        {whatsapp.isDefault ? "Sim" : "Não"}
                                    </Typography>
                                </Box>
                            </Box>

                            <Box className={classes.detailItem}>
                                <Box style={{ marginRight: 16 }}>☁️</Box>
                                <Box>
                                    <Typography variant="caption" color="textSecondary">Sincronização de Histórico</Typography>
                                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                                        {whatsapp.syncHistory ? "Ativado" : "Desativado"}
                                    </Typography>
                                </Box>
                            </Box>

                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </MainContainer>
    );
};

export default ConnectionConfig;
