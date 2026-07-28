FRONTEND_DIR := frontend
CONTRACTS_DIR := contracts

.PHONY: dev build start lint install deploy setup check contracts-install contracts-build contracts-test deploy-tar-sepolia deploy-tar-v2-sepolia

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
	$(MAKE) contracts-install

setup:
	cd $(FRONTEND_DIR) && npm install
	$(MAKE) contracts-install
	lefthook install

check:
	cd $(FRONTEND_DIR) && npm run lint
	cd $(FRONTEND_DIR) && npm run format:check
	cd $(FRONTEND_DIR) && npm run typecheck
	$(MAKE) contracts-build
	$(MAKE) contracts-test

deploy:
	cd $(FRONTEND_DIR) && npx vercel --prod

contracts-install:
	cd $(CONTRACTS_DIR) && forge install

contracts-build:
	cd $(CONTRACTS_DIR) && forge build

contracts-test:
	cd $(CONTRACTS_DIR) && forge test -vvv

deploy-tar-sepolia:
	cd $(CONTRACTS_DIR) && forge script script/DeployTARSepolia.s.sol --rpc-url $(SEPOLIA_RPC_URL) --private-key $(PK) --broadcast --verify

deploy-tar-v2-sepolia:
	cd $(CONTRACTS_DIR) && forge script script/DeployTARV2Sepolia.s.sol --rpc-url $(SEPOLIA_RPC_URL) --private-key $(PK) --broadcast --verify
