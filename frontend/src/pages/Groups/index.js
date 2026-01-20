import React, { useState, useEffect, useReducer } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import {
    makeStyles,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    IconButton,
    TableContainer,
    InputAdornment,
    TextField,
} from "@material-ui/core";

import {
    DeleteOutline,
    Edit,
    Search,
} from "@material-ui/icons";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import TableRowSkeleton from "../../components/TableRowSkeleton";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { Can } from "../../components/Can";
import useAuth from "../../hooks/useAuth";
import ButtonWithSpinner from "../../components/ButtonWithSpinner";

const reducer = (state, action) => {
    if (action.type === "LOAD_GROUPS") {
        const groups = action.payload;
        const newGroups = [];

        groups.forEach((group) => {
            const groupIndex = state.findIndex((g) => g.id === group.id);
            if (groupIndex !== -1) {
                state[groupIndex] = group;
            } else {
                newGroups.push(group);
            }
        });

        return [...state, ...newGroups];
    }

    if (action.type === "UPDATE_GROUPS") {
        const group = action.payload;
        const groupIndex = state.findIndex((g) => g.id === group.id);

        if (groupIndex !== -1) {
            state[groupIndex] = group;
            return [...state];
        } else {
            return [group, ...state];
        }
    }

    if (action.type === "DELETE_GROUP") {
        const groupId = action.payload;

        const groupIndex = state.findIndex((g) => g.id === groupId);
        if (groupIndex !== -1) {
            state.splice(groupIndex, 1);
        }
        return [...state];
    }

    if (action.type === "RESET") {
        return [];
    }
};

const useStyles = makeStyles((theme) => ({
    mainPaper: {
        flex: 1,
        padding: theme.spacing(1),
        overflowY: "scroll",
        ...theme.scrollbarStyles,
    },
}));

const Groups = () => {
    const classes = useStyles();
    const { user } = useAuth();
    const history = useHistory();

    const [loading, setLoading] = useState(false);
    const [pageNumber, setPageNumber] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [deletingGroup, setDeletingGroup] = useState(null);
    const [confirmModalOpen, setConfirmModalOpen] = useState(false);
    const [searchParam, setSearchParam] = useState("");
    const [groups, dispatch] = useReducer(reducer, []);

    useEffect(() => {
        dispatch({ type: "RESET" });
        setPageNumber(1);
    }, [searchParam]);

    useEffect(() => {
        setLoading(true);
        const delayDebounceFn = setTimeout(() => {
            const fetchGroups = async () => {
                try {
                    const { data } = await api.get("/groups", {
                        params: { searchParam, pageNumber },
                    });
                    // Assuming backend returns array directly as per GroupController, 
                    // or if paginated, data.groups. 
                    // Current Controller returns res.json(groups), which is an array.
                    // Adjust logic for array:
                    dispatch({ type: "LOAD_GROUPS", payload: Array.isArray(data) ? data : [] });
                    setHasMore(false); // Disable pagination for now as controller findAll is simple
                    setLoading(false);
                } catch (err) {
                    toastError(err);
                    setLoading(false);
                }
            };
            fetchGroups();
        }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchParam, pageNumber]);

    const handleAddGroup = () => {
        history.push("/groups/new");
    };

    const handleSearch = (event) => {
        setSearchParam(event.target.value.toLowerCase());
    };

    const handleEditGroup = (group) => {
        history.push(`/groups/${group.id}`);
    };

    const handleDeleteGroup = async (groupId) => {
        try {
            await api.delete(`/groups/${groupId}`);
            toast.success(i18n.t("groups.toasts.deleted"));
        } catch (err) {
            toastError(err);
        }
        setDeletingGroup(null);
        setSearchParam("");
        setPageNumber(1);
        dispatch({ type: "DELETE_GROUP", payload: groupId });
    };

    const loadMore = () => {
        setPageNumber((prevState) => prevState + 1);
    };

    const handleScroll = (e) => {
        if (!hasMore || loading) return;
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        if (scrollHeight - (scrollTop + 100) < clientHeight) {
            loadMore();
        }
    };

    return (
        <MainContainer>
            <ConfirmationModal
                title={deletingGroup && `${i18n.t("groups.confirmationModal.deleteTitle")} ${deletingGroup.name}?`}
                open={confirmModalOpen}
                onClose={setConfirmModalOpen}
                onConfirm={() => handleDeleteGroup(deletingGroup.id)}
            >
                {i18n.t("groups.confirmationModal.deleteMessage")}
            </ConfirmationModal>

            <MainHeader>
                <Title>{i18n.t("groups.title")}</Title>
                <MainHeaderButtonsWrapper>
                    <TextField
                        placeholder={i18n.t("contacts.searchPlaceholder")}
                        type="search"
                        value={searchParam}
                        onChange={handleSearch}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <Search color="secondary" />
                                </InputAdornment>
                            ),
                        }}
                    />
                    <ButtonWithSpinner
                        loading={loading}
                        onClick={handleAddGroup}
                        variant="contained"
                        color="primary"
                    >
                        {i18n.t("groups.buttons.add")}
                    </ButtonWithSpinner>
                </MainHeaderButtonsWrapper>
            </MainHeader>
            <Paper
                className={classes.mainPaper}
                variant="outlined"
                onScroll={handleScroll}
            >
                <TableContainer>
                    <Table size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell align="center">{i18n.t("groups.table.name")}</TableCell>
                                <TableCell align="center">{i18n.t("groups.table.actions")}</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            <>
                                {groups.map((group) => (
                                    <TableRow key={group.id}>
                                        <TableCell align="center">{group.name}</TableCell>
                                        <TableCell align="center">
                                            <IconButton
                                                size="small"
                                                onClick={() => handleEditGroup(group)}
                                            >
                                                <Edit color="secondary" />
                                            </IconButton>

                                            <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                    setConfirmModalOpen(true);
                                                    setDeletingGroup(group);
                                                }}
                                            >
                                                <DeleteOutline color="secondary" />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {loading && <TableRowSkeleton columns={3} />}
                            </>
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </MainContainer>
    );
};

export default Groups;
