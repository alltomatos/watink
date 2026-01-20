// MainListItems.js modifications
import React, { useContext, useEffect, useState } from "react";
import { Link as RouterLink } from "react-router-dom";

import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import ListSubheader from "@material-ui/core/ListSubheader";
import Divider from "@material-ui/core/Divider";
import { Badge, Tooltip, makeStyles } from "@material-ui/core";
import DashboardOutlinedIcon from "@material-ui/icons/DashboardOutlined";
import ListAltIcon from "@material-ui/icons/ListAlt";
import WhatsAppIcon from "@material-ui/icons/WhatsApp";
import SyncAltIcon from "@material-ui/icons/SyncAlt";
import GroupIcon from "@material-ui/icons/Group";
import HelpOutlineIcon from "@material-ui/icons/HelpOutline";
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

import { i18n } from "../translate/i18n";
import { WhatsAppsContext } from "../context/WhatsApp/WhatsAppsContext";
import { AuthContext } from "../context/Auth/AuthContext";
import { Can } from "../components/Can";
import { useThemeContext } from "../context/DarkMode";
import pluginApi from "../services/pluginApi"; // Import pluginApi with JWT interceptor

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
        perform="view_dashboard"
        yes={() => (
          <ListItemLink
            to="/"
            primary="Estatísticas"
            icon={<DashboardOutlinedIcon />}
            iconColor={googleColors.blue}
            collapsed={collapsed}
          />
        )}
      />
      <Can
        user={user}
        perform="view_pipelines"
        yes={() => (
          <ListItemLink
            to="/pipelines"
            primary="Pipelines"
            icon={<ListAltIcon />}
            iconColor={googleColors.purple}
            collapsed={collapsed}
          />
        )}
      />
      <ListItemLink
        to="/tickets"
        primary={i18n.t("mainDrawer.listItems.tickets")}
        icon={<WhatsAppIcon />}
        iconColor={googleColors.green}
        collapsed={collapsed}
      />

      <ListItemLink
        to="/contacts"
        primary={i18n.t("mainDrawer.listItems.contacts")}
        icon={<ContactPhoneOutlinedIcon />}
        iconColor={googleColors.orange}
        collapsed={collapsed}
      />
      <Can
        user={user}
        perform="view_quick_answers"
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
        perform="view_flows"
        yes={() => (
          <ListItemLink
            to="/flowbuilder"
            primary="Flow Builder"
            icon={<DeviceHubIcon />}
            iconColor={googleColors.blue}
            collapsed={collapsed}
          />
        )}
      />

      {/* Dynamic Plugins */}
      {activePlugins.includes("clientes") && (
        <ListItemLink
          to="/clients"
          primary="Clientes"
          icon={<PersonOutlineIcon />}
          iconColor={googleColors.blue}
          collapsed={collapsed}
        />
      )}

      {activePlugins.includes("helpdesk") && (
        <ListItemLink
          to="/helpdesk"
          primary="Helpdesk"
          icon={<HeadsetMicIcon />}
          iconColor={googleColors.red}
          collapsed={collapsed}
        />
      )}

      <Divider />
      {!collapsed && (
        <ListSubheader inset>
          {i18n.t("mainDrawer.listItems.administration")}
        </ListSubheader>
      )}

      <Can
        user={user}
        perform="view_groups"
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

      {/* ... keeping other items ... */}

      <Can
        user={user}
        perform="view_connections"
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
        perform="view_users"
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
        perform="view_admin_queues"
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
        perform="view_knowledge_bases"
        yes={() => (
          <ListItemLink
            to="/knowledge-bases"
            primary={i18n.t("knowledgeBase.menu")}
            icon={<LibraryBooksIcon />}
            iconColor={googleColors.orange}
            collapsed={collapsed}
          />
        )}
      />

      <Can
        user={user}
        perform="view_admin_settings"
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
        perform="view_swagger"
        yes={() => (
          <ListItemLink
            to="/swagger"
            primary="Swagger"
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


