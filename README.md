# TrampoIA — API

Servidor e página do [TrampoIA](https://github.com/diegopeon/TRAMPO-IA-). O mesmo processo Node entrega a página (`public/`) e a API, então em produção não é preciso configurar CORS.

## O que já está pronto

- Página em `public/`: abertura com aviso de privacidade, formulário em 3 passos, tela de espera, folha de currículo editável, aba de entrevista, cópia do texto e download do PDF. HTML, CSS e JavaScript puros, sem fonte nem imagem externa, cerca de 16 KB comprimidos.
- `POST /api/gerar`: recebe o relato, apaga CPF, telefone e e-mail, chama o Claude e devolve o currículo e as perguntas de entrevista.
- Filtro de Integridade: tira do resultado o que a pessoa não contou (curso, número ou certificado inventado).
- `POST /api/pdf`: gera o PDF do currículo revisado.
- Validação dos campos, limite de uso por IP e por dia e mensagens de erro (E01 a E07).
- Testes automáticos.

## O que falta

- [ ] Colar a chave da API da Anthropic no `.env` (passo a passo em "Como rodar")
- [x] Hospedar o servidor no Railway: https://trampoia-api-production.up.railway.app (teste: [`/api/saude`](https://trampoia-api-production.up.railway.app/api/saude))
- [ ] Testar uma geração de verdade com a chave e conferir o resultado do filtro nos logs
- [ ] Ajustar a lista de palavras do filtro depois do teste na oficina (`server/filtro.js`)

## Como rodar

Precisa do Node 22.9 ou mais novo.

```bash
npm install
npm test
```

Os testes rodam sem chave. Para gerar currículos de verdade:

1. Crie a chave em [platform.claude.com](https://platform.claude.com), em API Keys.
2. Abra o arquivo `.env` desta pasta (se não existir, copie o `.env.example` com esse nome) e cole a chave depois de `ANTHROPIC_API_KEY=`, sem aspas nem espaços.
3. Rode `npm run dev` e abra `http://localhost:3000` no navegador. Abrir o `index.html` direto da pasta não funciona, porque a página precisa do servidor.

O `.env` está no `.gitignore` e não vai para o GitHub. Nunca cole a chave no código, em print ou em mensagem. Se o servidor responder "A conexão falhou" e o terminal mostrar `ANTHROPIC_API_KEY ausente no .env`, a chave não foi lida: confira o nome da variável e reinicie o `npm run dev`.

No Railway, o `.env` não é enviado. Coloque `ANTHROPIC_API_KEY` e `TRUST_PROXY=1` na aba Variables do serviço; ele reinicia sozinho. Configure também um limite de gasto no Console da Anthropic (RN28).

`CORS_ORIGEM` só é necessário se a página for hospedada em outro endereço. Nesse caso, preencha também a meta `trampoia-api` em `public/index.html` com o endereço do servidor.

## Onde fica cada coisa

```text
public/             página (index.html, estilo.css, app.js)
server/app.js       rotas
server/claude.js    chamada à API do Claude
server/filtro.js    Filtro de Integridade
server/validar.js   regras dos campos
server/pdf.js       PDF
prompts/sistema.md  instruções para a IA
```

Os campos de cada rota seguem a documentação do [repositório principal](https://github.com/diegopeon/TRAMPO-IA-/tree/main/docs).
