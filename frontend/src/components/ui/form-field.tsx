import * as React from "react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";

export interface FormFieldProps extends React.HTMLAttributes<HTMLDivElement> {
  /** id do controle associado — vira o htmlFor do Label */
  htmlFor: string;
  /** Texto do label */
  label: string;
  /** Marca o campo como obrigatório (asterisco após o label) */
  required?: boolean;
  /** Mensagem de erro — quando presente, o campo entra em estado de erro */
  error?: string;
  /** Texto de apoio, exibido quando não há erro */
  helperText?: string;
  children: React.ReactNode;
}

/**
 * Wrapper padrão de campo de formulário: label + controle + erro/helper text
 * + indicador de obrigatório num único lugar. Substitui os ~4 padrões de
 * exibição de erro (span/p/aria-invalid/nenhum) hoje espalhados pelos
 * formulários do produto.
 */
const FormField = React.forwardRef<HTMLDivElement, FormFieldProps>(
  ({ className, htmlFor, label, required, error, helperText, children, ...props }, ref) => {
    const errorId = error ? `${htmlFor}-error` : undefined;
    const helperId = !error && helperText ? `${htmlFor}-helper` : undefined;

    return (
      <div ref={ref} className={cn("flex flex-col gap-1.5", className)} {...props}>
        <Label htmlFor={htmlFor} className={cn(error && "text-destructive")}>
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>
        {children}
        {error ? (
          <p id={errorId} className="text-xs text-destructive" role="alert">
            {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-muted-foreground">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);
FormField.displayName = "FormField";

export { FormField };
export default FormField;
