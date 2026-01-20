import React, { useState, useEffect } from 'react';
import { useHistory } from 'react-router-dom';
import { makeStyles } from '@material-ui/core/styles';
import {
    Paper,
    Button,
    Grid,
    Typography,
    Card,
    CardContent,
    CardActions,
    IconButton,
    TextField,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@material-ui/core';
import { Add, Edit, Delete, PlayArrow } from '@material-ui/icons';
import { toast } from 'react-toastify';
import api from '../../services/api';
import MainContainer from '../../components/MainContainer';
import MainHeader from '../../components/MainHeader';
import MainHeaderButtonsWrapper from '../../components/MainHeaderButtonsWrapper';
import Title from '../../components/Title';

const useStyles = makeStyles((theme) => ({
    root: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        padding: theme.spacing(2),
    },
    card: {
        padding: theme.spacing(2),
        minWidth: 275,
        height: '100%',
        cursor: "pointer",
        transition: "transform 0.2s",
        "&:hover": {
            transform: "scale(1.02)",
            boxShadow: "0 4px 20px 0 rgba(0,0,0,0.12)"
        }
    },
    cardContent: {
        flexGrow: 1
    },
    createNewButton: {
        width: '100%',
        height: '100%',
        minHeight: 150,
        border: '2px dashed #ccc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        '&:hover': {
            backgroundColor: '#f5f5f5',
            borderColor: theme.palette.primary.main
        }
    }
}));

const FlowManager = () => {
    const classes = useStyles();
    const history = useHistory();
    const [flows, setFlows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [openModal, setOpenModal] = useState(false);
    const [newFlowName, setNewFlowName] = useState('');
    const [whatsapps, setWhatsapps] = useState([]);
    const [selectedWhatsapp, setSelectedWhatsapp] = useState('');

    useEffect(() => {
        fetchFlows();
        fetchWhatsapps();
    }, []);

    const fetchFlows = async () => {
        setLoading(true);
        try {
            const { data } = await api.get('/flows');
            setFlows(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error("Erro ao carregar fluxos");
        }
        setLoading(false);
    };

    const fetchWhatsapps = async () => {
        try {
            const { data } = await api.get('/whatsapp');
            setWhatsapps(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error("Erro ao carregar conexões");
        }
    };

    const handleCreateFlow = async () => {
        if (!newFlowName) return;
        try {
            const { data } = await api.post('/flows', {
                name: newFlowName,
                whatsappId: selectedWhatsapp ? selectedWhatsapp : null,
                nodes: [{ id: '1', position: { x: 250, y: 50 }, data: { label: 'Início do Fluxo' }, type: 'input' }],
                edges: []
            });
            toast.success("Fluxo criado com sucesso!");
            setOpenModal(false);
            setNewFlowName('');
            setSelectedWhatsapp('');
            history.push(`/flowbuilder/${data.id}`);
        } catch (err) {
            toast.error("Erro ao criar fluxo");
        }
    };

    const handleEditFlow = (id) => {
        history.push(`/flowbuilder/${id}`);
    };

    const isConnectionUsed = (whatsappId) => {
        return flows.some(flow => flow.whatsappId === whatsappId && flow.isActive);
    };

    return (
        <MainContainer>
            <MainHeader>
                <Title>Gerenciador de Fluxos</Title>
                <MainHeaderButtonsWrapper>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<Add />}
                        onClick={() => setOpenModal(true)}
                    >
                        Novo Fluxo
                    </Button>
                </MainHeaderButtonsWrapper>
            </MainHeader>

            <Grid container spacing={3}>
                {flows.map((flow) => (
                    <Grid item xs={12} sm={6} md={4} key={flow.id}>
                        <Paper
                            className={classes.card}
                            variant="outlined"
                            onClick={() => handleEditFlow(flow.id)}
                            style={{ position: 'relative' }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <h3 style={{ margin: '0 0 8px 0' }}>{flow.name}</h3>
                                <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditFlow(flow.id);
                                    }}
                                >
                                    <Edit fontSize="small" />
                                </IconButton>
                            </div>

                            <Typography color="textSecondary" variant="body2" gutterBottom>
                                Status: {flow.isActive ? 'Ativo' : 'Inativo'}
                            </Typography>

                            {flow.whatsapp && (
                                <Typography variant="caption" display="block" color="textPrimary">
                                    Conexão: <strong>{flow.whatsapp.name}</strong>
                                </Typography>
                            )}
                        </Paper>
                    </Grid>
                ))}
            </Grid>

            <Dialog open={openModal} onClose={() => setOpenModal(false)} aria-labelledby="form-dialog-title">
                <DialogTitle id="form-dialog-title">Novo Fluxo</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        id="name"
                        label="Nome do Fluxo"
                        type="text"
                        fullWidth
                        value={newFlowName}
                        onChange={(e) => setNewFlowName(e.target.value)}
                    />

                    <div style={{ marginTop: 20 }}>
                        <Typography variant="caption" color="textSecondary">
                            Vincular Conexão (Opcional)
                        </Typography>
                        <TextField
                            select
                            fullWidth
                            margin="dense"
                            value={selectedWhatsapp}
                            onChange={(e) => setSelectedWhatsapp(e.target.value)}
                            SelectProps={{
                                native: true,
                            }}
                            variant="outlined"
                        >
                            <option value="">Nenhuma (Fluxo Solto)</option>
                            {whatsapps.map((whatsapp) => {
                                const used = isConnectionUsed(whatsapp.id);
                                return (
                                    <option
                                        key={whatsapp.id}
                                        value={whatsapp.id}
                                        disabled={used}
                                    >
                                        {whatsapp.name} {used ? '(Em uso)' : ''}
                                    </option>
                                );
                            })}
                        </TextField>
                    </div>

                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenModal(false)} color="primary">
                        Cancelar
                    </Button>
                    <Button onClick={handleCreateFlow} color="primary">
                        Criar
                    </Button>
                </DialogActions>
            </Dialog>
        </MainContainer>
    );
};

export default FlowManager;
