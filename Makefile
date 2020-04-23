all: build

node_modules: yarn.lock
	yarn

.PHONY: build
build: node_modules
	yarn build
	yarn flow-copy-source src lib

testing/swapi.schema.graphql:
	curl https://raw.githubusercontent.com/graphql/swapi-graphql/master/schema.graphql > testing/swapi.schema.graphql

.PHONY: test
test: testing/swapi.schema.graphql
	yarn test