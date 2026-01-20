import React from 'react';
import { Position } from 'reactflow';
import { EmojiObjects as KnowledgeIcon } from '@material-ui/icons';
import BaseNode from './BaseNode';

const KnowledgeNode = ({ data, isConnectable }) => {
    const mode = data?.responseMode || 'auto';

    return (
        <BaseNode
            data={data}
            icon={KnowledgeIcon}
            colorClass="colorKnowledge"
            defaultLabel="IA"
            sublabel={mode === 'auto' ? 'Automático' : mode}
            isConnectable={isConnectable}
        />
    );
};

export default KnowledgeNode;
