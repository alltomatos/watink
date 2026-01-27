import React from "react";
import { BrowserRouter, Switch } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import LoggedInLayout from "../layout";
import Dashboard from "../pages/Dashboard/";
import Pipelines from "../pages/Pipelines/";
import PipelineWizard from "../pages/Pipelines/PipelineWizard";
import PipelineCreator from "../pages/Pipelines/PipelineCreator";
import PipelineBoard from "../pages/Pipelines/PipelineBoard";
import Tickets from "../pages/Tickets/";
import FlowBuilder from "../pages/FlowBuilder/";
import FlowManager from "../pages/FlowManager/";
import Signup from "../pages/Signup/";
import Login from "../pages/Login/";
import Connections from "../pages/Connections/";
import ConnectionConfig from "../pages/Connections/ConnectionConfig";
import Settings from "../pages/Settings/";
import KanbanSettings from "../pages/Settings/KanbanSettings";
import WebchatConfig from "../pages/WebchatConfig/";
import Users from "../pages/Users";
import UserEdit from "../pages/UserEdit";
import UserProfile from "../pages/UserProfile";
import Contacts from "../pages/Contacts/";
import QuickAnswers from "../pages/QuickAnswers/";
import Groups from "../pages/Groups";
import GroupEdit from "../pages/GroupEdit";
import Queues from "../pages/Queues/";
import KnowledgeBase from "../pages/KnowledgeBase/";
import KnowledgeBaseConfig from "../pages/KnowledgeBase/KnowledgeBaseConfig";
import Marketplace from "../pages/Marketplace/";
import PluginDetail from "../pages/Marketplace/PluginDetail";
import Clients from "../pages/Clients/";
import Helpdesk from "../pages/Helpdesk/";
import ProtocolDetails from "../pages/Helpdesk/ProtocolDetails";
import HelpdeskKanban from "../pages/Helpdesk/HelpdeskKanban";
import HelpdeskTvMode from "../pages/Helpdesk/HelpdeskTvMode";
import Swagger from "../pages/Swagger/";
import VersionDashboard from "../pages/VersionDashboard/";
import TagManager from "../pages/TagManager/";
import { AuthProvider } from "../context/Auth/AuthContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import { ThemeProvider } from "../context/DarkMode";
import { TicketsProvider } from "../context/Tickets/TicketsContext";
import Route from "./Route";

const PrivateRoutes = () => {
  return (
    <WhatsAppsProvider>
      <TicketsProvider>
        <LoggedInLayout>
          <Switch>
            <Route exact path="/" component={Dashboard} isPrivate />
            <Route exact path="/pipelines" component={Pipelines} isPrivate />
            <Route exact path="/pipelines/new" component={PipelineCreator} isPrivate />
            <Route exact path="/pipelines/:pipelineId/edit" component={PipelineCreator} isPrivate />
            <Route exact path="/pipelines/:pipelineId" component={PipelineBoard} isPrivate />
            <Route exact path="/tickets/:ticketId?" component={Tickets} isPrivate />
            <Route exact path="/flowbuilder" component={FlowManager} isPrivate />
            <Route exact path="/flowbuilder/:flowId" component={FlowBuilder} isPrivate />
            <Route exact path="/connections/webchat/:webchatId" component={WebchatConfig} isPrivate />
            <Route exact path="/connections" component={Connections} isPrivate />
            <Route exact path="/connections/:whatsappId" component={ConnectionConfig} isPrivate />
            <Route exact path="/contacts" component={Contacts} isPrivate />
            <Route exact path="/users" component={Users} isPrivate />
            <Route exact path="/users/:userId" component={UserEdit} isPrivate />
            <Route exact path="/profile" component={UserProfile} isPrivate />
            <Route exact path="/quickAnswers" component={QuickAnswers} isPrivate />
            <Route exact path="/Settings" component={Settings} isPrivate />
            <Route exact path="/groups" component={Groups} isPrivate />
            <Route exact path="/groups/:groupId" component={GroupEdit} isPrivate />
            <Route exact path="/queues" component={Queues} isPrivate />
            <Route exact path="/settings/kanban" component={KanbanSettings} isPrivate />
            <Route exact path="/knowledge-bases" component={KnowledgeBase} isPrivate />
            <Route exact path="/knowledge-bases/:knowledgeBaseId" component={KnowledgeBaseConfig} isPrivate />
            <Route exact path="/swagger" component={Swagger} isPrivate />
            <Route exact path="/admin/settings/marketplace" component={Marketplace} isPrivate />
            <Route exact path="/admin/settings/marketplace/:slug" component={PluginDetail} isPrivate />
            <Route exact path="/clients" component={Clients} isPrivate />
            <Route exact path="/helpdesk" component={Helpdesk} isPrivate />
            <Route exact path="/helpdesk/kanban" component={HelpdeskKanban} isPrivate />
            <Route exact path="/helpdesk/tv" component={HelpdeskTvMode} isPrivate />
            <Route exact path="/helpdesk/:protocolId" component={ProtocolDetails} isPrivate />
            <Route exact path="/versions" component={VersionDashboard} isPrivate />
            <Route exact path="/tags" component={TagManager} isPrivate />
          </Switch>
        </LoggedInLayout>
      </TicketsProvider>
    </WhatsAppsProvider>
  );
};

import PublicProtocol from "../pages/PublicProtocol";
import ResetPassword from "../pages/ResetPassword/";

const Routes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeProvider>
          <Switch>
            <Route exact path="/login" component={Login} />
            <Route exact path="/signup" component={Signup} />
            <Route exact path="/public/protocols/:token" component={PublicProtocol} isPublic />
            <Route exact path="/reset-password/:token" component={ResetPassword} isPublic />
            <Route path="/" component={PrivateRoutes} isPrivate />
          </Switch>
          <ToastContainer autoClose={3000} />
        </ThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
