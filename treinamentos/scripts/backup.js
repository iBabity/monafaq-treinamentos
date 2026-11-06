const { runBackup } = require('../src/utils/backupHelper');

console.log('[Script Backup] Iniciando backup do banco de dados...');
runBackup()
  .then(result => {
    console.log('[Script Backup] Backup concluído com sucesso!');
    console.log(`[Script Backup] Arquivo salvo em: ${result.filePath}`);
    process.exit(0);
  })
  .catch(err => {
    console.error('[Script Backup] Falha no backup:', err.message);
    process.exit(1);
  });
