import React from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useProtocolModal } from "./hooks/useProtocolModal";
import { ProtocolContactSearch } from "./components/ProtocolContactSearch";
import { ProtocolPriorityCategory } from "./components/ProtocolPriorityCategory";

interface ProtocolModalProps {
  open: boolean;
  onClose: () => void;
  initialContactId?: number;
  initialContactName?: string;
  initialTicketId?: number;
  onSuccess?: () => void;
}

const ProtocolModal: React.FC<ProtocolModalProps> = ({
  open,
  onClose,
  initialContactId,
  initialContactName,
  initialTicketId,
  onSuccess,
}) => {
  const {
    loading,
    formData,
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
  } = useProtocolModal(open, onClose, initialContactId, initialContactName, initialTicketId, onSuccess);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>Novo Protocolo</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-2">
          <ProtocolContactSearch
            contactSearch={contactSearch}
            contactLoading={contactLoading}
            contactOptions={contactOptions}
            onSearch={handleContactSearch}
            onSelect={handleContactSelect}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modal-subject">
              Assunto <span className="text-destructive">*</span>
            </Label>
            <Input
              id="modal-subject"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Assunto do protocolo"
            />
          </div>

          <ProtocolPriorityCategory
            formData={formData}
            helpdeskEnabled={helpdeskEnabled}
            categories={categories}
            onSelectChange={handleSelectChange}
            onInputChange={handleChange}
          />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="modal-description">Descrição</Label>
            <Textarea
              id="modal-description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={4}
              placeholder="Descreva o problema ou solicitação..."
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Criar Protocolo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProtocolModal;
