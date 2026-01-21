import React, { useState, useEffect, useContext } from "react";
import { Link as RouterLink } from "react-router-dom";

import {
  Avatar,
  Button,
  CssBaseline,
  TextField,
  Grid,
  Box,
  Typography,
  Container,
  InputAdornment,
  IconButton,
  Link,
  Checkbox,
  FormControlLabel
} from '@material-ui/core';

import { LockOutlined, Visibility, VisibilityOff } from '@material-ui/icons';

import { makeStyles } from "@material-ui/core/styles";

import { i18n } from "../../translate/i18n";

import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import { getBackendUrl } from "../../config";

// const Copyright = () => {
// 	return (
// 		<Typography variant="body2" color="textSecondary" align="center">
// 			{"Copyleft "}
// 			<Link color="inherit" href="https://github.com/canove">
// 				Canove
// 			</Link>{" "}
// 			{new Date().getFullYear()}
// 			{"."}
// 		</Typography>
// 	);
// };

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

const Login = () => {
  const classes = useStyles();

  const [user, setUser] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(() => {
    // Se há email salvo, mantém rememberMe como true
    return localStorage.getItem("rememberedEmail") !== null;
  });
  const [settings, setSettings] = useState({
    loginLayout: "split_left", // split_left, split_right, centered
    loginBackground: "", // url
    systemLogo: "",
  });

  const { handleLogin } = useContext(AuthContext);

  // Carregar email salvo do localStorage
  useEffect(() => {
    const savedEmail = localStorage.getItem("rememberedEmail");
    if (savedEmail) {
      setUser(prev => ({ ...prev, email: savedEmail }));
      setRememberMe(true);
    }
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get("/public-settings");
        const settingsData = Array.isArray(data) ? data : [];

        const layoutSetting = settingsData.find(s => s.key === "login_layout");
        const bgSetting = settingsData.find(s => s.key === "login_backgroundImage");
        const logoSetting = settingsData.find(s => s.key === "systemLogo");
        const userCreationSetting = settingsData.find(s => s.key === "userCreation");

        setSettings({
          loginLayout: layoutSetting?.value || "split_left",
          loginBackground: bgSetting?.value ? `${getBackendUrl()}${bgSetting.value.startsWith('/') ? bgSetting.value.slice(1) : bgSetting.value}` : "/login-background.png",
          systemLogo: logoSetting?.value ? `${getBackendUrl()}${logoSetting.value.startsWith('/') ? logoSetting.value.slice(1) : logoSetting.value}` : "/logo.png",
          userCreation: userCreationSetting?.value || "enabled",
        });
      } catch (err) {
        console.error("Error fetching settings for login", err);
      }
    };
    fetchSettings();
  }, []);

  const handleChangeInput = (e) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handlSubmit = (e) => {
    e.preventDefault();

    // Salvar ou remover email do localStorage baseado no rememberMe
    if (rememberMe) {
      localStorage.setItem("rememberedEmail", user.email);
    } else {
      localStorage.removeItem("rememberedEmail");
    }

    handleLogin(user, rememberMe);
  };

  const renderLoginForm = () => (
    <div className={classes.paper}>
      {settings.systemLogo && (
        <img
          src={settings.systemLogo}
          alt="Logo"
          style={{ maxWidth: 200, marginBottom: 20 }}
          onError={(e) => { e.target.onerror = null; e.target.src = "/logo.png"; }}
        />
      )}
      {!settings.systemLogo && (
        <Avatar className={classes.avatar}>
          <LockOutlined />
        </Avatar>
      )}
      {!settings.systemLogo && (
        <Typography component="h1" variant="h5">
          {i18n.t("login.title")}
        </Typography>
      )}

      <form className={classes.form} noValidate onSubmit={handlSubmit}>
        <TextField
          variant="outlined"
          margin="normal"
          required
          fullWidth
          id="email"
          label={i18n.t("login.form.email")}
          name="email"
          value={user.email}
          onChange={handleChangeInput}
          autoComplete="email"
          autoFocus
        />
        <TextField
          variant="outlined"
          margin="normal"
          required
          fullWidth
          name="password"
          label={i18n.t("login.form.password")}
          id="password"
          value={user.password}
          onChange={handleChangeInput}
          autoComplete="current-password"
          type={showPassword ? 'text' : 'password'}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <IconButton
                  aria-label={i18n.t("login.form.passwordVisibility")}
                  onClick={() => setShowPassword((e) => !e)}
                >
                  {showPassword ? <VisibilityOff /> : <Visibility />}
                </IconButton>
              </InputAdornment>
            )
          }}
        />
        <Grid container alignItems="center">
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  name="rememberMe"
                  color="primary"
                />
              }
              label={i18n.t("login.form.rememberMe")}
            />
          </Grid>
        </Grid>
        <Button
          type="submit"
          fullWidth
          variant="contained"
          color="primary"
          className={classes.submit}
        >
          {i18n.t("login.buttons.submit")}
        </Button>
        <Grid container>
          <Grid item>
            {settings.userCreation === "enabled" && (
              <Grid item>
                <Link
                  href="#"
                  variant="body2"
                  component={RouterLink}
                  to="/signup"
                >
                  {i18n.t("login.buttons.register")}
                </Link>
              </Grid>
            )}
          </Grid>
        </Grid>
      </form>
    </div>
  );

  // Layout Render Logic
  if (settings.loginLayout === "centered") {
    return (
      <Box
        style={{
          minHeight: "100vh",
          backgroundImage: settings.loginBackground ? `url(${settings.loginBackground})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: settings.loginBackground ? "transparent" : "#f0f2f5",
        }}
      >
        <CssBaseline />
        <Container component="main" maxWidth="xs">
          <Box
            style={{
              backgroundColor: "rgba(255, 255, 255, 0.95)",
              padding: 40,
              borderRadius: 16,
              boxShadow: "0 8px 32px 0 rgba(31, 38, 135, 0.37)"
            }}
          >
            {renderLoginForm()}
          </Box>
        </Container>
      </Box>
    );
  }

  // Split Screen Logic
  const isRightForm = settings.loginLayout === "split_right";

  return (
    <Box style={{ minHeight: "100vh", display: "flex" }}>
      <CssBaseline />
      {/* Left Side (Image if Right Form, Form if Left Form) */}
      {!isRightForm ? (
        <Box style={{ flex: "0 0 450px", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 40px", backgroundColor: "#fff", zIndex: 2, boxShadow: "4px 0 24px rgba(0,0,0,0.1)" }}>
          {renderLoginForm()}
        </Box>
      ) : (
        <Box style={{ flex: 1, position: "relative" }}>
          {settings.loginBackground && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundImage: `url(${settings.loginBackground})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          )}
        </Box>
      )}

      {/* Right Side */}
      {!isRightForm ? (
        <Box style={{ flex: 1, position: "relative" }}>
          {settings.loginBackground && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                backgroundImage: `url(${settings.loginBackground})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />
          )}
        </Box>
      ) : (
        <Box style={{ flex: "0 0 450px", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 40px", backgroundColor: "#fff", zIndex: 2, boxShadow: "-4px 0 24px rgba(0,0,0,0.1)" }}>
          {renderLoginForm()}
        </Box>
      )}
    </Box>
  );
};

export default Login;
