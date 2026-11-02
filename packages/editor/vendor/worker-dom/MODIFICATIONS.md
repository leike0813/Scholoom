# Fixed WorkerDOM source closure

Upstream: https://github.com/ampproject/worker-dom/tree/52b619eb46416c4325306de851e5a9df99697fcb

Copyright 2018, Google Inc. The original Apache-2.0 text is in `LICENSE`.
The included HTML parser is Copyright 2019 Xiaoyi Shi; its original MIT text
is in `src/third_party/html-parser/LICENSE`. Upstream source comments are retained.
The fixed repository tree contains no NOTICE path. This shared source closure
is used through Scholoom's controlled adapters; it is not the npm release or
an installed runtime dependency.

Scholoom's 2026-10-30 local modifications, recorded in `local.patch`:

- `worker-thread/index.ts`: inject the owned IPC transport before creating the
  document; supply no real Worker globals, canvas objects or browser storage.
- `worker-thread/{nodes,strings}.ts`: check the shared `reportRenderLimits` from
  `@scholoom/protocol/reports` before registry growth: 16384 nodes (including
  Document/body identities), 16384 strings and 2097152 UTF-8 string bytes.
  Both index spaces remain within U16. `worker-thread/MutationTransfer.ts`
  retains the synthetic pending U16 mutation limit.
- `transfer/{TransferrableKeys,TransferrableEvent}.ts` and `worker-thread/Event.ts`:
  carry the fixed input sample's data, inputType and isComposing through the
  upstream event mechanism.
- `main-thread/nodes.ts`: create nodes in the bound frame's ownerDocument,
  bound the table and clear it on close.
- `main-thread/commands/event-subscription.ts`: keep root listeners inside the
  frame, retain removers, forward input fields and decode add/remove tuple
  lengths correctly. Attribute MutationObserver synchronization is absent
  from this fixed probe: the sample only uses explicit native events. The
  upstream default input listener still emits redundant SYNC messages; every
  message is kept in order, without merging input events.
- `main-thread/serialize.ts`: express the existing attribute mapping as a
  typed Array.from compatible with the installed TypeScript.

Scholoom's 2026-10-31 continuation modifies `third_party/html-parser/html-parser.ts`
to select HTML, SVG and MathML namespaces from each fragment parent and its
foreign-content integration points. The synthetic parser wrapper preserves the
original fragment context. HTML and MathML attribute names are normalized during
parsing, including the MathML definitionURL adjustment, so uppercase ENCODING
attributes select the same integration point. Original parser MIT license and source attribution
remain in place; the updated diff is recorded in `local.patch`.

The parser also retains boolean and empty quoted attributes and decodes entity
references in attribute values. SCRIPT, STYLE and NOSCRIPT preserve raw text;
TEXTAREA and TITLE consume RCDATA up to the closing tag and decode entities.
PRE uses ordinary HTML parsing so nested CODE remains an element. Raw-text and
RCDATA closing tags are matched without case sensitivity and accept trailing
whitespace. The asynchronous fixture compares these bounded representatives
and selected attribute values with an independent Chromium DOM; this does not
establish complete HTML parsing compatibility.

`worker-thread/dom/HTMLInputElement.ts` reads the checked attribute until an
explicit checked assignment, including a same-value assignment, makes the
property dirty. Property mutations use the effective boolean value.
`HTMLOptionElement.ts` separates selected from its defaultSelected attribute,
removes the property-backed selected attribute mapping, and preserves an empty
value attribute. `HTMLSelectElement.ts` reports the single/multiple type names
and uses selectedIndex when selecting the first option, preserving an empty
placeholder value. The fragment oracle compares selected properties and bounded
dirty-property changes with Chromium; radio groups, form reset and general
form-control compatibility are outside these local changes.

`worker-thread/strings.ts` counts UTF-8 bytes from UTF-16 code units without
allocating an encoded copy before admission. Node and string limits come from
the shared rendering contract; deduplication, cumulative capacity across consume
and the existing budget errors are preserved.

The original native beforeinput cancellation counterexample remains unchanged.
The separate asynchronous fixture supplies selection/focus and composition
handling; this parser change does not establish general DOM compatibility.
The inherited canvas/storage processors are rejected by the fixture's selected
mutation decoder before execution. Their presence in the source closure does
not make them supported.

The raw fork does not establish safe handling of arbitrary DOM. These synthetic
bounds, trusted fixed inputs and ordinary Node child are not a hostile-code or
OS isolation boundary; shared use requires the controlled adapters.

The CSS declaration adapter uses the fixed css-tree 3.2.1 dependency for token
preflight, parsing and serialization instead of splitting on colons or
semicolons. It retains quoted values, custom-property case and priorities in a
bounded table, replaces cssText once and reports one mutation. Dashed and camel
property registration share this implementation. Element's style attribute
uses the same declaration object; removing the attribute clears that object
without an extra style mutation. Attribute transfers name the actual namespace
through the shared string table. Native Chromium comparisons cover bounded
representatives, not shorthand expansion or full CSSOM normalization. The
production source bundle uses the official self-contained css-tree ESM build;
css-tree MIT, mdn-data CC0 and source-map-js BSD licenses accompany it.

The 2026-11-01 event adapter uses stable, monotonic U16 subscription handles
across event types on each node. Removal preserves the original handle;
duplicate callback/capture pairs are ignored. Dispatch follows capture, target
and bubble phases in registration order, snapshots each invocation, removes
once listeners before calling them, and handles propagation independently of
cancelability. Passive and noncancelable events cannot be canceled. Event
properties have ordinary defaults and dispatch cleanup; a received native trust
marker is consumed once, so redispatch is synthetic. `HTMLElement.on*` retains
its listener slot on replacement and applies return-false cancellation only to
the property handler. An independent Chromium oracle covers these bounded
semantics. Listener exceptions, AbortSignal, Shadow DOM and object handlers are
not covered by that oracle; this is not full Web event compatibility.
