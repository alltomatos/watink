import React from 'react';
import { Position } from 'reactflow';
import { Notifications as TriggerIcon } from '@material-ui/icons';
import BaseNode from './BaseNode';

const TRIGGER_LABELS = {
    'time': 'Agendado',
    'message': 'Mensagem',
    'webhook': 'Webhook',
    'event': 'Evento'
};

const TriggerNode = ({ data, isConnectable }) => {
    const triggerType = data?.triggerType || 'message';
    const triggerLabel = TRIGGER_LABELS[triggerType] || triggerType;

    return (
        <BaseNode
            data={data}
            icon={TriggerIcon}
            colorClass="colorTrigger"
            defaultLabel="Gatilho"
            sublabel={triggerLabel}
            isConnectable={isConnectable}
            targetHandles={[]}
            sourceHandles={[{ id: null, position: Position.Right }]}
        />
    );
};

export default TriggerNode;
