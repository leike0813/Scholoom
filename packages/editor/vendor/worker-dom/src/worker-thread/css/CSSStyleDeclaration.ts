import { mutate } from '../MutationObserver.js';
import { MutationRecordType } from '../MutationRecord.js';
import { Element } from '../dom/Element.js';
import { NamespaceURI } from '../dom/Node.js';
import { toLower } from '../../utils.js';
import { TransferrableKeys } from '../../transfer/TransferrableKeys.js';
import { TransferrableMutationType } from '../../transfer/TransferrableMutation.js';
import { store as storeString } from '../strings.js';
import { Document } from '../dom/Document.js';
import { reportRenderLimits as limits } from '@scholoom/protocol/reports';
import { type CssNode, generate, ident, lexer, parse, tokenize, tokenTypes, walk } from 'css-tree';

interface StyleProperties {
  [key: string]: { value: string; important: boolean };
}
interface StyleDeclaration {
  getPropertyValue: (key: string) => string;
  getPropertyPriority: (key: string) => string;
  removeProperty: (key: string) => string;
  setProperty: (key: string, value: string, priority?: string) => void;
  cssText: string;
  [key: string]:
    | undefined
    | string
    | number
    | StyleProperties
    | ((key: string) => string)
    | ((key: string) => void)
    | ((key: string, value: string) => void)
    | ((namespaceURI: NamespaceURI, name: string, value: string) => void);
}

const hyphenateKey = (key: string): string => toLower(key.replace(/(webkit|ms|moz|khtml)/g, '-$1').replace(/([a-zA-Z])(?=[A-Z])/g, '$1-'));
const propertyKey = (key: string): string => key.startsWith('--') ? key : toLower(key);
export const clearStyle = Symbol('clearStyle');

function checkCapacity(source: string): void {
  if (source.length > limits.cssBytes || new TextEncoder().encode(source).byteLength > limits.cssBytes)
    throw new RangeError('CSS declaration byte capacity exceeded.');
  let tokens = 0;
  let depth = 0;
  tokenize(source, (type) => {
    if (++tokens > limits.cssTokens) throw new RangeError('CSS declaration token capacity exceeded.');
    if (type === tokenTypes.Function || type === tokenTypes.LeftParenthesis || type === tokenTypes.LeftSquareBracket || type === tokenTypes.LeftCurlyBracket) {
      if (++depth > limits.cssDepth) throw new RangeError('CSS declaration depth capacity exceeded.');
    } else if (type === tokenTypes.RightParenthesis || type === tokenTypes.RightSquareBracket || type === tokenTypes.RightCurlyBracket) {
      depth = Math.max(0, depth - 1);
    }
  });
}

function declarationValue(key: string, node: CssNode): string | null {
  let valid = key !== '--';
  let variable = false;
  walk(node, (child) => {
    if (child.type === 'Raw') valid = false;
    if (child.type === 'Function' && toLower(ident.decode(child.name)) === 'var') {
      variable = true;
      const first = child.children.first;
      if (first?.type !== 'Identifier' || !ident.decode(first.name).startsWith('--') || ident.decode(first.name) === '--') valid = false;
    }
  });
  if (!valid) return null;
  if (!key.startsWith('--') && (lexer.checkPropertyName(key) || (!variable && !lexer.matchProperty(key, node).matched))) return null;
  // shortcut: variable substitution and full browser CSSOM normalization belong to a native style engine.
  return generate(node);
}

function serialize(properties: StyleProperties): string {
  return Object.keys(properties).map((key) => {
    const { value, important } = properties[key];
    return `${ident.encode(key)}: ${value}${important ? ' !important' : ''};`;
  }).join(' ');
}

export const appendKeys = (keys: Array<string>): void => {
  const aliases = keys.flatMap((key) => key.startsWith('--') ? [key] : [key, key.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase())]);
  const keysToAppend = [...new Set(aliases)].filter((key) => isNaN(key as any) && !(key in CSSStyleDeclaration.prototype));
  if (keysToAppend.length <= 0) {
    return;
  }

  const previousPrototypeLength = (CSSStyleDeclaration.prototype.length || 0) as number;
  if (previousPrototypeLength !== 0) {
    CSSStyleDeclaration.prototype.length = previousPrototypeLength + keysToAppend.length;
  } else {
    Object.defineProperty(CSSStyleDeclaration.prototype, 'length', {
      configurable: true,
      writable: true,
      value: keysToAppend.length,
    });
  }

  keysToAppend.forEach((key: string, index: number): void => {
    const hyphenatedKey = key.startsWith('--') || key.includes('-') ? propertyKey(key) : hyphenateKey(key);
    CSSStyleDeclaration.prototype[index + previousPrototypeLength] = hyphenatedKey;

    Object.defineProperties(CSSStyleDeclaration.prototype, {
      [key]: {
        get(): string {
          return this.getPropertyValue(hyphenatedKey);
        },
        set(value) {
          this.setProperty(hyphenatedKey, value);
        },
      },
    });
  });
};

export class CSSStyleDeclaration implements StyleDeclaration {
  [key: string]:
    | string
    | number
    | StyleProperties
    | ((key: string) => string)
    | ((key: string) => void)
    | ((key: string, value: string) => void)
    | ((namespaceURI: NamespaceURI, name: string, value: string) => void);
  private [TransferrableKeys.properties]: StyleProperties = Object.create(null);
  private [TransferrableKeys.storeAttribute]: (namespaceURI: NamespaceURI, name: string, value: string) => string;
  private [TransferrableKeys.target]: Element;

  constructor(target: Element) {
    this[TransferrableKeys.storeAttribute] = target[TransferrableKeys.storeAttribute].bind(target);
    this[TransferrableKeys.target] = target;
  }

  [clearStyle](): void {
    this[TransferrableKeys.properties] = Object.create(null);
  }

  /**
   * Retrieve the value for a given property key.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration/getPropertyValue
   * @param key the name of the property to retrieve the value for.
   * @return value stored for the provided key.
   */
  public getPropertyValue(key: string): string {
    return this[TransferrableKeys.properties][propertyKey(key)]?.value || '';
  }

  public getPropertyPriority(key: string): string {
    return this[TransferrableKeys.properties][propertyKey(key)]?.important ? 'important' : '';
  }

  /**
   * Remove a value for a given property key.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration/removeProperty
   * @param key the name of the property to retrieve the value for.
   * @return previously stored value for the provided key.
   */
  public removeProperty(key: string): string {
    const oldValue = this.getPropertyValue(key);

    delete this[TransferrableKeys.properties][propertyKey(key)];
    this.mutated(this.cssText);
    return oldValue;
  }

  /**
   * Stores a given value for the provided key.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration/setProperty
   * @param key modify this key
   * @param value store this value
   */
  public setProperty(key: string, value: string, priority: string = ''): void {
    key = propertyKey(String(key));
    if (priority !== '' && toLower(String(priority)) !== 'important') return;
    if (value == null || value === '') {
      this.removeProperty(key);
      return;
    }
    value = String(value);
    checkCapacity(key);
    checkCapacity(value);
    let nameValid = key !== '';
    tokenize(key, (type, start, end) => {
      if (type !== tokenTypes.Ident || start !== 0 || end !== key.length) nameValid = false;
    });
    if (!nameValid) return;
    let node: CssNode;
    try {
      node = parse(value, { context: 'value', parseCustomProperty: true });
    } catch {
      return;
    }
    const parsedValue = declarationValue(key, node);
    if (parsedValue === null || (!key.startsWith('--') && parsedValue === '')) return;
    const properties: StyleProperties = Object.assign(Object.create(null), this[TransferrableKeys.properties]);
    properties[key] = { value: parsedValue, important: priority !== '' };
    const text = serialize(properties);
    checkCapacity(text);
    this[TransferrableKeys.properties] = properties;
    this.mutated(text);
  }

  /**
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration/cssText
   * @return css text string representing known and valid style declarations.
   */
  get cssText(): string {
    return serialize(this[TransferrableKeys.properties]);
  }

  /**
   * Replace all style declarations with new values parsed from a cssText string.
   * @see https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleDeclaration/cssText
   * @param value css text string to parse and store
   */
  set cssText(value: string) {
    // value should have an "unknown" type but get/set can't have different types.
    // https://github.com/Microsoft/TypeScript/issues/2521
    const stringValue = typeof value === 'string' ? value : '';

    checkCapacity(stringValue);
    const tree = parse(stringValue, { context: 'declarationList', parseCustomProperty: true });
    const properties: StyleProperties = Object.create(null);
    if (tree.type !== 'DeclarationList') return;
    for (const node of tree.children) {
      if (node.type !== 'Declaration' || typeof node.important !== 'boolean') continue;
      const key = propertyKey(ident.decode(node.property));
      const value = declarationValue(key, node.value);
      if (value === null || (properties[key]?.important && !node.important)) continue;
      properties[key] = { value, important: node.important };
    }
    const text = serialize(properties);
    checkCapacity(text);
    this[TransferrableKeys.properties] = properties;
    this.mutated(text);
  }

  /**
   * Report CSSStyleDeclaration mutations to MutationObserver.
   * @param value value after mutation
   * @private
   * // TODO(KB): Write a test to ensure mutations are fired for CSSStyleDeclaration changes.
   */
  private mutated(value: string): void {
    const oldValue = this[TransferrableKeys.storeAttribute](this[TransferrableKeys.target].namespaceURI, 'style', value);
    mutate(
      this[TransferrableKeys.target].ownerDocument as Document,
      {
        type: MutationRecordType.ATTRIBUTES,
        target: this[TransferrableKeys.target],
        attributeName: 'style',
        value,
        oldValue,
      },
      [
        TransferrableMutationType.ATTRIBUTES,
        this[TransferrableKeys.target][TransferrableKeys.index],
        storeString('style'),
        storeString(this[TransferrableKeys.target].namespaceURI),
        value !== null ? storeString(value) + 1 : 0,
      ],
    );
  }
}
