# Fixed experimental WorkerDOM fork

Upstream: https://github.com/ampproject/worker-dom/tree/52b619eb46416c4325306de851e5a9df99697fcb

Copyright 2018, Google Inc. The original Apache-2.0 text is in `LICENSE`.
The included HTML parser is Copyright 2019 Xiaoyi Shi; its original MIT text
is in `src/third_party/html-parser/LICENSE`. Upstream source comments are retained.
The fixed repository tree contains no NOTICE path. This is a test-only source
closure, not the npm release or an installed runtime dependency.

Scholoom's 2026-10-30 local modifications, recorded in `../local.patch`:

- `worker-thread/index.ts`: inject the owned IPC transport before creating the
  document; supply no real Worker globals, canvas objects or browser storage.
- `worker-thread/{nodes,strings,MutationTransfer}.ts`: check finite synthetic
  node, string and pending U16 mutation limits before growth/encoding.
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
remain in place; the updated diff is recorded in `../local.patch`.

`worker-thread/strings.ts` counts UTF-8 bytes from UTF-16 code units without
allocating an encoded copy before its existing admission checks. The cumulative
1024-entry/65536-byte limits, deduplication and consume behavior remain unchanged.

The original native beforeinput cancellation counterexample remains unchanged.
The separate asynchronous fixture supplies selection/focus and composition
handling; this parser change does not establish general DOM compatibility.
The inherited canvas/storage processors are rejected by the fixture's selected
mutation decoder before execution. Their presence in the source closure does
not make them supported.

The fork is unsuitable for production. These synthetic bounds, trusted fixed
inputs and ordinary Node child are not a hostile-code or OS isolation boundary.
