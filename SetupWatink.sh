#!/bin/bash

## // ## // ## // ## // ## // ## // ## // ## //## // ## // ## // ## // ## // ## // ## // ## // ##
##                                         SETUP WATINK                                        ##
## // ## // ## // ## // ## // ## // ## // ## //## // ## // ## // ## // ## // ## // ## // ## // ##

# Diretórios e Arquivos
LOG_FILE="/var/log/setup_watink.log"
DADOS_DIR="/root/dados_vps"
DADOS_PORTAINER="$DADOS_DIR/dados_portainer"
DADOS_WATINK="$DADOS_DIR/dados_watink"

# Cores
VERDE="\e[32m"
AMARELO="\e[33m"
VERMELHO="\e[91m"
BRANCO="\e[97m"
BEGE="\e[93m"
RESET="\e[0m"

# Header Visual
header() {
    clear
    echo -e "${AMARELO}## // ## // ## // ## // ## // ## // ## // ## //## // ## // ## // ## // ## // ## // ## // ## // ##${RESET}"
    echo -e "${AMARELO}##                                         SETUP WATINK                                        ##${RESET}"
    echo -e "${AMARELO}## // ## // ## // ## // ## // ## // ## // ## //## // ## // ## // ## // ## // ## // ## // ## // ##${RESET}"
    echo ""
    echo -e "                                   ${BRANCO}Versão do SetupWatink: ${VERDE}v. 2.0.9${RESET}                "
    echo -e "${VERDE}                ${BRANCO}<----- Desenvolvido por AllTomatos ----->     ${VERDE}github.com/alltomatos/watink${RESET}"
    echo ""
}

# Logs
log() {
    local msg="$1"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $msg" >> "$LOG_FILE"
}

log_info() {
    echo -e "${BEGE}[INFO] $1${RESET}"
    log "INFO: $1"
}

log_success() {
    echo -e "${VERDE}[OK] $1${RESET}"
    log "SUCCESS: $1"
}

log_error() {
    echo -e "${VERMELHO}[ERRO] $1${RESET}"
    log "ERROR: $1"
}

# Verificações Básicas
check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Este script precisa ser executado como root."
        exit 1
    fi
}

install_deps() {
    log_info "Verificando dependências..."
    local deps=("curl" "jq" "openssl" "sed" "awk" "grep")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_info "Instalando $dep..."
            apt-get update -qq >/dev/null 2>&1
            apt-get install -y -qq "$dep" >/dev/null 2>&1 || log_error "Falha ao instalar $dep"
        fi
    done
}

# --- Gestão Portainer (Orion Compatible) ---

verificar_credenciais_portainer() {
    mkdir -p "$DADOS_DIR"
    
    # Se não existe arquivo, cria
    if [ ! -f "$DADOS_PORTAINER" ]; then
        header
        echo -e "${AMARELO}Credenciais do Portainer não encontradas.${RESET}"
        echo -e "${BRANCO}Por favor, informe os dados do seu Portainer:${RESET}"
        echo ""
        read -p "Domínio do Portainer (sem https://, ex: portainer.meudominio.com): " PORTAINER_DOMAIN
        # Remove https:// se usuário colocar
        PORTAINER_DOMAIN=$(echo "$PORTAINER_DOMAIN" | sed 's|https://||g' | sed 's|http://||g' | sed 's|/||g')
        
        read -p "Usuário (ex: admin): " PORTAINER_USER
        read -s -p "Senha: " PORTAINER_PASS
        echo ""
        
        # Salva dados iniciais (serão validados)
        echo -e "[ PORTAINER ]\nDominio do portainer: $PORTAINER_DOMAIN\n\nUsuario: $PORTAINER_USER\n\nSenha: $PORTAINER_PASS" > "$DADOS_PORTAINER"
    fi

    # Lê arquivo
    PORTAINER_DOMAIN=$(grep "Dominio do portainer:" "$DADOS_PORTAINER" | awk '{print $4}' | sed 's|https://||g')
    PORTAINER_USER=$(grep "Usuario:" "$DADOS_PORTAINER" | awk '{print $2}')
    PORTAINER_PASS=$(grep "Senha:" "$DADOS_PORTAINER" | awk '{print $2}')
    PORTAINER_TOKEN=$(grep "Token:" "$DADOS_PORTAINER" | awk '{print $2}')

    # Valida Token Existente
    if [ -n "$PORTAINER_TOKEN" ] && [ "$PORTAINER_TOKEN" != "null" ]; then
        local check=$(curl -s -o /dev/null -w "%{http_code}" -k -H "Authorization: Bearer $PORTAINER_TOKEN" "https://$PORTAINER_DOMAIN/api/endpoints")
        if [ "$check" == "200" ]; then
            log_success "Token do Portainer válido."
            return 0
        fi
    fi

    # Gera Novo Token
    log_info "Gerando novo token do Portainer..."
    local response=$(curl -s -k -X POST "https://$PORTAINER_DOMAIN/api/auth" -H "Content-Type: application/json" -d "{\"username\":\"$PORTAINER_USER\",\"password\":\"$PORTAINER_PASS\"}")
    local jwt=$(echo "$response" | jq -r .jwt)

    if [ -n "$jwt" ] && [ "$jwt" != "null" ]; then
        PORTAINER_TOKEN="$jwt"
        # Atualiza arquivo mantendo formato Orion (Token no final)
        echo -e "[ PORTAINER ]\nDominio do portainer: $PORTAINER_DOMAIN\n\nUsuario: $PORTAINER_USER\n\nSenha: $PORTAINER_PASS\n\nToken: $PORTAINER_TOKEN" > "$DADOS_PORTAINER"
        log_success "Novo token gerado e salvo."
    else
        log_error "Falha ao autenticar no Portainer: $response"
        rm "$DADOS_PORTAINER" # Remove para forçar nova entrada na próxima vez
        echo -e "${VERMELHO}Verifique suas credenciais e tente novamente.${RESET}"
        exit 1
    fi
}

obter_swarm_info() {
    # Pega Endpoint ID (Environment ID)
    PORTAINER_ENDPOINT_ID=$(curl -s -k -H "Authorization: Bearer $PORTAINER_TOKEN" "https://$PORTAINER_DOMAIN/api/endpoints" | jq '.[0].Id')
    
    # Pega Swarm ID (Cluster ID) - Fix: Usar endpoint /docker/swarm igual Orion
    PORTAINER_SWARM_ID=$(curl -s -k -H "Authorization: Bearer $PORTAINER_TOKEN" "https://$PORTAINER_DOMAIN/api/endpoints/$PORTAINER_ENDPOINT_ID/docker/swarm" | jq -r '.ID')
    
    if [ -z "$PORTAINER_SWARM_ID" ] || [ "$PORTAINER_SWARM_ID" == "null" ]; then
        log_error "Não foi possível identificar o cluster Swarm via Portainer. Verifique se o ambiente é Swarm."
        exit 1
    fi
    log_info "Ambiente detectado: Endpoint $PORTAINER_ENDPOINT_ID / Swarm $PORTAINER_SWARM_ID"
}

# --- Detecção de Ambiente ---

detectar_ambiente() {
    log_info "Analisando ambiente..."
    
    # 1. Docker Swarm Check
    if ! docker info 2>/dev/null | grep -q "Swarm: active"; then
        echo -e "${AMARELO}Docker Swarm não está ativo.${RESET}"
        read -p "Deseja inicializar o Swarm neste nó? (y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker swarm init >/dev/null 2>&1
            log_success "Swarm inicializado."
        else
            log_error "Swarm é necessário para este setup. Abortando."
            exit 1
        fi
    fi

    # 2. Check Traefik Service
    TRAEFIK_DETECTED=false
    if docker service ls --format '{{.Name}}' | grep -q "traefik"; then
        TRAEFIK_DETECTED=true
        log_success "Serviço Traefik detectado."
    fi

    # 3. Check Network
    # Procura redes comuns de proxy
    POSSIBLE_NETS=("proxy" "traefik_public" "traefik-public" "public" "web")
    DETECTED_NET=""
    
    for net in "${POSSIBLE_NETS[@]}"; do
        if docker network ls --format '{{.Name}}' | grep -q "^${net}$"; then
            DETECTED_NET="$net"
            break
        fi
    done
    
    # Se achou Traefik mas nao rede, tenta achar rede usada pelo traefik
    if [ "$TRAEFIK_DETECTED" = true ] && [ -z "$DETECTED_NET" ]; then
        # Tenta inspecionar o serviço traefik pra ver networks
        DETECTED_NET=$(docker service inspect traefik --format='{{range .Spec.TaskTemplate.Networks}}{{print .Target}}{{end}}' | head -n 1)
    fi

    # 4. Check Internal Network (watink_network)
    WATINK_NET_EXTERNAL="false"
    if docker network ls --format '{{.Name}}' | grep -q "^watink_network$"; then
        log_info "Rede interna 'watink_network' pré-existente detectada. Será reutilizada."
        WATINK_NET_EXTERNAL="true"
    fi
}

# --- Geradores de Stack ---

generate_net_block() {
    if [ "$WATINK_NET_EXTERNAL" == "true" ]; then
        cat <<EOF
  watink_network:
    external: true
    name: watink_network
EOF
    else
        cat <<EOF
  watink_network:
    driver: overlay
    name: watink_network
EOF
    fi
}

generate_stack_standalone() {
    # Captura bloco de rede dinâmico
    local NET_BLOCK=$(generate_net_block)

    cat <<EOF > watink.yaml
version: '3.8'

services:
  backend:
    image: watink/backend:latest
    ports:
      - "8080:8080"
    environment:
      - DB_DIALECT=postgres
      - DB_HOST=watink_postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASS=$DB_PASS
      - DB_NAME=watink
      - AMQP_URL=amqp://guest:guest@rabbitmq:5672
      - JWT_SECRET=3123123213123
      - JWT_REFRESH_SECRET=75756756756
      - FRONTEND_URL=$FRONTEND_URL
      - URL_BACKEND=$URL_BACKEND
      - PORT=8080
      - NODE_OPTIONS=--max-old-space-size=800
      - DEFAULT_TENANT_UUID=550e8400-e29b-41d4-a716-446655440000
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./backend/public:/app/public
    networks:
      - watink_network
    depends_on:
      - watink_postgres
      - redis
      - rabbitmq
    deploy:
      mode: replicated
      replicas: 1

  frontend:
    image: watink/frontend:latest
    ports:
      - "3000:80"
    environment:
      - URL_BACKEND=backend:8080
      - VITE_BACKEND_URL=$URL_BACKEND/
      - VITE_PLUGIN_MANAGER_URL=/plugins/
      - VITE_HOURS_CLOSE_TICKETS_AUTO=24
    networks:
      - watink_network
    depends_on:
      - backend
    deploy:
      mode: replicated
      replicas: 1

  whaileys-engine:
    image: watink/engine:latest
    environment:
      - AMQP_URL=amqp://guest:guest@rabbitmq:5672
      - REDIS_URL=redis://redis:6379
      - DB_DIALECT=postgres
      - DB_HOST=watink_postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASS=$DB_PASS
      - DB_NAME=watink
    networks:
      - watink_network
    depends_on:
      - rabbitmq
      - redis
      - watink_postgres
    deploy:
      mode: replicated
      replicas: 1

  flow-worker:
    image: watink/backend:latest
    command: [ "node", "dist/flow-worker.js" ]
    environment:
      - DB_DIALECT=postgres
      - DB_HOST=watink_postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASS=$DB_PASS
      - DB_NAME=watink
      - AMQP_URL=amqp://guest:guest@rabbitmq:5672
      - REDIS_URL=redis://redis:6379
      - DEFAULT_TENANT_UUID=550e8400-e29b-41d4-a716-446655440000
    networks:
      - watink_network
    depends_on:
      - watink_postgres
      - rabbitmq
      - redis
    deploy:
      mode: replicated
      replicas: 1

  watink-guard:
    image: watink/guard:latest
    environment:
      - DATABASE_URL=postgres://postgres:$DB_PASS@watink_postgres:5432/watink
      - RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
      - WATINK_MASTER_KEY=${MASTER_KEY:-change_me_in_production}
    networks:
      - watink_network
    depends_on:
      - watink_postgres
      - rabbitmq
    deploy:
      mode: replicated
      replicas: 1

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "15672:15672"
      - "5672:5672"
    networks:
      - watink_network
    deploy:
      mode: replicated
      replicas: 1

  redis:
    image: redis:alpine
    command: [ "redis-server", "--appendonly", "yes" ]
    ports:
      - "6379:6379"
    networks:
      - watink_network
    volumes:
      - redis_data:/data
    deploy:
      mode: replicated
      replicas: 1

  watink_postgres:
    image: watink/postgres-postgis-pgvector:16-optimized
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=watink
      - POSTGRES_PASSWORD=$DB_PASS
    volumes:
      - db_data:/var/lib/postgresql/data
    networks:
      - watink_network
    deploy:
      mode: replicated
      replicas: 1

networks:
$NET_BLOCK

volumes:
  db_data:
  redis_data:
EOF
}

generate_stack_traefik() {
    local NET_BLOCK=$(generate_net_block)

    cat <<EOF > watink.yaml
version: '3.8'

services:
  backend:
    image: watink/backend:latest
    environment:
      - DB_DIALECT=postgres
      - DB_HOST=watink_postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASS=$DB_PASS
      - DB_NAME=watink
      - AMQP_URL=amqp://guest:guest@rabbitmq:5672
      - JWT_SECRET=3123123213123
      - JWT_REFRESH_SECRET=75756756756
      - FRONTEND_URL=https://$DOMAIN_FRONTEND
      - URL_BACKEND=https://$DOMAIN_BACKEND
      - PORT=8080
      - NODE_OPTIONS=--max-old-space-size=800
      - DEFAULT_TENANT_UUID=550e8400-e29b-41d4-a716-446655440000
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./backend/public:/app/public
    networks:
      - watink_proxy
      - watink_network
    deploy:
      mode: replicated
      replicas: 1
      update_config:
        parallelism: 1
        delay: 10s
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.backend-api.rule=Host(\`$DOMAIN_BACKEND\`) && PathPrefix(\`/api\`)"
        - "traefik.http.routers.backend-api.entrypoints=websecure"
        - "traefik.http.routers.backend-api.tls.certresolver=letsencryptresolver"
        - "traefik.http.routers.backend-api.middlewares=backend-strip"
        - "traefik.http.middlewares.backend-strip.stripprefix.prefixes=/api"
        - "traefik.http.routers.backend-api.service=backend"
        - "traefik.http.routers.backend-root.rule=Host(\`$DOMAIN_BACKEND\`)"
        - "traefik.http.routers.backend-root.entrypoints=websecure"
        - "traefik.http.routers.backend-root.tls.certresolver=letsencryptresolver"
        - "traefik.http.routers.backend-root.service=backend"
        - "traefik.http.services.backend.loadbalancer.server.port=8080"
        - "traefik.docker.network=$NET_PROXY"

  frontend:
    image: watink/frontend:latest
    environment:
      - URL_BACKEND=backend:8080
      - VITE_BACKEND_URL=https://$DOMAIN_BACKEND/
      - VITE_PLUGIN_MANAGER_URL=/plugins/
      - VITE_HOURS_CLOSE_TICKETS_AUTO=24
    networks:
      - watink_proxy
      - watink_network
    deploy:
      mode: replicated
      replicas: 1
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.frontend.rule=Host(\`$DOMAIN_FRONTEND\`)"
        - "traefik.http.routers.frontend.entrypoints=websecure"
        - "traefik.http.routers.frontend.tls.certresolver=letsencryptresolver"
        - "traefik.http.routers.frontend.service=frontend"
        - "traefik.http.services.frontend.loadbalancer.server.port=80"
        - "traefik.docker.network=$NET_PROXY"

  whaileys-engine:
    image: watink/engine:latest
    environment:
      - AMQP_URL=amqp://guest:guest@rabbitmq:5672
      - REDIS_URL=redis://redis:6379
      - DB_DIALECT=postgres
      - DB_HOST=watink_postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASS=$DB_PASS
      - DB_NAME=watink
    networks:
      - watink_network
      - watink_proxy
    depends_on:
      - rabbitmq
    deploy:
      mode: replicated
      replicas: 1

  flow-worker:
    image: watink/backend:latest
    command: [ "node", "dist/flow-worker.js" ]
    environment:
      - DB_DIALECT=postgres
      - DB_HOST=watink_postgres
      - DB_PORT=5432
      - DB_USER=postgres
      - DB_PASS=$DB_PASS
      - DB_NAME=watink
      - AMQP_URL=amqp://guest:guest@rabbitmq:5672
      - REDIS_URL=redis://redis:6379
      - DEFAULT_TENANT_UUID=550e8400-e29b-41d4-a716-446655440000
    networks:
      - watink_network
    depends_on:
      - watink_postgres
      - rabbitmq
    deploy:
      mode: replicated
      replicas: 1

  watink-guard:
    image: watink/guard:latest
    environment:
      - DATABASE_URL=postgres://postgres:$DB_PASS@watink_postgres:5432/watink
      - RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
      - WATINK_MASTER_KEY=${MASTER_KEY:-change_me_in_production}
    networks:
      - watink_network
    depends_on:
      - watink_postgres
      - rabbitmq
    deploy:
      mode: replicated
      replicas: 1

  rabbitmq:
    image: rabbitmq:3-management-alpine
    networks:
      - watink_network
    deploy:
      mode: replicated
      replicas: 1

  redis:
    image: redis:alpine
    command: [ "redis-server", "--appendonly", "yes" ]
    networks:
      - watink_network
    volumes:
      - redis_data:/data
    deploy:
      mode: replicated
      replicas: 1

  watink_postgres:
    image: ronaldodavi/pgvectorgis:latest
    environment:
      - POSTGRES_DB=watink
      - POSTGRES_PASSWORD=$DB_PASS
    volumes:
      - db_data:/var/lib/postgresql/data
    networks:
      - watink_network
    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints:
          - node.role == manager

networks:
  watink_proxy:
    external: true
    name: $NET_PROXY
$NET_BLOCK

volumes:
  db_data:
  redis_data:
EOF
}

# --- Deploy Logic ---

deploy_stack_swarm() {
    local stack_name="$1"
    local file_path="watink.yaml"
    
    if [ ! -f "$file_path" ]; then
        log_error "Arquivo Stack não encontrado: $file_path"
        exit 1
    fi
    
    # Valida credenciais e pega IDs
    verificar_credenciais_portainer
    obter_swarm_info
    
    log_info "Enviando stack $stack_name para o Portainer..."
    
    # Curl Multipart Upload (estilo Orion)
    local response_file=$(mktemp)
    local http_code=$(curl -s -o "$response_file" -w "%{http_code}" -k -X POST \
        -H "Authorization: Bearer $PORTAINER_TOKEN" \
        -F "Name=$stack_name" \
        -F "file=@$(pwd)/$file_path" \
        -F "SwarmID=$PORTAINER_SWARM_ID" \
        -F "endpointId=$PORTAINER_ENDPOINT_ID" \
        "https://$PORTAINER_DOMAIN/api/stacks/create/swarm/file")
    
    local body=$(cat "$response_file")
    rm "$response_file"
    rm "$file_path" # Limpa arquivo gerado
    
    if [ "$http_code" == "200" ]; then
        if echo "$body" | grep -q "\"Id\""; then
            log_success "Deploy concluído com sucesso!"
            return 0
        else
            log_error "Resposta inesperada do Portainer: $body"
            return 1
        fi
    elif [ "$http_code" == "409" ]; then # Conflict
        log_error "Stack $stack_name já existe. Remova antes ou use outro nome."
        echo "Dica: Use a opção de remover stack no menu."
        return 1
    else
        log_error "Falha no deploy (HTTP $http_code): $body"
        return 1
    fi
}

remover_stack() {
    local stack_name="watink"
    verificar_credenciais_portainer
    obter_swarm_info
    
    # Busca Stack ID pelo nome
    local stack_id=$(curl -s -k -H "Authorization: Bearer $PORTAINER_TOKEN" "https://$PORTAINER_DOMAIN/api/stacks" | jq -r ".[] | select(.Name == \"$stack_name\") | .Id")
    
    if [ -n "$stack_id" ] && [ "$stack_id" != "null" ]; then
        log_info "Removendo stack $stack_name (ID: $stack_id)..."
        curl -s -k -X DELETE -H "Authorization: Bearer $PORTAINER_TOKEN" "https://$PORTAINER_DOMAIN/api/stacks/$stack_id?endpointId=$PORTAINER_ENDPOINT_ID" >/dev/null
        log_success "Stack removida."
    else
        log_error "Stack $stack_name não encontrada."
    fi
}

# --- Menu Principal ---

menu_principal() {
    while true; do
        header
        echo -e "${BRANCO}Selecione uma opção:${RESET}"
        echo ""
        echo -e "${VERDE}1${BRANCO} - Instalar Watink (Modo Traefik/Domain)${RESET}"
        echo -e "${VERDE}2${BRANCO} - Instalar Watink (Modo Standalone/IP)${RESET}"
        echo -e "${VERDE}3${BRANCO} - Remover Instalação${RESET}"
        echo -e "${VERDE}0${BRANCO} - Sair${RESET}"
        echo ""
        echo -en "${AMARELO}Opção: ${RESET}"
        read -r OPCAO
        
        case $OPCAO in
            1)
                check_root
                install_deps
                detectar_ambiente
                
                # Configuração Traefik
                if [ -z "$DETECTED_NET" ]; then
                    echo -e "${AMARELO}Rede do Traefik não detectada automaticamente.${RESET}"
                    read -p "Digite o nome da rede externa do Traefik (ex: proxy): " NET_PROXY
                else
                    echo -e "${VERDE}Rede detectada: $DETECTED_NET${RESET}"
                    read -p "Confirmar uso desta rede? (y/n) " -n 1 -r
                    echo ""
                    if [[ $REPLY =~ ^[Yy]$ ]]; then
                        NET_PROXY="$DETECTED_NET"
                    else
                        read -p "Digite o nome da rede correta: " NET_PROXY
                    fi
                fi
                
                read -p "Domínio Frontend (ex: app.meudominio.com): " DOMAIN_FRONTEND
                read -p "Domínio Backend (ex: api.meudominio.com): " DOMAIN_BACKEND
                
                # Gera Senhas
                DB_PASS=$(openssl rand -hex 12)
                MASTER_KEY=$(openssl rand -hex 16 | tr -d '\n')
                
                generate_stack_traefik
                deploy_stack_swarm "watink"
                
                # Salva dados
                mkdir -p "$DADOS_DIR"
                echo -e "[ WATINK ]\nMode: Traefik\nFrontend: https://$DOMAIN_FRONTEND\nBackend: https://$DOMAIN_BACKEND\nDB Pass: $DB_PASS\nMaster Key: $MASTER_KEY" > "$DADOS_WATINK"
                
                cat "$DADOS_WATINK"
                read -p "Pressione ENTER para continuar..."
                ;;
            
            2)
                check_root
                install_deps
                detectar_ambiente # Standalone tambem precisa de swarm
                
                echo -e "${AMARELO}Modo Standalone: Portas 3000 e 8080 serão expostas.${RESET}"
                read -p "IP/URL Frontend (para CORS, ex: http://localhost:3000): " FRONTEND_URL
                read -p "IP/URL Backend (para API, ex: http://localhost:8080): " URL_BACKEND
                
                DB_PASS=$(openssl rand -hex 12)
                MASTER_KEY=$(openssl rand -hex 16 | tr -d '\n')
                
                generate_stack_standalone
                deploy_stack_swarm "watink" # Usa a mesma funcao, mas com watink.yaml gerado diferente
                
                mkdir -p "$DADOS_DIR"
                echo -e "[ WATINK ]\nMode: Standalone\nFrontend: $FRONTEND_URL\nBackend: $URL_BACKEND\nDB Pass: $DB_PASS\nMaster Key: $MASTER_KEY" > "$DADOS_WATINK"
                
                cat "$DADOS_WATINK"
                read -p "Pressione ENTER para continuar..."
                ;;
                
            3)
                check_root
                install_deps
                remover_stack
                read -p "Pressione ENTER para continuar..."
                ;;
            0)
                clear
                exit 0
                ;;
            *)
                echo "Opção inválida"
                sleep 1
                ;;
        esac
    done
}

# Início
menu_principal
