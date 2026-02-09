import React, { useContext, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import Divider from "@material-ui/core/Divider";
import { Badge, Tooltip } from "@material-ui/core";
import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import ListAltIcon from "@material-ui/icons/ListAlt";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import GroupIcon from "@material-ui/icons/Group";
import SettingsOutlinedIcon from "@material-ui/icons/SettingsOutlined";
import PeopleAltOutlinedIcon from "@material-ui/icons/PeopleAltOutlined";
import ContactPhoneOutlinedIcon from "@material-ui/icons/ContactPhoneOutlined";
import AccountTreeOutlinedIcon from "@material-ui/icons/AccountTreeOutlined";
import QuestionAnswerOutlinedIcon from "@material-ui/icons/QuestionAnswerOutlined";
import MenuBookIcon from "@material-ui/icons/MenuBook";
import DeviceHubIcon from "@material-ui/icons/DeviceHub";
import LibraryBooksIcon from "@material-ui/icons/LibraryBooks";
import PersonOutlineIcon from "@material-ui/icons/PersonOutline";
import HeadsetMicIcon from "@material-ui/icons/HeadsetMic";
import LocalOfferIcon from "@material-ui/icons/LocalOffer";
import AssignmentIcon from "@material-ui/icons/Assignment";

import { i18n } from "../translate/i18n";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { Can } from "../components/Can";
import { useThemeContext } from "../context/DarkMode";
import pluginApi from "../services/pluginApi"; 

// Cores do Google para ícones (MD3)
const googleColors = {
  blue: "#1A73E8",
  green: "#1E8E3E",
  yellow: "#F9AB00",
  red: "#D93025",
  purple: "#7C4DFF",
  teal: "#00897B",
  orange: "#E8710A",
  pink: "#D01884",
};

function ListItemLink(props) {
  const { icon, primary, to, className, collapsed, iconColor } = props;
  const { appTheme } = useThemeContext();
  const isGoogleTheme = appTheme === "google";

  const renderLink = React.useMemo(
    () =>
      React.forwardRef((itemProps, ref) => (
        <RouterLink to={to} ref={ref} {...itemProps} />
      )),
    [to]
  );

  // Clonar ícone com cor se for tema Google
  const coloredIcon = isGoogleTheme && iconColor && icon
    ? React.cloneElement(icon, { style: { color: iconColor } })
    : icon;

  const listItem = (
    <ListItem button component={renderLink} className={className}>
      {coloredIcon ? <ListItemIcon>{coloredIcon}</ListItemIcon> : null}
      {!collapsed && <ListItemText primary={primary} />}
    </ListItem>
  );

  // Mostrar tooltip quando colapsado
  if (collapsed) {
    return (
      <li>
        <Tooltip title={primary} placement="right" arrow>
          {listItem}
        </Tooltip>
      </li>
    );
  }

  return <li>{listItem}</li>;
}

const MainListItems = (props) => {
  const { drawerClose, collapsed = false } = props;
  const { whatsApps } = useContext(WhatsAppsContext);
  const { user } = useContext(AuthContext);
  const [connectionWarning, setConnectionWarning] = useState(false);
  const [activePlugins, setActivePlugins] = useState([]);

  useEffect(() => {
    // Fetch active plugins using pluginApi (has JWT interceptor)
    const fetchPlugins = async () => {
      try {
        const { data } = await pluginApi.get("/api/v1/plugins/installed");
        setActivePlugins(data.active || []);
      } catch (err) {
        // Silent error for offline/502/CORS to avoid user disruption
      }
    };
    fetchPlugins();
  }, []);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (whatsApps.length > 0) {
        const offlineWhats = whatsApps.filter((whats) => {
          return (
            whats.status === "qrcode" ||
            whats.status === "PAIRING" ||
            whats.status === "DISCONNECTED" ||
            whats.status === "TIMEOUT" ||
            whats.status === "OPENING"
          );
        });
        if (offlineWhats.length > 0) {
          setConnectionWarning(true);
        } else {
          setConnectionWarning(false);
        }
      }
    }, 2000);
    return () => clearTimeout(delayDebounceFn);
  }, [whatsApps]);

  return (
    <div onClick={drawerClose}>
      <Can
        user={user}
        perform="dashboard:read"
        yes={() => (
          <ListItemLink
            to="/"
            primary={i18n.t("mainDrawer.listItems.dashboard")}
            icon={<DashboardOutlinedIcon />}
            iconColor={googleColors.blue}
            collapsed={collapsed}
          />
        )}
      />
      <Can
        user={user}
        perform="pipelines:read"
        yes={() => (
          <ListItemLink
            to="/pipelines"
            primary={i18n.t("mainDrawer.listItems.pipelines")}
            icon={<ListAltIcon />}
            iconColor={googleColors.purple}
            collapsed={collapsed}
          />
        )}
      />
      <Can
        user={user}
        perform="tickets:read"
        yes={() => (
          <ListItemLink
            to="/tickets"
            primary={i18n.t("mainDrawer.listItems.tickets")}
            icon={<WhatsAppIcon />}
            iconColor={googleColors.green}
            collapsed={collapsed}
          />
        )}
      />

      {activePlugins.includes("helpdesk") && (
        <ListItemLink
          to="/my-activities"
          primary={i18n.t("mainDrawer.listItems.myActivities")}
          icon={<AssignmentIcon />}
          iconColor={googleColors.blue}
          collapsed={collapsed}
        />
      )}

      <Can
        user={user}
        perform="contacts:read"
        yes={() => (
          <ListItemLink
            to="/contacts"
            primary={i18n.t("mainDrawer.listItems.contacts")}
            icon={<ContactPhoneOutlinedIcon />}
            iconColor={googleColors.orange}
            collapsed={collapsed}
          />
        )}
      />
      <Can
        user={user}
        perform="quick_answers:read"
        yes={() => (
          <ListItemLink
            to="/quickAnswers"
            primary={i18n.t("mainDrawer.listItems.quickAnswers")}
            icon={<QuestionAnswerOutlinedIcon />}
            iconColor={googleColors.purple}
            collapsed={collapsed}
          />
        )}
      />

      <Can
        user={user}
        perform="flows:read"
        yes={() => (
          <ListItemLink
            to="/flowbuilder"
            primary={i18n.t("mainDrawer.listItems.flowBuilder")}
            icon={<DeviceHubIcon />}
            iconColor={googleColors.blue}
            collapsed={collapsed}
          />
        )}
      />

      {/* Dynamic Plugins */}
      {activePlugins.includes("clientes") && (
        <Can
          user={user}
          perform="clients:read"
          yes={() => (
            <ListItemLink
              to="/clients"
              primary={i18n.t("mainDrawer.listItems.clients")}
              icon={<PersonOutlineIcon />}
              iconColor={googleColors.blue}
              collapsed={collapsed}
            />
          )}
        />
      )}

      {activePlugins.includes("helpdesk") && (
        <Can
          user={user}
          perform="helpdesk:read"
          yes={() => (
            <ListItemLink
              to="/helpdesk"
              primary={i18n.t("mainDrawer.listItems.helpdesk")}
              icon={<HeadsetMicIcon />}
              iconColor={googleColors.red}
              collapsed={collapsed}
            />
          )}
        />
      )}

      <Divider />


      <Can
        user={user}
        perform="tags:read"
        yes={() => (
          <ListItemLink
            to="/tags"
            primary={i18n.t("mainDrawer.listItems.tags")}
            icon={<LocalOfferIcon />}
            iconColor={googleColors.purple}
            collapsed={collapsed}
          />
        )}
      />

      <Can
        user={user}
        perform="groups:read"
        yes={() => (
          <ListItemLink
            to="/groups"
            primary={i18n.t("mainDrawer.listItems.groups")}
            icon={<GroupIcon />}
            iconColor={googleColors.teal}
            collapsed={collapsed}
          />
        )}
      />

      <Can
        user={user}
        perform="connections:read"
        yes={() => (
          <ListItemLink
            to="/connections"
            primary={i18n.t("mainDrawer.listItems.connections")}
            icon={
              <Badge badgeContent={connectionWarning ? "!" : 0} color="error">
                <SyncAltIcon />
              </Badge>
            }
            iconColor={googleColors.teal}
            collapsed={collapsed}
          />
        )}
      />

      <Can
        user={user}
        perform="users:read"
        yes={() => (
          <ListItemLink
            to="/users"
            primary={i18n.t("mainDrawer.listItems.users")}
            icon={<PeopleAltOutlinedIcon />}
            iconColor={googleColors.blue}
            collapsed={collapsed}
          />
        )}
      />

      <Can
        user={user}
        perform="queues:read"
        yes={() => (
          <ListItemLink
            to="/queues"
            primary={i18n.t("mainDrawer.listItems.queues")}
            icon={<AccountTreeOutlinedIcon />}
            iconColor={googleColors.yellow}
            collapsed={collapsed}
          />
        )}
      />

      <Can
        user={user}
        perform="knowledge_bases:read"
        yes={() => (
          <ListItemLink
            to="/knowledge-bases"
            primary={i18n.t("mainDrawer.listItems.knowledgeBase")}
            icon={<LibraryBooksIcon />}
            iconColor={googleColors.orange}
            collapsed={collapsed}
          />
        )}
      />

      <Can
        user={user}
        perform="settings:read"
        yes={() => (
          <ListItemLink
            to="/settings"
            primary={i18n.t("mainDrawer.listItems.settings")}
            icon={<SettingsOutlinedIcon />}
            iconColor={googleColors.red}
            collapsed={collapsed}
          />
        )}
      />

      <Can
        user={user}
        perform="swagger:read"
        yes={() => (
          <ListItemLink
            to="/swagger"
            primary={i18n.t("mainDrawer.listItems.swagger")}
            icon={<MenuBookIcon />}
            iconColor={googleColors.pink}
            collapsed={collapsed}
          />
        )}
      />
    </div>
  );
};

export default MainListItems;
