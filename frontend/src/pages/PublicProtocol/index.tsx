/* @jsxImportSource react */
import React from "react";
import { useParams } from "react-router";
import { i18n } from "../../translate/i18n";

import { usePublicProtocol } from "./hooks/usePublicProtocol";
import ProtocolLoadingScreen from "./components/ProtocolLoadingScreen";
import ProtocolNotFound from "./components/ProtocolNotFound";
import ProtocolHeader from "./components/ProtocolHeader";
import ProtocolDetails from "./components/ProtocolDetails";
import ProtocolTimeline from "./components/ProtocolTimeline";

const PublicProtocol: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const { protocol, loading } = usePublicProtocol(token);

  if (loading) return <ProtocolLoadingScreen />;
  if (!protocol) return <ProtocolNotFound />;

  return (
    <div className="min-h-screen bg-muted/10 py-8">
      <div className="container mx-auto max-w-5xl px-4 space-y-6">

        <div className="text-center">
          <p className="text-2xl font-bold text-primary">
            {protocol.tenant?.name || i18n.t("publicProtocol.defaultTenant")}
          </p>
        </div>

        <ProtocolHeader protocol={protocol} />

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
          <ProtocolDetails protocol={protocol} />
          <ProtocolTimeline history={protocol.history} />
        </div>

      </div>
    </div>
  );
};

export default PublicProtocol;
