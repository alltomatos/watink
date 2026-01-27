import React, { useState } from "react";
import { Link as RouterLink, useHistory, useParams } from "react-router-dom";

import {
    Avatar,
    Button,
    CssBaseline,
    TextField,
    Grid,
    Typography,
    Container,
    InputAdornment,
    IconButton
} from '@material-ui/core';

import { LockOutlined, Visibility, VisibilityOff } from '@material-ui/icons';

import { makeStyles } from "@material-ui/core/styles";
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
    paper: {
        marginTop: theme.spacing(8),
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
    },
    avatar: {
        margin: theme.spacing(1),
        backgroundColor: theme.palette.secondary.main,
    },
    form: {
        width: "100%", // Fix IE 11 issue.
        marginTop: theme.spacing(1),
    },
    submit: {
        margin: theme.spacing(3, 0, 2),
    },
}));

const CompleteRegistration = () => {
    const classes = useStyles();
    const history = useHistory();
    const { token } = useParams();

    const [passwords, setPasswords] = useState({ password: "", confirmPassword: "" });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleChangeInput = (e) => {
        setPasswords({ ...passwords, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (passwords.password !== passwords.confirmPassword) {
            toast.error("As senhas não conferem");
            return;
        }

        try {
            await api.post("/auth/complete-registration", {
                token,
                password: passwords.password
            });

            toast.success("E-mail verificado e senha definida com sucesso!");
            history.push("/login");
        } catch (err) {
            toast.error("Falha ao verificar e-mail e definir senha. O link pode ter expirado.");
        }
    };

    return (
        <Container component="main" maxWidth="xs">
            <CssBaseline />
            <div className={classes.paper}>
                <Avatar className={classes.avatar}>
                    <LockOutlined />
                </Avatar>
                <Typography component="h1" variant="h5">
                    Definir Senha e Verificar E-mail
                </Typography>
                <form className={classes.form} noValidate onSubmit={handleSubmit}>
                    <TextField
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        name="password"
                        label="Nova Senha"
                        type={showPassword ? "text" : "password"}
                        id="password"
                        value={passwords.password}
                        onChange={handleChangeInput}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label="toggle password visibility"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                    <TextField
                        variant="outlined"
                        margin="normal"
                        required
                        fullWidth
                        name="confirmPassword"
                        label="Confirmar Senha"
                        type={showConfirmPassword ? "text" : "password"}
                        id="confirmPassword"
                        value={passwords.confirmPassword}
                        onChange={handleChangeInput}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label="toggle password visibility"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    >
                                        {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                    <Button
                        type="submit"
                        fullWidth
                        variant="contained"
                        color="primary"
                        className={classes.submit}
                    >
                        Confirmar e Acessar
                    </Button>
                    <Grid container>
                        <Grid item>
                            <RouterLink to="/login" variant="body2">
                                Voltar para Login
                            </RouterLink>
                        </Grid>
                    </Grid>
                </form>
            </div>
        </Container>
    );
};

export default CompleteRegistration;
