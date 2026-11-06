const path = require('path');
const {
  latestBackupFilename,
  restoreTrainingContentFromBackup,
} = require('../src/utils/trainingContentRestore');

async function run() {
  const backupDir = path.resolve(__dirname, '../backup');
  const filename = process.argv[2] || latestBackupFilename(backupDir);

  if (!filename) {
    console.error('Nenhum backup encontrado para importar.');
    process.exit(1);
  }

  const result = await restoreTrainingContentFromBackup(filename, { backupDir });
  console.log(JSON.stringify(result, null, 2));
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message);
    process.exit(1);
  });
