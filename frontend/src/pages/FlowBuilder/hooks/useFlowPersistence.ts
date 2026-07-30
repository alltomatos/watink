import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router';
import { getConnectedEdges } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import { toast } from 'react-toastify';

import api from '../../../services/api';
import toastError from '../../../errors/toastError';
import { stripLegacyDimensions } from '../flowBuilderTypes';

interface UseFlowPersistenceOptions {
    flowId: string | undefined;
    nodes: Node[];
    edges: Edge[];
    hydrateNodes: (rawNodes: Node[]) => Node[];
    setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void;
    setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void;
}

export function useFlowPersistence({
    flowId,
    nodes,
    edges,
    hydrateNodes,
    setNodes,
    setEdges,
}: UseFlowPersistenceOptions) {
    const navigate = useNavigate();
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [flowName, setFlowName] = useState('');
    const [isActive, setIsActive] = useState(false);
    const [aiEnabled, setAiEnabled] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    // Conexão atrelada ao fluxo (Flow.WhatsAppID). null = sem conexão. Controlada
    // pelo editor (toolbar) — fonte da verdade; pode ser definida depois ou trocada.
    const [whatsappId, setWhatsappId] = useState<number | null>(null);
    const [connections, setConnections] = useState<{ id: number; name: string }[]>([]);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const { data } = await api.get('/settings');
                const masterEnabled = data.find((s: { key: string; value: string }) => s.key === 'aiEnabled')?.value === 'true';
                const flowBuilderEnabled = data.find((s: { key: string; value: string }) => s.key === 'aiFlowBuilderEnabled')?.value === 'true';
                if (masterEnabled && flowBuilderEnabled) {
                    setAiEnabled(true);
                    setIsChatOpen(true);
                } else {
                    setAiEnabled(false);
                    setIsChatOpen(false);
                }
            } catch {
                console.error('Erro ao carregar configurações');
            }
        };
        fetchSettings();
        api.get('/whatsapp').then((r) => setConnections(r.data)).catch(() => {});
    }, []);

    useEffect(() => {
        const fetchFlow = async () => {
            try {
                const { data } = await api.get(`/flows/${flowId}`);
                setFlowName(data.name);
                setIsActive(data.active !== false);
                setWhatsappId(typeof data.whatsappId === 'number' ? data.whatsappId : null);

                if (Array.isArray(data.nodes)) {
                    setNodes(hydrateNodes(stripLegacyDimensions(data.nodes as Node[])));
                }
                if (Array.isArray(data.edges)) setEdges(data.edges as Edge[]);
                setLoading(false);
            } catch (err) {
                toastError(err);
                navigate('/flowbuilder');
            }
        };
        fetchFlow();
        // hydrateNodes is stable (useCallback with no deps that change), navigate is stable
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [flowId]);

    const handleSave = useCallback(async (silent = false) => {
        if (!silent) setSaving(true);
        try {
            await api.put(`/flows/${flowId}`, {
                name: flowName,
                nodes,
                edges,
                active: isActive,
                whatsappId,
            });
            if (!silent) toast.success('Fluxo salvo com sucesso');
        } catch (err) {
            if (!silent) toastError(err);
        } finally {
            if (!silent) setSaving(false);
        }
    }, [flowId, flowName, nodes, edges, isActive, whatsappId]);

    useEffect(() => {
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        if (loading) return;
        if (nodes.length === 0 && edges.length === 0) return;

        saveTimeoutRef.current = setTimeout(() => {
            handleSave(true);
        }, 5000);

        return () => clearTimeout(saveTimeoutRef.current ?? undefined);
    }, [nodes, edges, loading, handleSave]);

    const handleToggle = useCallback(async () => {
        const next = !isActive;
        setIsActive(next);
        try {
            await api.put(`/flows/${flowId}`, {
                name: flowName,
                nodes,
                edges,
                active: next,
                whatsappId,
            });
            toast.success(next ? 'Fluxo ativado' : 'Fluxo pausado');
        } catch (err) {
            setIsActive(!next);
            toastError(err);
        }
    }, [isActive, flowId, flowName, nodes, edges, whatsappId]);

    const validateFlow = useCallback(() => {
        const connectedEdges = getConnectedEdges(nodes, edges);
        const unconnectedNodes = nodes.filter(
            (node) => !connectedEdges.find((edge) => edge.source === node.id || edge.target === node.id)
        );
        if (unconnectedNodes.length > 0) {
            toast.warning(`Atenção: Existem ${unconnectedNodes.length} nós desconectados.`);
            return false;
        }
        toast.success('Fluxo validado! Todas as conexões parecem corretas.');
        return true;
    }, [nodes, edges]);

    return {
        navigate,
        loading,
        saving,
        flowName,
        setFlowName,
        isActive,
        aiEnabled,
        isChatOpen,
        setIsChatOpen,
        whatsappId,
        setWhatsappId,
        connections,
        handleSave,
        handleToggle,
        validateFlow,
    };
}
