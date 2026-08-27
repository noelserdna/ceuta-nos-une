#!/usr/bin/env node
/**
 * Saca un dominio del rango de IPs que los operadores españoles bloquean.
 *
 * El problema: un "custom domain" de Workers hace que Cloudflare resuelva el
 * dominio a 188.114.9x.x, un rango interceptado en España en cumplimiento de la
 * sentencia de LaLiga. Un registro proxied normal resuelve a 104.21.x/172.67.x,
 * que sí es accesible.
 *
 * La solución: sustituir el custom domain por un registro A proxied (a una IP de
 * documentación que nunca se usa) más una ruta de Worker sobre ese hostname. El
 * Worker sigue respondiendo igual, pero por unas IPs que no están bloqueadas.
 *
 * Uso:  node scripts/arreglar-dominio.mjs <dominio> [--aplicar]
 *       Sin --aplicar solo enseña lo que haría.
 *
 * El token se lee de ~/.cf-token-ceuta (o de la variable CF_API_TOKEN) para no
 * dejarlo escrito en el historial de comandos.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const API = "https://api.cloudflare.com/client/v4";
const CUENTA = "5d04b22ddaecc60cea09b1bfdae188c6";
const WORKER = "ceuta-nos-une";
const IP_MARCADOR = "192.0.2.1"; // TEST-NET-1: nunca se conecta, la ruta manda

const dominio = process.argv[2];
const aplicar = process.argv.includes("--aplicar");

if (!dominio) {
  console.error("Uso: node scripts/arreglar-dominio.mjs <dominio> [--aplicar]");
  process.exit(1);
}

function leerToken() {
  if (process.env.CF_API_TOKEN) return process.env.CF_API_TOKEN.trim();
  try {
    return readFileSync(join(homedir(), ".cf-token-ceuta"), "utf8").trim();
  } catch {
    console.error("No encuentro el token. Guárdalo en ~/.cf-token-ceuta o exporta CF_API_TOKEN.");
    process.exit(1);
  }
}

const TOKEN = leerToken();

async function cf(ruta, opciones = {}) {
  const res = await fetch(API + ruta, {
    ...opciones,
    headers: {
      authorization: "Bearer " + TOKEN,
      "content-type": "application/json",
      ...(opciones.headers || {}),
    },
  });
  const datos = await res.json();
  if (!datos.success) {
    const detalle = (datos.errors || []).map((e) => e.code + " " + e.message).join("; ");
    throw new Error(opciones.method || "GET" + " " + ruta + " -> " + detalle);
  }
  return datos.result;
}

const paso = (n, texto) => console.log("\n[" + n + "] " + texto);
const ok = (texto) => console.log("    ✓ " + texto);
const nota = (texto) => console.log("    · " + texto);

async function main() {
  console.log("Dominio: " + dominio + (aplicar ? "  (APLICANDO CAMBIOS)" : "  (simulación)"));

  // ---- 1. Zona -----------------------------------------------------------
  paso(1, "Localizar la zona");
  const zonas = await cf("/zones?name=" + encodeURIComponent(dominio));
  if (!zonas.length) {
    console.error("    ✗ La zona no está en Cloudflare. Añádela primero y cambia los NS.");
    process.exit(1);
  }
  const zona = zonas[0];
  ok("zona " + zona.id + " (" + zona.status + ")");
  if (zona.status !== "active") {
    nota("La zona aún no está activa: los NS no han propagado del todo.");
  }

  const hosts = [dominio, "www." + dominio];

  // ---- 2. Quitar los custom domains --------------------------------------
  paso(2, "Quitar los custom domains del Worker (son los que traen las IPs bloqueadas)");
  const dominiosWorker = await cf("/accounts/" + CUENTA + "/workers/domains?per_page=100");
  const aBorrar = dominiosWorker.filter((d) => hosts.includes(d.hostname));
  if (!aBorrar.length) nota("no hay ninguno, nada que quitar");
  for (const d of aBorrar) {
    if (aplicar) {
      await cf("/accounts/" + CUENTA + "/workers/domains/" + d.id, { method: "DELETE" });
      ok("quitado " + d.hostname);
    } else {
      nota("quitaría " + d.hostname);
    }
  }

  // ---- 3. Registros DNS proxied -----------------------------------------
  paso(3, "Crear los registros proxied (así el dominio resuelve por 104.21.x / 172.67.x)");
  const registros = await cf("/zones/" + zona.id + "/dns_records?per_page=100");
  for (const host of hosts) {
    const previo = registros.find((r) => r.name === host && ["A", "AAAA", "CNAME"].includes(r.type));
    const cuerpo = { type: "A", name: host, content: IP_MARCADOR, proxied: true, ttl: 1 };

    if (!aplicar) {
      nota((previo ? "reemplazaría" : "crearía") + " " + host + " -> A " + IP_MARCADOR + " (proxied)");
      continue;
    }
    if (previo) {
      await cf("/zones/" + zona.id + "/dns_records/" + previo.id, {
        method: "PUT",
        body: JSON.stringify(cuerpo),
      });
      ok("actualizado " + host);
    } else {
      await cf("/zones/" + zona.id + "/dns_records", {
        method: "POST",
        body: JSON.stringify(cuerpo),
      });
      ok("creado " + host);
    }
  }

  // ---- 4. Rutas del Worker ----------------------------------------------
  paso(4, "Apuntar el Worker a esos hostnames con rutas");
  const rutas = await cf("/zones/" + zona.id + "/workers/routes");
  for (const host of hosts) {
    const patron = host + "/*";
    if (rutas.some((r) => r.pattern === patron)) {
      nota("ya existe la ruta " + patron);
      continue;
    }
    if (!aplicar) {
      nota("crearía la ruta " + patron + " -> " + WORKER);
      continue;
    }
    await cf("/zones/" + zona.id + "/workers/routes", {
      method: "POST",
      body: JSON.stringify({ pattern: patron, script: WORKER }),
    });
    ok("ruta " + patron + " -> " + WORKER);
  }

  // ---- 5. Comprobación ---------------------------------------------------
  if (aplicar) {
    paso(5, "Comprobación (el DNS puede tardar un par de minutos)");
    nota("dig @1.1.1.1 +short A " + dominio);
    nota("curl -I https://" + dominio + "/");
    nota("Si sigue devolviendo 188.114.x, espera a que caduque la caché y repite.");
  } else {
    console.log("\nSimulación terminada. Repite con --aplicar para hacerlo de verdad.");
  }
}

main().catch((err) => {
  console.error("\n✗ " + err.message);
  process.exit(1);
});
