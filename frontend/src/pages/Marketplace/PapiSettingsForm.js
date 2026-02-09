import React, { useState, useEffect } from "react";
import {
    TextField,
    Button,
    Grid,
    Typography,
    Box,
    Paper,
    CircularProgress
} from "@material-ui/core";
import { toast } from "react-toastify";
import api from "../../services/api";

const PapiSettingsForm = ({ active }) => {
    const [settings, setSettings] = useState({
        papiUrl: "",
        papiKey: ""
    });
    const [originalSettings, setOriginalSettings] = useState({
        papiUrl: "",
        papiKey: ""
    });
    const [loading, setLoading] = useState(false);

    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);

    useEffect(() => {
        if (active) {
            loadSettings();
        }
    }, [active]);

    const loadSettings = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/settings");
            const papiUrl = data.find(s => s.key === "papiUrl")?.value || "";
            const papiKey = data.find(s => s.key === "papiKey")?.value || "";
            setSettings({ papiUrl, papiKey });
            setOriginalSettings({ papiUrl, papiKey });
        } catch (err) {
            toast.error("Erro ao carregar configurações do PAPI");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setSettings(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleTestConnection = async () => {
        setTesting(true);
        try {
            await api.post("/plugins/papi/test", {
                papiUrl: settings.papiUrl,
                papiKey: settings.papiKey
            });
            toast.success("Conexão com PAPI estabelecida com sucesso!");
        } catch (err) {
            toast.error(`Erro ao conectar: ${err.response?.data?.details || err.message}`);
        } finally {
            setTesting(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await api.put("/settings/papiUrl", { value: settings.papiUrl });
            await api.put("/settings/papiKey", { value: settings.papiKey });
            await api.put("/settings/papiKey", { value: settings.papiKey });
            setOriginalSettings(settings);
            toast.success("Configurações do PAPI salvas com sucesso!");
        } catch (err) {
            toast.error("Erro ao salvar configurações do PAPI");
        } finally {
            setSaving(false);
        }
    };

    if (!active) return null;

    if (loading) {
        return <CircularProgress />;
    }

    return (
        <Paper variant="outlined" style={{ padding: 24, marginTop: 24 }}>
            <Box display="flex" flexDirection="column" gap={2}>
                <Typography variant="h6">
                    Configurações do Engine PAPI
                </Typography>

                <form onSubmit={handleSubmit}>
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="PAPI URL"
                                name="papiUrl"
                                variant="outlined"
                                value={settings.papiUrl}
                                onChange={handleChange}
                                placeholder="https://api.pastorini.com"
                                helperText="URL da API do Pastorini"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                type="password"
                                label="PAPI Key"
                                name="papiKey"
                                variant="outlined"
                                value={settings.papiKey}
                                onChange={handleChange}
                                placeholder="Sua chave de API"
                                helperText="Chave de autenticação"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Typography variant="body2" color="textSecondary" style={{ marginBottom: 8 }}>
                                Webhook Interno: Configurado automaticamente pelo sistema.
                            </Typography>
                        </Grid>
                        <Grid item xs={12} style={{ display: 'flex', gap: 10 }}>
                            <Button
                                variant="outlined"
                                color="primary"
                                onClick={handleTestConnection}
                                disabled={testing || JSON.stringify(settings) !== JSON.stringify(originalSettings)}
                            >
                                {testing ? "Testando..." : "Testar Conexão"}
                            </Button>
                            <Button
                                type="submit"
                                variant="contained"
                                color="primary"
                                disabled={saving}
                            >
                            </Button>
                        </Grid>
                    </Grid>
                </form>
            </Box>
        </Paper>
    );
};

export default PapiSettingsForm;
