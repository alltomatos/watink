import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Card, CardContent, Typography, Box } from "@material-ui/core";
import clsx from "clsx";

const useStyles = makeStyles((theme) => ({
    root: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16, // Premium rounded corners
        border: "none",
        // Premium diffuse shadow as requested
        boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)",
        transition: "all 0.3s cubic-bezier(.25,.8,.25,1)",
        overflow: "visible",
        position: "relative",
        "&:hover": {
            transform: (props) => (props.hoverEffect ? "translateY(-6px)" : "none"),
            boxShadow: (props) =>
                props.hoverEffect
                    ? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                    : "0px 4px 20px rgba(0, 0, 0, 0.08)",
        },
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: theme.spacing(2),
    },
    headerTitleGroup: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(2), // Increased gap
    },
    iconWrapper: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 48, // Larger icon area
        height: 48,
        borderRadius: 12, // Slightly larger and more rounded
        backgroundColor: (props) => props.iconColor || theme.palette.primary.light,
        color: (props) => props.iconColor ? "#fff" : theme.palette.primary.main,
    },
    content: {
        padding: theme.spacing(3), // Increased padding
        "&:last-child": {
            paddingBottom: theme.spacing(3),
        },
    },
    title: {
        fontWeight: 700, // Bolder
        fontSize: "1.25rem", // Larger
        color: "#1e293b",
        lineHeight: 1.2,
    },
    subtitle: {
        color: "#94a3b8", // Subtler gray
        fontSize: "0.875rem",
        marginTop: 4,
    },
}));

/**
 * BaseCard Component
 * 
 * @param {Object} props
 * @param {string} props.title - Title of the card
 * @param {string} props.subtitle - Subtitle text (can be a node)
 * @param {React.ReactNode} props.icon - Icon component (passed as node)
 * @param {string} props.iconColor - Background color for the icon wrapper
 * @param {React.ReactNode} props.actions - Action buttons (right side of header)
 * @param {boolean} props.hoverEffect - Enable hover animation (lift + shadow)
 * @param {Function} props.onClick - Click handler for the entire card
 * @param {string} props.className - Custom classes
 * @param {React.ReactNode} props.children - Card content
 */
const BaseCard = ({
    title,
    subtitle,
    icon,
    iconColor,
    actions,
    hoverEffect = false,
    onClick,
    className,
    children,
    ...rest
}) => {
    const classes = useStyles({ iconColor, hoverEffect });

    return (
        <Card
            className={clsx(classes.root, className)}
            onClick={onClick}
            {...rest}
        >
            <CardContent className={classes.content}>
                {(title || icon || actions) && (
                    <div className={classes.header}>
                        <div className={classes.headerTitleGroup}>
                            {icon && (
                                <div className={classes.iconWrapper}>
                                    {icon}
                                </div>
                            )}
                            <div>
                                {title && (
                                    <Typography variant="h6" className={classes.title}>
                                        {title}
                                    </Typography>
                                )}
                                {subtitle && (
                                    <div className={classes.subtitle}>
                                        {subtitle}
                                    </div>
                                )}
                            </div>
                        </div>
                        {actions && <Box>{actions}</Box>}
                    </div>
                )}
                {children}
            </CardContent>
        </Card>
    );
};

export default BaseCard;
