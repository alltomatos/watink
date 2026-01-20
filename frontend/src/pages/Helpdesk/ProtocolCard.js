import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Paper, Typography, Avatar, Box } from "@material-ui/core";
import { getBackendUrl } from "../../helpers/urlUtils";

const useStyles = makeStyles((theme) => ({
    card: {
        marginBottom: theme.spacing(1),
        backgroundColor: "#fff",
        borderRadius: 8,
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
        transition: "all 0.3s ease",
        cursor: "pointer",
        "&:hover": {
            transform: "translateY(-2px)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        },
    },
    priorityLow: {
        borderLeft: "4px solid #4CAF50",
    },
    priorityMedium: {
        borderLeft: "4px solid #2196F3",
    },
    priorityHigh: {
        borderLeft: "4px solid #FF9800",
    },
    priorityUrgent: {
        borderLeft: "4px solid #F44336",
        animation: "$pulse 2s infinite",
    },
    "@keyframes pulse": {
        "0%": {
            boxShadow: "0 0 0 0 rgba(244, 67, 54, 0.7)",
        },
        "70%": {
            boxShadow: "0 0 0 10px rgba(244, 67, 54, 0)",
        },
        "100%": {
            boxShadow: "0 0 0 0 rgba(244, 67, 54, 0)",
        },
    },
    avatar: {
        width: 40,
        height: 40,
        marginRight: theme.spacing(1.5),
    },
    protocolNumber: {
        fontWeight: 700,
        fontSize: "0.85rem",
        color: theme.palette.primary.main,
    },
    subject: {
        fontSize: "0.9rem",
        fontWeight: 500,
        maxWidth: 200,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
    },
    contactName: {
        fontSize: "0.75rem",
        color: theme.palette.text.secondary,
    },
    // Animation for newly added cards
    highlight: {
        animation: "$highlightPulse 1s ease-out",
    },
    "@keyframes highlightPulse": {
        "0%": {
            backgroundColor: "#E3F2FD",
        },
        "100%": {
            backgroundColor: "#fff",
        },
    },
}));

const ProtocolCard = ({ protocol, isNew = false, onClick }) => {
    const classes = useStyles();

    const getPriorityClass = (priority) => {
        const map = {
            low: classes.priorityLow,
            medium: classes.priorityMedium,
            high: classes.priorityHigh,
            urgent: classes.priorityUrgent,
        };
        return map[priority] || classes.priorityMedium;
    };

    const getAvatarUrl = () => {
        if (protocol.contact?.profilePicUrl) {
            return getBackendUrl(protocol.contact.profilePicUrl);
        }
        return null;
    };

    return (
        <Paper
            className={`${classes.card} ${getPriorityClass(protocol.priority)} ${isNew ? classes.highlight : ""}`}
            onClick={() => onClick && onClick(protocol)}
        >
            <Box display="flex" alignItems="center" p={1.5}>
                <Avatar
                    src={getAvatarUrl()}
                    alt={protocol.contact?.name || "Contato"}
                    className={classes.avatar}
                >
                    {protocol.contact?.name?.charAt(0) || "?"}
                </Avatar>
                <Box flexGrow={1} overflow="hidden">
                    <Typography className={classes.protocolNumber}>
                        #{protocol.protocolNumber}
                    </Typography>
                    <Typography className={classes.subject} title={protocol.subject}>
                        {protocol.subject}
                    </Typography>
                    <Typography className={classes.contactName}>
                        {protocol.contact?.name || "Sem contato"}
                    </Typography>
                </Box>
            </Box>
        </Paper>
    );
};

export default ProtocolCard;
