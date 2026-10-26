import type { KernelClient } from '@scholoom/client';
import type { ProgramEnvironment, ProgramRun } from '@scholoom/protocol/programs';
import { useId } from 'react';
import { draftKey } from '../drafts';
import type { ResourceTarget } from '../resource-controller';
import { type ProgramDraft, programStateLabel, useProgramController } from './program-controller';

export interface ProgramRunsTabProps {
  client: KernelClient;
  projectId: string;
  directory: string;
  enabled: boolean;
  canExecute?: boolean;
  onOpenResource?: ((target: ResourceTarget) => void | Promise<void>) | undefined;
}

const availabilityLabel: Record<ProgramEnvironment['availability'], string> = {
  unavailable: '不可用',
  needsAuthorization: '待授权',
  ready: '可用',
  preparing: '准备中',
  cancelling: '取消中',
  cancelled: '已取消',
  failed: '失败',
  interrupted: '已中断',
  unknown: '状态未知',
};
const phaseLabel: Record<ProgramRun['phase'], string> = {
  accepted: '已受理',
  environment: '检查环境',
  admission: '等待执行名额',
  starting: '启动程序',
  executing: '执行程序',
  stopping: '停止程序',
  inspecting: '核查输出',
};
const presenceLabel = {
  present: '存在',
  missing: '缺失',
  changed: '已变化',
  unreadable: '不可读',
  unknown: '未知',
};
const stopLabel = { pending: '待确认', confirmed: '已确认', unknown: '未知' };
const kindLabel = {
  program: '程序',
  environmentCheck: '环境检查',
  environmentPreparation: '环境准备',
};

export function ProgramRunsTab(props: ProgramRunsTabProps) {
  return (
    <ProgramRunsPanel key={draftKey(props.directory, props.projectId, 'programs')} {...props} />
  );
}

function ProgramRunsPanel(props: ProgramRunsTabProps) {
  const formId = useId();
  const controller = useProgramController(props);
  const { draft, edit, busy, readable, error, environments, runs, run, logs, plan, selectedId } =
    controller;
  const disabled = !readable || !!busy;
  const selectedRun = run?.value;
  const currentPlan = plan?.value;
  const planMatchesEnvironment = currentPlan?.environmentId === draft.environmentId;
  const environmentList = environments?.value?.environments ?? [];
  const field = (name: keyof ProgramDraft, label: string, multiline = false) => (
    <label htmlFor={`${formId}-${name}`}>
      <span>{label}</span>
      {multiline ? (
        <textarea
          id={`${formId}-${name}`}
          value={draft[name]}
          onChange={(event) => edit(name, event.target.value)}
          rows={3}
        />
      ) : (
        <input
          id={`${formId}-${name}`}
          value={draft[name]}
          onChange={(event) => edit(name, event.target.value)}
        />
      )}
    </label>
  );
  const errors = [
    ['操作', error],
    ['运行列表', runs?.error],
    ['环境列表', environments?.error],
    ['运行详情', run?.error],
    ['运行日志', logs?.error],
    ['准备计划', plan?.error],
  ].filter((entry) => entry[1]);

  if (props.projectId === 'application')
    return <p className="empty-hint">请先选择一个项目，再运行项目代码。</p>;

  return (
    <section className="program-runs-tab" aria-label="项目程序运行">
      <div className="program-runs-toolbar">
        <h2>程序运行</h2>
        <button type="button" className="btn" disabled={!readable} onClick={controller.refresh}>
          刷新运行状态
        </button>
        {busy ? <span role="status">{busy}…</span> : null}
        {!readable ? <span role="status">内核未连接，配置草稿已保留。</span> : null}
      </div>
      {errors.map(([source, message]) => (
        <p key={source} className="business-error" role="alert">
          {source}：{message}
        </p>
      ))}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void controller.start();
        }}
      >
        <fieldset className="project-controls program-runs-form">
          <legend>运行配置</legend>
          {field('entry', '项目代码路径')}
          <label>
            <span>运行环境</span>
            <select
              value={draft.environmentId}
              onChange={(event) => edit('environmentId', event.target.value)}
            >
              <option value="">选择环境</option>
              {draft.environmentId &&
              !environmentList.some((item) => item.environmentId === draft.environmentId) ? (
                <option value={draft.environmentId}>{draft.environmentId}（当前页未列出）</option>
              ) : null}
              {environmentList.map((environment) => (
                <option key={environment.environmentId} value={environment.environmentId}>
                  {environment.kind} · {environment.environmentId} ·{' '}
                  {availabilityLabel[environment.availability]}
                  {environment.version ? ` · ${environment.version}` : ''}
                </option>
              ))}
            </select>
          </label>
          <nav className="program-runs-toolbar" aria-label="环境分页">
            <button
              type="button"
              className="btn"
              disabled={disabled || controller.environmentPage === 1}
              onClick={controller.previousEnvironments}
            >
              上一页环境
            </button>
            <span>第 {controller.environmentPage} 页</span>
            <button
              type="button"
              className="btn"
              disabled={disabled || !environments?.value?.before}
              onClick={controller.nextEnvironments}
            >
              下一页环境
            </button>
          </nav>
          {field('args', '参数（JSON 字符串数组）', true)}
          {field('cwd', '工作目录（项目相对路径）')}
          {field('outputs', '声明输出（每行一条项目路径；留空表示无声明输出）', true)}
          <details>
            <summary>覆盖与期限</summary>
            {field('overwrite', '明确允许覆盖的输出路径（每行一条）', true)}
            {field('timeout', '程序期限（毫秒；留空表示无总期限）')}
            <label>
              <span>执行归属</span>
              <select
                value={draft.lifetime}
                onChange={(event) => edit('lifetime', event.target.value)}
              >
                <option value="background">后台运行（关闭界面后继续）</option>
                <option value="execution">随发起执行结束（需有关联执行）</option>
              </select>
            </label>
          </details>
          <button
            type="submit"
            className="btn"
            disabled={disabled || props.canExecute === false || !!controller.pending}
            aria-busy={busy === '启动程序'}
          >
            运行项目代码
          </button>
          <p>只运行你信任的项目代码。执行完成仍需核对实际输出。</p>
        </fieldset>
      </form>

      {controller.pending ? (
        <div className="program-runs-pending" role="status">
          <p>有待核对的启动请求：{controller.pending.operationId}。请先确认受理结果。</p>
          <details>
            <summary>查看原请求</summary>
            <pre>{JSON.stringify(controller.pending, null, 2)}</pre>
          </details>
          <div className="program-runs-toolbar">
            <button
              type="button"
              className="btn"
              disabled={disabled}
              onClick={() => void controller.queryStart()}
            >
              查询受理结果
            </button>
            <button
              type="button"
              className="btn"
              disabled={disabled}
              onClick={() => void controller.retryStart()}
            >
              按原请求补交
            </button>
          </div>
        </div>
      ) : null}

      <details className="program-runs-environments">
        <summary>环境登记与准备</summary>
        {environmentList.length === 0 ? <p className="empty-hint">当前页没有已登记环境。</p> : null}
        <ul className="program-runs-list" aria-label="已登记环境">
          {environmentList.map((environment) => (
            <li key={environment.environmentId}>
              <strong>
                {environment.kind} · {environment.environmentId}
              </strong>
              <span>
                {' '}
                · {availabilityLabel[environment.availability]}
                {environment.version ? ` · ${environment.version}` : ''}
              </span>
              {environment.diagnostic ? (
                <p role="status">
                  {environment.diagnostic.code}：{environment.diagnostic.message}
                </p>
              ) : null}
              {environment.programRunId ? (
                <button
                  type="button"
                  className="btn"
                  onClick={() => controller.selectRun(environment.programRunId ?? '')}
                >
                  查看环境运行
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void controller.registerEnvironment();
          }}
        >
          <fieldset className="project-controls program-runs-form">
            <legend>登记已有环境</legend>
            <label>
              <span>环境种类</span>
              <select
                value={draft.registrationKind}
                onChange={(event) => edit('registrationKind', event.target.value)}
              >
                <option value="python">已有 Python</option>
                <option value="conda">已有 Conda 解释器</option>
                <option value="uv">uv 受管 Python</option>
              </select>
            </label>
            {field('interpreterPath', '本机 Python 解释器位置')}
            {draft.registrationKind === 'uv' ? field('uvPath', '本机 uv 位置') : null}
            <button type="submit" className="btn" disabled={disabled || props.canExecute === false}>
              登记并核查环境
            </button>
          </fieldset>
        </form>
        <div className="program-runs-toolbar">
          <button
            type="button"
            className="btn"
            disabled={disabled || props.canExecute === false || !draft.environmentId}
            onClick={() => void controller.checkPlan()}
          >
            检查所选环境准备计划
          </button>
        </div>
        {currentPlan ? (
          <section className="program-runs-plan" aria-label="环境准备计划">
            <h3>准备计划 · {currentPlan.planId}</h3>
            {!planMatchesEnvironment ? (
              <p role="status">此计划属于其他环境，请选择对应环境或重新检查所选环境。</p>
            ) : null}
            <p role="status">
              {
                {
                  pending: '检查中',
                  ready: '计划已就绪',
                  failed: '检查失败',
                  unknown: '检查结果未知',
                }[currentPlan.state]
              }
            </p>
            <dl>
              <dt>环境</dt>
              <dd>{currentPlan.environmentId}</dd>
              <dt>解释器</dt>
              <dd>
                {currentPlan.interpreter?.executableId ?? '尚未确认'}{' '}
                {currentPlan.interpreter?.version ?? ''}
              </dd>
              <dt>准备目标</dt>
              <dd>{currentPlan.targetId ?? '尚未确认'}</dd>
              <dt>联网范围</dt>
              <dd>
                {currentPlan.network?.length
                  ? currentPlan.network.join('、')
                  : currentPlan.network
                    ? '无'
                    : '尚未确认'}
              </dd>
              <dt>安装依赖</dt>
              <dd>
                {currentPlan.installation === undefined
                  ? '尚未确认'
                  : currentPlan.installation
                    ? '需要'
                    : '不需要'}
              </dd>
              <dt>执行构建</dt>
              <dd>
                {currentPlan.build === undefined
                  ? '尚未确认'
                  : currentPlan.build
                    ? '需要'
                    : '不需要'}
              </dd>
              <dt>计划授权</dt>
              <dd>{currentPlan.authorizationId ? '已授权' : '尚未授权'}</dd>
            </dl>
            <details>
              <summary>声明依据、依赖与实际动作</summary>
              <pre>
                {JSON.stringify(
                  {
                    declarations: currentPlan.declarations,
                    dependencies: currentPlan.dependencies,
                    actions: currentPlan.actions,
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
            {currentPlan.error ? (
              <p className="business-error" role="alert">
                {currentPlan.error.code}：{currentPlan.error.message}
              </p>
            ) : null}
            <div className="program-runs-toolbar">
              <button
                type="button"
                className="btn"
                onClick={() => controller.selectRun(currentPlan.programRunId)}
              >
                查看计划检查运行
              </button>
              <button
                type="button"
                className="btn"
                disabled={
                  disabled ||
                  !planMatchesEnvironment ||
                  currentPlan.state !== 'ready' ||
                  !!currentPlan.authorizationId
                }
                onClick={() => void controller.authorizePlan()}
              >
                授权此计划
              </button>
              <button
                type="button"
                className="btn"
                disabled={
                  disabled ||
                  !planMatchesEnvironment ||
                  currentPlan.state !== 'ready' ||
                  !currentPlan.authorizationId ||
                  props.canExecute === false
                }
                onClick={() => void controller.prepareEnvironment(controller.canRetryPreparation)}
              >
                {controller.canRetryPreparation ? '重新准备环境' : '准备环境'}
              </button>
            </div>
          </section>
        ) : null}
      </details>

      <section aria-label="项目运行列表">
        <div className="program-runs-toolbar">
          <h3>项目运行</h3>
          <button
            type="button"
            className="btn"
            disabled={disabled || controller.runPage === 1}
            onClick={controller.previousRuns}
          >
            上一页运行
          </button>
          <span>第 {controller.runPage} 页</span>
          <button
            type="button"
            className="btn"
            disabled={disabled || !runs?.value?.before}
            onClick={controller.nextRuns}
          >
            下一页运行
          </button>
        </div>
        {!runs?.value && readable && !runs?.error ? <p role="status">正在读取运行列表…</p> : null}
        {runs?.value?.runs.length === 0 ? <p className="empty-hint">此页没有运行记录。</p> : null}
        <ul className="program-runs-list">
          {(runs?.value?.runs ?? []).map((item) => (
            <li key={item.programRunId}>
              <button
                type="button"
                className="btn program-runs-row"
                aria-pressed={selectedId === item.programRunId}
                onClick={() => controller.selectRun(item.programRunId)}
              >
                <span>
                  {kindLabel[item.kind]} · {item.programRunId}
                </span>
                <span>
                  {programStateLabel[item.state]} · {item.createdAt}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selectedId ? (
        <section aria-label="所选运行详情">
          <h3>运行 · {selectedId}</h3>
          {!selectedRun && readable && !run?.error ? <p role="status">正在读取运行详情…</p> : null}
          {selectedRun ? (
            <>
              <dl>
                <dt>运行状态</dt>
                <dd>{programStateLabel[selectedRun.state]}</dd>
                <dt>当前阶段</dt>
                <dd>{phaseLabel[selectedRun.phase]}</dd>
                <dt>停止确认</dt>
                <dd>{stopLabel[selectedRun.stop]}</dd>
                {selectedRun.backgroundOwner ? (
                  <>
                    <dt>后台移交</dt>
                    <dd>
                      {
                        {
                          authorized: '授权已保存，接管待核查',
                          active: '已移交',
                          failed: '接管失败，仍随原执行',
                        }[selectedRun.backgroundOwner.state]
                      }{' '}
                      · {selectedRun.backgroundOwner.at}
                      {selectedRun.backgroundOwner.error ? (
                        <span role="status">
                          {' '}
                          · {selectedRun.backgroundOwner.error.code}：
                          {selectedRun.backgroundOwner.error.message}
                        </span>
                      ) : null}
                    </dd>
                  </>
                ) : null}
                <dt>解释器版本</dt>
                <dd>{selectedRun.command?.version ?? '未确认'}</dd>
                <dt>程序退出</dt>
                <dd>{selectedRun.exit ? JSON.stringify(selectedRun.exit) : '尚无退出记录'}</dd>
                <dt>输出核查</dt>
                <dd>
                  {selectedRun.outputAssessment
                    ? {
                        unassessed: '未核查',
                        partial: '部分核查',
                        observed: '已观察，完整性未验证',
                      }[selectedRun.outputAssessment]
                    : '未核查'}
                </dd>
              </dl>
              {selectedRun.error ? (
                <p className="business-error" role="alert">
                  {selectedRun.error.code}：{selectedRun.error.message}
                </p>
              ) : null}
              <details>
                <summary>实际命令与声明输入依据</summary>
                <pre>
                  {JSON.stringify(
                    {
                      command: selectedRun.command,
                      code: selectedRun.code,
                      inputs: selectedRun.inputs,
                      dependencyCoverage: selectedRun.dependencyCoverage,
                      request: selectedRun.request,
                    },
                    null,
                    2,
                  )}
                </pre>
              </details>
              <div className="program-runs-toolbar">
                {controller.canHandoff ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={disabled}
                    onClick={() => void controller.handoff()}
                  >
                    移交后台
                  </button>
                ) : null}
                <button
                  type="button"
                  className="btn"
                  disabled={
                    disabled || !['queued', 'running', 'cancelling'].includes(selectedRun.state)
                  }
                  onClick={() => void controller.cancel()}
                >
                  取消运行
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={disabled}
                  onClick={() => void controller.reconcile()}
                >
                  核查运行和输出
                </button>
              </div>
              <p>取消不会撤回已写入的文件。状态未知时须等待可信的停止核查。</p>
              <h4>实际输出</h4>
              <ul className="program-runs-list" aria-label="实际输出">
                {(selectedRun.outputs ?? []).map((output) => (
                  <li key={output.declaredPath}>
                    <span>
                      {output.declaredPath} · {presenceLabel[output.presence]} ·{' '}
                      {output.completeness === 'incomplete' ? '不完整' : '完整性未验证'}
                    </span>
                    {output.association ? (
                      <span>
                        {' '}
                        · 关联
                        {
                          { confirmed: '已确认', pending: '待确认', unknown: '未知' }[
                            output.association.state
                          ]
                        }
                      </span>
                    ) : null}
                    {output.resource && props.onOpenResource ? (
                      <button
                        type="button"
                        className="btn"
                        disabled={disabled}
                        onClick={() => {
                          if (output.resource && props.onOpenResource)
                            void controller.openOutput(
                              output.resource,
                              output.declaredPath,
                              props.onOpenResource,
                            );
                        }}
                      >
                        打开输出 {output.declaredPath}
                      </button>
                    ) : null}
                    {output.error ? (
                      <p role="status">
                        {output.error.code}：{output.error.message}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          <div className="program-runs-toolbar">
            <h4>日志</h4>
            <button
              type="button"
              className="btn"
              disabled={disabled || controller.logPage === 1}
              onClick={controller.previousLogs}
            >
              上一页日志
            </button>
            <span>第 {controller.logPage} 页</span>
            <button
              type="button"
              className="btn"
              disabled={disabled || !controller.hasNextLogs}
              onClick={controller.nextLogs}
            >
              下一页日志
            </button>
          </div>
          {logs?.value ? (
            <>
              {logs.value.truncatedBefore > 0 ? (
                <p role="status">
                  日志保留起点：{logs.value.truncatedBefore}，较早片段可能已截断。
                </p>
              ) : null}
              {logs.value.error ? (
                <p className="business-error" role="alert">
                  {logs.value.error.code}：{logs.value.error.message}
                </p>
              ) : null}
              {logs.value.lastLogAt ? <p>最后日志：{logs.value.lastLogAt}</p> : null}
              <section aria-label="运行日志">
                <pre className="program-runs-logs">
                  {logs.value.entries.length
                    ? logs.value.entries.map((entry) => (
                        <span
                          key={entry.seq}
                          data-stream={entry.stream}
                        >{`[${entry.seq} ${entry.stream}] ${entry.text}\n`}</span>
                      ))
                    : '当前页暂无日志。'}
                </pre>
              </section>
            </>
          ) : readable && !logs?.error ? (
            <p role="status">正在读取日志…</p>
          ) : null}
        </section>
      ) : (
        <p className="empty-hint">选择一条运行查看日志和实际输出。</p>
      )}
    </section>
  );
}
