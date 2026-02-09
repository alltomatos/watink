import React, { useState, useEffect, useCallback } from "react";
import { useParams, useHistory } from "react-router-dom";
import {
    Container,
    Paper,
    Typography,
    Button,
    Grid,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Box,
    CircularProgress,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Chip,
    Divider,
    Tooltip,
    IconButton,
    Tabs,
    Tab,
} from "@material-ui/core";
import {
    Create as CreateIcon,
    Update as UpdateIcon,
    Comment as CommentIcon,
    CheckCircle as CheckCircleIcon,
    ArrowBack as ArrowBackIcon,
    Save as SaveIcon,
    CloudUpload as CloudUploadIcon,
    AttachFile as AttachFileIcon,
    FileCopy as FileCopyIcon,
    Link as LinkIcon,
} from "@material-ui/icons";
import FileUploader from "../../components/FileUploader";
import AttachmentsList from "../../components/AttachmentsList";
import ActivityList from "./components/ActivityList";
import { makeStyles } from "@material-ui/core/styles";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
    root: {
        padding: theme.spacing(3),
    },
    paper: {
        padding: theme.spacing(3),
        marginBottom: theme.spacing(3),
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: theme.spacing(3),
    },
    historyItem: {
        borderLeft: `2px solid ${theme.palette.primary.main}`,
        marginLeft: theme.spacing(2),
        paddingLeft: theme.spacing(2),
        marginBottom: theme.spacing(1),
    },
    historyIcon: {
        minWidth: 36,
    },
}));

const ProtocolDetails = () => {
    const classes = useStyles();
    const { protocolId } = useParams();
    const historyRoute = useHistory();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [protocol, setProtocol] = useState(null);
    const [history, setHistory] = useState([]);
    const [formData, setFormData] = useState({
        status: "",
        priority: "",
        comment: "",
    });
    const [attachments, setAttachments] = useState([]);
    const [tab, setTab] = useState(0);
    const [newFiles, setNewFiles] = useState([]);
    const [updateFiles, setUpdateFiles] = useState([]);
    const [uploadingFiles, setUploadingFiles] = useState(false);

    const loadProtocol = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get(`/protocols/${protocolId}`);
            setProtocol(data);
            setHistory(data.history || []);
            setFormData({
                status: data.status,
                priority: data.priority,
                comment: "",
            });
            // Load attachments
            const attachmentsRes = await api.get(`/protocols/${protocolId}/attachments`);
            setAttachments(attachmentsRes.data || []);
        } catch (err) {
            toast.error("Erro ao carregar protocolo");
            historyRoute.push("/helpdesk");
        } finally {
            setLoading(false);
        }
    }, [protocolId, historyRoute]);

    useEffect(() => {
        loadProtocol();
    }, [loadProtocol]);

    const handleUploadFiles = async () => {
        if (newFiles.length === 0) return;

        setUploadingFiles(true);
        try {
            const formData = new FormData();
            newFiles.forEach((file) => {
                formData.append("files", file);
            });

            const { data } = await api.post(`/protocols/${protocolId}/attachments`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            setAttachments((prev) => [...data, ...prev]);
            setNewFiles([]);
            toast.success("Arquivos enviados com sucesso!");
            loadProtocol();
        } catch (err) {
            toast.error("Erro ao enviar arquivos");
        } finally {
            setUploadingFiles(false);
        }
    };

    const handleDeleteAttachment = async (attachmentId) => {
        try {
            await api.delete(`/protocols/${protocolId}/attachments/${attachmentId}`);
            setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
            toast.success("Anexo removido");
        } catch (err) {
            toast.error("Erro ao remover anexo");
        }
    };


    const handleSubmit = async () => {
        try {
            setSaving(true);
            const formDataPayload = new FormData();

            formDataPayload.append("status", formData.status);
            formDataPayload.append("priority", formData.priority);
            if (formData.comment) {
                formDataPayload.append("comment", formData.comment);
            }

            // Append existing values to keep consistency if needed (though API might not strictly need them if partial update allowed)
            formDataPayload.append("subject", protocol.subject);
            formDataPayload.append("description", protocol.description);
            if (protocol.category) {
                formDataPayload.append("category", protocol.category);
            }

            // Append files
            updateFiles.forEach((file) => {
                formDataPayload.append("files", file);
            });

            await api.put(`/protocols/${protocolId}`, formDataPayload, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            toast.success("Protocolo atualizado com sucesso");
            setFormData(prev => ({ ...prev, comment: "" }));
            setUpdateFiles([]); // Clear files
            loadProtocol(); // Reload to get new history and attachments
        } catch (err) {
            toast.error("Erro ao atualizar protocolo");
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const getActionIcon = (action) => {
        const iconMap = {
            created: <CreateIcon fontSize="small" />,
            status_changed: <UpdateIcon fontSize="small" />,
            priority_changed: <UpdateIcon fontSize="small" />,
            commented: <CommentIcon fontSize="small" />,
            resolved: <CheckCircleIcon fontSize="small" />,
            attachment: <AttachFileIcon fontSize="small" />,
        };
        return iconMap[action] || <UpdateIcon fontSize="small" />;
    };

    const getActionLabel = (action) => {
        const labelMap = {
            created: "Criado",
            status_changed: "Status alterado",
            priority_changed: "Prioridade alterada",
            commented: "Comentário",
            resolved: "Resolvido",
            closed: "Fechado",
            attachment: "Anexo",
        };
        return labelMap[action] || action;
    };

    if (loading) {
        return (
            <Box className={classes.root} display="flex" justifyContent="center">
                <CircularProgress />
            </Box>
        );
    }

    if (!protocol) return null;

    const handleCopyExternalLink = () => {
        const externalUrl = `${window.location.origin}/public/protocols/${protocol.token}`;
        navigator.clipboard.writeText(externalUrl).then(() => {
            toast.success("Link copiado para a área de transferência!");
        }).catch(() => {
            toast.error("Erro ao copiar link");
        });
    };

    return (
        <Container maxWidth="lg" className={classes.root}>
            <Box className={classes.header}>
                <Box display="flex" alignItems="center">
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={() => historyRoute.push("/helpdesk")}
                        style={{ marginRight: 16 }}
                    >
                        Voltar
                    </Button>
                    <Typography variant="h4">
                        Protocolo #{protocol.protocolNumber}
                    </Typography>
                    <Tooltip title="Copiar link externo (para enviar ao cliente)">
                        <IconButton
                            onClick={handleCopyExternalLink}
                            style={{ marginLeft: 8 }}
                            color="primary"
                        >
                            <LinkIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>

            <Grid container spacing={3}>
                <Grid item xs={12} md={8}>
                    <Paper className={classes.paper}>
                        <Typography variant="h6" gutterBottom>
                            Detalhes
                        </Typography>
                        <Tabs
                            value={tab}
                            onChange={(e, v) => setTab(v)}
                            indicatorColor="primary"
                            textColor="primary"
                            variant="fullWidth"
                            style={{ marginBottom: 24, borderBottom: "1px solid #eee" }}
                        >
                            <Tab label="Dados Gerais" />
                            <Tab label="Anexos" />
                            <Tab label="Atividades / RAT" />
                        </Tabs>

                        {tab === 0 && (
                            <>
                                <Box mb={2}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Assunto
                                    </Typography>
                                    <Typography variant="body1">{protocol.subject}</Typography>
                                </Box>
                                <Box mb={2}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Descrição
                                    </Typography>
                                    <Typography variant="body1" style={{ whiteSpace: "pre-wrap" }}>
                                        {protocol.description}
                                    </Typography>
                                </Box>
                                <Box mb={2}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Categoria
                                    </Typography>
                                    <Typography variant="body1">
                                        {protocol.category || "-"}
                                    </Typography>
                                </Box>
                                <Box mb={2}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        Contato
                                    </Typography>
                                    <Typography variant="body1">
                                        {protocol.contact ? protocol.contact.name : "-"}
                                    </Typography>
                                </Box>
                            </>
                        )}

                        {tab === 1 && (
                            <>
                                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                    <Typography variant="h6">
                                        <AttachFileIcon style={{ marginRight: 8, verticalAlign: "middle" }} />
                                        Galeria de Anexos ({attachments.length})
                                    </Typography>
                                </Box>

                                <AttachmentsList
                                    attachments={attachments}
                                    onDelete={handleDeleteAttachment}
                                    canDelete={false}
                                    showEmpty={true}
                                />
                                
                                <Box mt={2}>
                                    <Typography variant="caption" color="textSecondary">
                                        * Para adicionar novos anexos, utilize a seção "Atualizar" abaixo.
                                    </Typography>
                                </Box>
                            </>
                        )}

                        {tab === 2 && (
                            <ActivityList protocolId={protocol.id} />
                        )}

                    </Paper>

                    <Paper className={classes.paper}>
                        <Typography variant="h6" gutterBottom>
                            Atualizar
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <FormControl variant="outlined" fullWidth size="small">
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        label="Status"
                                    >
                                        <MenuItem value="open">Aberto</MenuItem>
                                        <MenuItem value="in_progress">Em Andamento</MenuItem>
                                        <MenuItem value="pending">Pendente</MenuItem>
                                        <MenuItem value="resolved">Resolvido</MenuItem>
                                        <MenuItem value="closed">Fechado</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControl variant="outlined" fullWidth size="small">
                                    <InputLabel>Prioridade</InputLabel>
                                    <Select
                                        name="priority"
                                        value={formData.priority}
                                        onChange={handleChange}
                                        label="Prioridade"
                                    >
                                        <MenuItem value="low">Baixa</MenuItem>
                                        <MenuItem value="medium">Média</MenuItem>
                                        <MenuItem value="high">Alta</MenuItem>
                                        <MenuItem value="urgent">Urgente</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    name="comment"
                                    label="Adicionar Comentário"
                                    value={formData.comment}
                                    onChange={handleChange}
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                    multiline
                                    rows={3}
                                    placeholder="Descreva a ação realizada ou adicione uma nota..."
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <InputLabel shrink style={{ marginBottom: 8 }}>Anexar Arquivos (Opcional)</InputLabel>
                                <FileUploader
                                    files={updateFiles}
                                    onFilesChange={setUpdateFiles}
                                    maxFiles={5}
                                    disabled={saving}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                                    onClick={handleSubmit}
                                    disabled={saving}
                                >
                                    Atualizar Protocolo
                                </Button>
                            </Grid>
                        </Grid>
                    </Paper>
                </Grid>

                <Grid item xs={12} md={4}>
                    <Paper className={classes.paper}>
                        <Typography variant="h6" gutterBottom>
                            Histórico
                        </Typography>
                        <List dense>
                            {history.map((item, index) => (
                                <ListItem key={index} className={classes.historyItem}>
                                    <ListItemIcon className={classes.historyIcon}>
                                        {getActionIcon(item.action)}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={
                                            <Box display="flex" flexDirection="column">
                                                <Typography variant="body2" style={{ fontWeight: 600 }}>
                                                    {getActionLabel(item.action)}
                                                </Typography>
                                                {item.previousValue && item.newValue && (
                                                    <Typography variant="caption" display="block">
                                                        {item.previousValue} → {item.newValue}
                                                    </Typography>
                                                )}
                                            </Box>
                                        }
                                        secondary={
                                            <>
                                                {item.comment && (
                                                    <Typography variant="body2" style={{ marginTop: 4, fontStyle: "italic" }}>
                                                        "{item.comment}"
                                                    </Typography>
                                                )}
                                                <Box mt={1}>
                                                    <Typography variant="caption" color="textSecondary" display="block">
                                                        {item.user?.name || "Sistema"}
                                                    </Typography>
                                                    <Typography variant="caption" color="textSecondary" display="block">
                                                        {format(new Date(item.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                                                    </Typography>
                                                </Box>
                                            </>
                                        }
                                    />
                                </ListItem>
                            ))}
                            {history.length === 0 && (
                                <Typography variant="body2" color="textSecondary" align="center">
                                    Sem histórico registrado.
                                </Typography>
                            )}
                        </List>
                    </Paper>
                </Grid>
            </Grid>
        </Container >
    );
};

export default ProtocolDetails;
