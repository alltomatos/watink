import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Loader2, Users } from "lucide-react";
import {
    AssistantGroupItem,
    listAssistantGroups,
    setAssistantGroupActive,
} from "../../services/assistantService";

interface AssistantGroupsPanelProps {
    assistantId: number;
}

/** Duas colunas Inativo/Ativo: clicar num grupo move ele para a outra
 * coluna. Por padrão todo grupo começa Inativo — o bot não vê nem interage
 * até ser explicitamente ativado aqui. Renderizado inline (aba "Grupos"),
 * sem chrome de modal. */
const AssistantGroupsPanel: React.FC<AssistantGroupsPanelProps> = ({ assistantId }) => {
    const [loading, setLoading] = useState(false);
    const [groups, setGroups] = useState<AssistantGroupItem[]>([]);
    const [togglingId, setTogglingId] = useState<number | null>(null);

    useEffect(() => {
        setLoading(true);
        listAssistantGroups(assistantId)
            .then(setGroups)
            .catch(() => toast.error("Erro ao carregar grupos da conexão"))
            .finally(() => setLoading(false));
    }, [assistantId]);

    const toggle = async (group: AssistantGroupItem) => {
        setTogglingId(group.contactId);
        const nextActive = !group.active;
        try {
            await setAssistantGroupActive(assistantId, group.contactId, nextActive);
            setGroups((prev) =>
                prev.map((g) => (g.contactId === group.contactId ? { ...g, active: nextActive } : g))
            );
        } catch {
            toast.error("Erro ao atualizar o grupo");
        } finally {
            setTogglingId(null);
        }
    };

    const inactive = groups.filter((g) => !g.active);
    const active = groups.filter((g) => g.active);

    const renderColumn = (title: string, items: AssistantGroupItem[], emptyHint: string) => (
        <div className="flex flex-col gap-2 flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground">
                {title} ({items.length})
            </p>
            <div className="flex flex-col gap-1.5 rounded-xl border p-2 min-h-[220px] max-h-[420px] overflow-y-auto">
                {items.length === 0 && (
                    <p className="text-xs text-muted-foreground p-3 text-center">{emptyHint}</p>
                )}
                {items.map((g) => (
                    <button
                        key={g.contactId}
                        type="button"
                        onClick={() => toggle(g)}
                        disabled={togglingId === g.contactId}
                        className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm hover:bg-accent transition-colors disabled:opacity-50 cursor-pointer disabled:cursor-default"
                    >
                        <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <span className="truncate flex-1">{g.name || g.number}</span>
                        {togglingId === g.contactId && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    </button>
                ))}
            </div>
        </div>
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (groups.length === 0) {
        return (
            <p className="text-sm text-muted-foreground text-center py-12">
                Nenhum grupo conhecido nesta conexão ainda — grupos aparecem aqui depois que
                mandarem a primeira mensagem.
            </p>
        );
    }

    return (
        <div className="flex flex-col sm:flex-row gap-4">
            {renderColumn("Inativo", inactive, "Nenhum grupo inativo")}
            {renderColumn("Ativo", active, "Nenhum grupo ativo ainda")}
        </div>
    );
};

export default AssistantGroupsPanel;
