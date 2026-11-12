import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarFiltro, normalizar } from "../server/filtro.js";
import { montarMensagem } from "../server/claude.js";
import { respostaExemplo, entradaExemplo } from "./exemplo.js";

const entrada = montarMensagem(entradaExemplo);

test("normalizar tira acento, pontuação e caixa", () => {
  assert.equal(normalizar("  Informática, no CRAS!! "), "informatica no cras");
});

test("resposta do exemplo da documentação passa inteira e sem origem", () => {
  const r = aplicarFiltro(respostaExemplo(), entrada);
  assert.equal(r.ok, true);
  assert.equal(r.descartados, 0);
  assert.equal(r.resultado.experiencias.length, 2);
  assert.equal(r.resultado.cursos[0].texto, "Curso de informática (CRAS)");
  for (const lista of ["experiencias", "competencias", "cursos"]) {
    for (const item of r.resultado[lista]) assert.equal("origem" in item, false);
  }
});

test("V28: origem que não está no relato derruba o item", () => {
  const d = respostaExemplo();
  d.competencias.push({ texto: "Liderança de equipe", origem: "liderei uma equipe de vendas" });
  const r = aplicarFiltro(d, entrada);
  assert.equal(r.resultado.competencias.length, 2);
  assert.equal(r.descartados, 1);
});

test("V28: origem curta demais derruba o item", () => {
  const d = respostaExemplo();
  d.competencias.push({ texto: "Organização", origem: "caixa" });
  assert.equal(aplicarFiltro(d, entrada).descartados, 1);
});

test("V30: termo de credencial inventado derruba o item (exemplo errado da doc)", () => {
  const d = respostaExemplo();
  d.cursos = [{ texto: "Certificação em Pacote Office", origem: "fiz um curso de informatica no cras" }];
  const r = aplicarFiltro(d, entrada);
  assert.equal(r.resultado.cursos.length, 0);
});

test("V29: número que não está no relato derruba o item", () => {
  const d = respostaExemplo();
  d.experiencias[0].texto = "Atendimento a 50 clientes por semana.";
  assert.equal(aplicarFiltro(d, entrada).resultado.experiencias.length, 1);
});

test("V31: resumo com número inventado volta vazio", () => {
  const d = respostaExemplo();
  d.resumo = "Experiência de 3 anos em atendimento.";
  assert.equal(aplicarFiltro(d, entrada).resultado.resumo, "");
});

test("V29: número que está no relato é aceito", () => {
  const d = respostaExemplo();
  assert.match(aplicarFiltro(d, entrada).resultado.resumo, /2 anos/);
});

test("V32: sem experiência nem competência pede nova tentativa", () => {
  const d = respostaExemplo();
  d.experiencias = [];
  d.competencias = [];
  assert.deepEqual(aplicarFiltro(d, entrada).motivo, "insuficiente");
});

test("V25: menos de 3 perguntas pede nova tentativa; mais de 5 corta", () => {
  const d = respostaExemplo();
  d.entrevista = d.entrevista.slice(0, 2);
  assert.equal(aplicarFiltro(d, entrada).motivo, "entrevista");

  const e = respostaExemplo();
  e.entrevista = [...e.entrevista, ...e.entrevista, ...e.entrevista];
  e.entrevista[0].passos = ["a", "b", "c", "d", "e", "f"];
  const r = aplicarFiltro(e, entrada);
  assert.equal(r.resultado.entrevista.length, 5);
  assert.equal(r.resultado.entrevista[0].passos.length, 4);
});

test("RN24: pergunta de entrevista pode citar Excel", () => {
  const d = respostaExemplo();
  d.entrevista[0].pergunta = "Você sabe usar Excel?";
  assert.equal(aplicarFiltro(d, entrada).resultado.entrevista[0].pergunta, "Você sabe usar Excel?");
});

test("V27: corta experiências acima de 6", () => {
  const d = respostaExemplo();
  d.experiencias = Array.from({ length: 9 }, () => ({ ...d.experiencias[0] }));
  assert.equal(aplicarFiltro(d, entrada).resultado.experiencias.length, 6);
});
