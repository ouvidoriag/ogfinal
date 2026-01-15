/**
 * Middleware de Compressão
 * CÉREBRO X-3 - Sistema Ouvidoria Dashboard
 * 
 * Implementa compressão Gzip para respostas HTTP
 */

import compression from 'compression';

/**
 * Configurar compressão Gzip
 */
export const configureCompression = () => {
    return compression({
        // Nível de compressão (0-9, 6 é o padrão)
        level: 6,

        // Tamanho mínimo para comprimir (em bytes)
        threshold: 1024, // 1KB

        // Filtro de tipos de conteúdo
        filter: (req, res) => {
            // Não comprimir se o cliente não suporta
            if (req.headers['x-no-compression']) {
                return false;
            }

            // Não comprimir arquivos já comprimidos
            const contentType = res.getHeader('Content-Type');
            if (contentType) {
                const type = contentType.toString();

                // Tipos já comprimidos
                const precompressed = [
                    'image/jpeg',
                    'image/png',
                    'image/gif',
                    'image/webp',
                    'video/',
                    'audio/',
                    'application/zip',
                    'application/gzip',
                    'application/x-rar'
                ];

                if (precompressed.some(t => type.includes(t))) {
                    return false;
                }
            }

            // Usar compressão padrão do compression
            return compression.filter(req, res);
        },

        // Configurações de memória
        memLevel: 8,

        // Estratégia de compressão
        strategy: compression.Z_DEFAULT_STRATEGY
    });
};

export default {
    configureCompression
};
