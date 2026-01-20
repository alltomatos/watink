import React, { useState, useEffect, useReducer } from "react";
import { useParams, useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import openSocket from "../../services/socket-io";

import {
    Button,
    IconButton,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Typography,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Select,
    MenuItem,
    InputLabel,
    FormControl,
} from "@material-ui/core";
import {
    Delete,
    CloudUpload,
    Link as LinkIcon,
    Description,
    ArrowBack
} from "@material-ui/icons";

import { useTheme } from "@material-ui/core/styles";
import { makeStyles } from "@material-ui/core/styles";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import Title from "../../components/Title";
import ConfirmationModal from "../../components/ConfirmationModal";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";

const useStyles = makeStyles((theme) => ({
    mainPaper: {
        flex: 1,
        padding: theme.spacing(1),
        overflowY: "scroll",
        ...theme.scrollbarStyles,
    },
}));

const KnowledgeBaseConfig = () => {
    const classes = useStyles();
    const { knowledgeBaseId } = useParams();
    const history = useHistory();

    const [loading, setLoading] = useState(false);
    const [knowledgeBase, setKnowledgeBase] = useState(null);
    const [sources, setSources] = useState([]);
    const [sourceModalOpen, setSourceModalOpen] = useState(false);
    const [sourceType, setSourceType] = useState("text"); // text, file, url
    const [sourceUrl, setSourceUrl] = useState("");
    const [sourceFile, setSourceFile] = useState(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [deletingSource, setDeletingSource] = useState(null);

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const { data } = await api.get(`/knowledge-bases/${knowledgeBaseId}`);
                setKnowledgeBase(data);
                setSources(data.sources || []);
            } catch (err) {
                toastError(err);
            }
            setLoading(false);
        })();
    }, [knowledgeBaseId]);

    useEffect(() => {
        const socket = openSocket();

        if (!socket) return;

        socket.on("knowledgeSource", (data) => {
            if (data.action === "update" || data.action === "create") {
                setSources((prev) => {
                    const index = prev.findIndex((s) => s.id === data.source.id);
                    if (index !== -1) {
                        const newSources = [...prev];
                        newSources[index] = data.source;
                        return newSources;
                    } else {
                        return [...prev, data.source];
                    }
                });
            }
            if (data.action === "delete") {
                setSources((prev) => prev.filter((s) => s.id !== data.sourceId));
            }
        });

        return () => {
            socket.disconnect();
        }
    }, []);

    const handleOpenSourceModal = () => {
        setSourceType("url");
        setSourceUrl("");
        setSourceFile(null);
        setSourceModalOpen(true);
    };

    const handleCloseSourceModal = () => {
        setSourceModalOpen(false);
    };

    const handleUploadSource = async () => {
        if (!sourceType) return;

        const formData = new FormData();
        formData.append("type", sourceType);

        if (sourceType === "url") {
            formData.append("url", sourceUrl);
            formData.append("name", sourceUrl);
        } else if (sourceType === "file" || sourceType === "pdf") {
            if (!sourceFile) return;
            formData.append("file", sourceFile);
            formData.append("name", sourceFile.name);
        }

        try {
            await api.post(`/knowledge-bases/${knowledgeBaseId}/sources`, formData, {
                headers: { "Content-Type": "multipart/form-data" }
            });
            toast.success("Fonte adicionada com sucesso!");
            handleCloseSourceModal();
            // Reload sources is handled by socket or we can optimistically add (but backend does processing)
        } catch (err) {
            toastError(err);
        }
    };

    const handleDeleteSource = async (sourceId) => {
        try {
            await api.delete(`/knowledge-bases/${knowledgeBaseId}/sources/${sourceId}`);
            setSources(sources.filter(s => s.id !== sourceId));
            toast.success("Fonte removida com sucesso!");
        } catch (err) {
            toastError(err);
        }
        setDeletingSource(null);
    };

    return (
        <MainContainer>
            <MainHeader>
                <div style={{ display: "flex", alignItems: "center" }}>
                    <IconButton onClick={() => history.push("/knowledge-bases")} color="primary">
                        <ArrowBack />
                    </IconButton>
                    <Title>{knowledgeBase ? knowledgeBase.name : "Carregando..."}</Title>
                </div>
                <MainHeaderButtonsWrapper>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleOpenSourceModal}
                    >
                        Adicionar Fonte
                    </Button>
                </MainHeaderButtonsWrapper>
            </MainHeader>

            <Paper className={classes.mainPaper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Nome/URL</TableCell>
                            <TableCell>Tipo</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Ações</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sources.length > 0 ? sources.map((source) => (
                            <TableRow key={source.id}>
                                <TableCell>{source.url || source.fileName || "Sem nome"}</TableCell>
                                <TableCell>{source.type}</TableCell>
                                <TableCell>{source.status}</TableCell>
                                <TableCell>
                                    <IconButton onClick={() => {
                                        setDeletingSource(source);
                                        setConfirmModalOpen(true);
                                    }}>
                                        <Delete />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} align="center">Nenhuma fonte cadastrada.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Paper>

            {/* Source Modal */}
            <Dialog open={sourceModalOpen} onClose={handleCloseSourceModal} fullWidth maxWidth="sm">
                <DialogTitle>Adicionar Fonte de Conhecimento</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth margin="dense" variant="outlined">
                        <InputLabel>Tipo</InputLabel>
                        <Select
                            value={sourceType}
                            onChange={(e) => setSourceType(e.target.value)}
                            label="Tipo"
                        >
                            <MenuItem value="url">URL (Link)</MenuItem>
                            <MenuItem value="pdf">Arquivo PDF</MenuItem>
                            <MenuItem value="text">Texto Simples (Manual)</MenuItem>
                        </Select>
                    </FormControl>

                    {sourceType === "url" && (
                        <TextField
                            fullWidth
                            margin="dense"
                            label="URL"
                            variant="outlined"
                            value={sourceUrl}
                            onChange={(e) => setSourceUrl(e.target.value)}
                        />
                    )}

                    {(sourceType === "pdf" || sourceType === "file") && (
                        <div style={{ marginTop: 15 }}>
                            <Button
                                variant="contained"
                                component="label"
                                startIcon={<CloudUpload />}
                            >
                                Upload PDF
                                <input
                                    type="file"
                                    hidden
                                    accept=".pdf, .txt"
                                    onChange={(e) => setSourceFile(e.target.files[0])}
                                />
                            </Button>
                            {sourceFile && (
                                <Typography variant="body2" style={{ marginTop: 5 }}>
                                    {sourceFile.name}
                                </Typography>
                            )}
                        </div>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseSourceModal} color="secondary">Cancelar</Button>
                    <Button onClick={handleUploadSource} color="primary" variant="contained">Adicionar</Button>
                </DialogActions>
            </Dialog>

            <ConfirmationModal
                title="Excluir Fonte"
                open={confirmModalOpen}
                onClose={() => setConfirmModalOpen(false)}
                onConfirm={() => handleDeleteSource(deletingSource.id)}
            >
                Tem certeza que deseja remover esta fonte? Os vetores de busca serão perdidos.
            </ConfirmationModal>

        </MainContainer>
    );
};

export default KnowledgeBaseConfig;
