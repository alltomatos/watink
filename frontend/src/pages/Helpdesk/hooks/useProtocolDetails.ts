import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router";
import { toast } from "react-toastify";
import api from "../../../services/api";
import type { Protocol, Attachment, HistoryItem, UpdateFormData } from "../protocolTypes";

export interface UseProtocolDetailsReturn {
  loading: boolean;
  saving: boolean;
  uploadingFiles: boolean;
  protocol: Protocol | null;
  history: HistoryItem[];
  attachments: Attachment[];
  newFiles: File[];
  updateFiles: File[];
  formData: UpdateFormData;
  setNewFiles: (files: File[]) => void;
  setUpdateFiles: (files: File[]) => void;
  handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  handleSelectChange: (name: keyof UpdateFormData) => (value: string) => void;
  handleUploadFiles: () => Promise<void>;
  handleDeleteAttachment: (attachmentId: number) => Promise<void>;
  handleSubmit: () => Promise<void>;
  handleCopyExternalLink: () => void;
  navigate: ReturnType<typeof useNavigate>;
}

export function useProtocolDetails(): UseProtocolDetailsReturn {
  const { protocolId } = useParams<{ protocolId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [protocol, setProtocol] = useState<Protocol | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [updateFiles, setUpdateFiles] = useState<File[]>([]);
  const [formData, setFormData] = useState<UpdateFormData>({
    status: "",
    priority: "",
    comment: "",
  });

  const loadProtocol = useCallback(async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/protocols/${protocolId}`);
      setProtocol(data);
      setHistory(data.history || []);
      setFormData({ status: data.status, priority: data.priority, comment: "" });
      const attachmentsRes = await api.get(`/protocols/${protocolId}/attachments`);
      setAttachments(attachmentsRes.data || []);
    } catch {
      toast.error("Erro ao carregar protocolo");
      navigate("/helpdesk");
    } finally {
      setLoading(false);
    }
  }, [protocolId, navigate]);

  useEffect(() => {
    loadProtocol();
  }, [loadProtocol]);

  const handleUploadFiles = async () => {
    if (newFiles.length === 0) return;
    setUploadingFiles(true);
    try {
      const fd = new FormData();
      newFiles.forEach((file) => fd.append("files", file));
      const { data } = await api.post(`/protocols/${protocolId}/attachments`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setAttachments((prev) => [...data, ...prev]);
      setNewFiles([]);
      toast.success("Arquivos enviados com sucesso!");
      loadProtocol();
    } catch {
      toast.error("Erro ao enviar arquivos");
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    try {
      await api.delete(`/protocols/${protocolId}/attachments/${attachmentId}`);
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      toast.success("Anexo removido");
    } catch {
      toast.error("Erro ao remover anexo");
    }
  };

  const handleSubmit = async () => {
    if (!protocol) return;
    try {
      setSaving(true);
      const fd = new FormData();
      fd.append("status", formData.status);
      fd.append("priority", formData.priority);
      if (formData.comment) fd.append("comment", formData.comment);
      fd.append("subject", protocol.subject);
      fd.append("description", protocol.description);
      if (protocol.category) fd.append("category", protocol.category);
      updateFiles.forEach((file) => fd.append("files", file));
      await api.put(`/protocols/${protocolId}`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Protocolo atualizado com sucesso");
      setFormData((prev) => ({ ...prev, comment: "" }));
      setUpdateFiles([]);
      loadProtocol();
    } catch {
      toast.error("Erro ao atualizar protocolo");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof UpdateFormData) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCopyExternalLink = () => {
    if (!protocol) return;
    const externalUrl = `${window.location.origin}/public/protocols/${protocol.token}`;
    navigator.clipboard
      .writeText(externalUrl)
      .then(() => toast.success("Link copiado para a área de transferência!"))
      .catch(() => toast.error("Erro ao copiar link"));
  };

  return {
    loading,
    saving,
    uploadingFiles,
    protocol,
    history,
    attachments,
    newFiles,
    updateFiles,
    formData,
    setNewFiles,
    setUpdateFiles,
    handleChange,
    handleSelectChange,
    handleUploadFiles,
    handleDeleteAttachment,
    handleSubmit,
    handleCopyExternalLink,
    navigate,
  };
}
