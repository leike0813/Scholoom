// Shared fixed benign inputs; this function also runs in an offline native Chromium document.
export function runStyleCases(document) {
  const groups = [];
  function group(name, keys, actions) {
    const element = document.createElement('div');
    const style = element.style;
    const steps = [];
    const step = (action) => {
      const returned = action();
      steps.push({
        returned: returned ?? null,
        cssText: style.cssText,
        properties: keys.map((key) => ({
          key,
          value: style.getPropertyValue(key),
          priority: style.getPropertyPriority(key),
        })),
      });
    };
    actions(style, step, element);
    groups.push({ name, steps });
  }
  group('quoted separators', ['content', 'font-family'], (style, step) => {
    step(() => { style.cssText = 'content: "a;b:c"; font-family: "A;B:C";'; });
  });
  group('url variables and importance', ['background-image', 'width', 'color'], (style, step) => {
    step(() => { style.cssText = 'background-image: url("images/plot;a:b.svg"); width: var(--Width, 12px); color: red !important; color: blue;'; });
    step(() => { style.cssText = 'color: red; color: blue !IMPORTANT; color: green !important;'; });
    step(() => style.setProperty('width', 'calc(100% - var(--Gap, 2px))'));
    step(() => style.setProperty('background-image', 'url("images/plot;a:b.svg")', 'important'));
  });
  group('custom property case', ['--Theme', '--theme', 'COLOR', 'constructor', '__proto__'], (style, step) => {
    step(() => { style.cssText = '--Theme: "A;B:C"; --theme: Blue; COLOR: red;'; });
    step(() => style.setProperty('--Theme', 'Green', 'IMPORTANT'));
    step(() => style.removeProperty('--theme'));
    step(() => style.setProperty('--theme', '"Set;With:Separators"'));
  });
  group('set remove and priority', ['color', 'width', 'content'], (style, step) => {
    step(() => style.setProperty('color', 'red', 'important'));
    step(() => style.setProperty('COLOR', 'blue'));
    step(() => style.setProperty('color', 'green', 'invalid'));
    step(() => style.setProperty('content', '"x;y:z"', 'IMPORTANT'));
    step(() => style.setProperty('width', '10px !important'));
    step(() => style.removeProperty('CONTENT'));
    step(() => style.setProperty('color', '', 'invalid'));
  });
  group('ordered full replacements and aliases', ['color', 'width', 'background-color', '--Order'], (style, step) => {
    step(() => { style.cssText = 'color:red;width:10px;--Order:First;'; });
    step(() => { style.cssText = 'width:20px;color:blue;color:green;'; });
    step(() => { style.backgroundColor = 'red'; });
    step(() => { style['background-color'] = 'blue'; });
    step(() => style.removeProperty('width'));
    step(() => style.setProperty('width', '30px'));
    step(() => { style.cssText = ''; });
  });
  group('invalid declarations', ['color', 'width', 'made-up', 'constructor', '__proto__'], (style, step) => {
    step(() => { style.cssText = 'made-up:value;color:potato;width:12px;broken;color:blue;constructor:red;__proto__:red;'; });
    step(() => style.setProperty('color', 'red; width: 9px'));
    step(() => style.setProperty('made-up', 'value'));
    step(() => style.setProperty('width', 'potato'));
    step(() => { style.cssText = 'color:red!flag;width:3px;'; });
    step(() => { style.cssText = 'color:var(foo);width:4px;'; });
  });
  group('Element style attribute interop', ['content', '--Theme', '--theme', 'color'], (style, step, element) => {
    const check = (condition, message) => {
      if (!condition) throw new Error(`Element style attribute interop: ${message}`);
    };
    const observer = new document.defaultView.MutationObserver(() => {});
    observer.observe(element, { attributes: true });
    const change = (action, present = true) => step(() => {
      action();
      check(element.style === style, 'attribute changes preserve the same style object');
      const records = observer.takeRecords();
      check(records.length === 1, 'one mutation for each changed style attribute');
      check(records[0].target === element && records[0].attributeName === 'style', 'mutation identifies the owned style attribute');
      const attribute = element.getAttribute('style');
      check((attribute !== null) === present && element.hasAttribute('style') === present, 'attribute presence');
      if (present) {
        const parsed = document.createElement('div').style;
        parsed.cssText = attribute;
        for (const key of ['content', '--Theme', '--theme', 'color']) {
          check(parsed.getPropertyValue(key) === style.getPropertyValue(key), `attribute value agrees for ${key}`);
          check(parsed.getPropertyPriority(key) === style.getPropertyPriority(key), `attribute priority agrees for ${key}`);
        }
      } else {
        check(style.cssText === '', 'removing the attribute clears the existing style object');
        for (const key of ['content', '--Theme', '--theme', 'color']) {
          check(style.getPropertyValue(key) === '' && style.getPropertyPriority(key) === '', `removed declaration is empty for ${key}`);
        }
      }
    });
    try {
      change(() => element.setAttribute('style', 'content:"Attr;Has:Separators";--Theme:"Warm;Tone:One";--theme:Cool;color:red!important;'));
      change(() => style.setProperty('content', '"Style;Back:Attribute"', 'important'));
      change(() => style.setProperty('--theme', 'Updated'));
      change(() => element.removeAttribute('style'), false);
      step(() => {
        element.removeAttribute('style');
        check(observer.takeRecords().length === 0, 'removing an absent style attribute has no mutation');
      });
      change(() => style.setProperty('--Theme', 'Restored'));
    } finally {
      observer.disconnect();
    }
  });
  return groups;
}
