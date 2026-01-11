build-lua:
	GOOS=js GOARCH=wasm go build -o web/public/lua.wasm golua/main.go

run:
	cd web && npm run dev

clean:
	rm -rf web/public/lua.wasm web/node_modules

install:
	cd web && npm install