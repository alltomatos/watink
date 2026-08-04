import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { Plus, Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import ButtonWithSpinner from "@/components/ButtonWithSpinner";
import { Avatar } from "@/components/ui/avatar";
import { listCommunities, createCommunity, GroupInfo } from "../../../services/groupService";
import { useGroupsConnection } from "../../Groups/hooks/useGroups";
import { classifyGroupsApiError, GroupsApiError } from "../../Groups/groupTypes";
import GroupsErrorState from "../../Groups/GroupsErrorState";

const ComunidadesTab: React.FC = () => {
    const navigate = useNavigate();
    const { whatsapps, whatsappId, setWhatsappId, loadingConnections } = useGroupsConnection();
    const [communities, setCommunities] = useState<GroupInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState<GroupsApiError | null>(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState("");
    const [creating, setCreating] = useState(false);

    const fetchCommunities = useCallback(async () => {
        if (!whatsappId) return;
        setLoading(true);
        setApiError(null);
        try {
            setCommunities(await listCommunities(whatsappId));
        } catch (err) {
            setApiError(classifyGroupsApiError(err));
        } finally {
            setLoading(false);
        }
    }, [whatsappId]);

    useEffect(() => {
        if (whatsappId) fetchCommunities();
    }, [whatsappId, fetchCommunities]);

    const handleCreate = async () => {
        if (!whatsappId || !name.trim()) return;
        setCreating(true);
        try {
            await createCommunity(whatsappId, name.trim());
            toast.success("Comunidade criada!");
            setCreateOpen(false);
            setName("");
            fetchCommunities();
        } catch (err) {
            toast.error(classifyGroupsApiError(err).message);
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 flex-wrap">
                <Select
                    value={whatsappId ? String(whatsappId) : ""}
                    onValueChange={(v) => setWhatsappId(Number(v))}
                >
                    <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Selecione a conexão" />
                    </SelectTrigger>
                    <SelectContent>
                        {whatsapps.map((w) => (
                            <SelectItem key={w.id} value={String(w.id)}>
                                {w.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button onClick={() => setCreateOpen(true)} disabled={!whatsappId} className="ml-auto gap-2">
                    <Plus className="h-4 w-4" />
                    Criar comunidade
                </Button>
            </div>

            {loadingConnections ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-2xl" />
                    ))}
                </div>
            ) : whatsapps.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 h-full text-center px-6 py-16">
                    <h3 className="text-lg font-semibold">Nenhuma conexão disponível</h3>
                    <Button onClick={() => navigate("/connections")}>Ir para Conexões</Button>
                </div>
            ) : apiError ? (
                <GroupsErrorState error={apiError} />
            ) : loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-24 rounded-2xl" />
                    ))}
                </div>
            ) : communities.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 h-full text-center px-6 py-16">
                    <Network className="h-8 w-8 text-muted-foreground" />
                    <h3 className="text-base font-medium">Nenhuma comunidade encontrada</h3>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {communities.map((c) => (
                        <Card
                            key={c.jid}
                            className="rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)] cursor-pointer hover:shadow-[0px_6px_24px_rgba(0,0,0,0.12)] transition-shadow"
                            onClick={() => navigate(`/communities/${encodeURIComponent(c.jid)}`)}
                        >
                            <CardContent className="p-4 flex items-center gap-3">
                                <Avatar size="lg" src={c.pictureURL} name={c.subject} isGroup />
                                <div className="min-w-0">
                                    <p className="font-medium truncate">{c.subject}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {c.participants.length} participante(s)
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            <Dialog open={createOpen} onOpenChange={(isOpen) => !isOpen && setCreateOpen(false)}>
                <DialogContent className="rounded-xl">
                    <DialogHeader>
                        <DialogTitle>Criar comunidade</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-1.5 py-2">
                        <Label htmlFor="community-name">Nome da comunidade</Label>
                        <Input id="community-name" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={creating}>
                            Cancelar
                        </Button>
                        <ButtonWithSpinner onClick={handleCreate} loading={creating}>
                            Criar
                        </ButtonWithSpinner>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default ComunidadesTab;
