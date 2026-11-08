
/* Formulário de lançamento (receita ou gasto), com parcelas e repetição mensal.
   Usado fixo na tela inicial e também em janela (para editar). */
(function () {
  const GF = window.GF;

  GF.parseValor = function (s) {
    s = String(s || "").replace(/[R$\s]/g, "");
    if (!s) return NaN;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    return Number(s);
  };

  const valorTexto = (v) =>
    (v || v === 0 ? Number(v).toFixed(2).replace(".", ",") : "");

  function infoCategoria(tipo, nome) {
    const lista = tipo === "receita" ? GF.TIPOS_RECEITA : GF.TIPOS_GASTO;
    return lista.find((t) => t.nome === nome) ||
      { nome, finalidade: "Categoria personalizada" };
  }

  GF.criarFormulario = function ({
    lanc = null,
    tipo = "gasto",
    mes = GF.state.mes,
    forma = "pix",
    repeticao = "unica",
    inline = false,
    aoSalvar,
    aoCancelar
  } = {}) {
    const ed = lanc
      ? { ...lanc, pagos: { ...lanc.pagos } }
      : {
          tipo,
          descricao: "",
          categoria: "",
          valor: "",
          mes,
          forma,
          cartao: GF.state.ultimoCartao || GF.db.cartoes[0] || "",
          repeticao,
          parcelas: 2,
          parcelaInicial: 1,
          ate: null,
          pagos: {},
          obs: "",
        };

    let modoValor = "parcela";

    const f = GF.h(`
      <form class="form ${inline ? "form-inline" : ""}" novalidate autocomplete="off">
        <div class="seg seg-tipo" role="radiogroup" aria-label="Tipo">
          <button type="button" data-tipo="receita" class="seg-rec">${GF.icon.up} Receita</button>
          <button type="button" data-tipo="gasto" class="seg-gas">${GF.icon.down} Gasto</button>
        </div>

        <div class="field">
          <span data-rotulo-cat>Tipo de gasto</span>
          <div class="cat-grid" data-cats role="radiogroup"></div>
        </div>

        <div class="grid-form">
          <label class="field f-desc">
            <span>Descrição</span>
            <input name="descricao" list="dl-desc-${inline ? "i" : "m"}" placeholder="Ex.: Mercado, Salário, Netflix" required>
            <datalist id="dl-desc-${inline ? "i" : "m"}"></datalist>
          </label>
          <label class="field f-valor">
            <span data-rotulo-valor>Valor</span>
            <div class="input-money"><em>R$</em><input name="valor" inputmode="decimal" placeholder="0,00" required></div>
          </label>
          <label class="field f-mes">
            <span>Mês</span>
            <input name="mes" type="month" required>
          </label>
          <label class="field f-forma" data-so-gasto>
            <span>Pagamento</span>
            <select name="forma">
              ${Object.entries(GF.FORMAS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")}
            </select>
          </label>
          <label class="field f-cartao" data-so-cartao>
            <span>Qual cartão?</span>
            <select name="cartao"></select>
          </label>
        </div>

        <div class="field">
          <span>Repetição</span>
          <div class="seg seg-rep" role="radiogroup" aria-label="Repetição">
            <button type="button" data-rep="unica">Só este mês</button>
            <button type="button" data-rep="parcelada" data-so-gasto-btn>Parcelado</button>
            <button type="button" data-rep="mensal">Todo mês</button>
          </div>
        </div>

        <div class="sub-box" data-box-parcelas>
          <div class="grid-3">
            <label class="field">
              <span>Nº de parcelas</span>
              <input name="parcelas" type="number" min="2" max="120" inputmode="numeric">
            </label>
            <label class="field">
              <span>Neste mês é a parcela nº</span>
              <input name="parcelaInicial" type="number" min="1" max="120" inputmode="numeric">
            </label>
            <div class="field">
              <span>O valor digitado é</span>
              <div class="seg seg-sm">
                <button type="button" data-modo="parcela">da parcela</button>
                <button type="button" data-modo="total">o total</button>
              </div>
            </div>
          </div>
          <p class="hint" data-preview-parc></p>
        </div>

        <div class="sub-box" data-box-mensal>
          <label class="field">
            <span>Repetir até (opcional)</span>
            <input name="ate" type="month">
          </label>
          <p class="hint">Sem data final, aparece em todos os meses a partir do mês escolhido.</p>
        </div>

        <div class="form-foot">
          <label class="check" data-so-gasto>
            <input type="checkbox" name="pago"> <span>Já paguei este mês</span>
          </label>
          <label class="field f-obs">
            <input name="obs" placeholder="Observação (opcional)">
          </label>
        </div>

        <p class="form-error" role="alert"></p>
        <div class="form-actions">
          ${lanc ? `<button type="button" class="btn btn-danger-ghost" data-excluir>${GF.icon.trash} Excluir</button>` : ""}
          <span class="spacer"></span>
          ${inline
            ? `<button type="reset" class="btn btn-ghost" data-limpar>Limpar</button>`
            : `<button type="button" class="btn btn-ghost" data-cancelar>Cancelar</button>`}
          <button type="submit" class="btn btn-primary btn-save">${GF.icon.check} <span data-txt-salvar>Salvar</span></button>
        </div>
      </form>`);

    const $ = (s) => f.querySelector(s);
    const campo = (n) => f.elements[n];

    function preencherCampos() {
      campo("descricao").value = ed.descricao;
      campo("valor").value = valorTexto(ed.valor);
      campo("mes").value = ed.mes;
      campo("forma").value = ed.forma;
      campo("parcelas").value = ed.parcelas || 2;
      campo("parcelaInicial").value = ed.parcelaInicial || 1;
      campo("ate").value = ed.ate || "";
      campo("obs").value = ed.obs || "";
      campo("pago").checked = !!(ed.pagos && ed.pagos[ed.mes]);
    }

    function preencheSugestoes() {
      $("datalist").innerHTML = GF.descricoesUsadas()
        .filter((l) => l.tipo === ed.tipo)
        .map((l) => `<option value="${GF.esc(l.descricao)}"></option>`)
        .join("");
    }

    function desenharCategorias() {
      const lista = GF.db.categorias[ed.tipo];

      if (!lista.includes(ed.categoria)) ed.categoria = "";

      $("[data-cats]").innerHTML = lista.map((c) => {
        const i = infoCategoria(ed.tipo, c);

        return `<button type="button" class="cat-opt ${c === ed.categoria ? "on" : ""}" data-cat="${GF.esc(c)}"
            style="--c:${GF.corCategoria(c)}" title="${GF.esc(i.exemplo ? "Ex.: " + i.exemplo : i.finalidade)}">
            <b>${GF.esc(c)}</b><small>${GF.esc(i.finalidade)}</small></button>`;
      }).join("");

      $("[data-rotulo-cat]").textContent =
        ed.tipo === "receita" ? "Tipo de receita" : "Tipo de gasto";
    }

    function preencheCartoes() {
      const lista = GF.db.cartoes.length ? GF.db.cartoes : ["Cartão"];

      if (!lista.includes(ed.cartao)) ed.cartao = lista[0];

      campo("cartao").innerHTML = lista
        .map((c) => `<option ${c === ed.cartao ? "selected" : ""}>${GF.esc(c)}</option>`)
        .join("");
    }

    function atualizar() {
      f.classList.toggle("is-receita", ed.tipo === "receita");

      f.querySelectorAll("[data-tipo]").forEach((b) =>
        b.classList.toggle("on", b.dataset.tipo === ed.tipo)
      );

      f.querySelectorAll("[data-rep]").forEach((b) =>
        b.classList.toggle("on", b.dataset.rep === ed.repeticao)
      );

      f.querySelectorAll("[data-modo]").forEach((b) =>
        b.classList.toggle("on", b.dataset.modo === modoValor)
      );

      const gasto = ed.tipo === "gasto";

      f.querySelectorAll("[data-so-gasto]").forEach((e) => (e.hidden = !gasto));
      f.querySelectorAll("[data-so-gasto-btn]").forEach((e) => (e.hidden = !gasto));

      $("[data-so-cartao]").hidden =
        !(gasto && campo("forma").value === "credito");

      $("[data-box-parcelas]").hidden = ed.repeticao !== "parcelada";
      $("[data-box-mensal]").hidden = ed.repeticao !== "mensal";

      $("[data-rotulo-valor]").textContent =
        ed.repeticao === "parcelada"
          ? (modoValor === "total" ? "Valor total da compra" : "Valor da parcela")
          : ed.repeticao === "mensal"
            ? "Valor por mês"
            : "Valor";

      $("[data-txt-salvar]").textContent =
        lanc ? "Salvar alterações" : gasto ? "Cadastrar gasto" : "Cadastrar receita";

      previewParcelas();
    }

    function previewParcelas() {
      if (ed.repeticao !== "parcelada") return;

      const n = parseInt(campo("parcelas").value, 10);
      const p0 = parseInt(campo("parcelaInicial").value, 10) || 1;
      const v = GF.parseValor(campo("valor").value);
      const mes = campo("mes").value;
      const el = $("[data-preview-parc]");

      if (!(n >= 2) || !mes) {
        el.textContent = "Informe o número de parcelas.";
        return;
      }

      if (p0 > n) {
        el.textContent = "A parcela deste mês não pode ser maior que o total.";
        return;
      }

      const parcela = modoValor === "total" ? v / n : v;
      const fim = GF.somaMes(mes, n - p0);
      const ok = isFinite(parcela) && parcela > 0;

      el.innerHTML =
        `${ok ? `<strong>${n}x de ${GF.brl(parcela)}</strong> · ` : ""}parcela ${p0} em ${GF.mesMedio(mes)}` +
        ` · faltam ${n - p0} depois deste mês · <strong>termina em ${GF.mesMedio(fim)}</strong>` +
        `${ok ? ` · total ${GF.brl(parcela * n)}` : ""}`;
    }

    function inicial() {
      preencherCampos();
      preencheSugestoes();
      desenharCategorias();
      preencheCartoes();
      atualizar();
    }

    inicial();

    f.addEventListener("click", (e) => {
      const b = e.target.closest("button");

      if (!b || !f.contains(b)) return;

      if (b.dataset.tipo) {
        ed.tipo = b.dataset.tipo;
        ed.categoria = "";

        if (ed.tipo === "receita" && ed.repeticao === "parcelada") {
          ed.repeticao = "unica";
        }

        desenharCategorias();
        preencheSugestoes();
        atualizar();

      } else if (b.dataset.cat !== undefined) {
        ed.categoria = b.dataset.cat;

        f.querySelectorAll("[data-cat]").forEach((x) =>
          x.classList.toggle("on", x === b)
        );

        $(".form-error").textContent = "";

      } else if (b.dataset.rep) {
        ed.repeticao = b.dataset.rep;
        atualizar();

      } else if (b.dataset.modo) {
        modoValor = b.dataset.modo;
        atualizar();
      }
    });

    ["parcelas", "parcelaInicial", "valor", "mes"].forEach((n) =>
      campo(n).addEventListener("input", previewParcelas)
    );

    campo("forma").addEventListener("change", atualizar);
    campo("cartao").addEventListener("change", () =>
      (ed.cartao = campo("cartao").value)
    );

    campo("descricao").addEventListener("change", () => {
      if (lanc) return;

      const nome = campo("descricao").value.trim().toLowerCase();

      const ant = GF.descricoesUsadas().find(
        (l) => l.descricao.toLowerCase() === nome && l.tipo === ed.tipo
      );

      if (!ant) return;

      ed.categoria = ant.categoria;
      desenharCategorias();

      if (ant.tipo === "gasto") {
        campo("forma").value = ant.forma;

        if (ant.cartao) {
          ed.cartao = ant.cartao;
          preencheCartoes();
        }
      }

      if (!campo("valor").value) {
        campo("valor").value = valorTexto(ant.valor);
      }

      atualizar();
    });

    f.addEventListener("reset", (e) => {
      e.preventDefault();

      Object.assign(ed, {
        descricao: "",
        valor: "",
        categoria: "",
        repeticao: "unica",
        parcelas: 2,
        parcelaInicial: 1,
        ate: null,
        pagos: {},
        obs: ""
      });

      $(".form-error").textContent = "";
      inicial();
    });

    const cancelar = $("[data-cancelar]");

    if (cancelar) {
      cancelar.addEventListener("click", () => aoCancelar && aoCancelar());
    }

    // EXCLUSÃO: aguarda a confirmação da nuvem.
    const excluir = $("[data-excluir]");

    if (excluir) {
      excluir.addEventListener("click", async () => {
        const extra = lanc.repeticao !== "unica"
          ? " Ele some de todos os meses em que aparece."
          : "";

        if (!await GF.confirmar(
          `Excluir "${lanc.descricao}"?${extra}`,
          { ok: "Excluir", perigo: true }
        )) return;

        const anterior = [...GF.db.lancamentos];

        GF.db.lancamentos = GF.db.lancamentos.filter(
          (x) => x.id !== lanc.id
        );

        excluir.disabled = true;

        try {
          await GF.save();

          GF.toast("Lançamento excluído.");
          if (aoSalvar) aoSalvar();

        } catch (erro) {
          GF.db.lancamentos = anterior;
          GF.limparCache();
          GF.render();
          excluir.disabled = false;
        }
      });
    }

    // CADASTRO E EDIÇÃO: aguarda a confirmação da nuvem.
    f.addEventListener("submit", async (e) => {
      e.preventDefault();

      const erro = $(".form-error");
      const botaoSalvar = f.querySelector('[type="submit"]');

      const descricao = campo("descricao").value.trim();
      let valor = GF.parseValor(campo("valor").value);
      const mesV = campo("mes").value;

      const n = parseInt(campo("parcelas").value, 10);
      const p0 = parseInt(campo("parcelaInicial").value, 10) || 1;

      if (!ed.categoria) {
        return (erro.textContent =
          `Escolha o ${ed.tipo === "receita" ? "tipo de receita" : "tipo de gasto"}.`);
      }

      if (!descricao) {
        campo("descricao").focus();
        return (erro.textContent = "Escreva uma descrição.");
      }

      if (!(valor > 0)) {
        campo("valor").focus();
        return (erro.textContent = "Digite um valor maior que zero (ex.: 150,90).");
      }

      if (!mesV) return (erro.textContent = "Escolha o mês.");

      if (ed.repeticao === "parcelada") {
        if (!(n >= 2 && n <= 120)) {
          return (erro.textContent = "O número de parcelas deve ser de 2 a 120.");
        }

        if (p0 > n) {
          return (erro.textContent =
            "A parcela deste mês não pode ser maior que o total de parcelas.");
        }

        if (modoValor === "total") valor = valor / n;
      }

      const ate = campo("ate").value || null;

      if (ed.repeticao === "mensal" && ate && ate < mesV) {
        return (erro.textContent =
          "O 'repetir até' precisa ser depois do mês inicial.");
      }

      const forma = ed.tipo === "gasto"
        ? campo("forma").value
        : "pix";

      const pagos = { ...(ed.pagos || {}) };

      if (ed.tipo === "gasto") {
        if (campo("pago").checked) pagos[mesV] = true;
        else delete pagos[mesV];
      }

      const novo = GF.normalizaLanc({
        ...ed,
        descricao,
        valor,
        mes: mesV,
        forma,
        cartao: forma === "credito" ? campo("cartao").value : "",
        parcelas: n,
        parcelaInicial: p0,
        ate,
        pagos,
        obs: campo("obs").value.trim(),
      });

      const listaAnterior = [...GF.db.lancamentos];

      if (lanc) {
        const i = GF.db.lancamentos.findIndex((x) => x.id === lanc.id);

        if (i < 0) {
          erro.textContent = "Este lançamento não foi encontrado. Atualize a página.";
          return;
        }

        GF.db.lancamentos[i] = novo;

      } else {
        GF.db.lancamentos.push(novo);
      }

      GF.state.ultimoTipo = ed.tipo;

      if (forma === "credito") {
        GF.state.ultimoCartao = novo.cartao;
      }

      botaoSalvar.disabled = true;
      erro.textContent = "Salvando na nuvem...";

      try {
        await GF.save();

        GF.toast(
          lanc
            ? "Alterações salvas."
            : (ed.tipo === "receita"
              ? "Receita cadastrada e salva."
              : "Gasto cadastrado e salvo.")
        );

        if (aoSalvar) aoSalvar(novo);

      } catch (falha) {
        // GF.save já restaura o último estado confirmado.
        erro.textContent = falha.message || "Não foi possível salvar.";
        botaoSalvar.disabled = false;
      }
    });

    return f;
  };

  // Abre o formulário numa janela (usado para editar ou cadastrar de outras páginas).
  GF.abrirFormulario = function (opcoes = {}) {
    let modal;

    const form = GF.criarFormulario({
      ...opcoes,
      aoSalvar: () => modal.fechar(),
      aoCancelar: () => modal.fechar()
    });

    modal = GF.modal({
      titulo: opcoes.lanc ? "Editar lançamento" : "Novo lançamento",
      corpo: form,
      largura: "modal-md"
    });

    setTimeout(() => form.elements.descricao.focus(), 60);
  };

})();
