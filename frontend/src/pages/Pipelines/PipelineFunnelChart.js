import React from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from "recharts";
import { Paper, Typography } from "@material-ui/core";

const PipelineFunnelChart = ({ pipeline, deals }) => {
    if (!pipeline || !deals) return <div>Carregando...</div>;

    // Funnel Logic: Shows conversion drop-off
    // Assuming stages are sequential
    const funnelData = pipeline.stages.map((stage, index) => {
        const stageDeals = deals.filter(d => d.stageId === stage.id);
        // For a true funnel, maybe we accumulate or just show raw counts
        // Let's show raw counts for now, stylized to look like a funnel
        return {
            name: stage.name,
            count: stageDeals.length,
            fill: `rgba(33, 150, 243, ${1 - index * 0.1})` // Fading blue
        };
    });

    return (
        <Paper style={{ padding: 16, margin: 16 }}>
            <Typography variant="h6" gutterBottom>Análise de Funil</Typography>
            <ResponsiveContainer width="100%" height={400}>
                <BarChart data={funnelData} layout="vertical" barCategoryGap="10%">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={150} />
                    <Tooltip cursor={{ fill: 'transparent' }} />
                    <Legend />
                    <Bar dataKey="count" name="Deals" data={funnelData} />
                </BarChart>
            </ResponsiveContainer>
        </Paper>
    );
};

export default PipelineFunnelChart;
