import { test } from "node:test";
import assert from "node:assert/strict";
import { criarApp } from "../server/app.js";

test("CORS: libera só a origem configurada", async () => {
  process.env.CORS_ORIGEM = "https://front.exemplo.com";
  const servidor = criarApp({ gerar: async () => ({ tipo: "recusa", tokens: {} }) }).listen(0);
  await new Promise((ok) => servidor.once("listening", ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  try {
    const liberada = await fetch(`${base}/api/gerar`, {
      method: "OPTIONS",
      headers: { origin: "https://front.exemplo.com" },
    });
    assert.equal(liberada.status, 204);
    assert.equal(liberada.headers.get("access-control-allow-origin"), "https://front.exemplo.com");

    const outra = await fetch(`${base}/api/saude`, { headers: { origin: "https://outro.com" } });
    assert.equal(outra.headers.get("access-control-allow-origin"), null);
  } finally {
    servidor.close();
    delete process.env.CORS_ORIGEM;
  }
});
