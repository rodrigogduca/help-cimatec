# Help CIMATEC

Ferramentas acadêmicas para estudantes da **Universidade SENAI CIMATEC**.

🔗 **Site:** [rodrigogduca.github.io/help-cimatec](https://rodrigogduca.github.io/help-cimatec/)

## Ferramentas

- **Passei CIMATEC?** — Calcula a média do semestre (AG) com os pesos de AV1 (25%), AV2 (25%),
  AV3 (30%) e EDAG (20%), mostra em qual faixa do regulamento você caiu e, se for o caso,
  a nota necessária na Avaliação Final: `(50 − 6 × AG) ÷ 4`.
- **Saldo de faltas** — Mostra quantos dias você ainda pode faltar. Cada dia letivo vale
  2 aulas de 50 minutos e a presença mínima é de 75%, então o saldo é 25% dos dias letivos.

## Design

Direção visual "papel milimetrado": o regulamento acadêmico desenhado como instrumento de
medida. A **régua** — com as linhas de corte em 3,0 e 7,0 — é o elemento de assinatura e
aparece tanto no topo da página quanto no resultado da calculadora de média. Na calculadora
de notas, a largura de cada campo é o peso real da avaliação. Cores e marca vêm da logo:
azul `#1D4E89` e laranja `#F28A1F`.

Tipografia: IBM Plex Sans Condensed (títulos), IBM Plex Sans (texto) e IBM Plex Mono (dados).

## Arquivos

```
index.html          página
style.css           estilos
script.js           calculadoras
logo.png            assinatura horizontal (nav e OG)
icon.png            símbolo isolado, fundo transparente
favicon.ico/.png    ícone da aba
apple-touch-icon.png
og-image.png        card de compartilhamento 1200×630
brand/              artes originais em alta resolução
```

Os assets do site são gerados a partir de `brand/` — recorte, fundo transparente e
redimensionamento.

## Tecnologias

- HTML, CSS e JavaScript sem dependências
- Hospedado no GitHub Pages

## Autor

Rodrigo Gandarela — [Clube de Programação — Universidade SENAI CIMATEC](https://clube-de-programacao.vercel.app/)
