import React from 'react';
import { Position } from 'reactflow';
import { Message as MessageIcon } from '@material-ui/icons';
import BaseNode from './BaseNode';

const MessageNode = ({ data, isConnectable }) => {
    // Mostrar preview da mensagem
    const getPreview = () => {
        if (!data?.content) return '';
        const text = data.content.substring(0, 15);
        return text.length < data.content.length ? text + '...' : text;
    };

    return (
        <BaseNode
            data={data}
            icon={MessageIcon}
            colorClass="colorMessage"
            defaultLabel="Mensagem"
            sublabel={getPreview()}
            isConnectable={isConnectable}
        />
    );
};

export default MessageNode;
