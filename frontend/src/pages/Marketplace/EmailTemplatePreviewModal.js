import React, { useEffect, useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Divider,
    Box
} from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import Mustache from "mustache";

const EmailTemplatePreviewModal = ({ open, onClose, template }) => {
    const [renderedHTML, setRenderedHTML] = useState("");

    useEffect(() => {
        if (template && template.html) {
            // Default sample data for preview
            const view = {
                name: "João Silva",
                email: "joao@exemplo.com",
                password: "senha_segura_123",
                companyName: "Empresa Exemplo",
                frontendUrl: "https://plataforma.exemplo.com",
                year: new Date().getFullYear()
            };

            try {
                const rendered = Mustache.render(template.html, view);
                setRenderedHTML(rendered);
            } catch (err) {
                setRenderedHTML("Erro ao renderizar template: " + err.message);
            }
        }
    }, [template]);

    return (
        <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
            <DialogTitle>
                {i18n.t("emailTemplates.preview.title")} - {template?.name}
            </DialogTitle>
            <DialogContent dividers>
                <Box mb={2}>
                    <Typography variant="subtitle2" color="textSecondary">
                        {i18n.t("emailTemplates.preview.subject")}: {template?.subject}
                    </Typography>
                </Box>
                <Divider />
                <Box mt={2} p={2} border={1} borderColor="grey.300" borderRadius={4} bgcolor="grey.100">
                    <div
                        dangerouslySetInnerHTML={{ __html: renderedHTML }}
                        style={{ width: "100%", overflowX: "auto" }}
                    />
                </Box>
                <Box mt={2}>
                    <Typography variant="caption" color="textSecondary">
                        * {i18n.t("emailTemplates.preview.variablesInfo")}
                    </Typography>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="primary" variant="contained">
                    {i18n.t("emailTemplates.buttons.close")}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EmailTemplatePreviewModal;
