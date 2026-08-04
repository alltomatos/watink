import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Check, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar } from "@/components/ui/avatar";
import { JoinRequestEntry, listJoinRequests, resolveJoinRequests } from "../../services/groupService";
import { classifyGroupsApiError } from "./groupTypes";

interface JoinRequestsPanelProps {
    whatsappId: number;
    groupJid: string;
}

const JoinRequestsPanel: React.FC<JoinRequestsPanelProps> = ({ whatsappId, groupJid }) => {
    const [requests, setRequests] = useState<JoinRequestEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [processingJid, setProcessingJid] = useState<string | null>(null);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            setRequests(await listJoinRequests(whatsappId, groupJid));
        } catch (err) {
            toast.error(classifyGroupsApiError(err).message);
        } finally {
            setLoading(false);
        }
    }, [whatsappId, groupJid]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const handleResolve = async (jid: string, action: "approve" | "reject") => {
        setProcessingJid(jid);
        try {
            await resolveJoinRequests(whatsappId, groupJid, action, [jid]);
            toast.success(action === "approve" ? "Solicitação aprovada" : "Solicitação rejeitada");
            fetchRequests();
        } catch (err) {
            toast.error(classifyGroupsApiError(err).message);
        } finally {
            setProcessingJid(null);
        }
    };

    if (loading) {
        return (
            <div className="space-y-2 max-w-2xl">
                {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-14 rounded-2xl" />
                ))}
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <p className="text-sm text-muted-foreground">Nenhuma solicitação pendente</p>
            </div>
        );
    }

    return (
        <div className="space-y-2 max-w-2xl">
            {requests.map((r) => (
                <Card key={r.jid} className="rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)]">
                    <CardContent className="p-4 flex items-center gap-3">
                        <Avatar size="sm" name={r.jid} />
                        <div className="flex-1 min-w-0">
                            <p className="truncate text-sm">{r.jid}</p>
                        </div>
                        <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleResolve(r.jid, "approve")}
                            disabled={processingJid === r.jid}
                        >
                            <Check className="h-4 w-4 text-[var(--status-success-text)]" />
                        </Button>
                        <Button
                            size="icon"
                            variant="outline"
                            onClick={() => handleResolve(r.jid, "reject")}
                            disabled={processingJid === r.jid}
                        >
                            <X className="h-4 w-4 text-[var(--status-error-text)]" />
                        </Button>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
};

export default JoinRequestsPanel;
