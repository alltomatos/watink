import React from "react";
import { format, parseISO } from "date-fns";
import { SignalHigh, WifiOff, Network } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";

import { getBackendUrl } from "../../../helpers/urlUtils";
import type { ConnectionSession } from "../connectionsTypes";
import { ConnectionStatusBadge } from "./ConnectionStatusBadge";
import { ConnectionHealthBadge } from "./ConnectionHealthBadge";
import { ConnectionRiskBanner } from "./ConnectionRiskBanner";
import { ConnectionActionButtons } from "./ConnectionActionButtons";

interface ConnectionCardProps {
  whatsApp: ConnectionSession;
  onNavigate: (id: number) => void;
  onConnect: (id: number) => void;
  onDisconnect: (id: number) => void;
  onRequestQrCode: (id: number) => void;
  onEdit: (whatsApp: ConnectionSession) => void;
  onDelete: (whatsApp: ConnectionSession) => void;
}

export const ConnectionCard: React.FC<ConnectionCardProps> = ({
  whatsApp,
  onNavigate,
  onConnect,
  onDisconnect,
  onRequestQrCode,
  onEdit,
  onDelete,
}) => {
  return (
    <Card
      className="flex flex-col cursor-pointer transition-shadow hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      role="button"
      tabIndex={0}
      onClick={() => onNavigate(whatsApp.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onNavigate(whatsApp.id);
        }
      }}
    >
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div className="flex items-center gap-3">
          <Avatar
            size="lg"
            src={getBackendUrl(whatsApp.profilePicUrl)}
            name={whatsApp.name}
          />
          <div>
            <CardTitle className="text-lg">{whatsApp.name}</CardTitle>
            <CardDescription className="flex items-center gap-1">
              {whatsApp.number ? `+${whatsApp.number}` : "Sem número"}
            </CardDescription>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <ConnectionHealthBadge lastRiskCode={whatsApp.lastRiskCode} lastRiskAt={whatsApp.lastRiskAt} />
          <ConnectionStatusBadge status={whatsApp.status} />
        </div>
      </CardHeader>

      <CardContent className="flex-1 py-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Última atualização:</span>
            <span>
              {whatsApp.updatedAt
                ? format(parseISO(whatsApp.updatedAt), "dd/MM/yy HH:mm")
                : "-"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Fila padrão:</span>
            <span>{whatsApp.queue?.name ?? "Nenhuma"}</span>
          </div>
          {whatsApp.proxyMode && whatsApp.proxyMode !== "none" && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Proxy:</span>
              <span className="flex items-center gap-1 text-xs">
                <Network className="h-3 w-3" />
                {whatsApp.proxyMode === "group" ? "Grupo (rotação)" : "Dedicado"}
              </span>
            </div>
          )}
          <ConnectionRiskBanner lastRiskCode={whatsApp.lastRiskCode} lastRiskAt={whatsApp.lastRiskAt} />
        </div>
      </CardContent>

      <CardFooter
        className="border-t border-border/50 pt-4 flex justify-between items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          {whatsApp.status === "CONNECTED" ? (
            <SignalHigh size={18} className="text-green-500" />
          ) : (
            <WifiOff size={18} className="text-muted-foreground" />
          )}
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {whatsApp.type ?? "WHATSAPP"}
          </span>
        </div>
        <ConnectionActionButtons
          whatsApp={whatsApp}
          onConnect={onConnect}
          onDisconnect={onDisconnect}
          onRequestQrCode={onRequestQrCode}
          onEdit={onEdit}
          onDelete={onDelete}
          onConfigure={onNavigate}
        />
      </CardFooter>
    </Card>
  );
};
