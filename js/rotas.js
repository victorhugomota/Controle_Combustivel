// Algoritmo de circuito pendular (ida e volta separadas) + motor viário OSRM
export const FATOR_VIA_REAL = 1.38;

export function haversineKm(a, b) {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLng = (b.lng - a.lng) * Math.PI / 180;
  const la1 = a.lat * Math.PI / 180, la2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Monta a sequência de pontos do circuito pendular.
 * 1. Ordena destinos ativos por distância (euclidiana/Haversine) da casa: D1 (mais perto) .. Dn (mais longe).
 * 2. Ida:   Casa -> D1 -> D2 -> ... -> Dn
 * 3. Volta: Dn -> ... -> D2 -> D1 -> Casa
 */
export function montarCircuito(casa, destinos) {
  const ativos = destinos
    .filter(d => d.ativa !== false && Number.isFinite(d.latitude) && Number.isFinite(d.longitude))
    .map(d => ({ ...d, lat: d.latitude, lng: d.longitude }))
    .map(d => ({ ...d, distCasa: haversineKm(casa, d) }))
    .sort((x, y) => x.distCasa - y.distCasa);

  const casaPt = { nome: "Casa", lat: casa.lat, lng: casa.lng, casa: true };
  const ida = [casaPt, ...ativos];
  const volta = [...ativos.slice().reverse(), casaPt];
  return { ordenados: ativos, ida, volta };
}

async function osrmTrecho(pontos) {
  const coords = pontos.map(p => `${p.lng},${p.lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error("OSRM indisponível");
  const data = await resp.json();
  if (data.code !== "Ok" || !data.routes?.length) throw new Error("Rota não encontrada");
  const rota = data.routes[0];
  return {
    distanciaTotalKm: rota.distance / 1000,
    pernas: rota.legs.map(l => l.distance / 1000),
    linha: rota.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    real: true
  };
}

function fallbackTrecho(pontos) {
  const pernas = [];
  const linha = pontos.map(p => [p.lat, p.lng]);
  for (let i = 1; i < pontos.length; i++) {
    pernas.push(haversineKm(pontos[i - 1], pontos[i]) * FATOR_VIA_REAL);
  }
  return {
    distanciaTotalKm: pernas.reduce((s, v) => s + v, 0),
    pernas, linha, real: false
  };
}

export async function calcularTrecho(pontos) {
  if (pontos.length < 2) return { distanciaTotalKm: 0, pernas: [], linha: [], real: true };
  try {
    return await osrmTrecho(pontos);
  } catch (e) {
    console.warn("Fallback Haversine:", e.message);
    return fallbackTrecho(pontos);
  }
}

export function googleMapsUrl(pontos) {
  const [origin, ...rest] = pontos;
  const destination = rest.pop();
  const wp = rest.map(p => `${p.lat},${p.lng}`).join("|");
  let u = `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}` +
          `&destination=${destination.lat},${destination.lng}&travelmode=driving`;
  if (wp) u += `&waypoints=${encodeURIComponent(wp)}`;
  return u;
}
