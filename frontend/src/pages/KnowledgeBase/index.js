import React, { useState, useEffect, useReducer } from "react";
import { useHistory } from "react-router-dom";
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
    Tooltip,
} from "@material-ui/core";
import {
    Add,
    Delete,
    Edit,
    LibraryBooks,
    Settings,
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
    customTableCell: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
}));

const reducer = (state, action) => {
    if (action.type === "LOAD_KNOWLEDGE_BASES") {
        const knowledgeBases = action.payload;
        const newKnowledgeBases = [];

        knowledgeBases.forEach((knowledgeBase) => {
            const knowledgeBaseIndex = state.findIndex((k) => k.id === knowledgeBase.id);
            if (knowledgeBaseIndex !== -1) {
                state[knowledgeBaseIndex] = knowledgeBase;
            } else {
                newKnowledgeBases.push(knowledgeBase);
            }
        });

        return [...state, ...newKnowledgeBases];
    }

    if (action.type === "UPDATE_KNOWLEDGE_BASES") {
        const knowledgeBase = action.payload;
        const knowledgeBaseIndex = state.findIndex((k) => k.id === knowledgeBase.id);

        if (knowledgeBaseIndex !== -1) {
            state[knowledgeBaseIndex] = knowledgeBase;
            return [...state];
        } else {
            return [knowledgeBase, ...state];
        }
    }

    if (action.type === "DELETE_KNOWLEDGE_BASE") {
        const knowledgeBaseId = action.payload;
        const knowledgeBaseIndex = state.findIndex((k) => k.id === knowledgeBaseId);
        if (knowledgeBaseIndex !== -1) {
            state.splice(knowledgeBaseIndex, 1);
        }
        return [...state];
    }

    if (action.type === "RESET") {
        return [];
    }
};

const KnowledgeBase = () => {
    const classes = useStyles();
    const theme = useTheme();
    const history = useHistory();

    const [loading, setLoading] = useState(false);
    const [knowledgeBases, dispatch] = useReducer(reducer, []);
    const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState(null);
    const [knowledgeBaseModalOpen, setKnowledgeBaseModalOpen] = useState(false);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [deletingKnowledgeBase, setDeletingKnowledgeBase] = useState(null);

    // Form State
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    useEffect(() => {
        (async () => {
            setLoading(true);
            try {
                const { data } = await api.get("/knowledge-bases");
                dispatch({ type: "LOAD_KNOWLEDGE_BASES", payload: Array.isArray(data) ? data : [] });
            } catch (err) {
                toastError(err);
            }
            setLoading(false);
        })();
    }, []);

    const handleOpenKnowledgeBaseModal = (knowledgeBase) => {
        if (knowledgeBase) {
            setSelectedKnowledgeBase(knowledgeBase);
            setName(knowledgeBase.name);
            setDescription(knowledgeBase.description || "");
        } else {
            setSelectedKnowledgeBase(null);
            setName("");
            setDescription("");
        }
        setKnowledgeBaseModalOpen(true);
    };

    const handleCloseKnowledgeBaseModal = () => {
        setKnowledgeBaseModalOpen(false);
        setSelectedKnowledgeBase(null);
        setName("");
        setDescription("");
    };

    const handleSubmitKnowledgeBase = async () => {
        const knowledgeBaseData = { name, description };
        try {
            if (selectedKnowledgeBase) {
                const { data } = await api.put(`/knowledge-bases/${selectedKnowledgeBase.id}`, knowledgeBaseData);
                dispatch({ type: "UPDATE_KNOWLEDGE_BASES", payload: data });
                toast.success(i18n.t("knowledgeBase.toasts.edited"));
            } else {
                const { data } = await api.post("/knowledge-bases", knowledgeBaseData);
                dispatch({ type: "UPDATE_KNOWLEDGE_BASES", payload: data });
                toast.success(i18n.t("knowledgeBase.toasts.created"));
            }
            handleCloseKnowledgeBaseModal();
        } catch (err) {
            toastError(err);
        }
    };

    const handleDeleteKnowledgeBase = async (knowledgeBaseId) => {
        try {
            await api.delete(`/knowledge-bases/${knowledgeBaseId}`);
            dispatch({ type: "DELETE_KNOWLEDGE_BASE", payload: knowledgeBaseId });
            toast.success(i18n.t("knowledgeBase.toasts.deleted"));
        } catch (err) {
            toastError(err);
        }
        setDeletingKnowledgeBase(null);
    };

    return (
        <MainContainer>
            <MainHeader>
                <Title>{i18n.t("knowledgeBase.title")}</Title>
                <MainHeaderButtonsWrapper>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => handleOpenKnowledgeBaseModal()}
                    >
                        {i18n.t("knowledgeBase.buttons.add")}
                    </Button>
                </MainHeaderButtonsWrapper>
            </MainHeader>
            <Paper className={classes.mainPaper} variant="outlined">
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell align="center">{i18n.t("knowledgeBase.table.name")}</TableCell>
                            <TableCell align="center">{i18n.t("knowledgeBase.table.description")}</TableCell>
                            <TableCell align="center">{i18n.t("knowledgeBase.table.actions")}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {loading ? (
                            <TableRowSkeleton columns={3} />
                        ) : (
                            <>
                                {knowledgeBases.map((knowledgeBase) => (
                                    <TableRow key={knowledgeBase.id}>
                                        <TableCell align="center">{knowledgeBase.name}</TableCell>
                                        <TableCell align="center">{knowledgeBase.description}</TableCell>
                                        <TableCell align="center">
                                            <IconButton
                                                size="small"
                                                onClick={() => history.push(`/knowledge-bases/${knowledgeBase.id}`)}
                                            >
                                                <Settings />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => handleOpenKnowledgeBaseModal(knowledgeBase)}
                                            >
                                                <Edit />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => {
                                                    setDeletingKnowledgeBase(knowledgeBase);
                                                    setConfirmModalOpen(true);
                                                }}
                                            >
                                                <Delete />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {knowledgeBases.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} align="center">
                                            {i18n.t("knowledgeBase.table.noData")}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </>
                        )}
                    </TableBody>
                </Table>
            </Paper>

            {/* Modal for Create/Edit */}
            <Dialog open={knowledgeBaseModalOpen} onClose={handleCloseKnowledgeBaseModal} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {selectedKnowledgeBase
                        ? i18n.t("knowledgeBase.modal.edit")
                        : i18n.t("knowledgeBase.modal.add")}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        label={i18n.t("knowledgeBase.form.name")}
                        variant="outlined"
                        fullWidth
                        margin="dense"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />
                    <TextField
                        label={i18n.t("knowledgeBase.form.description")}
                        variant="outlined"
                        fullWidth
                        margin="dense"
                        multiline
                        rows={3}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseKnowledgeBaseModal} color="secondary" variant="outlined">
                        {i18n.t("knowledgeBase.buttons.cancel")}
                    </Button>
                    <Button onClick={handleSubmitKnowledgeBase} color="primary" variant="contained">
                        {selectedKnowledgeBase
                            ? i18n.t("knowledgeBase.buttons.save")
                            : i18n.t("knowledgeBase.buttons.add")}
                    </Button>
                </DialogActions>
            </Dialog>

            <ConfirmationModal
                title={i18n.t("knowledgeBase.confirmationModal.deleteTitle")}
                open={confirmModalOpen}
                onClose={() => setConfirmModalOpen(false)}
                onConfirm={() => handleDeleteKnowledgeBase(deletingKnowledgeBase.id)}
            >
                {i18n.t("knowledgeBase.confirmationModal.deleteMessage")}
            </ConfirmationModal>
        </MainContainer>
    );
};

export default KnowledgeBase;
