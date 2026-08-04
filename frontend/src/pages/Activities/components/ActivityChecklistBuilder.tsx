import React from "react";
import { Plus, Trash2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface ChecklistDraftItem {
  label: string;
  inputType: "text" | "number" | "photo";
  isRequired: boolean;
  position: number;
}

interface ActivityChecklistBuilderProps {
  items: ChecklistDraftItem[];
  onChange: (items: ChecklistDraftItem[]) => void;
}

const INPUT_TYPE_LABELS: Record<ChecklistDraftItem["inputType"], string> = {
  text: "Texto",
  number: "Número",
  photo: "Foto",
};

// ActivityChecklistBuilder — monta o checklist de execução ANTES de criar a
// Activity (POST /activities aceita items[]). O backend hoje não expõe
// rota para adicionar/remover item de uma Activity já existente — por isso
// este montador só é editável na criação; na edição, o formulário mostra o
// checklist existente como leitura (ver ActivityFormDialog).
const ActivityChecklistBuilder: React.FC<ActivityChecklistBuilderProps> = ({ items, onChange }) => {
  const addItem = () => {
    onChange([...items, { label: "", inputType: "text", isRequired: false, position: items.length }]);
  };

  const updateItem = (index: number, patch: Partial<ChecklistDraftItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index).map((item, i) => ({ ...item, position: i })));
  };

  const moveItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((item, i) => ({ ...item, position: i })));
  };

  return (
    <div className="space-y-2">
      {items.length === 0 && (
        <p className="text-sm text-muted-foreground">Nenhum item no checklist ainda.</p>
      )}
      {items.map((item, index) => (
        <div key={index} className="flex items-center gap-2 rounded-md border border-border p-2">
          <div className="flex flex-col">
            <Button variant="ghost" size="icon" className="h-4 w-6" disabled={index === 0} onClick={() => moveItem(index, -1)}>
              <ChevronUp className="h-3 w-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-4 w-6" disabled={index === items.length - 1} onClick={() => moveItem(index, 1)}>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </div>

          <Input
            className="flex-1"
            placeholder="Ex: Conferir voltagem"
            value={item.label}
            onChange={(e) => updateItem(index, { label: e.target.value })}
          />

          <Select value={item.inputType} onValueChange={(v) => updateItem(index, { inputType: v as ChecklistDraftItem["inputType"] })}>
            <SelectTrigger className="w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(INPUT_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5" title="Obrigatório">
            <Switch checked={item.isRequired} onCheckedChange={(v) => updateItem(index, { isRequired: v })} />
          </div>

          <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeItem(index)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}

      <Button variant="outline" size="sm" onClick={addItem}>
        <Plus className="mr-2 h-4 w-4" />
        Adicionar item
      </Button>
    </div>
  );
};

export default ActivityChecklistBuilder;
