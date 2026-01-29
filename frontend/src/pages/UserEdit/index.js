import React, { useState, useEffect, useCallback, useContext } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { useParams, useHistory } from "react-router-dom";

import {
    makeStyles,
    Paper,
    Grid,
    Typography,
    TextField,
    Button,
    IconButton,
    Checkbox,
    FormControlLabel,
    Collapse,
    CircularProgress,
    InputAdornment,
    Chip,
    MenuItem,
    Select,
    InputLabel,
    FormControl,
    Fade,
    Tooltip
} from "@material-ui/core";

import {
    ArrowBack,
    Save,
    ExpandMore,
    ExpandLess,
    ContactMail,
    ConfirmationNumber,
    Group,
    QuestionAnswer,
    AccountTree,
    MenuBook,
    Phone,
    QueuePlayNext,
    Settings,
    Dashboard,
    Code,
    Business,
    Storefront,
    Headset,
    Drafts,
    Person,
    Email,
    Lock,
    Visibility,
    VisibilityOff,
    WhatsApp,
    SupervisorAccount,
    Security,
    Block,
    CheckCircle,

    Send,
    VerifiedUser,
    Search
} from "@material-ui/icons";
import Switch from "@material-ui/core/Switch";
import InputBase from "@material-ui/core/InputBase";

import MainContainer from "../../components/MainContainer";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import QueueSelect from "../../components/QueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import useWhatsApps from "../../hooks/useWhatsApps";

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
    cardIconUser: {
        background: `linear-gradient(135deg, ${theme.palette.info.main}20 0%, ${theme.palette.info.light}20 100%)`,
        color: theme.palette.info.main,
    },
    cardIconSettings: {
        background: `linear-gradient(135deg, ${theme.palette.success.main}20 0%, ${theme.palette.success.light}20 100%)`,
        color: theme.palette.success.main,
    },
    cardIconPermissions: {
        background: `linear-gradient(135deg, ${theme.palette.warning.main}20 0%, ${theme.palette.warning.light}20 100%)`,
        color: theme.palette.warning.main,
    },
    cardTitle: {
        fontWeight: 600,
        fontSize: "1.1rem",
    },
    categorySection: {
        marginBottom: theme.spacing(1),
    },
    categoryHeader: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: theme.spacing(1, 1.5),
        borderRadius: 10,
        cursor: "pointer",
        transition: "background 0.2s ease",
        "&:hover": {
            background: theme.palette.action.hover,
        },
    },
    categoryHeaderLeft: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(1),
    },
    categoryIcon: {
        fontSize: 20,
        opacity: 0.8,
    },
    categoryName: {
        fontWeight: 500,
        fontSize: "0.95rem",
    },
    categoryBadge: {
        marginLeft: theme.spacing(1),
    },
    permissionItem: {
        paddingLeft: theme.spacing(4),
    },
    permissionCheckbox: {
        padding: theme.spacing(0.5),
    },
    permissionLabel: {
        fontSize: "0.875rem",
    },
    permissionsContainer: {
        maxHeight: 600,
        overflowY: "auto",
        ...theme.scrollbarStyles,
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
    chip: {
        marginLeft: theme.spacing(1),
        height: 22,
        fontSize: "0.75rem",
    },
    fieldSpacing: {
        marginBottom: theme.spacing(2),
    },
    headerButtons: {
        display: "flex",
        gap: theme.spacing(1),
        alignItems: "center",
    },
    actionButton: {
        borderRadius: 10,
        padding: theme.spacing(1, 2),
        textTransform: "none",
        fontWeight: 500,
    },
    searchContainer: {
        display: "flex",
        alignItems: "center",
        backgroundColor: theme.palette.background.default,
        borderRadius: 12,
        padding: "8px 16px",
        marginBottom: theme.spacing(2),
        border: `1px solid ${theme.palette.divider}`,
        transition: "all 0.2s ease",
        "&:focus-within": {
            borderColor: theme.palette.primary.main,
            boxShadow: `0 0 0 2px ${theme.palette.primary.main}20`,
        },
    },
    searchInput: {
        marginLeft: theme.spacing(1),
        flex: 1,
        fontSize: "0.95rem",
    },
    searchIcon: {
        color: theme.palette.text.secondary,
    },
}));



const categoryIcons = {
    "Contatos": ContactMail,
    "Tickets": ConfirmationNumber,
    "Usuários": Group,
    "Grupos": SupervisorAccount,
    "Respostas Rápidas": QuestionAnswer,
    "Flow Builder": AccountTree,
    "Base de Conhecimento": MenuBook,
    "Conexões": Phone,
    "Filas": QueuePlayNext,
    "Configurações": Settings,
    "Dashboard": Dashboard,
    "Pipelines": AccountTree,
    "Desenvolvedor": Code,
    "Clientes": Business,
    "Marketplace": Storefront,
    "Helpdesk": Headset,
    "Outros": Settings,
};

const UserEdit = () => {
    const classes = useStyles();
    const { userId } = useParams();
    const history = useHistory();

    const isNew = userId === "new";

    const UserSchema = Yup.object().shape({
        name: Yup.string()
            .min(2, "Too Short!")
            .max(50, "Too Long!")
            .required("Required"),
        password: Yup.string()
            .min(5, "Too Short!")
            .max(50, "Too Long!")
            .test("password-required", "Required", function (value) {
                return !isNew || (isNew && !!value);
            }),
        email: Yup.string().email("Invalid email").required("Required"),
    });

    const [user, setUser] = useState(initialState);
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [togglingStatus, setTogglingStatus] = useState(false);
    const [resendingEmail, setResendingEmail] = useState(false);
    const [verifyingEmail, setVerifyingEmail] = useState(false);
    const [smtpPluginActive, setSmtpPluginActive] = useState(false);

    // Data lists
    const [groups, setGroups] = useState([]);
    const [allPermissions, setAllPermissions] = useState([]);

    // Selected values
    const [selectedQueueIds, setSelectedQueueIds] = useState([]);
    const [whatsappId, setWhatsappId] = useState("");
    const [selectedPermissions, setSelectedPermissions] = useState([]);
    const [searchParam, setSearchParam] = useState("");

    const [expandedCategories, setExpandedCategories] = useState({});

    const categorizePermissions = useCallback((permissions) => {
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
            const permName = permission.name || permission.resource;
            if (!permission || !permName) return;
            let category = "Outros";
            for (const [key, label] of Object.entries(categories)) {
                if (permName.includes(key) || permName.includes(key.replace("es", ""))) {
                    category = label;
                    if (permName.includes("admin_queues")) category = "Filas";
                    if (permName.includes("admin_settings")) category = "Configurações";
                    break;
                }
            }

            if (permName.includes("admin_queues")) category = "Filas";
            if (permName.includes("admin_settings")) category = "Configurações";

            if (!grouped[category]) {
                grouped[category] = [];
            }
            grouped[category].push(permission);
        });

        return grouped;
    }, []);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [groupsRes, permissionsRes] = await Promise.all([
                    api.get("/groups"),
                    api.get("/permissions")
                ]);

                setGroups(groupsRes.data);
                setAllPermissions(permissionsRes.data);

                // Expand all categories by default
                const grouped = categorizePermissions(permissionsRes.data);
                const expanded = {};
                Object.keys(grouped).forEach(cat => expanded[cat] = true);
                setExpandedCategories(expanded);

                if (!isNew) {
                    const { data } = await api.get(`/users/${userId}`);
                    setUser(prevState => ({ ...prevState, ...data, groupId: data.groupId || "" }));
                    setSelectedQueueIds(data.queues?.map(q => q.id) || []);
                    setWhatsappId(data.whatsappId || "");
                    setSelectedPermissions(data.permissions?.map(p => p.id) || []);
                }
            } catch (err) {
                toastError(err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userId, isNew, categorizePermissions]);

    // Check if SMTP plugin is active
    useEffect(() => {
        const checkSmtpPlugin = async () => {
            try {
                const { data } = await api.get("/plugins/api/v1/plugins/installed");
                if (data.active && data.active.includes("smtp")) {
                    setSmtpPluginActive(true);
                }
            } catch (err) {
                setSmtpPluginActive(false);
            }
        };
        checkSmtpPlugin();
    }, []);

    const handleSaveUser = async (values) => {
        setSaving(true);
        const userData = {
            ...values,
            whatsappId,
            queueIds: selectedQueueIds,
            permissions: selectedPermissions
        };

        try {
            if (isNew) {
                await api.post("/users", userData);
                toast.success(i18n.t("userModal.success"));
                history.push("/users");
            } else {
                await api.put(`/users/${userId}`, userData);
                toast.success(i18n.t("userModal.success"));
            }
        } catch (err) {
            toastError(err);
        } finally {
            setSaving(false);
        }
    };

    const handlePermissionChange = (permissionId) => {
        setSelectedPermissions(prev => {
            if (prev.includes(permissionId)) {
                return prev.filter(id => id !== permissionId);
            }
            return [...prev, permissionId];
        });
    };

    const handleCategoryToggle = (category) => {
        setExpandedCategories(prev => ({
            ...prev,
            [category]: !prev[category]
        }));
    };

    const handleSelectAllCategory = (categoryPermissions, isAllSelected) => {
        const categoryIds = categoryPermissions.map(p => p.id);
        setSelectedPermissions(prev => {
            if (isAllSelected) {
                return prev.filter(id => !categoryIds.includes(id));
            }
            return [...new Set([...prev, ...categoryIds])];
        });
    };

    const handleToggleStatus = async () => {
        setTogglingStatus(true);
        try {
            const { data } = await api.post(`/users/${userId}/toggle-status`);
            setUser(prev => ({ ...prev, enabled: data.enabled }));
            toast.success(data.enabled ? i18n.t("userModal.toasts.activated") : i18n.t("userModal.toasts.deactivated"));
        } catch (err) {
            toastError(err);
        } finally {
            setTogglingStatus(false);
        }
    };

    const handleResendResetPasswordEmail = async () => {
        setResendingEmail(true);
        try {
            await api.post(`/users/${userId}/resend-welcome`);
            toast.success(i18n.t("userModal.toasts.resetEmailSent"));
        } catch (err) {
            toastError(err);
        } finally {
            setResendingEmail(false);
        }
    };

    const handleManualVerify = async () => {
        setVerifyingEmail(true);
        try {
            await api.post(`/users/${userId}/manual-verify`);
            setUser(prev => ({ ...prev, emailVerified: true }));
            toast.success(i18n.t("userModal.toasts.emailVerified"));
        } catch (err) {
            toastError(err);
        } finally {
            setVerifyingEmail(false);
        }
    };

    const filteredPermissions = allPermissions.filter(p =>
        ((p.name || p.resource) && (p.name || p.resource).toLowerCase().includes(searchParam.toLowerCase())) ||
        (p.description && p.description.toLowerCase().includes(searchParam.toLowerCase()))
    );

    const groupedPermissions = categorizePermissions(filteredPermissions);

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
                initialValues={user}
                enableReinitialize
                validationSchema={UserSchema}
                onSubmit={handleSaveUser}
            >
                {({ touched, errors, values }) => (
                    <Form>
                        <Fade in timeout={400}>
                            <div className={classes.root}>
                                {/* Header */}
                                <div className={classes.header}>
                                    <div className={classes.headerLeft}>
                                        <IconButton
                                            className={classes.backButton}
                                            onClick={() => history.push("/users")}
                                        >
                                            <ArrowBack />
                                        </IconButton>
                                        <div>
                                            <Typography variant="h5" style={{ fontWeight: 600 }}>
                                                {isNew ? i18n.t("userModal.title.add") : i18n.t("userModal.title.edit")}
                                            </Typography>
                                            {!isNew && (
                                                <Typography variant="body2" color="textSecondary">
                                                    {user.name}
                                                </Typography>
                                            )}
                                        </div>
                                    </div>
                                    <div className={classes.headerButtons}>
                                        {!isNew && (
                                            <>
                                                <Button
                                                    variant="outlined"
                                                    color="primary"
                                                    startIcon={resendingEmail ? <CircularProgress size={18} /> : <Lock />}
                                                    className={classes.actionButton}
                                                    onClick={handleResendResetPasswordEmail}
                                                    disabled={resendingEmail || saving}
                                                >
                                                    {i18n.t("userModal.buttons.sendResetPassword")}
                                                </Button>

                                                <Can
                                                    perform="users:verify"
                                                    yes={() => !user.emailVerified && (
                                                        <Button
                                                            variant="outlined"
                                                            color="secondary"
                                                            startIcon={verifyingEmail ? <CircularProgress size={18} /> : <VerifiedUser />}
                                                            className={classes.actionButton}
                                                            onClick={handleManualVerify}
                                                            disabled={verifyingEmail || saving}
                                                        >
                                                            {i18n.t("userModal.buttons.manualVerify")}
                                                        </Button>
                                                    )}
                                                />
                                            </>
                                        )}
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <Save />}
                                            className={classes.saveButton}
                                            type="submit"
                                            disabled={saving}
                                        >
                                            {isNew ? i18n.t("userModal.buttons.okAdd") : i18n.t("userModal.buttons.okEdit")}
                                        </Button>
                                    </div>
                                </div>

                                <Grid container spacing={3}>
                                    {/* Coluna 1: Dados e Configurações */}
                                    <Grid item xs={12} md={4}>
                                        <Grid container spacing={3}>
                                            {/* Dados do Usuário */}
                                            <Grid item xs={12}>
                                                <Paper className={classes.card}>
                                                    <div className={classes.cardHeader}>
                                                        <div className={`${classes.cardIcon} ${classes.cardIconUser}`}>
                                                            <Person />
                                                        </div>
                                                        <Typography className={classes.cardTitle}>
                                                            Dados do Usuário
                                                        </Typography>
                                                    </div>

                                                    <Field
                                                        as={TextField}
                                                        label={i18n.t("userModal.form.name")}
                                                        name="name"
                                                        variant="outlined"
                                                        fullWidth
                                                        error={touched.name && Boolean(errors.name)}
                                                        helperText={touched.name && errors.name}
                                                        className={classes.fieldSpacing}
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <Person color="action" fontSize="small" />
                                                                </InputAdornment>
                                                            ),
                                                            style: { borderRadius: 12 }
                                                        }}
                                                    />

                                                    <Field
                                                        as={TextField}
                                                        label={i18n.t("userModal.form.email")}
                                                        name="email"
                                                        variant="outlined"
                                                        fullWidth
                                                        error={touched.email && Boolean(errors.email)}
                                                        helperText={touched.email && errors.email}
                                                        className={classes.fieldSpacing}
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <Email color="action" fontSize="small" />
                                                                </InputAdornment>
                                                            ),
                                                            style: { borderRadius: 12 }
                                                        }}
                                                    />

                                                    <Field
                                                        as={TextField}
                                                        name="password"
                                                        variant="outlined"
                                                        label={i18n.t("userModal.form.password")}
                                                        error={touched.password && Boolean(errors.password)}
                                                        helperText={touched.password && errors.password}
                                                        type={showPassword ? "text" : "password"}
                                                        fullWidth
                                                        className={classes.fieldSpacing}
                                                        InputProps={{
                                                            startAdornment: (
                                                                <InputAdornment position="start">
                                                                    <Lock color="action" fontSize="small" />
                                                                </InputAdornment>
                                                            ),
                                                            endAdornment: (
                                                                <InputAdornment position="end">
                                                                    <IconButton
                                                                        aria-label="toggle password visibility"
                                                                        onClick={() => setShowPassword((e) => !e)}
                                                                        size="small"
                                                                    >
                                                                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                                                                    </IconButton>
                                                                </InputAdornment>
                                                            ),
                                                            style: { borderRadius: 12 }
                                                        }}
                                                    />



                                                    <FormControl
                                                        variant="outlined"
                                                        fullWidth
                                                    >
                                                        <InputLabel id="group-selection-input-label">
                                                            {i18n.t("userModal.form.group")}
                                                        </InputLabel>
                                                        <Field
                                                            as={Select}
                                                            label={i18n.t("userModal.form.group")}
                                                            name="groupId"
                                                            labelId="group-selection-label"
                                                            id="group-selection"
                                                            style={{ borderRadius: 12 }}
                                                        >
                                                            <MenuItem value=""><em>None</em></MenuItem>
                                                            {groups.map(group => (
                                                                <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>
                                                            ))}
                                                        </Field>
                                                    </FormControl>

                                                </Paper>
                                            </Grid>

                                            {/* Configurações Adicionais */}
                                            <Grid item xs={12}>
                                                <Paper className={classes.card}>
                                                    <div className={classes.cardHeader}>
                                                        <div className={`${classes.cardIcon} ${classes.cardIconSettings}`}>
                                                            <Settings />
                                                        </div>
                                                        <Typography className={classes.cardTitle}>
                                                            Configurações
                                                        </Typography>
                                                    </div>

                                                    <div className={classes.fieldSpacing}>
                                                        <QueueSelect
                                                            selectedQueueIds={selectedQueueIds}
                                                            onChange={(values) => setSelectedQueueIds(values)}
                                                        />
                                                    </div>

                                                    <Can
                                                        role={loggedInUser.profile}
                                                        perform="user-modal:editQueues"
                                                        yes={() => (
                                                            !loadingWhats && (
                                                                <FormControl
                                                                    variant="outlined"
                                                                    fullWidth
                                                                >
                                                                    <InputLabel>{i18n.t("userModal.form.whatsapp")}</InputLabel>
                                                                    <Field
                                                                        as={Select}
                                                                        value={whatsappId}
                                                                        onChange={(e) => setWhatsappId(e.target.value)}
                                                                        label={i18n.t("userModal.form.whatsapp")}
                                                                        style={{ borderRadius: 12 }}
                                                                    >
                                                                        <MenuItem value={""}>&nbsp;</MenuItem>
                                                                        {whatsApps.map((whatsapp) => (
                                                                            <MenuItem key={whatsapp.id} value={whatsapp.id}>
                                                                                {whatsapp.name}
                                                                            </MenuItem>
                                                                        ))}
                                                                    </Field>
                                                                </FormControl>
                                                            )
                                                        )}
                                                    />

                                                </Paper>
                                            </Grid>
                                        </Grid>
                                    </Grid>

                                    {/* Coluna 2: Permissões */}
                                    <Grid item xs={12} md={8}>
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

                                            <Can
                                                role={loggedInUser.profile}
                                                perform="user-modal:editProfile"
                                                yes={() => (
                                                    <div className={classes.permissionsContainer}>
                                                        <div className={classes.searchContainer}>
                                                            <Search className={classes.searchIcon} />
                                                            <InputBase
                                                                className={classes.searchInput}
                                                                placeholder="Buscar permissões..."
                                                                value={searchParam}
                                                                onChange={(e) => setSearchParam(e.target.value)}
                                                            />
                                                        </div>

                                                        {Object.entries(groupedPermissions).map(([category, permissions]) => {
                                                            const CategoryIcon = categoryIcons[category] || Settings;
                                                            const selectedCount = permissions.filter(p =>
                                                                selectedPermissions.includes(p.id)
                                                            ).length;
                                                            const isAllSelected = selectedCount === permissions.length;

                                                            return (
                                                                <div key={category} className={classes.categorySection}>
                                                                    <div
                                                                        className={classes.categoryHeader}
                                                                        onClick={() => handleCategoryToggle(category)}
                                                                    >
                                                                        <div className={classes.categoryHeaderLeft}>
                                                                            <Switch
                                                                                checked={isAllSelected}
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handleSelectAllCategory(permissions, isAllSelected);
                                                                                }}
                                                                                color="primary"
                                                                                size="small"
                                                                                inputProps={{ 'aria-label': 'secondary checkbox' }}
                                                                            />
                                                                            <CategoryIcon className={classes.categoryIcon} />
                                                                            <Typography className={classes.categoryName}>
                                                                                {category}
                                                                            </Typography>
                                                                            <Chip
                                                                                size="small"
                                                                                label={`${selectedCount}/${permissions.length}`}
                                                                                className={classes.categoryBadge}
                                                                                variant="outlined"
                                                                                color={selectedCount > 0 ? "primary" : "default"}
                                                                            />
                                                                        </div>
                                                                        {expandedCategories[category] ? <ExpandLess /> : <ExpandMore />}
                                                                    </div>

                                                                    <Collapse in={expandedCategories[category]}>
                                                                        <div style={{ paddingLeft: 24 }}>
                                                                            <Grid container spacing={1}>
                                                                                {permissions.map(permission => (
                                                                                    <Grid item xs={12} sm={6} key={permission.id}>
                                                                                        <FormControlLabel
                                                                                            control={
                                                                                                <Switch
                                                                                                    checked={selectedPermissions.includes(permission.id)}
                                                                                                    onChange={() => handlePermissionChange(permission.id)}
                                                                                                    color="primary"
                                                                                                    size="small"
                                                                                                />
                                                                                            }
                                                                                            label={
                                                                                                <Typography className={classes.permissionLabel}>
                                                                                                    {permission.description || permission.name || permission.resource}
                                                                                                </Typography>
                                                                                            }
                                                                                            className={classes.permissionItem}
                                                                                        />
                                                                                    </Grid>
                                                                                ))}
                                                                            </Grid>
                                                                        </div>
                                                                    </Collapse>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                                no={() => (
                                                    <Typography variant="h6" color="error" align="center">
                                                        Você não tem permissão para editar permissões.
                                                    </Typography>
                                                )}
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

// Start of Security Icon definition if it wasn't imported. 
// Wait, I used Security in the code but didn't import it in the top list.
// I see I imported 'Security' in GroupEdit but here I missed it in my manual list above?
// Let me check my generated code imports.
// Imports: ArrowBack, Save, ExpandMore, ExpandLess, ContactMail...
// I missed 'Security'. I will add it.
// Also 'Paper', 'Grid' etc are imported.
// I'll make sure to add Security to imports.

export default UserEdit;
