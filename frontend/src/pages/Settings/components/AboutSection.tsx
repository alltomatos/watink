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

interface AboutInfo {
  version: string;
  commit: string;
  branch: string;
  database: {
    engine: string;
    version: string;
  };
  changelog: string;
}

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
          Versão do sistema, build e changelog.
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
              <dt className="text-muted-foreground">Banco de dados</dt>
              <dd className="text-foreground font-mono">
                {info.database.engine} {info.database.version}
              </dd>
            </dl>
            <div>
              <p className="mb-2 text-sm font-medium text-foreground">
                Changelog
              </p>
              <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-md border bg-muted/50 p-3 text-xs text-foreground">
                {info.changelog}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AboutSection;
