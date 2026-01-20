import React from "react";
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Typography
} from "@material-ui/core";
import { parseISO, format, differenceInDays } from "date-fns";

const PipelineGantt = ({ deals }) => {
    if (!deals) return <div>Carregando...</div>;

    return (
        <Paper style={{ margin: 16, padding: 16 }}>
            <Typography variant="h6" gutterBottom>Cronograma de Deals</Typography>
            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Deal</TableCell>
                            <TableCell>Contato</TableCell>
                            <TableCell>Criado em</TableCell>
                            <TableCell>Atualizado em</TableCell>
                            <TableCell>Dias no Pipeline</TableCell>
                            <TableCell>Valor</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {deals.map((deal) => (
                            <TableRow key={deal.id}>
                                <TableCell>{deal.title}</TableCell>
                                <TableCell>{deal.contact?.name}</TableCell>
                                <TableCell>{format(parseISO(deal.createdAt), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>{format(parseISO(deal.updatedAt), 'dd/MM/yyyy')}</TableCell>
                                <TableCell>
                                    {differenceInDays(new Date(), parseISO(deal.createdAt))} dias
                                </TableCell>
                                <TableCell>
                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(deal.value || 0)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

export default PipelineGantt;
