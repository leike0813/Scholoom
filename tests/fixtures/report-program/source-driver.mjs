import { Console } from 'node:console';
import { StringDecoder } from 'node:string_decoder';
import { createReportProgram } from '../../../packages/editor/report/program.mjs';
import { isReportProgramPacket } from '../../../packages/protocol/src/report-contracts.js';

// Benign mechanical oracle in an ordinary child. Frozen file/domain authority is an explicit fixture.
const output = process.stdout.write.bind(process.stdout);
globalThis.console = new Console({ stdout: process.stderr, stderr: process.stderr });
const entryURL = 'scholoom-report://local/reports/example.html';
const assets = new Map([
  ['scholoom-report://local/assets/labels.js', 'export const label = "Loaded native ESM";'],
  [
    'scholoom-report://local/assets/report.js',
    `import {label} from './labels.js'; document.getElementById('module').textContent=label;`,
  ],
]);
const files = {
  entryURL,
  html: `<html><head><title>Generic report</title><style id="source-style">#classic{padding-left:3px}</style><script type="module" src="../assets/report.js"></script></head><body><p id="classic"></p><p id="module"></p><p id="inline-module"></p><input id="query" aria-label="Report query" type="text"><p id="result"></p><textarea id="note" aria-label="Report note">Initial note</textarea><p id="note-result"></p><button id="choose">Choose object</button><math><mfrac><mi>x</mi><mn>2</mn></mfrac></math><section id="objects">${Array.from({ length: 100 }, (_, index) => `<article data-object="${index}"><h2>Object ${index}</h2><p>Evidence ${index}</p><table><tbody><tr><td>${index}</td></tr></tbody></table></article>`).join('')}</section><script>let reservedRejected=false; try{scholoomReport.postMessage({type:'state',browse:{},draft:{},dirty:false,basis:'another-version'});}catch(error){reservedRejected=error.code==='invalidRequest';} if(!reservedRejected)throw Error('reserved bridge binding accepted'); document.getElementById('classic').style.backgroundColor='rgb(12,34,56)'; var classicValue = 'Classic global'; if(window!==globalThis||document.defaultView!==window)throw Error('global identity'); document.getElementById('classic').textContent=window.classicValue; const input=document.getElementById('query'); input.addEventListener('input',()=>{document.getElementById('result').textContent=input.value;}); const note=document.getElementById('note'); note.addEventListener('input',()=>{document.getElementById('note-result').textContent=note.value;}); scholoomReport.addEventListener('message',({data})=>{if(data.type==='restore')note.value=data.draft.note;}); document.getElementById('choose').addEventListener('click',()=>scholoomReport.postMessage({type:'select',objectIds:['object-1'],request:'Compare evidence'}));</script><script type="module">import {label} from '../assets/labels.js'; document.getElementById('inline-module').textContent=label+' inline';</script></body></html>`,
  resolve(specifier, parent = entryURL) {
    const url = new URL(specifier, parent).href;
    if (!assets.has(url)) throw new Error('fixture dependency not approved');
    return url;
  },
  text(url) {
    if (!assets.has(url)) throw new Error('fixture dependency not approved');
    return assets.get(url);
  },
};
const program = createReportProgram(files, {
  send(packet) {
    if (!isReportProgramPacket(packet)) throw new Error('invalid program packet');
    return new Promise((resolve, reject) =>
      output(`${JSON.stringify(packet)}\n`, (error) => (error ? reject(error) : resolve())),
    );
  },
  failed(error) {
    console.error(error);
    process.exitCode = 1;
    process.stdin.destroy();
  },
});
let pending = '';
const decoder = new StringDecoder('utf8');
process.stdin.on('data', (chunk) => {
  pending += decoder.write(chunk);
  if (Buffer.byteLength(pending) > 65536) throw new Error('fixture request capacity');
  for (let stop = pending.indexOf('\n'); stop >= 0; stop = pending.indexOf('\n')) {
    const command = JSON.parse(pending.slice(0, stop));
    pending = pending.slice(stop + 1);
    void program.receive(command);
  }
});
process.stdin.on('end', () => {
  program.close();
  process.exit(0);
});
