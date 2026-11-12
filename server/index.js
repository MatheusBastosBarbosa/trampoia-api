import { criarApp } from "./app.js";

if (!process.env.ANTHROPIC_API_KEY) {
  console.warn("Aviso: ANTHROPIC_API_KEY não definida. /api/gerar vai falhar até ela ser configurada.");
}

const porta = Number(process.env.PORT) || 3000;
criarApp().listen(porta, () => console.log(`TrampoIA ouvindo em http://localhost:${porta}`));
