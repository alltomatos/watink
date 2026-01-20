import React, { useState, useRef, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    TextField,
    Typography,
    Box,
    Paper,
    Chip,
    CircularProgress,
    Divider,
    InputAdornment
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
    PlayArrow as PlayIcon,
    CheckCircle as SuccessIcon,
    Error as ErrorIcon,
    Warning as WarningIcon,
    Send as SendIcon,
    Close as CloseIcon,
    FiberManualRecord as DotIcon
} from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
    dialog: {
        '& .MuiDialog-paper': {
            maxWidth: 900,
            width: '100%',
            height: '80vh'
        }
    },
    dialogTitle: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: theme.spacing(1, 2),
        borderBottom: '1px solid #e0e0e0'
    },
    titleLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1)
    },
    dialogContent: {
        display: 'flex',
        padding: 0,
        height: 'calc(100% - 60px)',
        overflow: 'hidden'
    },
    chatArea: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        borderRight: '1px solid #e0e0e0'
    },
    messagesContainer: {
        flex: 1,
        overflowY: 'auto',
        padding: theme.spacing(2),
        background: '#f5f7fb'
    },
    inputArea: {
        padding: theme.spacing(1.5),
        borderTop: '1px solid #e0e0e0',
        background: '#fff'
    },
    logsArea: {
        width: 320,
        display: 'flex',
        flexDirection: 'column',
        background: '#fafafa'
    },
    logsHeader: {
        padding: theme.spacing(1.5),
        borderBottom: '1px solid #e0e0e0',
        fontWeight: 600,
        fontSize: 14
    },
    logsContainer: {
        flex: 1,
        overflowY: 'auto',
        padding: theme.spacing(1)
    },
    contextBox: {
        padding: theme.spacing(1.5),
        borderTop: '1px solid #e0e0e0',
        maxHeight: 150,
        overflowY: 'auto',
        fontSize: 11,
        fontFamily: 'monospace',
        background: '#f0f0f0'
    },
    // Message bubbles
    messageBubble: {
        maxWidth: '80%',
        padding: theme.spacing(1, 1.5),
        borderRadius: 12,
        marginBottom: theme.spacing(1),
        wordBreak: 'break-word'
    },
    userBubble: {
        background: '#dcf8c6',
        marginLeft: 'auto',
        borderBottomRightRadius: 4
    },
    botBubble: {
        background: '#fff',
        marginRight: 'auto',
        borderBottomLeftRadius: 4,
        boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
    },
    messageTime: {
        fontSize: 10,
        color: '#888',
        marginTop: 4,
        textAlign: 'right'
    },
    optionsContainer: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: theme.spacing(1)
    },
    optionChip: {
        cursor: 'pointer',
        '&:hover': {
            background: theme.palette.primary.light,
            color: '#fff'
        }
    },
    // Log items
    logItem: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: theme.spacing(1),
        padding: theme.spacing(0.75),
        marginBottom: theme.spacing(0.5),
        borderRadius: 4,
        fontSize: 12,
        background: '#fff',
        border: '1px solid #eee'
    },
    logIcon: {
        marginTop: 2
    },
    logSuccess: {
        '& $logIcon': { color: '#4caf50' }
    },
    logError: {
        '& $logIcon': { color: '#f44336' },
        background: '#fff5f5',
        borderColor: '#ffcdd2'
    },
    logWarning: {
        '& $logIcon': { color: '#ff9800' },
        background: '#fff8e1',
        borderColor: '#ffe082'
    },
    logPending: {
        '& $logIcon': { color: '#2196f3' }
    },
    logContent: {
        flex: 1
    },
    logLabel: {
        fontWeight: 600,
        color: '#333'
    },
    logMessage: {
        color: '#666',
        fontSize: 11
    },
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        color: '#999'
    },
    flowTypeBadge: {
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 10,
        marginLeft: theme.spacing(1)
    },
    chatBadge: {
        background: '#e3f2fd',
        color: '#1976d2'
    },
    automationBadge: {
        background: '#fff3e0',
        color: '#e65100'
    }
}));

const FlowSimulatorModal = ({ open, onClose, flowId, flowName, onSimulate }) => {
    const classes = useStyles();
    const [testMessage, setTestMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [result?.responses]);

    const handleSimulate = async () => {
        if (!testMessage.trim()) return;

        setLoading(true);
        try {
            const response = await onSimulate(flowId, testMessage);
            setResult(response);
            setTestMessage('');
        } catch (err) {
            setResult({
                success: false,
                error: err.message || 'Erro ao simular fluxo',
                log: [],
                responses: []
            });
        }
        setLoading(false);
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSimulate();
        }
    };

    const handleClose = () => {
        setResult(null);
        setTestMessage('');
        onClose();
    };

    const handleOptionClick = (option) => {
        setTestMessage(option);
    };

    const getLogIcon = (status) => {
        switch (status) {
            case 'success':
                return <SuccessIcon fontSize="small" className={classes.logIcon} />;
            case 'error':
                return <ErrorIcon fontSize="small" className={classes.logIcon} />;
            case 'warning':
                return <WarningIcon fontSize="small" className={classes.logIcon} />;
            default:
                return <DotIcon fontSize="small" className={classes.logIcon} />;
        }
    };

    const getLogClass = (status) => {
        switch (status) {
            case 'success': return classes.logSuccess;
            case 'error': return classes.logError;
            case 'warning': return classes.logWarning;
            default: return classes.logPending;
        }
    };

    const formatTime = (timestamp) => {
        if (!timestamp) return '';
        return new Date(timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    };

    return (
        <Dialog open={open} onClose={handleClose} className={classes.dialog}>
            <Box className={classes.dialogTitle}>
                <Box className={classes.titleLeft}>
                    <PlayIcon color="primary" />
                    <Typography variant="h6">Simular: {flowName}</Typography>
                    {result?.flowType && (
                        <Chip
                            size="small"
                            label={result.flowType === 'chat' ? '💬 Chat' : '⚙️ Automação'}
                            className={`${classes.flowTypeBadge} ${result.flowType === 'chat' ? classes.chatBadge : classes.automationBadge}`}
                        />
                    )}
                </Box>
                <IconButton size="small" onClick={handleClose}>
                    <CloseIcon />
                </IconButton>
            </Box>

            <DialogContent className={classes.dialogContent}>
                {/* Chat/Timeline Area */}
                <Box className={classes.chatArea}>
                    <Box className={classes.messagesContainer}>
                        {!result && !loading && (
                            <Box className={classes.emptyState}>
                                <PlayIcon style={{ fontSize: 48, marginBottom: 8 }} />
                                <Typography>Digite uma mensagem para iniciar a simulação</Typography>
                            </Box>
                        )}

                        {loading && (
                            <Box className={classes.emptyState}>
                                <CircularProgress size={32} style={{ marginBottom: 8 }} />
                                <Typography>Simulando fluxo...</Typography>
                            </Box>
                        )}

                        {result?.responses?.map((msg, idx) => (
                            <Paper
                                key={idx}
                                className={`${classes.messageBubble} ${msg.type === 'user' ? classes.userBubble : classes.botBubble}`}
                                elevation={0}
                            >
                                <Typography variant="body2">{msg.content}</Typography>
                                {msg.options && msg.options.length > 0 && (
                                    <Box className={classes.optionsContainer}>
                                        {msg.options.map((opt, i) => (
                                            <Chip
                                                key={i}
                                                size="small"
                                                label={opt}
                                                variant="outlined"
                                                className={classes.optionChip}
                                                onClick={() => handleOptionClick(opt)}
                                            />
                                        ))}
                                    </Box>
                                )}
                                <Typography className={classes.messageTime}>
                                    {formatTime(msg.timestamp)}
                                </Typography>
                            </Paper>
                        ))}

                        {result && !result.success && (
                            <Paper className={`${classes.messageBubble} ${classes.botBubble}`} elevation={0} style={{ background: '#ffebee' }}>
                                <Typography color="error" variant="body2">
                                    ❌ {result.error}
                                </Typography>
                            </Paper>
                        )}

                        <div ref={messagesEndRef} />
                    </Box>

                    <Box className={classes.inputArea}>
                        <TextField
                            fullWidth
                            variant="outlined"
                            size="small"
                            placeholder="Digite uma mensagem para simular..."
                            value={testMessage}
                            onChange={(e) => setTestMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            disabled={loading}
                            InputProps={{
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            color="primary"
                                            onClick={handleSimulate}
                                            disabled={loading || !testMessage.trim()}
                                        >
                                            <SendIcon />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Box>
                </Box>

                {/* Logs Sidebar */}
                <Box className={classes.logsArea}>
                    <Box className={classes.logsHeader}>
                        📋 Logs de Execução
                    </Box>
                    <Box className={classes.logsContainer}>
                        {(!result?.log || result.log.length === 0) && (
                            <Typography variant="body2" color="textSecondary" style={{ padding: 8, textAlign: 'center' }}>
                                Nenhum log ainda
                            </Typography>
                        )}
                        {result?.log?.map((log, idx) => (
                            <Box key={idx} className={`${classes.logItem} ${getLogClass(log.status)}`}>
                                {getLogIcon(log.status)}
                                <Box className={classes.logContent}>
                                    <Typography className={classes.logLabel}>
                                        {log.nodeLabel}
                                    </Typography>
                                    <Typography className={classes.logMessage}>
                                        {log.action || log.message}
                                    </Typography>
                                </Box>
                            </Box>
                        ))}
                    </Box>

                    {result?.finalContext && (
                        <>
                            <Divider />
                            <Box className={classes.contextBox}>
                                <Typography variant="caption" style={{ fontWeight: 600 }}>
                                    📊 Contexto Final
                                </Typography>
                                <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>
                                    {JSON.stringify(result.finalContext, null, 2)}
                                </pre>
                            </Box>
                        </>
                    )}
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default FlowSimulatorModal;
