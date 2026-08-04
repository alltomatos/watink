import { useState, useEffect } from "react";
import notify from "@/lib/notify";
import api from "../../../services/api";
import { timeToMinutes } from "../activityHelpers";
import {
  Activity, ChecklistItem, Material, Occurrence, NewOccurrence,
} from "../activityTypes";

export interface UseActivityExecutionReturn {
  loading: boolean;
  activity: Activity | null;
  items: ChecklistItem[];
  materials: Material[];
  occurrences: Occurrence[];
  materialModalOpen: boolean;
  occurrenceModalOpen: boolean;
  signatureModalOpen: boolean;
  newMaterial: Omit<Material, "id" | "activityId">;
  newOccurrence: NewOccurrence;
  setMaterialModalOpen: (v: boolean) => void;
  setOccurrenceModalOpen: (v: boolean) => void;
  setSignatureModalOpen: (v: boolean) => void;
  setNewMaterial: React.Dispatch<React.SetStateAction<Omit<Material, "id" | "activityId">>>;
  setNewOccurrence: React.Dispatch<React.SetStateAction<NewOccurrence>>;
  handleItemChange: (item: ChecklistItem, field: string, value: unknown) => Promise<void>;
  handleFileUpload: (item: ChecklistItem, file: File) => Promise<void>;
  handleAddMaterial: () => Promise<void>;
  handleDeleteMaterial: (id: number) => Promise<void>;
  handleAddOccurrence: () => Promise<void>;
  handleDeleteOccurrence: (id: number) => Promise<void>;
  handleFinish: (signatureDataUrl: string) => Promise<void>;
}

const DEFAULT_MATERIAL: Omit<Material, "id" | "activityId"> = {
  materialName: "", quantity: 1, unit: "un", isBillable: false, notes: "",
};

const DEFAULT_OCCURRENCE: NewOccurrence = {
  description: "", type: "info", timeImpact: "",
};

export const useActivityExecution = (
  open: boolean,
  activityId: string,
  onClose: () => void,
): UseActivityExecutionReturn => {
  const [loading, setLoading] = useState(false);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [occurrences, setOccurrences] = useState<Occurrence[]>([]);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [occurrenceModalOpen, setOccurrenceModalOpen] = useState(false);
  const [signatureModalOpen, setSignatureModalOpen] = useState(false);
  const [newMaterial, setNewMaterial] = useState<Omit<Material, "id" | "activityId">>(DEFAULT_MATERIAL);
  const [newOccurrence, setNewOccurrence] = useState<NewOccurrence>(DEFAULT_OCCURRENCE);

  useEffect(() => {
    if (!open || !activityId) return;
    const load = async () => {
      try {
        setLoading(true);
        const { data } = await api.get<Activity>(`/activities/${activityId}`);
        setActivity(data);
        setItems(data.items ?? []);
        setMaterials(data.materials ?? []);
        setOccurrences(data.occurrences ?? []);
      } catch (err) {
        notify.error(err);
        onClose();
      } finally {
        setLoading(false);
      }
    };
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activityId]);

  const handleItemChange = async (item: ChecklistItem, field: string, value: unknown) => {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, [field]: value } : i)));
    if (field === "isDone" || field === "value") {
      try {
        await api.put(`/activities/${activityId}/items/${item.id}`, { [field]: value });
      } catch (err) {
        notify.error(err);
      }
    }
  };

  const handleFileUpload = async (item: ChecklistItem, file: File) => {
    const formData = new FormData();
    formData.append("photo", file);
    try {
      const { data } = await api.post<{ photoUrl: string }>(
        `/activities/${activityId}/items/${item.id}/photo`,
        formData,
      );
      await handleItemChange(item, "value", data.photoUrl);
    } catch (err) {
      notify.error(err);
    }
  };

  const handleAddMaterial = async () => {
    if (!newMaterial.materialName.trim()) return;
    try {
      const { data } = await api.post<Material>(`/activities/${activityId}/materials`, {
        materialName: newMaterial.materialName.trim(),
        quantity: newMaterial.quantity,
        unit: newMaterial.unit,
        isBillable: newMaterial.isBillable,
        notes: newMaterial.notes,
      });
      setMaterials((prev) => [...prev, data]);
      setMaterialModalOpen(false);
      setNewMaterial(DEFAULT_MATERIAL);
      notify.success("Material adicionado");
    } catch (err) {
      notify.error(err);
    }
  };

  const handleDeleteMaterial = async (id: number) => {
    try {
      await api.delete(`/activities/${activityId}/materials/${id}`);
      setMaterials((prev) => prev.filter((m) => m.id !== id));
    } catch (err) {
      notify.error(err);
    }
  };

  const handleAddOccurrence = async () => {
    if (!newOccurrence.description.trim()) return;
    try {
      const { data } = await api.post<Occurrence>(`/activities/${activityId}/occurrences`, {
        description: newOccurrence.description.trim(),
        type: newOccurrence.type,
        timeImpact: timeToMinutes(newOccurrence.timeImpact),
      });
      setOccurrences((prev) => [...prev, data]);
      setOccurrenceModalOpen(false);
      setNewOccurrence(DEFAULT_OCCURRENCE);
      notify.success("Ocorrência registrada");
    } catch (err) {
      notify.error(err);
    }
  };

  const handleDeleteOccurrence = async (id: number) => {
    try {
      await api.delete(`/activities/${activityId}/occurrences/${id}`);
      setOccurrences((prev) => prev.filter((o) => o.id !== id));
    } catch (err) {
      notify.error(err);
    }
  };

  const handleFinish = async (signatureDataUrl: string) => {
    try {
      await api.post(`/activities/${activityId}/finalize`, { clientSignature: signatureDataUrl });
      notify.success("Atividade concluída com sucesso!");
      setSignatureModalOpen(false);
      onClose();
    } catch (err) {
      notify.error(err);
    }
  };

  return {
    loading, activity, items, materials, occurrences,
    materialModalOpen, occurrenceModalOpen, signatureModalOpen,
    newMaterial, newOccurrence,
    setMaterialModalOpen, setOccurrenceModalOpen, setSignatureModalOpen,
    setNewMaterial, setNewOccurrence,
    handleItemChange, handleFileUpload,
    handleAddMaterial, handleDeleteMaterial,
    handleAddOccurrence, handleDeleteOccurrence,
    handleFinish,
  };
};
