import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Card, CardContent, Typography, Box } from "@material-ui/core";
import { TrendingUp, TrendingDown } from "@material-ui/icons";
import clsx from "clsx";

const useStyles = makeStyles((theme) => ({
    root: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        border: "none",
        boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)",
        transition: "all 0.3s cubic-bezier(.25,.8,.25,1)",
        overflow: "visible",
        height: "100%",
        "&:hover": {
            transform: "translateY(-6px)",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        },
    },
    content: {
        padding: theme.spacing(3),
        "&:last-child": {
            paddingBottom: theme.spacing(3),
        },
    },
    header: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: theme.spacing(2),
    },
    iconWrapper: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 56,
        height: 56,
        borderRadius: 16,
        background: (props) => props.bgColor,
        boxShadow: "0 4px 6px rgba(0,0,0,0.05)",
    },
    label: {
        fontSize: "0.875rem",
        fontWeight: 600,
        color: "#64748b",
        marginBottom: theme.spacing(0.5),
        textTransform: "uppercase",
        letterSpacing: "0.5px",
    },
    value: {
        fontSize: "2.5rem",
        fontWeight: 800,
        color: (props) => props.textColor || "#1e293b",
        lineHeight: 1.2,
    },
    footer: {
        display: "flex",
        alignItems: "center",
        marginTop: theme.spacing(2),
    },
    trendPositive: {
        display: "flex",
        alignItems: "center",
        fontSize: "0.75rem",
        fontWeight: 700,
        color: "#10b981",
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        padding: "4px 10px",
        borderRadius: 20,
    },
    trendNegative: {
        display: "flex",
        alignItems: "center",
        fontSize: "0.75rem",
        fontWeight: 700,
        color: "#ef4444",
        backgroundColor: "rgba(239, 68, 68, 0.1)",
        padding: "4px 10px",
        borderRadius: 20,
    },
    trendIcon: {
        fontSize: 16,
        marginRight: 4,
    },
}));

// Mapeia cores do tema para valores RGB e Gradients
const colorMap = {
    primary: {
        bg: "linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)",
        icon: "#1565C0",
        text: "#0D47A1"
    },
    success: {
        bg: "linear-gradient(135deg, #E8F5E9 0%, #C8E6C9 100%)",
        icon: "#2E7D32",
        text: "#1B5E20"
    },
    warning: {
        bg: "linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)",
        icon: "#EF6C00",
        text: "#E65100"
    },
    error: {
        bg: "linear-gradient(135deg, #FFEBEE 0%, #FFCDD2 100%)",
        icon: "#C62828",
        text: "#B71C1C"
    },
    info: {
        bg: "linear-gradient(135deg, #E1F5FE 0%, #B3E5FC 100%)",
        icon: "#0277BD",
        text: "#01579B"
    },
};

/**
 * MetricCard Component
 * 
 * Card de métricas para dashboards com visual premium.
 * 
 * @param {Object} props
 * @param {string} props.label - Título/descrição da métrica
 * @param {string|number} props.value - Valor numérico grande
 * @param {React.ReactNode} props.icon - Ícone representativo
 * @param {string} props.color - Cor do tema (primary, success, warning, error, info)
 * @param {Object} props.trend - Opcional: { value: "+5%", positive: true }
 * @param {string} props.className - Classes CSS customizadas
 */
const MetricCard = ({
    label,
    value,
    icon,
    color = "primary",
    trend,
    className,
    ...rest
}) => {
    const colors = colorMap[color] || colorMap.primary;
    const classes = useStyles({ bgColor: colors.bg, textColor: colors.text });

    return (
        <Card className={clsx(classes.root, className)} {...rest}>
            <CardContent className={classes.content}>
                <div className={classes.header}>
                    <div className={classes.iconWrapper}>
                        {icon && React.cloneElement(icon, {
                            style: { color: colors.icon, fontSize: 30 }
                        })}
                    </div>
                </div>

                <Typography className={classes.label}>
                    {label}
                </Typography>

                <Typography className={classes.value}>
                    {value}
                </Typography>

                {trend && (
                    <div className={classes.footer}>
                        <span className={trend.positive ? classes.trendPositive : classes.trendNegative}>
                            {trend.positive
                                ? <TrendingUp className={classes.trendIcon} />
                                : <TrendingDown className={classes.trendIcon} />
                            }
                            {trend.value}
                        </span>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default MetricCard;
