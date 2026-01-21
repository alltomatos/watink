import React, { useState, useEffect } from "react";
import {
    TextField,
    Button,
    Grid,
    FormControlLabel,
    Switch,
    InputAdornment,
    IconButton,
    Typography,
    Box,
    Paper,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Tabs,
    Tab
} from "@material-ui/core";
import { Visibility, VisibilityOff } from "@material-ui/icons";
import { toast } from "react-toastify";
import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import EmailTemplateList from "./EmailTemplateList";

const SmtpSettingsForm = ({ active }) => {
    const [settings, setSettings] = useState({
        host: "",
        port: 587,
        user: "",
        password: "",
        secure: false,
        emailFrom: ""
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [tab, setTab] = useState(0);

    useEffect(() => {
        if (active) {
            loadSettings();
        }
    }, [active]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/smtp");
            if (data) {
                setSettings(prev => ({ ...prev, ...data }));
            }
        } catch (err) {
            // Ignore 404 (not found yet)
            if (err.response?.status !== 404) {
                toast.error(i18n.t("smtp.toasts.loadError"));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, checked, type } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put("/smtp", settings);
            toast.success(i18n.t("smtp.toasts.saveSuccess"));
        } catch (err) {
            toast.error(i18n.t("smtp.toasts.saveError"));
        } finally {
            setSaving(false);
        }
    };

    const [testModalOpen, setTestModalOpen] = useState(false);
    const [testEmail, setTestEmail] = useState("");
    const [testing, setTesting] = useState(false);

    const handleTestConnection = async () => {
        if (!testEmail) {
            toast.error(i18n.t("smtp.toasts.emailRequired"));
            return;
        }
        setTesting(true);
        try {
            // Send current settings + testEmail to test endpoint
            await api.post("/smtp/test", { ...settings, testEmail });
            toast.success(i18n.t("smtp.toasts.testSuccess"));
            setTestModalOpen(false);
        } catch (err) {
            const errorMsg = err.response?.data?.error || i18n.t("smtp.toasts.testError");
            const errorDetail = err.response?.data?.details || "";
            toast.error(`${errorMsg}${errorDetail ? `: ${errorDetail}` : ""}`);
        } finally {
            setTesting(false);
        }
    };

    const handleTabChange = (event, newValue) => {
        setTab(newValue);
    };

    if (!active) return null;

    if (loading) {
        return <CircularProgress />;
    }

    return (
        <Paper variant="outlined" style={{ padding: 24, marginTop: 24 }}>
            <Box display="flex" flexDirection="column" gap={2}>
                <Typography variant="h6">
                    {i18n.t("smtp.title")}
                </Typography>

                <Tabs value={tab} onChange={handleTabChange} indicatorColor="primary" textColor="primary">
                    <Tab label={i18n.t("smtp.settingsTitle")} />
                    <Tab label={i18n.t("emailTemplates.title")} />
                </Tabs>

                <Box hidden={tab !== 0} py={2}>
                    <form onSubmit={handleSubmit}>
                        <Grid container spacing={3}>
                            <Grid item xs={12} sm={8}>
                                <TextField
                                    fullWidth
                                    label={i18n.t("smtp.form.host")}
                                    name="host"
                                    variant="outlined"
                                    value={settings.host}
                                    onChange={handleChange}
                                    required
                                    placeholder="smtp.exemplo.com"
                                />
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <TextField
                                    fullWidth
                                    label={i18n.t("smtp.form.port")}
                                    name="port"
                                    type="number"
                                    variant="outlined"
                                    value={settings.port}
                                    onChange={handleChange}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label={i18n.t("smtp.form.user")}
                                    name="user"
                                    variant="outlined"
                                    value={settings.user}
                                    onChange={handleChange}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label={i18n.t("smtp.form.password")}
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    variant="outlined"
                                    value={settings.password}
                                    onChange={handleChange}
                                    placeholder={settings.id ? i18n.t("smtp.form.passwordPlaceholder") : ""}
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    edge="end"
                                                >
                                                    {showPassword ? <Visibility /> : <VisibilityOff />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} sm={8}>
                                <TextField
                                    fullWidth
                                    label={i18n.t("smtp.form.emailFrom")}
                                    name="emailFrom"
                                    variant="outlined"
                                    value={settings.emailFrom}
                                    onChange={handleChange}
                                    required
                                    placeholder="Nome <email@exemplo.com>"
                                />
                            </Grid>
                            <Grid item xs={12} sm={4} style={{ display: 'flex', alignItems: 'center' }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={settings.secure}
                                            onChange={handleChange}
                                            name="secure"
                                            color="primary"
                                        />
                                    }
                                    label={i18n.t("smtp.form.secure")}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <Box display="flex" justifyContent="flex-end">
                                    <Button
                                        type="submit"
                                        variant="contained"
                                        color="primary"
                                        disabled={saving}
                                        size="large"
                                    >
                                        {saving ? i18n.t("smtp.buttons.saving") : i18n.t("smtp.buttons.save")}
                                    </Button>
                                    <Button
                                        variant="outlined"
                                        color="secondary"
                                        onClick={() => setTestModalOpen(true)}
                                        disabled={saving || testing}
                                        size="large"
                                        style={{ marginLeft: 8 }}
                                    >
                                        {i18n.t("smtp.buttons.test")}
                                    </Button>
                                </Box>
                            </Grid>
                        </Grid>
                    </form>
                </Box>

                <Box hidden={tab !== 1} py={2}>
                    <EmailTemplateList />
                </Box>
            </Box>

            <Dialog open={testModalOpen} onClose={() => setTestModalOpen(false)}>
                <DialogTitle>{i18n.t("smtp.modal.title")}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {i18n.t("smtp.modal.content")}
                    </DialogContentText>
                    <TextField
                        autoFocus
                        margin="dense"
                        label={i18n.t("smtp.modal.emailLabel")}
                        type="email"
                        fullWidth
                        variant="outlined"
                        value={testEmail}
                        onChange={(e) => setTestEmail(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setTestModalOpen(false)} color="primary">
                        {i18n.t("smtp.buttons.cancel")}
                    </Button>
                    <Button onClick={handleTestConnection} color="primary" variant="contained" disabled={testing}>
                        {testing ? i18n.t("smtp.buttons.testing") : i18n.t("smtp.buttons.sendTest")}
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper >
    );
};

export default SmtpSettingsForm;
