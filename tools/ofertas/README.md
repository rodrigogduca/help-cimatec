# Planilhas de origem

Esta pasta guarda os arquivos que `tools/gerar-oferta.mjs` lê para escrever
`assets/data/`. **O conteúdo dela não é versionado** — só este README é.

Não é organização por gosto. O `netlify.toml` publica a raiz do repositório
como está (`publish = "."`), então qualquer arquivo versionado vira uma URL do
site, e o `GRD_HORARIOS` traz o nome de todos os docentes da universidade,
curso por curso. O que vai para o ar é o JSON gerado, em `assets/data/`, que
tem só o que a página desenha.

## O que vai aqui

| Arquivo | De onde vem | O que traz |
|---|---|---|
| `GRD_HORARIOS_<semestre>_FINAL.xls` | export do sistema acadêmico | a universidade inteira, todos os cursos num arquivo só |
| `Grade_<Curso>_<ano>_<sem>.xlsx` | planilha que a coordenação envia aos alunos | um curso só |

Os dois servem. O `.xls` do sistema tem colunas próprias e é traduzido por
`assets/js/grade/horarios.js` antes de qualquer outra coisa olhar para ele; a
planilha da coordenação é lida direto. O nome do arquivo é o que o gerador usa
para adivinhar curso e período, então vale manter o padrão acima — ou passar
`--curso` e `--periodo` na mão.

## Como usar

```bash
# a partir da raiz do repositório
node tools/gerar-oferta.mjs tools/ofertas/GRD_HORARIOS_20262_FINAL.xls \
  --somente engenharia-de-computacao
```

Isso reescreve `assets/data/<curso>-<semestre>.json` e atualiza o catálogo em
`assets/data/ofertas.json`. Esses dois **são** versionados — são eles que a
página carrega.

## Se a pasta estiver vazia

É o esperado num clone novo. Peça o arquivo à coordenação do curso, ou use
qualquer planilha de oferta que você já tenha: o simulador também aceita o
arquivo anexado direto na página, sem passar por aqui.
