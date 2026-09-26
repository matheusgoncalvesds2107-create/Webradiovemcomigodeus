# Modo 24 horas

Esta versão mantém o player sempre alimentado pela biblioteca salva.

- Nos horários dos 4 programas, o áudio preparado do programa entra primeiro.
- Fora dos horários, o player intercala louvores, mensagens e programas já salvos.
- Quando um áudio termina, o próximo começa automaticamente.
- Abrir o site e ouvir novamente não chama a IA.
- A IA só é usada ao preparar novos conteúdos.

## Importante no Render
O cache local pode ser apagado em novo deploy/restart. Para manter a biblioteca, configure `RADIO_STORAGE_DIR` apontando para um disco persistente, se seu plano do Render oferecer Persistent Disk. Sem disco persistente, a rotação funciona enquanto os arquivos existirem na instância, mas pode perder a biblioteca depois de um redeploy.
