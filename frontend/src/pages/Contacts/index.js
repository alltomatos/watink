import React, { useState, useEffect, useReducer, useContext } from "react";
import openSocket from "../../services/socket-io";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import {
  Box,
  Button,
  TextField,
  InputAdornment,
  Grid,
  CircularProgress,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Paper,
  Avatar,
} from "@material-ui/core";
import SearchIcon from "@material-ui/icons/Search";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";
import ViewModuleIcon from "@material-ui/icons/ViewModule";
import ViewListIcon from "@material-ui/icons/ViewList";
import AddIcon from "@material-ui/icons/Add";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import Title from "../../components/Title";
import ListItemCard from "../../components/ListItemCard";
import TagChip from "../../components/TagChip";
import { getTagColorStyles } from "../../helpers/tagColors";
import { Chip } from "@material-ui/core";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import ContactModal from "../../components/ContactModal";
import ContactImportModal from "../../components/ContactImportModal";
import ConfirmationModal from "../../components/ConfirmationModal/";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import ClientModal from "../Clients/ClientModal"; // Import ClientModal
import { useLocalStorage } from "../../hooks/useLocalStorage";
import { getBackendUrl } from "../../helpers/urlUtils";

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTS") {
    const contacts = action.payload;
    const newContacts = [];

    contacts.forEach((contact) => {
      const contactIndex = state.findIndex((c) => c.id === contact.id);
      if (contactIndex !== -1) {
        state[contactIndex] = contact;
      } else {
        newContacts.push(contact);
      }
    });

    return [...state, ...newContacts];
  }

  if (action.type === "UPDATE_CONTACTS") {
    const contact = action.payload;
    const contactIndex = state.findIndex((c) => c.id === contact.id);

    if (contactIndex !== -1) {
      state[contactIndex] = contact;
      return [...state];
    } else {
      return [contact, ...state];
    }
  }

  if (action.type === "DELETE_CONTACT") {
    const contactId = action.payload;

    const contactIndex = state.findIndex((c) => c.id === contactId);
    if (contactIndex !== -1) {
      state.splice(contactIndex, 1);
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
    overflowY: "auto",
    ...theme.scrollbarStyles,
  },
}));

// Status baseado na presença de LID
const getContactStatus = (contact) => {
  if (contact.isGroup || contact.number?.includes("@g.us")) {
    return { label: "Grupo", color: "info" };
  }
  if (contact.lid) {
    return { label: "Verificado", color: "success" };
  }
  return { label: "Pendente", color: "default" };
};

const TagFilter = ({ selectedTags, onChange, tags }) => {
  return (
    <Box display="flex" gap={1} mb={2} style={{ overflowX: "auto", paddingBottom: 8 }}>
      <Chip
        label="Todas"
        color={selectedTags.length === 0 ? "primary" : "default"}
        onClick={() => onChange([])}
        size="small"
        clickable
      />
      {tags.map((tag) => {
        const colors = getTagColorStyles(tag.color);
        const isSelected = selectedTags.includes(tag.id);

        return (
          <Chip
            key={tag.id}
            label={tag.name}
            onClick={() => {
              const newTags = isSelected
                ? selectedTags.filter(t => t !== tag.id)
                : [...selectedTags, tag.id];
              onChange(newTags);
            }}
            size="small"
            clickable
            style={{
              backgroundColor: isSelected ? colors.bg : "#f0f0f0",
              color: isSelected ? colors.text : "#666",
              border: isSelected ? `1px solid ${colors.border}` : "none",
              fontWeight: isSelected ? 600 : 400
            }}
          />
        );
      })}
    </Box>
  );
};

const Contacts = () => {
  const classes = useStyles();
  const history = useHistory();

  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [contacts, dispatch] = useReducer(reducer, []);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [deletingContact, setDeletingContact] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  /* Removed duplicate hasMore declaration */
  const [view, setView] = useLocalStorage("contactsView", "card");

  // Client Modal State
  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [selectedInitialContact, setSelectedInitialContact] = useState(null);

  // Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam, selectedTagIds]);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        const { data } = await api.get("/tags");
        setAllTags(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTags();
  }, []);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("/contacts/", {
            params: { searchParam, pageNumber, tags: selectedTagIds },
          });
          dispatch({ type: "LOAD_CONTACTS", payload: data.contacts });
          setHasMore(data.hasMore);
          setLoading(false);
        } catch (err) {
          toastError(err);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber, selectedTagIds]);

  useEffect(() => {
    const socket = openSocket();

    if (!socket) return;

    socket.on("contact", (data) => {
      if (data.action === "update" || data.action === "create") {
        dispatch({ type: "UPDATE_CONTACTS", payload: data.contact });
      }

      if (data.action === "delete") {
        dispatch({ type: "DELETE_CONTACT", payload: +data.contactId });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(false);
  };

  const handleOpenClientModal = (contact) => {
    setSelectedInitialContact(contact);
    setClientModalOpen(true);
  };

  const handleCloseClientModal = () => {
    setSelectedInitialContact(null);
    setClientModalOpen(false);
  };

  const handleSaveTicket = async (contactId) => {
    if (!contactId) return;
    setLoading(true);
    try {
      const { data: ticket } = await api.post("/tickets", {
        contactId: contactId,
        userId: user?.id,
        status: "open",
      });
      history.push(`/tickets/${ticket.id}`);
    } catch (err) {
      toastError(err);
    }
    setLoading(false);
  };

  const hadleEditContact = (contactId) => {
    setSelectedContactId(contactId);
    setContactModalOpen(true);
  };

  const handleDeleteContact = async (contactId) => {
    try {
      await api.delete(`/contacts/${contactId}`);
      toast.success(i18n.t("contacts.toasts.deleted"));
    } catch (err) {
      toastError(err);
    }
    setDeletingContact(null);
    setSearchParam("");
    setPageNumber(1);
  };

  const handleImportSuccess = () => {
    // Reload contacts after successful import
    dispatch({ type: "RESET" });
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

  return (
    <MainContainer className={classes.mainContainer}>
      <ContactModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        contactId={selectedContactId}
      ></ContactModal>
      <ClientModal
        open={clientModalOpen}
        onClose={handleCloseClientModal}
        client={null}
        initialContact={selectedInitialContact}
      />
      <ContactImportModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onSuccess={handleImportSuccess}
      />
      <ConfirmationModal
        title={
          deletingContact
            ? `${i18n.t("contacts.confirmationModal.deleteTitle")} ${deletingContact.name
            }?`
            : `${i18n.t("contacts.confirmationModal.importTitlte")}`
        }
        open={confirmOpen}
        onClose={setConfirmOpen}
        onConfirm={(e) => handleDeleteContact(deletingContact.id)}
      >
        {`${i18n.t("contacts.confirmationModal.deleteMessage")}`}
      </ConfirmationModal>
      <MainHeader>
        <Title>{i18n.t("contacts.title")}</Title>
        <MainHeaderButtonsWrapper>
          <TextField
            placeholder={i18n.t("contacts.searchPlaceholder")}
            type="search"
            value={searchParam}
            onChange={handleSearch}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon style={{ color: "gray" }} />
                </InputAdornment>
              ),
            }}
          />
          <Button
            variant="contained"
            color="primary"
            onClick={() => setImportModalOpen(true)}
          >
            {i18n.t("contacts.buttons.import")}
          </Button>
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenContactModal}
          >
            {i18n.t("contacts.buttons.add")}
          </Button>
          <IconButton
            onClick={() => setView(view === "card" ? "table" : "card")}
          >
            {view === "card" ? <ViewListIcon /> : <ViewModuleIcon />}
          </IconButton>
        </MainHeaderButtonsWrapper>
      </MainHeader>



      <Box className={classes.mainPaper} onScroll={handleScroll}>
        <TagFilter
          tags={allTags}
          selectedTags={selectedTagIds}
          onChange={setSelectedTagIds}
        />

        {view === "card" ? (
          <Grid container spacing={2}>
            {contacts.map((contact) => (
              <Grid item xs={12} sm={6} md={4} lg={3} key={contact.id}>
                <ListItemCard
                  avatar={getBackendUrl(contact.profilePicUrl)}
                  title={contact.name}
                  subtitle={contact.number}
                  status={getContactStatus(contact)}
                  actions={
                    <>
                      <IconButton
                        size="small"
                        onClick={() => handleSaveTicket(contact.id)}
                        title="Iniciar conversa"
                      >
                        <WhatsAppIcon fontSize="small" style={{ color: "#25D366" }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => hadleEditContact(contact.id)}
                        title="Editar"
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenClientModal(contact)}
                        title="Criar Cliente"
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                      <Can
                        user={user}
                        perform="contacts-page:deleteContact"
                        yes={() => (
                          <IconButton
                            size="small"
                            onClick={() => {
                              setConfirmOpen(true);
                              setDeletingContact(contact);
                            }}
                            title="Excluir"
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        )}
                      />
                    </>
                  }
                  tags={
                    contact.tags?.map((tag) => (
                      <TagChip key={tag.id} tag={tag} size="small" />
                    ))
                  }
                />
              </Grid>
            ))}
          </Grid>
        ) : (
          <Paper elevation={0}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" />
                  <TableCell>{i18n.t("contacts.table.name")}</TableCell>
                  <TableCell align="center">
                    {i18n.t("contacts.table.whatsapp")}
                  </TableCell>
                  <TableCell align="center">
                    {i18n.t("contacts.table.email")}
                  </TableCell>
                  <TableCell align="center">
                    Tags
                  </TableCell>
                  <TableCell align="center">
                    {i18n.t("contacts.table.actions")}
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell style={{ paddingRight: 0 }}>
                      {<Avatar src={getBackendUrl(contact.profilePicUrl)} />}
                    </TableCell>
                    <TableCell>{contact.name}</TableCell>
                    <TableCell align="center">{contact.number}</TableCell>
                    <TableCell align="center">{contact.email}</TableCell>
                    <TableCell align="center">
                      <div style={{ display: "flex", gap: 4, justifyContent: "center", flexWrap: "wrap" }}>
                        {contact.tags?.map((tag) => (
                          <TagChip key={tag.id} tag={tag} size="small" />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell align="center">
                      <IconButton
                        size="small"
                        onClick={() => handleSaveTicket(contact.id)}
                      >
                        <WhatsAppIcon fontSize="small" style={{ color: "#25D366" }} />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => hadleEditContact(contact.id)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenClientModal(contact)}
                        title="Criar Cliente"
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                      <Can
                        user={user}
                        perform="contacts-page:deleteContact"
                        yes={() => (
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              setConfirmOpen(true);
                              setDeletingContact(contact);
                            }}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        )}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Paper>
        )}

        {loading && (
          <Box display="flex" justifyContent="center" mt={3}>
            <CircularProgress />
          </Box>
        )}
      </Box>
    </MainContainer >
  );
};

export default Contacts;
