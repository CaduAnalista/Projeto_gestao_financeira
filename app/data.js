
/* Camada de dados: Supabase + apoio localStorage.
   Mantém os cálculos de meses, parcelas e lançamentos. */
(function () {
  const GF = (window.GF = window.GF || {});
  const KEY = "gestao-financeira:v1";

  // CONFIGURAÇÃO DA NUVEM
  const API_URL = "https://xhyytfbgajgtcnlccmx.supabase.co/functions/v1/gestao-api";
  const ACCESS_KEY = "gestao-financeira:codigo-acesso";

  let versaoNuvem = 0;
  let filaSalvamento = Promise.resolve();
  let ultimoConfirmado = null;

  function obterCodigo() {
    let codigo = "";

    try {
      codigo = sessionStorage.getItem(ACCESS_KEY) || "";
    } catch (e) {}

    if (!codigo) {
      codigo = prompt("Digite o código de acesso da gestão financeira:");

      if (!codigo || !codigo.trim()) {
        throw new Error("É necessário informar o código de acesso.");
      }

      codigo = codigo.trim();

      try {
        sessionStorage.setItem(ACCESS_KEY, codigo);
      } catch (e) {}
    }

    return codigo;
  }

  async function requisicaoNuvem(metodo, corpo) {
    const resposta = await fetch(API_URL, {
      method: metodo,
      headers: {
        "Content-Type": "application/json",
        "x-gestao-access-code": obterCodigo(),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });

    const resultado = await resposta.json().catch(() => ({}));

    if (!resposta.ok) {
      if (resposta.status === 401) {
        try {
          sessionStorage.removeItem(ACCESS_KEY);
        } catch (e) {}

        throw new Error("Código de acesso incorreto. Atualize a página e tente novamente.");
      }

      if (resposta.status === 409) {
        throw new Error(
          "Os dados foram alterados em outro dispositivo. Atualize a página antes de salvar novamente."
        );
      }

      throw new Error(resultado.erro || "Não foi possível comunicar com a nuvem.");
    }

    return resultado;
  }

  GF.FORMAS = {
    pix: "Pix",
    debito: "Débito",
    dinheiro: "Dinheiro",
    boleto: "Boleto",
    credito: "Cartão de crédito"
  };

  GF.REPETICOES = {
    unica: "Única",
    parcelada: "Parcelada",
    mensal: "Todo mês"
  };

  GF.CAT_RESERVA = "Investimentos";

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
    ((tipo === "receita" ? GF.TIPOS_RECEITA : GF.TIPOS_GASTO)
      .find((t) => t.nome === cat) || {}).finalidade || "";

  GF.CORES = [
    "#8B5A2B", "#C49A3A", "#A0522D", "#6B7B4B", "#D4A373", "#7F5539",
    "#B08968", "#9C6644", "#5E503F", "#C9A227", "#8C7051", "#BC6C25",
    "#6F4E37", "#DDA15E", "#A68A64", "#4F3B2A", "#B5835A", "#8A9A5B"
  ];

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
        receita: Array.isArray(d?.categorias?.receita) && d.categorias.receita.length
          ? d.categorias.receita
          : base.categorias.receita,

        gasto: Array.isArray(d?.categorias?.gasto) && d.categorias.gasto.length
          ? d.categorias.gasto
          : base.categorias.gasto,
      },
      cartoes: Array.isArray(d?.cartoes) ? d.cartoes : base.cartoes,
      lancamentos: Array.isArray(d?.lancamentos)
        ? d.lancamentos.map(normalizaLanc)
        : [],
    };

    for (const l of out.lancamentos) {
      const lista = out.categorias[l.tipo];

      if (!lista.includes(l.categoria)) lista.push(l.categoria);
      if (l.cartao && !out.cartoes.includes(l.cartao)) out.cartoes.push(l.cartao);
    }

    return out;
  }

  GF.normaliza = normaliza;
  GF.normalizaLanc = normalizaLanc;

  GF.uid = () =>
    Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // Carregamento local usado como apoio e para a primeira migração.
  GF.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return normaliza(JSON.parse(raw));
    } catch (e) {}

    return defaults();
  };

  const ouvintes = [];

  GF.onChange = (fn) => ouvintes.push(fn);

  function avisarAlteracao() {
    cache.clear();
    ouvintes.forEach((fn) => fn());
  }

  // CARREGAMENTO INICIAL DA NUVEM
  GF.iniciarNuvem = async function () {
    const local = GF.load();

    let localRaw = null;

    try {
      localRaw = localStorage.getItem(KEY);
    } catch (e) {}

    const remoto = await requisicaoNuvem("GET");

    if (remoto.dados) {
      // Se já existe dado na nuvem, ele é a fonte principal.
      GF.db = normaliza(remoto.dados);
      versaoNuvem = Number(remoto.versao) || 0;

    } else if (localRaw) {
      // Primeira utilização: oferece migrar os dados antigos.
      const migrar = confirm(
        "A nuvem ainda está vazia. Deseja enviar para ela os dados que já estão salvos neste navegador?"
      );

      if (migrar) {
        GF.db = local;

        const resultado = await requisicaoNuvem("POST", {
          dados: GF.db,
          versaoEsperada: 0,
        });

        versaoNuvem = Number(resultado.versao) || 0;

      } else {
        GF.db = defaults();
      }

    } else {
      GF.db = defaults();
    }

    ultimoConfirmado = JSON.stringify(GF.db);

    try {
      localStorage.setItem(KEY, ultimoConfirmado);
    } catch (e) {}

    avisarAlteracao();

    return GF.db;
  };

  // SALVAMENTO NA NUVEM
  GF.save = function () {
    filaSalvamento = filaSalvamento
      .catch(() => {})
      .then(async () => {
        const novoEstado = JSON.stringify(GF.db);
        const estadoAnterior = ultimoConfirmado;

        try {
          const resultado = await requisicaoNuvem("POST", {
            dados: JSON.parse(novoEstado),
            versaoEsperada: versaoNuvem,
          });

          versaoNuvem = Number(resultado.versao);
          ultimoConfirmado = novoEstado;

          try {
            localStorage.setItem(KEY, novoEstado);
          } catch (e) {}

          avisarAlteracao();

          return true;

        } catch (erro) {
          if (estadoAnterior) {
            GF.db = normaliza(JSON.parse(estadoAnterior));
          }

          avisarAlteracao();

          if (GF.toast) {
            GF.toast(erro.message, "erro");
          }

          throw erro;
        }
      });

    return filaSalvamento;
  };

  GF.substituirTudo = async function (dados) {
    const anterior = GF.db;

    GF.db = normaliza(dados);

    try {
      await GF.save();
    } catch (erro) {
      GF.db = anterior;
      avisarAlteracao();
      throw erro;
    }
  };

  GF.apagarTudo = async function () {
    const anterior = GF.db;

    GF.db = defaults();

    try {
      await GF.save();
    } catch (erro) {
      GF.db = anterior;
      avisarAlteracao();
      throw erro;
    }
  };

  /* ---------- meses ---------- */

  GF.mi = (ym) => {
    const [y, m] = ym.split("-").map(Number);
    return y * 12 + m - 1;
  };

  GF.ym = (i) =>
    `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;

  GF.mesAtual = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  };

  GF.somaMes = (ym, n) => GF.ym(GF.mi(ym) + n);

  /* ---------- parcelas e repetição ---------- */

  GF.inicioIdx = (l) => GF.mi(l.mes);

  GF.fimIdx = (l) => {
    if (l.repeticao === "parcelada") {
      return GF.mi(l.mes) + l.parcelas - l.parcelaInicial;
    }

    if (l.repeticao === "mensal") {
      return l.ate ? GF.mi(l.ate) : Infinity;
    }

    return GF.mi(l.mes);
  };

  GF.ativo = (l, k) =>
    GF.inicioIdx(l) <= k && k <= GF.fimIdx(l);

  GF.parcelaNo = (l, k) =>
    k - GF.inicioIdx(l) + l.parcelaInicial;

  GF.infoParcelas = (l, k) => {
    const ini = GF.inicioIdx(l);
    const fim = GF.fimIdx(l);

    let atual = null;
    let faltam;

    if (k < ini) {
      faltam = l.parcelas - l.parcelaInicial + 1;
    } else if (k > fim) {
      faltam = 0;
    } else {
      atual = GF.parcelaNo(l, k);
      faltam = l.parcelas - atual;
    }

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

  GF.ocorrencias = function (k) {
    if (cache.has(k)) return cache.get(k);

    const ymk = GF.ym(k);

    const lista = GF.db.lancamentos
      .filter((l) => GF.ativo(l, k))
      .map((l) => ({
        l,
        k,
        ym: ymk,
        valor: l.valor,
        parcela: l.repeticao === "parcelada"
          ? GF.parcelaNo(l, k)
          : null,
        pago: !!l.pagos[ymk],
      }));

    cache.set(k, lista);

    return lista;
  };

  GF.totais = function (k) {
    let receitas = 0;
    let gastos = 0;
    let pendente = 0;
    let cartao = 0;
    let reserva = 0;

    for (const o of GF.ocorrencias(k)) {
      if (o.l.tipo === "receita") {
        receitas += o.valor;
      } else {
        gastos += o.valor;

        if (!o.pago) pendente += o.valor;
        if (o.l.forma === "credito") cartao += o.valor;
        if (o.l.categoria === GF.CAT_RESERVA) reserva += o.valor;
      }
    }

    return {
      receitas,
      gastos,
      saldo: receitas - gastos,
      pendente,
      cartao,
      reserva
    };
  };

  GF.primeiroMesIdx = function () {
    let min = Infinity;

    for (const l of GF.db.lancamentos) {
      min = Math.min(min, GF.inicioIdx(l));
    }

    return min === Infinity ? GF.mi(GF.mesAtual()) : min;
  };

  GF.ultimoMesIdx = function () {
    let max = -Infinity;

    for (const l of GF.db.lancamentos) {
      const f = GF.fimIdx(l);

      max = Math.max(
        max,
        f === Infinity ? GF.inicioIdx(l) : f,
        GF.inicioIdx(l)
      );
    }

    return max === -Infinity ? GF.mi(GF.mesAtual()) : max;
  };

  GF.ultimoMesComLancamento = function () {
    let max = -Infinity;

    for (const l of GF.db.lancamentos) {
      if (l.repeticao !== "parcelada") {
        max = Math.max(max, GF.inicioIdx(l));
      }
    }

    return max === -Infinity ? GF.mi(GF.mesAtual()) : max;
  };

  GF.acumulado = function (k) {
    let s = 0;

    for (let i = GF.primeiroMesIdx(); i <= k; i++) {
      s += GF.totais(i).saldo;
    }

    return s;
  };

  GF.descricoesUsadas = function () {
    const set = new Map();

    for (const l of GF.db.lancamentos) {
      set.set(l.descricao.toLowerCase(), l);
    }

    return [...set.values()];
  };

  GF.normTexto = (s) =>
    String(s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  GF.corCategoria = function (cat) {
    const todas = [
      ...GF.db.categorias.gasto,
      ...GF.db.categorias.receita
    ];

    const i = todas.indexOf(cat);

    if (i >= 0) return GF.CORES[i % GF.CORES.length];

    let h = 0;

    for (const c of cat) {
      h = (h * 31 + c.charCodeAt(0)) >>> 0;
    }

    return GF.CORES[h % GF.CORES.length];
  };

  // Inicialização: o app deve aguardar GF.ready antes de renderizar.
  GF.db = GF.load();
  GF.state = { mes: GF.mesAtual() };

  GF.ready = GF.iniciarNuvem().catch((erro) => {
    console.error("Erro ao iniciar sincronização:", erro);

    alert(
      "Não foi possível carregar os dados da nuvem: " + erro.message
    );

    throw erro;
  });

})();
