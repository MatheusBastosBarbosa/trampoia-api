// Testa as rotas com um modelo falso: nada sai para a API real.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { criarApp } from "../server/app.js";
import { criarLimites } from "../server/limites.js";
import { entradaExemplo, respostaExemplo, identificacaoExemplo } from "./exemplo.js";

let servidor;
let base;
let respostas = [];
let chamadas = 0;
let ultimaMensagem = "";

const gerarFalso = async (mensagem) => {
  chamadas++;
  ultimaMensagem = mensagem;
  return respostas.shift() ?? { tipo: "ok", dados: respostaExemplo(), tokens: { entrada: 10, saida: 20 } };
};

before(async () => {
  const app = criarApp({ gerar: gerarFalso, limites: criarLimites({ porIp: 1000, diario: 1000 }) });
  servidor = app.listen(0);
  await new Promise((ok) => servidor.once("listening", ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
});
after(() => servidor.close());

const post = (rota, corpo) =>
  fetch(base + rota, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });

const zerar = (lista = []) => {
  respostas = lista;
  chamadas = 0;
};

test("gerar: 200 com currículo filtrado e sem origem", async () => {
  zerar();
  const r = await post("/api/gerar", entradaExemplo);
  assert.equal(r.status, 200);
  const corpo = await r.json();
  assert.equal(corpo.experiencias.length, 2);
  assert.equal(JSON.stringify(corpo).includes("origem"), false);
  assert.equal(chamadas, 1);
});

test("gerar: CPF e telefone não chegam ao modelo (RN14)", async () => {
  zerar();
  await post("/api/gerar", { ...entradaExemplo, voluntariado: "meu zap é 71 98888-7777 e cpf 12345678909" });
  assert.equal(ultimaMensagem.includes("98888"), false);
  assert.equal(ultimaMensagem.includes("12345678909"), false);
});

test("gerar: campo inválido dá E01 com mensagem por campo, sem chamar o modelo", async () => {
  zerar();
  const r = await post("/api/gerar", { ...entradaExemplo, vaga: "gerente" });
  assert.equal(r.status, 400);
  const corpo = await r.json();
  assert.equal(corpo.erro, "E01");
  assert.ok(corpo.campos.vaga);
  assert.equal(chamadas, 0);
});

test("gerar: corpo acima de 16 KB dá E02", async () => {
  zerar();
  const r = await post("/api/gerar", { ...entradaExemplo, vivencias: "a".repeat(20_000) });
  assert.equal(r.status, 413);
  assert.equal((await r.json()).erro, "E02");
});

test("gerar: JSON quebrado dá E01", async () => {
  const r = await post("/api/gerar", "{nao é json");
  assert.equal(r.status, 400);
});

test("gerar: recusa do modelo dá E05 na hora", async () => {
  zerar([{ tipo: "recusa", tokens: {} }]);
  const r = await post("/api/gerar", entradaExemplo);
  assert.equal(r.status, 422);
  assert.equal((await r.json()).erro, "E05");
  assert.equal(chamadas, 1);
});

test("gerar: resposta cortada tenta de novo e aproveita a segunda (V23)", async () => {
  zerar([{ tipo: "incompleta", tokens: {} }]);
  const r = await post("/api/gerar", entradaExemplo);
  assert.equal(r.status, 200);
  assert.equal(chamadas, 2);
});

test("gerar: duas respostas sem nada aproveitável dão E04, com no máximo 2 chamadas (RN11, RN27)", async () => {
  const vazia = () => ({ tipo: "ok", dados: { ...respostaExemplo(), experiencias: [], competencias: [] }, tokens: {} });
  zerar([vazia(), vazia(), vazia()]);
  const r = await post("/api/gerar", entradaExemplo);
  assert.equal(r.status, 422);
  assert.equal((await r.json()).erro, "E04");
  assert.equal(chamadas, 2);
});

test("limites: 31ª geração do mesmo IP em 10 minutos dá E03 (RN25)", async () => {
  const limites = criarLimites({ porIp: 30, diario: 300 });
  for (let i = 0; i < 30; i++) assert.equal(limites.consumir("1.1.1.1"), null);
  assert.equal(limites.consumir("1.1.1.1"), "E03");
  assert.equal(limites.consumir("2.2.2.2"), null);
});

test("limites: total diário dá E07 (RN26)", async () => {
  const limites = criarLimites({ porIp: 100, diario: 2 });
  limites.consumir("a");
  limites.consumir("b");
  assert.equal(limites.consumir("c"), "E07");
});

test("pdf: gera arquivo pequeno com nome sem acento", async () => {
  const curriculo = {
    objetivo: "Vaga de Jovem Aprendiz em rotinas administrativas. 🚀",
    resumo: "Experiência em atendimento.",
    experiencias: [{ titulo: "Apoio em salão de beleza familiar", texto: "Atendimento a clientes." }],
    competencias: [{ texto: "Atendimento ao cliente" }, { texto: "" }],
    cursos: [],
  };
  const r = await post("/api/pdf", {
    identificacao: { ...identificacaoExemplo, nome: "Átila Conceição" },
    curriculo,
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("content-type"), "application/pdf");
  assert.match(r.headers.get("content-disposition"), /curriculo-atila\.pdf/);
  const pdf = Buffer.from(await r.arrayBuffer());
  assert.equal(pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(pdf.length < 100_000, `PDF com ${pdf.length} bytes`); // RNF11
});

test("pdf: identificação inválida dá E01", async () => {
  const r = await post("/api/pdf", { identificacao: { ...identificacaoExemplo, escola: "" }, curriculo: {} });
  assert.equal(r.status, 400);
  assert.ok((await r.json()).campos["identificacao.escola"]);
});

test("front: a página sai do mesmo servidor, sem script de terceiros (RNF07)", async () => {
  const r = await fetch(base + "/");
  assert.equal(r.status, 200);
  const html = await r.text();
  assert.match(html, /<title>TrampoIA<\/title>/);
  assert.equal(/<script[^>]+src="https?:/.test(html), false);
  for (const arquivo of ["/app.js", "/estilo.css"]) {
    assert.equal((await fetch(base + arquivo)).status, 200, arquivo);
  }
});
