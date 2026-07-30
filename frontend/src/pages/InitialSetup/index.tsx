import React, { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import api from "../../services/api";

interface SetupData {
  companyName: string;
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  document: string;
  backendUrl: string;
}

const InitialSetup: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [setupData, setSetupData] = useState<SetupData>({
    companyName: "",
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    document: "",
    backendUrl:
      typeof window !== "undefined" ? window.location.origin : "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSetupData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !setupData.companyName ||
      !setupData.firstName ||
      !setupData.email ||
      !setupData.password
    ) {
      toast.error("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    if (setupData.password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    setLoading(true);
    try {
      // Email normalizado (lowercase + trim) para casar com o login — o backend
      // também normaliza; isto é só paridade de UX.
      await api.post("/initial-setup", {
        ...setupData,
        email: setupData.email.trim().toLowerCase(),
      });
      toast.success("Sistema inicializado com sucesso!");
      navigate("/login");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error || "Erro ao inicializar sistema.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{
        background:
          "linear-gradient(135deg, var(--bg-surface-alt) 0%, var(--border-default) 100%)",
      }}
    >
      <div className="w-full max-w-lg">
        <div
          className="flex flex-col items-center rounded-[20px] p-12"
          style={{
            boxShadow: "0 10px 25px var(--shadow-appbar)",
            backgroundColor: "var(--overlay-strong)",
          }}
        >
          <img
            src="/logo.png"
            alt="Watink Premium"
            className="mb-8 w-[280px]"
            onError={(e) => {
              const t = e.currentTarget;
              t.onerror = null;
              t.src = "https://watink.com/logo.png";
            }}
          />
          <h1
            className="mb-6 text-xl font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            Configuração Inicial
          </h1>

          <form className="w-full space-y-4" noValidate onSubmit={handleSubmit}>
            <div className="space-y-1">
              <Label htmlFor="companyName">Nome Fantasia da Empresa *</Label>
              <Input
                id="companyName"
                name="companyName"
                value={setupData.companyName}
                onChange={handleChange}
                autoFocus
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="firstName">Nome *</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  value={setupData.firstName}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="lastName">Sobrenome</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  value={setupData.lastName}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="email">E-mail (Super Admin) *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={setupData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="password">Senha *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                value={setupData.password}
                onChange={handleChange}
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="document">CPF/CNPJ (Opcional)</Label>
              <Input
                id="document"
                name="document"
                value={setupData.document}
                onChange={handleChange}
              />
            </div>

            <Button
              type="submit"
              className="mt-2 w-full rounded-xl py-6 text-base font-bold"
              disabled={loading}
            >
              {loading ? "Inicializando ambiente..." : "Concluir e Iniciar"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default InitialSetup;
