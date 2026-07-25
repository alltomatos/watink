/* @jsxImportSource react */
import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes as RouterRoutes } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import LoggedInLayout from "../layout";
import PageLoader from "../components/PageLoader";

const Dashboard = lazy(() => import("../pages/Dashboard"));
const Pipelines = lazy(() => import("../pages/Pipelines"));
const PipelineCreator = lazy(() => import("../pages/Pipelines/PipelineCreator"));
const PipelineBoard = lazy(() => import("../pages/Pipelines/PipelineBoard"));
const Tickets = lazy(() => import("../pages/Tickets"));
const FlowBuilder = lazy(() => import("../pages/FlowBuilder"));
const FlowManager = lazy(() => import("../pages/FlowManager"));
const Register = lazy(() => import("../pages/Register"));
const Plans = lazy(() => import("../pages/Plans"));
const Login = lazy(() => import("../pages/Login"));
const Connections = lazy(() => import("../pages/Connections"));
const ConnectionConfig = lazy(() => import("../pages/Connections/ConnectionConfig"));
const Settings = lazy(() => import("../pages/Settings"));
const Acessos = lazy(() => import("../pages/Acessos"));
const UserProfile = lazy(() => import("../pages/UserProfile"));
const ResetPassword = lazy(() => import("../pages/ResetPassword"));
const MyActivities = lazy(() => import("../pages/MyActivities"));
const Contacts = lazy(() => import("../pages/Contacts"));
const QuickAnswers = lazy(() => import("../pages/QuickAnswers"));
const QuickAnswerEditor = lazy(() => import("../pages/QuickAnswers/QuickAnswerEditor"));
const TagManager = lazy(() => import("../pages/TagManager"));
const Queues = lazy(() => import("../pages/Queues"));
const KnowledgeBase = lazy(() => import("../pages/KnowledgeBase"));
const KnowledgeBaseConfig = lazy(() => import("../pages/KnowledgeBase/KnowledgeBaseConfig"));
const Marketplace = lazy(() => import("../pages/Marketplace"));
const Billing = lazy(() => import("../pages/Billing"));
const PluginDetail = lazy(() => import("../pages/Marketplace/PluginDetail"));
const Clients = lazy(() => import("../pages/Clients"));
const Helpdesk = lazy(() => import("../pages/Helpdesk"));
const ProtocolDetails = lazy(() => import("../pages/Helpdesk/ProtocolDetails"));
const HelpdeskKanban = lazy(() => import("../pages/Helpdesk/HelpdeskKanban"));
const HelpdeskTvMode = lazy(() => import("../pages/Helpdesk/HelpdeskTvMode"));
const Swagger = lazy(() => import("../pages/Swagger"));
const VersionDashboard = lazy(() => import("../pages/VersionDashboard"));
const MonitorQueues = lazy(() => import("../pages/MonitorQueues"));
const SaaSAdmin = lazy(() => import("../pages/SaaS"));
const InitialSetup = lazy(() => import("../pages/InitialSetup"));
const PublicProtocol = lazy(() => import("../pages/PublicProtocol"));
import { AuthProvider } from "../context/Auth/AuthContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import { ThemeProvider } from "../context/DarkMode";
import { TicketsProvider } from "../context/Tickets/TicketsContext";
import PrivateRoute from "./Route";
import { Route, Navigate } from "react-router-dom";
import StatusCheck from "../components/StatusCheck";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { queryClient } from "../lib/queryClient";

const PrivateRoutes = () => {
 return (
 <WhatsAppsProvider>
 <TicketsProvider>
 <LoggedInLayout>
 <Suspense fallback={<PageLoader />}>
     <RouterRoutes>
     <Route path="/" element={<PrivateRoute isPrivate><Dashboard /></PrivateRoute>} />
     <Route path="/pipelines" element={<PrivateRoute isPrivate><Pipelines /></PrivateRoute>} />
     <Route path="/pipelines/new" element={<PrivateRoute isPrivate><PipelineCreator /></PrivateRoute>} />
     <Route path="/pipelines/:pipelineId/edit" element={<PrivateRoute isPrivate><PipelineCreator /></PrivateRoute>} />
     <Route path="/pipelines/:pipelineId" element={<PrivateRoute isPrivate><PipelineBoard /></PrivateRoute>} />
     <Route path="/tickets/:ticketId?" element={<PrivateRoute isPrivate><Tickets /></PrivateRoute>} />
     <Route path="/flowbuilder" element={<PrivateRoute isPrivate><FlowManager /></PrivateRoute>} />
     <Route path="/flowbuilder/:flowId" element={<PrivateRoute isPrivate><FlowBuilder /></PrivateRoute>} />
     <Route path="/connections" element={<PrivateRoute isPrivate><Connections /></PrivateRoute>} />
     <Route path="/connections/:whatsappId" element={<PrivateRoute isPrivate><ConnectionConfig /></PrivateRoute>} />
     <Route path="/contacts" element={<PrivateRoute isPrivate><Contacts /></PrivateRoute>} />
     <Route path="/acessos" element={<Navigate to="/acessos/usuarios" replace />} />
     <Route path="/acessos/:tab" element={<PrivateRoute isPrivate><Acessos /></PrivateRoute>} />
     <Route path="/profile" element={<PrivateRoute isPrivate><UserProfile /></PrivateRoute>} />
     <Route path="/reset-password" element={<PrivateRoute isPrivate><ResetPassword /></PrivateRoute>} />
     <Route path="/my-activities" element={<PrivateRoute isPrivate><MyActivities /></PrivateRoute>} />
     <Route path="/quickAnswers" element={<PrivateRoute isPrivate><QuickAnswers /></PrivateRoute>} />
     <Route path="/quick-answers" element={<PrivateRoute isPrivate><QuickAnswers /></PrivateRoute>} />
     <Route path="/quick-answers/new" element={<PrivateRoute isPrivate><QuickAnswerEditor /></PrivateRoute>} />
     <Route path="/quick-answers/:id/edit" element={<PrivateRoute isPrivate><QuickAnswerEditor /></PrivateRoute>} />
     <Route path="/Settings" element={<PrivateRoute isPrivate><Settings /></PrivateRoute>} />
     <Route path="/tags" element={<PrivateRoute isPrivate><TagManager /></PrivateRoute>} />
     <Route path="/queues" element={<PrivateRoute isPrivate><Queues /></PrivateRoute>} />
     <Route path="/knowledge-bases" element={<PrivateRoute isPrivate><KnowledgeBase /></PrivateRoute>} />
     <Route path="/knowledge-bases/:knowledgeBaseId" element={<PrivateRoute isPrivate><KnowledgeBaseConfig /></PrivateRoute>} />
     <Route path="/swagger" element={<PrivateRoute isPrivate><Swagger /></PrivateRoute>} />
     <Route path="/admin/settings/marketplace" element={<PrivateRoute isPrivate><Marketplace /></PrivateRoute>} />
     <Route path="/admin/settings/billing" element={<PrivateRoute isPrivate><Billing /></PrivateRoute>} />
     <Route path="/admin/settings/marketplace/:slug" element={<PrivateRoute isPrivate><PluginDetail /></PrivateRoute>} />
     <Route path="/clients" element={<PrivateRoute isPrivate><Clients /></PrivateRoute>} />
     <Route path="/helpdesk" element={<PrivateRoute isPrivate><Helpdesk /></PrivateRoute>} />
     <Route path="/helpdesk/kanban" element={<PrivateRoute isPrivate><HelpdeskKanban /></PrivateRoute>} />
     <Route path="/helpdesk/tv" element={<PrivateRoute isPrivate><HelpdeskTvMode /></PrivateRoute>} />
     <Route path="/helpdesk/:protocolId" element={<PrivateRoute isPrivate><ProtocolDetails /></PrivateRoute>} />
     <Route path="/saas-manager" element={<PrivateRoute isPrivate><SaaSAdmin /></PrivateRoute>} />
     <Route path="/monitor" element={<PrivateRoute isPrivate><VersionDashboard /></PrivateRoute>} />
     <Route path="/monitor/queues" element={<PrivateRoute isPrivate><MonitorQueues /></PrivateRoute>} />
     <Route path="/versions" element={<PrivateRoute isPrivate><VersionDashboard /></PrivateRoute>} />
     </RouterRoutes>
          </Suspense>
          </LoggedInLayout>
      </TicketsProvider>
    </WhatsAppsProvider>
  );
};

const Routes = () => {
 return (
 <QueryClientProvider client={queryClient}>
 <BrowserRouter>
 <StatusCheck>
 <AuthProvider>
 <ThemeProvider>
 <Suspense fallback={<PageLoader />}>
     <RouterRoutes>
     <Route path="/initial-setup" element={<PrivateRoute><InitialSetup /></PrivateRoute>} />
     <Route path="/login" element={<PrivateRoute><Login /></PrivateRoute>} />
     <Route path="/register" element={<PrivateRoute><Register /></PrivateRoute>} />
     <Route path="/planos" element={<PrivateRoute><Plans /></PrivateRoute>} />
     <Route path="/public/protocols/:token" element={<PrivateRoute isPublic><PublicProtocol /></PrivateRoute>} />
     <Route path="/*" element={<PrivateRoute isPrivate><PrivateRoutes /></PrivateRoute>} />
     </RouterRoutes>
 </Suspense>
 <ToastContainer autoClose={3000} />
 </ThemeProvider>
 </AuthProvider>
 </StatusCheck>
 </BrowserRouter>
 <ReactQueryDevtools initialIsOpen={false} />
 </QueryClientProvider>
 );
};

export default Routes;
