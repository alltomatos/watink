import React from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PERSONA_SECTIONS, PersonaSectionValues } from "./personaSections";

interface PersonaSectionsEditorProps {
    values: PersonaSectionValues;
    onChange: (key: string, value: string) => void;
}

/** Editor guiado da persona: 5 seções do framework (identidade, traços,
 * tom, fronteiras, relacionamento), cada uma com um placeholder explicando o
 * que preencher. O texto final salvo é a composição de todas — ver
 * `personaSections.ts`. Legado (persona salva antes desta feature, sem os
 * marcadores) aparece numa seção extra para não perder conteúdo. */
const PersonaSectionsEditor: React.FC<PersonaSectionsEditorProps> = ({ values, onChange }) => {
    return (
        <div className="flex flex-col gap-5">
            {values.legacy && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3">
                    <Label>Texto livre (versão anterior)</Label>
                    <p className="text-xs text-muted-foreground">
                        Conteúdo salvo antes deste editor guiado. Continua valendo — edite aqui ou
                        distribua o conteúdo nas seções abaixo.
                    </p>
                    <Textarea
                        value={values.legacy}
                        onChange={(e) => onChange("legacy", e.target.value)}
                        rows={3}
                    />
                </div>
            )}
            {PERSONA_SECTIONS.map((section) => (
                <div key={section.key} className="flex flex-col gap-1.5">
                    <Label>{section.title}</Label>
                    <p className="text-xs text-muted-foreground">{section.subtitle}</p>
                    <Textarea
                        value={values[section.key]}
                        onChange={(e) => onChange(section.key, e.target.value)}
                        rows={4}
                        placeholder={section.placeholder}
                    />
                </div>
            ))}
        </div>
    );
};

export default PersonaSectionsEditor;
