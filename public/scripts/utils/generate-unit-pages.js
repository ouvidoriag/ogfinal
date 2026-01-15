/**
 * Utilitário para gerar páginas de unidades de saúde dinamicamente
 * Usado quando uma unidade não tem página HTML pré-definida
 */

const UNIT_NAMES = [
  'adao',
  'cer-iv',
  'hospital-olho',
  'hospital-duque',
  'hospital-infantil',
  'hospital-moacyr',
  'maternidade-santa-cruz',
  'upa-beira-mar',
  'uph-pilar',
  'uph-saracuruna',
  'uph-xerem',
  'hospital-veterinario',
  'upa-walter-garcia',
  'uph-campos-eliseos',
  'uph-parque-equitativa',
  'ubs-antonio-granja',
  'upa-sarapui',
  'uph-imbarie'
];

const UNIT_DISPLAY_NAMES = {
  'adao': 'Hospital Adão',
  'cer-iv': 'CER IV',
  'hospital-olho': 'Hospital do Olho',
  'hospital-duque': 'Hospital Duque',
  'hospital-infantil': 'Hospital Infantil',
  'hospital-moacyr': 'Hospital Moacyr',
  'maternidade-santa-cruz': 'Maternidade Santa Cruz',
  'upa-beira-mar': 'UPA Beira Mar',
  'uph-pilar': 'UPH Pilar',
  'uph-saracuruna': 'UPH Saracuruna',
  'uph-xerem': 'UPH Xerém',
  'hospital-veterinario': 'Hospital Veterinário',
  'upa-walter-garcia': 'UPA Walter Garcia',
  'uph-campos-eliseos': 'UPH Campos Elíseos',
  'uph-parque-equitativa': 'UPH Parque Equitativa',
  'ubs-antonio-granja': 'UBS Antonio Granja',
  'upa-sarapui': 'UPA Sarapuí',
  'uph-imbarie': 'UPH Imbariê'
};

function createUnitPageHTML(unitId) {
  const displayName = UNIT_DISPLAY_NAMES[unitId] || unitId;
  return `
    <section id="page-unit-${unitId}" class="unit-page" style="display: none;">
      <header class="glass rounded-2xl p-6 mb-6">
        <h2 class="neon text-xl font-bold">Total de Assuntos - ${displayName}</h2>
      </header>
      <div class="grid grid-cols-12 gap-6">
        <div class="col-span-12 lg:col-span-8 glass rounded-2xl p-5">
          <h3 class="font-semibold mb-4 text-cyan-400">Assuntos</h3>
          <div class="unit-assuntos space-y-2 max-h-[600px] overflow-y-auto">
            <div class="text-center text-slate-400 py-4">Carregando...</div>
          </div>
        </div>
        <div class="col-span-12 lg:col-span-4 glass rounded-2xl p-5">
          <h3 class="font-semibold mb-4 text-cyan-400">Record Count por Tipo de Ação</h3>
          <canvas class="unit-tipos"></canvas>
        </div>
      </div>
    </section>
  `;
}

function ensureUnitPageExists(unitId) {
  const pageId = `page-unit-${unitId}`;
  let page = document.getElementById(pageId);
  
  if (!page) {
    const pagesContainer = document.getElementById('pages');
    if (pagesContainer) {
      pagesContainer.insertAdjacentHTML('beforeend', createUnitPageHTML(unitId));
      page = document.getElementById(pageId);
    }
  }
  
  return page;
}

if (typeof window !== 'undefined') {
  window.ensureUnitPageExists = ensureUnitPageExists;
  window.UNIT_NAMES = UNIT_NAMES;
  window.UNIT_DISPLAY_NAMES = UNIT_DISPLAY_NAMES;
}

