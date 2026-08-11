# Help CIMATEC

Ferramentas acadêmicas para estudantes da **Universidade SENAI CIMATEC**.

🔗 **Site:** [help-cimatec.netlify.app](https://help-cimatec.netlify.app/)

## Ferramentas

- **Passei CIMATEC?** — Calcula a média do semestre (AG) com os pesos de AV1 (25%), AV2 (25%),
  AV3 (30%) e EDAG (20%), mostra em qual faixa do regulamento você caiu e, se for o caso,
  a nota necessária na Avaliação Final: `(50 − 6 × AG) ÷ 4`.
- **Faltei CIMATEC?** — Mostra o saldo de faltas, contado em **dias** ou em **faltas lançadas**.
  Cada dia letivo vale 2 aulas de 50 min e a presença mínima é 75%, então o limite é 25% das
  aulas. Em dias o limite é arredondado para baixo, porque meio dia de falta não existe:
  30 h = 36 aulas = 9 faltas = **4 dias inteiros**.
- **Guia do Estudante** — matrícula, Elementos, EDAG, Trilhas, Canvas, notas, monitoria,
  iniciação científica, NAAE, contatos e benefícios do e-mail institucional, em abas
  recolhíveis ordenadas pela jornada do aluno: fechado, o guia é o seu próprio índice.
- **Iniciativas Estudantis** — clubes, atléticas, ligas, equipes de competição e empresa
  júnior, cada uma com a área de curso, a logo e o link do Instagram.
- **Wifi Cimatec** — as redes do campus e a senha de cada uma.

## Design

Direção visual "papel milimetrado": o regulamento acadêmico desenhado como instrumento de
medida. A **régua** — com as linhas de corte em 3,0 e 7,0 — é o elemento de assinatura e
aparece tanto no topo da página quanto no resultado da calculadora de média. Na calculadora
de notas, a largura de cada campo é o peso real da avaliação. Cores e marca vêm da logo:
azul `#1D4E89` e laranja `#F28A1F`.

Tipografia: IBM Plex Sans Condensed (títulos), IBM Plex Sans (texto) e IBM Plex Mono (dados).

### Temas

O site tem tema claro e escuro. Ele segue o tema do sistema por padrão e o botão na navbar
troca manualmente, guardando a escolha em `localStorage`. Um script no `<head>` resolve o
tema antes da primeira pintura, para a página não piscar no tema errado.

Toda cor é uma custom property em `:root`. O tema escuro é só o bloco de overrides em
`:root[data-tema="escuro"]` — nenhum componente sabe qual tema está ativo, então uma cor
nova precisa virar token antes de ser usada.

## Arquivos

Na raiz ficam só a página e os arquivos que buscadores exigem lá. Todo o resto vive em
`assets/`.

```text
index.html                     página
robots.txt · sitemap.xml       buscadores

assets/css/style.css           estilos
assets/js/script.js            calculadoras, tema e guia

assets/img/logo.png            assinatura horizontal (nav e OG)
assets/img/logo-dark.png       a mesma logo com o azul clareado, para o tema escuro
assets/img/icon.png            símbolo isolado, fundo transparente
assets/img/favicon.ico         ícone da aba
assets/img/favicon.png
assets/img/apple-touch-icon.png
assets/img/og-image.png        card de compartilhamento 1200×630
assets/img/iniciativas/        logo de cada iniciativa estudantil (ver README de lá)

assets/brand/                  artes originais em alta resolução
assets/brand/iniciativas/      as logos das iniciativas em resolução cheia
```

Os ícones e o og-image não estão mais na raiz, então cada um depende da sua `<link>` ou
`<meta>` no `index.html` para ser encontrado — mexer nesses caminhos derruba o favicon e o
card de compartilhamento.

O que o site serve em `assets/img/` é gerado a partir de `assets/brand/` — recorte, fundo
transparente e redimensionamento. Vale também para as iniciativas: `assets/brand/iniciativas/`
guarda o JPEG em resolução cheia e `assets/img/iniciativas/` serve o PNG 256×256 que a página
carrega. O README de lá tem a tabela de nomes, que é o contrato com o `index.html`.

## Tecnologias

- HTML, CSS e JavaScript sem dependências
- Hospedado na Netlify, com deploy automático a cada push na `main` (`netlify.toml`)

## Inspiração

- **Passei Senai:** [https://patrickguilherme.github.io/PasseiSenai/](https://patrickguilherme.github.io/PasseiSenai/)
- **Faltei Senai:** [https://victorbarretoandrade.github.io/FalteiSenai/](https://victorbarretoandrade.github.io/FalteiSenai/)

## Autor

Rodrigo Gandarela Soares de Farias Duca
