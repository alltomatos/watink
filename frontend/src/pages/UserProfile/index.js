import React, { useState, useEffect, useContext } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import {
    Button,
    TextField,
    InputAdornment,
    IconButton,
    Avatar,
    Box,
    Typography,
    Container,
    Paper,
    Badge,
    Grid,
} from "@material-ui/core";
import { Visibility, VisibilityOff, CameraAlt } from "@material-ui/icons";
import { makeStyles } from "@material-ui/core/styles";
import { green } from "@material-ui/core/colors";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { getBackendUrl } from "../../config";

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: theme.spacing(4),
    },
    paper: {
        padding: theme.spacing(4),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        width: "100%",
        maxWidth: 600,
    },
    avatarContainer: {
        position: "relative",
        marginBottom: theme.spacing(4),
    },
    avatar: {
        width: theme.spacing(16),
        height: theme.spacing(16),
    },
    uploadInput: {
        display: "none",
    },
    form: {
        width: "100%", // Fix IE 11 issue.
        marginTop: theme.spacing(1),
    },
    submit: {
        margin: theme.spacing(3, 0, 2),
    },
    btnWrapper: {
        position: "relative",
    },
}));

const UserSchema = Yup.object().shape({
    name: Yup.string()
        .min(2, "Too Short!")
        .max(50, "Too Long!")
        .required("Required"),
    email: Yup.string().email("Invalid email").required("Required"),
    password: Yup.string().min(5, "Too Short!").max(50, "Too Long!"),
    confirmPassword: Yup.string().oneOf(
        [Yup.ref("password"), null],
        "Passwords must match"
    ),
});

const UserProfile = () => {
    const classes = useStyles();
    const { user } = useContext(AuthContext);

    const initialState = {
        name: "",
        email: "",
        password: "",
        confirmPassword: "",
    };

    const [profile, setProfile] = useState(initialState);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const { data } = await api.get(`/users/${user.id}`);
                setProfile((prevState) => ({ ...prevState, ...data }));
                if (data.profileImage) {
                    setAvatarPreview(`${getBackendUrl()}/public/${data.profileImage}`);
                }
            } catch (err) {
                toastError(err);
            }
        };
        fetchUser();
    }, [user.id]);

    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAvatarPreview(URL.createObjectURL(file));
            setSelectedFile(file);
        }
    };

    const handleSubmit = async (values, actions) => {
        const formData = new FormData();
        formData.append("name", values.name);
        formData.append("email", values.email);
        if (values.password) {
            formData.append("password", values.password);
        }
        if (selectedFile) {
            formData.append("profileImage", selectedFile);
        }

        // Append other read-only data if necessary for backend validation, 
        // but usually backend relies on what is sent + defaults.
        // We might need to send profile, queueIds etc if backend controller expects them or fails.
        // But our updated logic accepts partial updates via UpdateUserService logic adjustment.

        // However, our backend implementation extracted `userData` from `req.body` and `profileImage` from `req.file`.
        // When using FormData, `req.body` might be populated differently by multer/express.
        // Multer populates `req.body` with text fields and `req.file` with the file.

        try {
            await api.put(`/users/${user.id}`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data"
                }
            });
            toast.success(i18n.t("userModal.success"));
            //   window.location.reload(); // Reload to update avatar in header if needed
        } catch (err) {
            toastError(err);
        } finally {
            actions.setSubmitting(false);
        }
    };

    return (
        <Container component="main" maxWidth="sm" className={classes.root}>
            <Paper className={classes.paper} elevation={3}>
                <Typography component="h1" variant="h5" gutterBottom>
                    {i18n.t("mainDrawer.appBar.user.profile")}
                </Typography>

                <Formik
                    initialValues={profile}
                    enableReinitialize={true}
                    validationSchema={UserSchema}
                    onSubmit={handleSubmit}
                >
                    {({ touched, errors, isSubmitting }) => (
                        <Form className={classes.form}>
                            <Box display="flex" justifyContent="center" className={classes.avatarContainer}>
                                <input
                                    accept="image/*"
                                    className={classes.uploadInput}
                                    id="icon-button-file"
                                    type="file"
                                    onChange={handleAvatarChange}
                                />
                                <label htmlFor="icon-button-file">
                                    <Badge
                                        overlap="circle"
                                        anchorOrigin={{
                                            vertical: "bottom",
                                            horizontal: "right",
                                        }}
                                        badgeContent={
                                            <IconButton
                                                component="span"
                                                style={{ backgroundColor: "#3f51b5", color: "white", width: 32, height: 32 }}
                                            >
                                                <CameraAlt style={{ fontSize: 20 }} />
                                            </IconButton>
                                        }
                                    >
                                        <Avatar
                                            src={avatarPreview}
                                            className={classes.avatar}
                                            alt={profile.name}
                                        />
                                    </Badge>
                                </label>
                            </Box>

                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <Field
                                        as={TextField}
                                        variant="outlined"
                                        fullWidth
                                        label={i18n.t("userModal.form.name")}
                                        name="name"
                                        error={touched.name && Boolean(errors.name)}
                                        helperText={touched.name && errors.name}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Field
                                        as={TextField}
                                        variant="outlined"
                                        fullWidth
                                        label={i18n.t("userModal.form.email")}
                                        name="email"
                                        error={touched.email && Boolean(errors.email)}
                                        helperText={touched.email && errors.email}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Field
                                        as={TextField}
                                        variant="outlined"
                                        fullWidth
                                        name="password"
                                        label={i18n.t("userModal.form.password")}
                                        type={showPassword ? "text" : "password"}
                                        error={touched.password && Boolean(errors.password)}
                                        helperText={touched.password && errors.password}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={() => setShowPassword(!showPassword)}
                                                    >
                                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <Field
                                        as={TextField}
                                        variant="outlined"
                                        fullWidth
                                        name="confirmPassword"
                                        label="Confirmar Senha"
                                        type={showConfirmPassword ? "text" : "password"}
                                        error={touched.confirmPassword && Boolean(errors.confirmPassword)}
                                        helperText={touched.confirmPassword && errors.confirmPassword}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                    >
                                                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                </Grid>
                            </Grid>

                            <Button
                                type="submit"
                                fullWidth
                                variant="contained"
                                color="primary"
                                className={classes.submit}
                                disabled={isSubmitting}
                            >
                                {i18n.t("userModal.buttons.okEdit")}
                            </Button>
                        </Form>
                    )}
                </Formik>
            </Paper>
        </Container>
    );
};

export default UserProfile;
