import { Go } from './wasm-exec.mjs'

export interface LuaVM {
  DoString(code: string): any
  GetGlobal(name: string): any
  GetAllGlobals(): any
  CallFunction(name: string, ...args: any[]): any
}

declare global {
  var lua: LuaVM
}

export async function initLua(): Promise<LuaVM> {
  const go = new Go()
  globalThis.lua = {} as LuaVM

  const wasmSrc = await WebAssembly.instantiateStreaming(fetch('lua.wasm'), go.importObject)
  go.run(wasmSrc.instance)

  lua.GetGlobal('_VERSION') // Test call to ensure Lua VM is ready
  console.log('Lua VM initialized, version:', lua.GetGlobal('_VERSION'))

  return globalThis.lua
}
