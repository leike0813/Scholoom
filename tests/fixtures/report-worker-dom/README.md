# WorkerDOM native input counterexample

This fixed-source experiment is rejected for native input equivalence. In both
Browser and real Electron, the source executes `beforeinput.preventDefault()`
for `x` but the host's ordinary input has already changed from `A` to `Ax`;
the independent native oracle stays `A`. Releasing the real source ACK then
allows the already emitted native `input` to reach the source, producing `AX`.
The equality assertion intentionally remains red. Do not treat a failing run
as an infrastructure failure or replace it with an expected-failure annotation.

`source.ts` runs the upstream non-SERVER DOM and fixed `sample.js` in one owned
Node child. `controller.ts` transports its real mutation tuples and source ACKs
over private IPC and a loopback test listener. `receiver.ts` feeds those tuples
to upstream processors in a no-script frame inside the actual Workbench
`renderResource` tab. The host bundle does not import the source or sample;
only the child and a separate native oracle window execute the sample.
The UI/kernel/resource identities are synthetic and do not grant report rights.

Upstream is pinned to `ampproject/worker-dom@52b619eb46416c4325306de851e5a9df99697fcb`.
`upstream-manifest.json` lists the 113 exact acquired inputs, their Git blobs,
hashes and acquisition method. `vendor/LICENSE`, parser `LICENSE` and
`vendor/MODIFICATIONS.md` preserve licensing and describe the ten modified files;
`local.patch` is reversible against the fixed source closure. No dependency was
installed. TypeScript checks use upstream-style strict null/implicit-any checks
while disabling newer project flags the upstream source does not use.
The root typecheck runs this fixture as its own TypeScript project; the ordinary
tools project excludes it so the pinned upstream is checked with its own flags.
All ten modified upstream files carry Scholoom modification notices; these
license-only additions do not change the recorded first-run behavior.
Fixture-local Biome and Git attributes preserve the upstream style and patch
context bytes; first-party fixture files retain the repository checks.

With the existing Node 24, esbuild, TypeScript, Playwright, Electron, compiled
shared packages and desktop outputs available, reuse DISPLAY :99 and run:

```sh
node tests/fixtures/report-worker-dom/run.mjs /home/joshua/.cache/<new-output>
```

Use a fresh dedicated output and an unoccupied `SCHOOLOOM_UI_PORT` (default
6259). The runner uses only installed CLIs, saves exact command exits, checks
the display, records provenance before building, saves both esbuild metafiles,
checks fixture/fork types and runs one scenario per host without retries. It
reuses the preserved static UI harness at
`/home/joshua/.cache/scholoom-round13-acceptance/`, never a dev server. The
ordinary test-owned kernel is used only by the existing UI harness. The
shared fixture closes Electron by awaiting its owned process exit and stops
and removes only its isolated test kernel configuration after confirming it
stopped. No report provider or production policy is enabled.

The original execution is under
`/home/joshua/.cache/scholoom-closeout-execution-20261030/workers/research-interaction/worker-dom/`:
`attempt-1/results.json` is 0 passed, 2 failed, 0 skipped/flaky; each host has
`first-failure.json`, `evidence.json`, `source-transport.json`, screenshots,
trace and `closed.json`. The result file describes passed subchecks separately
from the failed equivalence criterion. `RESULT.md` in that cache records exact
commands, provenance timing, stopping point and lifecycle evidence.

The initial single layout, explicit-namespace MathML and ordinary uppercase
handler round-trip ran successfully before cancellation failed. Second layout,
MathML innerHTML, IME/composition races, source focus/selection requests,
replacement-node/close races, clipboard/find/AX and credit-exhaustion cases
remain unverified. This is not arbitrary HTML support, T1/T2, native IME,
screen reader, cross-platform or production OS isolation evidence.
