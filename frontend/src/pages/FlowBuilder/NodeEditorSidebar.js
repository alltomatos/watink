import React from 'react';
import {
    Drawer,
    Typography,
    IconButton,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Button,
    List,
    ListItem,
    ListItemSecondaryAction,
    Divider,
    Box,
    Checkbox,
    FormControlLabel,
    FormGroup,
    ListItemText,
    Input
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import {
    Close as CloseIcon,
    Add as AddIcon,
    Delete as DeleteIcon
} from '@material-ui/icons';

import ConditionBuilder from './components/ConditionBuilder';
import FilterBuilder from './components/FilterBuilder';
import DataBuilder from './components/DataBuilder';
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
    drawer: {
        width: 380,
        flexShrink: 0,
    },
    drawerPaper: {
        width: 380,
        padding: theme.spacing(2),
        paddingTop: theme.spacing(8),
    },
    header: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: theme.spacing(2),
        paddingBottom: theme.spacing(1),
        borderBottom: '1px solid #e0e0e0'
    },
    field: {
        marginBottom: theme.spacing(2),
    },
    section: {
        marginTop: theme.spacing(2),
        marginBottom: theme.spacing(2),
    },
    sectionTitle: {
        marginBottom: theme.spacing(1),
        fontWeight: 500,
        color: '#333'
    },
    optionItem: {
        background: '#f5f5f5',
        marginBottom: theme.spacing(1),
        borderRadius: 4
    },
    addButton: {
        marginTop: theme.spacing(1),
    },
    saveButton: {
        marginTop: theme.spacing(3),
    },
    fieldCheckbox: {
        marginRight: theme.spacing(1)
    }
}));

// Títulos por tipo de nó
const nodeTitles = {
    'start': 'Configurar Início',
    'input': 'Configurar Início',
    'trigger': 'Configurar Gatilho',
    'message': 'Configurar Mensagem',
    'menu': 'Configurar Menu',
    'switch': 'Configurar Decisão',
    'pipeline': 'Configurar Pipeline (Kanban)',
    'ticket': 'Configurar Ticket',
    'webhook': 'Configurar Webhook',
    'knowledge': 'Configurar Conhecimento',
    'database': 'Configurar Database',
    'filter': 'Configurar Filtro de Dados',
    'api': 'Configurar Requisição API',
    'helpdesk': 'Configurar Helpdesk',
    'end': 'Configurar Fim',
    'output': 'Configurar Fim',
    'tag': 'Configurar Tag'
};

// Campos disponíveis por tabela para READ
const TABLE_ALL_FIELDS = {
    Contacts: ['id', 'name', 'number', 'email', 'isGroup', 'profilePicUrl', 'createdAt'],
    Tickets: ['id', 'status', 'queueId', 'userId', 'contactId', 'isGroup', 'createdAt', 'updatedAt'],
    Messages: ['id', 'body', 'fromMe', 'mediaType', 'ticketId', 'createdAt'],
    Users: ['id', 'name', 'email', 'profile', 'createdAt'],
    Queues: ['id', 'name', 'color', 'createdAt'],
    Whatsapps: ['id', 'name', 'status', 'isDefault', 'createdAt'],
    QuickAnswers: ['id', 'shortcut', 'message', 'createdAt'],
    Pipelines: ['id', 'name', 'createdAt']
};

const NodeEditorSidebar = ({ open, node, onClose, onSave, onDelete }) => {
    const classes = useStyles();
    const [formData, setFormData] = React.useState({});
    const [pipelines, setPipelines] = React.useState([]);
    const [queues, setQueues] = React.useState([]);
    const [users, setUsers] = React.useState([]);
    const [knowledgeBases, setKnowledgeBases] = React.useState([]);
    const [tags, setTags] = React.useState([]);

    React.useEffect(() => {
        if (node && node.data) {
            setFormData({ ...node.data });
        }
    }, [node]);

    React.useEffect(() => {
        if (node && node.type === 'tag') {
            api.get('/tags')
                .then(res => setTags(res.data))
                .catch(err => console.error("Erro ao carregar tags", err));
        }
        if (node && node.type === 'pipeline') {
            api.get('/pipelines')
                .then(res => setPipelines(res.data))
                .catch(err => console.error("Erro ao carregar pipelines", err));
        }
        if (node && node.type === 'ticket') {
            api.get('/queue')
                .then(res => {
                    setQueues(res.data);
                })
                .catch(err => console.error("Erro ao carregar filas", err));

            api.get('/users')
                .then(res => {
                    setUsers(res.data.users);
                })
                .catch(err => console.error("Erro ao carregar usuários", err));
        }
        if (node && node.type === 'knowledge') {
            api.get('/knowledge-bases')
                .then(res => setKnowledgeBases(res.data))
                .catch(err => console.error("Erro ao carregar bases de conhecimento", err));
        }
    }, [node]);

    if (!node) return null;

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleTagChange = (tagId) => {
        const tag = tags.find(t => t.id === tagId);
        setFormData(prev => ({
            ...prev,
            tagId,
            tagName: tag ? tag.name : ''
        }));
    };

    const handleSave = () => {
        onSave(node.id, formData);
    };

    // Renderiza formulário específico por tipo
    const renderForm = () => {
        switch (node.type) {
            case 'start':
            case 'input':
                return renderStartForm();
            case 'trigger':
                return renderTriggerForm();
            case 'message':
                return renderMessageForm();
            case 'menu':
                return renderMenuForm();
            case 'switch':
                return renderSwitchForm();
            case 'pipeline':
                return renderPipelineForm();
            case 'ticket':
                return renderTicketForm();
            case 'webhook':
                return renderWebhookForm();
            case 'knowledge':
                return renderKnowledgeForm();
            case 'database':
                return renderDatabaseForm();
            case 'filter':
                return renderFilterForm();
            case 'api':
                return renderAPIForm();
            case 'helpdesk':
                return renderHelpdeskForm();
            case 'end':
            case 'output':
                return renderEndForm();
            case 'tag':
                return renderTagForm();
            default:
                return <Typography>Tipo de nó desconhecido</Typography>;
        }
    };

    const renderTagForm = () => (
        <>
            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Ação</InputLabel>
                <Select
                    value={formData.tagAction || 'add'}
                    onChange={(e) => handleChange('tagAction', e.target.value)}
                    label="Ação"
                >
                    <MenuItem value="add">Adicionar Tag</MenuItem>
                    <MenuItem value="remove">Remover Tag</MenuItem>
                </Select>
            </FormControl>

            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Tag</InputLabel>
                <Select
                    value={formData.tagId || ''}
                    onChange={(e) => handleTagChange(e.target.value)}
                    label="Tag"
                >
                    {tags.map(t => (
                        <MenuItem key={t.id} value={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 12, height: 12, borderRadius: 2, backgroundColor: t.color || '#ccc' }}></div>
                            {t.name}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
        </>
    );

    const renderStartForm = () => (
        <>
            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Tipo de Gatilho</InputLabel>
                <Select
                    value={formData.triggerType || 'time'}
                    onChange={(e) => handleChange('triggerType', e.target.value)}
                    label="Tipo de Gatilho"
                >
                    <MenuItem value="time">Tempo/Agendamento</MenuItem>
                    <MenuItem value="action">Ação do Sistema</MenuItem>
                    <MenuItem value="message">Mensagem Recebida</MenuItem>
                    <MenuItem value="webhook">Webhook Externo</MenuItem>
                </Select>
            </FormControl>

            {formData.triggerType === 'action' && (
                <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                    <InputLabel>Tipo de Ação</InputLabel>
                    <Select
                        value={formData.actionType || 'ticketCreated'}
                        onChange={(e) => handleChange('actionType', e.target.value)}
                        label="Tipo de Ação"
                    >
                        <MenuItem value="ticketCreated">Ticket Criado</MenuItem>
                        <MenuItem value="ticketClosed">Ticket Fechado</MenuItem>
                        <MenuItem value="contactCreated">Contato Criado</MenuItem>
                        <MenuItem value="queueChanged">Mudança de Fila</MenuItem>
                    </Select>
                </FormControl>
            )}

            {formData.triggerType === 'message' && (
                <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                    <InputLabel>Conexão</InputLabel>
                    <Select
                        value={formData.whatsappId || 'all'}
                        onChange={(e) => handleChange('whatsappId', e.target.value)}
                        label="Conexão"
                    >
                        <MenuItem value="all">Todas as Conexões</MenuItem>
                        {/* Idealmente carregar da API */}
                    </Select>
                </FormControl>
            )}

            {formData.triggerType === 'webhook' && (
                <>
                    <Box className={classes.section}>
                        <Typography variant="caption" color="textSecondary">
                            URL do Webhook (use este endpoint para disparar o fluxo):
                        </Typography>
                        <TextField
                            fullWidth
                            variant="outlined"
                            size="small"
                            className={classes.field}
                            value={`${window.location.origin}/api/v1/flows/webhook/${formData.webhookToken || 'SEU_TOKEN_AQUI'}`}
                            InputProps={{ readOnly: true }}
                            helperText="Copie esta URL completa para usar em integrações externas"
                        />
                    </Box>
                    <TextField
                        fullWidth
                        label="Token do Webhook"
                        variant="outlined"
                        size="small"
                        className={classes.field}
                        value={formData.webhookToken || ''}
                        onChange={(e) => handleChange('webhookToken', e.target.value)}
                        placeholder="meu-token-unico"
                        helperText="Token único para identificar este fluxo (letras, números e hífens)"
                    />
                </>
            )}
        </>
    );

    const renderTriggerForm = () => (
        <>
            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Tipo de Gatilho</InputLabel>
                <Select
                    value={formData.triggerType || 'keyword'}
                    onChange={(e) => handleChange('triggerType', e.target.value)}
                    label="Tipo de Gatilho"
                >
                    <MenuItem value="keyword">Palavra-chave</MenuItem>
                    <MenuItem value="any">Qualquer Mensagem</MenuItem>
                    <MenuItem value="firstContact">Primeiro Contato</MenuItem>
                </Select>
            </FormControl>

            {formData.triggerType === 'keyword' && (
                <Box className={classes.section}>
                    <Typography variant="subtitle2" className={classes.sectionTitle}>
                        Condição de Ativação
                    </Typography>
                    <ConditionBuilder
                        conditions={formData.conditions || []}
                        onChange={(conditions) => handleChange('conditions', conditions)}
                        title=""
                        maxConditions={3}
                    />
                </Box>
            )}
        </>
    );

    const renderMessageForm = () => (
        <>
            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Tipo de Conteúdo</InputLabel>
                <Select
                    value={formData.contentType || 'text'}
                    onChange={(e) => handleChange('contentType', e.target.value)}
                    label="Tipo de Conteúdo"
                >
                    <MenuItem value="text">Texto</MenuItem>
                    <MenuItem value="image">Imagem</MenuItem>
                    <MenuItem value="video">Vídeo</MenuItem>
                    <MenuItem value="audio">Áudio</MenuItem>
                    <MenuItem value="file">Arquivo</MenuItem>
                </Select>
            </FormControl>

            {formData.contentType === 'text' ? (
                <TextField
                    fullWidth
                    label="Mensagem"
                    variant="outlined"
                    size="small"
                    className={classes.field}
                    multiline
                    rows={5}
                    value={formData.content || ''}
                    onChange={(e) => handleChange('content', e.target.value)}
                    placeholder="Digite a mensagem..."
                />
            ) : (
                <TextField
                    fullWidth
                    label="URL do Arquivo"
                    variant="outlined"
                    size="small"
                    className={classes.field}
                    value={formData.mediaUrl || ''}
                    onChange={(e) => handleChange('mediaUrl', e.target.value)}
                    placeholder="https://..."
                />
            )}

            <Box className={classes.section}>
                <Typography variant="caption" color="textSecondary">
                    Inserir variável:
                </Typography>
                <Box style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
                    {['{{firstName}}', '{{name}}', '{{protocol}}', '{{date}}'].map(v => (
                        <Button
                            key={v}
                            size="small"
                            variant="outlined"
                            onClick={() => handleChange('content', (formData.content || '') + ' ' + v)}
                        >
                            {v.replace(/\{\{|\}\}/g, '')}
                        </Button>
                    ))}
                </Box>
            </Box>
        </>
    );

    const renderMenuForm = () => {
        const options = formData.options || [{ id: 'opt1', label: 'Opção 1' }];

        const addOption = () => {
            const newOptions = [...options, { id: `opt${Date.now()}`, label: `Opção ${options.length + 1}` }];
            handleChange('options', newOptions);
        };

        const removeOption = (optId) => {
            const newOptions = options.filter(o => o.id !== optId);
            handleChange('options', newOptions);
        };

        const updateOption = (optId, newLabel) => {
            const newOptions = options.map(o => o.id === optId ? { ...o, label: newLabel } : o);
            handleChange('options', newOptions);
        };

        return (
            <>
                <TextField
                    fullWidth
                    label="Título do Menu"
                    variant="outlined"
                    size="small"
                    className={classes.field}
                    value={formData.menuTitle || ''}
                    onChange={(e) => handleChange('menuTitle', e.target.value)}
                    placeholder="Escolha uma opção:"
                />

                <Typography variant="subtitle2" className={classes.section}>
                    Opções do Menu
                </Typography>
                <List dense>
                    {options.map((opt, index) => (
                        <ListItem key={opt.id} className={classes.optionItem}>
                            <TextField
                                fullWidth
                                size="small"
                                value={opt.label}
                                onChange={(e) => updateOption(opt.id, e.target.value)}
                                variant="standard"
                            />
                            <ListItemSecondaryAction>
                                <IconButton edge="end" size="small" onClick={() => removeOption(opt.id)}>
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </ListItemSecondaryAction>
                        </ListItem>
                    ))}
                </List>
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addOption}
                    className={classes.addButton}
                >
                    Adicionar Opção
                </Button>
            </>
        );
    };

    const renderSwitchForm = () => (
        <>
            <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
                Configure quando seguir para a <strong>Opção A</strong> (verde).
                Caso contrário, seguirá para <strong>Opção B</strong> (vermelho).
            </Typography>

            <Box className={classes.section}>
                <Typography variant="subtitle2" className={classes.sectionTitle}>
                    Condição para Opção A
                </Typography>
                <ConditionBuilder
                    conditions={formData.conditionsA || []}
                    onChange={(conditions) => handleChange('conditionsA', conditions)}
                    title=""
                    maxConditions={3}
                />
            </Box>
        </>
    );

    const renderTicketForm = () => (
        <>
            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Ação do Ticket</InputLabel>
                <Select
                    value={formData.ticketAction || 'moveToQueue'}
                    onChange={(e) => handleChange('ticketAction', e.target.value)}
                    label="Ação do Ticket"
                >
                    <MenuItem value="moveToQueue">Mover para Fila</MenuItem>
                    <MenuItem value="assignUser">Atribuir Atendente</MenuItem>
                    <MenuItem value="changeStatus">Alterar Status</MenuItem>
                </Select>
            </FormControl>

            {formData.ticketAction === 'changeStatus' && (
                <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                    <InputLabel>Novo Status</InputLabel>
                    <Select
                        value={formData.newStatus || 'open'}
                        onChange={(e) => handleChange('newStatus', e.target.value)}
                        label="Novo Status"
                    >
                        <MenuItem value="open">Aberto</MenuItem>
                        <MenuItem value="pending">Pendente</MenuItem>
                        <MenuItem value="closed">Fechado</MenuItem>
                    </Select>
                </FormControl>
            )}

            {/* Campos de ID para Fila e Usuário (Adicionando suporte real) */}
            {formData.ticketAction === 'moveToQueue' && (
                <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                    <InputLabel>Fila</InputLabel>
                    <Select
                        value={formData.queueId || ''}
                        onChange={(e) => handleChange('queueId', e.target.value)}
                        label="Fila"
                    >
                        {queues.map(q => (
                            <MenuItem key={q.id} value={q.id} style={{ color: q.color }}>
                                {q.name}
                            </MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}

            {formData.ticketAction === 'assignUser' && (
                <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                    <InputLabel>Usuário (Atendente)</InputLabel>
                    <Select
                        value={formData.userId || ''}
                        onChange={(e) => handleChange('userId', e.target.value)}
                        label="Usuário (Atendente)"
                    >
                        {users.map(u => (
                            <MenuItem key={u.id} value={u.id}>{u.name}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            )}
        </>
    );

    const renderWebhookForm = () => (
        <>
            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Método</InputLabel>
                <Select
                    value={formData.method || 'POST'}
                    onChange={(e) => handleChange('method', e.target.value)}
                    label="Método"
                >
                    <MenuItem value="GET">GET</MenuItem>
                    <MenuItem value="POST">POST</MenuItem>
                    <MenuItem value="PUT">PUT</MenuItem>
                    <MenuItem value="DELETE">DELETE</MenuItem>
                    <MenuItem value="PATCH">PATCH</MenuItem>
                </Select>
            </FormControl>

            <TextField
                fullWidth
                label="URL"
                variant="outlined"
                size="small"
                className={classes.field}
                value={formData.url || ''}
                onChange={(e) => handleChange('url', e.target.value)}
                placeholder="https://api.exemplo.com/webhook"
            />

            <Typography variant="subtitle2" style={{ marginTop: 16 }}>Headers (JSON)</Typography>
            <TextField
                fullWidth
                variant="outlined"
                size="small"
                className={classes.field}
                multiline
                rows={3}
                value={formData.headers || ''}
                onChange={(e) => handleChange('headers', e.target.value)}
                placeholder='{ "Authorization": "Bearer 123" }'
            />

            <Typography variant="subtitle2" style={{ marginTop: 16 }}>Body (JSON)</Typography>
            <TextField
                fullWidth
                variant="outlined"
                size="small"
                className={classes.field}
                multiline
                rows={5}
                value={formData.body || ''}
                onChange={(e) => handleChange('body', e.target.value)}
                placeholder='{ "nome": "{{contact.name}}", "telefone": "{{contact.number}}" }'
            />

            <Typography variant="subtitle2" style={{ marginTop: 16 }}>Dados do Contato</Typography>
            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <Select
                    multiple
                    value={formData.contactFields || []}
                    onChange={(e) => handleChange('contactFields', e.target.value)}
                    input={<Input />}
                    renderValue={(selected) => selected.join(', ')}
                    MenuProps={{
                        anchorOrigin: {
                            vertical: "bottom",
                            horizontal: "left"
                        },
                        transformOrigin: {
                            vertical: "top",
                            horizontal: "left"
                        },
                        getContentAnchorEl: null,
                    }}
                >
                    {['name', 'number', 'email', 'profilePicUrl', 'id'].map((name) => (
                        <MenuItem key={name} value={name}>
                            <Checkbox checked={(formData.contactFields || []).indexOf(name) > -1} />
                            <ListItemText primary={name} />
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Typography variant="subtitle2" style={{ marginTop: 16 }}>Dados do Ticket</Typography>
            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <Select
                    multiple
                    value={formData.ticketFields || []}
                    onChange={(e) => handleChange('ticketFields', e.target.value)}
                    input={<Input />}
                    renderValue={(selected) => selected.join(', ')}
                    MenuProps={{
                        anchorOrigin: {
                            vertical: "bottom",
                            horizontal: "left"
                        },
                        transformOrigin: {
                            vertical: "top",
                            horizontal: "left"
                        },
                        getContentAnchorEl: null,
                    }}
                >
                    {['id', 'status', 'queueId', 'userId', 'lastMessage', 'chatbot'].map((name) => (
                        <MenuItem key={name} value={name}>
                            <Checkbox checked={(formData.ticketFields || []).indexOf(name) > -1} />
                            <ListItemText primary={name} />
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Typography variant="subtitle2" style={{ marginTop: 16 }}>Dados do Pipeline (CRM)</Typography>
            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <Select
                    multiple
                    value={formData.pipelineFields || []}
                    onChange={(e) => handleChange('pipelineFields', e.target.value)}
                    input={<Input />}
                    renderValue={(selected) => selected.join(', ')}
                    MenuProps={{
                        anchorOrigin: {
                            vertical: "bottom",
                            horizontal: "left"
                        },
                        transformOrigin: {
                            vertical: "top",
                            horizontal: "left"
                        },
                        getContentAnchorEl: null,
                    }}
                >
                    {['dealTitle', 'dealValue', 'pipelineName', 'stageName', 'dealId', 'priority'].map((name) => (
                        <MenuItem key={name} value={name}>
                            <Checkbox checked={(formData.pipelineFields || []).indexOf(name) > -1} />
                            <ListItemText primary={name} />
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <FormControlLabel
                control={
                    <Checkbox
                        checked={formData.includeContext || false}
                        onChange={(e) => handleChange('includeContext', e.target.checked)}
                        name="includeContext"
                        color="primary"
                    />
                }
                label="Incluir Contexto do Fluxo"
            />
            <FormControlLabel
                control={
                    <Checkbox
                        checked={formData.fullData || false}
                        onChange={(e) => handleChange('fullData', e.target.checked)}
                        name="fullData"
                        color="primary"
                    />
                }
                label="Enviar todos os dados (Contato, Ticket, Pipeline)"
            />
        </>
    );

    const renderAPIForm = () => (
        <>
            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Método</InputLabel>
                <Select
                    value={formData.method || 'GET'}
                    onChange={(e) => handleChange('method', e.target.value)}
                    label="Método"
                >
                    <MenuItem value="GET">GET</MenuItem>
                    <MenuItem value="POST">POST</MenuItem>
                    <MenuItem value="PUT">PUT</MenuItem>
                    <MenuItem value="DELETE">DELETE</MenuItem>
                    <MenuItem value="PATCH">PATCH</MenuItem>
                </Select>
            </FormControl>

            <TextField
                fullWidth
                label="URL"
                variant="outlined"
                size="small"
                className={classes.field}
                value={formData.url || ''}
                onChange={(e) => handleChange('url', e.target.value)}
                placeholder="https://api.exemplo.com/dados"
            />

            <Typography variant="subtitle2" style={{ marginTop: 16 }}>Headers (JSON)</Typography>
            <TextField
                fullWidth
                variant="outlined"
                size="small"
                className={classes.field}
                multiline
                rows={3}
                value={formData.headers || ''}
                onChange={(e) => handleChange('headers', e.target.value)}
                placeholder='{ "Authorization": "Bearer 123" }'
            />

            <Typography variant="subtitle2" style={{ marginTop: 16 }}>Body (JSON)</Typography>
            <TextField
                fullWidth
                variant="outlined"
                size="small"
                className={classes.field}
                multiline
                rows={5}
                value={formData.body || ''}
                onChange={(e) => handleChange('body', e.target.value)}
                placeholder='{ "id": "{{contact.id}}" }'
            />

            <Typography variant="subtitle2" style={{ marginTop: 16 }}>Saída</Typography>
            <TextField
                fullWidth
                label="Nome da Variável de Resultado"
                variant="outlined"
                size="small"
                className={classes.field}
                value={formData.resultVariable || ''}
                onChange={(e) => handleChange('resultVariable', e.target.value)}
                placeholder="Ex: resultadoApi"
                helperText="O resultado será salvo em {{resultadoApi}}"
            />
        </>
    );

    const renderPipelineForm = () => (
        <>
            <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
                Integração com Kanban/Pipelines (CRM).
            </Typography>

            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Ação Kanban</InputLabel>
                <Select
                    value={formData.kanbanAction || 'createDeal'}
                    onChange={(e) => handleChange('kanbanAction', e.target.value)}
                    label="Ação Kanban"
                >
                    <MenuItem value="createDeal">Criar Oportunidade</MenuItem>
                    <MenuItem value="moveDeal">Mover Oportunidade</MenuItem>
                </Select>
            </FormControl>

            {/* Campos para Criação de Oportunidade */}
            {formData.kanbanAction === 'createDeal' && (
                <>
                    <TextField
                        fullWidth
                        label="Título da Oportunidade"
                        variant="outlined"
                        size="small"
                        className={classes.field}
                        value={formData.dealTitle || ''}
                        onChange={(e) => handleChange('dealTitle', e.target.value)}
                        helperText="Use variáveis como {{contactName}}"
                    />
                    <TextField
                        fullWidth
                        label="Valor (R$)"
                        variant="outlined"
                        size="small"
                        className={classes.field}
                        value={formData.dealValue || ''}
                        onChange={(e) => handleChange('dealValue', e.target.value)}
                        helperText="Ex: 150.00"
                    />
                    <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                        <InputLabel>Prioridade</InputLabel>
                        <Select
                            value={formData.dealPriority || '1'}
                            onChange={(e) => handleChange('dealPriority', e.target.value)}
                            label="Prioridade"
                        >
                            <MenuItem value="1">Baixa</MenuItem>
                            <MenuItem value="2">Média</MenuItem>
                            <MenuItem value="3">Alta</MenuItem>
                        </Select>
                    </FormControl>
                </>
            )}

            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Pipeline</InputLabel>
                <Select
                    value={formData.pipelineId || ''}
                    onChange={(e) => handleChange('pipelineId', e.target.value)}
                    label="Pipeline"
                >
                    {pipelines.map(p => (
                        <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                    ))}
                </Select>
            </FormControl>

            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Etapa (Coluna)</InputLabel>
                <Select
                    value={formData.stageId || ''}
                    onChange={(e) => handleChange('stageId', e.target.value)}
                    label="Etapa (Coluna)"
                    disabled={!formData.pipelineId}
                >
                    {pipelines.find(p => p.id === formData.pipelineId)?.stages?.map(s => (
                        <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
                    ))}
                </Select>
            </FormControl>
        </>
    );

    const renderKnowledgeForm = () => (
        <>
            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Modo de Resposta</InputLabel>
                <Select
                    value={formData.responseMode || 'auto'}
                    onChange={(e) => handleChange('responseMode', e.target.value)}
                    label="Modo de Resposta"
                >
                    <MenuItem value="auto">Resposta Automática (IA)</MenuItem>
                    <MenuItem value="suggest">Sugestão para Atendente</MenuItem>
                    <MenuItem value="search">Apenas Busca</MenuItem>
                </Select>
            </FormControl>

            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Base de Conhecimento</InputLabel>
                <Select
                    value={formData.knowledgeBaseId || ''}
                    onChange={(e) => handleChange('knowledgeBaseId', e.target.value)}
                    label="Base de Conhecimento"
                >

                    <MenuItem value=""><em>Selecione</em></MenuItem>
                    {knowledgeBases.map(kb => (
                        <MenuItem key={kb.id} value={kb.id}>{kb.name}</MenuItem>
                    ))}
                </Select>
            </FormControl>
        </>
    );

    const renderHelpdeskForm = () => (
        <>
            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Ação do Helpdesk</InputLabel>
                <Select
                    value={formData.helpdeskAction || 'createProtocol'}
                    onChange={(e) => handleChange('helpdeskAction', e.target.value)}
                    label="Ação do Helpdesk"
                >
                    <MenuItem value="createProtocol">Criar Protocolo</MenuItem>
                    <MenuItem value="checkStatus">Verificar Status</MenuItem>
                </Select>
            </FormControl>

            {formData.helpdeskAction === 'createProtocol' && (
                <>
                    <TextField
                        fullWidth
                        label="Assunto"
                        variant="outlined"
                        size="small"
                        className={classes.field}
                        value={formData.subject || ''}
                        onChange={(e) => handleChange('subject', e.target.value)}
                        placeholder="Protocolo via Fluxo"
                        helperText="Use variáveis como {{contactName}}"
                    />

                    <TextField
                        fullWidth
                        label="Descrição"
                        variant="outlined"
                        size="small"
                        className={classes.field}
                        multiline
                        rows={3}
                        value={formData.description || ''}
                        onChange={(e) => handleChange('description', e.target.value)}
                        placeholder="Detalhes do protocolo..."
                    />

                    <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                        <InputLabel>Prioridade</InputLabel>
                        <Select
                            value={formData.priority || 'medium'}
                            onChange={(e) => handleChange('priority', e.target.value)}
                            label="Prioridade"
                        >
                            <MenuItem value="low">Baixa</MenuItem>
                            <MenuItem value="medium">Média</MenuItem>
                            <MenuItem value="high">Alta</MenuItem>
                            <MenuItem value="urgent">Urgente</MenuItem>
                        </Select>
                    </FormControl>

                    <TextField
                        fullWidth
                        label="Categoria"
                        variant="outlined"
                        size="small"
                        className={classes.field}
                        value={formData.category || ''}
                        onChange={(e) => handleChange('category', e.target.value)}
                        placeholder="Fluxo Automatizado"
                    />
                </>
            )}
        </>
    );

    const renderEndForm = () => (
        <>
            <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                <InputLabel>Ação de Finalização</InputLabel>
                <Select
                    value={formData.endAction || 'none'}
                    onChange={(e) => handleChange('endAction', e.target.value)}
                    label="Ação de Finalização"
                >
                    <MenuItem value="none">Apenas Finalizar</MenuItem>
                    <MenuItem value="closeTicket">Fechar Ticket</MenuItem>
                    <MenuItem value="transferQueue">Transferir para Fila</MenuItem>
                    <MenuItem value="sendMessage">Enviar Mensagem Final</MenuItem>
                </Select>
            </FormControl>

            {formData.endAction === 'sendMessage' && (
                <TextField
                    fullWidth
                    label="Mensagem de Encerramento"
                    variant="outlined"
                    size="small"
                    className={classes.field}
                    multiline
                    rows={3}
                    value={formData.endMessage || ''}
                    onChange={(e) => handleChange('endMessage', e.target.value)}
                    placeholder="Obrigado pelo contato!"
                />
            )}
        </>
    );

    const renderDatabaseForm = () => {
        const availableTables = [
            'Contacts', 'Tickets', 'Messages', 'Users',
            'Queues', 'Whatsapps', 'QuickAnswers', 'Pipelines'
        ];

        const tableFields = TABLE_ALL_FIELDS[formData.tableName] || [];

        return (
            <>
                <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                    <InputLabel>Operação</InputLabel>
                    <Select
                        value={formData.operation || 'read'}
                        onChange={(e) => handleChange('operation', e.target.value)}
                        label="Operação"
                    >
                        <MenuItem value="read">READ - Buscar dados</MenuItem>
                        <MenuItem value="update">UPDATE - Atualizar registro</MenuItem>
                    </Select>
                </FormControl>

                <FormControl fullWidth className={classes.field} variant="outlined" size="small">
                    <InputLabel>Tabela</InputLabel>
                    <Select
                        value={formData.tableName || ''}
                        onChange={(e) => {
                            handleChange('tableName', e.target.value);
                            handleChange('filters', []);
                            handleChange('dataFields', []);
                            handleChange('selectedFields', []);
                        }}
                        label="Tabela"
                    >
                        {availableTables.map(table => (
                            <MenuItem key={table} value={table}>{table}</MenuItem>
                        ))}
                    </Select>
                </FormControl>

                {/* Filtros NOCODE */}
                {(formData.operation === 'read' || formData.operation === 'update') && formData.tableName && (
                    <Box className={classes.section}>
                        <FilterBuilder
                            filters={formData.filters || []}
                            onChange={(filters) => handleChange('filters', filters)}
                            tableName={formData.tableName}
                        />
                    </Box>
                )}

                {/* Dados para UPDATE */}
                {formData.operation === 'update' && formData.tableName && (
                    <Box className={classes.section}>
                        <DataBuilder
                            dataFields={formData.dataFields || []}
                            onChange={(dataFields) => handleChange('dataFields', dataFields)}
                            tableName={formData.tableName}
                        />
                    </Box>
                )}

                {/* Campos para READ */}
                {formData.operation === 'read' && formData.tableName && (
                    <Box className={classes.section}>
                        <Typography variant="subtitle2" style={{ marginBottom: 8, color: '#666' }}>
                            Campos a retornar
                        </Typography>
                        <FormGroup row>
                            {tableFields.map(field => (
                                <FormControlLabel
                                    key={field}
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={(formData.selectedFields || []).includes(field)}
                                            onChange={(e) => {
                                                const current = formData.selectedFields || [];
                                                if (e.target.checked) {
                                                    handleChange('selectedFields', [...current, field]);
                                                } else {
                                                    handleChange('selectedFields', current.filter(f => f !== field));
                                                }
                                            }}
                                        />
                                    }
                                    label={field}
                                    className={classes.fieldCheckbox}
                                />
                            ))}
                        </FormGroup>
                    </Box>
                )}

                {/* Limite e Ordenação para READ */}
                {formData.operation === 'read' && formData.tableName && (
                    <Box style={{ display: 'flex', gap: 8 }}>
                        <FormControl variant="outlined" size="small" style={{ width: 100 }}>
                            <InputLabel>Limite</InputLabel>
                            <Select
                                value={formData.limit || 10}
                                onChange={(e) => handleChange('limit', e.target.value)}
                                label="Limite"
                            >
                                <MenuItem value={1}>1</MenuItem>
                                <MenuItem value={5}>5</MenuItem>
                                <MenuItem value={10}>10</MenuItem>
                                <MenuItem value={25}>25</MenuItem>
                                <MenuItem value={50}>50</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl variant="outlined" size="small" style={{ flex: 1 }}>
                            <InputLabel>Ordenar por</InputLabel>
                            <Select
                                value={formData.orderByField || 'createdAt'}
                                onChange={(e) => handleChange('orderByField', e.target.value)}
                                label="Ordenar por"
                            >
                                {tableFields.map(field => (
                                    <MenuItem key={field} value={field}>{field}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl variant="outlined" size="small" style={{ width: 100 }}>
                            <InputLabel>Direção</InputLabel>
                            <Select
                                value={formData.orderByDir || 'DESC'}
                                onChange={(e) => handleChange('orderByDir', e.target.value)}
                                label="Direção"
                            >
                                <MenuItem value="ASC">ASC ↑</MenuItem>
                                <MenuItem value="DESC">DESC ↓</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                )}

                {/* Variável de saída */}
                <TextField
                    fullWidth
                    label="Variável de saída"
                    variant="outlined"
                    size="small"
                    className={classes.field}
                    style={{ marginTop: 16 }}
                    value={formData.outputVariable || ''}
                    onChange={(e) => handleChange('outputVariable', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="resultado"
                    helperText="Nome da variável (apenas letras, números e _)"
                />
            </>
        );
    };

    // Formulário do Filter Node
    const renderFilterForm = () => {
        // Campos disponíveis para filtrar (comum em arrays de objetos)
        const FILTERABLE_FIELDS = [
            { value: 'id', label: 'ID' },
            { value: 'name', label: 'Nome' },
            { value: 'status', label: 'Status' },
            { value: 'email', label: 'E-mail' },
            { value: 'number', label: 'Número' },
            { value: 'body', label: 'Conteúdo' },
            { value: 'queueId', label: 'ID da Fila' },
            { value: 'userId', label: 'ID do Usuário' },
            { value: 'createdAt', label: 'Data de Criação' }
        ];

        // Operadores de filtro
        const FILTER_OPERATORS = [
            { value: 'equals', label: 'Igual a' },
            { value: 'notEquals', label: 'Diferente de' },
            { value: 'contains', label: 'Contém' },
            { value: 'notContains', label: 'Não contém' },
            { value: 'startsWith', label: 'Começa com' },
            { value: 'endsWith', label: 'Termina com' },
            { value: 'greaterThan', label: 'Maior que' },
            { value: 'lessThan', label: 'Menor que' },
            { value: 'isEmpty', label: 'Está vazio' },
            { value: 'isNotEmpty', label: 'Não está vazio' }
        ];

        const filterConditions = formData.filterConditions || [];

        const addFilterCondition = () => {
            const newCondition = {
                id: Date.now(),
                field: 'name',
                operator: 'contains',
                value: ''
            };
            handleChange('filterConditions', [...filterConditions, newCondition]);
        };

        const removeFilterCondition = (id) => {
            handleChange('filterConditions', filterConditions.filter(c => c.id !== id));
        };

        const updateFilterCondition = (id, key, value) => {
            handleChange('filterConditions', filterConditions.map(c =>
                c.id === id ? { ...c, [key]: value } : c
            ));
        };

        const needsValue = (operator) => {
            return !['isEmpty', 'isNotEmpty'].includes(operator);
        };

        return (
            <>
                <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
                    Este nó recebe dados de uma variável, aplica filtros e entrega o resultado filtrado para o próximo nó.
                </Typography>

                {/* Variável de entrada */}
                <TextField
                    fullWidth
                    label="Variável de entrada"
                    variant="outlined"
                    size="small"
                    className={classes.field}
                    value={formData.inputVariable || ''}
                    onChange={(e) => handleChange('inputVariable', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="dados"
                    helperText="Nome da variável que contém os dados (ex: resultado do Database)"
                />

                {/* Condições de filtro */}
                <Box className={classes.section}>
                    <Typography variant="subtitle2" className={classes.sectionTitle}>
                        Condições de Filtro
                    </Typography>

                    {filterConditions.map((condition, index) => (
                        <Box key={condition.id} style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                            {index > 0 && (
                                <FormControl size="small" variant="outlined" style={{ width: 70 }}>
                                    <Select
                                        value={condition.logic || 'AND'}
                                        onChange={(e) => updateFilterCondition(condition.id, 'logic', e.target.value)}
                                    >
                                        <MenuItem value="AND">E</MenuItem>
                                        <MenuItem value="OR">OU</MenuItem>
                                    </Select>
                                </FormControl>
                            )}

                            <FormControl size="small" variant="outlined" style={{ minWidth: 110 }}>
                                <InputLabel>Campo</InputLabel>
                                <Select
                                    value={condition.field || 'name'}
                                    onChange={(e) => updateFilterCondition(condition.id, 'field', e.target.value)}
                                    label="Campo"
                                >
                                    {FILTERABLE_FIELDS.map(f => (
                                        <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            <FormControl size="small" variant="outlined" style={{ minWidth: 120 }}>
                                <InputLabel>Operador</InputLabel>
                                <Select
                                    value={condition.operator || 'contains'}
                                    onChange={(e) => updateFilterCondition(condition.id, 'operator', e.target.value)}
                                    label="Operador"
                                >
                                    {FILTER_OPERATORS.map(op => (
                                        <MenuItem key={op.value} value={op.value}>{op.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>

                            {needsValue(condition.operator) && (
                                <TextField
                                    size="small"
                                    variant="outlined"
                                    label="Valor"
                                    style={{ flex: 1, minWidth: 100 }}
                                    value={condition.value || ''}
                                    onChange={(e) => updateFilterCondition(condition.id, 'value', e.target.value)}
                                />
                            )}

                            <IconButton size="small" onClick={() => removeFilterCondition(condition.id)}>
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Box>
                    ))}

                    <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={addFilterCondition}
                        className={classes.addButton}
                    >
                        Adicionar Condição
                    </Button>
                </Box>

                {/* Variável de saída */}
                <TextField
                    fullWidth
                    label="Variável de saída"
                    variant="outlined"
                    size="small"
                    className={classes.field}
                    value={formData.outputVariable || ''}
                    onChange={(e) => handleChange('outputVariable', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                    placeholder="filtrado"
                    helperText="Nome da variável para armazenar o resultado filtrado"
                />
            </>
        );
    };

    return (
        <Drawer
            className={classes.drawer}
            variant="persistent"
            anchor="right"
            open={open}
            classes={{ paper: classes.drawerPaper }}
        >
            <div className={classes.header}>
                <Typography variant="h6">
                    {nodeTitles[node.type] || 'Configurar Nó'}
                </Typography>
                <IconButton size="small" onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </div>

            {/* Campo de título comum a todos os nós */}
            <TextField
                fullWidth
                label="Título do Nó"
                variant="outlined"
                size="small"
                className={classes.field}
                value={formData.label || ''}
                onChange={(e) => handleChange('label', e.target.value)}
                placeholder={nodeTitles[node.type]?.replace('Configurar ', '') || 'Título'}
                helperText="Nome exibido abaixo do ícone do nó"
            />

            {renderForm()}

            <Button
                variant="contained"
                color="primary"
                fullWidth
                className={classes.saveButton}
                onClick={handleSave}
            >
                Salvar Configurações
            </Button>

            <Button
                variant="outlined"
                style={{ marginTop: 10, color: '#f44336', borderColor: '#f44336' }}
                fullWidth
                startIcon={<DeleteIcon />}
                onClick={() => {
                    if (window.confirm('Tem certeza que deseja excluir este nó?')) {
                        onDelete(node.id);
                    }
                }}
            >
                Excluir Nó
            </Button>
        </Drawer>
    );
};

export default NodeEditorSidebar;
