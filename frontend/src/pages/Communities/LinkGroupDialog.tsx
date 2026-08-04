import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import ButtonWithSpinner from "@/components/ButtonWithSpinner";
import { GroupInfo, listGroups, linkCommunityGroup } from "../../services/groupService";
import { classifyGroupsApiError } from "../Groups/groupTypes";

interface LinkGroupDialogProps {
    open: boolean;
    whatsappId: number;
    communityJid: string;
    alreadyLinkedJids: string[];
    onClose: () => void;
    onLinked: () => void;
}

const LinkGroupDialog: React.FC<LinkGroupDialogProps> = ({
    open,
    whatsappId,
    communityJid,
    alreadyLinkedJids,
    onClose,
    onLinked,
}) => {
    const [groups, setGroups] = useState<GroupInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [linkingJid, setLinkingJid] = useState<string | null>(null);

    useEffect(() => {
        if (!open) return;
        let active = true;
        (async () => {
            setLoading(true);
            try {
                const all = await listGroups(whatsappId);
                if (active) {
                    setGroups(
                        all.filter((g) => g.jid !== communityJid && !g.isCommunity && !alreadyLinkedJids.includes(g.jid))
                    );
                }
            } catch (err) {
                toast.error(classifyGroupsApiError(err).message);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [open, whatsappId, communityJid, alreadyLinkedJids]);

    const handleLink = async (groupJid: string) => {
        setLinkingJid(groupJid);
        try {
            await linkCommunityGroup(whatsappId, communityJid, groupJid);
            toast.success("Grupo vinculado!");
            onLinked();
        } catch (err) {
            toast.error(classifyGroupsApiError(err).message);
        } finally {
            setLinkingJid(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="rounded-xl">
                <DialogHeader>
                    <DialogTitle>Vincular grupo</DialogTitle>
                </DialogHeader>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                    {loading ? (
                        [...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 rounded-md" />)
                    ) : groups.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">
                            Nenhum grupo elegível para vincular.
                        </p>
                    ) : (
                        groups.map((g) => (
                            <div key={g.jid} className="flex items-center justify-between gap-2 py-1">
                                <span className="text-sm truncate">{g.subject}</span>
                                <ButtonWithSpinner
                                    size="sm"
                                    variant="outline"
                                    loading={linkingJid === g.jid}
                                    onClick={() => handleLink(g.jid)}
                                >
                                    Vincular
                                </ButtonWithSpinner>
                            </div>
                        ))
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Fechar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default LinkGroupDialog;
