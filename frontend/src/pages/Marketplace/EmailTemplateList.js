import React, { useState, useEffect } from "react";
import {
    Paper,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Typography,
    Box,
    CircularProgress
} from "@material-ui/core";
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon, Visibility as VisibilityIcon } from "@material-ui/icons";
import { toast } from "react-toastify";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import EmailTemplateModal from "./EmailTemplateModal";
import EmailTemplatePreviewModal from "./EmailTemplatePreviewModal";

const EmailTemplateList = () => {
    const [templates, setTemplates] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState(null);

    const [previewModalOpen, setPreviewModalOpen] = useState(false);
    const [selectedTemplateForPreview, setSelectedTemplateForPreview] = useState(null);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/email-templates");
            setTemplates(data);
        } catch (err) {
            toast.error(i18n.t("emailTemplates.toasts.loadListError"));
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (templateId = null) => {
        setSelectedTemplateId(templateId);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setSelectedTemplateId(null);
        setModalOpen(false);
        loadTemplates(); // Reload to reflect changes
    };

    const handleOpenPreview = (template) => {
        setSelectedTemplateForPreview(template);
        setPreviewModalOpen(true);
    };

    const handleClosePreview = () => {
        setSelectedTemplateForPreview(null);
        setPreviewModalOpen(false);
    };

    const handleDelete = async (templateId) => {
        try {
            await api.delete(`/email-templates/${templateId}`);
            toast.success(i18n.t("emailTemplates.toasts.deleteSuccess"));
            loadTemplates();
        } catch (err) {
            toast.error(i18n.t("emailTemplates.toasts.deleteError"));
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Paper variant="outlined" style={{ padding: 24, marginTop: 24 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">
                    {i18n.t("emailTemplates.title")}
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenModal()}
                >
                    {i18n.t("emailTemplates.buttons.add")}
                </Button>
            </Box>

            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>{i18n.t("emailTemplates.table.name")}</TableCell>
                            <TableCell>{i18n.t("emailTemplates.table.subject")}</TableCell>
                            <TableCell align="right">{i18n.t("emailTemplates.table.actions")}</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {templates.map((template) => (
                            <TableRow key={template.id}>
                                <TableCell>{template.name}</TableCell>
                                <TableCell>{template.subject}</TableCell>
                                <TableCell align="right">
                                    <IconButton
                                        size="small"
                                        onClick={() => handleOpenPreview(template)}
                                    >
                                        <VisibilityIcon />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleOpenModal(template.id)}
                                    >
                                        <EditIcon />
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleDelete(template.id)}
                                    >
                                        <DeleteIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                        {templates.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={3} align="center">
                                    {i18n.t("emailTemplates.table.noData")}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <EmailTemplateModal
                open={modalOpen}
                onClose={handleCloseModal}
                templateId={selectedTemplateId}
            />
            <EmailTemplatePreviewModal
                open={previewModalOpen}
                onClose={handleClosePreview}
                template={selectedTemplateForPreview}
            />
        </Paper>
    );
};

export default EmailTemplateList;
