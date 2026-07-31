import React from "react";
import { Loader2 } from "lucide-react";

import { PageLayout, PageContent } from "../../components/ui/page-layout";

import { useConnectionConfig } from "./hooks/useConnectionConfig";
import ConnectionModals from "./components/ConnectionModals";
import ConnectionPageHeader from "./components/ConnectionPageHeader";
import ConnectionActionGrid from "./components/ConnectionActionGrid";
import ConnectionStatusBanner from "./components/ConnectionStatusBanner";
import { ConnectionRiskBanner } from "./components/ConnectionRiskBanner";
import IdentityCard from "./components/IdentityCard";
import PairingCodePanel from "./components/PairingCodePanel";
import QrCodePanel from "./components/QrCodePanel";
import SessionDetailsCard from "./components/SessionDetailsCard";

const ConnectionConfig = () => {
  const {
    whatsappId,
    whatsapp,
    loading,
    stats,
    keepAliveSaving,
    status,
    isConnected,
    isBusy,
    connecting,
    restarting,
    pairingModalOpen,
    setPairingModalOpen,
    whatsappModalOpen,
    setWhatsAppModalOpen,
    confirmationOpen,
    setConfirmationOpen,
    confirmationAction,
    setConfirmationAction,
    phoneNumber,
    setPhoneNumber,
    pairingCode,
    pairingLoading,
    showPairingInput,
    showQrCode,
    inputPairingModalOpen,
    setInputPairingModalOpen,
    fetchWhatsapp,
    handleStartSessionQr,
    handleRestart,
    handleRequestPairingCode,
    handleDisconnect,
    handleDelete,
    handleToggleKeepAlive,
    handleCancelPairing,
  } = useConnectionConfig();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!whatsapp) return null;

  const openDisconnectConfirmation = () => { setConfirmationAction("disconnect"); setConfirmationOpen(true); };
  const openDeleteConfirmation = () => { setConfirmationAction("delete"); setConfirmationOpen(true); };

  return (
    <PageLayout>
      <ConnectionModals
        whatsappId={whatsappId}
        confirmationOpen={confirmationOpen}
        confirmationAction={confirmationAction}
        onCloseConfirmation={() => setConfirmationOpen(false)}
        onDisconnect={handleDisconnect}
        onDelete={handleDelete}
        whatsappModalOpen={whatsappModalOpen}
        onCloseWhatsAppModal={() => { setWhatsAppModalOpen(false); void fetchWhatsapp(); }}
        pairingModalOpen={pairingModalOpen}
        onClosePairingModal={() => setPairingModalOpen(false)}
        inputPairingModalOpen={inputPairingModalOpen}
        onOpenChangePairingInput={setInputPairingModalOpen}
        phoneNumber={phoneNumber}
        onPhoneNumberChange={setPhoneNumber}
        onConfirmPairing={handleRequestPairingCode}
        pairingLoading={pairingLoading}
      />

      <ConnectionPageHeader
        whatsapp={whatsapp}
        status={status}
        isConnected={isConnected}
        isBusy={isBusy}
        onEditClick={() => setWhatsAppModalOpen(true)}
      />

      <PageContent>
        <div className="space-y-6">
          <ConnectionStatusBanner
            isConnected={isConnected}
            isBusy={isBusy}
            status={status}
            connecting={connecting}
            onDisconnect={openDisconnectConfirmation}
            onConnectQr={handleStartSessionQr}
            onConnectPairing={() => setInputPairingModalOpen(true)}
          />

          <ConnectionRiskBanner lastRiskCode={whatsapp.lastRiskCode} lastRiskAt={whatsapp.lastRiskAt} />

          {status === "QRCODE" && showQrCode && (
            <QrCodePanel qrcode={whatsapp.qrcode} onCancel={openDisconnectConfirmation} />
          )}

          {showPairingInput && !isConnected && (
            <PairingCodePanel pairingCode={pairingCode} onCancel={handleCancelPairing} />
          )}

          <IdentityCard whatsapp={whatsapp} isConnected={isConnected} stats={stats} />

          <ConnectionActionGrid
            isConnected={isConnected}
            isBusy={isBusy}
            connecting={connecting}
            restarting={restarting}
            onDisconnect={openDisconnectConfirmation}
            onRestart={handleRestart}
            onStartQr={handleStartSessionQr}
            onDelete={openDeleteConfirmation}
          />

          <SessionDetailsCard
            whatsapp={whatsapp}
            status={status}
            keepAliveSaving={keepAliveSaving}
            onToggleKeepAlive={handleToggleKeepAlive}
          />
        </div>
      </PageContent>
    </PageLayout>
  );
};

export default ConnectionConfig;
