//go:build js && wasm

// =========================================================================================
// A thin and simplified WebAssembly/JavaScript bridge for running Lua code
// in the browser using GopherLua. This code exposes functions to execute Lua code
// and retrieve global variables, converting Lua types to JavaScript types.
// =========================================================================================

package main

import (
	"fmt"
	"syscall/js"

	lua "github.com/yuin/gopher-lua"
)

// Shared global Lua state
var luaState *lua.LState

func main() {
	fmt.Println("Initializing Lua state and WASM/JS bridge...")
	luaState = lua.NewState()
	defer luaState.Close()

	// Load Lua standard libraries
	luaState.OpenLibs()

	var luaBridge = js.Global().Get("lua")
	luaBridge.Set("DoString", js.FuncOf(doString))
	luaBridge.Set("GetAllGlobals", js.FuncOf(getAllGlobals))
	luaBridge.Set("GetGlobal", js.FuncOf(getGlobal))
	luaBridge.Set("CallFunction", js.FuncOf(callFunction))

	// Prevent the function from returning, which would terminate the WebAssembly module.
	select {}
}

func doString(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return "Error: missing argument"
	}

	str := args[0].String()

	err := luaState.DoString(str)
	if err != nil {
		fmt.Printf("Error in Lua: %s\n%v", str, err)
		return js.Global().Get("Error").New(err.Error())
	}

	if luaState.GetTop() > 0 {
		ret := luaState.Get(-1)
		luaState.Pop(1)
		return luaToJsVal(ret, 0)
	}

	return js.Null()
}

func getAllGlobals(this js.Value, args []js.Value) interface{} {
	jsObj := js.Global().Get("Object").New()

	luaState.ForEach(luaState.G.Global, func(key lua.LValue, value lua.LValue) {
		jsObj.Set(key.String(), luaToJsVal(value, 0))
	})

	return jsObj
}

func getGlobal(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return "Error: missing argument"
	}
	key := args[0].String()
	val := luaState.GetGlobal(key)
	return luaToJsVal(val, 0)
}

func callFunction(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return js.Global().Get("Error").New("Error: missing function name")
	}

	funcName := args[0].String()
	fn := luaState.GetGlobal(funcName)

	if fn.Type() != lua.LTFunction {
		return js.Global().Get("Error").New(fmt.Sprintf("Error: '%s' is not a function", funcName))
	}

	// Convert JS arguments to Lua values
	luaArgs := make([]lua.LValue, 0, len(args)-1)
	for i := 1; i < len(args); i++ {
		luaArgs = append(luaArgs, jsValToLua(args[i]))
	}

	// Call the function with the arguments and expect 1 return value
	err := luaState.CallByParam(lua.P{
		Fn:      fn,
		NRet:    1,
		Protect: true,
	}, luaArgs...)

	if err != nil {
		fmt.Printf("Error calling Lua function '%s': %v\n", funcName, err)
		return js.Global().Get("Error").New(err.Error())
	}

	// Get the return value
	if luaState.GetTop() > 0 {
		ret := luaState.Get(-1)
		luaState.Pop(1)
		return luaToJsVal(ret, 0)
	}

	return js.Null()
}

func luaToJsVal(val lua.LValue, depth int) js.Value {
	// Limit recursion depth to avoid deep or cyclic tables
	if depth > 5 {
		return js.Undefined()
	}

	if val.Type() == lua.LTFunction {
		return js.ValueOf(js.FuncOf(func(this js.Value, args []js.Value) interface{} {
			return js.Undefined()
		}))
	}

	switch v := val.(type) {
	case lua.LBool:
		return js.ValueOf(bool(v))
	case lua.LNumber:
		return js.ValueOf(float64(v))
	case *lua.LTable:
		jsObj := js.Global().Get("Object").New()

		v.ForEach(func(key lua.LValue, value lua.LValue) {
			jsObj.Set(key.String(), luaToJsVal(value, depth+1))
		})

		return jsObj
	case lua.LString:
		return js.ValueOf(string(v))
	default:
		s := v.String()
		if s == "nil" {
			return js.Null()
		}
		return js.ValueOf(s)
	}
}

func jsValToLua(val js.Value) lua.LValue {
	switch val.Type() {
	case js.TypeBoolean:
		return lua.LBool(val.Bool())
	case js.TypeNumber:
		return lua.LNumber(val.Float())
	case js.TypeString:
		return lua.LString(val.String())
	case js.TypeNull, js.TypeUndefined:
		return lua.LNil
	case js.TypeObject:
		// Convert JS object/array to Lua table
		table := luaState.NewTable()
		if val.Get("length").Type() == js.TypeNumber {
			// It's an array
			length := val.Get("length").Int()
			for i := 0; i < length; i++ {
				table.Append(jsValToLua(val.Index(i)))
			}
		} else {
			// It's an object - iterate over keys
			keys := js.Global().Get("Object").Call("keys", val)
			length := keys.Get("length").Int()
			for i := 0; i < length; i++ {
				key := keys.Index(i).String()
				table.RawSetString(key, jsValToLua(val.Get(key)))
			}
		}
		return table
	default:
		return lua.LNil
	}
}
