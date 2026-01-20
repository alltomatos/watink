import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";

import {
    Button,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    CircularProgress,
    TextField,
    Switch,
    FormControlLabel,
    Grid,
    FormGroup,
    Checkbox
} from "@material-ui/core";

import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles(theme => ({
    root: {
        display: "flex",
        flexWrap: "wrap",
    },
    multFieldLine: {
        display: "flex",
        "& > *:not(:last-child)": {
            marginRight: theme.spacing(1),
        },
    },
    btnWrapper: {
        position: "relative",
    },
    buttonProgress: {
        color: green[500],
        position: "absolute",
        top: "50%",
        left: "50%",
        marginTop: -12,
        marginLeft: -12,
    },
    formControl: {
        margin: theme.spacing(1),
        minWidth: 120,
    },
}));

const GroupSchema = Yup.object().shape({
    name: Yup.string()
        .min(2, "Too Short!")
        .max(50, "Too Long!")
        .required("Required"),
});

const GroupModal = ({ open, onClose, groupId }) => {
    const classes = useStyles();

    const initialState = {
        name: "",
        permissions: []
    };

    const [group, setGroup] = useState(initialState);
    const [allPermissions, setAllPermissions] = useState([]);
    const [selectedPermissions, setSelectedPermissions] = useState([]);

    useEffect(() => {
        const fetchPermissions = async () => {
            try {
                const { data } = await api.get("/permissions");
                setAllPermissions(data);
            } catch (err) {
                toastError(err);
            }
        };
        fetchPermissions();
    }, []);

    useEffect(() => {
        const fetchGroup = async () => {
            if (!groupId) return;
            try {
                const { data } = await api.get(`/groups/${groupId}`);
                setGroup(prevState => {
                    return { ...prevState, ...data };
                });
                setSelectedPermissions(data.permissions.map(p => p.id));
            } catch (err) {
                toastError(err);
            }
        };

        fetchGroup();
    }, [groupId, open]);

    const handleClose = () => {
        onClose();
        setGroup(initialState);
        setSelectedPermissions([]);
    };

    const handlePermissionChange = (permissionId) => {
        setSelectedPermissions(prevState => {
            if (prevState.includes(permissionId)) {
                return prevState.filter(id => id !== permissionId);
            } else {
                return [...prevState, permissionId];
            }
        });
    };

    const handleSaveGroup = async values => {
        const groupData = { ...values, permissions: selectedPermissions };
        try {
            if (groupId) {
                await api.put(`/groups/${groupId}`, groupData);
                toast.success(i18n.t("groupModal.success"));
            } else {
                await api.post("/groups", groupData);
                toast.success(i18n.t("groupModal.success"));
            }
            onClose();
        } catch (err) {
            toastError(err);
        }
    };

    const categorizePermissions = (permissions) => {
        const categories = {
            "contacts": "Contatos",
            "tickets": "Tickets",
            "users": "Usuários",
            "groups": "Grupos",
            "quick_answers": "Respostas Rápidas",
            "flows": "Flow Builder",
            "knowledge_bases": "Base de Conhecimento",
            "connections": "Conexões",
            "queues": "Filas",
            "settings": "Configurações",
            "dashboard": "Dashboard",
            "pipelines": "Pipelines",
            "swagger": "Desenvolvedor",
            "clients": "Clientes",
            "helpdesk": "Helpdesk",
            "marketplace": "Marketplace"
        };

        const grouped = {};

        permissions.forEach(permission => {
            let category = "Outros";
            for (const [key, label] of Object.entries(categories)) {
                if (permission.name.includes(key) || permission.name.includes(key.replace("es", ""))) { // simple check
                    category = label;
                    if (permission.name.includes("admin_queues")) category = "Filas"; // prioritize specific
                    if (permission.name.includes("admin_settings")) category = "Configurações";
                    break;
                }
            }

            // Clean up fallback for specific cases if loop didn't catch correctly
            if (permission.name.includes("admin_queues")) category = "Filas";
            if (permission.name.includes("admin_settings")) category = "Configurações";


            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(permission);
        });

        return grouped;
    };

    const groupedPermissions = categorizePermissions(allPermissions);

    return (
        <div className={classes.root}>
            <Dialog
                open={open}
                onClose={handleClose}
                maxWidth="md"
                fullWidth
                scroll="paper"
            >
                <DialogTitle id="form-dialog-title">
                    {groupId
                        ? `${i18n.t("groupModal.title.edit")}`
                        : `${i18n.t("groupModal.title.add")}`}
                </DialogTitle>
                <Formik
                    initialValues={group}
                    enableReinitialize={true}
                    validationSchema={GroupSchema}
                    onSubmit={(values, actions) => {
                        setTimeout(() => {
                            handleSaveGroup(values);
                            actions.setSubmitting(false);
                        }, 400);
                    }}
                >
                    {({ touched, errors, isSubmitting }) => (
                        <Form>
                            <DialogContent dividers>
                                <div className={classes.multFieldLine}>
                                    <Field
                                        as={TextField}
                                        label={i18n.t("groupModal.form.name")}
                                        autoFocus
                                        name="name"
                                        error={touched.name && Boolean(errors.name)}
                                        helperText={touched.name && errors.name}
                                        variant="outlined"
                                        margin="dense"
                                        fullWidth
                                    />
                                </div>

                                {Object.entries(groupedPermissions).map(([category, permissions]) => (
                                    <div key={category} style={{ marginTop: 20 }}>
                                        <h3 style={{ margin: "10px 0" }}>{category}</h3>
                                        <Grid container spacing={2}>
                                            {permissions.map(permission => (
                                                <Grid item xs={12} sm={6} md={4} key={permission.id}>
                                                    <FormControlLabel
                                                        control={
                                                            <Checkbox
                                                                checked={selectedPermissions.includes(permission.id)}
                                                                onChange={() => handlePermissionChange(permission.id)}
                                                                name={`permission-${permission.id}`}
                                                                color="primary"
                                                            />
                                                        }
                                                        label={permission.description || permission.name}
                                                    />
                                                </Grid>
                                            ))}
                                        </Grid>
                                    </div>
                                ))}

                            </DialogContent>
                            <DialogActions>
                                <Button
                                    onClick={handleClose}
                                    color="secondary"
                                    disabled={isSubmitting}
                                    variant="outlined"
                                >
                                    {i18n.t("groupModal.buttons.cancel")}
                                </Button>
                                <Button
                                    type="submit"
                                    color="primary"
                                    disabled={isSubmitting}
                                    variant="contained"
                                    className={classes.btnWrapper}
                                >
                                    {groupId
                                        ? `${i18n.t("groupModal.buttons.okEdit")}`
                                        : `${i18n.t("groupModal.buttons.okAdd")}`}
                                    {isSubmitting && (
                                        <CircularProgress
                                            size={24}
                                            className={classes.buttonProgress}
                                        />
                                    )}
                                </Button>
                            </DialogActions>
                        </Form>
                    )}
                </Formik>
            </Dialog>
        </div>
    );
};

export default GroupModal;
