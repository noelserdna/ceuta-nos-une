#!/usr/bin/env node
/**
 * Copia el frontend a vercel/public para desplegarlo en Vercel.
 *
 * Vercel sirve la web y hace de intermediario con el Worker: /api, /img y
 * /tiles se reescriben hacia Cloudflare. Como esas llamadas las hace Vercel
 * desde sus servidores (fuera de España), no las alcanza el bloqueo de IPs.
 */
import { cpSync, mkdirSync, rmSync } from "node:fs";

rmSync("vercel/public", { recursive: true, force: true });
mkdirSync("vercel/public", { recursive: true });
cpSync("public", "vercel/public", { recursive: true });
// El fichero _headers es de Cloudflare; en Vercel manda vercel.json
rmSync("vercel/public/_headers", { force: true });
console.log("Frontend copiado a vercel/public");
