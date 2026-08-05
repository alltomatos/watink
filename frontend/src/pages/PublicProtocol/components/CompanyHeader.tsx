/* @jsxImportSource react */
import React from "react";
import { MapPin, Phone, Mail, Globe } from "lucide-react";
import { i18n } from "../../../translate/i18n";
import type { CompanyInfo } from "../publicProtocolTypes";

interface CompanyHeaderProps {
  tenantName?: string;
  company?: CompanyInfo;
}

// Cabeçalho da página pública de protocolo: logo + identidade + endereço/
// contato cadastrados em Configurações > Empresa. Campos ausentes (tenant
// não preencheu ainda) simplesmente não renderizam — nada de placeholder.
const CompanyHeader: React.FC<CompanyHeaderProps> = ({ tenantName, company }) => {
  const displayName =
    company?.companyTradeName || tenantName || String(i18n.t("publicProtocol.defaultTenant"));

  const addressParts = [
    company?.companyAddressStreet && company?.companyAddressNumber
      ? `${company.companyAddressStreet}, ${company.companyAddressNumber}`
      : company?.companyAddressStreet,
    company?.companyAddressComplement,
    company?.companyAddressNeighborhood,
    company?.companyAddressCity && company?.companyAddressState
      ? `${company.companyAddressCity}/${company.companyAddressState}`
      : company?.companyAddressCity,
    company?.companyAddressZip,
  ].filter(Boolean);
  const address = addressParts.join(" — ");

  return (
    <div className="flex flex-col items-center gap-3 text-center">
      {company?.systemLogo && (
        <img
          src={company.systemLogo}
          alt={displayName}
          className="h-14 max-w-[220px] object-contain"
        />
      )}
      <p className="text-2xl font-bold text-primary">{displayName}</p>

      {(address || company?.companyPhone || company?.companyEmail || company?.companyWebsite) && (
        <div className="flex flex-col items-center gap-1 text-sm text-muted-foreground">
          {address && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0" />
              {address}
            </span>
          )}
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
            {company?.companyPhone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5 shrink-0" />
                {company.companyPhone}
              </span>
            )}
            {company?.companyEmail && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                {company.companyEmail}
              </span>
            )}
            {company?.companyWebsite && (
              <a
                href={company.companyWebsite}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 hover:text-primary hover:underline"
              >
                <Globe className="h-3.5 w-3.5 shrink-0" />
                {company.companyWebsite}
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CompanyHeader;
