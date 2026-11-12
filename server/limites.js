// Limites de uso (RN25, RN26). Ficam em memória e zeram se o servidor reiniciar (por isso RN28).

export function criarLimites({
  porIp = 30,
  janelaMs = 10 * 60 * 1000,
  diario = Number(process.env.LIMITE_DIARIO) || 300,
  agora = () => Date.now(),
} = {}) {
  const usosPorIp = new Map();
  let dia = null;
  let totalDia = 0;

  const hoje = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bahia" }).format(agora());

  function limparAntigos(t) {
    for (const [ip, usos] of usosPorIp) {
      if (!usos.some((u) => t - u < janelaMs)) usosPorIp.delete(ip);
    }
  }

  return {
    /** Registra uma geração. Devolve null se pode seguir, ou o código do erro. */
    consumir(ip) {
      const t = agora();
      const d = hoje();
      if (d !== dia) {
        dia = d;
        totalDia = 0;
      }
      if (totalDia >= diario) return "E07";

      if (usosPorIp.size > 5000) limparAntigos(t);
      const usos = (usosPorIp.get(ip) ?? []).filter((u) => t - u < janelaMs);
      if (usos.length >= porIp) {
        usosPorIp.set(ip, usos);
        return "E03";
      }
      usos.push(t);
      usosPorIp.set(ip, usos);
      totalDia++;
      return null;
    },
  };
}
