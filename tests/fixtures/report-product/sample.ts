export function reportPage(version: 'R1' | 'R2'): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Comparison ${version}</title>
  <link rel="stylesheet" href="./report.css">
</head>
<body>
  <main>
    <h1>Comparison ${version}</h1>
    <label>Filter <input id="report-filter" type="text" aria-label="Report filter" maxlength="128"></label>
    <label>Order <select id="report-order" aria-label="Report order">
      <option value="ascending" selected>ascending</option>
      <option value="descending">descending</option>
    </select></label>
    <section id="report-papers" aria-label="Compared papers">
      <article id="paper-a" data-object="paper-a" data-score="10">
        <h2>Paper A</h2>
        <p>Score: 10</p>
        <button type="button" id="expand-paper-a" aria-expanded="false" aria-controls="details-paper-a">Expand Paper A</button>
        <p id="details-paper-a" hidden>Hidden details for Paper A.</p>
        <button type="button" id="choose-paper-a">Choose Paper A</button>
      </article>
      <article id="paper-b" data-object="paper-b" data-score="20">
        <h2>Paper B</h2>
        <p>Score: 20</p>
        <button type="button" id="expand-paper-b" aria-expanded="false" aria-controls="details-paper-b">Expand Paper B</button>
        <p id="details-paper-b" hidden>Hidden details for Paper B.</p>
        <button type="button" id="choose-paper-b">Choose Paper B</button>
      </article>
    </section>
    <label>Note <textarea id="report-note" aria-label="Report note" maxlength="512" rows="3"></textarea></label>
  </main>
  <script src="./report.js"></script>
</body>
</html>`;
}

export const reportScript: string = `(() => {
  const filter = document.getElementById('report-filter');
  const order = document.getElementById('report-order');
  const note = document.getElementById('report-note');
  const papers = document.getElementById('report-papers');
  const objects = ['paper-a', 'paper-b'].map((id) => ({
    id,
    article: document.getElementById(id),
    expand: document.getElementById('expand-' + id),
    details: document.getElementById('details-' + id),
    choose: document.getElementById('choose-' + id),
  }));
  let expanded = new Set();

  function render() {
    const query = filter.value.toLowerCase();
    const sorted = objects.slice().sort((a, b) => {
      const difference = Number(a.article.getAttribute('data-score')) - Number(b.article.getAttribute('data-score'));
      return order.value === 'descending' ? -difference : difference;
    });
    for (const [index, object] of sorted.entries()) {
      if (object.article.querySelector('h2').textContent.toLowerCase().includes(query)) {
        object.article.removeAttribute('hidden');
      } else {
        object.article.setAttribute('hidden', '');
      }
      object.expand.setAttribute('aria-expanded', String(expanded.has(object.id)));
      if (expanded.has(object.id)) object.details.removeAttribute('hidden');
      else object.details.setAttribute('hidden', '');
      if (papers.children[index] !== object.article)
        papers.insertBefore(object.article, papers.children[index] || null);
    }
  }

  function publish() {
    scholoomReport.postMessage({
      type: 'state',
      browse: { filter: filter.value, order: order.value, expanded: objects.filter((object) => expanded.has(object.id)).map((object) => object.id) },
      draft: { note: note.value },
      dirty: !!note.value,
    });
  }

  filter.addEventListener('input', () => {
    if (filter.value.length > 128) filter.value = filter.value.slice(0, 128);
    render();
    publish();
  });
  order.addEventListener('change', () => {
    render();
    publish();
  });
  note.addEventListener('input', () => {
    if (note.value.length > 512) note.value = note.value.slice(0, 512);
    publish();
  });
  for (const object of objects) {
    object.expand.addEventListener('click', () => {
      if (expanded.has(object.id)) expanded.delete(object.id);
      else expanded.add(object.id);
      render();
      publish();
    });
    object.choose.addEventListener('click', () => {
      scholoomReport.postMessage({ type: 'select', objectIds: [object.id], request: note.value || 'Inspect selected evidence' });
    });
  }
  scholoomReport.addEventListener('message', ({ data }) => {
    if (!data || data.type !== 'restore') return;
    const browse = data.browse;
    filter.value = typeof browse?.filter === 'string' ? browse.filter.slice(0, 128) : '';
    order.value = browse?.order === 'descending' ? 'descending' : 'ascending';
    expanded = new Set(Array.isArray(browse?.expanded) ? browse.expanded.slice(0, 2).filter((id) => objects.some((object) => object.id === id)) : []);
    note.value = typeof data.draft?.note === 'string' ? data.draft.note.slice(0, 512) : '';
    render();
  });
})();`;

export const reportCSS: string = `
body { font-family: system-ui, sans-serif; line-height: 1.5; margin: 1em; }
main { max-width: 48em; }
label { display: block; margin-block: 0.75em; }
article { border: 1px solid; padding: 0.75em; margin-block: 0.75em; }
button, input, select, textarea { font: inherit; }
button { margin-inline-end: 0.5em; }
textarea { display: block; width: 100%; box-sizing: border-box; }
[hidden] { display: none; }
`;
