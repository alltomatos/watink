import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import { Flow, FlowApi, Whatsapp } from "../flowManagerTypes";

/** Maps the backend `active` field to the UI-facing `isActive`. */
const toFlow = (raw: FlowApi): Flow => ({
  id: raw.id,
  name: raw.name,
  isActive: raw.active === true,
  updatedAt: raw.updatedAt,
  whatsappId: raw.whatsappId,
  whatsapp: raw.whatsapp,
});

export function useFlowManager() {
  const navigate = useNavigate();
  const [flows, setFlows] = useState<Flow[]>([]);
  const [whatsapps, setWhatsapps] = useState<Whatsapp[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchParam, setSearchParam] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");

  // Modal state
  const [openModal, setOpenModal] = useState(false);
  const [selectedFlow, setSelectedFlow] = useState<Flow | null>(null);
  const [newFlowName, setNewFlowName] = useState("");
  const [selectedWhatsapp, setSelectedWhatsapp] = useState("");

  // Delete confirm state
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deletingFlow, setDeletingFlow] = useState<Flow | null>(null);

  useEffect(() => {
    fetchFlows();
    fetchWhatsapps();
  }, []);

  const fetchFlows = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/flows");
      setFlows(Array.isArray(data) ? (data as FlowApi[]).map(toFlow) : []);
    } finally {
      setLoading(false);
    }
  };

  const fetchWhatsapps = async () => {
    try {
      const { data } = await api.get("/whatsapp");
      setWhatsapps(Array.isArray(data) ? data : []);
    } catch (err) {
      toastError(err);
    }
  };

  const isConnectionUsed = (whatsappId: number) => {
    return flows.some((f) => f.whatsappId === whatsappId && f.isActive);
  };

  const handleOpenModal = (flow: Flow | null = null) => {
    setSelectedFlow(flow);
    setNewFlowName(flow ? flow.name : "");
    setSelectedWhatsapp(flow?.whatsappId ? String(flow.whatsappId) : "");
    setOpenModal(true);
  };

  const handleCloseModal = () => {
    setOpenModal(false);
    setSelectedFlow(null);
    setNewFlowName("");
    setSelectedWhatsapp("");
  };

  const handleSaveFlow = async () => {
    if (!newFlowName.trim()) {
      toast.error("O nome do fluxo é obrigatório");
      return;
    }
    try {
      if (selectedFlow) {
        await api.put(`/flows/${selectedFlow.id}`, {
          name: newFlowName,
          whatsappId: selectedWhatsapp ? Number(selectedWhatsapp) : null,
        });
        toast.success("Fluxo atualizado com sucesso");
        fetchFlows();
        handleCloseModal();
      } else {
        const { data } = await api.post("/flows", {
          name: newFlowName,
          whatsappId: selectedWhatsapp ? Number(selectedWhatsapp) : null,
          nodes: [
            {
              id: "1",
              position: { x: 250, y: 50 },
              data: { label: "Início do Fluxo" },
              type: "input",
            },
          ],
          edges: [],
        });
        toast.success("Fluxo criado com sucesso");
        handleCloseModal();
        navigate(`/flowbuilder/${data.id}`);
      }
    } catch (err) {
      toastError(err);
    }
  };

  const handleDeleteFlow = async () => {
    if (!deletingFlow) return;
    try {
      await api.delete(`/flows/${deletingFlow.id}`);
      toast.success("Fluxo removido com sucesso");
      fetchFlows();
      setConfirmModalOpen(false);
      setDeletingFlow(null);
    } catch (err) {
      toastError(err);
    }
  };

  const handleRequestDelete = (flow: Flow) => {
    setDeletingFlow(flow);
    setConfirmModalOpen(true);
  };

  const handleToggleActive = async (flow: Flow, active: boolean) => {
    try {
      await api.put(`/flows/${flow.id}`, { active });
      setFlows((prev) =>
        prev.map((f) => (f.id === flow.id ? { ...f, isActive: active } : f))
      );
      toast.success(active ? "Fluxo ativado" : "Fluxo desativado");
    } catch (err) {
      toastError(err);
    }
  };

  const filteredFlows = flows.filter((f) =>
    f.name.toLowerCase().includes(searchParam.toLowerCase())
  );

  return {
    flows,
    whatsapps,
    loading,
    searchParam,
    setSearchParam,
    view,
    setView,
    openModal,
    setOpenModal,
    selectedFlow,
    newFlowName,
    setNewFlowName,
    selectedWhatsapp,
    setSelectedWhatsapp,
    confirmModalOpen,
    setConfirmModalOpen,
    deletingFlow,
    filteredFlows,
    isConnectionUsed,
    handleOpenModal,
    handleCloseModal,
    handleSaveFlow,
    handleDeleteFlow,
    handleRequestDelete,
    handleToggleActive,
  };
}
