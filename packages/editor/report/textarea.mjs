import { TransferrableKeys as K } from '../vendor/worker-dom/src/transfer/TransferrableKeys.js';
import { TransferrableMutationType } from '../vendor/worker-dom/src/transfer/TransferrableMutation.js';
import { NumericBoolean } from '../vendor/worker-dom/src/utils.js';
import { registerSubclass } from '../vendor/worker-dom/src/worker-thread/dom/Element.js';
import { HTMLElement } from '../vendor/worker-dom/src/worker-thread/dom/HTMLElement.js';
import { transfer } from '../vendor/worker-dom/src/worker-thread/MutationTransfer.js';
import { store } from '../vendor/worker-dom/src/worker-thread/strings.js';

/** The source DOM keeps the native textarea's default text separate from its dirty value. */
export class HTMLTextAreaElement extends HTMLElement {
  #value;
  get value() {
    return (this.#value ?? this.textContent).replace(/\r\n?/g, '\n');
  }
  set value(value) {
    this.#value = (value === null ? '' : String(value)).replace(/\r\n?/g, '\n');
    transfer(this.ownerDocument, [
      TransferrableMutationType.PROPERTIES,
      this[K.index],
      store('value'),
      NumericBoolean.FALSE,
      store(this.#value),
    ]);
  }
  get defaultValue() {
    return this.textContent;
  }
  set defaultValue(value) {
    this.textContent = String(value);
  }
  get textLength() {
    return this.value.length;
  }
  get type() {
    return 'textarea';
  }
}
registerSubclass('textarea', HTMLTextAreaElement);
