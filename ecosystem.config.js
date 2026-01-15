module.exports = {
    apps: [
        {
            name: 'ouvidoria-dashboard',
            script: './src/server.js',

            // Modo de execução
            instances: 'max', // Usar todos os CPUs disponíveis
            exec_mode: 'cluster', // Cluster mode para balanceamento de carga

            // Ambiente
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            },

            // Recursos
            max_memory_restart: '1G', // Reiniciar se usar mais de 1GB
            node_args: '--max-old-space-size=2048', // Limite de memória Node.js

            // Logs
            log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
            error_file: './logs/pm2-error.log',
            out_file: './logs/pm2-out.log',
            log_file: './logs/pm2-combined.log',
            merge_logs: true,

            // Restart
            autorestart: true,
            max_restarts: 10,
            min_uptime: '10s',
            restart_delay: 4000,

            // Watch (desabilitado em produção)
            watch: false,
            ignore_watch: ['node_modules', 'logs', 'db-data'],

            // Graceful shutdown
            kill_timeout: 5000,
            listen_timeout: 3000,
            shutdown_with_message: true,

            // Variáveis de ambiente de produção
            env_production: {
                NODE_ENV: 'production',
                PORT: 3000
            },

            // Cron jobs (opcional - descomente se necessário)
            // cron_restart: '0 2 * * *', // Reiniciar às 2h da manhã

            // Monitoramento
            instance_var: 'INSTANCE_ID',

            // Outras configurações
            source_map_support: true,
            vizion: false, // Desabilitar versionamento Git
            post_update: ['npm install'],

            // Time
            time: true
        }
    ],

    // Configuração de deploy (opcional - para deploy automático via PM2)
    deploy: {
        production: {
            user: 'deploy',
            host: 'SEU_VPS_IP',
            ref: 'origin/main',
            repo: 'SEU_REPOSITORIO_GIT',
            path: '/var/www/ouvidoria-dashboard',
            'post-deploy': 'npm install && pm2 reload ecosystem.config.js --env production',
            'pre-deploy-local': 'echo "Deploying to production..."',
            'post-deploy-local': 'echo "Deploy completed!"'
        }
    }
};
