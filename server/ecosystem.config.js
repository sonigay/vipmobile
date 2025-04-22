module.exports = {
  apps: [{
    name: "index",
    script: "./index.js",
    instances: 1,
    exec_mode: 'fork',
    autorestart: false,
    max_restarts: 0,
    watch: false,
    max_memory_restart: '1G',
    error_file: "./logs/error.log",
    out_file: "./logs/out.log",
    log_file: "./logs/combined.log",
    time: true,
    env: {
      NODE_ENV: 'development'
    }
  }]
}; 