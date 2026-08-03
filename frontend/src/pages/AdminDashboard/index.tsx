import React from "react";
import { PageContainer } from "../../components/ui/page-layout";

const AdminDashboard: React.FC = () => {
  return (
    <PageContainer title="Super Admin Dashboard">
      <div className="p-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          Bem-vindo ao Painel do Super Admin
        </h2>
        <p className="text-sm text-[var(--muted-foreground)] mt-1">
          Gerenciamento de Tenants e Métricas do SaaS.
        </p>
      </div>
    </PageContainer>
  );
};

export default AdminDashboard;
