import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import api from "../../../services/api";

export interface Contact {
  id: number;
  name: string;
}

export interface ProtocolFormData {
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  contactId: number | null;
}

const DEFAULT_CATEGORIES = ["Incidente", "Requisição de Serviço", "Problema", "Mudança"];

const initialFormData: ProtocolFormData = {
  subject: "",
  description: "",
  status: "open",
  priority: "medium",
  category: "",
  contactId: null,
};

export function useProtocolModal(
  open: boolean,
  onClose: () => void,
  initialContactId?: number,
  initialContactName?: string,
  initialTicketId?: number,
  onSuccess?: () => void
) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<ProtocolFormData>(initialFormData);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [contactOptions, setContactOptions] = useState<Contact[]>([]);
  const [contactLoading, setContactLoading] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [helpdeskEnabled, setHelpdeskEnabled] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get("/settings");
        const settingsData = Array.isArray(data) ? data : [];

        const enabledSetting = settingsData.find(
          (s: { key: string; value: string }) => s.key === "helpdesk_settings_enabled"
        );
        const isEnabled = enabledSetting?.value === "true";
        setHelpdeskEnabled(isEnabled);

        if (isEnabled) {
          const categoriesSetting = settingsData.find(
            (s: { key: string; value: string }) => s.key === "helpdesk_categories"
          );
          if (categoriesSetting) {
            try {
              setCategories(JSON.parse(categoriesSetting.value));
            } catch {
              setCategories(DEFAULT_CATEGORIES);
            }
          } else {
            setCategories(DEFAULT_CATEGORIES);
          }
        }
      } catch (err) {
        console.error("Error fetching settings", err);
      }
    };
    fetchSettings();
  }, [open]);

  useEffect(() => {
    if (!open) {
      setFormData(initialFormData);
      setSelectedContact(null);
      setContactSearch("");
      setContactOptions([]);
      return;
    }
    if (initialContactId && initialContactName) {
      setFormData((prev) => ({ ...prev, contactId: initialContactId }));
      setSelectedContact({ id: initialContactId, name: initialContactName });
      setContactSearch(initialContactName);
    }
  }, [open, initialContactId, initialContactName]);

  useEffect(() => {
    if (!contactSearch || contactSearch.length < 3) {
      setContactLoading(false);
      return;
    }

    const timer = setTimeout(async () => {
      setContactLoading(true);
      try {
        const { data } = await api.get("contacts", {
          params: { searchParam: contactSearch },
        });
        setContactOptions(data.contacts);
      } catch {
        toast.error("Erro ao buscar contatos");
      } finally {
        setContactLoading(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [contactSearch]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof ProtocolFormData) => (value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleContactSearch = (value: string) => {
    setContactSearch(value);
    if (selectedContact && value !== selectedContact.name) {
      setSelectedContact(null);
      setFormData((prev) => ({ ...prev, contactId: null }));
    }
  };

  const handleContactSelect = (contact: Contact) => {
    setSelectedContact(contact);
    setFormData((prev) => ({ ...prev, contactId: contact.id }));
    setContactSearch(contact.name);
    setContactOptions([]);
  };

  const handleSubmit = async () => {
    if (!formData.subject.trim()) {
      toast.error("Assunto é obrigatório");
      return;
    }
    if (!formData.contactId) {
      toast.error("Contato é obrigatório");
      return;
    }

    try {
      setLoading(true);
      await api.post("/protocols", { ...formData, ticketId: initialTicketId });
      toast.success("Protocolo criado com sucesso");
      onSuccess?.();
      onClose();
    } catch {
      toast.error("Erro ao criar protocolo");
    } finally {
      setLoading(false);
    }
  };

  return {
    loading,
    formData,
    selectedContact,
    contactOptions,
    contactLoading,
    contactSearch,
    helpdeskEnabled,
    categories,
    handleChange,
    handleSelectChange,
    handleContactSearch,
    handleContactSelect,
    handleSubmit,
  };
}
