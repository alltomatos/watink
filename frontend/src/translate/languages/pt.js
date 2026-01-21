const messages = {
  pt: {
    translations: {
      signup: {
        title: "Cadastre-se",
        toasts: {
          success: "Usuário criado com sucesso! Faça seu login!!!.",
          fail: "Erro ao criar usuário. Verifique os dados informados.",
        },
        form: {
          name: "Nome",
          email: "Email",
          password: "Senha",
        },
        buttons: {
          submit: "Cadastrar",
          login: "Já tem uma conta? Entre!",
        },
      },
      login: {
        title: "Login",
        form: {
          email: "Email",
          password: "Senha",
          rememberMe: "Lembrar de mim",
          passwordVisibility: "Alternar visibilidade da senha",
        },
        buttons: {
          submit: "Entrar",
          register: "Não tem um conta? Cadastre-se!",
        },
      },
      auth: {
        toasts: {
          success: "Login efetuado com sucesso!",
        },
      },
      dashboard: {
        charts: {
          perDay: {
            title: "Tickets hoje: ",
          },
        },
        messages: {
          inAttendance: {
            title: "Em Atendimento"
          },
          waiting: {
            title: "Aguardando"
          },
          closed: {
            title: "Finalizado"
          }
        }
      },
      connections: {
        title: "Conexões",
        toasts: {
          deleted: "Conexão com o WhatsApp excluída com sucesso!",
        },
        confirmationModal: {
          deleteTitle: "Deletar",
          deleteMessage: "Você tem certeza? Essa ação não pode ser revertida.",
          disconnectTitle: "Desconectar",
          disconnectMessage:
            "Tem certeza? Você precisará ler o QR Code novamente.",
        },
        buttons: {
          add: "Adicionar WhatsApp",
          disconnect: "desconectar",
          tryAgain: "Tentar novamente",
          qrcode: "QR CODE",
          newQr: "Novo QR CODE",
          connecting: "Conectando",
          pairingCode: "Código de Pareamento",
          restart: "Reiniciar Conexão",
        },
        pairingCodeModal: {
          title: "Código de Pareamento",
          instruction: "Insira o número do telefone com DDI e DDD para gerar o código.",
          phoneNumber: "Número do Telefone (Ex: 5511999999999)",
          generate: "Gerar Código",
          codeInstruction: "Digite este código no seu celular quando solicitado pelo WhatsApp.",
        },
        toolTips: {
          disconnected: {
            title: "Falha ao iniciar sessão do WhatsApp",
            content:
              "Certifique-se de que seu celular esteja conectado à internet e tente novamente, ou solicite um novo QR Code",
          },
          qrcode: {
            title: "Esperando leitura do QR Code",
            content:
              "Clique no botão 'QR CODE' e leia o QR Code com o seu celular para iniciar a sessão",
          },
          connected: {
            title: "Conexão estabelecida!",
          },
          timeout: {
            title: "A conexão com o celular foi perdida",
            content:
              "Certifique-se de que seu celular esteja conectado à internet e o WhatsApp esteja aberto, ou clique no botão 'Desconectar' para obter um novo QR Code",
          },
        },
        table: {
          name: "Nome",
          status: "Status",
          lastUpdate: "Última atualização",
          default: "Padrão",
          actions: "Ações",
          session: "Sessão",
        },
      },
      whatsappModal: {
        deleteTitle: "Deletar Conexão",
        deleteMessage: "Tem certeza que deseja deletar esta conexão?",
        title: {
          add: "Adicionar WhatsApp",
          edit: "Editar WhatsApp",
        },
        form: {
          name: "Nome",
          default: "Padrão",
          isDefault: "Padrão",
          greetingMessage: "Mensagem de saudação",
          farewellMessage: "Mensagem de despedida",
          syncHistory: "Sincronizar Histórico",
          syncPeriod: "Período (ex: 30 dias)"
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "WhatsApp salvo com sucesso.",
      },
      webchatModal: {
        title: {
          add: "Adicionar Webchat",
          edit: "Editar Webchat",
        },
        form: {
          name: "Nome",
          isDefault: "Padrão",
          greetingMessage: "Mensagem de saudação",
          farewellMessage: "Mensagem de despedida",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Webchat salvo com sucesso.",
      },
      qrCode: {
        message: "Leia o QrCode para iniciar a sessão",
      },
      contacts: {
        title: "Contatos",
        toasts: {
          deleted: "Contato excluído com sucesso!",
        },
        searchPlaceholder: "Pesquisar...",
        confirmationModal: {
          deleteTitle: "Deletar ",
          importTitlte: "Importar contatos",
          deleteMessage:
            "Tem certeza que deseja deletar este contato? Todos os tickets relacionados serão perdidos.",
          importMessage: "Deseja importas todos os contatos do telefone?",
        },
        buttons: {
          import: "Importar Contatos",
          add: "Adicionar Contato",
        },
        table: {
          name: "Nome",
          whatsapp: "WhatsApp",
          email: "Email",
          actions: "Ações",
        },
      },
      contactModal: {
        title: {
          add: "Adicionar contato",
          edit: "Editar contato",
        },
        form: {
          mainInfo: "Dados do contato",
          extraInfo: "Informações adicionais",
          name: "Nome",
          number: "Número do Whatsapp",
          email: "Email",
          extraName: "Nome do campo",
          extraValue: "Valor",
        },
        buttons: {
          addExtraInfo: "Adicionar informação",
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Contato salvo com sucesso.",
      },
      quickAnswersModal: {
        title: {
          add: "Adicionar Resposta Rápida",
          edit: "Editar Resposta Rápida",
        },
        form: {
          shortcut: "Atalho",
          message: "Resposta Rápida",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Resposta Rápida salva com sucesso.",
      },
      queueModal: {
        title: {
          add: "Adicionar fila",
          edit: "Editar fila",
        },
        form: {
          name: "Nome",
          color: "Cor",
          greetingMessage: "Mensagem de saudação",
          distributionSection: "Distribuição de Tickets",
          distributionStrategy: "Estratégia de Distribuição",
          prioritizeWallet: "Priorizar Carteira",
          prioritizeWalletHelp: "Tickets são direcionados preferencialmente ao dono da carteira do contato",
          prioritizeWalletTooltip: "Quando ativo, o sistema verifica se o contato tem um vendedor/agente responsável atribuído à sua carteira. Se esse agente estiver online e nesta fila, o ticket é direcionado a ele automaticamente.",
        },
        strategies: {
          manual: "Manual (Pesca)",
          manualDescription: "Agentes escolhem quais tickets atender",
          roundRobin: "Automático (Circular)",
          roundRobinDescription: "Distribui igualmente entre agentes disponíveis",
          balanced: "Automático (Balanceado)",
          balancedDescription: "Prioriza agentes com menos tickets em aberto",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        toasts: {
          success: "Fila salva com sucesso!",
        },
      },
      wallet: {
        tooltips: {
          addToWallet: "Adicionar à minha carteira",
          myClient: "Remover da minha carteira",
          belongsTo: "Pertence a",
        },
        toasts: {
          added: "Contato adicionado à sua carteira!",
          removed: "Contato removido da sua carteira!",
          transferred: "Contato transferido para sua carteira!",
        },
        confirmDialog: {
          title: "Transferir Cliente?",
          message: "Este contato pertence a outro agente. Deseja transferi-lo para sua carteira?",
          warning: "O agente atual será notificado sobre a transferência.",
          confirm: "Transferir",
          cancel: "Cancelar",
        },
      },
      userModal: {
        title: {
          add: "Adicionar usuário",
          edit: "Editar usuário",
        },
        form: {
          name: "Nome",
          email: "Email",
          password: "Senha",
          profile: "Perfil",
          group: "Grupo",
          whatsapp: "Conexão Padrão",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Usuário salvo com sucesso.",
      },
      chat: {
        noTicketMessage: "Selecione um ticket para começar a conversar.",
      },
      ticketsManager: {
        buttons: {
          newTicket: "Novo",
        },
      },
      ticketsQueueSelect: {
        placeholder: "Filas",
      },
      tickets: {
        toasts: {
          deleted: "O ticket que você estava foi deletado.",
        },
        notification: {
          message: "Mensagem de",
        },
        tabs: {
          open: { title: "Inbox" },
          group: { title: "Grupos" },
          closed: { title: "Resolvidos" },
          search: { title: "Busca" },
        },
        search: {
          placeholder: "Buscar tickets e mensagens",
        },
        buttons: {
          showAll: "Todos",
        },
      },
      transferTicketModal: {
        title: "Transferir Ticket",
        fieldLabel: "Digite para buscar usuários",
        fieldQueueLabel: "Transferir para fila",
        fieldConnectionLabel: "Transferir para conexão",
        fieldQueuePlaceholder: "Selecione uma fila",
        fieldConnectionPlaceholder: "Selecione uma conexão",
        noOptions: "Nenhum usuário encontrado com esse nome",
        buttons: {
          ok: "Transferir",
          cancel: "Cancelar",
        },
      },
      ticketsList: {
        pendingHeader: "Aguardando",
        assignedHeader: "Atendendo",
        noTicketsTitle: "Nada aqui!",
        noTicketsMessage:
          "Nenhum ticket encontrado com esse status ou termo pesquisado",
        connectionTitle: "Conexão que está sendo utilizada atualmente.",
        buttons: {
          accept: "Aceitar",
        },
      },
      newTicketModal: {
        title: "Criar Ticket",
        fieldLabel: "Digite para pesquisar o contato",
        add: "Adicionar",
        buttons: {
          ok: "Salvar",
          cancel: "Cancelar",
        },
      },
      mainDrawer: {
        listItems: {
          dashboard: "Estatísticas",
          pipelines: "Pipelines",
          connections: "Conexões",
          tickets: "Chats",
          contacts: "Contatos",
          quickAnswers: "Respostas Rápidas",
          flowBuilder: "Flow Builder",
          clients: "Clientes",
          helpdesk: "Helpdesk",
          queues: "Filas",
          administration: "Administração",
          groups: "Grupos",
          users: "Usuários",
          knowledgeBase: "Base Conhecimento",
          settings: "Configurações",
          swagger: "Swagger",
        },
        appBar: {
          user: {
            profile: "Perfil",
            logout: "Sair",
          },
        },
      },
      notifications: {
        noTickets: "Nenhuma notificação.",
      },
      queues: {
        title: "Filas",
        table: {
          name: "Nome",
          color: "Cor",
          greeting: "Mensagem de saudação",
          actions: "Ações",
        },
        buttons: {
          add: "Adicionar fila",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage:
            "Você tem certeza? Essa ação não pode ser revertida! Os tickets dessa fila continuarão existindo, mas não terão mais nenhuma fila atribuída.",
        },
      },
      queueSelect: {
        inputLabel: "Filas",
      },
      quickAnswers: {
        title: "Respostas Rápidas",
        table: {
          shortcut: "Atalho",
          message: "Resposta Rápida",
          actions: "Ações",
        },
        buttons: {
          add: "Adicionar Resposta Rápida",
        },
        toasts: {
          deleted: "Resposta Rápida excluída com sucesso.",
        },
        searchPlaceholder: "Pesquisar...",
        confirmationModal: {
          deleteTitle:
            "Você tem certeza que quer excluir esta Resposta Rápida: ",
          deleteMessage: "Esta ação não pode ser revertida.",
        },
      },
      users: {
        title: "Usuários",
        table: {
          name: "Nome",
          email: "Email",
          profile: "Perfil",
          whatsapp: "Conexão Padrão",
          actions: "Ações",
        },
        buttons: {
          add: "Adicionar usuário",
        },
        toasts: {
          deleted: "Usuário excluído com sucesso.",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage:
            "Todos os dados do usuário serão perdidos. Os tickets abertos deste usuário serão movidos para a fila.",
        },
      },
      groups: {
        title: "Grupos",
        table: {
          name: "Nome",
          actions: "Ações",
        },
        buttons: {
          add: "Adicionar grupo",
        },
        toasts: {
          deleted: "Grupo excluído com sucesso.",
        },
        confirmationModal: {
          deleteTitle: "Excluir",
          deleteMessage:
            "Tem certeza? Essa ação não pode ser revertida.",
        },
      },
      groupModal: {
        title: {
          add: "Adicionar grupo",
          edit: "Editar grupo",
        },
        form: {
          name: "Nome",
          permissions: "Permissões",
        },
        buttons: {
          okAdd: "Adicionar",
          okEdit: "Salvar",
          cancel: "Cancelar",
        },
        success: "Grupo salvo com sucesso.",
      },
      settings: {
        success: "Configurações salvas com sucesso.",
        title: "Configurações",
        settings: {
          userCreation: {
            name: "Criação de tenant",
            options: {
              enabled: "Ativado",
              disabled: "Desativado",
            },
          },
          language: {
            name: "Idioma",
            options: {
              pt: "Português",
              en: "English",
              es: "Español",
            },
          },
        },
      },
      messagesList: {
        header: {
          assignedTo: "Atribuído à:",
          buttons: {
            return: "Retornar",
            resolve: "Resolver",
            reopen: "Reabrir",
            accept: "Aceitar",
          },
        },
      },
      messagesInput: {
        placeholderOpen: "Digite uma mensagem ou tecle ''/'' para utilizar as respostas rápidas cadastrada",
        placeholderClosed:
          "Reabra ou aceite esse ticket para enviar uma mensagem.",
        signMessage: "Assinar",
      },
      contactDrawer: {
        header: "Dados do contato",
        buttons: {
          edit: "Editar contato",
        },
        extraInfo: "Outras informações",
      },
      ticketOptionsMenu: {
        delete: "Deletar",
        transfer: "Transferir",
        confirmationModal: {
          title: "Deletar o ticket do contato",
          message:
            "Atenção! Todas as mensagens relacionadas ao ticket serão perdidas.",
        },
        buttons: {
          delete: "Excluir",
          cancel: "Cancelar",
        },
      },
      confirmationModal: {
        buttons: {
          confirm: "Ok",
          cancel: "Cancelar",
        },
      },
      messageOptionsMenu: {
        delete: "Deletar",
        reply: "Responder",
        confirmationModal: {
          title: "Apagar mensagem?",
          message: "Esta ação não pode ser revertida.",
        },
      },
      knowledgeBase: {
        title: "Base de Conhecimento",
        menu: "Base Conhecimento",
        table: {
          name: "Nome",
          description: "Descrição",
          actions: "Ações",
          noData: "Nenhuma base de conhecimento encontrada",
        },
        buttons: {
          add: "Adicionar Base",
          save: "Salvar",
          cancel: "Cancelar",
          edit: "Editar",
          delete: "Excluir",
        },
        modal: {
          add: "Nova Base de Conhecimento",
          edit: "Editar Base de Conhecimento",
        },
        form: {
          name: "Nome",
          description: "Descrição",
        },
        toasts: {
          created: "Base de conhecimento criada com sucesso!",
          edited: "Base de conhecimento atualizada com sucesso!",
          deleted: "Base de conhecimento excluída com sucesso!",
        },
        confirmationModal: {
          deleteTitle: "Excluir Base de Conhecimento",
          deleteMessage: "Tem certeza? Todos os conteúdos vinculados serão excluídos.",
        },
      },
      marketplace: {
        title: "Marketplace de Plugins",
        search: "Buscar plugins...",
        viewDetails: "Ver Detalhes",
        free: "Gratuito",
        installed: "Instalado",
        active: "Ativo",
        notInstalled: "Não instalado",
        details: "Detalhes",
        noPermission: "Sem permissão",
        adminOnly: "Apenas o Admin pode acessar o Marketplace.",
        offlineWarning: "Modo offline: exibindo catálogo local. Conexão com Marketplace remoto indisponível.",
        loadError: "Erro ao carregar plugins",
        table: {
          plugin: "Plugin",
          category: "Categoria",
          type: "Tipo",
          version: "Versão",
          status: "Status",
          actions: "Ações",
        },
        pluginDetail: {
          backToMarketplace: "Voltar ao Marketplace",
          aboutPlugin: "Sobre este plugin",
          activatePlugin: "Ativar Plugin",
          deactivatePlugin: "Desativar Plugin",
          pluginNotFound: "Plugin não encontrado",
          activatePremium: "Ativar Plugin Premium",
          premiumDescription: "Este é um plugin premium. Insira sua chave de licença para ativar.",
          licenseKey: "Chave de Licença",
          cancel: "Cancelar",
          activate: "Ativar",
          loadError: "Erro ao carregar plugin",
          activateSuccess: "Plugin ativado com sucesso!",
          activateError: "Erro ao ativar plugin",
          deactivateSuccess: "Plugin desativado.",
          deactivateError: "Erro ao desativar plugin",
          invalidLicense: "Chave de licença inválida",
          enterLicense: "Informe a chave de licença",
        },
      },
      emailTemplates: {
        title: "Modelos de Email",
        toasts: {
          loadListError: "Erro ao carregar lista de modelos",
          loadError: "Erro ao carregar modelo",
          saveSuccess: "Modelo salvo com sucesso",
          createSuccess: "Modelo criado com sucesso",
          saveError: "Erro ao salvar modelo",
          deleteSuccess: "Modelo excluído com sucesso",
          deleteError: "Erro ao excluir modelo",
        },
        buttons: {
          add: "Adicionar Modelo",
          save: "Salvar",
          cancel: "Cancelar",
          close: "Fechar",
        },
        table: {
          name: "Nome",
          subject: "Assunto",
          actions: "Ações",
          noData: "Nenhum modelo encontrado",
        },

        modal: {
          addTitle: "Novo Modelo de Email",
          editTitle: "Editar Modelo de Email",
        },
        preview: {
          title: "Visualizar Modelo",
          subject: "Assunto",
          variablesInfo: "Valores de exemplo utilizados para visualização. As variáveis reais serão substituídas no envio."
        },
        names: {
          welcome_premium: "Boas-vindas Premium - (welcome_premium)",
          custom: "Outro / Personalizado"
        },
        form: {
          name: "Nome (Identificador)",
          nameSelect: "Selecione o Modelo",
          subject: "Assunto",
          html: "Conteúdo HTML (Mustache)",
          text: "Conteúdo Texto (Opcional)",
        },
      },
      backendErrors: {
        ERR_NO_OTHER_WHATSAPP: "Deve haver pelo menos um WhatsApp padrão.",
        ERR_NO_DEF_WAPP_FOUND:
          "Nenhum WhatsApp padrão encontrado. Verifique a página de conexões.",
        ERR_WAPP_NOT_INITIALIZED:
          "Esta sessão do WhatsApp não foi inicializada. Verifique a página de conexões.",
        ERR_WAPP_CHECK_CONTACT:
          "Não foi possível verificar o contato do WhatsApp. Verifique a página de conexões",
        ERR_WAPP_INVALID_CONTACT: "Este não é um número de Whatsapp válido.",
        ERR_WAPP_DOWNLOAD_MEDIA:
          "Não foi possível baixar mídia do WhatsApp. Verifique a página de conexões.",
        ERR_INVALID_CREDENTIALS:
          "Erro de autenticação. Por favor, tente novamente.",
        ERR_SENDING_WAPP_MSG:
          "Erro ao enviar mensagem do WhatsApp. Verifique a página de conexões.",
        ERR_DELETE_WAPP_MSG: "Não foi possível excluir a mensagem do WhatsApp.",
        ERR_OTHER_OPEN_TICKET: "Já existe um tíquete aberto para este contato.",
        ERR_SESSION_EXPIRED: "Sessão expirada. Por favor entre.",
        ERR_USER_CREATION_DISABLED:
          "A criação do usuário foi desabilitada pelo administrador.",
        ERR_NO_PERMISSION: "Você não tem permissão para acessar este recurso.",
        ERR_DUPLICATED_CONTACT: "Já existe um contato com este número.",
        ERR_NO_SETTING_FOUND: "Nenhuma configuração encontrada com este ID.",
        ERR_NO_CONTACT_FOUND: "Nenhum contato encontrado com este ID.",
        ERR_NO_TICKET_FOUND: "Nenhum tíquete encontrado com este ID.",
        ERR_NO_USER_FOUND: "Nenhum usuário encontrado com este ID.",
        ERR_NO_WAPP_FOUND: "Nenhum WhatsApp encontrado com este ID.",
        ERR_CREATING_MESSAGE: "Erro ao criar mensagem no banco de dados.",
        ERR_CREATING_TICKET: "Erro ao criar tíquete no banco de dados.",
        ERR_FETCH_WAPP_MSG:
          "Erro ao buscar a mensagem no WhtasApp, talvez ela seja muito antiga.",
        ERR_QUEUE_COLOR_ALREADY_EXISTS:
          "Esta cor já está em uso, escolha outra.",
        ERR_WAPP_GREETING_REQUIRED:
          "A mensagem de saudação é obrigatório quando há mais de uma fila.",
      },
      publicProtocol: {
        header: {
          number: "Protocolo #{{number}}",
          createdAt: "Criado em {{date}}",
        },
        status: {
          open: "Aberto",
          in_progress: "Em Progresso",
          resolved: "Resolvido",
          closed: "Fechado",
          pending: "Pendente",
        },
        priority: {
          low: "Baixa",
          medium: "Normal",
          high: "Alta",
          urgent: "Urgente",
        },
        details: {
          title: "Detalhes da Solicitação",
          subject: "Assunto",
          description: "Descrição",
          category: "Categoria",
          noDescription: "Sem descrição.",
          generalCategory: "Geral",
          attachments: "Anexos",
        },
        history: {
          title: "Histórico de Movimentações",
          actions: {
            created: "Criado",
            status_changed: "Status alterado",
            priority_changed: "Prioridade alterada",
            attachment: "Anexo",
            comment_added: "Comentário adicionado",
            user_assigned: "Atribuído a usuário",
            resolved: "Resolvido",
            closed: "Fechado",
            reopened: "Reaberto",
          },
        },
        notFound: {
          title: "Protocolo não encontrado",
          message: "Verifique o link e tente novamente.",
        },
        defaultTenant: "Central de Atendimento",
      },
      smtp: {
        title: "Configurações do Servidor SMTP",
        settingsTitle: "Configurações de Email (SMTP)",
        form: {
          host: "Host SMTP",
          port: "Porta",
          user: "Usuário / Email",
          password: "Senha",
          passwordPlaceholder: "Deixe em branco para manter a atual",
          emailFrom: "Email Remetente (From)",
          secure: "Usar Conexão Segura (SSL/TLS)",
        },
        buttons: {
          save: "Salvar Configurações",
          saving: "Salvando...",
          test: "Testar Conexão",
          testing: "Enviando...",
          sendTest: "Enviar Teste",
          cancel: "Cancelar",
        },
        modal: {
          title: "Testar Conexão SMTP",
          content: "Insira um e-mail de destino para enviar uma mensagem de teste.",
          emailLabel: "E-mail de Destino",
        },
        toasts: {
          loadError: "Erro ao carregar configurações SMTP",
          saveSuccess: "Configurações SMTP salvas com sucesso!",
          saveError: "Erro ao salvar configurações SMTP",
          testSuccess: "E-mail de teste enviado com sucesso!",
          testError: "Erro ao enviar e-mail de teste",
          emailRequired: "Por favor, insira um e-mail de destino.",
        },
      },
      contactImport: {
        title: "Importar Contatos",
        dropZone: {
          title: "Arraste seu arquivo CSV aqui",
          subtitle: "ou clique para selecionar",
        },
        downloadSample: "Baixar planilha modelo",
        uploading: "Processando...",
        errors: {
          invalidFile: "Por favor, selecione um arquivo CSV.",
        },
        results: {
          success: "Importação concluída!",
          partial: "Importação parcial",
          failed: "Falha na importação",
          errorDetails: "Detalhes dos erros",
        },
        toasts: {
          success: "Contatos importados com sucesso!",
          partial: "Importação concluída com erros.",
        },
        buttons: {
          cancel: "Fechar",
          import: "Importar Contatos",
          uploading: "Importando...",
        },
      },
      kanbanSettings: {
        title: "Configuração do Kanban",
        queueLabel: "Selecione uma Fila",
        stepsCount: "steps configurados",
        addButton: "Adicionar Step",
        newStepPlaceholder: "Nome do novo step...",
        colorPicker: "Escolher cor",
        bindingStep: "Vincular",
        empty: {
          noQueue: "Selecione uma fila",
          noQueueDescription: "Escolha uma fila para configurar seus steps do Kanban",
          noSteps: "Nenhum step configurado",
          noStepsDescription: "Adicione steps para criar seu fluxo de trabalho",
        },
        actions: {
          edit: "Editar",
          delete: "Excluir",
        },
        validation: {
          nameRequired: "Digite um nome para o step.",
        },
        toasts: {
          created: "Step criado com sucesso!",
          updated: "Step atualizado!",
          deleted: "Step excluído com sucesso!",
        },
        deleteDialog: {
          title: "Excluir Step?",
          message: "Tem certeza que deseja excluir este step?",
          warning: "Esta ação não pode ser desfeita. Tickets neste step serão desvinculados.",
          confirm: "Excluir",
          cancel: "Cancelar",
        },
      },
    },
  },
};

export { messages };
