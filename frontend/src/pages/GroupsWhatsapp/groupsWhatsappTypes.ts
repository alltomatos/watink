// Central "Grupos WhatsApp" — mesmo padrão da Central de Acessos
// (src/pages/Acessos): uma página com PageHeader único e abas por
// sub-rota, em vez de 3 itens soltos no sidebar (Grupos · Comunidades ·
// Monitoramento).
export const GROUPS_WHATSAPP_TABS = ["grupos", "comunidades", "monitoramento", "campanhas"] as const;
export type GroupsWhatsappTab = (typeof GROUPS_WHATSAPP_TABS)[number];
