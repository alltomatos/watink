import React from "react";
import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

const AdminDashboard = () => {
  return (
    <MainContainer>
      <MainHeader>
        <Title>Super Admin Dashboard</Title>
      </MainHeader>
      <div>
        <h2>Bem-vindo ao Painel do Super Admin</h2>
        <p>Gerenciamento de Tenants e Métricas do SaaS.</p>
      </div>
    </MainContainer>
  );
};

export default AdminDashboard;
