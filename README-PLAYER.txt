WEB RÁDIO VEM COMIGO DEUS — PLAYER PRÓPRIO

Substitua/adicione no GitHub:
- gateway.js (novo, na raiz)
- package.json
- public/index.html
- public/style.css
- public/app.js

NÃO apague o server.js atual.

No Render:
PUBLIC_STREAM_URL = http://sapircast.caster.fm:11743/I3Pqo

O package.json passa a iniciar gateway.js.
O gateway deixa o server.js atual rodando internamente e cria /radio-stream,
evitando o bloqueio de conteúdo HTTP dentro do site HTTPS.

O player mostrado ao ouvinte é o player próprio da Web Rádio Vem Comigo Deus.
Não usa iframe nem widget visível do Caster.
