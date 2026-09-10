import {
  db, iniciarAuth, collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, getDoc
} from "./firebase.js";
import { geocodificar } from "./geocode.js";
import { montarCircuito, calcularTrecho, googleMapsUrl } from "./rotas.js";
import { calcularMetricas, analisarParidade } from "./metricas.js";

const $ = (s) => document.querySelector(s);
const brl = (v) => (Number(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const km = (v) => (Number(v) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });

const CASA_PADRAO = {
  nomeVeiculo: "Nissan Kicks de Victor e Maria",
  enderecoCasa: "Bonfim Paulista, Ribeirão Preto - SP",
  latCasa: -21.2687653, lngCasa: -47.8197413
};

const estado = {
  config: { ...CASA_PADRAO },
  rotas: [],
  abastecimentos: [],
  circuito: null,
  chart: null
};

/* ---------- Mapa ---------- */
const map = L.map("map").setView([CASA_PADRAO.latCasa, CASA_PADRAO.lngCasa], 12);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap", maxZoom: 19
}).addTo(map);
let camadasRota = L.layerGroup().addTo(map);

function iconePonto(cor, label) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${cor};color:#fff;border-radius:50%;width:26px;height:26px;
      display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;
      border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,.5)">${label}</div>`,
    iconSize: [26, 26], iconAnchor: [13, 13]
  });
}

/* ---------- Modais ---------- */
document.querySelectorAll("[data-modal]").forEach(b =>
  b.addEventListener("click", () => $("#" + b.dataset.modal).hidden = false));
document.querySelectorAll(".modal-close").forEach(b =>
  b.addEventListener("click", () => b.closest(".modal").hidden = true));
document.querySelectorAll(".modal").forEach(m =>
  m.addEventListener("click", e => { if (e.target === m) m.hidden = true; }));

/* ---------- Sync status ---------- */
function setSync(ok, txt) {
  $("#syncDot").className = "dot " + (ok ? "on" : "off");
  $("#syncStatus").textContent = txt;
}
window.addEventListener("online", () => setSync(true, "online"));
window.addEventListener("offline", () => setSync(false, "offline"));

/* ---------- Configurações ---------- */
const cfgRef = doc(db, "configuracoes", "global");

async function carregarConfig() {
  try {
    const snap = await getDoc(cfgRef);
    if (snap.exists()) estado.config = { ...CASA_PADRAO, ...snap.data() };
  } catch (e) { console.warn("config:", e.message); }
  aplicarConfig();
}

function aplicarConfig() {
  const c = estado.config;
  $("#vehicleName").textContent = c.nomeVeiculo || CASA_PADRAO.nomeVeiculo;
  if (c.fotoVeiculo) $("#vehiclePhoto").src = c.fotoVeiculo;
  $("#cfgNome").value = c.nomeVeiculo || "";
  $("#cfgEndereco").value = c.enderecoCasa || "";
  $("#cfgLat").value = c.latCasa ?? "";
  $("#cfgLng").value = c.lngCasa ?? "";
}

$("#formConfig").addEventListener("submit", async (e) => {
  e.preventDefault();
  const dados = {
    nomeVeiculo: $("#cfgNome").value.trim() || CASA_PADRAO.nomeVeiculo,
    enderecoCasa: $("#cfgEndereco").value.trim(),
    latCasa: parseFloat($("#cfgLat").value),
    lngCasa: parseFloat($("#cfgLng").value),
    updatedAt: serverTimestamp()
  };
  const file = $("#cfgFoto").files[0];
  if (file) dados.fotoVeiculo = await lerImagem(file);
  try {
    await setDoc(cfgRef, dados, { merge: true });
    estado.config = { ...estado.config, ...dados };
    aplicarConfig();
    $("#modalConfig").hidden = true;
    recalcular();
  } catch (err) { alert("Erro ao salvar: " + err.message); }
});

$("#btnGeocodeCasa").addEventListener("click", async () => {
  try {
    const r = await geocodificar($("#cfgEndereco").value);
    $("#cfgLat").value = r.lat.toFixed(7);
    $("#cfgLng").value = r.lng.toFixed(7);
  } catch (e) { alert(e.message); }
});

function lerImagem(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = rej;
    img.onload = () => {
      const c = document.createElement("canvas");
      const escala = Math.min(1, 320 / img.width);
      c.width = img.width * escala; c.height = img.height * escala;
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      res(c.toDataURL("image/jpeg", 0.8));
    };
    reader.readAsDataURL(file);
  });
}

$("#vehicleName").addEventListener("click", async () => {
  const novo = prompt("Nome do veículo:", $("#vehicleName").textContent);
  if (novo && novo.trim()) {
    await setDoc(cfgRef, { nomeVeiculo: novo.trim(), updatedAt: serverTimestamp() }, { merge: true });
    estado.config.nomeVeiculo = novo.trim();
    aplicarConfig();
  }
});
$("#vehiclePhoto").addEventListener("click", () => $("#cfgFoto").click());

/* ---------- Rotas / destinos ---------- */
const rotasCol = collection(db, "rotas");

$("#btnGeocode").addEventListener("click", async () => {
  const hint = $("#geoHint");
  try {
    hint.textContent = "Buscando…";
    const r = await geocodificar($("#rotaEndereco").value);
    $("#rotaEndereco").value = r.displayName;
    $("#rotaEndereco").dataset.lat = r.lat;
    $("#rotaEndereco").dataset.lng = r.lng;
    hint.textContent = `📍 ${r.lat.toFixed(5)}, ${r.lng.toFixed(5)}`;
  } catch (e) { hint.textContent = "⚠ " + e.message; }
});

$("#formRota").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nome = $("#rotaNome").value.trim();
  const endereco = $("#rotaEndereco").value.trim();
  let lat = parseFloat($("#rotaEndereco").dataset.lat);
  let lng = parseFloat($("#rotaEndereco").dataset.lng);
  try {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const r = await geocodificar(endereco);
      lat = r.lat; lng = r.lng;
    }
    await addDoc(rotasCol, {
      nome, endereco, latitude: lat, longitude: lng,
      ordem: estado.rotas.length, ativa: true,
      createdAt: serverTimestamp()
    });
    e.target.reset();
    $("#geoHint").textContent = "";
    delete $("#rotaEndereco").dataset.lat;
    delete $("#rotaEndereco").dataset.lng;
  } catch (err) { alert("Erro: " + err.message); }
});

function renderDestinos() {
  const ul = $("#listaDestinos");
  ul.innerHTML = "";
  estado.rotas.forEach(r => {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <label style="display:inline-flex;gap:6px;align-items:center;width:auto">
          <input type="checkbox" style="width:auto" ${r.ativa !== false ? "checked" : ""}>
          <strong>${r.nome}</strong>
        </label>
        <small>${r.endereco || ""}</small>
      </div>
      <button class="link-btn">excluir</button>`;
    li.querySelector("input").addEventListener("change", (ev) =>
      updateDoc(doc(db, "rotas", r.id), { ativa: ev.target.checked }));
    li.querySelector("button").addEventListener("click", () => {
      if (confirm(`Excluir "${r.nome}"?`)) deleteDoc(doc(db, "rotas", r.id));
    });
    ul.appendChild(li);
  });
}

/* ---------- Cálculo do circuito ---------- */
$("#btnRecalcular").addEventListener("click", recalcular);

async function recalcular() {
  const casa = { lat: Number(estado.config.latCasa), lng: Number(estado.config.lngCasa) };
  if (!Number.isFinite(casa.lat)) return;
  map.setView([casa.lat, casa.lng], 12);

  const { ordenados, ida, volta } = montarCircuito(casa, estado.rotas);
  if (!ordenados.length) {
    $("#listaIda").innerHTML = $("#listaVolta").innerHTML = "<li>Nenhum destino ativo.</li>";
    $("#routeSummary").innerHTML = "";
    $("#gmapsLink").hidden = true;
    camadasRota.clearLayers();
    estado.circuito = null;
    renderMetricas();
    return;
  }

  $("#routeSummary").innerHTML = "Calculando rota viária (OSRM)…";
  const [tIda, tVolta] = await Promise.all([calcularTrecho(ida), calcularTrecho(volta)]);
  estado.circuito = { ida, volta, tIda, tVolta, ordenados };

  renderPernas($("#listaIda"), ida, tIda);
  renderPernas($("#listaVolta"), volta, tVolta);

  const totalKm = tIda.distanciaTotalKm + tVolta.distanciaTotalKm;
  const estimado = !tIda.real || !tVolta.real;
  $("#routeSummary").innerHTML =
    `Ordem por proximidade de casa: <b>${ordenados.map(d => d.nome).join(" → ")}</b><br>` +
    `Ida: <b>${km(tIda.distanciaTotalKm)} km</b> &nbsp;•&nbsp; Volta: <b>${km(tVolta.distanciaTotalKm)} km</b><br>` +
    `Circuito completo: <b>${km(totalKm)} km</b>` +
    (estimado ? ` <span class="tag-est">estimativa (Haversine ×1,38)</span>` : "");

  const gm = $("#gmapsLink");
  gm.href = googleMapsUrl([...ida, ...volta.slice(1)]);
  gm.hidden = false;

  desenharMapa(ida, volta, tIda, tVolta);
  renderMetricas();
}

function renderPernas(ol, pontos, trecho) {
  ol.innerHTML = "";
  for (let i = 1; i < pontos.length; i++) {
    const li = document.createElement("li");
    const d = trecho.pernas[i - 1] || 0;
    li.innerHTML = `${pontos[i - 1].nome} → ${pontos[i].nome} <span>${km(d)} km</span>`;
    ol.appendChild(li);
  }
}

function desenharMapa(ida, volta, tIda, tVolta) {
  camadasRota.clearLayers();
  if (tIda.linha.length) L.polyline(tIda.linha, { color: "#22c55e", weight: 5, opacity: .85 }).addTo(camadasRota);
  if (tVolta.linha.length) L.polyline(tVolta.linha, { color: "#3b82f6", weight: 4, opacity: .8, dashArray: "8 6" }).addTo(camadasRota);

  ida.forEach((p, i) => {
    const label = p.casa ? "🏠" : String(i);
    L.marker([p.lat, p.lng], { icon: iconePonto(p.casa ? "#0f172a" : "#22c55e", label) })
      .bindPopup(`<b>${p.nome}</b>`).addTo(camadasRota);
  });
  const todos = [...tIda.linha, ...tVolta.linha];
  if (todos.length) map.fitBounds(L.latLngBounds(todos).pad(0.15));
}

/* ---------- Abastecimentos ---------- */
const abCol = collection(db, "abastecimentos");
$("#abData").valueAsDate = new Date();

["abValor", "abLitros"].forEach(id =>
  $("#" + id).addEventListener("input", () => {
    const v = parseFloat($("#abValor").value), l = parseFloat($("#abLitros").value);
    $("#abPrecoCalc").textContent = (v > 0 && l > 0) ? brl(v / l) : "—";
  }));

$("#formAbastecimento").addEventListener("submit", async (e) => {
  e.preventDefault();
  const valorTotal = parseFloat($("#abValor").value);
  const totalLitros = parseFloat($("#abLitros").value);
  try {
    await addDoc(abCol, {
      data: $("#abData").value,
      odometroKm: parseInt($("#abOdometro").value, 10),
      valorTotal, totalLitros,
      valorLitro: totalLitros > 0 ? valorTotal / totalLitros : 0,
      tipoCombustivel: $("#abTipo").value,
      createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    });
    e.target.reset();
    $("#abData").valueAsDate = new Date();
    $("#abPrecoCalc").textContent = "—";
    $("#modalAbastecimento").hidden = true;
  } catch (err) { alert("Erro: " + err.message); }
});

function renderHistorico() {
  const tb = $("#histBody");
  tb.innerHTML = "";
  const m = calcularMetricas(estado.abastecimentos);
  const consumoPorData = {};
  m.intervalos.forEach(i => consumoPorData[i.ate] = i.consumo);
  estado.abastecimentos
    .slice().sort((a, b) => (b.odometroKm || 0) - (a.odometroKm || 0))
    .forEach(a => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${a.data || ""}</td>
        <td>${(a.odometroKm || 0).toLocaleString("pt-BR")}</td>
        <td>${km(a.totalLitros)}</td>
        <td>${brl(a.valorTotal)}</td>
        <td>${brl(a.valorLitro)}</td>
        <td>${a.tipoCombustivel || ""}</td>
        <td>${consumoPorData[a.data] ? km(consumoPorData[a.data]) : "—"}</td>
        <td><button class="link-btn">excluir</button></td>`;
      tr.querySelector("button").addEventListener("click", () => {
        if (confirm("Excluir este abastecimento?")) deleteDoc(doc(db, "abastecimentos", a.id));
      });
      tb.appendChild(tr);
    });
}

/* ---------- Métricas + gráfico + paridade ---------- */
function renderMetricas() {
  const m = calcularMetricas(estado.abastecimentos);
  $("#mConsumo").textContent = m.consumoMedio ? km(m.consumoMedio) : "—";
  $("#mCustoKm").textContent = m.custoPorKm ? brl(m.custoPorKm) : "—";
  $("#mPrecoLitro").textContent = m.precoMedioLitro ? brl(m.precoMedioLitro) : "—";
  $("#mTotal").textContent = brl(m.totalGasto);
  $("#mLitros").textContent = km(m.litrosAcumulados) + " L";

  const c = estado.circuito;
  if (c && m.custoPorKm) {
    const totalKm = c.tIda.distanciaTotalKm + c.tVolta.distanciaTotalKm;
    $("#custoCircuito").innerHTML =
      `Custo estimado do circuito pendular (ida + volta): <b>${brl(totalKm * m.custoPorKm)}</b> ` +
      `<br>(${km(totalKm)} km × ${brl(m.custoPorKm)}/km)`;
  } else {
    $("#custoCircuito").textContent = "";
  }
  renderGrafico(m);
  renderHistorico();
}

function renderGrafico(m) {
  const dados = estado.abastecimentos
    .slice().sort((a, b) => (a.odometroKm || 0) - (b.odometroKm || 0));
  const labels = dados.map(a => a.data || "");
  const precos = dados.map(a => Number(a.valorLitro) || 0);
  const consumoPorData = {};
  m.intervalos.forEach(i => consumoPorData[i.ate] = i.consumo);
  const consumo = dados.map(a => consumoPorData[a.data] || null);

  if (estado.chart) estado.chart.destroy();
  estado.chart = new Chart($("#grafico"), {
    data: {
      labels,
      datasets: [
        { type: "bar", label: "Preço R$/L", data: precos, backgroundColor: "#3b82f6", yAxisID: "y" },
        { type: "line", label: "Consumo km/L", data: consumo, borderColor: "#22c55e", spanGaps: true, tension: .3, yAxisID: "y1" }
      ]
    },
    options: {
      responsive: true,
      scales: {
        y: { position: "left", ticks: { color: "#94a3b8" }, grid: { color: "#334155" } },
        y1: { position: "right", ticks: { color: "#94a3b8" }, grid: { drawOnChartArea: false } },
        x: { ticks: { color: "#94a3b8" }, grid: { color: "#334155" } }
      },
      plugins: { legend: { labels: { color: "#e2e8f0" } } }
    }
  });
}

function renderParidade() {
  const r = analisarParidade($("#precoEtanol").value, $("#precoGasolina").value, parseFloat($("#fatorParidade").value));
  const box = $("#resultadoParidade");
  if (!r) { box.className = "paridade-result"; box.textContent = "Informe os dois preços."; return; }
  box.className = "paridade-result " + r.recomendado.toLowerCase();
  box.innerHTML =
    `Razão etanol/gasolina: <b>${r.razao.toFixed(3)}</b> (limite ${r.fator.toFixed(2)})<br>` +
    `Recomendado: <b>${r.recomendado}</b><br>` +
    `Vantagem aproximada: <b>${r.economiaPerc.toFixed(1)}%</b> por km equivalente.`;
}
["precoEtanol", "precoGasolina", "fatorParidade"].forEach(id =>
  $("#" + id).addEventListener("input", renderParidade));

/* ---------- Boot ---------- */
function assinarColecoes() {
  onSnapshot(query(rotasCol, orderBy("ordem")), (snap) => {
    estado.rotas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderDestinos();
    recalcular();
  }, (e) => { console.warn("rotas:", e.message); setSync(false, "erro de leitura"); });

  onSnapshot(query(abCol, orderBy("odometroKm")), (snap) => {
    estado.abastecimentos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setSync(true, "sincronizado");
    renderMetricas();
  }, (e) => { console.warn("abastecimentos:", e.message); setSync(false, "erro de leitura"); });
}

(async function init() {
  setSync(navigator.onLine, "conectando…");
  await carregarConfig();
  iniciarAuth(() => {});
  assinarColecoes();
  renderParidade();
})();
