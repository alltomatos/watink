import React, { useState, useEffect, useRef } from "react";
import { makeStyles } from "@material-ui/core/styles";
import TextField from "@material-ui/core/TextField";
import Popover from "@material-ui/core/Popover";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import ListItemText from "@material-ui/core/ListItemText";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import Checkbox from "@material-ui/core/Checkbox";
import InputAdornment from "@material-ui/core/InputAdornment";
import IconButton from "@material-ui/core/IconButton";
import Divider from "@material-ui/core/Divider";
import Typography from "@material-ui/core/Typography";
import CircularProgress from "@material-ui/core/CircularProgress";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import AddIcon from "@material-ui/icons/Add";
import SearchIcon from "@material-ui/icons/Search";

import api from "../../services/api";
import TagChip from "../TagChip";
import { getTagColorStyles, TAG_COLOR_OPTIONS } from "../../helpers/tagColors";
import { i18n } from "../../translate/i18n";

const useStyles = makeStyles((theme) => ({
    container: {
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        alignItems: "center",
    },
    addButton: {
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        borderRadius: 4,
        border: "1px dashed #ccc",
        color: "#666",
        fontSize: "0.75rem",
        transition: "all 0.2s",
        "&:hover": {
            borderColor: theme.palette.primary.main,
            color: theme.palette.primary.main,
        },
    },
    popover: {
        width: 280,
        maxHeight: 350,
    },
    searchField: {
        padding: theme.spacing(1),
    },
    list: {
        maxHeight: 250,
        overflow: "auto",
    },
    tagColor: {
        width: 12,
        height: 12,
        borderRadius: 2,
        marginRight: 8,
    },
    createOption: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: theme.spacing(1, 2),
        cursor: "pointer",
        color: theme.palette.primary.main,
        "&:hover": {
            backgroundColor: theme.palette.action.hover,
        },
    },
    noResults: {
        padding: theme.spacing(2),
        textAlign: "center",
        color: "#999",
    },
    loading: {
        display: "flex",
        justifyContent: "center",
        padding: theme.spacing(2),
    },
}));

/**
 * TagPicker - Componente para selecionar e gerenciar tags
 * 
 * @param {Object} props
 * @param {Array} props.selectedTags - IDs das tags selecionadas
 * @param {Function} props.onChange - Callback quando tags mudam
 * @param {string} props.entityType - Tipo da entidade (contact, ticket, deal)
 * @param {number} props.entityId - ID da entidade
 * @param {boolean} [props.readOnly=false] - Modo somente leitura
 * @param {string} [props.placeholder] - Placeholder do campo
 */
const TagPicker = ({
    selectedTags = [],
    onChange,
    entityType,
    entityId,
    readOnly = false,
    placeholder,
}) => {
    const classes = useStyles();
    const anchorRef = useRef(null);

    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [tags, setTags] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState(selectedTags);

    useEffect(() => {
        setSelectedIds(selectedTags);
    }, [selectedTags]);

    useEffect(() => {
        if (open) {
            fetchTags();
        }
    }, [open]);

    const fetchTags = async () => {
        setLoading(true);
        try {
            const { data } = await api.get("/tags");
            setTags(data);
        } catch (err) {
            console.error("Erro ao carregar tags:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (tagId) => {
        const newSelectedIds = selectedIds.includes(tagId)
            ? selectedIds.filter((id) => id !== tagId)
            : [...selectedIds, tagId];

        setSelectedIds(newSelectedIds);

        if (onChange) {
            onChange(newSelectedIds);
        }

        // Se tiver entity, sincroniza automaticamente
        if (entityType && entityId) {
            try {
                await api.put(`/entities/${entityType}/${entityId}/tags/sync`, {
                    tagIds: newSelectedIds,
                });
            } catch (err) {
                console.error("Erro ao sincronizar tags:", err);
            }
        }
    };

    const handleCreateTag = async () => {
        if (!search.trim()) return;

        try {
            const { data } = await api.post("/tags", {
                name: search.trim(),
                color: TAG_COLOR_OPTIONS[Math.floor(Math.random() * TAG_COLOR_OPTIONS.length)],
            });

            setTags([...tags, data]);
            setSelectedIds([...selectedIds, data.id]);
            setSearch("");

            if (onChange) {
                onChange([...selectedIds, data.id]);
            }
        } catch (err) {
            console.error("Erro ao criar tag:", err);
        }
    };

    const filteredTags = tags.filter((tag) =>
        tag.name.toLowerCase().includes(search.toLowerCase())
    );

    const tagExists = tags.some(
        (tag) => tag.name.toLowerCase() === search.toLowerCase()
    );

    const selectedTagObjects = tags.filter((tag) => selectedIds.includes(tag.id));

    const handleKeyDown = (e) => {
        if (e.key === "Enter" && search && !tagExists) {
            e.preventDefault();
            handleCreateTag();
        }
        if (e.key === "Escape") {
            setOpen(false);
        }
    };

    return (
        <div className={classes.container}>
            {selectedTagObjects.map((tag) => (
                <TagChip
                    key={tag.id}
                    tag={tag}
                    size="small"
                    onRemove={readOnly ? undefined : () => handleToggle(tag.id)}
                />
            ))}

            {!readOnly && (
                <>
                    <div
                        ref={anchorRef}
                        className={classes.addButton}
                        onClick={() => setOpen(true)}
                    >
                        <LocalOfferIcon style={{ fontSize: 14 }} />
                        <span>{placeholder || i18n.t("tags.addTag") || "Adicionar tag"}</span>
                    </div>

                    <Popover
                        open={open}
                        anchorEl={anchorRef.current}
                        onClose={() => setOpen(false)}
                        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                        transformOrigin={{ vertical: "top", horizontal: "left" }}
                        PaperProps={{ className: classes.popover }}
                    >
                        <div className={classes.searchField}>
                            <TextField
                                autoFocus
                                fullWidth
                                size="small"
                                variant="outlined"
                                placeholder={i18n.t("tags.searchOrCreate") || "Buscar ou criar..."}
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                onKeyDown={handleKeyDown}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon fontSize="small" />
                                        </InputAdornment>
                                    ),
                                }}
                            />
                        </div>

                        <Divider />

                        {loading ? (
                            <div className={classes.loading}>
                                <CircularProgress size={24} />
                            </div>
                        ) : (
                            <>
                                <List className={classes.list} dense>
                                    {filteredTags.map((tag) => {
                                        const colors = getTagColorStyles(tag.color);
                                        const isSelected = selectedIds.includes(tag.id);

                                        return (
                                            <ListItem
                                                key={tag.id}
                                                button
                                                onClick={() => handleToggle(tag.id)}
                                            >
                                                <ListItemIcon style={{ minWidth: 32 }}>
                                                    <Checkbox
                                                        edge="start"
                                                        checked={isSelected}
                                                        tabIndex={-1}
                                                        disableRipple
                                                        size="small"
                                                    />
                                                </ListItemIcon>
                                                <div
                                                    className={classes.tagColor}
                                                    style={{ backgroundColor: colors.text }}
                                                />
                                                <ListItemText primary={tag.name} />
                                            </ListItem>
                                        );
                                    })}

                                    {filteredTags.length === 0 && !search && (
                                        <div className={classes.noResults}>
                                            <Typography variant="body2" color="textSecondary">
                                                {i18n.t("tags.noTags") || "Nenhuma tag encontrada"}
                                            </Typography>
                                        </div>
                                    )}
                                </List>

                                {search && !tagExists && (
                                    <>
                                        <Divider />
                                        <div className={classes.createOption} onClick={handleCreateTag}>
                                            <AddIcon fontSize="small" />
                                            <Typography variant="body2">
                                                Criar "{search}"
                                            </Typography>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </Popover>
                </>
            )}
        </div>
    );
};

export default TagPicker;
