export async function initLua() {
  const go = new Go();
  globalThis.lua = {};

  const wasmSrc = await WebAssembly.instantiateStreaming(
    fetch("lua.wasm"),
    go.importObject
  );

  go.run(wasmSrc.instance);

  return globalThis.lua;
}
