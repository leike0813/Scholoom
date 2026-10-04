/* Cold start: do not resolve uiReady or substitute plugin readiness. */
async function probeCold({outputDir, record, report}) {
  const windows = () => {
    const enumerator = Services.wm.getEnumerator(null);
    const found = [];
    while (enumerator.hasMoreElements()) {
      const win = enumerator.getNext();
      found.push({type: win.document.documentElement.getAttribute("windowtype"), uri: win.document.documentURI});
    }
    return found;
  };
  const seedPath = PathUtils.join(outputDir, "seed-items.json");
  const seed = await IOUtils.exists(seedPath) ? await IOUtils.readJSON(seedPath) : null;
  let item, attachment;
  if (seed) {
    item = await Zotero.Items.getByLibraryAndKeyAsync(seed.itemRef.libraryID, seed.itemRef.key);
    attachment = await Zotero.Items.getByLibraryAndKeyAsync(seed.attachmentRef.libraryID, seed.attachmentRef.key);
    if (!item || !attachment) throw new Error("Stopped seed fixtures missing from copied library");
  } else {
    const fixture = (await IOUtils.readJSON(PathUtils.join(outputDir, "items.json")))[0];
    item = new Zotero.Item(fixture.itemType);
    item.fromJSON(fixture);
    await item.saveTx();
    attachment = await Zotero.Attachments.importFromFile({file: PathUtils.join(outputDir, "fixture.pdf"), parentItemID: item.id});
  }
  let bbtReadyResolved = false;
  let uiReadyResolved = false;
  Zotero.uiReadyPromise.then(() => {uiReadyResolved = true;});
  const observedAt = Date.now();
  const bbtReady = Zotero.BetterBibTeX?.ready;
  if (bbtReady) await Promise.race([bbtReady.then(() => {bbtReadyResolved = true;}), Zotero.Promise.delay(60000)]);
  else await Zotero.Promise.delay(60000);
  for (let i = 0; i < 50 && !Zotero.Jasminum; i++) await Zotero.Promise.delay(100);
  report.coldStart = {mainWindowCount: Zotero.getMainWindows().length, windows: windows(), uiReadyResolved,
    bbtGlobalPresent: !!Zotero.BetterBibTeX, bbtReadyResolved,
    bbtKeyManagerStarted: !!Zotero.BetterBibTeX?.KeyManager?.started, jasminumGlobalPresent: !!Zotero.Jasminum,
    observationMs: Date.now() - observedAt, observationLimitMs: 60000,
    seedFrom: seed?.sourceRun || null, authority: seed ? "stopped scratch library copied for cold comparison" : "fresh scratch Zotero library"};
  await record("cold-native-library", async () => {
    if (report.coldStart.mainWindowCount !== 0 || uiReadyResolved) throw new Error("Cold probe opened or initialized the main workbench");
    return {...report.coldStart, itemID: item.id, itemKey: item.key, attachmentID: attachment.id};
  });
  return {item, attachment};
}
