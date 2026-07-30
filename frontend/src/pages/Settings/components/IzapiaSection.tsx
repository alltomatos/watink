import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { Zap, Loader2 } from "lucide-react";

import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";

interface IzapiaConfigResponse {
  baseUrl: string;
  hasApiKey: boolean;
}

const IZAPIA_BASE_URL = "https://api.izapia.com";

const IzapiaSection: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [hasApiKey, setHasApiKey] = useState(false);

  useEffect(() => {
    api
      .get<IzapiaConfigResponse>("/izapia-config")
      .then(({ data }) => setHasApiKey(data.hasApiKey))
      .catch(toastError)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!apiKey) return;
    setSaving(true);
    try {
      const { data } = await api.put<IzapiaConfigResponse>("/izapia-config", { apiKey });
      setHasApiKey(data.hasApiKey);
      setApiKey("");
      toast.success("API key izapia salva");
    } catch (err) {
      toastError(err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Zap className="h-5 w-5" />
          izapia
          {hasApiKey ? (
            <Badge variant="default">Configurado</Badge>
          ) : (
            <Badge variant="secondary">Não configurado</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Credencial usada pelas conexões WhatsApp com Motor = izapia. A URL da API é sempre {IZAPIA_BASE_URL} — só a API key é configurável. Ela nunca é reexibida; deixe o campo em branco para manter a atual.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-1.5">
          <Label htmlFor="izapia-api-key">API Key</Label>
          <Input
            id="izapia-api-key"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasApiKey ? "•••••••••• (mantida)" : "Cole sua API key do izapia"}
          />
        </div>
        <Button onClick={handleSave} disabled={saving || !apiKey}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar
        </Button>
      </CardContent>
    </Card>
  );
};

export default IzapiaSection;
