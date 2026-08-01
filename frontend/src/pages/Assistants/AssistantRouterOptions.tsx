import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Assistant,
    AssistantRouterOption,
    createRouterOption,
    deleteRouterOption,
    listAssistants,
    listRouterOptions,
    updateRouterOption,
} from "../../services/assistantService";

interface Props {
    assistantId: number;
}

const AssistantRouterOptions: React.FC<Props> = ({ assistantId }) => {
    const [options, setOptions] = useState<AssistantRouterOption[]>([]);
    const [candidates, setCandidates] = useState<Assistant[]>([]);
    const [label, setLabel] = useState("");
    const [targetAssistantId, setTargetAssistantId] = useState("");

    const load = async () => {
        try {
            const [opts, all] = await Promise.all([
                listRouterOptions(assistantId),
                listAssistants(),
            ]);
            setOptions(opts);
            setCandidates(all.filter((a) => a.id !== assistantId));
        } catch {
            toast.error("Erro ao carregar opções do menu");
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [assistantId]);

    const handleAdd = async () => {
        if (!label.trim() || !targetAssistantId) {
            toast.error("Preencha o rótulo e o assistente de destino");
            return;
        }
        try {
            await createRouterOption(assistantId, {
                label,
                order: options.length,
                targetAssistantId: Number(targetAssistantId),
            });
            setLabel("");
            setTargetAssistantId("");
            load();
        } catch (err) {
            const message =
                (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
                "Erro ao adicionar opção";
            toast.error(message);
        }
    };

    const handleRemove = async (optionId: number) => {
        try {
            await deleteRouterOption(assistantId, optionId);
            load();
        } catch {
            toast.error("Erro ao remover opção");
        }
    };

    const handleReorderLabel = async (option: AssistantRouterOption, value: string) => {
        try {
            await updateRouterOption(assistantId, option.id, {
                label: value,
                order: option.order,
                targetAssistantId: option.targetAssistantId,
            });
            load();
        } catch {
            toast.error("Erro ao atualizar opção");
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <Label>Opções do menu</Label>
            {options.length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma opção cadastrada ainda.</p>
            )}
            {options.map((option) => (
                <div key={option.id} className="flex items-center gap-2">
                    <Input
                        value={option.label}
                        onChange={(e) => handleReorderLabel(option, e.target.value)}
                        className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground min-w-[160px]">
                        →{" "}
                        {candidates.find((c) => c.id === option.targetAssistantId)?.name ??
                            `Assistant #${option.targetAssistantId}`}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => handleRemove(option.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                </div>
            ))}

            <div className="flex items-center gap-2 border-t pt-3">
                <Input
                    placeholder="Rótulo (ex: Suporte)"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="flex-1"
                />
                <Select value={targetAssistantId} onValueChange={setTargetAssistantId}>
                    <SelectTrigger className="w-[220px]">
                        <SelectValue placeholder="Assistente de destino" />
                    </SelectTrigger>
                    <SelectContent>
                        {candidates.map((a) => (
                            <SelectItem key={a.id} value={String(a.id)}>
                                {a.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleAdd}>
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar
                </Button>
            </div>
        </div>
    );
};

export default AssistantRouterOptions;
