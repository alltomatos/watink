/* @jsxImportSource react */
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Cloud, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";

interface SaaSModeStatus {
  paired: boolean;
  pairedAt?: string | null;
  lastSyncAt?: string | null;
}

interface PrecheckResult {
  reachable: boolean;
  host: string;
  guidance?: string;
}

interface RegisterForm {
  name: string;
  email: string;
  whatsapp: string;
  document: string;
  password: string;
}

interface PairForm {
  baseUrl: string;
  instanceId: string;
  internalToken: string;
}

const EMPTY_FORM: RegisterForm = { name: "", email: "", whatsapp: "", document: "", password: "" };
const EMPTY_PAIR_FORM: PairForm = { baseUrl: "", instanceId: "", internalToken: "" };

// SaaSModeSection é o botão + página de registro do "Modo SaaS" em
// Configurações (issue #632): grava o pareamento com o Watink SaaS
// hospedado via /system/saas-mode/register (superadmin-only), depois de uma
// pré-checagem de saída HTTPS que orienta o usuário ANTES de preencher o
// formulário, não depois — requisito explícito do dono do produto para o
// caso de core atrás de firewall corporativo. Mesmo formato visual de
// StorageSection (Card + Badge "Conectado"/"Não configurado").
const SaaSModeSection: React.FC = () => {
  const [status, setStatus] = useState<SaaSModeStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [precheck, setPrecheck] = useState<PrecheckResult | null>(null);
  const [checkingConnectivity, setCheckingConnectivity] = useState(false);
  const [form, setForm] = useState<RegisterForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"register" | "pair">("register");
  const [pairForm, setPairForm] = useState<PairForm>(EMPTY_PAIR_FORM);
  const [pairing, setPairing] = useState(false);

  const loadStatus = () => {
    setLoading(true);
    api
      .get<SaaSModeStatus>("/system/saas-mode/status")
      .then(({ data }) => setStatus(data))
      .catch(toastError)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStatus();
  }, []);

  const runPrecheck = () => {
    setCheckingConnectivity(true);
    setPrecheck(null);
    api
      .get<PrecheckResult>("/system/saas-mode/precheck")
      .then(({ data }) => setPrecheck(data))
      .catch(toastError)
      .finally(() => setCheckingConnectivity(false));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    api
      .post("/system/saas-mode/register", form)
      .then(() => {
        toast.success("Instância registrada no Watink SaaS com sucesso.");
        setForm(EMPTY_FORM);
        loadStatus();
      })
      .catch(toastError)
      .finally(() => setSubmitting(false));
  };

  const handlePairSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPairing(true);
    api
      .post("/system/saas-mode/pair", pairForm)
      .then(() => {
        toast.success("Instância pareada com o Watink SaaS com sucesso.");
        setPairForm(EMPTY_PAIR_FORM);
        loadStatus();
      })
      .catch(toastError)
      .finally(() => setPairing(false));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Cloud className="h-5 w-5" />
          Modo SaaS
        </CardTitle>
        <CardDescription>
          Registra esta instância no Watink SaaS hospedado — controle de
          planos, faturamento e provisionamento passam a ser geridos de lá,
          sem você precisar rodar seu próprio Watink SaaS. A conexão é
          sempre iniciada por esta instância (nunca o contrário), então
          nenhuma porta de entrada precisa ser aberta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : status?.paired ? (
          <div className="flex flex-col gap-2">
            <Badge className="w-fit border-transparent bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-text))]">
              Conectado
            </Badge>
            {status.lastSyncAt ? (
              <p className="text-sm text-muted-foreground">
                Última sincronização: {new Date(status.lastSyncAt).toLocaleString("pt-BR")}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Pareado — aguardando a primeira sincronização.
              </p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <Badge className="w-fit border-transparent bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))]">
              Não configurado
            </Badge>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={runPrecheck}
                disabled={checkingConnectivity}
              >
                {checkingConnectivity ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Testar conectividade de saída
              </Button>
              {precheck && precheck.reachable && (
                <p className="flex items-center gap-2 text-sm text-[hsl(var(--status-success-text))]">
                  <ShieldCheck className="h-4 w-4" />
                  Conectividade de saída confirmada com {precheck.host}.
                </p>
              )}
              {precheck && !precheck.reachable && (
                <p className="flex items-start gap-2 text-sm text-[hsl(var(--status-warning-text))]">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {precheck.guidance}
                </p>
              )}
            </div>

            <div className="flex w-fit gap-1 rounded-lg bg-muted p-1">
              <Button
                type="button"
                size="sm"
                variant={mode === "register" ? "default" : "ghost"}
                onClick={() => setMode("register")}
              >
                Criar conta
              </Button>
              <Button
                type="button"
                size="sm"
                variant={mode === "pair" ? "default" : "ghost"}
                onClick={() => setMode("pair")}
              >
                Parear instância existente
              </Button>
            </div>

            {mode === "register" ? (
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-md">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="saas-mode-name">Nome</Label>
                  <Input
                    id="saas-mode-name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="saas-mode-email">E-mail</Label>
                  <Input
                    id="saas-mode-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="saas-mode-whatsapp">WhatsApp</Label>
                  <Input
                    id="saas-mode-whatsapp"
                    value={form.whatsapp}
                    onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="saas-mode-document">CPF/CNPJ</Label>
                  <Input
                    id="saas-mode-document"
                    value={form.document}
                    onChange={(e) => setForm({ ...form, document: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="saas-mode-password">Senha</Label>
                  <Input
                    id="saas-mode-password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    required
                    minLength={8}
                  />
                </div>
                <Button type="submit" disabled={submitting} className="w-fit">
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Registrar no Watink SaaS
                </Button>
              </form>
            ) : (
              <form onSubmit={handlePairSubmit} className="flex flex-col gap-4 max-w-md">
                <p className="text-sm text-muted-foreground">
                  Use quando você já tem uma conta no Watink SaaS e quer conectar esta
                  instância (ex.: on-premise atrás de NAT/firewall, sem URL pública) a
                  ela. Gere o pareamento no Console em Instâncias → "Parear nova
                  instância" e cole os dados abaixo.
                </p>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="saas-mode-pair-baseurl">Base URL do seu Watink SaaS</Label>
                  <Input
                    id="saas-mode-pair-baseurl"
                    type="url"
                    value={pairForm.baseUrl}
                    onChange={(e) => setPairForm({ ...pairForm, baseUrl: e.target.value })}
                    placeholder="https://saashomol.watink.com"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="saas-mode-pair-instanceid">Instance ID</Label>
                  <Input
                    id="saas-mode-pair-instanceid"
                    value={pairForm.instanceId}
                    onChange={(e) => setPairForm({ ...pairForm, instanceId: e.target.value })}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="saas-mode-pair-token">Token interno</Label>
                  <Input
                    id="saas-mode-pair-token"
                    type="password"
                    value={pairForm.internalToken}
                    onChange={(e) => setPairForm({ ...pairForm, internalToken: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" disabled={pairing} className="w-fit">
                  {pairing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Parear instância
                </Button>
              </form>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SaaSModeSection;
