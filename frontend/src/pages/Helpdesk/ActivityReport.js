import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import {
    Container,
    Paper,
    Typography,
    Box,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    CircularProgress,
    Divider
} from "@material-ui/core";
import { Print as PrintIcon } from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { format } from "date-fns";
import ptBR from "date-fns/locale/pt-BR";
import activityApi from "../../services/activityApi";
import { toast } from "react-toastify";

const useStyles = makeStyles((theme) => ({
    "@global": {
        "@media print": {
            // Esconde elementos do layout (Sidebar, Header, etc)
            ".MuiDrawer-root": { display: "none !important" },
            ".MuiAppBar-root": { display: "none !important" },
            // Garante que o conteúdo principal ocupe tudo
            "main": {
                padding: "0 !important",
                margin: "0 !important",
                width: "100% !important",
                maxWidth: "100% !important",
                height: "auto !important",
                overflow: "visible !important",
                position: "static !important",
            },
            // Reset no body/html
            "html, body": {
                height: "auto !important",
                overflow: "visible !important",
                backgroundColor: "#fff !important",
            },
            // Esconde scrollbars
            "::-webkit-scrollbar": {
                display: "none"
            }
        }
    },
    root: {
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(4),
        backgroundColor: "#f5f5f5",
        minHeight: "100vh",
        "@media print": {
            backgroundColor: "#fff",
            padding: 0,
            margin: 0,
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            zIndex: 9999, // Garante que fique sobre tudo
        },
    },
    paper: {
        padding: theme.spacing(4),
        maxWidth: 800,
        margin: "0 auto",
        "@media print": {
            boxShadow: "none",
            maxWidth: "100%",
            padding: theme.spacing(2),
        },
    },
    header: {
        textAlign: "center",
        marginBottom: theme.spacing(4),
    },
    sectionTitle: {
        fontWeight: "bold",
        marginTop: theme.spacing(3),
        marginBottom: theme.spacing(1),
        backgroundColor: "#f0f0f0",
        padding: theme.spacing(1),
        borderRadius: 4,
        "@media print": {
            backgroundColor: "#f0f0f0 !important",
            WebkitPrintColorAdjust: "exact",
        },
    },
    printButton: {
        position: "fixed",
        bottom: theme.spacing(4),
        right: theme.spacing(4),
        "@media print": {
            display: "none",
        },
    },
    signatureBox: {
        marginTop: theme.spacing(8),
        textAlign: "center",
    },
    signatureLine: {
        borderTop: "1px solid #000",
        width: "80%",
        margin: "0 auto",
        paddingTop: theme.spacing(1),
    },
    signatureImage: {
        maxHeight: 80,
        marginBottom: -10,
    }
}));

const ActivityReport = () => {
    const classes = useStyles();
    const { activityId } = useParams();
    const [activity, setActivity] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchActivity = async () => {
            try {
                const { data } = await activityApi.show(activityId);
                setActivity(data);
            } catch (err) {
                toast.error("Erro ao carregar dados do relatório");
            } finally {
                setLoading(false);
            }
        };
        fetchActivity();
    }, [activityId]);

    const handlePrint = () => {
        window.print();
    };

    const translateStatus = (status) => {
        const map = {
            pending: "Pendente",
            in_progress: "Em Andamento",
            done: "Concluído",
            cancelled: "Cancelado"
        };
        return map[status] || status;
    };

    const translateInputType = (type) => {
        const map = {
            checkbox: "Checkbox",
            text: "Texto",
            photo: "Foto",
            number: "Número"
        };
        return map[type] || type;
    };

    const formatItemValue = (item) => {
        if (!item.value) return "-";
        if (item.inputType === "checkbox") return item.value === "true" ? "Sim" : "Não";
        if (item.inputType === "photo") return "Foto anexada";
        return item.value;
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
                <CircularProgress />
            </Box>
        );
    }

    if (!activity) {
        return (
            <Container className={classes.root}>
                <Typography variant="h5" align="center">Atividade não encontrada</Typography>
            </Container>
        );
    }

    return (
        <div className={classes.root}>
            <Paper className={classes.paper}>
                {/* Cabeçalho */}
                <div className={classes.header}>
                    <Typography variant="h5" style={{ fontWeight: "bold" }}>
                        RELATÓRIO DE ATENDIMENTO TÉCNICO (RAT)
                    </Typography>
                    <Typography variant="subtitle1" color="textSecondary">
                        Gerado em {format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </Typography>
                </div>

                {/* Dados do Protocolo */}
                <Grid container spacing={2}>
                    <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">Protocolo</Typography>
                        <Typography variant="body1" style={{ fontWeight: 500 }}>
                            {activity.protocol?.protocolNumber || "N/A"}
                        </Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="body2" color="textSecondary">Assunto</Typography>
                        <Typography variant="body1" style={{ fontWeight: 500 }}>
                            {activity.protocol?.subject || "N/A"}
                        </Typography>
                    </Grid>
                </Grid>

                {/* Dados do Cliente */}
                <Typography className={classes.sectionTitle}>Dados do Cliente</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} sm={4}>
                        <Typography variant="body2" color="textSecondary">Nome</Typography>
                        <Typography variant="body1">{activity.protocol?.contact?.name || "N/A"}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Typography variant="body2" color="textSecondary">Telefone</Typography>
                        <Typography variant="body1">{activity.protocol?.contact?.number || "N/A"}</Typography>
                    </Grid>
                    <Grid item xs={12} sm={4}>
                        <Typography variant="body2" color="textSecondary">E-mail</Typography>
                        <Typography variant="body1">{activity.protocol?.contact?.email || "N/A"}</Typography>
                    </Grid>
                </Grid>

                {/* Dados da Atividade */}
                <Typography className={classes.sectionTitle}>Dados da Atividade</Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12}>
                        <Typography variant="body2" color="textSecondary">Título</Typography>
                        <Typography variant="body1">{activity.title}</Typography>
                    </Grid>
                    <Grid item xs={12}>
                        <Typography variant="body2" color="textSecondary">Descrição</Typography>
                        <Typography variant="body1">{activity.description || "-"}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="textSecondary">Técnico</Typography>
                        <Typography variant="body1">{activity.user?.name || "N/A"}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="textSecondary">Status</Typography>
                        <Typography variant="body1">{translateStatus(activity.status)}</Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="textSecondary">Início</Typography>
                        <Typography variant="body1">
                            {activity.startedAt ? format(new Date(activity.startedAt), "dd/MM/yyyy HH:mm") : "-"}
                        </Typography>
                    </Grid>
                    <Grid item xs={6} sm={3}>
                        <Typography variant="body2" color="textSecondary">Término</Typography>
                        <Typography variant="body1">
                            {activity.finishedAt ? format(new Date(activity.finishedAt), "dd/MM/yyyy HH:mm") : "-"}
                        </Typography>
                    </Grid>
                </Grid>

                {/* Checklist */}
                {activity.items && activity.items.length > 0 && (
                    <>
                        <Typography className={classes.sectionTitle}>Checklist de Atividades</Typography>
                        <TableContainer component={Box} variant="outlined" style={{ border: "1px solid #e0e0e0", borderRadius: 4 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow style={{ backgroundColor: "#f9f9f9" }}>
                                        <TableCell><strong>Item</strong></TableCell>
                                        <TableCell><strong>Tipo</strong></TableCell>
                                        <TableCell><strong>Status</strong></TableCell>
                                        <TableCell><strong>Valor/Resposta</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {activity.items.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell>{item.label}</TableCell>
                                            <TableCell>{translateInputType(item.inputType)}</TableCell>
                                            <TableCell>{item.isDone ? "Concluído" : "Pendente"}</TableCell>
                                            <TableCell>
                                                {item.inputType === "photo" && item.value ? (
                                                    <a href={item.value} target="_blank" rel="noopener noreferrer">Ver Foto</a>
                                                ) : (
                                                    formatItemValue(item)
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}

                {/* Materiais */}
                {activity.materials && activity.materials.length > 0 && (
                    <>
                        <Typography className={classes.sectionTitle}>Materiais Utilizados</Typography>
                        <TableContainer component={Box} variant="outlined" style={{ border: "1px solid #e0e0e0", borderRadius: 4 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow style={{ backgroundColor: "#f9f9f9" }}>
                                        <TableCell><strong>Material</strong></TableCell>
                                        <TableCell><strong>Qtd</strong></TableCell>
                                        <TableCell><strong>Unidade</strong></TableCell>
                                        <TableCell><strong>Faturável</strong></TableCell>
                                        <TableCell><strong>Observações</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {activity.materials.map((mat) => (
                                        <TableRow key={mat.id}>
                                            <TableCell>{mat.materialName}</TableCell>
                                            <TableCell>{mat.quantity}</TableCell>
                                            <TableCell>{mat.unit || "un"}</TableCell>
                                            <TableCell>{mat.isBillable ? "Sim" : "Não"}</TableCell>
                                            <TableCell>{mat.notes || "-"}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}

                {/* Ocorrências */}
                {activity.occurrences && activity.occurrences.length > 0 && (
                    <>
                        <Typography className={classes.sectionTitle}>Diário de Ocorrências</Typography>
                        <TableContainer component={Box} variant="outlined" style={{ border: "1px solid #e0e0e0", borderRadius: 4 }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow style={{ backgroundColor: "#f9f9f9" }}>
                                        <TableCell><strong>Tipo</strong></TableCell>
                                        <TableCell><strong>Descrição</strong></TableCell>
                                        <TableCell><strong>Impacto</strong></TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {activity.occurrences.map((occ) => (
                                        <TableRow key={occ.id}>
                                            <TableCell>
                                                {occ.type === 'impediment' ? 'IMPEDIMENTO' : 
                                                 occ.type === 'delay' ? 'ATRASO' : 'INFORMATIVO'}
                                            </TableCell>
                                            <TableCell>{occ.description}</TableCell>
                                            <TableCell>{minutesToTime(occ.timeImpact)}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </>
                )}

                {/* Assinaturas */}
                <Box mt={6}>
                    <Typography className={classes.sectionTitle}>Assinaturas</Typography>
                    <Grid container spacing={4}>
                        <Grid item xs={6}>
                            <div className={classes.signatureBox}>
                                {activity.technicianSignature ? (
                                    <img src={activity.technicianSignature} alt="Assinatura Técnico" className={classes.signatureImage} />
                                ) : (
                                    <Box height={70} />
                                )}
                                <div className={classes.signatureLine}>
                                    <Typography variant="body2"><strong>Técnico:</strong> {activity.user?.name}</Typography>
                                </div>
                            </div>
                        </Grid>
                        <Grid item xs={6}>
                            <div className={classes.signatureBox}>
                                {activity.clientSignature ? (
                                    <img src={activity.clientSignature} alt="Assinatura Cliente" className={classes.signatureImage} />
                                ) : (
                                    <Box height={70} />
                                )}
                                <div className={classes.signatureLine}>
                                    <Typography variant="body2"><strong>Cliente:</strong> {activity.protocol?.contact?.name}</Typography>
                                </div>
                            </div>
                        </Grid>
                    </Grid>
                </Box>
            </Paper>

            <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<PrintIcon />}
                className={classes.printButton}
                onClick={handlePrint}
            >
                Imprimir
            </Button>
        </div>
    );
};

export default ActivityReport;
