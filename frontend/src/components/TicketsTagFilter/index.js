import React, { useState, useEffect } from "react";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import { Checkbox, ListItemText } from "@material-ui/core";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";

const TicketsTagFilter = ({ selectedTags = [], onChange }) => {
    const [tags, setTags] = useState([]);

    useEffect(() => {
        const fetchTags = async () => {
            try {
                const { data } = await api.get("/tags");
                setTags(data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchTags();
    }, []);

    const handleChange = e => {
        onChange(e.target.value);
    };

    return (
        <div style={{ width: 120, marginTop: -4, marginLeft: 6 }}>
            <FormControl fullWidth margin="dense">
                <Select
                    multiple
                    displayEmpty
                    variant="outlined"
                    value={selectedTags}
                    onChange={handleChange}
                    MenuProps={{
                        anchorOrigin: {
                            vertical: "bottom",
                            horizontal: "left",
                        },
                        transformOrigin: {
                            vertical: "top",
                            horizontal: "left",
                        },
                        getContentAnchorEl: null,
                    }}
                    renderValue={() => i18n.t("ticketsTagFilter.placeholder") || "Tags"}
                >
                    {tags?.length > 0 &&
                        tags.map(tag => (
                            <MenuItem dense key={tag.id} value={tag.id}>
                                <Checkbox
                                    style={{
                                        color: tag.color,
                                    }}
                                    size="small"
                                    color="primary"
                                    checked={selectedTags.indexOf(tag.id) > -1}
                                />
                                <ListItemText primary={tag.name} />
                            </MenuItem>
                        ))}
                </Select>
            </FormControl>
        </div>
    );
};

export default TicketsTagFilter;
