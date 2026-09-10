// Geocodificação de endereços via Nominatim / OpenStreetMap
export async function geocodificar(endereco) {
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q="
    + encodeURIComponent(endereco);
  const resp = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
  if (!resp.ok) throw new Error("Falha na geocodificação");
  const dados = await resp.json();
  if (!dados.length) throw new Error("Endereço não encontrado");
  return {
    lat: parseFloat(dados[0].lat),
    lng: parseFloat(dados[0].lon),
    displayName: dados[0].display_name
  };
}
