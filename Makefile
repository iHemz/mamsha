# Recipes avoid `cd` so they run the same under sh (CI, Git Bash) and cmd (Windows make).
API := uv --directory services/api
WEB := pnpm --dir apps/web

.PHONY: install install-api install-web dev dev-api dev-web check check-api check-web check-format drift gen test build

install: install-api install-web ## Install API and web dependencies

install-api:
	$(API) sync --locked

install-web:
	pnpm install

dev: ## Run the API (:8000) and web (:5173) together
	$(MAKE) -j2 dev-api dev-web

dev-api:
	$(API) run uvicorn app.main:app --reload --port 8000

dev-web:
	$(WEB) dev

check: check-api check-web check-format drift ## Everything that must pass before ticking an item

check-api:
	$(API) run ruff check .
	$(API) run ruff format --check .
	$(API) run mypy
	$(API) run pytest -q

check-web:
	$(WEB) lint
	$(WEB) typecheck
	$(WEB) test

check-format:
	pnpm exec prettier --check .

drift: ## Fail if schemas/ or packages/shared are out of date with the Pydantic models
	$(API) run python -m app.export_schemas --check
	node scripts/gen-types.mjs --check

gen: ## Export JSON Schemas from Pydantic and regenerate the TS types
	$(API) run python -m app.export_schemas
	node scripts/gen-types.mjs

test: ## Unit and integration tests only
	$(API) run pytest -q
	$(WEB) test

build: ## Production build of the web app
	$(WEB) build
