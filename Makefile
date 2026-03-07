PORT ?= 8877

.PHONY: serve stop

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
