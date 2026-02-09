import React, { useState, useEffect } from "react";
import {
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Button,
    Grid,
    Typography,
    Box,
    CircularProgress
} from "@material-ui/core";
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    Add as AddIcon,
} from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import activityApi from "../../../services/activityApi";
import TemplateModal from "./TemplateModal";

const useStyles = makeStyles((theme) => ({
    root: {
        marginTop: theme.spacing(2),
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: theme.spacing(2),
    },
    tableHeader: {
        fontWeight: "bold",
        backgroundColor: "#f5f5f5"
    }
}));

const TemplateList = () => {
    const classes = useStyles();
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const { data } = await activityApi.listTemplates();
            setTemplates(data.templates);
        } catch (err) {
            toast.error("Erro ao carregar templates");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadTemplates();
    }, []);

    const handleCreate = () => {
        setSelectedTemplateId(null);
        setModalOpen(true);
    };

    const handleEdit = (id) => {
        setSelectedTemplateId(id);
        setModalOpen(true);
    };

    const handleDelete = async (id) => {
        try {
            await activityApi.deleteTemplate(id);
            toast.success("Template excluído!");
            loadTemplates();
        } catch (err) {
            toast.error("Erro ao excluir template");
        }
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        loadTemplates();
    };

    return (
        <div className={classes.root}>
            <Box className={classes.header}>
                <Typography variant="h6" color="textSecondary">
                    Gerencie os modelos de Atividades e Checklist
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={handleCreate}
                >
                    Novo Modelo
                </Button>
            </Box>

            {loading ? (
                <Box display="flex" justifyContent="center" p={4}>
                    <CircularProgress />
                </Box>
            ) : (
                <TableContainer component={Paper} variant="outlined">
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell className={classes.tableHeader} width="30%">Nome</TableCell>
                                <TableCell className={classes.tableHeader} width="50%">Descrição</TableCell>
                                <TableCell className={classes.tableHeader} width="10%">Itens</TableCell>
                                <TableCell className={classes.tableHeader} align="right">Ações</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {templates.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} align="center">
                                        Nenhum modelo cadastrado.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                templates.map((template) => (
                                    <TableRow key={template.id} hover>
                                        <TableCell style={{ fontWeight: 500 }}>{template.name}</TableCell>
                                        <TableCell>{template.description}</TableCell>
                                        <TableCell>{template.items?.length || 0}</TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" onClick={() => handleEdit(template.id)}>
                                                <EditIcon color="primary" />
                                            </IconButton>
                                            <IconButton size="small" onClick={() => handleDelete(template.id)}>
                                                <DeleteIcon color="error" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}

            <TemplateModal
                open={modalOpen}
                onClose={handleCloseModal}
                templateId={selectedTemplateId}
            />
        </div>
    );
};

export default TemplateList;
