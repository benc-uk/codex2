build-lua:
	GOOS=js GOARCH=wasm go build -o web/public/lua.wasm github.com/benc-uk/codex2/golua

run:
	cd web && npm run dev

clean:
	rm -rf web/public/lua.wasm web/node_modules

install:
	cd web && npm install