import React, { useState, useEffect } from 'react';
import { LocalOffer as TagIcon } from '@material-ui/icons';
import BaseNode from './BaseNode';
import api from "../../../services/api";

const TagNode = ({ data, isConnectable }) => {
    const [tagName, setTagName] = useState('...');

    useEffect(() => {
        if (data.tagId) {
            // Tentar descobrir nome da tag se não tiver
            // Numa implementação real, idealmente o data já viria com tagName do backend ou store local
            // Para simplificar, vamos exibir o ID se não tiver nome, ou esperar que o editor popule tagName
            if (data.tagName) {
                setTagName(data.tagName);
            } else {
                // Fallback: tentar carregar? Evitar requests em loop.
                // Melhor deixar o editor salvar o nome junto com o ID.
            }
        }
    }, [data]);

    const getActionLabel = () => {
        const action = data.tagAction || 'add';
        const name = data.tagName || (data.tagId ? `#${data.tagId}` : '...');

        if (action === 'remove') return `Remover: ${name}`;
        return `Adicionar: ${name}`;
    };

    return (
        <BaseNode
            data={data}
            icon={TagIcon}
            colorClass="colorTag" // Precisa garantir que BaseNode suporte essa classe ou passar style direto
            // Se BaseNode usa useStyles interno baseado na string, preciso checar BaseNode.
            // Assumindo que ele recebe className ou style, ou teremos que editar BaseNode
            // Vou verificar BaseNode.js depois. Por enquanto uso colorClass
            defaultLabel="Tag"
            sublabel={getActionLabel()}
            isConnectable={isConnectable}
            style={{ background: 'linear-gradient(135deg, #FFB74D 0%, #F57C00 100%)' }} // Inline style fallback
        />
    );
};

export default TagNode;
