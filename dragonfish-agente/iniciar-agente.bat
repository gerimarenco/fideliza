@echo off
REM Lanzador del agente de Dragon Fish de Retornar. Pensado para el
REM Programador de tareas de Windows: no muestra nada en pantalla, todo queda
REM en agente.log (en esta misma carpeta). Si el agente se cierra por
REM cualquier motivo, lo vuelve a abrir solo al minuto.
cd /d "%~dp0"

:loop
REM Si agente.log pasa de ~5 MB se guarda como agente-anterior.log y se
REM empieza uno nuevo, para que no crezca sin limite con los meses.
if exist agente.log for %%A in (agente.log) do if %%~zA GTR 5000000 move /y agente.log agente-anterior.log >nul

echo %date% %time% - Iniciando agente Dragon Fish (carpeta: %~dp0) >> agente.log

where node >nul 2>nul
if errorlevel 1 (
  echo %date% %time% - ERROR: no se encuentra Node.js para este usuario. Instalarlo desde nodejs.org o revisar el PATH. Reintento en 60 segundos... >> agente.log
  timeout /t 60 /nobreak >nul
  goto loop
)

if not exist .env (
  echo %date% %time% - ERROR: falta el archivo .env en %~dp0 ^(copiar .env.example a .env y completarlo^). Reintento en 60 segundos... >> agente.log
  timeout /t 60 /nobreak >nul
  goto loop
)

node index.js >> agente.log 2>&1
echo %date% %time% - El agente se cerro (ver lineas de arriba), reintentando en 60 segundos... >> agente.log
timeout /t 60 /nobreak >nul
goto loop
