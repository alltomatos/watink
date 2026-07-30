import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "react-toastify";
import { ArrowLeft, Loader2 } from "lucide-react";
import { PageLayout, PageHeader, PageContent } from "@/components/ui/page-layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import WhatsAppBubblePreview from "../../components/WhatsAppBubblePreview";
import type {
  QuickAnswerType,
  QuickAnswerContent,
  QuickAnswerContentButtons,
  QuickAnswerContentList,
  QuickAnswerContentMedia,
  QuickAnswerContentPoll,
  QuickAnswerContentCarousel,
  QuickAnswerContentPix,
} from "./quickAnswersTypes";
import {
  defaultButtons,
  defaultList,
  defaultMedia,
  defaultPoll,
  defaultCarousel,
  defaultPix,
  TYPE_OPTIONS,
  validate,
  type FormErrors,
} from "./quickAnswersHelpers";
import { SectionTitle } from "./editors/SectionTitle";
import { PhoneMockup } from "./editors/PhoneMockup";
import { TextEditor } from "./editors/TextEditor";
import { ButtonsEditor } from "./editors/ButtonsEditor";
import { ListEditor } from "./editors/ListEditor";
import { MediaEditor } from "./editors/MediaEditor";
import { PollEditor } from "./editors/PollEditor";
import { CarouselEditor } from "./editors/CarouselEditor";
import { PixEditor } from "./editors/PixEditor";

// ─── main page ────────────────────────────────────────────────────────────────

const QuickAnswerEditor: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const isEdit = !!id;
  const isMounted = useRef(true);
  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const [shortcut, setShortcut] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<QuickAnswerType>("text");
  const [textBody, setTextBody] = useState("");
  const [buttonsContent, setButtonsContent] = useState<QuickAnswerContentButtons>(defaultButtons());
  const [listContent, setListContent] = useState<QuickAnswerContentList>(defaultList());
  const [mediaContent, setMediaContent] = useState<QuickAnswerContentMedia>(defaultMedia());
  const [pollContent, setPollContent] = useState<QuickAnswerContentPoll>(defaultPoll());
  const [carouselContent, setCarouselContent] = useState<QuickAnswerContentCarousel>(defaultCarousel());
  const [pixContent, setPixContent] = useState<QuickAnswerContentPix>(defaultPix());

  useEffect(() => () => { isMounted.current = false; }, []);

  useEffect(() => {
    if (!isEdit) return;
    api
      .get(`/quickAnswers/${id}`)
      .then(({ data }) => {
        if (!isMounted.current) return;
        setShortcut(data.shortcut ?? "");
        setSlug(data.slug ?? "");
        const t: QuickAnswerType = data.type || "text";
        setType(t);
        if (data.content) {
          try {
            const parsed = JSON.parse(data.content);
            if (t === "text") setTextBody(parsed.body ?? data.message ?? "");
            if (t === "interactive_buttons") setButtonsContent(parsed);
            if (t === "list") setListContent(parsed);
            if (t === "media") setMediaContent(parsed);
            if (t === "poll") setPollContent(parsed);
            if (t === "carousel") setCarouselContent(parsed);
            if (t === "pix") setPixContent(parsed);
          } catch {
            setTextBody(data.message ?? "");
          }
        } else {
          setTextBody(data.message ?? "");
        }
      })
      .catch(toastError)
      .finally(() => { if (isMounted.current) setLoading(false); });
  }, [id, isEdit]);

  const buildPreviewContent = (): QuickAnswerContent | undefined => {
    switch (type) {
      case "text": return { body: textBody };
      case "interactive_buttons": return buttonsContent;
      case "list": return listContent;
      case "media": return mediaContent;
      case "poll": return pollContent;
      case "carousel": return carouselContent;
      case "pix": return pixContent;
      default: return undefined;
    }
  };

  const buildPayload = () => {
    let content: object;
    let message: string;
    switch (type) {
      case "interactive_buttons": content = buttonsContent; message = buttonsContent.body; break;
      case "list": content = listContent; message = listContent.body; break;
      case "media": content = mediaContent; message = mediaContent.caption ?? mediaContent.url; break;
      case "poll": content = pollContent; message = pollContent.question; break;
      case "carousel": content = carouselContent; message = carouselContent.body; break;
      case "pix": content = pixContent; message = pixContent.body || "Pagamento via PIX"; break;
      default: content = { body: textBody }; message = textBody;
    }
    return { shortcut, slug, type, message, content: JSON.stringify(content) };
  };

  const handleSave = async () => {
    const errors = validate(shortcut, type, textBody, buttonsContent, listContent, mediaContent, pollContent, carouselContent, pixContent);
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setSubmitting(true);
    try {
      const payload = buildPayload();
      if (isEdit) {
        await api.put(`/quickAnswers/${id}`, payload);
      } else {
        await api.post("/quickAnswers", payload);
      }
      toast.success(isEdit ? "Resposta rápida atualizada!" : "Resposta rápida criada!");
      navigate("/quick-answers");
    } catch (err) {
      toastError(err);
    } finally {
      if (isMounted.current) setSubmitting(false);
    }
  };

  const selectedType = TYPE_OPTIONS.find((o) => o.value === type);

  return (
    <PageLayout>
      <PageHeader
        title={isEdit ? "Editar resposta rápida" : "Nova resposta rápida"}
        description={isEdit ? "Atualize o template de mensagem" : "Crie um template para agilizar o atendimento"}
      >
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={() => navigate("/quick-answers")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button onClick={handleSave} disabled={submitting || loading}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "Salvar alterações" : "Criar resposta"}
          </Button>
        </div>
      </PageHeader>

      <PageContent>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex gap-8 items-start">
            {/* ── Form ── */}
            <div className="flex-1 min-w-0 space-y-6">

              {/* Identificação */}
              <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                <CardContent className="p-5 space-y-4">
                  <SectionTitle>Identificação</SectionTitle>
                  <div className="space-y-1.5">
                    <Label htmlFor="qa-shortcut">
                      Atalho{" "}
                      <span className="text-muted-foreground font-normal">
                        — usado com / no chat
                      </span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm select-none">
                        /
                      </span>
                      <Input
                        id="qa-shortcut"
                        autoFocus
                        placeholder="ola, contrato, preco..."
                        value={shortcut}
                        onChange={(e) => setShortcut(e.target.value.replace(/\s+/g, "-").toLowerCase())}
                        aria-invalid={!!formErrors.shortcut}
                        className="pl-6 font-mono"
                      />
                    </div>
                    {formErrors.shortcut && (
                      <p className="text-xs text-destructive">{formErrors.shortcut}</p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="qa-slug">
                      Slug{" "}
                      <span className="text-muted-foreground font-normal">
                        — identificador para fluxos e integrações (opcional)
                      </span>
                    </Label>
                    <Input
                      id="qa-slug"
                      placeholder="ex: boas-vindas, menu-principal"
                      value={slug}
                      onChange={(e) =>
                        setSlug(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9-_]+/g, "-")
                            .replace(/-+/g, "-")
                        )
                      }
                      className="font-mono"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Tipo */}
              <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                <CardContent className="p-5 space-y-4">
                  <SectionTitle>Tipo de mensagem</SectionTitle>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setType(opt.value); setFormErrors({}); }}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                          type === opt.value
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/40 hover:bg-muted/40"
                        }`}
                      >
                        <p className="text-sm font-semibold leading-tight">{opt.label}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{opt.description}</p>
                      </button>
                    ))}
                  </div>
                  {selectedType && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {selectedType.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{selectedType.description}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Conteúdo */}
              <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)]">
                <CardContent className="p-5 space-y-4">
                  <SectionTitle>Conteúdo</SectionTitle>
                  {type === "text" && (
                    <TextEditor body={textBody} onChange={setTextBody} error={formErrors.body} />
                  )}
                  {type === "interactive_buttons" && (
                    <ButtonsEditor content={buttonsContent} onChange={setButtonsContent} errors={formErrors} />
                  )}
                  {type === "list" && (
                    <ListEditor content={listContent} onChange={setListContent} errors={formErrors} />
                  )}
                  {type === "media" && (
                    <MediaEditor content={mediaContent} onChange={setMediaContent} errors={formErrors} />
                  )}
                  {type === "poll" && (
                    <PollEditor content={pollContent} onChange={setPollContent} errors={formErrors} />
                  )}
                  {type === "carousel" && (
                    <CarouselEditor content={carouselContent} onChange={setCarouselContent} errors={formErrors} />
                  )}
                  {type === "pix" && (
                    <PixEditor content={pixContent} onChange={setPixContent} errors={formErrors} />
                  )}
                </CardContent>
              </Card>

              {/* Variáveis disponíveis */}
              <Card className="rounded-2xl shadow-[0px_4px_20px_rgba(0,0,0,0.06)] border-dashed">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
                    Variáveis disponíveis
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {["{{contact_name}}", "{{ticket_id}}", "{{agent_name}}", "{{company_name}}"].map((v) => (
                      <code
                        key={v}
                        className="bg-yellow-100 text-yellow-800 rounded px-1.5 py-0.5 text-xs font-mono cursor-default select-all"
                      >
                        {v}
                      </code>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Substituídas automaticamente no envio. No preview aparecem destacadas.
                  </p>
                </CardContent>
              </Card>

              {/* Footer actions */}
              <div className="flex items-center justify-end gap-2 pb-8">
                <Button variant="outline" onClick={() => navigate("/quick-answers")}>
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {isEdit ? "Salvar alterações" : "Criar resposta"}
                </Button>
              </div>
            </div>

            {/* ── Preview (sticky) ── */}
            <div className="hidden lg:block sticky top-6 w-[320px] shrink-0">
              <PhoneMockup>
                <WhatsAppBubblePreview
                  type={type}
                  content={buildPreviewContent()}
                  message={textBody}
                />
              </PhoneMockup>
            </div>
          </div>
        )}
      </PageContent>
    </PageLayout>
  );
};

export default QuickAnswerEditor;
