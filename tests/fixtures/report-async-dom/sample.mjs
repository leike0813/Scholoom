// Fixed benign report. The native oracle and Node source execute the same script.
export function mountSample(
  window,
  { reverse = false, cancel = false, cancelClick = false } = {},
  bridge = () => {},
) {
  const d = window.document;
  const root = d.createElement('section');
  const article = d.createElement('article');
  const input = d.createElement('input');
  input.id = 'ordinary-input';
  input.setAttribute('aria-label', 'Ordinary input');
  input.setAttribute('type', 'text');
  const result = d.createElement('p');
  result.id = 'result';
  const filter = d.createElement('button');
  filter.textContent = 'Filter';
  const expand = d.createElement('button');
  expand.textContent = 'Expand';
  const detail = d.createElement('p');
  detail.id = 'detail';
  detail.setAttribute('hidden', '');
  detail.textContent = 'Expanded content';
  const math = d.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');
  const fraction = d.createElementNS(math.namespaceURI, 'mfrac');
  for (const [tag, text] of [
    ['mi', 'n'],
    ['mn', '2'],
  ]) {
    const node = d.createElementNS(math.namespaceURI, tag);
    node.textContent = text;
    fraction.appendChild(node);
  }
  math.appendChild(fraction);
  const elements = [input, result, filter, expand, detail, math];
  for (const node of reverse ? elements.reverse() : elements) article.appendChild(node);
  root.appendChild(article);
  d.body.appendChild(root);
  const events = [];
  let caught = false,
    syntheticPrevented = false,
    filtered = false;
  function record(event) {
    if (events.length >= 32) throw new Error('sampleEventBudget');
    events.push({
      type: event.type,
      data: event.data ?? null,
      composing: !!event.isComposing,
      value: input.value,
      prevented: !!event.defaultPrevented,
    });
  }
  input.addEventListener('beforeinput', (event) => {
    if (!event.isTrusted) {
      event.preventDefault();
      return;
    }
    // A nested synthetic event must retain upstream cancellation semantics.
    const local = new window.Event('beforeinput', { cancelable: true });
    input.dispatchEvent(local);
    syntheticPrevented = local.defaultPrevented;
    if (cancel && event.data === 'x') {
      try {
        event.preventDefault();
      } catch {
        caught = true;
      }
      result.textContent = 'Must not be presented';
      try {
        bridge({ action: 'after-cancel' });
      } catch {
        /* latched by adapter */
      }
    }
    record(event);
  });
  input.addEventListener('input', (event) => {
    result.textContent = input.value;
    record(event);
  });
  for (const type of ['compositionstart', 'compositionupdate', 'compositionend'])
    input.addEventListener(type, record);
  filter.addEventListener('click', (event) => {
    if (cancelClick) {
      if (!event.isTrusted) {
        event.preventDefault();
        return;
      }
      const local = new window.Event('click', { cancelable: true });
      filter.dispatchEvent(local);
      syntheticPrevented = local.defaultPrevented;
      try {
        event.preventDefault();
      } catch {
        caught = true;
      }
      result.textContent = 'Must not be presented';
      try {
        bridge({ action: 'after-cancel-click' });
      } catch {
        /* latched by adapter */
      }
      record(event);
      return;
    }
    filtered = !filtered;
    result.textContent = filtered ? 'Filtered' : input.value;
  });
  expand.addEventListener('click', () => {
    if (detail.hasAttribute('hidden')) detail.removeAttribute('hidden');
    else detail.setAttribute('hidden', '');
  });
  return {
    read: () => ({
      value: input.value,
      text: result.textContent,
      events: [...events],
      caught,
      syntheticPrevented,
      filtered,
      expanded: !detail.hasAttribute('hidden'),
      math: {
        namespace: math.namespaceURI,
        fraction: fraction.localName,
        numerator: fraction.firstChild.textContent,
        denominator: fraction.lastChild.textContent,
      },
    }),
    mutate: () => {
      input.value = 'late-source';
      result.textContent = 'Late source mutation';
    },
    replace: () => {
      const next = d.createElement('input');
      next.id = input.id;
      next.setAttribute('aria-label', 'Ordinary input');
      next.setAttribute('type', 'text');
      article.replaceChild(next, input);
    },
  };
}
