// PDF do currículo (RF13, RN18, RN21, RNF11, V34, V35). Uma coluna, sem tabela nem imagem.
import PDFDocument from "pdfkit";
import { NIVEIS, SITUACOES } from "./validar.js";

// Caracteres que o Windows-1252 tem além do Latin-1 e que as fontes padrão do PDF desenham.
const EXTRAS_WINANSI = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";

// V34: remove o que a fonte padrão não desenha, como emoji.
export function paraWinAnsi(s) {
  return Array.from(String(s ?? "").normalize("NFC"))
    .filter((c) => {
      const cp = c.codePointAt(0);
      return (cp >= 0x20 && cp <= 0x7e) || (cp >= 0xa0 && cp <= 0xff) || EXTRAS_WINANSI.includes(c);
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

// V35: curriculo-primeiro-nome.pdf, sem acento.
export function nomeDoArquivo(nome) {
  const primeiro = String(nome ?? "")
    .split(" ")[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return primeiro ? `curriculo-${primeiro}.pdf` : "curriculo.pdf";
}

function formatarTelefone(d) {
  if (!d) return "";
  return d.length === 11
    ? `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
    : `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
}

/** @returns {Promise<Buffer>} */
export function gerarPdf({ identificacao: id, curriculo: cv }) {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 64, right: 64 },
    info: { Title: paraWinAnsi(`Currículo - ${id.nome}`), Author: paraWinAnsi(id.nome) },
  });
  const partes = [];
  doc.on("data", (p) => partes.push(p));
  const pronto = new Promise((ok, falha) => {
    doc.on("end", () => ok(Buffer.concat(partes)));
    doc.on("error", falha);
  });

  const corpo = (texto, opcoes = {}) =>
    doc.font("Helvetica").fontSize(11).fillColor("#000").text(paraWinAnsi(texto), opcoes);

  const secao = (titulo, preencher) => {
    doc.moveDown(0.8);
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#000").text(titulo.toUpperCase());
    doc.moveDown(0.3);
    preencher();
  };

  // Identificação
  doc.font("Helvetica-Bold").fontSize(18).text(paraWinAnsi(id.nome));
  const contato = [
    formatarTelefone(id.telefone),
    id.email,
    id.cidade,
    id.idade ? `${id.idade} anos` : "",
  ].filter(Boolean);
  corpo(contato.join(" | "));

  // RN18: ordem fixa; seção vazia não aparece.
  if (cv.objetivo) secao("Objetivo", () => corpo(cv.objetivo));
  if (cv.resumo) secao("Resumo", () => corpo(cv.resumo));

  // RN08: formação vem do formulário, nunca do modelo.
  secao("Formação", () => {
    corpo(`${NIVEIS[id.nivel]} (${SITUACOES[id.situacao]})`);
    corpo(id.escola);
    if (id.previsao && id.situacao === "cursando") corpo(`Previsão de conclusão: ${id.previsao}`);
    if (id.previsao && id.situacao === "concluido") corpo(`Concluído em ${id.previsao}`);
  });

  const experiencias = cv.experiencias.filter((e) => e.titulo || e.texto);
  if (experiencias.length) {
    secao("Experiências", () => {
      experiencias.forEach((e, i) => {
        if (i) doc.moveDown(0.4);
        if (e.titulo) doc.font("Helvetica-Bold").fontSize(11).text(paraWinAnsi(e.titulo));
        if (e.texto) corpo(e.texto);
      });
    });
  }

  const listar = (titulo, itens) => {
    const textos = itens.map((i) => i.texto).filter(Boolean);
    if (textos.length) secao(titulo, () => textos.forEach((t) => corpo(`• ${t}`)));
  };
  listar("Competências", cv.competencias);
  listar("Cursos e oficinas", cv.cursos);

  doc.end();
  return pronto;
}
