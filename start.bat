@echo off
setlocal

echo ======================================================
echo   Watink Core - Inicializacao Standalone
echo ======================================================

:: Verificar Docker Desktop instalado
set "DOCKER_DESKTOP_EXE=%ProgramFiles%\Docker\Docker\Docker Desktop.exe"
if not exist "%DOCKER_DESKTOP_EXE%" (
  set "DOCKER_DESKTOP_EXE=%ProgramFiles(x86)%\Docker\Docker\Docker Desktop.exe"
)
if not exist "%DOCKER_DESKTOP_EXE%" goto :erro_docker_desktop

:: Verificar Docker CLI no PATH
where docker >nul 2>&1
if errorlevel 1 goto :erro_docker

:: Verificar Docker Engine respondendo
for /f %%s in ('docker info --format "{{.ServerVersion}}" 2^>nul') do set "DOCKER_SERVER=%%s"
if "%DOCKER_SERVER%"=="" goto :erro_docker_not_running

:: Tentar docker-compose
where docker-compose >nul 2>&1
if not errorlevel 1 goto :use_compose_v1

:: Tentar docker compose
docker compose version >nul 2>&1
if not errorlevel 1 goto :use_compose_v2

goto :erro_compose

:use_compose_v1
set COMPOSE_CMD=docker-compose
goto :menu_mode

:use_compose_v2
set COMPOSE_CMD=docker compose
goto :menu_mode

:menu_mode
echo [OK] Docker detectado.
echo [OK] Docker Compose detectado (%COMPOSE_CMD%).
echo.
echo Escolha o modo de inicializacao:
echo.
echo   [1] NORMAL - Iniciar mantendo os dados existentes (Padrao)
echo   [2] LIMPO  - APAGAR todo o banco de dados e iniciar do zero
echo.
set /p "CHOICE=Digite sua escolha (1 ou 2): "

if "%CHOICE%"=="2" goto :start_clean
if "%CHOICE%"=="1" goto :start_normal
:: Default para normal se der enter vazio ou opcao invalida
goto :start_normal

:start_clean
echo.
echo [ATENCAO] Voce escolheu iniciar do ZERO.
echo Parando containers e removendo volumes...
echo.
%COMPOSE_CMD% -f docker-compose.standalone.yml down -v
if errorlevel 1 goto :erro_clean
echo [OK] Ambiente limpo.
goto :start_normal

:start_normal
echo.
echo Iniciando containers em modo Standalone...
echo.

%COMPOSE_CMD% -f docker-compose.standalone.yml up -d
if errorlevel 1 goto :erro_start

echo.
echo ======================================================
echo   Projeto rodando com sucesso!
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8080
echo ======================================================
echo.
echo Exibindo logs em 5 segundos... (Pressione Ctrl+C para parar de ver logs)
echo.
timeout /t 5
%COMPOSE_CMD% -f docker-compose.standalone.yml logs -f
goto :eof

:erro_docker_desktop
echo [ERRO] Docker Desktop nao encontrado neste computador.
echo Instale o Docker Desktop para Windows e tente novamente:
echo https://www.docker.com/products/docker-desktop/
pause
exit /b 1

:erro_docker
echo [ERRO] Docker CLI nao encontrado no PATH.
echo Abra o Docker Desktop, aguarde inicializar e tente novamente.
pause
exit /b 1

:erro_docker_not_running
echo [ERRO] Docker Desktop instalado, mas o Engine nao esta respondendo.
echo Abra o Docker Desktop e aguarde o status ^"Engine running^".
pause
exit /b 1

:erro_compose
echo [ERRO] Docker Compose nao encontrado.
pause
exit /b 1

:erro_clean
echo [ERRO] Falha ao limpar o ambiente. Verifique se ha arquivos bloqueados.
pause
exit /b 1

:erro_start
echo [ERRO] Falha ao iniciar containers.
pause
exit /b 1
