import React from "react";
import { makeStyles, Typography } from "@material-ui/core";
import { Link as RouterLink } from "react-router-dom";

const useStyles = makeStyles((theme) => ({
    footer: {
        padding: theme.spacing(2),
        textAlign: "center",
        color: theme.palette.text.secondary,
        borderTop: "1px solid rgba(0, 0, 0, 0.12)",
        marginTop: "auto",
        fontSize: "0.75rem",
        overflow: "hidden",
        whiteSpace: "nowrap",
    },
    link: {
        textDecoration: "none",
        color: theme.palette.primary.main,
        fontWeight: 600,
    },
}));

const VersionFooter = ({ collapsed = false }) => {
    const classes = useStyles();

    // Esconder footer quando drawer está colapsado
    if (collapsed) {
        return null;
    }

    return (
        <div className={classes.footer}>
            <RouterLink to="/versions" className={classes.link}>
                <Typography variant="caption" display="block">
                    Versões
                </Typography>
            </RouterLink>
        </div>
    );
};

export default VersionFooter;

