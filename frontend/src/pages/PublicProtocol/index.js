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
    Grid,
    Avatar,
    makeStyles,
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

const useStyles = makeStyles((theme) => ({
    root: {
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(4),
        backgroundColor: "#f4f6f8",
        minHeight: "100vh",
    },
    headerCard: {
        marginBottom: theme.spacing(3),
        borderRadius: 16,
        boxShadow: "0 4px 20px 0 rgba(0,0,0,0.05)",
    },
    detailCard: {
        height: "100%",
        borderRadius: 16,
        boxShadow: "0 4px 20px 0 rgba(0,0,0,0.05)",
    },
    timelineCard: {
        height: "100%",
        borderRadius: 16,
        boxShadow: "0 4px 20px 0 rgba(0,0,0,0.05)",
    },
    statusChip: {
        fontWeight: "bold",
        borderRadius: 8,
    },
    timelineDot: {
        boxShadow: "none",
    },
    timelineContent: {
        padding: "6px 16px",
    },
    timelineTime: {
        flex: 0.2,
        paddingTop: 8,
    },
    logoBox: {
        display: "flex",
        justifyContent: "center",
        marginBottom: theme.spacing(4),
    },
}));

const PublicProtocol = () => {
    const classes = useStyles();
    const { token } = useParams();
    const [protocol, setProtocol] = useState(null);
    const [loading, setLoading] = useState(true);

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
            case "resolved": return "default"; // Success green handled by style if needed
            case "closed": return "default";
            default: return "default";
        }
    };

    const getHistoryIcon = (action) => {
        switch (action) {
            case "created": return <AssignmentIcon fontSize="small" />;
            case "attachment": return <AttachFileIcon fontSize="small" />;
            case "comment_added": return <PersonIcon fontSize="small" />; // Reusing PersonIcon or CommentIcon if imported
            default: return <EventIcon fontSize="small" />;
        }
    };

    if (loading) {
        return (
            <Box className={classes.root} display="flex" justifyContent="center" alignItems="center">
                <CircularProgress />
            </Box>
        );
    }

    if (!protocol) {
        return (
            <Box className={classes.root}>
                <Container maxWidth="sm">
                    <Paper style={{ padding: 32, textAlign: "center", borderRadius: 16 }}>
                        <Typography variant="h5" color="error" gutterBottom>
                            {i18n.t("publicProtocol.notFound.title")}
                        </Typography>
                        <Typography variant="body2" color="textSecondary">
                            {i18n.t("publicProtocol.notFound.message")}
                        </Typography>
                    </Paper>
                </Container>
            </Box>
        );
    }

    return (
        <Box className={classes.root}>
            <Container maxWidth="lg">
                <Box className={classes.logoBox}>
                    <Typography variant="h5" color="primary" style={{ fontWeight: 800 }}>
                        {protocol.tenant?.name || i18n.t("publicProtocol.defaultTenant")}
                    </Typography>
                </Box>

                <Card className={classes.headerCard}>
                    <CardHeader
                        avatar={
                            <Avatar style={{ backgroundColor: "#3f51b5" }}>
                                <AssignmentIcon />
                            </Avatar>
                        }
                        title={
                            <Typography variant="h5" style={{ fontWeight: 700 }}>
                                {i18n.t("publicProtocol.header.number", { number: protocol.protocolNumber })}
                            </Typography>
                        }
                        subheader={i18n.t("publicProtocol.header.createdAt", { date: format(new Date(protocol.createdAt), "dd/MM/yyyy 'às' HH:mm"), interpolation: { escapeValue: false } })}
                        action={
                            <Box display="flex" gap={1}>
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
                    />
                </Card>

                <Grid container spacing={3}>
                    <Grid item xs={12} md={5}>
                        <Card className={classes.detailCard}>
                            <CardHeader
                                title={i18n.t("publicProtocol.details.title")}
                                titleTypographyProps={{ variant: "h6", style: { fontWeight: 600 } }}
                            />
                            <Divider />
                            <CardContent>
                                <Box mb={3}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        {i18n.t("publicProtocol.details.subject")}
                                    </Typography>
                                    <Typography variant="body1" style={{ fontWeight: 500 }}>
                                        {protocol.subject}
                                    </Typography>
                                </Box>
                                <Box mb={3}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        {i18n.t("publicProtocol.details.description")}
                                    </Typography>
                                    <Typography variant="body1" style={{ whiteSpace: "pre-wrap" }}>
                                        {protocol.description || i18n.t("publicProtocol.details.noDescription")}
                                    </Typography>
                                </Box>
                                <Box mb={3}>
                                    <Typography variant="subtitle2" color="textSecondary">
                                        {i18n.t("publicProtocol.details.category")}
                                    </Typography>
                                    <Chip label={protocol.category || i18n.t("publicProtocol.details.generalCategory")} size="small" />
                                </Box>
                            </CardContent>
                        </Card>

                    </Grid>
                    <Grid item xs={12} md={7}>
                        <Card className={classes.timelineCard}>
                            <CardHeader
                                title={i18n.t("publicProtocol.history.title")}
                                avatar={<HistoryIcon color="action" />}
                                titleTypographyProps={{ variant: "h6", style: { fontWeight: 600 } }}
                            />
                            <Divider />
                            <CardContent>
                                <Timeline align="left">
                                    {protocol.history.map((hist, index) => (
                                        <TimelineItem key={hist.id}>
                                            <TimelineOppositeContent className={classes.timelineTime}>
                                                <Typography variant="caption" color="textSecondary">
                                                    {format(new Date(hist.createdAt), "dd/MM HH:mm")}
                                                </Typography>
                                            </TimelineOppositeContent>
                                            <TimelineSeparator>
                                                <TimelineDot color="primary" variant="outlined" className={classes.timelineDot}>
                                                    {getHistoryIcon(hist.action)}
                                                </TimelineDot>
                                                {index < protocol.history.length - 1 && <TimelineConnector />}
                                            </TimelineSeparator>
                                            <TimelineContent className={classes.timelineContent}>
                                                <Paper elevation={0} style={{ backgroundColor: "#f9f9f9", padding: 12, borderRadius: 8 }}>
                                                    <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                                                        {i18n.t(`publicProtocol.history.actions.${hist.action}`) || hist.action}
                                                    </Typography>
                                                    <Typography variant="body2">
                                                        {hist.comment}
                                                    </Typography>
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
                                                        <Typography variant="caption" color="textSecondary">
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
                    </Grid>
                </Grid>
            </Container>
        </Box>
    );
};

export default PublicProtocol;
