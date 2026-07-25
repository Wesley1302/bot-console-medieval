/* global process */
module.exports = {
  apps: [
    {
      name: 'bot-console-medieval-backend',
      script: 'server.mjs',
      cwd: process.cwd(),
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'bot-console-medieval-worker',
      script: 'worker.mjs',
      cwd: process.cwd(),
      env: { NODE_ENV: 'production' },
    },
  ],
};
