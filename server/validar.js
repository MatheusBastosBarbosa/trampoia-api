// Validação de entrada (V01 a V22, V33) e mascaramento do relato.
import { z } from "zod";

export const NIVEIS = {
  fundamental: "Ensino fundamental",
  medio: "Ensino médio",
  tecnico: "Ensino técnico",
  superior: "Ensino superior",
};
export const SITUACOES = { cursando: "cursando", concluido: "concluído", interrompido: "interrompido" };
export const VAGAS = { jovem_aprendiz: "Jovem Aprendiz", estagio: "Estágio", primeiro_emprego: "Primeiro emprego" };

const vazioParaUndefined = (v) => (v === "" || v === null ? undefined : v);
const opcional = (s) => z.preprocess(vazioParaUndefined, s.optional()).optional();

const enumDe = (mapa, erro) => z.enum(Object.keys(mapa), { error: erro });

const nivel = enumDe(NIVEIS, "Escolhe sua escolaridade.");
const situacao = enumDe(SITUACOES, "Diz se você está cursando, concluiu ou parou os estudos.");

const MSG_RELATO_CURTO =
  "Conta um pouco mais do que você já fez: onde e fazendo o quê.";

// V01, V07, V08, V11 a V16. Campo desconhecido é rejeitado (V19).
export const entradaGeracao = z
  .strictObject({
    aceite: z.literal(true, { error: "Você precisa aceitar o aviso para continuar." }),
    nivel,
    situacao,
    vaga: enumDe(VAGAS, "Escolhe o tipo de vaga."),
    objetivo: z
      .string({ error: "Conta em que você gostaria de trabalhar." })
      .trim()
      .min(10, "Conta um pouco mais sobre onde você quer trabalhar.")
      .max(300, "O objetivo passou de 300 letras. Tenta resumir."),
    vivencias: z.string().trim().max(1500, "Esse campo passou de 1.500 letras. Tenta resumir.").default(""),
    voluntariado: z.string().trim().max(1500, "Esse campo passou de 1.500 letras. Tenta resumir.").default(""),
    oficinas: z.string().trim().max(1000, "Esse campo passou de 1.000 letras. Tenta resumir.").default(""),
  })
  .superRefine((d, ctx) => {
    if (d.vivencias.length + d.voluntariado.length + d.oficinas.length < 40) {
      ctx.addIssue({ code: "custom", path: ["vivencias"], message: MSG_RELATO_CURTO });
    }
  });

// V02 a V06, V09, V10.
export const identificacao = z
  .strictObject({
    nome: z
      .string({ error: "Faltou seu nome completo." })
      .trim()
      .transform((s) => s.replace(/\s+/g, " "))
      .pipe(
        z
          .string()
          .min(3, "Faltou seu nome completo.")
          .max(80, "O nome passou de 80 letras.")
          .regex(/^[\p{L}'’ -]+$/u, "Use só letras no nome.")
          .refine((s) => s.split(" ").length >= 2, "Escreve nome e sobrenome."),
      ),
    telefone: opcional(
      z
        .string()
        .max(20, "Confere o telefone, com DDD.")
        .transform((s) => s.replace(/\D/g, ""))
        .refine((d) => d.length === 10 || d.length === 11, "Confere o telefone, com DDD."),
    ),
    email: opcional(
      z
        .string()
        .trim()
        .max(120, "Confere o e-mail.")
        .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Confere o e-mail."),
    ),
    cidade: z
      .string()
      .trim()
      .min(2, "Confere a cidade.")
      .max(60, "Confere a cidade.")
      .default("Salvador/BA"),
    idade: opcional(
      z.coerce
        .number({ error: "Confere a idade." })
        .int("Confere a idade.")
        .min(14, "A idade mínima é 14 anos.")
        .max(99, "Confere a idade."),
    ),
    nivel,
    situacao,
    escola: z
      .string({ error: "Faltou o nome da escola." })
      .trim()
      .min(2, "Faltou o nome da escola.")
      .max(100, "O nome da escola passou de 100 letras."),
    previsao: opcional(
      z.coerce
        .number({ error: "Escreve o ano com 4 números." })
        .int("Escreve o ano com 4 números.")
        .min(2000, "Escreve o ano com 4 números.")
        .max(2035, "Escreve o ano com 4 números."),
    ),
  })
  .superRefine((d, ctx) => {
    if (!d.telefone && !d.email) {
      ctx.addIssue({ code: "custom", path: ["telefone"], message: "Coloca um telefone ou um e-mail para contato." });
    }
  });

// Currículo revisado pela pessoa (limites de V26 e V27). Campo vazio é aceito e some do PDF.
const textoCurto = (max, msg) => z.string().trim().max(max, msg).default("");
export const curriculoRevisado = z.strictObject({
  objetivo: textoCurto(200, "O objetivo passou de 200 letras."),
  resumo: textoCurto(400, "O resumo passou de 400 letras."),
  experiencias: z
    .array(
      z.strictObject({
        titulo: textoCurto(120, "Um título de experiência ficou grande demais."),
        texto: textoCurto(300, "Uma experiência passou de 300 letras."),
      }),
    )
    .max(6, "Deixa no máximo 6 experiências.")
    .default([]),
  competencias: z
    .array(z.strictObject({ texto: textoCurto(300, "Uma competência passou de 300 letras.") }))
    .max(10, "Deixa no máximo 10 competências.")
    .default([]),
  cursos: z
    .array(z.strictObject({ texto: textoCurto(300, "Um curso passou de 300 letras.") }))
    .max(6, "Deixa no máximo 6 cursos.")
    .default([]),
});

export const entradaPdf = z.strictObject({ identificacao, curriculo: curriculoRevisado });

// Formato devolvido pelo modelo (V24). A API já garante o esquema; isto é a segunda conferência.
const itemModelo = z.object({ texto: z.string(), origem: z.string() });
export const respostaModelo = z.object({
  objetivo: z.string(),
  resumo: z.string(),
  experiencias: z.array(z.object({ titulo: z.string(), texto: z.string(), origem: z.string() })),
  competencias: z.array(itemModelo),
  cursos: z.array(itemModelo),
  entrevista: z.array(z.object({ pergunta: z.string(), passos: z.array(z.string()) })),
});

// Converte o erro do Zod no formato de E01: uma mensagem por campo.
export function errosPorCampo(erro) {
  const campos = {};
  for (const issue of erro.issues) {
    const chave = issue.path.length ? issue.path.join(".") : "_";
    campos[chave] ??= issue.message;
  }
  return campos;
}

// V21 e V22. A ordem importa: CPF antes de telefone, senão o telefone come parte do CPF.
const CPF = /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const TELEFONE = /\(?\d{2}\)?\s?9?\d{4}[-\s]?\d{4}/g;

export function mascarar(texto) {
  return texto
    .replace(CPF, "[removido]")
    .replace(EMAIL, "[removido]")
    .replace(TELEFONE, "[removido]")
    .replace(/[<>]/g, "");
}
