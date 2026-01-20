import React, { memo } from 'react';
import HttpIcon from '@material-ui/icons/Http';
import BaseNode from './BaseNode';

const WebhookNode = ({ data, isConnectable }) => {
    return (
        <BaseNode
            data={data}
            icon={HttpIcon}
            colorClass="colorWebhook"
            defaultLabel="Webhook"
            sublabel={data.method + ' ' + (data.url || '')}
            isConnectable={isConnectable}
        />
    );
};

export default memo(WebhookNode);
