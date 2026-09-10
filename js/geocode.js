// Geocodificação de endereços via Nominatim / OpenStreetMap
const BASE = "https://nominatim.openstreetmap.org/search";

async function buscar(texto, limit) {
  const url = `${BASE}?format=jsonv2&addressdetails=1&limit=${limit}&countrycodes=br&q=`
    + encodeURIComponent(texto);
  const resp = await fetch(url, { headers: { "Accept-Language": "pt-BR" } });
  if (!resp.ok) throw new Error("Falha na geocodificação");
  return resp.json();
}

/* ---------- Plus Codes (Open Location Code) ---------- */
const OLC = () => window.OpenLocationCode;
// aceita "Q5PV+6R", "9G8F+6X" ou código completo "6GCRQ5PV+6R"
const RE_PLUSCODE = /\b([23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,3})\b/i;

export function extrairPlusCode(texto) {
  const m = (texto || "").match(RE_PLUSCODE);
  if (!m) return null;
  const codigo = m[1].toUpperCase();
  const resto = texto.replace(m[0], "").replace(/^[\s,;-]+|[\s,;-]+$/g, "").trim();
  return { codigo, resto };
}

// Resolve um plus code (completo ou curto + localidade) para coordenadas.
export async function resolverPlusCode(texto) {
  const olc = OLC();
  const info = extrairPlusCode(texto);
  if (!olc || !info || !olc.isValid(info.codigo)) throw new Error("Plus code inválido");

  let completo = info.codigo;
  if (!olc.isFull(info.codigo)) {
    if (!info.resto) throw new Error("Informe a cidade/bairro após o plus code");
    const ref = await geocodificar(info.resto);
    completo = olc.recoverNearest(info.codigo, ref.lat, ref.lng);
  }
  const area = olc.decode(completo);
  return {
    lat: area.latitudeCenter,
    lng: area.longitudeCenter,
    displayName: `${info.codigo}${info.resto ? " — " + info.resto : ""} (plus code)`
  };
}

export async function geocodificar(endereco) {
  if (window.OpenLocationCode && extrairPlusCode(endereco)) {
    try { return await resolverPlusCode(endereco); } catch (e) { /* tenta Nominatim abaixo */ }
  }
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
        if (extrairPlusCode(texto)) {
          const r = await resolverPlusCode(texto);
          render([r]);
        } else {
          render(await sugerirEnderecos(texto));
        }
      } catch (e) {
        lista.innerHTML = `<li class='ac-info'>${e.message || "Erro na busca"}</li>`;
      }
    }, 400);
  });

  input.addEventListener("blur", () => setTimeout(fechar, 150));
  input.addEventListener("keydown", (e) => { if (e.key === "Escape") fechar(); });
}
