.PHONY: dev backend frontend install install-backend install-frontend build

install: install-backend install-frontend

install-backend:
	python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt

install-frontend:
	cd frontend && npm install

backend:
	. .venv/bin/activate && cd api && uvicorn index:app --reload --port 8765

frontend:
	cd frontend && npm run dev

dev:
	@echo "Starting backend on :8765 and frontend on :5173"
	@(. .venv/bin/activate && cd api && uvicorn index:app --reload --port 8765) & \
	 (cd frontend && npm run dev) & \
	 wait

build:
	cd frontend && npm run build
