import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Plus, Pencil, Trash2, Loader2, KeyRound, Zap, CheckCircle2, XCircle, Sparkles } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";
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
    AiGatewayTestResult,
    createAiGateway,
    deleteAiGateway,
    listAiGateways,
    testAiGateway,
    updateAiGateway,
} from "../../../services/aiGatewayService";

const emptyForm: AiGatewayInput = {
    name: "",
    provider: "openai",
    apiKey: "",
    baseUrl: "",
    model: "",
    transcriptionModel: "",
    speechModel: "",
};

const AiGatewaysSection: React.FC = () => {
    const [gateways, setGateways] = useState<AiGateway[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<AiGateway | null>(null);
    const [form, setForm] = useState<AiGatewayInput>(emptyForm);
    const [deleteTarget, setDeleteTarget] = useState<AiGateway | null>(null);
    const [testingId, setTestingId] = useState<number | null>(null);
    const [testResult, setTestResult] = useState<{ gateway: AiGateway; result: AiGatewayTestResult } | null>(null);

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
            transcriptionModel: gateway.transcriptionModel ?? "",
            speechModel: gateway.speechModel ?? "",
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

    const handleTest = async (gateway: AiGateway) => {
        setTestingId(gateway.id);
        try {
            const result = await testAiGateway(gateway.id);
            setTestResult({ gateway, result });
            if (result.success) {
                toast.success(`Gateway "${gateway.name}" respondeu em ${result.elapsedMs}ms`);
            } else {
                toast.error(`Gateway "${gateway.name}" falhou no teste`);
            }
        } catch (err) {
            const message =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                "Erro ao testar gateway";
            setTestResult({ gateway, result: { success: false, error: message } });
            toast.error(message);
        } finally {
            setTestingId(null);
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
        <div className="space-y-6">
            <ConfirmationModal
                title="Remover gateway de IA"
                open={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleConfirmDelete}
            >
                Tem certeza que deseja remover o gateway "{deleteTarget?.name}"? Assistentes que o
                utilizam deixarão de funcionar até que você aponte para outro gateway.
            </ConfirmationModal>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-primary">
                            <Sparkles className="h-5 w-5" />
                            Agentes de IA
                        </CardTitle>
                        <CardDescription>
                            Provedores de IA usados pelos Assistentes (plugin "Assistentes de IA")
                        </CardDescription>
                    </div>
                    <Button onClick={openCreate}>
                        <Plus className="mr-2 h-4 w-4" />
                        Adicionar Gateway
                    </Button>
                </CardHeader>
                <CardContent>
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
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                title="Testar gateway"
                                                disabled={!gw.hasApiKey || testingId === gw.id}
                                                onClick={() => handleTest(gw)}
                                            >
                                                {testingId === gw.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Zap className="h-4 w-4" />
                                                )}
                                            </Button>
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
                </CardContent>
            </Card>

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
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col gap-1.5">
                                <Label>Modelo de transcrição (opcional)</Label>
                                <Input
                                    value={form.transcriptionModel ?? ""}
                                    onChange={(e) => setForm((f) => ({ ...f, transcriptionModel: e.target.value }))}
                                    placeholder="whisper-1"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Áudio → texto. Necessário para Assistants com "Entende áudio" ligado.
                                </p>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <Label>Modelo de fala (opcional)</Label>
                                <Input
                                    value={form.speechModel ?? ""}
                                    onChange={(e) => setForm((f) => ({ ...f, speechModel: e.target.value }))}
                                    placeholder="tts-1"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Texto → áudio. Necessário para Assistants com "Responde com áudio" ligado.
                                </p>
                            </div>
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

            <Dialog open={!!testResult} onOpenChange={(open) => !open && setTestResult(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {testResult?.result.success ? (
                                <CheckCircle2 className="h-5 w-5 text-green-500" />
                            ) : (
                                <XCircle className="h-5 w-5 text-destructive" />
                            )}
                            Teste — {testResult?.gateway.name}
                        </DialogTitle>
                    </DialogHeader>
                    {testResult?.result.success ? (
                        <div className="flex flex-col gap-2">
                            <p className="text-sm text-muted-foreground">
                                Resposta do modelo ({testResult.result.elapsedMs}ms):
                            </p>
                            <p className="rounded-lg border bg-muted/40 p-3 text-sm whitespace-pre-wrap">
                                {testResult.result.reply}
                            </p>
                        </div>
                    ) : (
                        <p className="text-sm text-destructive whitespace-pre-wrap">
                            {testResult?.result.error ?? "Falha desconhecida"}
                        </p>
                    )}
                    <DialogFooter>
                        <Button onClick={() => setTestResult(null)}>Fechar</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AiGatewaysSection;
