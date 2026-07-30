/* @jsxImportSource react */
import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  FlaskConical,
  Globe,
  Loader2,
  Plus,
  RotateCw,
  Trash2,
  Upload,
} from "lucide-react";

import api from "../../services/api";
import toastError from "../../errors/toastError";
import { subscribeToSocket } from "../../services/sse-client";
import ConfirmationModal from "../../components/ConfirmationModal";
import RetrievalPlayground from "./RetrievalPlayground";

import {
  PageContainer,
  PageHeader,
  PageContent,
} from "@/components/ui/page-layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SourceStatus = "pending" | "processing" | "ready" | "error";

interface KBSource {
  id: number;
  type: string;
  fileName?: string;
  url?: string;
  status: SourceStatus;
  chunkCount?: number;
  lastError?: string;
  objectKey?: string;
}

interface KnowledgeBase {
  id: number;
  name: string;
  description?: string;
  sources?: KBSource[];
}

interface ChunkView {
  ordinal: number;
  content: string;
  charCount: number;
  model: string;
  dim: number;
  contentHash: string;
}

interface KnowledgeSourceEvent {
  action?: string;
  sourceId: number;
  status: SourceStatus;
  chunkCount?: number;
  lastError?: string;
}

function sourceLabel(source: KBSource): string {
  if (source.fileName) return source.fileName;
  if (source.url) return source.url;
  return "Texto";
}

function SourceIcon({ source }: { source: KBSource }): React.ReactElement {
  if (source.url || source.type === "url") {
    return <Globe className="h-5 w-5 text-muted-foreground" />;
  }
  if (source.type === "text") {
    return <FileText className="h-5 w-5 text-muted-foreground" />;
  }
  return <FileText className="h-5 w-5 text-muted-foreground" />;
}

function StatusBadge({ source }: { source: KBSource }): React.ReactElement {
  switch (source.status) {
    case "ready":
      if (!source.chunkCount) {
        return (
          <Badge className="gap-1 border-transparent bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))]">
            <AlertTriangle className="h-3.5 w-3.5" />
            Sem conteúdo
          </Badge>
        );
      }
      return (
        <Badge className="gap-1 border-transparent bg-[hsl(var(--status-success-bg))] text-[hsl(var(--status-success-text))]">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Pronto
          <span className="font-normal">· {source.chunkCount} chunks</span>
        </Badge>
      );
    case "processing":
      return (
        <Badge className="gap-1 border-transparent bg-[hsl(var(--status-info-bg))] text-[hsl(var(--status-info-text))]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Processando
        </Badge>
      );
    case "error":
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge className="gap-1 border-transparent bg-[hsl(var(--status-error-bg))] text-[hsl(var(--status-error-text))] cursor-help">
                <AlertCircle className="h-3.5 w-3.5" />
                Erro
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {source.lastError || "Falha ao processar a fonte"}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    case "pending":
    default:
      return (
        <Badge className="gap-1 border-transparent bg-[hsl(var(--status-warning-bg))] text-[hsl(var(--status-warning-text))]">
          <Clock className="h-3.5 w-3.5" />
          Aguardando
        </Badge>
      );
  }
}

const KnowledgeBaseConfig: React.FC = () => {
  const { knowledgeBaseId } = useParams<{ knowledgeBaseId: string }>();
  const navigate = useNavigate();

  const [kb, setKb] = useState<KnowledgeBase | null>(null);
  const [sources, setSources] = useState<KBSource[]>([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<"text" | "file" | "url">("text");
  const [textName, setTextName] = useState("");
  const [textContent, setTextContent] = useState("");
  const [urlName, setUrlName] = useState("");
  const [urlValue, setUrlValue] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<KBSource | null>(null);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [chunksBySource, setChunksBySource] = useState<Record<number, ChunkView[]>>({});
  const [loadingChunks, setLoadingChunks] = useState<number | null>(null);
  const [playgroundOpen, setPlaygroundOpen] = useState(false);

  const toggleChunks = async (source: KBSource): Promise<void> => {
    if (expandedId === source.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(source.id);
    if (chunksBySource[source.id]) return;
    setLoadingChunks(source.id);
    try {
      const { data } = await api.get<{ chunks: ChunkView[] }>(
        `/knowledge-bases/${knowledgeBaseId}/sources/${source.id}/chunks`
      );
      setChunksBySource((prev) => ({
        ...prev,
        [source.id]: Array.isArray(data.chunks) ? data.chunks : [],
      }));
    } catch (err) {
      toastError(err);
      setExpandedId(null);
    } finally {
      setLoadingChunks(null);
    }
  };

  const fetchBase = useCallback(async () => {
    if (!knowledgeBaseId) return;
    setLoading(true);
    try {
      const { data } = await api.get<KnowledgeBase>(
        `/knowledge-bases/${knowledgeBaseId}`
      );
      setKb(data);
      setSources(Array.isArray(data.sources) ? data.sources : []);
    } catch (err) {
      toastError(err);
    } finally {
      setLoading(false);
    }
  }, [knowledgeBaseId]);

  useEffect(() => {
    fetchBase();
  }, [fetchBase]);

  useEffect(() => {
    const cleanup = subscribeToSocket({
      knowledgeSource: (payload: KnowledgeSourceEvent) => {
        if (!payload || typeof payload.sourceId !== "number") return;
        setSources((prev) =>
          prev.map((s) =>
            s.id === payload.sourceId
              ? {
                  ...s,
                  status: payload.status ?? s.status,
                  chunkCount:
                    typeof payload.chunkCount === "number"
                      ? payload.chunkCount
                      : s.chunkCount,
                  lastError:
                    typeof payload.lastError === "string"
                      ? payload.lastError
                      : s.lastError,
                }
              : s
          )
        );
      },
    });
    return cleanup;
  }, []);

  const resetDialog = (): void => {
    setTextName("");
    setTextContent("");
    setUrlName("");
    setUrlValue("");
    setFile(null);
    setTab("text");
  };

  const handleAddSource = async () => {
    if (!knowledgeBaseId) return;

    const formData = new FormData();
    if (tab === "text") {
      if (!textContent.trim()) return;
      formData.append("type", "text");
      formData.append("name", textName.trim() || "Texto");
      formData.append("content", textContent);
    } else if (tab === "url") {
      if (!urlValue.trim()) return;
      formData.append("type", "url");
      formData.append("name", urlName.trim() || urlValue.trim());
      formData.append("url", urlValue.trim());
    } else {
      if (!file) return;
      formData.append("type", "file");
      formData.append("name", file.name);
      formData.append("file", file);
    }

    setSubmitting(true);
    try {
      const { data } = await api.post<KBSource>(
        `/knowledge-bases/${knowledgeBaseId}/sources`,
        formData
      );
      if (data && typeof data.id === "number") {
        setSources((prev) => [...prev, data]);
      } else {
        await fetchBase();
      }
      toast.success("Fonte adicionada");
      setDialogOpen(false);
      resetDialog();
    } catch (err) {
      toastError(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReingest = async (source: KBSource): Promise<void> => {
    try {
      await api.post(
        `/knowledge-bases/${knowledgeBaseId}/sources/${source.id}/reingest`
      );
      setSources((prev) =>
        prev.map((s) =>
          s.id === source.id
            ? { ...s, status: "pending", lastError: undefined }
            : s
        )
      );
      toast.success("Reprocessando a fonte...");
    } catch (err) {
      toastError(err);
    }
  };

  const handleRequestDelete = (source: KBSource): void => {
    setDeleteTarget(source);
    setConfirmOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!knowledgeBaseId || !deleteTarget) return;
    try {
      await api.delete(
        `/knowledge-bases/${knowledgeBaseId}/sources/${deleteTarget.id}`
      );
      setSources((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      toast.success("Fonte removida");
    } catch (err) {
      toastError(err);
    } finally {
      setDeleteTarget(null);
    }
  };

  const canSubmit =
    tab === "text"
      ? Boolean(textContent.trim())
      : tab === "url"
        ? Boolean(urlValue.trim())
        : Boolean(file);

  return (
    <PageContainer>
      <ConfirmationModal
        title="Remover fonte?"
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleConfirmDelete}
      >
        A fonte e seus embeddings serão removidos desta base. Não pode ser
        desfeito.
      </ConfirmationModal>

      <PageHeader
        title={kb?.name || (loading ? "Carregando..." : "Base de Conhecimento")}
        description={kb?.description || undefined}
      >
        <Button variant="outline" onClick={() => navigate("/knowledge-bases")}>
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
        <Button
          variant="outline"
          onClick={() => setPlaygroundOpen(true)}
          disabled={sources.length === 0}
        >
          <FlaskConical className="h-4 w-4" />
          Testar recuperação
        </Button>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Adicionar fonte
        </Button>
      </PageHeader>

      <PageContent>
        {loading ? (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center">
              <Upload className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                Nenhuma fonte adicionada
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Adicione textos ou arquivos para a IA aprender com eles
              </p>
            </div>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" />
              Adicionar fonte
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sources.map((source) => {
              const isExpandable =
                source.status === "ready" && !!source.chunkCount;
              const isOpen = expandedId === source.id;
              const chunks = chunksBySource[source.id];
              return (
                <div key={source.id} className="flex flex-col">
                  <Card className="flex items-center gap-4 px-4 py-3">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <SourceIcon source={source} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">
                        {sourceLabel(source)}
                      </p>
                      {source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          title={source.url}
                          className="block truncate text-xs text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {source.url}
                        </a>
                      ) : (
                        <p className="text-xs uppercase tracking-wide text-muted-foreground">
                          {source.type}
                        </p>
                      )}
                    </div>
                    <StatusBadge source={source} />
                    {isExpandable && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={isOpen ? "Recolher chunks" : "Ver chunks"}
                        onClick={() => toggleChunks(source)}
                        className="shrink-0 text-muted-foreground"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform ${
                            isOpen ? "rotate-180" : ""
                          }`}
                        />
                      </Button>
                    )}
                    {source.type !== "text" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Reprocessar fonte"
                        title="Reprocessar (re-disparar raspagem/ingestão)"
                        onClick={() => handleReingest(source)}
                        className="shrink-0 text-muted-foreground"
                      >
                        <RotateCw className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remover fonte"
                      onClick={() => handleRequestDelete(source)}
                      className="shrink-0 text-muted-foreground hover:text-[hsl(var(--destructive))]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </Card>

                  {source.status === "error" && (
                    <div className="mx-2 mt-1 flex items-start gap-2 rounded-xl border border-[hsl(var(--status-error-text))]/30 bg-[hsl(var(--status-error-bg))]/40 p-3">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--status-error-text))]" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[hsl(var(--status-error-text))]">
                          Falha ao processar esta fonte
                        </p>
                        <p className="break-words text-xs text-muted-foreground">
                          {source.lastError ||
                            "Erro desconhecido durante a ingestão."}
                        </p>
                        {source.type !== "text" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReingest(source)}
                            className="mt-2 gap-1.5"
                          >
                            <RotateCw className="h-3.5 w-3.5" />
                            Tentar novamente
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  {source.status === "ready" && !source.chunkCount && (
                    <div className="mx-2 mt-1 flex items-start gap-2 rounded-xl border border-[hsl(var(--status-warning-text))]/30 bg-[hsl(var(--status-warning-bg))]/40 p-3">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--status-warning-text))]" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[hsl(var(--status-warning-text))]">
                          Nenhum conteúdo extraído
                        </p>
                        <p className="break-words text-xs text-muted-foreground">
                          A fonte foi processada, mas não gerou nenhum trecho. O site
                          pode ter bloqueado a raspagem, exigir login, depender de
                          JavaScript pesado ou ter excedido o tempo limite. Tente outra
                          URL ou uma página mais simples.
                        </p>
                      </div>
                    </div>
                  )}

                  {(source.status === "processing" ||
                    source.status === "pending") && (
                    <div className="mx-2 mt-1 flex items-center gap-2 rounded-xl border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {source.status === "processing"
                        ? "Processando: raspando e indexando o conteúdo…"
                        : "Na fila, aguardando processamento…"}
                    </div>
                  )}

                  {isOpen && (
                    <div className="mx-2 mt-1 rounded-xl border bg-muted/30 p-3">
                      {loadingChunks === source.id ? (
                        <div className="flex items-center justify-center py-4 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : !chunks || chunks.length === 0 ? (
                        <p className="py-3 text-center text-sm text-muted-foreground">
                          Nenhum chunk para esta fonte.
                        </p>
                      ) : (
                        <div className="flex flex-col gap-2">
                          <p className="text-xs text-muted-foreground">
                            {chunks.length} chunk(s) · modelo {chunks[0].model} ·{" "}
                            {chunks[0].dim} dimensões
                          </p>
                          {chunks.map((ch) => (
                            <div
                              key={ch.ordinal}
                              className="rounded-lg border bg-background p-2.5"
                            >
                              <div className="mb-1 flex items-center gap-2 text-[11px] text-muted-foreground">
                                <span className="font-medium">#{ch.ordinal}</span>
                                <span>· {ch.charCount} caracteres</span>
                              </div>
                              <p className="whitespace-pre-wrap text-sm text-foreground">
                                {ch.content}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PageContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar fonte</DialogTitle>
          </DialogHeader>

          <Tabs
            value={tab}
            onValueChange={(v) => setTab(v as "text" | "file" | "url")}
            className="mt-2"
          >
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="text">Texto</TabsTrigger>
              <TabsTrigger value="url">URL</TabsTrigger>
              <TabsTrigger value="file">Arquivo</TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="source-name">Nome</Label>
                <Input
                  id="source-name"
                  value={textName}
                  onChange={(e) => setTextName(e.target.value)}
                  placeholder="Ex: Política de trocas"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="source-content">Conteúdo</Label>
                <Textarea
                  id="source-content"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Cole aqui o texto que a IA deve aprender"
                  rows={8}
                />
              </div>
            </TabsContent>

            <TabsContent value="url" className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="source-url">Endereço (URL)</Label>
                <Input
                  id="source-url"
                  type="url"
                  value={urlValue}
                  onChange={(e) => setUrlValue(e.target.value)}
                  placeholder="https://exemplo.com/pagina"
                />
                <p className="text-xs text-muted-foreground">
                  A página será raspada e convertida em texto para a IA aprender.
                </p>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="source-url-name">Nome (opcional)</Label>
                <Input
                  id="source-url-name"
                  value={urlName}
                  onChange={(e) => setUrlName(e.target.value)}
                  placeholder="Ex: Notícias do dia"
                />
              </div>
            </TabsContent>

            <TabsContent value="file" className="flex flex-col gap-4 pt-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="source-file">Arquivo</Label>
                <Input
                  id="source-file"
                  type="file"
                  accept=".txt,.pdf,.docx,.csv,.xlsx,.md"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <p className="text-xs text-muted-foreground">
                  Formatos: txt, pdf, docx, csv, xlsx, md
                </p>
                {file && (
                  <p className="text-sm text-foreground truncate">
                    {file.name}
                  </p>
                )}
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-2">
            <Button
              variant="outline"
              onClick={() => {
                setDialogOpen(false);
                resetDialog();
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleAddSource} disabled={!canSubmit || submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RetrievalPlayground
        knowledgeBaseId={knowledgeBaseId ?? ""}
        open={playgroundOpen}
        onOpenChange={setPlaygroundOpen}
      />
    </PageContainer>
  );
};

export default KnowledgeBaseConfig;
