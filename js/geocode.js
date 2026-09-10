// Geocodificação de endereços via Nominatim / OpenStreetMap
const BASE = "https://nominatim.openstreetmap.org/search";

async function buscar(texto, limit) {
  const url = `${BASE}?format=jsonv2&addressdetails=1&limit=${limit}&countrycodes=br&q=`
    + encodeURIComponent(texto);
  const resp = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
  if (!resp.ok) throw new Error("Falha na geocodificação");
  return resp.json();
}

export async function geocodificar(endereco) {
  const dados = await buscar(endereco, 1);
  if (!dados.length) throw new Error("Endereço não encontrado");
  return {
    lat: parseFloat(dados[0].lat),
    lng: parseFloat(dados[0].lon),
    displayName: dados[0].display_name
  };
}

// Sugestões de autopreenchimento (autocomplete)
export async function sugerirEnderecos(texto) {
  if (!texto || texto.trim().length < 4) return [];
  const dados = await buscar(texto.trim(), 6);
  return dados.map(d => ({
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    displayName: d.display_name
  }));
}

/**
 * Liga um campo de texto a uma lista de sugestões de endereço.
 * onSelect recebe { lat, lng, displayName } quando o usuário escolhe uma opção.
 */
export function ativarAutocomplete(input, onSelect) {
  const wrap = document.createElement("div");
  wrap.className = "ac-wrap";
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);

  const lista = document.createElement("ul");
  lista.className = "ac-list";
  lista.hidden = true;
  wrap.appendChild(lista);

  let timer = null;
  let ultimoTexto = "";

  const fechar = () => { lista.hidden = true; lista.innerHTML = ""; };

  const render = (itens) => {
    lista.innerHTML = "";
    if (!itens.length) { fechar(); return; }
    itens.forEach(item => {
      const li = document.createElement("li");
      li.textContent = item.displayName;
      li.addEventListener("mousedown", (e) => {
        e.preventDefault();
        input.value = item.displayName;
        input.dataset.lat = item.lat;
        input.dataset.lng = item.lng;
        fechar();
        onSelect(item);
      });
      lista.appendChild(li);
    });
    lista.hidden = false;
  };

  input.addEventListener("input", () => {
    delete input.dataset.lat;
    delete input.dataset.lng;
    const texto = input.value;
    clearTimeout(timer);
    if (texto.trim().length < 4) { fechar(); return; }
    timer = setTimeout(async () => {
      if (texto === ultimoTexto) return;
      ultimoTexto = texto;
      lista.hidden = false;
      lista.innerHTML = "<li class='ac-info'>Buscando…</li>";
      try {
        render(await sugerirEnderecos(texto));
      } catch { lista.innerHTML = "<li class='ac-info'>Erro na busca</li>"; }
    }, 400);
  });

  input.addEventListener("blur", () => setTimeout(fechar, 150));
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
}
