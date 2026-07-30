module.exports = {
  apps: [
    {
      name: "backend",
      script: "./src/index.js",
      instances: "max",
      exec_mode: "cluster",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "development",
      },
      env_production: {
        NODE_ENV: "production",
      },
    },
  ],
};
