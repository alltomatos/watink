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
    Menu,
    IconButton,
    Box,
    Avatar,
} from "@material-ui/core";
import AccountCircle from "@material-ui/icons/AccountCircle";
import MenuIcon from "@material-ui/icons/Menu";

import MainListItems from "./MainListItems";
import NotificationsPopOver from "../components/NotificationsPopOver";
import UserModal from "../components/UserModal";
import { AuthContext } from "../context/Auth/AuthContext";
import BackdropLoading from "../components/BackdropLoading";
import { i18n } from "../translate/i18n";
import VersionFooter from "../components/VersionFooter";
import api from "../services/api";
import { getBackendUrl } from "../helpers/urlUtils";

const drawerWidth = 260;
const drawerWidthClosed = 72;

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        height: "100vh",
        // Fundo claro para área principal (Soft Cloud)
        backgroundColor: "#F1F5F9",
    },
    drawerPaper: {
        position: "relative",
        whiteSpace: "nowrap",
        width: drawerWidth,
        transition: theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
        borderRight: "1px solid #334155",
        // Sidebar com tom intermediário (não muito escuro, não muito claro)
        backgroundColor: "#1E293B",
        color: "#E2E8F0",
        boxShadow: "0 0 20px rgba(0,0,0,0.1)",
        display: "flex",
        flexDirection: "column",
    },
    drawerPaperClose: {
        overflowX: "hidden",
        transition: theme.transitions.create("width", {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
        width: drawerWidthClosed,
        display: "flex",
        flexDirection: "column",
    },
    appBar: {
        zIndex: theme.zIndex.drawer + 1,
        transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
        }),
        // AppBar branco para contrastar
        backgroundColor: "#FFFFFF",
        backdropFilter: "blur(12px)",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
        borderBottom: "1px solid #E2E8F0",
        color: "#1E293B",
    },
    appBarShift: {
        marginLeft: drawerWidth,
        width: `calc(100% - ${drawerWidth}px)`,
        transition: theme.transitions.create(["width", "margin"], {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.enteringScreen,
        }),
    },
    appBarCollapsed: {
        marginLeft: drawerWidthClosed,
        width: `calc(100% - ${drawerWidthClosed}px)`,
    },
    toolbar: {
        paddingRight: 24,
        display: "flex",
        justifyContent: "space-between",
    },
    menuButton: {
        marginRight: 20,
    },
    content: {
        flexGrow: 1,
        height: "100vh",
        overflow: "auto",
        // Fundo claro para área de conteúdo
        backgroundColor: "#F1F5F9",
    },
    appBarSpacer: {
        minHeight: 64,
    },
    logoContainer: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: 80,
        padding: "16px",
        borderBottom: "1px solid rgba(0,0,0,0.05)",
    },
    logoText: {
        fontWeight: 700,
        fontSize: "1.2rem",
        color: theme.palette.primary.main,
    },
    systemLogo: {
        maxWidth: "80%",
        maxHeight: 60,
        objectFit: "contain",
    },
    userActions: {
        display: "flex",
        alignItems: "center",
    }
}));

const MainLayoutSaaS = ({ children }) => {
    const classes = useStyles();
    const history = useHistory();
    // const [userModalOpen, setUserModalOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);
    const [menuOpen, setMenuOpen] = useState(false);
    const { handleLogout, loading, user } = useContext(AuthContext);
    const [drawerOpen, setDrawerOpen] = useState(true);
    const [drawerVariant, setDrawerVariant] = useState("permanent");
    const [systemLogo, setSystemLogo] = useState("");
    const [systemTitle, setSystemTitle] = useState("Watink");
    const [logoEnabled, setLogoEnabled] = useState(true);

    useEffect(() => {
        if (document.body.offsetWidth > 600) {
            setDrawerOpen(true);
        } else {
            setDrawerOpen(false);
        }
    }, []);

    useEffect(() => {
        if (document.body.offsetWidth < 600) {
            setDrawerVariant("temporary");
        } else {
            setDrawerVariant("permanent");
        }
    }, [drawerOpen]);

    // Fetch system settings
    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await api.get("/settings");
                const logoSetting = data.find(s => s.key === "systemLogo");
                const titleSetting = data.find(s => s.key === "systemTitle");
                const logoEnabledSetting = data.find(s => s.key === "systemLogoEnabled");
                const faviconSetting = data.find(s => s.key === "systemFavicon");

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
                        <Typography className={classes.logoText} noWrap>
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
                className={clsx(
                    classes.appBar,
                    drawerOpen ? classes.appBarShift : classes.appBarCollapsed
                )}
            >
                <Toolbar className={classes.toolbar}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                        <IconButton
                            edge="start"
                            color="inherit"
                            aria-label="toggle drawer"
                            onClick={() => setDrawerOpen(!drawerOpen)}
                            className={classes.menuButton}
                        >
                            <MenuIcon />
                        </IconButton>
                        <Typography variant="h6" noWrap>
                            {systemTitle}
                        </Typography>
                    </div>

                    <div className={classes.userActions}>
                        {user.id && <NotificationsPopOver />}

                        <IconButton
                            aria-label="account of current user"
                            aria-controls="menu-appbar"
                            aria-haspopup="true"
                            onClick={handleMenu}
                            color="inherit"
                        >
                            {user.profileImage ? (
                                <Avatar
                                    alt={user.name}
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
                                console.log("Profile menu clicked SaaS - Redirecting to /profile");
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
                {children}
            </main>
        </div>
    );
};

export default MainLayoutSaaS;

