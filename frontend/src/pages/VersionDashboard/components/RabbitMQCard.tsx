import React from "react";
import { Link as RouterLink } from "react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SystemStats, QueueAlert } from "../types";

interface RabbitMQCardProps {
  stats: SystemStats | null;
  queueAlerts: Record<string, QueueAlert>;
}

const RabbitMQCard: React.FC<RabbitMQCardProps> = ({ stats, queueAlerts }) => {
  const queues = stats?.rabbitmq?.queues || [];

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Fila de Mensagens (RabbitMQ)</h2>
        <Button variant="ghost" size="sm" asChild>
          <RouterLink to="/monitor/queues">Ver filas</RouterLink>
        </Button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Status:{" "}
        {stats?.rabbitmq?.connected ? (
          <span className="text-green-600">Online</span>
        ) : (
          <span className="text-destructive">Offline</span>
        )}{" "}
        • exibindo {Math.min(queues.length, 8)} de {queues.length}
      </p>
      <div className="space-y-3">
        {queues.slice(0, 8).map((q) => {
          const alert = queueAlerts[q.name] || { level: "ok", label: "OK" };
          return (
            <div key={q.name} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs">{q.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    msgs: {q.messages || 0} • consumers: {q.consumers || 0}
                  </span>
                  <Badge
                    variant={
                      alert.level === "error"
                        ? "destructive"
                        : alert.level === "warning"
                        ? "secondary"
                        : "outline"
                    }
                    className="text-xs"
                  >
                    {alert.label}
                  </Badge>
                </div>
              </div>
              <Progress
                value={Math.min(100, (q.messages || 0) * 5)}
                className={
                  alert.level !== "ok" ? "[&>div]:bg-destructive" : undefined
                }
              />
              {q.error && (
                <p className="text-xs text-destructive">{q.error}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RabbitMQCard;
