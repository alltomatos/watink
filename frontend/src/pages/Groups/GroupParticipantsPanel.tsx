import React, { useState } from "react";
import { toast } from "react-toastify";
import { MoreVertical, ShieldCheck, ShieldOff, UserMinus, UserPlus } from "lucide-react";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import ConfirmationModal from "@/components/ConfirmationModal";
import ButtonWithSpinner from "@/components/ButtonWithSpinner";
import { GroupInfo, ParticipantResult, updateParticipants } from "../../services/groupService";
import { classifyGroupsApiError } from "./groupTypes";

interface GroupParticipantsPanelProps {
    whatsappId: number;
    group: GroupInfo;
    onChanged: () => void;
}

const GroupParticipantsPanel: React.FC<GroupParticipantsPanelProps> = ({ whatsappId, group, onChanged }) => {
    const [addOpen, setAddOpen] = useState(false);
    const [addRaw, setAddRaw] = useState("");
    const [addLoading, setAddLoading] = useState(false);
    const [removeTarget, setRemoveTarget] = useState<string | null>(null);
    const [lastResults, setLastResults] = useState<ParticipantResult[] | null>(null);

    const runAction = async (action: "add" | "remove" | "promote" | "demote", jids: string[]) => {
        try {
            const results = await updateParticipants(whatsappId, group.jid, action, jids);
            setLastResults(results);
            const failed = results.filter((r) => r.status === "error");
            if (failed.length > 0) {
                toast.warning(`${results.length - failed.length}/${results.length} concluído(s) com sucesso`);
            } else {
                toast.success("Ação concluída");
            }
            onChanged();
        } catch (err) {
            toast.error(classifyGroupsApiError(err).message);
        }
    };

    const handleAddSubmit = async () => {
        const jids = addRaw
            .split(/[\n,]/)
            .map((p) => p.trim())
            .filter(Boolean);
        if (jids.length === 0) return;
        setAddLoading(true);
        await runAction("add", jids);
        setAddLoading(false);
        setAddOpen(false);
        setAddRaw("");
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-end">
                <Button size="sm" onClick={() => setAddOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Adicionar participantes
                </Button>
            </div>

            {lastResults && (
                <div className="rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)] p-4 text-sm">
                    <p className="font-medium mb-2">Resultado da última ação</p>
                    <ul className="space-y-1">
                        {lastResults.map((r) => (
                            <li key={r.jid} className="flex items-center gap-2">
                                <Badge variant={r.status === "ok" ? "secondary" : "destructive"}>
                                    {r.status === "ok" ? "OK" : "Falhou"}
                                </Badge>
                                <span className="truncate">{r.jid}</span>
                                {r.error && <span className="text-muted-foreground text-xs">— {r.error}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)] overflow-hidden">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Participante</TableHead>
                            <TableHead>Papel</TableHead>
                            <TableHead className="w-10" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {group.participants.map((p) => (
                            <TableRow key={p.jid}>
                                <TableCell className="flex items-center gap-2">
                                    <Avatar size="sm" name={p.displayName || p.phoneNumber || p.jid} />
                                    <div className="min-w-0">
                                        <p className="truncate text-sm">{p.displayName || p.phoneNumber || p.jid}</p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {p.isSuperAdmin ? (
                                        <Badge>Superadmin</Badge>
                                    ) : p.isAdmin ? (
                                        <Badge variant="secondary">Admin</Badge>
                                    ) : (
                                        <span className="text-xs text-muted-foreground">Membro</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button variant="ghost" size="icon">
                                                <MoreVertical className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="rounded-xl">
                                            {!p.isAdmin && (
                                                <DropdownMenuItem onClick={() => runAction("promote", [p.jid])}>
                                                    <ShieldCheck className="h-4 w-4 mr-2" /> Promover a admin
                                                </DropdownMenuItem>
                                            )}
                                            {p.isAdmin && !p.isSuperAdmin && (
                                                <DropdownMenuItem onClick={() => runAction("demote", [p.jid])}>
                                                    <ShieldOff className="h-4 w-4 mr-2" /> Rebaixar
                                                </DropdownMenuItem>
                                            )}
                                            <DropdownMenuItem
                                                className="text-destructive"
                                                onClick={() => setRemoveTarget(p.jid)}
                                            >
                                                <UserMinus className="h-4 w-4 mr-2" /> Remover
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={addOpen} onOpenChange={(isOpen) => !isOpen && setAddOpen(false)}>
                <DialogContent className="rounded-xl">
                    <DialogHeader>
                        <DialogTitle>Adicionar participantes</DialogTitle>
                    </DialogHeader>
                    <Textarea
                        value={addRaw}
                        onChange={(e) => setAddRaw(e.target.value)}
                        placeholder="Um número por linha"
                        rows={5}
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAddOpen(false)} disabled={addLoading}>
                            Cancelar
                        </Button>
                        <ButtonWithSpinner onClick={handleAddSubmit} loading={addLoading}>
                            Adicionar
                        </ButtonWithSpinner>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ConfirmationModal
                title="Remover participante"
                open={removeTarget !== null}
                onClose={() => setRemoveTarget(null)}
                onConfirm={() => {
                    if (removeTarget) runAction("remove", [removeTarget]);
                }}
            >
                Tem certeza que deseja remover este participante do grupo?
            </ConfirmationModal>
        </div>
    );
};

export default GroupParticipantsPanel;
