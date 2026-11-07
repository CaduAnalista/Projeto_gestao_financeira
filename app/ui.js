/* Utilidades de interface: formatação, modais, avisos, componentes pequenos. */
(function () {
  const GF = window.GF;

  const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  GF.brl = (v) => moeda.format(Math.round((v || 0) * 100) / 100 || 0);
  GF.brlCurto = (v) => {
    const a = Math.abs(v);
    if (a >= 1000) return (v < 0 ? "-" : "") + "R$ " + (a / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " mil";
    return "R$ " + Math.round(v).toLocaleString("pt-BR");
  };
  GF.pct = (v) => (isFinite(v) ? Math.round(v * 100) + "%" : "–");

  const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro",
    "outubro", "novembro", "dezembro"];
  GF.nomeMes = (ym) => { const [y, m] = ym.split("-").map(Number); return `${MESES[m - 1]} de ${y}`; };
  GF.mesCurto = (ym) => { const [y, m] = ym.split("-").map(Number); return `${MESES[m - 1].slice(0, 3)}/${String(y).slice(2)}`; };
  GF.mesMedio = (ym) => { const [y, m] = ym.split("-").map(Number); return `${MESES[m - 1].slice(0, 3)}/${y}`; };
  GF.cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  GF.esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  GF.h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  GF.icon = {
    plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
    edit: '<svg viewBox="0 0 24 24"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/></svg>',
    trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>',
    card: '<svg viewBox="0 0 24 24"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19"/></svg>',
    repeat: '<svg viewBox="0 0 24 24"><path d="M17 2l4 4-4 4M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    alert: '<svg viewBox="0 0 24 24"><path d="M12 9v4M12 17h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>',
    download: '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
    upload: '<svg viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>',
  };

  /* ---------- avisos ---------- */
  GF.toast = function (msg, tipo = "ok") {
    const el = GF.h(`<div class="toast toast-${tipo}">${GF.esc(msg)}</div>`);
    document.getElementById("toastRoot").appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 300); }, 3200);
  };

  /* ---------- modal ---------- */
  GF.modal = function ({ titulo, corpo, largura = "", aoAbrir }) {
    const root = document.getElementById("modalRoot");
    const el = GF.h(`
      <div class="modal-backdrop">
        <div class="modal ${largura}" role="dialog" aria-modal="true" aria-label="${GF.esc(titulo)}">
          <div class="modal-head">
            <h2>${GF.esc(titulo)}</h2>
            <button class="icon-btn" data-fechar type="button" aria-label="Fechar">${GF.icon.close}</button>
          </div>
          <div class="modal-body"></div>
        </div>
      </div>`);
    const body = el.querySelector(".modal-body");
    if (typeof corpo === "string") body.innerHTML = corpo; else body.appendChild(corpo);
    const fechar = () => { el.classList.remove("show"); document.removeEventListener("keydown", esc); setTimeout(() => el.remove(), 200); };
    const esc = (e) => { if (e.key === "Escape") fechar(); };
    el.addEventListener("mousedown", (e) => { if (e.target === el) fechar(); });
    el.querySelectorAll("[data-fechar]").forEach((b) => b.addEventListener("click", fechar));
    document.addEventListener("keydown", esc);
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    if (aoAbrir) aoAbrir(el, fechar);
    return { el, fechar };
  };

  GF.confirmar = function (texto, { ok = "Confirmar", perigo = false } = {}) {
    return new Promise((resolve) => {
      let decidido = false;
      const m = GF.modal({
        titulo: "Confirmar",
        largura: "modal-sm",
        corpo: `<p class="confirm-text">${GF.esc(texto)}</p>
          <div class="form-actions">
            <button type="button" class="btn btn-ghost" data-nao>Cancelar</button>
            <button type="button" class="btn ${perigo ? "btn-danger" : "btn-primary"}" data-sim>${GF.esc(ok)}</button>
          </div>`,
        aoAbrir(el, fechar) {
          el.querySelector("[data-sim]").addEventListener("click", () => { decidido = true; fechar(); resolve(true); });
          el.querySelector("[data-nao]").addEventListener("click", () => { decidido = true; fechar(); resolve(false); });
        },
      });
      const obs = new MutationObserver(() => { if (!document.body.contains(m.el)) { obs.disconnect(); if (!decidido) resolve(false); } });
      obs.observe(document.getElementById("modalRoot"), { childList: true });
    });
  };

  /* ---------- seletor de mês (barra superior) ---------- */
  GF.seletorMes = function (aoMudar) {
    const el = GF.h(`
      <div class="month-switch">
        <button class="icon-btn" type="button" data-ant aria-label="Mês anterior">${GF.icon.left}</button>
        <label class="month-label">
          <span>${GF.cap(GF.nomeMes(GF.state.mes))}</span>
          <input type="month" value="${GF.state.mes}" aria-label="Escolher mês">
        </label>
        <button class="icon-btn" type="button" data-prox aria-label="Próximo mês">${GF.icon.right}</button>
        ${GF.state.mes !== GF.mesAtual() ? `<button class="btn btn-ghost btn-sm" type="button" data-hoje>Hoje</button>` : ""}
      </div>`);
    const mudar = (ym) => { if (!ym) return; GF.state.mes = ym; aoMudar(); };
    el.querySelector("[data-ant]").onclick = () => mudar(GF.somaMes(GF.state.mes, -1));
    el.querySelector("[data-prox]").onclick = () => mudar(GF.somaMes(GF.state.mes, 1));
    el.querySelector("input").onchange = (e) => mudar(e.target.value);
    const hoje = el.querySelector("[data-hoje]");
    if (hoje) hoje.onclick = () => mudar(GF.mesAtual());
    return el;
  };

  /* ---------- gráficos ---------- */
  GF.charts = [];
  GF.limparGraficos = () => { GF.charts.forEach((c) => c.destroy()); GF.charts = []; };
  GF.cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  GF.grafico = function (canvas, config) {
    if (!window.Chart) {
      canvas.replaceWith(GF.h(`<p class="muted small">Gráfico indisponível sem internet.</p>`));
      return null;
    }
    const texto = GF.cssVar("--muted"), grade = GF.cssVar("--grid");
    Chart.defaults.font.family = "Inter, system-ui, sans-serif";
    Chart.defaults.color = texto;
    const c = new Chart(canvas, config);
    if (c.options.scales) for (const s of Object.values(c.options.scales)) { if (s.grid) s.grid.color = grade; }
    c.update("none");
    GF.charts.push(c);
    return c;
  };

  GF.vazio = (titulo, texto, botao) => `
    <div class="empty">
      <div class="empty-mark">R$</div>
      <h3>${titulo}</h3>
      <p>${texto}</p>
      ${botao || ""}
    </div>`;

  GF.badgeLanc = function (l, k) {
    if (l.repeticao === "parcelada") {
      const p = GF.parcelaNo(l, k), faltam = l.parcelas - p, fim = GF.mesMedio(GF.ym(GF.fimIdx(l)));
      return `<span class="badge badge-gold" title="Parcela ${p} de ${l.parcelas}">parcela ${p} de ${l.parcelas}</span>` +
        `<span class="parc-info">${faltam ? `faltam ${faltam} · até ${fim}` : "última parcela"}</span>`;
    }
    if (l.repeticao === "mensal") return `<span class="badge badge-soft" title="Repete todo mês${l.ate ? " até " + GF.mesMedio(l.ate) : ""}">${GF.icon.repeat} fixo</span>`;
    return "";
  };
  GF.formaTexto = (l) => (l.forma === "credito" ? l.cartao || "Cartão" : GF.FORMAS[l.forma]);
})();
