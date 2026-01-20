import React from "react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from "recharts";
import { Paper, Typography, Grid } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";

const useStyles = makeStyles((theme) => ({
    paper: {
        padding: theme.spacing(2),
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
    },
    title: {
        marginBottom: theme.spacing(2)
    }
}));

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

const PipelineKPIs = ({ pipeline, deals }) => {
    const classes = useStyles();

    if (!pipeline || !deals) return <div>Carregando...</div>;

    // Data prep
    const dealsByStage = pipeline.stages.map(stage => {
        const stageDeals = deals.filter(d => d.stageId === stage.id);
        const totalValue = stageDeals.reduce((acc, d) => acc + (parseFloat(d.value) || 0), 0);
        return {
            name: stage.name,
            count: stageDeals.length,
            value: totalValue
        };
    });

    return (
        <Grid container spacing={3} style={{ padding: 16 }}>
            <Grid item xs={12} md={6}>
                <Paper className={classes.paper}>
                    <Typography variant="h6" className={classes.title}>Deals por Etapa</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={dealsByStage}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Bar dataKey="count" name="Quantidade" fill="#8884d8" />
                        </BarChart>
                    </ResponsiveContainer>
                </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
                <Paper className={classes.paper}>
                    <Typography variant="h6" className={classes.title}>Valor Total por Etapa</Typography>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={dealsByStage}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {dealsByStage.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)} />
                        </PieChart>
                    </ResponsiveContainer>
                </Paper>
            </Grid>
        </Grid>
    );
};

export default PipelineKPIs;
