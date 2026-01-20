import React from 'react';
import { Timeline as PipelineIcon } from '@material-ui/icons';
import BaseNode from './BaseNode';

const PipelineNode = ({ data, isConnectable }) => {
    // Labels para ações do Kanban
    const getActionLabel = (action) => {
        switch (action) {
            case 'createDeal': return 'Criar Oportunidade';
            case 'moveDeal': return 'Mover Etapa';
            case 'updateDeal': return 'Atualizar Oportunidade';
            default: return 'Integração Kanban';
        }
    };

    return (
        <BaseNode
            data={data}
            icon={PipelineIcon}
            colorClass="colorPipeline"
            defaultLabel="Pipeline"
            sublabel={getActionLabel(data?.kanbanAction)}
            isConnectable={isConnectable}
        />
    );
};

export default PipelineNode;
