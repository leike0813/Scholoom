/// <reference lib="dom" />
import { type ErrorInfo, OperationError } from '@scholoom/protocol/core';
import { isReportRenderFrame, reportRenderLimits as limits } from '@scholoom/protocol/reports';
import { type ReportStyleResolver, ReportStyles } from './report-styles.js';

const html = 'http://www.w3.org/1999/xhtml';
const math = 'http://www.w3.org/1998/Math/MathML';
const svg = 'http://www.w3.org/2000/svg';
const words = (text: string) => new Set(text.split(' '));
const elements = new Map([
  [
    html,
    words(
      'a abbr address article aside b bdi bdo blockquote br button caption cite code col colgroup data datalist dd del details dfn dialog div dl dt em fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup hr i img input ins kbd label legend li link main mark menu meta meter nav ol optgroup option output p picture pre progress q rp rt ruby s samp section select small span strong style sub summary sup table tbody td textarea tfoot th thead time title tr u ul var wbr',
    ),
  ],
  [
    math,
    words(
      'math maction maligngroup malignmark menclose merror mfenced mfrac mi mmultiscripts mn mo mover mpadded mphantom mprescripts mroot mrow ms mspace msqrt mstyle msub msubsup msup mtable mtd mtext mtr munder munderover none semantics annotation annotation-xml',
    ),
  ],
  [
    svg,
    words(
      'svg g path rect circle ellipse line polyline polygon text tspan textPath defs desc title clipPath mask marker pattern symbol linearGradient radialGradient stop',
    ),
  ],
]);
const attributes = words(
  'id class title role lang dir hidden tabindex inert for name type value checked disabled readonly required placeholder min max step minlength maxlength multiple selected size rows cols width height colspan rowspan scope headers span start reversed open datetime cite label low high optimum maxLength minLength accept-charset autocomplete inputmode spellcheck wrap xmlns encoding definitionURL display mathvariant mathsize mathcolor mathbackground stretchy symmetric fence separator lspace rspace largeop movablelimits accent accentunder linethickness bevelled notation columnalign rowalign columnspacing rowspacing columnlines rowlines frame framespacing equalrows equalcolumns rowspan columnspan scriptlevel displaystyle scriptsizemultiplier scriptminsize mathdepth viewBox preserveAspectRatio d x y x1 y1 x2 y2 cx cy r rx ry points transform fill fill-opacity fill-rule stroke stroke-width stroke-opacity stroke-linecap stroke-linejoin stroke-dasharray opacity offset stop-color stop-opacity text-anchor dominant-baseline font-size font-family font-weight font-style textLength lengthAdjust href',
);
const events = words(
  'beforeinput input change compositionstart compositionupdate compositionend click dblclick keydown keyup focus blur focusin focusout pointerdown pointerup pointermove pointercancel mousedown mouseup mousemove mouseenter mouseleave select selectionchange scroll toggle',
);
const inputTypes = words(
  'text search number range checkbox radio button date datetime-local month week time email url tel password color hidden reset submit',
);

/** No report bytes are parsed as host HTML. Only this trusted document is installed. */
export const reportDOMDocument =
  "<!doctype html><html><head><meta charset=\"utf-8\"><meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; connect-src 'none'; img-src blob:; font-src blob:; media-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'\"></head><body></body></html>";

type Shape = {
  type: number;
  name: string;
  namespace: string;
  parent: number;
  children: number[];
  attributes: Map<string, string>;
  attributeUnits?: Map<string, number>;
  valueUnits?: number;
  text: string;
};
type Listener = { node: number; type: string; capture: boolean; remove(): void };
function require(valid: unknown, code: ErrorInfo['code'] = 'protocolIncompatible'): asserts valid {
  if (!valid)
    throw new OperationError(
      code,
      code === 'resourceLimit'
        ? '报告内容超过当前视图的呈现容量，请缩小报告或分批查看。'
        : '报告呈现数据不兼容。',
    );
}

/** One owned, scriptless frame. Native input transactions remain the calling view's responsibility. */
export function createReportDOM({
  document: owner,
  onEvent,
  preserveProperty,
  styles: styleResources,
}: {
  document: Document;
  onEvent?(index: number, event: Event): void;
  /** Trusted input coordinator only; a source frame never supplies this callback. */
  preserveProperty?(index: number, name: string, value: string | boolean): boolean;
  styles?: { baseURL: string; resolve: ReportStyleResolver };
}) {
  require(owner.defaultView, 'unavailable');
  const nodePrototype = owner.defaultView.Node.prototype;
  const elementPrototype = owner.defaultView.Element.prototype;
  const documentPrototype = owner.defaultView.Document.prototype;
  const eventPrototype = owner.defaultView.EventTarget.prototype;
  const contains = (parent: Node, child: Node | null) => nodePrototype.contains.call(parent, child);
  const styles = new ReportStyles(
    styleResources?.resolve ??
      (() => {
        throw new OperationError('unavailable', '报告样式资源未批准。');
      }),
  );
  const element = owner.createElement('iframe');
  element.title = '交互报告';
  element.setAttribute('sandbox', 'allow-same-origin');
  let closed = false;
  let failed = false;
  let applying = false;
  let document: Document | undefined;
  let sequence = 0;
  let stringBytes = 0;
  let roots: { html: number; head: number } | undefined;
  let sheetOrder: number[] = [];
  let sheets = new Map<
    number,
    {
      source: string;
      baseURL: string;
      css: string;
      selectorWork: number;
      element?: HTMLStyleElement;
    }
  >();
  const strings: string[] = [];
  const nodes = new Map<number, Node>();
  const identities = new WeakMap<Node, number>();
  const forwarded = new WeakSet<Event>();
  let shapes = new Map<number, Shape>([
    [
      2,
      {
        type: 1,
        name: 'body',
        namespace: html,
        parent: 0,
        children: [],
        attributes: new Map(),
        text: '',
      },
    ],
  ]);
  const listeners = new Map<string, Listener>();
  let rejectReady!: (reason: unknown) => void;
  const ready = new Promise<void>((resolve, reject) => {
    rejectReady = reject;
    element.addEventListener('load', () => {
      if (closed) return;
      if (document) {
        failed = true;
        return;
      }
      document = element.contentDocument ?? undefined;
      if (!document?.body) {
        failed = true;
        reject(new OperationError('unavailable', '报告文档不可用。'));
        return;
      }
      nodes.set(2, document.body);
      identities.set(document, 1);
      identities.set(document.body, 2);
      resolve();
    });
  });
  // Closing an unmounted frame must not produce an unhandled promise rejection.
  void ready.catch(() => {});
  element.srcdoc = reportDOMDocument;
  const canonical = (id: number) => (id === 1 ? 2 : id);
  const node = (id: number) => {
    const value = nodes.get(canonical(id));
    require(value);
    return value;
  };
  const live = () =>
    require(
      !closed &&
        !applying &&
        !failed &&
        document &&
        element.contentDocument === document &&
        element.getAttribute('sandbox') === 'allow-same-origin',
    );

  const identity = (value: Node | null) => {
    if (closed || failed || !document || !value) return undefined;
    if (value !== document && !contains(document.documentElement, value)) return undefined;
    return identities.get(value);
  };

  return {
    element,
    ready,
    identity,
    apply(value: unknown) {
      live();
      require(isReportRenderFrame(value));
      const frame = value;
      require(frame.sequence === sequence + 1 && frame.nodes.length % 5 === 0);
      const addedBytes = frame.strings.reduce(
        (n, s) => n + new TextEncoder().encode(s).byteLength,
        0,
      );
      require(strings.length + frame.strings.length <= limits.strings &&
        stringBytes + addedBytes <= limits.stringBytes, 'resourceLimit');
      require(shapes.size + frame.nodes.length / 5 + (frame.roots ? 2 : 0) <=
        limits.nodes, 'resourceLimit');
      let remaining: number = limits.workUnits;
      const spend = (units: number) => {
        require(units <= remaining, 'resourceLimit');
        remaining -= units;
      };
      const string = (index: number) => {
        const text =
          index < strings.length ? strings[index] : frame.strings[index - strings.length];
        require(typeof text === 'string');
        return text;
      };
      spend(shapes.size + listeners.size);
      const next = new Map(shapes);
      const touched = new Set<number>();
      const shape = (raw: number, write = false): Shape => {
        const id = canonical(raw);
        let item = next.get(id);
        require(item);
        if (write && !touched.has(id)) {
          spend(item.children.length + item.attributes.size + 1);
          item = {
            ...item,
            children: [...item.children],
            attributes: new Map(item.attributes),
            ...(item.attributeUnits ? { attributeUnits: new Map(item.attributeUnits) } : {}),
          };
          next.set(id, item);
          touched.add(id);
        }
        return item;
      };
      const work: Array<() => void> = [];
      const inputShadows = new Map<number, HTMLInputElement>();
      const inputShadow = (id: number) => {
        let input = inputShadows.get(id);
        if (input) return input;
        const previous = shapes.get(id);
        let copyUnits = previous?.valueUnits ?? 0;
        for (const [name, value] of previous?.attributes ?? [])
          copyUnits += name.length + (previous?.attributeUnits?.get(name) ?? value.length);
        spend(copyUnits + 1);
        input = (
          nodes.has(id)
            ? nodePrototype.cloneNode.call(node(id), false)
            : documentPrototype.createElementNS.call(document!, html, 'input')
        ) as HTMLInputElement;
        inputShadows.set(id, input);
        return input;
      };
      const recordInput = (id: number, input: HTMLInputElement) => {
        const value = input.value;
        const attribute = elementPrototype.getAttribute.call(input, 'value') as string | null;
        spend(value.length + (attribute?.length ?? 0));
        const item = shape(id, true);
        item.valueUnits = value.length;
        // Native type/value reflection can retain a content attribute after .value is cleared.
        if (attribute === null) {
          item.attributes.delete('value');
          item.attributeUnits?.delete('value');
        } else {
          item.attributes.set('value', attribute);
          item.attributeUnits ??= new Map();
          item.attributeUnits.set('value', attribute.length);
        }
        require(item.attributes.size <= limits.attributes, 'resourceLimit');
      };
      const nextRoots = frame.roots ?? roots;
      if (frame.roots) {
        require(!roots && frame.sequence === 1);
        const { html: root, head } = frame.roots;
        require(root > 2 && head > 2 && root !== head);
        require(!next.has(root) && !next.has(head));
        next.set(root, {
          type: 1,
          name: 'html',
          namespace: html,
          parent: 0,
          children: [head, 2],
          attributes: new Map(),
          text: '',
        });
        next.set(head, {
          type: 1,
          name: 'head',
          namespace: html,
          parent: root,
          children: [],
          attributes: new Map(),
          text: '',
        });
        shape(2, true).parent = root;
        work.push(() => {
          for (const [id, value] of [
            [root, document!.documentElement],
            [head, document!.head],
          ] as const) {
            nodes.set(id, value);
            identities.set(value, id);
          }
        });
      }
      for (let i = 0; i < frame.nodes.length; i += 5) {
        const id = frame.nodes[i]!;
        const type = frame.nodes[i + 1]!;
        const name = string(frame.nodes[i + 2]!);
        require(id > 2 && id <= 65535 && !next.has(id));
        require([1, 3, 8, 11].includes(type));
        const namespace = type === 1 ? string(frame.nodes[i + 4]!) : '';
        if (type === 1) require(elements.get(namespace)?.has(name), 'unavailable');
        const text = type === 3 || type === 8 ? string(frame.nodes[i + 3]!) : '';
        spend(text.length);
        next.set(id, {
          type,
          name,
          namespace,
          parent: 0,
          children: [],
          attributes: new Map(),
          text,
        });
        touched.add(id);
        work.push(() => {
          const created =
            type === 1
              ? documentPrototype.createElementNS.call(document!, namespace, name)
              : type === 3
                ? documentPrototype.createTextNode.call(document!, text)
                : type === 8
                  ? documentPrototype.createComment.call(document!, text)
                  : documentPrototype.createDocumentFragment.call(document!);
          nodes.set(id, created);
          identities.set(created, id);
          if (namespace === html && name === 'style')
            elementPrototype.setAttribute.call(created, 'type', 'text/plain');
          if (namespace === html && name === 'link')
            elementPrototype.setAttribute.call(created, 'rel', 'scholoom-inert');
        });
      }
      const detach = (ids: readonly number[]) => {
        const parents = new Map<number, Set<number>>();
        for (const id of ids) {
          const parent = shape(id).parent;
          if (parent) {
            let removed = parents.get(parent);
            if (!removed) {
              removed = new Set();
              parents.set(parent, removed);
            }
            removed.add(id);
            shape(id, true).parent = 0;
          }
        }
        for (const [parent, removed] of parents) {
          const item = shape(parent, true);
          spend(item.children.length);
          item.children = item.children.filter((id) => !removed.has(id));
        }
      };
      const plannedListeners = new Map(listeners);
      let operations = 0;
      for (let i = 0; i < frame.mutations.length; ) {
        require(++operations <= limits.operations, 'resourceLimit');
        const m = frame.mutations;
        const type = m[i]!;
        const length =
          type === 0 || type === 3
            ? 5
            : type === 1
              ? 3
              : type === 2
                ? 6 + m[i + 4]! + m[i + 5]!
                : type === 4
                  ? 4 + m[i + 2]! * 2 + m[i + 3]! * 6
                  : 0;
        require(length > 0 && i + length <= m.length);
        const id = canonical(m[i + 1]!);
        const target = shape(id);
        if (type === 0) {
          require(target.type === 1);
          const name = string(m[i + 2]!);
          const namespace = string(m[i + 3]!);
          const value = m[i + 4] === 0 ? null : string(m[i + 4]! - 1);
          require(namespace === html || namespace === '', 'unavailable');
          const sourceSheet = target.namespace === html && ['style', 'link'].includes(target.name);
          const imageAttribute =
            target.namespace === html &&
            target.name === 'img' &&
            ['src', 'alt', 'loading', 'decoding'].includes(name);
          const metadata =
            target.namespace === html &&
            target.name === 'meta' &&
            ['content', 'charset'].includes(name);
          const sheetAttribute = sourceSheet && ['type', 'media', 'href', 'rel'].includes(name);
          require(name === 'style' ||
            imageAttribute ||
            sheetAttribute ||
            metadata ||
            attributes.has(name) ||
            /^(aria|data)-[a-z][a-z0-9_.-]*$/.test(name), 'unavailable');
          // srcdoc resolves even #fragments against the host URL. Trusted navigation is separate.
          if (name === 'href' && target.name !== 'link') require(value === null, 'unavailable');
          if (metadata) require(value === null || value.length <= 512, 'resourceLimit');
          if (name === 'type' && target.namespace === html && target.name === 'input')
            require(value === null || inputTypes.has(value.toLowerCase()), 'unavailable');
          const presented =
            name === 'style' && value !== null
              ? styles.compile(value, 'declarationList', styleResources?.baseURL ?? '', spend).css
              : imageAttribute && name === 'src' && value !== null
                ? value
                  ? styles.renderURL(value, styleResources?.baseURL ?? '')
                  : null
                : value;
          spend(name.length + Math.max(value?.length ?? 0, presented?.length ?? 0));
          // SVG presentation attributes can also resolve URLs; only literal paints are supported here.
          if (['fill', 'stroke', 'stop-color'].includes(name))
            require(value === null ||
              /^(?:none|currentColor|transparent|[a-zA-Z]+|#[\da-fA-F]{3,8})$/.test(
                value,
              ), 'unavailable');
          const edited = shape(id, true);
          if (value === null) {
            edited.attributes.delete(name);
            edited.attributeUnits?.delete(name);
          } else {
            edited.attributes.set(name, value);
            edited.attributeUnits ??= new Map();
            edited.attributeUnits.set(name, Math.max(value.length, presented?.length ?? 0));
          }
          require(edited.attributes.size <= limits.attributes, 'resourceLimit');
          if (target.namespace === html && target.name === 'input') {
            const input = inputShadow(id);
            if (presented === null) elementPrototype.removeAttribute.call(input, name);
            else elementPrototype.setAttribute.call(input, name, presented);
            recordInput(id, input);
          }
          if (
            nodes.has(id) &&
            target.namespace === html &&
            ['input', 'textarea', 'select'].includes(target.name)
          )
            require(document!.activeElement !== node(id), 'unavailable');
          if (!(sourceSheet && ['type', 'rel', 'href', 'media'].includes(name)))
            work.push(() =>
              presented === null
                ? elementPrototype.removeAttribute.call(node(id), name)
                : elementPrototype.setAttribute.call(node(id), name, presented),
            );
        } else if (type === 1) {
          require(target.type === 3 || target.type === 8);
          const text = string(m[i + 2]!);
          spend(text.length);
          shape(id, true).text = text;
          work.push(() => {
            (node(id) as CharacterData).data = text;
          });
        } else if (type === 2) {
          require(target.type === 1 || target.type === 11);
          require(id !== nextRoots?.html, 'unavailable');
          const sibling = canonical(m[i + 2]!);
          if (sibling) require(shape(sibling).parent === id);
          const previous = canonical(m[i + 3]!);
          if (previous) require(shape(previous).parent === id);
          const added = m.slice(i + 6, i + 6 + m[i + 4]!);
          const removed = m.slice(i + 6 + m[i + 4]!, i + length);
          require(new Set(added).size === added.length && new Set(removed).size === removed.length);
          const focused = document!.activeElement;
          if (focused && focused !== document!.body) {
            for (const child of [...added, ...removed]) {
              if (nodes.has(child)) require(!contains(node(child), focused), 'unavailable');
            }
          }
          for (const child of removed)
            require(
              child > 2 &&
                child !== nextRoots?.html &&
                child !== nextRoots?.head &&
                shape(child).parent === id,
            );
          detach(removed);
          if (sibling) require(shape(sibling).parent === id);
          const inserted: number[] = [];
          for (const child of added) {
            require(child > 2 && child !== id);
            require(child !== nextRoots?.html && child !== nextRoots?.head);
            const candidates = shape(child).type === 11 ? [...shape(child).children] : [child];
            for (const item of candidates) {
              if (item === sibling) continue;
              for (let parent = id, depth = 0; parent; parent = shape(parent).parent) {
                spend(1);
                require(parent !== item && ++depth <= limits.depth);
              }
              inserted.push(item);
            }
          }
          require(new Set(inserted).size === inserted.length);
          detach(inserted);
          const children = shape(id, true).children;
          const index = sibling ? children.indexOf(sibling) : children.length;
          require(index >= 0);
          spend(sibling ? children.length : 0);
          spend(children.length - index);
          children.splice(index, 0, ...inserted);
          for (const item of inserted) shape(item, true).parent = id;
          work.push(() => {
            for (const child of removed) nodePrototype.removeChild.call(node(id), node(child));
            for (const child of added)
              nodePrototype.insertBefore.call(
                node(id),
                node(child),
                sibling ? node(sibling) : null,
              );
          });
        } else if (type === 3) {
          require(target.type === 1 && target.namespace === html);
          const name = string(m[i + 2]!);
          const boolean = m[i + 3]!;
          require(boolean === 0 || boolean === 1);
          const value = boolean ? m[i + 4] === 1 : string(m[i + 4]!);
          require(!boolean || m[i + 4]! <= 1);
          require((name === 'value' &&
            !boolean &&
            ['input', 'textarea', 'select', 'option'].includes(target.name)) ||
            (boolean &&
              ((name === 'checked' && target.name === 'input') ||
                (name === 'selected' && target.name === 'option'))), 'unavailable');
          const preserve = nodes.has(id) && preserveProperty?.(id, name, value);
          if (typeof value === 'string') {
            spend(value.length);
            if (target.name === 'input') {
              const input = inputShadow(id);
              if (!preserve) input.value = value;
              recordInput(id, input);
            } else {
              const actual = preserve ? Reflect.get(node(id), name) : value;
              require(typeof actual === 'string');
              shape(id, true).valueUnits = actual.length;
            }
          }
          if (!preserve && nodes.has(id) && document!.activeElement === node(id))
            require(Reflect.get(node(id), name) === value, 'unavailable');
          if (!preserve)
            work.push(() => {
              if (Reflect.get(node(id), name) !== value) Reflect.set(node(id), name, value);
            });
        } else {
          require(target.type === 1);
          let position = i + 4;
          const adds = i + 4 + m[i + 2]! * 2;
          for (; position < i + length; ) {
            const type = string(m[position]!);
            const index = m[position + 1]!;
            require(events.has(type), 'unavailable');
            const sourceId = m[i + 1]!;
            const key = `${sourceId}:${index}`;
            if (position < adds) {
              require(plannedListeners.get(key)?.type === type);
              plannedListeners.delete(key);
              work.push(() => {
                listeners.get(key)?.remove();
                listeners.delete(key);
              });
              position += 2;
            } else {
              require(!plannedListeners.has(key));
              const flags = m.slice(position + 2, position + 6);
              require(flags.every((flag) => flag === 0 || flag === 1));
              require(flags[3] === 0, 'unavailable');
              const capture = flags[0] === 1;
              const placeholder = { node: id, type, capture, remove() {} };
              plannedListeners.set(key, placeholder);
              require(plannedListeners.size <= limits.nodes, 'resourceLimit');
              work.push(() => {
                const listener = (event: Event) => {
                  if (closed || failed || forwarded.has(event)) return;
                  const target = identity(event.target as Node | null);
                  if (target === undefined) return;
                  forwarded.add(event);
                  onEvent?.(target, event);
                };
                eventPrototype.addEventListener.call(node(id), type, listener, {
                  capture,
                  // Source dispatch owns once: host propagation may reach a listener it skips.
                  passive: flags[2] === 1,
                });
                listeners.set(key, {
                  ...placeholder,
                  remove: () =>
                    eventPrototype.removeEventListener.call(node(id), type, listener, capture),
                });
              });
              position += 6;
            }
          }
        }
        i += length;
      }
      // Validate depth once, including descendants of a subtree moved in this frame.
      spend(next.size * 4);
      const stack: Array<[number, number]> = [...next]
        .filter(([, item]) => item.parent === 0)
        .map(([id]) => [id, 1]);
      let visited = 0;
      while (stack.length) {
        const [id, depth] = stack.pop()!;
        require(depth <= limits.depth && ++visited <= next.size, 'resourceLimit');
        for (const child of shape(id).children) stack.push([child, depth + 1]);
      }
      require(visited === next.size);
      if (nextRoots) {
        for (const child of shape(nextRoots.head).children) {
          const item = shape(child);
          require(item.type === 3 ||
            item.type === 8 ||
            (item.namespace === html &&
              ['style', 'link', 'title', 'meta'].includes(item.name)), 'unavailable');
        }
      }
      let contentUnits = 0;
      for (const item of next.values()) {
        spend(item.attributes.size + 1);
        contentUnits += item.text.length + (item.valueUnits ?? 0);
        for (const [name, value] of item.attributes)
          contentUnits += name.length + (item.attributeUnits?.get(name) ?? value.length);
        require(contentUnits <= limits.contentUnits, 'resourceLimit');
      }
      const compiled = new Map<
        number,
        {
          source: string;
          baseURL: string;
          css: string;
          selectorWork: number;
          element?: HTMLStyleElement;
        }
      >();
      spend(next.size * 2);
      const sourceOrder = [nextRoots?.html ?? 2];
      let selectorWork = 0;
      while (sourceOrder.length) {
        const id = sourceOrder.pop()!;
        const item = shape(id);
        if (item.namespace === html && ['style', 'link'].includes(item.name)) {
          let source = '';
          let baseURL = styleResources?.baseURL ?? '';
          const media = item.attributes.get('media');
          require(!media || media.length <= 512, 'resourceLimit');
          require(!item.attributes.get('type') ||
            item.attributes.get('type') === 'text/css', 'unavailable');
          if (item.name === 'style') {
            for (const child of item.children) {
              require(shape(child).type === 3 || shape(child).type === 8, 'unavailable');
              if (shape(child).type === 3) source += shape(child).text;
              require(source.length <= limits.cssBytes, 'resourceLimit');
            }
          } else {
            const href = item.attributes.get('href');
            const rel = item.attributes.get('rel');
            if (!href || !rel) continue;
            require(rel.toLowerCase() === 'stylesheet' &&
              !item.children.length &&
              styleResources, 'unavailable');
            const asset = styleResources.resolve(href, baseURL, 'style');
            require(typeof asset.text === 'string', 'unavailable');
            source = asset.text;
            baseURL = asset.url;
          }
          if (media) source = `@media ${media}{${source}}`;
          spend(source.length);
          const cached = sheets.get(id);
          const sheet =
            cached?.source === source && cached.baseURL === baseURL
              ? cached
              : {
                  source,
                  baseURL,
                  ...styles.compile(source, 'stylesheet', baseURL, spend),
                  ...(cached?.element ? { element: cached.element } : {}),
                };
          compiled.set(id, sheet);
          contentUnits += sheet.css.length;
          require(contentUnits <= limits.contentUnits, 'resourceLimit');
          selectorWork += sheet.selectorWork;
        }
        sourceOrder.push(...[...item.children].reverse());
      }
      spend(selectorWork * next.size);
      applying = true;
      try {
        for (const action of work) action();
        for (const [id, sheet] of sheets) {
          if (!compiled.has(id) && sheet.element?.parentNode)
            nodePrototype.removeChild.call(sheet.element.parentNode, sheet.element);
        }
        const order = [...compiled.keys()];
        const reorder =
          order.length !== sheetOrder.length || order.some((id, index) => id !== sheetOrder[index]);
        for (const sheet of compiled.values()) {
          if (!sheet.element) {
            sheet.element = documentPrototype.createElementNS.call(
              document!,
              html,
              'style',
            ) as HTMLStyleElement;
          }
          if (sheet.element.textContent !== sheet.css) sheet.element.textContent = sheet.css;
          if (reorder) nodePrototype.appendChild.call(document!.head, sheet.element);
        }
        sheetOrder = order;
        sheets = compiled;
      } catch (error) {
        failed = true;
        throw error;
      } finally {
        applying = false;
      }
      shapes = next;
      roots = nextRoots;
      strings.push(...frame.strings);
      stringBytes += addedBytes;
      sequence = frame.sequence;
      return { sequence, nodes: nodes.size, strings: strings.length, stringBytes };
    },
    close() {
      if (closed) return;
      closed = true;
      rejectReady(new OperationError('unavailable', '报告视图已关闭。'));
      for (const item of listeners.values()) item.remove();
      listeners.clear();
      nodes.clear();
      shapes.clear();
      sheets.clear();
      strings.length = 0;
      element.remove();
    },
  };
}
