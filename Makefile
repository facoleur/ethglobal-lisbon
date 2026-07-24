FRONTEND_DIR := frontend

.PHONY: dev build start lint install deploy setup check

dev:
	cd $(FRONTEND_DIR) && npm run dev

build:
	cd $(FRONTEND_DIR) && npm run build

start:
	cd $(FRONTEND_DIR) && npm run start

lint:
	cd $(FRONTEND_DIR) && npm run lint

install:
	cd $(FRONTEND_DIR) && npm install

setup:
	cd $(FRONTEND_DIR) && npm install
	lefthook install

check:
	cd $(FRONTEND_DIR) && npm run lint
	cd $(FRONTEND_DIR) && npm run format:check
	cd $(FRONTEND_DIR) && npm run typecheck

deploy:
	cd $(FRONTEND_DIR) && npx vercel --prod
