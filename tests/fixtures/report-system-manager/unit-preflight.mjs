import assert from 'node:assert/strict';

export const preflightProperties =
  'Id,LoadState,ActiveState,SubState,FragmentPath,SourcePath,DropInPaths,Transient,ControlGroup,InvocationID,Job,NeedDaemonReload';

export function unitProperties(text) {
  return Object.fromEntries(
    text
      .trim()
      .split('\n')
      .map((line) => {
        const at = line.indexOf('=');
        assert.ok(at > 0, 'Incomplete systemd unit observation');
        return [line.slice(0, at), line.slice(at + 1)];
      }),
  );
}

export function assertUnitUnoccupied(state, name, retainedSlice) {
  assert.equal(state.Id, name);
  // PID1 synthesizes unloaded slice names as loaded units, without a fragment or execution.
  assert.ok(
    state.LoadState === 'not-found' || (name === retainedSlice && state.LoadState === 'loaded'),
    `${name}: unexpected LoadState ${state.LoadState}`,
  );
  for (const [key, value] of Object.entries({
    ActiveState: 'inactive',
    SubState: 'dead',
    FragmentPath: '',
    SourcePath: '',
    DropInPaths: '',
    Transient: 'no',
    ControlGroup: '',
    InvocationID: '',
    Job: '',
    NeedDaemonReload: 'no',
  }))
    assert.equal(state[key], value, `${name}: existing unit ${key}`);
}
