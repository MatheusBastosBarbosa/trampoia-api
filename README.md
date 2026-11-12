# TrampoIA — API

Back-end do [TrampoIA](https://github.com/diegopeon/TRAMPO-IA-). Aqui fica só o servidor; o front é outra parte.

## O que já está pronto

- `POST /api/gerar`: recebe o relato, apaga CPF, telefone e e-mail, chama o Claude e devolve o currículo e as perguntas de entrevista.
- Filtro de Integridade: tira do resultado o que a pessoa não contou (curso, número ou certificado inventado).
- `POST /api/pdf`: gera o PDF do currículo revisado.
- Validação dos campos, limite de uso por IP e por dia e mensagens de erro (E01 a E07).
- Testes automáticos.

## O que falta

- [ ] Chave da API da Anthropic e colocar no `.env` (veja o `.env.example`)
- [x] Hospedar o servidor no Railway: https://trampoia-api-production.up.railway.app (teste: [`/api/saude`](https://trampoia-api-production.up.railway.app/api/saude))
- [ ] Endereço do servidor e colocar o endereço do front em `CORS_ORIGEM`
- [ ] Ajustar a lista de palavras do filtro depois do teste na oficina (`server/filtro.js`)

## Como rodar

Precisa do Node 22.9 ou mais novo.

```bash
npm install
npm test
```

Os testes rodam sem chave. Para subir o servidor, crie o `.env` a partir do `.env.example` e rode `npm run dev`. Ele fica em `http://localhost:3000`.

## Onde fica cada coisa

```text
server/app.js       rotas
server/claude.js    chamada à API do Claude
server/filtro.js    Filtro de Integridade
server/validar.js   regras dos campos
server/pdf.js       PDF
prompts/sistema.md  instruções para a IA
```

Os campos de cada rota seguem a documentação do [repositório principal](https://github.com/diegopeon/TRAMPO-IA-/tree/main/docs).
