PORT ?= 8800

.PHONY: serve stop check hooks

serve: ## Start local dev server
	@echo "Serving on http://localhost:$(PORT)"
	@python3 -m http.server $(PORT)

stop: ## Kill process using the dev server port
	@pid=$$(lsof -ti:$(PORT)); \
	if [ -n "$$pid" ]; then \
		kill $$pid && echo "Killed process on port $(PORT)"; \
	else \
		echo "Nothing running on port $(PORT)"; \
	fi

## Icon standard: weight, colour, render mode, and a sheet that cannot go stale.
## Exits non-zero if anything is off OR if the generated sheet is out of date,
## because a doc that silently lags the thing it documents is the failure this
## whole check exists to prevent.
check:
	@python3 scripts/icon-lint.py
	@python3 scripts/icon-sheet.py >/dev/null
	@if git ls-files --error-unmatch docs/icon-sheet.html >/dev/null 2>&1; then \
		if ! git diff --quiet -- docs/icon-sheet.html; then \
			echo "docs/icon-sheet.html was out of date and has been regenerated. Stage it."; \
			exit 1; \
		fi; \
	fi
	@echo "icons: standard held, sheet current"

## Opt-in: route git hooks at .githooks/ so `make check` runs before each commit.
## Reversible with `git config --unset core.hooksPath`.
hooks:
	@git config core.hooksPath .githooks
	@echo "git hooks enabled from .githooks/ — 'make check' now runs on commit"
	@echo "undo with: git config --unset core.hooksPath"
