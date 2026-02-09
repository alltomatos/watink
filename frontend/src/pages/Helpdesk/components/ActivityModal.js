import React, { useState, useEffect, useRef } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogActions,
    Button,
    TextField,
    Grid,
    Typography,
    Box,
    Tabs,
    Tab,
    Checkbox,
    FormControlLabel,
    IconButton,
    CircularProgress,
    List,
    ListItem,
    MenuItem,
    Select,
    InputLabel,
    FormControl,
    Avatar
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import {
    Close as CloseIcon,
    CameraAlt as CameraIcon,
    Assignment as ChecklistIcon,
    Assignment as AssignmentIcon,
    Build as MaterialsIcon,
    Create as SignatureIcon,
    Save as SaveIcon,
    CheckCircle as CheckCircleIcon,
    Delete as DeleteIcon,
    Add as AddIcon
} from "@material-ui/icons";
import { toast } from "react-toastify";
import SignatureCanvas from "react-signature-canvas";

import activityApi from "../../../services/activityApi";

const useStyles = makeStyles((theme) => ({
    dialogPaper: {
        borderRadius: 16,
        padding: theme.spacing(1),
    },
    dialogTitle: {
        borderBottom: "1px solid rgba(0,0,0,0.05)",
        paddingBottom: theme.spacing(2),
        "& h2": {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: 700,
        }
    },
    tabRoot: {
        borderBottom: "1px solid rgba(0,0,0,0.1)",
        marginBottom: theme.spacing(3),
    },
    tabIndicator: {
        backgroundColor: theme.palette.primary.main,
        height: 3,
        borderRadius: "3px 3px 0 0",
    },
    tabItem: {
        textTransform: "none",
        fontWeight: 600,
        fontSize: "0.95rem",
        minWidth: 100,
    },
    sectionTitle: {
        fontWeight: 600,
        fontSize: "1rem",
        marginBottom: theme.spacing(2),
        color: theme.palette.text.primary,
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
    },
    itemCard: {
        backgroundColor: "#f8f9fa",
        borderRadius: 8,
        padding: theme.spacing(2),
        marginBottom: theme.spacing(1),
        border: "1px solid #eee",
        transition: "all 0.2s",
        "&:hover": {
            borderColor: theme.palette.primary.main,
            backgroundColor: "#fff",
            boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
        }
    },
    photoPreview: {
        width: "100%",
        height: 150,
        objectFit: "cover",
        borderRadius: 8,
        marginTop: theme.spacing(1),
        cursor: "pointer",
        border: "2px dashed #ccc",
    },
    signaturePad: {
        border: "1px solid #ddd",
        borderRadius: 8,
        width: "100%",
        height: 200,
        backgroundColor: "#fff",
    },
    templateCard: {
        cursor: "pointer",
        padding: theme.spacing(3),
        borderRadius: 12,
        border: "1px solid #e0e0e0",
        textAlign: "center",
        transition: "all 0.2s",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        "&:hover": {
            borderColor: theme.palette.primary.main,
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            transform: "translateY(-2px)",
        }
    },
    actionButton: {
        borderRadius: 8,
        textTransform: "none",
        padding: "8px 24px",
        fontWeight: 600,
    }
}));

const ActivityModal = ({ open, onClose, activityId, protocolId }) => {
    const classes = useStyles();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [step, setStep] = useState(activityId ? "details" : "template"); // template, details
    const [activeTab, setActiveTab] = useState(0);
    const [activity, setActivity] = useState(null);
    const [templates, setTemplates] = useState([]);

    // Signatures
    const clientSigRef = useRef({});
    const techSigRef = useRef({});

    useEffect(() => {
        if (open) {
            if (activityId) {
                setStep("details");
                loadActivity(activityId);
            } else {
                setStep("template");
                setActivity({
                    title: "",
                    description: "",
                    items: [],
                    materials: [],
                    protocolId,
                });
                loadTemplates();
            }
        } else {
            setActivity(null);
        }
    }, [open, activityId, protocolId]);

    const loadActivity = async (id) => {
        setLoading(true);
        try {
            const { data } = await activityApi.show(id);
            setActivity(data);
        } catch (err) {
            toast.error("Erro ao carregar atividade");
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const loadTemplates = async () => {
        try {
            const { data } = await activityApi.listTemplates({ showInactive: false });
            setTemplates(data.templates);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSelectTemplate = (template) => {
        let items = [];
        if (template && template.items) {
            items = template.items.map(i => ({
                label: i.label,
                inputType: i.inputType,
                isRequired: i.isRequired,
                order: i.order,
                value: "",
                isDone: false
            }));
        }

        setActivity(prev => ({
            ...prev,
            title: template ? template.name : "",
            description: template ? template.description : "",
            templateId: template ? template.id : null,
            items
        }));
        setStep("details");
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            let savedActivity;
            if (activity.id) {
                await activityApi.update(activity.id, {
                    title: activity.title,
                    description: activity.description,
                    status: activity.status,
                    items: activity.items, // Send items for Smart Sync
                    assignedUserId: activity.assignedUserId
                });
                savedActivity = activity;
            } else {
                const { data } = await activityApi.create(activity);
                savedActivity = data;
            }

            setActivity(savedActivity);
            toast.success("Salvo com sucesso!");
            if (!activityId) {
                // If created new, stay in modal but allow editing logic now
                setStep("details");
            } else {
                onClose();
            }
        } catch (err) {
            toast.error("Erro ao salvar");
        } finally {
            setSaving(false);
        }
    };

    const handleChangeItem = async (index, field, value) => {
        const newItems = [...activity.items];
        newItems[index] = { ...newItems[index], [field]: value };
        setActivity(prev => ({ ...prev, items: newItems }));

        // Only auto-save values/checks if the item itself is already saved (has ID)
        if (activity.id && newItems[index].id && (field === 'isDone' || field === 'value')) {
            try {
                await activityApi.updateItem(activity.id, newItems[index].id, {
                    [field]: value
                });
            } catch (err) { console.error(err); }
        }
    };

    const handleAddItem = () => {
        setActivity(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    label: "",
                    inputType: "checkbox",
                    isRequired: false,
                    value: "",
                    isDone: false
                }
            ]
        }));
    };

    const handleRemoveItem = async (index) => {
        const itemToRemove = activity.items[index];
        // If item has ID, we might need to delete it from backend?
        // For now, simpler: user saves the whole activity to sync? 
        // Or if we want to support instant delete:
        // await activityApi.removeItem(activity.id, itemToRemove.id) (if backend supports)

        // Current backend likely doesn't have partial update for items removal in the 'update' payload?
        // We will just update local state and let 'handleSave' sync everything.
        // NOTE: The backend 'update' method needs to handle full items replacement or we need logic.

        const newItems = activity.items.filter((_, i) => i !== index);
        setActivity(prev => ({ ...prev, items: newItems }));
    };


    const handleUploadPhoto = async (index, file) => {
        if (!activity.id) {
            toast.warning("Salve a atividade antes de enviar fotos.");
            return;
        }

        const item = activity.items[index];
        const loadingToast = toast.info("Enviando foto...", { autoClose: false });

        try {
            const { data } = await activityApi.uploadPhoto(activity.id, item.id, file);

            const newItems = [...activity.items];
            newItems[index] = { ...newItems[index], value: data.photoUrl, isDone: true };
            setActivity(prev => ({ ...prev, items: newItems }));

            toast.dismiss(loadingToast);
            toast.success("Foto enviada!");
        } catch (err) {
            toast.dismiss(loadingToast);
            toast.error("Erro ao enviar foto");
        }
    };

    const handleFinalize = async () => {
        if (!clientSigRef.current.isEmpty && clientSigRef.current.isEmpty()) {
            toast.warning("Assinatura do cliente é obrigatória");
            return;
        }

        const clientSig = clientSigRef.current.toDataURL();
        const techSig = techSigRef.current.toDataURL ? techSigRef.current.toDataURL() : "";

        setSaving(true);
        try {
            await activityApi.finalize(activity.id, {
                clientSignature: clientSig,
                technicianSignature: techSig
            });
            toast.success("Atividade Finalizada!");
            onClose();
        } catch (err) {
            toast.error("Erro ao finalizar");
        } finally {
            setSaving(false);
        }
    };

    const renderTemplateSelection = () => (
        <Grid container spacing={3} style={{ padding: 24 }}>
            <Grid item xs={12} sm={6} md={4}>
                <div onClick={() => handleSelectTemplate(null)} className={classes.templateCard}>
                    <AssignmentIcon style={{ fontSize: 40, color: "#999", marginBottom: 16 }} />
                    <Typography variant="h6">Em Branco</Typography>
                    <Typography variant="body2" color="textSecondary">Começar do zero</Typography>
                </div>
            </Grid>
            {templates.map(t => (
                <Grid item xs={12} sm={6} md={4} key={t.id}>
                    <div onClick={() => handleSelectTemplate(t)} className={classes.templateCard}>
                        <ChecklistIcon style={{ fontSize: 40, color: "#1976d2", marginBottom: 16 }} />
                        <Typography variant="h6">{t.name}</Typography>
                        <Typography variant="body2" color="textSecondary">
                            {t.items?.length || 0} itens
                        </Typography>
                    </div>
                </Grid>
            ))}
        </Grid>
    );

    const renderDetails = () => (
        <>
            <Tabs
                value={activeTab}
                onChange={(e, v) => setActiveTab(v)}
                classes={{ root: classes.tabRoot, indicator: classes.tabIndicator }}
            >
                <Tab label="Dados Principais" className={classes.tabItem} />
                <Tab label="Checklist" className={classes.tabItem} />
                <Tab label="Assinaturas" className={classes.tabItem} disabled={!activity.id} />
            </Tabs>

            {activeTab === 0 && (
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField
                            label="Título da Atividade"
                            fullWidth
                            variant="outlined"
                            value={activity.title || ""}
                            onChange={(e) => setActivity(prev => ({ ...prev, title: e.target.value }))}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            label="Descrição"
                            fullWidth
                            multiline
                            rows={4}
                            variant="outlined"
                            value={activity.description || ""}
                            onChange={(e) => setActivity(prev => ({ ...prev, description: e.target.value }))}
                        />
                    </Grid>
                </Grid>
            )}

            {activeTab === 1 && (
                <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Typography className={classes.sectionTitle} style={{ marginBottom: 0 }}>
                            <ChecklistIcon color="primary" fontSize="small" /> Itens de Verificação
                        </Typography>
                        <Button
                            startIcon={<AddIcon />}
                            size="small"
                            color="primary"
                            onClick={handleAddItem}
                        >
                            Adicionar Item
                        </Button>
                    </Box>

                    {activity.items && activity.items.map((item, index) => (
                        <div key={index} className={classes.itemCard}>
                            <Grid container alignItems="center" spacing={2}>
                                <Grid item xs={1}>
                                    <Checkbox
                                        checked={item.isDone}
                                        onChange={(e) => handleChangeItem(index, "isDone", e.target.checked)}
                                        color="primary"
                                    />
                                </Grid>
                                <Grid item xs={6}>
                                    <TextField
                                        fullWidth
                                        value={item.label}
                                        onChange={(e) => handleChangeItem(index, "label", e.target.value)}
                                        placeholder="Descrição do item"
                                        InputProps={{
                                            disableUnderline: true,
                                            style: { fontWeight: 500, textDecoration: item.isDone ? "line-through" : "none" }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={2}>
                                    <Select
                                        value={item.inputType}
                                        onChange={(e) => handleChangeItem(index, "inputType", e.target.value)}
                                        fullWidth
                                        disableUnderline
                                        style={{ fontSize: "0.85rem", color: "#666" }}
                                    >
                                        <MenuItem value="checkbox">Checkbox</MenuItem>
                                        <MenuItem value="text">Texto</MenuItem>
                                        <MenuItem value="photo">Foto</MenuItem>
                                        <MenuItem value="number">Número</MenuItem>
                                    </Select>
                                </Grid>
                                <Grid item xs={2}>
                                    {item.inputType === "text" && (
                                        <TextField
                                            fullWidth
                                            size="small"
                                            placeholder="Observação"
                                            value={item.value || ""}
                                            onChange={(e) => handleChangeItem(index, "value", e.target.value)}
                                        />
                                    )}
                                    {item.inputType === "photo" && (
                                        <Box>
                                            <input
                                                accept="image/*"
                                                style={{ display: "none" }}
                                                id={`icon-button-file-${index}`}
                                                type="file"
                                                onChange={(e) => handleUploadPhoto(index, e.target.files[0])}
                                            />
                                            <label htmlFor={`icon-button-file-${index}`}>
                                                <Button variant="outlined" component="span" size="small" fullWidth startIcon={<CameraIcon />}>
                                                    Foto
                                                </Button>
                                            </label>
                                            {item.value && (
                                                <img
                                                    src={item.value}
                                                    alt="Preview"
                                                    className={classes.photoPreview}
                                                    onClick={() => window.open(item.value, "_blank")}
                                                />
                                            )}
                                        </Box>
                                    )}
                                </Grid>
                                <Grid item xs={1}>
                                    <IconButton size="small" onClick={() => handleRemoveItem(index)}>
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Grid>
                            </Grid>
                        </div>
                    ))}
                    {(!activity.items || activity.items.length === 0) && (
                        <Typography variant="body2" color="textSecondary" align="center" style={{ padding: 24 }}>
                            Esta atividade não possui itens de checklist. Adicione um novo item acima.
                        </Typography>
                    )}
                </Box>
            )}

            {activeTab === 2 && (
                <Box>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Typography className={classes.sectionTitle}>Assinatura do Técnico</Typography>
                            <Box className={classes.signaturePad}>
                                <SignatureCanvas
                                    penColor="black"
                                    canvasProps={{ className: classes.signaturePad }}
                                    ref={techSigRef}
                                />
                            </Box>
                            <Button size="small" onClick={() => techSigRef.current.clear()}>Limpar</Button>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography className={classes.sectionTitle}>Assinatura do Cliente</Typography>
                            <Box className={classes.signaturePad}>
                                <SignatureCanvas
                                    penColor="black"
                                    canvasProps={{ className: classes.signaturePad }}
                                    ref={clientSigRef}
                                />
                            </Box>
                            <Button size="small" onClick={() => clientSigRef.current.clear()}>Limpar</Button>
                        </Grid>
                    </Grid>
                </Box>
            )}
        </>
    );

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            classes={{ paper: classes.dialogPaper }}
        >
            <DialogTitle className={classes.dialogTitle}>
                {activityId ? "Editar Atividade" : "Nova Atividade"}
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent style={{ padding: 24, minHeight: 400 }}>
                {loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" height="100%">
                        <CircularProgress />
                    </Box>
                ) : (
                    step === "template" ? renderTemplateSelection() : (activity && renderDetails())
                )}
            </DialogContent>
            {step === "details" && activity && (
                <DialogActions style={{ padding: 16 }}>
                    <Button onClick={onClose} color="default">
                        Cancelar
                    </Button>
                    {activeTab === 2 ? (
                        <Button
                            onClick={handleFinalize}
                            color="primary"
                            variant="contained"
                            disabled={saving}
                            className={classes.actionButton}
                            startIcon={<CheckCircleIcon />}
                        >
                            Finalizar e Assinar
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSave}
                            color="primary"
                            variant="contained"
                            disabled={saving}
                            className={classes.actionButton}
                            startIcon={<SaveIcon />}
                        >
                            {activity.id ? "Salvar Alterações" : "Criar Atividade"}
                        </Button>
                    )}
                </DialogActions>
            )}
        </Dialog>
    );
};

export default ActivityModal;
