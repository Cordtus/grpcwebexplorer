module.exports = {
  apps: [{
    name: 'grpc-explorer',
    script: 'npm',
    args: 'run start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      NODE_OPTIONS: '--max-old-space-size=512'
    },
    no_treekill: true,
    kill_timeout: 3000
  }]
};
