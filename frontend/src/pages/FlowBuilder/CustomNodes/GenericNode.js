import React from 'react';
import { Handle, Position } from 'reactflow';
import { makeStyles } from '@material-ui/core/styles';
import { Typography, Paper, IconButton } from '@material-ui/core';
import DeleteIcon from '@material-ui/icons/Delete';

const useStyles = makeStyles((theme) => ({
    node: {
        padding: '10px',
        border: '1px solid #1a192b',
        borderRadius: '5px',
        background: 'white',
        color: '#333',
        fontSize: '14px',
        minWidth: 180,
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
    },
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        position: 'relative',
        marginBottom: 8
    },
    title: {
        fontWeight: 'normal',
        display: 'flex',
        alignItems: 'center',
        gap: 6
    },
    deleteButton: {
        position: 'absolute',
        right: -5,
        top: -5,
        padding: 2
    },
    content: {
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontSize: '12px',
        color: '#555'
    }
}));

const GenericNode = ({ data, isConnectable, title, icon: Icon, children, style = {}, onDelete, showTargetHandle = true, showSourceHandle = true }) => {
    const classes = useStyles();

    const handleDelete = (e) => {
        e.stopPropagation();
        if (onDelete) {
            onDelete();
        } else if (data.onDelete) {
            data.onDelete();
        }
    };

    const showDelete = onDelete || data.onDelete;

    return (
        <Paper className={classes.node} style={style}>
            {showTargetHandle && (
                <Handle
                    type="target"
                    position={Position.Left}
                    isConnectable={isConnectable}
                    style={{ background: '#555', width: 10, height: 10 }}
                />
            )}

            <div className={classes.header}>
                <div className={classes.title}>
                    {Icon && <Icon style={{ fontSize: 16 }} />}
                    {title}
                </div>
                {showDelete && (
                    <IconButton
                        size="small"
                        className={classes.deleteButton}
                        onClick={handleDelete}
                    >
                        <DeleteIcon style={{ fontSize: 14, color: '#999' }} />
                    </IconButton>
                )}
            </div>

            <div className={classes.content}>
                {children}
            </div>

            {showSourceHandle && (
                <Handle
                    type="source"
                    position={Position.Right}
                    isConnectable={isConnectable}
                    style={{ background: '#555', width: 10, height: 10 }}
                />
            )}
        </Paper>
    );
};

export default GenericNode;
