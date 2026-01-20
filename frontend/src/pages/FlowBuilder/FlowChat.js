import React, { useState } from 'react';
import {
    Paper,
    TextField,
    IconButton,
    Typography,
    List,
    ListItem,
    ListItemText,
    ListItemAvatar,
    Avatar,
    Box,
    CircularProgress
} from '@material-ui/core';
import SendIcon from '@material-ui/icons/Send';
import ComputerIcon from '@material-ui/icons/Computer';
import PersonIcon from '@material-ui/icons/Person';
import { makeStyles } from '@material-ui/core/styles';
import api from '../../services/api';
import { toast } from 'react-toastify';

const useStyles = makeStyles((theme) => ({
    root: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#fff'
    },
    header: {
        padding: theme.spacing(2),
        backgroundColor: theme.palette.primary.main,
        color: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
    },
    chatArea: {
        flexGrow: 1,
        overflowY: 'auto',
        padding: theme.spacing(2),
        backgroundColor: '#f9f9f9'
    },
    inputArea: {
        padding: theme.spacing(2),
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        alignItems: 'center',
        backgroundColor: '#fff'
    },
    messageBubble: {
        backgroundColor: '#e3f2fd',
        borderRadius: 12,
        padding: theme.spacing(1, 2),
        maxWidth: '85%',
        marginBottom: theme.spacing(1),
        boxShadow: '0 1px 1px rgba(0,0,0,0.05)'
    },
    userBubble: {
        backgroundColor: '#e8f5e9',
        borderRadius: 12,
        padding: theme.spacing(1, 2),
        maxWidth: '85%',
        marginBottom: theme.spacing(1),
        alignSelf: 'flex-end',
        boxShadow: '0 1px 1px rgba(0,0,0,0.05)'
    }
}));

const FlowChat = ({ onFlowGenerated }) => {
    const classes = useStyles();
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [messages, setMessages] = useState([
        { id: 1, text: "Olá! Sou seu assistente de criação de fluxos. Descreva o fluxo que você gostaria de criar.", sender: 'bot' }
    ]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMsg = { id: Date.now(), text: input, sender: 'user' };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // Call Backend AI Service
            const { data } = await api.post('/flows/ai', { prompt: userMsg.text });

            const botMsg = {
                id: Date.now() + 1,
                text: data.message || "Fluxo gerado com sucesso!",
                sender: 'bot'
            };
            setMessages(prev => [...prev, botMsg]);

            if (data.nodes && data.edges) {
                onFlowGenerated(data.nodes, data.edges);
            }

        } catch (err) {
            console.error(err);
            toast.error("Erro ao processar sua solicitação.");
            setMessages(prev => [...prev, { id: Date.now() + 1, text: "Desculpe, tive um problema ao gerar o fluxo. Tente novamente.", sender: 'bot' }]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className={classes.root}>
            <div className={classes.header}>
                <Typography variant="h6" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ComputerIcon /> Flow Assistant
                </Typography>
            </div>

            <List className={classes.chatArea}>
                {messages.map((msg) => (
                    <div
                        key={msg.id}
                        style={{
                            display: 'flex',
                            justifyContent: msg.sender === 'user' ? 'flex-end' : 'flex-start'
                        }}
                    >
                        <div className={msg.sender === 'user' ? classes.userBubble : classes.messageBubble}>
                            <Typography variant="body2">{msg.text}</Typography>
                        </div>
                    </div>
                ))}
                {loading && (
                    <div style={{ display: 'flex', justifyContent: 'flex-start', padding: 10 }}>
                        <CircularProgress size={20} />
                    </div>
                )}
            </List>

            <div className={classes.inputArea}>
                <TextField
                    fullWidth
                    variant="outlined"
                    placeholder="Ex: Crie um fluxo para agendar consultas..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyPress={handleKeyPress}
                    multiline
                    rowsMax={3}
                    disabled={loading}
                    size="small"
                />
                <IconButton color="primary" onClick={handleSend} disabled={loading || !input.trim()}>
                    <SendIcon />
                </IconButton>
            </div>
        </div>
    );
};

export default FlowChat;
