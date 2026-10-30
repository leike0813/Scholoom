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

No MathML innerHTML parser extension, selection/focus request protocol,
composition transaction protection or general DOM compatibility was added:
the first native beforeinput cancellation counterexample stopped the probe.
The inherited canvas/storage processors are rejected by the fixture's selected
mutation decoder before execution. Their presence in the source closure does
not make them supported.

The fork is unsuitable for production. These synthetic bounds, trusted fixed
inputs and ordinary Node child are not a hostile-code or OS isolation boundary.
