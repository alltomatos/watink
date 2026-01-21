import React, { useState, useEffect, useReducer, useContext } from "react";
import { toast } from "react-toastify";
import openSocket from "../../services/socket-io";
import { useHistory } from "react-router-dom";

import {
  makeStyles,
  Paper,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  InputAdornment,
  TextField,
  Avatar,
  Chip,
  Tooltip,
  Typography,
} from "@material-ui/core";

import {
  Search,
  DeleteOutline,
  Edit,
  PersonAdd,
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
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";

const reducer = (state, action) => {
  if (action.type === "LOAD_USERS") {
    const users = action.payload;
    const newUsers = [];

    users.forEach((user) => {
      const userIndex = state.findIndex((u) => u.id === user.id);
      if (userIndex !== -1) {
        state[userIndex] = user;
      } else {
        newUsers.push(user);
      }
    });

    return [...state, ...newUsers];
  }

  if (action.type === "UPDATE_USERS") {
    const user = action.payload;
    const userIndex = state.findIndex((u) => u.id === user.id);

    if (userIndex !== -1) {
      state[userIndex] = user;
      return [...state];
    } else {
      return [user, ...state];
    }
  }

  if (action.type === "DELETE_USER") {
    const userId = action.payload;

    const userIndex = state.findIndex((u) => u.id === userId);
    if (userIndex !== -1) {
      state.splice(userIndex, 1);
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
    padding: theme.spacing(2),
    margin: theme.spacing(1),
    overflowY: "auto",
    ...theme.scrollbarStyles,
    borderRadius: 16,
    boxShadow: "0 4px 20px rgba(0,0,0,0.05)",
    background: theme.palette.background.paper,
  },
  avatar: {
    width: 40,
    height: 40,
    background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.main} 100%)`,
    fontSize: "1rem",
    fontWeight: 600,
  },
  userName: {
    fontWeight: 500,
    color: theme.palette.text.primary,
  },
  userEmail: {
    fontSize: "0.85rem",
    color: theme.palette.text.secondary,
  },
  actionButton: {
    background: theme.palette.action.hover,
    marginLeft: theme.spacing(1),
    "&:hover": {
      background: theme.palette.action.selected,
    },
  },
  searchField: {
    "& .MuiOutlinedInput-root": {
      borderRadius: 12,
    },
  },
  addButton: {
    borderRadius: 12,
    textTransform: "none",
    fontWeight: 600,
  },
}));

const Users = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user: loggedInUser } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [deletingUser, setDeletingUser] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [users, dispatch] = useReducer(reducer, []);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchUsers = async () => {
        try {
          const { data } = await api.get("/users/", {
            params: { searchParam, pageNumber },
          });
          dispatch({ type: "LOAD_USERS", payload: data.users || [] });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchUsers();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber]);

  useEffect(() => {
    const socket = openSocket();

    if (!socket) return;

    socket.on("user", (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_USERS", payload: data.user });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_USER", payload: +data.userId });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleEditUser = (user) => {
    history.push(`/users/${user.id}`);
  };

  const handleDeleteUser = async (userId) => {
    try {
      await api.delete(`/users/${userId}`);
      toast.success(i18n.t("users.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingUser(null);
    setSearchParam("");
    setPageNumber(1);
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

  const getInitials = (name) => {
    if (!name) return "";
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getProfileStyle = (profile) => {
    switch (profile) {
      case "admin":
        return { color: "primary", label: "Admin" };
      case "supervisor":
        return { color: "secondary", label: "Supervisor" };
      default:
        return { color: "default", label: "Usuário" };
    }
  };

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingUser &&
          `${i18n.t("users.confirmationModal.deleteTitle")} ${deletingUser.name}?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteUser(deletingUser.id)}
      >
        {i18n.t("users.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <MainHeader>
        <Title>{i18n.t("users.title")}</Title>
        <MainHeaderButtonsWrapper>
          <TextField
            placeholder={i18n.t("contacts.searchPlaceholder")}
            type="search"
            value={searchParam}
            onChange={handleSearch}
            className={classes.searchField}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search color="action" />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            color="primary"
            className={classes.addButton}
            onClick={() => history.push("/users/new")}
            startIcon={<PersonAdd />}
          >
            {i18n.t("users.buttons.add")}
          </Button>
        </MainHeaderButtonsWrapper>
      </MainHeader>

      <Paper className={classes.mainPaper} onScroll={handleScroll}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell align="center" style={{ width: 60 }}>
                Avatar
              </TableCell>
              <TableCell>{i18n.t("users.table.name")}</TableCell>
              <TableCell align="center">{i18n.t("users.table.email")}</TableCell>
              <TableCell align="center">{i18n.t("users.table.profile")}</TableCell>
              <TableCell align="center">{i18n.t("users.table.actions")}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            <>
              {users.map((user) => {
                const profileInfo = getProfileStyle(user.profile);
                return (
                  <TableRow key={user.id}>
                    <TableCell align="center">
                      <Avatar className={classes.avatar}>
                        {getInitials(user.name)}
                      </Avatar>
                    </TableCell>
                    <TableCell>
                      <div>
                        <Typography className={classes.userName}>
                          {user.name}
                        </Typography>
                      </div>
                    </TableCell>
                    <TableCell align="center">
                      <Typography className={classes.userEmail}>
                        {user.email}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={profileInfo.label}
                        color={profileInfo.color}
                        size="small"
                        variant="outlined"
                        style={{ fontWeight: 500 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleEditUser(user)}
                        className={classes.actionButton}
                      >
                        <Edit color="secondary" fontSize="small" />
                      </IconButton>

                      <IconButton
                        size="small"
                        onClick={(e) => {
                          setConfirmModalOpen(true);
                          setDeletingUser(user);
                        }}
                        className={classes.actionButton}
                      >
                        <DeleteOutline color="secondary" fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
              {loading && <TableRowSkeleton columns={5} />}
            </>
          </TableBody>
        </Table>
      </Paper>
    </MainContainer>
  );
};

export default Users;
