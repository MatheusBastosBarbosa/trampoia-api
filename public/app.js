// Front do TrampoIA. JavaScript puro, sem dependência (RNF01).
// Tudo fica em variáveis desta página: nada de cookie nem localStorage (RN12, RNF07).
"use strict";
(() => {
  const API = (document.querySelector('meta[name="trampoia-api"]')?.content || "").replace(/\/$/, "");
  const MSG_CONEXAO = "A conexão falhou. O que você digitou continua aqui. Tenta de novo.";
  const MSG_RELATO_CURTO = "Conta um pouco mais do que você já fez: onde e fazendo o quê.";
  const ESPERAS = [
    "Lendo o que você contou...",
    "Traduzindo para a linguagem do RH...",
    "Conferindo se não entrou nada que você não disse...",
    "Separando perguntas de entrevista...",
    "Quase lá...",
  ];
  const PASSOS = ["Seus dados", "Escola", "Sua história"];
  const NIVEIS = { fundamental: "Ensino fundamental", medio: "Ensino médio", tecnico: "Ensino técnico", superior: "Ensino superior" };
  const SITUACOES = { cursando: "cursando", concluido: "concluído", interrompido: "interrompido" };
  const ICONE_X =
    '<svg viewBox="0 0 18 18" aria-hidden="true"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>';

  const $ = (s) => document.querySelector(s);
  const form = $("#tela-form");
  const telas = { inicio: $("#tela-inicio"), form, gerando: $("#tela-gerando"), revisao: $("#tela-revisao") };
  const passos = [...form.querySelectorAll(".passo")];
  let passo = 0;
  let resultado = null; // resposta de /api/gerar
  let ocupado = false;

  const focarTitulo = (onde) => {
    const titulo = onde.querySelector("h1");
    if (!titulo) return;
    titulo.tabIndex = -1;
    titulo.focus({ preventScroll: true });
  };

  function mostrar(nome) {
    for (const [chave, el] of Object.entries(telas)) el.hidden = chave !== nome;
    window.scrollTo(0, 0);
    focarTitulo(nome === "form" ? passos[passo] : telas[nome]);
  }

  // Lê qualquer campo pelo name, inclusive grupos de rádio.
  const valor = (nome) => String(form.elements[nome]?.value ?? "").trim();

  // Mesmo formato do PDF (server/pdf.js).
  function formatarTelefone(t) {
    const d = t.replace(/\D/g, "");
    if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
    return t;
  }
  const linhaDeContato = (id) =>
    [formatarTelefone(id.telefone), id.email, id.cidade, id.idade ? id.idade + " anos" : ""].filter(Boolean).join("  ·  ");

  // ---------- Abertura e aviso (RF01) ----------
  $("#continuar").addEventListener("click", () => {
    if (!$("#aceite").checked) {
      $("#aceite-erro").textContent = "Marque a caixa para continuar.";
      $("#aceite").focus();
      return;
    }
    $("#aceite-erro").textContent = "";
    irPara(0);
    mostrar("form");
  });

  // ---------- Passos do formulário ----------
  function irPara(n) {
    passo = n;
    passos.forEach((p, i) => (p.hidden = i !== n));
    $("#progresso-texto").textContent = `Passo ${n + 1} de ${PASSOS.length} · ${PASSOS[n]}`;
    form.querySelectorAll(".progresso-barra li").forEach((li, i) => {
      li.className = i < n ? "feito" : i === n ? "atual" : "";
    });
    const ultimo = n === passos.length - 1;
    $("#proximo").hidden = ultimo;
    $("#gerar").hidden = !ultimo;
    if (!telas.form.hidden) {
      window.scrollTo(0, 0);
      focarTitulo(passos[n]);
    }
  }

  $("#anterior").addEventListener("click", () => {
    if (passo === 0) mostrar("inicio");
    else irPara(passo - 1);
  });

  $("#proximo").addEventListener("click", avancar);

  function avancar() {
    limparErros();
    const erros = errosDoPasso(validar(), passo);
    if (Object.keys(erros).length) return mostrarErros(erros);
    irPara(passo + 1);
  }

  // Contador de letras nas caixas de texto.
  for (const caixa of form.querySelectorAll("textarea[maxlength]")) {
    const atualizar = () => {
      const n = caixa.value.length;
      $("#" + caixa.id + "-conta").textContent = n ? `${n} de ${caixa.maxLength}` : "";
    };
    caixa.addEventListener("input", atualizar);
    caixa.atualizarContador = atualizar;
  }

  // ---------- Validação no navegador (RF04). O servidor repete tudo. ----------
  function validar() {
    const e = {};
    const nome = valor("nome").replace(/\s+/g, " ");
    if (nome.length < 3) e.nome = "Faltou seu nome completo.";
    else if (!/^[\p{L}'’ -]+$/u.test(nome)) e.nome = "Use só letras no nome.";
    else if (nome.split(" ").length < 2) e.nome = "Escreve nome e sobrenome.";

    const tel = valor("telefone").replace(/\D/g, "");
    const email = valor("email");
    if (tel && tel.length !== 10 && tel.length !== 11) e.telefone = "Confere o telefone, com DDD.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Confere o e-mail.";
    if (!tel && !email) e.telefone = "Coloca um telefone ou um e-mail para contato.";

    if (valor("cidade").length < 2) e.cidade = "Confere a cidade.";
    const idade = valor("idade");
    if (idade) {
      if (!/^\d+$/.test(idade)) e.idade = "Confere a idade.";
      else if (Number(idade) < 14) e.idade = "A idade mínima é 14 anos.";
    }

    if (!valor("nivel")) e.nivel = "Escolhe sua escolaridade.";
    if (!valor("situacao")) e.situacao = "Diz se você está cursando, concluiu ou parou os estudos.";
    if (valor("escola").length < 2) e.escola = "Faltou o nome da escola.";
    const previsao = valor("previsao");
    if (previsao && (!/^\d{4}$/.test(previsao) || previsao < "2000" || previsao > "2035")) {
      e.previsao = "Escreve o ano com 4 números.";
    }

    if (!valor("vaga")) e.vaga = "Escolhe o tipo de vaga.";
    const objetivo = valor("objetivo");
    if (!objetivo) e.objetivo = "Conta em que você gostaria de trabalhar.";
    else if (objetivo.length < 10) e.objetivo = "Conta um pouco mais sobre onde você quer trabalhar.";

    const relato = valor("vivencias").length + valor("voluntariado").length + valor("oficinas").length;
    if (relato < 40) e.vivencias = MSG_RELATO_CURTO; // V16
    return e;
  }

  const idDoCampo = (chave) => chave.replace(/^identificacao\./, "");
  const passoDoCampo = (chave) => passos.indexOf(document.getElementById(idDoCampo(chave))?.closest(".passo"));
  const errosDoPasso = (erros, n) => Object.fromEntries(Object.entries(erros).filter(([k]) => passoDoCampo(k) === n));

  function limparErros() {
    for (const el of form.querySelectorAll(".erro, .alerta")) el.textContent = "";
    for (const el of form.querySelectorAll("[aria-invalid]")) el.removeAttribute("aria-invalid");
    for (const el of form.querySelectorAll(".invalido")) el.classList.remove("invalido");
  }

  // Aceita erros do navegador e o campo "campos" de E01. Leva a pessoa ao passo do primeiro erro.
  function mostrarErros(campos) {
    const chaves = Object.keys(campos).filter((k) => passoDoCampo(k) >= 0);
    if (!chaves.length) return;
    const destino = Math.min(...chaves.map(passoDoCampo));
    if (destino !== passo) irPara(destino);
    let primeiro = null;
    for (const chave of chaves) {
      const id = idDoCampo(chave);
      const campo = document.getElementById(id);
      document.getElementById(id + "-erro").textContent = campos[chave];
      if (campo.matches("fieldset")) {
        campo.classList.add("invalido");
        if (passoDoCampo(chave) === destino) primeiro ??= campo.querySelector("input");
      } else {
        campo.setAttribute("aria-invalid", "true");
        if (passoDoCampo(chave) === destino) primeiro ??= campo;
      }
    }
    primeiro?.focus();
  }

  // RF05: só isto vai para /api/gerar. Nome e contato nunca (RN13, V19).
  const dadosGeracao = () => ({
    aceite: true,
    nivel: valor("nivel"),
    situacao: valor("situacao"),
    vaga: valor("vaga"),
    objetivo: valor("objetivo"),
    vivencias: valor("vivencias"),
    voluntariado: valor("voluntariado"),
    oficinas: valor("oficinas"),
  });

  const identificacao = () => ({
    nome: valor("nome").replace(/\s+/g, " "),
    telefone: valor("telefone"),
    email: valor("email"),
    cidade: valor("cidade"),
    idade: valor("idade"),
    nivel: valor("nivel"),
    situacao: valor("situacao"),
    escola: valor("escola"),
    previsao: valor("previsao"),
  });

  async function chamar(rota, corpo, prazoMs) {
    const controle = new AbortController();
    const relogio = setTimeout(() => controle.abort(), prazoMs);
    try {
      return await fetch(API + rota, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
        signal: controle.signal,
      });
    } finally {
      clearTimeout(relogio);
    }
  }

  async function lerErro(resposta) {
    try {
      const corpo = await resposta.json();
      if (corpo && corpo.mensagem) return corpo;
    } catch {
      // resposta sem JSON: servidor fora do ar, por exemplo
    }
    return { mensagem: MSG_CONEXAO };
  }

  // ---------- Geração (RF07, RF09) ----------
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    if (passo < passos.length - 1) return avancar(); // Enter nos primeiros passos
    if (ocupado) return;
    limparErros();
    const erros = validar();
    if (Object.keys(erros).length) return mostrarErros(erros);

    ocupado = true;
    let i = 0;
    $("#espera").textContent = ESPERAS[0];
    mostrar("gerando");
    const giro = setInterval(() => {
      i = Math.min(i + 1, ESPERAS.length - 1);
      $("#espera").textContent = ESPERAS[i];
    }, 7000);

    const falhar = (erro) => {
      mostrar("form");
      if (erro.campos) mostrarErros(erro.campos);
      $("#form-erro").textContent = erro.mensagem;
      if (!erro.campos) $("#form-erro").focus();
    };

    try {
      const r = await chamar("/api/gerar", dadosGeracao(), 100_000); // servidor corta em 90 s (RNF09)
      if (r.ok) {
        resultado = await r.json();
        montarRevisao();
        selecionarAba("cv", false);
        mostrar("revisao");
        crescerTodos();
      } else {
        falhar(await lerErro(r));
      }
    } catch {
      falhar({ mensagem: MSG_CONEXAO });
    } finally {
      clearInterval(giro);
      ocupado = false;
    }
  });

  // ---------- Revisão (RF10, RF11) ----------
  const criar = (tag, props = {}, filhos = []) => {
    const el = Object.assign(document.createElement(tag), props);
    el.append(...filhos);
    return el;
  };

  const crescer = (caixa) => {
    caixa.style.height = "auto";
    caixa.style.height = caixa.scrollHeight + "px";
  };
  const crescerTodos = () => document.querySelectorAll("#cv textarea.editavel").forEach(crescer);
  window.addEventListener("resize", crescerTodos);

  let contador = 0;
  function editavel(rotulo, valorInicial, { campo, secao, i, max, classe = "" }) {
    const id = "r" + ++contador;
    const caixa = criar("textarea", { id, rows: 1, maxLength: max, className: ("editavel " + classe).trim() });
    caixa.value = valorInicial ?? ""; // .value nunca interpreta HTML (V36)
    caixa.dataset.campo = campo;
    if (secao) {
      caixa.dataset.secao = secao;
      caixa.dataset.i = String(i);
    }
    caixa.addEventListener("input", () => crescer(caixa));
    return [criar("label", { htmlFor: id, textContent: rotulo, className: "so-leitor" }), caixa];
  }

  function botaoApagar(descricao, item) {
    const botao = criar("button", { type: "button", className: "apagar", innerHTML: ICONE_X });
    botao.setAttribute("aria-label", "Apagar " + descricao);
    botao.addEventListener("click", () => {
      const secao = item.closest(".cv-secao");
      const vizinho = item.nextElementSibling ?? item.previousElementSibling;
      item.remove();
      if (!secao.querySelector(".cv-item")) {
        const depois = secao.nextElementSibling;
        secao.remove();
        (depois?.querySelector("textarea") ?? $("#baixar")).focus();
      } else {
        (vizinho?.querySelector("textarea") ?? $("#baixar")).focus();
      }
    });
    return botao;
  }

  function montarRevisao() {
    const id = identificacao();
    $("#folha-nome").textContent = id.nome;
    $("#folha-contato").textContent = linhaDeContato(id);
    $("#titulo-revisao").textContent = `Pronto, ${id.nome.split(" ")[0]}! Agora confere.`;

    const cv = $("#cv");
    cv.replaceChildren();
    contador = 0;
    const secao = (titulo, conteudo, classe = "") =>
      cv.append(criar("section", { className: ("cv-secao " + classe).trim() }, [criar("h2", { textContent: titulo }), ...conteudo]));

    secao("Objetivo", editavel("Objetivo", resultado.objetivo, { campo: "objetivo", max: 200 }));
    secao("Resumo", editavel("Resumo", resultado.resumo, { campo: "resumo", max: 400 }));

    // RN08: formação vem do formulário, sem passar pelo modelo.
    const formacao = [`${NIVEIS[id.nivel]} (${SITUACOES[id.situacao]})`, id.escola];
    if (id.previsao && id.situacao === "cursando") formacao.push("Previsão de conclusão: " + id.previsao);
    if (id.previsao && id.situacao === "concluido") formacao.push("Concluído em " + id.previsao);
    secao(
      "Formação",
      [
        criar("div", { className: "cv-fixo" }, [
          ...formacao.map((t) => criar("p", { textContent: t })),
          criar("p", { className: "dica", textContent: "Vem do formulário. Para mudar, use “Voltar e mudar o que contei”." }),
        ]),
      ],
    );

    // Item da folha com o botão de apagar no fim.
    const item = (filhos, descricao) => {
      const div = criar("div", { className: "cv-item" }, filhos);
      div.append(botaoApagar(descricao, div));
      return div;
    };

    if (resultado.experiencias.length) {
      secao(
        "Experiências",
        resultado.experiencias.map((e, i) =>
          item(
            [
              criar("div", {}, [
                ...editavel("Título da experiência", e.titulo, { campo: "titulo", secao: "experiencias", i, max: 120, classe: "titulo" }),
                ...editavel("Descrição da experiência", e.texto, { campo: "texto", secao: "experiencias", i, max: 300 }),
              ]),
            ],
            "experiência: " + e.titulo,
          ),
        ),
      );
    }
    const lista = (titulo, chave, itens, nomeItem) => {
      if (!itens.length) return;
      secao(
        titulo,
        itens.map((c, i) =>
          item(
            [
              criar("span", { className: "marcador" }),
              criar("div", {}, editavel(nomeItem, c.texto, { campo: "texto", secao: chave, i, max: 300 })),
            ],
            nomeItem.toLowerCase() + ": " + c.texto,
          ),
        ),
        "cv-lista",
      );
    };
    lista("Competências", "competencias", resultado.competencias, "Competência");
    lista("Cursos e oficinas", "cursos", resultado.cursos, "Curso");

    $("#entrevista").replaceChildren(
      ...resultado.entrevista.map((p) =>
        criar("li", {}, [
          criar("h3", { textContent: p.pergunta }),
          criar("ol", { className: "passos" }, p.passos.map((s) => criar("li", { textContent: s }))),
        ]),
      ),
    );
    for (const s of ["#revisao-erro", "#revisao-ok", "#entrevista-ok"]) $(s).textContent = "";
  }

  // Abas Currículo e Entrevista.
  const abas = { cv: $("#aba-cv"), entrevista: $("#aba-entrevista") };
  function selecionarAba(nome, focar = true) {
    for (const [chave, aba] of Object.entries(abas)) {
      const ativa = chave === nome;
      aba.setAttribute("aria-selected", String(ativa));
      aba.tabIndex = ativa ? 0 : -1;
      $("#" + aba.getAttribute("aria-controls")).hidden = !ativa;
    }
    if (focar) abas[nome].focus();
    if (nome === "cv") crescerTodos();
  }
  abas.cv.addEventListener("click", () => selecionarAba("cv"));
  abas.entrevista.addEventListener("click", () => selecionarAba("entrevista"));
  $(".abas").addEventListener("keydown", (ev) => {
    if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
      selecionarAba(abas.cv.getAttribute("aria-selected") === "true" ? "entrevista" : "cv");
    }
  });

  // Lê o que está na folha agora, já com as correções da pessoa.
  function lerCurriculo() {
    const cv = { objetivo: "", resumo: "", experiencias: [], competencias: [], cursos: [] };
    for (const el of document.querySelectorAll("#cv [data-campo]")) {
      const { secao, i, campo } = el.dataset;
      const texto = el.value.trim();
      if (!secao) cv[campo] = texto;
      else (cv[secao][i] ??= {})[campo] = texto;
    }
    cv.experiencias = cv.experiencias.filter((e) => e && (e.titulo || e.texto));
    cv.competencias = cv.competencias.filter((c) => c && c.texto);
    cv.cursos = cv.cursos.filter((c) => c && c.texto);
    return cv;
  }

  // ---------- Exportação (RF12, RF13, RF15) ----------
  function textoDoCurriculo() {
    const id = identificacao();
    const cv = lerCurriculo();
    const partes = [id.nome, linhaDeContato(id).replaceAll("  ·  ", " | ")];
    const bloco = (titulo, linhas) => {
      if (linhas.length) partes.push("", titulo.toUpperCase(), ...linhas);
    };
    bloco("Objetivo", cv.objetivo ? [cv.objetivo] : []);
    bloco("Resumo", cv.resumo ? [cv.resumo] : []);
    const formacao = [`${NIVEIS[id.nivel]} (${SITUACOES[id.situacao]})`, id.escola];
    if (id.previsao && id.situacao === "cursando") formacao.push("Previsão de conclusão: " + id.previsao);
    if (id.previsao && id.situacao === "concluido") formacao.push("Concluído em " + id.previsao);
    bloco("Formação", formacao);
    bloco("Experiências", cv.experiencias.flatMap((e) => [e.titulo, e.texto].filter(Boolean)));
    bloco("Competências", cv.competencias.map((c) => "- " + c.texto));
    bloco("Cursos e oficinas", cv.cursos.map((c) => "- " + c.texto));
    return partes.join("\n");
  }

  const textoDaEntrevista = () =>
    resultado.entrevista
      .map((p, n) => [`${n + 1}. ${p.pergunta}`, ...p.passos.map((s) => "   - " + s)].join("\n"))
      .join("\n\n");

  async function copiar(texto, saida) {
    let ok = false;
    try {
      await navigator.clipboard.writeText(texto);
      ok = true;
    } catch {
      // navegador antigo ou página sem HTTPS
      const caixa = criar("textarea", { value: texto, readOnly: true });
      caixa.style.cssText = "position:fixed;top:0;opacity:0";
      document.body.append(caixa);
      caixa.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      }
      caixa.remove();
    }
    $("#revisao-erro").textContent = "";
    $(saida).textContent = ok ? "Copiado! Agora é só colar onde quiser." : "Não deu para copiar neste navegador.";
  }

  $("#copiar").addEventListener("click", () => copiar(textoDoCurriculo(), "#revisao-ok"));
  $("#copiar-entrevista").addEventListener("click", () => copiar(textoDaEntrevista(), "#entrevista-ok"));

  $("#baixar").addEventListener("click", async () => {
    if (ocupado) return;
    ocupado = true;
    const botao = $("#baixar");
    botao.disabled = true;
    botao.textContent = "Preparando o PDF...";
    $("#revisao-erro").textContent = "";
    $("#revisao-ok").textContent = "";
    try {
      const r = await chamar("/api/pdf", { identificacao: identificacao(), curriculo: lerCurriculo() }, 30_000);
      if (!r.ok) {
        const erro = await lerErro(r);
        const detalhe = erro.campos ? Object.values(erro.campos)[0] : "";
        $("#revisao-erro").textContent = detalhe ? `${erro.mensagem} ${detalhe}` : erro.mensagem;
        return;
      }
      const arquivo = await r.blob();
      const nome = /filename="([^"]+)"/.exec(r.headers.get("Content-Disposition") || "")?.[1] || "curriculo.pdf";
      const url = URL.createObjectURL(arquivo);
      const link = criar("a", { href: url, download: nome });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      $("#revisao-ok").textContent = "PDF baixado. Procure na pasta de downloads do celular.";
    } catch {
      $("#revisao-erro").textContent = MSG_CONEXAO;
    } finally {
      botao.disabled = false;
      botao.textContent = "Baixar PDF";
      ocupado = false;
    }
  });

  // ---------- Navegação (RF14) ----------
  $("#voltar").addEventListener("click", () => {
    irPara(passos.length - 1);
    mostrar("form");
  });

  for (const botao of document.querySelectorAll(".recomecar")) {
    botao.addEventListener("click", () => {
      if (!window.confirm("Isso apaga tudo o que você escreveu. Quer começar de novo?")) return;
      form.reset(); // devolve a cidade padrão
      limparErros();
      resultado = null;
      for (const s of ["#cv", "#entrevista"]) $(s).replaceChildren();
      for (const s of ["#folha-nome", "#folha-contato"]) $(s).textContent = "";
      for (const caixa of form.querySelectorAll("textarea[maxlength]")) caixa.atualizarContador();
      $("#aceite").checked = false;
      irPara(0);
      mostrar("inicio");
    });
  }

  irPara(0);
})();
