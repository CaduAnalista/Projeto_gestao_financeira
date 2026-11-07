/* Página de cartões: fatura do mês por cartão e todas as compras parceladas. */
(function () {
  const GF = window.GF;
  GF.pages = GF.pages || {};
  const estado = { cartao: "todos", ver: "ativas" };

  GF.pages.cartoes = {
    titulo: "Cartões e parcelas",
    render(view, top) {
      const k = GF.mi(GF.state.mes);
      document.getElementById("pageSub").textContent = "Faturas e parcelas de " + GF.nomeMes(GF.state.mes);
      top.append(GF.seletorMes(() => GF.render()));
      const novo = GF.h(`<button class="btn btn-primary" type="button">${GF.icon.plus} Compra no cartão</button>`);
      novo.onclick = () => GF.abrirFormulario({ tipo: "gasto", forma: "credito", repeticao: "parcelada" });
      top.append(novo);

      const ocorr = GF.ocorrencias(k).filter((o) => o.l.tipo === "gasto");
      const cartoes = [...new Set([...GF.db.cartoes, ...GF.db.lancamentos.filter((l) => l.cartao).map((l) => l.cartao)])];
      const parceladas = GF.db.lancamentos.filter((l) => l.tipo === "gasto" && l.repeticao === "parcelada");

      const resumo = cartoes.map((c) => {
        const doMes = ocorr.filter((o) => o.l.forma === "credito" && o.l.cartao === c);
        const total = doMes.reduce((s, o) => s + o.valor, 0);
        const parcelado = doMes.filter((o) => o.l.repeticao === "parcelada").reduce((s, o) => s + o.valor, 0);
        const pendente = doMes.filter((o) => !o.pago).reduce((s, o) => s + o.valor, 0);
        const futuro = parceladas.filter((l) => l.forma === "credito" && l.cartao === c)
          .reduce((s, l) => s + GF.infoParcelas(l, k).restante, 0);
        const ativas = parceladas.filter((l) => l.forma === "credito" && l.cartao === c && GF.ativo(l, k)).length;
        return { c, total, parcelado, avista: total - parcelado, pendente, futuro, ativas, qtd: doMes.length };
      });

      let lista = parceladas.filter((l) => estado.cartao === "todos" || (l.forma === "credito" && l.cartao === estado.cartao));
      if (estado.ver === "ativas") lista = lista.filter((l) => GF.ativo(l, k));
      else if (estado.ver === "futuras") lista = lista.filter((l) => GF.fimIdx(l) >= k);
      lista.sort((a, b) => GF.fimIdx(a) - GF.fimIdx(b) || b.valor - a.valor);
      const somaParcelas = lista.filter((l) => GF.ativo(l, k)).reduce((s, l) => s + l.valor, 0);
      const somaRestante = lista.reduce((s, l) => s + GF.infoParcelas(l, k).restante, 0);

      view.innerHTML = `
        <section class="cc-grid">
          ${resumo.length ? resumo.map((r, i) => `
            <button type="button" class="cc ${estado.cartao === r.c ? "on" : ""}" data-cartao="${GF.esc(r.c)}" style="--i:${i}">
              <div class="cc-top"><span class="cc-chip"></span><span class="cc-name">${GF.esc(r.c)}</span></div>
              <div class="cc-label">Fatura de ${GF.nomeMes(GF.state.mes).split(" ")[0]}</div>
              <div class="cc-value">${GF.brl(r.total)}</div>
              <div class="cc-foot">
                <span>Parcelas <b>${GF.brl(r.parcelado)}</b></span>
                <span title="Compras à vista e assinaturas de todo mês">Outras compras <b>${GF.brl(r.avista)}</b></span>
              </div>
              <div class="cc-foot">
                <span>${r.ativas} ${r.ativas === 1 ? "parcelamento ativo" : "parcelamentos ativos"}</span>
                <span>Ainda vai pagar <b>${GF.brl(r.futuro)}</b></span>
              </div>
              ${r.pendente > 0 ? `<span class="cc-pend">${GF.brl(r.pendente)} a pagar</span>` : r.qtd ? `<span class="cc-pend ok">paga ✓</span>` : ""}
            </button>`).join("") : `<div class="card">${GF.vazio("Nenhum cartão", "Cadastre seus cartões em Ajustes.", `<a class="btn btn-primary" href="#config">Ir para Ajustes</a>`)}</div>`}
        </section>

        <section class="card">
          <div class="card-head">
            <h2>Compras parceladas</h2>
            <div class="seg seg-sm">
              <button type="button" data-ver="ativas" class="${estado.ver === "ativas" ? "on" : ""}">Neste mês</button>
              <button type="button" data-ver="futuras" class="${estado.ver === "futuras" ? "on" : ""}">Em aberto</button>
              <button type="button" data-ver="todas" class="${estado.ver === "todas" ? "on" : ""}">Todas</button>
            </div>
          </div>
          <div class="chips">
            <button type="button" class="chip ${estado.cartao === "todos" ? "on" : ""}" data-cartao="todos">Todos</button>
            ${cartoes.map((c) => `<button type="button" class="chip ${estado.cartao === c ? "on" : ""}" data-cartao="${GF.esc(c)}">${GF.esc(c)}</button>`).join("")}
          </div>
          ${lista.length ? `
          <div class="table-wrap">
            <table class="table table-cards">
              <thead><tr>
                <th>Compra</th><th>Pagamento</th><th class="num">Parcela</th><th>Andamento</th>
                <th class="num">Faltam</th><th>Termina em</th><th class="num">Total da compra</th><th class="num">Falta pagar</th>
              </tr></thead>
              <tbody>
                ${lista.map((l) => {
                  const p = GF.infoParcelas(l, k);
                  const feitas = p.atual ?? (p.terminou ? p.total : l.parcelaInicial - 1);
                  const status = p.terminou ? `<span class="badge badge-soft">quitada</span>` : p.naoComecou ? `<span class="badge badge-soft">começa ${GF.mesMedio(l.mes)}</span>` : "";
                  return `<tr class="row-click" data-id="${l.id}">
                    <td><div class="cell-main"><span class="dot dot-sm" style="--c:${GF.corCategoria(l.categoria)}"></span>
                      <div><strong>${GF.esc(l.descricao)}</strong><small>${GF.esc(l.categoria)}</small></div></div></td>
                    <td data-label="Pagamento">${GF.esc(GF.formaTexto(l))}</td>
                    <td class="num" data-label="Parcela">${GF.brl(l.valor)}</td>
                    <td data-label="Andamento"><div class="progress-cell">
                      <span>${p.atual ? `<b>${p.atual}</b> de ${p.total}` : status || `${feitas} de ${p.total}`}</span>
                      <div class="progress"><i style="width:${(feitas / p.total) * 100}%"></i></div></div></td>
                    <td class="num" data-label="Faltam"><b>${p.faltam}</b></td>
                    <td data-label="Termina em">${GF.mesMedio(p.terminaEm)}</td>
                    <td class="num" data-label="Total da compra">${GF.brl(p.valorTotal)}</td>
                    <td class="num" data-label="Falta pagar"><b>${GF.brl(p.restante)}</b></td>
                  </tr>`;
                }).join("")}
              </tbody>
              <tfoot><tr>
                <td colspan="2">${lista.length} ${lista.length === 1 ? "compra" : "compras"}</td>
                <td class="num">${GF.brl(somaParcelas)}</td><td colspan="4" class="muted small">“Faltam” = parcelas depois de ${GF.mesMedio(GF.state.mes)}</td>
                <td class="num"><b>${GF.brl(somaRestante)}</b></td>
              </tr></tfoot>
            </table>
          </div>` : `<p class="muted small pad">Nenhuma compra parcelada ${estado.ver === "ativas" ? "neste mês" : "por aqui"}.</p>`}
        </section>

        <section class="card">
          <div class="card-head"><h2>Compromisso dos próximos 12 meses</h2><span class="muted small">quanto já está garantido nas faturas</span></div>
          <div class="chart-box"><canvas data-chart-futuro></canvas></div>
        </section>`;

      view.querySelectorAll("[data-cartao]").forEach((b) => (b.onclick = () => {
        estado.cartao = estado.cartao === b.dataset.cartao && b.classList.contains("cc") ? "todos" : b.dataset.cartao;
        GF.render();
      }));
      view.querySelectorAll("[data-ver]").forEach((b) => (b.onclick = () => { estado.ver = b.dataset.ver; GF.render(); }));
      view.querySelectorAll("tr[data-id]").forEach((tr) => (tr.onclick = () => {
        const l = GF.db.lancamentos.find((x) => x.id === tr.dataset.id);
        if (l) GF.abrirFormulario({ lanc: l });
      }));

      // gráfico: próximos 12 meses por cartão (tudo que vai no cartão)
      const meses = Array.from({ length: 12 }, (_, i) => k + i);
      const datasets = cartoes.map((c, i) => ({
        label: c,
        data: meses.map((m) => GF.ocorrencias(m).filter((o) => o.l.forma === "credito" && o.l.cartao === c && o.l.repeticao !== "unica")
          .reduce((s, o) => s + o.valor, 0)),
        backgroundColor: ["#C49A3A", "#8B5A2B", "#6B7B4B", "#B4573A", "#D4A373", "#5E503F"][i % 6],
        borderRadius: 6, maxBarThickness: 38,
      }));
      GF.grafico(view.querySelector("[data-chart-futuro]"), {
        type: "bar",
        data: { labels: meses.map((m) => GF.mesCurto(GF.ym(m))), datasets },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { position: "bottom" }, tooltip: { callbacks: { label: (c) => `${c.dataset.label}: ${GF.brl(c.raw)}` } } },
          scales: { x: { stacked: true, grid: { display: false } }, y: { stacked: true, ticks: { callback: (v) => GF.brlCurto(v) }, grid: {} } },
        },
      });
    },
  };
})();
