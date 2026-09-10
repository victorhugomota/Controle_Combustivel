# Controle de Combustível — Consumo Família Mota

Aplicação web (SPA estática, sem build) para **gestão de consumo de combustível** e
**roteirização de circuito pendular** (ida e volta calculadas separadamente), baseada
na *Documentação Técnica do Sistema de Gestão & Auditoria de Consumo de Combustível*.

🔗 **Deploy (GitHub Pages):** https://victorhugomota.github.io/Controle_Combustivel/

## O que o sistema faz

### Circuito pendular (ida e volta separadas)
1. Cadastre o **endereço de casa** (Configurações) e os **destinos de trabalho**. Os campos de endereço têm **autocomplete** (Nominatim/OSM) e também aceitam **Plus Codes** do Google/Open Location Code — código completo (`6GCRQ5PV+6R`) ou código curto + localidade (`Q5PV+6R Jardim Canadá, Ribeirão Preto - SP`), resolvido offline pela lib `js/vendor/openlocationcode.js`.
2. O algoritmo (`js/rotas.js`) ordena os destinos ativos pela **distância de casa** (Haversine), do mais próximo ao mais distante: `D1 … Dn`.
3. **Ida:** `Casa → D1 → D2 → … → Dn`.
4. **Volta:** `Dn → … → D2 → D1 → Casa` — assim o passageiro deixado no primeiro destino é recolhido no retorno.
5. A quilometragem de cada perna é calculada pelo **OSRM** (malha viária real). Se o OSRM estiver indisponível, usa-se **Haversine × 1,38** (fator viário) e o resultado é marcado como *estimativa*.
6. O mapa Leaflet desenha a **ida em verde** e a **volta em azul tracejado**; há botão para abrir o circuito no Google Maps.

### Consumo e custos
- **Consumo médio (km/L):** calculado par-a-par pela variação de odômetro entre abastecimentos (`(Σ Δkm) / (Σ litros)`).
- **Preço médio do litro:** `Σ valorTotal / Σ totalLitros`.
- **Custo por km:** `preço médio do litro ÷ consumo médio`.
- **Custo do circuito:** `km do circuito × custo por km`.
- **Custo do trabalho no mês atual:** `km/dia (ida+volta) × custo por km × dias úteis do mês`. Os dias úteis descontam finais de semana e feriados nacionais (fixos + móveis via Páscoa de Meeus/Jones/Butcher) e o feriado municipal de Ribeirão Preto (19/06) — ver `js/feriados.js`. O card mostra `Mês X (Atual) — Y dias úteis`, distância diária, custo médio por km, custo médio por dia e a estimativa mensal para ir e voltar.
- **Etanol × Gasolina:** razão `preço etanol / preço gasolina` comparada ao fator (padrão 0,70).
- Gráfico Recharts/Chart.js com histórico de preço (barras) e consumo (linha).

## Banco de dados — Firebase Firestore

Projeto: **`consumocombustivel-3adda`** (config já embutida em `js/firebase.js`).

Coleções usadas: `abastecimentos`, `rotas`, `configuracoes/global` — conforme o dicionário de dados da documentação.

### Configuração necessária no console do Firebase
1. **Firestore Database** → criar banco (modo produção).
2. **Authentication** → *Sign-in method* → habilitar **Anônimo**.
3. **Firestore → Rules** → publicar o conteúdo de [`firestore.rules`](firestore.rules).

> Sem autenticação anônima, troque as regras pela alternativa aberta comentada no arquivo (apenas para testes).

## Rodar localmente

É um site estático com ES modules — precisa de um servidor HTTP (não abra via `file://`):

```bash
python -m http.server 8000
# abra http://localhost:8000
```

## Deploy no GitHub Pages
Settings → Pages → *Build and deployment* → **Deploy from a branch** → branch `main` / pasta `/ (root)`.
O arquivo `.nojekyll` garante que as pastas `js/` e `css/` sejam servidas.

## Estrutura
```
index.html            # layout Z-pattern (header + grid de cards + modais)
css/styles.css
js/firebase.js         # init Firebase + auth anônima + re-exports do SDK
js/geocode.js          # geocodificação Nominatim
js/rotas.js            # circuito pendular + OSRM + fallback Haversine + link Google Maps
js/metricas.js         # consumo par-a-par, preço médio, custo/km, paridade
js/app.js              # orquestração, UI, mapa Leaflet, gráfico, listeners Firestore
firestore.rules
```
