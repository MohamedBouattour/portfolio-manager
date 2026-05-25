module.exports = {
  apps: [
    {
      name: "portfolio-bybit-connector",
      script: "services/bybit-connector/dist/main.js",
      cwd: "/mnt/main/portfolio",
      env: {
        PORT: 3011,
        NODE_ENV: "production",
      }
    },
    {
      name: "portfolio-market-scouter",
      script: "services/market-scouter/dist/main.js",
      cwd: "/mnt/main/portfolio",
      env: {
        PORT: 3012,
        BYBIT_CONNECTOR_URL: "http://localhost:3011",
        NODE_ENV: "production",
      }
    },
    {
      name: "portfolio-manager",
      script: "services/portfolio-manager/dist/main.js",
      cwd: "/mnt/main/portfolio",
      env: {
        PORT: 3013,
        BYBIT_CONNECTOR_URL: "http://localhost:3011",
        MARKET_SCOUTER_URL: "http://localhost:3012",
        NODE_ENV: "production",
      }
    },
    {
      name: "portfolio-bff",
      script: "services/bff/dist/main.js",
      cwd: "/mnt/main/portfolio",
      env: {
        PORT: 3010,
        BYBIT_CONNECTOR_URL: "http://localhost:3011",
        MARKET_SCOUTER_URL: "http://localhost:3012",
        PORTFOLIO_MANAGER_URL: "http://localhost:3013",
        NODE_ENV: "production",
      }
    }
  ]
};
