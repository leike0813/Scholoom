// Synthetic Adapter only: the product has no common-library provider wired yet.
const { app } = require('electron');
const { join } = require('node:path');
const { mkdirSync } = require('node:fs');
const root = join(__dirname, '../../..');
const { ZoteroHost } = require(join(root, 'apps/zotero-host/out/main/host.cjs'));
const { createCatalog } = require('./catalog.cjs');
const profile = process.env.SCHOOLOOM_BBT_PROFILE;
mkdirSync(profile, { recursive: true });
app.setPath('userData', profile);
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const catalog = createCatalog(profile);
  const host = new ZoteroHost({
    packageDirectory: process.env.SCHOOLOOM_BBT_PACKAGE,
    profileDirectory: profile,
    dateFormats: join(root, 'apps/zotero-host/resources/dateFormats.json'),
    catalog,
    rendererDirectory: join(root, 'apps/zotero-host/out/renderer'),
    preload: join(root, 'apps/zotero-host/out/preload/index.cjs'),
  });
  globalThis.fixture = { catalog, host };
  if (process.env.SCHOOLOOM_BBT_MANUAL_START !== '1') await host.start();
});
