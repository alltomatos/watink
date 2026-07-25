/* @jsxImportSource react */
import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { Puzzle, Loader2 } from "lucide-react";

import { AuthContext } from "../../context/Auth/AuthContext";
import { Can } from "../../components/Can";
import { Button } from "../../components/ui/button";
import {
  PageLayout,
  PageHeader,
  PageContent,
} from "../../components/ui/page-layout";
import AISettings from "./components/AISettings";
import StorageSection from "./components/StorageSection";
import AboutSection from "./components/AboutSection";
import ProxySection from "./components/ProxySection";
import AddressLookupSettings from "./components/AddressLookupSettings";

import { useSettings } from "./hooks/useSettings";
import GeneralSection from "./components/GeneralSection";
import PersonalizationSection from "./components/PersonalizationSection";
import SMTPSection from "./components/SMTPSection";
import PAPISection from "./components/PAPISection";
import HelpdeskSection from "./components/HelpdeskSection";
import SettingsSideNav from "./components/SettingsSideNav";

const Settings: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [activeSection, setActiveSection] = useState("general");

  const {
    activePlugins,
    loading,
    slaConfig,
    newCategory,
    helpdeskCategories,
    setNewCategory,
    getSettingValue,
    handleUpdateSetting,
    handleImageUpload,
    handleLanguageChange,
    handleUpdateSla,
    handleAddCategory,
    handleRemoveCategory,
  } = useSettings();

  const sharedProps = { getSettingValue, handleUpdateSetting };
  const isSuperAdmin = (user as unknown as { alcance?: string })?.alcance === "plataforma";

  return (
    <PageLayout>
      <PageHeader title="Configurações do Sistema">
        <div className="flex gap-2">
          <Can
            user={user}
            perform="settings:update"
            yes={() => (
              <Button variant="ghost" onClick={() => navigate("/admin/settings/marketplace")}>
                <Puzzle className="mr-2 h-4 w-4" />
                Marketplace de Plugins
              </Button>
            )}
          />
        </div>
      </PageHeader>

      <PageContent className="flex flex-col md:flex-row gap-8 items-start">
        <SettingsSideNav
          activeSection={activeSection}
          activePlugins={activePlugins}
          onSelect={setActiveSection}
          isSuperAdmin={isSuperAdmin}
        />

        <div className="flex-1 min-w-0 w-full">
          {loading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {activeSection === "general" && (
                <GeneralSection {...sharedProps} handleLanguageChange={handleLanguageChange} />
              )}
              {activeSection === "personalization" && (
                <PersonalizationSection {...sharedProps} handleImageUpload={handleImageUpload} />
              )}
              {activeSection === "smtp" && activePlugins.includes("smtp") && (
                <SMTPSection {...sharedProps} />
              )}
              {activeSection === "papi" && activePlugins.includes("engine-papi") && (
                <PAPISection {...sharedProps} />
              )}
              {activeSection === "helpdesk" && activePlugins.includes("helpdesk") && (
                <HelpdeskSection
                  {...sharedProps}
                  slaConfig={slaConfig}
                  handleUpdateSla={handleUpdateSla}
                  newCategory={newCategory}
                  setNewCategory={setNewCategory}
                  helpdeskCategories={helpdeskCategories}
                  handleAddCategory={handleAddCategory}
                  handleRemoveCategory={handleRemoveCategory}
                />
              )}
              {activeSection === "ai" && (
                <AISettings {...sharedProps} />
              )}
              {activeSection === "address" && (
                <AddressLookupSettings {...sharedProps} />
              )}
              {activeSection === "proxy" && (
                <ProxySection />
              )}
              {activeSection === "storage" && isSuperAdmin && (
                <StorageSection />
              )}
              {activeSection === "about" && (
                <AboutSection />
              )}
            </>
          )}
        </div>
      </PageContent>
    </PageLayout>
  );
};

export default Settings;
