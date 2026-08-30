# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

El `README.md` explica **qué** es cada pieza, los secretos, el correo y las decisiones de
privacidad. Este fichero no lo repite: recoge lo que hay que saber para **tocar** el código
sin romper nada, y las trampas que ya han mordido.

La web está escrita en español, comentarios incluidos. Escribe igual.

## Comandos

```bash
npm run dev            # wrangler dev en 127.0.0.1:8787
npm run deploy         # despliega el Worker
npm run db:local       # aplica migraciones en la base local
npx tsc --noEmit -p .  # comprobar tipos: no hay build, wrangler compila al desplegar

npx wrangler d1 execute ceuta-nos-une --local  --command "SELECT ..."
npx wrangler d1 execute ceuta-nos-une --remote --command "SELECT ..."
```

**No hay tests ni linter.** Se verifica ejecutando: `wrangler dev`, `curl` contra las rutas y
el navegador para lo visual. Cualquier cambio con datos se comprueba **contra producción**
después de desplegar, no solo en local (ver «Assets» más abajo).

`npm run db:remote` está en `package.json` pero **léete la advertencia** antes de usarlo.

## La arquitectura en una frase

Un solo Worker (`src/index.ts`, ~1.700 líneas) sirve la web y la API; delante hay **dos
frentes** que se comportan distinto, y esa diferencia es la fuente de casi todos los fallos.

| | `ceutanosune.es` (Vercel) | `ceutanosune.com` (Cloudflare) |
|---|---|---|
| Qué es | **producción** | banco de pruebas |
| Estáticos de `public/` | los sirve Vercel, **desde git** | los sirve el Worker, **desde disco** |
| Rutas dinámicas | rewrites de `vercel.json` → Worker | directas al Worker |
| Accesible en España | sí | **no**: sus IPs están bloqueadas (ver README) |

**Verifica siempre contra el `.es`.** El `.com` puede no responder ni siquiera desde la
máquina de desarrollo.

### Añadir una ruta dinámica toca TRES sitios

Olvidar el tercero es el fallo más fácil de cometer: funciona en local y en el `.com`, y da
404 en producción.

1. El router al final de `src/index.ts` (busca `export default {`).
2. `run_worker_first` en `wrangler.jsonc` — es una **lista explícita**; lo que no esté ahí lo
   contesta el servidor de assets antes de que el Worker lo vea.
3. `rewrites` en `vercel.json`, o el `.es` nunca llegará al Worker.

### Ficheros clave

- **`src/index.ts`** — Worker entero, dividido por comentarios de sección: ajustes, correo,
  Turnstile, sesión de admin, endpoints públicos, el cruce con porceuta.es, endpoints de
  administración y enrutado. Genera HTML a mano (`/lugares`), CSV, `llms.txt` y `sitemap.xml`.
- **`src/union.ts`** — cruce de nuestros lugares con los de `porceuta.es`. Dos filas son la
  misma concentración si coinciden de municipio **y** (mismo núcleo de sitio **o** menos de
  300 m). Hacen falta las dos condiciones: solo por nombre, Alicante fusionaría dos actos
  distintos a 849 m; solo por distancia, Quintanar de la Orden se partiría en dos porque sus
  coordenadas discrepan en 88 km. **No recorta nombres tras «de»**: ese atajo confundía
  Torrejón de Ardoz con Torrejón de la Calzada.
- **`api/[...ruta].js`** — función edge de Vercel que reenvía `/api/*` al Worker con la IP
  real del visitante. Sin ella el límite anti-spam contaría a todos como la misma persona.
- **`scripts/generar-espejo.mjs`** — copia estática para GitHub Pages, último respaldo.

### El cron y el cruce

`triggers.crons` dispara `scheduled()` cada hora: rehace el cruce con porceuta.es y guarda un
CSV en la tabla `vuelcos`. La ruta que lo sirve va tras el secret `UNION_TOKEN` porque el
volcado incluye las convocatorias retiradas con su motivo, que no son datos publicados. Si su
API falla, se tira de la última copia buena guardada en `copias` y el CSV lo avisa en su
primera fila.

### Ramas

`main` es producción. `webmcp` añade `public/webmcp.js` y **no** lleva `src/union.ts` ni el
cruce: no la fusiones sin mirar qué te llevas por delante.

## Trampas comprobadas

**`wrangler d1 migrations apply --remote` puede reaplicar TODAS las migraciones.** Si la tabla
`d1_migrations` de producción no tiene registro de las anteriores, wrangler las ejecuta desde
la primera y **reinserta todos los datos**. Pasó el 30/08/2026: duplicó 325 lugares y 7
mensajes del muro. Las migraciones de datos llevan `INSERT` sin protección, así que no son
idempotentes. Antes y después de tocar migraciones en remoto, **cuenta las filas**:

```bash
npx wrangler d1 execute ceuta-nos-une --remote --command \
  "SELECT status, COUNT(*) FROM places GROUP BY status"   # 403 / 93 / pendientes
```

No te fíes de verificar contra el CSV del cruce: **deduplica**, y esconde justo este fallo.

**La CSP del Worker prohíbe scripts inline** (`script-src 'self' https://challenges.cloudflare.com`).
Todo JS va en un fichero de `public/`. Ojo: el `.es` sirve los HTML sin pasar por el Worker,
así que allí no verás la cabecera, pero el `.com` y el local sí la aplican.

**`.gitignore` excluye `*.png`** (para no versionar capturas) con excepciones para
`public/media/`. Un asset nuevo puede funcionar en local y con `wrangler` —que sube desde
disco— y dar **404 en el `.es`**, que sirve desde git. Comprueba siempre el asset en el `.es`
después de desplegar.

**El `gap` de flex parte palabras en la barra de navegación.** Envuelve el texto de cada
enlace en `<span class="nav-texto">`. En móvil solo caben tres enlaces; hay reglas
`nth-child` en `styles.css` que esconden los que ya tienen acceso desde la portada.

**Coordenadas para hojas de cálculo: coma decimal y entre comillas.** Google, en configuración
española, lee `43.3710378` como cuarenta y tres millones. Y los CSV destinados a `IMPORTDATA`
van **sin BOM**, al contrario que `/lugares.csv`, que sí lo lleva para Excel.

## Datos y contenido

- Los lugares se publican solo tras aprobarlos en `/admin`; los mensajes del muro salen al
  momento. Nada de lo que escribe la gente se pinta con `innerHTML`.
- Antes de borrar filas de `places` o `messages`, comprueba `ip_hash` y `submitter_name`: si
  los tienen, son de una persona, no de una migración.
- El himno de Ceuta **no** se puede alojar: su música está protegida hasta 2037. Se enlaza. La
  bandera sí, pero el SVG usado es CC BY-SA 4.0 y exige mantener la atribución.
