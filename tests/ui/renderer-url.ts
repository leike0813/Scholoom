const value = process.env.SCHOOLOOM_UI_PORT ?? '5174';
const port = Number(value);
if (!/^\d+$/u.test(value) || port < 1 || port > 65535)
  throw new Error(`SCHOOLOOM_UI_PORT 必须是 1-65535 的整数端口，收到 ${JSON.stringify(value)}`);

export const uiPort = port;
export const rendererOrigin = `http://127.0.0.1:${uiPort}`;
export const rendererUrl = `${rendererOrigin}/`;
