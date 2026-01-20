import React from 'react';
import { Position } from 'reactflow';
import { List as MenuIcon } from '@material-ui/icons';
import BaseNode from './BaseNode';

const MenuNode = ({ data, isConnectable }) => {
    const optionCount = data?.options?.length || 0;

    return (
        <BaseNode
            data={data}
            icon={MenuIcon}
            colorClass="colorMenu"
            defaultLabel="Menu"
            sublabel={optionCount > 0 ? `${optionCount} opções` : ''}
            isConnectable={isConnectable}
            badge={optionCount > 0 ? optionCount : null}
        />
    );
};

export default MenuNode;
