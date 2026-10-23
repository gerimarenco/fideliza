# Copias de seguridad de la base de datos

Estado: **Pendiente de diagnóstico** — no se sabe todavía qué proveedor de
PostgreSQL se usa en producción (no figura en el código; está en la
variable `DATABASE_URL` de Netlify, a la que Claude no tiene acceso).

Regla de oro: **nunca** restaurar sobre producción para probar. Una copia
se prueba restaurándola en una base aparte.

## 1. Identificar el proveedor (Genaro, 2 minutos)

Netlify → el sitio → **Site configuration → Environment variables →
`DATABASE_URL`** → mirar solo el pedazo después de la `@` (no copiar ni
pegar la variable entera en ningún lado: tiene la contraseña).

| Si dice algo como... | El proveedor es |
|---|---|
| `...neon.tech` | Neon |
| `...supabase.co` / `...supabase.com` | Supabase |
| `...rlwy.net` / `...railway.app` | Railway |
| `...render.com` | Render |
| `db.prisma.io` | Prisma Postgres |
| `...rds.amazonaws.com` | Amazon RDS |

Con ese dato, entrar al panel del proveedor y anotar en la tabla de abajo:

| Pregunta | Respuesta |
|---|---|
| Plan actual (gratis/pago) | |
| ¿Hace copias automáticas? | |
| ¿Cada cuánto y por cuántos días las guarda? | |
| ¿Permite volver a un momento exacto (point-in-time recovery)? | |
| ¿Restaurar tiene costo? | |
| ¿En qué país están los servidores? (lo pide también privacidad) | |

Muchos planes gratuitos guardan poco historial o ninguno: si es el caso,
el punto 2 pasa a ser la única copia real.

## 2. Copia propia, independiente del proveedor

Además de lo que haga el proveedor, una copia semanal propia con `pg_dump`
(herramienta oficial de PostgreSQL), guardada fuera del proveedor.

Requisitos: PostgreSQL instalado en la compu donde se hace la copia (misma
versión mayor que el servidor o más nueva).

```bash
# 1. Copia (formato comprimido de pg_dump). Pedir la URL en el momento, no
#    dejarla guardada en un archivo ni en el historial.
read -s -p "DATABASE_URL de producción: " URL_PROD; echo
pg_dump --format=custom --no-owner --no-privileges "$URL_PROD" \
  --file "retornar-$(date +%Y-%m-%d).dump"
unset URL_PROD
```

`pg_dump` solo lee: no modifica nada en producción.

Dónde guardarla: un lugar privado con acceso restringido (no un chat, no
un mail). Tiene datos personales de todas las clientas.

## 3. Comprobar que la copia sirve (restaurarla aparte)

Una copia que nunca se restauró no está comprobada.

```bash
# Base local descartable, nada que ver con producción
createdb retornar_restauracion_prueba
pg_restore --no-owner --no-privileges --dbname=retornar_restauracion_prueba \
  "retornar-AAAA-MM-DD.dump"

# Comparar conteos con producción (anotar los de producción el mismo día,
# con una consulta de solo lectura en la consola del proveedor)
psql retornar_restauracion_prueba -c '
  SELECT (SELECT count(*) FROM "Negocio") AS negocios,
         (SELECT count(*) FROM "Cliente") AS clientes,
         (SELECT count(*) FROM "MovimientoPuntos") AS movimientos,
         (SELECT count(*) FROM "Canje") AS canjes,
         (SELECT sum(puntos) FROM "Cliente") AS puntos_totales;'

# Al terminar, borrar la base de prueba (tiene datos personales)
dropdb retornar_restauracion_prueba
```

Si los conteos coinciden con los de producción del mismo día, la copia está
verificada. Anotar fecha y resultado acá abajo.

## 4. Antes de cualquier operación delicada

Antes de borrar cuentas (ver `cuentas-automaticas.sql`), correr una
migración que toque datos, o cualquier cambio masivo: copia del punto 2 +
verificación del punto 3, **el mismo día**.

## 5. Registro de copias verificadas

| Fecha | Quién | Tamaño | Conteos coinciden | Notas |
|---|---|---|---|---|
| | | | | |
