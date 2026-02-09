import React, { useState, useEffect } from "react";
import {
    Box,
    Card,
    Typography,
    Button,
    Grid,
    IconButton,
    Tooltip,
    LinearProgress,
    Avatar,
    Menu,
    MenuItem
} from "@material-ui/core";
import { makeStyles, withStyles } from "@material-ui/core/styles";
import {
    Add as AddIcon,
    Visibility as ViewIcon,
    MoreVert as MoreIcon,
    PictureAsPdf as PdfIcon,
    Delete as DeleteIcon,
    Assignment as AssignmentIcon,
} from "@material-ui/icons";
import { format } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";
import { toast } from "react-toastify";

import activityApi from "../../../services/activityApi";
import ActivityModal from "./ActivityModal";

const CustomLinearProgress = withStyles((theme) => ({
    root: {
        height: 6,
        borderRadius: 5,
    },
    colorPrimary: {
        backgroundColor: theme.palette.grey[200],
    },
    bar: {
        borderRadius: 5,
        backgroundColor: "#1a73e8",
    },
}))(LinearProgress);

const useStyles = makeStyles((theme) => ({
    root: {
        marginTop: theme.spacing(2),
    },
    card: {
        padding: theme.spacing(2),
        marginBottom: theme.spacing(2),
        borderRadius: 12,
        boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
        transition: "all 0.3s ease",
        border: "1px solid rgba(0,0,0,0.05)",
        "&:hover": {
            boxShadow: "0 8px 16px rgba(0,0,0,0.1)",
            transform: "translateY(-2px)",
        },
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: theme.spacing(1),
    },
    titleMap: {
        fontSize: "1rem",
        fontWeight: 600,
        color: theme.palette.text.primary,
    },
    statusChip: {
        fontSize: "0.75rem",
        fontWeight: 700,
        padding: "4px 8px",
        borderRadius: 6,
        textTransform: "uppercase",
        letterSpacing: "0.5px",
    },
    statusPending: {
        backgroundColor: "#fff0e6",
        color: "#ff8c00",
    },
    statusInProgress: {
        backgroundColor: "#e3f2fd",
        color: "#1976d2",
    },
    statusDone: {
        backgroundColor: "#e8f5e9",
        color: "#2e7d32",
    },
    statusCancelled: {
        backgroundColor: "#ffebee",
        color: "#d32f2f",
    },
    metaInfo: {
        display: "flex",
        alignItems: "center",
        marginTop: theme.spacing(2),
        gap: theme.spacing(2),
    },
    avatar: {
        width: 24,
        height: 24,
        fontSize: "0.75rem",
        backgroundColor: theme.palette.primary.main,
    },
    emptyState: {
        textAlign: "center",
        padding: theme.spacing(6),
        backgroundColor: theme.palette.background.default,
        borderRadius: 12,
        border: "2px dashed rgba(0,0,0,0.1)",
    },
    addButton: {
        borderRadius: 8,
        textTransform: "none",
        fontWeight: 600,
        padding: "8px 16px",
    },
}));

const ActivityList = ({ protocolId }) => {
    const classes = useStyles();
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedActivityId, setSelectedActivityId] = useState(null);
    const [anchorEl, setAnchorEl] = useState(null);
    const [menuActivity, setMenuActivity] = useState(null);

    useEffect(() => {
        if (protocolId) {
            loadActivities();
        }
    }, [protocolId]);

    const loadActivities = async () => {
        setLoading(true);
        try {
            const { data } = await activityApi.list({ protocolId });
            setActivities(data.activities);
        } catch (err) {
            toast.error("Erro ao carregar atividades");
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (activityId = null) => {
        setSelectedActivityId(activityId);
        setModalOpen(true);
        handleCloseMenu();
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedActivityId(null);
        loadActivities();
    };

    const handleMenuOpen = (event, activity) => {
        setAnchorEl(event.currentTarget);
        setMenuActivity(activity);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
        setMenuActivity(null);
    };

    const handleDelete = async () => {
        if (!menuActivity) return;
        try {
            await activityApi.remove(menuActivity.id);
            toast.success("Atividade removida com sucesso");
            loadActivities();
        } catch (err) {
            toast.error("Erro ao remover atividade");
        }
        handleCloseMenu();
    };

    const handleDownloadPdf = async () => {
        if (!menuActivity) return;
        
        // Open the report in a new tab
        const url = `${process.env.REACT_APP_BACKEND_URL || ""}/helpdesk/report/${menuActivity.id}`;
        // Since we are using HashRouter or similar in SPA, the path is relative to root.
        // Assuming browser router:
        const reportPath = `/helpdesk/report/${menuActivity.id}`;
        window.open(reportPath, '_blank');
        
        handleCloseMenu();
    };

    const getStatusClass = (status) => {
        switch (status) {
            case "in_progress": return classes.statusInProgress;
            case "done": return classes.statusDone;
            case "cancelled": return classes.statusCancelled;
            default: return classes.statusPending;
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case "in_progress": return "Em Andamento";
            case "done": return "Concluído";
            case "cancelled": return "Cancelado";
            default: return "Pendente";
        }
    };

    // Calculate progress based on checklist items (this is a mock calculation as backend might not return stats directly in list)
    // Assuming backend returns check count or we just show status for now. 
    // If backend returns items count:
    const getProgress = (activity) => {
        // If your backend list doesn't return items, this might need adjustment.
        // For visual purpose: 
        if (activity.status === 'done') return 100;
        if (activity.status === 'pending') return 0;
        return 50;
    };

    return (
        <div className={classes.root}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h6" style={{ fontWeight: 600 }}>
                    Relatórios de Atividade (RAT)
                </Typography>
                <Button
                    variant="contained"
                    color="primary"
                    startIcon={<AddIcon />}
                    className={classes.addButton}
                    onClick={() => handleOpenModal(null)}
                >
                    Nova Atividade
                </Button>
            </Box>

            {activities.length === 0 && !loading ? (
                <div className={classes.emptyState}>
                    <AssignmentIcon style={{ fontSize: 48, color: "#ccc", marginBottom: 16 }} />
                    <Typography variant="body1" color="textSecondary">
                        Nenhuma atividade registrada neste protocolo.
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                        Crie um novo RAT para iniciar os trabalhos.
                    </Typography>
                </div>
            ) : (
                <Grid container spacing={2}>
                    {activities.map((activity) => (
                        <Grid item xs={12} md={6} key={activity.id}>
                            <Card className={classes.card} onClick={() => handleOpenModal(activity.id)} style={{ cursor: 'pointer' }}>
                                <div className={classes.header}>
                                    <Typography className={classes.titleMap}>
                                        {activity.title}
                                    </Typography>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleMenuOpen(e, activity);
                                        }}
                                    >
                                        <MoreIcon />
                                    </IconButton>
                                </div>

                                <Box display="flex" alignItems="center" mb={1}>
                                    <span className={`${classes.statusChip} ${getStatusClass(activity.status)}`}>
                                        {getStatusLabel(activity.status)}
                                    </span>
                                </Box>

                                <Tooltip title="Progresso estimado">
                                    <Box width="100%" mt={2}>
                                        <CustomLinearProgress
                                            variant="determinate"
                                            value={getProgress(activity)}
                                        />
                                    </Box>
                                </Tooltip>

                                <div className={classes.metaInfo}>
                                    {activity.user && (
                                        <Tooltip title={`Responsável: ${activity.user.name}`}>
                                            <Avatar className={classes.avatar} src={activity.user.profileImage}>
                                                {activity.user.name.charAt(0)}
                                            </Avatar>
                                        </Tooltip>
                                    )}
                                    <Typography variant="caption" color="textSecondary">
                                        Criado em {format(new Date(activity.createdAt), "dd/MM/yyyy", { locale: ptBR })}
                                    </Typography>
                                </div>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            )}

            <Menu
                anchorEl={anchorEl}
                keepMounted
                open={Boolean(anchorEl)}
                onClose={handleCloseMenu}
            >
                <MenuItem onClick={() => handleOpenModal(menuActivity?.id)}>
                    <ViewIcon fontSize="small" style={{ marginRight: 8 }} /> Abrir
                </MenuItem>
                <MenuItem onClick={handleDownloadPdf}>
                    <PdfIcon fontSize="small" style={{ marginRight: 8 }} /> Gerar PDF
                </MenuItem>
                <MenuItem onClick={handleDelete} style={{ color: "#d32f2f" }}>
                    <DeleteIcon fontSize="small" style={{ marginRight: 8 }} /> Excluir
                </MenuItem>
            </Menu>

            <ActivityModal
                open={modalOpen}
                onClose={handleCloseModal}
                activityId={selectedActivityId}
                protocolId={protocolId}
            />
        </div>
    );
};

export default ActivityList;
