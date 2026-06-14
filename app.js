// ===================================================
// BOLÃO COPA 2026 — App com Supabase
// Desenvolvido por Jhony Beraldo
// ===================================================

// ===== CONFIGURAÇÃO SUPABASE =====
const SUPABASE_URL = "https://ppsvevnflfsricjjleba.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwc3Zldm5mbGZzcmljampsZWJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNjIxOTMsImV4cCI6MjA5NjgzODE5M30.dhunAekr-8WHC8VgBLhjw-gizlxP6zV3_rpwWy6uI8E";
const ADMIN_PASS   = "240159";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== CACHE LOCAL (só para performance de leitura) =====
const Cache = {
  _data: {},
  set(k, v) { this._data[k] = v; },
  get(k)    { return this._data[k] ?? null; },
  clear()   { this._data = {}; }
};

// ===== LOADING STATE =====
let _loading = false;
function setLoading(on) {
  _loading = on;
  document.body.style.cursor = on ? "wait" : "";
}

// ===== DB HELPERS =====
async function dbSelect(table, query = {}) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    let q = db.from(table).select("*").range(from, from + PAGE - 1);
    if (query.eq)    Object.entries(query.eq).forEach(([k,v]) => q = q.eq(k, v));
    if (query.order) q = q.order(query.order, { ascending: true });
    const { data, error } = await q;
    if (error) { console.error(table, error); return all; }
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function dbUpsert(table, row) {
  const { error } = await db.from(table).upsert(row, { onConflict: "id" });
  if (error) throw error;
}

async function dbDelete(table, id) {
  const { error } = await db.from(table).delete().eq("id", id);
  if (error) throw error;
}

async function dbDeleteWhere(table, col, val) {
  const { error } = await db.from(table).delete().eq(col, val);
  if (error) throw error;
}

// ===== CARREGAR TUDO =====
async function carregarTudo() {
  setLoading(true);
  try {
    const [participantes, jogos, palpites, resultados, config] = await Promise.all([
      dbSelect("participantes", { order: "nome" }),
      dbSelect("jogos",         { order: "data" }),
      dbSelect("palpites"),
      dbSelect("resultados"),
      dbSelect("config"),
    ]);
    Cache.set("participantes", participantes);
    Cache.set("jogos",         jogos);
    Cache.set("palpites",      palpites);
    Cache.set("resultados",    resultados);
    const cfgValor = config.find(c => c.chave === "valor_bolao")?.valor || "20";
    Cache.set("config", { valor: parseFloat(cfgValor) });
  } finally {
    setLoading(false);
  }
}

// ===== GETTERS (usam cache) =====
const Store = {
  participantes: () => Cache.get("participantes") || [],
  jogos:         () => Cache.get("jogos")         || [],
  palpites:      () => Cache.get("palpites")      || [],
  resultados:    () => Cache.get("resultados")    || [],
};

// ===== PONTUAÇÃO =====
function calcPontos(apostA, apostB, realA, realB) {
  apostA = +apostA; apostB = +apostB; realA = +realA; realB = +realB;
  if (apostA === realA && apostB === realB) return 7;
  if (apostA === realB && apostB === realA) return 1;
  const apostEmpate = apostA === apostB;
  const realEmpate  = realA  === realB;
  if (apostEmpate && realEmpate) return 3;
  const apostVenc = apostA > apostB ? "A" : apostA < apostB ? "B" : "E";
  const realVenc  = realA  > realB  ? "A" : realA  < realB  ? "B" : "E";
  if (apostVenc !== "E" && apostVenc === realVenc) {
    if (apostVenc === "A") {
      if (apostA === realA) return 5;
      if (apostB === realB) return 4;
    } else {
      if (apostB === realB) return 5;
      if (apostA === realA) return 4;
    }
    return 3;
  }
  return 0;
}

// ===== NAVIGATION =====
function navigate(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  document.querySelectorAll(".bnav-item").forEach(b => b.classList.remove("active"));

  const el = document.getElementById("page-" + page);
  if (el) el.classList.add("active");
  document.querySelector(`.nav-link[data-page="${page}"]`)?.classList.add("active");
  document.querySelector(`.bnav-item[data-page="${page}"]`)?.classList.add("active");

  if (page === "ranking")       renderRanking();
  if (page === "jogos")         renderJogos();
  if (page === "palpites")      renderPalpitesPage();
  if (page === "estatisticas")  renderEstatisticas();
  if (page === "premiacao")     renderPremiacao();
  if (page === "admin")         renderAdmin();

  updateHeroStats();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-link").forEach(l =>
  l.addEventListener("click", e => { e.preventDefault(); navigate(l.dataset.page); })
);
document.querySelectorAll(".bnav-item").forEach(b =>
  b.addEventListener("click", () => navigate(b.dataset.page))
);
document.querySelector(".nav-logo")?.addEventListener("click", () => navigate("ranking"));

// ===== HELPERS =====
function fmtData(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  return `${d}/${m}`;
}
function fmtDataLong(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  const meses = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];
  return `${d} ${meses[+m - 1]}`;
}
function jogoLabel(j) {
  return `${fmtData(j.data)} — ${j.time_a} × ${j.time_b}`;
}
function getResultado(jogoId) {
  return Store.resultados().find(r => r.jogo_id === jogoId) || null;
}
function toast(msg, isError = false) {
  document.querySelectorAll(".toast").forEach(t => t.remove());
  const t = document.createElement("div");
  t.className = "toast" + (isError ? " error" : "");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}
function fmtBRL(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
function getValorBolao() {
  return parseFloat(Cache.get("config")?.valor) || 20;
}
function updateHeroStats() {
  const j = document.getElementById("heroJogos");
  const p = document.getElementById("heroParticipantes");
  if (j) j.textContent = Store.jogos().length;
  if (p) p.textContent = Store.participantes().length;
}

// ===== RANKING COMPUTE =====
function computeRanking() {
  const participantes = Store.participantes();
  const palpites      = Store.palpites();
  const resultados    = Store.resultados();
  const jogos         = Store.jogos();

  return participantes.map(p => {
    const meusPalpites = palpites.filter(x => x.participante_id === p.id);
    let totalPts = 0, exatos = 0, vencedores = 0, jogosFeitos = 0;
    const detalhe = [];

    meusPalpites.forEach(pal => {
      const res  = resultados.find(r => r.jogo_id === pal.jogo_id);
      const jogo = jogos.find(j => j.id === pal.jogo_id);
      let pts = null;
      if (res) {
        pts = calcPontos(pal.gols_a, pal.gols_b, res.gols_a, res.gols_b);
        totalPts += pts;
        if (pts === 7) exatos++;
        const apostVenc = +pal.gols_a > +pal.gols_b ? "A" : +pal.gols_a < +pal.gols_b ? "B" : "E";
        const realVenc  = +res.gols_a  > +res.gols_b  ? "A" : +res.gols_a  < +res.gols_b  ? "B" : "E";
        if (apostVenc !== "E" && apostVenc === realVenc) vencedores++;
        jogosFeitos++;
      }
      if (jogo) detalhe.push({ jogo, pal, pts });
    });

    return { ...p, totalPts, exatos, vencedores, jogosFeitos, detalhe };
  }).sort((a, b) => b.totalPts - a.totalPts || b.exatos - a.exatos);
}

// ===== RENDER RANKING =====
function renderRanking() {
  const ranked = computeRanking();
  const tbody  = document.getElementById("rankingBody");
  tbody.innerHTML = "";

  if (!ranked.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Nenhum participante cadastrado</td></tr>';
  } else {
    ranked.forEach((p, i) => {
      const pos  = i + 1;
      const cls  = pos <= 3 ? `rank-${pos}` : "";
      const icon = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `${pos}º`;
      const tr   = document.createElement("tr");
      tr.innerHTML = `
        <td><span class="rank-pos ${cls}">${icon}</span></td>
        <td><span class="rank-name" onclick="openPlayerModal('${p.id}')">${p.nome}</span></td>
        <td><span class="pts-badge">${p.totalPts}</span></td>
        <td>${p.exatos}</td>
        <td>${p.vencedores}</td>
        <td>${p.jogosFeitos}</td>`;
      tbody.appendChild(tr);
    });
  }

  // Pódio
  const top = ranked.slice(0, 3);
  ["p1name","p2name","p3name"].forEach((id, i) => {
    document.getElementById(id).textContent = top[i]?.nome || "—";
    document.getElementById(`p${i+1}pts`).textContent = top[i] ? `${top[i].totalPts} pts` : "0 pts";
  });
  ["podium1","podium2","podium3"].forEach((id, i) => {
    const el = document.getElementById(id);
    el.onclick = top[i] ? () => openPlayerModal(top[i].id) : null;
  });

  // Próximos jogos
  const hoje = new Date().toISOString().slice(0, 10);
  const jogos = Store.jogos();
  const resultados = Store.resultados();
  const proximos = jogos
    .filter(j => j.data >= hoje && !resultados.find(r => r.jogo_id === j.id))
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 5);

  const wrap = document.getElementById("proximosJogos");
  wrap.innerHTML = proximos.length
    ? proximos.map(j => `
        <div class="proximo-item">
          <span class="proximo-times">${j.time_a}<span class="proximo-vs">vs</span>${j.time_b}</span>
          <span class="proximo-date">📅 ${fmtDataLong(j.data)}</span>
        </div>`).join("")
    : '<p style="color:var(--muted);padding:12px 0;font-style:italic;font-size:0.85rem">Nenhum jogo programado</p>';
}

// ===== RENDER JOGOS =====
function renderJogos() {
  const jogos = Store.jogos().sort((a, b) => a.data.localeCompare(b.data));
  const resultados = Store.resultados();

  const sel = document.getElementById("filterDate");
  const datas = [...new Set(jogos.map(j => j.data))].sort();
  const curVal = sel.value;
  sel.innerHTML = '<option value="">Todas as datas</option>' +
    datas.map(d => `<option value="${d}">${fmtDataLong(d)}</option>`).join("");
  sel.value = curVal;

  const filtered = sel.value ? jogos.filter(j => j.data === sel.value) : jogos;
  const tbody = document.getElementById("jogosBody");
  tbody.innerHTML = "";
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Nenhum jogo cadastrado</td></tr>';
    return;
  }
  filtered.forEach(j => {
    const res    = resultados.find(r => r.jogo_id === j.id);
    const status = res
      ? '<span class="badge badge-done">Finalizado</span>'
      : '<span class="badge badge-pending">Aguardando</span>';
    const score  = res
      ? `<span class="resultado-score">${res.gols_a} × ${res.gols_b}</span>`
      : '<span style="color:var(--muted)">—</span>';
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDataLong(j.data)}</td>
      <td style="font-weight:600">${j.time_a}</td>
      <td style="color:var(--muted);text-align:center">×</td>
      <td style="font-weight:600">${j.time_b}</td>
      <td>${score}</td>
      <td>${status}</td>`;
    tbody.appendChild(tr);
  });
}
document.getElementById("filterDate").addEventListener("change", renderJogos);

// ===== RENDER PALPITES PAGE =====
function renderPalpitesPage() {
  const jogos = Store.jogos().sort((a, b) => a.data.localeCompare(b.data));
  const sel = document.getElementById("jogoSelect");
  sel.innerHTML = '<option value="">— Escolha um jogo —</option>' +
    jogos.map(j => `<option value="${j.id}">${fmtData(j.data)} — ${j.time_a} × ${j.time_b}</option>`).join("");
  document.getElementById("palpitesJogoWrap").innerHTML = "";
}
document.getElementById("jogoSelect").addEventListener("change", function () {
  const jogoId = this.value;
  const wrap = document.getElementById("palpitesJogoWrap");
  if (!jogoId) { wrap.innerHTML = ""; return; }

  const jogo         = Store.jogos().find(j => j.id === jogoId);
  const res          = Store.resultados().find(r => r.jogo_id === jogoId);
  const palJogo      = Store.palpites().filter(p => p.jogo_id === jogoId);
  const participantes = Store.participantes();

  const resultLabel = res
    ? `<span class="palpite-resultado-label">🏁 ${res.gols_a} × ${res.gols_b}</span>`
    : '<span class="badge badge-pending">Não finalizado</span>';

  let rows = "";
  participantes.forEach(p => {
    const pal = palJogo.find(x => x.participante_id === p.id);
    if (!pal) {
      rows += `<tr><td>${p.nome}</td><td style="color:var(--muted);font-style:italic">Sem palpite</td>${res ? "<td>—</td>" : ""}</tr>`;
      return;
    }
    const score = `${pal.gols_a} × ${pal.gols_b}`;
    if (res) {
      const pts = calcPontos(pal.gols_a, pal.gols_b, res.gols_a, res.gols_b);
      rows += `<tr>
        <td style="font-weight:600">${p.nome}</td>
        <td style="font-family:var(--font-mono);font-size:1rem">${score}</td>
        <td><span class="pts-color-${pts}">${pts === 7 ? "⭐ " : ""}${pts} pts</span></td></tr>`;
    } else {
      rows += `<tr>
        <td style="font-weight:600">${p.nome}</td>
        <td style="font-family:var(--font-mono);font-size:1rem">${score}</td></tr>`;
    }
  });

  wrap.innerHTML = `
    <div class="card">
      <div class="palpite-jogo-header">
        <span class="palpite-jogo-title">${jogo.time_a} × ${jogo.time_b}</span>
        ${resultLabel}
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Participante</th><th>Palpite</th>${res ? "<th>Pontos</th>" : ""}</tr></thead>
          <tbody>${rows || '<tr><td colspan="3" class="empty-row">Nenhum palpite</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
});

// ===== RENDER ESTATÍSTICAS =====
function renderEstatisticas() {
  const ranked = computeRanking();
  const empty  = '<tr><td colspan="2" class="empty-row">Sem dados</td></tr>';

  document.getElementById("statExatos").innerHTML = ranked.length
    ? [...ranked].sort((a,b) => b.exatos - a.exatos)
        .map((p,i) => `<tr><td>${i===0?"🥇 ":""}${p.nome}</td>
          <td style="font-family:var(--font-mono);font-weight:700;color:var(--accent)">${p.exatos}</td></tr>`).join("")
    : empty;

  document.getElementById("statVencedores").innerHTML = ranked.length
    ? [...ranked].sort((a,b) => b.vencedores - a.vencedores)
        .map((p,i) => `<tr><td>${i===0?"🥇 ":""}${p.nome}</td>
          <td style="font-family:var(--font-mono);font-weight:700;color:var(--green)">${p.vencedores}</td></tr>`).join("")
    : empty;

  // Rodadas
  const jogos      = Store.jogos();
  const palpites   = Store.palpites();
  const resultados = Store.resultados();
  const parts      = Store.participantes();
  const rodadas    = [...new Set(jogos.map(j => j.rodada || "Geral"))];
  const rodadaRows = [];
  rodadas.forEach(rod => {
    const jogosRod = jogos.filter(j => (j.rodada || "Geral") === rod);
    const ptsPorP  = parts.map(p => {
      let total = 0;
      jogosRod.forEach(j => {
        const res = resultados.find(r => r.jogo_id === j.id);
        const pal = palpites.find(x => x.participante_id === p.id && x.jogo_id === j.id);
        if (res && pal) total += calcPontos(pal.gols_a, pal.gols_b, res.gols_a, res.gols_b);
      });
      return { nome: p.nome, total };
    }).sort((a,b) => b.total - a.total);
    if (ptsPorP[0]?.total > 0) rodadaRows.push({ rod, p: ptsPorP[0] });
  });

  document.getElementById("statRodadasBody").innerHTML = rodadaRows.length
    ? rodadaRows.map(r => `<tr><td>${r.rod}</td><td style="font-weight:600">${r.p.nome}</td>
        <td><span class="pts-badge">${r.p.total}</span></td></tr>`).join("")
    : '<tr><td colspan="3" class="empty-row">Sem dados por rodada</td></tr>';

  const maxPts = Math.max(...ranked.map(p => p.totalPts), 1);
  document.getElementById("barChartWrap").innerHTML = ranked.map(p => `
    <div class="bar-item">
      <div class="bar-label">
        <span>${p.nome}</span>
        <span style="font-family:var(--font-mono);color:var(--accent)">${p.totalPts} pts</span>
      </div>
      <div class="bar-track">
        <div class="bar-fill" style="width:${(p.totalPts / maxPts) * 100}%"></div>
      </div>
    </div>`).join("");
}

// ===== PREMIAÇÃO =====
const PREMIOS_PCT = [
  { pos: "1º", pct: 0.50, cls: "premio-pos-1" },
  { pos: "2º", pct: 0.20, cls: "premio-pos-2" },
  { pos: "3º", pct: 0.15, cls: "premio-pos-3" },
  { pos: "4º", pct: 0.10, cls: "premio-pos-4" },
  { pos: "5º", pct: 0.05, cls: "premio-pos-5" },
];

function renderPremiacao() {
  const ranked = computeRanking();
  const nParts = Store.participantes().length;
  const valor  = getValorBolao();
  const total  = nParts * valor;

  document.getElementById("premioTotal").textContent = fmtBRL(total);
  document.getElementById("premioSub").textContent   = `${nParts} participante${nParts!==1?"s":""} × ${fmtBRL(valor)}`;
  document.getElementById("premioCount").textContent  = nParts;

  const grid = document.getElementById("premioGrid");
  if (grid) {
    grid.innerHTML = PREMIOS_PCT.map((p, i) => {
      const vPremio  = total * p.pct;
      const part     = ranked[i];
      const slotCls = i === 0 ? "premio-slot premio-slot-1" : "premio-slot";
      return `
        <div class="${slotCls}">
          <div class="premio-pos ${p.cls}">${p.pos}</div>
          <div class="premio-pct">${(p.pct*100).toFixed(0)}%</div>
          <div class="premio-valor">${fmtBRL(vPremio)}</div>
          <div class="premio-nome ${part?"":"vazio"}">${part?.nome || "—"}</div>
        </div>`;
    }).join("");
  }

  const tbody = document.getElementById("premioRankingBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!ranked.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhum participante</td></tr>';
    return;
  }
  ranked.forEach((p, i) => {
    const slot = PREMIOS_PCT[i];
    const pos  = i + 1;
    const icon = pos===1?"🥇":pos===2?"🥈":pos===3?"🥉":`${pos}º`;
    const tr   = document.createElement("tr");
    tr.className = slot ? `premio-row-${pos}` : "";
    tr.innerHTML = `
      <td><span class="rank-pos ${pos<=3?`rank-${pos}`:""}">${icon}</span></td>
      <td style="font-weight:600">${p.nome}</td>
      <td><span class="pts-badge">${p.totalPts}</span></td>
      <td style="font-family:var(--font-disp);font-size:1.05rem;letter-spacing:1px;color:var(--green)">${slot?fmtBRL(total*slot.pct):"—"}</td>
      <td class="premio-pct-cell">${slot?(slot.pct*100).toFixed(0)+"%":"—"}</td>`;
    tbody.appendChild(tr);
  });
}

// ===== ADMIN LOGIN =====
function adminLogin() {
  const val = document.getElementById("adminPass").value;
  if (val === ADMIN_PASS) {
    document.getElementById("adminLogin").style.display = "none";
    document.getElementById("adminPanel").style.display = "block";
    renderAdmin();
    toast("✅ Acesso liberado!");
  } else {
    document.getElementById("loginMsg").textContent = "Senha incorreta.";
  }
}
document.getElementById("adminPass").addEventListener("keydown", e => {
  if (e.key === "Enter") adminLogin();
});
function adminLogout() {
  document.getElementById("adminLogin").style.display = "flex";
  document.getElementById("adminPanel").style.display = "none";
  document.getElementById("adminPass").value = "";
  navigate("ranking");
}

// ===== ADMIN TABS =====
function showAdminTab(id) {
  document.querySelectorAll(".atab-content").forEach(t => t.classList.remove("active"));
  document.querySelectorAll(".atab").forEach(t => t.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  const idx = ["tabParticipantes","tabJogos","tabPalpites","tabResultados","tabConfig"].indexOf(id);
  if (idx >= 0) document.querySelectorAll(".atab")[idx].classList.add("active");
  if (id === "tabPalpites") renderBulkParticipantPicker();
  if (id === "tabConfig") {
    const el = document.getElementById("configValor");
    if (el) el.value = getValorBolao();
  }
}

// ===== RENDER ADMIN =====
function renderAdmin() {
  renderAdminParticipantes();
  renderAdminJogos();
  renderBulkParticipantPicker();
  renderAdminPalpites();
  renderAdminResultados();
  populateAdminSelects();
}

// ===== PARTICIPANTES =====
async function addParticipante() {
  const nome = document.getElementById("nomeParticipante").value.trim();
  if (!nome) return toast("Informe o nome!", true);
  const fone = document.getElementById("foneParticipante").value.trim();
  const ps   = Store.participantes();
  if (ps.find(p => p.nome.toLowerCase() === nome.toLowerCase())) return toast("Participante já cadastrado!", true);

  const btn = event.currentTarget;
  btn.disabled = true;
  try {
    const row = { id: "p" + Date.now(), nome, fone: fone || "" };
    await dbUpsert("participantes", row);
    await recarregarTabela("participantes");
    document.getElementById("nomeParticipante").value = "";
    document.getElementById("foneParticipante").value = "";
    renderAdminParticipantes();
    renderBulkParticipantPicker();
    updateHeroStats();
    toast("✅ Participante adicionado!");
  } catch(e) {
    toast("Erro ao salvar: " + e.message, true);
  } finally { btn.disabled = false; }
}

async function removeParticipante(id) {
  if (!confirm("Remover participante e todos os seus palpites?")) return;
  try {
    await dbDelete("participantes", id);
    await recarregarTabela("participantes");
    await recarregarTabela("palpites");
    renderAdminParticipantes();
    renderAdminPalpites();
    renderBulkParticipantPicker();
    updateHeroStats();
    toast("Removido.");
  } catch(e) { toast("Erro: " + e.message, true); }
}

async function clearParticipantes() {
  if (!confirm("Limpar TODOS os participantes?")) return;
  try {
    await db.from("palpites").delete().neq("id","__nothing__");
    await db.from("participantes").delete().neq("id","__nothing__");
    await recarregarTabela("participantes");
    await recarregarTabela("palpites");
    renderAdminParticipantes();
    renderAdminPalpites();
    renderBulkParticipantPicker();
    updateHeroStats();
  } catch(e) { toast("Erro: " + e.message, true); }
}

function renderAdminParticipantes() {
  const ps      = [...Store.participantes()].sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const palpites = Store.palpites();
  const tbody   = document.getElementById("participantesBody");
  tbody.innerHTML = "";
  if (!ps.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Nenhum participante</td></tr>';
    return;
  }
  ps.forEach((p, i) => {
    const n  = palpites.filter(x => x.participante_id === p.id).length;
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i+1}</td>
      <td style="font-weight:600">${p.nome} <span style="font-size:0.72rem;color:var(--muted)">(${n} palpite${n!==1?"s":""})</span></td>
      <td style="color:var(--muted)">${p.fone || "—"}</td>
      <td style="display:flex;gap:6px">
        <button class="btn-edit" onclick="abrirEdicao('${p.id}')">✏️</button>
        <button class="btn-icon" onclick="removeParticipante('${p.id}')">🗑</button>
      </td>`;
    tbody.appendChild(tr);
  });
}

// ===== EDIT PARTICIPANT =====
function abrirEdicao(id) {
  const p = Store.participantes().find(x => x.id === id);
  if (!p) return;
  document.getElementById("editParticipanteId").value = id;
  document.getElementById("editNome").value = p.nome;
  document.getElementById("editFone").value = p.fone || "";
  document.getElementById("editModalOverlay").classList.add("open");
}
function closeEditModal() {
  document.getElementById("editModalOverlay").classList.remove("open");
}
async function salvarEdicaoParticipante() {
  const id   = document.getElementById("editParticipanteId").value;
  const nome = document.getElementById("editNome").value.trim();
  const fone = document.getElementById("editFone").value.trim();
  if (!nome) return toast("Nome não pode ser vazio!", true);
  try {
    await db.from("participantes").update({ nome, fone }).eq("id", id);
    await recarregarTabela("participantes");
    closeEditModal();
    renderAdminParticipantes();
    renderBulkParticipantPicker();
    toast("✅ Nome atualizado!");
  } catch(e) { toast("Erro: " + e.message, true); }
}

// ===== JOGOS ADMIN =====
async function addJogo() {
  const data   = document.getElementById("jogoData").value;
  const time_a = document.getElementById("jogoTimeA").value.trim();
  const time_b = document.getElementById("jogoTimeB").value.trim();
  const rodada = document.getElementById("jogoRodada").value.trim() || "Fase de Grupos";
  if (!data || !time_a || !time_b) return toast("Preencha data e times!", true);
  try {
    await dbUpsert("jogos", { id: "j" + Date.now(), data, time_a, time_b, rodada });
    await recarregarTabela("jogos");
    document.getElementById("jogoData").value = "";
    document.getElementById("jogoTimeA").value = "";
    document.getElementById("jogoTimeB").value = "";
    renderAdminJogos();
    populateAdminSelects();
    updateHeroStats();
    toast("✅ Jogo adicionado!");
  } catch(e) { toast("Erro: " + e.message, true); }
}

async function removeJogo(id) {
  if (!confirm("Remover jogo?")) return;
  try {
    await dbDelete("jogos", id);
    await recarregarTabela("jogos");
    await recarregarTabela("palpites");
    await recarregarTabela("resultados");
    renderAdminJogos();
    renderAdminPalpites();
    renderAdminResultados();
    populateAdminSelects();
    updateHeroStats();
  } catch(e) { toast("Erro: " + e.message, true); }
}

async function clearJogos() {
  if (!confirm("Limpar TODOS os jogos?")) return;
  try {
    await db.from("resultados").delete().neq("id","__nothing__");
    await db.from("palpites").delete().neq("id","__nothing__");
    await db.from("jogos").delete().neq("id","__nothing__");
    await recarregarTabela("jogos");
    await recarregarTabela("palpites");
    await recarregarTabela("resultados");
    renderAdminJogos();
    renderAdminPalpites();
    renderAdminResultados();
    populateAdminSelects();
    updateHeroStats();
  } catch(e) { toast("Erro: " + e.message, true); }
}


function renderAdminJogos() {
  const js    = Store.jogos().sort((a,b) => a.data.localeCompare(b.data));
  const tbody = document.getElementById("adminJogosBody");
  tbody.innerHTML = "";
  if (!js.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Nenhum jogo</td></tr>';
    return;
  }
  js.forEach(j => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDataLong(j.data)}</td>
      <td style="font-weight:600">${j.time_a}</td>
      <td style="color:var(--muted);text-align:center">×</td>
      <td style="font-weight:600">${j.time_b}</td>
      <td style="color:var(--muted);font-size:0.8rem">${j.rodada||"—"}</td>
      <td><button class="btn-icon" onclick="removeJogo('${j.id}')">🗑</button></td>`;
    tbody.appendChild(tr);
  });
}

// ===== BULK PALPITES =====
let bulkParticipanteAtivo = null;

function renderBulkParticipantPicker() {
  const parts   = Store.participantes();
  const palpites = Store.palpites();
  const picker  = document.getElementById("bulkParticipantPicker");
  if (!picker) return;
  if (!parts.length) {
    picker.innerHTML = '<p class="bulk-p-empty">Nenhum participante. Cadastre na aba Participantes.</p>';
    return;
  }
  parts.sort((a,b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  picker.innerHTML = parts.map(p => {
    const n      = palpites.filter(x => x.participante_id === p.id).length;
    const active = bulkParticipanteAtivo === p.id ? " active" : "";
    return `<button class="bulk-p-btn${active}" onclick="selecionarBulkParticipante('${p.id}')">
      <span>${p.nome}</span>
      ${n > 0 ? `<span class="bulk-p-count">${n}</span>` : ""}
    </button>`;
  }).join("");
}

function selecionarBulkParticipante(pid) {
  bulkParticipanteAtivo = pid;
  renderBulkParticipantPicker();
  renderBulkPalpitesTable(pid);
  const p = Store.participantes().find(x => x.id === pid);
  document.getElementById("bulkNomeLabel").textContent = p?.nome || "—";
  document.getElementById("bulkPalpitesWrap").style.display = "block";
  setTimeout(() => document.getElementById("bulkPalpitesWrap").scrollIntoView({ behavior:"smooth", block:"start" }), 50);
}

function renderBulkPalpitesTable(pid) {
  const jogos    = Store.jogos().sort((a,b) => a.data.localeCompare(b.data));
  const palpites = Store.palpites();
  const tbody    = document.getElementById("bulkPalpitesBody");
  tbody.innerHTML = "";
  if (!jogos.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Nenhum jogo cadastrado</td></tr>';
    return;
  }
  jogos.forEach(j => {
    const pal   = palpites.find(x => x.participante_id === pid && x.jogo_id === j.id);
    const saved = !!pal;
    const tr    = document.createElement("tr");
    tr.id = `bulk-row-${j.id}`;
    tr.innerHTML = `
      <td class="bulk-jogo-data">${fmtDataLong(j.data)}</td>
      <td class="bulk-jogo-name">${j.time_a} <span style="color:var(--muted);font-size:0.75rem">×</span> ${j.time_b}</td>
      <td style="text-align:center">
        <input class="bulk-gols-input" type="number" id="ba-${j.id}" value="${pal?pal.gols_a:""}" min="0" max="20" placeholder="—"
          onkeydown="bulkTabNext(event,'${j.id}','A')" />
      </td>
      <td class="bulk-vs-cell">×</td>
      <td style="text-align:center">
        <input class="bulk-gols-input" type="number" id="bb-${j.id}" value="${pal?pal.gols_b:""}" min="0" max="20" placeholder="—"
          onkeydown="bulkTabNext(event,'${j.id}','B')" />
      </td>
      <td style="text-align:center">
        <span class="bulk-saved-dot ${saved?"saved":""}" id="dot-${j.id}"></span>
      </td>`;
    tbody.appendChild(tr);
  });
}

function bulkTabNext(e, jogoId, side) {
  if (e.key === "Enter" || e.key === "Tab") {
    e.preventDefault();
    const jogos = Store.jogos().sort((a,b) => a.data.localeCompare(b.data));
    const idx   = jogos.findIndex(j => j.id === jogoId);
    const nextId = side === "A" ? `bb-${jogoId}` : (jogos[idx+1] ? `ba-${jogos[idx+1].id}` : null);
    if (nextId) document.getElementById(nextId)?.focus();
  }
}

async function salvarTodosPalpites() {
  if (!bulkParticipanteAtivo) return toast("Selecione um participante!", true);
  const jogos  = Store.jogos();
  const rows   = [];
  jogos.forEach(j => {
    const vA = document.getElementById(`ba-${j.id}`)?.value.trim();
    const vB = document.getElementById(`bb-${j.id}`)?.value.trim();
    if (vA === "" || vB === "") return;
    rows.push({ id: "pal" + Date.now() + Math.random().toString(36).slice(2), participante_id: bulkParticipanteAtivo, jogo_id: j.id, gols_a: +vA, gols_b: +vB });
  });
  if (!rows.length) return toast("Nenhum palpite preenchido!", true);

  const btn = document.querySelector("#bulkPalpitesWrap .btn-primary");
  if (btn) btn.disabled = true;
  try {
    // upsert with conflict on (participante_id, jogo_id)
    const { error } = await db.from("palpites").upsert(rows, { onConflict: "participante_id,jogo_id" });
    if (error) throw error;
    await recarregarTabela("palpites");
    rows.forEach(r => {
      const dot = document.getElementById(`dot-${r.jogo_id}`);
      if (dot) dot.className = "bulk-saved-dot saved";
    });
    renderAdminPalpites();
    renderBulkParticipantPicker();
    renderAdminParticipantes();
    toast(`✅ ${rows.length} palpites salvos!`);
  } catch(e) {
    toast("Erro ao salvar: " + e.message, true);
  } finally { if (btn) btn.disabled = false; }
}

function limparBulkForm() {
  bulkParticipanteAtivo = null;
  document.getElementById("bulkPalpitesWrap").style.display = "none";
  renderBulkParticipantPicker();
}

async function removePalpite(id) {
  try {
    await dbDelete("palpites", id);
    await recarregarTabela("palpites");
    renderAdminPalpites();
    if (bulkParticipanteAtivo) renderBulkPalpitesTable(bulkParticipanteAtivo);
    renderBulkParticipantPicker();
  } catch(e) { toast("Erro: " + e.message, true); }
}

async function clearPalpites() {
  if (!confirm("Limpar TODOS os palpites?")) return;
  try {
    await db.from("palpites").delete().neq("id","__nothing__");
    await recarregarTabela("palpites");
    renderAdminPalpites();
    renderBulkParticipantPicker();
    if (bulkParticipanteAtivo) renderBulkPalpitesTable(bulkParticipanteAtivo);
  } catch(e) { toast("Erro: " + e.message, true); }
}

function renderAdminPalpites() {
  const palpites  = Store.palpites();
  const jogos     = Store.jogos();
  const parts     = Store.participantes();
  const resultados = Store.resultados();
  const tbody = document.getElementById("adminPalpitesBody");
  tbody.innerHTML = "";
  if (!palpites.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhum palpite</td></tr>';
    return;
  }
  const sorted = [...palpites].sort((a,b) => {
    const pa = parts.find(x=>x.id===a.participante_id)?.nome || "";
    const pb = parts.find(x=>x.id===b.participante_id)?.nome || "";
    const cmp = pa.localeCompare(pb, 'pt-BR');
    if (cmp !== 0) return cmp;
    // dentro do mesmo participante, ordena por jogo
    const ja = jogos.find(x=>x.id===a.jogo_id)?.data || "";
    const jb = jogos.find(x=>x.id===b.jogo_id)?.data || "";
    return ja.localeCompare(jb);
  });
  sorted.forEach(pal => {
    const p   = parts.find(x => x.id === pal.participante_id);
    const j   = jogos.find(x => x.id === pal.jogo_id);
    const res = resultados.find(r => r.jogo_id === pal.jogo_id);
    const pts = res ? calcPontos(pal.gols_a, pal.gols_b, res.gols_a, res.gols_b) : "—";
    const ptsCls = typeof pts === "number" ? `pts-color-${pts}` : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:600">${p?.nome||"?"}</td>
      <td style="font-size:0.82rem;color:var(--muted)">${j?jogoLabel(j):"?"}</td>
      <td style="font-family:var(--font-mono)">${pal.gols_a} × ${pal.gols_b}</td>
      <td><span class="${ptsCls}">${pts}</span></td>
      <td><button class="btn-icon" onclick="removePalpite('${pal.id}')">🗑</button></td>`;
    tbody.appendChild(tr);
  });
}

// ===== RESULTADOS =====
async function addResultado() {
  const jid   = document.getElementById("resultadoJogo").value;
  const golsA = document.getElementById("resultadoGolsA").value;
  const golsB = document.getElementById("resultadoGolsB").value;
  if (!jid || golsA === "" || golsB === "") return toast("Preencha todos os campos!", true);
  try {
    const { error } = await db.from("resultados")
      .upsert({ id: "r" + Date.now(), jogo_id: jid, gols_a: +golsA, gols_b: +golsB }, { onConflict: "jogo_id" });
    if (error) throw error;
    await recarregarTabela("resultados");
    document.getElementById("resultadoGolsA").value = "";
    document.getElementById("resultadoGolsB").value = "";
    renderAdminResultados();
    renderAdminPalpites();
    toast("🏁 Resultado salvo! Ranking recalculado.");
  } catch(e) { toast("Erro: " + e.message, true); }
}

async function removeResultado(jogoId) {
  try {
    await db.from("resultados").delete().eq("jogo_id", jogoId);
    await recarregarTabela("resultados");
    renderAdminResultados();
    renderAdminPalpites();
  } catch(e) { toast("Erro: " + e.message, true); }
}

function renderAdminResultados() {
  const rs    = Store.resultados();
  const js    = Store.jogos();
  const tbody = document.getElementById("adminResultadosBody");
  tbody.innerHTML = "";
  if (!rs.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Nenhum resultado</td></tr>';
    return;
  }
  rs.forEach(r => {
    const j  = js.find(x => x.id === r.jogo_id);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-size:0.85rem">${j?jogoLabel(j):"?"}</td>
      <td><span class="resultado-score">${r.gols_a} × ${r.gols_b}</span></td>
      <td><span class="badge badge-done">✅ Finalizado</span></td>
      <td><button class="btn-icon" onclick="removeResultado('${r.jogo_id}')">🗑</button></td>`;
    tbody.appendChild(tr);
  });
}

// ===== CONFIG =====
async function salvarConfig() {
  const v = parseFloat(document.getElementById("configValor").value);
  if (!v || v <= 0) return toast("Valor inválido!", true);
  try {
    await db.from("config").upsert({ chave: "valor_bolao", valor: String(v) }, { onConflict: "chave" });
    Cache.set("config", { valor: v });
    toast(`✅ Valor salvo: ${fmtBRL(v)}`);
  } catch(e) { toast("Erro: " + e.message, true); }
}

// ===== SELECTS =====
function populateAdminSelects() {
  const jogos = Store.jogos().sort((a,b) => a.data.localeCompare(b.data));
  const resJogo = document.getElementById("resultadoJogo");
  if (resJogo) {
    resJogo.innerHTML = '<option value="">Selecione o Jogo</option>' +
      jogos.map(j => `<option value="${j.id}">${jogoLabel(j)}</option>`).join("");
  }
  const jogoSel = document.getElementById("jogoSelect");
  if (jogoSel) {
    jogoSel.innerHTML = '<option value="">— Escolha um jogo —</option>' +
      jogos.map(j => `<option value="${j.id}">${fmtData(j.data)} — ${j.time_a} × ${j.time_b}</option>`).join("");
  }
}

// ===== HELPER: reload one table into cache =====
async function recarregarTabela(tabela) {
  const data = await dbSelect(tabela, tabela === "jogos" ? { order: "data" } : {});
  Cache.set(tabela, data);
}

// ===== MODAL: Player Detail =====
function openPlayerModal(pid) {
  const ranked = computeRanking();
  const player = ranked.find(p => p.id === pid);
  if (!player) return;
  const pos    = ranked.indexOf(player) + 1;
  const icon   = pos===1?"🥇":pos===2?"🥈":pos===3?"🥉":`${pos}º`;
  const resultados = Store.resultados();

  const rows = player.detalhe
    .filter(d => d.pts !== null)
    .sort((a,b) => b.pts - a.pts)
    .map(d => {
      const res = resultados.find(r => r.jogo_id === d.jogo.id);
      return `<tr>
        <td style="font-size:0.83rem">${d.jogo.time_a} × ${d.jogo.time_b}</td>
        <td style="font-family:var(--font-mono)">${d.pal.gols_a} × ${d.pal.gols_b}</td>
        <td style="font-family:var(--font-mono)">${res?`${res.gols_a} × ${res.gols_b}`:"—"}</td>
        <td><span class="pts-color-${d.pts}">${d.pts} pts</span></td>
      </tr>`;
    }).join("") || '<tr><td colspan="4" class="empty-row">Sem jogos avaliados</td></tr>';

  document.getElementById("modalContent").innerHTML = `
    <div class="modal-player-header">
      <div class="modal-player-name">${icon} ${player.nome}</div>
      <div class="modal-stats-row">
        <div class="modal-stat">
          <div class="modal-stat-val">${player.totalPts}</div>
          <div class="modal-stat-lbl">Pontos</div>
        </div>
        <div class="modal-stat">
          <div class="modal-stat-val" style="color:var(--accent2)">${player.exatos}</div>
          <div class="modal-stat-lbl">Exatos</div>
        </div>
        <div class="modal-stat">
          <div class="modal-stat-val" style="color:var(--green)">${player.vencedores}</div>
          <div class="modal-stat-lbl">Vencedores</div>
        </div>
        <div class="modal-stat">
          <div class="modal-stat-val" style="color:var(--muted)">${player.jogosFeitos}</div>
          <div class="modal-stat-lbl">Jogos</div>
        </div>
      </div>
    </div>
    <div class="modal-body">
      <p style="font-weight:700;margin-bottom:12px;color:var(--muted);font-size:0.8rem;text-transform:uppercase;letter-spacing:1px">Histórico de Palpites</p>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Jogo</th><th>Palpite</th><th>Resultado</th><th>Pts</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
  document.getElementById("modalOverlay").classList.add("open");
}
function closeModal() { document.getElementById("modalOverlay").classList.remove("open"); }
function closeEditModal() { document.getElementById("editModalOverlay").classList.remove("open"); }
document.addEventListener("keydown", e => { if (e.key==="Escape") { closeModal(); closeEditModal(); } });

// nav logo
document.querySelector(".nav-logo")?.addEventListener("click", () => navigate("ranking"));

// ===== LOADING OVERLAY =====
function showSplash(msg) {
  let el = document.getElementById("splash");
  if (!el) {
    el = document.createElement("div");
    el.id = "splash";
    el.style.cssText = "position:fixed;inset:0;background:var(--bg);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999;gap:16px";
    el.innerHTML = `<div style="font-family:var(--font-disp);font-size:2rem;letter-spacing:4px;color:var(--accent)">BOLÃO COPA 2026</div>
      <div id="splashMsg" style="font-family:var(--font-mono);font-size:0.8rem;color:var(--muted);letter-spacing:2px">${msg}</div>
      <div class="splash-spinner"></div>`;
    document.body.appendChild(el);
  } else {
    document.getElementById("splashMsg").textContent = msg;
  }
}
function hideSplash() {
  const el = document.getElementById("splash");
  if (el) { el.style.opacity = "0"; el.style.transition = "opacity 0.4s"; setTimeout(() => el.remove(), 400); }
}

// ===== LIVE SCORES — football-data.org via Supabase Proxy =====
const LiveSync = (() => {
  const PROXY_URL = "https://ppsvevnflfsricjjleba.supabase.co/functions/v1/live-scores";
  const PROXY_KEY = SUPABASE_KEY;
  const INTERVAL  = 30000;

  let _timer      = null;
  let _running    = false;
  let _lastSync   = null;
  let _liveBadge  = null;

  const TEAM_MAP = {
    "Mexico":"México","South Africa":"África do Sul","Korea Republic":"Coreia do Sul",
    "Czechia":"República Tcheca","Czech Republic":"República Tcheca","Canada":"Canadá",
    "Bosnia and Herzegovina":"Bósnia","United States":"Estados Unidos","Paraguay":"Paraguai",
    "Qatar":"Catar","Switzerland":"Suíça","Brazil":"Brasil","Morocco":"Marrocos",
    "Germany":"Alemanha","Curaçao":"Curaçao","Netherlands":"Holanda","Japan":"Japão",
    "Côte d'Ivoire":"Costa do Marfim","Ivory Coast":"Costa do Marfim","Ecuador":"Equador",
    "Spain":"Espanha","Cape Verde":"Cabo Verde","Belgium":"Bélgica","Egypt":"Egito",
    "Saudi Arabia":"Arábia Saudita","Uruguay":"Uruguai","France":"França","Senegal":"Senegal",
    "Argentina":"Argentina","Algeria":"Argélia","Portugal":"Portugal",
    "Congo, DR":"RD Congo","DR Congo":"RD Congo","England":"Inglaterra","Croatia":"Croácia",
    "Sweden":"Suécia","Tunisia":"Tunísia","Austria":"Áustria","Iraq":"Iraque",
    "Norway":"Noruega","Uzbekistan":"Uzbequistão","Ghana":"Gana","Colombia":"Colômbia",
    "Scotland":"Escócia","Türkiye":"Turquia","Turkey":"Turquia",
  };

  function normalizar(nome) {
    return (TEAM_MAP[nome] || nome).toLowerCase().trim();
  }

  function matchJogo(homeTeam, awayTeam, jogos) {
    const ta = normalizar(homeTeam);
    const tb = normalizar(awayTeam);
    return jogos.find(j => {
      const ja = normalizar(j.time_a);
      const jb = normalizar(j.time_b);
      return (ja === ta && jb === tb) || (ja === tb && jb === ta);
    });
  }

  function goalsOrdenados(homeTeam, jogo, scoreHome, scoreAway) {
    if (normalizar(homeTeam) === normalizar(jogo.time_a)) {
      return { ga: scoreHome, gb: scoreAway };
    }
    return { ga: scoreAway, gb: scoreHome };
  }

  async function proxyFetch(endpoint) {
    const url = `${PROXY_URL}?endpoint=${encodeURIComponent(endpoint)}`;
    const res = await fetch(url, {
      headers: { "Authorization": `Bearer ${PROXY_KEY}` }
    });
    if (!res.ok) throw new Error(`Proxy error ${res.status}`);
    return res.json();
  }

  async function sincronizar() {
    if (_running) return;
    _running = true;
    setBtnSyncLoading(true);
    atualizarPainel({ status: "sync", fixtures: 0 });
    try {
      const jogos      = Store.jogos();
      const resultados = Store.resultados();

      const liveData = await proxyFetch("/competitions/WC/matches?status=IN_PLAY,PAUSED,FINISHED");
      const allFix   = liveData?.matches || [];

      const hoje = new Date().toISOString().slice(0, 10);
      const fixHoje = allFix.filter(f => f.utcDate?.slice(0, 10) === hoje);

      if (!fixHoje.length) {
        _lastSync = new Date();
        atualizarPainel({ status: "ok", atualizados: 0, fixtures: 0 });
        atualizarBadge(false);
        _running = false;
        setBtnSyncLoading(false);
        return;
      }

      let atualizados = 0;
      let temAoVivo   = false;

      for (const fix of fixHoje) {
        const status     = fix.status;
        const aoVivo     = ["IN_PLAY","PAUSED"].includes(status);
        const finalizado = status === "FINISHED";
        if (!aoVivo && !finalizado) continue;
        if (aoVivo) temAoVivo = true;

        const homeTeam = fix.homeTeam?.name;
        const awayTeam = fix.awayTeam?.name;
        if (!homeTeam || !awayTeam) continue;

        const jogo = matchJogo(homeTeam, awayTeam, jogos);
        if (!jogo) continue;

        const scoreHome = fix.score?.fullTime?.home ?? fix.score?.halfTime?.home;
        const scoreAway = fix.score?.fullTime?.away ?? fix.score?.halfTime?.away;
        if (scoreHome === null || scoreHome === undefined) continue;

        const { ga, gb } = goalsOrdenados(homeTeam, jogo, scoreHome, scoreAway);

        const jaExiste = resultados.find(r => r.jogo_id === jogo.id);
        if (jaExiste && jaExiste.gols_a === ga && jaExiste.gols_b === gb && finalizado) continue;

        const row = {
          id:      `res_${jogo.id}`,
          jogo_id: jogo.id,
          gols_a:  ga,
          gols_b:  gb,
          ao_vivo: aoVivo,
        };
        await db.from("resultados").upsert(row, { onConflict: "jogo_id" });
        atualizados++;
      }

      if (atualizados > 0) {
        await recarregarTabela("resultados");
        const paginaAtual = document.querySelector(".nav-item.active")?.dataset?.page;
        if (paginaAtual === "ranking") renderRanking();
        renderAdminResultados();
        renderAdminPalpites();
      }

      _lastSync = new Date();
      atualizarPainel({ status: temAoVivo ? "live" : "ok", atualizados, fixtures: fixHoje.length });
      atualizarBadge(temAoVivo);

    } catch (e) {
      console.warn("[LiveSync] Erro:", e.message);
      atualizarPainel({ status: "erro", erro: e.message });
      atualizarBadge(false);
    }
    _running = false;
    setBtnSyncLoading(false);
  }

  function setBtnSyncLoading(on) {
    const btn = document.getElementById("btnSyncAgora");
    if (!btn) return;
    btn.disabled = on;
    btn.textContent = on ? "⏳ Sincronizando..." : "🔄 Sincronizar Agora";
  }

  function atualizarPainel({ status, atualizados = 0, fixtures = 0, erro = "" }) {
    const el = document.getElementById("liveSyncStatus");
    if (!el) return;
    const hora = new Date().toLocaleTimeString("pt-BR");
    const autoAtivo = !!_timer;
    const cores = {
      live:  { bg:"rgba(231,76,60,.12)", borda:"#e74c3c" },
      ok:    { bg:"rgba(39,174,96,.1)",  borda:"var(--green)" },
      erro:  { bg:"rgba(231,76,60,.08)", borda:"#e74c3c55" },
      sync:  { bg:"rgba(52,152,219,.1)", borda:"#3498db" },
    }[status] || {};
    const msgs = {
      live: `🔴 <strong>JOGO AO VIVO!</strong> ${atualizados > 0 ? `${atualizados} resultado(s) atualizado(s).` : "Acompanhando placar..."}`,
      ok:   `${atualizados > 0 ? `✅ ${atualizados} resultado(s) atualizado(s).` : "✅ Nenhum jogo ao vivo no momento."} Última sync: <strong>${hora}</strong>`,
      erro: `❌ Erro: <em>${erro}</em>`,
      sync: `⏳ Sincronizando com a API...`,
    }[status] || "";
    el.style.cssText = `margin-top:12px;padding:12px 16px;border-radius:10px;border:1px solid ${cores.borda};background:${cores.bg};font-size:0.85rem;color:var(--fg);transition:all .3s`;
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
        <div>${msgs}</div>
        <div style="display:flex;gap:16px;font-family:var(--font-mono);font-size:0.78rem;color:var(--muted)">
          <span>Jogos: <strong style="color:var(--fg)">${fixtures}</strong></span>
          <span>Auto-Sync: <strong style="color:${autoAtivo?"var(--green)":"#e74c3c"}">${autoAtivo?"▶ LIGADO":"⏸ PAUSADO"}</strong></span>
        </div>
      </div>`;
  }

  function atualizarBotoes() {
    const btnLigar  = document.getElementById("btnSyncLigar");
    const btnPausar = document.getElementById("btnSyncPausar");
    if (!btnLigar || !btnPausar) return;
    const ativo = !!_timer;
    btnLigar.style.opacity   = ativo ? "0.4" : "1";
    btnLigar.style.cursor    = ativo ? "default" : "pointer";
    btnLigar.innerHTML       = ativo ? "▶ Auto-Sync LIGADO" : "▶ Ligar Auto-Sync";
    btnPausar.style.opacity  = ativo ? "1" : "0.4";
    btnPausar.style.cursor   = ativo ? "pointer" : "default";
    btnPausar.innerHTML      = ativo ? "⏸ Pausar Auto-Sync" : "⏸ Auto-Sync PAUSADO";
    btnLigar.style.borderColor  = ativo ? "var(--green)" : "";
    btnPausar.style.borderColor = !ativo ? "#e74c3c" : "";
  }

  function atualizarBadge(aoVivo) {
    if (!_liveBadge) {
      _liveBadge = document.createElement("div");
      _liveBadge.id = "liveBadge";
      _liveBadge.style.cssText = `position:fixed;top:10px;right:10px;z-index:9999;display:flex;align-items:center;gap:6px;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:4px 10px;font-family:var(--font-mono);font-size:0.68rem;color:var(--muted);box-shadow:0 2px 8px rgba(0,0,0,.4);transition:all .3s;cursor:pointer;`;
      _liveBadge.title = "Clique para ir à aba Resultados";
      _liveBadge.onclick = () => { navigate("admin"); setTimeout(() => showAdminTab("tabResultados"), 100); };
      document.body.appendChild(_liveBadge);
    }
    const hora = _lastSync ? _lastSync.toLocaleTimeString("pt-BR") : "--:--:--";
    if (aoVivo) {
      _liveBadge.style.borderColor = "#e74c3c";
      _liveBadge.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:#e74c3c;animation:livePulse 1s infinite"></span> 🔴 AO VIVO · ${hora}`;
    } else {
      _liveBadge.style.borderColor = "var(--border)";
      _liveBadge.innerHTML = `<span style="width:8px;height:8px;border-radius:50%;background:var(--green)"></span> ⚽ Sync ${hora}`;
    }
  }

  function start() {
    if (_timer) return;
    sincronizar();
    _timer = setInterval(sincronizar, INTERVAL);
    atualizarBotoes();
    toast("▶ Auto-Sync ligado — verificando a cada 30s");
  }

  function stop() {
    if (_timer) { clearInterval(_timer); _timer = null; }
    atualizarBotoes();
    atualizarPainel({ status: "erro", erro: "Auto-Sync pausado manualmente.", fixtures: 0 });
    toast("⏸ Auto-Sync pausado");
  }

  return { start, stop, sincronizar };
})();

// ===== CSS animação badge =====
(function injectLiveCSS() {
  const s = document.createElement("style");
  s.textContent = `@keyframes livePulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(1.4)}}`;
  document.head.appendChild(s);
})();

// ===== INIT =====
(async () => {
  showSplash("Conectando ao banco de dados...");
  try {
    await carregarTudo();
    hideSplash();
    navigate("ranking");
    LiveSync.start();
  } catch(e) {
    document.getElementById("splashMsg").textContent = "Erro ao conectar. Verifique as credenciais do Supabase.";
    console.error(e);
  }
})();
