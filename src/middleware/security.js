/**
 * Middleware de Segurança para Produção
 * CÉREBRO X-3 - Sistema Ouvidoria Dashboard
 * 
 * Implementa camadas de segurança:
 * - Helmet.js para headers HTTP seguros
 * - Rate limiting por IP
 * - Proteção contra ataques comuns
 */

import rateLimit from 'express-rate-limit';
import helmet from 'helmet';

/**
 * Configurar Helmet.js
 * Headers de segurança HTTP
 */
export const configureHelmet = () => {
    return helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
                scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net"],
                fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdn.jsdelivr.net"],
                imgSrc: ["'self'", "data:", "https:", "blob:"],
                connectSrc: ["'self'", "https://generativelanguage.googleapis.com"],
                frameSrc: ["'none'"],
                objectSrc: ["'none'"],
                upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
            }
        },
        crossOriginEmbedderPolicy: false,
        crossOriginResourcePolicy: { policy: "cross-origin" },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        },
        noSniff: true,
        referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
        xssFilter: true
    });
};

/**
 * Rate Limiter Global
 * Limita requisições por IP
 */
export const globalRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 1000, // Máximo de 1000 requisições por IP
    message: {
        error: 'Muitas requisições deste IP, tente novamente mais tarde.',
        retryAfter: '15 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Não aplicar rate limit para health check
        return req.path === '/health';
    }
});

/**
 * Rate Limiter para API
 * Mais restritivo para endpoints de API
 */
export const apiRateLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minutos
    max: 500, // Máximo de 500 requisições
    message: {
        error: 'Limite de requisições da API excedido.',
        retryAfter: '10 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Rate Limiter para Login
 * Muito restritivo para prevenir brute force
 */
export const loginRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 10, // Máximo de 10 tentativas
    message: {
        error: 'Muitas tentativas de login. Tente novamente em 15 minutos.',
        retryAfter: '15 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // Não contar requisições bem-sucedidas
});

/**
 * Rate Limiter para Chat/IA
 * Limitar uso da API Gemini
 */
export const chatRateLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    max: 10, // Máximo de 10 mensagens por minuto
    message: {
        error: 'Limite de mensagens excedido. Aguarde um momento.',
        retryAfter: '1 minuto'
    },
    standardHeaders: true,
    legacyHeaders: false
});

/**
 * Middleware de sanitização de inputs
 * Remove caracteres perigosos
 */
export const sanitizeInputs = (req, res, next) => {
    // Sanitizar query params
    if (req.query) {
        for (const key in req.query) {
            if (typeof req.query[key] === 'string') {
                req.query[key] = req.query[key]
                    .replace(/[<>]/g, '') // Remove < e >
                    .trim();
            }
        }
    }

    // Sanitizar body
    if (req.body) {
        for (const key in req.body) {
            if (typeof req.body[key] === 'string') {
                req.body[key] = req.body[key]
                    .replace(/[<>]/g, '') // Remove < e >
                    .trim();
            }
        }
    }

    next();
};

/**
 * Middleware de log de segurança
 * Registra eventos suspeitos
 */
export const securityLogger = (req, res, next) => {
    // Detectar padrões suspeitos
    const suspiciousPatterns = [
        /(\.\.|\/etc\/|\/var\/|\/usr\/)/i, // Path traversal
        /(union|select|insert|update|delete|drop|create|alter)/i, // SQL injection
        /(<script|javascript:|onerror=|onload=)/i, // XSS
        /(eval\(|exec\(|system\()/i // Code injection
    ];

    const fullUrl = req.originalUrl || req.url;
    const bodyStr = JSON.stringify(req.body || {});

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(fullUrl) || pattern.test(bodyStr)) {
            console.warn('🚨 [SECURITY] Requisição suspeita detectada:', {
                ip: req.ip,
                method: req.method,
                url: fullUrl,
                userAgent: req.get('user-agent'),
                timestamp: new Date().toISOString()
            });
            break;
        }
    }

    next();
};

/**
 * Middleware de CORS configurado
 */
export const configureCORS = () => {
    return (req, res, next) => {
        const allowedOrigins = process.env.ALLOWED_ORIGINS
            ? process.env.ALLOWED_ORIGINS.split(',')
            : ['http://localhost:3000'];

        const origin = req.headers.origin;

        if (allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
            res.setHeader('Access-Control-Allow-Origin', origin || '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Allow-Credentials', 'true');
        }

        // Handle preflight
        if (req.method === 'OPTIONS') {
            return res.sendStatus(200);
        }

        next();
    };
};

export default {
    configureHelmet,
    globalRateLimiter,
    apiRateLimiter,
    loginRateLimiter,
    chatRateLimiter,
    sanitizeInputs,
    securityLogger,
    configureCORS
};
