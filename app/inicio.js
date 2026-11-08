
/* Página inicial: resumo do mês, formulário de cadastro sempre visível e listas do mês. */
(function () {
  const GF = window.GF;
  GF.pages = GF.pages || {};
  const filtro = { tipo: "todos", busca: "" };

  GF.linhaLanc = function (o, { mostrarMes = false } = {}) {
    const l = o.l, cor = GF.corCategoria(l.categoria);
    const receita = l.tipo === "receita";

    return `
      <div class="row-item ${o.pago ? "is-paid" : ""}" data-id="${l.id}" data-ym="${o.ym}" tabindex="0">
        <span class="dot" style="--c:${cor}">${GF.esc(l.categoria.charAt(0))}</span>
        <div class="ri-main">
          <strong>${GF.esc(l.descricao)}</strong>
          <small>${mostrarMes ? GF.mesMedio(o.ym) + " · " : ""}${GF.esc(l.categoria)}${receita ? "" : " · " + GF.esc(GF.formaTexto(l))} ${GF.badgeLanc(l, o.k)}</small>
        </div>
        <div class="ri-val ${receita ? "pos" : "neg"}">${receita ? "+" : "−"} ${GF.brl(o.valor)}</div>
        ${receita ? `<span class="pay-spacer"></span>` :
        `<button class="pay-toggle ${o.pago ? "on" : ""}" type="button" data-pagar title="${o.pago ? "Pago — clique para marcar como pendente" : "Pendente — clique para marcar como pago"}">${GF.icon.check}</button>`}
      </div>`;
  };

  /** Liga cliques das linhas (editar e marcar pago) dentro de um container */
  GF.ligarLinhas = function (container) {
    container.addEventListener("click", async (e) => {
      const item = e.target.closest(".row-item");
      if (!item || !container.contains(item)) return;

      const l = GF.db.lancamentos.find((x) => x.id === item.dataset.id);
      if (!l) return;

      const botaoPagar = e.target.closest("[data-pagar]");

      if (botaoPagar) {
        if (botaoPagar.disabled) return;

        const ym = item.dataset.ym || GF.state.mes;

        botaoPagar.disabled = true;

        if (l.pagos[ym]) {
          delete l.pagos[ym];
        } else {
          l.pagos[ym] = true;
        }

        try {
          await GF.save();
        } catch (erro) {
          if (botaoPagar.isConnected) {
            botaoPagar.disabled = false;
          }
        }

        return;
      }

      GF.abrirFormulario({ lanc: l });
    });

    container.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.classList.contains("row-item")) {
        e.target.click();
      }
    });
  };

  GF.pages.inicio = {
    titulo: "Cadastro",

    render(view, top) {
      const k = GF.mi(GF.state.mes);
      const t = GF.totais(k);
      const acum = GF.acumulado(k);
      const ocorr = GF.ocorrencias(k);

      document.getElementById("pageSub").textContent =
        "Resumo de " + GF.nomeMes(GF.state.mes);

      top.append(GF.seletorMes(() => GF.render()));

      const receitas = ocorr
        .filter((o) => o.l.tipo === "receita")
        .sort((a, b) => b.valor - a.valor);

      const gastosTodos = ocorr.filter((o) => o.l.tipo === "gasto");
      const ant = GF.totais(k - 1);
      const varG = ant.gastos ? (t.gastos - ant.gastos) / ant.gastos : null;

      const porCat = {};

      gastosTodos.forEach((o) => {
        porCat[o.l.categoria] = (porCat[o.l.categoria] || 0) + o.valor;
      });

      const tiposMostrar = [
        ...new Set([...GF.db.categorias.gasto, ...Object.keys(porCat)])
      ];

      view.innerHTML = `
        <section class="kpis">
          <div class="kpi kpi-income">
            <span class="kpi-label">Receitas do mês</span>
            <strong class="kpi-value">${GF.brl(t.receitas)}</strong>
            <span class="kpi-sub">${receitas.length} ${receitas.length === 1 ? "entrada" : "entradas"}</span>
          </div>

          <div class="kpi kpi-expense">
            <span class="kpi-label">Gastos do mês</span>
            <strong class="kpi-value">${GF.brl(t.gastos)}</strong>
            <span class="kpi-sub">${t.receitas ? GF.pct(t.gastos / t.receitas) + " da renda" : "sem receitas no mês"}${varG !== null ? ` · <b class="${varG > 0 ? "neg" : "pos"}">${varG > 0 ? "▲" : "▼"} ${GF.pct(Math.abs(varG))}</b> vs mês anterior` : ""}</span>
          </div>

          <div class="kpi kpi-balance ${t.saldo < 0 ? "is-neg" : ""}">
            <span class="kpi-label">Saldo do mês</span>
            <strong class="kpi-value">${GF.brl(t.saldo)}</strong>
            <span class="kpi-sub">${t.pendente > 0 ? `${GF.brl(t.pendente)} ainda a pagar` : gastosTodos.length ? "tudo pago ✓" : "nenhum gasto ainda"}</span>
          </div>

          <div class="kpi kpi-gold ${acum < 0 ? "is-neg" : ""}">
            <span class="kpi-label">Saldo acumulado</span>
            <strong class="kpi-value">${GF.brl(acum)}</strong>
            <span class="kpi-sub">desde ${GF.mesMedio(GF.ym(GF.primeiroMesIdx()))}</span>
          </div>
        </section>

        <section class="layout-form">
          <div class="card card-form">
            <div class="card-head">
              <h2>Cadastrar</h2>
              <span class="muted small">Tudo que você cadastra fica salvo automaticamente</span>
            </div>
            <div data-form></div>
          </div>

          <div class="stack">
            <div class="card">
              <div class="card-head">
                <h2>Gastos por tipo</h2>
                <span class="pill neg">${GF.brl(t.gastos)}</span>
              </div>
              <div class="type-list">${tiposMostrar.map((c) => {
                const v = porCat[c] || 0;

                return `<div class="type-row" style="--c:${GF.corCategoria(c)}">
                  <div class="type-name">
                    <b>${GF.esc(c)}</b>
                    <small>${GF.esc(GF.finalidade("gasto", c))}</small>
                  </div>
                  <div class="type-val">
                    <b>${GF.brl(v)}</b>
                    <small>${t.gastos ? GF.pct(v / t.gastos) : "–"}</small>
                  </div>
                  <div class="bar">
                    <i style="width:${t.gastos ? (v / t.gastos) * 100 : 0}%"></i>
                  </div>
                </div>`;
              }).join("")}</div>
            </div>

            <div class="card">
              <div class="card-head">
                <h2>Receitas</h2>
                <span class="pill pos">${GF.brl(t.receitas)}</span>
              </div>
              <div class="list" data-lista-rec>
                ${receitas.length
                  ? receitas.map((o) => GF.linhaLanc(o)).join("")
                  : `<p class="muted small pad">Nenhuma receita em ${GF.nomeMes(GF.state.mes).split(" ")[0]}.</p>`}
              </div>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <h2>Gastos de ${GF.nomeMes(GF.state.mes).split(" ")[0]}</h2>
            <div class="search">
              ${GF.icon.search}
              <input type="search" placeholder="Buscar gasto" value="${GF.esc(filtro.busca)}" data-busca>
            </div>
          </div>

          <div class="chips">
            ${[["todos", "Todos"], ["cartao", "No cartão"], ["parcelado", "Parcelados"], ["fixo", "Todo mês"], ["pendente", "A pagar"]]
              .map(([v, n]) => `<button type="button" class="chip ${filtro.tipo === v ? "on" : ""}" data-f="${v}">${n}</button>`).join("")}
          </div>

          <div class="list" data-lista-gastos></div>
        </section>`;

      // Formulário fixo
      const form = GF.criarFormulario({
        inline: true,
        tipo: GF.state.ultimoTipo || "gasto",
        mes: GF.state.mes
      });

      view.querySelector("[data-form]").appendChild(form);

      const lista = view.querySelector("[data-lista-gastos]");

      function desenharLista() {
        const q = GF.normTexto(filtro.busca);

        const g = gastosTodos
          .filter((o) => {
            if (filtro.tipo === "cartao" && o.l.forma !== "credito") return false;
            if (filtro.tipo === "parcelado" && o.l.repeticao !== "parcelada") return false;
            if (filtro.tipo === "fixo" && o.l.repeticao !== "mensal") return false;
            if (filtro.tipo === "pendente" && o.pago) return false;

            if (
              q &&
              !GF.normTexto(
                o.l.descricao + " " + o.l.categoria + " " + GF.formaTexto(o.l)
              ).includes(q)
            ) return false;

            return true;
          })
          .sort((a, b) => (a.pago - b.pago) || b.valor - a.valor);

        const soma = g.reduce((s, o) => s + o.valor, 0);

        lista.innerHTML = g.length
          ? g.map((o) => GF.linhaLanc(o)).join("") +
            `<div class="list-total">
              <span>${g.length} ${g.length === 1 ? "gasto" : "gastos"}</span>
              <b>${GF.brl(soma)}</b>
            </div>`
          : `<p class="muted small pad">${gastosTodos.length
              ? "Nada por aqui com esse filtro."
              : "Nenhum gasto cadastrado neste mês. Use o formulário acima."}</p>`;
      }

      desenharLista();

      view.querySelectorAll("[data-f]").forEach((b) => {
        b.onclick = () => {
          filtro.tipo = b.dataset.f;

          view.querySelectorAll("[data-f]").forEach((x) => {
            x.classList.toggle("on", x === b);
          });

          desenharLista();
        };
      });

      view.querySelector("[data-busca]").addEventListener("input", (e) => {
        filtro.busca = e.target.value;
        desenharLista();
      });

      GF.ligarLinhas(lista);
      GF.ligarLinhas(view.querySelector("[data-lista-rec]"));
    },
  };
})();
