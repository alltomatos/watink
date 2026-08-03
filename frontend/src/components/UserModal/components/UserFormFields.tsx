import React from "react";
import { Field, FieldProps } from "formik";
import { Eye, EyeOff } from "lucide-react";

import { i18n } from "../../../translate/i18n";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form-field";
import { cn } from "@/lib/utils";

interface UserFormFieldsProps {
  touched: Partial<Record<"name" | "email" | "password", string>>;
  errors: Partial<Record<"name" | "email" | "password", string>>;
  showPassword: boolean;
  onTogglePassword: () => void;
}

const UserFormFields: React.FC<UserFormFieldsProps> = ({
  touched,
  errors,
  showPassword,
  onTogglePassword,
}) => {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <FormField htmlFor="name" label={i18n.t("userModal.form.name")} required error={touched.name ? errors.name : undefined}>
          <Field name="name">
            {({ field }: FieldProps) => (
              <Input
                {...field}
                id="name"
                autoFocus
                className={cn(touched.name && errors.name && "border-destructive")}
              />
            )}
          </Field>
        </FormField>

        <FormField htmlFor="password" label={i18n.t("userModal.form.password")} required error={touched.password ? errors.password : undefined}>
          <div className="relative">
            <Field name="password">
              {({ field }: FieldProps) => (
                <Input
                  {...field}
                  id="password"
                  type={showPassword ? "text" : "password"}
                  className={cn(
                    "pr-10",
                    touched.password && errors.password && "border-destructive"
                  )}
                />
              )}
            </Field>
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={onTogglePassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </FormField>
      </div>

      <FormField htmlFor="email" label={i18n.t("userModal.form.email")} required error={touched.email ? errors.email : undefined}>
        <Field name="email">
          {({ field }: FieldProps) => (
            <Input
              {...field}
              id="email"
              type="email"
              className={cn(touched.email && errors.email && "border-destructive")}
            />
          )}
        </Field>
      </FormField>
    </>
  );
};

export default UserFormFields;
