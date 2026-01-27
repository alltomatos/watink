# 💰 Priorização por Carteira

O recurso de **Carteira** permite que você vincule um contato a um atendente específico, garantindo que o cliente seja sempre atendido pela mesma pessoa sempre que entrar em contato.

## O que é a Carteira?
A "Carteira" é o vínculo entre um **Contato** e um **Usuário** (Atendente) do sistema. Quando um contato possui um dono definido, o sistema pode priorizar esse atendente na hora de distribuir um novo ticket.

## Como configurar a Priorização
Para que o sistema direcione automaticamente o cliente para o dono da carteira, siga estes passos:

1.  Acesse o menu **Filas / Departamentos**.
2.  Edite a fila desejada.
3.  Localize a opção **Priorizar Carteira** e ative-a.
4.  Certifique-se de que a **Estratégia de Distribuição** esteja em um modo automático (ex: Round Robin).

## Como funciona na prática
Quando um cliente envia uma mensagem e entra em uma fila com a priorização ativa:

1.  O sistema verifica se o contato tem um **Usuário Responsável** definido.
2.  Se o responsável estiver **Online**, o ticket é direcionado imediatamente para ele, ignorando a fila de espera comum.
3.  Se o responsável estiver **Offline**, o ticket seguirá o fluxo normal de distribuição da fila para os atendentes que estiverem disponíveis.

## Definindo o dono de um Contato
Existem duas formas de definir o dono de uma carteira:
*   **Manual**: Edite o contato na aba **Contatos** e selecione o atendente no campo "Usuário Responsável".
*   **Automática**: Ao aceitar um atendimento pela primeira vez, o sistema pode ser configurado para vincular automaticamente aquele cliente ao atendente que o atendeu.

> [!TIP]
> **Dica**: Utilize este recurso para contas de "Farmer" ou suporte dedicado, onde a pessoalidade no atendimento é fundamental para a retenção do cliente.

> [!IMPORTANT]
> A priorização por carteira só funciona se o atendente responsável estiver com o status **Online** no sistema.
