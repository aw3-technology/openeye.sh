# Contributing to OpenEye

Thanks for your interest in contributing to OpenEye! This guide will help you get set up and productive quickly.

## Prerequisites

- **Python 3.10+** (CLI package) / **Python 3.11+** (backend)
- **Node.js 20+** and npm (frontend)
- **Git**

## Repository Structure

```
perceptify-the-world/
├── cli/              # openeye-sh CLI & inference server (Python)
├── backend/          # Perception engine runtime (Python)
├── src/              # React frontend (TypeScript)
├── docs/             # MkDocs documentation site
└── .github/          # CI workflows
```

## Getting Started

### Frontend

```bash
npm install
npm run dev          # Start dev server
npm run lint         # ESLint
npx tsc --noEmit     # Type check
npm test             # Run vitest
```

### CLI

```bash
cd cli
pip install -e ".[all]" --group dev
ruff check           # Lint
ruff format --check  # Format check
pytest -v            # Run tests (excludes integration)
```

### Backend

```bash
cd backend
pip install -e . --group dev
ruff check
ruff format --check
pytest -v
```

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Ensure all tests and linting pass locally
4. Submit a pull request

## Coding Standards

### Python (CLI & Backend)

- Formatter/linter: **ruff** (configured in each `pyproject.toml`)
- Line length: 88 characters
- Use type hints on all public functions
- Follow existing patterns for adapters, providers, and plugins

### TypeScript (Frontend)

- Linter: **ESLint** (configured in project root)
- Component style: functional components with hooks
- Use `@/` path alias for imports from `src/`
- UI components: shadcn/ui in `src/components/ui/`

## Testing Guidelines

### CLI Tests

- **Mock all ML imports** (ultralytics, transformers, torch) — tests must run without GPU or model downloads
- Use the `FakeAdapter` from `tests/conftest.py` for server and integration tests
- Mark tests requiring real models with `@pytest.mark.integration`
- Mark slow tests with `@pytest.mark.slow`

### Backend Tests

- Singleton providers are **auto-reset** between tests via the autouse fixture in `conftest.py`
- Use `pytest-asyncio` with `asyncio_mode = "strict"` — mark async tests explicitly
- Mock plugin loaders (`load_input`, `load_llm`, etc.) when testing config

### Frontend Tests

- Use `@testing-library/react` with `screen` queries
- Wrap components needing routing in `<MemoryRouter>`
- Mock heavy child components with `vi.mock()` to keep tests fast
- The `IntersectionObserver` mock is provided in `src/test/setup.ts`

## Pull Request Process

1. Ensure CI passes (frontend lint + test, CLI lint + test, backend lint + test)
2. Write clear commit messages describing the "why"
3. Keep PRs focused — one feature or fix per PR
4. Add tests for new functionality
5. Update documentation if adding new CLI commands or API endpoints

## Architecture

See `docs/` for detailed architecture documentation:

- **CLI**: Adapter pattern for model backends, FastAPI server, typer CLI
- **Backend**: Mode-based cortex runtime with plugin-based inputs, actions, and LLM providers
- **Frontend**: React + Vite + TailwindCSS with shadcn/ui components
