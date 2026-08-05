export interface HistoryEntry {
  id: string;
  action: string;
  comment?: string;
  changes?: string;
  createdAt: string;
  user?: { name: string };
}

export interface CompanyInfo {
  systemLogo?: string;
  companyTradeName?: string;
  companyLegalName?: string;
  companyDocument?: string;
  companyAddressStreet?: string;
  companyAddressNumber?: string;
  companyAddressComplement?: string;
  companyAddressNeighborhood?: string;
  companyAddressCity?: string;
  companyAddressState?: string;
  companyAddressZip?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
}

export interface Protocol {
  protocolNumber: string;
  status: string;
  priority: string;
  subject: string;
  description?: string;
  category?: string;
  createdAt: string;
  tenant?: { name: string };
  company?: CompanyInfo;
  history: HistoryEntry[];
}
