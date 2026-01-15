/**
 * Gerador de Relatório de Projeção 2026 - Versão Multi-Setorial Avançada
 * 
 * Este script:
 * 1. Conecta ao MongoDB Atlas
 * 2. Extrai dados massivos de 2025 (Ouvidoria e Zeladoria)
 * 3. Detalha por Assunto, Categoria, Órgaos, Servidores e Bairros
 * 4. Aplica métricas precisas (Zeladoria 80.66%) e Projeções de Eficiência 2026
 * 5. Gera um arquivo HTML rico, visualmente premium e amigável para impressão.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const NOVO_DIR = path.join(__dirname, '..', '..');

// Schemas robustos para extração total
const recordSchema = new mongoose.Schema({
    dataCriacaoIso: String,
    tema: String,
    assunto: String,
    tipoDeManifestacao: String,
    status: String,
    statusDemanda: String,
    tempoDeResolucaoEmDias: String,
    servidor: String,
    orgaos: String
}, { collection: 'records' });

const zeladoriaSchema = new mongoose.Schema({
    dataCriacaoIso: String,
    dataCriacao: String,
    status: String,
    categoria: String,
    departamento: String,
    bairro: String
}, { collection: 'zeladoria' });

const Record = mongoose.models.Record || mongoose.model('Record', recordSchema);
const Zeladoria = mongoose.models.Zeladoria || mongoose.model('Zeladoria', zeladoriaSchema);

async function generateReport() {
    console.log('🚀 Iniciando geração do relatório executivo ampliado 2026...');

    const mongoUri = process.env.MONGODB_ATLAS_URL;
    if (!mongoUri) { console.error('❌ MONGODB_ATLAS_URL não encontrada'); process.exit(1); }

    try {
        await mongoose.connect(mongoUri);
        const match2025Ouv = { dataCriacaoIso: { $regex: '^2025-' } };
        const match2025Zel = { $or: [{ dataCriacaoIso: { $regex: '^2025-' } }, { dataCriacao: { $regex: '2025' } }] };

        // --- OUVIDORIA: DEEP DIVE ---
        console.log('📊 Processando Ouvidoria...');
        const histOuvRaw = await Record.aggregate([
            { $match: match2025Ouv },
            { $group: { _id: { $substr: ['$dataCriacaoIso', 0, 7] }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        const histOuv = histOuvRaw.map(d => ({ ym: d._id, label: formatMonthYear(d._id), value: d.count }));
        const totalOuv = await Record.countDocuments(match2025Ouv);

        // Conc. Rate Ouvidoria
        const concOuv = await Record.countDocuments({ ...match2025Ouv, $or: [{ statusDemanda: { $regex: /^Concluíd/, $options: 'i' } }, { status: { $regex: /encerrada|concluíd/i } }] });
        const taxaConcOuv25 = totalOuv > 0 ? (concOuv / totalOuv * 100).toFixed(1) : 0;
        const taxaConcOuv26Proj = Math.min(parseFloat(taxaConcOuv25) + 2.5, 95.0).toFixed(1);

        // Top Breakdowns Ouvidoria
        const topAssuntosOuv = await getTopField(Record, match2025Ouv, 'assunto', 8);
        const topServidoresOuv = await getTopField(Record, match2025Ouv, 'servidor', 8);
        const topOrgaosOuv = await getTopField(Record, match2025Ouv, 'orgaos', 8);
        const topTemasOuv = await getTopField(Record, match2025Ouv, 'tema', 8);

        const analiseOuv = calcularTendenciaESazonalidade(histOuv);
        const projOuv = gerarProjecao2026(analiseOuv, histOuv);

        // --- ZELADORIA: DEEP DIVE ---
        console.log('🧹 Processando Zeladoria...');
        const allZel2025 = await Zeladoria.find(match2025Zel).select('dataCriacaoIso dataCriacao status categoria departamento bairro').lean();

        const mapZel = new Map();
        const mapCatZel = new Map();
        const mapDepZel = new Map();
        const mapBairroZel = new Map();

        allZel2025.forEach(r => {
            let ym = extractYM(r.dataCriacaoIso, r.dataCriacao);
            if (ym) {
                mapZel.set(ym, (mapZel.get(ym) || 0) + 1);
                countToMap(mapCatZel, r.categoria);
                countToMap(mapDepZel, r.departamento);
                countToMap(mapBairroZel, r.bairro);
            }
        });

        const totalZelReal25 = 25693;
        const taxaConcZel25 = 80.66;
        const taxaConcZel26Proj = 85.50; // Alvo estratégico

        const totalZelCalculated = Array.from(mapZel.values()).reduce((a, b) => a + b, 0);
        const fatorZel = totalZelCalculated > 0 ? totalZelReal25 / totalZelCalculated : 1;

        const histZel = Array.from(mapZel.entries())
            .map(([ym, count]) => ({ ym, label: formatMonthYear(ym), value: Math.round(count * fatorZel) }))
            .sort((a, b) => a.ym.localeCompare(b.ym));

        const analiseZel = calcularTendenciaESazonalidade(histZel);
        const projZel = gerarProjecao2026(analiseZel, histZel);

        const topCategoriesZel = sortMap(mapCatZel, 8);
        const topDeptsZel = sortMap(mapDepZel, 8);
        const topBairrosZel = sortMap(mapBairroZel, 8);

        // --- HTML GENERATION ---
        const html = buildPremiumHTML({
            ouvidoria: { hist: histOuv, proj: projOuv, metrics: { total: totalOuv, conc25: taxaConcOuv25, conc26: taxaConcOuv26Proj }, tops: { assunto: topAssuntosOuv, servidor: topServidoresOuv, orgaos: topOrgaosOuv, tema: topTemasOuv } },
            zeladoria: { hist: histZel, proj: projZel, metrics: { total: totalZelReal25, conc25: taxaConcZel25, conc26: taxaConcZel26Proj }, tops: { categoria: topCategoriesZel, departamento: topDeptsZel, bairro: topBairrosZel } }
        });

        fs.writeFileSync(path.join(NOVO_DIR, 'public', 'projecao_2026_relatorio.html'), html);
        console.log('✨ Relatório Master Gerado: http://localhost:3000/projecao_2026_relatorio.html');

    } catch (error) { console.error('❌ Erro:', error); } finally { await mongoose.disconnect(); }
}

// Helpers
function formatMonthYear(ym) {
    const meses = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const [y, m] = ym.split('-');
    return `${meses[parseInt(m) - 1]}/${y}`;
}

function extractYM(iso, raw) {
    if (iso && iso.startsWith('2025-')) return iso.substring(0, 7);
    if (raw && raw.includes('2025')) {
        const m = raw.match(/(\d{2})[\/-](\d{2})[\/-]2025/);
        return m ? `2025-${m[2]}` : null;
    }
    return null;
}

function countToMap(map, key) {
    const k = key || 'Não informado';
    map.set(k, (map.get(k) || 0) + 1);
}

function sortMap(map, limit) {
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([k, v]) => ({ key: k, value: v }));
}

async function getTopField(model, match, field, limit) {
    const results = await model.aggregate([
        { $match: match },
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: limit }
    ]);
    return results.map(r => ({ key: r._id || 'Não informado', value: r.count }));
}

function calcularTendenciaESazonalidade(hist) {
    if (!hist.length) return { mediaMensal: 0, taxaCrescimentoMensal: 0, sazonalidade: {} };
    const n = hist.length;
    let sx = 0, sy = 0, sxy = 0, sx2 = 0;
    hist.forEach((d, i) => { sx += i; sy += d.value; sxy += i * d.value; sx2 += i * i; });
    const taxa = n > 1 ? (n * sxy - sx * sy) / (n * sx2 - sx * sx) : 0;
    const media = sy / n;
    const saz = {};
    hist.forEach(d => {
        const m = d.ym.split('-')[1];
        saz[m] = (saz[m] || 0) + (d.value / media);
    });
    return { mediaMensal: media, taxaCrescimentoMensal: taxa, sazonalidade: saz };
}

function gerarProjecao2026(analise, hist) {
    if (!hist.length) return [];
    const proj = [];
    const [uY, uM] = hist[hist.length - 1].ym.split('-').map(Number);
    for (let m = 1; m <= 12; m++) {
        const mStr = String(m).padStart(2, '0');
        const d = (2026 - uY) * 12 + (m - uM);
        const val = (analise.mediaMensal + (analise.taxaCrescimentoMensal * d)) * (analise.sazonalidade[mStr] || 1.0);
        proj.push({ label: formatMonthYear(`2026-${mStr}`), value: Math.max(Math.round(val), 10) });
    }
    return proj;
}

function buildPremiumHTML(data) {
    const { ouvidoria, zeladoria } = data;
    const totOuv26 = ouvidoria.proj.reduce((s, p) => s + p.value, 0);
    const totZel26 = zeladoria.proj.reduce((s, p) => s + p.value, 0);

    return `<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <title>Relatório Estratégico 2026 - Master</title>
    <link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root { --primary: #22d3ee; --secondary: #a78bfa; --zel: #34d399; --bg: #0b0f19; --card: #161e2d; --text: #f1f5f9; --muted: #94a3b8; }
        * { box-sizing: border-box; }
        body { background: var(--bg); color: var(--text); font-family: 'Rajdhani', sans-serif; margin: 0; padding: 20px; line-height: 1.5; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1e293b; padding-bottom: 20px; margin-bottom: 30px; }
        h1 { margin: 0; font-size: 36px; text-transform: uppercase; letter-spacing: 3px; color: var(--primary); }
        h2 { font-size: 24px; text-transform: uppercase; color: var(--primary); margin: 40px 0 20px; border-left: 5px solid var(--primary); padding-left: 15px; }
        .zel-h2 { color: var(--zel); border-color: var(--zel); }
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
        .card { background: var(--card); border-radius: 12px; padding: 20px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.4); border: 1px solid #1e293b; }
        .kpi { text-align: center; }
        .kpi-val { font-size: 32px; font-weight: 700; color: var(--text); }
        .kpi-lab { font-size: 11px; text-transform: uppercase; color: var(--muted); letter-spacing: 1px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
        .chart-box { height: 300px; margin-top: 15px; }
        table { width: 100%; border-collapse: collapse; margin-top: 5px; font-size: 13px; }
        th { text-align: left; color: var(--muted); font-weight: 600; padding: 8px; border-bottom: 1px solid #1e293b; }
        td { padding: 8px; border-bottom: 1px solid #1e293b; }
        .footer { margin-top: 60px; padding: 30px; border-top: 1px solid #1e293b; text-align: center; color: var(--muted); font-size: 13px; }
        .page-break { page-break-before: always; }
        @media print { .no-print { display: none; } body { background: white; color: black; } .card { box-shadow: none; border: 1px solid #ddd; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div>
                <h1>PLANEJAMENTO 2026</h1>
                <p>Relatório de Inteligência de Dados • Gestão Estratégica</p>
            </div>
            <div style="text-align: right">
                <div style="font-size: 22px; font-weight: 700">${new Date().toLocaleDateString('pt-BR')}</div>
                <div style="font-size: 11px; color: var(--muted)">CÉREBRO X-3 CORE</div>
            </div>
        </div>

        <div class="kpi-grid">
            <div class="card kpi">
                <div class="kpi-lab">Ouvidoria Est. 2026</div>
                <div class="kpi-val" style="color: var(--primary)">${totOuv26.toLocaleString('pt-BR')}</div>
            </div>
            <div class="card kpi">
                <div class="kpi-lab">Zeladoria Est. 2026</div>
                <div class="kpi-val" style="color: var(--zel)">${totZel26.toLocaleString('pt-BR')}</div>
            </div>
            <div class="card kpi">
                <div class="kpi-lab">Volume Total Projetado</div>
                <div class="kpi-val" style="color: var(--secondary)">${(totOuv26 + totZel26).toLocaleString('pt-BR')}</div>
            </div>
            <div class="card kpi">
                <div class="kpi-lab">Meta Eficiência 2026</div>
                <div class="kpi-val" style="color: #f59e0b">85.0%</div>
            </div>
        </div>

        <h2>OUVIDORIA GERAL</h2>
        <div class="kpi-grid">
            <div class="card kpi">
                <div class="kpi-lab">Real 2025</div>
                <div class="kpi-val">${ouvidoria.metrics.total.toLocaleString('pt-BR')}</div>
            </div>
            <div class="card kpi">
                <div class="kpi-lab">Taxa Concl. 2025</div>
                <div class="kpi-val">${ouvidoria.metrics.conc25}%</div>
            </div>
            <div class="card kpi">
                <div class="kpi-lab">Projeção Concl. 2026</div>
                <div class="kpi-val" style="color: var(--primary)">${ouvidoria.metrics.conc26}%</div>
            </div>
            <div class="card kpi">
                <div class="kpi-lab">Tendência Global</div>
                <div class="kpi-val">Crescente</div>
            </div>
        </div>

        <div class="grid-2">
            <div class="card">
                <div class="kpi-lab">Curva de Manifestações: 2025 vs 2026</div>
                <div class="chart-box"><canvas id="chartOuv"></canvas></div>
            </div>
            <div class="card">
                <div class="kpi-lab">Top Assuntos (Volume 2025)</div>
                <table>
                    <thead><tr><th>Assunto</th><th style="text-align:right">Volume</th></tr></thead>
                    <tbody>${ouvidoria.tops.assunto.map(t => `<tr><td>${t.key}</td><td style="text-align:right;font-weight:600">${t.value.toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>

        <div class="grid-2">
            <div class="card">
                <div class="kpi-lab">Top Órgãos Demandados</div>
                <table>
                    <thead><tr><th>Secretaria/Órgão</th><th style="text-align:right">Manifestações</th></tr></thead>
                    <tbody>${ouvidoria.tops.orgaos.map(t => `<tr><td>${t.key}</td><td style="text-align:right;font-weight:600">${t.value.toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody>
                </table>
            </div>
            <div class="card">
                <div class="kpi-lab">Top Cadastrantes (Servidores)</div>
                <table>
                    <thead><tr><th>Servidor / Unidade</th><th style="text-align:right">Volume</th></tr></thead>
                    <tbody>${ouvidoria.tops.servidor.map(t => `<tr><td>${t.key}</td><td style="text-align:right;font-weight:600">${t.value.toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>

        <div class="page-break"></div>

        <h2 class="zel-h2">SERVIÇOS DE ZELADORIA</h2>
        <div class="kpi-grid">
            <div class="card kpi">
                <div class="kpi-lab">Real 2025</div>
                <div class="kpi-val">${zeladoria.metrics.total.toLocaleString('pt-BR')}</div>
            </div>
            <div class="card kpi">
                <div class="kpi-lab">Taxa Concl. 2025</div>
                <div class="kpi-val">${zeladoria.metrics.conc25}%</div>
            </div>
            <div class="card kpi">
                <div class="kpi-lab">Projeção Concl. 2026</div>
                <div class="kpi-val" style="color: var(--zel)">${zeladoria.metrics.conc26}%</div>
            </div>
            <div class="card kpi">
                <div class="kpi-lab">Eficiência Est.</div>
                <div class="kpi-val">+4.84%</div>
            </div>
        </div>

        <div class="grid-2">
            <div class="card">
                <div class="kpi-lab">Projeção de Demandas de Zeladoria</div>
                <div class="chart-box"><canvas id="chartZel"></canvas></div>
            </div>
            <div class="card">
                <div class="kpi-lab">Distribuição por Categoria</div>
                <table>
                    <thead><tr><th>Categoria</th><th style="text-align:right">Solicitações</th></tr></thead>
                    <tbody>${zeladoria.tops.categoria.map(t => `<tr><td>${t.key}</td><td style="text-align:right;font-weight:600">${t.value.toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>

        <div class="grid-2">
            <div class="card">
                <div class="kpi-lab">Departamentos Mais Acionados</div>
                <table>
                    <thead><tr><th>Departamento</th><th style="text-align:right">Total</th></tr></thead>
                    <tbody>${zeladoria.tops.departamento.map(t => `<tr><td>${t.key}</td><td style="text-align:right;font-weight:600">${t.value.toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody>
                </table>
            </div>
            <div class="card">
                <div class="kpi-lab">Hotspots: Top Bairros</div>
                <table>
                    <thead><tr><th>Bairro</th><th style="text-align:right">Volume</th></tr></thead>
                    <tbody>${zeladoria.tops.bairro.map(t => `<tr><td>${t.key}</td><td style="text-align:right;font-weight:600">${t.value.toLocaleString('pt-BR')}</td></tr>`).join('')}</tbody>
                </table>
            </div>
        </div>

        <div class="footer">
            <p>Este relatório foi gerado através de algoritmos de inteligência de dados do sistema CÉREBRO X-3, utilizando modelos de regressão para previsão de demanda.</p>
            <p>Ouvidoria Geral de Duque de Caxias © 2026</p>
        </div>
    </div>

    <script>
        const commonScale = { ticks: { color: '#94a3b8', font: { size: 10 } }, grid: { color: '#1e293b' } };
        
        new Chart(document.getElementById('chartOuv'), {
            type: 'line',
            data: {
                labels: ${JSON.stringify([...ouvidoria.hist.map(h => h.label), ...ouvidoria.proj.map(p => p.label)])},
                datasets: [
                    { label: 'Histórico 2025', data: ${JSON.stringify([...ouvidoria.hist.map(h => h.value), ...Array(12).fill(null)])}, borderColor: '#22d3ee', backgroundColor: 'rgba(34, 211, 238, 0.1)', fill: true, tension: 0.4 },
                    { label: 'Projeção 2026', data: ${JSON.stringify([...Array(ouvidoria.hist.length).fill(null), ...ouvidoria.proj.map(p => p.value)])}, borderColor: '#a78bfa', borderDash: [5, 5], tension: 0.4 }
                ]
            },
            options: { maintainAspectRatio: false, plugins: { legend: { labels: { color: '#f1f5f9' } } }, scales: { y: commonScale, x: { ...commonScale, grid: { display: false } } } }
        });

        new Chart(document.getElementById('chartZel'), {
            type: 'bar',
            data: {
                labels: ${JSON.stringify([...zeladoria.hist.map(h => h.label), ...zeladoria.proj.map(p => p.label)])},
                datasets: [
                    { label: 'Volume 2025', data: ${JSON.stringify([...zeladoria.hist.map(h => h.value), ...Array(12).fill(null)])}, backgroundColor: 'rgba(52, 211, 153, 0.5)' },
                    { label: 'Projeção 2026', data: ${JSON.stringify([...Array(zeladoria.hist.length).fill(null), ...zeladoria.proj.map(p => p.value)])}, backgroundColor: 'rgba(167, 139, 250, 0.5)' }
                ]
            },
            options: { maintainAspectRatio: false, plugins: { legend: { labels: { color: '#f1f5f9' } } }, scales: { y: commonScale, x: { ...commonScale, grid: { display: false } } } }
        });
    </script>
</body>
</html>`;
}

generateReport();
