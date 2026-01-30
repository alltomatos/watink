import React, { useState, useEffect } from "react";
import { useParams, useHistory } from "react-router-dom";
import { toast } from "react-toastify";
import { Formik, Form, Field } from "formik";
import * as Yup from "yup";

import {
    makeStyles,
    Paper,
    Grid,
    Typography,
    TextField,
    Button,
    IconButton,
    CircularProgress,
    Fade,
} from "@material-ui/core";

import {
    ArrowBack,
    Save,
    Edit,
    Security,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import RolePermissionTransferList from "../../components/RolePermissionTransferList";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
    root: {
        padding: theme.spacing(2),
        animation: "$fadeIn 0.4s ease-out",
    },
    "@keyframes fadeIn": {
        from: { opacity: 0, transform: "translateY(10px)" },
        to: { opacity: 1, transform: "translateY(0)" },
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: theme.spacing(3),
        padding: theme.spacing(2),
        background: `linear-gradient(135deg, ${theme.palette.primary.main}15 0%, ${theme.palette.secondary.main}10 100%)`,
        borderRadius: 16,
        backdropFilter: "blur(10px)",
    },
    headerLeft: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(2),
    },
    backButton: {
        background: theme.palette.background.paper,
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
        "&:hover": {
            background: theme.palette.background.paper,
            transform: "scale(1.05)",
        },
        transition: "transform 0.2s ease",
    },
    card: {
        padding: theme.spacing(2.5),
        borderRadius: 16,
        background: theme.palette.background.paper,
        boxShadow: "0 4px 20px rgba(0,0,0,0.08)",
        border: `1px solid ${theme.palette.divider}`,
        height: "100%",
        transition: "box-shadow 0.3s ease, transform 0.2s ease",
        "&:hover": {
            boxShadow: "0 8px 30px rgba(0,0,0,0.12)",
        },
    },
    cardHeader: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1.5),
        marginBottom: theme.spacing(2),
        paddingBottom: theme.spacing(1.5),
        borderBottom: `1px solid ${theme.palette.divider}`,
    },
    cardIcon: {
        padding: theme.spacing(1),
        borderRadius: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
    },
    cardIconData: {
        background: `linear-gradient(135deg, ${theme.palette.info.main}20 0%, ${theme.palette.info.light}20 100%)`,
        color: theme.palette.info.main,
    },
    cardTitle: {
        fontWeight: 600,
        fontSize: "1.1rem",
    },
    saveButton: {
        borderRadius: 10,
        padding: theme.spacing(1, 3),
        textTransform: "none",
        fontWeight: 600,
        boxShadow: "0 4px 14px rgba(0,0,0,0.15)",
        "&:hover": {
            boxShadow: "0 6px 20px rgba(0,0,0,0.2)",
        },
    },
    loadingContainer: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: 400,
    },
}));

const RoleSchema = Yup.object().shape({
    name: Yup.string()
        .min(2, "Nome muito curto!")
        .max(50, "Nome muito longo!")
        .required("Nome é obrigatório"),
    description: Yup.string()
        .max(100, "Descrição muito longa!"),
});

const RoleEdit = () => {
    const classes = useStyles();
    const { roleId } = useParams();
    const history = useHistory();

    const isNew = roleId === "new";

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [role, setRole] = useState({ name: "", description: "", permissions: [] });
    const [allPermissions, setAllPermissions] = useState([]);
    const [selectedPermissions, setSelectedPermissions] = useState([]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const requests = [api.get("/permissions")];

                if (!isNew) {
                    requests.push(api.get(`/roles/${roleId}`));
                }

                const responses = await Promise.all(requests);
                
                const [permissionsRes] = responses;
                setAllPermissions(permissionsRes.data);

                if (!isNew) {
                    const [, roleRes] = responses;
                    setRole(roleRes.data);
                    setSelectedPermissions(roleRes.data.permissions?.map(p => p.id) || []);
                }
            } catch (err) {
                toastError(err);
                // history.push("/roles"); // Commented out until Roles list is implemented
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [roleId, history, isNew]);

    const handleSave = async (values) => {
        setSaving(true);
        try {
            const roleData = {
                name: values.name,
                description: values.description,
                permissionIds: selectedPermissions,
            };

            if (isNew) {
                await api.post("/roles", roleData);
                toast.success(i18n.t("role.success")); // Ensure translation exists or use default string
            } else {
                await api.put(`/roles/${roleId}`, roleData);
                toast.success(i18n.t("role.success"));
            }
            // history.push("/roles"); // Commented out until Roles list is implemented
        } catch (err) {
            toastError(err);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <MainContainer>
                <div className={classes.loadingContainer}>
                    <CircularProgress />
                </div>
            </MainContainer>
        );
    }

    return (
        <MainContainer>
            <Formik
                initialValues={role}
                enableReinitialize
                validationSchema={RoleSchema}
                onSubmit={handleSave}
            >
                {({ touched, errors, values }) => (
                    <Form>
                        <Fade in timeout={400}>
                            <div className={classes.root}>
                                <div className={classes.header}>
                                    <div className={classes.headerLeft}>
                                        <IconButton
                                            className={classes.backButton}
                                            onClick={() => history.goBack()}
                                        >
                                            <ArrowBack />
                                        </IconButton>
                                        <div>
                                            <Typography variant="h5" style={{ fontWeight: 600 }}>
                                                {isNew ? (i18n.t("role.title.add") || "Adicionar Role") : (i18n.t("role.title.edit") || "Editar Role")}
                                            </Typography>
                                            {!isNew && (
                                                <Typography variant="body2" color="textSecondary">
                                                    {role.name}
                                                </Typography>
                                            )}
                                        </div>
                                    </div>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />}
                                        className={classes.saveButton}
                                        type="submit"
                                        disabled={saving}
                                    >
                                        {isNew ? (i18n.t("common.save") || "Salvar") : (i18n.t("common.save") || "Salvar")}
                                    </Button>
                                </div>

                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={4}>
                                        <Paper className={classes.card}>
                                            <div className={classes.cardHeader}>
                                                <div className={`${classes.cardIcon} ${classes.cardIconData}`}>
                                                    <Edit />
                                                </div>
                                                <Typography className={classes.cardTitle}>
                                                    Dados do Papel
                                                </Typography>
                                            </div>

                                            <Grid container spacing={2}>
                                                <Grid item xs={12}>
                                                    <Field
                                                        as={TextField}
                                                        name="name"
                                                        label={i18n.t("role.form.name") || "Nome"}
                                                        variant="outlined"
                                                        fullWidth
                                                        error={touched.name && Boolean(errors.name)}
                                                        helperText={touched.name && errors.name}
                                                        InputProps={{
                                                            style: { borderRadius: 12 }
                                                        }}
                                                    />
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Field
                                                        as={TextField}
                                                        name="description"
                                                        label={i18n.t("role.form.description") || "Descrição"}
                                                        variant="outlined"
                                                        fullWidth
                                                        multiline
                                                        rows={3}
                                                        error={touched.description && Boolean(errors.description)}
                                                        helperText={touched.description && errors.description}
                                                        InputProps={{
                                                            style: { borderRadius: 12 }
                                                        }}
                                                    />
                                                </Grid>
                                            </Grid>
                                        </Paper>
                                    </Grid>

                                    <Grid item xs={12} md={8}>
                                        <Paper className={classes.card}>
                                            <div className={classes.cardHeader}>
                                                <div className={`${classes.cardIcon} ${classes.cardIconData}`}>
                                                    <Security />
                                                </div>
                                                <Typography className={classes.cardTitle}>
                                                    Permissões
                                                </Typography>
                                            </div>
                                            
                                            <RolePermissionTransferList 
                                                allPermissions={allPermissions}
                                                selectedPermissions={selectedPermissions}
                                                onChange={setSelectedPermissions}
                                            />
                                        </Paper>
                                    </Grid>
                                </Grid>
                            </div>
                        </Fade>
                    </Form>
                )}
            </Formik>
        </MainContainer>
    );
};

export default RoleEdit;
