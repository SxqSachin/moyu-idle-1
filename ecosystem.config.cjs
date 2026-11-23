module.exports = {
  apps: [
    {
      name: 'DeepApp',
      port: '3000',
      script: './.output/server/index.mjs',
      env_production : {
        NODE_ENV: "production"
      }
    },
    {
      name: 'DeepApp1',
      port: '3001',
      script: './.output/server/index.mjs',
      env_production : {
        NODE_ENV: "production"
      }
    },
    {
      name: 'DeepApp2',
      port: '3002',
      script: './.output/server/index.mjs',
      env_production : {
        NODE_ENV: "production"
      }
    },
    {
      name: 'DeepApp3',
      port: '3003',
      script: './.output/server/index.mjs',
      env_production : {
        NODE_ENV: "production"
      }
    }
  ]
}
