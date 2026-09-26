# Web Rádio Vem Comigo Deus

Projeto automático de rádio cristã com 4 programas diários, pregações, orações, mensagens de fé, vozes específicas e louvores originais gerados por IA.

## Grade
- 09:00–10:00 — Bom Dia Deus — Pastor Luiz Felipe (Puck)
- 12:30–13:00 — Encontro com Deus — Missionária Ingrid Laura (Sulafat)
- 18:00–19:00 — Tarde da Benção — Pastor Bernardo Henrique (Achird)
- 19:00–21:00 — Culto No Seu Lar — Pastor Heitor Cruz (Charon)

Vozes extras: Pastor Fernando Baptista (Fenrir) e Pastora Manuela Rodrigues (Pulcherrima).

## Como rodar no PC
1. Instale Node.js 20 ou mais novo.
2. Abra a pasta no terminal.
3. Rode: `npm install`
4. Configure a variável `GEMINI_API_KEY`.
   - Windows PowerShell: `$env:GEMINI_API_KEY="SUA_CHAVE"`
   - Linux/macOS: `export GEMINI_API_KEY="SUA_CHAVE"`
5. Rode: `npm start`
6. Abra `http://localhost:3000`.

## Render
- Build command: `npm install`
- Start command: `npm start`
- Environment: adicione `GEMINI_API_KEY`.
- Runtime: Node.

## Como funciona
O relógio usa `America/Sao_Paulo`. Quando o ouvinte liga a rádio, o motor reconhece o programa do horário e monta a sequência: abertura → louvor → Palavra → louvor → oração → mensagem de fé → encerramento.

O texto pode ser criado pelo Gemini 3.8 Flash, as falas são geradas pelo Gemini 3.8 Flash TTS e os louvores originais pelo Lyria 3.5. Os áudios são guardados em cache para evitar gerar a mesma faixa toda vez.

## Direitos autorais
Os cinco louvores incluídos têm letras originais feitas para este projeto. O prompt do motor também proíbe imitação de artistas ou músicas existentes. Não adicione gravações comerciais sem autorização.

## Observação sobre autoplay
Navegadores normalmente exigem um primeiro clique do usuário para iniciar áudio. Depois do botão “LIGAR RÁDIO”, o player segue automaticamente de um bloco para o próximo.

## Painel 3.0
Acesse `http://localhost:3000/admin.html` para abrir o novo painel visual da Web Rádio Vem Comigo Deus.

As duas artes oficiais fornecidas pelo projeto estão em `public/assets/`:
- `logo-radio.png` — marca principal da Web Rádio Vem Comigo Deus.
- `logo-pregacao24.png` — capa da Rádio 24 Pregação.

O Painel 3.0 já mostra “No ar agora”, grade, biblioteca dos 5 louvores, área de geração de conteúdo e área preparada para o sinal Icecast/SHOUTcast. A próxima etapa é ligar os botões administrativos e reaproveitar o encoder/automação do painel Android anterior.


## Correção 1.0.1 (setembro/2026)

- Atualiza `@google/genai` para a linha 2.x exigida pela nova Interactions API.
- Cria automaticamente `cache/tts` e `cache/music` no boot, evitando `ENOENT` no Render.
- Mantém o Lyria 3.5 na nova Interactions API.

Depois de enviar estes arquivos ao GitHub, faça um novo deploy no Render. O `npm install` instalará a SDK atualizada.
