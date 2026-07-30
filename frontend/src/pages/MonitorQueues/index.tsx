/* @jsxImportSource react */
import React, { useEffect, useState, useContext, useCallback } from "react";
import { Link as RouterLink } from "react-router";
import { RotateCcw } from "lucide-react";
import api from "../../services/api";
import { AuthContext } from "../../context/Auth/AuthContext";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

interface QueueInfo {
  name: string;
  vhost: string;
  messages: number;
  ready: number;
  unacknowledged: number;
  consumers: number;
  error?: string;
  state?: string;
}

interface QueueData {
  connected: boolean;
  queues: QueueInfo[];
  total: number;
}

const MonitorQueues: React.FC = () => {
  const { user } = useContext(AuthContext);
  const isSuperAdmin = (user as unknown as { alcance?: string })?.alcance === "plataforma";
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<QueueData>({ connected: false, queues: [], total: 0 });

  const load = useCallback(async () => {
    try {
      const { data: resp } = await api.get<QueueData>("/system/rabbitmq/queues");
      setData(resp ?? { connected: false, queues: [], total: 0 });
      setError(null);
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string } }; message?: string };
      setError(err?.response?.data?.error ?? err?.message ?? "Falha ao carregar filas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, [load]);

  if (!isSuperAdmin) {
    return (
      <PageContainer>
        <PageContent>
          <p className="text-center text-destructive py-16">
            Acesso restrito ao superadmin.
          </p>
        </PageContent>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="RabbitMQ · Todas as Filas"
      >
        <Button variant="outline" size="sm" asChild>
          <RouterLink to="/monitor" className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            Voltar ao Monitor
          </RouterLink>
        </Button>
      </PageHeader>
      <PageContent className="p-0">
        <div className="p-6 space-y-4">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : error ? (
            <p className="text-destructive">Erro: {error}</p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Status:{" "}
                <span className={data.connected ? "text-green-600 font-medium" : "text-red-500 font-medium"}>
                  {data.connected ? "Online" : "Offline"}
                </span>{" "}
                · Total de filas: {data.total || 0}
              </p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fila</TableHead>
                    <TableHead>VHost</TableHead>
                    <TableHead className="text-right">Msgs</TableHead>
                    <TableHead className="text-right">Ready</TableHead>
                    <TableHead className="text-right">Unacked</TableHead>
                    <TableHead className="text-right">Consumers</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.queues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Nenhuma fila encontrada.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.queues.map((q) => (
                      <TableRow key={`${q.vhost || "/"}:${q.name}`}>
                        <TableCell className="font-mono text-sm">{q.name}</TableCell>
                        <TableCell className="font-mono text-sm">{q.vhost || "/"}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{q.messages}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{q.ready}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{q.unacknowledged}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{q.consumers}</TableCell>
                        <TableCell>
                          <span className={q.error ? "text-destructive font-medium" : "text-muted-foreground"}>
                            {q.error || q.state || "ok"}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </>
          )}
        </div>
      </PageContent>
    </PageContainer>
  );
};

export default MonitorQueues;