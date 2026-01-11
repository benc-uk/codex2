ROOT_DIR := $(shell git rev-parse --show-toplevel)
DEV_DIR := $(ROOT_DIR)/.dev
PACKAGE := github.com/benc-uk/codex
VERSION := $(shell git describe --tags --abbrev=0 --dirty=-dev 2>/dev/null || echo "0.0.0-dev")


build-lua:
	GOOS=js GOARCH=wasm go build -o web/public/lua.wasm golua/main.go

run:
	cd web && npm run dev

clean:
	rm -rf web/public/lua.wasm web/node_modules

install:
	cd web && npm install
	go mod download
	go mod download -modfile=$(DEV_DIR)/tools.mod

lint: # ✨ Check code formatting
	@count=$$(gofmt -l . | wc -l); \
	echo "$$count files need formatting"; \
	[ $$count -eq 0 ] || exit 1
	@cd web && npm run lint && npm run format:check

	
