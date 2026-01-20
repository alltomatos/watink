import React, { useState, useEffect, useRef } from "react";
import {
    Paper,
    Typography,
    CircularProgress,
    Box,
    TextField,
    IconButton,
    Chip,
    Divider,
    List,
    ListItem,
    ListItemText,
    InputAdornment
} from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import SendIcon from "@material-ui/icons/Send";
import RefreshIcon from "@material-ui/icons/Refresh";
import TrendingUpIcon from "@material-ui/icons/TrendingUp";
import TrendingDownIcon from "@material-ui/icons/TrendingDown";
import RemoveIcon from "@material-ui/icons/Remove";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
    root: {
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        backgroundColor: theme.palette.type === 'dark' ? '#1e293b' : '#f8fafc',
    },
    header: {
        padding: theme.spacing(2),
        borderBottom: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
    },
    content: {
        flex: 1,
        overflowY: "auto",
        padding: theme.spacing(2),
        ...theme.scrollbarStyles,
    },
    insightsCard: {
        padding: theme.spacing(2),
        marginBottom: theme.spacing(2),
        borderRadius: theme.spacing(1),
    },
    sentimentBadge: {
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 12px",
        borderRadius: 20,
        fontWeight: 600,
        fontSize: "0.85rem",
    },
    positive: {
        backgroundColor: "#e8f5e9",
        color: "#2e7d32",
    },
    negative: {
        backgroundColor: "#ffebee",
        color: "#c62828",
    },
    neutral: {
        backgroundColor: "#e3f2fd",
        color: "#1565c0",
    },
    topicChip: {
        margin: theme.spacing(0.5),
    },
    chatContainer: {
        borderTop: `1px solid ${theme.palette.divider}`,
        padding: theme.spacing(2),
        backgroundColor: theme.palette.background.paper,
    },
    messageList: {
        maxHeight: 200,
        overflowY: "auto",
        marginBottom: theme.spacing(1),
    },
    userMessage: {
        backgroundColor: theme.palette.primary.main,
        color: "#fff",
        borderRadius: "12px 12px 0 12px",
        padding: theme.spacing(1, 2),
        marginBottom: theme.spacing(1),
        maxWidth: "80%",
        marginLeft: "auto",
    },
    aiMessage: {
        backgroundColor: theme.palette.type === 'dark' ? '#334155' : '#e2e8f0',
        borderRadius: "12px 12px 12px 0",
        padding: theme.spacing(1, 2),
        marginBottom: theme.spacing(1),
        maxWidth: "80%",
    },
    emptyState: {
        textAlign: "center",
        padding: theme.spacing(4),
        color: theme.palette.text.secondary,
    },
    statsGrid: {
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: theme.spacing(1),
        marginTop: theme.spacing(2),
    },
    statItem: {
        textAlign: "center",
        padding: theme.spacing(1),
        backgroundColor: theme.palette.type === 'dark' ? '#334155' : '#f1f5f9',
        borderRadius: theme.spacing(1),
    }
}));

const ContactAIInsights = ({ contactId, ticketId }) => {
    const classes = useStyles();
    const [loading, setLoading] = useState(true);
    const [insights, setInsights] = useState(null);
    const [question, setQuestion] = useState("");
    const [asking, setAsking] = useState(false);
    const [chatHistory, setChatHistory] = useState([]);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [chatHistory]);

    useEffect(() => {
        if (contactId) {
            fetchInsights();
        }
    }, [contactId]);

    const fetchInsights = async () => {
        setLoading(true);
        try {
            const { data } = await api.get(`/ai/contact/${contactId}/insights`);
            setInsights(data.insights);
        } catch (err) {
            console.error("Erro ao carregar insights:", err);
            if (err.response?.status !== 403) {
                toast.error("Erro ao carregar análise de IA");
            }
        }
        setLoading(false);
    };

    const handleAsk = async () => {
        if (!question.trim() || asking) return;

        const userMsg = { role: "user", content: question };
        setChatHistory(prev => [...prev, userMsg]);
        setQuestion("");
        setAsking(true);

        try {
            const { data } = await api.post("/ai/ask", {
                question,
                contactId
            });

            const aiMsg = { role: "ai", content: data.answer, sources: data.sources };
            setChatHistory(prev => [...prev, aiMsg]);
        } catch (err) {
            console.error("Erro ao perguntar:", err);
            const errorMsg = {
                role: "ai",
                content: "Desculpe, ocorreu um erro ao processar sua pergunta."
            };
            setChatHistory(prev => [...prev, errorMsg]);
        }
        setAsking(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleAsk();
        }
    };

    const getSentimentInfo = (sentiment) => {
        if (sentiment > 0.3) return { label: "Positivo", class: classes.positive, icon: <TrendingUpIcon fontSize="small" /> };
        if (sentiment < -0.3) return { label: "Negativo", class: classes.negative, icon: <TrendingDownIcon fontSize="small" /> };
        return { label: "Neutro", class: classes.neutral, icon: <RemoveIcon fontSize="small" /> };
    };

    if (loading) {
        return (
            <div className={classes.root}>
                <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
                    <CircularProgress />
                </Box>
            </div>
        );
    }

    return (
        <div className={classes.root}>
            <div className={classes.header}>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                        🤖 Assistente IA
                    </Typography>
                    <IconButton size="small" onClick={fetchInsights} title="Atualizar análise">
                        <RefreshIcon fontSize="small" />
                    </IconButton>
                </Box>
            </div>

            <div className={classes.content}>
                {!insights ? (
                    <div className={classes.emptyState}>
                        <Typography variant="body2" gutterBottom>
                            Nenhuma análise disponível ainda.
                        </Typography>
                        <Typography variant="caption">
                            As análises são geradas quando tickets são fechados.
                        </Typography>
                    </div>
                ) : (
                    <>
                        {/* Sentiment and Stats */}
                        <Paper className={classes.insightsCard} variant="outlined">
                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                                <Typography variant="subtitle2">Sentimento Geral</Typography>
                                {insights.averageSentiment !== undefined && (
                                    <span className={`${classes.sentimentBadge} ${getSentimentInfo(insights.averageSentiment).class}`}>
                                        {getSentimentInfo(insights.averageSentiment).icon}
                                        <span style={{ marginLeft: 4 }}>{getSentimentInfo(insights.averageSentiment).label}</span>
                                    </span>
                                )}
                            </Box>

                            <div className={classes.statsGrid}>
                                <div className={classes.statItem}>
                                    <Typography variant="h6">{insights.conversationCount || 0}</Typography>
                                    <Typography variant="caption">Conversas</Typography>
                                </div>
                                <div className={classes.statItem}>
                                    <Typography variant="h6">{insights.totalMessages || 0}</Typography>
                                    <Typography variant="caption">Mensagens</Typography>
                                </div>
                            </div>
                        </Paper>

                        {/* Topics */}
                        {insights.topTopics && insights.topTopics.length > 0 && (
                            <Paper className={classes.insightsCard} variant="outlined">
                                <Typography variant="subtitle2" gutterBottom>Tópicos Frequentes</Typography>
                                <Box>
                                    {insights.topTopics.map((topic, i) => (
                                        <Chip
                                            key={i}
                                            label={topic}
                                            size="small"
                                            className={classes.topicChip}
                                            variant="outlined"
                                            color="primary"
                                        />
                                    ))}
                                </Box>
                            </Paper>
                        )}

                        {/* Recent Summaries */}
                        {insights.recentSummaries && insights.recentSummaries.length > 0 && (
                            <Paper className={classes.insightsCard} variant="outlined">
                                <Typography variant="subtitle2" gutterBottom>Resumos Recentes</Typography>
                                <List dense>
                                    {insights.recentSummaries.map((item, i) => (
                                        <ListItem key={i} style={{ paddingLeft: 0, paddingRight: 0 }}>
                                            <ListItemText
                                                primary={item.summary}
                                                secondary={`Ticket #${item.ticketId}`}
                                                primaryTypographyProps={{ variant: "body2" }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Paper>
                        )}
                    </>
                )}
            </div>

            {/* Chat Section */}
            <div className={classes.chatContainer}>
                <Typography variant="caption" color="textSecondary" gutterBottom style={{ display: "block" }}>
                    Pergunte sobre este contato:
                </Typography>

                {chatHistory.length > 0 && (
                    <div className={classes.messageList}>
                        {chatHistory.map((msg, i) => (
                            <div
                                key={i}
                                className={msg.role === "user" ? classes.userMessage : classes.aiMessage}
                            >
                                <Typography variant="body2" style={{ whiteSpace: "pre-wrap" }}>
                                    {msg.content}
                                </Typography>
                            </div>
                        ))}
                        {asking && (
                            <div className={classes.aiMessage}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <CircularProgress size={14} />
                                    <Typography variant="caption">Pensando...</Typography>
                                </Box>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>
                )}

                <TextField
                    fullWidth
                    size="small"
                    variant="outlined"
                    placeholder="Ex: Qual foi o último problema reportado?"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={asking}
                    InputProps={{
                        endAdornment: (
                            <InputAdornment position="end">
                                <IconButton
                                    size="small"
                                    onClick={handleAsk}
                                    disabled={!question.trim() || asking}
                                    color="primary"
                                >
                                    <SendIcon fontSize="small" />
                                </IconButton>
                            </InputAdornment>
                        )
                    }}
                />
            </div>
        </div>
    );
};

export default ContactAIInsights;
