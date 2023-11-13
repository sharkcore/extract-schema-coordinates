all: build

node_modules:
	npm install

.PHONY: build
build: node_modules
	npm run build

.PHONY: test
test: node_modules
	npm run typecheck
	npm run test