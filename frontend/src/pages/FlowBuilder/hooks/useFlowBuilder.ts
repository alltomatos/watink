import { useState, useRef } from 'react';
import { useParams } from 'react-router';

import { useFlowEditor } from './useFlowEditor';
import { useFlowNodes } from './useFlowNodes';
import { useFlowEdges } from './useFlowEdges';
import { useFlowPersistence } from './useFlowPersistence';
import { useFlowIO } from './useFlowIO';

export function useFlowBuilder() {
    const { flowId } = useParams<{ flowId: string }>();
    const reactFlowWrapper = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [reactFlowInstance, setReactFlowInstance] = useState<unknown>(null);

    const editor = useFlowEditor();

    const flowNodes = useFlowNodes({
        reactFlowInstance,
        onEditorOpen: editor.openEditor,
        onEditorClose: editor.closeEditor,
    });

    const flowEdges = useFlowEdges();

    const persistence = useFlowPersistence({
        flowId,
        nodes: flowNodes.nodes,
        edges: flowEdges.edges,
        hydrateNodes: flowNodes.hydrateNodes,
        setNodes: flowNodes.setNodes,
        setEdges: flowEdges.setEdges,
    });

    const io = useFlowIO({
        flowId,
        nodes: flowNodes.nodes,
        edges: flowEdges.edges,
        setNodes: flowNodes.setNodes,
        setEdges: flowEdges.setEdges,
        fileInputRef,
    });

    return {
        flowId,
        navigate: persistence.navigate,
        reactFlowWrapper,
        fileInputRef,
        // nodes
        nodes: flowNodes.nodes,
        onNodesChange: flowNodes.onNodesChange,
        handleNodeDelete: flowNodes.handleNodeDelete,
        handleNodeConfigSave: flowNodes.handleNodeConfigSave,
        onNodeClick: flowNodes.onNodeClick,
        onDragOver: flowNodes.onDragOver,
        onDrop: flowNodes.onDrop,
        // edges
        edges: flowEdges.edges,
        onEdgesChange: flowEdges.onEdgesChange,
        onConnect: flowEdges.onConnect,
        // reactflow instance
        reactFlowInstance,
        setReactFlowInstance,
        // persistence / meta
        loading: persistence.loading,
        saving: persistence.saving,
        flowName: persistence.flowName,
        isActive: persistence.isActive,
        aiEnabled: persistence.aiEnabled,
        isChatOpen: persistence.isChatOpen,
        setIsChatOpen: persistence.setIsChatOpen,
        whatsappId: persistence.whatsappId,
        setWhatsappId: persistence.setWhatsappId,
        connections: persistence.connections,
        handleSave: persistence.handleSave,
        handleToggle: persistence.handleToggle,
        validateFlow: persistence.validateFlow,
        // editor UI state
        selectedNode: editor.selectedNode,
        isEditorOpen: editor.isEditorOpen,
        isSimulatorOpen: editor.isSimulatorOpen,
        setIsSimulatorOpen: editor.setIsSimulatorOpen,
        isNodesSidebarOpen: editor.isNodesSidebarOpen,
        setIsNodesSidebarOpen: editor.setIsNodesSidebarOpen,
        handleCloseEditor: editor.closeEditor,
        // IO
        handleExport: io.handleExport,
        handleImport: io.handleImport,
        handleSimulate: io.handleSimulate,
        handleAIResponse: io.handleAIResponse,
    };
}
