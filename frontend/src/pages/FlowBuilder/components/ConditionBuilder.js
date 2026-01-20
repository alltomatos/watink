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
    Typography
} from '@material-ui/core';
import { makeStyles } from '@material-ui/core/styles';
import { Add as AddIcon, Delete as DeleteIcon } from '@material-ui/icons';

const useStyles = makeStyles((theme) => ({
    conditionRow: {
        display: 'flex',
        gap: theme.spacing(1),
        marginBottom: theme.spacing(1),
        alignItems: 'center',
        flexWrap: 'wrap'
    },
    fieldSelect: {
        minWidth: 130
    },
    operatorSelect: {
        minWidth: 120
    },
    valueField: {
        flex: 1,
        minWidth: 100
    },
    addButton: {
        marginTop: theme.spacing(1)
    },
    header: {
        marginBottom: theme.spacing(1),
        color: '#666'
    }
}));

// Campos disponíveis para condições
const AVAILABLE_FIELDS = [
    { value: 'lastInput', label: 'Última Mensagem' },
    { value: 'contactName', label: 'Nome do Contato' },
    { value: 'contactNumber', label: 'Número do Contato' },
    { value: 'ticketStatus', label: 'Status do Ticket' },
    { value: 'queueName', label: 'Fila' },
    { value: 'tagName', label: 'Tag do Contato' },
    { value: 'dayOfWeek', label: 'Dia da Semana' },
    { value: 'currentHour', label: 'Hora Atual' }
];

// Operadores disponíveis
const OPERATORS = [
    { value: 'equals', label: 'Igual a', needsValue: true },
    { value: 'notEquals', label: 'Diferente de', needsValue: true },
    { value: 'contains', label: 'Contém', needsValue: true },
    { value: 'notContains', label: 'Não contém', needsValue: true },
    { value: 'startsWith', label: 'Começa com', needsValue: true },
    { value: 'endsWith', label: 'Termina com', needsValue: true },
    { value: 'isEmpty', label: 'Está vazio', needsValue: false },
    { value: 'isNotEmpty', label: 'Não está vazio', needsValue: false },
    { value: 'greaterThan', label: 'Maior que', needsValue: true },
    { value: 'lessThan', label: 'Menor que', needsValue: true }
];

// Valores predefinidos para alguns campos
const PREDEFINED_VALUES = {
    ticketStatus: [
        { value: 'open', label: 'Aberto' },
        { value: 'pending', label: 'Pendente' },
        { value: 'closed', label: 'Fechado' }
    ],
    dayOfWeek: [
        { value: '0', label: 'Domingo' },
        { value: '1', label: 'Segunda' },
        { value: '2', label: 'Terça' },
        { value: '3', label: 'Quarta' },
        { value: '4', label: 'Quinta' },
        { value: '5', label: 'Sexta' },
        { value: '6', label: 'Sábado' }
    ]
};

const ConditionBuilder = ({
    conditions = [],
    onChange,
    maxConditions = 5,
    title = "Condições",
    showLogic = true
}) => {
    const classes = useStyles();

    // Inicializa com uma condição padrão se vazio
    React.useEffect(() => {
        if (conditions.length === 0) {
            onChange([{ id: Date.now(), field: 'lastInput', operator: 'isNotEmpty', value: '' }]);
        }
    }, []);

    const addCondition = () => {
        if (conditions.length >= maxConditions) return;
        const newCondition = {
            id: Date.now(),
            field: 'lastInput',
            operator: 'contains',
            value: '',
            logic: 'AND'
        };
        onChange([...conditions, newCondition]);
    };

    const removeCondition = (id) => {
        if (conditions.length <= 1) return;
        onChange(conditions.filter(c => c.id !== id));
    };

    const updateCondition = (id, key, value) => {
        onChange(conditions.map(c =>
            c.id === id ? { ...c, [key]: value } : c
        ));
    };

    const getOperatorNeedsValue = (operatorValue) => {
        const op = OPERATORS.find(o => o.value === operatorValue);
        return op ? op.needsValue : true;
    };

    const hasPredefinedValues = (fieldValue) => {
        return PREDEFINED_VALUES[fieldValue] !== undefined;
    };

    return (
        <Box>
            <Typography variant="subtitle2" className={classes.header}>
                {title}
            </Typography>

            {conditions.map((condition, index) => (
                <Box key={condition.id} className={classes.conditionRow}>
                    {/* Lógica (AND/OR) - exceto primeira condição */}
                    {showLogic && index > 0 && (
                        <FormControl size="small" variant="outlined" style={{ minWidth: 70 }}>
                            <Select
                                value={condition.logic || 'AND'}
                                onChange={(e) => updateCondition(condition.id, 'logic', e.target.value)}
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
                            value={condition.field || 'lastInput'}
                            onChange={(e) => updateCondition(condition.id, 'field', e.target.value)}
                            label="Campo"
                        >
                            {AVAILABLE_FIELDS.map(f => (
                                <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Operador */}
                    <FormControl size="small" variant="outlined" className={classes.operatorSelect}>
                        <InputLabel>Operador</InputLabel>
                        <Select
                            value={condition.operator || 'equals'}
                            onChange={(e) => updateCondition(condition.id, 'operator', e.target.value)}
                            label="Operador"
                        >
                            {OPERATORS.map(op => (
                                <MenuItem key={op.value} value={op.value}>{op.label}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    {/* Valor - só mostra se o operador precisar */}
                    {getOperatorNeedsValue(condition.operator) && (
                        hasPredefinedValues(condition.field) ? (
                            <FormControl size="small" variant="outlined" className={classes.valueField}>
                                <InputLabel>Valor</InputLabel>
                                <Select
                                    value={condition.value || ''}
                                    onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                                    label="Valor"
                                >
                                    {PREDEFINED_VALUES[condition.field].map(v => (
                                        <MenuItem key={v.value} value={v.value}>{v.label}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        ) : (
                            <TextField
                                size="small"
                                variant="outlined"
                                label="Valor"
                                className={classes.valueField}
                                value={condition.value || ''}
                                onChange={(e) => updateCondition(condition.id, 'value', e.target.value)}
                            />
                        )
                    )}

                    {/* Remover condição */}
                    {conditions.length > 1 && (
                        <IconButton
                            size="small"
                            onClick={() => removeCondition(condition.id)}
                            style={{ padding: 4 }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>
            ))}

            {conditions.length < maxConditions && (
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addCondition}
                    className={classes.addButton}
                >
                    Adicionar Condição
                </Button>
            )}
        </Box>
    );
};

export default ConditionBuilder;
