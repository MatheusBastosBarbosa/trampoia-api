// Mensagens de erro (validacoes.md, E01 a E07).
export const ERROS = {
  E01: { status: 400, mensagem: "Tem um campo para corrigir." },
  E02: { status: 413, mensagem: "Seu texto passou do limite. Tenta resumir um pouco." },
  E03: { status: 429, mensagem: "Tem muita gente usando agora. Espera uns minutinhos e tenta de novo." },
  E04: {
    status: 422,
    mensagem:
      "Não consegui montar seu currículo com essas informações. Conta um pouco mais do que você já fez: onde e fazendo o quê.",
  },
  E05: { status: 422, mensagem: "Não deu para gerar com esse texto. Revisa o que você escreveu e tenta de novo." },
  E06: { status: 502, mensagem: "A conexão falhou. O que você digitou continua aqui. Tenta de novo." },
  E07: { status: 503, mensagem: "O TrampoIA chegou no limite de hoje. Volta amanhã." },
};

/**
 * Corpo de erro único para o front:
 * { erro: "E01", mensagem: "...", campos?: { nome: "Faltou seu nome completo." } }
 */
export function enviarErro(res, codigo, { status, mensagem, campos } = {}) {
  const base = ERROS[codigo];
  const corpo = { erro: codigo, mensagem: mensagem ?? base.mensagem };
  if (campos) corpo.campos = campos;
  res.status(status ?? base.status).json(corpo);
}
