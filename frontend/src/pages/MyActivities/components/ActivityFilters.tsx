import React from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ACTIVITY_PRIORITY_LABELS, ACTIVITY_STATUS_LABELS } from "../activityTypes";

interface ActivityFiltersProps {
  search: string;
  onSearchChange: (v: string) => void;
  status: string;
  onStatusChange: (v: string) => void;
  priority: string;
  onPriorityChange: (v: string) => void;
}

// Mesma disposição horizontal de GruposTab.tsx (selects + busca à esquerda)
// — sem seletor de conexão, Activities não é por-conexão-WhatsApp.
const ActivityFilters: React.FC<ActivityFiltersProps> = ({
  search, onSearchChange, status, onStatusChange, priority, onPriorityChange,
}) => (
  <div className="flex items-center gap-2 flex-wrap">
    <Select value={status || "all"} onValueChange={(v) => onStatusChange(v === "all" ? "" : v)}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Status" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos os status</SelectItem>
        {Object.entries(ACTIVITY_STATUS_LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>

    <Select value={priority || "all"} onValueChange={(v) => onPriorityChange(v === "all" ? "" : v)}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Prioridade" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todas as prioridades</SelectItem>
        {Object.entries(ACTIVITY_PRIORITY_LABELS).map(([value, label]) => (
          <SelectItem key={value} value={value}>{label}</SelectItem>
        ))}
      </SelectContent>
    </Select>

    <div className="relative">
      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
      <Input
        placeholder="Buscar por título..."
        className="pl-8 w-[220px]"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
      />
    </div>
  </div>
);

export default ActivityFilters;
