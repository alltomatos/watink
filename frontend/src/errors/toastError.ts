import { toast } from "react-toastify";
import { i18n } from "../translate/i18n";

interface ApiError {
  response?: {
    status?: number;
    data?: {
      message?: string;
      error?: string;
      resource?: string;
      limit?: number;
    };
  };
}

const toastError = (err: unknown): void => {
  const apiErr = err as ApiError;
  const status = apiErr.response?.status;
  const data = apiErr.response?.data;
  const errorMsg = data?.message || data?.error;

  // Onda 2/A.5 do watink-saas (docs/integration-core.md §2.2/§3): toast de
  // upgrade com o recurso e o limite exatos, em vez da mensagem genérica de
  // backendErrors -- resource/limit só existem neste formato estruturado.
  // tenant_suspended/tenant_canceled (Onda 2/A.3) já navegam pra
  // /conta-suspensa via interceptor global em useAuth -- a tela cheia
  // substitui o toast, evitar ruído duplicado aqui.
  if (errorMsg === "tenant_suspended" || errorMsg === "tenant_canceled") {
    return;
  }

  if (errorMsg === "plan_limit_reached" && data?.resource) {
    const resourceLabel = i18n.exists(`planLimitResources.${data.resource}`)
      ? i18n.t(`planLimitResources.${data.resource}`)
      : data.resource;
    toast.error(
      `${i18n.t("backendErrors.plan_limit_reached")} (${resourceLabel}: ${data.limit})`,
      { toastId: "plan_limit_reached" }
    );
    return;
  }

  if (status === 402) {
    toast.error(
      "Assinatura requerida ou expirada. Verifique seus planos no Marketplace.",
      {
        toastId: "PAYMENT_REQUIRED",
        onClick: () => {
          window.location.href = "/admin/settings/billing";
        },
      }
    );
    return;
  }

  if (errorMsg) {
    if (i18n.exists(`backendErrors.${errorMsg}`)) {
      toast.error(i18n.t(`backendErrors.${errorMsg}`), {
        toastId: errorMsg,
      });
    } else {
      toast.error(errorMsg, {
        toastId: errorMsg,
      });
    }
  } else {
    toast.error("An error occurred!");
  }
};

export default toastError;
