// Cálculos de consumo (par-a-par por variação de odômetro), preço e custo por km
const num = (v) => Number(v) || 0;

export function calcularMetricas(abastecimentos) {
  const lista = abastecimentos
    .filter(a => Number.isFinite(Number(a.odometroKm)))
    .slice()
    .sort((a, b) => num(a.odometroKm) - num(b.odometroKm));

  const intervalos = [];
  for (let i = 1; i < lista.length; i++) {
    const dKm = num(lista[i].odometroKm) - num(lista[i - 1].odometroKm);
    const litros = num(lista[i].totalLitros);
    if (dKm > 0 && litros > 0) {
      intervalos.push({
        de: lista[i - 1].data, ate: lista[i].data,
        deltaKm: dKm, litros, consumo: dKm / litros
      });
    }
  }

  const somaLitrosIntervalos = intervalos.reduce((s, x) => s + x.litros, 0);
  const somaKm = intervalos.reduce((s, x) => s + x.deltaKm, 0);
  const consumoMedio = somaLitrosIntervalos > 0 ? somaKm / somaLitrosIntervalos : 0;

  const somaValor = lista.reduce((s, a) => s + num(a.valorTotal), 0);
  const somaLitrosTotal = lista.reduce((s, a) => s + num(a.totalLitros), 0);
  const precoMedioLitro = somaLitrosTotal > 0 ? somaValor / somaLitrosTotal : 0;
  const custoPorKm = consumoMedio > 0 ? precoMedioLitro / consumoMedio : 0;

  return {
    consumoMedio, precoMedioLitro, custoPorKm,
    totalGasto: somaValor, litrosAcumulados: somaLitrosTotal,
    intervalos, ultimoConsumo: intervalos.at(-1)?.consumo || 0
  };
}

// Paridade Etanol x Gasolina (regra do fator, padrão 0,70)
export function analisarParidade(precoEtanol, precoGasolina, fator = 0.70) {
  const e = num(precoEtanol), g = num(precoGasolina);
  if (e <= 0 || g <= 0) return null;
  const razao = e / g;
  const recomendado = razao <= fator ? "Etanol" : "Gasolina";
  const economiaPerc = Math.abs(1 - razao / fator) * 100;
  return { razao, recomendado, fator, economiaPerc };
}
