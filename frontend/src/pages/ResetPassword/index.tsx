/* @jsxImportSource react */
import React, { useState } from "react";
import { Link as RouterLink, useNavigate, useParams } from "react-router";
import { Lock, Eye, EyeOff } from "lucide-react";
import { toast } from "react-toastify";

import { i18n } from "../../translate/i18n";
import api from "../../services/api";

import { PageContainer } from "../../components/ui/page-layout";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Card, CardContent } from "../../components/ui/card";

// ─── Component ────────────────────────────────────────────────────────────────

const ResetPassword: React.FC = () => {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error(i18n.t("resetPassword.error.mismatch"));
      return;
    }

    try {
      setLoading(true);
      await api.post("/auth/reset-password", {
        token,
        password,
      });

      toast.success(i18n.t("resetPassword.success"));
      navigate("/login");
    } catch {
      toast.error(i18n.t("resetPassword.error.failed"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="flex h-screen items-center justify-center bg-muted/20">
      <Card className="w-full max-w-sm shadow-md">
        <CardContent className="pt-6 space-y-6">
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-xl font-bold">{i18n.t("resetPassword.title")}</h1>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">{i18n.t("resetPassword.form.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">{i18n.t("resetPassword.form.confirmPassword")}</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Processando..." : i18n.t("resetPassword.buttons.submit")}
            </Button>
          </form>

          <RouterLink to="/login" className="block text-center text-sm text-primary hover:underline">
            {i18n.t("resetPassword.buttons.login")}
          </RouterLink>
        </CardContent>
      </Card>
    </PageContainer>
  );
};

export default ResetPassword;
