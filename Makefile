-include Makefile.env
export

PATH := $(CURDIR)/.tools/node/bin:$(PATH)
NPM := $(CURDIR)/.tools/node/bin/npm
VSCE := $(CURDIR)/node_modules/.bin/vsce

.PHONY: $(wildcard *)

## help: show help
help:
	@echo ""
	@echo "Usage:"
	@echo ""
	@sed -n 's/^## //p' Makefile | column -t -s ':' | sed -e 's/^/\t/'
	@echo ""

## install: install npm dependencies
install:
	$(NPM) install

## build: compile TypeScript
build:
	$(NPM) run compile

## test: compile and run unit tests
test:
	$(NPM) test

## dev: compile TypeScript in watch mode
dev:
	$(NPM) run watch

## clean: remove generated build output
clean:
	rm -rf out

## package: build and package the extension as a VSIX
package:
	$(VSCE) package

## publish: publish the extension to VS Code Marketplace
publish:
	$(VSCE) publish

ARGS := $(word 2,$(MAKECMDGOALS))
%:
	@:
