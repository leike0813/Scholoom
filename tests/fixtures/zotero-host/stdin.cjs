const { app } = require('electron');
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');

const directory = process.argv.at(-1);
app.setPath('userData', directory);
app.on('window-all-closed', () => {});
async function main() {
  let receivedBytes = 0;
  for await (const chunk of process.stdin) {
    receivedBytes += Buffer.byteLength(chunk);
    if (receivedBytes > 4096) throw new Error('Synthetic envelope too large');
  }
  await app.whenReady();
  writeFileSync(join(directory, 'stdin-observation.json'), JSON.stringify({ receivedBytes }), {
    flag: 'wx',
    mode: 0o600,
  });
  app.exit(0);
}
void main().catch(() => app.exit(1));
