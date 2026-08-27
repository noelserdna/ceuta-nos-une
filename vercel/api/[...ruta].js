/**
 * Proxy de /api/* hacia el Worker de Cloudflare.
 *
 * No basta con un rewrite de vercel.json: al pasar por Vercel, el Worker ve
 * como origen la IP de Vercel, no la del visitante, y el límite anti-spam del
 * muro pasaría a contar a todo el mundo como si fuera la misma persona (un
 * solo abusador dejaría el muro bloqueado para el resto).
 *
 * Aquí se reenvía la IP real en una cabecera propia, acompañada de un token
 * compartido: sin ese token el Worker la ignora, así nadie puede falsear su
 * IP llamando al Worker directamente.
 */

export const config = { runtime: "edge" };

const WORKER = "https://ceuta-nos-une.andresleontest.workers.dev";

export default async function handler(request) {
  const url = new URL(request.url);
  const destino = WORKER + url.pathname + url.search;

  const cabeceras = new Headers(request.headers);
  cabeceras.delete("host");
  cabeceras.delete("connection");

  const ipReal =
    request.headers.get("x-vercel-forwarded-for") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "";
  cabeceras.set("x-visitante-ip", ipReal);
  if (process.env.PROXY_TOKEN) cabeceras.set("x-proxy-token", process.env.PROXY_TOKEN);

  const sinCuerpo = request.method === "GET" || request.method === "HEAD";

  const respuesta = await fetch(destino, {
    method: request.method,
    headers: cabeceras,
    body: sinCuerpo ? undefined : request.body,
    redirect: "manual",
    duplex: sinCuerpo ? undefined : "half",
  });

  // Se devuelve tal cual, conservando cabeceras (incluida la cookie del panel).
  return new Response(respuesta.body, {
    status: respuesta.status,
    statusText: respuesta.statusText,
    headers: respuesta.headers,
  });
}
