module.exports = {
  apps: [
    {
      name: "auto_apply_linkedin_backend",
      script: "./src/index.js",
      instances: 1,
      exec_mode: "fork",
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
