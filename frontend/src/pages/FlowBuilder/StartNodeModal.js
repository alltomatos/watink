import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    makeStyles,
    IconButton,
    RadioGroup,
    FormControlLabel,
    Radio,
    FormControl,
    FormLabel,
    Select,
    MenuItem,
    InputLabel,
    Box,
    CircularProgress
} from '@material-ui/core';
import { Close as CloseIcon } from '@material-ui/icons';
import api from '../../services/api';
import { toast } from 'react-toastify';

const useStyles = makeStyles((theme) => ({
    dialogTitle: {
        borderBottom: '1px solid #e0e0e0',
        padding: theme.spacing(2),
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    section: {
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(2)
    },
    subSection: {
        marginLeft: theme.spacing(3),
        marginTop: theme.spacing(1),
        padding: theme.spacing(2),
        backgroundColor: '#f5f5f5',
        borderRadius: 4
    },
    formControl: {
        width: '100%',
        marginBottom: theme.spacing(2)
    }
}));

const StartNodeModal = ({ open, onClose, onSave, initialData }) => {
    const classes = useStyles();
    const [triggerType, setTriggerType] = useState(initialData?.triggerType || 'time');
    const [actionType, setActionType] = useState(initialData?.actionType || 'message');
    
    // Data states
    const [connections, setConnections] = useState([]);
    const [pipelines, setPipelines] = useState([]);
    const [loading, setLoading] = useState(false);

    // Selected values
    const [selectedConnection, setSelectedConnection] = useState(initialData?.connectionId || '');
    const [selectedPipeline, setSelectedPipeline] = useState(initialData?.pipelineId || '');

    useEffect(() => {
        if (open) {
            setTriggerType(initialData?.triggerType || 'time');
            setActionType(initialData?.actionType || 'message');
            setSelectedConnection(initialData?.connectionId || '');
            setSelectedPipeline(initialData?.pipelineId || '');
            fetchData();
        }
    }, [open, initialData]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [connectionsRes, pipelinesRes] = await Promise.all([
                api.get('/whatsapp'),
                api.get('/pipelines')
            ]);
            setConnections(connectionsRes.data);
            setPipelines(pipelinesRes.data);
        } catch (err) {
            toast.error("Erro ao carregar dados");
        }
        setLoading(false);
    };

    const handleSave = () => {
        const connectionName = connections.find(c => c.id === selectedConnection)?.name;
        const pipelineName = pipelines.find(p => p.id === selectedPipeline)?.name;

        onSave({
            triggerType,
            actionType: triggerType === 'action' ? actionType : null,
            connectionId: triggerType === 'action' && actionType === 'message' ? selectedConnection : null,
            connectionName: triggerType === 'action' && actionType === 'message' ? connectionName : null,
            pipelineId: triggerType === 'action' && (actionType === 'kanban' || actionType === 'funnel') ? selectedPipeline : null,
            pipelineName: triggerType === 'action' && (actionType === 'kanban' || actionType === 'funnel') ? pipelineName : null,
        });
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <div className={classes.dialogTitle}>
                <Typography variant="h6">Configurar Gatilho Inicial</Typography>
                <IconButton size="small" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </div>

            <DialogContent dividers>
                {loading ? (
                    <Box display="flex" justifyContent="center" p={3}>
                        <CircularProgress />
                    </Box>
                ) : (
                    <>
                        <FormControl component="fieldset" className={classes.section}>
                            <FormLabel component="legend">Tipo de Gatilho</FormLabel>
                            <RadioGroup
                                aria-label="trigger-type"
                                name="triggerType"
                                value={triggerType}
                                onChange={(e) => setTriggerType(e.target.value)}
                            >
                                <FormControlLabel value="time" control={<Radio color="primary" />} label="Tempo (Cronograma)" />
                                <FormControlLabel value="action" control={<Radio color="primary" />} label="Ação (Evento)" />
                            </RadioGroup>
                        </FormControl>

                        {triggerType === 'action' && (
                            <Box className={classes.subSection}>
                                <FormControl className={classes.formControl}>
                                    <InputLabel id="action-type-label">Tipo de Ação</InputLabel>
                                    <Select
                                        labelId="action-type-label"
                                        value={actionType}
                                        onChange={(e) => setActionType(e.target.value)}
                                    >
                                        <MenuItem value="message">Mensagem vinda de uma conexão</MenuItem>
                                        <MenuItem value="kanban">Alteração num quadro Kanban</MenuItem>
                                        <MenuItem value="funnel">Alteração num quadro Funil</MenuItem>
                                    </Select>
                                </FormControl>

                                {actionType === 'message' && (
                                    <FormControl className={classes.formControl}>
                                        <InputLabel id="connection-label">Conexão (WhatsApp)</InputLabel>
                                        <Select
                                            labelId="connection-label"
                                            value={selectedConnection}
                                            onChange={(e) => setSelectedConnection(e.target.value)}
                                            displayEmpty
                                        >
                                            <MenuItem value="">
                                                <em>Todas as conexões</em>
                                            </MenuItem>
                                            {connections.map((conn) => (
                                                <MenuItem key={conn.id} value={conn.id}>
                                                    {conn.name}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                )}

                                {(actionType === 'kanban' || actionType === 'funnel') && (
                                    <FormControl className={classes.formControl}>
                                        <InputLabel id="pipeline-label">Quadro / Funil</InputLabel>
                                        <Select
                                            labelId="pipeline-label"
                                            value={selectedPipeline}
                                            onChange={(e) => setSelectedPipeline(e.target.value)}
                                        >
                                            {pipelines
                                                .filter(p => actionType === 'kanban' ? p.type === 'kanban' : (p.type === 'funnel' || p.type === 'funil'))
                                                .map((pipeline) => (
                                                <MenuItem key={pipeline.id} value={pipeline.id}>
                                                    {pipeline.name}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                )}
                            </Box>
                        )}
                    </>
                )}
            </DialogContent>

            <DialogActions style={{ padding: 16 }}>
                <Button onClick={onClose} color="default" variant="contained" style={{ backgroundColor: '#f44336', color: '#fff' }}>
                    Cancelar
                </Button>
                <Button onClick={handleSave} color="primary" variant="contained">
                    Salvar
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default StartNodeModal;
