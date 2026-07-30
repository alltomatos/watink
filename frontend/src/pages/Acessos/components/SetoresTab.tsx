import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Search, Plus, Edit, Trash2, Loader2, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ConfirmationModal from "../../../components/ConfirmationModal";

import { useSetoresTab } from "../hooks/useSetoresTab";
import SetorPanel from "./SetorPanel";
import type { SetorListItem } from "../acessosTypes";

const SetoresTab: React.FC = () => {
  const {
    setores,
    loading,
    searchParam,
    handleSearch,
    panelOpen,
    editingSetor,
    panelLoading,
    initialName,
    openCreate,
    openEdit,
    closePanel,
    saveSetorName,
    deleteSetor,
    addMember,
    updateMember,
    removeMember,
    setQueues,
  } = useSetoresTab();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingSetor, setDeletingSetor] = useState<SetorListItem | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-abertura do fluxo de criação guiada (ex: Onboarding Checklist do
  // Dashboard) via query param — ver docs/agents/onboarding.md. Não é um
  // endpoint novo: só reaproveita o openCreate() já existente.
  useEffect(() => {
    if (searchParams.get("autoOpen") === "create") {
      openCreate(searchParams.get("suggestedName") ?? "");
      const next = new URLSearchParams(searchParams);
      next.delete("autoOpen");
      next.delete("suggestedName");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <ConfirmationModal
        title={deletingSetor ? `Excluir o setor ${deletingSetor.name}?` : ""}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          if (deletingSetor) await deleteSetor(deletingSetor);
          setConfirmOpen(false);
          setDeletingSetor(null);
        }}
      >
        Setores com membros vinculados não podem ser excluídos — realoque os
        usuários primeiro.
      </ConfirmationModal>

      <SetorPanel
        open={panelOpen}
        loading={panelLoading}
        editingSetor={editingSetor}
        initialName={initialName}
        onClose={closePanel}
        onSaveName={saveSetorName}
        onAddMember={addMember}
        onToggleMember={updateMember}
        onRemoveMember={removeMember}
        onSetQueues={setQueues}
      />

      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar setor..."
            value={searchParam}
            onChange={handleSearch}
            className="pl-9 h-10"
          />
        </div>
        <Button onClick={() => openCreate()} className="ml-auto gap-2">
          <Plus className="h-4 w-4" />
          Novo Setor
        </Button>
      </div>

      <div className="rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead className="text-center">Membros</TableHead>
              <TableHead className="text-center">Gestores</TableHead>
              <TableHead className="text-right w-[110px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {setores.map((setor) => (
              <TableRow key={setor.id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    <span className="font-semibold">{setor.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="secondary">{setor.memberCount}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{setor.gestorCount}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(setor)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        setDeletingSetor(setor);
                        setConfirmOpen(true);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {loading && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!loading && setores.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  Nenhum setor encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default SetoresTab;
