import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Material } from "../activityTypes";

interface MaterialModalProps {
  open: boolean;
  newMaterial: Omit<Material, "id" | "activityId">;
  onChange: React.Dispatch<React.SetStateAction<Omit<Material, "id" | "activityId">>>;
  onConfirm: () => void;
  onCancel: () => void;
}

const MaterialModal: React.FC<MaterialModalProps> = ({
  open, newMaterial, onChange, onConfirm, onCancel,
}) => (
  <Dialog open={open} onOpenChange={onCancel}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Adicionar Material</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Nome do Material</label>
          <Input
            value={newMaterial.materialName}
            onChange={(e) => onChange((prev) => ({ ...prev, materialName: e.target.value }))}
            placeholder="Ex: Cabo HDMI 2m"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Quantidade</label>
            <Input
              type="number"
              min={1}
              value={newMaterial.quantity}
              onChange={(e) => onChange((prev) => ({ ...prev, quantity: Number(e.target.value) }))}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Unidade</label>
            <Input
              value={newMaterial.unit}
              onChange={(e) => onChange((prev) => ({ ...prev, unit: e.target.value }))}
              placeholder="un, m, kg"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Observações</label>
          <Textarea
            value={newMaterial.notes}
            onChange={(e) => onChange((prev) => ({ ...prev, notes: e.target.value }))}
            rows={2}
            placeholder="Opcional..."
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="billable"
            checked={newMaterial.isBillable}
            onCheckedChange={(v) => onChange((prev) => ({ ...prev, isBillable: v }))}
          />
          <label htmlFor="billable" className="text-sm cursor-pointer">
            Item Faturável (cobrar do cliente)
          </label>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button onClick={onConfirm} disabled={!newMaterial.materialName.trim()}>
          Adicionar
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default MaterialModal;
