// Generated from businessSchemas; regenerate with pnpm generate:contracts.
import type { FromSchema } from 'json-schema-to-ts';
import type { businessSchemas } from './operations.js';

export type Inputs = {
  'artifacts.reconcile': FromSchema<(typeof businessSchemas)['artifacts.reconcile']['params']>;
  'delegation.cancel': FromSchema<(typeof businessSchemas)['delegation.cancel']['params']>;
  'delegation.get': FromSchema<(typeof businessSchemas)['delegation.get']['params']>;
  'delegation.list': FromSchema<(typeof businessSchemas)['delegation.list']['params']>;
  'editor.cancel': FromSchema<(typeof businessSchemas)['editor.cancel']['params']>;
  'editor.convert': FromSchema<(typeof businessSchemas)['editor.convert']['params']>;
  'editor.export': FromSchema<(typeof businessSchemas)['editor.export']['params']>;
  'editor.job': FromSchema<(typeof businessSchemas)['editor.job']['params']>;
  'editor.output': FromSchema<(typeof businessSchemas)['editor.output']['params']>;
  'editor.render': FromSchema<(typeof businessSchemas)['editor.render']['params']>;
  'editor.tools': FromSchema<(typeof businessSchemas)['editor.tools']['params']>;
  'files.changes': FromSchema<(typeof businessSchemas)['files.changes']['params']>;
  'files.edit': FromSchema<(typeof businessSchemas)['files.edit']['params']>;
  'files.history': FromSchema<(typeof businessSchemas)['files.history']['params']>;
  'files.importBegin': FromSchema<(typeof businessSchemas)['files.importBegin']['params']>;
  'files.importChunk': FromSchema<(typeof businessSchemas)['files.importChunk']['params']>;
  'files.importFinish': FromSchema<(typeof businessSchemas)['files.importFinish']['params']>;
  'files.list': FromSchema<(typeof businessSchemas)['files.list']['params']>;
  'files.mkdir': FromSchema<(typeof businessSchemas)['files.mkdir']['params']>;
  'files.operation': FromSchema<(typeof businessSchemas)['files.operation']['params']>;
  'files.read': FromSchema<(typeof businessSchemas)['files.read']['params']>;
  'files.readBytes': FromSchema<(typeof businessSchemas)['files.readBytes']['params']>;
  'files.rename': FromSchema<(typeof businessSchemas)['files.rename']['params']>;
  'files.resolve': FromSchema<(typeof businessSchemas)['files.resolve']['params']>;
  'files.resource': FromSchema<(typeof businessSchemas)['files.resource']['params']>;
  'files.restore': FromSchema<(typeof businessSchemas)['files.restore']['params']>;
  'files.save': FromSchema<(typeof businessSchemas)['files.save']['params']>;
  'files.transfer': FromSchema<(typeof businessSchemas)['files.transfer']['params']>;
  'files.transferCancel': FromSchema<(typeof businessSchemas)['files.transferCancel']['params']>;
  'files.transferDecide': FromSchema<(typeof businessSchemas)['files.transferDecide']['params']>;
  'files.transferStatus': FromSchema<(typeof businessSchemas)['files.transferStatus']['params']>;
  'files.trash': FromSchema<(typeof businessSchemas)['files.trash']['params']>;
  'files.trashList': FromSchema<(typeof businessSchemas)['files.trashList']['params']>;
  'files.undo': FromSchema<(typeof businessSchemas)['files.undo']['params']>;
  'files.unwatch': FromSchema<(typeof businessSchemas)['files.unwatch']['params']>;
  'files.watch': FromSchema<(typeof businessSchemas)['files.watch']['params']>;
  'library.attachment': FromSchema<(typeof businessSchemas)['library.attachment']['params']>;
  'library.attachments': FromSchema<(typeof businessSchemas)['library.attachments']['params']>;
  'library.backup': FromSchema<(typeof businessSchemas)['library.backup']['params']>;
  'library.backups': FromSchema<(typeof businessSchemas)['library.backups']['params']>;
  'library.batch': FromSchema<(typeof businessSchemas)['library.batch']['params']>;
  'library.batches': FromSchema<(typeof businessSchemas)['library.batches']['params']>;
  'library.collections': FromSchema<(typeof businessSchemas)['library.collections']['params']>;
  'library.commitRecords': FromSchema<(typeof businessSchemas)['library.commitRecords']['params']>;
  'library.commitResult': FromSchema<(typeof businessSchemas)['library.commitResult']['params']>;
  'library.createSourceInstance': FromSchema<
    (typeof businessSchemas)['library.createSourceInstance']['params']
  >;
  'library.documentInfo': FromSchema<(typeof businessSchemas)['library.documentInfo']['params']>;
  'library.get': FromSchema<(typeof businessSchemas)['library.get']['params']>;
  'library.grant': FromSchema<(typeof businessSchemas)['library.grant']['params']>;
  'library.history': FromSchema<(typeof businessSchemas)['library.history']['params']>;
  'library.importFiles': FromSchema<(typeof businessSchemas)['library.importFiles']['params']>;
  'library.importProjectFiles': FromSchema<
    (typeof businessSchemas)['library.importProjectFiles']['params']
  >;
  'library.ingest': FromSchema<(typeof businessSchemas)['library.ingest']['params']>;
  'library.list': FromSchema<(typeof businessSchemas)['library.list']['params']>;
  'library.pdfInfo': FromSchema<(typeof businessSchemas)['library.pdfInfo']['params']>;
  'library.readAttachment': FromSchema<
    (typeof businessSchemas)['library.readAttachment']['params']
  >;
  'library.readDocumentResource': FromSchema<
    (typeof businessSchemas)['library.readDocumentResource']['params']
  >;
  'library.readDocumentSection': FromSchema<
    (typeof businessSchemas)['library.readDocumentSection']['params']
  >;
  'library.readPdfPage': FromSchema<(typeof businessSchemas)['library.readPdfPage']['params']>;
  'library.readingHistory': FromSchema<
    (typeof businessSchemas)['library.readingHistory']['params']
  >;
  'library.readingRecord': FromSchema<(typeof businessSchemas)['library.readingRecord']['params']>;
  'library.readingRecords': FromSchema<
    (typeof businessSchemas)['library.readingRecords']['params']
  >;
  'library.record': FromSchema<(typeof businessSchemas)['library.record']['params']>;
  'library.recordHistory': FromSchema<(typeof businessSchemas)['library.recordHistory']['params']>;
  'library.relocateAttachment': FromSchema<
    (typeof businessSchemas)['library.relocateAttachment']['params']
  >;
  'library.removeReadingRecord': FromSchema<
    (typeof businessSchemas)['library.removeReadingRecord']['params']
  >;
  'library.restore': FromSchema<(typeof businessSchemas)['library.restore']['params']>;
  'library.resume': FromSchema<(typeof businessSchemas)['library.resume']['params']>;
  'library.saveCollection': FromSchema<
    (typeof businessSchemas)['library.saveCollection']['params']
  >;
  'library.saveReadingRecord': FromSchema<
    (typeof businessSchemas)['library.saveReadingRecord']['params']
  >;
  'library.searchDocument': FromSchema<
    (typeof businessSchemas)['library.searchDocument']['params']
  >;
  'library.status': FromSchema<(typeof businessSchemas)['library.status']['params']>;
  'library.update': FromSchema<(typeof businessSchemas)['library.update']['params']>;
  'programs.authorizeEnvironment': FromSchema<
    (typeof businessSchemas)['programs.authorizeEnvironment']['params']
  >;
  'programs.cancel': FromSchema<(typeof businessSchemas)['programs.cancel']['params']>;
  'programs.environmentPlan': FromSchema<
    (typeof businessSchemas)['programs.environmentPlan']['params']
  >;
  'programs.environmentPlanStatus': FromSchema<
    (typeof businessSchemas)['programs.environmentPlanStatus']['params']
  >;
  'programs.environmentPrepare': FromSchema<
    (typeof businessSchemas)['programs.environmentPrepare']['params']
  >;
  'programs.environments': FromSchema<(typeof businessSchemas)['programs.environments']['params']>;
  'programs.handoff': FromSchema<(typeof businessSchemas)['programs.handoff']['params']>;
  'programs.logs': FromSchema<(typeof businessSchemas)['programs.logs']['params']>;
  'programs.reconcile': FromSchema<(typeof businessSchemas)['programs.reconcile']['params']>;
  'programs.registerEnvironment': FromSchema<
    (typeof businessSchemas)['programs.registerEnvironment']['params']
  >;
  'programs.run': FromSchema<(typeof businessSchemas)['programs.run']['params']>;
  'programs.runs': FromSchema<(typeof businessSchemas)['programs.runs']['params']>;
  'programs.start': FromSchema<(typeof businessSchemas)['programs.start']['params']>;
  'project.backup': FromSchema<(typeof businessSchemas)['project.backup']['params']>;
  'project.backups': FromSchema<(typeof businessSchemas)['project.backups']['params']>;
  'project.browseDirectories': FromSchema<
    (typeof businessSchemas)['project.browseDirectories']['params']
  >;
  'project.create': FromSchema<(typeof businessSchemas)['project.create']['params']>;
  'project.forget': FromSchema<(typeof businessSchemas)['project.forget']['params']>;
  'project.grant': FromSchema<(typeof businessSchemas)['project.grant']['params']>;
  'project.open': FromSchema<(typeof businessSchemas)['project.open']['params']>;
  'project.restore': FromSchema<(typeof businessSchemas)['project.restore']['params']>;
  'provider.configure': FromSchema<(typeof businessSchemas)['provider.configure']['params']>;
  'provider.profiles': FromSchema<(typeof businessSchemas)['provider.profiles']['params']>;
  'provider.removeProfile': FromSchema<
    (typeof businessSchemas)['provider.removeProfile']['params']
  >;
  'provider.saveProfile': FromSchema<(typeof businessSchemas)['provider.saveProfile']['params']>;
  'provider.setDefaults': FromSchema<(typeof businessSchemas)['provider.setDefaults']['params']>;
  'research.attempts': FromSchema<(typeof businessSchemas)['research.attempts']['params']>;
  'research.graph': FromSchema<(typeof businessSchemas)['research.graph']['params']>;
  'research.graphCalls': FromSchema<(typeof businessSchemas)['research.graphCalls']['params']>;
  'research.graphs': FromSchema<(typeof businessSchemas)['research.graphs']['params']>;
  'research.method': FromSchema<(typeof businessSchemas)['research.method']['params']>;
  'research.methods': FromSchema<(typeof businessSchemas)['research.methods']['params']>;
  'research.requestGraph': FromSchema<(typeof businessSchemas)['research.requestGraph']['params']>;
  'resources.cancel': FromSchema<(typeof businessSchemas)['resources.cancel']['params']>;
  'resources.create': FromSchema<(typeof businessSchemas)['resources.create']['params']>;
  'resources.creation': FromSchema<(typeof businessSchemas)['resources.creation']['params']>;
  'resources.describe': FromSchema<(typeof businessSchemas)['resources.describe']['params']>;
  'resources.document': FromSchema<(typeof businessSchemas)['resources.document']['params']>;
  'resources.read': FromSchema<(typeof businessSchemas)['resources.read']['params']>;
  'resources.report': FromSchema<(typeof businessSchemas)['resources.report']['params']>;
  'resources.save': FromSchema<(typeof businessSchemas)['resources.save']['params']>;
  'session.archive': FromSchema<(typeof businessSchemas)['session.archive']['params']>;
  'session.cancel': FromSchema<(typeof businessSchemas)['session.cancel']['params']>;
  'session.configure': FromSchema<(typeof businessSchemas)['session.configure']['params']>;
  'session.create': FromSchema<(typeof businessSchemas)['session.create']['params']>;
  'session.list': FromSchema<(typeof businessSchemas)['session.list']['params']>;
  'session.rename': FromSchema<(typeof businessSchemas)['session.rename']['params']>;
  'session.search': FromSchema<(typeof businessSchemas)['session.search']['params']>;
  'session.send': FromSchema<(typeof businessSchemas)['session.send']['params']>;
  'tasks.create': FromSchema<(typeof businessSchemas)['tasks.create']['params']>;
  'tasks.graphs': FromSchema<(typeof businessSchemas)['tasks.graphs']['params']>;
  'tasks.list': FromSchema<(typeof businessSchemas)['tasks.list']['params']>;
  'tasks.read': FromSchema<(typeof businessSchemas)['tasks.read']['params']>;
  'tasks.runGraph': FromSchema<(typeof businessSchemas)['tasks.runGraph']['params']>;
  'tasks.save': FromSchema<(typeof businessSchemas)['tasks.save']['params']>;
  'workbench.context.publish': FromSchema<
    (typeof businessSchemas)['workbench.context.publish']['params']
  >;
  'workbench.snapshot': FromSchema<(typeof businessSchemas)['workbench.snapshot']['params']>;
  'workbench.watch': FromSchema<(typeof businessSchemas)['workbench.watch']['params']>;
  'zotero.export': FromSchema<(typeof businessSchemas)['zotero.export']['params']>;
  'zotero.fillKeys': FromSchema<(typeof businessSchemas)['zotero.fillKeys']['params']>;
  'zotero.result': FromSchema<(typeof businessSchemas)['zotero.result']['params']>;
};
export type Outputs = {
  'artifacts.reconcile': FromSchema<(typeof businessSchemas)['artifacts.reconcile']['result']>;
  'delegation.cancel': FromSchema<(typeof businessSchemas)['delegation.cancel']['result']>;
  'delegation.get': FromSchema<(typeof businessSchemas)['delegation.get']['result']>;
  'delegation.list': FromSchema<(typeof businessSchemas)['delegation.list']['result']>;
  'editor.cancel': FromSchema<(typeof businessSchemas)['editor.cancel']['result']>;
  'editor.convert': FromSchema<(typeof businessSchemas)['editor.convert']['result']>;
  'editor.export': FromSchema<(typeof businessSchemas)['editor.export']['result']>;
  'editor.job': FromSchema<(typeof businessSchemas)['editor.job']['result']>;
  'editor.output': FromSchema<(typeof businessSchemas)['editor.output']['result']>;
  'editor.render': FromSchema<(typeof businessSchemas)['editor.render']['result']>;
  'editor.tools': FromSchema<(typeof businessSchemas)['editor.tools']['result']>;
  'files.changes': FromSchema<(typeof businessSchemas)['files.changes']['result']>;
  'files.edit': FromSchema<(typeof businessSchemas)['files.edit']['result']>;
  'files.history': FromSchema<(typeof businessSchemas)['files.history']['result']>;
  'files.importBegin': FromSchema<(typeof businessSchemas)['files.importBegin']['result']>;
  'files.importChunk': FromSchema<(typeof businessSchemas)['files.importChunk']['result']>;
  'files.importFinish': FromSchema<(typeof businessSchemas)['files.importFinish']['result']>;
  'files.list': FromSchema<(typeof businessSchemas)['files.list']['result']>;
  'files.mkdir': FromSchema<(typeof businessSchemas)['files.mkdir']['result']>;
  'files.operation': FromSchema<(typeof businessSchemas)['files.operation']['result']>;
  'files.read': FromSchema<(typeof businessSchemas)['files.read']['result']>;
  'files.readBytes': FromSchema<(typeof businessSchemas)['files.readBytes']['result']>;
  'files.rename': FromSchema<(typeof businessSchemas)['files.rename']['result']>;
  'files.resolve': FromSchema<(typeof businessSchemas)['files.resolve']['result']>;
  'files.resource': FromSchema<(typeof businessSchemas)['files.resource']['result']>;
  'files.restore': FromSchema<(typeof businessSchemas)['files.restore']['result']>;
  'files.save': FromSchema<(typeof businessSchemas)['files.save']['result']>;
  'files.transfer': FromSchema<(typeof businessSchemas)['files.transfer']['result']>;
  'files.transferCancel': FromSchema<(typeof businessSchemas)['files.transferCancel']['result']>;
  'files.transferDecide': FromSchema<(typeof businessSchemas)['files.transferDecide']['result']>;
  'files.transferStatus': FromSchema<(typeof businessSchemas)['files.transferStatus']['result']>;
  'files.trash': FromSchema<(typeof businessSchemas)['files.trash']['result']>;
  'files.trashList': FromSchema<(typeof businessSchemas)['files.trashList']['result']>;
  'files.undo': FromSchema<(typeof businessSchemas)['files.undo']['result']>;
  'files.unwatch': FromSchema<(typeof businessSchemas)['files.unwatch']['result']>;
  'files.watch': FromSchema<(typeof businessSchemas)['files.watch']['result']>;
  'library.attachment': FromSchema<(typeof businessSchemas)['library.attachment']['result']>;
  'library.attachments': FromSchema<(typeof businessSchemas)['library.attachments']['result']>;
  'library.backup': FromSchema<(typeof businessSchemas)['library.backup']['result']>;
  'library.backups': FromSchema<(typeof businessSchemas)['library.backups']['result']>;
  'library.batch': FromSchema<(typeof businessSchemas)['library.batch']['result']>;
  'library.batches': FromSchema<(typeof businessSchemas)['library.batches']['result']>;
  'library.collections': FromSchema<(typeof businessSchemas)['library.collections']['result']>;
  'library.commitRecords': FromSchema<(typeof businessSchemas)['library.commitRecords']['result']>;
  'library.commitResult': FromSchema<(typeof businessSchemas)['library.commitResult']['result']>;
  'library.createSourceInstance': FromSchema<
    (typeof businessSchemas)['library.createSourceInstance']['result']
  >;
  'library.documentInfo': FromSchema<(typeof businessSchemas)['library.documentInfo']['result']>;
  'library.get': FromSchema<(typeof businessSchemas)['library.get']['result']>;
  'library.grant': FromSchema<(typeof businessSchemas)['library.grant']['result']>;
  'library.history': FromSchema<(typeof businessSchemas)['library.history']['result']>;
  'library.importFiles': FromSchema<(typeof businessSchemas)['library.importFiles']['result']>;
  'library.importProjectFiles': FromSchema<
    (typeof businessSchemas)['library.importProjectFiles']['result']
  >;
  'library.ingest': FromSchema<(typeof businessSchemas)['library.ingest']['result']>;
  'library.list': FromSchema<(typeof businessSchemas)['library.list']['result']>;
  'library.pdfInfo': FromSchema<(typeof businessSchemas)['library.pdfInfo']['result']>;
  'library.readAttachment': FromSchema<
    (typeof businessSchemas)['library.readAttachment']['result']
  >;
  'library.readDocumentResource': FromSchema<
    (typeof businessSchemas)['library.readDocumentResource']['result']
  >;
  'library.readDocumentSection': FromSchema<
    (typeof businessSchemas)['library.readDocumentSection']['result']
  >;
  'library.readPdfPage': FromSchema<(typeof businessSchemas)['library.readPdfPage']['result']>;
  'library.readingHistory': FromSchema<
    (typeof businessSchemas)['library.readingHistory']['result']
  >;
  'library.readingRecord': FromSchema<(typeof businessSchemas)['library.readingRecord']['result']>;
  'library.readingRecords': FromSchema<
    (typeof businessSchemas)['library.readingRecords']['result']
  >;
  'library.record': FromSchema<(typeof businessSchemas)['library.record']['result']>;
  'library.recordHistory': FromSchema<(typeof businessSchemas)['library.recordHistory']['result']>;
  'library.relocateAttachment': FromSchema<
    (typeof businessSchemas)['library.relocateAttachment']['result']
  >;
  'library.removeReadingRecord': FromSchema<
    (typeof businessSchemas)['library.removeReadingRecord']['result']
  >;
  'library.restore': FromSchema<(typeof businessSchemas)['library.restore']['result']>;
  'library.resume': FromSchema<(typeof businessSchemas)['library.resume']['result']>;
  'library.saveCollection': FromSchema<
    (typeof businessSchemas)['library.saveCollection']['result']
  >;
  'library.saveReadingRecord': FromSchema<
    (typeof businessSchemas)['library.saveReadingRecord']['result']
  >;
  'library.searchDocument': FromSchema<
    (typeof businessSchemas)['library.searchDocument']['result']
  >;
  'library.status': FromSchema<(typeof businessSchemas)['library.status']['result']>;
  'library.update': FromSchema<(typeof businessSchemas)['library.update']['result']>;
  'programs.authorizeEnvironment': FromSchema<
    (typeof businessSchemas)['programs.authorizeEnvironment']['result']
  >;
  'programs.cancel': FromSchema<(typeof businessSchemas)['programs.cancel']['result']>;
  'programs.environmentPlan': FromSchema<
    (typeof businessSchemas)['programs.environmentPlan']['result']
  >;
  'programs.environmentPlanStatus': FromSchema<
    (typeof businessSchemas)['programs.environmentPlanStatus']['result']
  >;
  'programs.environmentPrepare': FromSchema<
    (typeof businessSchemas)['programs.environmentPrepare']['result']
  >;
  'programs.environments': FromSchema<(typeof businessSchemas)['programs.environments']['result']>;
  'programs.handoff': FromSchema<(typeof businessSchemas)['programs.handoff']['result']>;
  'programs.logs': FromSchema<(typeof businessSchemas)['programs.logs']['result']>;
  'programs.reconcile': FromSchema<(typeof businessSchemas)['programs.reconcile']['result']>;
  'programs.registerEnvironment': FromSchema<
    (typeof businessSchemas)['programs.registerEnvironment']['result']
  >;
  'programs.run': FromSchema<(typeof businessSchemas)['programs.run']['result']>;
  'programs.runs': FromSchema<(typeof businessSchemas)['programs.runs']['result']>;
  'programs.start': FromSchema<(typeof businessSchemas)['programs.start']['result']>;
  'project.backup': FromSchema<(typeof businessSchemas)['project.backup']['result']>;
  'project.backups': FromSchema<(typeof businessSchemas)['project.backups']['result']>;
  'project.browseDirectories': FromSchema<
    (typeof businessSchemas)['project.browseDirectories']['result']
  >;
  'project.create': FromSchema<(typeof businessSchemas)['project.create']['result']>;
  'project.forget': FromSchema<(typeof businessSchemas)['project.forget']['result']>;
  'project.grant': FromSchema<(typeof businessSchemas)['project.grant']['result']>;
  'project.open': FromSchema<(typeof businessSchemas)['project.open']['result']>;
  'project.restore': FromSchema<(typeof businessSchemas)['project.restore']['result']>;
  'provider.configure': FromSchema<(typeof businessSchemas)['provider.configure']['result']>;
  'provider.profiles': FromSchema<(typeof businessSchemas)['provider.profiles']['result']>;
  'provider.removeProfile': FromSchema<
    (typeof businessSchemas)['provider.removeProfile']['result']
  >;
  'provider.saveProfile': FromSchema<(typeof businessSchemas)['provider.saveProfile']['result']>;
  'provider.setDefaults': FromSchema<(typeof businessSchemas)['provider.setDefaults']['result']>;
  'research.attempts': FromSchema<(typeof businessSchemas)['research.attempts']['result']>;
  'research.graph': FromSchema<(typeof businessSchemas)['research.graph']['result']>;
  'research.graphCalls': FromSchema<(typeof businessSchemas)['research.graphCalls']['result']>;
  'research.graphs': FromSchema<(typeof businessSchemas)['research.graphs']['result']>;
  'research.method': FromSchema<(typeof businessSchemas)['research.method']['result']>;
  'research.methods': FromSchema<(typeof businessSchemas)['research.methods']['result']>;
  'research.requestGraph': FromSchema<(typeof businessSchemas)['research.requestGraph']['result']>;
  'resources.cancel': FromSchema<(typeof businessSchemas)['resources.cancel']['result']>;
  'resources.create': FromSchema<(typeof businessSchemas)['resources.create']['result']>;
  'resources.creation': FromSchema<(typeof businessSchemas)['resources.creation']['result']>;
  'resources.describe': FromSchema<(typeof businessSchemas)['resources.describe']['result']>;
  'resources.document': FromSchema<(typeof businessSchemas)['resources.document']['result']>;
  'resources.read': FromSchema<(typeof businessSchemas)['resources.read']['result']>;
  'resources.report': FromSchema<(typeof businessSchemas)['resources.report']['result']>;
  'resources.save': FromSchema<(typeof businessSchemas)['resources.save']['result']>;
  'session.archive': FromSchema<(typeof businessSchemas)['session.archive']['result']>;
  'session.cancel': FromSchema<(typeof businessSchemas)['session.cancel']['result']>;
  'session.configure': FromSchema<(typeof businessSchemas)['session.configure']['result']>;
  'session.create': FromSchema<(typeof businessSchemas)['session.create']['result']>;
  'session.list': FromSchema<(typeof businessSchemas)['session.list']['result']>;
  'session.rename': FromSchema<(typeof businessSchemas)['session.rename']['result']>;
  'session.search': FromSchema<(typeof businessSchemas)['session.search']['result']>;
  'session.send': FromSchema<(typeof businessSchemas)['session.send']['result']>;
  'tasks.create': FromSchema<(typeof businessSchemas)['tasks.create']['result']>;
  'tasks.graphs': FromSchema<(typeof businessSchemas)['tasks.graphs']['result']>;
  'tasks.list': FromSchema<(typeof businessSchemas)['tasks.list']['result']>;
  'tasks.read': FromSchema<(typeof businessSchemas)['tasks.read']['result']>;
  'tasks.runGraph': FromSchema<(typeof businessSchemas)['tasks.runGraph']['result']>;
  'tasks.save': FromSchema<(typeof businessSchemas)['tasks.save']['result']>;
  'workbench.context.publish': FromSchema<
    (typeof businessSchemas)['workbench.context.publish']['result']
  >;
  'workbench.snapshot': FromSchema<(typeof businessSchemas)['workbench.snapshot']['result']>;
  'workbench.watch': FromSchema<(typeof businessSchemas)['workbench.watch']['result']>;
  'zotero.export': FromSchema<(typeof businessSchemas)['zotero.export']['result']>;
  'zotero.fillKeys': FromSchema<(typeof businessSchemas)['zotero.fillKeys']['result']>;
  'zotero.result': FromSchema<(typeof businessSchemas)['zotero.result']['result']>;
};
