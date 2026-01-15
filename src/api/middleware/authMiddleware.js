export const requireAuth = (req, res, next) => {
    if (req.session && req.session.isAuthenticated) {
        return next();
    }

    if (req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) {
        return res.status(401).json({
            success: false,
            message: 'Não autenticado'
        });
    }

    res.redirect('/login');
};

export const requireRole = (requiredRole) => {
    return (req, res, next) => {
        // Se não estiver autenticado, usa a lógica do requireAuth
        if (!req.session || !req.session.isAuthenticated) {
            if (req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) {
                return res.status(401).json({
                    success: false,
                    message: 'Não autenticado'
                });
            }
            return res.redirect('/login');
        }

        const userRole = req.session.role || 'viewer';

        // Hierarquia de roles
        // master > admin > analista > visualizador
        const roles = {
            'master': 4,
            'admin': 3,
            'analista': 2,
            'visualizador': 1,
            'viewer': 1
        };

        const userRoleValue = roles[userRole] || 1;
        const requiredRoleValue = roles[requiredRole] || 1;

        if (userRoleValue >= requiredRoleValue) {
            return next();
        }

        // Se falhar na verificação de permissão
        if (req.path.startsWith('/api') || req.headers.accept?.includes('application/json')) {
            return res.status(403).json({
                success: false,
                message: 'Acesso negado: permissão insuficiente'
            });
        }

        // Se for página, redireciona para dashboard com erro (ou página de erro)
        // Por enquanto, apenas redirecionar para dashboard é seguro
        res.redirect('/dashboard');
    };
};
