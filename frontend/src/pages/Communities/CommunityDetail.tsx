import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import { ArrowLeft, Link2, Unlink, Plus } from "lucide-react";
import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmationModal from "@/components/ConfirmationModal";
import { CommunityInfo, getCommunity, unlinkCommunityGroup } from "../../services/groupService";
import { useGroupsConnection } from "../Groups/hooks/useGroups";
import { classifyGroupsApiError, GroupsApiError } from "../Groups/groupTypes";
import GroupsErrorState from "../Groups/GroupsErrorState";
import LinkGroupDialog from "./LinkGroupDialog";

const CommunityDetail: React.FC = () => {
    const { jid } = useParams<{ jid: string }>();
    const navigate = useNavigate();
    const { whatsappId } = useGroupsConnection();
    const [community, setCommunity] = useState<CommunityInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState<GroupsApiError | null>(null);
    const [linkOpen, setLinkOpen] = useState(false);
    const [unlinkTarget, setUnlinkTarget] = useState<string | null>(null);

    const decodedJid = jid ? decodeURIComponent(jid) : "";

    const fetchCommunity = useCallback(async () => {
        if (!whatsappId || !decodedJid) return;
        setLoading(true);
        setApiError(null);
        try {
            setCommunity(await getCommunity(whatsappId, decodedJid));
        } catch (err) {
            setApiError(classifyGroupsApiError(err));
        } finally {
            setLoading(false);
        }
    }, [whatsappId, decodedJid]);

    useEffect(() => {
        fetchCommunity();
    }, [fetchCommunity]);

    const handleUnlink = async () => {
        if (!whatsappId || !unlinkTarget) return;
        try {
            await unlinkCommunityGroup(whatsappId, decodedJid, unlinkTarget);
            toast.success("Grupo desvinculado");
            fetchCommunity();
        } catch (err) {
            toast.error(classifyGroupsApiError(err).message);
        } finally {
            setUnlinkTarget(null);
        }
    };

    return (
        <PageContainer>
            <PageHeader title={community?.subject || "Comunidade"}>
                <Button variant="outline" size="icon" onClick={() => navigate("/grupos-whatsapp/comunidades")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                {community && (
                    <Button onClick={() => setLinkOpen(true)}>
                        <Plus className="h-4 w-4 mr-2" />
                        Vincular grupo
                    </Button>
                )}
            </PageHeader>
            <PageContent className="p-6">
                {loading ? (
                    <div className="space-y-3 max-w-2xl">
                        {[...Array(3)].map((_, i) => (
                            <Skeleton key={i} className="h-16 rounded-2xl" />
                        ))}
                    </div>
                ) : apiError ? (
                    <GroupsErrorState error={apiError} />
                ) : !community || !whatsappId ? null : community.linkedGroups.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 h-full text-center px-6 py-16">
                        <Link2 className="h-8 w-8 text-muted-foreground" />
                        <h3 className="text-base font-medium">Nenhum subgrupo vinculado</h3>
                    </div>
                ) : (
                    <div className="space-y-3 max-w-2xl">
                        {community.linkedGroups.map((g) => (
                            <Card key={g.jid} className="rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)]">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <span className="font-medium truncate">{g.subject}</span>
                                    <Button variant="outline" size="sm" onClick={() => setUnlinkTarget(g.jid)}>
                                        <Unlink className="h-4 w-4 mr-2" />
                                        Desvincular
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </PageContent>
            {whatsappId && community && (
                <LinkGroupDialog
                    open={linkOpen}
                    whatsappId={whatsappId}
                    communityJid={community.jid}
                    alreadyLinkedJids={community.linkedGroups.map((g) => g.jid)}
                    onClose={() => setLinkOpen(false)}
                    onLinked={() => {
                        setLinkOpen(false);
                        fetchCommunity();
                    }}
                />
            )}
            <ConfirmationModal
                title="Desvincular grupo"
                open={unlinkTarget !== null}
                onClose={() => setUnlinkTarget(null)}
                onConfirm={handleUnlink}
            >
                Tem certeza que deseja desvincular este grupo da comunidade?
            </ConfirmationModal>
        </PageContainer>
    );
};

export default CommunityDetail;
