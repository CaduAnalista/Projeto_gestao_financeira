/* Camada de dados: guarda tudo no navegador (localStorage) e faz as contas de meses e parcelas. */
(function () {
  const GF = (window.GF = window.GF || {});
  const KEY = "gestao-financeira:v1";

  GF.FORMAS = { pix: "Pix", debito: "Débito", dinheiro: "Dinheiro", boleto: "Boleto", credito: "Cartão de crédito" };
  GF.REPETICOES = { unica: "Única", parcelada: "Parcelada", mensal: "Todo mês" };
  GF.CAT_RESERVA = "Investimentos";
  /** Tipos de gasto e para que serve cada um (aparece na tela na hora de cadastrar) */
  GF.TIPOS_GASTO = [
    { nome: "Fixos", finalidade: "Compromissos mensais", exemplo: "aluguel, condomínio, luz, internet, escola" },
    { nome: "Variáveis", finalidade: "Necessidades de consumo", exemplo: "mercado, farmácia, gasolina, padaria" },
    { nome: "Supérfluos", finalidade: "Desejos e lazer", exemplo: "lanches, delivery, cinema, roupas, passeios" },
    { nome: "Financeiros", finalidade: "Custos com crédito e bancos", exemplo: "juros, tarifas, anuidade, empréstimos" },
    { nome: "Extraordinários", finalidade: "Imprevistos e eventualidades", exemplo: "conserto, exame, multa, presente" },
    { nome: "Investimentos", finalidade: "Construção de patrimônio", exemplo: "reserva, poupança, previdência" },
  ];
  GF.TIPOS_RECEITA = [
    { nome: "Salário", finalidade: "Renda do trabalho" },
    { nome: "Renda extra", finalidade: "Bicos, vendas, trabalhos extras" },
    { nome: "Aluguel recebido", finalidade: "Imóveis alugados" },
    { nome: "Benefícios", finalidade: "13º, férias, FGTS, auxílios" },
    { nome: "Ajuda da família", finalidade: "Valores recebidos de familiares" },
    { nome: "Resgate de investimento", finalidade: "Dinheiro tirado da reserva" },
    { nome: "Outras receitas", finalidade: "Qualquer outra entrada" },
  ];
  GF.finalidade = (tipo, cat) =>
    ((tipo === "receita" ? GF.TIPOS_RECEITA : GF.TIPOS_GASTO).find((t) => t.nome === cat) || {}).finalidade || "";

  GF.CORES = ["#8B5A2B", "#C49A3A", "#A0522D", "#6B7B4B", "#D4A373", "#7F5539", "#B08968", "#9C6644",
    "#5E503F", "#C9A227", "#8C7051", "#BC6C25", "#6F4E37", "#DDA15E", "#A68A64", "#4F3B2A", "#B5835A", "#8A9A5B"];

  function defaults() {
    return {
      versao: 1,
      categorias: {
        receita: GF.TIPOS_RECEITA.map((t) => t.nome),
        gasto: GF.TIPOS_GASTO.map((t) => t.nome),
      },
      cartoes: ["Cartão Millene", "Cartão Kadu", "Cartão Mãe"],
      lancamentos: [],
    };
  }

  function normalizaLanc(l) {
    return {
      id: l.id || GF.uid(),
      tipo: l.tipo === "receita" ? "receita" : "gasto",
      descricao: String(l.descricao || "").trim() || "Sem descrição",
      categoria: l.categoria || (l.tipo === "receita" ? "Outras receitas" : "Variáveis"),
      valor: Math.round(Number(l.valor || 0) * 100) / 100,
      mes: /^\d{4}-\d{2}$/.test(l.mes) ? l.mes : GF.mesAtual(),
      forma: GF.FORMAS[l.forma] ? l.forma : "pix",
      cartao: l.forma === "credito" ? l.cartao || "" : "",
      repeticao: GF.REPETICOES[l.repeticao] ? l.repeticao : "unica",
      parcelas: l.repeticao === "parcelada" ? Math.max(2, parseInt(l.parcelas, 10) || 2) : null,
      parcelaInicial: l.repeticao === "parcelada" ? Math.max(1, parseInt(l.parcelaInicial, 10) || 1) : null,
      ate: l.repeticao === "mensal" && /^\d{4}-\d{2}$/.test(l.ate || "") ? l.ate : null,
      pagos: l.pagos && typeof l.pagos === "object" ? l.pagos : {},
      obs: String(l.obs || ""),
      criadoEm: l.criadoEm || new Date().toISOString(),
    };
  }

  function normaliza(d) {
    const base = defaults();
    const out = {
      versao: 1,
      categorias: {
        receita: Array.isArray(d?.categorias?.receita) && d.categorias.receita.length ? d.categorias.receita : base.categorias.receita,
        gasto: Array.isArray(d?.categorias?.gasto) && d.categorias.gasto.length ? d.categorias.gasto : base.categorias.gasto,
      },
      cartoes: Array.isArray(d?.cartoes) ? d.cartoes : base.cartoes,
      lancamentos: Array.isArray(d?.lancamentos) ? d.lancamentos.map(normalizaLanc) : [],
    };
    // garante que categorias e cartões usados nos lançamentos existam nas listas
    for (const l of out.lancamentos) {
      const lista = out.categorias[l.tipo];
      if (!lista.includes(l.categoria)) lista.push(l.categoria);
      if (l.cartao && !out.cartoes.includes(l.cartao)) out.cartoes.push(l.cartao);
    }
    return out;
  }
  GF.normaliza = normaliza;
  GF.normalizaLanc = normalizaLanc;

  GF.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  GF.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normaliza(JSON.parse(raw));
    } catch (e) { /* armazenamento indisponível */ }
    return defaults();
  };

  const ouvintes = [];
  GF.onChange = (fn) => ouvintes.push(fn);
  GF.save = function () {
    try {
      localStorage.setItem(KEY, JSON.stringify(GF.db));
    } catch (e) {
      if (GF.toast) GF.toast("Não consegui salvar no navegador. Faça um backup em Ajustes.", "erro");
    }
    cache.clear();
    ouvintes.forEach((fn) => fn());
  };
  GF.substituirTudo = function (dados) {
    GF.db = normaliza(dados);
    GF.save();
  };
  GF.apagarTudo = function () {
    GF.db = defaults();
    GF.save();
  };

  /* ---------- meses ---------- */
  GF.mi = (ym) => { const [y, m] = ym.split("-").map(Number); return y * 12 + m - 1; };
  GF.ym = (i) => `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
  GF.mesAtual = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
  GF.somaMes = (ym, n) => GF.ym(GF.mi(ym) + n);

  /* ---------- parcelas e repetição ---------- */
  GF.inicioIdx = (l) => GF.mi(l.mes);
  GF.fimIdx = (l) => {
    if (l.repeticao === "parcelada") return GF.mi(l.mes) + l.parcelas - l.parcelaInicial;
    if (l.repeticao === "mensal") return l.ate ? GF.mi(l.ate) : Infinity;
    return GF.mi(l.mes);
  };
  GF.ativo = (l, k) => GF.inicioIdx(l) <= k && k <= GF.fimIdx(l);
  GF.parcelaNo = (l, k) => k - GF.inicioIdx(l) + l.parcelaInicial;
  /** Situação de uma compra parcelada vista a partir do mês k */
  GF.infoParcelas = (l, k) => {
    const ini = GF.inicioIdx(l), fim = GF.fimIdx(l);
    let atual = null, faltam;
    if (k < ini) faltam = l.parcelas - l.parcelaInicial + 1;   // ainda não começou: todas pela frente
    else if (k > fim) faltam = 0;                               // já terminou
    else { atual = GF.parcelaNo(l, k); faltam = l.parcelas - atual; } // faltam DEPOIS deste mês
    return {
      total: l.parcelas,
      atual,
      faltam,
      terminaEm: GF.ym(fim),
      valorTotal: l.valor * l.parcelas,
      restante: l.valor * faltam,
      terminou: k > fim,
      naoComecou: k < GF.inicioIdx(l),
    };
  };

  const cache = new Map();
  GF.limparCache = () => cache.clear();
  /** Tudo que conta no mês k (índice de mês) */
  GF.ocorrencias = function (k) {
    if (cache.has(k)) return cache.get(k);
    const ymk = GF.ym(k);
    const lista = GF.db.lancamentos
      .filter((l) => GF.ativo(l, k))
      .map((l) => ({
        l, k, ym: ymk, valor: l.valor,
        parcela: l.repeticao === "parcelada" ? GF.parcelaNo(l, k) : null,
        pago: !!l.pagos[ymk],
      }));
    cache.set(k, lista);
    return lista;
  };
  GF.totais = function (k) {
    let receitas = 0, gastos = 0, pendente = 0, cartao = 0, reserva = 0;
    for (const o of GF.ocorrencias(k)) {
      if (o.l.tipo === "receita") receitas += o.valor;
      else {
        gastos += o.valor;
        if (!o.pago) pendente += o.valor;
        if (o.l.forma === "credito") cartao += o.valor;
        if (o.l.categoria === GF.CAT_RESERVA) reserva += o.valor;
      }
    }
    return { receitas, gastos, saldo: receitas - gastos, pendente, cartao, reserva };
  };
  GF.primeiroMesIdx = function () {
    let min = Infinity;
    for (const l of GF.db.lancamentos) min = Math.min(min, GF.inicioIdx(l));
    return min === Infinity ? GF.mi(GF.mesAtual()) : min;
  };
  GF.ultimoMesIdx = function () {
    let max = -Infinity;
    for (const l of GF.db.lancamentos) {
      const f = GF.fimIdx(l);
      max = Math.max(max, f === Infinity ? GF.inicioIdx(l) : f, GF.inicioIdx(l));
    }
    return max === -Infinity ? GF.mi(GF.mesAtual()) : max;
  };
  /** Último mês com algum lançamento "de verdade" (sem contar só parcelas futuras) */
  GF.ultimoMesComLancamento = function () {
    let max = -Infinity;
    for (const l of GF.db.lancamentos) if (l.repeticao !== "parcelada") max = Math.max(max, GF.inicioIdx(l));
    return max === -Infinity ? GF.mi(GF.mesAtual()) : max;
  };
  GF.acumulado = function (k) {
    let s = 0;
    for (let i = GF.primeiroMesIdx(); i <= k; i++) s += GF.totais(i).saldo;
    return s;
  };

  GF.descricoesUsadas = function () {
    const set = new Map();
    for (const l of GF.db.lancamentos) set.set(l.descricao.toLowerCase(), l);
    return [...set.values()];
  };

  GF.normTexto = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

  GF.corCategoria = function (cat) {
    const todas = [...GF.db.categorias.gasto, ...GF.db.categorias.receita];
    const i = todas.indexOf(cat);
    if (i >= 0) return GF.CORES[i % GF.CORES.length];
    let h = 0; for (const c of cat) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return GF.CORES[h % GF.CORES.length];
  };

  GF.db = GF.load();
  GF.state = { mes: GF.mesAtual() };
})();
