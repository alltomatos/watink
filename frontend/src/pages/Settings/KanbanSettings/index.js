import React, { useState, useEffect, useCallback } from "react";
import { toast } from "react-toastify";
import { DragDropContext, Droppable, Draggable } from "react-beautiful-dnd";

import { makeStyles } from "@material-ui/core/styles";
import {
    Box,
    Paper,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    IconButton,
    Button,
    CircularProgress,
    Divider,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
} from "@material-ui/core";
import {
    DragIndicator,
    DeleteOutline,
    Add,
    EditOutlined,
    CheckOutlined,
    CloseOutlined,
    ViewColumnOutlined,
    WarningOutlined,
} from "@material-ui/icons";
import { blue, green, grey, red, amber } from "@material-ui/core/colors";

import MainContainer from "../../../components/MainContainer";
import MainHeader from "../../../components/MainHeader";
import Title from "../../../components/Title";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import { i18n } from "../../../translate/i18n";

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: theme.spacing(2),
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: theme.spacing(3),
        flexWrap: "wrap",
        gap: theme.spacing(2),
    },
    queueSelector: {
        minWidth: 250,
        "& .MuiOutlinedInput-root": {
            borderRadius: 10,
            backgroundColor: "#fff",
        },
    },
    stepsList: {
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(1),
    },
    stepItem: {
        display: "flex",
        alignItems: "center",
        padding: theme.spacing(1.5, 2),
        backgroundColor: "#fff",
        borderRadius: 10,
        border: `1px solid ${grey[200]}`,
        transition: "all 0.2s ease",
        "&:hover": {
            boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            borderColor: blue[200],
        },
    },
    stepItemDragging: {
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        borderColor: blue[400],
    },
    dragHandle: {
        cursor: "grab",
        color: grey[400],
        marginRight: theme.spacing(1),
        "&:active": {
            cursor: "grabbing",
        },
    },
    stepColor: {
        width: 16,
        height: 16,
        borderRadius: 4,
        marginRight: theme.spacing(1.5),
        boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
    },
    stepName: {
        flex: 1,
        fontWeight: 500,
    },
    stepOrder: {
        marginRight: theme.spacing(2),
        color: grey[500],
        fontSize: "0.75rem",
        backgroundColor: grey[100],
        padding: theme.spacing(0.5, 1),
        borderRadius: 4,
    },
    stepActions: {
        display: "flex",
        gap: theme.spacing(0.5),
    },
    addStepContainer: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(2),
        marginTop: theme.spacing(2),
        padding: theme.spacing(2),
        backgroundColor: "#fff",
        borderRadius: 10,
        border: `1px dashed ${grey[300]}`,
    },
    addStepInput: {
        flex: 1,
        "& .MuiOutlinedInput-root": {
            borderRadius: 10,
        },
    },
    colorPicker: {
        width: 40,
        height: 40,
        border: "none",
        borderRadius: 8,
        cursor: "pointer",
        "&::-webkit-color-swatch-wrapper": {
            padding: 0,
        },
        "&::-webkit-color-swatch": {
            borderRadius: 8,
            border: "none",
        },
    },
    addButton: {
        borderRadius: 10,
        textTransform: "none",
        fontWeight: 600,
        background: `linear-gradient(135deg, ${blue[500]} 0%, ${blue[700]} 100%)`,
        boxShadow: "0 4px 12px rgba(33, 150, 243, 0.3)",
        "&:hover": {
            background: `linear-gradient(135deg, ${blue[600]} 0%, ${blue[800]} 100%)`,
        },
    },
    emptyState: {
        textAlign: "center",
        padding: theme.spacing(6),
        color: grey[500],
    },
    emptyIcon: {
        fontSize: 64,
        color: grey[300],
        marginBottom: theme.spacing(2),
    },
    deleteDialog: {
        "& .MuiDialog-paper": {
            borderRadius: 12,
        },
    },
    deleteDialogTitle: {
        backgroundColor: red[50],
        borderBottom: `1px solid ${red[100]}`,
    },
    bindingChip: {
        marginLeft: theme.spacing(1),
        backgroundColor: amber[100],
        color: amber[800],
        fontWeight: 500,
    },
    editInput: {
        width: 200,
        "& .MuiOutlinedInput-root": {
            borderRadius: 8,
        },
    },
}));

const defaultColors = [
    "#2196F3", "#4CAF50", "#FF9800", "#9C27B0",
    "#F44336", "#00BCD4", "#795548", "#607D8B"
];

const KanbanSettings = () => {
    const classes = useStyles();

    const [loading, setLoading] = useState(false);
    const [queues, setQueues] = useState([]);
    const [selectedQueueId, setSelectedQueueId] = useState("");
    const [steps, setSteps] = useState([]);

    // Add step state
    const [newStepName, setNewStepName] = useState("");
    const [newStepColor, setNewStepColor] = useState(defaultColors[0]);
    const [addingStep, setAddingStep] = useState(false);

    // Edit step state
    const [editingStepId, setEditingStepId] = useState(null);
    const [editStepName, setEditStepName] = useState("");

    // Delete dialog state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [stepToDelete, setStepToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    // Load queues on mount
    useEffect(() => {
        const fetchQueues = async () => {
            try {
                const { data } = await api.get("/queue");
                setQueues(data);
                if (data.length > 0) {
                    setSelectedQueueId(data[0].id);
                }
            } catch (err) {
                toastError(err);
            }
        };
        fetchQueues();
    }, []);

    // Load steps when queue changes
    useEffect(() => {
        if (!selectedQueueId) return;

        const fetchSteps = async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/steps?queueId=${selectedQueueId}`);
                // Sort by order
                const sortedSteps = (data || []).sort((a, b) => a.order - b.order);
                setSteps(sortedSteps);
            } catch (err) {
                toastError(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSteps();
    }, [selectedQueueId]);

    const handleQueueChange = (e) => {
        setSelectedQueueId(e.target.value);
        setSteps([]);
    };

    const handleAddStep = async () => {
        if (!newStepName.trim()) {
            toast.warning(i18n.t("kanbanSettings.validation.nameRequired") || "Digite um nome para o step.");
            return;
        }

        setAddingStep(true);
        try {
            const { data } = await api.post("/steps", {
                name: newStepName.trim(),
                color: newStepColor,
                queueId: selectedQueueId,
                order: steps.length + 1,
            });
            setSteps([...steps, data]);
            setNewStepName("");
            setNewStepColor(defaultColors[(steps.length + 1) % defaultColors.length]);
            toast.success(i18n.t("kanbanSettings.toasts.created") || "Step criado com sucesso!");
        } catch (err) {
            toastError(err);
        } finally {
            setAddingStep(false);
        }
    };

    const handleStartEdit = (step) => {
        setEditingStepId(step.id);
        setEditStepName(step.name);
    };

    const handleCancelEdit = () => {
        setEditingStepId(null);
        setEditStepName("");
    };

    const handleSaveEdit = async (stepId) => {
        if (!editStepName.trim()) {
            toast.warning(i18n.t("kanbanSettings.validation.nameRequired") || "Digite um nome para o step.");
            return;
        }

        try {
            await api.put(`/steps/${stepId}`, { name: editStepName.trim() });
            setSteps(steps.map(s => s.id === stepId ? { ...s, name: editStepName.trim() } : s));
            setEditingStepId(null);
            toast.success(i18n.t("kanbanSettings.toasts.updated") || "Step atualizado!");
        } catch (err) {
            toastError(err);
        }
    };

    const handleOpenDeleteDialog = (step) => {
        setStepToDelete(step);
        setDeleteDialogOpen(true);
    };

    const handleDeleteStep = async () => {
        if (!stepToDelete) return;

        setDeleting(true);
        try {
            await api.delete(`/steps/${stepToDelete.id}`);
            setSteps(steps.filter(s => s.id !== stepToDelete.id));
            toast.success(i18n.t("kanbanSettings.toasts.deleted") || "Step excluído com sucesso!");
            setDeleteDialogOpen(false);
        } catch (err) {
            toastError(err);
        } finally {
            setDeleting(false);
            setStepToDelete(null);
        }
    };

    const handleDragEnd = async (result) => {
        if (!result.destination) return;
        if (result.destination.index === result.source.index) return;

        const reorderedSteps = Array.from(steps);
        const [removed] = reorderedSteps.splice(result.source.index, 1);
        reorderedSteps.splice(result.destination.index, 0, removed);

        // Update local state immediately (optimistic UI)
        const updatedSteps = reorderedSteps.map((step, idx) => ({
            ...step,
            order: idx + 1,
        }));
        setSteps(updatedSteps);

        // Send to API
        try {
            await api.put("/steps/reorder", {
                stepIds: updatedSteps.map(s => s.id),
            });
        } catch (err) {
            toastError(err);
            // Revert on error
            setSteps(steps);
        }
    };

    const selectedQueue = queues.find(q => q.id === selectedQueueId);

    return (
        <MainContainer>
            <MainHeader>
                <Title>
                    {i18n.t("kanbanSettings.title") || "Configuração do Kanban"}
                </Title>
            </MainHeader>

            <Box className={classes.root}>
                {/* Header with Queue Selector */}
                <Box className={classes.header}>
                    <FormControl variant="outlined" className={classes.queueSelector}>
                        <InputLabel>{i18n.t("kanbanSettings.queueLabel") || "Selecione uma Fila"}</InputLabel>
                        <Select
                            value={selectedQueueId}
                            onChange={handleQueueChange}
                            label={i18n.t("kanbanSettings.queueLabel") || "Selecione uma Fila"}
                        >
                            {queues.map((queue) => (
                                <MenuItem key={queue.id} value={queue.id}>
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Box
                                            style={{
                                                width: 12,
                                                height: 12,
                                                borderRadius: 3,
                                                backgroundColor: queue.color,
                                            }}
                                        />
                                        {queue.name}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {selectedQueue && (
                        <Typography variant="body2" color="textSecondary">
                            {steps.length} {i18n.t("kanbanSettings.stepsCount") || "steps configurados"}
                        </Typography>
                    )}
                </Box>

                <Divider style={{ marginBottom: 24 }} />

                {/* Steps List */}
                {loading ? (
                    <Box display="flex" justifyContent="center" py={6}>
                        <CircularProgress />
                    </Box>
                ) : !selectedQueueId ? (
                    <Box className={classes.emptyState}>
                        <ViewColumnOutlined className={classes.emptyIcon} />
                        <Typography variant="h6">
                            {i18n.t("kanbanSettings.empty.noQueue") || "Selecione uma fila"}
                        </Typography>
                        <Typography variant="body2">
                            {i18n.t("kanbanSettings.empty.noQueueDescription") || "Escolha uma fila para configurar seus steps do Kanban"}
                        </Typography>
                    </Box>
                ) : steps.length === 0 ? (
                    <Box className={classes.emptyState}>
                        <ViewColumnOutlined className={classes.emptyIcon} />
                        <Typography variant="h6">
                            {i18n.t("kanbanSettings.empty.noSteps") || "Nenhum step configurado"}
                        </Typography>
                        <Typography variant="body2">
                            {i18n.t("kanbanSettings.empty.noStepsDescription") || "Adicione steps para criar seu fluxo de trabalho"}
                        </Typography>
                    </Box>
                ) : (
                    <DragDropContext onDragEnd={handleDragEnd}>
                        <Droppable droppableId="steps-list">
                            {(provided) => (
                                <Box
                                    ref={provided.innerRef}
                                    {...provided.droppableProps}
                                    className={classes.stepsList}
                                >
                                    {steps.map((step, index) => (
                                        <Draggable key={step.id} draggableId={String(step.id)} index={index}>
                                            {(provided, snapshot) => (
                                                <Paper
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    elevation={0}
                                                    className={`${classes.stepItem} ${snapshot.isDragging ? classes.stepItemDragging : ""}`}
                                                >
                                                    <Box {...provided.dragHandleProps} className={classes.dragHandle}>
                                                        <DragIndicator />
                                                    </Box>
                                                    <Box className={classes.stepColor} style={{ backgroundColor: step.color }} />

                                                    {editingStepId === step.id ? (
                                                        <>
                                                            <TextField
                                                                value={editStepName}
                                                                onChange={(e) => setEditStepName(e.target.value)}
                                                                variant="outlined"
                                                                size="small"
                                                                className={classes.editInput}
                                                                autoFocus
                                                                onKeyPress={(e) => e.key === "Enter" && handleSaveEdit(step.id)}
                                                            />
                                                            <Box className={classes.stepActions} style={{ marginLeft: 16 }}>
                                                                <Tooltip title="Salvar">
                                                                    <IconButton size="small" onClick={() => handleSaveEdit(step.id)}>
                                                                        <CheckOutlined fontSize="small" style={{ color: green[500] }} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title="Cancelar">
                                                                    <IconButton size="small" onClick={handleCancelEdit}>
                                                                        <CloseOutlined fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Box>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Typography className={classes.stepName}>{step.name}</Typography>
                                                            {step.isBindingStep && (
                                                                <Chip
                                                                    size="small"
                                                                    label={i18n.t("kanbanSettings.bindingStep") || "Vincular"}
                                                                    className={classes.bindingChip}
                                                                />
                                                            )}
                                                            <Typography className={classes.stepOrder}>#{index + 1}</Typography>
                                                            <Box className={classes.stepActions}>
                                                                <Tooltip title={i18n.t("kanbanSettings.actions.edit") || "Editar"}>
                                                                    <IconButton size="small" onClick={() => handleStartEdit(step)}>
                                                                        <EditOutlined fontSize="small" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                                <Tooltip title={i18n.t("kanbanSettings.actions.delete") || "Excluir"}>
                                                                    <IconButton size="small" onClick={() => handleOpenDeleteDialog(step)}>
                                                                        <DeleteOutline fontSize="small" style={{ color: red[400] }} />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </Box>
                                                        </>
                                                    )}
                                                </Paper>
                                            )}
                                        </Draggable>
                                    ))}
                                    {provided.placeholder}
                                </Box>
                            )}
                        </Droppable>
                    </DragDropContext>
                )}

                {/* Add New Step */}
                {selectedQueueId && (
                    <Box className={classes.addStepContainer}>
                        <input
                            type="color"
                            value={newStepColor}
                            onChange={(e) => setNewStepColor(e.target.value)}
                            className={classes.colorPicker}
                            title={i18n.t("kanbanSettings.colorPicker") || "Escolher cor"}
                        />
                        <TextField
                            placeholder={i18n.t("kanbanSettings.newStepPlaceholder") || "Nome do novo step..."}
                            value={newStepName}
                            onChange={(e) => setNewStepName(e.target.value)}
                            variant="outlined"
                            size="small"
                            className={classes.addStepInput}
                            onKeyPress={(e) => e.key === "Enter" && handleAddStep()}
                        />
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={addingStep ? <CircularProgress size={20} color="inherit" /> : <Add />}
                            onClick={handleAddStep}
                            disabled={addingStep || !newStepName.trim()}
                            className={classes.addButton}
                        >
                            {i18n.t("kanbanSettings.addButton") || "Adicionar Step"}
                        </Button>
                    </Box>
                )}
            </Box>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => !deleting && setDeleteDialogOpen(false)}
                className={classes.deleteDialog}
                maxWidth="xs"
                fullWidth
            >
                <DialogTitle className={classes.deleteDialogTitle}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <WarningOutlined style={{ color: red[500] }} />
                        {i18n.t("kanbanSettings.deleteDialog.title") || "Excluir Step?"}
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Typography style={{ marginTop: 16 }}>
                        {i18n.t("kanbanSettings.deleteDialog.message") ||
                            `Tem certeza que deseja excluir o step "${stepToDelete?.name}"?`}
                    </Typography>
                    <Typography variant="caption" color="textSecondary" style={{ marginTop: 8, display: "block" }}>
                        {i18n.t("kanbanSettings.deleteDialog.warning") ||
                            "Esta ação não pode ser desfeita. Tickets neste step serão desvinculados."}
                    </Typography>
                </DialogContent>
                <DialogActions style={{ padding: 16 }}>
                    <Button
                        onClick={() => setDeleteDialogOpen(false)}
                        variant="outlined"
                        disabled={deleting}
                    >
                        {i18n.t("kanbanSettings.deleteDialog.cancel") || "Cancelar"}
                    </Button>
                    <Button
                        onClick={handleDeleteStep}
                        variant="contained"
                        style={{ backgroundColor: red[500], color: "#fff" }}
                        disabled={deleting}
                        startIcon={deleting ? <CircularProgress size={20} color="inherit" /> : null}
                    >
                        {i18n.t("kanbanSettings.deleteDialog.confirm") || "Excluir"}
                    </Button>
                </DialogActions>
            </Dialog>
        </MainContainer>
    );
};

export default KanbanSettings;
