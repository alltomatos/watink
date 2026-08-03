import { toast, type ToastOptions } from "react-toastify";

import toastError from "@/errors/toastError";

/**
 * Ponto único para disparar toasts. `notify.error` delega ao helper
 * existente (`errors/toastError`), que já resolve mensagens do backend via
 * i18n e trata 402 como caso especial — antes 105 call sites chamavam
 * `toast.error(...)` cru e ficavam de fora desse tratamento.
 */
export const notify = {
  success: (message: string, options?: ToastOptions): void => {
    toast.success(message, options);
  },
  info: (message: string, options?: ToastOptions): void => {
    toast.info(message, options);
  },
  warning: (message: string, options?: ToastOptions): void => {
    toast.warn(message, options);
  },
  error: (err: unknown): void => {
    toastError(err);
  },
};

export default notify;
