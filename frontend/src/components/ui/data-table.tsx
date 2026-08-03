import * as React from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import TableRowSkeleton from "@/components/TableRowSkeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";

export interface DataTableColumn<T> {
  /** Chave única da coluna (usada como React key do <TableHead>) */
  key: string;
  /** Cabeçalho exibido */
  header: React.ReactNode;
  /** Renderiza o conteúdo da célula para uma linha */
  cell: (row: T) => React.ReactNode;
  /** className aplicado ao <TableHead> e a cada <TableCell> da coluna */
  className?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  /** Chave React de cada linha */
  getRowKey: (row: T) => string | number;
  loading?: boolean;
  /** Linhas de skeleton exibidas durante o loading (padrão: 5) */
  skeletonRows?: number;
  error?: boolean;
  onRetry?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  /** Chamado ao clicar em uma linha (opcional — linha vira interativa) */
  onRowClick?: (row: T) => void;
}

/**
 * Tabela genérica que resolve loading (via TableRowSkeleton), empty e error
 * state sem exigir colSpan manual sincronizado com o header — a causa mais
 * comum de divergência entre as ~10 implementações de tabela hoje copiadas
 * página a página.
 */
function DataTable<T>({
  columns,
  data,
  getRowKey,
  loading = false,
  skeletonRows = 5,
  error = false,
  onRetry,
  emptyTitle = "Nenhum registro encontrado",
  emptyDescription,
  emptyAction,
  onRowClick,
}: DataTableProps<T>) {
  const colSpan = columns.length;

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead key={col.key} className={col.className}>
              {col.header}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {error ? (
          <TableRow>
            <TableCell colSpan={colSpan}>
              <ErrorState onRetry={onRetry} />
            </TableCell>
          </TableRow>
        ) : loading ? (
          Array.from({ length: skeletonRows }, (_, i) => (
            <TableRowSkeleton key={i} columns={colSpan} />
          ))
        ) : data.length === 0 ? (
          <TableRow>
            <TableCell colSpan={colSpan}>
              <EmptyState
                title={emptyTitle}
                description={emptyDescription}
                action={emptyAction}
              />
            </TableCell>
          </TableRow>
        ) : (
          data.map((row) => (
            <TableRow
              key={getRowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? "cursor-pointer" : undefined}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className={col.className}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}

export { DataTable };
export default DataTable;
