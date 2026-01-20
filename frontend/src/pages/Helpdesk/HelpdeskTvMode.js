import React, { useEffect } from "react";
import { makeStyles } from "@material-ui/core/styles";
import HelpdeskKanban from "./HelpdeskKanban";

const useStyles = makeStyles((theme) => ({
    root: {
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        backgroundColor: "#f5f6fa",
    },
}));

/**
 * TV Mode - Fullscreen Helpdesk Kanban
 * No sidebar, no header, just the Kanban board
 * Perfect for displaying on a TV or monitor for team visibility
 */
const HelpdeskTvMode = () => {
    const classes = useStyles();

    // Request fullscreen on mount
    useEffect(() => {
        const requestFullscreen = async () => {
            try {
                if (document.documentElement.requestFullscreen) {
                    await document.documentElement.requestFullscreen();
                }
            } catch (err) {
                console.log("Fullscreen request failed:", err);
            }
        };

        requestFullscreen();

        // Exit fullscreen when component unmounts
        return () => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            }
        };
    }, []);

    return (
        <div className={classes.root}>
            <HelpdeskKanban tvMode={true} />
        </div>
    );
};

export default HelpdeskTvMode;
