import React from 'react';
import { Position } from 'reactflow';
import { Stop as StopIcon } from '@material-ui/icons';
import BaseNode from './BaseNode';

const EndNode = ({ data, isConnectable }) => {
    return (
        <BaseNode
            data={data}
            icon={StopIcon}
            colorClass="colorEnd"
            defaultLabel="Fim"
            sublabel={data?.endAction || ''}
            isConnectable={isConnectable}
            targetHandles={[{ id: null, position: Position.Left }]}
            sourceHandles={[]} // Sem saída
        />
    );
};

export default EndNode;
