import React, { useState, useEffect } from "react";
import { useParams, useHistory } from "react-router-dom";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import { makeStyles } from "@material-ui/core/styles";

import {
    Paper,
    Button,
    CircularProgress,
    TextField,
    Switch,
    FormControlLabel,
    Typography,
    Grid,
    Box,
    Tabs,
    Tab,
    IconButton,
    Card,
    CardContent,
    Divider
} from "@material-ui/core";
import { ArrowBack, Send, Chat, Laptop, ColorLens, Code, AccessTime } from "@material-ui/icons";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import QueueSelect from "../../components/QueueSelect";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

const useStyles = makeStyles(theme => ({
    multFieldLine: {
        display: "flex",
        "& > *:not(:last-child)": {
            marginRight: theme.spacing(1),
        },
    },
    colorPicker: {
        width: '100%',
        height: '40px',
        border: 'none',
        padding: 0,
        backgroundColor: 'transparent'
    },
    root: {
        display: "flex",
        flexWrap: "wrap",
        gap: theme.spacing(3),
    },
    mainPaper: {
        flex: 1,
        padding: theme.spacing(2),
        overflowY: "auto",
        height: "calc(100vh - 140px)",
    },
    previewPaper: {
        width: 400,
        height: "calc(100vh - 140px)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: theme.spacing(2),
        backgroundColor: "#f4f6f8",
        borderLeft: "1px solid #e0e0e0",
        position: 'relative'
    },
    tabPanel: {
        padding: theme.spacing(2),
    },
    // Mock Widget Styles (WhatsApp-like)
    mockWidget: {
        width: 360,
        height: 600,
        maxHeight: '80vh',
        backgroundColor: '#fff',
        borderRadius: 16,
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #eee',
        position: 'relative'
    },
    mockHeader: {
        padding: '16px 20px',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        zIndex: 2
    },
    mockBody: {
        flex: 1,
        backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")',
        backgroundRepeat: 'repeat',
        backgroundColor: '#e5ddd5',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        overflowY: 'auto'
    },
    mockFooter: {
        padding: '10px 16px',
        backgroundColor: '#f0f0f0',
        display: 'flex',
        alignItems: 'center',
        borderTop: '1px solid #ddd'
    },
    mockInput: {
        flex: 1,
        backgroundColor: '#fff',
        border: 'none',
        borderRadius: 24,
        padding: '10px 16px',
        fontSize: 14,
        outline: 'none',
        boxShadow: '0 1px 1px rgba(0,0,0,0.05)'
    },
    mockMsg: {
        padding: '8px 12px',
        borderRadius: 8,
        maxWidth: '80%',
        fontSize: 14,
        lineHeight: 1.4,
        position: 'relative',
        boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
        marginBottom: 4
    },
    mockMsgSent: {
        backgroundColor: '#dcf8c6',
        alignSelf: 'flex-end',
        borderTopRightRadius: 0,
        '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: -8,
            width: 0,
            height: 0,
            border: '8px solid transparent',
            borderTopColor: '#dcf8c6',
            borderLeft: 0,
            borderRight: 0,
            marginLeft: -4,
            marginTop: 0
        }
    },
    mockMsgRecv: {
        backgroundColor: '#fff',
        alignSelf: 'flex-start',
        borderTopLeftRadius: 0,
        '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: -8,
            width: 0,
            height: 0,
            border: '8px solid transparent',
            borderTopColor: '#fff',
            borderRight: 0,
            borderLeft: 0,
            marginRight: -4,
            marginTop: 0,
            transform: 'scaleX(-1)'
        }
    },
    sectionTitle: {
        fontWeight: 600,
        marginBottom: theme.spacing(2),
        color: '#555',
        display: 'flex',
        alignItems: 'center',
        gap: 8
    },
}));

const SessionSchema = Yup.object().shape({
    name: Yup.string()
        .min(2, "Too Short!")
        .max(50, "Too Long!")
        .required("Required"),
});

const WebchatConfig = () => {
    const classes = useStyles();
    const { webchatId } = useParams();
    const history = useHistory();

    const initialState = {
        name: "",
        greetingMessage: "",
        farewellMessage: "",
        isDefault: false,
        type: "webchat",
        chatConfig: {
            buttonColor: "#00E676",
            title: "Suporte Online",
            subtitle: "Fale conosco agora",
            fields: {
                name: true,
                email: true,
                phone: false
            },
            businessHours: {
                enabled: false,
                startTime: "09:00",
                endTime: "18:00",
                message: "Estamos fora do horário de atendimento."
            }
        }
    };
    const [whatsApp, setWhatsApp] = useState(initialState);
    const [selectedQueueIds, setSelectedQueueIds] = useState([]);
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSession = async () => {
            try {
                const { data } = await api.get(`whatsapp/${webchatId}`);

                // Parse chatConfig if it's a string (fix persistence issue)
                if (data.chatConfig && typeof data.chatConfig === 'string') {
                    try {
                        data.chatConfig = JSON.parse(data.chatConfig);
                    } catch (e) {
                        console.error("Failed to parse chatConfig", e);
                        data.chatConfig = initialState.chatConfig;
                    }
                } else if (!data.chatConfig) {
                    data.chatConfig = initialState.chatConfig;
                }

                // Merge defaults
                data.chatConfig = { ...initialState.chatConfig, ...data.chatConfig };

                setWhatsApp(data);

                const whatsQueueIds = data.queues?.map(queue => queue.id);
                setSelectedQueueIds(whatsQueueIds);
                setLoading(false);
            } catch (err) {
                toastError(err);
                setLoading(false);
            }
        };
        fetchSession();
    }, [webchatId]);

    const handleSaveWhatsApp = async values => {
        const whatsappData = { ...values, queueIds: selectedQueueIds, type: "webchat" };

        try {
            await api.put(`/whatsapp/${webchatId}`, whatsappData);
            toast.success(i18n.t("webchatModal.success"));
            // Stay on page after save
        } catch (err) {
            toastError(err);
        }
    };

    const handleTabChange = (event, newValue) => {
        setTab(newValue);
    };

    const renderEmbedCode = () => {
        const backendUrl = process.env.REACT_APP_BACKEND_URL || window.location.origin.replace('app', 'api').replace('3000', '8080');
        const script = `<script>
  window.watinkWebchatConfig = {
    url: "${backendUrl}",
    webchatId: "${webchatId}"
  };
  (function(d, s, id) {
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) return;
    js = d.createElement(s); js.id = id;
    js.src = "${backendUrl}/public/webchat.js?v=1.3.248";
    fjs.parentNode.insertBefore(js, fjs);
  }(document, 'script', 'watink-webchat-sdk'));
</script>`;
        return (
            <Box mt={2}>
                <Typography variant="h6" className={classes.sectionTitle}><Code /> Instalação</Typography>
                <Card variant="outlined" style={{ backgroundColor: '#f8f9fa' }}>
                    <CardContent>
                        <Typography variant="subtitle2" gutterBottom>
                            Copie e cole este código antes do fechamento da tag <code>&lt;/body&gt;</code> do seu site.
                        </Typography>
                        <TextField
                            fullWidth
                            multiline
                            rows={10}
                            variant="outlined"
                            value={script}
                            InputProps={{
                                readOnly: true,
                                style: { fontFamily: 'monospace', fontSize: 13, backgroundColor: '#fff' }
                            }}
                        />
                    </CardContent>
                </Card>
            </Box>
        );
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <MainContainer>
            <MainHeader>
                <div style={{ display: "flex", alignItems: "center" }}>
                    <IconButton onClick={() => history.push("/connections")}>
                        <ArrowBack />
                    </IconButton>
                    <Title>{whatsApp.name || "Configuração do Webchat"}</Title>
                </div>
            </MainHeader>

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
                    <Form style={{ display: 'flex', gap: 20, height: '100%' }}>

                        {/* LEFT COLUMN: Config Form */}
                        <Paper className={classes.mainPaper} elevation={0} variant="outlined">
                            <Tabs
                                value={tab}
                                onChange={handleTabChange}
                                indicatorColor="primary"
                                textColor="primary"
                                style={{ borderBottom: '1px solid #e0e0e0', marginBottom: 20 }}
                            >
                                <Tab label="Geral" icon={<Laptop />} />
                                <Tab label="Aparência" icon={<ColorLens />} />
                                <Tab label="Horários" icon={<AccessTime />} />
                                <Tab label="Instalação" icon={<Code />} />
                            </Tabs>

                            {tab === 0 && (
                                <Box className={classes.tabPanel}>
                                    <Typography variant="h6" className={classes.sectionTitle}>Informações Básicas</Typography>
                                    <Grid container spacing={3}>
                                        <Grid item xs={12}>
                                            <Field
                                                as={TextField}
                                                label="Nome da Conexão"
                                                name="name"
                                                error={touched.name && Boolean(errors.name)}
                                                helperText={touched.name && errors.name}
                                                variant="outlined"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <QueueSelect
                                                selectedQueueIds={selectedQueueIds}
                                                onChange={selectedIds => setSelectedQueueIds(selectedIds)}
                                            />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <FormControlLabel
                                                control={
                                                    <Field
                                                        as={Switch}
                                                        color="primary"
                                                        name="isDefault"
                                                        checked={values.isDefault}
                                                    />
                                                }
                                                label="Definir como Padrão"
                                            />
                                        </Grid>

                                        <Grid item xs={12}>
                                            <Divider style={{ margin: '20px 0' }} />
                                            <Typography variant="h6" className={classes.sectionTitle}>Segurança</Typography>
                                            <Field
                                                as={TextField}
                                                label="Domínios Autorizados"
                                                name="chatConfig.authorizedDomains"
                                                variant="outlined"
                                                fullWidth
                                                placeholder="ex: meusite.com, app.meusite.com (Deixe em branco para permitir todos)"
                                                helperText="Separe os domínios por vírgula. Se preenchido, o chat só funcionará nestas origens."
                                            />
                                        </Grid>

                                        <Grid item xs={12}>
                                            <Divider style={{ margin: '20px 0' }} />
                                            <Typography variant="h6" className={classes.sectionTitle}>Mensagens Automáticas</Typography>
                                        </Grid>

                                        <Grid item xs={12}>
                                            <Field
                                                as={TextField}
                                                label="Mensagem de Saudação (Topo do Chat)"
                                                name="greetingMessage"
                                                variant="outlined"
                                                fullWidth
                                                multiline
                                                rows={3}
                                                placeholder="Olá! Como podemos ajudar você hoje?"
                                            />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <Field
                                                as={TextField}
                                                label="Mensagem de Despedida / Encerramento"
                                                name="farewellMessage"
                                                variant="outlined"
                                                fullWidth
                                                multiline
                                                rows={3}
                                            />
                                        </Grid>
                                    </Grid>
                                </Box>
                            )}

                            {tab === 1 && (
                                <Box className={classes.tabPanel}>
                                    <Typography variant="h6" className={classes.sectionTitle}>Personalização Visual</Typography>
                                    <Grid container spacing={3}>
                                        <Grid item xs={12} md={6}>
                                            <Field
                                                as={TextField}
                                                label="Título do Chat"
                                                name="chatConfig.title"
                                                variant="outlined"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <Field
                                                as={TextField}
                                                label="Subtítulo"
                                                name="chatConfig.subtitle"
                                                variant="outlined"
                                                fullWidth
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <Typography variant="subtitle2" gutterBottom>Cor Principal</Typography>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                <input
                                                    type="color"
                                                    className={classes.colorPicker}
                                                    value={values.chatConfig?.buttonColor || "#00E676"}
                                                    onChange={(e) => setFieldValue("chatConfig.buttonColor", e.target.value)}
                                                />
                                                <Typography>{values.chatConfig?.buttonColor}</Typography>
                                            </div>
                                        </Grid>

                                        <Grid item xs={12}>
                                            <Divider style={{ margin: '20px 0' }} />
                                            <Typography variant="h6" className={classes.sectionTitle}>Campos do Formulário Inicial</Typography>
                                            <FormikCheckbox name="chatConfig.fields.name" label="Solicitar Nome" disabled checked />
                                            <FormikCheckbox name="chatConfig.fields.email" label="Solicitar E-mail" disabled checked />
                                            <Field
                                                component={SwitchForm}
                                                name="chatConfig.fields.phone"
                                                label="Solicitar Telefone"
                                            />
                                        </Grid>
                                    </Grid>
                                </Box>
                            )}

                            {tab === 2 && (
                                <Box className={classes.tabPanel}>
                                    <Typography variant="h6" className={classes.sectionTitle}>Horário de Atendimento</Typography>

                                    <Box mb={3}>
                                        <Field
                                            component={SwitchForm}
                                            name="chatConfig.businessHours.enabled"
                                            label="Ativar Restrição de Horário"
                                        />
                                    </Box>

                                    {values.chatConfig?.businessHours?.enabled && (
                                        <Grid container spacing={3}>
                                            <Grid item xs={6}>
                                                <Field
                                                    as={TextField}
                                                    label="Início"
                                                    type="time"
                                                    name="chatConfig.businessHours.startTime"
                                                    variant="outlined"
                                                    fullWidth
                                                    InputLabelProps={{ shrink: true }}
                                                />
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Field
                                                    as={TextField}
                                                    label="Fim"
                                                    type="time"
                                                    name="chatConfig.businessHours.endTime"
                                                    variant="outlined"
                                                    fullWidth
                                                    InputLabelProps={{ shrink: true }}
                                                />
                                            </Grid>
                                            <Grid item xs={12}>
                                                <Field
                                                    as={TextField}
                                                    label="Mensagem de Ausência"
                                                    name="chatConfig.businessHours.message"
                                                    variant="outlined"
                                                    fullWidth
                                                    multiline
                                                    rows={3}
                                                    helperText="Exibida quando o chat for aberto fora do horário."
                                                />
                                            </Grid>
                                        </Grid>
                                    )}
                                </Box>
                            )}


                            {tab === 3 && (
                                <Box className={classes.tabPanel}>
                                    {renderEmbedCode()}
                                </Box>
                            )}

                            <Box mt={4} display="flex" justifyContent="flex-end" style={{ borderTop: '1px solid #eee', paddingTop: 20 }}>
                                <Button
                                    onClick={() => history.push("/connections")}
                                    style={{ marginRight: 10, color: '#666' }}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="submit"
                                    color="primary"
                                    variant="contained"
                                    disabled={isSubmitting}
                                    startIcon={isSubmitting ? <CircularProgress size={20} color="inherit" /> : <Send />}
                                    style={{ padding: '10px 30px', fontWeight: 'bold' }}
                                >
                                    Salvar Configurações
                                </Button>
                            </Box>

                        </Paper>

                        {/* RIGHT COLUMN: Live Preview */}
                        <div className={classes.previewPaper}>
                            <Typography variant="overline" style={{ color: '#888', marginBottom: 10, letterSpacing: 1.2 }}>
                                PRE-VISUALIZAÇÃO AO VIVO
                            </Typography>

                            <div className={classes.mockWidget}>
                                {/* Header */}
                                <div className={classes.mockHeader} style={{ backgroundColor: values.chatConfig?.buttonColor || '#00E676' }}>
                                    <div>
                                        <Typography variant="subtitle1" style={{ fontWeight: 600, lineHeight: 1.2 }}>
                                            {values.chatConfig?.title || "Suporte Online"}
                                        </Typography>
                                        <Typography variant="caption" style={{ opacity: 0.9 }}>
                                            {values.chatConfig?.subtitle || "Estamos online!"}
                                        </Typography>
                                    </div>
                                    <IconButton size="small" style={{ color: '#fff' }}><AccessTime fontSize="small" /></IconButton>
                                </div>

                                {/* Body */}
                                <div className={classes.mockBody}>
                                    {values.greetingMessage && (
                                        <div style={{
                                            backgroundColor: '#fff',
                                            padding: 10,
                                            borderRadius: 8,
                                            textAlign: 'center',
                                            fontSize: 13,
                                            color: '#555',
                                            borderLeft: `4px solid ${values.chatConfig?.buttonColor || '#00E676'}`
                                        }}>
                                            {values.greetingMessage}
                                        </div>
                                    )}

                                    <div className={`${classes.mockMsg} ${classes.mockMsgRecv}`}>
                                        Olá! Como posso ajudar você hoje?
                                    </div>
                                    <div className={`${classes.mockMsg} ${classes.mockMsgSent}`}>
                                        Gostaria de saber mais sobre os planos.
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className={classes.mockFooter}>
                                    <input className={classes.mockInput} placeholder="Digite uma mensagem..." disabled />
                                    <div style={{ marginLeft: 10, color: values.chatConfig?.buttonColor || '#00E676' }}>
                                        <Send />
                                    </div>
                                </div>
                            </div>

                            <Box mt={3} display="flex" alignItems="center">
                                <div
                                    style={{
                                        width: 50, height: 50, borderRadius: '50%',
                                        backgroundColor: values.chatConfig?.buttonColor || '#00E676',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        boxShadow: '0 4px 10px rgba(0,0,0,0.2)'
                                    }}
                                >
                                    <Chat style={{ color: '#fff' }} />
                                </div>
                                <Typography variant="caption" style={{ marginLeft: 10, color: '#666' }}>
                                    Botão Flutuante
                                </Typography>
                            </Box>
                        </div>

                    </Form>
                )}
            </Formik>
        </MainContainer>
    );
};

// Helper Components
const SwitchForm = ({ field, form, label, ...props }) => (
    <FormControlLabel
        control={
            <Switch
                checked={field.value}
                onChange={e => form.setFieldValue(field.name, e.target.checked)}
                color="primary"
            />
        }
        label={label}
    />
);

const FormikCheckbox = ({ name, label, disabled = false, checked = false }) => (
    <FormControlLabel
        control={
            <Switch
                checked={checked}
                disabled={disabled}
                color="primary"
            />
        }
        label={label}
    />
);

export default WebchatConfig;
