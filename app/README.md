# Finanças da Família

Aplicativo web para cadastrar receitas e gastos, com tipos de gasto, compras no cartão e parcelas.
Feito só com HTML, CSS e JavaScript: não precisa instalar nada.

## Como abrir

- **Mais fácil:** dê dois cliques em `index.html`.
- **No VS Code:** instale a extensão *Live Server*, clique com o botão direito em `index.html` e escolha *Open with Live Server*.

## Onde os dados ficam

Tudo que você cadastra é salvo **automaticamente no navegador** (localStorage), no computador ou no celular em que você usou.
Nada é enviado para a internet, nem quando o site estiver publicado no GitHub.

- Cada navegador ou aparelho tem os seus próprios dados.
- Limpar os dados de navegação do navegador apaga os lançamentos. Em **Ajustes → Baixar cópia de segurança** você guarda um arquivo com tudo,
  e em **Restaurar cópia** recupera os dados (também serve para levar os dados para outro computador ou celular).

## Estrutura

Todos os arquivos ficam juntos, na mesma pasta (assim o envio pelo site do GitHub funciona direto):

```
index.html    página principal
style.css     visual (tons terrosos, dourado e marrom)
data.js       dados, meses e cálculo de parcelas
ui.js         formatação, janelas, avisos
form.js       formulário de cadastro
app.js        navegação, menu recolhível e tema claro/escuro
inicio.js     página de Cadastro
cartoes.js    Cartões e parcelas
analise.js    Análise: projeção, 5 gastos mais frequentes e exceções
config.js     Ajustes: exportar para Excel, cópia de segurança, cartões
```

## Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie o conteúdo da pasta `app` (o `index.html` precisa ficar na raiz do repositório).
2. No repositório: **Settings → Pages → Build and deployment → Deploy from a branch**, escolha a branch `main` e a pasta `/ (root)`.
3. Em um ou dois minutos o site fica disponível em `https://SEU-USUARIO.github.io/NOME-DO-REPOSITORIO/`.
