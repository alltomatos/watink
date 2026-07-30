import React from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, MessageSquare, Edit2 } from "lucide-react";

import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../../../components/ui/tooltip";
import { PageHeader } from "../../../components/ui/page-layout";

import type { WhatsApp } from "../connectionConfigTypes";

interface ConnectionPageHeaderProps {
  whatsapp: WhatsApp;
  status: string;
  isConnected: boolean;
  isBusy: boolean;
  onEditClick: () => void;
}

const StatusBadge = ({ isConnected, isBusy, status }: { isConnected: boolean; isBusy: boolean; status: string }) => {
  if (isConnected) {
    return (
      <Badge variant="secondary" className="bg-green-100 text-green-700 border-none gap-1">
        <span className="h-2 w-2 rounded-full bg-green-500" /> Conectado
      </Badge>
    );
  }
  if (status === "QRCODE") {
    return (
      <Badge variant="outline" className="border-amber-400 text-amber-600">
        Escanear QR Code
      </Badge>
    );
  }
  if (isBusy) {
    return <Badge variant="outline" className="animate-pulse">Iniciando...</Badge>;
  }
  return <Badge variant="destructive">Desconectado</Badge>;
};

const ConnectionPageHeader = ({ whatsapp, status, isConnected, isBusy, onEditClick }: ConnectionPageHeaderProps) => {
  const navigate = useNavigate();

  return (
    <PageHeader
      title={
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/connections")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-100 text-green-600">
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold">{whatsapp.name}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEditClick}>
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Editar Nome/Fila</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <span className="text-xs text-muted-foreground">Conexão WhatsApp · ID #{whatsapp.id}</span>
          </div>
          <div className="ml-auto">
            <StatusBadge isConnected={isConnected} isBusy={isBusy} status={status} />
          </div>
        </div>
      }
    />
  );
};

export default ConnectionPageHeader;
