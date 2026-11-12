// Dados do exemplo de integracao-claude.md, reaproveitados pelos testes.
export const entradaExemplo = {
  aceite: true,
  nivel: "medio",
  situacao: "cursando",
  vaga: "jovem_aprendiz",
  objetivo: "quero trabalhar em escritório",
  vivencias:
    "ajudo minha tia no salão dela faz 2 anos, atendo as clientes e marco horário no zap. tambem cuido do caixa quando ela sai",
  voluntariado: "",
  oficinas: "fiz um curso de informatica no cras",
};

const pergunta = (n) => ({
  pergunta: `Pergunta ${n}?`,
  passos: ["Diga o que quer aprender.", "Conte que atende clientes no salão da sua tia."],
});

export const respostaExemplo = () => ({
  objetivo: "Vaga de Jovem Aprendiz em rotinas administrativas.",
  resumo:
    "Experiência de 2 anos em atendimento ao cliente e organização de agenda em salão de beleza familiar, com responsabilidade sobre o caixa.",
  experiencias: [
    {
      titulo: "Apoio em salão de beleza familiar",
      texto: "Atendimento a clientes e agendamento de horários por WhatsApp.",
      origem: "atendo as clientes e marco horário no zap",
    },
    {
      titulo: "Apoio em salão de beleza familiar",
      texto: "Controle do caixa na ausência da responsável.",
      origem: "cuido do caixa quando ela sai",
    },
  ],
  competencias: [
    { texto: "Atendimento ao cliente", origem: "atendo as clientes" },
    { texto: "Organização de agenda", origem: "marco horário no zap" },
  ],
  cursos: [{ texto: "Curso de informática (CRAS)", origem: "fiz um curso de informatica no cras" }],
  entrevista: [pergunta(1), pergunta(2), pergunta(3)],
});

export const identificacaoExemplo = {
  nome: "Maria José da Silva",
  telefone: "(71) 99999-1234",
  email: "",
  cidade: "Salvador/BA",
  idade: "17",
  nivel: "medio",
  situacao: "cursando",
  escola: "Colégio Estadual Exemplo",
  previsao: "2027",
};
