declare module 'virtual:scholoom-pdf-assets' {
  const assets: {
    wasmUrl: string;
    fontFallback: { fonts: Record<number, string>; defaultFont: string };
  };
  export default assets;
}
