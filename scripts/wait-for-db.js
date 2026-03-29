#!/usr/bin/env node
/**
 * Wait until PostgreSQL is accepting connections.
 * Uses a TCP connect probe – no pg driver required.
 */

const net = require("net");

const HOST = process.env.DB_HOST || "127.0.0.1";
const PORT = parseInt(process.env.DB_PORT || "5432", 10);
const MAX_ATTEMPTS = 30;
const RETRY_MS = 1000;

function probe() {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: HOST, port: PORT });
    sock.once("connect", () => { sock.destroy(); resolve(true); });
    sock.once("error", () => { sock.destroy(); resolve(false); });
    sock.setTimeout(1000, () => { sock.destroy(); resolve(false); });
  });
}

(async () => {
  console.log(`[db] Waiting for PostgreSQL on ${HOST}:${PORT}...`);
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    const ok = await probe();
    if (ok) {
      console.log(`[db] PostgreSQL ready (attempt ${i})`);
      process.exit(0);
    }
    process.stdout.write(`\r[db] Not ready yet... (${i}/${MAX_ATTEMPTS})`);
    await new Promise((r) => setTimeout(r, RETRY_MS));
  }
  console.error(`\n[db] PostgreSQL did not become ready after ${MAX_ATTEMPTS}s.`);
  console.error("[db] Make sure Docker is running: docker compose -f docker-compose.dev.yml up -d db");
  process.exit(1);
})();
