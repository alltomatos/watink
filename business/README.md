# Watink Business 🦞

Este é o backend de alta performance do Watink, desenvolvido em **Go** para garantir escalabilidade em produção e baixa latência.

## Tecnologias
- **Framework:** Gin Gonic (API Rest)
- **ORM:** GORM (Postgres)
- **Real-time:** Socket.IO (Go implementation)
- **Fila:** RabbitMQ (AMQP)
- **Cache:** Redis
- **Auth:** JWT (JSON Web Tokens)

## Estrutura do Projeto
- `cmd/server/`: Ponto de entrada da aplicação.
- `internal/controllers/`: Lógica das rotas da API.
- `internal/models/`: Definição das tabelas (mapeadas do core Node.js).
- `internal/services/`: Serviços de integração (RabbitMQ, Sockets, etc).
- `internal/routes/`: Definição dos endpoints.
- `internal/middleware/`: Filtros de autenticação e multitenancy.

## Como Executar (Manual)
1. Certifique-se de que o Docker Infra (Postgres, Redis, RabbitMQ) está rodando.
2. Configure as variáveis de ambiente no `.env`.
3. Execute:
   ```bash
   go run cmd/server/main.go
   ```

## Compilação
```bash
go build -o watink-business cmd/server/main.go
```

---
*Desenvolvido proativamente para elevar o Watink ao nível profissional.*
