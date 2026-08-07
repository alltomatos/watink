import React from "react";
import { useParams, useNavigate, Navigate } from "react-router";
import { Users, Network, Bell, Megaphone } from "lucide-react";

import { PageContainer, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { GROUPS_WHATSAPP_TABS, type GroupsWhatsappTab } from "./groupsWhatsappTypes";
import GruposTab from "./components/GruposTab";
import ComunidadesTab from "./components/ComunidadesTab";
import MonitoramentoTab from "./components/MonitoramentoTab";
import CampanhasTab from "./components/CampanhasTab";

/**
 * Central "Grupos WhatsApp" — mesmo padrão da Central de Acessos
 * (src/pages/Acessos/index.tsx): substitui os 3 itens soltos no sidebar
 * (Grupos · Comunidades · Monitoramento) por uma única área com abas.
 *
 * Sub-rotas (/grupos-whatsapp/grupos, /comunidades, /monitoramento) em vez
 * de query param — permite voltar/avançar do navegador trocar de aba
 * corretamente. Rota-base /grupos-whatsapp redireciona para
 * /grupos-whatsapp/grupos (ver routes/index.tsx).
 */
const GroupsWhatsapp: React.FC = () => {
    const { tab } = useParams<{ tab: string }>();
    const navigate = useNavigate();

    const activeTab: GroupsWhatsappTab = GROUPS_WHATSAPP_TABS.includes(tab as GroupsWhatsappTab)
        ? (tab as GroupsWhatsappTab)
        : "grupos";

    if (tab && !GROUPS_WHATSAPP_TABS.includes(tab as GroupsWhatsappTab)) {
        return <Navigate to="/grupos-whatsapp/grupos" replace />;
    }

    return (
        <PageContainer>
            <PageHeader title="Grupos WhatsApp" description="Gestão de grupos, comunidades e monitoramento de frases" />
            <PageContent>
                <Tabs
                    value={activeTab}
                    onValueChange={(value) => navigate(`/grupos-whatsapp/${value}`)}
                    className="flex flex-col gap-4"
                >
                    <TabsList>
                        <TabsTrigger value="grupos" className="gap-1.5">
                            <Users className="h-4 w-4" />
                            Grupos
                        </TabsTrigger>
                        <TabsTrigger value="comunidades" className="gap-1.5">
                            <Network className="h-4 w-4" />
                            Comunidades
                        </TabsTrigger>
                        <TabsTrigger value="monitoramento" className="gap-1.5">
                            <Bell className="h-4 w-4" />
                            Monitoramento
                        </TabsTrigger>
                        <TabsTrigger value="campanhas" className="gap-1.5">
                            <Megaphone className="h-4 w-4" />
                            Campanhas
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="grupos">
                        <GruposTab />
                    </TabsContent>
                    <TabsContent value="comunidades">
                        <ComunidadesTab />
                    </TabsContent>
                    <TabsContent value="monitoramento">
                        <MonitoramentoTab />
                    </TabsContent>
                    <TabsContent value="campanhas">
                        <CampanhasTab />
                    </TabsContent>
                </Tabs>
            </PageContent>
        </PageContainer>
    );
};

export default GroupsWhatsapp;
