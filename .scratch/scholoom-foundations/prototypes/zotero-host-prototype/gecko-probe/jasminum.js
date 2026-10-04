/* Throwaway Gecko probe for the unmodified Jasminum 1.1.39 XPI. */
async function probeJasminum({ outputDir, pdfPath, record }) {
  const addon = Zotero.Jasminum;
  const fixture = await IOUtils.readJSON(PathUtils.join(outputDir, "chinese-fixture.json"));
  const results = {};
  const created = [];
  let reader;
  let tabID;

  results.metadata = await record("jasminum.metadata", async () => {
    const verification = "unmodified Jasminum taskRunner search + metaTranslate + globalItemFix";
    if (!addon?.taskRunner?.createTask || !addon.taskRunner.runTask) throw new Error("Jasminum public taskRunner is unavailable");
    const source = Zotero.File.pathToFile(pdfPath);
    const attachment = await Zotero.Attachments.importFromFile({ file: source, libraryID: Zotero.Libraries.userLibraryID });
    created.push(attachment);
    await attachment.renameAttachmentFile(`${fixture.title}.pdf`);

    const prefKeys = ["metadataSource", "isMainlandChina", "namePattern", "namePatternCustom"];
    const prefs = Object.fromEntries(prefKeys.map(key => {
      const fullKey = `extensions.jasminum.${key}`;
      return [fullKey, Zotero.Prefs.get(fullKey, true)];
    }));
    const httpRequest = Zotero.HTTP.request;
    const translate = Zotero.Translate.Web.prototype.translate;
    const cookie = addon.data.myCookieSandbox.getCNKIHomeCookieId;
    const mockCalls = [];
    let translatedFixture;
    try {
      Zotero.Prefs.set("extensions.jasminum.metadataSource", "CNKI", true);
      Zotero.Prefs.set("extensions.jasminum.isMainlandChina", true, true);
      Zotero.Prefs.set("extensions.jasminum.namePattern", "{%t}", true);
      Zotero.Prefs.set("extensions.jasminum.namePatternCustom", "{%t}", true);
      addon.data.myCookieSandbox.getCNKIHomeCookieId = async () => 0;
      Zotero.HTTP.request = async (method, url, options = {}) => {
        mockCalls.push({ method, url, responseType: options.responseType || "text" });
        if (url === "https://kns.cnki.net/kns8s/brief/grid" && method === "POST" && !options.responseType) {
          return { responseText: fixture.searchHTML, responseURL: url, status: 200 };
        }
        const articleURL = "https://kns.cnki.net/kcms/detail/detail.aspx?dbcode=CJFD&filename=JASM202610001";
        if (url === articleURL && method === "GET" && options.responseType === "document") {
          return {
            response: new DOMParser().parseFromString(fixture.articleHTML, "text/html"),
            responseURL: url,
            responseText: fixture.articleHTML,
            status: 200
          };
        }
        throw new Error(`Unexpected HTTP request escaped CNKI fixture boundary: ${method} ${url} (${options.responseType || "text"})`);
      };
      Zotero.Translate.Web.prototype.translate = async function () {
        mockCalls.push({ transport: "Zotero.Translate.Web.translate fixture" });
        const item = new Zotero.Item(fixture.translatedItem.itemType);
        for (const [field, value] of Object.entries(fixture.translatedItem.fields)) item.setField(field, value);
        item.setCreators(fixture.translatedItem.creators);
        await item.saveTx();
        created.push(item);
        translatedFixture = item;
        return [item];
      };
      const before = { attachmentID: attachment.id, attachmentTitle: attachment.getField("title"), attachmentFilename: attachment.attachmentFilename, parentID: attachment.parentID || null };
      const task = addon.taskRunner.createTask(attachment, "attachment", true);
      await addon.taskRunner.runTask(task);
      if (task.status !== "success") throw new Error(`Original Jasminum task ended with status ${task.status}: ${task.message || "no task message"}`);
      const parent = Zotero.Items.get(attachment.parentID);
      const after = {
        taskStatus: task.status,
        taskMessages: task.message || "",
        attachmentID: attachment.id,
        parentID: attachment.parentID,
        parentTitle: parent?.getField("title") || "",
        parentCreators: parent?.getCreators() || [],
        translatorReturnedItemID: translatedFixture?.id || null,
        httpAndTranslateCalls: mockCalls
      };
      if (!parent || parent.getField("title") !== fixture.translatedItem.fields.title) throw new Error("Jasminum did not apply the fixture translator item to a parent item");
      return {
        verification,
        scope: "Temporary top-level imported PDF attachment; original taskRunner and metadata business logic; CNKI HTTP/search-document and Zotero.Translate.Web return are deterministic fixtures, not live CNKI or a live Zotero translator.",
        before,
        after
      };
    } finally {
      Zotero.HTTP.request = httpRequest;
      Zotero.Translate.Web.prototype.translate = translate;
      addon.data.myCookieSandbox.getCNKIHomeCookieId = cookie;
      for (const [key, value] of Object.entries(prefs)) value == null ? Zotero.Prefs.clear(key, true) : Zotero.Prefs.set(key, value, true);
    }
  });

  results.outline = await record("jasminum.outline", async () => {
    const verification = "Zotero.Reader.open returned instance passed directly to the original addon.api.getOutlineFromPDF";
    const attachment = created.find(item => item?.isAttachment?.());
    if (!attachment) throw new Error("Temporary PDF attachment was not created by the metadata probe");
    reader = await Zotero.Reader.open(attachment.id);
    tabID = reader?.tabID ?? reader?._tabID ?? addon.data.ztoolkit.getGlobal("Zotero_Tabs")?.selectedID;
    if (!reader || !tabID) throw new Error("Zotero.Reader.open returned no Reader instance or discoverable tab ID");
    await (reader._initPromise || reader._internalReader?._initPromise);
    const jasminumReader = reader;
    const before = {
      readerOpened: true,
      tabID,
      readerItemID: reader._item?.id || null,
      internalReaderItemID: reader._internalReader?._item?.id || null,
      primaryViewOnReader: !!reader._primaryView,
      primaryViewOnInternalReader: !!reader._internalReader?._primaryView
    };
    if (!jasminumReader._item || !jasminumReader._primaryView) throw new Error(`Zotero.Reader.open returned a real Reader lacking fields required by Jasminum getOutlineFromPDF: _item=${!!jasminumReader._item}, _primaryView=${!!jasminumReader._primaryView}, internalReaderItem=${!!reader._internalReader?._item}, internalReaderPrimaryView=${!!reader._internalReader?._primaryView}`);
    const outline = await addon.api.getOutlineFromPDF(jasminumReader);
    if (!Array.isArray(outline)) throw new Error("Jasminum getOutlineFromPDF returned no outline array");
    const titles = [];
    const collectTitles = nodes => nodes.forEach(node => { titles.push(node.title); collectTitles(node.children || []); });
    collectTitles(outline);
    if (!titles.includes("Introduction") || !titles.includes("Methods")) throw new Error(`Original Jasminum outline result did not contain the PDF fixture headings: ${JSON.stringify(titles)}`);
    const sidecar = PathUtils.join(Zotero.DataDirectory.dir, "storage", attachment.key, "jasminum-outline.json");
    const sidecarExists = await IOUtils.exists(sidecar);
    if (!sidecarExists) throw new Error("Jasminum returned the PDF outline but did not write its outline sidecar");
    const sidecarValue = await IOUtils.readJSON(sidecar);
    const after = { outlineNodeCount: outline.length, outlineTitles: titles, sidecarPath: sidecar, sidecarExists, sidecarOutline: sidecarValue.outline };
    return {
      verification,
      scope: "Temporary PDF attachment opened by Zotero.Reader; unmodified Jasminum PDF outline API; reader private-view fields recorded as observed.",
      before,
      after
    };
  });

  results.bookmarks = await record("jasminum.bookmarks", async () => {
    const verification = "Original Reader bookmark add event, sidecar write, and reopen projection";
    if (!reader || !tabID) throw new Error("Reader was not opened successfully for the bookmark probe");
    let doc = reader._iframeWindow?.document;
    // The original plugin installs its sidebar controls when the real sidebar opens.
    if (!doc?.getElementById("j-bookmark-add")) doc?.getElementById("sidebarToggle")?.click();
    for (let i = 0; i < 60 && !doc?.getElementById("j-bookmark-add"); i++) {
      await new Promise(resolve => setTimeout(resolve, 250));
      doc = reader._iframeWindow?.document;
    }
    const addButton = doc?.getElementById("j-bookmark-add");
    if (!addButton) {
      const detail = {sidebarToggle: !!doc?.getElementById("sidebarToggle"),
        sidebarContainer: !!doc?.getElementById("sidebarContainer"),
        sidebarStart: !!doc?.querySelector("#sidebarContainer div.start"),
        pluginOutlineButton: !!doc?.getElementById("j-outline-button"),
        documentURL: doc?.URL, ids: Array.from(doc?.querySelectorAll("[id]") || []).map(el => el.id)};
      await IOUtils.writeJSON(PathUtils.join(outputDir, "reader-controls.json"), detail);
      const error = new Error("Jasminum bookmark add UI was not installed after opening the real Reader sidebar");
      error.detail = detail;
      throw error;
    }
    const attachment = reader._item;
    const pdfBefore = await IOUtils.read(await attachment.getFilePathAsync());
    const sidecarPath = PathUtils.join(Zotero.DataDirectory.dir, "storage", attachment.key, "jasminum-bookmarks.json");
    const before = { sidecarExists: await IOUtils.exists(sidecarPath), addButtonPresent: true, bookmarkCount: doc.querySelectorAll("li.bookmark-item").length };
    addButton.click();
    let sidecar;
    for (let i = 0; i < 40; i++) {
      if (await IOUtils.exists(sidecarPath)) {
        sidecar = await IOUtils.readJSON(sidecarPath);
        if (sidecar.bookmarks?.length) break;
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    if (!sidecar?.bookmarks?.length) throw new Error("Original bookmark UI event did not produce a readable bookmark sidecar within 10 seconds");
    if (typeof reader.close === "function") await reader.close();
    else if (typeof Zotero.Reader.close === "function") await Zotero.Reader.close(tabID);
    else throw new Error("Zotero Reader exposes no close operation for the required reopen check");
    const reopened = await Zotero.Reader.open(attachment.id);
    const reopenedTabID = reopened?.tabID ?? reopened?._tabID ?? addon.data.ztoolkit.getGlobal("Zotero_Tabs")?.selectedID;
    if (!reopened || !reopenedTabID) throw new Error("Reader did not reopen as an instance with a discoverable tab ID");
    await reopened._initPromise;
    if (!reopened._iframeWindow.document.querySelector("li.bookmark-item")) reopened._iframeWindow.document.getElementById("sidebarToggle")?.click();
    for (let i = 0; i < 40 && !reopened._iframeWindow.document.querySelector("li.bookmark-item"); i++) await new Promise(resolve => setTimeout(resolve, 250));
    const reopenedDoc = reopened._iframeWindow.document;
    const reopenedCount = reopenedDoc.querySelectorAll("li.bookmark-item").length;
    if (!reopenedCount) throw new Error("Reopened Jasminum Reader did not project the saved bookmark");
    reader = reopened;
    tabID = reopenedTabID;
    const pdfAfter = await IOUtils.read(await attachment.getFilePathAsync());
    return {
      verification,
      scope: "Bookmark created through the unmodified Jasminum Reader button event; exact sidecar bytes parsed from Zotero storage; Reader reopened and its UI projection checked.",
      before,
      after: { sidecarPath, sidecarExists: true, sidecarInfo: sidecar.info, sidecarBookmarks: sidecar.bookmarks, reopenedBookmarkCount: reopenedCount,
        pdfBytesUnchanged: pdfBefore.length === pdfAfter.length && pdfBefore.every((value, i) => value === pdfAfter[i]) }
    };
  });

  return { outputDir, pdfPath, results };
}
