/* @jsxImportSource react */
import React, { useEffect, useState } from "react";
import { Info, Loader2 } from "lucide-react";

import api from "../../../services/api";
import toastError from "../../../errors/toastError";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "../../../components/ui/card";
import { Badge } from "../../../components/ui/badge";

interface UpdateStatus {
  status: "up_to_date" | "behind" | "unknown";
  commitsBehind: number;
}

interface AboutInfo {
  version: string;
  commit: string;
  branch: string;
  commitDate: string;
  updateStatus: UpdateStatus;
  database: {
    engine: string;
    version: string;
  };
  changelog: string;
}

const formatCommitDate = (iso: string) => {
  if (!iso || iso === "unknown") return "desconhecida";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "desconhecida";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

const UpdateStatusBadge: React.FC<{ status?: UpdateStatus }> = ({ status }) => {
  if (!status || status.status === "unknown") {
    return <Badge variant="secondary">Status de atualização desconhecido</Badge>;
  }
  if (status.status === "up_to_date") {
    return <Badge variant="default">Atualizado</Badge>;
  }
  const count = status.commitsBehind;
  return (
    <Badge variant="destructive">
      {count > 0
        ? `${count} ${count === 1 ? "novo commit disponível" : "novos commits disponíveis"}`
        : "Novos commits disponíveis"}
    </Badge>
  );
};

const AboutSection: React.FC = () => {
  const [info, setInfo] = useState<AboutInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    api
      .get<AboutInfo>("/about")
      .then(({ data }) => setInfo(data))
      .catch((err) => {
        toastError(err);
        setError(true);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Info className="h-5 w-5" />
          Sobre
        </CardTitle>
        <CardDescription>
          Versão do sistema e build.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : error || !info ? (
          <p className="text-sm text-muted-foreground">
            Não foi possível carregar as informações do sistema.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-sm">
              <dt className="text-muted-foreground">Versão</dt>
              <dd className="text-foreground font-mono">{info.version}</dd>
              <dt className="text-muted-foreground">Commit</dt>
              <dd className="text-foreground font-mono">
                {info.commit} ({info.branch})
              </dd>
              <dt className="text-muted-foreground">Data do commit</dt>
              <dd className="text-foreground font-mono">{formatCommitDate(info.commitDate)}</dd>
              <dt className="text-muted-foreground">Atualização</dt>
              <dd>
                <UpdateStatusBadge status={info.updateStatus} />
              </dd>
              <dt className="text-muted-foreground">Banco de dados</dt>
              <dd className="text-foreground font-mono">
                {info.database.engine} {info.database.version}
              </dd>
            </dl>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AboutSection;
