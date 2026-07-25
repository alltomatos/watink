import React, { useContext, useState } from "react";
import { useTicketsContext } from "../../context/Tickets/TicketsContext";
import { AuthContext } from "../../context/Auth/AuthContext";
import { NewTicketModal } from "../NewTicketModal/NewTicketModal";
import TicketsList from "../TicketsList";
import { Can } from "../Can";
import TicketsQueueSelect, { Queue } from "../TicketsQueueSelect";
import TicketsTagFilter from "../TicketsTagFilter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Search, Plus, Filter, Tag, Users, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";

type ActiveTab = "all" | "open" | "pending" | "closed" | "groups";

const TicketsManager: React.FC = () => {
  useTicketsContext();
  const { user } = useContext(AuthContext);

  const [activeTab, setActiveTab] = useState<ActiveTab>("all");
  const [searchParam, setSearchParam] = useState<string>("");
  const [newTicketModalOpen, setNewTicketModalOpen] = useState<boolean>(false);
  const [currentCount, setCurrentCount] = useState<number>(0);
  const [showUnreadOnly, setShowUnreadOnly] = useState<boolean>(false);

  const userQueueIds: number[] = ((user.queues as Queue[] | undefined) ?? []).map((q) => q.id);
  const [selectedQueueIds, setSelectedQueueIds] = useState<number[]>(userQueueIds);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);

  const [queuePopoverOpen, setQueuePopoverOpen] = useState<boolean>(false);
  const [tagPopoverOpen, setTagPopoverOpen] = useState<boolean>(false);

  const isGroupsTab = activeTab === "groups";

  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSearchParam("");
  };

  const listKey = `${activeTab}-${showUnreadOnly}`;

  // Derive TicketsList props from activeTab
  const listStatus = !isGroupsTab && activeTab !== "all" ? activeTab : undefined;
  const listIsGroup: string | undefined = isGroupsTab ? "true" : "false";

  return (
    <TooltipProvider>
      <div className="relative flex h-full flex-col overflow-hidden bg-background text-foreground">
        <NewTicketModal
          modalOpen={newTicketModalOpen}
          onClose={() => setNewTicketModalOpen(false)}
        />

        {/* ── Cabeçalho ───────────────────────────────────────────── */}
        <header className="flex flex-col gap-2 border-b bg-card px-3 pb-3 pt-3">
          {/* Linha: busca + ações */}
          <div className="flex items-center gap-1.5">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8 text-sm h-8 bg-muted/60 border-0 focus-visible:ring-1"
                placeholder="Buscar..."
                value={searchParam}
                onChange={(e) => setSearchParam(e.target.value.toLowerCase())}
              />
            </div>

            {/* Filtro de filas */}
            <Popover open={queuePopoverOpen} onOpenChange={setQueuePopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" aria-label="Filtrar filas" title="Filtrar Filas">
                  <Filter size={14} />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3">
                <TicketsQueueSelect selectedQueueIds={selectedQueueIds} userQueues={(user.queues as Queue[] | undefined) ?? []} onChange={(values: number[]) => setSelectedQueueIds(values)} />
              </PopoverContent>
            </Popover>

            {/* Filtro de tags */}
            <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground" aria-label="Filtrar tags" title="Filtrar Tags">
                  <Tag size={14} />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-3">
                <TicketsTagFilter selectedTags={selectedTags} onChange={(values: number[]) => setSelectedTags(values)} />
              </PopoverContent>
            </Popover>

            {/* Novo ticket */}
            <Can
              user={user}
              perform="tickets:create"
              yes={() => (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-primary hover:bg-primary/10" aria-label="Novo ticket" onClick={() => setNewTicketModalOpen(true)}>
                      <Plus size={15} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Novo Ticket</TooltipContent>
                </Tooltip>
              )}
              no={() => null}
            />
          </div>

          {/* Pills de abas: individuais (Todos/Abertos/Aguardando/Fechados) + Grupos */}
          <div className="flex items-center gap-1 flex-wrap">
            {!isGroupsTab && (
              <>
                <FilterPill label="Todos"      active={activeTab === "all"}     onClick={() => handleTabChange("all")}     count={activeTab === "all" ? currentCount : undefined} />
                <FilterPill label="Abertos"    active={activeTab === "open"}    onClick={() => handleTabChange("open")}    count={activeTab === "open" ? currentCount : undefined} />
                <FilterPill label="Aguardando" active={activeTab === "pending"} onClick={() => handleTabChange("pending")} count={activeTab === "pending" ? currentCount : undefined} />
                <FilterPill label="Fechados"   active={activeTab === "closed"}  onClick={() => handleTabChange("closed")}  count={activeTab === "closed" ? currentCount : undefined} />
              </>
            )}
            <FilterPill
              label="Grupos"
              active={isGroupsTab}
              onClick={() => handleTabChange(isGroupsTab ? "all" : "groups")}
              count={isGroupsTab ? currentCount : undefined}
              icon={<Users size={10} />}
            />
          </div>

          {/* Chip "Não lidas" (disponível em todas as abas) */}
          <div className="flex items-center gap-1.5">
            <ToggleChip
              icon={<CircleDot size={11} />}
              label="Não lidas"
              active={showUnreadOnly}
              onClick={() => setShowUnreadOnly((v) => !v)}
            />
          </div>
        </header>

        {/* ── Lista de tickets ─────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden">
          <TicketsList
            key={listKey}
            status={listStatus}
            showAll
            selectedQueueIds={selectedQueueIds}
            updateCount={(val: number) => setCurrentCount(val)}
            tags={selectedTags}
            searchParam={searchParam}
            isGroup={listIsGroup}
            withUnreadMessages={showUnreadOnly ? "true" : undefined}
          />
        </div>
      </div>
    </TooltipProvider>
  );
};

// ── Componentes auxiliares locais ─────────────────────────────────────────────

interface FilterPillProps {
  label: string;
  active: boolean;
  onClick: () => void;
  count?: number;
  icon?: React.ReactNode;
}

const FilterPill: React.FC<FilterPillProps> = ({ label, active, onClick, count, icon }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[0.6875rem] font-semibold transition-all",
      active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )}
  >
    {icon}
    {label}
    {count !== undefined && count > 0 && (
      <span className={cn(
        "text-[10px] font-bold leading-none",
        active ? "opacity-80" : "opacity-60"
      )}>
        {count}
      </span>
    )}
  </button>
);

interface ToggleChipProps {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}

const ToggleChip: React.FC<ToggleChipProps> = ({ icon, label, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      "flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.625rem] font-medium transition-all",
      active
        ? "border-primary/40 bg-primary/10 text-primary"
        : "border-border bg-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
    )}
  >
    {icon}
    {label}
  </button>
);

export default TicketsManager;
