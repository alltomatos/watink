import React, { useState, useContext, useEffect } from "react";
import { useHistory } from "react-router-dom";
import clsx from "clsx";
import {
    makeStyles,
    Drawer,
    AppBar,
    Toolbar,
    List,
    Typography,
    Divider,
    MenuItem,
    IconButton,
    Menu,
    Box,
    Avatar,
} from "@material-ui/core";
import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import AccountCircle from "@material-ui/icons/AccountCircle";

import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import VersionFooter from "../components/VersionFooter";
import api from "../services/api";
import { getBackendUrl } from "../helpers/urlUtils";

const drawerWidth = 240;

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        height: "100vh",
        [theme.breakpoints.down("sm")]: {
            height: "calc(100vh - 56px)",
        },
    },
    toolbar: {
        paddingRight: 24, // keep right padding when drawer closed
    },
    toolbarIcon: {
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "0 8px",
        minHeight: "48px",
    },
    appBar: {
        zIndex: theme.zIndex.drawer + 1,
        transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
    },
    appBarShift: {
        marginLeft: drawerWidth,
        width: `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
    },
    menuButton: {
        marginRight: 36,
    },
    menuButtonHidden: {
        display: "none",
    },
    title: {
        flexGrow: 1,
    },
    drawerPaper: {
        position: "relative",
        whiteSpace: "nowrap",
        width: drawerWidth,
        transition: theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
        display: "flex",
        flexDirection: "column",
    },
    drawerPaperClose: {
        overflowX: "hidden",
        transition: theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
        width: theme.spacing(7),
        [theme.breakpoints.up("sm")]: {
            width: theme.spacing(9),
        },
        display: "flex",
        flexDirection: "column",
    },
    appBarSpacer: {
        minHeight: "48px",
    },
    content: {
        flex: 1,
        overflow: "auto",
    },
    container: {
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(4),
    },
    paper: {
        padding: theme.spacing(2),
        display: "flex",
        overflow: "auto",
        flexDirection: "column",
    },
    iconButton: {
        color: "inherit",
    },
    logoContainer: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        minHeight: 80,
        width: "100%",
    },
    systemLogo: {
        maxWidth: "80%",
        maxHeight: 80,
        objectFit: "contain",
    },
    systemTitle: {
        fontWeight: 600,
        fontSize: "1.1rem",
        textAlign: "center",
        padding: "0 8px",
    },
}));

const MainLayoutDefault = ({ children }) => {
    const classes = useStyles();
    const history = useHistory();
    // const [userModalOpen, setUserModalOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const { handleLogout, loading } = useContext(AuthContext);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [drawerVariant, setDrawerVariant] = useState("permanent");
    const { user } = useContext(AuthContext);
    const [systemLogo, setSystemLogo] = useState("");
    const [systemTitle, setSystemTitle] = useState("Watink");
    const [logoEnabled, setLogoEnabled] = useState(true);

    useEffect(() => {
        if (document.body.offsetWidth > 600) {
            setDrawerOpen(true);
        }
    }, []);

    // Fetch system settings for logo and title
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await api.get("/public-settings");
                const settingsData = Array.isArray(data) ? data : [];

                const logoSetting = settingsData.find(s => s.key === "systemLogo");
                const titleSetting = settingsData.find(s => s.key === "systemTitle");
                const logoEnabledSetting = settingsData.find(s => s.key === "systemLogoEnabled");
                const faviconSetting = settingsData.find(s => s.key === "systemFavicon");

                if (logoSetting && logoSetting.value) {
                    setSystemLogo(logoSetting.value);
                }
                if (titleSetting && titleSetting.value) {
                    setSystemTitle(titleSetting.value);
                    document.title = titleSetting.value;
                }
                if (logoEnabledSetting) {
                    setLogoEnabled(logoEnabledSetting.value === "true");
                }
                // Update browser favicon dynamically
                if (faviconSetting && faviconSetting.value) {
                    link.href = getBackendUrl(faviconSetting.value);
                    document.head.appendChild(link);
                }
            } catch (err) {
                console.error("Error fetching settings:", err);
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        if (document.body.offsetWidth < 600) {
            setDrawerVariant("temporary");
        } else {
            setDrawerVariant("permanent");
        }
    }, [drawerOpen]);

    const handleMenu = (event) => {
        setAnchorEl(event.currentTarget);
        setMenuOpen(true);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
        setMenuOpen(false);
    };

    const handleOpenUserModal = () => {
        setUserModalOpen(true);
        handleCloseMenu();
    };

    const handleClickLogout = () => {
        handleCloseMenu();
        handleLogout();
    };

    const drawerClose = () => {
        if (document.body.offsetWidth < 600) {
            setDrawerOpen(false);
        }
    };

    if (loading) {
        return <BackdropLoading />;
    }

    return (
        <div className={classes.root}>
            <Drawer
                variant={drawerVariant}
                className={drawerOpen ? classes.drawerPaper : classes.drawerPaperClose}
                classes={{
                    paper: clsx(
                        classes.drawerPaper,
                        !drawerOpen && classes.drawerPaperClose
                    ),
                }}
                open={drawerOpen}
            >
                {/* Logo and Title Section */}
                <Box className={classes.logoContainer}>
                    {drawerOpen && systemLogo && logoEnabled ? (
                        <img
                            src={getBackendUrl(systemLogo)}
                            alt="Logo"
                            className={classes.systemLogo}
                        />
                    ) : drawerOpen && systemTitle ? (
                        <Typography className={classes.systemTitle} noWrap>
                            {systemTitle}
                        </Typography>
                    ) : null}
                </Box>
                <Divider />
                <List style={{ flexGrow: 1, overflowY: "auto", overflowX: "hidden" }}>
                    <MainListItems drawerClose={drawerClose} collapsed={!drawerOpen} />
                </List>
                <Divider />
                <VersionFooter collapsed={!drawerOpen} />
            </Drawer>
            {/* 
            <UserModal
                open={userModalOpen}
                onClose={() => setUserModalOpen(false)}
                userId={user?.id}
            /> 
            */}
            <AppBar
                position="absolute"
                className={clsx(classes.appBar, drawerOpen && classes.appBarShift)}
            >
                <Toolbar variant="dense" className={classes.toolbar}>
                    <IconButton
                        edge="start"
                        color="inherit"
                        aria-label="toggle drawer"
                        onClick={() => setDrawerOpen(!drawerOpen)}
                        className={classes.menuButton}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography
                        component="h1"
                        variant="h6"
                        color="inherit"
                        noWrap
                        className={classes.title}
                    >
                        {systemTitle}
                    </Typography>

                    {user?.id && <NotificationsPopOver />}

                    <div>
                        <IconButton
                            aria-label="account of current user"
                            aria-controls="menu-appbar"
                            aria-haspopup="true"
                            onClick={handleMenu}
                            color="inherit"
                        >
                            {user?.profileImage ? (
                                <Avatar
                                    alt={user?.name}
                                    src={getBackendUrl(user.profileImage)}
                                    className={classes.avatar}
                                    style={{ width: 32, height: 32 }}
                                />
                            ) : (
                                <AccountCircle />
                            )}
                        </IconButton>
                        <Menu
                            id="menu-appbar"
                            anchorEl={anchorEl}
                            getContentAnchorEl={null}
                            anchorOrigin={{
                                vertical: "bottom",
                                horizontal: "right",
                            }}
                            transformOrigin={{
                                vertical: "top",
                                horizontal: "right",
                            }}
                            open={menuOpen}
                            onClose={handleCloseMenu}
                        >
                            <MenuItem onClick={() => {
                                console.log("Profile menu clicked - Redirecting to /profile");
                                handleCloseMenu();
                                history.push("/profile");
                            }}>
                                {i18n.t("mainDrawer.appBar.user.profile")}
                            </MenuItem>
                            <MenuItem onClick={handleClickLogout}>
                                {i18n.t("mainDrawer.appBar.user.logout")}
                            </MenuItem>
                        </Menu>
                    </div>
                </Toolbar>
            </AppBar>
            <main className={classes.content}>
                <div className={classes.appBarSpacer} />
                {children ? children : null}
            </main>
        </div>
    );
};

export default MainLayoutDefault;
