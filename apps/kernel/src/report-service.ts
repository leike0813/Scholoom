import { RpcPeer, type RpcTransport } from '@scholoom/broker/rpc';
import {
  reportStdioChannel,
  SystemReportManager,
  type SystemReportManagerHost,
  systemReportAdapter,
} from '@scholoom/platform/node';
import { ReportControlHost } from './report-control.js';
import { connectReportManager } from './report-manager-client.js';

/** PID1 supplies a connected socket on stdin/stdout; all options come from protected installation. */
async function serve(
  callerUid: number,
  bind: (transport: RpcTransport) => { receive(frame: string): void; disconnect(): Promise<void> },
): Promise<void> {
  let finish = () => {};
  const done = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await reportStdioChannel(callerUid, (transport) => {
    const host = bind(transport);
    let closing = false;
    return {
      onFrame: (frame) => host.receive(frame),
      onClose: () => {
        if (closing) return;
        closing = true;
        void host.disconnect().finally(async () => {
          await transport.close();
          finish();
        });
      },
    };
  });
  await done;
}

export function serveReportControl(
  options: ConstructorParameters<typeof ReportControlHost>[1] & { callerUid: number },
): Promise<void> {
  return serve(options.callerUid, (transport) => new ReportControlHost(transport, options));
}

/** The protected installation supplies both account bindings; no report can choose its manager. */
export async function serveSystemReportControl(
  options: Omit<Parameters<typeof serveReportControl>[0], 'native' | 'route'> & {
    manager: Parameters<typeof connectReportManager>[0];
  },
): Promise<void> {
  const manager = await connectReportManager(options.manager, options.configId);
  try {
    await serveReportControl({
      ...options,
      route: 'linux-system-service-v1',
      native: systemReportAdapter(options.configId, manager.request),
    });
  } finally {
    await manager.close();
  }
}

/** M owns only fixed OS operations; configuration and caller identity come from protected installation. */
export function serveReportManager(options: {
  callerUid: number;
  configId: string;
  host?: SystemReportManagerHost;
}): Promise<void> {
  return serve(options.callerUid, (transport) => {
    const manager = new SystemReportManager(options);
    const peer = new RpcPeer(transport, {
      control: () => true,
      request: (method, raw) => manager.request(method, raw),
    });
    return {
      receive: (frame) => peer.receive(frame),
      disconnect: async () => {
        peer.close();
        await manager.disconnect();
      },
    };
  });
}
