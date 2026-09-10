// Feriados nacionais brasileiros (fixos + móveis) e cálculo de dias úteis.
// Feriados móveis derivam da Páscoa via algoritmo de Meeus/Jones/Butcher.

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function iso(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Domingo de Páscoa
export function domingoDePascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(ano, mes - 1, dia);
}

function addDias(data, dias) {
  const nova = new Date(data);
  nova.setDate(nova.getDate() + dias);
  return nova;
}

// Conjunto de datas ISO feriado no ano. Inclui feriado municipal de Ribeirão Preto (19/06).
export function feriadosDoAno(ano, { incluirRibeiraoPreto = true } = {}) {
  const pascoa = domingoDePascoa(ano);
  const fixos = [
    [0, 1],   // Confraternização Universal
    [3, 21],  // Tiradentes
    [4, 1],   // Dia do Trabalho
    [8, 7],   // Independência
    [9, 12],  // Nossa Senhora Aparecida
    [10, 2],  // Finados
    [10, 15], // Proclamação da República
    [11, 25]  // Natal
  ].map(([m, d]) => iso(new Date(ano, m, d)));

  const moveis = [
    iso(addDias(pascoa, -47)), // Carnaval (terça)
    iso(addDias(pascoa, -46)), // Quarta-feira de Cinzas (ponto facultativo, contamos como não útil)
    iso(addDias(pascoa, -2)),  // Sexta-feira Santa
    iso(addDias(pascoa, 60))   // Corpus Christi
  ];

  const municipais = incluirRibeiraoPreto ? [iso(new Date(ano, 5, 19))] : []; // 19/06 Aniversário de Ribeirão Preto

  return new Set([...fixos, ...moveis, ...municipais]);
}

// Retorna { nome, ano, mes, diasUteis, feriadosNoMes: [ISO], primeiroDia, ultimoDia }
export function resumoMes(ref = new Date()) {
  const ano = ref.getFullYear();
  const mes = ref.getMonth(); // 0-11
  const feriados = feriadosDoAno(ano);
  const ultimo = new Date(ano, mes + 1, 0).getDate();

  let diasUteis = 0;
  const feriadosNoMes = [];
  for (let dia = 1; dia <= ultimo; dia++) {
    const d = new Date(ano, mes, dia);
    const dow = d.getDay(); // 0 dom, 6 sáb
    const chave = iso(d);
    const ehFeriado = feriados.has(chave);
    if (ehFeriado) feriadosNoMes.push(chave);
    if (dow !== 0 && dow !== 6 && !ehFeriado) diasUteis++;
  }

  return {
    nome: MESES[mes], ano, mes: mes + 1,
    diasUteis, feriadosNoMes,
    totalDias: ultimo
  };
}
