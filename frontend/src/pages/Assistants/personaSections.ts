/**
 * O campo `persona` salvo no backend continua sendo um único texto livre
 * (prompt de sistema) — nenhuma mudança de schema. Este módulo só organiza a
 * EDIÇÃO desse texto em 5 seções guiadas (framework de design de persona de
 * IA), compondo/decompondo por marcadores de cabeçalho reconhecíveis. Persona
 * salva antes desta feature (texto livre sem os marcadores) cai inteira na
 * seção "legacy" e continua editável sem perda de conteúdo.
 */

export interface PersonaSectionDef {
    key: string;
    marker: string;
    title: string;
    subtitle: string;
    placeholder: string;
}

export const PERSONA_SECTIONS: PersonaSectionDef[] = [
    {
        key: "identity",
        marker: "## Identidade e Propósito",
        title: "1. Identidade e Propósito",
        subtitle: 'Define a base da existência da IA e sua função no mundo do usuário ("Quem").',
        placeholder:
            "Papel/Profissão: é um tutor acadêmico, concierge de hotel, suporte técnico, amigo virtual?\n" +
            "Nome e Origem: a IA tem nome próprio? Assume abertamente que é uma IA ou simula uma persona humana?\n" +
            "Missão Principal: qual o objetivo central de cada interação? (ex: \"resolver o problema no menor tempo possível\")",
    },
    {
        key: "personality",
        marker: "## Traços de Personalidade",
        title: "2. Traços de Personalidade",
        subtitle: "Determina como a IA se comporta emocionalmente e psicologicamente (o \"Caráter\").",
        placeholder:
            "Adjetivos Centrais: 3 a 5 características (ex: empática, direta, bem-humorada, rigorosa, paciente, enérgica).\n" +
            "Humor e Tolerância: a IA faz piadas? Entende sarcasmo? Como reage a um usuário frustrado ou confuso?",
    },
    {
        key: "tone",
        marker: "## Tom e Voz",
        title: "3. Tom e Voz",
        subtitle: "A manifestação prática da personalidade através das palavras escolhidas (a \"Comunicação\").",
        placeholder:
            "Nível de Formalidade: vocabulário culto/técnico (jurídico) ou casual/acessível (gírias, emojis, entretenimento)?\n" +
            "Estilo de Resposta: respostas curtas em tópicos, ou longas e narrativas?\n" +
            "Variação Contextual: o tom se mantém constante ou se adapta ao assunto (ex: descontraído em metas, sério em riscos)?",
    },
    {
        key: "boundaries",
        marker: "## Domínio de Conhecimento e Limitações",
        title: "4. Domínio de Conhecimento e Limitações",
        subtitle: "Estabelece o que a IA sabe e, mais importante, o que ela não faz (as \"Fronteiras\").",
        placeholder:
            "Especialidade: em quais temas ela é uma autoridade inquestionável?\n" +
            "Lidar com o Desconhecido: como responde quando não sabe ou a pergunta foge do escopo? (ex: \"isso foge da minha área, mas posso ajudar com X\" vs. \"não sei\")\n" +
            "Diretrizes Éticas: como reage a pedidos inadequados, ofensivos ou perigosos.",
    },
    {
        key: "relationship",
        marker: "## Dinâmica de Relacionamento",
        title: "5. Dinâmica de Relacionamento",
        subtitle: "Define o nível de hierarquia e interação com o usuário (a \"Conexão\").",
        placeholder:
            "Posicionamento: subordinado (\"como desejar, executarei agora\"), guia/mentor (\"vamos aprender juntos, tente o passo 1\") ou parceiro (\"o que você acha dessa ideia?\")?\n" +
            "Proatividade: só responde passivamente ao que foi perguntado, ou antecipa necessidades e faz perguntas para guiar a conversa?",
    },
];

export type PersonaSectionValues = Record<string, string> & { legacy: string };

const emptySectionValues = (): PersonaSectionValues => {
    const values = { legacy: "" } as PersonaSectionValues;
    PERSONA_SECTIONS.forEach((s) => {
        values[s.key] = "";
    });
    return values;
};

/** Decompõe o texto salvo em seções, pelos marcadores `## Título`. Texto sem
 * nenhum marcador reconhecido (persona legada, pré-feature) vai inteiro para
 * `legacy`. */
export function parsePersonaSections(raw: string): PersonaSectionValues {
    const values = emptySectionValues();
    if (!raw || !raw.trim()) return values;

    const markerPositions = PERSONA_SECTIONS.map((s) => ({
        key: s.key,
        index: raw.indexOf(s.marker),
    })).filter((m) => m.index !== -1);

    if (markerPositions.length === 0) {
        values.legacy = raw;
        return values;
    }

    markerPositions.sort((a, b) => a.index - b.index);

    const leading = raw.slice(0, markerPositions[0].index).trim();
    if (leading) values.legacy = leading;

    markerPositions.forEach((m, i) => {
        const def = PERSONA_SECTIONS.find((s) => s.key === m.key)!;
        const start = m.index + def.marker.length;
        const end = i + 1 < markerPositions.length ? markerPositions[i + 1].index : raw.length;
        values[m.key] = raw.slice(start, end).trim();
    });

    return values;
}

/** Recompõe o texto final salvo no backend a partir das seções preenchidas. */
export function buildPersonaFromSections(values: PersonaSectionValues): string {
    const parts: string[] = [];
    if (values.legacy.trim()) parts.push(values.legacy.trim());
    PERSONA_SECTIONS.forEach((s) => {
        const content = values[s.key]?.trim();
        if (content) parts.push(`${s.marker}\n${content}`);
    });
    return parts.join("\n\n");
}
