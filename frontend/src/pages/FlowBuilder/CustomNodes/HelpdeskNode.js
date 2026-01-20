import React from 'react';
import BaseNode from './BaseNode';
import { ConfirmationNumber as HelpdeskIcon } from '@material-ui/icons';
import { Position } from 'reactflow';

const HelpdeskNode = ({ id, data }) => {
    const actionLabels = {
        'createProtocol': 'Criar Protocolo',
        'checkStatus': 'Verificar Status'
    };
    const action = data.helpdeskAction || 'createProtocol';

    return (
        <BaseNode
            data={data}
            icon={HelpdeskIcon}
            colorClass="colorHelpdesk"
            defaultLabel="Helpdesk"
            sublabel={actionLabels[action] || action}
            targetHandles={[{ id: null, position: Position.Left }]}
            sourceHandles={[{ id: null, position: Position.Right }]}
        />
    );
};

export default HelpdeskNode;
