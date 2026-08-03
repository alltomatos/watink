import React from "react";
import { Rocket } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReleaseMeta } from "../types";

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableVersion: string;
  frontendVersion: string;
  releaseMeta: ReleaseMeta;
  changelog: string[];
  blockedByCompatibility: boolean;
  onConfirm: () => void;
}

const UpdateDialog: React.FC<UpdateDialogProps> = ({
  open,
  onOpenChange,
  availableVersion,
  frontendVersion,
  releaseMeta,
  changelog,
  blockedByCompatibility,
  onConfirm,
}) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5 text-muted-foreground" />
          Verificar Atualização
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-2 text-sm">
        <p>
          Versão disponível:{" "}
          <strong>v{availableVersion !== "-" ? availableVersion : "latest"}</strong>
        </p>
        <p className="text-muted-foreground">Versão atual: v{frontendVersion}</p>

        {releaseMeta?.breaking && (
          <div className="mt-2 space-y-1">
            <Badge variant="destructive">Release com quebra de compatibilidade</Badge>
            {releaseMeta?.minCompatibleFrom && (
              <p className="text-xs text-destructive">
                Compatível apenas a partir de v{releaseMeta.minCompatibleFrom}.
              </p>
            )}
            {releaseMeta?.migrationNotes && (
              <p className="text-xs text-muted-foreground">
                Migração necessária: {releaseMeta.migrationNotes}
              </p>
            )}
          </div>
        )}

        {changelog.length > 0 ? (
          <>
            <p className="pt-2">Changelog desta versão:</p>
            <ul className="list-disc pl-5 space-y-1">
              {changelog.map((item, idx) => (
                <li key={`${idx}-${item}`}>{item}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-muted-foreground">
            Changelog não informado para esta versão.
          </p>
        )}

        <p className="pt-2">
          Ao atualizar, o sistema irá entrar em manutenção e reiniciar os serviços.
        </p>
        <p>Deseja prosseguir agora?</p>

        {blockedByCompatibility && (
          <p className="text-destructive">
            Atualização bloqueada por compatibilidade. Atualize para uma versão
            intermediária compatível ou execute a migração indicada antes de prosseguir.
          </p>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Agora não
        </Button>
        <Button onClick={onConfirm} disabled={blockedByCompatibility}>
          {blockedByCompatibility ? "Release incompatível" : "Sim, Atualizar Agora"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default UpdateDialog;
