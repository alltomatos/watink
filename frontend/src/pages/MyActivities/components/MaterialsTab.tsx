import React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TabsContent } from "@/components/ui/tabs";
import { Material } from "../activityTypes";

interface MaterialsTabProps {
  materials: Material[];
  onDelete: (id: number) => void;
  onAdd: () => void;
}

const MaterialsTab: React.FC<MaterialsTabProps> = ({ materials, onDelete, onAdd }) => (
  <TabsContent value="materials" className="space-y-3">
    {materials.length === 0 ? (
      <p className="text-center text-muted-foreground py-8">Nenhum material utilizado.</p>
    ) : (
      <div className="space-y-2">
        {materials.map((m) => (
          <div key={m.id} className="flex items-start justify-between rounded-lg border border-border p-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{m.materialName}</p>
              <p className="text-xs text-muted-foreground">
                {m.quantity} {m.unit}
                {m.isBillable && (
                  <span className="ml-2 font-semibold text-green-600">$ Faturável</span>
                )}
              </p>
              {m.notes && <p className="text-xs text-muted-foreground mt-1">{m.notes}</p>}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDelete(m.id)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    )}
    <div className="flex justify-end">
      <Button size="sm" onClick={onAdd}>
        <Plus className="mr-2 h-4 w-4" />
        Adicionar Material
      </Button>
    </div>
  </TabsContent>
);

export default MaterialsTab;
