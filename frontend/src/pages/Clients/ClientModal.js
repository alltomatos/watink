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
    IconButton,
    Box,
    Divider,
    CircularProgress,
    Tabs,
    Tab,
} from "@material-ui/core";
import { Autocomplete } from "@material-ui/lab";
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Search as SearchIcon, // Import SearchIcon
} from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
    form: {
        minWidth: 600,
    },
    section: {
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(2),
    },
    sectionHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: theme.spacing(1),
    },
    itemCard: {
        padding: theme.spacing(2),
        marginBottom: theme.spacing(1),
        backgroundColor: theme.palette.grey[50],
        borderRadius: theme.shape.borderRadius,
        position: "relative",
    },
    deleteBtn: {
        position: "absolute",
        top: 4,
        right: 4,
    },
}));

const emptyContact = {
    name: "",
    role: "",
    phone: "",
    email: "",
    isPrimary: false,
    contactId: null,
};

const emptyAddress = {
    label: "",
    zipCode: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    isPrimary: false,
};

const ClientModal = ({ open, onClose, client, initialContact }) => {
    const classes = useStyles();
    const [loading, setLoading] = useState(false);
    const [tab, setTab] = useState(0);
    const [formData, setFormData] = useState({
        type: "pf",
        name: "",
        document: "",
        email: "",
        phone: "",
        notes: "",
        contacts: [],
        addresses: [],
    });

    const [contactOptions, setContactOptions] = useState([]);
    const [loadingContacts, setLoadingContacts] = useState(false);
    const searchTimeoutRef = React.useRef(null);

    const fetchContacts = (inputValue) => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }

        if (!inputValue) {
            setContactOptions([]);
            return;
        }

        searchTimeoutRef.current = setTimeout(async () => {
            setLoadingContacts(true);
            try {
                const { data } = await api.get("/contacts", {
                    params: { searchParam: inputValue }
                });
                setContactOptions(data.contacts);
            } catch (err) {
                console.error(err);
            } finally {
                setLoadingContacts(false);
            }
        }, 500);
    };

    useEffect(() => {
        if (client) {
            setFormData({
                type: client.type || "pf",
                name: client.name || "",
                document: client.document || "",
                email: client.email || "",
                phone: client.phone || "",
                notes: client.notes || "",
                contacts: client.contacts || [],
                addresses: client.addresses || [],
            });
        } else {
            const initialContacts = initialContact ? [{
                name: initialContact.name,
                role: "",
                phone: initialContact.number,
                email: initialContact.email || "",
                isPrimary: true,
                contactId: initialContact.id
            }] : [];

            setFormData({
                type: "pf",
                name: initialContact ? initialContact.name : "", // Prefill name too? Maybe.
                document: "",
                email: initialContact ? initialContact.email : "",
                phone: initialContact ? initialContact.number : "",
                notes: "",
                contacts: initialContacts,
                addresses: [],
            });
        }
        setTab(0);
    }, [client, open, initialContact]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleAddExistingContact = () => {
        setFormData((prev) => ({
            ...prev,
            contacts: [...prev.contacts, { ...emptyContact, isNew: false }],
        }));
    };

    const handleAddNewContact = () => {
        setFormData((prev) => ({
            ...prev,
            contacts: [...prev.contacts, { ...emptyContact, isNew: true }],
        }));
    };

    const handleContactChange = (index, field, value) => {
        const newContacts = [...formData.contacts];
        newContacts[index][field] = value;
        setFormData((prev) => ({ ...prev, contacts: newContacts }));
    };

    const handleRemoveContact = (index) => {
        const newContacts = formData.contacts.filter((_, i) => i !== index);
        setFormData((prev) => ({ ...prev, contacts: newContacts }));
    };

    const handleAddAddress = () => {
        setFormData((prev) => ({
            ...prev,
            addresses: [...prev.addresses, { ...emptyAddress }],
        }));
    };

    const handleAddressChange = (index, field, value) => {
        const newAddresses = [...formData.addresses];
        newAddresses[index][field] = value;
        setFormData((prev) => ({ ...prev, addresses: newAddresses }));
    };

    const handleRemoveAddress = (index) => {
        const newAddresses = formData.addresses.filter((_, i) => i !== index);
        setFormData((prev) => ({ ...prev, addresses: newAddresses }));
    };

    const handleCepBlur = async (index) => {
        const cep = formData.addresses[index]?.zipCode?.replace(/\D/g, "");
        if (cep?.length !== 8) return;

        try {
            const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
            const data = await response.json();

            if (data.erro) {
                toast.error("CEP não encontrado");
                return;
            }

            const newAddresses = [...formData.addresses];
            newAddresses[index] = {
                ...newAddresses[index],
                street: data.logradouro || "",
                neighborhood: data.bairro || "",
                city: data.localidade || "",
                state: data.uf || "",
            };
            setFormData((prev) => ({ ...prev, addresses: newAddresses }));
        } catch (err) {
            toast.error("Erro ao consultar CEP");
        }
    };

    const handleSubmit = async () => {
        if (!formData.name.trim()) {
            toast.error("Nome é obrigatório");
            return;
        }

        try {
            setLoading(true);
            if (client) {
                await api.put(`/clients/${client.id}`, formData);
                toast.success("Cliente atualizado com sucesso");
            } else {
                await api.post("/clients", formData);
                toast.success("Cliente criado com sucesso");
            }
            onClose();
        } catch (err) {
            toast.error("Erro ao salvar cliente");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>{client ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
            <DialogContent className={classes.form}>
                <Tabs value={tab} onChange={(e, v) => setTab(v)} indicatorColor="primary">
                    <Tab label="Dados Básicos" />
                    <Tab label={`Contatos (${formData.contacts.length})`} />
                    <Tab label={`Endereços (${formData.addresses.length})`} />
                </Tabs>

                {tab === 0 && (
                    <Box mt={2}>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={4}>
                                <FormControl variant="outlined" fullWidth size="small">
                                    <InputLabel>Tipo</InputLabel>
                                    <Select
                                        name="type"
                                        value={formData.type}
                                        onChange={handleChange}
                                        label="Tipo"
                                    >
                                        <MenuItem value="pf">Pessoa Física</MenuItem>
                                        <MenuItem value="pj">Pessoa Jurídica</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={8}>
                                <TextField
                                    name="name"
                                    label="Nome / Razão Social"
                                    value={formData.name}
                                    onChange={handleChange}
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    name="document"
                                    label={formData.type === "pf" ? "CPF" : "CNPJ"}
                                    value={formData.document}
                                    onChange={handleChange}
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    name="email"
                                    label="Email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    name="phone"
                                    label="Telefone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    name="notes"
                                    label="Observações"
                                    value={formData.notes}
                                    onChange={handleChange}
                                    variant="outlined"
                                    size="small"
                                    fullWidth
                                    multiline
                                    rows={3}
                                />
                            </Grid>
                        </Grid>
                    </Box>
                )}

                {tab === 1 && (
                    <Box mt={2}>
                        <Box className={classes.sectionHeader}>
                            <Typography variant="subtitle1">Contatos Vinculados</Typography>
                            <Box>
                                <Button
                                    size="small"
                                    startIcon={<SearchIcon />} // Need to import SearchIcon
                                    onClick={handleAddExistingContact}
                                    style={{ marginRight: 8 }}
                                >
                                    Vincular Existente
                                </Button>
                                <Button
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={handleAddNewContact}
                                >
                                    Adicionar Novo
                                </Button>
                            </Box>
                        </Box>
                        {formData.contacts.length === 0 ? (
                            <Typography variant="body2" color="textSecondary">
                                Nenhum contato adicionado
                            </Typography>
                        ) : (
                            formData.contacts.map((contact, index) => (
                                <Box key={index} className={classes.itemCard}>
                                    <IconButton
                                        size="small"
                                        className={classes.deleteBtn}
                                        onClick={() => handleRemoveContact(index)}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            {!contact.isNew ? (
                                                <Autocomplete
                                                    freeSolo
                                                    options={contactOptions}
                                                    getOptionLabel={(option) => option.name || ""}
                                                    onChange={(e, value) => {
                                                        if (typeof value === 'string') {
                                                            handleContactChange(index, "name", value);
                                                            handleContactChange(index, "contactId", null);
                                                        } else if (value && value.id) {
                                                            const newContacts = [...formData.contacts];
                                                            newContacts[index] = {
                                                                ...newContacts[index],
                                                                contactId: value.id,
                                                                name: value.name,
                                                                phone: value.number,
                                                                email: value.email
                                                            };
                                                            setFormData(prev => ({ ...prev, contacts: newContacts }));
                                                        } else {
                                                            handleContactChange(index, "name", "");
                                                            handleContactChange(index, "contactId", null);
                                                        }
                                                    }}
                                                    onInputChange={(e, newInputValue, reason) => {
                                                        handleContactChange(index, "name", newInputValue);
                                                        if (reason === 'input') {
                                                            fetchContacts(newInputValue);
                                                        }
                                                    }}
                                                    inputValue={contact.name}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label="Buscar Contato"
                                                            variant="outlined"
                                                            size="small"
                                                            fullWidth
                                                            InputProps={{
                                                                ...params.InputProps,
                                                                endAdornment: (
                                                                    <React.Fragment>
                                                                        {loadingContacts ? <CircularProgress color="inherit" size={20} /> : null}
                                                                        {params.InputProps.endAdornment}
                                                                    </React.Fragment>
                                                                ),
                                                            }}
                                                        />
                                                    )}
                                                />
                                            ) : (
                                                <TextField
                                                    label="Nome"
                                                    value={contact.name}
                                                    onChange={(e) => handleContactChange(index, "name", e.target.value)}
                                                    variant="outlined"
                                                    size="small"
                                                    fullWidth
                                                />
                                            )}
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                label="Cargo/Função"
                                                value={contact.role}
                                                onChange={(e) => handleContactChange(index, "role", e.target.value)}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                label="Telefone"
                                                value={contact.phone}
                                                onChange={(e) => handleContactChange(index, "phone", e.target.value)}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                label="Email"
                                                value={contact.email}
                                                onChange={(e) => handleContactChange(index, "email", e.target.value)}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                    </Grid>
                                </Box>
                            ))
                        )}
                    </Box>
                )}

                {tab === 2 && (
                    <Box mt={2}>
                        <Box className={classes.sectionHeader}>
                            <Typography variant="subtitle1">Endereços</Typography>
                            <Button
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={handleAddAddress}
                            >
                                Adicionar
                            </Button>
                        </Box>
                        {formData.addresses.length === 0 ? (
                            <Typography variant="body2" color="textSecondary">
                                Nenhum endereço adicionado
                            </Typography>
                        ) : (
                            formData.addresses.map((address, index) => (
                                <Box key={index} className={classes.itemCard}>
                                    <IconButton
                                        size="small"
                                        className={classes.deleteBtn}
                                        onClick={() => handleRemoveAddress(index)}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={4}>
                                            <TextField
                                                label="Rótulo (ex: Sede)"
                                                value={address.label}
                                                onChange={(e) => handleAddressChange(index, "label", e.target.value)}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <TextField
                                                label="CEP"
                                                value={address.zipCode}
                                                onChange={(e) => handleAddressChange(index, "zipCode", e.target.value)}
                                                onBlur={() => handleCepBlur(index)}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                                placeholder="00000-000"
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <TextField
                                                label="Número"
                                                value={address.number}
                                                onChange={(e) => handleAddressChange(index, "number", e.target.value)}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={8}>
                                            <TextField
                                                label="Logradouro"
                                                value={address.street}
                                                onChange={(e) => handleAddressChange(index, "street", e.target.value)}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <TextField
                                                label="Complemento"
                                                value={address.complement}
                                                onChange={(e) => handleAddressChange(index, "complement", e.target.value)}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <TextField
                                                label="Bairro"
                                                value={address.neighborhood}
                                                onChange={(e) => handleAddressChange(index, "neighborhood", e.target.value)}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <TextField
                                                label="Cidade"
                                                value={address.city}
                                                onChange={(e) => handleAddressChange(index, "city", e.target.value)}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <TextField
                                                label="Estado"
                                                value={address.state}
                                                onChange={(e) => handleAddressChange(index, "state", e.target.value)}
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                            />
                                        </Grid>
                                    </Grid>
                                </Box>
                            ))
                        )}
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancelar</Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSubmit}
                    disabled={loading}
                >
                    {loading ? <CircularProgress size={20} /> : "Salvar"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ClientModal;
