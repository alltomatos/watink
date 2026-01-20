import React from 'react';
import { Position } from 'reactflow';
import { Storage as DatabaseIcon } from '@material-ui/icons';
import BaseNode from './BaseNode';

const OPERATION_LABELS = {
    'read': 'Buscar',
    'update': 'Atualizar',
    'create': 'Criar',
    'delete': 'Excluir'
};

const DatabaseNode = ({ data, isConnectable }) => {
    const operation = data?.operation || 'read';
    const table = data?.tableName || '';
    const opLabel = OPERATION_LABELS[operation] || operation;

    return (
        <BaseNode
            data={data}
            icon={DatabaseIcon}
            colorClass="colorDatabase"
            defaultLabel="Database"
            sublabel={table ? `${opLabel}: ${table}` : opLabel}
            isConnectable={isConnectable}
        />
    );
};

export default DatabaseNode;
