import React, { useState } from "react";
import { useNavigate } from "react-router";
import { MessageSquare, Plus } from "lucide-react";
import { i18n } from "../../translate/i18n";

import {
  PageLayout,
  PageHeader,
  PageContent,
} from "../../components/ui/page-layout";
import { Button } from "../../components/ui/button";
import ConfirmationModal from "../../components/ConfirmationModal";

import { useQuickAnswers } from "./hooks/useQuickAnswers";
import { QuickAnswersToolbar, type ViewMode } from "./components/QuickAnswersToolbar";
import { QuickAnswersTable } from "./components/QuickAnswersTable";

const QuickAnswers = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>("grid");

  const {
    quickAnswers,
    loading,
    searchParam,
    selectedQuickAnswer,
    confirmModalOpen,
    handleSearch,
    handleDeleteQuickAnswer,
    handleRequestDelete,
    handleCloseConfirmModal,
    handleScroll,
  } = useQuickAnswers();

  const handleEdit = (qa: { id: number }) => {
    navigate(`/quick-answers/${qa.id}/edit`);
  };

  return (
    <PageLayout>
      <ConfirmationModal
        title={
          selectedQuickAnswer
            ? `${i18n.t("quickAnswers.confirmationModal.deleteTitle")} ${selectedQuickAnswer.shortcut}?`
            : ""
        }
        open={confirmModalOpen}
        onClose={handleCloseConfirmModal}
        onConfirm={() =>
          selectedQuickAnswer && handleDeleteQuickAnswer(selectedQuickAnswer.id)
        }
      >
        {i18n.t("quickAnswers.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <PageHeader
        title={i18n.t("quickAnswers.title") as string}
        description="Gerencie suas respostas rápidas para agilizar o atendimento"
      >
        <QuickAnswersToolbar
          searchParam={searchParam}
          onSearch={handleSearch}
          onAdd={() => navigate("/quick-answers/new")}
          view={view}
          onViewChange={setView}
        />
      </PageHeader>

      <PageContent>
        {!loading && quickAnswers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Nenhuma resposta rápida criada
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Crie templates de mensagem para agilizar o atendimento
              </p>
            </div>
            <Button onClick={() => navigate("/quick-answers/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Criar Resposta Rápida
            </Button>
          </div>
        ) : (
          <QuickAnswersTable
            quickAnswers={quickAnswers}
            loading={loading}
            onEdit={handleEdit}
            onDelete={handleRequestDelete}
            onScroll={handleScroll}
            view={view}
          />
        )}
      </PageContent>
    </PageLayout>
  );
};

export default QuickAnswers;
