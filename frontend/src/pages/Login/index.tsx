/* @jsxImportSource react */
import React, { useState, useEffect, useContext } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import { Lock, Eye, EyeOff, Loader2 } from "lucide-react";

import { i18n } from "../../translate/i18n";
import { AuthContext } from "../../context/Auth/AuthContext";
import api from "../../services/api";
import { getBackendUrl } from "../../helpers/urlUtils";

import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import { Card, CardContent } from "../../components/ui/card";

const Login = () => {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState({ email: searchParams.get("email") || "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [settings, setSettings] = useState({
    loginLayout: "split_left", // split_left, split_right, centered
    loginBackground: "", // url
    systemLogo: "",
  });

  const { handleLogin } = useContext(AuthContext);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data } = await api.get("/public-settings");
        const settingsData = Array.isArray(data) ? data : [];

        const layoutSetting = settingsData.find(s => s.key === "login_layout");
        const bgSetting = settingsData.find(s => s.key === "login_backgroundImage");
        const logoSetting = settingsData.find(s => s.key === "systemLogo");

        setSettings({
          loginLayout: layoutSetting?.value || "split_left",
          loginBackground: getBackendUrl(bgSetting?.value) ?? "/login-background.png",
          systemLogo: getBackendUrl(logoSetting?.value) ?? "/logo.png",
        });
      } catch (err) {
        console.error("Error fetching settings for login", err);
      }
    };
    fetchSettings();

    // Registro self-service (Onda 6, ADR 0007): a rota só existe quando o
    // control plane Watink SaaS está configurado nesta instalação — em
    // instalações sem ele, a chamada falha (404) e o botão fica escondido.
    const checkRegistration = async () => {
      try {
        const { data } = await api.get("/register/plans");
        setRegistrationOpen(Boolean(data?.registrationOpen));
      } catch {
        setRegistrationOpen(false);
      }
    };
    checkRegistration();
  }, []);

  const handleChangeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUser({ ...user, [e.target.name]: e.target.value });
  };

  const handlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await handleLogin(user, rememberMe);
    } finally {
      setLoading(false);
    }
  };

  const isCentered = settings.loginLayout === "centered";
  const isRightForm = settings.loginLayout === "split_right";

  const renderLoginForm = () => (
    <div className="flex flex-col items-center w-full max-w-sm mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      <div className="flex flex-col items-center space-y-2 text-center">
        {settings.systemLogo ? (
          <img
            src={settings.systemLogo}
            alt="Logo"
            className="h-16 w-auto mb-4 object-contain"
            onError={(e) => { (e.target as HTMLImageElement).onerror = null; (e.target as HTMLImageElement).src = "/logo.png"; }}
          />
        ) : (
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <Lock className="h-6 w-6 text-primary" />
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">
          {i18n.t("login.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          Entre com suas credenciais para acessar a plataforma
        </p>
      </div>

      <form onSubmit={handlSubmit} className="grid gap-4 w-full">
        <div className="grid gap-2">
          <Label htmlFor="email">{i18n.t("login.form.email")}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="nome@empresa.com"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect="off"
            required
            value={user.email}
            onChange={handleChangeInput}
            className="h-11"
          />
        </div>
        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{i18n.t("login.form.password")}</Label>
            <RouterLink
              to="/forgetpassword"
              className="text-sm font-medium text-primary hover:underline"
            >
              Esqueceu a senha?
            </RouterLink>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              required
              value={user.password}
              onChange={handleChangeInput}
              className="h-11 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" /> }
            </button>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox 
            id="rememberMe" 
            checked={rememberMe}
            onCheckedChange={(checked) => setRememberMe(checked as boolean)}
          />
          <label
            htmlFor="rememberMe"
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
          >
            Mantenha-me conectado
          </label>
        </div>
        <Button type="submit" className="h-11 w-full text-base font-bold" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Entrando...
            </>
          ) : (
            i18n.t("login.buttons.submit")
          )}
        </Button>
      </form>

      {registrationOpen && (
        <div className="text-center text-sm text-muted-foreground">
          Não tem uma conta?{" "}
          <RouterLink to="/planos" className="font-medium text-primary hover:underline">
            {i18n.t("login.buttons.register")}
          </RouterLink>
        </div>
      )}
    </div>
  );

  if (isCentered) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background relative overflow-hidden">
        {/* Background Decorative Elements */}
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <Card className="w-full max-w-md z-10 shadow-2xl border-border/40 backdrop-blur-sm bg-card/95">
          <CardContent className="pt-8 pb-8 px-8">
            {renderLoginForm()}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex w-full overflow-hidden bg-background">
      {/* Form Side */}
      <div className={`flex flex-col items-center justify-center flex-1 px-8 lg:px-24 z-10 bg-card ${isRightForm ? 'order-2' : 'order-1 border-right shadow-2xl'}`}>
        {renderLoginForm()}
      </div>

      {/* Image Side */}
      <div className={`hidden lg:flex flex-[1.5] relative ${isRightForm ? 'order-1' : 'order-2'}`}>
        <div 
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[10000ms] hover:scale-110"
          style={{ backgroundImage: `url(${settings.loginBackground})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-background/20 to-transparent flex flex-col justify-end p-12">
          <div className="max-w-xl space-y-4 animate-in fade-in slide-in-from-left-8 duration-1000">
            <h2 className="text-4xl font-bold text-white drop-shadow-lg">
              Conecte-se com seus clientes em tempo real.
            </h2>
            <p className="text-xl text-white/90 drop-shadow-md">
              A plataforma multicanal definitiva para gestão de atendimento e automação.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
