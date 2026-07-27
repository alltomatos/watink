import React, { useState, useEffect } from "react";
import * as Yup from "yup";
import { Formik, Form, Field } from "formik";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";
import toastError from "../../errors/toastError";
import QueueSelect from "../QueueSelect";
import type { WhatsAppConnection, WhatsAppFormValues, Proxy, ProxyGroup, ConnectionGroup } from "../../types/domain";

const SessionSchema = Yup.object().shape({
  name: Yup.string().min(2, "Too Short!").max(50, "Too Long!").required("Required"),
});

interface WhatsAppModalProps {
  open: boolean;
  onClose: () => void;
  whatsAppId?: number | string;
  onSaved?: () => void; // Adicionado onSaved que é passado nos consumers (ex: Connections)
}

const WhatsAppModal = ({ open, onClose, whatsAppId, onSaved }: WhatsAppModalProps) => {
  const [whatsApp, setWhatsApp] = useState<WhatsAppFormValues>({
    name: "",
    isDefault: false,
    keepAlive: false,
    syncHistory: false,
    engineType: "whatsmeow",
    proxyMode: "none",
    proxyId: null,
    proxyGroupId: null,
    connectionGroupId: null,
  });
  const [selectedQueueIds, setSelectedQueueIds] = useState<number[]>([]);
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [proxyGroups, setProxyGroups] = useState<ProxyGroup[]>([]);
  const [connectionGroups, setConnectionGroups] = useState<ConnectionGroup[]>([]);

  useEffect(() => {
    if (!open) return;
    api.get<Proxy[]>("/proxies", { params: { status: "active" } })
      .then(({ data }) => setProxies(Array.isArray(data) ? data : []))
      .catch(() => setProxies([]));
    api.get<ProxyGroup[]>("/proxy-groups")
      .then(({ data }) => setProxyGroups(Array.isArray(data) ? data : []))
      .catch(() => setProxyGroups([]));
    api.get<ConnectionGroup[]>("/connection-groups")
      .then(({ data }) => setConnectionGroups(Array.isArray(data) ? data : []))
      .catch(() => setConnectionGroups([]));
  }, [open]);

  useEffect(() => {
    if (!whatsAppId) return;
    api.get<WhatsAppConnection>(`/whatsapp/${whatsAppId}`)
      .then(({ data }) => {
        setWhatsApp({
          name: data.name,
          isDefault: data.isDefault,
          keepAlive: data.keepAlive,
          syncHistory: data.syncHistory,
          engineType: data.engineType ?? "whatsmeow",
          proxyMode: data.proxyMode ?? "none",
          proxyId: data.proxyId ?? null,
          proxyGroupId: data.proxyGroupId ?? null,
          connectionGroupId: data.connectionGroupId ?? null,
        });
        if (data.queues) {
          setSelectedQueueIds(data.queues.map((q) => q.id));
        }
      })
      .catch(toastError);
  }, [whatsAppId, open]);

  const handleClose = () => {
    onClose();
    setWhatsApp({ name: "", isDefault: false, keepAlive: false, syncHistory: false, engineType: "whatsmeow", proxyMode: "none", proxyId: null, proxyGroupId: null, connectionGroupId: null });
    setSelectedQueueIds([]);
  };

  const handleSaveWhatsApp = async (values: WhatsAppFormValues) => {
    const payload = { ...values, queueIds: selectedQueueIds };
    try {
      if (whatsAppId) {
        await api.put(`/whatsapp/${whatsAppId}`, payload);
      } else {
        await api.post("/whatsapp", payload);
      }
      toast.success(i18n.t("whatsappModal.success"));
      if (onSaved) onSaved(); // Chamar callback se existir
      handleClose();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {whatsAppId ? i18n.t("whatsappModal.title.edit") : i18n.t("whatsappModal.title.add")}
          </DialogTitle>
        </DialogHeader>

        <Formik
          initialValues={whatsApp}
          enableReinitialize
          validationSchema={SessionSchema}
          onSubmit={(values, actions) => {
            handleSaveWhatsApp(values);
            actions.setSubmitting(false);
          }}
        >
          {({ values, touched, errors, isSubmitting, setFieldValue }) => (
            <Form className="space-y-4">
              <div className="space-y-1">
                <Label>{i18n.t("whatsappModal.form.name")}</Label>
                <Field as={Input} name="name" autoFocus aria-invalid={!!(errors.name && touched.name)} />
                {errors.name && touched.name && <p className="text-xs text-destructive">{errors.name as string}</p>}
              </div>

              <div className="space-y-1">
                <Label>Motor</Label>
                <Select
                  value={values.engineType ?? "whatsmeow"}
                  onValueChange={(v) => setFieldValue("engineType", v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsmeow">whatsmeow (padrão)</SelectItem>
                    <SelectItem value="izapia">izapia</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="wa-default"
                  checked={values.isDefault}
                  onCheckedChange={(checked) => setFieldValue("isDefault", checked)}
                />
                <Label htmlFor="wa-default">{i18n.t("whatsappModal.form.default")}</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="wa-keep-alive"
                  checked={values.keepAlive}
                  onCheckedChange={(checked) => setFieldValue("keepAlive", checked)}
                />
                <Label htmlFor="wa-keep-alive">Keep Alive</Label>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="wa-sync"
                  checked={values.syncHistory}
                  onCheckedChange={(checked) => setFieldValue("syncHistory", checked)}
                />
                <Label htmlFor="wa-sync">Sincronizar Histórico</Label>
              </div>

              {values.engineType !== "izapia" && (
              <div className="space-y-1 pt-2">
                <Label>Proxy (anti-ban)</Label>
                <Select
                  value={
                    values.proxyMode === "group" && values.proxyGroupId
                      ? `group:${values.proxyGroupId}`
                      : values.proxyMode === "single" && values.proxyId
                      ? `single:${values.proxyId}`
                      : "none"
                  }
                  onValueChange={(v) => {
                    if (v === "none") {
                      setFieldValue("proxyMode", "none");
                      setFieldValue("proxyId", null);
                      setFieldValue("proxyGroupId", null);
                    } else if (v.startsWith("group:")) {
                      setFieldValue("proxyMode", "group");
                      setFieldValue("proxyGroupId", Number(v.slice(6)));
                      setFieldValue("proxyId", null);
                    } else {
                      setFieldValue("proxyMode", "single");
                      setFieldValue("proxyId", Number(v.slice(7)));
                      setFieldValue("proxyGroupId", null);
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sem proxy" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem proxy (IP do servidor)</SelectItem>
                    {proxyGroups.map((g) => (
                      <SelectItem key={`g${g.id}`} value={`group:${g.id}`}>
                        Grupo: {g.name} ({g.rotationStrategy === "rotate" ? "rotação" : "fixo"})
                      </SelectItem>
                    ))}
                    {proxies.map((p) => (
                      <SelectItem key={`p${p.id}`} value={`single:${p.id}`}>
                        {p.label ? `${p.label} — ` : ""}{p.scheme}://{p.host}:{p.port}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Alterar o proxy só vale na próxima conexão — reconecte para aplicar.
                </p>
              </div>
              )}

              <div className="space-y-1 pt-2">
                <Label>Grupo de conexões</Label>
                <Select
                  value={values.connectionGroupId ? String(values.connectionGroupId) : "none"}
                  onValueChange={(v) => setFieldValue("connectionGroupId", v === "none" ? null : Number(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sem grupo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem grupo</SelectItem>
                    {connectionGroups.map((g) => (
                      <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="pt-2">
                <Label className="mb-2 block">Filas Permitidas</Label>
                <QueueSelect
                  selectedQueueIds={selectedQueueIds}
                  onChange={setSelectedQueueIds}
                />
              </div>

              <DialogFooter className="pt-4">
                <Button type="button" variant="outline" onClick={handleClose}>
                  {i18n.t("whatsappModal.buttons.cancel")}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {whatsAppId ? i18n.t("whatsappModal.buttons.okEdit") : i18n.t("whatsappModal.buttons.okAdd")}
                </Button>
              </DialogFooter>
            </Form>
          )}
        </Formik>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppModal;
