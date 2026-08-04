import React from "react";
import { Lock, Clock, PlugZap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router";
import { GroupsApiError } from "./groupTypes";

interface GroupsErrorStateProps {
    error: GroupsApiError;
}

/**
 * Dedicated states for 402 (plugin blocked)/429 (throttled)/501 (provider
 * doesn't support groups) — plan §6.5: these are NEVER a generic error
 * toast, each has its own explanation and (where relevant) a CTA.
 */
const GroupsErrorState: React.FC<GroupsErrorStateProps> = ({ error }) => {
    const navigate = useNavigate();

    if (error.kind === "blocked") {
        return (
            <div className="flex flex-col items-center justify-center gap-4 h-full text-center px-6">
                <div className="rounded-full bg-[var(--status-warning-bg)] p-4">
                    <Lock className="h-8 w-8 text-[var(--status-warning-text)]" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold">Plugin bloqueado</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        A gestão de Grupos e Comunidades exige o plugin "Grupos e Comunidades" ativo e licenciado.
                    </p>
                </div>
                <Button onClick={() => navigate("/admin/settings/marketplace")}>Ir para o Marketplace</Button>
            </div>
        );
    }

    if (error.kind === "rateLimited") {
        return (
            <div className="flex flex-col items-center justify-center gap-4 h-full text-center px-6">
                <div className="rounded-full bg-[var(--status-warning-bg)] p-4">
                    <Clock className="h-8 w-8 text-[var(--status-warning-text)]" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold">Muitas ações em sequência</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        {error.message || "Aguarde um instante antes de tentar de novo — isso protege o número contra banimento por atividade administrativa em massa."}
                    </p>
                </div>
            </div>
        );
    }

    if (error.kind === "notSupported") {
        return (
            <div className="flex flex-col items-center justify-center gap-4 h-full text-center px-6">
                <div className="rounded-full bg-[var(--status-default-bg)] p-4">
                    <PlugZap className="h-8 w-8 text-[var(--status-default-text)]" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold">Conexão sem suporte a grupos</h3>
                    <p className="text-sm text-muted-foreground mt-1 max-w-md">
                        A conexão selecionada não suporta gestão de grupos. Selecione outra conexão.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center gap-4 h-full text-center px-6">
            <div className="rounded-full bg-[var(--status-error-bg)] p-4">
                <AlertTriangle className="h-8 w-8 text-[var(--status-error-text)]" />
            </div>
            <div>
                <h3 className="text-lg font-semibold">Não foi possível carregar</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-md">{error.message}</p>
            </div>
        </div>
    );
};

export default GroupsErrorState;
