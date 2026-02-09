import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogActions,
    Button,
    TextField,
    Grid,
    IconButton,
    Typography,
    Box,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Switch,
    FormControlLabel,
    Chip,
    Divider
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import {
    Close as CloseIcon,
    Save as SaveIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    DragHandle as DragHandleIcon,
    RadioButtonChecked as RadioIcon,
    CheckBox as CheckBoxIcon,
    TextFields as TextIcon,
    ArrowDropDownCircle as SelectIcon,
    PhotoCamera as PhotoIcon,
    DateRange as DateIcon,
    Notes as TextareaIcon,
    Dialpad as NumberIcon
} from "@material-ui/icons";
import { toast } from "react-toastify";
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
    sectionTitle: {
        fontWeight: 600,
        marginBottom: theme.spacing(2),
        marginTop: theme.spacing(2),
    },
    itemCard: {
        backgroundColor: "#f9f9fb",
        borderRadius: 12,
        marginBottom: theme.spacing(2),
        padding: theme.spacing(2),
        border: "1px solid #e0e0e0",
        transition: "box-shadow 0.2s",
        "&:hover": {
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }
    },
    typeSelect: {
        minWidth: 180,
        "& .MuiSelect-root": {
            display: "flex",
            alignItems: "center",
            gap: 8
        }
    },
    optionRow: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
        marginTop: theme.spacing(1),
        paddingLeft: theme.spacing(2)
    },
    optionInput: {
        flex: 1
    },
    addOptionBtn: {
        marginTop: theme.spacing(1),
        marginLeft: theme.spacing(2)
    },
    typeIcon: {
        marginRight: 8,
        opacity: 0.7
    }
}));

const INPUT_TYPES = [
    { value: "text", label: "Resposta curta", icon: TextIcon },
    { value: "textarea", label: "Parágrafo", icon: TextareaIcon },
    { value: "radio", label: "Múltipla escolha", icon: RadioIcon },
    { value: "checkbox", label: "Caixa de seleção", icon: CheckBoxIcon },
    { value: "multiselect", label: "Várias opções", icon: CheckBoxIcon },
    { value: "select", label: "Lista suspensa", icon: SelectIcon },
    { value: "photo", label: "Upload de foto", icon: PhotoIcon },
    { value: "number", label: "Número", icon: NumberIcon },
    { value: "date", label: "Data", icon: DateIcon },
];

const TYPES_WITH_OPTIONS = ["radio", "multiselect", "select"];

const TemplateModal = ({ open, onClose, templateId }) => {
    const classes = useStyles();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [template, setTemplate] = useState({
        name: "",
        description: "",
        items: []
    });

    useEffect(() => {
        if (open) {
            if (templateId) {
                loadTemplate(templateId);
            } else {
                setTemplate({
                    name: "",
                    description: "",
                    items: []
                });
            }
        }
    }, [open, templateId]);

    const loadTemplate = async (id) => {
        setLoading(true);
        try {
            const { data } = await activityApi.showTemplate(id);
            setTemplate(data);
        } catch (err) {
            toast.error("Erro ao carregar template");
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!template.name) {
            toast.warning("Nome é obrigatório");
            return;
        }

        // Validar opções para tipos que requerem
        for (const item of template.items) {
            if (TYPES_WITH_OPTIONS.includes(item.inputType)) {
                if (!item.options || item.options.length < 2) {
                    toast.warning(`O item "${item.label || 'Sem título'}" precisa de pelo menos 2 opções`);
                    return;
                }
            }
        }

        setSaving(true);
        try {
            if (templateId) {
                await activityApi.updateTemplate(templateId, template);
            } else {
                await activityApi.createTemplate(template);
            }
            toast.success("Template salvo com sucesso!");
            onClose();
        } catch (err) {
            toast.error("Erro ao salvar template");
        } finally {
            setSaving(false);
        }
    };

    const handleAddItem = () => {
        setTemplate(prev => ({
            ...prev,
            items: [
                ...prev.items,
                {
                    label: "",
                    inputType: "text",
                    isRequired: false,
                    options: []
                }
            ]
        }));
    };

    const handleRemoveItem = (index) => {
        const newItems = template.items.filter((_, i) => i !== index);
        setTemplate(prev => ({ ...prev, items: newItems }));
    };

    const handleChangeItem = (index, field, value) => {
        const newItems = [...template.items];
        newItems[index] = { ...newItems[index], [field]: value };

        // Se mudou o tipo, resetar options se não for tipo com opções
        if (field === "inputType" && !TYPES_WITH_OPTIONS.includes(value)) {
            newItems[index].options = [];
        }
        // Se mudou para tipo com opções e não tem opções, inicializar
        if (field === "inputType" && TYPES_WITH_OPTIONS.includes(value) && (!newItems[index].options || newItems[index].options.length === 0)) {
            newItems[index].options = ["Opção 1"];
        }

        setTemplate(prev => ({ ...prev, items: newItems }));
    };

    const handleAddOption = (itemIndex) => {
        const newItems = [...template.items];
        const options = newItems[itemIndex].options || [];
        options.push(`Opção ${options.length + 1}`);
        newItems[itemIndex].options = options;
        setTemplate(prev => ({ ...prev, items: newItems }));
    };

    const handleChangeOption = (itemIndex, optionIndex, value) => {
        const newItems = [...template.items];
        newItems[itemIndex].options[optionIndex] = value;
        setTemplate(prev => ({ ...prev, items: newItems }));
    };

    const handleRemoveOption = (itemIndex, optionIndex) => {
        const newItems = [...template.items];
        newItems[itemIndex].options = newItems[itemIndex].options.filter((_, i) => i !== optionIndex);
        setTemplate(prev => ({ ...prev, items: newItems }));
    };

    const getTypeIcon = (type) => {
        const found = INPUT_TYPES.find(t => t.value === type);
        if (found) {
            const Icon = found.icon;
            return <Icon fontSize="small" className={classes.typeIcon} />;
        }
        return null;
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            classes={{ paper: classes.dialogPaper }}
        >
            <DialogTitle className={classes.dialogTitle}>
                {templateId ? "Editar Template" : "Novo Template"}
                <IconButton onClick={onClose} size="small"><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent style={{ padding: 24 }}>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <TextField
                            label="Nome do Modelo"
                            fullWidth
                            variant="outlined"
                            value={template.name}
                            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            label="Descrição"
                            fullWidth
                            multiline
                            rows={2}
                            variant="outlined"
                            value={template.description}
                            onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <Box display="flex" justifyContent="space-between" alignItems="center">
                            <Typography className={classes.sectionTitle}>
                                Itens de Checklist
                            </Typography>
                            <Button
                                startIcon={<AddIcon />}
                                size="small"
                                color="primary"
                                variant="outlined"
                                onClick={handleAddItem}
                            >
                                Adicionar Item
                            </Button>
                        </Box>

                        {template.items && template.items.map((item, index) => (
                            <div key={index} className={classes.itemCard}>
                                <Box display="flex" alignItems="flex-start" gap={2}>
                                    <Box flex={1}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            placeholder="Pergunta ou descrição do item..."
                                            value={item.label}
                                            onChange={(e) => handleChangeItem(index, "label", e.target.value)}
                                            variant="outlined"
                                            style={{ marginBottom: 12 }}
                                        />

                                        <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                                            <FormControl variant="outlined" size="small" className={classes.typeSelect}>
                                                <InputLabel>Tipo</InputLabel>
                                                <Select
                                                    value={item.inputType}
                                                    onChange={(e) => handleChangeItem(index, "inputType", e.target.value)}
                                                    label="Tipo"
                                                >
                                                    {INPUT_TYPES.map((type) => {
                                                        const Icon = type.icon;
                                                        return (
                                                            <MenuItem key={type.value} value={type.value}>
                                                                <Icon fontSize="small" style={{ marginRight: 8, opacity: 0.7 }} />
                                                                {type.label}
                                                            </MenuItem>
                                                        );
                                                    })}
                                                </Select>
                                            </FormControl>

                                            <FormControlLabel
                                                control={
                                                    <Switch
                                                        checked={item.isRequired}
                                                        onChange={(e) => handleChangeItem(index, "isRequired", e.target.checked)}
                                                        color="primary"
                                                        size="small"
                                                    />
                                                }
                                                label="Obrigatório"
                                            />

                                            <Box flex={1} />

                                            <IconButton size="small" onClick={() => handleRemoveItem(index)} color="secondary">
                                                <DeleteIcon />
                                            </IconButton>
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Área de opções para tipos de múltipla escolha */}
                                {TYPES_WITH_OPTIONS.includes(item.inputType) && (
                                    <Box mt={2} pl={1}>
                                        <Divider style={{ marginBottom: 12 }} />
                                        <Typography variant="caption" color="textSecondary" style={{ marginBottom: 8, display: 'block' }}>
                                            Opções de resposta:
                                        </Typography>
                                        {(item.options || []).map((option, optIndex) => (
                                            <div key={optIndex} className={classes.optionRow}>
                                                {item.inputType === 'radio' && <RadioIcon fontSize="small" color="disabled" />}
                                                {item.inputType === 'multiselect' && <CheckBoxIcon fontSize="small" color="disabled" />}
                                                {item.inputType === 'select' && <Typography variant="body2" color="textSecondary">{optIndex + 1}.</Typography>}
                                                <TextField
                                                    size="small"
                                                    variant="standard"
                                                    placeholder={`Opção ${optIndex + 1}`}
                                                    value={option}
                                                    onChange={(e) => handleChangeOption(index, optIndex, e.target.value)}
                                                    className={classes.optionInput}
                                                />
                                                <IconButton size="small" onClick={() => handleRemoveOption(index, optIndex)}>
                                                    <CloseIcon fontSize="small" />
                                                </IconButton>
                                            </div>
                                        ))}
                                        <Button
                                            size="small"
                                            color="primary"
                                            startIcon={<AddIcon />}
                                            onClick={() => handleAddOption(index)}
                                            className={classes.addOptionBtn}
                                        >
                                            Adicionar opção
                                        </Button>
                                    </Box>
                                )}
                            </div>
                        ))}

                        {(!template.items || template.items.length === 0) && (
                            <Box
                                p={4}
                                textAlign="center"
                                bgcolor="#f5f5f5"
                                borderRadius={8}
                                border="2px dashed #e0e0e0"
                            >
                                <Typography color="textSecondary">
                                    Nenhum item adicionado. Clique em "Adicionar Item" para começar.
                                </Typography>
                            </Box>
                        )}
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions style={{ padding: 16 }}>
                <Button onClick={onClose}>Cancelar</Button>
                <Button
                    color="primary"
                    variant="contained"
                    onClick={handleSave}
                    disabled={saving}
                    startIcon={<SaveIcon />}
                >
                    Salvar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default TemplateModal;
