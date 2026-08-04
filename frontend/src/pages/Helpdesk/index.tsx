import React, { useContext } from "react";
import { useNavigate } from "react-router";
import { Plus, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";

import { Can } from "../../components/Can";
import { AuthContext } from "../../context/Auth/AuthContext";
import ProtocolModal from "./ProtocolModal";
import HelpdeskReports from "./HelpdeskReports";
import { useHelpdesk } from "./hooks/useHelpdesk";
import HelpdeskFilters from "./components/HelpdeskFilters";
import ProtocolsTable from "./components/ProtocolsTable";

const Helpdesk: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const {
    protocols,
    loading,
    filters,
    modalOpen,
    setSearchParam,
    setStatusFilter,
    setPriorityFilter,
    handleOpenModal,
    handleCloseModal,
    handleViewProtocol,
  } = useHelpdesk();

  return (
    <Can
      user={user}
      perform="tickets:read"
      yes={() => (
        <div className="mx-auto max-w-7xl p-6">
          <Tabs defaultValue="protocols" className="w-full">
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <h1 className="text-3xl font-bold tracking-tight">🎫 Helpdesk</h1>
              <TabsList>
                <TabsTrigger value="protocols">Protocolos</TabsTrigger>
                <TabsTrigger value="reports">Relatórios</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="protocols" className="mt-0 outline-none">
              <div className="mb-6 flex flex-col gap-4">
                <div className="flex justify-end gap-2">
                  <Button
                    variant="outline"
                    onClick={() => navigate("/helpdesk/kanban")}
                  >
                    <LayoutGrid className="mr-2 h-4 w-4" />
                    Ver Kanban
                  </Button>
                  <Can
                    user={user}
                    perform="tickets:create"
                    yes={() => (
                      <Button onClick={handleOpenModal}>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Protocolo
                      </Button>
                    )}
                  />
                </div>

                <HelpdeskFilters
                  filters={filters}
                  onSearchChange={setSearchParam}
                  onStatusChange={setStatusFilter}
                  onPriorityChange={setPriorityFilter}
                />
              </div>

              <div className="rounded-md border bg-card">
                <ProtocolsTable
                  protocols={protocols}
                  loading={loading}
                  user={user}
                  onViewProtocol={handleViewProtocol}
                />
              </div>
            </TabsContent>

            <TabsContent value="reports" className="mt-0 outline-none">
              <HelpdeskReports />
            </TabsContent>
          </Tabs>

          <ProtocolModal open={modalOpen} onClose={handleCloseModal} />
        </div>
      )}
      no={() => (
        <div className="flex h-full min-h-[50vh] items-center justify-center p-6">
          <h2 className="text-xl font-semibold text-muted-foreground">
            Você não tem permissão para visualizar esta página.
          </h2>
        </div>
      )}
    />
  );
};

export default Helpdesk;
