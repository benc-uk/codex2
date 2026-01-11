import { Go } from './wasm-exec.mjs'

// Define the possible Lua types we can handle
export type BasicType = string | number | boolean | undefined | null | object | Error

// Define the LuaVM interface to represent the Lua virtual machine
export interface LuaVM {
  DoString(code: string): BasicType
  GetGlobal(name: string): BasicType
  GetAllGlobals(): Record<string, BasicType>
  CallFunction(name: string, ...args: BasicType[]): BasicType
  SetGlobal(name: string, value: BasicType): void
}

// Stop TypeScript from complaining about the global 'lua' variable
declare global {
  var lua: LuaVM
}

// ==================================================================================
// Initialize the Lua VM via WASM and return the LuaVM
// ==================================================================================
export async function initLua(): Promise<LuaVM> {
  const go = new Go()

  // We use global as that's the easiest (only?) way to interface with the Go WASM module
  // See golua/main.go for the other side of this bridge and explanation on why
  globalThis.lua = {} as LuaVM

  const wasmSrc = await WebAssembly.instantiateStreaming(fetch('lua.wasm'), go.importObject)
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  go.run(wasmSrc.instance)

  lua.GetGlobal('_VERSION') // Test call to ensure Lua VM is ready
  console.log('Lua VM initialized, version:', lua.GetGlobal('_VERSION'))

  return globalThis.lua
}
