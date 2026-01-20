import Setting from "../../models/Setting";
import AppError from "../../errors/AppError";

interface AIResponse {
    message: string;
    stages?: string[] | null;
}

const AIService = async (history: any[], tenantId: number | string): Promise<AIResponse> => {
    // Buscar API Key nas configurações do tenant
    const apiKeySetting = await Setting.findOne({
        where: { key: "aiApiKey", tenantId }
    });

    const providerSetting = await Setting.findOne({
        where: { key: "aiProvider", tenantId }
    });

    const modelSetting = await Setting.findOne({
        where: { key: "aiModel", tenantId }
    });

    let apiKey = apiKeySetting?.value;
    let provider = providerSetting?.value || "openai";

    // Fallback para variáveis de ambiente se não houver no banco
    if (!apiKey) {
        if (process.env.OPENAI_API_KEY) {
            apiKey = process.env.OPENAI_API_KEY;
            provider = "openai";
        }
    }

    if (!apiKey) {
        console.error("AIService: No API Key found in Settings or ENV.");
        throw new AppError("ERR_NO_AI_API_KEY");
    }

    // Configurar endpoint base
    let baseURL = "https://api.openai.com/v1";
    let model = "gpt-4o-mini"; // Better default for OpenAI

    if (provider === "grok") {
        baseURL = "https://api.x.ai/v1";
        model = "grok-beta";
    }

    if (modelSetting?.value) {
        model = modelSetting.value;
    }

    const guidePromptSetting = await Setting.findOne({
        where: { key: "aiGuidePrompt", tenantId }
    });

    // CONTEXTO PRIORITÁRIO
    const guidePrompt = guidePromptSetting?.value
        ? `\nCONTEXTO DE NEGÓCIO (IMPORTANTÍSSIMO - SIGA ESTRITAMENTE):\n${guidePromptSetting.value}\n`
        : "";

    const systemPrompt = `
    ${guidePrompt}
    Atue como um Especialista em CRM e Processos.
    O usuário quer criar um Pipeline (Funil) de vendas ou atendimento.

    SEU OBJETIVO:
    1. Entender o negócio do usuário através de perguntas (se o Contexto de Negócio acima não for suficiente).
    2. Sugerir as etapas ideais para o processo dele.

    REGRAS DE RESPOSTA (JSON):
    Retorne SEMPRE um JSON com a seguinte estrutura:
    {
      "message": "Texto da sua resposta ou pergunta para o usuário aqui.",
      "stages": ["Nome da Etapa 1", "Etapa 2", ...] || null
    }

    COMPORTAMENTO:
    - Se você ainda precisa de informações ou o Contexto de Negócio pede para perguntar primeiro: envie a pergunta em "message" e deixe "stages" como null.
    - Se você já tem certeza do fluxo (pelo histórico ou contexto): envie a explicação em "message" e a lista de etapas em "stages".
    - Responda de forma curta e direta na "message".

    Exemplo de Conversa:
    JSON: { "message": "Para qual nicho seria esse funil? Imobiliária ou Varejo?", "stages": null }

    Exemplo de Solução:
    JSON: { "message": "Aqui está uma sugestão para Imobiliária baseada no seu contexto.", "stages": ["Prospecção", "Visita", "Proposta", "Contrato"] }
    `;

    try {
        const response = await fetch(`${baseURL}/chat/completions`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    ...history // Histórico completo enviado pelo front
                ],
                temperature: model.startsWith("o1") ? 1 : 0.7
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error("AI API Error:", response.status, errText);

            let detailedError = `Integration error: ${response.status} ${response.statusText}`;
            try {
                const errJson = JSON.parse(errText);
                if (errJson.error && errJson.error.message) {
                    detailedError = errJson.error.message;
                }
            } catch (_) { }

            throw new AppError(detailedError);
        }

        const data: any = await response.json();
        const content = data.choices[0].message.content;

        // Tentar limpar json - remove markdown code blocks e prefixos comuns
        let cleaned = content
            .replace(/```json/gi, "")
            .replace(/```/g, "")
            .trim();

        // Remove prefixos comuns como "JSON:", "json:", etc.
        cleaned = cleaned.replace(/^JSON:\s*/i, "").trim();

        // Tenta extrair apenas o objeto JSON se houver texto antes/depois
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            cleaned = jsonMatch[0];
        }

        try {
            const json = JSON.parse(cleaned);
            return json; // Retorna { message, stages }
        } catch (e) {
            console.error("JSON Parse Error:", e, "Content:", content);
            // Se falhar o JSON, assume que o texto todo é mensagem
            return {
                message: content,
                stages: null
            };
        }

    } catch (err: any) {
        console.error("AI Service Component Error:", err);
        if (err instanceof AppError) {
            throw err;
        }
        throw new AppError(`AI Service Failed: ${err.message}`);
    }
};

export default AIService;
