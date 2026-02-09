import React, { useContext, useEffect, useRef, useState } from "react";
import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import SearchIcon from "@material-ui/icons/Search";
import InputBase from "@material-ui/core/InputBase";
import Tabs from "@material-ui/core/Tabs";
import Tab from "@material-ui/core/Tab";
import Badge from "@material-ui/core/Badge";
import MoveToInboxIcon from "@material-ui/icons/MoveToInbox";
import CheckBoxIcon from "@material-ui/icons/CheckBox";
import FormControlLabel from "@material-ui/core/FormControlLabel";
import Switch from "@material-ui/core/Switch";
import NewTicketModal from "../NewTicketModal";
import TicketsList from "../TicketsList";
import TabPanel from "../TabPanel";
import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import { useTicketsContext } from "../../context/Tickets/TicketsContext";
import { Can } from "../Can";
import TicketsQueueSelect from "../TicketsQueueSelect";
import TicketsTagFilter from "../TicketsTagFilter";
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Checkbox, Typography } from "@material-ui/core";
import { toast } from "react-toastify";
import api from "../../services/api";

const useStyles = makeStyles((theme) => ({
  ticketsWrapper: {
    position: "relative",
    display: "flex",
    height: "100%",
    flexDirection: "column",
    overflow: "hidden",
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: theme.palette.background.default,
    color: theme.palette.text.primary,
  },
  tabsHeader: {
    flex: "none",
    backgroundColor: theme.palette.background.paper,
  },
  settingsIcon: {
    alignSelf: "center",
    marginLeft: "auto",
    padding: 8,
  },
  tab: {
    minWidth: 120,
    width: 120,
  },
  ticketOptionsBox: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    background: theme.palette.background.paper,
    padding: theme.spacing(1),
  },
  serachInputWrapper: {
    flex: 1,
    background: theme.palette.background.default,
    display: "flex",
    borderRadius: 40,
    padding: 4,
    marginRight: theme.spacing(1),
  },
  searchIcon: {
    color: "grey",
    marginLeft: 6,
    marginRight: 6,
    alignSelf: "center",
  },
  searchInput: {
    flex: 1,
    border: "none",
    borderRadius: 30,
    color: theme.palette.text.primary,
    backgroundColor: theme.palette.background.default,
  },
  badge: {
    right: "-10px",
  },
  show: {
    display: "block",
  },
  hide: {
    display: "none !important",
  },
}));

const TicketsManager = () => {
  const classes = useStyles();
  const [searchParam, setSearchParam] = useState("");
  const [tab, setTab] = useState("open");
  const { tabOpen, setTabOpen } = useTicketsContext();
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [showAllTickets, setShowAllTickets] = useState(() => {
    const saved = localStorage.getItem("showAllTickets");
    return saved ? JSON.parse(saved) : false;
  });
  const searchInputRef = useRef();
  const { user } = useContext(AuthContext);
  const [openCount, setOpenCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [groupsCount, setGroupsCount] = useState(0);
  const userQueueIds = user.queues.map((q) => q.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState(userQueueIds || []);
  const [selectedTags, setSelectedTags] = useState([]);
  const [closeAllModalOpen, setCloseAllModalOpen] = useState(false);
  const [closeAllLoading, setCloseAllLoading] = useState(false);
  const [closeAllOptions, setCloseAllOptions] = useState({
    statusOpen: true,
    statusPending: true,
    includeGroups: false
  });

  useEffect(() => {
    if (user.profile && user.profile.toUpperCase() === "ADMIN") {
      const saved = localStorage.getItem("showAllTickets");
      if (saved === null) {
        setShowAllTickets(true);
        localStorage.setItem("showAllTickets", JSON.stringify(true));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    localStorage.setItem("showAllTickets", JSON.stringify(showAllTickets));
  }, [showAllTickets]);

  useEffect(() => {
    if (tab === "search") {
      searchInputRef.current.focus();
      setSearchParam("");
    }
  }, [tab]);

  let searchTimeout;

  const handleSearch = (e) => {
    const searchedTerm = e.target.value.toLowerCase();

    clearTimeout(searchTimeout);

    if (searchedTerm === "") {
      setSearchParam(searchedTerm);
      setTab("open");
      return;
    }

    searchTimeout = setTimeout(() => {
      setSearchParam(searchedTerm);
    }, 500);
  };

  const handleChangeTab = (e, newValue) => {
    setTab(newValue);
  };

  const handleChangeTabOpen = (e, newValue) => {
    setTabOpen(newValue);
  };

  const applyPanelStyle = (status) => {
    if (tabOpen !== status) {
      return { width: 0, height: 0 };
    }
  };

  const handleCloseAllTickets = async () => {
    setCloseAllLoading(true);
    try {
      const { data } = await api.put("/tickets/close-all", closeAllOptions);
      toast.success(`${data.closedCount || 0} tickets fechados com sucesso!`);
      setCloseAllModalOpen(false);
    } catch (err) {
      toast.error("Erro ao fechar tickets");
      console.error(err);
    }
    setCloseAllLoading(false);
  };

  return (
    <Paper elevation={0} variant="outlined" className={classes.ticketsWrapper}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        onClose={(e) => setNewTicketModalOpen(false)}
      />
      <Paper elevation={0} square className={classes.tabsHeader}>
        <Tabs
          value={tab}
          onChange={handleChangeTab}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
          aria-label="icon label tabs example"
        >
          <Tab
            value={"open"}
            icon={<MoveToInboxIcon />}
            label={i18n.t("tickets.tabs.open.title")}
            classes={{ root: classes.tab }}
          />
          <Tab
            value={"closed"}
            icon={<CheckBoxIcon />}
            label={i18n.t("tickets.tabs.closed.title")}
            classes={{ root: classes.tab }}
          />
          <Tab
            value={"search"}
            icon={<SearchIcon />}
            label={i18n.t("tickets.tabs.search.title")}
            classes={{ root: classes.tab }}
          />

        </Tabs>
      </Paper>
      <Paper square elevation={0} className={classes.ticketOptionsBox}>
        {tab === "search" ? (
          <div className={classes.serachInputWrapper}>
            <SearchIcon className={classes.searchIcon} />
            <InputBase
              className={classes.searchInput}
              inputRef={searchInputRef}
              placeholder={i18n.t("tickets.search.placeholder")}
              type="search"
              onChange={handleSearch}
            />
          </div>
        ) : (
          <>
            <Button
              variant="outlined"
              color="primary"
              onClick={() => setNewTicketModalOpen(true)}
            >
              {i18n.t("ticketsManager.buttons.newTicket")}
            </Button>
            <Can
              user={user}
              perform="tickets-manager:showall"
              yes={() => (
                <Button
                  variant="outlined"
                  color="secondary"
                  style={{ marginLeft: 6 }}
                  onClick={() => setCloseAllModalOpen(true)}
                >
                  Fechar Todos
                </Button>
              )}
            />
            <Can
              user={user}
              perform="tickets-manager:showall"
              yes={() => (
                <FormControlLabel
                  label={i18n.t("tickets.buttons.showAll")}
                  labelPlacement="start"
                  control={
                    <Switch
                      size="small"
                      checked={showAllTickets}
                      onChange={() =>
                        setShowAllTickets((prevState) => !prevState)
                      }
                      name="showAllTickets"
                      color="primary"
                    />
                  }
                />
              )}
            />
          </>
        )}
        <TicketsQueueSelect
          style={{ marginLeft: 6 }}
          selectedQueueIds={selectedQueueIds}
          userQueues={user?.queues}
          onChange={(values) => setSelectedQueueIds(values)}
        />
        <TicketsTagFilter
          selectedTags={selectedTags}
          onChange={(values) => setSelectedTags(values)}
        />
      </Paper>
      <TabPanel value={tab} name="open" className={classes.ticketsWrapper}>
        <Tabs
          value={tabOpen}
          onChange={handleChangeTabOpen}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={openCount}
                color="primary"
              >
                {i18n.t("ticketsList.assignedHeader")}
              </Badge>
            }
            value={"open"}
          />
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={pendingCount}
                color="secondary"
              >
                {i18n.t("ticketsList.pendingHeader")}
              </Badge>
            }
            value={"pending"}
          />
          <Tab
            label={
              <Badge
                className={classes.badge}
                badgeContent={groupsCount}
                color="secondary"
              >
                {i18n.t("tickets.tabs.group.title") || "Grupos"}
              </Badge>
            }
            value={"groups"}
          />
        </Tabs>
        <Paper className={classes.ticketsWrapper}>
          <TicketsList
            status="open"
            showAll={showAllTickets}
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setOpenCount(val)}
            style={applyPanelStyle("open")}
            isGroup="false"
            tags={selectedTags}
          />
          <TicketsList
            status="pending"
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setPendingCount(val)}
            style={applyPanelStyle("pending")}
            isGroup="false"
            tags={selectedTags}
          />
          <TicketsList
            showAll={showAllTickets}
            selectedQueueIds={selectedQueueIds}
            updateCount={(val) => setGroupsCount(val)}
            isGroup="true"
            style={applyPanelStyle("groups")}
            tags={selectedTags}
          />
        </Paper>
      </TabPanel>
      <TabPanel value={tab} name="closed" className={classes.ticketsWrapper}>
        <TicketsList
          status="closed"
          showAll={true}
          selectedQueueIds={selectedQueueIds}
          tags={selectedTags}
        />
      </TabPanel>
      <TabPanel value={tab} name="search" className={classes.ticketsWrapper}>
        <TicketsList
          searchParam={searchParam}
          showAll={true}
          selectedQueueIds={selectedQueueIds}
          tags={selectedTags}
        />
      </TabPanel>

      {/* Close All Tickets Confirmation Modal */}
      <Dialog open={closeAllModalOpen} onClose={() => setCloseAllModalOpen(false)}>
        <DialogTitle>Confirmar</DialogTitle>
        <DialogContent>
          <Typography variant="body1" gutterBottom>
            Selecione quais tickets deseja encerrar:
          </Typography>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={closeAllOptions.statusOpen}
                  onChange={(e) => setCloseAllOptions({ ...closeAllOptions, statusOpen: e.target.checked })}
                  color="primary"
                />
              }
              label={i18n.t("ticketsList.assignedHeader") + " (Abertos)"}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={closeAllOptions.statusPending}
                  onChange={(e) => setCloseAllOptions({ ...closeAllOptions, statusPending: e.target.checked })}
                  color="primary"
                />
              }
              label={i18n.t("ticketsList.pendingHeader") + " (Aguardando)"}
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={closeAllOptions.includeGroups}
                  onChange={(e) => setCloseAllOptions({ ...closeAllOptions, includeGroups: e.target.checked })}
                  color="secondary"
                />
              }
              label={i18n.t("tickets.tabs.group.title") || "Grupos"}
            />
          </div>
          <Typography variant="caption" color="error" style={{ marginTop: 10, display: 'block' }}>
            Isso não poderá ser desfeito.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setCloseAllModalOpen(false)}
            color="secondary"
            disabled={closeAllLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCloseAllTickets}
            color="primary"
            variant="contained"
            disabled={closeAllLoading}
            startIcon={closeAllLoading ? <CircularProgress size={20} /> : null}
          >
            Fechar Todos
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

export default TicketsManager;
