import React, { useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Drawer from "@material-ui/core/Drawer";
import Typography from "@material-ui/core/Typography";
import IconButton from "@material-ui/core/IconButton";
import CloseIcon from "@material-ui/icons/Close";
import Button from "@material-ui/core/Button";
import TextField from "@material-ui/core/TextField";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";
import { toast } from "react-toastify";
import api from "../../services/api";

const drawerWidth = 320;

const useStyles = makeStyles((theme) => ({
    drawer: {
        width: drawerWidth,
        flexShrink: 0,
    },
    drawerPaper: {
        width: drawerWidth,
        display: "flex",
        borderTop: "1px solid rgba(0, 0, 0, 0.12)",
        borderRight: "1px solid rgba(0, 0, 0, 0.12)",
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        borderTopRightRadius: 4,
        borderBottomRightRadius: 4,
    },
    header: {
        display: "flex",
        borderBottom: "1px solid rgba(0, 0, 0, 0.12)",
        backgroundColor: "#eee",
        alignItems: "center",
        padding: theme.spacing(0, 1),
        minHeight: "73px",
        justifyContent: "space-between",
    },
    content: {
        display: "flex",
        backgroundColor: "#fff",
        flexDirection: "column",
        padding: "16px",
        height: "100%",
        overflowY: "auto",
        ...theme.scrollbarStyles,
    },
    formControl: {
        marginBottom: theme.spacing(2),
        minWidth: 120,
    },
    actions: {
        padding: theme.spacing(2),
        display: "flex",
        justifyContent: "flex-end",
        borderTop: "1px solid rgba(0, 0, 0, 0.12)",
    },
}));

const ProtocolDrawer = ({ open, onClose, contactId, ticketId, onSuccess }) => {
    const classes = useStyles();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        subject: "",
        description: "",
        priority: "medium",
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        if (!formData.subject.trim()) {
            toast.error("Assunto é obrigatório");
            return;
        }

        if (!contactId) {
            toast.error("Contato não identificado");
            return;
        }

        try {
            setLoading(true);
            await api.post(`/contacts/${contactId}/protocols`, {
                ...formData,
                ticketId,
            });
            toast.success("Protocolo criado com sucesso!");
            setFormData({ subject: "", description: "", priority: "medium" });
            if (onSuccess) onSuccess();
            onClose();
        } catch (err) {
            toast.error("Erro ao criar protocolo");
        } finally {
            setLoading(false);
        }
    };

    return (
        <Drawer
            className={classes.drawer}
            variant="persistent"
            anchor="right"
            open={open}
            PaperProps={{ style: { position: "absolute" } }}
            BackdropProps={{ style: { position: "absolute" } }}
            ModalProps={{
                container: document.getElementById("drawer-container"),
                style: { position: "absolute" },
            }}
            classes={{
                paper: classes.drawerPaper,
            }}
        >
            <div className={classes.header}>
                <Typography variant="h6">
                    Novo Protocolo
                </Typography>
                <IconButton onClick={onClose}>
                    <CloseIcon />
                </IconButton>
            </div>
            <div className={classes.content}>
                <TextField
                    label="Assunto"
                    name="subject"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={formData.subject}
                    onChange={handleChange}
                    autoFocus
                />

                <FormControl variant="outlined" className={classes.formControl} fullWidth>
                    <InputLabel>Prioridade</InputLabel>
                    <Select
                        name="priority"
                        value={formData.priority}
                        onChange={handleChange}
                        label="Prioridade"
                    >
                        <MenuItem value="low">Baixa</MenuItem>
                        <MenuItem value="medium">Média</MenuItem>
                        <MenuItem value="high">Alta</MenuItem>
                        <MenuItem value="urgent">Urgente</MenuItem>
                    </Select>
                </FormControl>

                <TextField
                    label="Descrição"
                    name="description"
                    variant="outlined"
                    fullWidth
                    multiline
                    minRows={4}
                    margin="normal"
                    value={formData.description}
                    onChange={handleChange}
                />
            </div>
            <div className={classes.actions}>
                <Button onClick={onClose} style={{ marginRight: 8 }}>
                    Cancelar
                </Button>
                <Button
                    variant="contained"
                    color="primary"
                    onClick={handleSubmit}
                    disabled={loading || !formData.subject.trim()}
                >
                    {loading ? "Criando..." : "Criar Protocolo"}
                </Button>
            </div>
        </Drawer>
    );
};

export default ProtocolDrawer;
