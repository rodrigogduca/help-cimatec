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
- **Grade CIMATEC** (`grade.html`) — monta a grade do semestre antes da matrícula a partir do
  arquivo de oferta da coordenação. A página abre no passo de **escolha do curso**: a oferta é de
  um curso só, então o simulador não aparece antes dessa escolha. Feita a escolha, clicar numa
  disciplina põe as aulas dela na semana; horário que bate com outra turma é barrado com o aviso
  do que chocou, e disciplina que você já tem na grade em outra turma é oferecida como troca.
  A seleção fica no navegador e sai em PDF pela impressão. Só **Engenharia da Computação** vem
  com a grade pronta; nos outros cursos é o aluno que **anexa** a planilha — a da coordenação
  dele ou o `GRD_HORARIOS` do semestre, o `.xls` do sistema acadêmico com todos os cursos juntos.
  No passo de escolha do curso, um botão **Como usar o simulador** abre o passo a passo em modal:
  vem antes da escolha porque é ali que a dúvida aparece: depois de montar a grade, a página já
  se explicou sozinha.
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

### A grade no celular

Uma tabela de seis dias por oito blocos não cabe num aparelho em pé: em 320px sobrariam menos de
40px por coluna, largura em que nome de disciplina nenhum se lê. Até 560px a tabela dá lugar a uma
**lista por dia** — "Segunda" e as aulas dela, "Terça" e as dela —, com os dias vazios reunidos numa
linha "Sem aula" no fim, porque sexta livre é informação e não ausência.

O desenho manda as duas formas no HTML e o `@media` escolhe uma; nenhuma decisão de layout mora no
JavaScript. As duas usam o mesmo chip, então o clique que tira a aula da grade é o mesmo nas duas.
A escondida sai com `display: none`, e não com a técnica de leitor de tela, senão a semana seria
lida duas vezes em voz alta.

Na mesma faixa, a tabela de disciplinas escolhidas (sete colunas, 520px de mínimo) vira um cartão
por linha, e a linha de procedência esconde o nome do arquivo — sozinho, em mono, ele ocupava
quatro linhas acima da grade.

### Temas

O site tem tema claro e escuro. Ele segue o tema do sistema por padrão e o botão na navbar
troca manualmente, guardando a escolha em `localStorage`. Um script no `<head>` resolve o
tema antes da primeira pintura, para a página não piscar no tema errado.

Toda cor é uma custom property em `:root`. O tema escuro é só o bloco de overrides em
`:root[data-tema="escuro"]` — nenhum componente sabe qual tema está ativo, então uma cor
nova precisa virar token antes de ser usada.

## Arquivos

Na raiz ficam só as páginas e os arquivos que buscadores e verificação de domínio exigem lá.
Todo o resto vive em `assets/` (o que o site serve) e em `tools/` (o que gera o que o site
serve, e nunca vai para o ar).

```text
index.html                     página
grade.html                     simulador de grade
robots.txt · sitemap.xml       buscadores
google*.html                   verificação do Search Console
netlify.toml                   deploy e cabeçalhos de segurança
.gitignore                     o que fica fora do git — leia antes de versionar planilha

assets/css/style.css           estilos
assets/css/grade.css           estilos do simulador, incluindo a folha impressa
assets/js/script.js            calculadoras, tema e guia

assets/js/grade/xlsx.js        leitor de .xlsx sem dependência (ZIP + XML)
assets/js/grade/xls.js         leitor de .xls sem dependência (OLE2 + BIFF8)
assets/js/grade/horarios.js    o GRD_HORARIOS do sistema -> forma de planilha comum
assets/js/grade/oferta.js      planilha -> modelo (turmas, encontros, blocos)
assets/js/grade/regras.js      equivalência, choque de horário e carga
assets/js/grade/estado.js      seleção do aluno e onde ela é salva
assets/js/grade/cursos.js      lista de cursos e o passo de escolha
assets/js/grade/ui.js          desenho da grade, do catálogo e do resumo
assets/js/grade/pdf.js         a folha que a impressão do navegador vira PDF
assets/js/grade/app.js         liga tudo: eventos, filtros e carregamento

assets/data/ofertas.json       catálogo de ofertas publicadas
assets/data/<curso>-<sem>.json a oferta normalizada que a página carrega

tools/gerar-oferta.mjs         gera os dois a partir da planilha da coordenação
tools/ofertas/                 as planilhas de origem — conteúdo fora do git
tools/ofertas/README.md        o que vai lá dentro e por que não é versionado

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

A mesma separação vale em `tools/`: a planilha de origem entra, o JSON sai. A diferença é que
aqui ela não pode ser versionada. O `netlify.toml` publica a raiz do repositório como está
(`publish = "."`), então **todo arquivo versionado vira uma URL do site** — e o `GRD_HORARIOS`
traz o nome de todos os docentes da universidade, curso por curso. Por isso `tools/ofertas/`
está no `.gitignore` e só o README dela é versionado. Público é o que sai em `assets/data/`,
que tem apenas o que a página desenha.

Num clone novo essa pasta vem vazia, e isso é o esperado: sem ela dá para rodar o site inteiro
e montar grade — só não dá para *republicar* a oferta. Quem quiser fazer isso pede o arquivo à
coordenação e o solta lá.

## Rodar localmente

O site não tem build: os arquivos são servidos como estão. Mas **abrir o `index.html` com dois
cliques não funciona** para o simulador — em `file://` o navegador recusa os módulos ES e o
`fetch` do `assets/data/*.json`. Sempre suba um servidor:

```bash
# na raiz do repositório, escolha um:
npx serve .                 # Node
python -m http.server 8000  # Python 3
php -S localhost:8000       # PHP
```

Depois abra `http://localhost:8000/` (a calculadora) ou `http://localhost:8000/grade.html`
(o simulador). Não há nada para instalar, compilar ou configurar: sem `package.json`, sem
dependências, sem variáveis de ambiente.

Para **publicar uma oferta nova** é preciso Node 18 ou mais recente — é a versão em que
`DecompressionStream` virou global, e é com ele que o `.xlsx` é descompactado tanto no
navegador quanto no script (o `.xls` não é comprimido e não depende disso):

```bash
node tools/gerar-oferta.mjs tools/ofertas/GRD_HORARIOS_20262_FINAL.xls \
  --somente engenharia-de-computacao
```

Os cabeçalhos de segurança do `netlify.toml` (CSP e companhia) **não valem** num servidor
estático comum — ele não lê esse arquivo. Para testar a página como ela vai para o ar, use
o CLI da Netlify, que aplica os cabeçalhos do `netlify.toml`:

```bash
npx netlify dev
```

Vale rodar isso depois de mexer no `<script>` inline do `<head>`: a CSP libera aquele trecho
por *hash*, então mudar uma vírgula dentro dele exige recalcular o hash (o comando está
comentado no `netlify.toml`). O sintoma de hash errado é a página abrir no tema errado e
piscar — o resto do site continua funcionando, então é fácil não perceber.

## Os cursos e a oferta de disciplinas

A lista dos onze cursos de graduação fica em `assets/js/grade/cursos.js` — é institucional e muda
quando a universidade abre ou fecha um curso, não quando sai uma planilha nova. Cada curso tem um
`id`, a sigla do selo e a lista de `slugs` que a coordenação já usou no nome do arquivo (é o que
faz "Engenharia de Computação" e "Engenharia da Computação" caírem no mesmo cartão). O cruzamento
com `assets/data/ofertas.json` é o que decide se o cartão mostra a oferta publicada ou o convite
para anexar a planilha.

**Só Engenharia da Computação tem oferta publicada.** É uma decisão de manutenção, não um limite
do simulador: um arquivo de oferta envelhece a cada semestre, e prometer nove cursos atualizados
é prometer nove arquivos a cada seis meses. Nos outros cursos o aluno anexa a planilha e monta a
grade igual — o mesmo `GRD_HORARIOS` que gerou a oferta de Computação serve para todos eles,
porque traz a universidade inteira. Publicar mais um curso é uma linha:
`--somente engenharia-de-computacao,engenharia-civil`.

O passo 1 sai em três blocos, na ordem de `GRUPOS`: **Engenharias**, **Outras graduações** e
**Em breve**. Os dois primeiros vêm do campo `area`; o terceiro é o `emBreve: true`, e ele é
testado antes da área justamente para o curso que ainda não abriu cair sempre no fim. Vale
distinguir os dois estados de indisponibilidade:

| Estado | Como aparece | O aluno pode |
|---|---|---|
| `emBreve: true` | Cartão esmaecido, `disabled`, selo "Em breve" | Nada — o curso ainda não existe |
| Sem oferta em `ofertas.json` | Cartão normal, "Anexe a planilha do curso" | Anexar a planilha e montar a grade |

Hoje `emBreve` está em Administração e Economia. Quando um deles abrir, é só apagar a linha
`emBreve: true` do curso — ele volta para "Outras graduações" e passa a aceitar a planilha.

O simulador lê o arquivo que a coordenação divulga. Uma linha da planilha é uma aula (turma, dia,
horário, disciplina, docente, sala); o simulador agrupa essas linhas por turma, porque é a turma
que o aluno matricula. As colunas são reconhecidas por sinônimo — `Turma(s) de Computação`,
`Horário`, `Componente curricular` e afins caem no lugar certo sozinhas —, e a aba escolhida é a
que tiver mais colunas reconhecidas, o que descarta as abas de resumo do próprio arquivo.

Para publicar um semestre novo, com a planilha em `tools/ofertas/` (ver *Arquivos*):

```bash
node tools/gerar-oferta.mjs tools/ofertas/GRD_HORARIOS_20262_FINAL.xls \
  --somente engenharia-de-computacao
```

Isso escreve `assets/data/<curso>-<semestre>.json` e atualiza `assets/data/ofertas.json`, que é o
seletor de oferta da página. Curso e semestre saem do título da planilha ou do nome do arquivo, e
podem ser forçados com `--curso` e `--periodo`. Sem `--somente`, um arquivo com vários cursos
escreve um JSON para cada um.

### O arquivo do sistema acadêmico (GRD_HORARIOS)

A coordenação publica uma planilha por curso; o sistema acadêmico exporta outra coisa — um `.xls`
só, com a universidade inteira, e com as colunas que o próprio sistema usa (`Allocated Student Set
Description`, `Descrição`, `Dias agendados`…). Duas diferenças mudam a leitura, e as duas moram em
`assets/js/grade/horarios.js`, que reescreve essas linhas no formato da planilha de coordenação
antes de qualquer outra coisa olhar para elas:

- **A primeira coluna não é a turma: é a lista de turmas que assistem àquela aula.** Economia dada
  para Computação, Química e o gerencial de Computação é *uma* linha com três turmas. Ler só a
  primeira faria a disciplina sumir da grade dos outros dois cursos, então a linha vira três — o
  aluno matricula uma turma, não uma aula.
- **Disciplina, código e turma vêm grudados na `Descrição`:**
  `20231GRDARQGERENCIAL|GRD-CIV-2220 - Estruturas Metálicas - 4`. O `- 4` é a quarta aula da
  semana daquela turma, e não parte do nome: sem tirá-lo, "Estruturas Metálicas" viraria quatro
  disciplinas de um encontro cada. (Vale conferir de vez em quando que essa numeração é mesmo
  sequencial por turma: no arquivo de 2026.2 são 303 grupos, todos numerados de 1 a N.)

O código da turma vira o mesmo rótulo que a coordenação escreve — `20242GRDECPDIU` é a turma
"2024.2 — Integral" —, e é isso que faz os dois arquivos falarem da mesma turma: a oferta gerada
do `GRD_HORARIOS` tem os mesmos ids da que saía da planilha de Computação, então quem já tinha
uma grade montada não perde a seleção.

**Subturma continua sendo subturma.** Uma disciplina prática que se divide em dois grupos vem no
arquivo como `Elementos de Matemática - Subturma: SUBTURMA A`, e cada grupo tem o seu horário —
A na quinta, B na terça. São duas turmas no catálogo, cada uma com o seu selo e o seu horário, e
escolher a segunda com a primeira na grade cai no aviso de disciplina repetida, que oferece a
troca. É o mesmo caminho das turmas de ingressos diferentes.

**Nem todo horário do arquivo é uma faixa da grade.** As linhas da semana saem dos próprios
dados — planilha com outra divisão desenha outra grade, sem tocar em código —, mas uma faixa é
sempre um número inteiro de aulas de 50 minutos, e as oito de 2026.2 têm duas aulas cada. O
`GRD_HORARIOS` traz um caso que não fecha nesse múltiplo: o **Desafio Empreendedor**, sábado,
`08:00–16:30`, um evento de 510 minutos no anfiteatro, compartilhado por nove cursos. Virando
linha própria, ele punha um degrau de oito horas e meia entre `07:10–08:50` e `09:00–10:40` e a
régua da manhã deixava de se ler. Então `montarOferta()` o descarta como faixa — e ele não some
da tela, porque `montarMapa()` põe cada encontro em toda faixa que ele cruza: o evento aparece
desenhado das 07:10 às 16:30 do sábado, que é onde ele de fato acontece. Só continua virando
linha o horário atípico que não cruza faixa nenhuma, senão ele ficaria sem lugar onde ser
desenhado.

Ler o `.xls` é trabalho de `assets/js/grade/xls.js`, e não do `xlsx.js`: apesar do nome parecido,
não é um `.xlsx` antigo. É um sistema de arquivos inteiro (OLE2 — setores, tabela de alocação e
diretório) com um fluxo de registros binários dentro (BIFF8). Duas consequências práticas:

- **A hora não é texto.** `16:40` está guardado como `0,694444` — fração do dia —, e quem diz que
  aquilo é hora é o formato da célula, num registro à parte. O leitor resolve o formato uma vez
  por estilo e devolve `16:40` já pronto. Quando o mesmo arquivo é exportado em `.csv`, o formato
  se perde e a fração chega crua: por isso `paraMinutos()` também aceita `0,694444`.
- **Não há descompressão, mas há laço.** A tabela de alocação é um vetor de "próximo setor", e um
  arquivo truncado no meio da escrita produz cadeia que aponta para trás — sem o corte por setor
  já visitado, a leitura roda para sempre e leva a aba junto.

### O que o arquivo não traz, a página precisa dizer

A planilha da coordenação nem sempre é a oferta inteira. A de Engenharia de Computação 2026.2,
por exemplo, avisa no próprio subtítulo: *"Somente disciplinas exclusivas de Computação; Cálculo,
Química e Administração foram removidos"* — ou seja, as disciplinas compartilhadas entre cursos
ficaram de fora antes de o arquivo chegar aqui.

Quem procura Cálculo Vetorial nessa oferta não acha, e sem explicação a conclusão é que o site
perdeu a disciplina. Por isso o texto entre o título e o cabeçalho da planilha é lido e guardado
em `oferta.ressalva`, e aparece em três lugares: na linha de procedência, no rodapé do PDF e —
principalmente — na lista vazia do catálogo, que é onde o aluno está quando a busca não devolve
nada. Nenhuma heurística de palavra: é tudo que a coordenação escreveu ali.

Para a disciplina compartilhada realmente aparecer, algum arquivo precisa trazê-la — e é por isso
que **anexar não substitui sozinho**. Com uma oferta já na tela, o arquivo novo abre a escolha
entre *somar* e *substituir*: somar é o caminho de quem foi buscar Cálculo na planilha do curso que
o oferece. `unirOfertas()` junta os catálogos pelo id da turma, então a mesma turma nos dois
arquivos entra uma vez só, e a grade que o aluno já montou continua de pé.

Somadas, o cross-curso funciona sozinho: a mesma disciplina oferecida a três cursos vira três
turmas com a mesma chave de equivalência, o filtro de curso aparece e cada uma é oferecida como
alternativa das outras.

O catálogo sai **da turma mais nova para a mais velha**. Quem abre o simulador está montando o
próximo semestre, e a turma do próprio ingresso é quase sempre uma das últimas: em ordem crescente,
o aluno de 2026.1 rolava oito anos de oferta antes de chegar nela. A ordenação mora em
`montarOferta()`, que é o funil por onde passam todas as origens.

O **filtro de turma** segue a mesma ordem, pelo mesmo comparador (`compararTurmas()`): seletor e
lista discordando faria a primeira turma da lista não ser a primeira do seletor. O ano sai do
próprio rótulo, e não do campo `ingresso`, porque o filtro ordena rótulos soltos — e porque um
JSON anexado pode chegar com `ingresso` vazio ou mentindo.

E ele tem **uma opção por ingresso, não por ingresso × modalidade**. Em 2026.2 isso é 15 opções em
vez de 23: `2025.2 — Integral` e `2025.2 — Gerencial` eram duas linhas do seletor para a mesma
pergunta, já que a modalidade é divisão interna do ingresso. Filtrar por `2025.2` traz as duas, e
cada cartão do catálogo continua mostrando o rótulo inteiro — é lá que a distinção importa, na hora
de escolher a turma.

O separador do `.csv` é descoberto lendo as primeiras linhas inteiras, e não só a primeira: a
planilha da coordenação abre com um título mesclado, sem separador nenhum, e um arquivo de ponto e
vírgula era lido como uma coluna só. A tabulação entra na mesma disputa, porque `.tsv` é aceito.

O aluno também pode anexar um arquivo direto na página, em `.xls`, `.xlsx`, `.csv` ou no JSON já
pronto. Nesse caso nada é enviado para lugar nenhum: o `.xlsx` é descompactado no próprio
navegador, com `DecompressionStream`, e o `.xls` é destrinchado registro a registro — nos dois
casos pelo mesmo módulo que o script do Node usa. PDF não é aceito — a página explica que é
preciso pedir a planilha ou colar a tabela em uma e exportar em `.csv`.

Anexado um arquivo com vários cursos, o catálogo já abre filtrado no curso escolhido no passo 1.
Abrir em "todos os cursos" seria despejar quatrocentas turmas alheias em cima de uma escolha que
o aluno acabou de fazer; o filtro continua na tela para afrouxá-la quando ele for atrás de uma
disciplina compartilhada.

### O arquivo anexado é conteúdo não confiável

O site não tem servidor nem banco: o arquivo é lido em memória, no navegador do próprio aluno, e
some ao fechar a aba — só a lista de ids das turmas escolhidas fica no `localStorage`. Não existe
upload, então um arquivo ruim não contamina ninguém além de quem o abriu. Mesmo assim ele é tratado
como entrada hostil, porque basta alguém mandar um "grade.json" num grupo de turma:

- **Planilha e CSV** passam por `normalizarLinhas()`, que constrói cada campo a partir de célula de
  texto — o tipo de tudo que sai de lá é conhecido.
- **JSON** chega já no formato final, então é reconstruído campo a campo por `sanearOferta()`, com
  o tipo forçado. `minutos` e `aulas` são recontados dos encontros, `dia` fora da semana conhecida
  vira EAD, e `blocos`/`dias` são regerados por `montarOferta()`. O objeto do arquivo nunca chega
  à tela.
- **A oferta publicada** passa pelo mesmo `sanearOferta()` do arquivo anexado. Ela vem do próprio
  site, mas ter um caminho só até a tela é o que garante que a regra acima não tenha exceção.
- **Na saída**, todo texto vindo do arquivo passa por `esc()` antes de virar HTML. As duas camadas
  são independentes de propósito: uma falha sozinha não vira execução de script.
- **No servidor**, o `netlify.toml` manda uma CSP com `script-src 'self'` + hash do script inline.
  É a terceira camada: mesmo que um dia escape um `<script>` para dentro da página, o navegador se
  recusa a executá-lo — e `connect-src 'self'` impede que qualquer coisa injetada mande dado para
  fora. Só vale no site publicado (veja *Rodar localmente*).

Ao mexer no desenho, a regra é: **nada que veio do arquivo entra em `innerHTML` sem `esc()`** —
nem os campos que "são sempre número".

### Um arquivo pequeno não pode travar a aba

XSS é o risco óbvio, mas num leitor de arquivo o barato é o outro: um arquivo minúsculo que
custa caro para ler. A página não tem worker, então quem trava é a interface inteira, sem botão
de cancelar. O `.xlsx` é lido sem `DOMParser` — não há XXE nem expansão de entidade —, e cada
limite abaixo existe porque a versão sem ele derrubava a aba num teste:

| Limite | Onde | Contra o quê |
|---|---|---|
| 20 MB de arquivo | `app.js` | arquivo grande antes de qualquer leitura |
| 64 MB descomprimidos, conferidos durante a descompressão | `xlsx.js` | *zip bomb*: 200 kB que viram 200 MB de XML |
| só `.xml` e `.rels` são extraídos | `xlsx.js` | imagem e tema embutidos que ninguém vai ler |
| varredura de XML por índice, nunca por regex de corpo | `xlsx.js` | 15 kB de `<row>` sem fechamento — a regex preguiçosa era quadrática e prendia a aba por horas |
| 16 384 colunas (o limite do Excel) | `xlsx.js` | `<c r="AAAAAAAA1">`: 600 bytes que montavam uma linha de 8 bilhões de células |
| cadeia de setores sem repetição, cortada no tamanho do arquivo | `xls.js` | FAT truncada que aponta para trás: a leitura rodava para sempre |
| 1 milhão de células | `xls.js` | registro de célula tem 10 bytes; sem o corte, 20 MB viravam 2 milhões de strings |
| 20 000 linhas de aula | `oferta.js` | arquivo enorme mas válido, que viraria um catálogo impossível de desenhar |

Todo limite recusa o arquivo com uma frase em português na própria página — nenhum falha calado
nem deixa a grade anterior em estado quebrado.

## Tecnologias

- HTML, CSS e JavaScript sem dependências — nem para ler `.xls` e `.xlsx`, nem para gerar PDF
- O simulador usa módulos ES (`<script type="module">`); o resto do site segue em script clássico
- O PDF é a página impressa pelo navegador, com uma folha própria em `@media print`: o texto sai
  selecionável, a paginação é do navegador e o site continua sem nenhuma dependência
- Hospedado na Netlify, com deploy automático a cada push na `main` (`netlify.toml`)

## Inspiração

- **Passei Senai:** [https://patrickguilherme.github.io/PasseiSenai/](https://patrickguilherme.github.io/PasseiSenai/)
- **Faltei Senai:** [https://victorbarretoandrade.github.io/FalteiSenai/](https://victorbarretoandrade.github.io/FalteiSenai/)

## Autor

Rodrigo Gandarela Soares de Farias Duca
