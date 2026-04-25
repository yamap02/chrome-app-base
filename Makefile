SHELL := /bin/bash

NODE ?= node
NPM ?= npm
BUILD_DIR := .output/chrome-mv3

ifeq ($(shell uname -s),Darwin)
CHROME_BIN ?= /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
else
CHROME_BIN ?= $(shell command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser)
endif

.PHONY: build compile format-check knip lint test-unit test-scripts manifest-contract zip zip-artifact-contract test-e2e-headless ci

build:
	$(NPM) run build

compile:
	$(NPM) run compile

format-check:
	$(NPM) run format:check

knip:
	$(NPM) run knip

lint:
	$(NPM) run lint

test-unit:
	$(NPM) test

manifest-contract: build
	$(NODE) --test tests/scripts/manifest-contract.test.mjs

zip:
	$(NPM) run zip

zip-artifact-contract: zip
	$(NODE) --test tests/scripts/zip-artifact.test.mjs

test-scripts: manifest-contract zip-artifact-contract

test-e2e-headless: build
	@if [ -z "$(CHROME_BIN)" ] || [ ! -x "$(CHROME_BIN)" ]; then echo "CHROME_BIN not found: $(CHROME_BIN)"; exit 1; fi
	CHROME_BIN="$(CHROME_BIN)" $(NODE) --test tests/e2e/headless-smoke.test.mjs

ci: format-check lint compile test-unit test-scripts knip test-e2e-headless
