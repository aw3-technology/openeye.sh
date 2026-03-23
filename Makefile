.DEFAULT_GOAL := help

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------

.PHONY: install install-frontend install-backend install-cli

install: install-frontend install-backend install-cli ## Install all dependencies

install-frontend: ## npm install
	npm install

install-backend: ## pip install backend in editable mode with dev deps
	pip install -e backend/ --group dev

install-cli: ## pip install CLI in editable mode with dev deps
	pip install -e "cli/[all]" --group dev

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

.PHONY: build build-frontend

build: build-frontend ## Build all packages

build-frontend: ## Build frontend with Vite
	npm run build

# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------

.PHONY: test test-frontend test-backend test-cli

test: test-frontend test-backend test-cli ## Run all tests

test-frontend: ## Run frontend tests (vitest)
	npm run test

test-backend: ## Run backend tests (pytest)
	cd backend && python -m pytest -v

test-cli: ## Run CLI tests (pytest, skip integration)
	cd cli && python -m pytest -v -m "not integration"

# ---------------------------------------------------------------------------
# Lint
# ---------------------------------------------------------------------------

.PHONY: lint lint-frontend lint-backend lint-cli

lint: lint-frontend lint-backend lint-cli ## Lint all packages

lint-frontend: ## Lint frontend (eslint)
	npm run lint

lint-backend: ## Lint backend (ruff check + format check)
	cd backend && ruff check src/ && ruff format --check src/

lint-cli: ## Lint CLI (ruff check + format check)
	cd cli && ruff check . && ruff format --check .

# ---------------------------------------------------------------------------
# Format
# ---------------------------------------------------------------------------

.PHONY: format format-backend format-cli

format: format-backend format-cli ## Format all Python packages

format-backend: ## Format backend (ruff format)
	cd backend && ruff format src/

format-cli: ## Format CLI (ruff format)
	cd cli && ruff format .

# ---------------------------------------------------------------------------
# Type check
# ---------------------------------------------------------------------------

.PHONY: typecheck

typecheck: ## Type-check frontend (tsc --noEmit)
	npx tsc --noEmit

# ---------------------------------------------------------------------------
# Dev
# ---------------------------------------------------------------------------

.PHONY: dev dev-backend

dev: ## Start frontend dev server (Vite)
	npm run dev

dev-backend: ## Start backend with uvicorn --reload
	cd backend && uvicorn src.fleet.app:app --reload

# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------

.PHONY: clean

clean: ## Remove build artifacts and caches
	rm -rf dist/ node_modules/.cache .vite/
	find backend -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find cli -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	rm -rf backend/dist/ cli/dist/
	rm -rf backend/*.egg-info cli/*.egg-info
	rm -rf .pytest_cache backend/.pytest_cache cli/.pytest_cache

# ---------------------------------------------------------------------------
# CI
# ---------------------------------------------------------------------------

.PHONY: ci

ci: lint typecheck test ## Run full CI pipeline (lint + typecheck + test)

# ---------------------------------------------------------------------------
# Help
# ---------------------------------------------------------------------------

.PHONY: help

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
