import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { Plus, Search, Users, Megaphone, Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { listGroups, GroupInfo } from "../../../services/groupService";
import { useGroupsConnection } from "../../Groups/hooks/useGroups";
import { classifyGroupsApiError, GroupsApiError } from "../../Groups/groupTypes";
import GroupsErrorState from "../../Groups/GroupsErrorState";
import CreateGroupDialog from "../../Groups/CreateGroupDialog";

const GruposTab: React.FC = () => {
    const navigate = useNavigate();
    const { whatsapps, whatsappId, setWhatsappId, loadingConnections } = useGroupsConnection();
    const [groups, setGroups] = useState<GroupInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState<GroupsApiError | null>(null);
    const [search, setSearch] = useState("");
    const [createOpen, setCreateOpen] = useState(false);

    const fetchGroups = useCallback(async () => {
        if (!whatsappId) return;
        setLoading(true);
        setApiError(null);
        try {
            setGroups(await listGroups(whatsappId));
        } catch (err) {
            setApiError(classifyGroupsApiError(err));
        } finally {
            setLoading(false);
        }
    }, [whatsappId]);

    useEffect(() => {
        if (whatsappId) fetchGroups();
    }, [whatsappId, fetchGroups]);

    const filtered = groups.filter((g) => g.subject.toLowerCase().includes(search.toLowerCase()));
    const adminGroups = filtered.filter((g) => g.isConnectionAdmin);
    const memberGroups = filtered.filter((g) => !g.isConnectionAdmin);

    const renderGroupCard = (g: GroupInfo) => (
        <Card
            key={g.jid}
            className="rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)] cursor-pointer hover:shadow-[0px_6px_24px_rgba(0,0,0,0.12)] transition-shadow"
            onClick={() => navigate(`/groups/${encodeURIComponent(g.jid)}`)}
        >
            <CardContent className="p-4 flex items-start gap-3">
                <Avatar size="lg" src={g.pictureURL} name={g.subject} isGroup />
                <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{g.subject}</p>
                    <p className="text-xs text-muted-foreground">
                        {g.participants.length} participante{g.participants.length === 1 ? "" : "s"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {g.isCommunity && <Badge variant="secondary">Comunidade</Badge>}
                        {g.isSubGroup && <Badge variant="outline">Subgrupo</Badge>}
                        {g.announce && (
                            <Badge variant="outline" className="gap-1">
                                <Megaphone className="h-3 w-3" /> Somente admins
                            </Badge>
                        )}
                        {g.locked && (
                            <Badge variant="outline" className="gap-1">
                                <Lock className="h-3 w-3" /> Bloqueado
                            </Badge>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    );

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
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar grupo..."
                        className="pl-8 w-[220px]"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button onClick={() => setCreateOpen(true)} disabled={!whatsappId} className="ml-auto gap-2">
                    <Plus className="h-4 w-4" />
                    Criar grupo
                </Button>
            </div>

            {loadingConnections ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-28 rounded-2xl" />
                    ))}
                </div>
            ) : whatsapps.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-4 h-full text-center px-6 py-16">
                    <h3 className="text-lg font-semibold">Nenhuma conexão disponível</h3>
                    <p className="text-sm text-muted-foreground max-w-md">
                        Conecte um número de WhatsApp para gerenciar grupos.
                    </p>
                    <Button onClick={() => navigate("/connections")}>Ir para Conexões</Button>
                </div>
            ) : apiError ? (
                <GroupsErrorState error={apiError} />
            ) : loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <Skeleton key={i} className="h-28 rounded-2xl" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 h-full text-center px-6 py-16">
                    <Users className="h-8 w-8 text-muted-foreground" />
                    <h3 className="text-base font-medium">Nenhum grupo encontrado</h3>
                </div>
            ) : (
                <Tabs defaultValue="admin">
                    <TabsList>
                        <TabsTrigger value="admin" className="gap-1.5">
                            <ShieldCheck className="h-4 w-4" />
                            Você é admin
                            <Badge variant="secondary">{adminGroups.length}</Badge>
                        </TabsTrigger>
                        <TabsTrigger value="member" className="gap-1.5">
                            <Users className="h-4 w-4" />
                            Você participa
                            <Badge variant="secondary">{memberGroups.length}</Badge>
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="admin">
                        {adminGroups.length === 0 ? (
                            <p className="text-sm text-muted-foreground px-1 py-8 text-center">
                                Nenhum grupo em que esta conexão é administradora.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                                {adminGroups.map(renderGroupCard)}
                            </div>
                        )}
                    </TabsContent>
                    <TabsContent value="member">
                        {memberGroups.length === 0 ? (
                            <p className="text-sm text-muted-foreground px-1 py-8 text-center">
                                Nenhum grupo em que esta conexão é só participante.
                            </p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-4">
                                {memberGroups.map(renderGroupCard)}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            )}

            {whatsappId && (
                <CreateGroupDialog
                    open={createOpen}
                    whatsappId={whatsappId}
                    onClose={() => setCreateOpen(false)}
                    onCreated={() => {
                        setCreateOpen(false);
                        toast.success("Grupo criado com sucesso!");
                        fetchGroups();
                    }}
                />
            )}
        </div>
    );
};

export default GruposTab;
