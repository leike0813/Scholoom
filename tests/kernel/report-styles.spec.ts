import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import type * as CssTree from '../../packages/editor/node_modules/@types/css-tree/index.js';
import { type ReportStyleResolver, ReportStyles } from '../../packages/editor/src/report-styles.js';
import { OperationError } from '../../packages/protocol/dist/core.js';

const { generate, parse, walk } = createRequire(
  new URL('../../packages/editor/package.json', import.meta.url),
)('css-tree') as typeof CssTree;
type Context = 'stylesheet' | 'declarationList';
const baseURL = 'https://approved.invalid/reports/main.html';
const icon = 'blob:approved-icon';
const font = 'blob:approved-font';
const idle = (_units: number) => {};

// Frozen assets and authorization are pure substitutes; no CSS is executed or fetched.
function fixture(styles: Record<string, ReturnType<ReportStyleResolver>> = {}) {
  const calls: Parameters<ReportStyleResolver>[] = [];
  const renders = new Map([
    ['https://approved.invalid/reports/icon.png', icon],
    ['https://approved.invalid/reports/icon', icon],
    ['https://approved.invalid/reports/font.woff2', font],
    ['https://approved.invalid/frozen/images/icon.png', icon],
  ]);
  const resolve: ReportStyleResolver = (specifier, base, kind) => {
    calls.push([specifier, base, kind]);
    const address = new URL(specifier, base).href;
    const asset = kind === 'style' ? styles[address] : undefined;
    if (asset) return asset;
    const url = kind === 'render' ? renders.get(address) : undefined;
    if (url) return { url };
    throw new OperationError('unavailable', 'Unapproved fixture resource');
  };
  return { compiler: new ReportStyles(resolve), calls };
}

function nodes(css: string, context: Context = 'stylesheet') {
  const result: CssTree.CssNode[] = [];
  walk(
    parse(css, {
      context,
      parseCustomProperty: true,
      onParseError(error) {
        throw error;
      },
    }),
    (node) => {
      expect(node.type).not.toBe('Raw');
      result.push(node);
    },
  );
  return result;
}

function declarations(css: string, context: Context = 'stylesheet') {
  return Object.fromEntries(
    nodes(css, context)
      .filter((node) => node.type === 'Declaration')
      .map((node) => [node.property, generate(node.value)]),
  );
}

test('ordinary colors, grid, variables and supported conditional rules retain semantics', () => {
  const { compiler, calls } = fixture();
  for (const context of ['stylesheet', 'declarationList'] as const) {
    const body = String.raw`c\6flor:rgb(12,34,56);display:grid;grid-template-columns:repeat(2,minmax(0,1fr));--Tone:rebeccapurple;border-color:var(--Tone);gap:clamp(1px,2vw,20px)`;
    const output = compiler.compile(
      context === 'stylesheet' ? `.report,.chart{${body}}` : body,
      context,
      baseURL,
      idle,
    );
    expect(declarations(output.css, context)).toMatchObject({
      color: 'rgb(12,34,56)',
      display: 'grid',
      'grid-template-columns': 'repeat(2,minmax(0,1fr))',
      '--Tone': 'rebeccapurple',
      'border-color': 'var(--Tone)',
    });
    expect(output.selectors).toBe(context === 'stylesheet' ? 2 : 0);
    expect(output.selectorWork).toBeGreaterThanOrEqual(output.selectors);
  }
  for (const rule of [
    '@media (min-width:1px)',
    '@supports (display:grid)',
    '@container report (min-width:1px)',
    '@layer report',
    String.raw`@\6c ayer report`,
  ]) {
    const output = compiler.compile(`${rule}{.report{color:blue}}`, 'stylesheet', baseURL, idle);
    expect(declarations(output.css)).toMatchObject({ color: 'blue' });
    expect(output.selectors).toBe(1);
  }
  expect(calls).toEqual([]);
});

test('ordinary and decoded resource addresses resolve against the explicit base', () => {
  for (const [value, specifier] of [
    ['url(icon.png)', 'icon.png'],
    ['url("icon.png")', 'icon.png'],
    [String.raw`url("\69 con.png")`, 'icon.png'],
    [
      String.raw`url(\68 ttps\3a //approved.invalid/reports/icon.png)`,
      'https://approved.invalid/reports/icon.png',
    ],
    [String.raw`u\72l("icon.png")`, 'icon.png'],
    [String.raw`u\72l(\69 con)`, 'icon'],
    ['src("icon.png")', 'icon.png'],
    [String.raw`s\72 c("icon.png")`, 'icon.png'],
  ] as const) {
    const { compiler, calls } = fixture();
    const output = compiler.compile(
      `--Image:${value};background-image:var(--Image,url(icon.png))`,
      'declarationList',
      baseURL,
      idle,
    );
    const urls = nodes(output.css, 'declarationList')
      .filter((node) => node.type === 'Url')
      .map((node) => node.value);
    expect(urls, value).toEqual([icon, icon]);
    expect(calls).toEqual([
      [specifier, baseURL, 'render'],
      ['icon.png', baseURL, 'render'],
    ]);
  }
  const { compiler } = fixture();
  assert.throws(
    () =>
      compiler.compile(
        'background:url(https://outside.invalid/icon.png)',
        'declarationList',
        baseURL,
        idle,
      ),
    { code: 'unavailable' },
  );
  const nonBlob = new ReportStyles(() => ({ url: 'https://approved.invalid/icon.png' }));
  assert.throws(
    () => nonBlob.compile('background:url(icon.png)', 'declarationList', baseURL, idle),
    { code: 'unavailable' },
  );
});

test('image-set rewrites resource Strings while MIME and ordinary Strings stay unchanged', () => {
  for (const name of ['image-set', '-webkit-image-set', String.raw`image-\73 et`]) {
    const { compiler, calls } = fixture();
    const output = compiler.compile(
      `content:"icon.png";--Label:"icon.png";background-image:${name}("icon.png" type("image/png") 1x,url(icon.png) 2x)`,
      'declarationList',
      baseURL,
      idle,
    );
    const parsed = nodes(output.css, 'declarationList');
    expect(parsed.filter((node) => node.type === 'String').map((node) => node.value)).toEqual([
      'icon.png',
      'icon.png',
      icon,
      'image/png',
    ]);
    expect(parsed.filter((node) => node.type === 'Url').map((node) => node.value)).toEqual([icon]);
    expect(calls).toEqual([
      ['icon.png', baseURL, 'render'],
      ['icon.png', baseURL, 'render'],
    ]);
  }
});

test('image-set rejects ambiguous variable resource substitution including env fallbacks', () => {
  for (const value of [
    'var(--Image)',
    'var(--Missing,"unapproved.png")',
    String.raw`v\61r(--Image)`,
    'env(--missing,"unapproved.png")',
  ]) {
    const { compiler } = fixture();
    assert.throws(
      () =>
        compiler.compile(
          `--Image:"unapproved.png";background-image:image-set(${value} 1x)`,
          'declarationList',
          baseURL,
          idle,
        ),
      { code: 'unavailable' },
      value,
    );
  }
});

test('imports retain canonical CSS bases and reject cycles, qualifiers and excessive imports', () => {
  const theme = 'https://approved.invalid/frozen/css/theme.css';
  const nested = 'https://approved.invalid/frozen/css/nested/contrast.css';
  for (const prelude of ['"theme.css"', 'url(theme.css)']) {
    const { compiler, calls } = fixture({
      'https://approved.invalid/reports/theme.css': {
        url: theme,
        text: '@import "nested/contrast.css";.theme{background:url("../images/icon.png")}',
      },
      [nested]: { url: nested, text: '.contrast{color:blue}' },
    });
    const output = compiler.compile(`@import ${prelude};`, 'stylesheet', baseURL, idle);
    expect(declarations(output.css)).toMatchObject({ color: 'blue' });
    expect(
      nodes(output.css)
        .filter((node) => node.type === 'Url')
        .map((node) => node.value),
    ).toEqual([icon]);
    expect(nodes(output.css).filter((node) => node.type === 'Atrule')).toEqual([]);
    expect(output.selectors).toBe(2);
    expect(calls).toHaveLength(3);
    expect(calls).toEqual(
      expect.arrayContaining([
        ['theme.css', baseURL, 'style'],
        ['nested/contrast.css', theme, 'style'],
        ['../images/icon.png', theme, 'render'],
      ]),
    );
  }
  const { compiler } = fixture({
    'https://approved.invalid/reports/theme.css': { url: theme, text: '@import "theme.css";' },
    [theme]: { url: theme, text: '@import "theme.css";' },
    'https://approved.invalid/reports/empty.css': { url: theme, text: '' },
  });
  for (const css of [
    '@import "theme.css";',
    '@import "empty.css" screen;',
    '@import "empty.css" layer(report);',
    '@import "empty.css" supports(display:grid);',
    '@import "empty.css" "other.css";',
  ])
    assert.throws(() => compiler.compile(css, 'stylesheet', baseURL, idle), {
      code: 'unavailable',
    });
  assert.throws(
    () => compiler.compile('@import "empty.css";'.repeat(9), 'stylesheet', baseURL, idle),
    { code: 'resourceLimit' },
  );
});

test('font-face retains approved URLs and format Strings but rejects local fonts', () => {
  for (const property of ['src', String.raw`s\72 c`]) {
    const { compiler, calls } = fixture();
    const output = compiler.compile(
      `@font-face{font-family:"Report";${property}:url(font.woff2) format("woff2");font-display:swap}`,
      'stylesheet',
      baseURL,
      idle,
    );
    const parsed = nodes(output.css);
    expect(parsed.filter((node) => node.type === 'Url').map((node) => node.value)).toEqual([font]);
    expect(parsed.filter((node) => node.type === 'String').map((node) => node.value)).toEqual([
      'Report',
      'woff2',
    ]);
    expect(calls).toEqual([['font.woff2', baseURL, 'render']]);
  }
  for (const value of ['local("Report")', String.raw`l\6f cal("Report"),url(font.woff2)`]) {
    const { compiler } = fixture();
    assert.throws(
      () =>
        compiler.compile(
          `@font-face{font-family:Report;src:${value}}`,
          'stylesheet',
          baseURL,
          idle,
        ),
      { code: 'unavailable' },
    );
  }
});

test('inline declarations cannot carry nested rules or at-rules', () => {
  const { compiler } = fixture();
  for (const css of [
    '.report{color:red}',
    '& .report{color:red}',
    '@media (min-width:1px){color:red}',
    '@import "theme.css";',
    '@font-face{font-family:Report;src:url(font.woff2)}',
  ])
    assert.throws(() => compiler.compile(css, 'declarationList', baseURL, idle), {
      code: 'unavailable',
    });
});

test('Raw anywhere, unknown names, animations and has selectors fail with structured codes', () => {
  const { compiler } = fixture();
  for (const css of [
    '.report{color:??}',
    'a:custom(foo){color:red}',
    '.report{--tokens:{a:b}}',
    '.report{color:mystery(1)}',
    String.raw`.report{color:m\79stery(1)}`,
    '.report{unknown-property:red}',
    '.report{animation:spin 1s}',
    String.raw`.report{\61nimation-name:spin}`,
    '@unknown report{.report{color:red}}',
    String.raw`@\6d edia (min-width:1px){.report{color:blue}}`,
    'a:has(img){color:red}',
    String.raw`a:\68 as(img){color:red}`,
    String.raw`.report{background:u\72l(icon.png)}`,
  ])
    assert.throws(
      () => compiler.compile(css, 'stylesheet', baseURL, idle),
      { code: 'unavailable' },
      css,
    );
});

test('UTF8, token, depth, selector, numeric, String and shared frame budgets are bounded', () => {
  const { compiler } = fixture();
  const cases = [
    ['UTF8 bytes', `/*${'中'.repeat(22000)}*/`],
    ['tokens', `.report{${'color:red;'.repeat(2200)}}`],
    ['depth', `.report{width:${'calc('.repeat(65)}1px${')'.repeat(65)}}`],
    ['selectors', `${Array.from({ length: 257 }, (_, i) => `.s${i}`).join(',')}{color:red}`],
    ['numeric magnitude', '.report{width:-1000001px}'],
    ['String length', `.report{content:"${'a'.repeat(513)}"}`],
  ] as const;
  for (const [label, css] of cases) {
    assert.throws(
      () => compiler.compile(css, 'stylesheet', baseURL, idle),
      { code: 'resourceLimit' },
      label,
    );
  }
  expect(cases[0][1].length).toBeLessThan(65536);
  expect(new TextEncoder().encode(cases[0][1]).byteLength).toBeGreaterThan(65536);
  for (const value of [-1000000, 1000000])
    expect(
      declarations(
        compiler.compile(`width:${value}px`, 'declarationList', baseURL, idle).css,
        'declarationList',
      ),
    ).toMatchObject({ width: `${value}px` });

  let spent = 0;
  const spend = (units: number) => {
    expect(Number.isInteger(units) && units > 0).toBe(true);
    spent += units;
    if (spent > 500) throw new OperationError('resourceLimit', 'Frame budget exhausted');
  };
  compiler.compile('.report{color:red}', 'stylesheet', baseURL, spend);
  expect(spent).toBeGreaterThan(0);
  assert.throws(
    () => {
      for (let i = 0; i < 501; i++)
        compiler.compile('.report{color:red}', 'stylesheet', baseURL, spend);
    },
    { code: 'resourceLimit' },
  );
});
