import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import {
	Dialog,
	DialogContent,
	DialogTitle,
	Button,
	DialogActions,
	CircularProgress,
	TextField,
	Switch,
	FormControlLabel,
    InputAdornment,
    Typography,
    Grid,
    Box,
    Tabs,
    Tab,
    Paper
} from "@material-ui/core";
import { Colorize } from "@material-ui/icons";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";

const useStyles = makeStyles(theme => ({
	root: {
		display: "flex",
		flexWrap: "wrap",
	},
	multFieldLine: {
		display: "flex",
		"& > *:not(:last-child)": {
			marginRight: theme.spacing(1),
		},
	},
	btnWrapper: {
		position: "relative",
	},
	buttonProgress: {
		color: green[500],
		position: "absolute",
		top: "50%",
		left: "50%",
		marginTop: -12,
		marginLeft: -12,
	},
    colorPicker: {
        width: '100%',
        height: '40px',
        border: 'none',
        padding: 0,
        backgroundColor: 'transparent'
    },
    previewContainer: {
        border: '1px solid #ddd',
        borderRadius: 8,
        padding: 16,
        marginTop: 16,
        backgroundColor: '#f5f5f5',
        position: 'relative',
        height: 200,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'flex-end'
    },
    previewButton: {
        borderRadius: '50%',
        width: 60,
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
        color: '#fff',
        cursor: 'pointer'
    }
}));

const SessionSchema = Yup.object().shape({
	name: Yup.string()
		.min(2, "Too Short!")
		.max(50, "Too Long!")
		.required("Required"),
});

const WebchatModal = ({ open, onClose, whatsAppId }) => {
	const classes = useStyles();
	const initialState = {
		name: "",
		greetingMessage: "",
		farewellMessage: "",
		isDefault: false,
        type: "webchat",
        chatConfig: {
            buttonColor: "#00E676",
            icon: "chat",
            position: "right",
            title: "Suporte Online",
            subtitle: "Fale conosco agora",
            fields: {
                name: true,
                email: true,
                phone: false
            }
        }
	};
	const [whatsApp, setWhatsApp] = useState(initialState);
	const [selectedQueueIds, setSelectedQueueIds] = useState([]);
    const [tab, setTab] = useState(0);

	useEffect(() => {
		const fetchSession = async () => {
			if (!whatsAppId) {
                setWhatsApp(initialState);
                return;
            }

			try {
				const { data } = await api.get(`whatsapp/${whatsAppId}`);
                // Ensure chatConfig has defaults if missing
                if (!data.chatConfig) {
                    data.chatConfig = initialState.chatConfig;
                }
				setWhatsApp(data);

				const whatsQueueIds = data.queues?.map(queue => queue.id);
				setSelectedQueueIds(whatsQueueIds);
			} catch (err) {
				toastError(err);
			}
		};
		if (open) {
			fetchSession();
		}
	}, [whatsAppId, open]);

	const handleSaveWhatsApp = async values => {
        // Merge chatConfig from state (as it might be complex object not fully in Formik values if we don't manage it there)
        // Or better, let Formik handle everything.
        // For simplicity, we'll use values but ensure chatConfig is structured.
		const whatsappData = { ...values, queueIds: selectedQueueIds, type: "webchat" };

		try {
			if (whatsAppId) {
				await api.put(`/whatsapp/${whatsAppId}`, whatsappData);
			} else {
				await api.post("/whatsapp", whatsappData);
			}
			toast.success(i18n.t("whatsappModal.success"));
			onClose();
		} catch (err) {
			toastError(err);
		}
	};

	const handleClose = () => {
		onClose();
		setWhatsApp(initialState);
	};

    const handleTabChange = (event, newValue) => {
        setTab(newValue);
    };

    const renderEmbedCode = () => {
        if (!whatsAppId) return <Typography>Salve para gerar o código</Typography>;
        const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin.replace('app', 'api').replace('3000', '8080'); // Fallback approximation
        const script = `<script>
  window.watinkWebchatConfig = {
    url: "${backendUrl}",
    whatsappId: "${whatsAppId}"
  };
  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "${backendUrl}/public/webchat.js";
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'watink-webchat-sdk'));
</script>`;
        return (
            <Box mt={2}>
                <Typography variant="subtitle2">Código de Incorporação (Embed):</Typography>
                <TextField
                    fullWidth
                    multiline
                    rows={8}
                    variant="outlined"
                    value={script}
                    InputProps={{
                        readOnly: true,
                    }}
                />
            </Box>
        );
    };

	return (
		<Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
			<DialogTitle>
                Configurar Webchat
            </DialogTitle>
			<Formik
				initialValues={whatsApp}
				enableReinitialize={true}
				validationSchema={SessionSchema}
				onSubmit={(values, actions) => {
					setTimeout(() => {
						handleSaveWhatsApp(values);
						actions.setSubmitting(false);
					}, 400);
				}}
			>
				{({ values, touched, errors, isSubmitting, setFieldValue }) => (
					<Form>
                        <Tabs value={tab} onChange={handleTabChange} indicatorColor="primary" textColor="primary" centered>
                            <Tab label="Geral" />
                            <Tab label="Personalização" />
                            <Tab label="Integração" />
                        </Tabs>

						<DialogContent dividers>
                            {tab === 0 && (
                                <>
                                    <div className={classes.multFieldLine}>
                                        <Field
                                            as={TextField}
                                            label={i18n.t("whatsappModal.form.name")}
                                            autoFocus
                                            name="name"
                                            error={touched.name && Boolean(errors.name)}
                                            helperText={touched.name && errors.name}
                                            variant="outlined"
                                            margin="dense"
                                            className={classes.textField}
                                            fullWidth
                                        />
                                        <FormControlLabel
                                            control={
                                                <Field
                                                    as={Switch}
                                                    color="primary"
                                                    name="isDefault"
                                                    checked={values.isDefault}
                                                />
                                            }
                                            label={i18n.t("whatsappModal.form.isDefault")}
                                        />
                                    </div>
                                    <div className={classes.multFieldLine}>
                                        <Field
                                            as={TextField}
                                            label={i18n.t("whatsappModal.form.greetingMessage")}
                                            name="greetingMessage"
                                            error={touched.greetingMessage && Boolean(errors.greetingMessage)}
                                            helperText={touched.greetingMessage && errors.greetingMessage}
                                            variant="outlined"
                                            margin="dense"
                                            fullWidth
                                            multiline
                                            rows={4}
                                        />
                                    </div>
                                    <div className={classes.multFieldLine}>
                                        <Field
                                            as={TextField}
                                            label={i18n.t("whatsappModal.form.farewellMessage")}
                                            name="farewellMessage"
                                            error={touched.farewellMessage && Boolean(errors.farewellMessage)}
                                            helperText={touched.farewellMessage && errors.farewellMessage}
                                            variant="outlined"
                                            margin="dense"
                                            fullWidth
                                            multiline
                                            rows={4}
                                        />
                                    </div>
                                    <QueueSelect
                                        selectedQueueIds={selectedQueueIds}
                                        onChange={selectedIds => setSelectedQueueIds(selectedIds)}
                                    />
                                </>
                            )}

                            {tab === 1 && (
                                <Grid container spacing={2}>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="subtitle1" gutterBottom>Aparência</Typography>
                                        <Field
                                            as={TextField}
                                            label="Título do Chat"
                                            name="chatConfig.title"
                                            variant="outlined"
                                            margin="dense"
                                            fullWidth
                                        />
                                        <Field
                                            as={TextField}
                                            label="Subtítulo"
                                            name="chatConfig.subtitle"
                                            variant="outlined"
                                            margin="dense"
                                            fullWidth
                                        />
                                        <Box mt={2}>
                                            <Typography variant="caption">Cor do Botão</Typography>
                                            <input
                                                type="color"
                                                className={classes.colorPicker}
                                                value={values.chatConfig?.buttonColor || "#00E676"}
                                                onChange={(e) => setFieldValue("chatConfig.buttonColor", e.target.value)}
                                            />
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <div className={classes.previewContainer}>
                                            <div 
                                                className={classes.previewButton}
                                                style={{ backgroundColor: values.chatConfig?.buttonColor || "#00E676" }}
                                            >
                                                <svg style={{ width: 30, height: 30, fill: '#fff' }} viewBox="0 0 24 24">
                                                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
                                                </svg>
                                            </div>
                                        </div>
                                    </Grid>
                                </Grid>
                            )}

                            {tab === 2 && renderEmbedCode()}
						</DialogContent>
						<DialogActions>
							<Button onClick={handleClose} color="secondary" variant="outlined">
								{i18n.t("whatsappModal.buttons.cancel")}
							</Button>
							<Button
								type="submit"
								color="primary"
								variant="contained"
								disabled={isSubmitting}
								className={classes.btnWrapper}
							>
								{whatsAppId
									? i18n.t("whatsappModal.buttons.okEdit")
									: i18n.t("whatsappModal.buttons.okAdd")}
								{isSubmitting && (
									<CircularProgress
										size={24}
										className={classes.buttonProgress}
									/>
								)}
							</Button>
						</DialogActions>
					</Form>
				)}
			</Formik>
		</Dialog>
	);
};

export default WebchatModal;