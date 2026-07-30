import React from "react";
import { Link as RouterLink } from "react-router";
import { UploadCloud, BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DashboardHeaderProps {
  hasUpdateAvailable: boolean;
  availableVersion: string;
  updating: boolean;
  updateStatus: "idle" | "updating" | "ok";
  onUpdateClick: () => void;
}

const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  hasUpdateAvailable,
  availableVersion,
  updating,
  updateStatus,
  onUpdateClick,
}) => (
  <div className="flex flex-wrap items-center justify-between gap-3">
    <h1 className="text-xl font-semibold">Monitor do Sistema (Business)</h1>
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" asChild>
        <RouterLink to="/swagger">
          <BookOpen className="mr-2 h-4 w-4" />
          Swagger
        </RouterLink>
      </Button>
      {hasUpdateAvailable && (
        <Badge variant="destructive">Nova versão v{availableVersion}</Badge>
      )}
      <Button
        size="sm"
        variant={updateStatus === "ok" ? "secondary" : "default"}
        disabled={updating || updateStatus === "ok"}
        onClick={onUpdateClick}
        style={
          updateStatus === "ok"
            ? {
                backgroundColor: "var(--status-success)",
                color: "var(--bg-surface)",
              }
            : undefined
        }
      >
        {updating ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <UploadCloud className="mr-2 h-4 w-4" />
        )}
        {updateStatus === "ok"
          ? "Atualização OK"
          : updating
          ? "Atualizando..."
          : "Verificar Atualização"}
      </Button>
    </div>
  </div>
);

export default DashboardHeader;
