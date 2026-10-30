// Fixed benign source; executed only by the owned Node child and native oracle.
export function mountSample(window) {
  const document = window.document;
  const root = document.createElement('section');
  const article = document.createElement('article');
  const label = document.createElement('label');
  label.setAttribute('for', 'ordinary-input');
  label.textContent = 'Ordinary input';
  const input = document.createElement('input');
  input.id = 'ordinary-input';
  input.setAttribute('type', 'text');
  const paragraph = document.createElement('p');
  paragraph.id = 'result';
  const math = document.createElementNS('http://www.w3.org/1998/Math/MathML', 'math');
  const fraction = document.createElementNS(math.namespaceURI, 'mfrac');
  const numerator = document.createElementNS(math.namespaceURI, 'mi');
  const denominator = document.createElementNS(math.namespaceURI, 'mn');
  numerator.textContent = 'n';
  denominator.textContent = '2';
  fraction.appendChild(numerator);
  fraction.appendChild(denominator);
  math.appendChild(fraction);
  article.appendChild(label);
  article.appendChild(input);
  article.appendChild(paragraph);
  article.appendChild(math);
  root.appendChild(article);
  document.body.appendChild(root);
  const events = [];
  function record(event) {
    if (events.length >= 128) throw new Error('sampleEventBudget');
    events.push({
      type: event.type,
      data: event.data,
      inputType: event.inputType,
      isComposing: event.isComposing,
      value: input.value,
      defaultPrevented: !!event.defaultPrevented,
      cancelable: event.cancelable,
    });
  }
  input.addEventListener('beforeinput', (event) => {
    if (event.data === 'x') {
      event.preventDefault();
      paragraph.textContent = 'Source canceled x';
    }
    record(event);
  });
  input.addEventListener('input', (event) => {
    input.value = input.value.toUpperCase();
    numerator.textContent = input.value || 'n';
    paragraph.textContent = `Source accepted ${input.value}`;
    record(event);
  });
  return {
    read: () => ({
      value: input.value,
      events: [...events],
      text: paragraph.textContent,
      math: {
        namespace: math.namespaceURI,
        fraction: fraction.localName,
        numerator: numerator.textContent,
        denominator: denominator.textContent,
      },
    }),
  };
}
