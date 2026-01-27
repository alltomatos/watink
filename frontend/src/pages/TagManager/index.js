import React, { useState, useEffect, useCallback } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Table from "@material-ui/core/Table";
import TableBody from "@material-ui/core/TableBody";
import TableCell from "@material-ui/core/TableCell";
import TableHead from "@material-ui/core/TableHead";
import TableRow from "@material-ui/core/TableRow";
import IconButton from "@material-ui/core/IconButton";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import Dialog from "@material-ui/core/Dialog";
import DialogTitle from "@material-ui/core/DialogTitle";
import DialogContent from "@material-ui/core/DialogContent";
import DialogActions from "@material-ui/core/DialogActions";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Typography from "@material-ui/core/Typography";
import Tooltip from "@material-ui/core/Tooltip";
import EditIcon from "@material-ui/icons/Edit";
import DeleteIcon from "@material-ui/icons/Delete";
import AddIcon from "@material-ui/icons/Add";
import ArchiveIcon from "@material-ui/icons/Archive";
import UnarchiveIcon from "@material-ui/icons/Unarchive";
import { toast } from "react-toastify";

import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import MainContainer from "../../components/MainContainer";
import TagChip from "../../components/TagChip";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import { TAG_COLOR_OPTIONS, getTagColorStyles } from "../../helpers/tagColors";

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        flexDirection: "column",
        gap: theme.spacing(2),
    },
    paper: {
        padding: theme.spacing(2),
        overflowY: "auto",
    },
    colorOption: {
        display: "flex",
        alignItems: "center",
        gap: 8,
    },
    colorDot: {
        width: 16,
        height: 16,
        borderRadius: 4,
        border: "1px solid rgba(0,0,0,0.1)",
    },
    usageCount: {
        backgroundColor: "#f0f0f0",
        padding: "2px 8px",
        borderRadius: 12,
        fontSize: "0.75rem",
    },
    formField: {
        marginBottom: theme.spacing(2),
    },
}));

const TagManager = () => {
    const classes = useStyles();

    const [tags, setTags] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [showArchived, setShowArchived] = useState(false);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTag, setEditingTag] = useState(null);
    const [formData, setFormData] = useState({
        name: "",
        color: "blue",
        icon: "",
        description: "",
        groupId: "",
    });

    const fetchTags = useCallback(async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/tags", {
                params: { includeArchived: showArchived },
            });
            setTags(data);
        } catch (err) {
            toast.error("Erro ao carregar tags");
        } finally {
            setLoading(false);
        }
    }, [showArchived]);

    const fetchGroups = async () => {
        try {
            const { data } = await api.get("/tag-groups");
            setGroups(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchTags();
        fetchGroups();
    }, [fetchTags]);

    const handleOpenModal = (tag = null) => {
        if (tag) {
            setEditingTag(tag);
            setFormData({
                name: tag.name,
                color: tag.color,
                icon: tag.icon || "",
                description: tag.description || "",
                groupId: tag.groupId || "",
            });
        } else {
            setEditingTag(null);
            setFormData({
                name: "",
                color: "blue",
                icon: "",
                description: "",
                groupId: "",
            });
        }
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setEditingTag(null);
    };

    const handleSave = async () => {
        try {
            if (editingTag) {
                await api.put(`/tags/${editingTag.id}`, formData);
                toast.success("Tag atualizada com sucesso");
            } else {
                await api.post("/tags", formData);
                toast.success("Tag criada com sucesso");
            }
            handleCloseModal();
            fetchTags();
        } catch (err) {
            toast.error(err.response?.data?.message || "Erro ao salvar tag");
        }
    };

    const handleToggleArchive = async (tag) => {
        try {
            await api.put(`/tags/${tag.id}`, { archived: !tag.archived });
            toast.success(tag.archived ? "Tag restaurada" : "Tag arquivada");
            fetchTags();
        } catch (err) {
            toast.error("Erro ao arquivar/restaurar tag");
        }
    };

    const handleDelete = async (tag) => {
        if (!window.confirm(`Deseja realmente excluir a tag "${tag.name}"? Esta ação não pode ser desfeita.`)) {
            return;
        }

        try {
            await api.delete(`/tags/${tag.id}?forceDelete=true`);
            toast.success("Tag excluída com sucesso");
            fetchTags();
        } catch (err) {
            toast.error("Erro ao excluir tag");
        }
    };

    return (
        <MainContainer>
            <MainHeader>
                <Title>🏷️ Gerenciar Tags</Title>
                <MainHeaderButtonsWrapper>
                    <Button
                        variant="outlined"
                        color="default"
                        onClick={() => setShowArchived(!showArchived)}
                    >
                        {showArchived ? "Ocultar Arquivadas" : "Mostrar Arquivadas"}
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenModal()}
                    >
                        Nova Tag
                    </Button>
                </MainHeaderButtonsWrapper>
            </MainHeader>

            <Paper className={classes.paper}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Tag</TableCell>
                            <TableCell>Grupo</TableCell>
                            <TableCell>Descrição</TableCell>
                            <TableCell align="center">Uso</TableCell>
                            <TableCell align="right">Ações</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {tags.map((tag) => (
                            <TableRow
                                key={tag.id}
                                style={{ opacity: tag.archived ? 0.5 : 1 }}
                            >
                                <TableCell>
                                    <TagChip tag={tag} size="medium" />
                                </TableCell>
                                <TableCell>
                                    {tag.group?.name || "-"}
                                </TableCell>
                                <TableCell>
                                    {tag.description || "-"}
                                </TableCell>
                                <TableCell align="center">
                                    <span className={classes.usageCount}>
                                        {tag.usageCount || 0}
                                    </span>
                                </TableCell>
                                <TableCell align="right">
                                    <Tooltip title="Editar">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleOpenModal(tag)}
                                        >
                                            <EditIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title={tag.archived ? "Restaurar" : "Arquivar"}>
                                        <IconButton
                                            size="small"
                                            onClick={() => handleToggleArchive(tag)}
                                        >
                                            {tag.archived ? (
                                                <UnarchiveIcon fontSize="small" />
                                            ) : (
                                                <ArchiveIcon fontSize="small" />
                                            )}
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Excluir">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleDelete(tag)}
                                            color="secondary"
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}

                        {tags.length === 0 && !loading && (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    <Typography color="textSecondary">
                                        Nenhuma tag encontrada
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Paper>

            {/* Modal de Criar/Editar Tag */}
            <Dialog open={modalOpen} onClose={handleCloseModal} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingTag ? "Editar Tag" : "Nova Tag"}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        label="Nome"
                        fullWidth
                        variant="outlined"
                        className={classes.formField}
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />

                    <FormControl fullWidth variant="outlined" className={classes.formField}>
                        <InputLabel>Cor</InputLabel>
                        <Select
                            value={formData.color}
                            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                            label="Cor"
                        >
                            {TAG_COLOR_OPTIONS.map((color) => {
                                const styles = getTagColorStyles(color);
                                return (
                                    <MenuItem key={color} value={color}>
                                        <div className={classes.colorOption}>
                                            <div
                                                className={classes.colorDot}
                                                style={{ backgroundColor: styles.text }}
                                            />
                                            <span style={{ textTransform: "capitalize" }}>{color}</span>
                                        </div>
                                    </MenuItem>
                                );
                            })}
                        </Select>
                    </FormControl>

                    <FormControl fullWidth variant="outlined" className={classes.formField}>
                        <InputLabel>Grupo (opcional)</InputLabel>
                        <Select
                            value={formData.groupId}
                            onChange={(e) => setFormData({ ...formData, groupId: e.target.value })}
                            label="Grupo (opcional)"
                        >
                            <MenuItem value="">
                                <em>Nenhum</em>
                            </MenuItem>
                            {groups.map((group) => (
                                <MenuItem key={group.id} value={group.id}>
                                    {group.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        label="Descrição (opcional)"
                        fullWidth
                        variant="outlined"
                        multiline
                        rows={2}
                        className={classes.formField}
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />

                    {/* Preview */}
                    <Typography variant="subtitle2" gutterBottom>
                        Preview:
                    </Typography>
                    <TagChip
                        tag={{ name: formData.name || "Exemplo", color: formData.color }}
                        size="large"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseModal} color="default">
                        Cancelar
                    </Button>
                    <Button
                        onClick={handleSave}
                        color="primary"
                        variant="contained"
                        disabled={!formData.name.trim()}
                    >
                        {editingTag ? "Salvar" : "Criar"}
                    </Button>
                </DialogActions>
            </Dialog>
        </MainContainer>
    );
};

export default TagManager;
