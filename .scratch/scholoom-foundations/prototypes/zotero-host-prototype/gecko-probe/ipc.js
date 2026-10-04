/* Throwaway loopback RPC. One scratch Zotero library remains the authority. */
async function startIPC({outputDir, report, save, fixtures}) {
  const {HttpServer} = ChromeUtils.importESModule("chrome://remote/content/server/httpd.sys.mjs");
  const {NetUtil} = ChromeUtils.importESModule("resource://gre/modules/NetUtil.sys.mjs");
  const mainWindows = () => Zotero.getMainWindows().filter(win => !win.closed);
  const keyResult = report.checks.find(check => check.name === "bbt-citekey-generate-and-preserve" && check.status === "passed");
  const outline = report.checks.find(check => check.name === "jasminum.outline" && check.status === "passed");
  if (!fixtures && (!keyResult || !outline)) throw new Error("IPC requires successful scratch fixture setup");
  const attachment = fixtures?.attachment || await Zotero.Items.getAsync(outline.detail.before.readerItemID);
  const boundary = ["boundary", "reader", "restart"].includes(Services.prefs.getStringPref("extensions.scholoomProbe.round", "baseline"));
  // The reading fixture's real parent keeps metadata, citekey and navigation on one source.
  const item = fixtures?.item || await Zotero.Items.getAsync(boundary ? attachment.parentID : keyResult.detail.itemIDs[0]);
  if (boundary) await Zotero.BetterBibTeX.KeyManager.fill([item.id]);
  const ref = item => ({libraryID: item.libraryID, key: item.key});
  const resolveItem = async identity => {
    if (identity?.libraryID !== item.libraryID || typeof identity.key !== "string") throw new Error("Invalid scratch identity");
    const found = await Zotero.Items.getByLibraryAndKeyAsync(identity.libraryID, identity.key);
    if (!found || ![item.id, attachment.id].includes(found.id)) throw new Error("Identity outside prototype fixtures");
    return found;
  };
  async function snapshot(identity) {
    const found = await resolveItem(identity);
    await found.loadDataType("itemData");
    await found.reload(["itemData"], true);
    const rows = await Zotero.DB.queryAsync(
      "SELECT fields.fieldName, itemDataValues.value FROM itemData JOIN fields USING (fieldID) JOIN itemDataValues USING (valueID) WHERE itemData.itemID=? AND fields.fieldName IN (?, ?)",
      [found.id, "title", "citationKey"]);
    return {ref: ref(found), itemID: found.id, title: found.getField("title"), citationKey: found.getField("citationKey"),
      sql: Object.fromEntries(rows.map(row => [row.fieldName, row.value])), mainWindowCount: mainWindows().length,
      bbtReady: !!Zotero.BetterBibTeX?.KeyManager.started, jasminumReady: !!Zotero.Jasminum,
      dataDirectory: Zotero.DataDirectory.dir};
  }
  const events = [];
  const persistEvents = () => IOUtils.writeJSON(PathUtils.join(outputDir, "ipc-host-events.json"), events);
  // HttpServer writes an 8-bit string; encode JSON before passing Unicode text to it.
  const writeJSON = (response, value) => {
    let bytes = "";
    for (const byte of new TextEncoder().encode(JSON.stringify(value))) bytes += String.fromCharCode(byte);
    response.write(bytes);
  };
  const server = new HttpServer();
  const token = Services.uuid.generateUUID().toString();
  let survivalArea = false;
  let busy = false;
  async function execute({method, params = {}}) {
    switch (method) {
      case "snapshot": return snapshot(params.ref);
      case "updateTitle": {
        const found = await resolveItem(params.ref);
        if (found.id !== item.id || typeof params.title !== "string" || !params.title.length || params.title.length > 300) throw new Error("Invalid title update");
        found.setField("title", params.title);
        await found.saveTx();
        if (Zotero.BetterBibTeX?.KeyManager?.started) await Zotero.BetterBibTeX.KeyManager.fill([found.id]);
        return snapshot(params.ref);
      }
      case "export": {
        const found = await resolveItem(params.ref);
        const translator = Zotero.BetterBibTeX.Translators.bySlug[params.format];
        if (found.id !== item.id || !["BetterBibTeX", "BetterBibLaTeX"].includes(params.format) || !translator) throw new Error("Invalid export scope");
        const text = await Zotero.BetterBibTeX.Translators.exportItems({translatorID: translator.translatorID,
          displayOptions: {worker: true, exportNotes: false}, scope: {type: "items", items: [found]}, timeout: 30});
        return {ref: ref(found), text, mainWindowCount: mainWindows().length};
      }
      case "pluginReady": {
        await Promise.race([Zotero.BetterBibTeX.ready,
          Zotero.Promise.delay(20000).then(() => {throw new Error("BBT readiness timed out");})]);
        await Zotero.BetterBibTeX.KeyManager.fill([item.id]);
        return snapshot(ref(item));
      }
      case "regenerateCitationKey": {
        if (!boundary) throw new Error("Citation regeneration belongs to the boundary experiment");
        const found = await resolveItem(params.ref);
        if (found.id !== item.id) throw new Error("Citation regeneration requires the source fixture");
        const before = await snapshot(params.ref);
        await Zotero.BetterBibTeX.KeyManager.fill([found.id], {replace: true});
        const after = await snapshot(params.ref);
        return {before, after, writer: "unmodified BBT KeyManager.fill({replace: true})", scope: [found.id]};
      }
      case "readingState": {
        if (!boundary) throw new Error("Reading state belongs to the boundary experiment");
        const found = await resolveItem(params.ref);
        if (found.id !== attachment.id || found.parentID !== item.id) throw new Error("Reading material outside source fixture");
        const storage = PathUtils.join(Zotero.DataDirectory.dir, "storage", found.key);
        const outline = await IOUtils.readJSON(PathUtils.join(storage, "jasminum-outline.json"));
        const bookmarks = await IOUtils.readJSON(PathUtils.join(storage, "jasminum-bookmarks.json"));
        const path = await found.getFilePathAsync();
        return {ref: ref(found), sourceRef: ref(item), contentType: found.attachmentContentType,
          fileName: found.attachmentFilename, fileExists: await IOUtils.exists(path),
          storageMode: found.attachmentLinkMode === Zotero.Attachments.LINK_MODE_IMPORTED_FILE ? "managed" : "linked",
          outline: outline.outline, bookmarks: bookmarks.bookmarks,
          schema: bookmarks.schema, jasminumVersion: bookmarks.jasminumVersion};
      }
      case "readMaterial": {
        if (!boundary) throw new Error("Material reads belong to interface experiments");
        const found = await resolveItem(params.ref);
        if (found.id !== attachment.id) throw new Error("Material outside prototype fixture");
        const path = await found.getFilePathAsync();
        const bytes = await IOUtils.read(path);
        if (bytes.length > 1024 * 1024) throw new Error("Prototype material too large for this bounded transfer");
        return {ref: ref(found), sourceRef: ref(item), bytes: Array.from(bytes), contentType: found.attachmentContentType};
      }
      case "renameBookmark": {
        if (!boundary) throw new Error("Bookmark edits belong to interface experiments");
        const found = await resolveItem(params.ref);
        if (found.id !== attachment.id || typeof params.bookmarkId !== "string"
          || typeof params.title !== "string" || !params.title.trim() || params.title.length > 200) throw new Error("Invalid fixture bookmark edit");
        let reader = await Zotero.Reader.open(found.id);
        await reader._initPromise;
        let win = reader._iframeWindow, doc = win.document;
        if (!doc.getElementById("sidebarContainer")) doc.getElementById("sidebarToggle")?.click();
        for (let i = 0; i < 100 && !doc.querySelector(".bookmark-node"); i++) await Zotero.Promise.delay(100);
        const controlsBeforeRetry = {sidebar: !!doc.getElementById("sidebarContainer"), bookmarkViewer: !!doc.getElementById("j-bookmark-viewer"), bookmarkNodes: doc.querySelectorAll(".bookmark-node").length};
        let readerReopened = false;
        if (!doc.querySelector(".bookmark-node")) {
          // A restored tab can predate plugin toolbar registration. Try one real reopen.
          await Zotero.Reader.flushAllReaderStates(); reader.close();
          reader = await Zotero.Reader.open(found.id); await reader._initPromise;
          win = reader._iframeWindow; doc = win.document; readerReopened = true;
          if (!doc.getElementById("sidebarContainer")) doc.getElementById("sidebarToggle")?.click();
          for (let i = 0; i < 100 && !doc.querySelector(".bookmark-node"); i++) await Zotero.Promise.delay(100);
        }
        const node = Array.from(doc.querySelectorAll(".bookmark-node")).find(node => node.getAttribute("data-id") === params.bookmarkId);
        const title = node?.querySelector(".bookmark-title");
        if (!title) {
          const error = new Error("Original bookmark editor unavailable after one normal reopen");
          error.detail = {controlsBeforeRetry, readerReopened, sidebar: !!doc.getElementById("sidebarContainer"), bookmarkViewer: !!doc.getElementById("j-bookmark-viewer")};
          throw error;
        }
        const path = PathUtils.join(Zotero.DataDirectory.dir, "storage", found.key, "jasminum-bookmarks.json");
        const before = (await IOUtils.readJSON(path)).bookmarks.find(bookmark => bookmark.id === params.bookmarkId);
        const pdfBefore = await IOUtils.read(await found.getFilePathAsync());
        title.dispatchEvent(new win.MouseEvent("dblclick", {bubbles: true}));
        const input = node.querySelector(".bookmark-edit-container input");
        if (!input) throw new Error("Original rename event did not open editor");
        input.value = params.title.trim();
        input.dispatchEvent(new win.KeyboardEvent("keydown", {key: "Enter", bubbles: true}));
        let after;
        for (let i = 0; i < 100; i++) {
          after = (await IOUtils.readJSON(path)).bookmarks.find(bookmark => bookmark.id === params.bookmarkId);
          if (after?.title === params.title.trim()) break;
          await Zotero.Promise.delay(100);
        }
        const pdfAfter = await IOUtils.read(await found.getFilePathAsync());
        const pdfBytesUnchanged = pdfBefore.length === pdfAfter.length && pdfBefore.every((byte, index) => byte === pdfAfter[index]);
        if (after?.title !== params.title.trim() || !pdfBytesUnchanged) throw new Error("Original bookmark write did not persist or changed PDF");
        return {ref: ref(found), bookmarkId: params.bookmarkId, before, after, pdfBytesUnchanged,
          controlsBeforeRetry, readerReopened,
          writer: "unmodified Jasminum Reader rename event; sidecar observed after save", dependency: "original Reader DOM and active tab"};
      }
      case "verifyRenamedBookmark": {
        if (!boundary) throw new Error("Bookmark verification belongs to interface experiments");
        const found = await resolveItem(params.ref);
        if (found.id !== attachment.id) throw new Error("Bookmark verification outside fixture");
        let reader = await Zotero.Reader.open(found.id);
        await reader._initPromise;
        await Zotero.Reader.flushAllReaderStates(); reader.close();
        reader = await Zotero.Reader.open(found.id); await reader._initPromise;
        const doc = reader._iframeWindow.document;
        if (!doc.getElementById("sidebarContainer")) doc.getElementById("sidebarToggle")?.click();
        for (let i = 0; i < 100 && !doc.querySelector(".bookmark-node"); i++) await Zotero.Promise.delay(100);
        const node = Array.from(doc.querySelectorAll(".bookmark-node")).find(node => node.getAttribute("data-id") === params.bookmarkId);
        const sidecar = await IOUtils.readJSON(PathUtils.join(Zotero.DataDirectory.dir, "storage", found.key, "jasminum-bookmarks.json"));
        return {ref: ref(found), uiTitlePresent: node?.querySelector(".bookmark-title")?.textContent === params.title,
          sidecarTitle: sidecar.bookmarks.find(bookmark => bookmark.id === params.bookmarkId)?.title, readerReopened: true};
      }
      case "retryJasminum": {
        if (!mainWindows().length) throw new Error("Jasminum retry control requires a real main window");
        const beforeGlobal = !!Zotero.Jasminum;
        if (!beforeGlobal) {
          const {AddonManager} = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
          const addon = await AddonManager.getAddonByID("jasminum@linxzh.com");
          await addon.disable();
          await addon.enable();
          for (let i = 0; i < 100 && !Zotero.Jasminum; i++) await Zotero.Promise.delay(100);
        }
        if (!Zotero.Jasminum) throw new Error("Original Jasminum failed even after real main window and native re-enable");
        return {beforeGlobal, afterGlobal: !!Zotero.Jasminum, disableEnablePerformed: !beforeGlobal,
          mechanism: "original AddonManager disable/enable; no plugin hook replacement"};
      }
      case "closeWindows": {
        await Zotero.Reader.flushAllReaderStates();
        if (!survivalArea) {
          // Real toolkit keep-alive; main windows still close and receive unload hooks.
          Services.startup.enterLastWindowClosingSurvivalArea();
          survivalArea = true;
        }
        const before = mainWindows();
        for (const win of before) win.close();
        for (let i = 0; i < 100 && mainWindows().length; i++) await Zotero.Promise.delay(100);
        if (mainWindows().length) throw new Error("Main window did not close");
        return {closedWindowCount: before.length, mainWindowCount: 0, survivalArea,
          observedClosed: before.every(win => win.closed)};
      }
      case "openWindow": {
        if (!mainWindows().length) Zotero.openMainWindow();
        let win;
        for (let i = 0; i < 150; i++) {
          win = mainWindows()[0];
          if (win?.ZoteroPane?.itemsView && win.ZoteroPane.collectionsView && win.document.readyState === "complete") break;
          await Zotero.Promise.delay(100);
        }
        if (!win?.ZoteroPane?.itemsView || !win.ZoteroPane.collectionsView || win.document.readyState !== "complete") throw new Error("Main window reopen timed out");
        await Promise.race([win.ZoteroPane.itemsView.waitForLoad(),
          Zotero.Promise.delay(10000).then(() => {throw new Error("Main window item tree load timed out");})]);
        return {mainWindowCount: mainWindows().length, documentReady: win.document.readyState};
      }
      case "openReader": {
        const found = await resolveItem(params.ref);
        if (found.id !== attachment.id || !mainWindows().length) throw new Error("Reader requires attachment and reopened window");
        const reader = await Zotero.Reader.open(found.id);
        await reader._initPromise;
        const doc = reader._iframeWindow.document;
        if (!doc.getElementById("sidebarContainer")) doc.getElementById("sidebarToggle")?.click();
        for (let i = 0; i < 100 && !doc.querySelector("li.bookmark-item"); i++) await Zotero.Promise.delay(100);
        const bookmarkCount = doc.querySelectorAll("li.bookmark-item").length;
        const sidecar = await IOUtils.readJSON(PathUtils.join(Zotero.DataDirectory.dir, "storage", found.key, "jasminum-bookmarks.json"));
        return {ref: ref(found), readerItemID: reader._item.id, tabID: reader.tabID,
          bookmarkCount, sidecarBookmarkCount: sidecar.bookmarks.length,
          originalAddButtonPresent: !!doc.getElementById("j-bookmark-add")};
      }
      case "createBookmark": {
        let reader = await Zotero.Reader.open(attachment.id);
        await reader._initPromise;
        let doc = reader._iframeWindow.document;
        for (let attempt = 0; attempt < 2 && !doc.getElementById("j-bookmark-add"); attempt++) {
          if (attempt) {
            await Zotero.Reader.flushAllReaderStates();
            reader.close();
            reader = await Zotero.Reader.open(attachment.id);
            await reader._initPromise;
            doc = reader._iframeWindow.document;
          }
          doc.getElementById("sidebarToggle")?.click();
          for (let i = 0; i < 50 && !doc.getElementById("j-bookmark-add"); i++) await Zotero.Promise.delay(100);
        }
        const button = doc.getElementById("j-bookmark-add");
        if (!button) {
          const error = new Error("Original Jasminum Reader button unavailable after cold launch");
          error.detail = {readerInitialized: reader._isReaderInitialized, documentURI: doc.documentURI,
            sidebarToggle: !!doc.getElementById("sidebarToggle"), sidebarContainer: !!doc.getElementById("sidebarContainer"),
            sidebarStart: !!doc.querySelector("#sidebarContainer div.start"), outlineButton: !!doc.getElementById("j-outline-button"),
            jasminumPresent: !!Zotero.Jasminum, mainWindowCount: mainWindows().length};
          throw error;
        }
        button.click();
        const path = PathUtils.join(Zotero.DataDirectory.dir, "storage", attachment.key, "jasminum-bookmarks.json");
        for (let i = 0; i < 100; i++) {
          if (await IOUtils.exists(path)) {
            const value = await IOUtils.readJSON(path);
            if (value.bookmarks?.length) return {bookmarkCount: value.bookmarks.length, sidecarPath: path};
          }
          await Zotero.Promise.delay(100);
        }
        throw new Error("Cold Reader bookmark did not persist");
      }
      case "shutdown": {
        await Zotero.Reader.flushAllReaderStates();
        report.ipcListening = false;
        report.finishedAt = new Date().toISOString();
        await save();
        setTimeout(() => {
          if (survivalArea) Services.startup.exitLastWindowClosingSurvivalArea();
          Services.startup.quit(Services.startup.eAttemptQuit);
        }, 500);
        return {shutdownScheduled: true};
      }
      default: throw new Error("Unknown prototype method");
    }
  }
  server.registerPathHandler("/rpc", (request, response) => {
    response.processAsync();
    void (async () => {
      let payload;
      let status = 200;
      let ownsRequest = false;
      try {
        if (request.method !== "POST" || !request.hasHeader("X-Scholoom-Token") || request.getHeader("X-Scholoom-Token") !== token) {
          status = 403;
          throw new Error("Invalid prototype request");
        }
        if (busy) {status = 409; throw new Error("Prototype executes one request at a time");}
        const length = Number(request.getHeader("Content-Length"));
        if (!Number.isInteger(length) || length <= 0 || length > 4096) {status = 400; throw new Error("Invalid request size");}
        const bytes = NetUtil.readInputStreamToString(request.bodyInputStream, length);
        payload = JSON.parse(Zotero.Utilities.Internal.decodeUTF8(bytes));
        busy = true;
        ownsRequest = true;
        const result = await execute(payload);
        events.push({time: new Date().toISOString(), request: payload, result});
        await persistEvents();
        response.setStatusLine(request.httpVersion, 200, "OK");
        response.setHeader("Content-Type", "application/json; charset=utf-8", false);
        writeJSON(response, {ok: true, result});
      } catch (error) {
        status = status === 200 ? 500 : status;
        events.push({time: new Date().toISOString(), request: payload, error: String(error), stack: error.stack, detail: error.detail});
        await persistEvents();
        response.setStatusLine(request.httpVersion, status, "Error");
        response.setHeader("Content-Type", "application/json; charset=utf-8", false);
        writeJSON(response, {ok: false, error: {code: "PROTOTYPE_RPC_FAILED", message: String(error)}});
      } finally {
        if (ownsRequest) busy = false;
        response.finish();
      }
    })();
  });
  server.start(-1, "127.0.0.1");
  Zotero.addShutdownListener(() => server.stop(() => {}));
  report.ipcListening = true;
  report.ipc = {transport: "loopback HTTP JSON", port: server.identity.primaryPort,
    authority: "isolated native Zotero library; not a Scholoom storage decision", itemRef: ref(item), attachmentRef: ref(attachment)};
  await save();
  await IOUtils.writeJSON(PathUtils.join(outputDir, "ipc-ready.json"),
    {url: `http://127.0.0.1:${server.identity.primaryPort}/rpc`, token, itemRef: ref(item), attachmentRef: ref(attachment), coldStart: report.coldStart});
}
