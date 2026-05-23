# Bybit Stocks Bot & Sandbox Monorepo

This repository is structured as a workspaces-based monorepo containing three core components:
1. **`apps/bot`**: The standalone automated trading bot (compiled to ESM; run as a cron job every 4h).
2. **`apps/backend`**: A NestJS backend API serving asset details, historical kline data, and evaluating strategy parameters.
3. **`apps/frontend`**: An Angular 19 visual sandbox/test bench rendering interactive kline/indicator charts to inspect and validate bot decisions manually.

---

## Quick Start

### 1. Install Workspace Dependencies
From the repository root directory, run:
```bash
npm install
```

### 2. Build the Bot Logic
Compile the TypeScript code for the core bot:
```bash
npm run build:bot
```

### 3. Run Trading Bot Unit Tests (Vitest)
Verify that the position management (Take Profit, DCA Rebuys) and entry scouting logic works without regressions:
```bash
npm run test:bot
```

### 4. Start the Sandbox Environment
Run these commands in separate terminals to start the visual test bench:

* **Backend (NestJS)**:
  ```bash
  npm run start:backend
  ```
  *(Exposed on http://localhost:3000)*

* **Frontend (Angular)**:
  ```bash
  npm run start:frontend
  ```
  *(Exposed on http://localhost:4200)*

Open your browser to `http://localhost:4200/` to explore the interactive dashboard!
