/* Página de análise: receitas x gastos, tipos de gasto, 5 gastos mais frequentes e exceções. */
(function () {
  const GF = window.GF;
  GF.pages = GF.pages || {};
  const estado = { periodo: 6, freq: "dia" };

  const mediana = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b), m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };

  function mesesDoPeriodo() {
    const fim = GF.mi(GF.state.mes);
    const ini = estado.periodo === "tudo" ? Math.min(GF.primeiroMesIdx(), fim) : fim - estado.periodo + 1;
    return Array.from({ length: fim - ini + 1 }, (_, i) => ini + i);
  }

  /** Procura gastos que fogem do normal. Usa o histórico inteiro como referência. */
  function excecoes(meses) {
    const todosMeses = [];
    for (let i = GF.primeiroMesIdx(); i <= Math.max(GF.ultimoMesComLancamento(), GF.mi(GF.state.mes)); i++) todosMeses.push(i);
    const hist = todosMeses.flatMap((m) => GF.ocorrencias(m)).filter((o) => o.l.tipo === "gasto" && o.l.categoria !== GF.CAT_RESERVA);
    const porDesc = {}, porCat = {};
    hist.forEach((o) => {
      (porDesc[GF.normTexto(o.l.descricao)] ||= []).push(o.valor);
      if (o.l.repeticao === "unica") (porCat[o.l.categoria] ||= []).push(o.valor);
    });
    const noPeriodo = meses.flatMap((m) => GF.ocorrencias(m)).filter((o) => o.l.tipo === "gasto" && o.l.categoria !== GF.CAT_RESERVA);
    const itens = [];
    const vistos = new Set();

    for (const o of noPeriodo) {
      const chave = o.l.id + o.ym;
      if (o.l.categoria === "Extraordinários") {
        itens.push({ tipo: "imprevisto", o, titulo: o.l.descricao, valor: o.valor,
          motivo: `Gasto extraordinário (imprevisto) em ${GF.mesMedio(o.ym)}.` });
        vistos.add(chave); continue;
      }
      if (o.l.repeticao !== "unica") continue;
      // compara com o próprio histórico da descrição (ex.: "Mercado") quando há base suficiente
      const hd = porDesc[GF.normTexto(o.l.descricao)] || [];
      if (hd.length >= 4) {
        const md = mediana(hd), maior = Math.max(...hd.filter((v) => v !== o.valor), 0);
        if (o.valor >= md * 2 && o.valor - md >= 100 && o.valor > maior * 1.2) {
          itens.push({ tipo: "acima", o, titulo: o.l.descricao, valor: o.valor,
            motivo: `Em ${GF.mesMedio(o.ym)} foi ${GF.brl(o.valor)}; normalmente fica perto de ${GF.brl(md)} (${GF.pct(o.valor / md - 1)} a mais).` });
          vistos.add(chave);
        }
        continue; // tem histórico próprio: não compara com o tipo inteiro
      }
      // gasto novo (no máximo 1 registro): compara com o tipo de gasto
      if (hd.length > 1) continue;
      const hc = porCat[o.l.categoria] || [];
      if (hc.length >= 6) {
        const mc = mediana(hc);
        if (o.valor >= mc * 4 && o.valor >= 200) {
          itens.push({ tipo: "acima", o, titulo: o.l.descricao, valor: o.valor,
            motivo: `Bem acima do típico em ${o.l.categoria} (um gasto comum desse tipo fica perto de ${GF.brl(mc)}).` });
          vistos.add(chave);
        }
      }
    }

    // meses em que um tipo de gasto subiu muito
    const tipos = [...new Set(hist.map((o) => o.l.categoria))];
    const totalMesCat = (m, c) => GF.ocorrencias(m).filter((o) => o.l.tipo === "gasto" && o.l.categoria === c).reduce((s, o) => s + o.valor, 0);
    const mesesHist = todosMeses.filter((m) => GF.ocorrencias(m).some((o) => o.l.tipo === "gasto" && o.l.repeticao !== "parcelada"));
    const picos = [];
    for (const c of tipos) {
      for (const m of meses) {
        const v = totalMesCat(m, c);
        const outros = mesesHist.filter((x) => x !== m).map((x) => totalMesCat(x, c));
        if (outros.length < 2) continue;
        const media = outros.reduce((s, x) => s + x, 0) / outros.length;
        if (media > 0 && v > media * 1.4 && v - media >= 150) {
          picos.push({ c, m, v, media });
        }
      }
    }
    const negativos = meses.map((m) => ({ m, t: GF.totais(m) })).filter((x) => x.t.saldo < 0 && x.t.receitas + x.t.gastos > 0);
    itens.sort((a, b) => b.valor - a.valor);
    picos.sort((a, b) => (b.v - b.media) - (a.v - a.media));
    return { itens, picos, negativos };
  }

  GF.pages.analise = {
    titulo: "Análise",
    render(view, top) {
      top.append(GF.seletorMes(() => GF.render()));
      const meses = mesesDoPeriodo();
      const nomePeriodo = estado.periodo === "tudo" ? "todo o período" : `últimos ${estado.periodo} meses`;
      document.getElementById("pageSub").textContent =
        `${GF.cap(nomePeriodo)}: ${GF.mesMedio(GF.ym(meses[0]))} a ${GF.mesMedio(GF.ym(meses[meses.length - 1]))}`;

      const periodoBar = `<div class="chips">
        ${[[3, "3 meses"], [6, "6 meses"], [12, "12 meses"], ["tudo", "Tudo"]]
          .map(([v, n]) => `<button type="button" class="chip ${estado.periodo === v ? "on" : ""}" data-per="${v}">${n}</button>`).join("")}
        </div>`;

      if (!GF.db.lancamentos.length) {
        view.innerHTML = `<div class="card">${GF.vazio("Ainda não há o que analisar",
          "Cadastre suas receitas e gastos na tela inicial. A análise aparece aqui automaticamente.",
          `<a class="btn btn-primary" href="#inicio">Ir para o cadastro</a>`)}</div>`;
        return;
      }

      const serie = meses.map((m) => ({ m, ...GF.totais(m) }));
      const tot = serie.reduce((a, s) => ({ r: a.r + s.receitas, g: a.g + s.gastos, inv: a.inv + s.reserva }), { r: 0, g: 0, inv: 0 });
      const saldo = tot.r - tot.g;
      const n = meses.length;
      const occ = meses.flatMap((m) => GF.ocorrencias(m));
      const gastos = occ.filter((o) => o.l.tipo === "gasto");
      const receitas = occ.filter((o) => o.l.tipo === "receita");

      const agrupa = (lista) => {
        const r = {};
        lista.forEach((o) => (r[o.l.categoria] = (r[o.l.categoria] || 0) + o.valor));
        return Object.entries(r).sort((a, b) => b[1] - a[1]);
      };
      const gCat = agrupa(gastos), rCat = agrupa(receitas);

      // 5 mais frequentes
      const baseFreq = gastos.filter((o) => o.l.categoria !== GF.CAT_RESERVA && (estado.freq === "tudo" || o.l.repeticao === "unica"));
      const grupos = {};
      baseFreq.forEach((o) => {
        const key = GF.normTexto(o.l.descricao);
        const g = (grupos[key] ||= { nome: o.l.descricao, cat: o.l.categoria, vezes: 0, total: 0, meses: new Set(), ultimo: o.ym });
        g.vezes++; g.total += o.valor; g.meses.add(o.ym); if (o.ym > g.ultimo) g.ultimo = o.ym;
      });
      const top5 = Object.values(grupos).sort((a, b) => b.vezes - a.vezes || b.total - a.total).slice(0, 5);
      const maxVezes = top5.length ? top5[0].vezes : 1;

      const maiores = gastos.filter((o) => o.l.repeticao === "unica" && o.l.categoria !== GF.CAT_RESERVA)
        .sort((a, b) => b.valor - a.valor).slice(0, 5);

      const exc = excecoes(meses);

      // projeção dos próximos 12 meses com base no período analisado:
      // contas fixas e parcelas já cadastradas + média dos lançamentos avulsos do período
      const comDados = serie.filter((s) => s.receitas + s.gastos > 0);
      const nBase = comDados.length || 1;
      const avulso = (tipo) => occ.filter((o) => o.l.tipo === tipo && o.l.repeticao === "unica").reduce((s, o) => s + o.valor, 0) / nBase;
      const mediaAvulsoR = avulso("receita"), mediaAvulsoG = avulso("gasto");
      const kFim = meses[meses.length - 1];
      const proj = Array.from({ length: 12 }, (_, i) => {
        const m = kFim + 1 + i, oc = GF.ocorrencias(m);
        const soma = (tipo, rep) => oc.filter((o) => o.l.tipo === tipo && (rep ? o.l.repeticao === "unica" : o.l.repeticao !== "unica")).reduce((s, o) => s + o.valor, 0);
        const receitas = soma("receita") + Math.max(mediaAvulsoR, soma("receita", true));
        const gastos = soma("gasto") + Math.max(mediaAvulsoG, soma("gasto", true));
        return { m, receitas, gastos, saldo: receitas - gastos };
      });
      const tp = proj.reduce((a, p) => ({ r: a.r + p.receitas, g: a.g + p.gastos }), { r: 0, g: 0 });

      view.innerHTML = `
        <div class="toolbar">${periodoBar}</div>

        <section class="kpis">
          <div class="kpi kpi-income"><span class="kpi-label">Receitas no período</span><strong class="kpi-value">${GF.brl(tot.r)}</strong>
            <span class="kpi-sub">média de ${GF.brl(tot.r / n)} por mês</span></div>
          <div class="kpi kpi-expense"><span class="kpi-label">Gastos no período</span><strong class="kpi-value">${GF.brl(tot.g)}</strong>
            <span class="kpi-sub">média de ${GF.brl(tot.g / n)} por mês</span></div>
          <div class="kpi kpi-balance ${saldo < 0 ? "is-neg" : ""}"><span class="kpi-label">Sobrou no período</span><strong class="kpi-value">${GF.brl(saldo)}</strong>
            <span class="kpi-sub">${tot.r ? GF.pct(saldo / tot.r) + " das receitas" : "–"}</span></div>
          <div class="kpi kpi-gold"><span class="kpi-label">Investido</span><strong class="kpi-value">${GF.brl(tot.inv)}</strong>
            <span class="kpi-sub">${tot.r ? GF.pct(tot.inv / tot.r) + " das receitas" : "–"}</span></div>
        </section>

        <section class="card">
          <div class="card-head"><h2>Receitas x gastos por mês</h2><span class="muted small">barras claras e linha tracejada = projeção</span></div>
          <div class="chart-box chart-lg"><canvas data-ch-meses></canvas></div>
          <div class="proj-resumo">
            <div><span>Projeção ${GF.mesMedio(GF.ym(proj[0].m))} a ${GF.mesMedio(GF.ym(proj[11].m))}</span>
              <small>Baseada ${nBase === 1 ? "no mês" : `na média dos ${nBase} meses`} com lançamentos do período, mais as contas fixas e parcelas já cadastradas.</small></div>
            <div><span>Receitas</span><b class="pos">${GF.brl(tp.r)}</b></div>
            <div><span>Gastos</span><b class="neg">${GF.brl(tp.g)}</b></div>
            <div><span>Deve sobrar</span><b class="${tp.r - tp.g < 0 ? "neg" : ""}">${GF.brl(tp.r - tp.g)}</b></div>
          </div>
        </section>

        <section class="layout-2 even">
          <div class="card">
            <div class="card-head"><h2>${GF.icon.star} Os 5 gastos mais frequentes</h2>
              <div class="seg seg-sm">
                <button type="button" data-freq="dia" class="${estado.freq === "dia" ? "on" : ""}">Dia a dia</button>
                <button type="button" data-freq="tudo" class="${estado.freq === "tudo" ? "on" : ""}">Incluir fixos</button>
              </div>
            </div>
            <p class="muted small">${estado.freq === "dia" ? "Compras avulsas (sem contar contas fixas e parcelas)." : "Contando também contas de todo mês e parcelas."}</p>
            ${top5.length ? `<ol class="rank">${top5.map((g, i) => `
              <li>
                <span class="rank-n">${i + 1}</span>
                <div class="rank-main">
                  <div class="rank-top"><strong>${GF.esc(g.nome)}</strong><b>${g.vezes}×</b></div>
                  <div class="bar"><i style="width:${(g.vezes / maxVezes) * 100}%;--c:${GF.corCategoria(g.cat)}"></i></div>
                  <small>${GF.esc(g.cat)} · total ${GF.brl(g.total)} · média ${GF.brl(g.total / g.vezes)} · em ${g.meses.size} ${g.meses.size === 1 ? "mês" : "meses"}</small>
                </div>
              </li>`).join("")}</ol>` : `<p class="muted small pad">Sem gastos suficientes no período.</p>`}
          </div>

          <div class="card">
            <div class="card-head"><h2>Gastos por tipo</h2></div>
            <div class="donut-wrap">
              <div class="chart-box chart-donut"><canvas data-ch-tipos></canvas></div>
              <div class="type-list compact">${gCat.map(([c, v]) => `
                <div class="type-row" style="--c:${GF.corCategoria(c)}">
                  <div class="type-name"><b>${GF.esc(c)}</b><small>${GF.esc(GF.finalidade("gasto", c))}</small></div>
                  <div class="type-val"><b>${GF.brl(v)}</b><small>${GF.pct(v / tot.g)} · ${GF.brl(v / n)}/mês</small></div>
                </div>`).join("")}</div>
            </div>
          </div>
        </section>

        <section class="card card-exc">
          <div class="card-head"><h2>${GF.icon.alert} Exceções do período</h2><span class="muted small">o que fugiu do normal</span></div>
          ${!exc.itens.length && !exc.picos.length && !exc.negativos.length ? `<p class="muted pad">Nenhuma exceção encontrada. Seus gastos seguiram o padrão de sempre. 👏</p>` : ""}
          ${exc.negativos.length ? `<div class="exc-group"><h3>Meses que fecharam no vermelho</h3>
            ${exc.negativos.map((x) => `<div class="exc-item exc-neg">
              <div><strong>${GF.cap(GF.nomeMes(GF.ym(x.m)))}</strong><small>Receitas ${GF.brl(x.t.receitas)} · gastos ${GF.brl(x.t.gastos)}</small></div>
              <b>${GF.brl(x.t.saldo)}</b></div>`).join("")}</div>` : ""}
          ${exc.picos.length ? `<div class="exc-group"><h3>Tipos de gasto que subiram muito no mês</h3>
            ${exc.picos.slice(0, 8).map((p) => `<div class="exc-item">
              <div><strong>${GF.esc(p.c)} em ${GF.mesMedio(GF.ym(p.m))}</strong><small>Gastou ${GF.brl(p.v)}; a média dos outros meses é ${GF.brl(p.media)} (${GF.pct(p.v / p.media - 1)} a mais).</small></div>
              <b class="neg">+ ${GF.brl(p.v - p.media)}</b></div>`).join("")}</div>` : ""}
          ${exc.itens.length ? `<div class="exc-group"><h3>Gastos fora do padrão e imprevistos</h3>
            ${exc.itens.slice(0, 12).map((x) => `<div class="exc-item row-click" data-id="${x.o.l.id}">
              <div><strong>${GF.esc(x.titulo)} <span class="badge ${x.tipo === "imprevisto" ? "badge-soft" : "badge-gold"}">${x.tipo === "imprevisto" ? "imprevisto" : "acima do normal"}</span></strong><small>${GF.esc(x.motivo)}</small></div>
              <b>${GF.brl(x.valor)}</b></div>`).join("")}</div>` : ""}
        </section>

        <section class="layout-2 even">
          <div class="card">
            <div class="card-head"><h2>Maiores gastos avulsos</h2></div>
            <div class="list" data-lista-maiores>${maiores.length ? maiores.map((o) => GF.linhaLanc(o, { mostrarMes: true })).join("") : `<p class="muted small pad">Nenhum.</p>`}</div>
          </div>
          <div class="card">
            <div class="card-head"><h2>Receitas por tipo</h2><span class="pill pos">${GF.brl(tot.r)}</span></div>
            ${rCat.length ? `<div class="type-list compact">${rCat.map(([c, v]) => `
              <div class="type-row" style="--c:${GF.corCategoria(c)}">
                <div class="type-name"><b>${GF.esc(c)}</b><small>${GF.esc(GF.finalidade("receita", c))}</small></div>
                <div class="type-val"><b>${GF.brl(v)}</b><small>${GF.pct(v / tot.r)} · ${GF.brl(v / n)}/mês</small></div>
                <div class="bar"><i style="width:${(v / tot.r) * 100}%"></i></div>
              </div>`).join("")}</div>` : `<p class="muted small pad">Nenhuma receita no período.</p>`}
          </div>
        </section>

        <section class="card">
          <div class="card-head"><h2>Mês a mês</h2></div>
          <div class="table-wrap"><table class="table">
            <thead><tr><th>Mês</th><th class="num">Receitas</th><th class="num">Gastos</th><th class="num">Saldo</th><th class="num">Acumulado</th>
              ${GF.db.categorias.gasto.map((c) => `<th class="num">${GF.esc(c)}</th>`).join("")}</tr></thead>
            <tbody>${serie.map((s) => `<tr>
              <td><strong>${GF.mesMedio(GF.ym(s.m))}</strong></td>
              <td class="num pos">${GF.brl(s.receitas)}</td><td class="num neg">${GF.brl(s.gastos)}</td>
              <td class="num ${s.saldo < 0 ? "neg" : ""}"><b>${GF.brl(s.saldo)}</b></td>
              <td class="num">${GF.brl(GF.acumulado(s.m))}</td>
              ${GF.db.categorias.gasto.map((c) => `<td class="num muted">${GF.brl(GF.ocorrencias(s.m).filter((o) => o.l.tipo === "gasto" && o.l.categoria === c).reduce((a, o) => a + o.valor, 0))}</td>`).join("")}
            </tr>`).join("")}</tbody>
          </table></div>
        </section>`;

      view.querySelectorAll("[data-per]").forEach((b) => (b.onclick = () => {
        estado.periodo = b.dataset.per === "tudo" ? "tudo" : Number(b.dataset.per); GF.render();
      }));
      view.querySelectorAll("[data-freq]").forEach((b) => (b.onclick = () => { estado.freq = b.dataset.freq; GF.render(); }));
      view.querySelectorAll(".exc-item[data-id]").forEach((el) => (el.onclick = () => {
        const l = GF.db.lancamentos.find((x) => x.id === el.dataset.id); if (l) GF.abrirFormulario({ lanc: l });
      }));
      GF.ligarLinhas(view.querySelector("[data-lista-maiores]"));

      const verde = GF.cssVar("--income"), terra = GF.cssVar("--expense"), ouro = GF.cssVar("--gold");
      const claro = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c + "59" : c);
      const todos = [...serie, ...proj], nReal = serie.length;
      const cores = (c) => todos.map((_, i) => (i < nReal ? c : claro(c)));
      GF.grafico(view.querySelector("[data-ch-meses]"), {
        type: "bar",
        data: {
          labels: todos.map((s) => GF.mesCurto(GF.ym(s.m))),
          datasets: [
            { label: "Receitas", data: todos.map((s) => s.receitas), backgroundColor: cores(verde), borderColor: verde,
              borderWidth: todos.map((_, i) => (i < nReal ? 0 : 1.5)), borderSkipped: false, borderRadius: 6, maxBarThickness: 34, order: 2 },
            { label: "Gastos", data: todos.map((s) => s.gastos), backgroundColor: cores(terra), borderColor: terra,
              borderWidth: todos.map((_, i) => (i < nReal ? 0 : 1.5)), borderSkipped: false, borderRadius: 6, maxBarThickness: 34, order: 2 },
            { label: "Saldo do mês", data: todos.map((s) => s.saldo), type: "line", borderColor: ouro, backgroundColor: ouro,
              borderWidth: 3, pointRadius: todos.map((_, i) => (i < nReal ? 4 : 3)), tension: 0.3, order: 1,
              segment: { borderDash: (ctx) => (ctx.p1DataIndex >= nReal ? [6, 5] : undefined) } },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
          plugins: { legend: { position: "bottom" }, tooltip: { callbacks: {
            title: (it) => it[0].label + (it[0].dataIndex >= nReal ? " (projeção)" : ""),
            label: (c) => `${c.dataset.label}: ${GF.brl(c.raw)}` } } },
          scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v) => GF.brlCurto(v) }, grid: {} } },
        },
      });
      GF.grafico(view.querySelector("[data-ch-tipos]"), {
        type: "doughnut",
        data: { labels: gCat.map((x) => x[0]), datasets: [{ data: gCat.map((x) => x[1]), backgroundColor: gCat.map((x) => GF.corCategoria(x[0])), borderColor: GF.cssVar("--surface"), borderWidth: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, cutout: "68%",
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `${c.label}: ${GF.brl(c.raw)} (${GF.pct(c.raw / tot.g)})` } } } },
      });
    },
  };
})();
