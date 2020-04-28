all: build

node_modules: yarn.lock
	yarn

.PHONY: build
build: node_modules
	yarn build
	yarn flow-copy-source src lib

.PHONY: test
test: node_modules
	yarn flow check
	yarn test