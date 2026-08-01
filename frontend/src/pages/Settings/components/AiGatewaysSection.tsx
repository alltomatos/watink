import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Plus, Pencil, Trash2, Loader2, KeyRound } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "../../../components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "../../../components/ui/table";
import ConfirmationModal from "../../../components/ConfirmationModal";

import {
    AiGateway,
    AiGatewayInput,
    createAiGateway,
    deleteAiGateway,
    listAiGateways,
    updateAiGateway,
} from "../../../services/aiGatewayService";

const emptyForm: AiGatewayInput = { name: "", provider: "openai", apiKey: "", baseUrl: "", model: "" };

const AiGatewaysSection: React.FC = () => {
    const [gateways, setGateways] = useState<AiGateway[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<AiGateway | null>(null);
    const [form, setForm] = useState<AiGatewayInput>(emptyForm);
    const [deleteTarget, setDeleteTarget] = useState<AiGateway | null>(null);

    const fetchGateways = useCallback(async () => {
        setLoading(true);
        try {
            setGateways(await listAiGateways());
        } catch {
            toast.error("Erro ao carregar gateways de IA");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchGateways();
    }, [fetchGateways]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setFormOpen(true);
    };

    const openEdit = (gateway: AiGateway) => {
        setEditing(gateway);
        setForm({
            name: gateway.name,
            provider: gateway.provider,
            apiKey: "",
            baseUrl: gateway.baseUrl ?? "",
            model: gateway.model,
        });
        setFormOpen(true);
    };

    const handleSave = async () => {
        if (!form.name.trim() || !form.provider.trim() || !form.model.trim()) {
            toast.error("Preencha nome, provedor e modelo");
            return;
        }
        setSaving(true);
        try {
            if (editing) {
                await updateAiGateway(editing.id, form);
                toast.success("Gateway de IA atualizado!");
            } else {
                await createAiGateway(form);
                toast.success("Gateway de IA criado!");
            }
            setFormOpen(false);
            fetchGateways();
        } catch (err) {
            const message =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                "Erro ao salvar gateway de IA";
            toast.error(message);
        } finally {
            setSaving(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteAiGateway(deleteTarget.id);
            toast.success("Gateway de IA removido!");
            fetchGateways();
        } catch {
            toast.error("Erro ao remover gateway de IA");
        } finally {
            setDeleteTarget(null);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <ConfirmationModal
                title="Remover gateway de IA"
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleConfirmDelete}
            >
                Tem certeza que deseja remover o gateway "{deleteTarget?.name}"? Assistentes que o
                utilizam deixarão de funcionar até que você aponte para outro gateway.
            </ConfirmationModal>

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold">Agentes de IA</h2>
                    <p className="text-sm text-muted-foreground">
                        Provedores de IA usados pelos Assistentes (plugin "Assistentes de IA")
                    </p>
                </div>
                <Button onClick={openCreate}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Gateway
                </Button>
            </div>

            {loading ? (
                <div className="flex h-32 items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : gateways.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3 border rounded-2xl">
                    <KeyRound className="h-8 w-8 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                        Nenhum gateway de IA cadastrado ainda.
                    </p>
                </div>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Nome</TableHead>
                            <TableHead>Provedor</TableHead>
                            <TableHead>Modelo</TableHead>
                            <TableHead>Chave</TableHead>
                            <TableHead className="w-[100px]" />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {gateways.map((gw) => (
                            <TableRow key={gw.id}>
                                <TableCell className="font-medium">{gw.name}</TableCell>
                                <TableCell>{gw.provider}</TableCell>
                                <TableCell>{gw.model}</TableCell>
                                <TableCell>
                                    <Badge variant={gw.hasApiKey ? "default" : "secondary"}>
                                        {gw.hasApiKey ? "Configurada" : "Sem chave"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="flex gap-1 justify-end">
                                    <Button variant="ghost" size="icon" onClick={() => openEdit(gw)}>
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(gw)}>
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}

            <Dialog open={formOpen} onOpenChange={setFormOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing ? "Editar Gateway de IA" : "Novo Gateway de IA"}</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>Nome</Label>
                            <Input
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                                placeholder="Ex: OpenAI principal"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <Label>Provedor</Label>
                                <Input
                                    value={form.provider}
                                    onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value }))}
                                    placeholder="openai, anthropic..."
                                />
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Modelo</Label>
                                <Input
                                    value={form.model}
                                    onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                                    placeholder="gpt-4o"
                                />
                            </div>
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>Base URL (opcional)</Label>
                            <Input
                                value={form.baseUrl ?? ""}
                                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                                placeholder="https://api.openai.com/v1"
                            />
                        </div>
                        <div className="flex flex-col gap-1.5">
                            <Label>
                                API Key {editing && <span className="text-muted-foreground">(deixe em branco para manter a atual)</span>}
                            </Label>
                            <Input
                                type="password"
                                value={form.apiKey ?? ""}
                                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                                placeholder={editing?.hasApiKey ? "••••••••" : "sk-..."}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setFormOpen(false)}>
                            Cancelar
                        </Button>
                        <Button onClick={handleSave} disabled={saving}>
                            {saving ? "Salvando..." : "Salvar"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AiGatewaysSection;
