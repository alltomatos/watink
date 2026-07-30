import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { Search, Plus, Edit, Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import ConfirmationModal from "../../../components/ConfirmationModal";

import { useUsuariosTab } from "../hooks/useUsuariosTab";
import UserPanel from "./UserPanel";
import { ALCANCE_OPTIONS } from "../acessosTypes";
import type { AcessosUserListItem } from "../acessosTypes";

const alcanceLabel = (value: string): string =>
  ALCANCE_OPTIONS.find((o) => o.value === value)?.label ?? value;

const UsuariosTab: React.FC = () => {
  const {
    users,
    loading,
    searchParam,
    handleSearch,
    cargos,
    setores,
    panelOpen,
    editingUser,
    editingUserSetores,
    panelLoading,
    openCreate,
    openEdit,
    closePanel,
    saveUser,
    deleteUser,
    cargoNameById,
  } = useUsuariosTab();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState<AcessosUserListItem | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  // Auto-abertura do fluxo de criação guiada (ex: Onboarding Checklist do
  // Dashboard) via query param — ver docs/agents/onboarding.md. Não é um
  // endpoint novo: só reaproveita o openCreate() já existente.
  useEffect(() => {
    if (searchParams.get("autoOpen") === "create") {
      openCreate();
      const next = new URLSearchParams(searchParams);
      next.delete("autoOpen");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <ConfirmationModal
        title={deletingUser ? `Excluir o usuário ${deletingUser.name}?` : ""}
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          if (deletingUser) await deleteUser(deletingUser);
          setConfirmOpen(false);
          setDeletingUser(null);
        }}
      >
        O dono do tenant e o último Administrador não podem ser excluídos.
      </ConfirmationModal>

      <UserPanel
        open={panelOpen}
        loading={panelLoading}
        editingUser={editingUser}
        editingUserSetores={editingUserSetores}
        cargos={cargos}
        setores={setores}
        onClose={closePanel}
        onSave={saveUser}
      />

      <div className="flex items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar usuário..."
            value={searchParam}
            onChange={handleSearch}
            className="pl-9 h-10"
          />
        </div>
        <Button onClick={openCreate} className="ml-auto gap-2">
          <Plus className="h-4 w-4" />
          Novo Usuário
        </Button>
      </div>

      <div className="rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">Avatar</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead className="text-center">Alcance</TableHead>
              <TableHead className="text-right w-[110px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="text-center">
                  <Avatar size="sm" name={user.name} />
                </TableCell>
                <TableCell>
                  <span className="font-semibold text-sm">{user.name}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">{user.email}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={user.cargoId ? "default" : "secondary"}>
                    {cargoNameById(user.cargoId)}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{alcanceLabel(user.alcance)}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEdit(user)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => {
                        setDeletingUser(user);
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
                <TableCell colSpan={6} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                </TableCell>
              </TableRow>
            )}
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  Nenhum usuário encontrado.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default UsuariosTab;
