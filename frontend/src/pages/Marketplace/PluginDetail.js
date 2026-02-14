import React, { useState, useEffect } from "react";
import {
    Container,
    Paper,
    Typography,
    Box,
    Button,
    Chip,
    Divider,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
} from "@material-ui/core";
import {
    ArrowBack as ArrowBackIcon,
    Extension as ExtensionIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
} from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { useParams, useHistory } from "react-router-dom";
import { useContext } from "react";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import pluginApi from "../../services/pluginApi";
import { toast } from "react-toastify";
import { getBackendUrl } from "../../helpers/urlUtils";

const useStyles = makeStyles((theme) => ({
    root: {
        padding: theme.spacing(3),
    },
    backButton: {
        marginBottom: theme.spacing(2),
    },
    header: {
        display: "flex",
        alignItems: "flex-start",
        gap: theme.spacing(3),
        marginBottom: theme.spacing(3),
    },
    iconBox: {
        width: 120,
        height: 120,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: theme.palette.grey[100],
        borderRadius: theme.shape.borderRadius,
    },
    icon: {
        fontSize: 64,
        color: theme.palette.primary.main,
    },
    chipFree: {
        backgroundColor: theme.palette.success.main,
        color: "#fff",
    },
    chipPremium: {
        backgroundColor: theme.palette.warning.main,
        color: "#fff",
    },
    section: {
        marginTop: theme.spacing(3),
    },
    actionButtons: {
        display: "flex",
        gap: theme.spacing(2),
        marginTop: theme.spacing(3),
    },
    loader: {
        display: "flex",
        justifyContent: "center",
        padding: theme.spacing(4),
    },
}));

const PluginDetail = () => {
    const classes = useStyles();
    const { slug } = useParams();
    const history = useHistory();
    const { user } = useContext(AuthContext);
    const [plugin, setPlugin] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activating, setActivating] = useState(false);
    const [licenseDialogOpen, setLicenseDialogOpen] = useState(false);
    const [licenseKey, setLicenseKey] = useState("");

    useEffect(() => {
        loadPlugin();
    }, [slug]);

    const loadPlugin = async () => {
        try {
            setLoading(true);
            const { data: catalogRes } = await pluginApi.get("/api/v1/plugins/catalog");
            const all = Array.isArray(catalogRes?.plugins) ? catalogRes.plugins : [];
            const p = all.find(x => x.slug === slug && ["clientes", "helpdesk"].includes(x.slug));
            if (!p) {
                setPlugin(null);
            } else {
                setPlugin({
                    ...p,
                    installed: p.status !== 'not_installed' && p.status !== null && p.status !== undefined,
                    active: p.status === 'active',
                    // Force use of local icons based on slug
                    iconUrl: `/public/plugins/${p.slug}.png`,
                    longDescription:
                        p.slug === "clientes"
                            ? `O Plugin de Clientes adiciona ao Watink uma gestão completa de clientes, permitindo:\n\n• Cadastro detalhado de clientes (pessoa física e jurídica)\n• Múltiplos contatos vinculados ao mesmo cliente\n• Múltiplos endereços por cliente\n• Integração automática com API ViaCEP para autocompletar endereços\n• Vinculação de contatos do WhatsApp a clientes cadastrados\n• Histórico de interações por cliente`
                            : `O Plugin de Helpdesk transforma seu atendimento em um sistema de suporte profissional:\n\n• Criação de protocolos de atendimento\n• Vinculação de protocolos a tickets\n• Gestão de status, prioridade e SLA\n• Histórico completo de interações no protocolo\n• Relatórios de atendimento`,
                });
            }
        } catch (err) {
            toast.error("Erro ao carregar plugin");
        } finally {
            setLoading(false);
        }
    };


    const handleActivate = async () => {
        if (plugin.type === "premium" && !plugin.installed) {
            setLicenseDialogOpen(true);
            return;
        }

        try {
            setActivating(true);
            await pluginApi.post(`/api/v1/plugins/${plugin.slug}/activate`, {
                licenseKey: licenseKey || undefined,
            });
            toast.success(`Plugin ${plugin.name} ativado com sucesso!`);
            setPlugin({ ...plugin, installed: true, active: true });
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            toast.error("Erro ao ativar plugin");
        } finally {
            setActivating(false);
        }
    };

    const handleDeactivate = async () => {
        try {
            setActivating(true);
            await pluginApi.post(`/api/v1/plugins/${plugin.slug}/deactivate`);
            toast.success(`Plugin ${plugin.name} desativado.`);
            setPlugin({ ...plugin, active: false });
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        } catch (err) {
            toast.error("Erro ao desativar plugin");
        } finally {
            setActivating(false);
        }
    };

    const handleLicenseSubmit = async () => {
        if (!licenseKey.trim()) {
            toast.error("Informe a chave de licença");
            return;
        }

        try {
            setActivating(true);
            await pluginApi.post(`/api/v1/plugins/${plugin.slug}/install`, { licenseKey });
            await pluginApi.post(`/api/v1/plugins/${plugin.slug}/activate`, { licenseKey });
            toast.success(`Plugin ${plugin.name} ativado com sucesso!`);
            setPlugin({ ...plugin, installed: true, active: true });
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            setLicenseDialogOpen(false);
            setLicenseKey("");
        } catch (err) {
            toast.error("Chave de licença inválida");
        } finally {
            setActivating(false);
        }
    };

    if (loading) {
        return (
            <Container maxWidth="lg" className={classes.root}>
                <Box className={classes.loader}>
                    <CircularProgress />
                </Box>
            </Container>
        );
    }

    if (!plugin) {
        return (
            <Container maxWidth="lg" className={classes.root}>
                <Typography>Plugin não encontrado</Typography>
            </Container>
        );
    }

    return (
        <Can
            user={user}
            perform="view_marketplace"
            yes={() => (
                <Container maxWidth="lg" className={classes.root}>
                    <Button
                        startIcon={<ArrowBackIcon />}
                        className={classes.backButton}
                        onClick={() => history.push("/admin/settings/marketplace")}
                    >
                        Voltar ao Marketplace
                    </Button>

                    <Paper elevation={0} style={{ padding: 24 }}>
                        <Box className={classes.header}>
                            <Box className={classes.iconBox}>
                                {plugin.iconUrl ? (
                                    <img src={getBackendUrl(plugin.iconUrl)} alt={plugin.name} style={{ width: 80, height: 80 }} />
                                ) : (
                                    <ExtensionIcon className={classes.icon} />
                                )}
                            </Box>
                            <Box flex={1}>
                                <Box display="flex" alignItems="center" gap={2}>
                                    <Typography variant="h4">{plugin.name}</Typography>
                                    {plugin.active && (
                                        <CheckCircleIcon style={{ color: "green", marginLeft: 8 }} />
                                    )}
                                </Box>
                                <Box mt={1} display="flex" gap={1}>
                                    <Chip
                                        label={plugin.type === "free" ? "Gratuito" : `R$ ${plugin.price}`}
                                        className={plugin.type === "free" ? classes.chipFree : classes.chipPremium}
                                    />
                                    <Chip label={`v${plugin.version}`} variant="outlined" />
                                    <Chip label={plugin.category} variant="outlined" />
                                </Box>
                                <Typography variant="body1" color="textSecondary" style={{ marginTop: 8 }}>
                                    {plugin.description}
                                </Typography>
                            </Box>
                        </Box>

                        <Divider />

                        <Box className={classes.section}>
                            <Typography variant="h6" gutterBottom>
                                Sobre este plugin
                            </Typography>
                            <Typography variant="body1" style={{ whiteSpace: "pre-line" }}>
                                {plugin.longDescription}
                            </Typography>
                        </Box>

                        <Box className={classes.actionButtons}>
                            {plugin.active ? (
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    startIcon={<CancelIcon />}
                                    onClick={handleDeactivate}
                                    disabled={activating}
                                >
                                    {activating ? <CircularProgress size={20} /> : "Desativar Plugin"}
                                </Button>
                            ) : (
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={<CheckCircleIcon />}
                                    onClick={handleActivate}
                                    disabled={activating}
                                >
                                    {activating ? <CircularProgress size={20} /> : "Ativar Plugin"}
                                </Button>
                            )}
                        </Box>
                    </Paper>

                    <Dialog open={licenseDialogOpen} onClose={() => setLicenseDialogOpen(false)}>
                        <DialogTitle>Ativar Plugin Premium</DialogTitle>
                        <DialogContent>
                            <Typography variant="body2" gutterBottom>
                                Este é um plugin premium. Insira sua chave de licença para ativar.
                            </Typography>
                            <TextField
                                autoFocus
                                margin="dense"
                                label="Chave de Licença"
                                fullWidth
                                variant="outlined"
                                value={licenseKey}
                                onChange={(e) => setLicenseKey(e.target.value)}
                                placeholder="XXXX-XXXX-XXXX-XXXX"
                            />
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setLicenseDialogOpen(false)}>Cancelar</Button>
                            <Button
                                onClick={handleLicenseSubmit}
                                color="primary"
                                variant="contained"
                                disabled={activating}
                            >
                                {activating ? <CircularProgress size={20} /> : "Ativar"}
                            </Button>
                        </DialogActions>
                    </Dialog>
                </Container>
            )}
            no={() => (
                <Container maxWidth="lg" className={classes.root}>
                    <Typography variant="h5">Sem permissão</Typography>
                    <Typography variant="body2" color="textSecondary">
                        Apenas o Admin pode acessar o Marketplace.
                    </Typography>
                </Container>
            )}
        />
    );
};

export default PluginDetail;
