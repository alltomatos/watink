@echo off
setlocal

echo ======================================================
echo   Watink Core - Inicializacao Standalone
echo ======================================================

:: Verificar Docker
where docker >nul 2>&1
if errorlevel 1 goto :erro_docker

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

:erro_docker
echo [ERRO] Docker nao encontrado.
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
