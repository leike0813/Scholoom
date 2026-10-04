/* Privileged cold-start helper; does not initialize Zotero's main pane. */
dump("Scholoom cold helper script loaded\n");
const {Zotero} = ChromeUtils.importESModule("chrome://zotero/content/zotero.mjs");
const scope = {Zotero, Services, ChromeUtils, IOUtils, PathUtils,
  setTimeout: window.setTimeout.bind(window), clearTimeout: window.clearTimeout.bind(window), TextEncoder, DOMParser};
const companionRoot = "jar:" + Services.prefs.getStringPref("extensions.scholoomProbe.companionURI") + "!/";
Services.scriptloader.loadSubScript(companionRoot + "bootstrap.js", scope);
scope.startup({rootURI: companionRoot});
