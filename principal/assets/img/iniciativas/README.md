# Logos das iniciativas

Uma logo por iniciativa da lista do modal **Iniciativas Estudantis**. O nome do arquivo é o
contrato: o `index.html` já aponta para todos eles, então trocar uma logo é sobrescrever o
arquivo — não se mexe no HTML, no CSS nem no JS.

| Iniciativa                | Arquivo                         | Instagram                  | Sigla |
| ------------------------- | ------------------------------- | -------------------------- | ----- |
| Clube de Programação      | `clube-de-programacao.png`      | `clubedeprogramacaocimatec`| CP    |
| AWS Student Builder Group | `aws-student-builder-group.png` | `awssbgsenaicimatec`       | AWS   |
| Cimatlética               | `cimatletica.png`               | `_cimatletica`             | CIM   |
| Falcons                   | `falcons.png`                   | `atcfalcons`               | FAL   |
| Horustec                  | `horustec.png`                  | `_horustec`                | HOR   |
| Calango TEC \| Baja       | `calango-tec-baja.png`          | `calangotecbaja`           | BAJA  |
| TEC Racing \| Fórmula SAE | `tec-racing.png`                | `gotecr`                   | SAE   |
| IEEE Cimatec              | `ieee-cimatec.png`              | `ieeecimatec`              | IEEE  |
| Cimatec JR                | `cimatec-jr.png`                | `cimatecjr`                | CJR   |
| AIAS                      | `aias.png`                      | `aiascimatec`              | AIAS  |
| DAEQ Cimatec              | `daeq-cimatec.png`              | `daeqcimatec`              | DAEQ  |

As 11 estão no lugar. A sigla é o plano B: enquanto o arquivo não existir, o slot mostra ela.

## Como o slot se comporta

O `.iniciativa-logo` é um círculo de 46 px (`border-radius: 50%`) com `overflow: hidden`,
como o avatar no próprio Instagram de onde as logos vêm. A imagem vai de borda a borda com
`object-fit: contain` e nasce com `opacity: 0` — só aparece quando o `script.js` confirma o
`load` e marca o slot com `.tem-logo`. Por isso uma logo que falta nunca vira ícone quebrado,
e nada pisca durante o carregamento.

A imagem não tem recuo de propósito: recuada, ela teria os cantos comidos pelo círculo e
sobraria fundo nas laterais — o resultado não é círculo nem quadrado. Como as logos são
quadradas, ir de borda a borda preenche o círculo exatamente.

As imagens são `loading="lazy"` dentro de um `<dialog>`: elas só baixam quando o modal abre
pela primeira vez. Se for testar no console, abra o modal antes de conferir `.tem-logo`.

## Formato

- PNG quadrado de 256×256. É o que está publicado hoje.
- 256 px cobre o slot de 46 px com folga até em telas 3x, e o `contain` não corta nada.
- Quadrado não é capricho: o slot é redondo, e só uma imagem quadrada preenche o círculo
  sem sobrar fundo nas laterais.
- Prefira o símbolo à assinatura horizontal — numa moldura redonda uma marca larga encolhe
  até virar tarja. Se o símbolo tiver detalhe encostado na borda, deixe uma margem própria
  dentro do PNG: o círculo corta o que passa dele.

### Sobre o fundo

As logos atuais vieram da foto de perfil do Instagram, que é sempre JPEG opaco, então cada
uma carrega o próprio fundo — branco em `cimatec-jr` e `horustec`, escuro em
`aws-student-builder-group` e `falcons`, colorido nas demais. Com o slot redondo isso deixou
de ser problema: elas leem como avatar e funcionam nos dois temas, que era exatamente o risco
que este README apontava quando o slot ainda era quadrado.

Transparência continua bem-vinda numa logo nova, mas agora é preferência, não requisito.

## De onde vieram

Foto de perfil pública do Instagram de cada iniciativa, entre 397 px e 1080 px conforme o
perfil, reduzida para 256×256 PNG. Os JPEG originais, em resolução cheia, ficam em
`assets/brand/iniciativas/` com os mesmos nomes — é de lá que se regera esta pasta.

Última coleta: 10/08/2026.

## Direitos

Cada logo pertence à sua iniciativa. O uso aqui é para identificar o grupo ao lado do link
do próprio perfil, mas peça autorização antes de publicar — e troque na hora se alguma
iniciativa pedir.
