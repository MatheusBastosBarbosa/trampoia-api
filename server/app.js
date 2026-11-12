// Monta o Express. Separado do index.js para os testes trocarem o modelo por um falso.
import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { fileURLToPath } from "node:url";
import { entradaGeracao, entradaPdf, errosPorCampo } from "./validar.js";
import { aplicarFiltro } from "./filtro.js";
import { gerarComClaude, montarMensagem } from "./claude.js";
import { gerarPdf, nomeDoArquivo } from "./pdf.js";
import { criarLimites } from "./limites.js";
import { enviarErro } from "./erros.js";

const PRAZO_MS = 90_000; // RNF09
const MAX_CHAMADAS = 2; // RN27

// RN16: o log nunca leva texto digitado.
function registrar(dados) {
  console.log(JSON.stringify({ data: new Date().toISOString(), ...dados }));
}

// Traduz exceções do SDK para E03/E06 (integracao-claude.md, "Tratamento da resposta").
function erroDaApi(err, signal) {
  if (signal.aborted || err instanceof Anthropic.APIUserAbortError || err instanceof Anthropic.APIConnectionTimeoutError) {
    return { codigo: "E06", status: 504 };
  }
  if (err instanceof Anthropic.RateLimitError) return { codigo: "E03" };
  if (
    err instanceof Anthropic.BadRequestError ||
    err instanceof Anthropic.AuthenticationError ||
    err instanceof Anthropic.PermissionDeniedError ||
    err instanceof Anthropic.NotFoundError
  ) {
    // Problema de configuração nosso. O status e o tipo bastam para investigar.
    registrar({ rota: "/api/gerar", configuracao: true, statusApi: err.status, tipo: err.constructor.name });
    return { codigo: "E06", status: 502 };
  }
  if (err instanceof Anthropic.APIError) return { codigo: "E06", status: 502 };
  return null;
}

export function criarApp({ gerar = gerarComClaude, limites = criarLimites() } = {}) {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.TRUST_PROXY) {
    const v = process.env.TRUST_PROXY;
    app.set("trust proxy", /^\d+$/.test(v) ? Number(v) : v);
  }

  // Log de toda rota /api: data, rota, status, duração e o que a rota anexar.
  app.use("/api", (req, res, next) => {
    const inicio = Date.now();
    res.locals.log = {};
    res.on("finish", () =>
      registrar({ rota: req.baseUrl + req.path, status: res.statusCode, ms: Date.now() - inicio, ...res.locals.log }),
    );
    next();
  });

  // CORS: o front fica em outro endereço. CORS_ORIGEM aceita uma lista separada por vírgula.
  const origens = (process.env.CORS_ORIGEM ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  app.use("/api", (req, res, next) => {
    const origem = req.get("origin");
    if (origem && (origens.includes("*") || origens.includes(origem))) {
      res.set("Access-Control-Allow-Origin", origens.includes("*") ? "*" : origem);
      res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type");
      res.set("Access-Control-Expose-Headers", "Content-Disposition");
      res.set("Vary", "Origin");
    }
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.use(express.json({ limit: "16kb" })); // V17, RNF08
  app.use(express.static(fileURLToPath(new URL("../public", import.meta.url))));

  app.get("/api/saude", (req, res) => res.json({ ok: true }));

  app.post("/api/gerar", async (req, res) => {
    const v = entradaGeracao.safeParse(req.body ?? {});
    if (!v.success) return enviarErro(res, "E01", { campos: errosPorCampo(v.error) });

    const bloqueio = limites.consumir(req.ip); // V20
    if (bloqueio) return enviarErro(res, bloqueio);

    const mensagem = montarMensagem(v.data);
    const controle = new AbortController();
    const prazo = Date.now() + PRAZO_MS;
    const relogio = setTimeout(() => controle.abort(), PRAZO_MS);
    res.on("close", () => {
      if (!res.writableEnded) controle.abort(); // a pessoa fechou a aba
    });

    const log = res.locals.log;
    log.tokensEntrada = 0;
    log.tokensSaida = 0;
    log.descartados = 0;
    log.chamadas = 0;
    let ultimoMotivo = null;

    try {
      for (let i = 0; i < MAX_CHAMADAS; i++) {
        log.chamadas++;
        const r = await gerar(mensagem, { signal: controle.signal, timeoutMs: Math.max(1, prazo - Date.now()) });
        log.tokensEntrada += r.tokens?.entrada ?? 0;
        log.tokensSaida += r.tokens?.saida ?? 0;

        if (r.tipo === "recusa") return enviarErro(res, "E05");
        if (r.tipo !== "ok") {
          ultimoMotivo = r.tipo; // incompleta ou json_invalido: nova tentativa
          continue;
        }

        const f = aplicarFiltro(r.dados, mensagem);
        log.descartados += f.descartados;
        if (f.ok) return res.json(f.resultado);
        ultimoMotivo = f.motivo;
      }
      log.motivo = ultimoMotivo;
      return enviarErro(res, ultimoMotivo === "insuficiente" ? "E04" : "E06");
    } catch (err) {
      const mapeado = erroDaApi(err, controle.signal);
      if (!mapeado) throw err;
      return enviarErro(res, mapeado.codigo, { status: mapeado.status });
    } finally {
      clearTimeout(relogio);
    }
  });

  app.post("/api/pdf", async (req, res) => {
    const v = entradaPdf.safeParse(req.body ?? {});
    if (!v.success) return enviarErro(res, "E01", { campos: errosPorCampo(v.error) }); // V33
    const pdf = await gerarPdf(v.data);
    res.locals.log.bytes = pdf.length;
    res
      .type("application/pdf")
      .set("Content-Disposition", `attachment; filename="${nomeDoArquivo(v.data.identificacao.nome)}"`)
      .set("Cache-Control", "no-store")
      .send(pdf);
  });

  app.use("/api", (req, res) => res.status(404).json({ erro: "nao_encontrado" }));

  // Erros do corpo da requisição e qualquer falha inesperada.
  app.use((err, req, res, next) => {
    if (err.type === "entity.too.large") return enviarErro(res, "E02");
    if (err.type === "entity.parse.failed") {
      return enviarErro(res, "E01", { mensagem: "Não consegui ler os dados enviados. Tenta de novo." });
    }
    registrar({ rota: req.path, erroInterno: err.name });
    if (res.headersSent) return next(err);
    enviarErro(res, "E06", { status: 500 });
  });

  return app;
}
