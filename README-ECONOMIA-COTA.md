# Modo econômico de cota

Esta versão foi ajustada para não gastar a cota de voz quando um ouvinte abre o site.

## Regra principal
- O site público nunca gera TTS novo por conta própria.
- No painel, use **Preparar programação de hoje** uma vez por dia.
- O motor prepara no máximo 4 áudios TTS por dia: 1 para cada programa.
- Aberturas, pregações, orações, mensagens de fé e encerramento do programa são reunidos em uma única geração de voz por apresentador.
- Abrir ou ouvir o mesmo áudio novamente usa o cache e não faz nova chamada ao Gemini.
- Vinheta textual usa conteúdo fixo e não consome IA.
- Louvores só são gerados manualmente e no máximo 1 por dia nesta configuração.

## Limites de segurança configuráveis no Render
- MAX_TTS_DAY=4
- MAX_TEXT_DAY=4
- MAX_MUSIC_DAY=1
- ALLOW_ADHOC_TTS=false

Não aumente MAX_TTS_DAY enquanto a conta estiver no limite gratuito de 10 chamadas diárias do modelo TTS.

## Importante sobre Render
O disco padrão de um Web Service pode ser efêmero. Se o serviço reiniciar/reimplantar, arquivos de cache podem desaparecer. Para uma rádio 24h definitiva, use armazenamento persistente (Render Persistent Disk ou armazenamento externo) para manter os áudios prontos.
