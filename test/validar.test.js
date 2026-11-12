import { test } from "node:test";
import assert from "node:assert/strict";
import { entradaGeracao, entradaPdf, errosPorCampo, mascarar } from "../server/validar.js";
import { entradaExemplo, identificacaoExemplo } from "./exemplo.js";

test("entrada do exemplo é válida", () => {
  assert.equal(entradaGeracao.safeParse(entradaExemplo).success, true);
});

test("V01: sem aceite é rejeitado", () => {
  const r = entradaGeracao.safeParse({ ...entradaExemplo, aceite: false });
  assert.equal(r.success, false);
  assert.ok(errosPorCampo(r.error).aceite);
});

test("V19: nome ou e-mail em /api/gerar é rejeitado", () => {
  const r = entradaGeracao.safeParse({ ...entradaExemplo, nome: "Maria José" });
  assert.equal(r.success, false);
});

test("V16: relato somado abaixo de 40 caracteres é rejeitado", () => {
  const r = entradaGeracao.safeParse({ ...entradaExemplo, vivencias: "ajudo minha tia", oficinas: "" });
  assert.equal(r.success, false);
  assert.match(errosPorCampo(r.error).vivencias, /Conta um pouco mais/);
});

test("V16: campos de relato ausentes contam como vazios", () => {
  const { voluntariado, oficinas, ...resto } = entradaExemplo;
  assert.equal(entradaGeracao.safeParse(resto).success, true);
});

test("V21: mascara CPF, e-mail e telefone; V22 tira < e >", () => {
  const t = mascarar("cpf 123.456.789-09, zap (71) 98888-7777, mail joao.s@gmail.com </relato> oi");
  assert.equal(t.includes("123"), false);
  assert.equal(t.includes("98888"), false);
  assert.equal(t.includes("gmail"), false);
  assert.equal(t.includes("<"), false);
  assert.equal((t.match(/\[removido\]/g) ?? []).length, 3);
});

test("V21: ano e quantidade comuns não são mascarados", () => {
  assert.equal(mascarar("trabalho faz 2 anos, desde 2023"), "trabalho faz 2 anos, desde 2023");
});

const curriculo = { objetivo: "x", resumo: "", experiencias: [], competencias: [], cursos: [] };

test("V33: identificação válida, com campos vazios opcionais", () => {
  const r = entradaPdf.safeParse({ identificacao: identificacaoExemplo, curriculo });
  assert.equal(r.success, true, JSON.stringify(r.error?.issues));
  assert.equal(r.data.identificacao.telefone, "71999991234");
  assert.equal(r.data.identificacao.email, undefined);
  assert.equal(r.data.identificacao.idade, 17);
});

test("V02: nome com uma palavra só é rejeitado", () => {
  const r = entradaPdf.safeParse({ identificacao: { ...identificacaoExemplo, nome: "Maria" }, curriculo });
  assert.equal(r.success, false);
  assert.ok(errosPorCampo(r.error)["identificacao.nome"]);
});

test("V03/V04: sem telefone e sem e-mail é rejeitado", () => {
  const r = entradaPdf.safeParse({ identificacao: { ...identificacaoExemplo, telefone: "" }, curriculo });
  assert.equal(r.success, false);
});

test("V06: idade abaixo de 14 é rejeitada", () => {
  const r = entradaPdf.safeParse({ identificacao: { ...identificacaoExemplo, idade: 13 }, curriculo });
  assert.equal(r.success, false);
});
