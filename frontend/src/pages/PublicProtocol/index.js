import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { format } from "date-fns";
import api from "../../services/api";
import {
    Container,
    Paper,
    Typography,
    Box,
    CircularProgress,
    Card,
    CardContent,
    CardHeader,
    Chip,
    Divider,
    Avatar,
    makeStyles,
    useMediaQuery,
    useTheme,
} from "@material-ui/core";
import {
    Timeline,
    TimelineItem,
    TimelineSeparator,
    TimelineConnector,
    TimelineContent,
    TimelineDot,
    TimelineOppositeContent
} from "@material-ui/lab";
import {
    Assignment as AssignmentIcon,
    History as HistoryIcon,
    Person as PersonIcon,
    Event as EventIcon,
    PriorityHigh as PriorityHighIcon,
    AttachFile as AttachFileIcon,
} from "@material-ui/icons";

import { i18n } from "../../translate/i18n";
import AttachmentsList from "../../components/AttachmentsList";
import { getBackendUrl } from "../../helpers/urlUtils";

const useStyles = makeStyles((theme) => ({
    "@keyframes fadeIn": {
        "0%": { opacity: 0, transform: "translateY(20px)" },
        "100%": { opacity: 1, transform: "translateY(0)" },
    },
    root: {
        background: "linear-gradient(135deg, #f6f8fb 0%, #eef2f5 100%)",
        minHeight: "100vh",
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(8),
        fontFamily: theme.typography.fontFamily,
        [theme.breakpoints.down("xs")]: { // < 600px
            paddingTop: theme.spacing(2),
            paddingBottom: theme.spacing(4),
        },
        "@media (max-width: 320px)": {
            padding: theme.spacing(1),
        },
    },
    container: {
        maxWidth: 1280,
        margin: "0 auto",
        width: "100%",
        padding: theme.spacing(0, 2),
        "@media (max-width: 320px)": {
            padding: theme.spacing(0, 1),
        },
    },
    logoBox: {
        display: "flex",
        justifyContent: "center",
        marginBottom: theme.spacing(4),
        animation: "$fadeIn 0.6s ease-out forwards",
        "& img": {
            maxWidth: "100%",
            height: "auto",
            maxHeight: 90,
            objectFit: "contain",
            transition: "transform 0.3s ease",
            "&:hover": {
                transform: "scale(1.02)",
            },
        },
    },
    headerCard: {
        marginBottom: theme.spacing(3),
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.5)",
        boxShadow: "0 10px 30px -5px rgba(0, 0, 0, 0.05)",
        background: "rgba(255, 255, 255, 0.95)",
        backdropFilter: "blur(10px)",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        animation: "$fadeIn 0.6s ease-out 0.1s forwards",
        opacity: 0,
        "&:hover": {
            transform: "translateY(-4px)",
            boxShadow: "0 20px 40px -5px rgba(0, 0, 0, 0.1)",
        },
    },
    gridContainer: {
        display: "grid",
        gridTemplateColumns: "1fr",
        gap: theme.spacing(3),
        width: "100%",
        opacity: 0,
        animation: "$fadeIn 0.6s ease-out 0.2s forwards",
        "@media (min-width: 768px)": {
            gridTemplateColumns: "1fr", // Stacked on tablets usually, or side-by-side? Let's stick to stack for tablet portrait
        },
        "@media (min-width: 1024px)": {
            gridTemplateColumns: "1fr 1.5fr", // Details | History
            alignItems: "start",
        },
    },
    detailCard: {
        height: "100%",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.5)",
        boxShadow: "0 4px 20px 0 rgba(0,0,0,0.03)",
        background: "#ffffff",
        transition: "box-shadow 0.3s ease",
        "&:hover": {
            boxShadow: "0 8px 30px rgba(0,0,0,0.06)",
        },
    },
    timelineCard: {
        height: "100%",
        borderRadius: 16,
        border: "1px solid rgba(255, 255, 255, 0.5)",
        boxShadow: "0 4px 20px 0 rgba(0,0,0,0.03)",
        background: "#ffffff",
    },
    sectionTitle: {
        fontWeight: 700,
        fontSize: "1.1rem",
        color: theme.palette.text.primary,
    },
    statusChip: {
        fontWeight: 700,
        borderRadius: 8,
        height: 32,
        fontSize: "0.875rem",
    },
    timelineDot: {
        boxShadow: "0 0 0 4px rgba(63, 81, 181, 0.1)",
        margin: "11.5px 0",
    },
    timelineItem: {
        "&:before": {
            display: "none !important"
        }
    },
    timelineContent: {
        padding: "6px 16px",
        [theme.breakpoints.down("xs")]: {
            padding: "6px 8px 6px 12px", // Menos padding no mobile
        },
    },
    timelineTime: {
        flex: 0.2,
        paddingTop: 12,
        minWidth: 80,
        "@media (max-width: 768px)": {
            display: "none", // Hide side time on mobile to save space, move inside
        },
    },
    timelinePaper: {
        backgroundColor: "#f8f9fa",
        padding: theme.spacing(2),
        borderRadius: 12,
        border: "1px solid #eef0f2",
        transition: "background-color 0.2s ease",
        "&:hover": {
            backgroundColor: "#f0f2f5",
        },
        [theme.breakpoints.down("xs")]: {
            padding: theme.spacing(1.5), // Card mais compacto no mobile
        },
    },
    headerContentMobile: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        gap: theme.spacing(1),
        width: "100%",
    },
    headerTitleMobile: {
        fontSize: "1.25rem",
        fontWeight: 800,
        wordBreak: "break-word", // Quebra melhor palavras longas
        lineHeight: 1.3,
    },
    mobileTime: {
        display: "none",
        "@media (max-width: 768px)": {
            display: "block",
            marginBottom: 4,
            fontSize: "0.75rem",
            color: theme.palette.text.secondary,
        },
    },
    touchTarget: {
        minWidth: 44,
        minHeight: 44,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
    },
    detailsRow: {
        marginBottom: theme.spacing(3),
        "&:last-child": {
            marginBottom: 0,
        },
    },
    detailsLabel: {
        fontWeight: 600,
        color: theme.palette.text.secondary,
        marginBottom: theme.spacing(0.5),
        display: "block",
        fontSize: "0.85rem",
        textTransform: "uppercase",
        letterSpacing: "0.5px",
    },
    detailsValue: {
        fontSize: "1rem",
        color: theme.palette.text.primary,
        lineHeight: 1.6,
    },
    notFoundPaper: {
        padding: theme.spacing(4),
        textAlign: "center",
        borderRadius: 24,
        boxShadow: "0 20px 60px rgba(0,0,0,0.08)",
    },
}));

const PublicProtocol = () => {
    const classes = useStyles();
    const theme = useTheme();
    const { token } = useParams();
    const [protocol, setProtocol] = useState(null);
    const [loading, setLoading] = useState(true);
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

    useEffect(() => {
        const fetchProtocol = async () => {
            try {
                const { data } = await api.get(`/public/protocols/${token}`);
                setProtocol(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProtocol();
    }, [token]);

    const getStatusColor = (status) => {
        switch (status) {
            case "open": return "primary";
            case "in_progress": return "secondary";
            case "resolved": return "default";
            case "closed": return "default";
            default: return "default";
        }
    };

    const getHistoryIcon = (action) => {
        switch (action) {
            case "created": return <AssignmentIcon fontSize="small" />;
            case "attachment": return <AttachFileIcon fontSize="small" />;
            case "comment_added": return <PersonIcon fontSize="small" />;
            default: return <EventIcon fontSize="small" />;
        }
    };

    const formatActionFallback = (action) => {
        const translationKey = `publicProtocol.history.actions.${action}`;
        const translation = i18n.t(translationKey);
        
        // Se a tradução for igual à chave (falha), aplica fallback
        if (translation === translationKey) {
            const fallbackMap = {
                "activity_created": "Atividade Criada",
                "activity_completed": "Atividade Concluída",
                "activity_cancelled": "Atividade Cancelada",
                "status_changed": "Alteração de Status",
                "priority_changed": "Alteração de Prioridade",
                "commented": "Comentário Adicionado",
                "resolved": "Resolvido"
            };
            return fallbackMap[action] || action.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase());
        }
        return translation;
    };

    if (loading) {
        return (
            <Box className={classes.root} display="flex" justifyContent="center" alignItems="center">
                <CircularProgress size={60} thickness={4} />
            </Box>
        );
    }

    if (!protocol) {
        return (
            <Box className={classes.root} display="flex" alignItems="center" justifyContent="center">
                <Container maxWidth="sm">
                    <Paper className={classes.notFoundPaper}>
                        <Typography variant="h4" color="error" gutterBottom style={{ fontWeight: 700 }}>
                            {i18n.t("publicProtocol.notFound.title")}
                        </Typography>
                        <Typography variant="body1" color="textSecondary" style={{ fontSize: "1.1rem" }}>
                            {i18n.t("publicProtocol.notFound.message")}
                        </Typography>
                    </Paper>
                </Container>
            </Box>
        );
    }

    return (
        <main className={classes.root} role="main">
            <Box className={classes.container}>
                <header className={classes.logoBox}>
                    {protocol.tenantConfig?.systemLogo ? (
                        <img
                            src={getBackendUrl(protocol.tenantConfig.systemLogo)}
                            alt={protocol.tenantConfig?.systemTitle || "Logo"}
                            loading="lazy"
                        />
                    ) : (
                        <Typography variant="h4" color="primary" style={{ fontWeight: 800, letterSpacing: "-0.5px" }}>
                            {protocol.tenantConfig?.systemTitle || protocol.tenant?.name || i18n.t("publicProtocol.defaultTenant")}
                        </Typography>
                    )}
                </header>

                <Card className={classes.headerCard}>
                    {isMobile ? (
                        <Box p={2} className={classes.headerContentMobile}>
                             <Avatar style={{ backgroundColor: theme.palette.primary.main, width: 48, height: 48, boxShadow: "0 4px 10px rgba(63, 81, 181, 0.3)", marginBottom: 8 }}>
                                <AssignmentIcon />
                            </Avatar>
                            <Box>
                                <Typography variant="caption" color="textSecondary" style={{ textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>
                                    Protocolo
                                </Typography>
                                <Typography className={classes.headerTitleMobile} color="textPrimary">
                                    #{protocol.protocolNumber}
                                </Typography>
                            </Box>
                            
                            <Typography variant="body2" color="textSecondary">
                                {i18n.t("publicProtocol.header.createdAt", { date: format(new Date(protocol.createdAt), "dd/MM/yyyy 'às' HH:mm"), interpolation: { escapeValue: false } })}
                            </Typography>

                            <Box display="flex" gap={1} flexWrap="wrap" justifyContent="center" mt={1}>
                                <Chip
                                    label={i18n.t(`publicProtocol.status.${protocol.status}`)}
                                    color={getStatusColor(protocol.status)}
                                    className={classes.statusChip}
                                    size="small"
                                />
                                <Chip
                                    label={i18n.t(`publicProtocol.priority.${protocol.priority}`)}
                                    variant="outlined"
                                    icon={<PriorityHighIcon fontSize="small" />}
                                    className={classes.statusChip}
                                    size="small"
                                />
                            </Box>
                        </Box>
                    ) : (
                        <CardHeader
                            avatar={
                                <Avatar style={{ backgroundColor: theme.palette.primary.main, width: 56, height: 56, boxShadow: "0 4px 10px rgba(63, 81, 181, 0.3)" }}>
                                    <AssignmentIcon fontSize="large" />
                                </Avatar>
                            }
                            title={
                                <Typography variant="h4" style={{ fontWeight: 800, color: theme.palette.text.primary }}>
                                    {i18n.t("publicProtocol.header.number", { number: protocol.protocolNumber })}
                                </Typography>
                            }
                            subheader={
                                <Typography variant="body1" color="textSecondary" style={{ marginTop: 4 }}>
                                    {i18n.t("publicProtocol.header.createdAt", { date: format(new Date(protocol.createdAt), "dd/MM/yyyy 'às' HH:mm"), interpolation: { escapeValue: false } })}
                                </Typography>
                            }
                            action={
                                <Box display="flex" gap={1} flexWrap="wrap" justifyContent="flex-end" className={classes.touchTarget}>
                                    <Chip
                                        label={i18n.t(`publicProtocol.status.${protocol.status}`)}
                                        color={getStatusColor(protocol.status)}
                                        className={classes.statusChip}
                                    />
                                    <Chip
                                        label={i18n.t(`publicProtocol.priority.${protocol.priority}`)}
                                        variant="outlined"
                                        icon={<PriorityHighIcon fontSize="small" />}
                                        className={classes.statusChip}
                                    />
                                </Box>
                            }
                            style={{ padding: 24 }}
                        />
                    )}
                </Card>

                <div className={classes.gridContainer}>
                    {/* Details Section */}
                    <section>
                        <Card className={classes.detailCard}>
                            <CardHeader
                                title={i18n.t("publicProtocol.details.title")}
                                titleTypographyProps={{ className: classes.sectionTitle }}
                                style={{ padding: isMobile ? 16 : 24, paddingBottom: 8 }}
                            />
                            <Divider light />
                            <CardContent style={{ padding: isMobile ? 16 : 24 }}>
                                <div className={classes.detailsRow}>
                                    <span className={classes.detailsLabel}>
                                        {i18n.t("publicProtocol.details.subject")}
                                    </span>
                                    <Typography className={classes.detailsValue} style={{ fontWeight: 600 }}>
                                        {protocol.subject}
                                    </Typography>
                                </div>
                                
                                <div className={classes.detailsRow}>
                                    <span className={classes.detailsLabel}>
                                        {i18n.t("publicProtocol.details.description")}
                                    </span>
                                    <Typography className={classes.detailsValue} style={{ whiteSpace: "pre-wrap" }}>
                                        {protocol.description || i18n.t("publicProtocol.details.noDescription")}
                                    </Typography>
                                </div>

                                <div className={classes.detailsRow}>
                                    <span className={classes.detailsLabel}>
                                        {i18n.t("publicProtocol.details.category")}
                                    </span>
                                    <Chip 
                                        label={protocol.category || i18n.t("publicProtocol.details.generalCategory")} 
                                        size="small"
                                        style={{ fontWeight: 500, borderRadius: 6 }} 
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </section>

                    {/* Timeline Section */}
                    <section>
                        <Card className={classes.timelineCard}>
                            <CardHeader
                                title={i18n.t("publicProtocol.history.title")}
                                avatar={<HistoryIcon color="action" />}
                                titleTypographyProps={{ className: classes.sectionTitle }}
                                style={{ padding: isMobile ? 16 : 24, paddingBottom: 8 }}
                            />
                            <Divider light />
                            <CardContent style={{ padding: isMobile ? 16 : 24 }}>
                                <Timeline align={isMobile ? "left" : "left"} style={{ padding: 0 }}>
                                    {protocol.history.map((hist, index) => (
                                        <TimelineItem key={hist.id} style={{ minHeight: 80 }} className={isMobile ? classes.timelineItem : ""}>
                                            {!isMobile && (
                                                <TimelineOppositeContent className={classes.timelineTime}>
                                                    <Typography variant="caption" color="textSecondary" style={{ fontWeight: 500 }}>
                                                        {format(new Date(hist.createdAt), "dd/MM HH:mm")}
                                                    </Typography>
                                                </TimelineOppositeContent>
                                            )}
                                            <TimelineSeparator>
                                                <TimelineDot color="primary" variant="outlined" className={classes.timelineDot}>
                                                    {getHistoryIcon(hist.action)}
                                                </TimelineDot>
                                                {index < protocol.history.length - 1 && <TimelineConnector style={{ backgroundColor: theme.palette.divider }} />}
                                            </TimelineSeparator>
                                            <TimelineContent className={classes.timelineContent}>
                                                <span className={classes.mobileTime}>
                                                    {format(new Date(hist.createdAt), "dd/MM HH:mm")}
                                                </span>
                                                <Paper elevation={0} className={classes.timelinePaper}>
                                                    <Typography variant="subtitle2" style={{ fontWeight: 700, color: theme.palette.text.primary }}>
                                                        {formatActionFallback(hist.action)}
                                                    </Typography>
                                                    {hist.comment && (
                                                        <Typography variant="body2" style={{ marginTop: 4, color: theme.palette.text.secondary }}>
                                                            {hist.comment}
                                                        </Typography>
                                                    )}
                                                    {hist.action === "attachment" && hist.changes && (
                                                        <Box mt={2}>
                                                            <AttachmentsList
                                                                attachments={(() => {
                                                                    try {
                                                                        const changes = JSON.parse(hist.changes);
                                                                        return changes.files || [];
                                                                    } catch (e) {
                                                                        return [];
                                                                    }
                                                                })()}
                                                                canDelete={false}
                                                                showEmpty={false}
                                                            />
                                                        </Box>
                                                    )}
                                                    <Box mt={1} display="flex" alignItems="center">
                                                        <PersonIcon fontSize="inherit" color="textSecondary" style={{ marginRight: 4 }} />
                                                        <Typography variant="caption" color="textSecondary" style={{ fontWeight: 500 }}>
                                                            {hist.user ? hist.user.name : "Sistema"}
                                                        </Typography>
                                                    </Box>
                                                </Paper>
                                            </TimelineContent>
                                        </TimelineItem>
                                    ))}
                                </Timeline>
                            </CardContent>
                        </Card>
                    </section>
                </div>
            </Box>
        </main>
    );
};

export default PublicProtocol;
