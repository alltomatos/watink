import React, { useState, useEffect } from "react";
import { getBackendUrl } from "../../helpers/urlUtils";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";

const useStyles = makeStyles((theme) => ({
    root: {
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 100px)", // Adjust for header
        padding: theme.spacing(2),
    },
    paper: {
        padding: theme.spacing(2),
        display: "flex",
        alignItems: "center",
        marginBottom: 12,
    },
    iframe: {
        width: "100%",
        height: "100%",
        border: "none",
    },
}));

const Swagger = () => {
    const classes = useStyles();
    const [url, setUrl] = useState("");

    useEffect(() => {
        setUrl(getBackendUrl("docs"));
    }, []);

    return (
        <div className={classes.root}>
            <Paper className={classes.paper}>
                <h2>Documentação API</h2>
            </Paper>
            <iframe src={url} className={classes.iframe} title="Swagger UI" />
        </div>
    );
};

export default Swagger;
