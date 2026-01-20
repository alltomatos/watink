import React from 'react';
import { Handle, Position } from 'reactflow';
import { makeStyles } from '@material-ui/core/styles';
import { Typography, Tooltip } from '@material-ui/core';

const useStyles = makeStyles((theme) => ({
    nodeWrapper: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        minWidth: 80,
        maxWidth: 100,
        cursor: 'pointer',
        '&:hover $nodeCard': {
            transform: 'scale(1.05)',
            boxShadow: '0 6px 20px rgba(0,0,0,0.25)'
        }
    },
    nodeCard: {
        width: 50,
        height: 50,
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
    },
    icon: {
        fontSize: 24,
        color: '#fff'
    },
    label: {
        marginTop: 6,
        fontSize: 11,
        fontWeight: 500,
        color: '#333',
        textAlign: 'center',
        maxWidth: 90,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: 1.2
    },
    sublabel: {
        fontSize: 9,
        color: '#888',
        textAlign: 'center',
        marginTop: 2
    },
    handle: {
        width: 8,
        height: 8,
        background: '#555',
        border: '2px solid #fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
    },
    handleLeft: {
        left: -4
    },
    handleRight: {
        right: -4
    },
    handleTop: {
        top: -4
    },
    handleBottom: {
        bottom: -4
    },
    // Variantes de cor
    colorTrigger: {
        background: 'linear-gradient(135deg, #4caf50 0%, #2e7d32 100%)'
    },
    colorTicket: {
        background: 'linear-gradient(135deg, #f06292 0%, #c2185b 100%)' // Rosa/Magenta para Ticket
    },
    colorMessage: {
        background: 'linear-gradient(135deg, #2196f3 0%, #1565c0 100%)'
    },
    colorMenu: {
        background: 'linear-gradient(135deg, #ff9800 0%, #e65100 100%)'
    },
    colorSwitch: {
        background: 'linear-gradient(135deg, #9c27b0 0%, #6a1b9a 100%)'
    },
    colorDatabase: {
        background: 'linear-gradient(135deg, #795548 0%, #4e342e 100%)'
    },
    colorFilter: {
        background: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)'
    },
    colorPipeline: {
        background: 'linear-gradient(135deg, #00bcd4 0%, #0097a7 100%)'
    },
    colorKnowledge: {
        background: 'linear-gradient(135deg, #e91e63 0%, #ad1457 100%)'
    },
    colorEnd: {
        background: 'linear-gradient(135deg, #f44336 0%, #c62828 100%)'
    },
    colorDefault: {
        background: 'linear-gradient(135deg, #607d8b 0%, #455a64 100%)'
    },
    colorWebhook: {
        background: 'linear-gradient(135deg, #ff5722 0%, #e64a19 100%)' // Deep Orange
    },
    colorApi: {
        background: 'linear-gradient(135deg, #3f51b5 0%, #283593 100%)' // Indigo
    },
    colorHelpdesk: {
        background: 'linear-gradient(135deg, #009688 0%, #00695c 100%)' // Teal
    },
    // Badge para indicadores
    badge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 16,
        height: 16,
        borderRadius: '50%',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 'bold',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
    }
}));

/**
 * BaseNode - Componente base para todos os nós no estilo N8N
 * @param {object} data - dados do nó
 * @param {React.Component} icon - componente de ícone
 * @param {string} colorClass - classe de cor (colorTrigger, colorMessage, etc)
 * @param {string} defaultLabel - label padrão se não definido
 * @param {string} sublabel - texto adicional abaixo do título
 * @param {boolean} isConnectable - se pode conectar
 * @param {array} sourceHandles - handles de saída customizados [{id, position, style}]
 * @param {array} targetHandles - handles de entrada customizados [{id, position, style}]
 * @param {string|number} badge - badge no canto do nó
 */
const BaseNode = ({
    data,
    icon: Icon,
    colorClass = 'colorDefault',
    defaultLabel = 'Nó',
    sublabel = '',
    isConnectable = true,
    sourceHandles = [{ id: null, position: Position.Right }],
    targetHandles = [{ id: null, position: Position.Left }],
    badge = null
}) => {
    const classes = useStyles();
    const label = data?.label || defaultLabel;
    const displaySublabel = sublabel || data?.sublabel || '';

    return (
        <Tooltip title={label} placement="top" arrow>
            <div className={classes.nodeWrapper}>
                {/* Handles de entrada */}
                {targetHandles.map((handle, idx) => (
                    <Handle
                        key={`target-${idx}`}
                        type="target"
                        position={handle.position}
                        id={handle.id}
                        isConnectable={isConnectable}
                        className={`${classes.handle} ${handle.position === Position.Left ? classes.handleLeft :
                            handle.position === Position.Top ? classes.handleTop : ''
                            }`}
                        style={handle.style}
                    />
                ))}

                {/* Card do nó */}
                <div className={`${classes.nodeCard} ${classes[colorClass]}`}>
                    {Icon && <Icon className={classes.icon} />}
                    {badge && <div className={classes.badge}>{badge}</div>}
                </div>

                {/* Label abaixo */}
                <Typography className={classes.label}>
                    {label}
                </Typography>

                {displaySublabel && (
                    <Typography className={classes.sublabel}>
                        {displaySublabel}
                    </Typography>
                )}

                {/* Handles de saída */}
                {sourceHandles.map((handle, idx) => (
                    <Handle
                        key={`source-${idx}`}
                        type="source"
                        position={handle.position}
                        id={handle.id}
                        isConnectable={isConnectable}
                        className={`${classes.handle} ${handle.position === Position.Right ? classes.handleRight :
                            handle.position === Position.Bottom ? classes.handleBottom : ''
                            }`}
                        style={handle.style}
                    />
                ))}
            </div>
        </Tooltip>
    );
};

export default BaseNode;
