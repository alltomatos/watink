import React, { useState, useEffect, useCallback, useContext } from "react";
import {
    Container,
    Paper,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    TextField,
    InputAdornment,
    Box,
    Chip,
    CircularProgress,
} from "@material-ui/core";
import {
    Add as AddIcon,
    Search as SearchIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Person as PersonIcon,
    Business as BusinessIcon,
} from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";
import api from "../../services/api";
import ClientModal from "./ClientModal";
import ConfirmationModal from "../../components/ConfirmationModal";
import { Can } from "../../components/Can";
import { AuthContext } from "../../context/Auth/AuthContext";

const useStyles = makeStyles((theme) => ({
    root: {
        padding: theme.spacing(3),
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: theme.spacing(3),
    },
    searchBox: {
        marginBottom: theme.spacing(2),
        maxWidth: 400,
    },
    tableContainer: {
        marginTop: theme.spacing(2),
    },
    loader: {
        display: "flex",
        justifyContent: "center",
        padding: theme.spacing(4),
    },
    chipPf: {
        backgroundColor: theme.palette.info.main,
        color: "#fff",
    },
    chipPj: {
        backgroundColor: theme.palette.secondary.main,
        color: "#fff",
    },
}));

const Clients = () => {
    const classes = useStyles();
    const { user } = useContext(AuthContext);
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchParam, setSearchParam] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState(null);
    const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState(null);

    const loadClients = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await api.get("/clients", {
                params: { searchParam },
            });
            setClients(data.clients);
        } catch (err) {
            toast.error("Erro ao carregar clientes");
        } finally {
            setLoading(false);
        }
    }, [searchParam]);

    useEffect(() => {
        loadClients();
    }, [loadClients]);

    const handleOpenModal = (client = null) => {
        setSelectedClient(client);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setSelectedClient(null);
        setModalOpen(false);
        loadClients();
    };

    const handleDeleteClick = (client) => {
        setClientToDelete(client);
        setConfirmDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        try {
            await api.delete(`/clients/${clientToDelete.id}`);
            toast.success("Cliente excluído com sucesso");
            loadClients();
        } catch (err) {
            toast.error("Erro ao excluir cliente");
        }
        setConfirmDeleteOpen(false);
        setClientToDelete(null);
    };

    return (
        <Can
            user={user}
            perform="clients:read"
            yes={() => (
                <Container maxWidth="lg" className={classes.root}>
                    <Paper elevation={0} style={{ padding: 24 }}>
                        <Box className={classes.header}>
                            <Typography variant="h4">👥 Clientes</Typography>
                            <Can
                                user={user}
                                perform="clients:write"
                                yes={() => (
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={<AddIcon />}
                                        onClick={() => handleOpenModal()}
                                    >
                                        Novo Cliente
                                    </Button>
                                )}
                            />
                        </Box>

                        <TextField
                            className={classes.searchBox}
                            variant="outlined"
                            size="small"
                            placeholder="Buscar por nome, documento ou email..."
                            fullWidth
                            value={searchParam}
                            onChange={(e) => setSearchParam(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                        />

                        {loading ? (
                            <Box className={classes.loader}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            <TableContainer component={Paper} className={classes.tableContainer}>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Tipo</TableCell>
                                            <TableCell>Nome</TableCell>
                                            <TableCell>Documento</TableCell>
                                            <TableCell>Email</TableCell>
                                            <TableCell>Telefone</TableCell>
                                            <TableCell>Contatos</TableCell>
                                            <TableCell align="right">Ações</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {clients.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={7} align="center">
                                                    Nenhum cliente encontrado
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            clients.map((client) => (
                                                <TableRow key={client.id} hover>
                                                    <TableCell>
                                                        <Chip
                                                            icon={client.type === "pf" ? <PersonIcon /> : <BusinessIcon />}
                                                            label={client.type === "pf" ? "PF" : "PJ"}
                                                            size="small"
                                                            className={client.type === "pf" ? classes.chipPf : classes.chipPj}
                                                        />
                                                    </TableCell>
                                                    <TableCell>{client.name}</TableCell>
                                                    <TableCell>{client.document || "-"}</TableCell>
                                                    <TableCell>{client.email || "-"}</TableCell>
                                                    <TableCell>{client.phone || "-"}</TableCell>
                                                    <TableCell>{client.contacts?.length || 0}</TableCell>
                                                    <TableCell align="right">
                                                    <Can
                                                            user={user}
                                                            perform="clients:write"
                                                            yes={() => (
                                                                <>
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => handleOpenModal(client)}
                                                                    >
                                                                        <EditIcon />
                                                                    </IconButton>
                                                                    <Can
                                                                        user={user}
                                                                        perform="clients:delete"
                                                                        yes={() => (
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={() => handleDeleteClick(client)}
                                                                            >
                                                                                <DeleteIcon />
                                                                            </IconButton>
                                                                        )}
                                                                    />
                                                                </>
                                                            )}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        )}
                    </Paper>

                    <ClientModal
                        open={modalOpen}
                        onClose={handleCloseModal}
                        client={selectedClient}
                    />

                    <ConfirmationModal
                        open={confirmDeleteOpen}
                        title="Excluir Cliente"
                        message={`Deseja realmente excluir o cliente "${clientToDelete?.name}"?`}
                        onConfirm={handleConfirmDelete}
                        onCancel={() => setConfirmDeleteOpen(false)}
                    />
                </Container>
            )}
            no={() => (
                <Container maxWidth="lg" className={classes.root}>
                    <Typography variant="h5" align="center">
                        Você não tem permissão para visualizar esta página.
                    </Typography>
                </Container>
            )}
        />
    );
};

export default Clients;
