/**
 * Utilitário Frontend: Informações de Secretarias
 *
 * - Abre modal com dados das secretarias (planilha Dados e emails.xlsx)
 * - Permite selecionar uma secretaria e abrir página de impressão A4
 */

(function () {
  const state = {
    items: [],
    selectedId: null,
    isLoading: false,
  };

  function qs(id) {
    return document.getElementById(id);
  }

  function showModal() {
    const modal = qs('secretariasInfoModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    modal.style.display = 'flex'; // Forçar display flex

    // Sempre recarregar dados ao abrir o modal (para garantir dados atualizados)
    loadData(false);
  }

  function hideModal() {
    const modal = qs('secretariasInfoModal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    modal.style.display = 'none'; // Forçar display none
  }

  async function loadData(forceRefresh = false) {
    const loadingEl = qs('secretariasInfoLoading');
    const errorEl = qs('secretariasInfoError');
    const listWrapper = qs('secretariasInfoList');
    const tableBody = qs('secretariasInfoTableBody');
    const summaryEl = qs('secretariasInfoSummary');
    const printBtn = qs('secretariasInfoPrint');

    if (!loadingEl || !errorEl || !listWrapper || !tableBody || !summaryEl || !printBtn) {
      return;
    }

    state.isLoading = true;
    state.selectedId = null;
    printBtn.disabled = true;
    tableBody.innerHTML = '';
    loadingEl.classList.remove('hidden');
    errorEl.classList.add('hidden');
    listWrapper.classList.add('hidden');
    summaryEl.textContent = 'Carregando dados das secretarias...';

    try {
      // Invalidar cache se forçar refresh
      if (forceRefresh && window.dataStore) {
        window.dataStore.invalidate(['/api/secretarias-info']);
      }

      const data = await window.dataLoader?.load('/api/secretarias-info', {
        useDataStore: !forceRefresh, // Não usar cache se forçar refresh
        ttl: 60 * 60 * 1000, // 1 hora
      });

      const items = Array.isArray(data?.items) ? data.items : [];
      state.items = items;

      if (items.length === 0) {
        summaryEl.textContent =
          'Nenhuma informação de secretaria encontrada. Verifique se a planilha "Dados e emails.xlsx" foi importada.';
        loadingEl.classList.add('hidden');
        listWrapper.classList.add('hidden');
        return;
      }

      const rowsHtml = items
        .map(
          (s, index) => `
          <tr class="hover:bg-white/5 transition-colors">
            <td class="px-3 py-2 text-center">
              <input 
                type="radio" 
                name="secretaria-select" 
                value="${s.id}" 
                aria-label="Selecionar ${s.name || s.acronym || 'Secretaria'}"
                class="cursor-pointer"
                ${index === 0 ? 'checked' : ''}
              />
            </td>
            <td class="px-3 py-2">
              <div class="font-semibold text-slate-100">${s.name || s.acronym || 'N/A'}</div>
              ${
                s.acronym && s.name && s.acronym !== s.name
                  ? `<div class="text-xs text-slate-400 mt-0.5">${s.acronym}</div>`
                  : ''
              }
            </td>
            <td class="px-3 py-2 text-slate-200">
              ${s.email || '<span class="text-slate-500">—</span>'}
              ${
                s.alternateEmail
                  ? `<div class="text-xs text-slate-400 mt-0.5">${s.alternateEmail}</div>`
                  : ''
              }
            </td>
            <td class="px-3 py-2 text-slate-200">
              ${s.phone || '<span class="text-slate-500">—</span>'}
              ${
                s.phoneAlt
                  ? `<div class="text-xs text-slate-400 mt-0.5">${s.phoneAlt}</div>`
                  : ''
              }
            </td>
            <td class="px-3 py-2 text-slate-200">
              ${s.district || '<span class="text-slate-500">—</span>'}
            </td>
          </tr>
        `
        )
        .join('');

      tableBody.innerHTML = rowsHtml;

      // Selecionar o primeiro por padrão (se existir)
      const first = items[0];
      if (first && first.id) {
        state.selectedId = first.id;
        printBtn.disabled = false;
      }

      // Delegação de eventos para os radios
      tableBody.addEventListener('change', (ev) => {
        const target = ev.target;
        if (target && target.name === 'secretaria-select') {
          state.selectedId = target.value;
          printBtn.disabled = !state.selectedId;
        }
      });

      summaryEl.textContent = `${items.length} secretaria(s) carregada(s) a partir da planilha "Dados e emails.xlsx".`;
      loadingEl.classList.add('hidden');
      listWrapper.classList.remove('hidden');
    } catch (error) {
      console.error('Erro ao carregar /api/secretarias-info:', error);
      loadingEl.classList.add('hidden');
      listWrapper.classList.add('hidden');
      errorEl.classList.remove('hidden');
      summaryEl.textContent = 'Erro ao carregar informações de secretarias.';
    } finally {
      state.isLoading = false;
    }
  }

  function initEvents() {
    const openBtn = qs('secretariasInfoButton');
    const closeBtn = qs('secretariasInfoClose');
    const cancelBtn = qs('secretariasInfoCancel');
    const modal = qs('secretariasInfoModal');
    const printBtn = qs('secretariasInfoPrint');

    if (openBtn) {
      openBtn.addEventListener('click', () => {
        showModal();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => hideModal());
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => hideModal());
    }

    if (modal) {
      modal.addEventListener('click', (ev) => {
        if (ev.target === modal) {
          hideModal();
        }
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', () => {
        if (!state.selectedId) return;
        const url = `/secretarias-print?id=${encodeURIComponent(state.selectedId)}`;
        window.open(url, '_blank', 'noopener');
      });
    }
  }

  // Garantir que o modal comece oculto
  function ensureModalHidden() {
    const modal = qs('secretariasInfoModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
      modal.style.display = 'none';
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensureModalHidden();
      initEvents();
    });
  } else {
    ensureModalHidden();
    initEvents();
  }

  // Exportar para debug, se necessário
  window.secretariasInfo = {
    open: showModal,
    load: loadData,
  };
})();


