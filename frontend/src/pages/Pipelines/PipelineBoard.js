import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import {
    Paper,
    Typography,
    Button,
    Chip,
    CircularProgress
} from "@material-ui/core";
import api from "../../services/api";
import { toast } from "react-toastify";
import PipelineKanban from "./PipelineKanban";
import PipelineFunnelView from "./PipelineFunnelView";
import TicketsTagFilter from "../../components/TicketsTagFilter";

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        flexGrow: 1,
        overflowX: "auto",
        height: "100%",
        padding: theme.spacing(2),
        flexDirection: 'column'
    },
    header: {
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 1,
        marginBottom: theme.spacing(2)
    },
    titleContainer: {
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    }
}));

const PipelineBoard = () => {
    const classes = useStyles();
    const { pipelineId } = useParams();
    const [pipeline, setPipeline] = useState(null);
    const [columns, setColumns] = useState({});
    const [loading, setLoading] = useState(true);
    const [deals, setDeals] = useState([]);
    const [selectedTags, setSelectedTags] = useState([]);

    useEffect(() => {
        fetchPipelineData();
    }, [pipelineId, selectedTags]);

    const fetchPipelineData = async () => {
        try {
            setLoading(true);
            const { data } = await api.get(`/pipelines`);
            const selectedPipeline = data.find(p => p.id === Number(pipelineId));

            if (selectedPipeline) {
                setPipeline(selectedPipeline);

                const { data: dealData } = await api.get(`/deals`, {
                    params: {
                        pipelineId,
                        tags: selectedTags
                    }
                });

                setDeals(dealData.deals);

                // Group deals by stageId
                const stageMap = {};

                selectedPipeline.stages.forEach(stage => {
                    stageMap[stage.id] = {
                        ...stage,
                        items: dealData.deals.filter(d => d.stageId === stage.id)
                    };
                });

                setColumns(stageMap);
            }
            setLoading(false);
        } catch (err) {
            toast.error("Erro ao carregar pipeline");
            setLoading(false);
        }
    };

    const handleDragEnd = async (result) => {
        if (!result.destination) return;

        const { source, destination, draggableId } = result;

        if (source.droppableId !== destination.droppableId) {
            const sourceColumn = columns[source.droppableId];
            const destColumn = columns[destination.droppableId];
            const sourceItems = [...sourceColumn.items];
            const destItems = [...destColumn.items];
            const [removed] = sourceItems.splice(source.index, 1);

            // Speculatively update UI
            destItems.splice(destination.index, 0, removed);

            // Update item locally (stageId change) for other views
            removed.stageId = Number(destination.droppableId);

            setColumns({
                ...columns,
                [source.droppableId]: { ...sourceColumn, items: sourceItems },
                [destination.droppableId]: { ...destColumn, items: destItems }
            });

            // Also update deals list state for other tabs
            setDeals(prev => prev.map(d => d.id === removed.id ? removed : d));

            // API Call
            try {
                await api.put(`/deals/${draggableId}`, {
                    stageId: Number(destination.droppableId),
                    pipelineId: Number(pipelineId)
                });
            } catch (err) {
                toast.error("Erro ao mover card");
                fetchPipelineData(); // Revert on error
            }
        }
    };

    if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}><CircularProgress /></div>;
    if (!pipeline) return <div>Pipeline não encontrado</div>;

    const isEnterprise = pipeline.type === 'funnel' || pipeline.type === 'funil';

    return (
        <div className={classes.root} style={{ padding: 0 }}>
            <Paper square className={classes.header}>
                <div className={classes.titleContainer}>
                    <Typography variant="h6">{pipeline.name}</Typography>
                    <Chip
                        label={pipeline.type === 'kanban' ? 'Kanban' : 'Funil'}
                        color={pipeline.type === 'kanban' ? 'primary' : 'secondary'}
                        size="small"
                        style={{ marginLeft: 8 }}
                    />
                    <div style={{ marginLeft: 20 }}>
                        <TicketsTagFilter
                            selectedTags={selectedTags}
                            onChange={(values) => setSelectedTags(values)}
                        />
                    </div>
                </div>
                <Button
                    variant="outlined"
                    startIcon={<i className="fas fa-file-export" />}
                    onClick={async () => {
                        try {
                            const { data } = await api.get(`/pipelines/export/${pipelineId}`);
                            const json = JSON.stringify(data, null, 2);
                            const blob = new Blob([json], { type: "application/json" });
                            const href = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = href;
                            link.download = `${data.name.replace(/\s+/g, '_')}_pipeline.json`;
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        } catch (err) {
                            toast.error("Erro ao exportar");
                        }
                    }}
                >
                    Exportar
                </Button>
            </Paper>

            {/* View Switching Logic */}
            {isEnterprise ? (
                <PipelineFunnelView
                    pipeline={pipeline}
                    columns={columns}
                    setColumns={setColumns}
                    onDragEnd={handleDragEnd}
                    deals={deals}
                />
            ) : (
                <PipelineKanban
                    pipeline={pipeline}
                    columns={columns}
                    setColumns={setColumns}
                    onDragEnd={handleDragEnd}
                    isEnterprise={false}
                />
            )}
        </div>
    );
};

export default PipelineBoard;
