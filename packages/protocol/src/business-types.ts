// Generated from businessSchemas; regenerate with pnpm generate:contracts.
import type { FromSchema } from 'json-schema-to-ts';
import type { businessSchemas } from './operations.js';

export type Inputs = {
  'artifacts.reconcile': FromSchema<(typeof businessSchemas)['artifacts.reconcile']['params']>;
  'editor.cancel': FromSchema<(typeof businessSchemas)['editor.cancel']['params']>;
  'editor.convert': FromSchema<(typeof businessSchemas)['editor.convert']['params']>;
  'editor.export': FromSchema<(typeof businessSchemas)['editor.export']['params']>;
  'editor.job': FromSchema<(typeof businessSchemas)['editor.job']['params']>;
  'editor.output': FromSchema<(typeof businessSchemas)['editor.output']['params']>;
  'editor.render': FromSchema<(typeof businessSchemas)['editor.render']['params']>;
  'editor.tools': FromSchema<(typeof businessSchemas)['editor.tools']['params']>;
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
  'provider.setDefaults': FromSchema<(typeof businessSchemas)['provider.setDefaults']['params']>;
  'research.attempts': FromSchema<(typeof businessSchemas)['research.attempts']['params']>;
  'research.method': FromSchema<(typeof businessSchemas)['research.method']['params']>;
  'research.methods': FromSchema<(typeof businessSchemas)['research.methods']['params']>;
  'resources.cancel': FromSchema<(typeof businessSchemas)['resources.cancel']['params']>;
  'resources.describe': FromSchema<(typeof businessSchemas)['resources.describe']['params']>;
  'resources.document': FromSchema<(typeof businessSchemas)['resources.document']['params']>;
  'resources.read': FromSchema<(typeof businessSchemas)['resources.read']['params']>;
  'resources.save': FromSchema<(typeof businessSchemas)['resources.save']['params']>;
  'session.archive': FromSchema<(typeof businessSchemas)['session.archive']['params']>;
  'session.cancel': FromSchema<(typeof businessSchemas)['session.cancel']['params']>;
  'session.configure': FromSchema<(typeof businessSchemas)['session.configure']['params']>;
  'session.create': FromSchema<(typeof businessSchemas)['session.create']['params']>;
  'session.list': FromSchema<(typeof businessSchemas)['session.list']['params']>;
  'session.rename': FromSchema<(typeof businessSchemas)['session.rename']['params']>;
  'session.search': FromSchema<(typeof businessSchemas)['session.search']['params']>;
  'session.send': FromSchema<(typeof businessSchemas)['session.send']['params']>;
  'workbench.snapshot': FromSchema<(typeof businessSchemas)['workbench.snapshot']['params']>;
  'workbench.watch': FromSchema<(typeof businessSchemas)['workbench.watch']['params']>;
};
export type Outputs = {
  'artifacts.reconcile': FromSchema<(typeof businessSchemas)['artifacts.reconcile']['result']>;
  'editor.cancel': FromSchema<(typeof businessSchemas)['editor.cancel']['result']>;
  'editor.convert': FromSchema<(typeof businessSchemas)['editor.convert']['result']>;
  'editor.export': FromSchema<(typeof businessSchemas)['editor.export']['result']>;
  'editor.job': FromSchema<(typeof businessSchemas)['editor.job']['result']>;
  'editor.output': FromSchema<(typeof businessSchemas)['editor.output']['result']>;
  'editor.render': FromSchema<(typeof businessSchemas)['editor.render']['result']>;
  'editor.tools': FromSchema<(typeof businessSchemas)['editor.tools']['result']>;
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
  'provider.setDefaults': FromSchema<(typeof businessSchemas)['provider.setDefaults']['result']>;
  'research.attempts': FromSchema<(typeof businessSchemas)['research.attempts']['result']>;
  'research.method': FromSchema<(typeof businessSchemas)['research.method']['result']>;
  'research.methods': FromSchema<(typeof businessSchemas)['research.methods']['result']>;
  'resources.cancel': FromSchema<(typeof businessSchemas)['resources.cancel']['result']>;
  'resources.describe': FromSchema<(typeof businessSchemas)['resources.describe']['result']>;
  'resources.document': FromSchema<(typeof businessSchemas)['resources.document']['result']>;
  'resources.read': FromSchema<(typeof businessSchemas)['resources.read']['result']>;
  'resources.save': FromSchema<(typeof businessSchemas)['resources.save']['result']>;
  'session.archive': FromSchema<(typeof businessSchemas)['session.archive']['result']>;
  'session.cancel': FromSchema<(typeof businessSchemas)['session.cancel']['result']>;
  'session.configure': FromSchema<(typeof businessSchemas)['session.configure']['result']>;
  'session.create': FromSchema<(typeof businessSchemas)['session.create']['result']>;
  'session.list': FromSchema<(typeof businessSchemas)['session.list']['result']>;
  'session.rename': FromSchema<(typeof businessSchemas)['session.rename']['result']>;
  'session.search': FromSchema<(typeof businessSchemas)['session.search']['result']>;
  'session.send': FromSchema<(typeof businessSchemas)['session.send']['result']>;
  'workbench.snapshot': FromSchema<(typeof businessSchemas)['workbench.snapshot']['result']>;
  'workbench.watch': FromSchema<(typeof businessSchemas)['workbench.watch']['result']>;
};
