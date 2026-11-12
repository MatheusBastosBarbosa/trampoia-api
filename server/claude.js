// Única chamada à IA do sistema: o Tradutor e Estruturador Curricular (integracao-claude.md).
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { NIVEIS, SITUACOES, VAGAS, mascarar, respostaModelo } from "./validar.js";

const SISTEMA = readFileSync(new URL("../prompts/sistema.md", import.meta.url), "utf8").trim();

const ITEM = {
  type: "array",
  items: {
    type: "object",
    additionalProperties: false,
    required: ["texto", "origem"],
    properties: { texto: { type: "string" }, origem: { type: "string" } },
  },
};

// Limites de tamanho e quantidade ficam no servidor (V25 a V27): o esquema da API não os aceita.
export const ESQUEMA = {
  type: "object",
  additionalProperties: false,
  required: ["objetivo", "resumo", "experiencias", "competencias", "cursos", "entrevista"],
  properties: {
    objetivo: { type: "string" },
    resumo: { type: "string" },
    experiencias: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["titulo", "texto", "origem"],
        properties: { titulo: { type: "string" }, texto: { type: "string" }, origem: { type: "string" } },
      },
    },
    competencias: ITEM,
    cursos: ITEM,
    entrevista: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["pergunta", "passos"],
        properties: {
          pergunta: { type: "string" },
          passos: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
};

// Monta a mensagem do usuário. Só vão dados de RF05; nome e contato nunca chegam aqui (RN13).
// O texto devolvido é também a "entrada" que o filtro usa para comparar.
export function montarMensagem(d) {
  const relato = [
    `Objetivo: ${mascarar(d.objetivo)}`,
    `Vivências: ${mascarar(d.vivencias)}`,
    `Voluntariado: ${mascarar(d.voluntariado)}`,
    `Oficinas: ${mascarar(d.oficinas)}`,
  ].join("\n");
  return [
    `Vaga pretendida: ${VAGAS[d.vaga]}`,
    `Escolaridade: ${NIVEIS[d.nivel]}, ${SITUACOES[d.situacao]}`,
    "",
    "<relato>",
    relato,
    "</relato>",
  ].join("\n");
}

let cliente;
// Criado sob demanda para os testes rodarem sem chave.
// maxRetries 0: quem decide a nova tentativa é o servidor, para respeitar RN27.
const obterCliente = () => (cliente ??= new Anthropic({ maxRetries: 0 }));

/**
 * Faz uma chamada ao modelo.
 * @returns {Promise<{ tipo: "ok", dados, tokens } | { tipo: "recusa" | "incompleta" | "json_invalido", tokens }>}
 * Erros de rede e HTTP sobem como exceções do SDK.
 */
export async function gerarComClaude(mensagem, { signal, timeoutMs }) {
  const resposta = await obterCliente().beta.messages.create(
    {
      model: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      thinking: { type: "adaptive" },
      output_config: {
        effort: process.env.ANTHROPIC_EFFORT || "medium",
        format: { type: "json_schema", schema: ESQUEMA },
      },
      system: SISTEMA,
      messages: [{ role: "user", content: mensagem }],
    },
    { signal, timeout: timeoutMs },
  );

  const tokens = {
    entrada: resposta.usage?.input_tokens ?? 0,
    saida: resposta.usage?.output_tokens ?? 0,
  };

  // V23
  if (resposta.stop_reason === "refusal") return { tipo: "recusa", tokens };
  if (resposta.stop_reason !== "end_turn") return { tipo: "incompleta", tokens };

  // V24
  const texto = resposta.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    const r = respostaModelo.safeParse(JSON.parse(texto));
    if (r.success) return { tipo: "ok", dados: r.data, tokens };
  } catch {
    // JSON quebrado cai na nova tentativa
  }
  return { tipo: "json_invalido", tokens };
}
