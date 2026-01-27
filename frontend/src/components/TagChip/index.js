import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import Chip from "@material-ui/core/Chip";
import CloseIcon from "@material-ui/icons/Close";
import { getTagColorStyles } from "../../helpers/tagColors";

const useStyles = makeStyles((theme) => ({
    chip: {
        fontWeight: 500,
        fontSize: "0.75rem",
        height: "auto",
        padding: "2px 0",
        borderRadius: 4,
        cursor: "pointer",
        transition: "all 0.2s ease",
        "&:hover": {
            filter: "brightness(0.95)",
        },
    },
    chipSmall: {
        fontSize: "0.65rem",
        padding: "1px 0",
    },
    chipMedium: {
        fontSize: "0.75rem",
        padding: "2px 0",
    },
    chipLarge: {
        fontSize: "0.85rem",
        padding: "4px 2px",
    },
    deleteIcon: {
        fontSize: "0.9rem",
        marginLeft: 2,
        marginRight: -4,
    },
}));

/**
 * TagChip - Componente visual para exibir uma tag
 * 
 * @param {Object} props
 * @param {Object} props.tag - Objeto da tag { id, name, color, icon }
 * @param {string} [props.size='medium'] - Tamanho: 'small', 'medium', 'large'
 * @param {Function} [props.onRemove] - Callback ao clicar no X
 * @param {Function} [props.onClick] - Callback ao clicar na tag
 * @param {boolean} [props.showIcon=false] - Exibir ícone (se disponível)
 */
const TagChip = ({
    tag,
    size = "medium",
    onRemove,
    onClick,
    showIcon = false,
    className,
    style,
    ...rest
}) => {
    const classes = useStyles();
    const colors = getTagColorStyles(tag.color || "gray");

    const sizeClass = {
        small: classes.chipSmall,
        medium: classes.chipMedium,
        large: classes.chipLarge,
    }[size] || classes.chipMedium;

    const chipStyle = {
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        ...style,
    };

    const label = (
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
            {showIcon && tag.icon && (
                <span role="img" aria-label={tag.icon}>
                    {/* Você pode usar uma biblioteca de ícones aqui */}
                </span>
            )}
            {tag.name}
        </span>
    );

    return (
        <Chip
            label={label}
            size={size === "small" ? "small" : "medium"}
            onClick={onClick}
            onDelete={onRemove}
            deleteIcon={onRemove ? <CloseIcon className={classes.deleteIcon} /> : undefined}
            className={`${classes.chip} ${sizeClass} ${className || ""}`}
            style={chipStyle}
            {...rest}
        />
    );
};

export default TagChip;
