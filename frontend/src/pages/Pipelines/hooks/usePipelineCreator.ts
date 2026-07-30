import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import type { AxiosError } from "axios";
import api from "@/services/api";
import type { Pipeline } from "@/types/domain";
import {
    type PipelineFormData,
    type StageFormItem,
    type ChatMessage,
    INITIAL_FORM_DATA,
    INITIAL_CHAT_MESSAGE,
    getDefaultColorKey,
} from "../pipelineCreatorTypes";

export function usePipelineCreator() {
    const navigate = useNavigate();
    const { pipelineId } = useParams<{ pipelineId: string }>();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const [data, setData] = useState<PipelineFormData>(INITIAL_FORM_DATA);
    const [originalStages, setOriginalStages] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [aiEnabled, setAiEnabled] = useState(false);
    const [pendingSave, setPendingSave] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_CHAT_MESSAGE]);
    const [input, setInput] = useState("");
    const [aiLoading, setAiLoading] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data: settings } = await api.get("/settings");
                const aiEnabledSetting = settings.find(
                    (s: { key: string; value: string }) => s.key === "aiEnabled"
                );
                const aiPipelineSetting = settings.find(
                    (s: { key: string; value: string }) => s.key === "aiPipelineEnabled"
                );
                setAiEnabled(
                    aiEnabledSetting?.value === "true" && aiPipelineSetting?.value === "true"
                );
            } catch {
                // Ignore silent config errors
            }
        };

        const fetchPipeline = async () => {
            if (!pipelineId) return;
            try {
                const { data: pipelines } = await api.get("/pipelines");
                const pipeline = (pipelines as Pipeline[]).find(
                    (p) => p.id === Number(pipelineId)
                );
                if (pipeline) {
                    const names = pipeline.stages.map((s) => s.name);
                    setData({
                        name: pipeline.name,
                        description: pipeline.description ?? "",
                        type: pipeline.type ?? "kanban",
                        stages: pipeline.stages.map((s, i) => ({
                            name: s.name,
                            colorKey: getDefaultColorKey(i),
                        })),
                    });
                    setOriginalStages(names);
                    setMessages((prev) => [
                        ...prev,
                        {
                            role: "ai",
                            content: `Estou pronto para ajudar a editar o pipeline "${pipeline.name}".`,
                        },
                    ]);
                }
            } catch {
                toast.error("Erro ao carregar pipeline para edição");
            }
        };

        fetchSettings();
        fetchPipeline();
    }, [pipelineId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const removedStages = pipelineId
        ? originalStages.filter((s) => !data.stages.some((st) => st.name === s))
        : [];

    const handleSave = async () => {
        if (!data.name) {
            toast.error("O nome do pipeline é obrigatório");
            return;
        }
        if (pipelineId && removedStages.length > 0 && !pendingSave) {
            setPendingSave(true);
            return;
        }
        setPendingSave(false);
        setLoading(true);
        try {
            const payload = {
                ...data,
                stages: data.stages.map((s) => ({ name: s.name })),
            };
            if (pipelineId) {
                await api.put(`/pipelines/${pipelineId}`, payload);
                toast.success("Pipeline atualizado com sucesso!");
            } else {
                await api.post("/pipelines", payload);
                toast.success("Pipeline criado com sucesso!");
            }
            navigate("/pipelines");
        } catch {
            toast.error("Erro ao salvar pipeline");
        }
        setLoading(false);
    };

    const handleStageChange = (index: number, value: string) => {
        const newStages = [...data.stages];
        newStages[index] = { ...newStages[index], name: value };
        setData({ ...data, stages: newStages });
    };

    const handleStageColorChange = (index: number, colorKey: string) => {
        const newStages = [...data.stages];
        newStages[index] = { ...newStages[index], colorKey };
        setData({ ...data, stages: newStages });
    };

    const handleAddStage = () => {
        const newStage: StageFormItem = {
            name: "Nova Etapa",
            colorKey: getDefaultColorKey(data.stages.length),
        };
        setData({ ...data, stages: [...data.stages, newStage] });
    };

    const handleRemoveStage = (index: number) =>
        setData({ ...data, stages: data.stages.filter((_, i) => i !== index) });

    const handleMoveStage = (index: number, direction: "up" | "down") => {
        const targetIndex = direction === "up" ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= data.stages.length) return;
        const newStages = [...data.stages];
        [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
        setData({ ...data, stages: newStages });
    };

    const handleSendMessage = async () => {
        if (!input.trim()) return;

        const userMsg: ChatMessage = { role: "user", content: input };
        const newHistory = [...messages, userMsg];

        setMessages(newHistory);
        setInput("");
        setAiLoading(true);

        try {
            const apiMessages = newHistory.map((m) => ({
                role: m.role === "ai" ? "assistant" : m.role,
                content: m.content,
            }));

            const { data: aiData } = await api.post("/pipelines/ai-suggest", {
                messages: apiMessages,
            });

            if (aiData.message) {
                setMessages((prev) => [...prev, { role: "ai", content: aiData.message }]);
            }

            if (Array.isArray(aiData.stages) && aiData.stages.length > 0) {
                const newStages: StageFormItem[] = (aiData.stages as string[]).map(
                    (name, i) => ({ name, colorKey: getDefaultColorKey(i) })
                );
                setData((prev) => ({ ...prev, stages: newStages }));
                toast.success("Etapas geradas e aplicadas!");
            }
        } catch (err) {
            const axiosErr = err as AxiosError<{ error?: string }>;
            const errorMessage =
                axiosErr.response?.data?.error ?? axiosErr.message ?? "Erro desconhecido";
            let helpfulTip = "";
            if (
                errorMessage.includes("ERR_NO_AI_API_KEY") ||
                errorMessage.includes("ERR_AI_SERVICE_FAILED") ||
                axiosErr.response?.status === 400
            ) {
                helpfulTip =
                    "\n\nDica: Verifique em Configurações > Inteligência Artificial se a API Key, Modelo e Provedor estão corretos.";
            }
            setMessages((prev) => [
                ...prev,
                { role: "ai", content: `Ocorreu um erro: ${errorMessage}.${helpfulTip}` },
            ]);
        }
        setAiLoading(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    return {
        pipelineId,
        data,
        setData,
        loading,
        aiEnabled,
        messages,
        input,
        setInput,
        aiLoading,
        messagesEndRef,
        handleSave,
        handleStageChange,
        handleStageColorChange,
        handleAddStage,
        handleRemoveStage,
        handleMoveStage,
        handleSendMessage,
        handleKeyDown,
        navigate,
        pendingSave,
        setPendingSave,
        removedStages,
    };
}
