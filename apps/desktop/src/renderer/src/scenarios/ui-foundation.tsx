import type { AppendMessage, ThreadMessageLike } from '@assistant-ui/react';
import { useState } from 'react';
import { Workbench } from '../workbench/Workbench';

const MATERIALS = ['研究计划.md', '示例论文.pdf'] as const;
const INITIAL_STATE: {
  selectedMaterials: readonly string[];
  messages: readonly ThreadMessageLike[];
} = {
  selectedMaterials: [MATERIALS[0]],
  messages: [],
};

export default function UiFoundationScenario() {
  const [state, setState] = useState(INITIAL_STATE);

  const onNew = async (message: AppendMessage) => {
    if (message.content.length !== 1 || message.content[0]?.type !== 'text') {
      throw new Error('The UI sample accepts text instructions only.');
    }
    const instruction = message.content[0].text.trim();
    if (!instruction) return;
    setState((current) => ({
      ...current,
      messages: [
        { id: crypto.randomUUID(), role: 'user', content: instruction },
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: `示例响应\n材料：${current.selectedMaterials.join('、') || '未附加材料'}\n目标：把指令拆成可检验的子问题。\n证据：标出材料中的对应章节或页码。\n待确认：列出需要补充说明的部分。`,
        },
      ],
    }));
  };

  return (
    <Workbench
      session={{
        status: 'sample',
        materials: MATERIALS,
        selectedMaterials: state.selectedMaterials,
        toggleMaterial: (name) => {
          setState((current) => ({
            ...current,
            selectedMaterials: current.selectedMaterials.includes(name)
              ? current.selectedMaterials.filter((item) => item !== name)
              : [...current.selectedMaterials, name],
          }));
        },
        adapter: {
          messages: state.messages,
          onNew,
          convertMessage: (message) => message,
        },
        reset: () => setState(INITIAL_STATE),
      }}
    />
  );
}
