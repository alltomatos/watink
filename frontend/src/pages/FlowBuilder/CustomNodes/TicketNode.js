import React from 'react';
import { ConfirmationNumber as TicketIcon } from '@material-ui/icons';
import BaseNode from './BaseNode';

const TicketNode = ({ data, isConnectable }) => {
    // Mapeia ações para labels amigáveis
    const getActionLabel = (action) => {
        switch (action) {
            case 'moveToQueue': return 'Mover p/ Fila';
            case 'assignUser': return 'Atribuir Atendente';
            case 'changeStatus': return 'Alterar Status';
            case 'addTag': return 'Adicionar Tag';
            default: return 'Configurar Ticket';
        }
    };

    return (
        <BaseNode
            data={data}
            icon={TicketIcon}
            colorClass="colorTicket" // Preciso adicionar essa classe no BaseNode ou usar uma existente
            defaultLabel="Ticket"
            sublabel={getActionLabel(data?.ticketAction)}
            isConnectable={isConnectable}
        />
    );
};

export default TicketNode;
