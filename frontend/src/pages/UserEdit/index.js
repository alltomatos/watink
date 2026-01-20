import React, { useState, useEffect, useReducer, useContext } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { useParams, useHistory } from "react-router-dom";

import {
    Button,
    CircularProgress,
    Select,
    InputLabel,
    MenuItem,
    FormControl,
    TextField,
    InputAdornment,
    IconButton,
    Paper,
    Tabs,
    Tab,
    Box,
    Typography,
    Grid,
    Checkbox,
    FormControlLabel,
    FormGroup,
    ListItemText
} from "@material-ui/core";

import { Visibility, VisibilityOff } from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import QueueSelect from "../../components/QueueSelect";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import useWhatsApps from "../../hooks/useWhatsApps";

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        flexWrap: "wrap",
    },
    paper: {
        padding: theme.spacing(2),
        display: "flex",
        overflow: "auto",
        flexDirection: "column",
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
    tabContent: {
        padding: theme.spacing(2)
    }
}));

const UserSchema = Yup.object().shape({
    name: Yup.string()
        .min(2, "Too Short!")
        .max(50, "Too Long!")
        .required("Required"),
    password: Yup.string().min(5, "Too Short!").max(50, "Too Long!"),
    email: Yup.string().email("Invalid email").required("Required"),
});

const UserEdit = () => {
    const classes = useStyles();
    const { userId } = useParams();
    const history = useHistory();

    const initialState = {
        name: "",
        email: "",
        password: "",
        profile: "user",
        groupId: ""
    };

    const { user: loggedInUser } = useContext(AuthContext);

    const [user, setUser] = useState(initialState);
    const [selectedQueueIds, setSelectedQueueIds] = useState([]);
    const [showPassword, setShowPassword] = useState(false);
    const [whatsappId, setWhatsappId] = useState(false);
    const { loading, whatsApps } = useWhatsApps();
    const [tab, setTab] = useState(0);
    const [groups, setGroups] = useState([]);
    const [allPermissions, setAllPermissions] = useState([]);
    const [selectedPermissions, setSelectedPermissions] = useState([]);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const { data } = await api.get(`/users/${userId}`);
                const userGroupIds = data.groups?.map((group) => group.id) || [];
                setUser((prevState) => {
                    return { ...prevState, ...data, groupIds: userGroupIds };
                });
                const userQueueIds = data.queues?.map((queue) => queue.id);
                setSelectedQueueIds(userQueueIds);
                setWhatsappId(data.whatsappId ? data.whatsappId : "");
                setSelectedPermissions(data.permissions?.map(p => p.id) || []);
            } catch (err) {
                toastError(err);
            }
        };

        const fetchGroups = async () => {
            try {
                const { data } = await api.get("/groups");
                setGroups(data);
            } catch (err) {
                toastError(err);
            }
        };

        const fetchPermissions = async () => {
            try {
                const { data } = await api.get("/permissions");
                setAllPermissions(data);
            } catch (err) {
                toastError(err);
            }
        };

        fetchUser();
        fetchGroups();
        fetchPermissions();
    }, [userId]);

    const handleSaveUser = async (values) => {
        const userData = { ...values, whatsappId, queueIds: selectedQueueIds, permissions: selectedPermissions };
        try {
            await api.put(`/users/${userId}`, userData);
            toast.success(i18n.t("userModal.success"));
        } catch (err) {
            toastError(err);
        }
    };

    const handleTabChange = (event, newValue) => {
        setTab(newValue);
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

    return (
        <MainContainer>
            <MainHeader>
                <Title>{user.name}</Title>
            </MainHeader>
            <Paper className={classes.paper}>
                <Tabs value={tab} onChange={handleTabChange} indicatorColor="primary" textColor="primary">
                    <Tab label="Dados do Usuário" />
                    <Tab label="Permissões" />
                </Tabs>

                <Box hidden={tab !== 0} className={classes.tabContent}>
                    <Formik
                        initialValues={user}
                        enableReinitialize={true}
                        validationSchema={UserSchema}
                        onSubmit={(values, actions) => {
                            setTimeout(() => {
                                handleSaveUser(values);
                                actions.setSubmitting(false);
                            }, 400);
                        }}
                    >
                        {({ touched, errors, isSubmitting }) => (
                            <Form>
                                <div className={classes.multFieldLine}>
                                    <Field
                                        as={TextField}
                                        label={i18n.t("userModal.form.name")}
                                        name="name"
                                        error={touched.name && Boolean(errors.name)}
                                        helperText={touched.name && errors.name}
                                        variant="outlined"
                                        margin="dense"
                                        fullWidth
                                    />
                                    <Field
                                        as={TextField}
                                        name="password"
                                        variant="outlined"
                                        margin="dense"
                                        label={i18n.t("userModal.form.password")}
                                        error={touched.password && Boolean(errors.password)}
                                        helperText={touched.password && errors.password}
                                        type={showPassword ? "text" : "password"}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        aria-label="toggle password visibility"
                                                        onClick={() => setShowPassword((e) => !e)}
                                                    >
                                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                        fullWidth
                                    />
                                </div>
                                <div className={classes.multFieldLine}>
                                    <Field
                                        as={TextField}
                                        label={i18n.t("userModal.form.email")}
                                        name="email"
                                        error={touched.email && Boolean(errors.email)}
                                        helperText={touched.email && errors.email}
                                        variant="outlined"
                                        margin="dense"
                                        fullWidth
                                    />
                                    <FormControl
                                        variant="outlined"
                                        className={classes.formControl}
                                        margin="dense"
                                    >
                                        <Can
                                            role={loggedInUser.profile}
                                            perform="user-modal:editProfile"
                                            yes={() => (
                                                <>
                                                    <InputLabel id="profile-selection-input-label">
                                                        {i18n.t("userModal.form.profile")}
                                                    </InputLabel>

                                                    <Field
                                                        as={Select}
                                                        label={i18n.t("userModal.form.profile")}
                                                        name="profile"
                                                        labelId="profile-selection-label"
                                                        id="profile-selection"
                                                        required
                                                    >
                                                        <MenuItem value="admin">Admin</MenuItem>
                                                        <MenuItem value="user">User</MenuItem>
                                                    </Field>
                                                </>
                                            )}
                                        />
                                    </FormControl>

                                    <FormControl
                                        variant="outlined"
                                        className={classes.formControl}
                                        margin="dense"
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
                                        >
                                            <MenuItem value=""><em>None</em></MenuItem>
                                            {groups.map(group => (
                                                <MenuItem key={group.id} value={group.id}>{group.name}</MenuItem>
                                            ))}
                                        </Field>
                                    </FormControl>

                                </div>
                                <Can
                                    role={loggedInUser.profile}
                                    perform="user-modal:editQueues"
                                    yes={() => (
                                        <QueueSelect
                                            selectedQueueIds={selectedQueueIds}
                                            onChange={(values) => setSelectedQueueIds(values)}
                                        />
                                    )}
                                />
                                <Can
                                    role={loggedInUser.profile}
                                    perform="user-modal:editQueues"
                                    yes={() => (
                                        !loading && (
                                            <FormControl
                                                variant="outlined"
                                                margin="dense"
                                                className={classes.maxWidth}
                                                fullWidth
                                            >
                                                <InputLabel>{i18n.t("userModal.form.whatsapp")}</InputLabel>
                                                <Field
                                                    as={Select}
                                                    value={whatsappId}
                                                    onChange={(e) => setWhatsappId(e.target.value)}
                                                    label={i18n.t("userModal.form.whatsapp")}
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

                                <div className={classes.btnWrapper}>
                                    <Button
                                        type="submit"
                                        color="primary"
                                        disabled={isSubmitting}
                                        variant="contained"
                                    >
                                        {i18n.t("userModal.buttons.okEdit")}
                                        {isSubmitting && (
                                            <CircularProgress
                                                size={24}
                                                className={classes.buttonProgress}
                                            />
                                        )}
                                    </Button>
                                </div>
                            </Form>
                        )}
                    </Formik>
                </Box>

                <Box hidden={tab !== 1} className={classes.tabContent}>
                    <Can
                        role={loggedInUser.profile}
                        perform="user-modal:editProfile"
                        yes={() => (
                            <Grid container spacing={2}>
                                {allPermissions.map(permission => (
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
                        )}
                        no={() => <Typography variant="h6" color="error">Você não tem permissão para editar permissões.</Typography>}
                    />
                    <div className={classes.btnWrapper}>
                        <Button
                            variant="contained"
                            color="primary"
                            onClick={() => handleSaveUser(user)}
                        >
                            Salvar Permissões
                        </Button>
                    </div>
                </Box>

            </Paper>
        </MainContainer>
    );
};

export default UserEdit;
