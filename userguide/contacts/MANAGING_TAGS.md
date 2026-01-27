# 🏷️ Guia de Etiquetas (Tags)

As etiquetas (tags) são fundamentais para organizar seus contatos e atendimentos, permitindo uma segmentação eficiente e automações inteligentes.

## ⚙️ Gerenciando Etiquetas

Para criar e organizar suas etiquetas, acesse o menu **Tags** no painel lateral.

1.  **Criar Nova Tag**: Clique em **+ Nova Tag**.
2.  **Personalização**:
    *   **Nome**: Identificação clara (ex: "Lead Quente", "Suporte Urgente").
    *   **Cor**: Escolha uma cor para facilitar a identificação visual no chat.
    *   **Descrição**: (Opcional) Nota interna sobre o uso daquela tag.
3.  **Arquivamento**: Se uma tag não for mais necessária mas você quiser manter o histórico, use o botão **Arquivar**. Tags arquivadas param de aparecer na seleção manual, mas podem ser consultadas no filtro.

## 👤 Atribuindo Tags a Contatos

Você pode categorizar seus clientes para saber exatamente quem são e o que precisam:

1.  Vá em **Contatos**.
2.  Edite um contato existente.
3.  No campo de **Tags**, selecione uma ou mais etiquetas.
4.  O sistema salva automaticamente as alterações.

## 🎫 Usando Tags no Atendimento (Tickets)

Durante uma conversa ativa, você pode aplicar etiquetas diretamente no ticket:

1.  No painel de atendimento (centro da tela), procure o seletor de etiquetas no topo ou lateral do chat.
2.  Adicione as tags relevantes para aquele momento do atendimento (ex: "Pendente Pagamento", "Dúvida Técnica").
3.  **Filtros**: Use o filtro de etiquetas no topo da lista de tickets para encontrar rapidamente conversas específicas.

## 🤖 Automação com Flow Builder

Você pode automatizar a aplicação de etiquetas baseada nas escolhas do cliente:

1.  No **Flow Builder**, arraste o nó **Tag**.
2.  Configure a **Ação**:
    *   **Adicionar**: Aplica a tag ao cliente quando ele passar por aquele ponto do fluxo.
    *   **Remover**: Retira a tag do cliente (ex: tirar a tag "Inativo" quando ele volta a falar).
3.  Selecione a etiqueta desejada.

> [!TIP]
> **Dica**: Utilize o nó de Tag logo após um menu de opções. Se o cliente escolher "Vendas", adicione automaticamente a tag "Lead" para que o atendente já receba o ticket classificado.

> [!IMPORTANT]
> As etiquetas são visíveis para todos os atendentes que possuem acesso ao contato ou ticket, facilitando o trabalho em equipe.
