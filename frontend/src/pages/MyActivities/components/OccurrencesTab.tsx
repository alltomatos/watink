import React from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Occurrence, OCCURRENCE_TYPE_LABELS } from "../activityTypes";
import { minutesToTime } from "../activityHelpers";

interface OccurrencesTabProps {
  occurrences: Occurrence[];
  onDelete: (id: number) => void;
  onAdd: () => void;
}

const OccurrencesTab: React.FC<OccurrencesTabProps> = ({ occurrences, onDelete, onAdd }) => (
  <TabsContent value="occurrences" className="space-y-3">
    {occurrences.length === 0 ? (
      <p className="text-center text-muted-foreground py-8">Nenhuma ocorrência registrada.</p>
    ) : (
      <div className="space-y-2">
        {occurrences.map((o) => (
          <div key={o.id} className="flex items-start justify-between rounded-lg border border-border p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm">{o.description}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <span
                  className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                    o.type === "impediment"
                      ? "bg-red-100 text-red-700"
                      : o.type === "delay"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-blue-100 text-blue-700"
                  }`}
                >
                  {OCCURRENCE_TYPE_LABELS[o.type]}
                </span>
                {o.timeImpact != null && (
                  <span className="text-xs text-muted-foreground">
                    Impacto: {minutesToTime(o.timeImpact)}
                  </span>
                )}
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(o.id)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    )}
    <div className="flex justify-end">
      <Button variant="secondary" size="sm" onClick={onAdd}>
        <AlertTriangle className="mr-2 h-4 w-4" />
        Registrar Ocorrência
      </Button>
    </div>
  </TabsContent>
);

export default OccurrencesTab;
