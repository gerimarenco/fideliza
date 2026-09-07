@echo off
cd /d "%~dp0"

:loop
echo %date% %time% - Arrancando agente Dragon Fish >> agente.log
node index.js >> agente.log 2>&1
echo %date% %time% - El agente se cerro (revisar agente.log), reintentando en 60 segundos... >> agente.log
timeout /t 60 /nobreak >nul
goto loop
