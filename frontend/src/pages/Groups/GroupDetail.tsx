import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import { ArrowLeft, LogOut } from "lucide-react";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfirmationModal from "@/components/ConfirmationModal";
import { GroupInfo, getGroup, leaveGroup } from "../../services/groupService";
import { useGroupsConnection } from "./hooks/useGroups";
import { classifyGroupsApiError, GroupsApiError } from "./groupTypes";
import GroupsErrorState from "./GroupsErrorState";
import GroupParticipantsPanel from "./GroupParticipantsPanel";
import GroupSettingsPanel from "./GroupSettingsPanel";
import GroupInviteCard from "./GroupInviteCard";
import JoinRequestsPanel from "./JoinRequestsPanel";

const GroupDetail: React.FC = () => {
    const { jid } = useParams<{ jid: string }>();
    const navigate = useNavigate();
    const { whatsappId } = useGroupsConnection();
    const [group, setGroup] = useState<GroupInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState<GroupsApiError | null>(null);
    const [confirmLeave, setConfirmLeave] = useState(false);

    const decodedJid = jid ? decodeURIComponent(jid) : "";

    const fetchGroup = useCallback(async () => {
        if (!whatsappId || !decodedJid) return;
        setLoading(true);
        setApiError(null);
        try {
            setGroup(await getGroup(whatsappId, decodedJid));
        } catch (err) {
            setApiError(classifyGroupsApiError(err));
        } finally {
            setLoading(false);
        }
    }, [whatsappId, decodedJid]);

    useEffect(() => {
        fetchGroup();
    }, [fetchGroup]);

    const handleLeave = async () => {
        if (!whatsappId) return;
        try {
            await leaveGroup(whatsappId, decodedJid);
            toast.success("Você saiu do grupo");
            navigate("/groups");
        } catch (err) {
            toast.error(classifyGroupsApiError(err).message);
        }
    };

    return (
        <PageLayout>
            <PageHeader
                title={group?.subject ?? "Grupo"}
                description={group ? `${group.participants.length} participante(s)` : undefined}
            >
                <Button variant="outline" size="icon" onClick={() => navigate("/groups")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                {group && (
                    <Button variant="outline" onClick={() => setConfirmLeave(true)}>
                        <LogOut className="h-4 w-4 mr-2" />
                        Sair do grupo
                    </Button>
                )}
            </PageHeader>
            <PageContent className="p-6">
                {loading ? (
                    <div className="space-y-4 max-w-2xl">
                        <Skeleton className="h-10 w-64" />
                        <Skeleton className="h-40" />
                    </div>
                ) : apiError ? (
                    <GroupsErrorState error={apiError} />
                ) : !group || !whatsappId ? null : (
                    <Tabs defaultValue="participants">
                        <TabsList>
                            <TabsTrigger value="participants">Participantes</TabsTrigger>
                            <TabsTrigger value="settings">Configurações</TabsTrigger>
                            <TabsTrigger value="invite">Convite</TabsTrigger>
                            <TabsTrigger value="requests">Solicitações</TabsTrigger>
                        </TabsList>
                        <TabsContent value="participants" className="pt-4">
                            <GroupParticipantsPanel whatsappId={whatsappId} group={group} onChanged={fetchGroup} />
                        </TabsContent>
                        <TabsContent value="settings" className="pt-4">
                            <GroupSettingsPanel whatsappId={whatsappId} group={group} onChanged={fetchGroup} />
                        </TabsContent>
                        <TabsContent value="invite" className="pt-4">
                            <GroupInviteCard whatsappId={whatsappId} groupJid={group.jid} />
                        </TabsContent>
                        <TabsContent value="requests" className="pt-4">
                            <JoinRequestsPanel whatsappId={whatsappId} groupJid={group.jid} />
                        </TabsContent>
                    </Tabs>
                )}
            </PageContent>
            <ConfirmationModal
                title="Sair do grupo"
                open={confirmLeave}
                onClose={() => setConfirmLeave(false)}
                onConfirm={handleLeave}
            >
                Tem certeza que deseja sair deste grupo? Você precisará ser adicionado novamente para voltar.
            </ConfirmationModal>
        </PageLayout>
    );
};

export default GroupDetail;
