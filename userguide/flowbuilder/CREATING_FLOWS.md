# 🤖 Criando Fluxos (Flow Builder)

O **Flow Builder** é o "cérebro" das suas automações, permitindo criar assistentes virtuais (chatbots) inteligentes com uma interface visual de arrastar e soltar.

## Conceitos Básicos

*   **Nós (Nodes)**: São as caixas que realizam ações específicas.
*   **Conexões (Edges)**: São as linhas que ligam os nós, definindo o caminho da conversa.
*   **Gatilho (Start Node)**: Indica como o fluxo começa (ex: por palavras-chave ou qualquer mensagem).

## Principais Blocos

1.  **Mensagem (Message)**: Envia textos, áudios, imagens ou vídeos para o cliente.
2.  **Menu**: Cria opções numéricas para o cliente escolher o caminho.
3.  **Condicional (Switch)**: Verifica uma informação e decide qual caminho seguir.
4.  **Transferência (Ticket/Queue)**: Manda o cliente para uma fila humana ou atendente específico.
5.  **Kanban (Pipeline)**: Move o cliente automaticamente para uma etapa do seu funil de vendas.
6.  **Integração (Webhook/API)**: Envia ou recebe dados de sistemas externos.
7.  **Base de Conhecimento**: Consulta seus documentos de IA para responder dúvidas frequentes.

## Criando seu Primeiro Fluxo

1.  Acesse **Flow Builder** no menu lateral.
2.  Clique em **+ Novo Fluxo**.
3.  **O Nó Inicial**: Todo fluxo começa no nó **Start**. Clique nele para configurar se o robô deve responder a tudo ou a termos específicos. 
4.  **Adicionando Ações**: No menu lateral, escolha um nó (ex: Message) e arraste-o para o mapa.
5.  **Conectando**: Clique no ponto de saída de um nó e arraste até o ponto de entrada do próximo.
6.  **Simulação**: Use o botão **Simular** (ícone de chat) no topo da tela para testar o comportamento do robô antes de salvar.

> [!TIP]
> **Dica de Ouro**: Sempre finalize caminhos de erro ou opções inválidas com um nó de "Mensagem" amigável ou transferência para um humano.

> [!WARNING]
> Certifique-se de **Salvar** o fluxo após as alterações para que elas entrem em vigor no seu WhatsApp.
