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
    echo -e "                                   ${BRANCO}Versão do SetupWatink: ${VERDE}v. 2.1.0${RESET}                "
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
    local deps=("curl" "jq" "openssl" "sed" "awk" "grep" "net-tools")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_info "Instalando $dep..."
            apt-get update -qq >/dev/null 2>&1
            apt-get install -y -qq "$dep" >/dev/null 2>&1 || log_error "Falha ao instalar $dep"
        fi
    done
}

validar_senha() { 
    local senha=$1
    local tamanho_minimo=$2
    local tem_erro=0
    local mensagem_erro=""

    if [ ${#senha} -lt $tamanho_minimo ]; then
        mensagem_erro+="\n- Senha precisa ter no mínimo $tamanho_minimo caracteres"
        tem_erro=1
    fi
    if ! [[ $senha =~ [A-Z] ]]; then
        mensagem_erro+="\n- Falta pelo menos uma letra maiúscula"
        tem_erro=1
    fi
    if ! [[ $senha =~ [a-z] ]]; then
        mensagem_erro+="\n- Falta pelo menos uma letra minúscula"
        tem_erro=1
    fi
    if ! [[ $senha =~ [0-9] ]]; then
        mensagem_erro+="\n- Falta pelo menos um número"
        tem_erro=1
    fi
    if ! [[ $senha =~ [@_] ]]; then
        mensagem_erro+="\n- Falta pelo menos um caractere especial (@ ou _)"
        tem_erro=1
    fi
    if [[ $senha =~ [^A-Za-z0-9@_] ]]; then
        mensagem_erro+="\n- Contém caracteres especiais não permitidos (use apenas @ ou _)"
        tem_erro=1
    fi

    if [ $tem_erro -eq 1 ]; then
        echo -e "${VERMELHO}Senha inválida! Corrija os seguintes problemas:${RESET}$mensagem_erro"
        return 1
    fi
    return 0
}

wait_stack() {
    local service_name="$1"
    log_info "Aguardando serviço $service_name..."
    local counter=0
    local max_retries=60 # 60 * 5s = 5 minutos

    while [ $counter -lt $max_retries ]; do
        # Verifica se o serviço existe
        if docker service ls --format '{{.Name}}' | grep -q "$service_name"; then
            # Obtém réplicas atuais e desejadas (ex: 1/1)
            local replicas=$(docker service ls --filter "name=$service_name" --format '{{.Replicas}}')
            local current=$(echo "$replicas" | cut -d'/' -f1)
            local desired=$(echo "$replicas" | cut -d'/' -f2)
            
            # Se current > 0 e igual a desired, está ok
            if [ -n "$current" ] && [ "$current" -gt 0 ] && [ "$current" -eq "$desired" ]; then
                log_success "Serviço $service_name está online ($replicas)!"
                sleep 5 # Espera extra para estabilização da aplicação
                return 0
            fi
        fi
        echo -n "."
        sleep 5
        counter=$((counter+1))
    done
    log_error "Timeout aguardando serviço $service_name."
    # Diagnóstico de erro
    echo -e "${VERMELHO}--- Diagnóstico de Falha ($service_name) ---${RESET}"
    docker service ps "$service_name" --no-trunc | head -n 5
    echo -e "${VERMELHO}--- Logs do Serviço ---${RESET}"
    docker service logs "$service_name" | tail -n 20
    return 1
}

wait_for_portainer_api() {
    local domain="$1"
    log_info "Aguardando API do Portainer em https://$domain..."
    local counter=0
    local max_retries=30 # 2.5 minutos

    while [ $counter -lt $max_retries ]; do
        # Tenta acessar o endpoint de status ou public
        if curl -k -s --connect-timeout 5 "https://$domain/api/status" > /dev/null; then
            log_success "API do Portainer respondendo!"
            return 0
        fi
        echo -n "."
        sleep 5
        counter=$((counter+1))
    done
    log_error "Portainer API não respondeu em https://$domain após tentativas."
    # Não retorna erro fatal, tenta prosseguir com o loop de criação de conta que também tem retries
    return 0 
}

# --- Gestão Portainer (Helpers) ---

verificar_credenciais_portainer() {
    if [ ! -f "$DADOS_PORTAINER" ]; then
        log_error "Credenciais do Portainer não encontradas. Execute o Setup de Infraestrutura (Opção 2 do Wizard Inicial) ou crie o arquivo manualmente."
        return 1
    fi
    PORTAINER_DOMAIN=$(grep "Dominio do portainer:" "$DADOS_PORTAINER" | awk '{print $4}' | sed 's|https://||g')
    PORTAINER_TOKEN=$(grep "Token:" "$DADOS_PORTAINER" | awk '{print $2}')
    
    # Check Token Validity
    local check=$(curl -s -o /dev/null -w "%{http_code}" -k -H "Authorization: Bearer $PORTAINER_TOKEN" "https://$PORTAINER_DOMAIN/api/endpoints")
    if [ "$check" != "200" ]; then
        # Tenta renovar
        PORTAINER_USER=$(grep "Usuario:" "$DADOS_PORTAINER" | awk '{print $2}')
        PORTAINER_PASS=$(grep "Senha:" "$DADOS_PORTAINER" | awk '{print $2}')
        local response=$(curl -s -k -X POST "https://$PORTAINER_DOMAIN/api/auth" -H "Content-Type: application/json" -d "{\"username\":\"$PORTAINER_USER\",\"password\":\"$PORTAINER_PASS\"}")
        local jwt=$(echo "$response" | jq -r .jwt)
        if [ -n "$jwt" ] && [ "$jwt" != "null" ]; then
            PORTAINER_TOKEN="$jwt"
            # Atualiza token no arquivo (hacky sed replacement)
            sed -i "s|Token: .*|Token: $PORTAINER_TOKEN|" "$DADOS_PORTAINER"
        else
            log_error "Falha ao autenticar no Portainer."
            return 1
        fi
    fi
    return 0
}

obter_swarm_info() {
    log_info "Obtendo informações do Swarm via Portainer..."
    
    # Debug: Listar endpoints para ver o que está retornando
    local endpoints_response=$(curl -s -k -H "Authorization: Bearer $PORTAINER_TOKEN" "https://$PORTAINER_DOMAIN/api/endpoints")
    
    # Tenta pegar o ID do primeiro endpoint (geralmente o local/primary)
    PORTAINER_ENDPOINT_ID=$(echo "$endpoints_response" | jq '.[0].Id')
    
    # Validação rigorosa
    if [ "$PORTAINER_ENDPOINT_ID" == "null" ] || [ -z "$PORTAINER_ENDPOINT_ID" ]; then
        log_error "Não foi possível obter o ID do Endpoint do Portainer."
        log_error "Resposta da API: $endpoints_response"
        
        # Tentativa de fallback: buscar pelo nome "local" ou "primary"
        PORTAINER_ENDPOINT_ID=$(echo "$endpoints_response" | jq -r '.[] | select(.Name=="local" or .Name=="primary") | .Id' | head -n 1)
        
        if [ -z "$PORTAINER_ENDPOINT_ID" ]; then
             log_error "Falha crítica: Nenhum endpoint válido encontrado no Portainer."
             exit 1
        fi
    fi
    
    log_info "Endpoint ID detectado: $PORTAINER_ENDPOINT_ID"

    # Obter Swarm ID
    PORTAINER_SWARM_ID=$(curl -s -k -H "Authorization: Bearer $PORTAINER_TOKEN" "https://$PORTAINER_DOMAIN/api/endpoints/$PORTAINER_ENDPOINT_ID/docker/swarm" | jq -r '.ID')
    
    if [ "$PORTAINER_SWARM_ID" == "null" ] || [ -z "$PORTAINER_SWARM_ID" ]; then
        log_error "Não foi possível obter o Swarm ID."
        # Em alguns casos o deploy funciona sem SwarmID se for stack compose, mas para swarm mode precisa.
        # Vamos tentar continuar mas avisando
        log_error "Continuando sem Swarm ID (pode falhar se for stack Swarm)..."
    else
        log_info "Swarm ID detectado: $PORTAINER_SWARM_ID"
    fi
}

# --- Infraestrutura ---

install_docker() {
    if ! command -v docker &> /dev/null; then
        log_info "Instalando Docker..."
        
        # Tentativa 1: Script oficial
        if curl -fsSL https://get.docker.com | bash; then
            log_success "Docker instalado via script oficial."
        else
            log_info "Falha na instalação via script. Tentando método manual..."
            
            # Tentativa 2: Manual (Ubuntu/Debian)
            apt-get update -qq >/dev/null 2>&1
            apt-get install -y ca-certificates curl gnupg lsb-release >/dev/null 2>&1
            mkdir -p /etc/apt/keyrings
            curl -fsSL https://download.docker.com/linux/ubuntu/gpg | tee /etc/apt/keyrings/docker.asc > /dev/null
            chmod a+r /etc/apt/keyrings/docker.asc
            
            echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
            
            apt-get update -qq >/dev/null 2>&1
            apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >/dev/null 2>&1
            
            if command -v docker &> /dev/null; then
                 log_success "Docker instalado via método manual."
            else
                 log_error "Falha crítica ao instalar Docker."
                 exit 1
            fi
        fi
        
        systemctl enable docker >/dev/null 2>&1
        systemctl start docker >/dev/null 2>&1
        
        # Aplicar correção DOCKER_MIN_API_VERSION=1.24 (SetupOrion Pattern)
        mkdir -p /etc/systemd/system/docker.service.d
        cat > /etc/systemd/system/docker.service.d/override.conf <<EOF
[Service]
Environment=DOCKER_MIN_API_VERSION=1.24
EOF
        systemctl daemon-reload >/dev/null 2>&1
        systemctl restart docker >/dev/null 2>&1
        log_success "Correção DOCKER_MIN_API_VERSION aplicada."
        
    else
        log_info "Docker já instalado."
    fi
}

init_swarm() {
    if ! docker info 2>/dev/null | grep -q "Swarm: active"; then
        log_info "Inicializando Docker Swarm..."
        local ip_addr=$(hostname -I | awk '{print $1}')
        local max_attempts=3
        local attempt=1
        
        while [ $attempt -le $max_attempts ]; do
            if docker swarm init --advertise-addr "$ip_addr"; then
                log_success "Swarm inicializado."
                return 0
            else
                log_error "Falha ao iniciar Swarm (Tentativa $attempt/$max_attempts)."
                attempt=$((attempt + 1))
                sleep 5
            fi
        done
        
        log_error "Não foi possível iniciar o Swarm após $max_attempts tentativas."
        exit 1
    else
        log_info "Swarm já ativo."
    fi
}

setup_infra_wizard() {
    header
    echo -e "${BRANCO}Bem-vindo ao SetupWatink!${RESET}"
    echo ""
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo -e "${AMARELO}Docker não detectado.${RESET}"
        read -p "Deseja instalar a infraestrutura agora? (y/n) " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Docker é necessário. Abortando."
            exit 1
        fi
    else
        # Se Docker existe, mas usuário quer reconfigurar infra
        echo -e "${VERDE}Docker detectado.${RESET}"
        # Se swarm não ativo e usuário quer cluster, ou se quer standalone
    fi

    echo -e "${BRANCO}Escolha o modo de operação da VPS:${RESET}"
    echo -e "${VERDE}1${BRANCO} - Standalone (Sem Swarm, Apenas Docker)${RESET}"
    echo -e "${VERDE}2${BRANCO} - Cluster (Swarm + Traefik + Portainer)${RESET}"
    echo ""
    read -p "Opção: " INFRA_OPT

    case $INFRA_OPT in
        1)
            install_docker
            # Garante que Swarm NÃO está ativo (se user quiser standalone puro)
            if docker info 2>/dev/null | grep -q "Swarm: active"; then
                echo -e "${AMARELO}Aviso: Swarm está ativo, mas modo Standalone foi selecionado.${RESET}"
                echo -e "${AMARELO}Isso não impede o funcionamento, mas o deploy será via 'docker compose'.${RESET}"
            fi
            ;;
        2)
            install_docker
            init_swarm
            setup_traefik_portainer
            ;;
        *)
            echo "Opção inválida."
            exit 1
            ;;
    esac
}

setup_traefik_portainer() {
    log_info "Verificando estado atual da infraestrutura..."

    local infra_ok=true
    
    # 1. Verifica Swarm
    if ! docker info 2>/dev/null | grep -q "Swarm: active"; then infra_ok=false; fi
    
    # 2. Verifica Stacks
    if ! docker stack ls 2>/dev/null | grep -q "traefik"; then infra_ok=false; fi
    if ! docker stack ls 2>/dev/null | grep -q "portainer"; then infra_ok=false; fi
    
    # 3. Verifica Credenciais
    if [ ! -f "$DADOS_PORTAINER" ]; then infra_ok=false; fi

    if [ "$infra_ok" = true ]; then
        log_success "Infraestrutura (Swarm + Traefik + Portainer) já detectada!"
        log_info "Tentando reutilizar configurações existentes..."
        
        # Carregar variáveis para validar token
        PORTAINER_DOMAIN=$(grep "Dominio do portainer:" "$DADOS_PORTAINER" | awk '{print $4}' | sed 's|https://||g')
        PORTAINER_USER=$(grep "Usuario:" "$DADOS_PORTAINER" | awk '{print $2}')
        PORTAINER_PASS=$(grep "Senha:" "$DADOS_PORTAINER" | awk '{print $2}')
        PORTAINER_TOKEN=$(grep "Token:" "$DADOS_PORTAINER" | awk '{print $2}')
        REDE_INTERNA=$(grep "Rede:" "$DADOS_PORTAINER" | awk '{print $2}')

        # Compatibilidade SetupOrion: Tentar ler de dados_vps se estiver vazio
        if [ -z "$REDE_INTERNA" ] && [ -f "$DADOS_DIR/dados_vps" ]; then
            REDE_INTERNA=$(grep "Rede interna:" "$DADOS_DIR/dados_vps" | awk -F': ' '{print $2}')
        fi

        # Auto-detecção via Docker Service se ainda estiver vazio
        if [ -z "$REDE_INTERNA" ]; then
             if docker service ls --format '{{.Name}}' | grep -q "traefik_traefik"; then
                 local net_id=$(docker service inspect traefik_traefik --format '{{range .Spec.TaskTemplate.Networks}}{{.Target}}{{end}}')
                 if [ -n "$net_id" ]; then
                     REDE_INTERNA=$(docker network inspect "$net_id" --format '{{.Name}}')
                     log_info "Rede detectada via serviço Traefik: $REDE_INTERNA"
                 fi
             fi
        fi

        # Se detectou rede, atualiza o arquivo para persistência e uso futuro
        if [ -n "$REDE_INTERNA" ]; then
            if ! grep -q "Rede:" "$DADOS_PORTAINER"; then
                echo "Rede: $REDE_INTERNA" >> "$DADOS_PORTAINER"
            fi
        else
            # Fallback seguro
            REDE_INTERNA="public_net"
        fi
        
        # Validar token/acesso
        if verificar_credenciais_portainer; then
             log_success "Credenciais validadas. Infraestrutura pronta para uso."
             echo -e "${VERDE}Reutilizando infraestrutura existente.${RESET}"
             read -p "Pressione ENTER para continuar..."
             return 0
        else
             log_error "Infraestrutura existe, mas credenciais salvas são inválidas."
             log_info "Prosseguindo com reconfiguração..."
        fi
    else
        log_info "Infraestrutura incompleta ou inexistente. Iniciando instalação..."
    fi

    log_info "Configurando Cluster (Traefik + Portainer)..."

    # Inputs
    header
    echo -e "${BRANCO}Configuração do Portainer e Traefik${RESET}"
    echo ""
    read -p "Domínio do Portainer (ex: portainer.meudominio.com): " PORTAINER_DOMAIN
    PORTAINER_DOMAIN=$(echo "$PORTAINER_DOMAIN" | sed 's|https://||g' | sed 's|http://||g' | sed 's|/||g')
    
    read -p "Usuário Admin Portainer (ex: admin): " PORTAINER_USER
    
    while true; do
        read -s -p "Senha Admin Portainer (Min 12 chars, Maiusc, Minusc, Num, @/_): " PORTAINER_PASS
        echo ""
        if validar_senha "$PORTAINER_PASS" 12; then
            break
        fi
    done

    read -p "Nome da Rede Interna (padrão: public_net): " REDE_INTERNA
    REDE_INTERNA=${REDE_INTERNA:-public_net}

    read -p "Email para SSL (LetsEncrypt): " EMAIL_SSL

    # Criar Rede
    if ! docker network ls --format '{{.Name}}' | grep -q "^$REDE_INTERNA$"; then
        docker network create --driver=overlay --attachable "$REDE_INTERNA"
        log_success "Rede $REDE_INTERNA criada."
    fi

    # Criar Volumes Externos (Compatibilidade SetupOrion)
    local volumes=("volume_swarm_certificates" "volume_swarm_shared" "portainer_data")
    for vol in "${volumes[@]}"; do
        if ! docker volume ls --format '{{.Name}}' | grep -q "^$vol$"; then
            docker volume create "$vol" >/dev/null
            log_success "Volume $vol criado."
        fi
    done

    # Deploy Traefik
    log_info "Criando stack Traefik..."
    # Verificação de portas antes de iniciar
    if netstat -tuln | grep -E ':80 |:443 '; then
        log_error "Portas 80 ou 443 já estão em uso. O Traefik não poderá subir."
        log_error "Por favor, libere as portas ou pare serviços conflitantes (apache, nginx, etc)."
        exit 1
    fi

    cat > traefik_stack.yaml <<EOF
version: "3.7"
services:

## --------------------------- ORION --------------------------- ##

  traefik:
    image: traefik:v3.4.0
    command:
      - "--api.dashboard=true"
      - "--providers.swarm=true"
      - "--providers.docker.endpoint=unix:///var/run/docker.sock"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.docker.network=$REDE_INTERNA" ## Nome da rede interna
      - "--entrypoints.web.address=:80"
      - "--entrypoints.web.http.redirections.entryPoint.to=websecure"
      - "--entrypoints.web.http.redirections.entryPoint.scheme=https"
      - "--entrypoints.web.http.redirections.entrypoint.permanent=true"
      - "--entrypoints.websecure.address=:443"
      - "--entrypoints.web.transport.respondingTimeouts.idleTimeout=3600"
      - "--certificatesresolvers.letsencryptresolver.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencryptresolver.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencryptresolver.acme.storage=/etc/traefik/letsencrypt/acme.json"
      - "--certificatesresolvers.letsencryptresolver.acme.email=$EMAIL_SSL" ## Email para receber as notificações
      - "--log.level=DEBUG"
      - "--log.format=common"
      - "--log.filePath=/var/log/traefik/traefik.log"
      - "--accesslog=true"
      - "--accesslog.filepath=/var/log/traefik/access-log"

    volumes:
      - "vol_certificates:/etc/traefik/letsencrypt"
      - "/var/run/docker.sock:/var/run/docker.sock:ro"

    networks:
      - $REDE_INTERNA ## Nome da rede interna

    ports:
      - target: 80
        published: 80
        mode: host
      - target: 443
        published: 443
        mode: host

    deploy:
      placement:
        constraints:
          - node.role == manager
      labels:
        - "traefik.enable=true"
        - "traefik.http.middlewares.redirect-https.redirectscheme.scheme=https"
        - "traefik.http.middlewares.redirect-https.redirectscheme.permanent=true"
        - "traefik.http.routers.http-catchall.rule=Host(\`{host:.+}\`)"
        - "traefik.http.routers.http-catchall.entrypoints=web"
        - "traefik.http.routers.http-catchall.middlewares=redirect-https@docker"
        - "traefik.http.routers.http-catchall.priority=1"

## --------------------------- ORION --------------------------- ##

volumes:
  vol_shared:
    external: true
    name: volume_swarm_shared
  vol_certificates:
    external: true
    name: volume_swarm_certificates

networks:
  $REDE_INTERNA: ## Nome da rede interna
    external: true
    attachable: true
    name: $REDE_INTERNA ## Nome da rede interna
EOF
    docker stack deploy --prune --resolve-image always -c traefik_stack.yaml traefik
    wait_stack "traefik_traefik"

    # Deploy Portainer
    log_info "Criando stack Portainer..."
    cat > portainer_stack.yaml <<EOF
version: "3.7"
services:

## --------------------------- ORION --------------------------- ##

  agent:
    image: portainer/agent:latest ## Versão Agent do Portainer

    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /var/lib/docker/volumes:/var/lib/docker/volumes

    networks:
      - $REDE_INTERNA ## Nome da rede interna

    deploy:
      mode: global
      placement:
        constraints: [node.platform.os == linux]

## --------------------------- ORION --------------------------- ##

  portainer:
    image: portainer/portainer-ce:latest ## Versão do Portainer
    command: -H tcp://tasks.agent:9001 --tlsskipverify

    volumes:
      - portainer_data:/data

    networks:
      - $REDE_INTERNA ## Nome da rede interna

    deploy:
      mode: replicated
      replicas: 1
      placement:
        constraints: [node.role == manager]
      labels:
        - "traefik.enable=true"
        - "traefik.http.routers.portainer.rule=Host(\`$PORTAINER_DOMAIN\`)" ## Dominio do Portainer
        - "traefik.http.services.portainer.loadbalancer.server.port=9000"
        - "traefik.http.routers.portainer.tls.certresolver=letsencryptresolver"
        - "traefik.http.routers.portainer.service=portainer"
        - "traefik.docker.network=$REDE_INTERNA" ## Nome da rede interna
        - "traefik.http.routers.portainer.entrypoints=websecure"
        - "traefik.http.routers.portainer.priority=1"

## --------------------------- ORION --------------------------- ##

volumes:
  portainer_data:
    external: true
    name: portainer_data

networks:
  $REDE_INTERNA: ## Nome da rede interna
    external: true
    attachable: true
    name: $REDE_INTERNA ## Nome da rede interna
EOF
    docker stack deploy --prune --resolve-image always -c portainer_stack.yaml portainer
    wait_stack "portainer_portainer"
    
    # Aguardar API do Portainer estar pronta
    wait_for_portainer_api "$PORTAINER_DOMAIN"

    # Configurar Admin Portainer
    log_info "Criando conta Admin no Portainer..."
    sleep 5
    local max_retries=4
    local delay=15
    local conta_criada=false
    
    for i in $(seq 1 $max_retries); do
        RESPONSE=$(curl -k -s -X POST "https://$PORTAINER_DOMAIN/api/users/admin/init" \
            -H "Content-Type: application/json" \
            -d "{\"Username\": \"$PORTAINER_USER\", \"Password\": \"$PORTAINER_PASS\"}")
        
        # SetupOrion check pattern
        if echo "$RESPONSE" | grep -q "\"Username\":\"$PORTAINER_USER\""; then
            log_success "Conta admin criada com sucesso!"
            conta_criada=true
            break
        else
            log_info "Tentativa $i/$max_retries - Aguardando Portainer..."
            if [ $i -eq $max_retries ]; then
                 log_error "Não foi possível criar a conta de administrador após $max_retries tentativas."
                 log_error "Erro retornado: $RESPONSE"
            fi
            sleep $delay
        fi
    done

    # Gerar Token
    local token=""
    if [ "$conta_criada" = true ]; then
        log_info "Autenticando para gerar token..."
        sleep 5
        
        # SetupOrion Auth Pattern
        local auth_response=$(curl -k -s -X POST "https://$PORTAINER_DOMAIN/api/auth" \
            -H "Content-Type: application/json" \
            -d "{\"username\":\"$PORTAINER_USER\",\"password\":\"$PORTAINER_PASS\"}")
            
        token=$(echo "$auth_response" | jq -r .jwt 2>/dev/null)
        
        if [ -n "$token" ] && [ "$token" != "null" ]; then
             log_success "Token gerado com sucesso."
        else
             log_error "Falha ao gerar token de autenticação."
             log_error "Resposta da API Auth: $auth_response"
             # Não abortamos fatalmente aqui para permitir que o usuário tente acessar manualmente,
             # mas o script falhará nos próximos passos se depender do token.
        fi
    fi

    # Salvar Credenciais
    mkdir -p "$DADOS_DIR"
    cat > "$DADOS_PORTAINER" <<EOF
[ PORTAINER ]
Dominio do portainer: $PORTAINER_DOMAIN
Usuario: $PORTAINER_USER
Senha: $PORTAINER_PASS
Token: $token
Rede: $REDE_INTERNA
EOF
    log_success "Infraestrutura configurada com sucesso!"
    echo -e "${VERDE}Credenciais salvas em $DADOS_PORTAINER${RESET}"
    read -p "Pressione ENTER para continuar..."
}



# --- Geradores de Stack ---

generate_stack_standalone() {
    # Para standalone usamos docker-compose standard
    cat <<EOF > docker-compose.standalone.yml
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
      - backend_public_data:/app/public
    depends_on:
      - watink_postgres
      - redis
      - rabbitmq
    deploy:
      resources:
        limits:
          cpus: '0.50'
          memory: 1024M

  frontend:
    image: watink/frontend:latest
    ports:
      - "3000:80"
    environment:
      - URL_BACKEND=backend:8080
      - VITE_BACKEND_URL=$URL_BACKEND/
      - VITE_PLUGIN_MANAGER_URL=/plugins/
      - VITE_HOURS_CLOSE_TICKETS_AUTO=24
    depends_on:
      - backend

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
    depends_on:
      - rabbitmq
      - redis
      - watink_postgres
    deploy:
      resources:
        limits:
          cpus: '0.50'
          memory: 2048M

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
    depends_on:
      - watink_postgres
      - rabbitmq
      - redis
    deploy:
      resources:
        limits:
          cpus: '0.50'
          memory: 512M

  watink-guard:
    image: watink/guard:latest
    environment:
      - DATABASE_URL=postgres://postgres:$DB_PASS@watink_postgres:5432/watink
      - RABBITMQ_URL=amqp://guest:guest@rabbitmq:5672/
      - WATINK_MASTER_KEY=${MASTER_KEY:-change_me_in_production}
    depends_on:
      - watink_postgres
      - rabbitmq
    deploy:
      resources:
        limits:
          cpus: '0.25'
          memory: 128M

  rabbitmq:
    image: rabbitmq:3-management-alpine
    ports:
      - "15672:15672"
      - "5672:5672"
    deploy:
      resources:
        limits:
          memory: 1024M

  redis:
    image: redis:alpine
    command: [ "redis-server", "--appendonly", "yes" ]
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    deploy:
      resources:
        limits:
          memory: 512M

  watink_postgres:
    image: watink/postgres-postgis-pgvector:16-optimized
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=watink
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=$DB_PASS
    volumes:
      - db_data:/var/lib/postgresql/data

volumes:
  db_data:
  redis_data:
  backend_public_data:
EOF
}

generate_stack_traefik() {
    # Tenta ler rede do arquivo de portainer, senao default
    local NET_PROXY="public_net"
    if [ -f "$DADOS_PORTAINER" ]; then
        local saved_net=$(grep "Rede:" "$DADOS_PORTAINER" | awk '{print $2}')
        if [ -n "$saved_net" ]; then NET_PROXY="$saved_net"; fi
    fi

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
      - backend_public_data:/app/public
    networks:
      - watink_proxy
      - watink_network
    deploy:
      mode: replicated
      replicas: 1
      update_config:
        parallelism: 1
        delay: 10s
      resources:
        limits:
          cpus: '0.50'
          memory: 1024M
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
      resources:
        limits:
          cpus: '0.50'
          memory: 2048M

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
      resources:
        limits:
          cpus: '0.50'
          memory: 512M

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
    deploy:
      mode: replicated
      replicas: 1
      resources:
        limits:
          cpus: '0.25'
          memory: 128M

  rabbitmq:
    image: rabbitmq:3-management-alpine
    networks:
      - watink_network
    deploy:
      mode: replicated
      replicas: 1
      resources:
        limits:
          memory: 1024M

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
      resources:
        limits:
          memory: 512M

  watink_postgres:
    image: watink/postgres-postgis-pgvector:16-optimized
    environment:
      - POSTGRES_DB=watink
      - POSTGRES_USER=postgres
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
  watink_network:
    driver: overlay
    name: watink_network

volumes:
  db_data:
  redis_data:
  backend_public_data:
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
    
    verificar_credenciais_portainer || exit 1
    obter_swarm_info
    
    log_info "Enviando stack $stack_name para o Portainer..."
    
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
    # rm "$file_path"  <-- Mantido para debug/referência futura
    
    if [ "$http_code" == "200" ]; then
        log_success "Deploy concluído com sucesso!"
        return 0
    else
        log_error "Falha no deploy (HTTP $http_code): $body"
        return 1
    fi
}

deploy_standalone() {
    log_info "Iniciando deploy Standalone..."
    docker compose -f docker-compose.standalone.yml up -d
    if [ $? -eq 0 ]; then
        log_success "Containers iniciados."
    else
        log_error "Falha ao iniciar containers."
    fi
}

remover_stack() {
    read -p "Qual stack deseja remover? (padrão: watink): " stack_name
    stack_name=${stack_name:-watink}
    
    # Tenta remover via Portainer (se credenciais existirem)
    if [ -f "$DADOS_PORTAINER" ]; then
        verificar_credenciais_portainer || return 1
        obter_swarm_info
        local stack_id=$(curl -s -k -H "Authorization: Bearer $PORTAINER_TOKEN" "https://$PORTAINER_DOMAIN/api/stacks" | jq -r ".[] | select(.Name == \"$stack_name\") | .Id")
        if [ -n "$stack_id" ] && [ "$stack_id" != "null" ]; then
             curl -s -k -X DELETE -H "Authorization: Bearer $PORTAINER_TOKEN" "https://$PORTAINER_DOMAIN/api/stacks/$stack_id?endpointId=$PORTAINER_ENDPOINT_ID" >/dev/null
             log_success "Stack removida via Portainer."
             return
        fi
    fi

    # Fallback para docker compose (standalone)
    log_info "Tentando remover via docker compose..."
    docker compose -f docker-compose.standalone.yml down 2>/dev/null || docker stack rm "$stack_name" 2>/dev/null
    log_success "Comandos de remoção executados."
}

full_cleanup() {
    clear
    echo -e "${VERMELHO}###############################################################${RESET}"
    echo -e "${VERMELHO}#                     PERIGO: ZONA DESTRUTIVA                 #${RESET}"
    echo -e "${VERMELHO}###############################################################${RESET}"
    echo ""
    echo -e "${AMARELO}Você solicitou a REMOÇÃO TOTAL de todo o ambiente Watink e Docker.${RESET}"
    echo -e "${BRANCO}Esta ação fará o seguinte:${RESET}"
    echo -e "1. Parar e remover ${VERMELHO}TODOS${RESET} os containers do sistema."
    echo -e "2. Remover ${VERMELHO}TODOS${RESET} os volumes (banco de dados, redis, etc)."
    echo -e "3. Remover ${VERMELHO}TODAS${RESET} as imagens Docker baixadas."
    echo -e "4. Desfazer o Swarm e remover redes."
    echo -e "5. Desinstalar o Docker Engine e CLI."
    echo -e "6. Apagar pastas de dados ($DADOS_DIR) e logs."
    echo ""
    echo -e "${VERMELHO}A VPS ficará como se fosse recém-formatada (em relação ao Docker/Watink).${RESET}"
    echo -e "${VERMELHO}ESTA AÇÃO É IRREVERSÍVEL!${RESET}"
    echo ""
    
    read -p "Tem certeza absoluta que deseja continuar? Digite 'DESTRUIR' para confirmar: " CONFIRMACAO
    
    if [ "$CONFIRMACAO" != "DESTRUIR" ]; then
        log_info "Limpeza cancelada pelo usuário."
        echo -e "${VERDE}Operação cancelada. Nada foi alterado.${RESET}"
        read -p "Pressione ENTER para voltar..."
        return
    fi
    
    echo ""
    log_info "Iniciando limpeza total do sistema..."
    
    # 1. Remover Stacks e Containers
    echo -e "${AMARELO}1/6 - Removendo containers e stacks...${RESET}"
    docker stack rm watink traefik portainer 2>/dev/null
    docker compose -f docker-compose.standalone.yml down -v 2>/dev/null
    docker rm -f $(docker ps -a -q) 2>/dev/null
    
    # 2. Leave Swarm
    echo -e "${AMARELO}2/6 - Saindo do Docker Swarm...${RESET}"
    docker swarm leave --force 2>/dev/null
    
    # 3. Prune System (Volumes, Networks, Images)
    echo -e "${AMARELO}3/6 - Limpando volumes, redes e imagens...${RESET}"
    docker system prune -a --volumes -f 2>/dev/null
    
    # 4. Parar Docker
    echo -e "${AMARELO}4/6 - Parando serviço Docker...${RESET}"
    systemctl stop docker 2>/dev/null
    systemctl stop docker.socket 2>/dev/null
    
    # 5. Desinstalar Docker
    echo -e "${AMARELO}5/6 - Desinstalando Docker...${RESET}"
    apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-ce-rootless-extras 2>/dev/null
    rm -rf /var/lib/docker
    rm -rf /var/lib/containerd
    
    # 6. Limpar Arquivos
    echo -e "${AMARELO}6/6 - Removendo arquivos de dados e logs...${RESET}"
    rm -rf "$DADOS_DIR"
    rm -rf dados_vps
    rm -f "$LOG_FILE"
    rm -f docker-compose.standalone.yml watink.yaml traefik_stack.yaml portainer_stack.yaml
    
    log_success "Limpeza total concluída."
    echo ""
    echo -e "${VERDE}###############################################################${RESET}"
    echo -e "${VERDE}#                 SISTEMA LIMPO COM SUCESSO                   #${RESET}"
    echo -e "${VERDE}###############################################################${RESET}"
    echo ""
    echo -e "O Docker e todos os dados do Watink foram removidos."
    read -p "Pressione ENTER para sair..."
    exit 0
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
                read -p "Domínio Frontend (ex: app.meudominio.com): " DOMAIN_FRONTEND
                read -p "Domínio Backend (ex: api.meudominio.com): " DOMAIN_BACKEND
                
                DB_PASS=$(openssl rand -hex 12)
                MASTER_KEY=$(openssl rand -hex 16 | tr -d '\n')
                
                generate_stack_traefik
                deploy_stack_swarm "watink"
                
                mkdir -p "$DADOS_DIR"
                echo -e "[ WATINK ]\nMode: Traefik\nFrontend: https://$DOMAIN_FRONTEND\nBackend: https://$DOMAIN_BACKEND\nDB Pass: $DB_PASS\nMaster Key: $MASTER_KEY" > "$DADOS_WATINK"
                cat "$DADOS_WATINK"
                read -p "Pressione ENTER para continuar..."
                ;;
            
            2)
                check_root
                echo -e "${AMARELO}Modo Standalone: Portas 3000 e 8080 serão expostas.${RESET}"
                read -p "IP/URL Frontend (para CORS, ex: http://localhost:3000): " FRONTEND_URL
                read -p "IP/URL Backend (para API, ex: http://localhost:8080): " URL_BACKEND
                
                DB_PASS=$(openssl rand -hex 12)
                MASTER_KEY=$(openssl rand -hex 16 | tr -d '\n')
                
                generate_stack_standalone
                deploy_standalone
                
                mkdir -p "$DADOS_DIR"
                echo -e "[ WATINK ]\nMode: Standalone\nFrontend: $FRONTEND_URL\nBackend: $URL_BACKEND\nDB Pass: $DB_PASS\nMaster Key: $MASTER_KEY" > "$DADOS_WATINK"
                cat "$DADOS_WATINK"
                read -p "Pressione ENTER para continuar..."
                ;;
                
            3)
                check_root
                remover_stack
                read -p "Pressione ENTER para continuar..."
                ;;
            0)
                clear
                exit 0
                ;;
            99)
                check_root
                full_cleanup
                ;;
            *)
                echo "Opção inválida"
                sleep 1
                ;;
        esac
    done
}

# Start Logic
check_root
install_deps
# Check infra and run wizard if needed
if ! command -v docker &> /dev/null || [ "$1" == "--setup-infra" ]; then
    setup_infra_wizard
fi

# Show Main Menu
menu_principal
