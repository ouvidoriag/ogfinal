/**
 * UI para Filtros Compostos (OR/AND)
 * 
 * Interface visual para criar e gerenciar filtros compostos
 * 
 * Data: 2025-01-XX
 * CÉREBRO X-3
 */

(function() {
  'use strict';

  /**
   * Sistema de UI para Filtros Compostos
   */
  window.compositeFiltersUI = {
    /**
     * Criar modal para construir filtro composto
     * @param {Function} onSave - Callback quando salvar
     * @param {Object} initialFilter - Filtro inicial (opcional)
     */
    showBuilder(onSave, initialFilter = null) {
      // Remover modal existente
      const existing = document.getElementById('composite-filter-modal');
      if (existing) {
        existing.remove();
      }

      // Criar modal
      const modal = document.createElement('div');
      modal.id = 'composite-filter-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
      `;

      const content = document.createElement('div');
      content.style.cssText = `
        background: white;
        border-radius: 12px;
        padding: 24px;
        max-width: 700px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        width: 90%;
      `;

      // Título
      const title = document.createElement('h2');
      title.textContent = 'Criar Filtro Composto';
      title.style.cssText = 'margin: 0 0 20px 0; font-size: 20px; color: #333;';
      content.appendChild(title);

      // Estado do filtro composto
      let compositeFilter = initialFilter || {
        operator: 'AND',
        filters: []
      };

      // Container de grupos
      const groupsContainer = document.createElement('div');
      groupsContainer.id = 'composite-filter-groups';
      content.appendChild(groupsContainer);

      /**
       * Renderizar grupos de filtros
       */
      const renderGroups = () => {
        groupsContainer.innerHTML = '';

        if (compositeFilter.filters.length === 0) {
          const empty = document.createElement('div');
          empty.style.cssText = 'padding: 20px; text-align: center; color: #999;';
          empty.textContent = 'Nenhum filtro adicionado. Clique em "Adicionar Filtro" para começar.';
          groupsContainer.appendChild(empty);
          return;
        }

        compositeFilter.filters.forEach((filter, index) => {
          const groupEl = this.createFilterGroup(filter, index, (updatedFilter) => {
            compositeFilter.filters[index] = updatedFilter;
            renderGroups();
          }, () => {
            compositeFilter.filters.splice(index, 1);
            renderGroups();
          });
          groupsContainer.appendChild(groupEl);
        });
      };

      // Controles
      const controls = document.createElement('div');
      controls.style.cssText = 'margin-top: 20px; display: flex; gap: 10px; align-items: center;';

      // Operador
      const operatorLabel = document.createElement('label');
      operatorLabel.textContent = 'Operador:';
      operatorLabel.style.cssText = 'font-weight: 500; margin-right: 8px;';
      controls.appendChild(operatorLabel);

      const operatorSelect = document.createElement('select');
      operatorSelect.value = compositeFilter.operator;
      operatorSelect.style.cssText = 'padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px;';
      operatorSelect.innerHTML = '<option value="AND">AND (todos devem ser verdadeiros)</option><option value="OR">OR (qualquer um pode ser verdadeiro)</option>';
      operatorSelect.onchange = (e) => {
        compositeFilter.operator = e.target.value;
      };
      controls.appendChild(operatorSelect);

      content.appendChild(controls);

      // Botão adicionar filtro
      const addButton = document.createElement('button');
      addButton.textContent = '+ Adicionar Filtro';
      addButton.style.cssText = `
        margin-top: 16px;
        padding: 10px 16px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        width: 100%;
      `;
      addButton.onclick = () => {
        compositeFilter.filters.push({
          field: '',
          op: 'eq',
          value: ''
        });
        renderGroups();
      };
      content.appendChild(addButton);

      // Botões de ação
      const actions = document.createElement('div');
      actions.style.cssText = 'margin-top: 20px; display: flex; gap: 10px;';

      const cancelButton = document.createElement('button');
      cancelButton.textContent = 'Cancelar';
      cancelButton.style.cssText = `
        flex: 1;
        padding: 10px;
        background: #f0f0f0;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      `;
      cancelButton.onclick = () => {
        modal.remove();
      };
      actions.appendChild(cancelButton);

      const saveButton = document.createElement('button');
      saveButton.textContent = 'Salvar Filtro';
      saveButton.style.cssText = `
        flex: 1;
        padding: 10px;
        background: #667eea;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      `;
      saveButton.onclick = () => {
        if (compositeFilter.filters.length === 0) {
          alert('Adicione pelo menos um filtro');
          return;
        }

        // Validar filtros
        const invalid = compositeFilter.filters.find(f => !f.field || !f.value);
        if (invalid) {
          alert('Preencha todos os campos dos filtros');
          return;
        }

        if (onSave) {
          onSave(compositeFilter);
        }
        modal.remove();
      };
      actions.appendChild(saveButton);

      content.appendChild(actions);

      // Renderizar grupos iniciais
      renderGroups();

      modal.appendChild(content);
      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.remove();
        }
      };

      document.body.appendChild(modal);
    },

    /**
     * Criar grupo de filtro individual
     * @private
     */
    createFilterGroup(filter, index, onUpdate, onRemove) {
      const group = document.createElement('div');
      group.style.cssText = `
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 16px;
        margin-bottom: 12px;
        background: #f9f9f9;
      `;

      const header = document.createElement('div');
      header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;';
      
      const label = document.createElement('span');
      label.textContent = `Filtro ${index + 1}`;
      label.style.cssText = 'font-weight: 600; color: #333;';
      header.appendChild(label);

      const removeBtn = document.createElement('button');
      removeBtn.textContent = '×';
      removeBtn.style.cssText = `
        background: #ff4444;
        color: white;
        border: none;
        width: 24px;
        height: 24px;
        border-radius: 50%;
        cursor: pointer;
        font-size: 18px;
        line-height: 1;
      `;
      removeBtn.onclick = onRemove;
      header.appendChild(removeBtn);

      group.appendChild(header);

      // Campo
      const fieldLabel = document.createElement('label');
      fieldLabel.textContent = 'Campo:';
      fieldLabel.style.cssText = 'display: block; margin-bottom: 4px; font-size: 12px; color: #666;';
      group.appendChild(fieldLabel);

      const fieldSelect = document.createElement('select');
      fieldSelect.value = filter.field || '';
      fieldSelect.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 12px;';
      fieldSelect.innerHTML = `
        <option value="">Selecione um campo</option>
        <option value="statusDemanda">Status</option>
        <option value="tema">Tema</option>
        <option value="assunto">Assunto</option>
        <option value="secretaria">Secretaria</option>
        <option value="tipoDeManifestacao">Tipo</option>
        <option value="canal">Canal</option>
        <option value="prioridade">Prioridade</option>
        <option value="unidadeCadastro">Unidade</option>
        <option value="bairro">Bairro</option>
        <option value="dataCriacaoIso">Data de Criação</option>
      `;
      fieldSelect.onchange = (e) => {
        filter.field = e.target.value;
        onUpdate(filter);
      };
      group.appendChild(fieldSelect);

      // Operador
      const opLabel = document.createElement('label');
      opLabel.textContent = 'Operador:';
      opLabel.style.cssText = 'display: block; margin-bottom: 4px; font-size: 12px; color: #666;';
      group.appendChild(opLabel);

      const opSelect = document.createElement('select');
      opSelect.value = filter.op || 'eq';
      opSelect.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 12px;';
      opSelect.innerHTML = `
        <option value="eq">Igual a (=)</option>
        <option value="in">Está em (múltiplos valores)</option>
        <option value="contains">Contém</option>
        <option value="gte">Maior ou igual (≥)</option>
        <option value="lte">Menor ou igual (≤)</option>
        <option value="gt">Maior que (>)</option>
        <option value="lt">Menor que (<)</option>
      `;
      opSelect.onchange = (e) => {
        filter.op = e.target.value;
        onUpdate(filter);
      };
      group.appendChild(opSelect);

      // Valor
      const valueLabel = document.createElement('label');
      valueLabel.textContent = 'Valor:';
      valueLabel.style.cssText = 'display: block; margin-bottom: 4px; font-size: 12px; color: #666;';
      group.appendChild(valueLabel);

      const valueInput = document.createElement('input');
      valueInput.type = 'text';
      valueInput.value = filter.value || '';
      valueInput.placeholder = 'Digite o valor ou valores separados por vírgula';
      valueInput.style.cssText = 'width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;';
      valueInput.onchange = (e) => {
        filter.value = e.target.value;
        onUpdate(filter);
      };
      group.appendChild(valueInput);

      return group;
    }
  };

  if (window.Logger) {
    window.Logger.debug('CompositeFiltersUI: Sistema de UI para filtros compostos inicializado');
  }
})();

