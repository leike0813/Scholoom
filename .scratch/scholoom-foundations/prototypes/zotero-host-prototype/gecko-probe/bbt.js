async function probeBBT({outputDir, record}) {
  const fixtures = await IOUtils.readJSON(PathUtils.join(outputDir, "items.json"));
  const items = [];
  const ready = await record("bbt-ready", async () => {
    for (let i = 0; i < 100 && !Zotero.BetterBibTeX; i++) await Zotero.Promise.delay(200);
    if (!Zotero.BetterBibTeX) throw new Error("BBT global unavailable");
    await Promise.race([Zotero.BetterBibTeX.ready,
      Zotero.Promise.delay(30000).then(() => {throw new Error("BBT ready timeout");})]);
    return {ready: true, keyManagerStarted: Zotero.BetterBibTeX.KeyManager.started};
  });
  if (!ready) return;
  await record("bbt-citekey-generate-and-preserve", async () => {
    for (const fixture of fixtures) {
      const item = new Zotero.Item(fixture.itemType);
      item.fromJSON(fixture);
      await item.saveTx();
      items.push(item);
    }
    await Zotero.BetterBibTeX.KeyManager.fill(items.map(item => item.id));
    const generated = items[0].getField("citationKey");
    const preserved = items[1].getField("citationKey");
    if (!generated || preserved !== fixtures[1].citationKey) throw new Error("Citation key generation/preservation failed");
    // A second fill must preserve existing keys, including the generated one.
    await Zotero.BetterBibTeX.KeyManager.fill(items.map(item => item.id));
    if (items[0].getField("citationKey") !== generated) throw new Error("Generated key changed on second fill");
    const rows = await Zotero.DB.queryAsync(
      "SELECT itemData.itemID, itemDataValues.value FROM itemData JOIN fields USING (fieldID) JOIN itemDataValues USING (valueID) WHERE fields.fieldName = ? AND itemData.itemID IN (?, ?)",
      ["citationKey", ...items.map(item => item.id)]);
    const sql = rows.map(row => ({itemID: row.itemID, value: row.value}));
    if (sql.length !== 2 || !sql.some(row => row.value === generated) || !sql.some(row => row.value === preserved)) {
      throw new Error("Native citationKey SQL visibility differs from Item fields");
    }
    await IOUtils.writeJSON(PathUtils.join(outputDir, "bbt-items.json"), items.map(item => item.toJSON()));
    return {generated, preserved, sql, itemIDs: items.map(item => item.id),
      authority: "isolated Zotero library", secondFillPreserved: true};
  });
  for (const slug of ["BetterBibTeX", "BetterBibLaTeX"]) {
    await record(`bbt-export-${slug}`, async () => {
      const translator = Zotero.BetterBibTeX.Translators.bySlug[slug];
      if (!translator) throw new Error(`Missing translator ${slug}`);
      const text = await Zotero.BetterBibTeX.Translators.exportItems({
        translatorID: translator.translatorID,
        displayOptions: {worker: true, exportNotes: false},
        scope: {type: "items", items}, timeout: 30,
      });
      if (!text || !text.includes(items[0].getField("citationKey")) || !text.includes(fixtures[1].citationKey)) {
        throw new Error("Export missing citation keys");
      }
      await IOUtils.writeUTF8(PathUtils.join(outputDir, `${slug}.bib`), text);
      return {translatorID: translator.translatorID, bytes: new TextEncoder().encode(text).length,
        keys: items.map(item => item.getField("citationKey")), path: `${slug}.bib`, requestedWorker: true};
    });
  }
  await record("attachment-and-file-boundaries", async () => {
    const pdfPath = PathUtils.join(outputDir, "fixture.pdf");
    const managed = await Zotero.Attachments.importFromFile({file: pdfPath, parentItemID: items[0].id});
    const linked = await Zotero.Attachments.linkFromFile({file: pdfPath, parentItemID: items[0].id});
    const managedPath = await managed.getFilePathAsync();
    const linkedPath = await linked.getFilePathAsync();
    if (managedPath === pdfPath || linkedPath !== pdfPath || managed.parentID !== items[0].id || linked.parentID !== items[0].id) {
      throw new Error("Managed/linked attachment relationship mismatch");
    }
    const projectPath = PathUtils.join(outputDir, "project-reference.pdf");
    await IOUtils.copy(pdfPath, projectPath);
    return {managed: {id: managed.id, key: managed.key, parentID: managed.parentID, linkMode: managed.attachmentLinkMode, path: managedPath},
      linked: {id: linked.id, parentID: linked.parentID, linkMode: linked.attachmentLinkMode, path: linkedPath},
      projectReference: {path: projectPath, registeredInLibrary: false},
      scope: "Zotero native attachment APIs; not plugin local-match or Scholoom database mapping"};
  });
}
