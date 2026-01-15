/**
 * Módulo: Gestão de Usuários (Admin)
 * Gerencia a listagem e alteração de perfis (RBAC)
 * 
 * CÉREBRO X-3
 * Data: 09/01/2026
 */

(function (window) {
    'use strict';

    /**
     * Inicializa a página de gestão de usuários
     */
    async function loadAdminUsers() {
        if (window.Logger) {
            window.Logger.info('Carregando página de gestão de usuários...');
        }

        const tableBody = document.getElementById('user-table-body');
        const userCountBadge = document.getElementById('user-count-badge');

        if (!tableBody) return;

        try {
            // 1. Buscar usuários da API
            const response = await fetch('/api/users');
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message || 'Erro ao carregar usuários');
            }

            const users = data.users;
            userCountBadge.textContent = users.length;

            // 2. Renderizar tabela
            if (users.length === 0) {
                tableBody.innerHTML = `
          <tr>
            <td colspan="5" class="px-6 py-12 text-center text-slate-500 italic">
              Nenhum usuário encontrado.
            </td>
          </tr>
        `;
                return;
            }

            tableBody.innerHTML = users.map(user => renderUserRow(user)).join('');

            // 3. Adicionar Event Listeners para os selects de roles
            tableBody.querySelectorAll('.role-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const userId = e.target.getAttribute('data-id');
                    const newRole = e.target.value;
                    const oldRole = e.target.getAttribute('data-old-role');

                    if (confirm(`Deseja alterar o nível de acesso de "${e.target.getAttribute('data-username')}" para "${newRole.toUpperCase()}"?`)) {
                        await handleRoleChange(userId, newRole, e.target);
                    } else {
                        // Reverter valor
                        e.target.value = oldRole;
                    }
                });
            });

        } catch (error) {
            console.error('Erro na gestão de usuários:', error);
            tableBody.innerHTML = `
        <tr>
          <td colspan="5" class="px-6 py-12 text-center text-rose-400">
            ❌ Erro ao carregar dados: ${error.message}
          </td>
        </tr>
      `;
        }
    }

    /**
     * Renderiza uma linha da tabela para um usuário
     */
    function renderUserRow(user) {
        const roles = {
            'admin': { label: 'Administrador', color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/30' },
            'manager': { label: 'Gestor', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
            'viewer': { label: 'Visualizador', color: 'text-slate-400', bg: 'bg-slate-400/10', border: 'border-slate-400/30' }
        };

        const currentRole = user.role || 'viewer';
        const date = new Date(user.createdAt).toLocaleDateString('pt-BR');

        return `
      <tr class="hover:bg-white/5 border-b border-white/5 transition-colors">
        <td class="px-6 py-4">
          <div class="font-bold text-slate-200">${user.username}</div>
          <div class="text-[10px] text-slate-500 font-mono">${user.id}</div>
        </td>
        <td class="px-6 py-4">
          <div class="text-sm font-semibold">${user.nomeCompleto}</div>
          <div class="text-xs text-slate-400">${user.cargo}</div>
        </td>
        <td class="px-6 py-4 text-sm text-slate-300">
          ${user.email}
        </td>
        <td class="px-6 py-4">
          <div class="flex justify-center">
            <select 
              class="role-select bg-slate-800 border ${roles[currentRole]?.border || 'border-white/10'} rounded px-2 py-1 text-xs focus:ring-1 focus:ring-cyan-500 outline-none transition-all"
              data-id="${user.id}"
              data-username="${user.username}"
              data-old-role="${currentRole}"
            >
              <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>🥇 Administrador</option>
              <option value="manager" ${currentRole === 'manager' ? 'selected' : ''}>🥈 Gestor</option>
              <option value="viewer" ${currentRole === 'viewer' ? 'selected' : ''}>🥉 Visualizador</option>
            </select>
          </div>
        </td>
        <td class="px-6 py-4 text-right text-xs text-slate-500">
          ${date}
        </td>
      </tr>
    `;
    }

    /**
     * Envia atualização de role para o servidor
     */
    async function handleRoleChange(userId, role, selectElement) {
        try {
            const response = await fetch(`/api/users/${userId}/role`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ role })
            });

            const data = await response.json();

            if (data.success) {
                if (window.Logger) {
                    window.Logger.success(`Sucesso: Perfil de ${data.user.username} alterado para ${role.toUpperCase()}`);
                }

                // Atualizar atributo de backup
                selectElement.setAttribute('data-old-role', role);

                // Atualizar estilos visuais (opcional dependendo da row render)
                // Por simplicidade, recarregamos a lista ou mudamos a borda
                window.location.reload(); // Recarregar garante que a própria sessão/middleware se atualize se for o próprio user
            } else {
                throw new Error(data.message || 'Erro ao atualizar');
            }
        } catch (error) {
            if (window.Logger) {
                window.Logger.error('Falha ao atualizar nível:', error);
            }
            alert('Falha ao atualizar nível: ' + error.message);
            // Reverter valor
            selectElement.value = selectElement.getAttribute('data-old-role');
        }
    }

    // Expor para o sistema de navegação do main.js
    window.loadAdminUsers = loadAdminUsers;

})(window);
