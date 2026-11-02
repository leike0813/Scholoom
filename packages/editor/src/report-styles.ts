import { OperationError } from '@scholoom/protocol/core';
import { reportRenderLimits as limits } from '@scholoom/protocol/reports';
import {
  type CssNode,
  generate,
  ident,
  type List,
  type ListItem,
  parse,
  tokenize,
  tokenTypes,
  walk,
} from 'css-tree';

/** The trusted view resolves only the same frozen assets; a stylesheet URL is its own base. */
export type ReportStyleResolver = (
  specifier: string,
  baseURL: string,
  kind: 'render' | 'style',
) => { url: string; text?: string };

const names = (value: string) => new Set(value.split(' '));
export const reportStyleProperties = names(
  'accent-color align-content align-items align-self appearance aspect-ratio background background-color background-image background-position background-position-x background-position-y background-repeat background-size background-origin background-clip background-attachment border border-top border-right border-bottom border-left border-color border-width border-style border-radius border-top-color border-right-color border-bottom-color border-left-color border-top-width border-right-width border-bottom-width border-left-width border-top-style border-right-style border-bottom-style border-left-style border-top-left-radius border-top-right-radius border-bottom-left-radius border-bottom-right-radius border-collapse border-spacing border-image border-image-source border-image-slice border-image-width border-image-outset border-image-repeat box-sizing box-shadow break-after break-before break-inside caption-side caret-color clear clip-path color color-scheme column-count column-gap column-width column-rule column-rule-color column-rule-style column-rule-width columns content counter-increment counter-reset cursor direction display empty-cells fill fill-opacity fill-rule flex flex-basis flex-direction flex-flow flex-grow flex-shrink flex-wrap float font font-family font-feature-settings font-kerning font-optical-sizing font-size font-stretch font-style font-variant font-variant-caps font-variant-numeric font-variation-settings font-weight gap grid grid-area grid-auto-columns grid-auto-flow grid-auto-rows grid-column grid-column-end grid-column-start grid-row grid-row-end grid-row-start grid-template grid-template-areas grid-template-columns grid-template-rows height hyphens inline-size inset inset-block inset-block-end inset-block-start inset-inline inset-inline-end inset-inline-start isolation justify-content justify-items justify-self left letter-spacing line-height list-style list-style-image list-style-position list-style-type margin margin-block margin-block-end margin-block-start margin-bottom margin-inline margin-inline-end margin-inline-start margin-left margin-right margin-top max-block-size max-height max-inline-size max-width min-block-size min-height min-inline-size min-width object-fit object-position opacity order orphans outline outline-color outline-offset outline-style outline-width overflow overflow-wrap overflow-x overflow-y overscroll-behavior padding padding-block padding-block-end padding-block-start padding-bottom padding-inline padding-inline-end padding-inline-start padding-left padding-right padding-top page-break-after page-break-before page-break-inside paint-order pointer-events position quotes resize right row-gap scroll-behavior scroll-margin scroll-padding scrollbar-color scrollbar-width shape-outside speak stroke stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-opacity stroke-width tab-size table-layout text-align text-align-last text-decoration text-decoration-color text-decoration-line text-decoration-style text-decoration-thickness text-indent text-justify text-overflow text-rendering text-shadow text-transform text-underline-offset top touch-action transform transform-origin transform-style unicode-bidi user-select vertical-align visibility white-space widows width word-break word-spacing word-wrap writing-mode z-index',
);
const fontProperties = names(
  'font-family src font-style font-weight font-stretch font-display font-feature-settings font-variation-settings unicode-range size-adjust ascent-override descent-override line-gap-override',
);
const functions = names(
  'calc min max clamp var env rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix light-dark linear-gradient radial-gradient conic-gradient repeating-linear-gradient repeating-radial-gradient repeating-conic-gradient fit-content minmax repeat translate translatex translatey translatez translate3d scale scalex scaley scalez scale3d rotate rotatex rotatey rotatez rotate3d skew skewx skewy matrix matrix3d perspective format type tech counter counters symbols circle ellipse inset polygon path round mod rem sin cos tan asin acos atan atan2 pow sqrt hypot log exp abs sign',
);
const atRules = names('media supports container layer font-face import');
const decode = (name: string) => ident.decode(name).toLowerCase();
function check(
  value: unknown,
  code: 'unavailable' | 'resourceLimit' = 'unavailable',
): asserts value {
  if (!value) throw new OperationError(code, '报告样式能力不可用或超过容量。');
}

/** Parses and rewrites the whole CSS tree before any bytes reach the rendering document. */
export class ReportStyles {
  constructor(private readonly resolve: ReportStyleResolver) {}

  renderURL(value: string, baseURL: string) {
    const asset = this.resolve(value, baseURL, 'render');
    check(asset.url.startsWith('blob:') && asset.url.length <= 512);
    return asset.url;
  }

  compile(
    text: string,
    context: 'stylesheet' | 'declarationList',
    baseURL: string,
    spend: (units: number) => void,
  ) {
    let totalBytes = 0;
    let tokens = 0;
    let nodes = 0;
    let selectors = 0;
    let selectorWork = 0;
    let imports = 0;
    const loading = new Set([baseURL]);
    const resource = this.renderURL.bind(this);
    const read = (source: string, mode: typeof context, base: string): CssNode => {
      check(typeof source === 'string' && source.length <= limits.cssBytes, 'resourceLimit');
      totalBytes += new TextEncoder().encode(source).byteLength;
      check(totalBytes <= limits.cssBytes, 'resourceLimit');
      spend(source.length);
      let depth = 0;
      tokenize(source, (type) => {
        check(++tokens <= limits.cssTokens, 'resourceLimit');
        spend(1);
        if (
          [
            tokenTypes.Function,
            tokenTypes.LeftParenthesis,
            tokenTypes.LeftSquareBracket,
            tokenTypes.LeftCurlyBracket,
          ].includes(type)
        )
          check(++depth <= limits.cssDepth, 'resourceLimit');
        if (
          [
            tokenTypes.RightParenthesis,
            tokenTypes.RightSquareBracket,
            tokenTypes.RightCurlyBracket,
          ].includes(type)
        )
          check(--depth >= 0);
      });
      check(depth === 0);
      const tree = parse(source, {
        context: mode,
        parseCustomProperty: true,
        onParseError: () => check(false),
      });
      const ancestors: CssNode[] = [];
      walk(tree, {
        enter: (node: CssNode, item: ListItem<CssNode>, list: List<CssNode>) => {
          check(++nodes <= limits.cssNodes, 'resourceLimit');
          spend(ancestors.length + 1);
          check(ancestors.length <= limits.cssDepth, 'resourceLimit');
          check(node.type !== 'Raw');
          if (node.type === 'Selector' || ancestors.some((parent) => parent.type === 'Selector'))
            selectorWork++;
          if (node.type === 'String') check(node.value.length <= 512, 'resourceLimit');
          if (node.type === 'PseudoClassSelector') check(decode(node.name) !== 'has');
          if (mode === 'declarationList' && (node.type === 'Atrule' || node.type === 'Rule'))
            check(false);
          if (node.type === 'Selector') check(++selectors <= limits.cssSelectors, 'resourceLimit');
          if (node.type === 'Atrule') {
            node.name = decode(node.name);
            check(atRules.has(node.name));
            if (node.name === 'import') {
              check(
                mode === 'stylesheet' &&
                  item &&
                  list &&
                  !node.block &&
                  ++imports <= limits.cssImports,
                'resourceLimit',
              );
              const prelude = node.prelude;
              check(prelude?.type === 'AtrulePrelude' && prelude.children.size === 1);
              const address = prelude.children.first;
              // shortcut: import qualifiers need explicit structural wrapping before they can be supported.
              check(address?.type === 'String' || address?.type === 'Url');
              const asset = this.resolve(address.value, base, 'style');
              check(typeof asset.text === 'string' && !loading.has(asset.url));
              loading.add(asset.url);
              const imported = read(asset.text, 'stylesheet', asset.url);
              loading.delete(asset.url);
              check(imported.type === 'StyleSheet');
              list.replace(item, imported.children);
              return walk.skip;
            }
          }
          if (node.type === 'Declaration') {
            const property = ident.decode(node.property);
            const font = ancestors.some(
              (parent) => parent.type === 'Atrule' && parent.name === 'font-face',
            );
            check(
              property.startsWith('--') ||
                (font ? fontProperties : reportStyleProperties).has(property.toLowerCase()),
            );
            node.property = property.startsWith('--') ? node.property : property.toLowerCase();
          }
          if (node.type === 'Function') {
            const name = decode(node.name);
            if (name === 'url' || name === 'src') {
              const value = node.children.first;
              check(
                node.children.size === 1 &&
                  (value?.type === 'String' || value?.type === 'Identifier'),
              );
              Object.assign(node, {
                type: 'Url',
                value: resource(
                  value.type === 'String' ? value.value : ident.decode(value.name),
                  base,
                ),
              });
              return walk.skip;
            }
            if (name === 'image-set' || name === '-webkit-image-set') {
              // Variables can substitute a resource String only after parsing; reject that ambiguity.
              walk(node, (child: CssNode) => {
                spend(1);
                check(child.type !== 'Function' || !['var', 'env'].includes(decode(child.name)));
              });
              node.children.forEach((child) => {
                if (child.type === 'String') child.value = resource(child.value, base);
              });
            } else check(functions.has(name));
            node.name = name;
          }
          if (node.type === 'Url') node.value = resource(node.value, base);
          if (node.type === 'Number' || node.type === 'Dimension' || node.type === 'Percentage')
            check(
              Number.isFinite(Number(node.value)) && Math.abs(Number(node.value)) <= 1000000,
              'resourceLimit',
            );
          ancestors.push(node);
        },
        leave: () => {
          ancestors.pop();
        },
      });
      return tree;
    };
    try {
      const tree = read(text, context, baseURL);
      const css = generate(tree);
      check(
        css.length <= limits.cssBytes &&
          new TextEncoder().encode(css).byteLength <= limits.cssBytes,
        'resourceLimit',
      );
      return { css, selectors, selectorWork };
    } catch (error) {
      if (error instanceof OperationError) throw error;
      throw new OperationError('unavailable', '报告样式无法安全解析。');
    }
  }
}
