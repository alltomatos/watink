import React, { useState, useEffect } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Grid from "@material-ui/core/Grid";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";
import EditIcon from "@material-ui/icons/Edit";
import { toast } from "react-toastify";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
    mainPaper: {
        flex: 1,
        padding: theme.spacing(2),
        overflowY: "scroll",
        ...theme.scrollbarStyles,
    },
    card: {
        padding: theme.spacing(2),
        cursor: "pointer",
        transition: "transform 0.2s",
        "&:hover": {
            transform: "scale(1.02)",
            boxShadow: "0 4px 20px 0 rgba(0,0,0,0.12)"
        }
    }
}));

const Pipelines = () => {
    const classes = useStyles();
    const history = useHistory();
    const [pipelines, setPipelines] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPipelines();
    }, []);

    const fetchPipelines = async () => {
        try {
            const { data } = await api.get("/pipelines");
            setPipelines(Array.isArray(data) ? data : []);
        } catch (err) {
            toast.error("Erro ao carregar pipelines");
        }
        setLoading(false);
    };

    const handleOpenWizard = () => {
        history.push("/pipelines/new");
    };

    const handleOpenPipeline = (id) => {
        history.push(`/pipelines/${id}`);
    };

    const handleEditPipeline = (e, id) => {
        e.stopPropagation();
        history.push(`/pipelines/${id}/edit`);
    };

    return (
        <MainContainer className={classes.mainContainer}>
            <MainHeader>
                <Title>Pipelines</Title>
                <MainHeaderButtonsWrapper>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleOpenWizard}
                    >
                        Adicionar Pipeline
                    </Button>
                    <input
                        style={{ display: "none" }}
                        id="import-pipeline"
                        type="file"
                        accept=".json"
                        onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;

                            const reader = new FileReader();
                            reader.onload = async (readerEvent) => {
                                try {
                                    const json = JSON.parse(readerEvent.target.result);
                                    await api.post("/pipelines/import", json);
                                    toast.success("Pipeline importado com sucesso!");
                                    fetchPipelines();
                                } catch (err) {
                                    toast.error("Erro ao importar pipeline: " + err.message);
                                }
                            };
                            reader.readAsText(file);
                            e.target.value = ""; // Reset value
                        }}
                    />
                    <label htmlFor="import-pipeline">
                        <Button
                            variant="contained"
                            color="secondary"
                            component="span"
                            style={{ marginLeft: 10 }}
                        >
                            Importar Pipeline
                        </Button>
                    </label>
                </MainHeaderButtonsWrapper>
            </MainHeader>

            <Paper className={classes.mainPaper} variant="outlined">
                <Grid container spacing={2}>
                    {pipelines.map(pipeline => (
                        <Grid item xs={12} sm={6} md={4} key={pipeline.id}>
                            <Paper
                                className={classes.card}
                                variant="outlined"
                                onClick={() => handleOpenPipeline(pipeline.id)}
                                style={{ position: 'relative' }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <h3 style={{ margin: '0 0 8px 0' }}>{pipeline.name}</h3>
                                    <IconButton
                                        size="small"
                                        color="primary"
                                        onClick={(e) => handleEditPipeline(e, pipeline.id)}
                                    >
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                </div>
                                <p>{pipeline.description}</p>
                                <span style={{
                                    background: pipeline.type === 'kanban' ? '#e3f2fd' : '#fff3e0',
                                    color: pipeline.type === 'kanban' ? '#1976d2' : '#f57c00',
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '0.8rem',
                                    width: 'fit-content'
                                }}>
                                    {pipeline.type === 'kanban' ? 'Kanban' : 'Funil de Vendas'}
                                </span>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            </Paper>
        </MainContainer>
    );
};

export default Pipelines;
