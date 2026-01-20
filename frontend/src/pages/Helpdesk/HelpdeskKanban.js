import React, { useState, useEffect, useCallback } from "react";
import { useHistory } from "react-router-dom";
import { makeStyles } from "@material-ui/core/styles";
import {
    Paper,
    Typography,
    Box,
    CircularProgress,
    IconButton,
    Tooltip,
} from "@material-ui/core";
import {
    Fullscreen as FullscreenIcon,
    Refresh as RefreshIcon,
    ArrowBack as ArrowBackIcon,
} from "@material-ui/icons";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import api from "../../services/api";
import openSocket from "../../services/socket-io";
import ProtocolCard from "./ProtocolCard";

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: theme.spacing(2),
        backgroundColor: "#f5f6fa",
    },
    header: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: theme.spacing(2),
        padding: theme.spacing(1, 2),
        backgroundColor: "#fff",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
    },
    title: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
    },
    columnsContainer: {
        display: "flex",
        flexGrow: 1,
        overflowX: "auto",
        gap: theme.spacing(2),
        paddingBottom: theme.spacing(2),
    },
    column: {
        minWidth: 280,
        width: 280,
        display: "flex",
        flexDirection: "column",
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
    },
    columnHeader: {
        padding: theme.spacing(1.5, 2),
        color: "#fff",
        fontWeight: 600,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
    },
    columnBody: {
        flexGrow: 1,
        padding: theme.spacing(1),
        overflowY: "auto",
        maxHeight: "calc(100vh - 200px)",
    },
    badge: {
        backgroundColor: "rgba(255,255,255,0.3)",
        color: "#fff",
        padding: "2px 10px",
        borderRadius: 12,
        fontWeight: 700,
        fontSize: "0.8rem",
    },
    emptyColumn: {
        textAlign: "center",
        padding: theme.spacing(3),
        color: theme.palette.text.secondary,
    },
    loader: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
    },
}));

const HelpdeskKanban = ({ tvMode = false }) => {
    const classes = useStyles();
    const history = useHistory();
    const [columns, setColumns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [recentlyAdded, setRecentlyAdded] = useState(new Set());

    const loadKanbanData = useCallback(async () => {
        try {
            const { data } = await api.get("/protocols/kanban");
            setColumns(data.columns);
        } catch (err) {
            toast.error("Erro ao carregar Kanban");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadKanbanData();

        // Socket connection for real-time updates
        const socket = openSocket();
        if (socket) {
            socket.emit("joinHelpdeskKanban");

            socket.on("protocol", (data) => {
                handleProtocolEvent(data);
            });
        }

        return () => {
            if (socket) {
                socket.disconnect();
            }
        };
    }, [loadKanbanData]);

    const handleProtocolEvent = (data) => {
        const { action, protocol, previousStatus, newStatus } = data;

        if (action === "create") {
            // Add new protocol to appropriate column with animation
            setColumns((prev) =>
                prev.map((col) => {
                    if (col.status === protocol.status) {
                        return {
                            ...col,
                            protocols: [protocol, ...col.protocols],
                        };
                    }
                    return col;
                })
            );
            // Mark as recently added for highlight animation
            setRecentlyAdded((prev) => new Set(prev).add(protocol.id));
            setTimeout(() => {
                setRecentlyAdded((prev) => {
                    const next = new Set(prev);
                    next.delete(protocol.id);
                    return next;
                });
            }, 2000);
        } else if (action === "update") {
            // Move protocol between columns if status changed
            if (previousStatus !== newStatus) {
                setColumns((prev) =>
                    prev.map((col) => {
                        if (col.status === previousStatus) {
                            return {
                                ...col,
                                protocols: col.protocols.filter((p) => p.id !== protocol.id),
                            };
                        }
                        if (col.status === newStatus) {
                            return {
                                ...col,
                                protocols: [protocol, ...col.protocols],
                            };
                        }
                        return col;
                    })
                );
            } else {
                // Just update the protocol in place
                setColumns((prev) =>
                    prev.map((col) => ({
                        ...col,
                        protocols: col.protocols.map((p) =>
                            p.id === protocol.id ? protocol : p
                        ),
                    }))
                );
            }
        }
    };

    const handleCardClick = (protocol) => {
        if (!tvMode) {
            history.push(`/helpdesk/${protocol.id}`);
        }
    };

    const handleTvMode = () => {
        history.push("/helpdesk/tv");
    };

    if (loading) {
        return (
            <Box className={classes.loader}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <div className={classes.root}>
            <Paper className={classes.header}>
                <Box className={classes.title}>
                    {!tvMode && (
                        <IconButton size="small" onClick={() => history.push("/helpdesk")}>
                            <ArrowBackIcon />
                        </IconButton>
                    )}
                    <Typography variant="h5" style={{ fontWeight: 600 }}>
                        🎫 Helpdesk Kanban
                    </Typography>
                </Box>
                <Box>
                    <Tooltip title="Atualizar">
                        <IconButton onClick={loadKanbanData}>
                            <RefreshIcon />
                        </IconButton>
                    </Tooltip>
                    {!tvMode && (
                        <Tooltip title="Modo TV (Tela Cheia)">
                            <IconButton onClick={handleTvMode}>
                                <FullscreenIcon />
                            </IconButton>
                        </Tooltip>
                    )}
                </Box>
            </Paper>

            <div className={classes.columnsContainer}>
                {columns.map((col) => (
                    <div
                        key={col.status}
                        className={classes.column}
                        style={{ backgroundColor: col.bgColor }}
                    >
                        <div
                            className={classes.columnHeader}
                            style={{ backgroundColor: col.color }}
                        >
                            {col.label}
                            <span className={classes.badge}>{col.protocols.length}</span>
                        </div>
                        <div className={classes.columnBody}>
                            <AnimatePresence>
                                {col.protocols.length === 0 ? (
                                    <Typography className={classes.emptyColumn}>
                                        Nenhum protocolo
                                    </Typography>
                                ) : (
                                    col.protocols.map((protocol) => (
                                        <motion.div
                                            key={protocol.id}
                                            initial={{ opacity: 0, y: -20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, x: 100 }}
                                            transition={{ duration: 0.3 }}
                                            layout
                                        >
                                            <ProtocolCard
                                                protocol={protocol}
                                                isNew={recentlyAdded.has(protocol.id)}
                                                onClick={handleCardClick}
                                            />
                                        </motion.div>
                                    ))
                                )}
                            </AnimatePresence>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default HelpdeskKanban;
