import React, { useState } from "react";
import { toast } from "react-toastify";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import ButtonWithSpinner from "@/components/ButtonWithSpinner";
import { createGroup } from "../../services/groupService";
import { classifyGroupsApiError } from "./groupTypes";

interface CreateGroupDialogProps {
    open: boolean;
    whatsappId: number;
    onClose: () => void;
    onCreated: () => void;
}

const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({ open, whatsappId, onClose, onCreated }) => {
    const [subject, setSubject] = useState("");
    const [participantsRaw, setParticipantsRaw] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        if (!subject.trim()) {
            toast.error("Informe o nome do grupo");
            return;
        }
        const participants = participantsRaw
            .split(/[\n,]/)
            .map((p) => p.trim())
            .filter(Boolean);
        setLoading(true);
        try {
            await createGroup(whatsappId, subject.trim(), participants);
            setSubject("");
            setParticipantsRaw("");
            onCreated();
        } catch (err) {
            toast.error(classifyGroupsApiError(err).message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DialogContent className="rounded-xl">
                <DialogHeader>
                    <DialogTitle>Criar grupo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                        <Label htmlFor="group-subject">Nome do grupo</Label>
                        <Input
                            id="group-subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            placeholder="Ex.: Time de Vendas"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="group-participants">Participantes (opcional)</Label>
                        <Textarea
                            id="group-participants"
                            value={participantsRaw}
                            onChange={(e) => setParticipantsRaw(e.target.value)}
                            placeholder="Um número por linha, ex.: 5511999999999"
                            rows={4}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={loading}>
                        Cancelar
                    </Button>
                    <ButtonWithSpinner onClick={handleSubmit} loading={loading}>
                        Criar
                    </ButtonWithSpinner>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CreateGroupDialog;
