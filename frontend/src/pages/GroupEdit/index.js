import React, { useState, useEffect, useCallback } from "react";
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
    Avatar,
    List,
    ListItem,
    ListItemAvatar,
    ListItemText,
    ListItemSecondaryAction,
    InputAdornment,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tooltip,
    Fade,
} from "@material-ui/core";

import {
    ArrowBack,
    Save,
    Search,
    PersonAdd,
    Delete,
    Security,
    Group,
    Edit,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import PermissionTransferList from "../../components/PermissionTransferList";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
    root: {
        padding: theme.spacing(2),
        animation: "$fadeIn 0.4s ease-out",
        height: "100%",
        overflowY: "auto",
        ...theme.scrollbarStyles,
    },
    formContainer: {
        height: "100%",
        display: "flex",
        flexDirection: "column",
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
    cardIconPermissions: {
        background: `linear-gradient(135deg, ${theme.palette.warning.main}20 0%, ${theme.palette.warning.light}20 100%)`,
        color: theme.palette.warning.main,
    },
    cardIconUsers: {
        background: `linear-gradient(135deg, ${theme.palette.success.main}20 0%, ${theme.palette.success.light}20 100%)`,
        color: theme.palette.success.main,
    },
    cardTitle: {
        fontWeight: 600,
        fontSize: "1.1rem",
    },

    userList: {
        maxHeight: 350,
        overflowY: "auto",
        ...theme.scrollbarStyles,
    },
    userItem: {
        borderRadius: 10,
        marginBottom: theme.spacing(0.5),
        transition: "background 0.2s ease",
        "&:hover": {
            background: theme.palette.action.hover,
        },
    },
    userAvatar: {
        width: 36,
        height: 36,
        fontSize: "0.9rem",
        background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
    },
    searchField: {
        marginBottom: theme.spacing(2),
        "& .MuiOutlinedInput-root": {
            borderRadius: 12,
        },
    },
    addUserButton: {
        marginTop: theme.spacing(2),
        borderRadius: 10,
        textTransform: "none",
        fontWeight: 500,
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
    emptyState: {
        textAlign: "center",
        padding: theme.spacing(3),
        color: theme.palette.text.secondary,
    },
    loadingContainer: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: 400,
    },
    chip: {
        marginLeft: theme.spacing(1),
        height: 22,
        fontSize: "0.75rem",
    },
    dialogContent: {
        minWidth: 400,
    },
    availableUserItem: {
        borderRadius: 8,
        marginBottom: theme.spacing(0.5),
        cursor: "pointer",
        transition: "all 0.2s ease",
        "&:hover": {
            background: theme.palette.action.selected,
            transform: "translateX(4px)",
        },
    },
}));

const GroupSchema = Yup.object().shape({
    name: Yup.string()
        .min(2, "Nome muito curto!")
        .max(50, "Nome muito longo!")
        .required("Nome é obrigatório"),
});

const GroupEdit = () => {
    const classes = useStyles();
    const { groupId } = useParams();
    const history = useHistory();

    const isNew = groupId === "new";

    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [group, setGroup] = useState({ name: "", permissions: [], users: [] });
    const [allPermissions, setAllPermissions] = useState([]);
    const [allUsers, setAllUsers] = useState([]);
    const [selectedPermissions, setSelectedPermissions] = useState([]);
    const [groupUsers, setGroupUsers] = useState([]);
    const [userSearchTerm, setUserSearchTerm] = useState("");
    const [addUserDialogOpen, setAddUserDialogOpen] = useState(false);
    const [availableUserSearch, setAvailableUserSearch] = useState("");

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const requests = [
                    api.get("/permissions"),
                    api.get("/users")
                ];

                // Only fetch group data if editing an existing group
                if (!isNew) {
                    requests.unshift(api.get(`/groups/${groupId}`));
                }

                const responses = await Promise.all(requests);

                if (isNew) {
                    // Creating new group
                    const [permissionsRes, usersRes] = responses;
                    setAllPermissions(permissionsRes.data);
                    setAllUsers(usersRes.data.users || usersRes.data || []);
                } else {
                    // Editing existing group
                    const [groupRes, permissionsRes, usersRes] = responses;
                    setGroup(groupRes.data);
                    setSelectedPermissions(groupRes.data.permissions?.map(p => p.id) || []);
                    setGroupUsers(groupRes.data.users || []);
                    setAllPermissions(permissionsRes.data);
                    setAllUsers(usersRes.data.users || usersRes.data || []);
                }
            } catch (err) {
                toastError(err);
                history.push("/groups");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [groupId, history, isNew]);

    const handleSave = async (values) => {
        setSaving(true);
        try {
            const groupData = {
                name: values.name,
                permissions: selectedPermissions,
                userIds: groupUsers.map(u => u.id)
            };

            if (isNew) {
                await api.post("/groups", groupData);
                toast.success(i18n.t("groupModal.success"));
                history.push("/groups");
            } else {
                await api.put(`/groups/${groupId}`, groupData);
                toast.success(i18n.t("groupModal.success"));
            }
        } catch (err) {
            toastError(err);
        } finally {
            setSaving(false);
        }
    };

    const handlePermissionChange = (newSelectedIds) => {
        setSelectedPermissions(newSelectedIds);
    };

    const handleRemoveUser = (userId) => {
        setGroupUsers(prev => prev.filter(u => u.id !== userId));
    };

    const handleAddUser = (user) => {
        if (!groupUsers.find(u => u.id === user.id)) {
            setGroupUsers(prev => [...prev, user]);
        }
        setAddUserDialogOpen(false);
        setAvailableUserSearch("");
    };

    const getInitials = (name) => {
        return name
            .split(" ")
            .map(n => n[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
    };

    const filteredGroupUsers = groupUsers.filter(user =>
        user.name.toLowerCase().includes(userSearchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(userSearchTerm.toLowerCase())
    );

    const availableUsers = allUsers.filter(user =>
        !groupUsers.find(u => u.id === user.id) &&
        (user.name.toLowerCase().includes(availableUserSearch.toLowerCase()) ||
            user.email?.toLowerCase().includes(availableUserSearch.toLowerCase()))
    );

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
                initialValues={group}
                enableReinitialize
                validationSchema={GroupSchema}
                onSubmit={handleSave}
            >
                {({ touched, errors, isSubmitting, values }) => (
                    <Form className={classes.formContainer}>
                        <Fade in timeout={400}>
                            <div className={classes.root}>
                                {/* Header */}
                                <div className={classes.header}>
                                    <div className={classes.headerLeft}>
                                        <IconButton
                                            className={classes.backButton}
                                            onClick={() => history.push("/groups")}
                                        >
                                            <ArrowBack />
                                        </IconButton>
                                        <div>
                                            <Typography variant="h5" style={{ fontWeight: 600 }}>
                                                {isNew ? i18n.t("groupModal.title.add") : i18n.t("groupModal.title.edit")}
                                            </Typography>
                                            {!isNew && (
                                                <Typography variant="body2" color="textSecondary">
                                                    {group.name}
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
                                        {isNew ? i18n.t("groupModal.buttons.okAdd") : i18n.t("groupModal.buttons.okEdit")}
                                    </Button>
                                </div>

                                {/* Grid de Conteúdo */}
                                <Grid container spacing={3}>
                                    {/* Coluna 1: Dados do Grupo */}
                                    <Grid item xs={12} md={6}>
                                        <Paper className={classes.card}>
                                            <div className={classes.cardHeader}>
                                                <div className={`${classes.cardIcon} ${classes.cardIconData}`}>
                                                    <Edit />
                                                </div>
                                                <Typography className={classes.cardTitle}>
                                                    Dados do Grupo
                                                </Typography>
                                            </div>

                                            <Field
                                                as={TextField}
                                                name="name"
                                                label={i18n.t("groupModal.form.name")}
                                                variant="outlined"
                                                fullWidth
                                                error={touched.name && Boolean(errors.name)}
                                                helperText={touched.name && errors.name}
                                                InputProps={{
                                                    style: { borderRadius: 12 }
                                                }}
                                            />

                                            <div style={{ marginTop: 24 }}>
                                                <Typography variant="body2" color="textSecondary" gutterBottom>
                                                    Resumo
                                                </Typography>
                                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                                    <Chip
                                                        size="small"
                                                        icon={<Security style={{ fontSize: 16 }} />}
                                                        label={`${selectedPermissions.length} permissões`}
                                                        color="primary"
                                                        variant="outlined"
                                                    />
                                                    <Chip
                                                        size="small"
                                                        icon={<Group style={{ fontSize: 16 }} />}
                                                        label={`${groupUsers.length} usuários`}
                                                        color="secondary"
                                                        variant="outlined"
                                                    />
                                                </div>
                                            </div>
                                        </Paper>
                                    </Grid>

                                    {/* Coluna 2: Usuários (moved to right) */}
                                    <Grid item xs={12} md={6}>
                                        <Paper className={classes.card}>
                                            <div className={classes.cardHeader}>
                                                <div className={`${classes.cardIcon} ${classes.cardIconUsers}`}>
                                                    <Group />
                                                </div>
                                                <Typography className={classes.cardTitle}>
                                                    Usuários do Grupo
                                                </Typography>
                                                <Chip
                                                    size="small"
                                                    label={groupUsers.length}
                                                    className={classes.chip}
                                                    color="secondary"
                                                />
                                            </div>

                                            <TextField
                                                placeholder="Buscar usuários..."
                                                variant="outlined"
                                                size="small"
                                                fullWidth
                                                value={userSearchTerm}
                                                onChange={(e) => setUserSearchTerm(e.target.value)}
                                                className={classes.searchField}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <Search color="action" />
                                                        </InputAdornment>
                                                    ),
                                                }}
                                            />

                                            <List className={classes.userList}>
                                                {filteredGroupUsers.length === 0 ? (
                                                    <div className={classes.emptyState}>
                                                        <Group style={{ fontSize: 48, opacity: 0.3 }} />
                                                        <Typography variant="body2">
                                                            Nenhum usuário no grupo
                                                        </Typography>
                                                    </div>
                                                ) : (
                                                    filteredGroupUsers.map(user => (
                                                        <ListItem key={user.id} className={classes.userItem}>
                                                            <ListItemAvatar>
                                                                <Avatar className={classes.userAvatar}>
                                                                    {getInitials(user.name)}
                                                                </Avatar>
                                                            </ListItemAvatar>
                                                            <ListItemText
                                                                primary={user.name}
                                                                secondary={user.email}
                                                                primaryTypographyProps={{ style: { fontWeight: 500 } }}
                                                            />
                                                            <ListItemSecondaryAction>
                                                                <Tooltip title="Remover do grupo">
                                                                    <IconButton
                                                                        edge="end"
                                                                        size="small"
                                                                        onClick={() => handleRemoveUser(user.id)}
                                                                    >
                                                                        <Delete fontSize="small" color="error" />
                                                                    </IconButton>
                                                                </Tooltip>
                                                            </ListItemSecondaryAction>
                                                        </ListItem>
                                                    ))
                                                )}
                                            </List>

                                            <Button
                                                variant="outlined"
                                                color="primary"
                                                fullWidth
                                                startIcon={<PersonAdd />}
                                                className={classes.addUserButton}
                                                onClick={() => setAddUserDialogOpen(true)}
                                            >
                                                Adicionar Usuário
                                            </Button>
                                        </Paper>
                                    </Grid>

                                    {/* Coluna 3: Permissões (Full Width) */}
                                    <Grid item xs={12}>
                                        <Paper className={classes.card}>
                                            <div className={classes.cardHeader}>
                                                <div className={`${classes.cardIcon} ${classes.cardIconPermissions}`}>
                                                    <Security />
                                                </div>
                                                <Typography className={classes.cardTitle}>
                                                    Permissões
                                                </Typography>
                                                <Chip
                                                    size="small"
                                                    label={`${selectedPermissions.length}/${allPermissions.length}`}
                                                    className={classes.chip}
                                                    color="primary"
                                                />
                                            </div>

                                            <PermissionTransferList
                                                allPermissions={allPermissions}
                                                selectedPermissions={selectedPermissions}
                                                onChange={handlePermissionChange}
                                            />
                                        </Paper>
                                    </Grid>
                                </Grid>
                            </div>
                        </Fade>
                    </Form>
                )}
            </Formik>

            {/* Dialog para adicionar usuário */}
            <Dialog
                open={addUserDialogOpen}
                onClose={() => setAddUserDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Adicionar Usuário ao Grupo</DialogTitle>
                <DialogContent className={classes.dialogContent}>
                    <TextField
                        placeholder="Buscar usuário..."
                        variant="outlined"
                        size="small"
                        fullWidth
                        value={availableUserSearch}
                        onChange={(e) => setAvailableUserSearch(e.target.value)}
                        style={{ marginBottom: 16 }}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search color="action" />
                                </InputAdornment>
                            ),
                        }}
                    />

                    <List style={{ maxHeight: 300, overflow: "auto" }}>
                        {availableUsers.length === 0 ? (
                            <div className={classes.emptyState}>
                                <Typography variant="body2">
                                    Nenhum usuário disponível
                                </Typography>
                            </div>
                        ) : (
                            availableUsers.map(user => (
                                <ListItem
                                    key={user.id}
                                    className={classes.availableUserItem}
                                    onClick={() => handleAddUser(user)}
                                >
                                    <ListItemAvatar>
                                        <Avatar className={classes.userAvatar}>
                                            {getInitials(user.name)}
                                        </Avatar>
                                    </ListItemAvatar>
                                    <ListItemText
                                        primary={user.name}
                                        secondary={user.email}
                                    />
                                    <PersonAdd color="primary" />
                                </ListItem>
                            ))
                        )}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddUserDialogOpen(false)} color="secondary">
                        Cancelar
                    </Button>
                </DialogActions>
            </Dialog>
        </MainContainer>
    );
};

export default GroupEdit;
