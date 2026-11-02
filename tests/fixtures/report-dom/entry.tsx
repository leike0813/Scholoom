import type { ReportBridgeMessage, ReportProgramCommand } from '@scholoom/protocol/reports';
import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import type { WorkbenchSession } from '../../../apps/desktop/src/renderer/src/workbench/session';
import { Workbench } from '../../../apps/desktop/src/renderer/src/workbench/Workbench';
import { createReportDOM } from '../../../packages/editor/src/report-dom';
import { createReportPresentation } from '../../../packages/editor/src/report-presentation';
import { createReportStyleAssets } from '../../../packages/editor/src/report-style-assets';
import '../../../apps/desktop/src/renderer/src/styles.css';

function View() {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let receiver: ReturnType<typeof createReportDOM>;
    let presentation: ReturnType<typeof createReportPresentation> | undefined;
    let assets: ReturnType<typeof createReportStyleAssets> | undefined;
    const events: Array<{ index: number; type: string; trusted: boolean; value?: string }> = [];
    const commands: ReportProgramCommand[] = [];
    const messages: ReportBridgeMessage[] = [];
    const failures: unknown[] = [];
    const close = () => {
      presentation?.close();
      receiver?.close();
      assets?.close();
    };
    const reset = async (withStyles = false) => {
      close();
      assets = withStyles
        ? createReportStyleAssets([
            {
              url: 'scholoom-report://local/assets/theme.css',
              mediaType: 'text/css',
              bytes: new TextEncoder().encode(
                '@import "palette.css";.linked{color:rgb(90,100,110);background-image:url("pixel.png");margin-left:7px}',
              ),
            },
            {
              url: 'scholoom-report://local/assets/palette.css',
              mediaType: 'text/css',
              bytes: new TextEncoder().encode('.linked{font-weight:700}'),
            },
            {
              url: 'scholoom-report://local/assets/pixel.png',
              mediaType: 'image/png',
              bytes: Uint8Array.from(
                atob(
                  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aDs0AAAAASUVORK5CYII=',
                ),
                (value) => value.charCodeAt(0),
              ),
            },
          ])
        : undefined;
      events.length = 0;
      receiver = createReportDOM({
        document,
        ...(assets
          ? {
              styles: {
                baseURL: 'scholoom-report://local/reports/main.html',
                resolve: assets.resolve,
              },
            }
          : {}),
        onEvent(index, event) {
          events.push({
            index,
            type: event.type,
            trusted: event.isTrusted,
            ...((event.target as Element | null)?.localName === 'input'
              ? { value: (event.target as HTMLInputElement).value }
              : {}),
          });
        },
      });
      host.current!.append(receiver.element);
      await receiver.ready;
    };
    const mountPresentation = async () => {
      close();
      commands.length = messages.length = failures.length = 0;
      presentation = createReportPresentation({
        document,
        binding: {
          version: 1,
          viewId: 'presentation-fixture',
          generation: 7,
          basis: 'fixed-basis',
        },
        async send(command) {
          if (commands.length >= 128) throw new Error('Fixture command capacity exceeded');
          commands.push(command);
        },
        message(message) {
          if (messages.length >= 128) throw new Error('Fixture message capacity exceeded');
          messages.push(message);
        },
        failed(error) {
          failures.push((error as { code?: unknown })?.code ?? 'unknown');
        },
      });
      host.current!.append(presentation.element);
      await presentation.ready;
    };
    const ready = reset();
    Reflect.set(window, 'reportDOMProbe', {
      ready,
      reset,
      resetStyles: () => reset(true),
      apply: (frame: unknown) => receiver.apply(frame),
      events: () => [...events],
      mountPresentation,
      receive: (packet: unknown) => presentation!.receive(packet),
      presentation: () => ({
        commands: [...commands],
        messages: [...messages],
        failures: [...failures],
      }),
      close,
    });
    return close;
  }, []);
  return <div ref={host} />;
}
const session: WorkbenchSession = {
  status: 'sample',
  projectId: 'report-dom-static',
  materials: [],
  selectedMaterials: [],
  toggleMaterial: () => {},
  adapter: { messages: [], onNew: async () => {}, convertMessage: (message) => message },
  resourceTarget: {
    locator: {
      source: 'project',
      projectId: 'report-dom-static',
      fileId: 'probe',
      path: 'probe.html',
    },
    name: 'Report DOM probe.html',
    openMode: 'permanent',
  },
  renderResource: () => <View />,
};
createRoot(document.getElementById('fixture')!).render(<Workbench session={session} />);
