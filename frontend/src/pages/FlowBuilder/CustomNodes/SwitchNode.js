import React from 'react';
import { Handle, Position } from 'reactflow';
import { makeStyles } from '@material-ui/core/styles';
import { Typography, Tooltip } from '@material-ui/core';
import { CallSplit as SwitchIcon } from '@material-ui/icons';

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
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        background: 'linear-gradient(135deg, #9c27b0 0%, #6a1b9a 100%)'
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
        whiteSpace: 'nowrap'
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
        border: '2px solid #fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
    },
    handleA: {
        background: '#4caf50', // Verde para True
        top: '30%'
    },
    handleB: {
        background: '#f44336', // Vermelho para False
        top: '70%'
    },
    handleLabels: {
        position: 'absolute',
        right: -20,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        height: 40,
        top: 5
    },
    handleLabel: {
        fontSize: 8,
        fontWeight: 'bold',
        color: '#666'
    }
}));

const SwitchNode = ({ data, isConnectable }) => {
    const classes = useStyles();
    const label = data?.label || 'Decisão';
    const conditionCount = data?.conditionsA?.length || 0;

    return (
        <Tooltip title={label} placement="top" arrow>
            <div className={classes.nodeWrapper}>
                {/* Handle de entrada */}
                <Handle
                    type="target"
                    position={Position.Left}
                    isConnectable={isConnectable}
                    className={classes.handle}
                    style={{ background: '#555', left: -4 }}
                />

                {/* Card do nó */}
                <div className={classes.nodeCard}>
                    <SwitchIcon className={classes.icon} />
                </div>

                {/* Label */}
                <Typography className={classes.label}>
                    {label}
                </Typography>
                {conditionCount > 0 && (
                    <Typography className={classes.sublabel}>
                        {conditionCount} condição(ões)
                    </Typography>
                )}

                {/* Handles de saída A (true) e B (false) */}
                <Handle
                    type="source"
                    position={Position.Right}
                    id="a"
                    isConnectable={isConnectable}
                    className={`${classes.handle} ${classes.handleA}`}
                    style={{ right: -4 }}
                />
                <Handle
                    type="source"
                    position={Position.Right}
                    id="b"
                    isConnectable={isConnectable}
                    className={`${classes.handle} ${classes.handleB}`}
                    style={{ right: -4 }}
                />

                {/* Labels dos handles */}
                <div className={classes.handleLabels}>
                    <span className={classes.handleLabel} style={{ color: '#4caf50' }}>✓</span>
                    <span className={classes.handleLabel} style={{ color: '#f44336' }}>✗</span>
                </div>
            </div>
        </Tooltip>
    );
};

export default SwitchNode;
