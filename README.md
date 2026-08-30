# Ceuta nos une

Web de la convocatoria del **2 de septiembre**: mapa y listado de lugares, formulario para
proponer lugares nuevos y muro donde dejar mensajes de apoyo con foto.

El frontend se sirve desde Vercel y el backend es un Worker de Cloudflare.

- **En producción:** https://ceutanosune.es (servida desde Vercel)
- **La fila cero:** https://ceutanosune.es/directo — la manifestación virtual del día 2
- **Panel de revisión:** https://ceutanosune.es/admin
- **Espejo de respaldo:** https://noelserdna.github.io/ceuta-nos-une/

## Por qué la web no está en Cloudflare

Cloudflare asignó a `ceutanosune.com` unas IPs (188.114.96.5/97.5) que los operadores
españoles bloquean en cumplimiento de la sentencia de LaLiga: desde España se servía una
página de bloqueo con el certificado suplantado. La asignación de IPs es aleatoria por zona
y no se puede elegir, así que el frontend se movió a **Vercel**, que sí es accesible, y
Cloudflare se quedó como backend (D1, R2, correo, rate limiting).

Vercel hace de intermediario: `/api/*` pasa por una función edge (`vercel/api/[...ruta].js`)
y `/img/*` y `/tiles/*` por rewrites, todo hacia el Worker. La función reenvía la IP real
del visitante en `x-visitante-ip`, firmada con `PROXY_TOKEN`, para que el límite anti-spam
del muro siga contando por persona y no por servidor de Vercel.

## Cómo se publica cada cosa

| | Quién lo envía | Cuándo aparece |
|---|---|---|
| **Lugares** | Cualquiera, desde el formulario | Solo tras aprobarlos en `/admin`. Además llega un aviso por correo |
| **Mensajes del muro** | Cualquiera | Al momento, sin revisión previa. Se pueden ocultar o borrar desde `/admin` |
| **Fotos** | Adjuntas al mensaje | Al momento. Van a R2 y quedan enlazadas a su mensaje |
| **Fila cero** | Cualquiera (una foto por persona) | Tras pasar el filtro automático, con 90 s de retraso |
| **Fotos y vídeos del equipo** | Quien tiene un código de `/subir` | Con los mismos 90 s, sin pasar por el filtro |

## Piezas

| Pieza | Para qué |
|---|---|
| Vercel (`vercel/`) | Sirve la web y hace de intermediario hacia el Worker |
| Worker (`src/`) | La API, las fotos y las teselas |
| D1 `ceuta-nos-une` | Lugares, mensajes, ajustes y registro de avisos por correo |
| R2 `ceuta-nos-une-fotos` | Fotos del muro |
| Rate limiting | Frena el spam. En la fila cero la clave es IP + ficha, no la IP sola: las operadoras móviles reparten la misma IPv4 entre muchos clientes |
| Workers AI | Clasifica textos y fotos antes de que salgan en pantalla |
| Durable Object `AFORO` | Cuenta quién está conectado, en memoria, sin tocar la base |
| Assets estáticos (`public/`) | Portada, panel, CSS, JS y Leaflet |

El mapa usa OpenStreetMap. Las teselas **no** van directas al servidor de OSM: pasan por
`/tiles/*` en el Worker, que las cachea en el borde de Cloudflare. Así se aguanta un pico de
visitas sin castigar a OSM ni depender de ninguna clave de terceros. (El espejo de GitHub
Pages sí las pide directas, porque no puede contar con el Worker.)

## Trabajar en local

```bash
npm install
cp .dev.vars.example .dev.vars          # y rellena ADMIN_PASSWORD, SESSION_SECRET, IP_SALT
npm run db:local                        # crea las tablas y mete datos de ejemplo
npm run dev                             # http://127.0.0.1:8787
```

## Desplegar

```bash
npm run deploy
npm run db:remote                       # solo si hay migraciones nuevas
```

## Ajustes que se cambian sin tocar código

Están en la tabla `settings` y se editan desde **`/admin` → Ajustes**:

| Clave | Qué controla |
|---|---|
| `notify_email` | **Correo que recibe el aviso de cada lugar propuesto** |
| `contact_email` | Correo de contacto que sale en el pie de la web |
| `event_date` | Fecha del acto (`AAAA-MM-DD`). Manda en la cuenta atrás |
| `event_label` | La fecha en texto para la portada |
| `site_title`, `site_claim` | Título y lema |
| `places_open`, `messages_open` | `1` o `0` para abrir o cerrar cada formulario |

## Secretos

Se cargan con `npx wrangler secret put NOMBRE`:

| Secreto | Obligatorio | Para qué |
|---|---|---|
| `ADMIN_PASSWORD` | Sí | Entrar en `/admin` |
| `SESSION_SECRET` | Sí | Firma la cookie de sesión del panel |
| `IP_SALT` | Sí | Anonimiza las IP antes de guardarlas |
| `PROXY_TOKEN` | Sí | Compartido con Vercel: valida la IP real del visitante que llega por el proxy |
| `RESEND_API_KEY` | No | Alternativa de correo, por si falla el envío nativo de Cloudflare |
| `TURNSTILE_SECRET_KEY` + `TURNSTILE_SITE_KEY` | **Sí para la fila cero** | El anti-bot. En el muro son opcionales (sin ellas el widget no aparece y se pasa igual); en `/directo` no: sin ellas nadie puede entrar, y es a propósito |

### Retirar algo con prisa

Si hay que quitar una foto o un mensaje de golpe, en este orden:

```bash
# 1. Que deje de salir, ya.
npx wrangler d1 execute ceuta-nos-une --remote --command \
  "UPDATE messages SET hidden = 1 WHERE id = <id>;"
# 2. Y que la URL deje de servir.
npx wrangler r2 object delete ceuta-nos-une-fotos/<clave>
# 3. Purgar el CDN de Vercel desde su panel, o desplegar de nuevo.
```

Las fotos se sirven con `max-age=3600`, no con `immutable`: quien ya la vio la conserva una
hora en su navegador, pero a quien llegue nuevo ya no le llega. **Prueba este procedimiento
antes de que haga falta**, no a las 20:30 del día 2.

Para reaccionar sin SQL están los interruptores de `/admin` → Ajustes (`directo_modo`) y el
botón de purga, que esconde de golpe todo lo publicado en los últimos minutos.

### El correo

Todo por **Cloudflare**, sin proveedores externos, y funciona pese al bloqueo web porque el
correo viaja por MX, no por las IPs bloqueadas.

- **Salida**: el binding `send_email` envía desde `avisos@avisos.ceutanosune.com`, un
  subdominio propio para no tocar el SPF del dominio principal.
- **Entrada**: Email Routing en `ceutanosune.com` recibe en `info@ceutanosune.com` y lo
  reenvía a la cuenta personal. Es el correo de contacto que sale en el pie de la web y el
  destinatario de los avisos de lugares.

Cada aviso queda registrado en `notifications` se consiga enviar o no, así que ninguna
propuesta se pierde por un fallo del correo.

## Cambiar los datos de ejemplo por los reales

Los lugares de muestra están marcados en `notes`. Se pueden borrar de golpe:

```bash
npx wrangler d1 execute ceuta-nos-une --remote \
  --command "DELETE FROM places WHERE notes LIKE 'EJEMPLO%'; DELETE FROM messages WHERE body LIKE 'EJEMPLO%';"
```

Los reales se pueden meter por el formulario público (y aprobarlos), o directamente por SQL.

## Decisiones que conviene conocer

- **Nada de `innerHTML`.** Todo lo que escribe la gente se pinta con `textContent`, porque los
  mensajes se publican sin revisar. Está comprobado con etiquetas `<script>` reales.
- **Las imágenes se comprueban por sus bytes**, no por el `content-type` que declara el
  navegador, y se sirven con `Content-Security-Policy: sandbox` para que nada se ejecute.
- **No se pide ningún dato personal.** El formulario de proponer lugares no recoge nombre,
  correo ni teléfono; el muro solo pide una firma, que puede ser un apodo. La contrapartida
  asumida a conciencia: un lugar dudoso no se puede verificar preguntando a quien lo envió.
- **No se guarda ninguna IP en claro**, solo un hash con sal, para poder frenar abusos.
- **A las fotos se les quita el EXIF** al recodificarlas en el navegador, que es donde viajan
  las coordenadas GPS de dónde se hicieron.
- **Las fotos se reducen en el propio móvil** antes de subirlas (máx. 1600 px), lo que ahorra
  datos a quien publica.
- **El aviso por correo se registra siempre en D1**, se consiga enviar o no: ninguna propuesta
  se pierde por un fallo del proveedor de correo.
