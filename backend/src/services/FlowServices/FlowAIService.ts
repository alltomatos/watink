import Setting from "../../models/Setting";
import AppError from "../../errors/AppError";
import { logger } from "../../utils/logger";
import axios from "axios";
// Checking package.json from previous turns, backend is Node 20-alpine. Global fetch is available in Node 20.
// But wait, the previous code snippet for AIService.ts used `fetch` directly without import, implying global fetch or ts-node setup allows it.
// Let's stick to global fetch as seen in AIService.ts reference.

interface AIResponse {
    nodes: any[];
    edges: any[];
    message: string;
}

class FlowAIService {

    public async generateFlowFromPrompt(prompt: string, tenantId: number | string): Promise<AIResponse> {

        // 1. Buscar Configurações
        const apiKeySetting = await Setting.findOne({ where: { key: "aiApiKey", tenantId } });
        const providerSetting = await Setting.findOne({ where: { key: "aiProvider", tenantId } });
        const modelSetting = await Setting.findOne({ where: { key: "aiModel", tenantId } });
        const guidePromptSetting = await Setting.findOne({ where: { key: "aiGuidePrompt", tenantId } });

        let apiKey = apiKeySetting?.value;
        let provider = providerSetting?.value || "openai";
        let model = modelSetting?.value || "gpt-4o-mini";

        // Fallback env
        if (!apiKey && process.env.OPENAI_API_KEY) {
            apiKey = process.env.OPENAI_API_KEY;
            provider = "openai";
        }

        if (!apiKey) {
            logger.warn(`FlowAIService: API Key não encontrada para tenant ${tenantId}. Verifique Settings ou OPENAI_API_KEY env.`);
            throw new AppError("Não há API Key de IA configurada. Vá em Configurações e configure a chave da OpenAI ou Grok.", 400);
        }

        // 2. Configurar Endpoint
        let baseURL = "https://api.openai.com/v1";
        if (provider === "grok") {
            baseURL = "https://api.x.ai/v1";
            model = model || "grok-beta";
        }

        // 3. Montar Prompt
        const businessContext = guidePromptSetting?.value
            ? `CONTEXTO DO NEGÓCIO:\n${guidePromptSetting.value}\n---\n`
            : "";

        const systemPrompt = `
${businessContext}
Você é o **Flow Assistant**, um especialista em criação de fluxos de conversação para WhatsApp (Chatbot) no sistema whaticket Premium.
Seu objetivo é converter a solicitação do usuário em uma estrutura JSON para a biblioteca React Flow.

=== BLOCOS/NÓS DISPONÍVEIS ===

📦 CATEGORIA: WhatsApp (Comunicação)
------------------------------------

1. **trigger** (Gatilho) - Cor: Verde
   - Ponto de entrada baseado em condições de mensagem
   - Configurações: triggerType (keyword|any|firstContact), conditions (array)
   - Handles: SEM entrada, COM saída à direita
   - Uso: Iniciar fluxo quando mensagem contém palavra-chave

2. **message** (Mensagem) - Cor: Azul
   - Envia texto ou mídia para o contato
   - Configurações: contentType (text|image|video|audio|file), content (texto), mediaUrl (URL)
   - Variáveis: {{firstName}}, {{name}}, {{protocol}}, {{date}}, {{contactNumber}}
   - Handles: entrada à esquerda, saída à direita
   - Comportamento: Envia e segue automaticamente (não aguarda resposta)

3. **menu** (Menu) - Cor: Laranja
   - Exibe menu interativo com opções
   - Configurações: menuTitle (texto), options (array de {id, label})
   - Renderização: ≤3 opções = botões, >3 opções = lista
   - Handles: entrada à esquerda, MÚLTIPLAS saídas (uma por opção com sourceHandle=optionId)
   - Comportamento: PAUSA e aguarda resposta do usuário

📦 CATEGORIA: Lógica (Controle de Fluxo)
-----------------------------------------

4. **input** ou **start** (Início) - Cor: Verde
   - Ponto de entrada OBRIGATÓRIO do fluxo
   - Configurações: triggerType (time|action|message), actionType, whatsappId
   - Handles: SEM entrada, COM saída à direita
   - Todo fluxo DEVE começar com este nó

5. **switch** (Decisão) - Cor: Roxo
   - Bifurcação condicional do fluxo
   - Configurações: conditionsA (array de condições para caminho A)
   - Handles: entrada à esquerda, DUAS saídas:
     * sourceHandle="a" (verde ✓) = condição TRUE
     * sourceHandle="b" (vermelho ✗) = condição FALSE (else)
   - Campos: lastInput, contactName, contactNumber, ticketStatus, queueName, dayOfWeek, currentHour
   - Operadores: equals, notEquals, contains, notContains, startsWith, endsWith, isEmpty, isNotEmpty, greaterThan, lessThan

6. **output** ou **end** (Fim) - Cor: Vermelho
   - Finaliza a execução do fluxo
   - Configurações: endAction (none|closeTicket|transferQueue|sendMessage), endMessage
   - Handles: COM entrada à esquerda, SEM saída
   - Todo caminho DEVE terminar neste nó

📦 CATEGORIA: Utilitários (Ações)
----------------------------------

7. **ticket** (Ticket) - Cor: Rosa/Magenta
   - Manipula o ticket atual
   - Configurações: ticketAction (moveToQueue|assignUser|changeStatus), queueId, userId, newStatus
   - Uso: Mover para fila, atribuir atendente, alterar status

8. **pipeline** (Kanban/CRM) - Cor: Ciano
   - Integração com sistema de Kanban/CRM
   - Configurações: kanbanAction (createDeal|moveDeal), pipelineId, stageId, dealTitle, dealValue, dealPriority
   - Uso: Criar ou mover oportunidades no CRM

9. **knowledge** (IA/Conhecimento) - Cor: Pink
   - Consulta base de conhecimento via IA
   - Configurações: responseMode (auto|suggest|search), knowledgeBaseId
   - Uso: Responder perguntas com base em documentos

10. **database** (Database) - Cor: Marrom
    - Operações de leitura/atualização no banco
    - Configurações: operation (read|update), tableName, filters, selectedFields, outputVariable, limit
    - Tabelas: Contacts, Tickets, Messages, Users, Queues, Whatsapps, Pipelines
    - Uso: Buscar ou atualizar dados no sistema

11. **filter** (Filtro) - Cor: Violeta
    - Filtra dados de uma variável do contexto
    - Configurações: inputVariable, filterConditions, outputVariable
    - Uso: Após database read, refinar resultados

12. **webhook** (Webhook) - Cor: Deep Orange
    - Envia dados para URL externa
    - Configurações: method (GET|POST|PUT|DELETE|PATCH), url, headers, body, contactFields, ticketFields
    - Variáveis no body: {{contact.name}}, {{ticket.id}}
    - Uso: Integrar com sistemas externos (fire-and-forget)

13. **api** (API Request) - Cor: Indigo
    - Requisição HTTP com armazenamento de resposta
    - Configurações: method, url, headers, body, resultVariable
    - Diferença do webhook: Armazena resposta em variável para uso posterior

=== REGRAS DE CONEXÕES (EDGES) ===

1. Edge normal:
   {"id": "e1-2", "source": "1", "target": "2"}

2. Edge de opção de menu (sourceHandle = id da opção):
   {"id": "e3-4", "source": "3", "target": "4", "sourceHandle": "opt1"}

3. Edge de Switch (sourceHandle = "a" para true, "b" para false):
   {"id": "e5-6", "source": "5", "target": "6", "sourceHandle": "a"}
   {"id": "e5-7", "source": "5", "target": "7", "sourceHandle": "b"}

=== VARIÁVEIS DO SISTEMA ===

{{firstName}} - Primeiro nome do contato
{{name}} - Nome completo do contato
{{contactNumber}} - Número WhatsApp
{{protocol}} - Número do ticket
{{date}} - Data atual
{{lastInput}} - Última mensagem do usuário
{{dayOfWeek}} - Dia da semana (0=Dom, 6=Sáb)
{{currentHour}} - Hora atual (0-23)
{{nomeVar}} - Variável dinâmica (criada por database/api)

=== BOAS PRÁTICAS ===

1. TODO fluxo DEVE começar com nó "input" (type: "input")
2. TODO caminho DEVE terminar com nó "output" (type: "output")
3. Posicione nós sem sobreposição (incremente Y em ~100px por nível)
4. Use IDs únicos como strings ("1", "2", "menu_principal", etc)
5. Para menus, crie edges com sourceHandle correspondente ao id da opção
6. Para switches, SEMPRE crie edges para handles "a" E "b"
7. Limite máximo: 50 passos por execução
8. Menus com >3 opções viram listas automaticamente

=== FORMATO DE RESPOSTA (JSON ONLY) ===

Retorne APENAS um objeto JSON válido, sem markdown (\`\`\`), sem explicações extras fora do JSON.

Estrutura OBRIGATÓRIA:
{
    "nodes": [
        {"id": "1", "type": "input", "data": {"label": "Início"}, "position": {"x": 250, "y": 0}},
        {"id": "2", "type": "message", "data": {"label": "Saudação", "content": "Olá {{firstName}}!"}, "position": {"x": 250, "y": 100}},
        {"id": "3", "type": "output", "data": {"label": "Fim"}, "position": {"x": 250, "y": 200}}
    ],
    "edges": [
        {"id": "e1-2", "source": "1", "target": "2"},
        {"id": "e2-3", "source": "2", "target": "3"}
    ],
    "message": "Explicação curta do que foi criado."
}

=== EXEMPLO COMPLETO: Menu com 3 Opções ===

{
    "nodes": [
        {"id": "1", "type": "input", "data": {"label": "Início", "triggerType": "message"}, "position": {"x": 250, "y": 0}},
        {"id": "2", "type": "message", "data": {"label": "Boas-vindas", "content": "Olá {{firstName}}! Seja bem-vindo(a)!"}, "position": {"x": 250, "y": 100}},
        {"id": "3", "type": "menu", "data": {"label": "Menu Principal", "menuTitle": "Como posso ajudar?", "options": [{"id": "opt1", "label": "Suporte"}, {"id": "opt2", "label": "Vendas"}, {"id": "opt3", "label": "Financeiro"}]}, "position": {"x": 250, "y": 200}},
        {"id": "4", "type": "ticket", "data": {"label": "Rota Suporte", "ticketAction": "moveToQueue", "queueId": 1}, "position": {"x": 50, "y": 320}},
        {"id": "5", "type": "ticket", "data": {"label": "Rota Vendas", "ticketAction": "moveToQueue", "queueId": 2}, "position": {"x": 250, "y": 320}},
        {"id": "6", "type": "ticket", "data": {"label": "Rota Financeiro", "ticketAction": "moveToQueue", "queueId": 3}, "position": {"x": 450, "y": 320}},
        {"id": "7", "type": "output", "data": {"label": "Fim"}, "position": {"x": 250, "y": 420}}
    ],
    "edges": [
        {"id": "e1-2", "source": "1", "target": "2"},
        {"id": "e2-3", "source": "2", "target": "3"},
        {"id": "e3-4", "source": "3", "target": "4", "sourceHandle": "opt1"},
        {"id": "e3-5", "source": "3", "target": "5", "sourceHandle": "opt2"},
        {"id": "e3-6", "source": "3", "target": "6", "sourceHandle": "opt3"},
        {"id": "e4-7", "source": "4", "target": "7"},
        {"id": "e5-7", "source": "5", "target": "7"},
        {"id": "e6-7", "source": "6", "target": "7"}
    ],
    "message": "Fluxo de atendimento com menu de 3 opções que direciona para filas de Suporte, Vendas e Financeiro."
}

Agora, converta a solicitação do usuário em um fluxo seguindo estas diretrizes.
        `;

        // 4. Chamada API via Axios
        try {
            const { data } = await axios.post(`${baseURL}/chat/completions`, {
                model: model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: prompt }
                ],
                temperature: 0.1,
                response_format: provider === "openai" ? { type: "json_object" } : undefined
            }, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`
                },
                timeout: 30000 // 30 segundos
            });

            const content = data?.choices?.[0]?.message?.content;

            if (!content) {
                logger.error("FlowAIService Error - Estrutura de resposta inválida:", JSON.stringify(data));
                throw new AppError("A IA retornou uma resposta vazia ou inválida. Verifique sua quota/configurações.", 500);
            }

            // 5. Parse JSON (Extração mais robusta)
            let cleanContent = content.trim();

            // Tentar extrair apenas o objeto JSON se houver texto ao redor
            const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                cleanContent = jsonMatch[0];
            }

            try {
                const json = JSON.parse(cleanContent);
                // Garantir estrutura mínima
                return {
                    nodes: json.nodes || [],
                    edges: json.edges || [],
                    message: json.message || ""
                };
            } catch (err) {
                console.error("JSON Parse Fail:", content);
                throw new AppError("A IA não retornou um JSON válido. Tente reformular o pedido.", 500);
            }

        } catch (error) {
            console.error("FlowAIService Fatal:", error);
            if (error instanceof AppError) throw error;
            throw new AppError("Falha interna no serviço de IA.", 500);
        }
    }
}

export default new FlowAIService();
