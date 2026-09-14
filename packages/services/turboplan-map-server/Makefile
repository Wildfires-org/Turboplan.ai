.PHONY: clean
clean:
	rm -rf .pytest_cache htmlcov .coverage requirements.txt

.PHONY: run
run:
	poetry run uvicorn app.main:app --host 0.0.0.0 --port 9000 --reload

.PHONY: test
test:
ifndef COVERAGE
	poetry run python -m pytest
else
	poetry run coverage run -m pytest
	poetry run coverage html
	@echo "=============================================================================="
	@echo "||                                                                          ||"
	@echo "||                View HTML report http://localhost:8000                    ||"
	@echo "||                                                                          ||"
	@echo "=============================================================================="
	poetry run python -m http.server --directory htmlcov
endif

.PHONY: requirements
requirements:
	poetry run pip freeze > requirements.txt

.PHONY: deploy
deploy: clean requirements
ifndef PROD
	vercel
else
	vercel --prod
endif

.PHONY: fmt
fmt:
	poetry run autoflake --ignore-init-module-imports --remove-all-unused-imports --verbose --remove-unused-variables -r -i app/* tests/*
	poetry run isort .
	poetry run black .

.PHONY: docker-build
docker-build:
	docker build -t turboplan-map-server .

.PHONY: docker-run
docker-run:
	docker run --rm -p 8080:8080 --env-file .env turboplan-map-server