import React, { useState, useEffect } from "react";
import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    TextField,
    RadioGroup,
    FormControlLabel,
    Radio,
    Stepper,
    Step,
    StepLabel,
    Typography,
    CircularProgress,
    IconButton,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Tabs,
    Tab,
    Box,
    InputAdornment
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import DeleteIcon from "@material-ui/icons/Delete";
import AddIcon from "@material-ui/icons/Add";
import api from "../../services/api";
import { toast } from "react-toastify";

const useStyles = makeStyles((theme) => ({
    root: {
        width: "100%",
    },
    button: {
        marginRight: theme.spacing(1),
    },
    instructions: {
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
    },
    stepContent: {
        padding: theme.spacing(2),
    },
    aiContainer: {
        backgroundColor: theme.palette.type === 'dark' ? '#1e293b' : '#f8fafc',
        padding: theme.spacing(2),
        borderRadius: theme.spacing(1),
        marginTop: theme.spacing(2),
        border: `1px solid ${theme.palette.divider}`
    }
}));

function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box p={3}>
                    {children}
                </Box>
            )}
        </div>
    );
}

const PipelineWizard = ({ open, onClose }) => {
    const classes = useStyles();
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState({
        name: "",
        description: "",
        type: "kanban",
        stages: ["Novo", "Em Andamento", "Concluído"] // Default
    });

    // IA State
    const [tabValue, setTabValue] = useState(0);
    const [aiPrompt, setAiPrompt] = useState("");
    const [aiLoading, setAiLoading] = useState(false);
    const [aiEnabled, setAiEnabled] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await api.get("/settings");
                // Verifica aiEnabled master E aiPipelineEnabled específico
                const aiEnabledSetting = data.find(s => s.key === "aiEnabled");
                const aiPipelineSetting = data.find(s => s.key === "aiPipelineEnabled");
                const masterEnabled = aiEnabledSetting?.value === "true";
                const pipelineEnabled = aiPipelineSetting?.value === "true";
                setAiEnabled(masterEnabled && pipelineEnabled);
            } catch (err) {
                console.error("Erro ao carregar configurações:", err);
            }
        };
        fetchSettings();
    }, []);

    const steps = ["Definições Básicas", "Configurar Etapas"];

    const handleNext = () => {
        if (activeStep === steps.length - 1) {
            handleFinish();
        } else {
            setActiveStep((prev) => prev + 1);
        }
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
    };

    const handleFinish = async () => {
        setLoading(true);
        try {
            const payload = {
                ...data,
                stages: data.stages.map(stage => ({ name: stage }))
            };
            await api.post("/pipelines", payload);
            toast.success("Pipeline criado com sucesso!");
            onClose();
        } catch (err) {
            toast.error("Erro ao criar pipeline");
        }
        setLoading(false);
    };

    const handleStageChange = (index, value) => {
        const newStages = [...data.stages];
        newStages[index] = value;
        setData({ ...data, stages: newStages });
    };

    const handleAddStage = () => {
        setData({ ...data, stages: [...data.stages, "Nova Etapa"] });
    };

    const handleRemoveStage = (index) => {
        const newStages = data.stages.filter((_, i) => i !== index);
        setData({ ...data, stages: newStages });
    };

    const handleAiSuggest = async () => {
        if (!aiPrompt) return;
        setAiLoading(true);
        try {
            const { data: aiData } = await api.post("/pipelines/ai-suggest", { prompt: aiPrompt });
            if (aiData.stages && Array.isArray(aiData.stages)) {
                setData({ ...data, stages: aiData.stages });
                toast.success("Sugestões aplicadas!");
            }
        } catch (err) {
            toast.error("Erro ao gerar sugestões da IA. Verifique sua API Key.");
        }
        setAiLoading(false);
    };

    const renderStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <div className={classes.stepContent}>
                        <TextField
                            label="Nome do Pipeline"
                            variant="outlined"
                            fullWidth
                            margin="normal"
                            value={data.name}
                            onChange={(e) => setData({ ...data, name: e.target.value })}
                        />
                        <TextField
                            label="Descrição"
                            variant="outlined"
                            fullWidth
                            margin="normal"
                            multiline
                            rows={2}
                            value={data.description}
                            onChange={(e) => setData({ ...data, description: e.target.value })}
                        />
                        <Typography variant="subtitle1" style={{ marginTop: 16 }}>Tipo de Visualização</Typography>
                        <RadioGroup
                            row
                            value={data.type}
                            onChange={(e) => setData({ ...data, type: e.target.value })}
                        >
                            <FormControlLabel value="kanban" control={<Radio color="primary" />} label="Kanban (Colunas)" />
                            <FormControlLabel value="funnel" control={<Radio color="primary" />} label="Funil de Vendas (Lista)" />
                        </RadioGroup>
                    </div>
                );
            case 1:
                return (
                    <div className={classes.stepContent}>
                        <Tabs
                            value={tabValue}
                            onChange={(e, v) => setTabValue(v)}
                            indicatorColor="primary"
                            textColor="primary"
                            variant="fullWidth"
                        >
                            <Tab label="Manual" />
                            {aiEnabled && <Tab icon={<AddIcon fontSize="small" />} label="Assistente de IA" />}
                        </Tabs>

                        <TabPanel value={tabValue} index={0}>
                            <List dense>
                                {data.stages.map((stage, index) => (
                                    <ListItem key={index}>
                                        <TextField
                                            fullWidth
                                            value={stage}
                                            onChange={(e) => handleStageChange(index, e.target.value)}
                                            InputProps={{
                                                startAdornment: <InputAdornment position="start">{index + 1}.</InputAdornment>
                                            }}
                                        />
                                        <ListItemSecondaryAction>
                                            <IconButton edge="end" onClick={() => handleRemoveStage(index)}>
                                                <DeleteIcon />
                                            </IconButton>
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))}
                            </List>
                            <Button
                                startIcon={<AddIcon />}
                                onClick={handleAddStage}
                                color="primary"
                                style={{ marginTop: 8 }}
                            >
                                Adicionar Etapa
                            </Button>
                        </TabPanel>

                        <TabPanel value={tabValue} index={1}>
                            <div className={classes.aiContainer}>
                                <Typography gutterBottom>
                                    Descreva seu processo para a IA sugerir as etapas ideais.
                                </Typography>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={3}
                                    variant="outlined"
                                    placeholder="Ex: Processo de vendas de carros usados, desde o lead até a entrega."
                                    value={aiPrompt}
                                    onChange={(e) => setAiPrompt(e.target.value)}
                                    disabled={aiLoading}
                                />
                                <Box display="flex" justifyContent="flex-end" mt={2}>
                                    <Button
                                        variant="contained"
                                        color="secondary"
                                        startIcon={aiLoading ? <CircularProgress size={20} color="inherit" /> : <AddIcon />}
                                        onClick={handleAiSuggest}
                                        disabled={aiLoading || !aiPrompt}
                                    >
                                        {aiLoading ? "Gerando..." : "Gerar Sugestões"}
                                    </Button>
                                </Box>
                            </div>
                            {/* Mostra preview das stages atuais abaixo também */}
                            <Box mt={2}>
                                <Typography variant="caption" color="textSecondary">Etapas Atuais:</Typography>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                                    {data.stages.map((s, i) => (
                                        <div key={i} style={{
                                            background: '#e0e0e0', padding: '4px 8px', borderRadius: 4, fontSize: 12
                                        }}>
                                            {s}
                                        </div>
                                    ))}
                                </div>
                            </Box>
                        </TabPanel>
                    </div>
                );
            default:
                return "Unknown step";
        }
    };

    return (
        <Dialog open={open} onClose={loading ? null : onClose} maxWidth="md" fullWidth>
            <DialogTitle>Novo Pipeline</DialogTitle>
            <DialogContent dividers>
                <Stepper activeStep={activeStep} alternativeLabel>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>
                {renderStepContent(activeStep)}
            </DialogContent>
            <DialogActions>
                <Button disabled={activeStep === 0 || loading} onClick={handleBack} className={classes.button}>
                    Voltar
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleNext}
                    disabled={loading || (activeStep === 0 && !data.name)}
                    className={classes.button}
                >
                    {activeStep === steps.length - 1 ? (loading ? <CircularProgress size={24} /> : "Criar Pipeline") : "Próximo"}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PipelineWizard;
