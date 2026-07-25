/* @jsxImportSource react */
import React from "react";
import { Plus, MessageSquare } from "lucide-react";

import { i18n } from "../../translate/i18n";
import {
  PageContainer,
  PageHeader,
  PageContent,
} from "../../components/ui/page-layout";
import { Button } from "../../components/ui/button";
import WhatsAppModal from "../../components/WhatsAppModal";
import WebchatModal from "../../components/WebchatModal";
import ConfirmationModal from "../../components/ConfirmationModal";

import { useConnections } from "./hooks/useConnections";
import { ConnectionCard } from "./components/ConnectionCard";

const Connections = () => {
  const {
    whatsApps,
    reloadWhatsApps,
    whatsAppModalOpen,
    webchatModalOpen,
    confirmModalOpen,
    selectedWhatsApp,
    handleStartSession,
    handleRequestNewQrCode,
    handleDisconnectSession,
    handleDeleteWhatsApp,
    handleEditWhatsApp,
    handleOpenNewWhatsApp,
    handleOpenNewWebchat,
    handleCloseWhatsAppModal,
    handleCloseWebchatModal,
    handleOpenConfirm,
    handleCloseConfirm,
    navigate,
  } = useConnections();

  return (
    <PageContainer>
      <WhatsAppModal
        open={whatsAppModalOpen}
        onClose={handleCloseWhatsAppModal}
        whatsAppId={selectedWhatsApp?.id}
        onSaved={async () => { await reloadWhatsApps(); }}
      />
      <WebchatModal
        open={webchatModalOpen}
        onClose={handleCloseWebchatModal}
        whatsAppId={selectedWhatsApp?.id}
        onSaved={async () => { await reloadWhatsApps(); }}
      />
      <ConfirmationModal
        title={i18n.t("connections.confirmationModal.deleteTitle")}
        open={confirmModalOpen}
        onClose={handleCloseConfirm}
        onConfirm={handleDeleteWhatsApp}
      >
        {i18n.t("connections.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <PageHeader
        title={i18n.t("connections.title")}
        description="Gerencie seus canais de comunicação e conexões WhatsApp"
      >
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleOpenNewWebchat}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Configurar Webchat
          </Button>
          <Button onClick={handleOpenNewWhatsApp}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Conexão
          </Button>
        </div>
      </PageHeader>

      <PageContent>
        {whatsApps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Nenhuma conexão configurada</p>
              <p className="text-sm text-muted-foreground mt-1">
                Adicione um WhatsApp para começar a atender seus clientes
              </p>
            </div>
            <Button onClick={handleOpenNewWhatsApp}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Conexão
            </Button>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {whatsApps.map((whatsApp) => (
            <ConnectionCard
              key={whatsApp.id}
              whatsApp={whatsApp}
              onNavigate={(id) => navigate(`/connections/${id}`)}
              onConnect={handleStartSession}
              onDisconnect={handleDisconnectSession}
              onRequestQrCode={handleRequestNewQrCode}
              onEdit={handleEditWhatsApp}
              onDelete={handleOpenConfirm}
            />
          ))}
        </div>
      </PageContent>
    </PageContainer>
  );
};

export default Connections;
