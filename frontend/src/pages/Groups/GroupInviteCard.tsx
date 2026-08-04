import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Copy, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import ConfirmationModal from "@/components/ConfirmationModal";
import { getInviteLink, revokeInviteLink } from "../../services/groupService";
import { classifyGroupsApiError } from "./groupTypes";

interface GroupInviteCardProps {
    whatsappId: number;
    groupJid: string;
}

const GroupInviteCard: React.FC<GroupInviteCardProps> = ({ whatsappId, groupJid }) => {
    const [link, setLink] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirmRevoke, setConfirmRevoke] = useState(false);
    const [revoking, setRevoking] = useState(false);

    useEffect(() => {
        let active = true;
        (async () => {
            setLoading(true);
            try {
                const l = await getInviteLink(whatsappId, groupJid);
                if (active) setLink(l);
            } catch (err) {
                if (active) toast.error(classifyGroupsApiError(err).message);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [whatsappId, groupJid]);

    const handleCopy = () => {
        if (!link) return;
        navigator.clipboard.writeText(link);
        toast.success("Link copiado!");
    };

    const handleRevoke = async () => {
        setRevoking(true);
        try {
            const newLink = await revokeInviteLink(whatsappId, groupJid);
            setLink(newLink);
            toast.success("Link revogado — novo link gerado.");
        } catch (err) {
            toast.error(classifyGroupsApiError(err).message);
        } finally {
            setRevoking(false);
        }
    };

    return (
        <Card className="rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)] max-w-2xl">
            <CardContent className="p-6 space-y-4">
                <p className="font-medium">Link de convite</p>
                {loading ? (
                    <Skeleton className="h-10 w-full" />
                ) : (
                    <div className="flex gap-2">
                        <Input readOnly value={link ?? ""} className="font-mono text-sm" />
                        <Button variant="outline" size="icon" onClick={handleCopy} disabled={!link}>
                            <Copy className="h-4 w-4" />
                        </Button>
                    </div>
                )}
                <Button
                    variant="outline"
                    onClick={() => setConfirmRevoke(true)}
                    disabled={loading || revoking}
                >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Revogar e gerar novo
                </Button>
            </CardContent>
            <ConfirmationModal
                title="Revogar link de convite"
                open={confirmRevoke}
                onClose={() => setConfirmRevoke(false)}
                onConfirm={handleRevoke}
            >
                O link atual deixará de funcionar imediatamente e um novo será gerado. Esta ação não pode ser desfeita.
            </ConfirmationModal>
        </Card>
    );
};

export default GroupInviteCard;
