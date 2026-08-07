import React, { useEffect, useMemo, useState } from "react";
import { Search, TriangleAlert, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { listGroups, type GroupInfo } from "@/services/groupService";
import type { CampaignTargetDraft } from "../campaignTypes";

interface CampaignGroupPickerProps {
    whatsappId: number | null;
    selected: CampaignTargetDraft[];
    onChange: (targets: CampaignTargetDraft[]) => void;
}

/** Groups where the connection is member but NOT admin, and the group only
 * allows admins to post (announce=true) -- the WhatsApp send itself would
 * be rejected, so these are excluded from selection automatically rather
 * than surfaced as a send failure later. */
function isSendable(g: GroupInfo): boolean {
    return !(g.announce && !g.isConnectionAdmin);
}

const CampaignGroupPicker: React.FC<CampaignGroupPickerProps> = ({ whatsappId, selected, onChange }) => {
    const [groups, setGroups] = useState<GroupInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");

    useEffect(() => {
        if (!whatsappId) {
            setGroups([]);
            return;
        }
        let active = true;
        setLoading(true);
        listGroups(whatsappId)
            .then((list) => {
                if (active) setGroups(list);
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => {
            active = false;
        };
    }, [whatsappId]);

    const sendable = useMemo(() => groups.filter(isSendable), [groups]);
    const excludedCount = groups.length - sendable.length;

    const filtered = sendable.filter((g) => g.subject.toLowerCase().includes(search.toLowerCase()));

    const selectedJids = useMemo(() => new Set(selected.map((t) => t.jid)), [selected]);

    const toggle = (g: GroupInfo) => {
        if (selectedJids.has(g.jid)) {
            onChange(selected.filter((t) => t.jid !== g.jid));
        } else if (whatsappId) {
            onChange([
                ...selected,
                { whatsappId, jid: g.jid, subject: g.subject, isConnectionAdmin: !!g.isConnectionAdmin },
            ]);
        }
    };

    const selectAllFiltered = () => {
        if (!whatsappId) return;
        const toAdd = filtered
            .filter((g) => !selectedJids.has(g.jid))
            .map((g) => ({ whatsappId, jid: g.jid, subject: g.subject, isConnectionAdmin: !!g.isConnectionAdmin }));
        onChange([...selected, ...toAdd]);
    };

    const clearSelection = () => onChange([]);

    if (!whatsappId) {
        return <p className="text-sm text-muted-foreground">Selecione uma conexão para escolher os grupos.</p>;
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar grupo..."
                        className="pl-8"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button type="button" variant="outline" size="sm" onClick={selectAllFiltered}>
                    Selecionar todos os filtrados
                </Button>
                {selected.length > 0 && (
                    <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                        Limpar seleção
                    </Button>
                )}
                <Badge variant="secondary">{selected.length} selecionado{selected.length === 1 ? "" : "s"}</Badge>
            </div>

            {excludedCount > 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-start gap-1.5">
                    <TriangleAlert className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    {excludedCount} grupo{excludedCount === 1 ? "" : "s"} oculto{excludedCount === 1 ? "" : "s"}{" "}
                    da lista: só admins podem postar e esta conexão não é admin — o envio seria rejeitado pelo
                    WhatsApp.
                </p>
            )}

            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-14 rounded-lg" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum grupo encontrado.</p>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[360px] overflow-y-auto pr-1">
                    {filtered.map((g) => (
                        <label
                            key={g.jid}
                            className="flex items-center gap-2.5 rounded-lg border px-2.5 py-2 cursor-pointer hover:bg-muted/40"
                        >
                            <Checkbox checked={selectedJids.has(g.jid)} onCheckedChange={() => toggle(g)} />
                            <Avatar size="sm" src={g.pictureURL} name={g.subject} isGroup />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm truncate">{g.subject}</p>
                                <p className="text-[11px] text-muted-foreground">
                                    {g.participants.length} participante{g.participants.length === 1 ? "" : "s"}
                                </p>
                            </div>
                            {g.isConnectionAdmin && (
                                <Badge variant="outline" className="gap-1 shrink-0">
                                    <ShieldCheck className="h-3 w-3" /> Admin
                                </Badge>
                            )}
                        </label>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CampaignGroupPicker;
