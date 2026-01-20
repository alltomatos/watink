import React, { useState, useEffect } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Box,
    Divider,
    CircularProgress,
    Tabs,
    Tab,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Chip,
} from "@material-ui/core";
import {
    Timeline,
    Create as CreateIcon,
    Update as UpdateIcon,
    Comment as CommentIcon,
    CheckCircle as CheckCircleIcon,
} from "@material-ui/icons";
import Autocomplete from "@material-ui/lab/Autocomplete";
import { makeStyles } from "@material-ui/core/styles";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
    form: {
        minWidth: 600,
    },
    section: {
        marginTop: theme.spacing(2),
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
    commentBox: {
        marginTop: theme.spacing(2),
    },
}));

const ProtocolModal = ({ open, onClose }) => {
    const classes = useStyles();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        subject: "",
        description: "",
        status: "open",
        priority: "medium",
        category: "",
        contactId: null,
    });
    const [selectedContact, setSelectedContact] = useState(null);
    const [contactOptions, setContactOptions] = useState([]);
    const [contactLoading, setContactLoading] = useState(false);
    const [contactSearch, setContactSearch] = useState("");

    // Helpdesk Settings
    const [helpdeskEnabled, setHelpdeskEnabled] = useState(false);
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await api.get("/settings");
                const settingsData = Array.isArray(data) ? data : [];

                const enabledSetting = settingsData.find(s => s.key === "helpdesk_settings_enabled");
                const isEnabled = enabledSetting?.value === "true";
                setHelpdeskEnabled(isEnabled);

                if (isEnabled) {
                    const categoriesSetting = settingsData.find(s => s.key === "helpdesk_categories");
                    if (categoriesSetting) {
                        try {
                            setCategories(JSON.parse(categoriesSetting.value));
                        } catch (e) {
                            setCategories(["Incidente", "Requisição de Serviço", "Problema", "Mudança"]);
                        }
                    } else {
                        setCategories(["Incidente", "Requisição de Serviço", "Problema", "Mudança"]);
                    }
                }
            } catch (err) {
                console.error("Error fetching settings", err);
            }
        };
        fetchSettings();
    }, [open]);

    useEffect(() => {
        if (!open) {
            setFormData({
                subject: "",
                description: "",
                status: "open",
                priority: "medium",
                category: "",
                contactId: null,
            });
            setSelectedContact(null);
            setContactSearch("");
            setContactOptions([]);
        }
    }, [open]);

    useEffect(() => {
        if (!contactSearch || contactSearch.length < 3) {
            setContactLoading(false);
            return;
        }

        const delayDebounceFn = setTimeout(async () => {
            setContactLoading(true);
            try {
                const { data } = await api.get("contacts", {
                    params: { searchParam: contactSearch },
                });
                setContactOptions(data.contacts);
            } catch (err) {
                toast.error("Erro ao buscar contatos");
            } finally {
                setContactLoading(false);
            }
        }, 500);

        return () => clearTimeout(delayDebounceFn);
    }, [contactSearch]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleContactChange = (e, newValue) => {
        setSelectedContact(newValue);
        setFormData(prev => ({ ...prev, contactId: newValue ? newValue.id : null }));
    };

    const handleSubmit = async () => {
        if (!formData.subject.trim()) {
            toast.error("Assunto é obrigatório");
            return;
        }

        if (!formData.contactId) {
            toast.error("Contato é obrigatório");
            return;
        }

        try {
            setLoading(true);
            await api.post("/protocols", formData);
            toast.success("Protocolo criado com sucesso");
            onClose();
        } catch (err) {
            toast.error("Erro ao criar protocolo");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Novo Protocolo</DialogTitle>
            <DialogContent className={classes.form}>
                <Box mt={1}>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <Autocomplete
                                options={contactOptions}
                                loading={contactLoading}
                                getOptionLabel={(option) => option.name}
                                onChange={handleContactChange}
                                onInputChange={(e, newInputValue) => setContactSearch(newInputValue)}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Contato"
                                        variant="outlined"
                                        size="small"
                                        fullWidth
                                        required
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <React.Fragment>
                                                    {contactLoading ? <CircularProgress color="inherit" size={20} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </React.Fragment>
                                            ),
                                        }}
                                    />
                                )}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                name="subject"
                                label="Assunto"
                                value={formData.subject}
                                onChange={handleChange}
                                variant="outlined"
                                size="small"
                                fullWidth
                                required
                            />
                        </Grid>
                        <Grid item xs={12} sm={helpdeskEnabled ? 6 : 12}>
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
                        {helpdeskEnabled && (
                            <Grid item xs={12} sm={6}>
                                {categories.length > 0 ? (
                                    <FormControl variant="outlined" fullWidth size="small">
                                        <InputLabel>Categoria</InputLabel>
                                        <Select
                                            name="category"
                                            value={formData.category}
                                            onChange={handleChange}
                                            label="Categoria"
                                        >
                                            {categories.map((cat) => (
                                                <MenuItem key={cat} value={cat}>
                                                    {cat}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                ) : (
                                    <TextField
                                        name="category"
                                        label="Categoria"
                                        value={formData.category}
                                        onChange={handleChange}
                                        variant="outlined"
                                        size="small"
                                        fullWidth
                                    />
                                )}
                            </Grid>
                        )}
                        <Grid item xs={12}>
                            <TextField
                                name="description"
                                label="Descrição"
                                value={formData.description}
                                onChange={handleChange}
                                variant="outlined"
                                size="small"
                                fullWidth
                                multiline
                                rows={4}
                            />
                        </Grid>
                    </Grid>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSubmit}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={20} /> : "Criar Protocolo"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ProtocolModal;
