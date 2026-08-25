# Tareas futuras — Fideliza

> Lo que sigue apenas se pueda retomar, en orden. Ver `sesion-actual.md`
> para el detalle completo de cómo se llegó a este punto.

## 1. Pagar / actualizar el plan de Netlify (bloqueante)

La cuenta se quedó sin créditos operativos del ciclo de facturación —
Netlify pausó los deploys de producción nuevos (el último deploy publicado
sigue siendo el del merge del PR #9, `main@bec2deb`). Cecilia dijo que iba
a hacer el upgrade del plan al día siguiente.

- [ ] Actualizar el plan en el dashboard de Netlify.
- [ ] Confirmar que los deploys de producción vuelven a activarse (probar
      con un merge o un "Trigger deploy" manual).

## 2. Hacer funcionar los ítems (retomar el diagnóstico)

Ya en la rama de trabajo (`claude/fideliza-retomada-af1eus`), sin PR
abierto todavía, hay un commit que agrega manejo de errores (`try/catch` +
alerta visible) a todos los botones de guardado que antes fallaban en
silencio (`crearNegocio`, `guardarEdicionNegocio`, `crearPremio`,
`guardarEdicionPremio`, `togglePremioActivo`, `guardarIntegraciones`,
`guardarPuntosXPeso`, `cambiarPassword`, `agregarCliente`, `sumarPuntos`).

No quedó confirmado si esto era la única causa de "toco guardar negocio y
no pasa nada" en producción, o si el corte de créditos de Netlify también
afectaba la ejecución de las funciones serverless (no solo los deploys
nuevos). Pasos para retomar, una vez reactivado Netlify:

- [ ] Abrir el PR con el commit de manejo de errores (`f670029`).
- [ ] Probarlo en el deploy-preview de ese PR.
- [ ] Fusionarlo y esperar el deploy a producción.
- [ ] Volver a probar en producción: crear un negocio de prueba, editar
      un negocio, entrar como ese negocio y probar Mis clientes / Premios
      / Canjes / Integraciones / Ajustes.
- [ ] Si ahora aparece un mensaje de error visible en vez de "no pasa
      nada": leer el mensaje exacto (puede requerir mirar los logs de la
      función en Netlify) y recién ahí diagnosticar la causa de fondo.
- [ ] Si todo funciona sin errores: cerrar este pendiente, no hay causa de
      fondo adicional — era el manejo de errores faltante.

## 3. Ítem "Ajustes" del panel Admin (sin construir)

A diferencia de "Ajustes" del panel de negocio (ya construido en el PR
#9: contraseña, `puntosXPeso`, datos de cuenta), el "Ajustes" del panel
Admin sigue sin alcance definido y sin backend. Queda pendiente de una
charla futura sobre qué debería incluir (¿configuración global del
sistema? ¿gestión de usuarios admin? ¿algo más?) antes de encararlo.

## 4. Otros pendientes menores (de sesiones previas, sin resolver)

- Confirmar si hace falta alguna acción adicional sobre el agente local de
  Dragon Fish (quedó bloqueado esperando el formato real del payload de
  parte de Zoo Logic).
