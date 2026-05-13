# Vitae developer / operator helpers.
# `make` with no target prints help.

.DEFAULT_GOAL := help
COMPOSE_DEV := docker compose --profile dev
COMPOSE_PROD := sudo docker compose -f /opt/vitae/docker-compose.prod.yml
BACKUP_DIR := backups

.PHONY: help
help:
	@echo "Vitae targets:"
	@echo ""
	@echo "  Local development:"
	@echo "    make up         — start the dev stack"
	@echo "    make down       — stop the dev stack"
	@echo "    make rebuild    — rebuild images and restart"
	@echo "    make test       — run the API test suite"
	@echo ""
	@echo "  Operations (run on the VPS unless noted):"
	@echo "    make logs              — tail prod logs"
	@echo "    make shell             — shell into the prod API container"
	@echo "    make migrate           — run alembic upgrade head against prod"
	@echo "    make create-user EMAIL=foo@bar.com  — create a prod user account"
	@echo "    make backup            — pg_dump + uploads tar to ./backups/"

# --- Local dev ---

.PHONY: up
up:
	$(COMPOSE_DEV) up -d --build

.PHONY: down
down:
	$(COMPOSE_DEV) down

.PHONY: rebuild
rebuild:
	$(COMPOSE_DEV) build --no-cache
	$(COMPOSE_DEV) up -d

.PHONY: test
test:
	cd src-api && .venv/bin/python -m pytest -q

# --- Prod ops (VPS) ---

.PHONY: logs
logs:
	$(COMPOSE_PROD) logs -f --tail=200

.PHONY: shell
shell:
	$(COMPOSE_PROD) exec vitae-api /bin/bash

.PHONY: migrate
migrate:
	$(COMPOSE_PROD) exec vitae-api uv run alembic upgrade head

.PHONY: create-user
create-user:
	@if [ -z "$(EMAIL)" ]; then echo "Usage: make create-user EMAIL=foo@bar.com"; exit 64; fi
	$(COMPOSE_PROD) exec vitae-api uv run python -m app.scripts.create_user $(EMAIL)

.PHONY: backup
backup:
	@mkdir -p $(BACKUP_DIR)
	@TS=$$(date +%Y%m%d-%H%M%S); \
	echo "Backing up to $(BACKUP_DIR)/vitae-$$TS.{sql.gz,uploads.tar.gz}"; \
	$(COMPOSE_PROD) exec -T vitae-postgres pg_dump -U vitae vitae | gzip > $(BACKUP_DIR)/vitae-$$TS.sql.gz; \
	$(COMPOSE_PROD) run --rm -v vitae-uploads:/source:ro -v $$(pwd)/$(BACKUP_DIR):/dest alpine tar -czf /dest/vitae-$$TS.uploads.tar.gz -C /source .; \
	echo "Done."
