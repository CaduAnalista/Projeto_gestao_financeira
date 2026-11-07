/* Ajustes: tipos de gasto/receita, cartões, exportação e backup. */
(function () {
  const GF = window.GF;
  GF.pages = GF.pages || {};

  function baixar(nome, conteudo, tipo) {
    const blob = new Blob([conteudo], { type: tipo });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = nome;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const hoje = () => new Date().toISOString().slice(0, 10);

  GF.exportarCSV = function () {
    const fim = Math.max(GF.mi(GF.mesAtual()), GF.ultimoMesComLancamento(),
      ...GF.db.lancamentos.map((l) => (GF.fimIdx(l) === Infinity ? 0 : GF.fimIdx(l))));
    const linhas = [["Mês", "Tipo", "Categoria", "Descrição", "Pagamento", "Cartão", "Valor", "Parcela", "Total de parcelas",
      "Termina em", "Repetição", "Pago", "Observação"]];
    for (let k = GF.primeiroMesIdx(); k <= fim; k++) {
      for (const o of GF.ocorrencias(k)) {
        const l = o.l;
        linhas.push([GF.mesMedio(o.ym), l.tipo === "receita" ? "Receita" : "Gasto", l.categoria, l.descricao,
          l.tipo === "gasto" ? GF.FORMAS[l.forma] : "", l.cartao, o.valor.toFixed(2).replace(".", ","),
          o.parcela || "", l.repeticao === "parcelada" ? l.parcelas : "", l.repeticao === "parcelada" ? GF.mesMedio(GF.ym(GF.fimIdx(l))) : "",
          GF.REPETICOES[l.repeticao], l.tipo === "gasto" ? (o.pago ? "Sim" : "Não") : "", l.obs]);
      }
    }
    const csv = linhas.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(";")).join("\r\n");
    baixar(`financas-${hoje()}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
  };
  GF.exportarBackup = function () {
    baixar(`financas-backup-${hoje()}.json`, JSON.stringify(GF.db, null, 2), "application/json");
    try { localStorage.setItem("gestao-financeira:ultimo-backup", new Date().toISOString()); } catch (e) { }
  };

  function listaEditavel(titulo, itens, { info, usado, aoAdicionar, aoRemover, placeholder }) {
    return `
      <div class="card">
        <div class="card-head"><h2>${titulo}</h2></div>
        <div class="tag-list">
          ${itens.map((c) => `<div class="tag-item" style="--c:${GF.corCategoria(c)}">
            <span class="dot dot-sm"></span>
            <div><b>${GF.esc(c)}</b>${info && info(c) ? `<small>${GF.esc(info(c))}</small>` : ""}</div>
            <span class="muted small">${usado(c)} ${usado(c) === 1 ? "lançamento" : "lançamentos"}</span>
            <div class="tag-acoes">
              <button class="icon-btn" type="button" data-renomear="${GF.esc(c)}" data-lista="${aoRemover}" title="Renomear">${GF.icon.edit}</button>
              <button class="icon-btn" type="button" data-remover="${GF.esc(c)}" data-lista="${aoRemover}" title="Remover">${GF.icon.trash}</button>
            </div>
          </div>`).join("")}
        </div>
        <form class="add-row" data-add="${aoAdicionar}">
          <input placeholder="${placeholder}" maxlength="40" required>
          <button class="btn btn-ghost" type="submit">${GF.icon.plus} Adicionar</button>
        </form>
      </div>`;
  }

  GF.pages.config = {
    titulo: "Ajustes",
    render(view) {
      document.getElementById("pageSub").textContent = "Tipos, cartões e seus dados";
      const usos = (campo, v) => GF.db.lancamentos.filter((l) => l[campo] === v).length;
      let ultimo = null;
      try { ultimo = localStorage.getItem("gestao-financeira:ultimo-backup"); } catch (e) { }

      view.innerHTML = `
        <section class="card card-save">
          <div class="save-status">
            <span class="save-icon">${GF.icon.check}</span>
            <div>
              <h2>Seus dados ficam salvos automaticamente</h2>
              <p>Cada receita ou gasto que você cadastra é guardado na hora, neste navegador. Você tem
                <b>${GF.db.lancamentos.length}</b> ${GF.db.lancamentos.length === 1 ? "lançamento" : "lançamentos"} guardados.
                ${ultimo ? `Última cópia exportada em ${new Date(ultimo).toLocaleDateString("pt-BR")}.` : ""}</p>
            </div>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" type="button" data-csv>${GF.icon.download} Exportar para Excel (CSV)</button>
            <button class="btn btn-ghost" type="button" data-backup>${GF.icon.download} Baixar cópia de segurança</button>
            <label class="btn btn-ghost">${GF.icon.upload} Restaurar cópia<input type="file" accept=".json,application/json" data-restaurar hidden></label>
          </div>
          <p class="hint">Dica: de vez em quando baixe uma cópia de segurança. Se você limpar os dados do navegador ou trocar de computador,
            é com ela que você recupera tudo.</p>
        </section>

        <section class="layout-2 even">
          <div class="card">
            <div class="card-head"><h2>Tipos de gasto</h2><span class="muted small">fixos, usados em todo o app</span></div>
            <div class="tag-list">
              ${GF.TIPOS_GASTO.map((t) => `<div class="tag-item tag-fixo" style="--c:${GF.corCategoria(t.nome)}">
                <span class="dot dot-sm"></span>
                <div><b>${GF.esc(t.nome)}</b><small>${GF.esc(t.finalidade)}${t.exemplo ? " · " + GF.esc(t.exemplo) : ""}</small></div>
                <span class="muted small">${usos("categoria", t.nome)} ${usos("categoria", t.nome) === 1 ? "lançamento" : "lançamentos"}</span>
              </div>`).join("")}
            </div>
          </div>
          <div class="stack">
            ${listaEditavel("Tipos de receita", GF.db.categorias.receita, {
              info: (c) => GF.finalidade("receita", c), usado: (c) => usos("categoria", c),
              aoAdicionar: "receita", aoRemover: "receita", placeholder: "Novo tipo de receita",
            })}
            ${listaEditavel("Cartões de crédito", GF.db.cartoes, {
              usado: (c) => usos("cartao", c), aoAdicionar: "cartao", aoRemover: "cartao", placeholder: "Nome do cartão (ex.: Nubank Millene)",
            })}
          </div>
        </section>

        <section class="card card-danger">
          <div class="card-head"><h2>Zona de cuidado</h2></div>
          <p class="muted small">Apaga todos os lançamentos deste navegador. Baixe uma cópia de segurança antes.</p>
          <button class="btn btn-danger" type="button" data-apagar>${GF.icon.trash} Apagar todos os dados</button>
        </section>`;

      view.querySelector("[data-csv]").onclick = () => {
        if (!GF.db.lancamentos.length) return GF.toast("Ainda não há lançamentos para exportar.", "erro");
        GF.exportarCSV(); GF.toast("Planilha exportada. Abra o arquivo no Excel.");
      };
      view.querySelector("[data-backup]").onclick = () => { GF.exportarBackup(); GF.toast("Cópia de segurança baixada."); GF.render(); };
      view.querySelector("[data-restaurar]").onchange = (e) => {
        const file = e.target.files[0]; if (!file) return;
        const r = new FileReader();
        r.onload = async () => {
          try {
            const dados = JSON.parse(r.result);
            if (!Array.isArray(dados.lancamentos)) throw new Error("formato");
            if (await GF.confirmar(`Restaurar a cópia com ${dados.lancamentos.length} lançamentos? Os dados atuais deste navegador serão substituídos.`, { ok: "Restaurar" })) {
              GF.substituirTudo(dados); GF.toast("Cópia restaurada.");
            }
          } catch (err) { GF.toast("Esse arquivo não é uma cópia de segurança válida.", "erro"); }
        };
        r.readAsText(file);
        e.target.value = "";
      };
      view.querySelector("[data-apagar]").onclick = async () => {
        if (await GF.confirmar("Apagar TODOS os lançamentos deste navegador? Isso não pode ser desfeito.", { ok: "Apagar tudo", perigo: true })) {
          GF.apagarTudo(); GF.toast("Todos os dados foram apagados.");
        }
      };

      view.querySelectorAll("form[data-add]").forEach((form) => form.addEventListener("submit", (e) => {
        e.preventDefault();
        const nome = form.querySelector("input").value.trim();
        if (!nome) return;
        const alvo = form.dataset.add === "cartao" ? GF.db.cartoes : GF.db.categorias[form.dataset.add];
        if (alvo.some((x) => x.toLowerCase() === nome.toLowerCase())) return GF.toast("Esse nome já existe.", "erro");
        alvo.push(nome); GF.save(); GF.toast(`"${nome}" adicionado.`);
      }));
      view.querySelectorAll("[data-renomear]").forEach((b) => (b.onclick = () => {
        const antigo = b.dataset.renomear, lista = b.dataset.lista;
        const alvo = lista === "cartao" ? GF.db.cartoes : GF.db.categorias[lista];
        GF.modal({
          titulo: "Renomear", largura: "modal-sm",
          corpo: `<form class="form" data-ren>
              <label class="field"><span>Novo nome</span><input value="${GF.esc(antigo)}" maxlength="40" required></label>
              <p class="hint">Os lançamentos que usam “${GF.esc(antigo)}” também serão atualizados.</p>
              <div class="form-actions"><button type="button" class="btn btn-ghost" data-fechar>Cancelar</button>
              <button type="submit" class="btn btn-primary">Salvar</button></div></form>`,
          aoAbrir(el, fechar) {
            const inp = el.querySelector("input"); inp.focus(); inp.select();
            el.querySelector("[data-ren]").onsubmit = (e) => {
              e.preventDefault();
              const novo = inp.value.trim();
              if (!novo || novo === antigo) return fechar();
              if (alvo.some((x) => x !== antigo && x.toLowerCase() === novo.toLowerCase())) return GF.toast("Esse nome já existe.", "erro");
              alvo[alvo.indexOf(antigo)] = novo;
              GF.db.lancamentos.forEach((l) => {
                if (lista === "cartao" ? l.cartao === antigo : l.tipo === lista && l.categoria === antigo) l[lista === "cartao" ? "cartao" : "categoria"] = novo;
              });
              GF.save(); fechar(); GF.toast(`Renomeado para "${novo}".`);
            };
          },
        });
      }));
      view.querySelectorAll("[data-remover]").forEach((b) => (b.onclick = async () => {
        const nome = b.dataset.remover, lista = b.dataset.lista;
        const campo = lista === "cartao" ? "cartao" : "categoria";
        const n = GF.db.lancamentos.filter((l) => l[campo] === nome && (lista === "cartao" || l.tipo === lista)).length;
        if (n) return GF.toast(`"${nome}" está em ${n} lançamento(s). Troque esses lançamentos antes de remover.`, "erro");
        const alvo = lista === "cartao" ? GF.db.cartoes : GF.db.categorias[lista];
        if (lista !== "cartao" && alvo.length <= 1) return GF.toast("Precisa ter pelo menos um tipo.", "erro");
        if (await GF.confirmar(`Remover "${nome}"?`, { ok: "Remover", perigo: true })) {
          alvo.splice(alvo.indexOf(nome), 1); GF.save();
        }
      }));
    },
  };
})();
