// Filtro de Integridade (RN05 a RN07, RN11, V25 a V32). Código comum, sem IA.

// Primeira versão da lista (validacoes.md). Ampliar conforme os testes.
const TERMOS_CREDENCIAL = [
  "certificado", "certificação", "certificada", "diploma", "graduação", "graduado",
  "bacharel", "licenciatura", "técnico em", "pós-graduação", "MBA", "fluente",
  "inglês", "espanhol", "Excel", "Word", "Pacote Office", "CNH", "habilitação",
];

// Minúsculas, sem acento, pontuação vira espaço, espaços repetidos viram um.
export function normalizar(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TERMOS = TERMOS_CREDENCIAL.map(normalizar);
const contemPalavra = (textoComBordas, trecho) => textoComBordas.includes(` ${trecho} `);
const digitos = (norm) => norm.match(/\d+/g) ?? [];

function criarContexto(entrada) {
  const norm = normalizar(entrada);
  const comBordas = ` ${norm} `;
  return {
    comBordas,
    digitos: new Set(digitos(norm)),
    termos: new Set(TERMOS.filter((t) => contemPalavra(comBordas, t))),
  };
}

// V29 e V30: todo número e todo termo de credencial precisam estar na entrada.
function semInvencao(texto, ctx) {
  const norm = normalizar(texto);
  if (digitos(norm).some((d) => !ctx.digitos.has(d))) return false;
  const comBordas = ` ${norm} `;
  return !TERMOS.some((t) => contemPalavra(comBordas, t) && !ctx.termos.has(t));
}

// V28: origem com ao menos 10 caracteres e copiada da entrada.
function origemValida(origem, ctx) {
  const norm = normalizar(origem);
  return norm.length >= 10 && contemPalavra(ctx.comBordas, norm);
}

const LIMITES = { experiencias: 6, competencias: 10, cursos: 6, objetivo: 200, resumo: 400, texto: 300, titulo: 120 };

/**
 * Aplica o filtro à resposta do modelo.
 * @param dados resposta já no formato de respostaModelo
 * @param entrada texto exato enviado ao modelo, já mascarado
 * @returns {{ ok: true, resultado, descartados } | { ok: false, motivo: "insuficiente" | "entrevista", descartados }}
 */
export function aplicarFiltro(dados, entrada) {
  const ctx = criarContexto(entrada);
  let descartados = 0;

  // V26 e V31: em objetivo e resumo o campo volta vazio.
  const campoLivre = (valor, max) => {
    const t = valor.trim();
    if (!t) return "";
    if (t.length > max || !semInvencao(t, ctx)) {
      descartados++;
      return "";
    }
    return t;
  };

  // V26 a V30: item inválido é descartado; excedente é cortado (V27).
  const lista = (itens, limite, comTitulo) => {
    const aceitos = [];
    for (const item of itens) {
      const texto = item.texto.trim();
      const titulo = comTitulo ? item.titulo.trim() : "";
      const valido =
        texto &&
        texto.length <= LIMITES.texto &&
        (!comTitulo || (titulo && titulo.length <= LIMITES.titulo && semInvencao(titulo, ctx))) &&
        semInvencao(texto, ctx) &&
        origemValida(item.origem, ctx);
      if (!valido) {
        descartados++;
        continue;
      }
      aceitos.push(comTitulo ? { titulo, texto } : { texto }); // origem sai aqui
    }
    return aceitos.slice(0, limite);
  };

  const resultado = {
    objetivo: campoLivre(dados.objetivo, LIMITES.objetivo),
    resumo: campoLivre(dados.resumo, LIMITES.resumo),
    experiencias: lista(dados.experiencias, LIMITES.experiencias, true),
    competencias: lista(dados.competencias, LIMITES.competencias, false),
    cursos: lista(dados.cursos, LIMITES.cursos, false),
    // RN24: entrevista não passa pelo filtro de origem. V25: 3 a 5 perguntas, 2 a 4 passos.
    entrevista: dados.entrevista
      .map((p) => ({
        pergunta: p.pergunta.trim(),
        passos: p.passos.map((s) => s.trim()).filter(Boolean).slice(0, 4),
      }))
      .filter((p) => p.pergunta && p.passos.length >= 2)
      .slice(0, 5),
  };

  // V32: sem experiência nem competência, não há currículo.
  if (resultado.experiencias.length + resultado.competencias.length === 0) {
    return { ok: false, motivo: "insuficiente", descartados };
  }
  if (resultado.entrevista.length < 3) {
    return { ok: false, motivo: "entrevista", descartados };
  }
  return { ok: true, resultado, descartados };
}
