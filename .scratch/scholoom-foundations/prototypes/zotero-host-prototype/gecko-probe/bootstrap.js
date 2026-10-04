/* Throwaway companion plugin. Calls unchanged release XPIs in a scratch library. */
function install() {}
function uninstall() {}
function shutdown() {}
function onMainWindowLoad() {}
function onMainWindowUnload() {}

async function startup({ rootURI }) {
  const round = Services.prefs.getStringPref("extensions.scholoomProbe.round", "baseline");
  if (round === "cold") {
    if (Zotero.ScholoomColdProbeStarted) return;
    Zotero.ScholoomColdProbeStarted = true;
  }
  const outputDir = Services.prefs.getStringPref("extensions.scholoomProbe.outputDir");
  const report = {host: Zotero.version, startedAt: new Date().toISOString(), checks: []};
  const reportPath = PathUtils.join(outputDir, "gecko-results.json");
  const save = () => IOUtils.writeJSON(reportPath, report);
  async function record(name, action) {
    const started = Date.now();
    try {
      const detail = await action();
      report.checks.push({name, status: "passed", durationMs: Date.now() - started, detail});
      await save();
      return detail;
    } catch (error) {
      report.checks.push({name, status: "failed", durationMs: Date.now() - started,
        error: String(error), stack: error.stack, detail: error.detail});
      await save();
      return null;
    }
  }
  // Run asynchronously: plugin loading must be able to complete before uiReady resolves.
  void (async () => {
    try {
      await Zotero.initializationPromise;
      if (round !== "cold") await Zotero.uiReadyPromise;
      await save();
      await record("release-xpi-loading", async () => {
        const {AddonManager} = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
        const result = [];
        for (const id of ["better-bibtex@iris-advies.com", "jasminum@linxzh.com"]) {
          const addon = await AddonManager.getAddonByID(id);
          if (!addon?.isActive) throw new Error(`Inactive release XPI: ${id}`);
          result.push({id, version: addon.version, active: addon.isActive,
            rootURI: addon.getResourceURI().spec});
        }
        return {addons: result, dataDirectory: Zotero.DataDirectory.dir};
      });
      const scope = {Zotero, Services, ChromeUtils, IOUtils, PathUtils,
        setTimeout, clearTimeout, TextEncoder, DOMParser, record};
      if (round === "cold") {
        Services.scriptloader.loadSubScript(rootURI + "cold.js", scope);
        const fixtures = await scope.probeCold({outputDir, record, report});
        Services.scriptloader.loadSubScript(rootURI + "ipc.js", scope);
        await scope.startIPC({outputDir, report, save, fixtures});
        return;
      }
      if (round === "restart" && await IOUtils.exists(PathUtils.join(outputDir, "identity-bindings.json"))) {
        const bindings = await IOUtils.readJSON(PathUtils.join(outputDir, "identity-bindings.json"));
        const restored = await record("restore-existing-source-and-material", async () => {
          const item = await Zotero.Items.getByLibraryAndKeyAsync(bindings.source.providerRef.libraryID, bindings.source.providerRef.key);
          const attachment = await Zotero.Items.getByLibraryAndKeyAsync(bindings.material.providerRef.libraryID, bindings.material.providerRef.key);
          if (!item || !attachment || attachment.parentID !== item.id) throw new Error("Persisted source/material relationship missing");
          for (let i = 0; i < 100 && !Zotero.BetterBibTeX; i++) await Zotero.Promise.delay(200);
          if (!Zotero.BetterBibTeX) throw new Error("Restored BBT unavailable");
          await Promise.race([Zotero.BetterBibTeX.ready, Zotero.Promise.delay(30000).then(() => {throw new Error("Restored BBT readiness timed out");})]);
          return {itemID: item.id, attachmentID: attachment.id,
            sourceId: bindings.source.id, materialId: bindings.material.id, fixtureSetupRepeated: false};
        });
        if (!restored) throw new Error("Cannot restore experiment fixtures");
        Services.scriptloader.loadSubScript(rootURI + "ipc.js", scope);
        await scope.startIPC({outputDir, report, save, fixtures: {
          item: await Zotero.Items.getAsync(restored.itemID), attachment: await Zotero.Items.getAsync(restored.attachmentID)}});
        return;
      }
      Services.scriptloader.loadSubScript(rootURI + "bbt.js", scope);
      await scope.probeBBT({outputDir, record});
      Services.scriptloader.loadSubScript(rootURI + "jasminum.js", scope);
      await scope.probeJasminum({outputDir, pdfPath: PathUtils.join(outputDir, "fixture.pdf"), record});
      if (["ipc", "boundary", "reader", "restart"].includes(round)) {
        Services.scriptloader.loadSubScript(rootURI + "ipc.js", scope);
        await scope.startIPC({outputDir, report, save});
        return;
      }
      await record("plugin-disable-lifecycle", async () => {
        const {AddonManager} = ChromeUtils.importESModule("resource://gre/modules/AddonManager.sys.mjs");
        for (const id of ["jasminum@linxzh.com", "better-bibtex@iris-advies.com"]) {
          const addon = await AddonManager.getAddonByID(id);
          await addon.disable();
        }
        for (let i = 0; i < 100 && (Zotero.BetterBibTeX || Zotero.Jasminum); i++) await Zotero.Promise.delay(100);
        if (Zotero.BetterBibTeX || Zotero.Jasminum) throw new Error("Plugin global survived disable");
        return {bbtRemoved: !Zotero.BetterBibTeX, jasminumRemoved: !Zotero.Jasminum};
      });
    } catch (error) {
      report.fatal = {error: String(error), stack: error.stack};
    } finally {
      if (!report.ipcListening) {
        report.finishedAt = new Date().toISOString();
        await save();
        Services.startup.quit(Services.startup.eAttemptQuit);
      }
    }
  })();
}
