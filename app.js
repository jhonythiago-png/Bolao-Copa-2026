// ===================================================
// BOLÃO COPA 2026 — App Principal
// Desenvolvido por Jhony Beraldo
// ===================================================

const ADMIN_PASS = "bolao2026";  // Troque aqui a senha do admin

// ===== STORAGE HELPERS =====
const Store = {
  get: (k, def = []) => {
    try { return JSON.parse(localStorage.getItem("bolao2026_" + k)) ?? def; }
    catch { return def; }
  },
  set: (k, v) => localStorage.setItem("bolao2026_" + k, JSON.stringify(v)),
  participantes: () => Store.get("participantes"),
  jogos:         () => Store.get("jogos"),
  palpites:      () => Store.get("palpites"),
  resultados:    () => Store.get("resultados"),
};

// ===== PONTUAÇÃO =====
function calcPontos(apostA, apostB, realA, realB) {
  apostA = +apostA; apostB = +apostB; realA = +realA; realB = +realB;
  // 1. Placar exato
  if (apostA === realA && apostB === realB) return 7;
  // 2. Placar invertido exato
  if (apostA === realB && apostB === realA) return 1;
  // 3. Empate
  const apostEmpate = apostA === apostB;
  const realEmpate  = realA === realB;
  if (apostEmpate && realEmpate) return 3; // já passamos o exato
  // 4. Acertou vencedor
  const apostVenc = apostA > apostB ? "A" : apostA < apostB ? "B" : "E";
  const realVenc  = realA  > realB  ? "A" : realA  < realB  ? "B" : "E";
  if (apostVenc !== "E" && apostVenc === realVenc) {
    if (apostVenc === "A") {
      if (apostA === realA) return 5; // vencedor + gols do vencedor
      if (apostB === realB) return 4; // vencedor + gols do perdedor
    } else {
      if (apostB === realB) return 5;
      if (apostA === realA) return 4;
    }
    return 3; // só vencedor
  }
  return 0;
}

// ===== HERO STATS =====
function updateHeroStats() {
  const jogos = Store.jogos();
  const parts = Store.participantes();
  const heroJ = document.getElementById("heroJogos");
  const heroP = document.getElementById("heroParticipantes");
  if (heroJ) heroJ.textContent = jogos.length;
  if (heroP) heroP.textContent = parts.length;
}

// ===== NAVIGATION =====
function navigate(page) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-link").forEach(l => l.classList.remove("active"));
  document.querySelectorAll(".bnav-item").forEach(b => b.classList.remove("active"));

  const el = document.getElementById("page-" + page);
  if (el) el.classList.add("active");

  const topLink = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (topLink) topLink.classList.add("active");

  const botBtn = document.querySelector(`.bnav-item[data-page="${page}"]`);
  if (botBtn) botBtn.classList.add("active");

  // render
  if (page === "ranking")       renderRanking();
  if (page === "jogos")         renderJogos();
  if (page === "palpites")      renderPalpitesPage();
  if (page === "estatisticas")  renderEstatisticas();
  if (page === "premiacao")     renderPremiacao();
  if (page === "regras")        {} // static, no render needed
  if (page === "admin")         renderAdmin();

  updateHeroStats();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-link").forEach(l => {
  l.addEventListener("click", e => { e.preventDefault(); navigate(l.dataset.page); });
});
document.querySelectorAll(".bnav-item").forEach(b => {
  b.addEventListener("click", () => navigate(b.dataset.page));
});

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
  return `${fmtData(j.data)} — ${j.timeA} x ${j.timeB}`;
}
function getResultado(jogoId) {
  return Store.resultados().find(r => r.jogoId === jogoId) || null;
}
function toast(msg, isError = false) {
  const t = document.createElement("div");
  t.className = "toast" + (isError ? " error" : "");
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

// ===== RANKING COMPUTE =====
function computeRanking() {
  const participantes = Store.participantes();
  const palpites      = Store.palpites();
  const resultados    = Store.resultados();
  const jogos         = Store.jogos();

  return participantes.map(p => {
    const meusPalpites = palpites.filter(x => x.participanteId === p.id);
    let totalPts = 0, exatos = 0, vencedores = 0, jogosFeitos = 0;
    const detalhe = [];

    meusPalpites.forEach(pal => {
      const res = resultados.find(r => r.jogoId === pal.jogoId);
      const jogo = jogos.find(j => j.id === pal.jogoId);
      let pts = null;
      if (res) {
        pts = calcPontos(pal.golsA, pal.golsB, res.golsA, res.golsB);
        totalPts += pts;
        if (pts === 7) exatos++;
        const apostVenc = +pal.golsA > +pal.golsB ? "A" : +pal.golsA < +pal.golsB ? "B" : "E";
        const realVenc  = +res.golsA  > +res.golsB  ? "A" : +res.golsA  < +res.golsB  ? "B" : "E";
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
  const tbody = document.getElementById("rankingBody");
  tbody.innerHTML = "";

  if (!ranked.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Nenhum participante cadastrado</td></tr>';
  } else {
    ranked.forEach((p, i) => {
      const pos  = i + 1;
      const cls  = pos <= 3 ? `rank-${pos}` : "";
      const icon = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `${pos}º`;
      const tr = document.createElement("tr");
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

  // Podium
  const top = ranked.slice(0, 3);
  ["p1name","p2name","p3name"].forEach((id, i) => {
    document.getElementById(id).textContent = top[i]?.nome || "—";
    document.getElementById(`p${i+1}pts`).textContent = top[i] ? `${top[i].totalPts} pts` : "0 pts";
  });
  // click on podium
  ["podium1","podium2","podium3"].forEach((id, i) => {
    const el = document.getElementById(id);
    el.onclick = top[i] ? () => openPlayerModal(top[i].id) : null;
  });

  // Próximos jogos
  const hoje = new Date().toISOString().slice(0, 10);
  const jogos = Store.jogos();
  const resultados = Store.resultados();
  const proximos = jogos
    .filter(j => j.data >= hoje && !resultados.find(r => r.jogoId === j.id))
    .sort((a, b) => a.data.localeCompare(b.data))
    .slice(0, 5);

  const wrap = document.getElementById("proximosJogos");
  if (!proximos.length) {
    wrap.innerHTML = '<p style="color:var(--muted);padding:16px 0;font-style:italic">Nenhum jogo programado</p>';
  } else {
    wrap.innerHTML = proximos.map(j => `
      <div class="proximo-item">
        <span class="proximo-times">${j.timeA}<span class="proximo-vs">vs</span>${j.timeB}</span>
        <span class="proximo-date">📅 ${fmtDataLong(j.data)}</span>
      </div>`).join("");
  }
}

// ===== RENDER JOGOS =====
function renderJogos() {
  const jogos = Store.jogos().sort((a, b) => a.data.localeCompare(b.data));
  const resultados = Store.resultados();

  // populate date filter
  const sel = document.getElementById("filterDate");
  const datas = [...new Set(jogos.map(j => j.data))].sort();
  const curVal = sel.value;
  sel.innerHTML = '<option value="">Todas as datas</option>' +
    datas.map(d => `<option value="${d}">${fmtDataLong(d)}</option>`).join("");
  sel.value = curVal;

  const filtro = sel.value;
  const filtered = filtro ? jogos.filter(j => j.data === filtro) : jogos;

  const tbody = document.getElementById("jogosBody");
  tbody.innerHTML = "";
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Nenhum jogo cadastrado</td></tr>';
    return;
  }
  filtered.forEach(j => {
    const res = resultados.find(r => r.jogoId === j.id);
    const status = res
      ? '<span class="badge badge-done">Finalizado</span>'
      : '<span class="badge badge-pending">Aguardando</span>';
    const score = res
      ? `<span class="resultado-score">${res.golsA} × ${res.golsB}</span>`
      : '<span style="color:var(--muted)">—</span>';
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${fmtDataLong(j.data)}</td>
      <td style="font-weight:600">${j.timeA}</td>
      <td style="color:var(--muted);text-align:center">×</td>
      <td style="font-weight:600">${j.timeB}</td>
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
    jogos.map(j => `<option value="${j.id}">${fmtData(j.data)} — ${j.timeA} × ${j.timeB}</option>`).join("");
  document.getElementById("palpitesJogoWrap").innerHTML = "";
}
document.getElementById("jogoSelect").addEventListener("change", function () {
  const jogoId = this.value;
  const wrap = document.getElementById("palpitesJogoWrap");
  if (!jogoId) { wrap.innerHTML = ""; return; }

  const jogos      = Store.jogos();
  const palpites   = Store.palpites();
  const resultados = Store.resultados();
  const participantes = Store.participantes();

  const jogo = jogos.find(j => j.id === jogoId);
  const res  = resultados.find(r => r.jogoId === jogoId);
  const palJogo = palpites.filter(p => p.jogoId === jogoId);

  const resultLabel = res
    ? `<span class="palpite-resultado-label">🏁 ${res.golsA} × ${res.golsB}</span>`
    : '<span class="badge badge-pending">Não finalizado</span>';

  let rows = "";
  participantes.forEach(p => {
    const pal = palJogo.find(x => x.participanteId === p.id);
    if (!pal) {
      rows += `<tr><td>${p.nome}</td><td style="color:var(--muted);font-style:italic">Sem palpite</td>${res ? "<td>—</td>" : ""}</tr>`;
      return;
    }
    const score = `${pal.golsA} × ${pal.golsB}`;
    if (res) {
      const pts = calcPontos(pal.golsA, pal.golsB, res.golsA, res.golsB);
      const ptsCls = `pts-color-${pts}`;
      rows += `<tr><td style="font-weight:600">${p.nome}</td>
        <td style="font-family:var(--font-mono);font-size:1rem">${score}</td>
        <td><span class="${ptsCls}">${pts === 7 ? "⭐ " : ""}${pts} pts</span></td></tr>`;
    } else {
      rows += `<tr><td style="font-weight:600">${p.nome}</td>
        <td style="font-family:var(--font-mono);font-size:1rem">${score}</td></tr>`;
    }
  });

  wrap.innerHTML = `
    <div class="card">
      <div class="palpite-jogo-header">
        <span class="palpite-jogo-title">${jogo.timeA} × ${jogo.timeB}</span>
        ${resultLabel}
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr>
            <th>Participante</th>
            <th>Palpite</th>
            ${res ? "<th>Pontos</th>" : ""}
          </tr></thead>
          <tbody>${rows || '<tr><td colspan="3" class="empty-row">Nenhum palpite registrado</td></tr>'}</tbody>
        </table>
      </div>
    </div>`;
});

// ===== RENDER ESTATÍSTICAS =====
function renderEstatisticas() {
  const ranked = computeRanking();
  if (!ranked.length) {
    document.getElementById("statExatos").innerHTML = '<tr><td colspan="2" class="empty-row">Sem dados</td></tr>';
    document.getElementById("statVencedores").innerHTML = '<tr><td colspan="2" class="empty-row">Sem dados</td></tr>';
    document.getElementById("statRodadasBody").innerHTML = '<tr><td colspan="3" class="empty-row">Sem dados</td></tr>';
    document.getElementById("barChartWrap").innerHTML = "";
    return;
  }

  // Exatos
  const byExatos = [...ranked].sort((a, b) => b.exatos - a.exatos);
  document.getElementById("statExatos").innerHTML =
    byExatos.map((p, i) => `<tr><td>${i === 0 ? "🥇 " : ""}${p.nome}</td><td style="font-family:var(--font-mono);font-weight:700;color:var(--accent)">${p.exatos}</td></tr>`).join("") ||
    '<tr><td colspan="2" class="empty-row">Sem dados</td></tr>';

  // Vencedores
  const byVenc = [...ranked].sort((a, b) => b.vencedores - a.vencedores);
  document.getElementById("statVencedores").innerHTML =
    byVenc.map((p, i) => `<tr><td>${i === 0 ? "🥇 " : ""}${p.nome}</td><td style="font-family:var(--font-mono);font-weight:700;color:var(--green)">${p.vencedores}</td></tr>`).join("") ||
    '<tr><td colspan="2" class="empty-row">Sem dados</td></tr>';

  // Rodadas
  const jogos = Store.jogos();
  const palpites = Store.palpites();
  const resultados = Store.resultados();
  const participantes = Store.participantes();

  // group by rodada
  const rodadas = [...new Set(jogos.map(j => j.rodada || "Geral"))];
  const rodadaRows = [];
  rodadas.forEach(rod => {
    const jogosRod = jogos.filter(j => (j.rodada || "Geral") === rod);
    const ptsPorP = participantes.map(p => {
      let total = 0;
      jogosRod.forEach(j => {
        const res = resultados.find(r => r.jogoId === j.id);
        const pal = palpites.find(x => x.participanteId === p.id && x.jogoId === j.id);
        if (res && pal) total += calcPontos(pal.golsA, pal.golsB, res.golsA, res.golsB);
      });
      return { nome: p.nome, total };
    }).sort((a, b) => b.total - a.total);
    if (ptsPorP[0] && ptsPorP[0].total > 0)
      rodadaRows.push({ rod, p: ptsPorP[0] });
  });
  document.getElementById("statRodadasBody").innerHTML =
    rodadaRows.map(r => `<tr><td>${r.rod}</td><td style="font-weight:600">${r.p.nome}</td><td><span class="pts-badge">${r.p.total}</span></td></tr>`).join("") ||
    '<tr><td colspan="3" class="empty-row">Sem dados por rodada</td></tr>';

  // Bar chart
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

// ===== CONFIG =====
const PREMIOS_PCT = [
  { pos: "1º", pct: 0.50, emoji: "🥇", cls: "premio-pos-1" },
  { pos: "2º", pct: 0.20, emoji: "🥈", cls: "premio-pos-2" },
  { pos: "3º", pct: 0.15, emoji: "🥉", cls: "premio-pos-3" },
  { pos: "4º", pct: 0.10, emoji: "4",  cls: "premio-pos-4" },
  { pos: "5º", pct: 0.05, emoji: "5",  cls: "premio-pos-5" },
];

function getValorBolao() {
  return parseFloat(Store.get("config", { valor: 20 }).valor) || 20;
}
function salvarConfig() {
  const v = parseFloat(document.getElementById("configValor").value);
  if (!v || v <= 0) return toast("Valor inválido!", true);
  Store.set("config", { valor: v });
  toast(`✅ Valor salvo: R$ ${v.toFixed(2)}`);
}
function fmtBRL(v) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// ===== RENDER PREMIAÇÃO =====
function renderPremiacao() {
  const ranked  = computeRanking();
  const nParts  = Store.participantes().length;
  const valor   = getValorBolao();
  const total   = nParts * valor;

  // Caixa total
  const elTotal = document.getElementById("premioTotal");
  const elSub   = document.getElementById("premioSub");
  const elCount = document.getElementById("premioCount");
  if (elTotal) elTotal.textContent = fmtBRL(total);
  if (elSub)   elSub.textContent   = `${nParts} participante${nParts !== 1 ? "s" : ""} × ${fmtBRL(valor)}`;
  if (elCount) elCount.textContent = nParts;

  // Premio grid (5 slots)
  const grid = document.getElementById("premioGrid");
  if (grid) {
    grid.innerHTML = PREMIOS_PCT.map((p, i) => {
      const valorPremio = total * p.pct;
      const participante = ranked[i];
      const nomeEl = participante
        ? `<div class="premio-nome">${participante.nome}</div>`
        : `<div class="premio-nome vazio">—</div>`;
      return `
        <div class="premio-slot">
          <div class="premio-pos ${p.cls}">${p.pos}</div>
          <div class="premio-pct">${(p.pct * 100).toFixed(0)}%</div>
          <div class="premio-valor">${fmtBRL(valorPremio)}</div>
          ${nomeEl}
        </div>`;
    }).join("");
  }

  // Ranking com premiação
  const tbody = document.getElementById("premioRankingBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!ranked.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhum participante</td></tr>';
    return;
  }
  ranked.forEach((p, i) => {
    const slot  = PREMIOS_PCT[i];
    const pos   = i + 1;
    const icon  = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `${pos}º`;
    const prem  = slot ? fmtBRL(total * slot.pct) : "—";
    const pct   = slot ? `${(slot.pct * 100).toFixed(0)}%` : "—";
    const rowCls = slot ? `premio-row-${pos}` : "";
    const tr = document.createElement("tr");
    tr.className = rowCls;
    tr.innerHTML = `
      <td><span class="rank-pos ${pos <= 3 ? `rank-${pos}` : ""}">${icon}</span></td>
      <td style="font-weight:600">${p.nome}</td>
      <td><span class="pts-badge">${p.totalPts}</span></td>
      <td style="font-family:var(--font-disp);font-size:1.05rem;letter-spacing:1px;color:var(--green)">${prem}</td>
      <td class="premio-pct-cell">${pct}</td>`;
    tbody.appendChild(tr);
  });

  // Sync config input
  const cfgInput = document.getElementById("configValor");
  if (cfgInput) cfgInput.value = valor;
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
    document.getElementById("loginMsg").textContent = "Senha incorreta. Tente novamente.";
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
  // Load config value when opening config tab
  if (id === "tabConfig") {
    const cfgInput = document.getElementById("configValor");
    if (cfgInput) cfgInput.value = getValorBolao();
  }
}

// ===== RENDER ADMIN =====
function renderAdmin() {
  renderAdminParticipantes();
  renderAdminJogos();
  renderAdminPalpites();
  renderAdminResultados();
  populateAdminSelects();
}

// ===== PARTICIPANTES =====
function addParticipante() {
  const nome = document.getElementById("nomeParticipante").value.trim();
  if (!nome) return toast("Informe o nome!", true);
  const fone = document.getElementById("foneParticipante").value.trim();
  const ps = Store.participantes();
  if (ps.find(p => p.nome.toLowerCase() === nome.toLowerCase())) return toast("Participante já cadastrado!", true);
  ps.push({ id: "p" + Date.now(), nome, fone });
  Store.set("participantes", ps);
  document.getElementById("nomeParticipante").value = "";
  document.getElementById("foneParticipante").value = "";
  renderAdminParticipantes();
  populateAdminSelects();
  toast("✅ Participante adicionado!");
}
function removeParticipante(id) {
  if (!confirm("Remover participante?")) return;
  Store.set("participantes", Store.participantes().filter(p => p.id !== id));
  Store.set("palpites", Store.palpites().filter(x => x.participanteId !== id));
  renderAdminParticipantes();
  renderAdminPalpites();
  populateAdminSelects();
  toast("Removido.");
}
function clearParticipantes() {
  if (!confirm("Limpar TODOS os participantes?")) return;
  Store.set("participantes", []);
  Store.set("palpites", []);
  renderAdminParticipantes();
  renderAdminPalpites();
  populateAdminSelects();
}
function renderAdminParticipantes() {
  const ps = Store.participantes();
  const tbody = document.getElementById("participantesBody");
  tbody.innerHTML = "";
  if (!ps.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Nenhum participante</td></tr>';
    return;
  }
  ps.forEach((p, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${i+1}</td><td style="font-weight:600">${p.nome}</td><td style="color:var(--muted)">${p.fone || "—"}</td>
      <td><button class="btn-icon" onclick="removeParticipante('${p.id}')">🗑</button></td>`;
    tbody.appendChild(tr);
  });
}

// ===== JOGOS ADMIN =====
function addJogo() {
  const data  = document.getElementById("jogoData").value;
  const timeA = document.getElementById("jogoTimeA").value.trim();
  const timeB = document.getElementById("jogoTimeB").value.trim();
  const rodada = document.getElementById("jogoRodada").value.trim() || "Fase de Grupos";
  if (!data || !timeA || !timeB) return toast("Preencha data e times!", true);
  const js = Store.jogos();
  js.push({ id: "j" + Date.now(), data, timeA, timeB, rodada });
  Store.set("jogos", js);
  document.getElementById("jogoData").value = "";
  document.getElementById("jogoTimeA").value = "";
  document.getElementById("jogoTimeB").value = "";
  renderAdminJogos();
  populateAdminSelects();
  toast("✅ Jogo adicionado!");
}
function removeJogo(id) {
  if (!confirm("Remover jogo?")) return;
  Store.set("jogos", Store.jogos().filter(j => j.id !== id));
  Store.set("palpites", Store.palpites().filter(x => x.jogoId !== id));
  Store.set("resultados", Store.resultados().filter(x => x.jogoId !== id));
  renderAdminJogos();
  renderAdminPalpites();
  renderAdminResultados();
  populateAdminSelects();
}
function clearJogos() {
  if (!confirm("Limpar TODOS os jogos?")) return;
  Store.set("jogos", []);
  Store.set("palpites", []);
  Store.set("resultados", []);
  renderAdminJogos();
  renderAdminPalpites();
  renderAdminResultados();
  populateAdminSelects();
}
function importarJogos() {
  if (!confirm(`Importar ${JOGOS_COPA2026.length} jogos da Copa 2026?`)) return;
  const existing = Store.jogos();
  let added = 0;
  JOGOS_COPA2026.forEach(j => {
    const dup = existing.find(x => x.data === j.data && x.timeA === j.timeA && x.timeB === j.timeB);
    if (!dup) {
      existing.push({ id: "j" + Date.now() + Math.random(), ...j });
      added++;
    }
  });
  Store.set("jogos", existing);
  renderAdminJogos();
  populateAdminSelects();
  toast(`✅ ${added} jogos importados!`);
}
function renderAdminJogos() {
  const js = Store.jogos().sort((a,b) => a.data.localeCompare(b.data));
  const tbody = document.getElementById("adminJogosBody");
  tbody.innerHTML = "";
  if (!js.length) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">Nenhum jogo</td></tr>';
    return;
  }
  js.forEach(j => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${fmtDataLong(j.data)}</td>
      <td style="font-weight:600">${j.timeA}</td>
      <td style="color:var(--muted);text-align:center">×</td>
      <td style="font-weight:600">${j.timeB}</td>
      <td style="color:var(--muted);font-size:0.8rem">${j.rodada || "—"}</td>
      <td><button class="btn-icon" onclick="removeJogo('${j.id}')">🗑</button></td>`;
    tbody.appendChild(tr);
  });
}

// ===== PALPITES ADMIN =====
function addPalpite() {
  const pid   = document.getElementById("palpiteParticipante").value;
  const jid   = document.getElementById("palpiteJogo").value;
  const golsA = document.getElementById("palpiteGolsA").value;
  const golsB = document.getElementById("palpiteGolsB").value;
  if (!pid || !jid || golsA === "" || golsB === "") return toast("Preencha todos os campos!", true);
  const ps = Store.palpites();
  const idx = ps.findIndex(x => x.participanteId === pid && x.jogoId === jid);
  const entry = { id: "pal" + Date.now(), participanteId: pid, jogoId: jid, golsA: +golsA, golsB: +golsB };
  if (idx >= 0) ps[idx] = entry; else ps.push(entry);
  Store.set("palpites", ps);
  document.getElementById("palpiteGolsA").value = "";
  document.getElementById("palpiteGolsB").value = "";
  renderAdminPalpites();
  toast("✅ Palpite salvo!");
}
function removePalpite(id) {
  Store.set("palpites", Store.palpites().filter(x => x.id !== id));
  renderAdminPalpites();
}
function clearPalpites() {
  if (!confirm("Limpar TODOS os palpites?")) return;
  Store.set("palpites", []);
  renderAdminPalpites();
}
function renderAdminPalpites() {
  const palpites = Store.palpites();
  const jogos    = Store.jogos();
  const parts    = Store.participantes();
  const resultados = Store.resultados();
  const tbody = document.getElementById("adminPalpitesBody");
  tbody.innerHTML = "";
  if (!palpites.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-row">Nenhum palpite</td></tr>';
    return;
  }
  palpites.forEach(pal => {
    const p = parts.find(x => x.id === pal.participanteId);
    const j = jogos.find(x => x.id === pal.jogoId);
    const res = resultados.find(r => r.jogoId === pal.jogoId);
    const pts = res ? calcPontos(pal.golsA, pal.golsB, res.golsA, res.golsB) : "—";
    const ptsCls = typeof pts === "number" ? `pts-color-${pts}` : "";
    const tr = document.createElement("tr");
    tr.innerHTML = `<td style="font-weight:600">${p?.nome || "?"}</td>
      <td style="font-size:0.82rem;color:var(--muted)">${j ? jogoLabel(j) : "?"}</td>
      <td style="font-family:var(--font-mono)">${pal.golsA} × ${pal.golsB}</td>
      <td><span class="${ptsCls}">${pts}</span></td>
      <td><button class="btn-icon" onclick="removePalpite('${pal.id}')">🗑</button></td>`;
    tbody.appendChild(tr);
  });
}

// ===== RESULTADOS ADMIN =====
function addResultado() {
  const jid   = document.getElementById("resultadoJogo").value;
  const golsA = document.getElementById("resultadoGolsA").value;
  const golsB = document.getElementById("resultadoGolsB").value;
  if (!jid || golsA === "" || golsB === "") return toast("Preencha todos os campos!", true);
  const rs = Store.resultados();
  const idx = rs.findIndex(r => r.jogoId === jid);
  const entry = { id: "r" + Date.now(), jogoId: jid, golsA: +golsA, golsB: +golsB };
  if (idx >= 0) rs[idx] = entry; else rs.push(entry);
  Store.set("resultados", rs);
  document.getElementById("resultadoGolsA").value = "";
  document.getElementById("resultadoGolsB").value = "";
  renderAdminResultados();
  renderAdminPalpites();
  toast("🏁 Resultado salvo! Ranking recalculado.");
}
function removeResultado(jid) {
  Store.set("resultados", Store.resultados().filter(r => r.jogoId !== jid));
  renderAdminResultados();
  renderAdminPalpites();
}
function renderAdminResultados() {
  const rs   = Store.resultados();
  const js   = Store.jogos();
  const tbody = document.getElementById("adminResultadosBody");
  tbody.innerHTML = "";
  if (!rs.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-row">Nenhum resultado</td></tr>';
    return;
  }
  rs.forEach(r => {
    const j = js.find(x => x.id === r.jogoId);
    const tr = document.createElement("tr");
    tr.innerHTML = `<td style="font-size:0.85rem">${j ? jogoLabel(j) : "?"}</td>
      <td><span class="resultado-score">${r.golsA} × ${r.golsB}</span></td>
      <td><span class="badge badge-done">✅ Finalizado</span></td>
      <td><button class="btn-icon" onclick="removeResultado('${r.jogoId}')">🗑</button></td>`;
    tbody.appendChild(tr);
  });
}

// ===== POPULATE SELECTS =====
function populateAdminSelects() {
  const parts = Store.participantes();
  const jogos = Store.jogos().sort((a,b) => a.data.localeCompare(b.data));

  const palPart = document.getElementById("palpiteParticipante");
  palPart.innerHTML = '<option value="">Participante</option>' +
    parts.map(p => `<option value="${p.id}">${p.nome}</option>`).join("");

  const palJogo = document.getElementById("palpiteJogo");
  palJogo.innerHTML = '<option value="">Jogo</option>' +
    jogos.map(j => `<option value="${j.id}">${jogoLabel(j)}</option>`).join("");

  const resJogo = document.getElementById("resultadoJogo");
  resJogo.innerHTML = '<option value="">Selecione o Jogo</option>' +
    jogos.map(j => `<option value="${j.id}">${jogoLabel(j)}</option>`).join("");
}

// ===== PLAYER MODAL =====
function openPlayerModal(pid) {
  const ranked = computeRanking();
  const player = ranked.find(p => p.id === pid);
  if (!player) return;
  const pos = ranked.indexOf(player) + 1;
  const posIcon = pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `${pos}º`;

  const rows = player.detalhe
    .filter(d => d.pts !== null)
    .sort((a, b) => b.pts - a.pts)
    .map(d => {
      const ptsCls = `pts-color-${d.pts}`;
      return `<tr>
        <td style="font-size:0.83rem">${d.jogo.timeA} × ${d.jogo.timeB}</td>
        <td style="font-family:var(--font-mono)">${d.pal.golsA} × ${d.pal.golsB}</td>
        <td style="font-family:var(--font-mono)">${d.jogo.golsAReal ?? "—"} × ${d.jogo.golsBReal ?? "—"}</td>
        <td><span class="${ptsCls}">${d.pts} pts</span></td>
      </tr>`;
    }).join("") || '<tr><td colspan="4" class="empty-row">Sem jogos avaliados</td></tr>';

  // compute real scores from results
  const resultados = Store.resultados();
  const detRowsFixed = player.detalhe
    .filter(d => d.pts !== null)
    .sort((a, b) => b.pts - a.pts)
    .map(d => {
      const res = resultados.find(r => r.jogoId === d.jogo.id);
      const ptsCls = `pts-color-${d.pts}`;
      return `<tr>
        <td style="font-size:0.83rem">${d.jogo.timeA} × ${d.jogo.timeB}</td>
        <td style="font-family:var(--font-mono)">${d.pal.golsA} × ${d.pal.golsB}</td>
        <td style="font-family:var(--font-mono)">${res ? `${res.golsA} × ${res.golsB}` : "—"}</td>
        <td><span class="${ptsCls}">${d.pts} pts</span></td>
      </tr>`;
    }).join("") || '<tr><td colspan="4" class="empty-row">Sem jogos avaliados</td></tr>';

  document.getElementById("modalContent").innerHTML = `
    <div class="modal-player-header">
      <div class="modal-player-name">${posIcon} ${player.nome}</div>
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
          <tbody>${detRowsFixed}</tbody>
        </table>
      </div>
    </div>`;
  document.getElementById("modalOverlay").classList.add("open");
}
function closeModal() {
  document.getElementById("modalOverlay").classList.remove("open");
}
document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

// ===== INIT =====
navigate("ranking");

// nav logo click
const navLogo = document.querySelector(".nav-logo");
if (navLogo) navLogo.addEventListener("click", () => navigate("ranking"));
