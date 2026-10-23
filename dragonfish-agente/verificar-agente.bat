@echo off
REM Doble clic para ver si el agente de Dragon Fish esta funcionando, sin
REM tener que abrir agente.log a mano. No cambia nada, solo muestra.
cd /d "%~dp0"
echo ==============================================
echo   Estado del agente de Dragon Fish - Retornar
echo ==============================================
echo.
tasklist /FI "IMAGENAME eq node.exe" 2>nul | find /I "node.exe" >nul
if errorlevel 1 (
  echo [ATENCION] El agente NO esta corriendo en esta PC.
  echo            Para abrirlo a mano: doble clic en iniciar-agente.bat
) else (
  echo [OK] El agente esta corriendo.
)
echo.
if exist agente.log (
  echo Ultimas lineas de agente.log ^(la de mas abajo es la mas reciente^):
  echo ----------------------------------------------
  powershell -NoProfile -Command "Get-Content -Path 'agente.log' -Tail 15"
  echo ----------------------------------------------
  echo Si la ultima linea tiene la fecha y hora de hoy, esta todo bien.
) else (
  echo [ATENCION] Todavia no existe agente.log en esta carpeta:
  echo            el agente nunca se abrio con iniciar-agente.bat.
)
echo.
pause
