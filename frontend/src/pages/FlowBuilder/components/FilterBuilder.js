import React from 'react';
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    IconButton,
    Button,
    Typography,
    Chip
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Add as AddIcon, Delete as DeleteIcon } from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
    filterRow: {
        display: 'flex',
        gap: theme.spacing(1),
        marginBottom: theme.spacing(1),
        alignItems: 'center',
        flexWrap: 'wrap'
    },
    fieldSelect: {
        minWidth: 120
    },
    operatorSelect: {
        minWidth: 100
    },
    valueField: {
        flex: 1,
        minWidth: 100
    },
    addButton: {
        marginTop: theme.spacing(1)
    },
    variableChip: {
        margin: theme.spacing(0.5),
        cursor: 'pointer'
    },
    variablesBox: {
        marginTop: theme.spacing(1),
        padding: theme.spacing(1),
        background: '#f5f5f5',
        borderRadius: 4
    }
}));

// Campos por tabela
const TABLE_FIELDS = {
    Contacts: [
        { value: 'id', label: 'ID', type: 'number' },
        { value: 'name', label: 'Nome', type: 'string' },
        { value: 'number', label: 'Número', type: 'string' },
        { value: 'email', label: 'E-mail', type: 'string' },
        { value: 'isGroup', label: 'É Grupo', type: 'boolean' }
    ],
    Tickets: [
        { value: 'id', label: 'ID', type: 'number' },
        { value: 'status', label: 'Status', type: 'select', options: ['open', 'pending', 'closed'] },
        { value: 'queueId', label: 'ID da Fila', type: 'number' },
        { value: 'userId', label: 'ID do Usuário', type: 'number' },
        { value: 'contactId', label: 'ID do Contato', type: 'number' },
        { value: 'isGroup', label: 'É Grupo', type: 'boolean' }
    ],
    Messages: [
        { value: 'id', label: 'ID', type: 'number' },
        { value: 'body', label: 'Conteúdo', type: 'string' },
        { value: 'fromMe', label: 'Enviada por mim', type: 'boolean' },
        { value: 'mediaType', label: 'Tipo de Mídia', type: 'string' },
        { value: 'ticketId', label: 'ID do Ticket', type: 'number' }
    ],
    Users: [
        { value: 'id', label: 'ID', type: 'number' },
        { value: 'name', label: 'Nome', type: 'string' },
        { value: 'email', label: 'E-mail', type: 'string' },
        { value: 'profile', label: 'Perfil', type: 'select', options: ['admin', 'user', 'super'] }
    ],
    Queues: [
        { value: 'id', label: 'ID', type: 'number' },
        { value: 'name', label: 'Nome', type: 'string' },
        { value: 'color', label: 'Cor', type: 'string' }
    ],
    Whatsapps: [
        { value: 'id', label: 'ID', type: 'number' },
        { value: 'name', label: 'Nome', type: 'string' },
        { value: 'status', label: 'Status', type: 'select', options: ['CONNECTED', 'DISCONNECTED', 'OPENING'] },
        { value: 'isDefault', label: 'É Padrão', type: 'boolean' }
    ],
    QuickAnswers: [
        { value: 'id', label: 'ID', type: 'number' },
        { value: 'shortcut', label: 'Atalho', type: 'string' },
        { value: 'message', label: 'Mensagem', type: 'string' }
    ],
    Pipelines: [
        { value: 'id', label: 'ID', type: 'number' },
        { value: 'name', label: 'Nome', type: 'string' }
    ]
};

// Operadores de filtro
const FILTER_OPERATORS = [
    { value: '=', label: 'Igual a' },
    { value: '!=', label: 'Diferente de' },
    { value: '>', label: 'Maior que' },
    { value: '<', label: 'Menor que' },
    { value: '>=', label: 'Maior ou igual' },
    { value: '<=', label: 'Menor ou igual' },
    { value: 'like', label: 'Contém' }
];

// Variáveis de contexto disponíveis
const CONTEXT_VARIABLES = [
    { value: '{{contactId}}', label: 'ID do Contato' },
    { value: '{{ticketId}}', label: 'ID do Ticket' },
    { value: '{{userId}}', label: 'ID do Usuário' },
    { value: '{{queueId}}', label: 'ID da Fila' },
    { value: '{{lastInput}}', label: 'Última Mensagem' }
];

const FilterBuilder = ({
    filters = [],
    onChange,
    tableName = '',
    maxFilters = 5
}) => {
    const classes = useStyles();
    const tableFields = TABLE_FIELDS[tableName] || [];

    const addFilter = () => {
        if (filters.length >= maxFilters) return;
        const defaultField = tableFields.length > 0 ? tableFields[0].value : 'id';
        const newFilter = {
            id: Date.now(),
            field: defaultField,
            operator: '=',
            value: '',
            logic: 'AND'
        };
        onChange([...filters, newFilter]);
    };

    const removeFilter = (id) => {
        onChange(filters.filter(f => f.id !== id));
    };

    const updateFilter = (id, key, value) => {
        onChange(filters.map(f =>
            f.id === id ? { ...f, [key]: value } : f
        ));
    };

    const insertVariable = (filterId, variable) => {
        const filter = filters.find(f => f.id === filterId);
        if (filter) {
            updateFilter(filterId, 'value', variable);
        }
    };

    const getFieldConfig = (fieldValue) => {
        return tableFields.find(f => f.value === fieldValue);
    };

    const renderValueInput = (filter) => {
        const fieldConfig = getFieldConfig(filter.field);

        if (!fieldConfig) {
            return (
                <TextField
                    size="small"
                    variant="outlined"
                    label="Valor"
                    className={classes.valueField}
                    value={filter.value || ''}
                    onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                />
            );
        }

        // Para campos boolean
        if (fieldConfig.type === 'boolean') {
            return (
                <FormControl size="small" variant="outlined" className={classes.valueField}>
                    <InputLabel>Valor</InputLabel>
                    <Select
                        value={filter.value || ''}
                        onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                        label="Valor"
                    >
                        <MenuItem value="true">Sim</MenuItem>
                        <MenuItem value="false">Não</MenuItem>
                    </Select>
                </FormControl>
            );
        }

        // Para campos select com opções predefinidas
        if (fieldConfig.type === 'select' && fieldConfig.options) {
            return (
                <FormControl size="small" variant="outlined" className={classes.valueField}>
                    <InputLabel>Valor</InputLabel>
                    <Select
                        value={filter.value || ''}
                        onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                        label="Valor"
                    >
                        {fieldConfig.options.map(opt => (
                            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            );
        }

        // Para campos number
        if (fieldConfig.type === 'number') {
            // Permite variáveis ou números
            const isVariable = filter.value && filter.value.startsWith('{{');
            return (
                <FormControl size="small" variant="outlined" className={classes.valueField}>
                    <InputLabel>Valor</InputLabel>
                    <Select
                        value={filter.value || ''}
                        onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
                        label="Valor"
                    >
                        <MenuItem value=""><em>Digitar valor...</em></MenuItem>
                        {CONTEXT_VARIABLES.filter(v => v.value.includes('Id')).map(v => (
                            <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            );
        }

        // Default: TextField
        return (
            <TextField
                size="small"
                variant="outlined"
                label="Valor"
                className={classes.valueField}
                value={filter.value || ''}
                onChange={(e) => updateFilter(filter.id, 'value', e.target.value)}
            />
        );
    };

    if (!tableName) {
        return (
            <Typography variant="body2" color="textSecondary">
                Selecione uma tabela primeiro
            </Typography>
        );
    }

    return (
        <Box>
            <Typography variant="subtitle2" style={{ marginBottom: 8, color: '#666' }}>
                Filtros (WHERE)
            </Typography>

            {filters.map((filter, index) => (
                <Box key={filter.id} className={classes.filterRow}>
                    {/* Lógica AND/OR */}
                    {index > 0 && (
                        <FormControl size="small" variant="outlined" style={{ minWidth: 70 }}>
                            <Select
                                value={filter.logic || 'AND'}
                                onChange={(e) => updateFilter(filter.id, 'logic', e.target.value)}
                            >
                                <MenuItem value="AND">E</MenuItem>
                                <MenuItem value="OR">OU</MenuItem>
                            </Select>
                        </FormControl>
                    )}

                    {/* Campo */}
                    <FormControl size="small" variant="outlined" className={classes.fieldSelect}>
                        <InputLabel>Campo</InputLabel>
                        <Select
                            value={filter.field || ''}
                            onChange={(e) => updateFilter(filter.id, 'field', e.target.value)}
                            label="Campo"
                        >
                            {tableFields.map(f => (
                                <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Operador */}
                    <FormControl size="small" variant="outlined" className={classes.operatorSelect}>
                        <InputLabel>Op</InputLabel>
                        <Select
                            value={filter.operator || '='}
                            onChange={(e) => updateFilter(filter.id, 'operator', e.target.value)}
                            label="Op"
                        >
                            {FILTER_OPERATORS.map(op => (
                                <MenuItem key={op.value} value={op.value}>{op.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Valor */}
                    {renderValueInput(filter)}

                    {/* Remover */}
                    <IconButton
                        size="small"
                        onClick={() => removeFilter(filter.id)}
                        style={{ padding: 4 }}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Box>
            ))}

            {filters.length < maxFilters && (
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addFilter}
                    className={classes.addButton}
                >
                    Adicionar Filtro
                </Button>
            )}

            {/* Variáveis de contexto */}
            <Box className={classes.variablesBox}>
                <Typography variant="caption" color="textSecondary">
                    Variáveis disponíveis:
                </Typography>
                <Box>
                    {CONTEXT_VARIABLES.map(v => (
                        <Chip
                            key={v.value}
                            label={v.label}
                            size="small"
                            className={classes.variableChip}
                            onClick={() => {
                                // Copia para clipboard
                                navigator.clipboard.writeText(v.value);
                            }}
                        />
                    ))}
                </Box>
            </Box>
        </Box>
    );
};

export default FilterBuilder;
