// The same fixed, benign function runs in Chromium and the bundled source DOM.
export function runEventCases({ document, Event }) {
  const groups = [];
  function scenario(name, action) {
    const root = document.createElement('div');
    const parent = document.createElement('div');
    const target = document.createElement('div');
    root.appendChild(parent);
    parent.appendChild(target);
    document.body.appendChild(root);
    const names = new Map([
      [root, 'root'],
      [parent, 'parent'],
      [target, 'target'],
    ]);
    const trace = [];
    const state = (event) => ({
      type: event.type,
      target: names.get(event.target) ?? null,
      currentTarget: names.get(event.currentTarget) ?? null,
      eventPhase: event.eventPhase,
      isTrusted: event.isTrusted,
      defaultPrevented: event.defaultPrevented,
      cancelBubble: event.cancelBubble,
      returnValue: event.returnValue,
    });
    const listener = (label, effect) =>
      function (event) {
        trace.push({ listener: label, thisNode: names.get(this) ?? null, ...state(event) });
        return effect?.(event);
      };
    const fire = (type, options = {}, label = type) => {
      const event = new Event(type, { bubbles: true, cancelable: true, ...options });
      const result = target.dispatchEvent(event);
      trace.push({ dispatch: label, result, ...state(event) });
      return event;
    };
    try {
      action({ parent, target, trace, listener, fire });
      groups.push({ name, trace });
    } finally {
      root.remove();
    }
  }

  scenario('order-phases-and-boolean-capture', ({ parent, target, listener, fire }) => {
    parent.addEventListener('order', listener('parent-bubble-1'));
    parent.addEventListener('order', listener('parent-capture-1'), true);
    parent.addEventListener('order', listener('parent-capture-2'), { capture: true });
    target.addEventListener('order', listener('target-bubble-1'));
    target.addEventListener('order', listener('target-capture'), true);
    target.addEventListener('order', listener('target-bubble-2'));
    parent.addEventListener('order', listener('parent-bubble-2'));
    const removed = listener('removed-capture');
    parent.addEventListener('order', removed, true);
    parent.removeEventListener('order', removed, { capture: true });
    const retained = listener('retained-capture');
    parent.addEventListener('order', retained, { capture: true });
    parent.removeEventListener('order', retained, false);
    fire('order');
    parent.removeEventListener('order', retained, true);
    fire('order', { bubbles: false }, 'nonbubbling-still-captures');
  });

  scenario('duplicate-callback-and-capture-identity', ({ target, listener, fire }) => {
    const shared = listener('shared');
    target.addEventListener('duplicate', shared);
    target.addEventListener('duplicate', shared, { once: true, passive: true });
    target.addEventListener('duplicate', shared, true);
    target.addEventListener('duplicate', shared, { capture: true });
    fire('duplicate', {}, 'first');
    target.removeEventListener('duplicate', shared, false);
    fire('duplicate', {}, 'only-capture');
    target.removeEventListener('duplicate', shared, { capture: true });
    fire('duplicate', {}, 'both-removed');
  });

  scenario('once-before-recursive-new-event', ({ target, listener, fire }) => {
    let nested = false;
    target.addEventListener(
      'recursive',
      listener('once', () => {
        if (!nested) {
          nested = true;
          fire('recursive', {}, 'nested-new-event');
        }
      }),
      { once: true },
    );
    target.addEventListener('recursive', listener('persistent'));
    fire('recursive', {}, 'outer');
    fire('recursive', {}, 'later');
  });

  scenario('dispatch-listener-snapshots', ({ target, listener, fire }) => {
    const pending = listener('removed-before-turn');
    const late = listener('late-bubble');
    let changed = false;
    target.addEventListener(
      'snapshot',
      listener('mutator', () => {
        if (!changed) {
          changed = true;
          target.removeEventListener('snapshot', pending);
          target.addEventListener('snapshot', pending);
          target.addEventListener('snapshot', late);
        }
      }),
    );
    target.addEventListener('snapshot', pending);
    target.addEventListener('snapshot', listener('existing-tail'));
    fire('snapshot', {}, 'mutation-dispatch');
    fire('snapshot', {}, 'next-dispatch');
    const laterPhase = listener('added-for-later-bubble-phase');
    target.addEventListener(
      'phaseadd',
      listener('capture-adds-bubble', () => {
        target.addEventListener('phaseadd', laterPhase);
      }),
      true,
    );
    fire('phaseadd');
  });

  scenario('noncancelable-propagation-controls', ({ parent, target, listener, fire }) => {
    parent.addEventListener('stop', listener('parent'));
    target.addEventListener(
      'stop',
      listener('stopper', (event) => event.stopPropagation()),
    );
    target.addEventListener('stop', listener('same-target-tail'));
    fire('stop', { cancelable: false });
    parent.addEventListener('immediate', listener('parent'));
    target.addEventListener(
      'immediate',
      listener('immediate', (event) => event.stopImmediatePropagation()),
    );
    target.addEventListener('immediate', listener('must-not-run'));
    fire('immediate', { cancelable: false });
    parent.addEventListener(
      'capturestop',
      listener('capture-stop', (event) => event.stopPropagation()),
      true,
    );
    parent.addEventListener('capturestop', listener('same-parent-capture-tail'), true);
    target.addEventListener('capturestop', listener('unreached-target'));
    fire('capturestop', { cancelable: false });
    target.addEventListener(
      'targetstop',
      listener('target-capture-stop', (event) => event.stopPropagation()),
      true,
    );
    target.addEventListener('targetstop', listener('target-bubble-after-capture-stop'));
    fire('targetstop', { cancelable: false });
  });

  scenario('passive-and-cancelable-defaults', ({ target, trace, listener, fire }) => {
    for (const [type, passive, cancelable] of [
      ['passive', true, true],
      ['noncancelable', false, false],
      ['cancelable', false, true],
    ]) {
      target.addEventListener(
        type,
        listener('prevent', (event) => {
          event.preventDefault();
          trace.push({
            afterPrevent: type,
            defaultPrevented: event.defaultPrevented,
            returnValue: event.returnValue,
          });
        }),
        { passive },
      );
      target.addEventListener(type, listener('observer'));
      fire(type, { cancelable });
    }
    target.addEventListener(
      'returnfalse',
      listener('listener-returns-false', () => false),
    );
    target.addEventListener('returnfalse', listener('tail-after-return-false'));
    fire('returnfalse');
  });

  scenario('onproperty-return-false-and-replacement', ({ target, trace, listener, fire }) => {
    const first = listener('property-first', () => false);
    const replacement = listener('property-replacement', () => false);
    target.addEventListener('click', listener('before-property'));
    target.onclick = first;
    target.addEventListener('click', listener('after-property'));
    trace.push({ property: 'initial', sameCallback: target.onclick === first });
    fire('click', {}, 'property-cancels');
    target.onclick = replacement;
    trace.push({ property: 'replacement', sameCallback: target.onclick === replacement });
    fire('click', {}, 'replacement-retains-slot');
    fire('click', { cancelable: false }, 'property-cannot-cancel-noncancelable');
    target.onclick = null;
    trace.push({ property: 'removed', isNull: target.onclick === null });
    fire('click', {}, 'property-removed');
    target.onclick = first;
    fire('click', {}, 'readded-at-end');
  });
  return groups;
}
