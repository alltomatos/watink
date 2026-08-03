import React from "react";
import { Edit, Trash2 } from "lucide-react";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { StatusChip } from "@/components/ui/status-chip";
import { Button } from "@/components/ui/button";
import { Can } from "../../../components/Can";
import type { User } from "../../../types/domain";
import type { Client } from "../hooks/useClients";

interface ClientsTableProps {
  clients: Client[];
  loading: boolean;
  user: User | undefined;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
}

function ClientTypeBadge({ type }: { type: Client["type"] }) {
  const isPf = type === "pf";
  return (
    <StatusChip status={isPf ? "info" : "default"} dot={false} label={isPf ? "PF" : "PJ"} />
  );
}

export function ClientsTable({ clients, loading, user, onEdit, onDelete }: ClientsTableProps) {
  const columns: DataTableColumn<Client>[] = [
    { key: "type", header: "Tipo", cell: (c) => <ClientTypeBadge type={c.type} /> },
    { key: "name", header: "Nome", cell: (c) => <span className="font-medium">{c.name}</span> },
    { key: "document", header: "Documento", cell: (c) => <span className="text-muted-foreground">{c.document ?? "—"}</span> },
    { key: "email", header: "Email", cell: (c) => <span className="text-muted-foreground">{c.email ?? "—"}</span> },
    { key: "phone", header: "Telefone", cell: (c) => <span className="text-muted-foreground">{c.phone ?? "—"}</span> },
    {
      key: "actions",
      header: "Ações",
      className: "text-right w-[100px]",
      cell: (client) => (
        <div className="flex items-center justify-end gap-1">
          <Can
            user={user}
            perform="clients:update"
            yes={() => (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(client)}>
                <Edit className="h-4 w-4" />
              </Button>
            )}
          />
          <Can
            user={user}
            perform="clients:delete"
            yes={() => (
              <Button variant="destructive-ghost" size="icon" className="h-8 w-8" onClick={() => onDelete(client)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={clients}
      getRowKey={(c) => c.id}
      loading={loading}
      emptyTitle="Nenhum cliente encontrado"
      emptyDescription="Cadastre o primeiro cliente para começar."
    />
  );
}
