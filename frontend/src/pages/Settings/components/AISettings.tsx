/* @jsxImportSource react */
import React from "react";
import { Brain, Database, MessageSquare } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/card";
import { Label } from "../../../components/ui/label";
import { Switch } from "../../../components/ui/switch";
import { Separator } from "../../../components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select";
import { Input } from "../../../components/ui/input";
import { Textarea } from "../../../components/ui/textarea";

interface AISettingsProps {
  getSettingValue: (key: string) => string;
  handleUpdateSetting: (key: string, value: string) => Promise<void>;
}

const providerModels: Record<string, string[]> = {
  openai: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
  grok: ["grok-beta", "grok-2"],
  anthropic: ["claude-3-5-sonnet", "claude-3-opus", "claude-3-haiku"],
  custom: [],
};

const AISettings: React.FC<AISettingsProps> = ({
  getSettingValue,
  handleUpdateSetting,
}) => {
  const provider = getSettingValue("aiProvider") || "openai";
  const models = providerModels[provider] || [];
  const isCustomProvider = provider === "custom";

  // O embedding usa um gateway DEDICADO quando há uma URL base própria configurada;
  // caso contrário, reusa o gateway do chat (apenas com um modelo de embedding próprio).
  const [embeddingDedicated, setEmbeddingDedicated] = React.useState<boolean>(
    Boolean(getSettingValue("aiEmbeddingBaseURL"))
  );

  const handleToggleDedicated = (checked: boolean): void => {
    setEmbeddingDedicated(checked);
    if (!checked) {
      // Voltar a usar o gateway do chat → limpa o endpoint/chave dedicados.
      void handleUpdateSetting("aiEmbeddingBaseURL", "");
      void handleUpdateSetting("aiEmbeddingApiKey", "");
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Funcionalidades de IA ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Brain className="h-5 w-5" />
            Agente de IA e Automação
          </CardTitle>
          <CardDescription>
            Ative as funcionalidades de Inteligência Artificial do sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Habilitar IA Global</Label>
                <p className="text-xs text-muted-foreground">
                  Bot inteligente ativo no onboarding e fechamento básico
                </p>
              </div>
              <Switch
                checked={getSettingValue("aiEnabled") === "true"}
                onCheckedChange={(checked) =>
                  handleUpdateSetting("aiEnabled", checked ? "true" : "false")
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>IA no FlowBuilder</Label>
                <p className="text-xs text-muted-foreground">
                  Editor assistido de fluxos de decisão automatizados
                </p>
              </div>
              <Switch
                checked={getSettingValue("aiFlowBuilderEnabled") === "true"}
                onCheckedChange={(checked) =>
                  handleUpdateSetting(
                    "aiFlowBuilderEnabled",
                    checked ? "true" : "false"
                  )
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>IA no Pipeline</Label>
                <p className="text-xs text-muted-foreground">
                  Assistente de IA ativo na criação e edição de pipelines
                </p>
              </div>
              <Switch
                checked={getSettingValue("aiPipelineEnabled") === "true"}
                onCheckedChange={(checked) =>
                  handleUpdateSetting(
                    "aiPipelineEnabled",
                    checked ? "true" : "false"
                  )
                }
              />
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Co-Piloto de Respostas no Chat</Label>
                <p className="text-xs text-muted-foreground">
                  Sugestões de atendimento inteligentes e automáticas em tempo real
                </p>
              </div>
              <Switch
                checked={getSettingValue("aiAssistantEnabled") === "true"}
                onCheckedChange={(checked) =>
                  handleUpdateSetting(
                    "aiAssistantEnabled",
                    checked ? "true" : "false"
                  )
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Gateway de Chat / LLM ───────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <MessageSquare className="h-5 w-5" />
            Gateway de Chat / LLM
          </CardTitle>
          <CardDescription>
            Provedor, modelo de linguagem e credenciais usados pelo agente,
            FlowBuilder, Pipeline e Co-Piloto.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="ai-provider">Provedor de Inteligência Artificial</Label>
              <Select
                value={provider}
                onValueChange={(v) => {
                  handleUpdateSetting("aiProvider", v);
                  const firstModel = providerModels[v]?.[0] || "";
                  if (firstModel) {
                    handleUpdateSetting("aiModel", firstModel);
                  }
                }}
              >
                <SelectTrigger id="ai-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openai">OpenAI (GPT-4/GPT-3.5)</SelectItem>
                  <SelectItem value="grok">xAI Grok (Grok-2/Grok-Beta)</SelectItem>
                  <SelectItem value="anthropic">Anthropic (Claude 3.5)</SelectItem>
                  <SelectItem value="custom">
                    Provedor Customizado (OpenAI-compatível)
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ai-model">Modelo de Linguagem (LLM)</Label>
              {isCustomProvider ? (
                <Input
                  id="ai-model"
                  placeholder="Ex: llama3, mistral, gpt-4o-mini"
                  defaultValue={getSettingValue("aiModel")}
                  onBlur={(e) => handleUpdateSetting("aiModel", e.target.value)}
                />
              ) : (
                <Select
                  value={getSettingValue("aiModel") || models[0] || ""}
                  onValueChange={(v) => handleUpdateSetting("aiModel", v)}
                  disabled={models.length === 0}
                >
                  <SelectTrigger id="ai-model">
                    <SelectValue placeholder="Selecione o modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((mod) => (
                      <SelectItem key={mod} value={mod}>
                        {mod}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {isCustomProvider && (
            <div className="grid gap-2">
              <Label htmlFor="ai-base-url">URL Base da API</Label>
              <Input
                id="ai-base-url"
                placeholder="http://localhost:20128/v1"
                defaultValue={getSettingValue("aiCustomBaseURL")}
                onBlur={(e) =>
                  handleUpdateSetting("aiCustomBaseURL", e.target.value)
                }
              />
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="ai-key">Chave da API (Credentials/API Key)</Label>
            <Input
              id="ai-key"
              type="password"
              placeholder="sk-..."
              defaultValue={getSettingValue("aiApiKey")}
              onBlur={(e) => handleUpdateSetting("aiApiKey", e.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="ai-prompt">Prompt de Orientação (Guide Prompt)</Label>
            <Textarea
              id="ai-prompt"
              rows={6}
              placeholder="Você é um assistente virtual focado em..."
              defaultValue={getSettingValue("aiGuidePrompt")}
              onBlur={(e) => handleUpdateSetting("aiGuidePrompt", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Gateway de Embedding (RAG) ──────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Database className="h-5 w-5" />
            Gateway de Embedding (Base de Conhecimento / RAG)
          </CardTitle>
          <CardDescription>
            Vetorização das fontes da Base de Conhecimento. Pode reusar o gateway
            do chat (com um modelo próprio) ou usar um gateway dedicado.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Gateway dedicado para embedding</Label>
              <p className="text-xs text-muted-foreground">
                Desligado: usa o gateway do chat acima. Ligado: endpoint próprio
                (ex.: Ollama self-hosted em http://ollama:11434/v1).
              </p>
            </div>
            <Switch
              checked={embeddingDedicated}
              onCheckedChange={handleToggleDedicated}
            />
          </div>

          {embeddingDedicated && (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="ai-embedding-base-url">
                  URL Base do Gateway de Embedding
                </Label>
                <Input
                  id="ai-embedding-base-url"
                  placeholder="http://ollama:11434/v1"
                  defaultValue={getSettingValue("aiEmbeddingBaseURL")}
                  onBlur={(e) =>
                    handleUpdateSetting("aiEmbeddingBaseURL", e.target.value)
                  }
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="ai-embedding-key">
                  Chave da API do Embedding (opcional)
                </Label>
                <Input
                  id="ai-embedding-key"
                  type="password"
                  placeholder="vazio = reusa a chave do chat (Ollama não exige)"
                  defaultValue={getSettingValue("aiEmbeddingApiKey")}
                  onBlur={(e) =>
                    handleUpdateSetting("aiEmbeddingApiKey", e.target.value)
                  }
                />
              </div>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="ai-embedding-model">Modelo de Embedding</Label>
            <Input
              id="ai-embedding-model"
              placeholder="Ex: qwen3-embedding:4b ou openrouter/nvidia/llama-nemotron-embed-vl-1b-v2:free"
              defaultValue={getSettingValue("aiEmbeddingModel")}
              onBlur={(e) =>
                handleUpdateSetting("aiEmbeddingModel", e.target.value)
              }
            />
            <p className="text-xs text-muted-foreground">
              A dimensão do índice é fixa por modelo — trocar de modelo exige
              re-embedar a base inteira (reprocessar as fontes).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AISettings;
