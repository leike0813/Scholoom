// Throwaway fixed trusted page. This script runs only in the independent browser.
import { studies } from '../report-context/sample.js';

const records = studies.slice(0, 3);
const filter = document.querySelector<HTMLInputElement>('#filter')!;
const order = document.querySelector<HTMLSelectElement>('#order')!;
const body = document.querySelector('tbody')!;
let revision = 0;
const expanded = new Set<string>();

function render() {
  revision++;
  const visible = records
    .filter((row) => `${row.name} ${row.method}`.includes(filter.value))
    .sort((a, b) => (order.value === 'ascending' ? a.year - b.year : b.year - a.year));
  body.replaceChildren();
  for (const row of visible) {
    const tr = body.insertRow();
    tr.dataset.id = row.objectId;
    for (const value of [row.name, String(row.year), row.method])
      tr.insertCell().textContent = value;
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `详情 ${row.name}`;
    const description = document.createElement('p');
    description.textContent = row.semantics;
    details.append(summary, description);
    if (expanded.has(row.objectId)) details.open = true;
    details.addEventListener('toggle', () => {
      if (details.open) expanded.add(row.objectId);
      else expanded.delete(row.objectId);
      revision++;
    });
    tr.insertCell().append(details);
    // Deliberate semantic counterexample to this text-only field projection.
    const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');
    const fraction = document.createElementNS(math.namespaceURI, 'mfrac');
    for (const digit of ['1', '2']) {
      const number = document.createElementNS(math.namespaceURI, 'mn');
      number.textContent = digit;
      fraction.append(number);
    }
    math.append(fraction);
    tr.insertCell().append(math);
  }
  document.querySelector('#count')!.textContent = `${visible.length} / ${records.length}`;
}
filter.addEventListener('input', render);
order.addEventListener('change', render);
render();

Reflect.set(window, 'surfaceSource', {
  read: () => ({
    version: 1,
    revision,
    filter: filter.value,
    order: order.value,
    count: document.querySelector('#count')!.textContent,
    rows: Array.from(body.rows, (row) => ({
      id: row.dataset.id!,
      name: row.cells[0]!.textContent!,
      year: row.cells[1]!.textContent!,
      method: row.cells[2]!.textContent!,
      summary: row.querySelector('summary')!.textContent!,
      expanded: row.querySelector('details')!.open,
      description: row.querySelector('details')!.open ? row.querySelector('p')!.textContent! : '',
      effect: row.cells[4]!.textContent!,
    })),
  }),
});
