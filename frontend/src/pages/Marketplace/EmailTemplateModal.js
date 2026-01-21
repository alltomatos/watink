import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    CircularProgress,
    TextField,
    InputAdornment,
    IconButton,
    Grid
} from "@material-ui/core";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";

const EmailTemplateModal = ({ open, onClose, templateId }) => {
    const [template, setTemplate] = useState({
        name: "",
        subject: "",
        html: "",
        text: ""
    });

    useEffect(() => {
        const fetchTemplate = async () => {
            if (!templateId) return;
            try {
                const { data } = await api.get(`/email-templates/${templateId}`);
                setTemplate(data);
            } catch (err) {
                toast.error(i18n.t("emailTemplates.toasts.loadError"));
            }
        };

        fetchTemplate();
        return () => {
            setTemplate({
                name: "",
                subject: "",
                html: "",
                text: ""
            });
        }
    }, [templateId, open]);

    const handleClose = () => {
        onClose();
        setTemplate({
            name: "",
            subject: "",
            html: "",
            text: ""
        });
    };

    const TemplateSchema = Yup.object().shape({
        name: Yup.string()
            .min(2, "Too Short!")
            .max(50, "Too Long!")
            .required("Required"),
        subject: Yup.string().required("Required"),
        html: Yup.string().required("Required")
    });

    const handleSaveTemplate = async (values) => {
        try {
            if (templateId) {
                await api.put(`/email-templates/${templateId}`, values);
                toast.success(i18n.t("emailTemplates.toasts.saveSuccess"));
            } else {
                await api.post("/email-templates", values);
                toast.success(i18n.t("emailTemplates.toasts.createSuccess"));
            }
            handleClose();
        } catch (err) {
            toast.error(i18n.t("emailTemplates.toasts.saveError"));
        }
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle>
                {templateId
                    ? i18n.t("emailTemplates.modal.editTitle")
                    : i18n.t("emailTemplates.modal.addTitle")}
            </DialogTitle>
            <Formik
                initialValues={template}
                enableReinitialize={true}
                validationSchema={TemplateSchema}
                onSubmit={(values, actions) => {
                    setTimeout(() => {
                        handleSaveTemplate(values);
                        actions.setSubmitting(false);
                    }, 400);
                }}
            >
                {({ touched, errors, isSubmitting, values }) => (
                    <Form>
                        <DialogContent dividers>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <Field
                                        as={TextField}
                                        label={i18n.t("emailTemplates.form.nameSelect")}
                                        name="name"
                                        error={touched.name && Boolean(errors.name)}
                                        helperText={touched.name && errors.name}
                                        variant="outlined"
                                        fullWidth
                                        select
                                        SelectProps={{
                                            native: true,
                                        }}
                                    >
                                        <option value="">{i18n.t("emailTemplates.form.nameSelect")}</option>
                                        <option value="welcome_premium">{i18n.t("emailTemplates.names.welcome_premium")}</option>
                                        <option value="custom">{i18n.t("emailTemplates.names.custom")}</option>
                                    </Field>
                                </Grid>
                                <Grid item xs={12}>
                                    <Field
                                        as={TextField}
                                        label={i18n.t("emailTemplates.form.subject")}
                                        name="subject"
                                        error={touched.subject && Boolean(errors.subject)}
                                        helperText={touched.subject && errors.subject}
                                        variant="outlined"
                                        fullWidth
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Field
                                        as={TextField}
                                        label={i18n.t("emailTemplates.form.html")}
                                        name="html"
                                        error={touched.html && Boolean(errors.html)}
                                        helperText={touched.html && errors.html}
                                        variant="outlined"
                                        fullWidth
                                        multiline
                                        minRows={10}
                                        maxRows={20}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Field
                                        as={TextField}
                                        label={i18n.t("emailTemplates.form.text")}
                                        name="text"
                                        error={touched.text && Boolean(errors.text)}
                                        helperText={touched.text && errors.text}
                                        variant="outlined"
                                        fullWidth
                                        multiline
                                        minRows={3}
                                    />
                                </Grid>
                            </Grid>
                        </DialogContent>
                        <DialogActions>
                            <Button
                                onClick={handleClose}
                                color="secondary"
                                disabled={isSubmitting}
                                variant="outlined"
                            >
                                {i18n.t("emailTemplates.buttons.cancel")}
                            </Button>
                            <Button
                                type="submit"
                                color="primary"
                                disabled={isSubmitting}
                                variant="contained"
                            >
                                {templateId
                                    ? i18n.t("emailTemplates.buttons.save")
                                    : i18n.t("emailTemplates.buttons.add")}
                                {isSubmitting && (
                                    <CircularProgress size={24} style={{ marginLeft: 15 }} />
                                )}
                            </Button>
                        </DialogActions>
                    </Form>
                )}
            </Formik>
        </Dialog>
    );
};

export default EmailTemplateModal;
