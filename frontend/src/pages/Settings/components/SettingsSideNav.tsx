import React from "react";
import { useNavigate } from "react-router-dom";
import { SettingsIcon, Palette, Mail, Globe, Headphones, Brain, Library, HardDrive, Network, MapPin, Info } from "lucide-react";
import { Button } from "../../../components/ui/button";

interface SettingsSideNavProps {
  activeSection: string;
  activePlugins: string[];
  onSelect: (section: string) => void;
  isSuperAdmin?: boolean;
}

const SettingsSideNav: React.FC<SettingsSideNavProps> = ({ activeSection, activePlugins, onSelect, isSuperAdmin }) => {
  const navigate = useNavigate();

  const item = (section: string, Icon: React.ElementType, label: string, condition = true) =>
    condition ? (
      <Button
        key={section}
        variant={activeSection === section ? "secondary" : "ghost"}
        className="w-full justify-start text-left"
        onClick={() => onSelect(section)}
      >
        <Icon className="mr-2 h-4 w-4" />
        {label}
      </Button>
    ) : null;

  return (
    <aside className="w-full md:w-64 space-y-2 border p-3 rounded-lg bg-card">
      {item("general", SettingsIcon, "Geral")}
      {item("personalization", Palette, "Personalização")}
      {item("smtp", Mail, "E-mail SMTP", activePlugins.includes("smtp"))}
      {item("papi", Globe, "Gateway PAPI", activePlugins.includes("engine-papi"))}
      {item("helpdesk", Headphones, "Helpdesk Atendimento", activePlugins.includes("helpdesk"))}
      {item("ai", Brain, "Agente de IA")}
      {item("address", MapPin, "Endereço (CEP)")}
      {item("proxy", Network, "Proxy")}
      {item("storage", HardDrive, "Armazenamento", !!isSuperAdmin)}
      {item("about", Info, "Sobre")}

      <Button
        variant="ghost"
        className="w-full justify-start text-left"
        onClick={() => navigate("/knowledge-bases")}
      >
        <Library className="mr-2 h-4 w-4" />
        Base de Conhecimento
      </Button>
    </aside>
  );
};

export default SettingsSideNav;
