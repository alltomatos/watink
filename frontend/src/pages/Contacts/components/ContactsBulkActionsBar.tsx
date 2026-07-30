import React from "react";
import { Trash2, X } from "lucide-react";

import { Button } from "../../../components/ui/button";
import { i18n } from "../../../translate/i18n";

interface ContactsBulkActionsBarProps {
  selectedCount: number;
  onDeleteSelected: () => void;
  onDeselectAll: () => void;
}

const ContactsBulkActionsBar: React.FC<ContactsBulkActionsBarProps> = ({
  selectedCount,
  onDeleteSelected,
  onDeselectAll,
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/50 px-4 py-2 mb-3">
      <span className="text-sm font-medium">
        {i18n.t("contacts.selection.selectedCount", { count: selectedCount })}
      </span>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onDeselectAll}>
          <X className="mr-2 h-4 w-4" />
          {i18n.t("contacts.buttons.deselectAll")}
        </Button>
        <Button variant="destructive" size="sm" onClick={onDeleteSelected}>
          <Trash2 className="mr-2 h-4 w-4" />
          {i18n.t("contacts.buttons.deleteSelected")}
        </Button>
      </div>
    </div>
  );
};

export default ContactsBulkActionsBar;
