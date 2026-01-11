// Type declarations for wasm_exec.mjs
export class Go {
  importObject: WebAssembly.Imports
  run(instance: WebAssembly.Instance): Promise<void>
}
