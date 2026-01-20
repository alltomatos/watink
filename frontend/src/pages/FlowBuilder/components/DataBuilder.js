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
    Switch,
    FormControlLabel
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Add as AddIcon, Delete as DeleteIcon } from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
    dataRow: {
        display: 'flex',
        gap: theme.spacing(1),
        marginBottom: theme.spacing(1),
        alignItems: 'center'
    },
    fieldSelect: {
        minWidth: 140
    },
    valueField: {
        flex: 1,
        minWidth: 120
    },
    addButton: {
        marginTop: theme.spacing(1)
    },
    header: {
        marginBottom: theme.spacing(1),
        color: '#666'
    }
}));

// Campos editáveis por tabela (excluindo campos auto-gerenciados)
const EDITABLE_FIELDS = {
    Contacts: [
        { value: 'name', label: 'Nome', type: 'string' },
        { value: 'email', label: 'E-mail', type: 'string' },
        { value: 'profilePicUrl', label: 'URL da Foto', type: 'string' }
    ],
    Tickets: [
        { value: 'status', label: 'Status', type: 'select', options: ['open', 'pending', 'closed'] },
        { value: 'queueId', label: 'ID da Fila', type: 'variable' },
        { value: 'userId', label: 'ID do Usuário', type: 'variable' }
    ],
    Messages: [
        { value: 'body', label: 'Conteúdo', type: 'string' },
        { value: 'read', label: 'Lida', type: 'boolean' }
    ],
    Users: [
        { value: 'name', label: 'Nome', type: 'string' },
        { value: 'email', label: 'E-mail', type: 'string' }
    ],
    Queues: [
        { value: 'name', label: 'Nome', type: 'string' },
        { value: 'color', label: 'Cor', type: 'string' }
    ],
    Whatsapps: [
        { value: 'name', label: 'Nome', type: 'string' },
        { value: 'isDefault', label: 'É Padrão', type: 'boolean' }
    ],
    QuickAnswers: [
        { value: 'shortcut', label: 'Atalho', type: 'string' },
        { value: 'message', label: 'Mensagem', type: 'string' }
    ],
    Pipelines: [
        { value: 'name', label: 'Nome', type: 'string' }
    ]
};

// Variáveis de contexto
const CONTEXT_VARIABLES = [
    { value: '{{contactId}}', label: 'ID do Contato' },
    { value: '{{ticketId}}', label: 'ID do Ticket' },
    { value: '{{userId}}', label: 'ID do Usuário' },
    { value: '{{queueId}}', label: 'ID da Fila' },
    { value: '{{contactName}}', label: 'Nome do Contato' },
    { value: '{{lastInput}}', label: 'Última Mensagem' }
];

const DataBuilder = ({
    dataFields = [],
    onChange,
    tableName = '',
    maxFields = 10
}) => {
    const classes = useStyles();
    const editableFields = EDITABLE_FIELDS[tableName] || [];

    const addField = () => {
        if (dataFields.length >= maxFields) return;
        const defaultField = editableFields.length > 0 ? editableFields[0].value : '';
        const newField = {
            id: Date.now(),
            field: defaultField,
            value: '',
            useVariable: false
        };
        onChange([...dataFields, newField]);
    };

    const removeField = (id) => {
        onChange(dataFields.filter(f => f.id !== id));
    };

    const updateField = (id, key, value) => {
        onChange(dataFields.map(f =>
            f.id === id ? { ...f, [key]: value } : f
        ));
    };

    const getFieldConfig = (fieldValue) => {
        return editableFields.find(f => f.value === fieldValue);
    };

    const renderValueInput = (dataField) => {
        const fieldConfig = getFieldConfig(dataField.field);

        // Se está usando variável
        if (dataField.useVariable) {
            return (
                <FormControl size="small" variant="outlined" className={classes.valueField}>
                    <InputLabel>Variável</InputLabel>
                    <Select
                        value={dataField.value || ''}
                        onChange={(e) => updateField(dataField.id, 'value', e.target.value)}
                        label="Variável"
                    >
                        {CONTEXT_VARIABLES.map(v => (
                            <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            );
        }

        if (!fieldConfig) {
            return (
                <TextField
                    size="small"
                    variant="outlined"
                    label="Valor"
                    className={classes.valueField}
                    value={dataField.value || ''}
                    onChange={(e) => updateField(dataField.id, 'value', e.target.value)}
                />
            );
        }

        // Boolean
        if (fieldConfig.type === 'boolean') {
            return (
                <FormControl size="small" variant="outlined" className={classes.valueField}>
                    <InputLabel>Valor</InputLabel>
                    <Select
                        value={dataField.value || ''}
                        onChange={(e) => updateField(dataField.id, 'value', e.target.value)}
                        label="Valor"
                    >
                        <MenuItem value="true">Sim</MenuItem>
                        <MenuItem value="false">Não</MenuItem>
                    </Select>
                </FormControl>
            );
        }

        // Select com opções
        if (fieldConfig.type === 'select' && fieldConfig.options) {
            return (
                <FormControl size="small" variant="outlined" className={classes.valueField}>
                    <InputLabel>Valor</InputLabel>
                    <Select
                        value={dataField.value || ''}
                        onChange={(e) => updateField(dataField.id, 'value', e.target.value)}
                        label="Valor"
                    >
                        {fieldConfig.options.map(opt => (
                            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            );
        }

        // Variable type (IDs)
        if (fieldConfig.type === 'variable') {
            return (
                <FormControl size="small" variant="outlined" className={classes.valueField}>
                    <InputLabel>Valor</InputLabel>
                    <Select
                        value={dataField.value || ''}
                        onChange={(e) => updateField(dataField.id, 'value', e.target.value)}
                        label="Valor"
                    >
                        {CONTEXT_VARIABLES.filter(v => v.value.includes('Id')).map(v => (
                            <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>
                        ))}
                    </Select>
                </FormControl>
            );
        }

        // String - TextField
        return (
            <TextField
                size="small"
                variant="outlined"
                label="Valor"
                className={classes.valueField}
                value={dataField.value || ''}
                onChange={(e) => updateField(dataField.id, 'value', e.target.value)}
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

    if (editableFields.length === 0) {
        return (
            <Typography variant="body2" color="textSecondary">
                Nenhum campo editável para esta tabela
            </Typography>
        );
    }

    return (
        <Box>
            <Typography variant="subtitle2" className={classes.header}>
                Dados a {dataFields.length > 0 ? 'salvar' : 'definir'}
            </Typography>

            {dataFields.map((dataField) => (
                <Box key={dataField.id} className={classes.dataRow}>
                    {/* Campo */}
                    <FormControl size="small" variant="outlined" className={classes.fieldSelect}>
                        <InputLabel>Campo</InputLabel>
                        <Select
                            value={dataField.field || ''}
                            onChange={(e) => updateField(dataField.id, 'field', e.target.value)}
                            label="Campo"
                        >
                            {editableFields.map(f => (
                                <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Valor */}
                    {renderValueInput(dataField)}

                    {/* Toggle para usar variável */}
                    <FormControlLabel
                        control={
                            <Switch
                                size="small"
                                checked={dataField.useVariable || false}
                                onChange={(e) => updateField(dataField.id, 'useVariable', e.target.checked)}
                            />
                        }
                        label="Var"
                        style={{ marginLeft: 0, marginRight: 0 }}
                    />

                    {/* Remover */}
                    <IconButton
                        size="small"
                        onClick={() => removeField(dataField.id)}
                        style={{ padding: 4 }}
                    >
                        <DeleteIcon fontSize="small" />
                    </IconButton>
                </Box>
            ))}

            {dataFields.length < maxFields && (
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addField}
                    className={classes.addButton}
                >
                    Adicionar Campo
                </Button>
            )}
        </Box>
    );
};

export default DataBuilder;
