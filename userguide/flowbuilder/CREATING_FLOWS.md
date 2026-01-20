# 🤖 Criando Fluxos (Flow Builder)

O **Flow Builder** permite criar assistentes virtuais (chatbots) desenhando caixinhas na tela, sem precisar programar.

## Conceitos Básicos

*   **Gatilho (Start)**: O que inicia o robô (ex: Uma palavra-chave "Menu" ou qualquer mensagem recebida "Boas Vindas").
*   **Nós (Caixas)**: São as ações que o robô vai fazer.
*   **Conexões (Linhas)**: A ordem das ações.

## Principais Blocos
1.  **Enviar Mensagem**: O robô manda um texto, imagem ou áudio.
2.  **Menu de Opções**: O robô manda uma lista (1. Vendas, 2. Suporte). Dependendo do que o cliente responder, você puxa uma linha para caminhos diferentes.
3.  **Transferir (Handover)**: Encerra o robô e joga o cliente para uma **Fila de Atendimento** humana.

## Criando seu Primeiro Fluxo
1.  Vá em **Flow Builder** > **Novo Fluxo**.
2.  Dê um nome para o fluxo.
3.  Arraste um bloco **Start** da esquerda.
4.  Arraste um bloco **Content (Mensagem)**.
5.  **Ligue os pontos**: Clique na bolinha azul do Start e arraste até a bolinha do Message.
6.  Clique no bloco Message para digitar o texto (ex: "Olá! Como posso ajudar?").
7.  Adicione um bloco de Opções ou Transferência para finalizar.
8.  **Salve** o fluxo.

> [!WARNING]
> **Teste sempre!** Use seu próprio WhatsApp pessoal para testar o fluxo antes de ativar para todos os clientes.
