import React, { useState } from "react";
import { toast } from "react-toastify";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import ButtonWithSpinner from "@/components/ButtonWithSpinner";
import { GroupInfo, GroupSettingsPatch, updateGroupSettings } from "../../services/groupService";
import { classifyGroupsApiError } from "./groupTypes";

interface GroupSettingsPanelProps {
    whatsappId: number;
    group: GroupInfo;
    onChanged: () => void;
}

const GroupSettingsPanel: React.FC<GroupSettingsPanelProps> = ({ whatsappId, group, onChanged }) => {
    const [subject, setSubject] = useState(group.subject);
    const [description, setDescription] = useState(group.description);
    const [announce, setAnnounce] = useState(group.announce);
    const [locked, setLocked] = useState(group.locked);
    const [joinApprovalMode] = useState(group.joinApprovalMode);
    const [memberAddMode, setMemberAddMode] = useState(group.memberAddMode || "admin_add");
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        const patch: GroupSettingsPatch = {};
        if (subject !== group.subject) patch.subject = subject;
        if (description !== group.description) patch.description = description;
        if (announce !== group.announce) patch.announce = announce;
        if (locked !== group.locked) patch.locked = locked;
        if (memberAddMode !== group.memberAddMode) patch.memberAddMode = memberAddMode;
        if (Object.keys(patch).length === 0) {
            toast.info("Nenhuma alteração para salvar");
            return;
        }
        setSaving(true);
        try {
            await updateGroupSettings(whatsappId, group.jid, patch);
            toast.success("Configurações atualizadas!");
            onChanged();
        } catch (err) {
            toast.error(classifyGroupsApiError(err).message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="rounded-2xl bg-card shadow-[0px_4px_20px_rgba(0,0,0,0.08)] p-6 space-y-5 max-w-2xl">
            <div className="space-y-1.5">
                <Label htmlFor="settings-subject">Nome do grupo</Label>
                <Input id="settings-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
                <Label htmlFor="settings-description">Descrição</Label>
                <Textarea
                    id="settings-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                />
            </div>
            <div className="flex items-center justify-between">
                <div>
                    <Label htmlFor="settings-announce">Somente administradores enviam mensagens</Label>
                </div>
                <Switch id="settings-announce" checked={announce} onCheckedChange={setAnnounce} />
            </div>
            <div className="flex items-center justify-between">
                <div>
                    <Label htmlFor="settings-locked">Somente administradores editam informações do grupo</Label>
                </div>
                <Switch id="settings-locked" checked={locked} onCheckedChange={setLocked} />
            </div>
            {/* joinApprovalMode não tem rota própria no plugin ainda
                (domain.GroupEngine.SetJoinApprovalMode existe, mas
                internal/plugins/groups.go não expõe um endpoint dedicado —
                gap conhecido, registrado para follow-up; ver Solicitações
                para o fluxo de aprovação em si, que já funciona via
                join-requests). */}
            <div className="flex items-center justify-between opacity-60">
                <div>
                    <Label htmlFor="settings-join-approval">Aprovação de entrada por administrador</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Em breve — gerencie pela aba Solicitações por enquanto</p>
                </div>
                <Switch id="settings-join-approval" checked={joinApprovalMode} disabled />
            </div>
            <div className="space-y-1.5">
                <Label>Quem pode adicionar novos membros</Label>
                <Select value={memberAddMode} onValueChange={setMemberAddMode}>
                    <SelectTrigger className="w-[280px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="admin_add">Somente administradores</SelectItem>
                        <SelectItem value="all_member_add">Todos os membros</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex justify-end pt-2">
                <ButtonWithSpinner onClick={handleSave} loading={saving}>
                    Salvar alterações
                </ButtonWithSpinner>
            </div>
        </div>
    );
};

export default GroupSettingsPanel;
