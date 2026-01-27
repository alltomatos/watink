import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Card, CardContent, Typography, Avatar, Box, Chip } from "@material-ui/core";
import clsx from "clsx";

const useStyles = makeStyles((theme) => ({
    root: {
        backgroundColor: "#FFFFFF",
        borderRadius: 16,
        border: "none",
        boxShadow: "0px 4px 20px rgba(0, 0, 0, 0.08)",
        transition: "all 0.3s cubic-bezier(.25,.8,.25,1)",
        cursor: (props) => props.clickable ? "pointer" : "default",
        "&:hover": {
            transform: (props) => props.clickable ? "translateY(-4px)" : "none",
            boxShadow: (props) => props.clickable
                ? "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
                : "0px 4px 20px rgba(0, 0, 0, 0.08)",
        },
    },
    content: {
        padding: theme.spacing(2),
        "&:last-child": {
            paddingBottom: theme.spacing(2),
        },
    },
    row: {
        display: "flex",
        alignItems: "center",
        gap: theme.spacing(2),
    },
    avatar: {
        width: 56,
        height: 56,
        fontSize: "1.25rem",
        fontWeight: 600,
        backgroundColor: "#E3F2FD",
        color: "#1976d2",
    },
    textWrapper: {
        flex: 1,
        minWidth: 0, // Permite text-overflow funcionar
    },
    title: {
        fontWeight: 600,
        fontSize: "1rem",
        color: "#1e293b",
        lineHeight: 1.3,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    subtitle: {
        fontSize: "0.875rem",
        color: "#64748b",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
    },
    rightSection: {
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: theme.spacing(1),
    },
    statusChip: {
        fontWeight: 600,
        fontSize: "0.75rem",
        height: 24,
        borderRadius: 6,
    },
    actions: {
        display: "flex",
        gap: theme.spacing(0.5),
    },
}));

// Mapeia cores de status
const statusColorMap = {
    success: { bg: "#E8F5E9", text: "#2E7D32" },
    warning: { bg: "#FFF3E0", text: "#E65100" },
    error: { bg: "#FFEBEE", text: "#C62828" },
    info: { bg: "#E3F2FD", text: "#1565C0" },
    default: { bg: "#F3F4F6", text: "#6B7280" },
};

/**
 * ListItemCard Component
 * 
 * Card para exibir itens em formato de lista com visual premium.
 * Ideal para listas de contatos, usuários, tickets, etc.
 * 
 * @param {Object} props
 * @param {string} props.avatar - URL da imagem ou null para usar iniciais
 * @param {string} props.title - Nome/título principal
 * @param {string} props.subtitle - Descrição secundária (email, telefone, etc)
 * @param {Object} props.status - { label: "Ativo", color: "success" }
 * @param {React.ReactNode} props.actions - Botões de ação (IconButtons)
 * @param {Function} props.onClick - Handler de clique no card
 * @param {string} props.className - Classes CSS customizadas
 */
const ListItemCard = ({
    avatar,
    title,
    subtitle,
    status,
    actions,
    onClick,
    className,
    ...rest
}) => {
    const clickable = !!onClick;
    const classes = useStyles({ clickable });
    const statusColors = status?.color ? statusColorMap[status.color] : statusColorMap.default;

    // Gera iniciais do nome para avatar fallback
    const getInitials = (name) => {
        if (!name) return "?";
        const parts = name.split(" ");
        if (parts.length >= 2) {
            return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <Card className={clsx(classes.root, className)} onClick={onClick} {...rest}>
            <CardContent className={classes.content}>
                <div className={classes.row}>
                    <Avatar
                        src={avatar}
                        className={classes.avatar}
                    >
                        {!avatar && getInitials(title)}
                    </Avatar>

                    <div className={classes.textWrapper}>
                        <Typography className={classes.title}>
                            {title}
                        </Typography>
                        {subtitle && (
                            <Typography className={classes.subtitle}>
                                {subtitle}
                            </Typography>
                        )}
                        {rest.tags && (
                            <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap", maxHeight: 24, overflow: "hidden" }}>
                                {rest.tags}
                            </div>
                        )}
                    </div>

                    <div className={classes.rightSection}>
                        {status && (
                            <Chip
                                label={status.label}
                                className={classes.statusChip}
                                style={{
                                    backgroundColor: statusColors.bg,
                                    color: statusColors.text,
                                }}
                            />
                        )}
                        {actions && (
                            <div className={classes.actions}>
                                {actions}
                            </div>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ListItemCard;
