
/* Navegação entre páginas, tema e atualização automática da tela. */
(function () {
  const GF = window.GF;
  const TEMA = "gestao-financeira:tema";

  function aplicarTema(t) {
    document.documentElement.dataset.theme = t;

    try {
      localStorage.setItem(TEMA, t);
    } catch (e) {}
  }

  let temaSalvo = null;

  try {
    temaSalvo = localStorage.getItem(TEMA);
  } catch (e) {}

  aplicarTema(
    temaSalvo ||
    (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
  );

  document.getElementById("btnTema").onclick = () => {
    aplicarTema(
      document.documentElement.dataset.theme === "dark"
        ? "light"
        : "dark"
    );

    GF.render();
  };

  // Menu lateral recolhível.
  const MENU = "gestao-financeira:menu-recolhido";
  const btnMenu = document.getElementById("btnMenu");

  document.querySelectorAll(".nav a").forEach((a) => {
    a.title = a.textContent.trim();
  });

  function aplicarMenu(recolhido) {
    document.querySelector(".app")
      .classList.toggle("menu-recolhido", recolhido);

    btnMenu.title = recolhido ? "Abrir menu" : "Recolher menu";

    btnMenu.querySelector("span").textContent =
      recolhido ? "Abrir menu" : "Recolher menu";

    btnMenu.setAttribute("aria-expanded", String(!recolhido));

    try {
      localStorage.setItem(MENU, recolhido ? "1" : "0");
    } catch (e) {}
  }

  let menuSalvo = null;

  try {
    menuSalvo = localStorage.getItem(MENU);
  } catch (e) {}

  aplicarMenu(menuSalvo === "1");

  btnMenu.onclick = () => {
    aplicarMenu(
      !document.querySelector(".app")
        .classList.contains("menu-recolhido")
    );
  };

  GF.render = function ({ manterScroll = true } = {}) {
    const nome = (location.hash || "#inicio")
      .slice(1)
      .split("?")[0];

    const page = GF.pages[nome] || GF.pages.inicio;
    const y = window.scrollY;

    GF.limparGraficos();

    const view = document.getElementById("view");
    const top = document.getElementById("topActions");

    const nova = view.cloneNode(false);
    view.replaceWith(nova);

    top.innerHTML = "";

    document.getElementById("pageTitle").textContent = page.titulo;
    document.getElementById("pageSub").textContent = "";

    document.body.dataset.page = GF.pages[nome] ? nome : "inicio";

    document.querySelectorAll(".nav a").forEach((a) => {
      a.classList.toggle(
        "on",
        a.dataset.page === document.body.dataset.page
      );
    });

    try {
      page.render(nova, top);
    } catch (err) {
      console.error(err);

      nova.innerHTML = `
        <div class="card">
          ${GF.vazio("Algo deu errado nesta tela", GF.esc(err.message))}
        </div>
      `;
    }

    if (manterScroll) {
      window.scrollTo(0, y);
    }
  };

  window.addEventListener("hashchange", () => {
    GF.render({ manterScroll: false });
    window.scrollTo(0, 0);
  });

  // Atualiza as telas quando os dados são confirmados na nuvem.
  GF.onChange(() => GF.render());

  document.getElementById("fab").onclick = () => {
    GF.abrirFormulario({
      tipo: "gasto",
      forma: document.body.dataset.page === "cartoes"
        ? "credito"
        : "pix"
    });
  };

  // Aguarda a nuvem carregar antes de abrir o painel.
  GF.ready
    .then(() => {
      GF.render();
    })
    .catch((erro) => {
      console.error("Não foi possível iniciar o painel:", erro);
    });

})();
