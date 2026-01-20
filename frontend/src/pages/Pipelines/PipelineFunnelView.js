import React, { useState } from 'react';
import { Paper, Tabs, Tab } from '@material-ui/core';
import PipelineKanban from './PipelineKanban';
import PipelineKPIs from './PipelineKPIs';
import PipelineFunnelChart from './PipelineFunnelChart';
import PipelineGantt from './PipelineGantt';
import ViewWeekIcon from '@material-ui/icons/ViewWeek';
import BarChartIcon from '@material-ui/icons/BarChart';
import TimelineIcon from '@material-ui/icons/Timeline';
import FilterListIcon from '@material-ui/icons/FilterList';

const PipelineFunnelView = ({ pipeline, columns, setColumns, onDragEnd, deals }) => {
    const [tab, setTab] = useState(0);

    const handleTabChange = (event, newValue) => {
        setTab(newValue);
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <Paper square style={{ marginBottom: 1 }}>
                <Tabs
                    value={tab}
                    onChange={handleTabChange}
                    variant="fullWidth"
                    indicatorColor="primary"
                    textColor="primary"
                    aria-label="pipeline tabs"
                >
                    <Tab icon={<ViewWeekIcon />} label="Quadro" />
                    <Tab icon={<TimelineIcon />} label="Gantt" />
                    <Tab icon={<BarChartIcon />} label="KPIs" />
                    <Tab icon={<FilterListIcon />} label="Funil" />
                </Tabs>
            </Paper>

            <div style={{ flexGrow: 1, overflow: 'auto' }}>
                {tab === 0 && (
                    <PipelineKanban
                        pipeline={pipeline}
                        columns={columns}
                        setColumns={setColumns}
                        onDragEnd={onDragEnd}
                        isEnterprise={true}
                    />
                )}
                {tab === 1 && <PipelineGantt deals={deals} />}
                {tab === 2 && <PipelineKPIs pipeline={pipeline} deals={deals} />}
                {tab === 3 && <PipelineFunnelChart pipeline={pipeline} deals={deals} />}
            </div>
        </div>
    );
};

export default PipelineFunnelView;
