import React from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardFooter,
} from "../../../components/ui/card";
import { getBackendUrl } from "../../../helpers/urlUtils";
import type { MarketplacePlugin } from "../marketplaceTypes";

interface PluginGridProps {
  plugins: MarketplacePlugin[];
  onPluginClick: (plugin: MarketplacePlugin) => void;
}

export function PluginGrid({ plugins, onPluginClick }: PluginGridProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {plugins.map((plugin) => (
        <Card
          key={plugin.id}
          className="group cursor-pointer hover:shadow-lg transition-all duration-300 flex flex-col"
          onClick={() => onPluginClick(plugin)}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-primary/10 rounded-lg text-primary">
                <img
                  src={getBackendUrl(plugin.iconUrl)}
                  alt={plugin.name}
                  className="h-6 w-6 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              </div>
              <div className="flex items-center gap-2">
                {plugin.price !== undefined && (
                  <Badge variant="outline" className="text-[10px]">
                    {plugin.price ? `R$ ${plugin.price} + impostos` : "Gratuito"}
                  </Badge>
                )}
                {plugin.installed && (
                  <Badge
                    variant="secondary"
                    className="bg-green-100 text-green-700 hover:bg-green-100 border-none"
                  >
                    <CheckCircle2 size={12} className="mr-1" />
                    Instalado
                  </Badge>
                )}
              </div>
            </div>
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {plugin.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <p className="text-sm text-muted-foreground line-clamp-3">
              {plugin.description || "Nenhuma descrição fornecida para este plugin."}
            </p>
          </CardContent>
          <CardFooter className="pt-4 border-t border-border/50">
            <Button variant="ghost" className="w-full text-xs" size="sm">
              Ver Detalhes
              <ExternalLink size={14} className="ml-2" />
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
