import { useState } from 'react';
import './orca-ui-prototype.css';

const MATERIALS = ['研究计划.md', '示例论文.pdf'] as const;
const INITIAL_MATERIALS: string[] = [MATERIALS[0]];

interface Result {
  instruction: string;
  materials: string[];
}

export function OrcaUiPrototype() {
  const [materials, setMaterials] = useState<string[]>(INITIAL_MATERIALS);
  const [instruction, setInstruction] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  const toggleMaterial = (name: string) => {
    setMaterials((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
    );
  };

  const sendInstruction = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = instruction.trim();
    if (!trimmed) return;
    setResult({ instruction: trimmed, materials: [...materials] });
    setInstruction('');
  };

  const reset = () => {
    setMaterials(INITIAL_MATERIALS);
    setInstruction('');
    setResult(null);
  };

  return (
    <main className="orca-prototype">
      <header className="orca-prototype__header">
        <h1>Scholoom</h1>
        <p className="orca-prototype__subtitle">Orca 交互原型</p>
        <p className="orca-prototype__hint">示例响应 · 刷新后重置</p>
      </header>

      <div className="orca-prototype__columns">
        <section className="orca-prototype__panel" aria-labelledby="orca-materials-title">
          <h2 id="orca-materials-title">示例材料</h2>
          <ul className="orca-prototype__materials">
            {MATERIALS.map((name) => (
              <li key={name}>
                <label className="orca-prototype__material">
                  <input
                    type="checkbox"
                    checked={materials.includes(name)}
                    onChange={() => toggleMaterial(name)}
                  />
                  <span>{name}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>

        <section className="orca-prototype__panel" aria-labelledby="orca-instruction-title">
          <h2 id="orca-instruction-title">指令与示例结果</h2>
          <form className="orca-prototype__form" onSubmit={sendInstruction}>
            <label className="orca-prototype__label" htmlFor="orca-instruction">
              研究指令
            </label>
            <textarea
              id="orca-instruction"
              className="orca-prototype__input"
              rows={4}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
            />
            <div className="orca-prototype__actions">
              <button type="submit" disabled={instruction.trim() === ''}>
                发送指令
              </button>
              <button type="button" onClick={reset}>
                重置示例
              </button>
            </div>
          </form>

          <div className="orca-prototype__result" aria-live="polite">
            {result === null ? null : (
              <>
                <h3>示例结果</h3>
                <dl>
                  <dt>指令</dt>
                  <dd>{result.instruction}</dd>
                  <dt>材料</dt>
                  <dd>
                    {result.materials.length === 0 ? '未附加材料' : result.materials.join('、')}
                  </dd>
                </dl>
                <ul>
                  <li>目标：把指令拆成可检验的子问题，明确每个子问题的产出形式。</li>
                  <li>证据：为每个子问题标出材料中的对应章节或页码。</li>
                  <li>待确认：列出材料中无法直接回答、需要你补充说明的部分。</li>
                </ul>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
