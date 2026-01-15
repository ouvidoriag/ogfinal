import {
    SERVER_NAME_MAP,
    THEME_TO_SECRETARIAT_MAP,
    THEME_TO_OMBUDSMAN_MAP,
    UNIT_NAME_MAP,
    RESPONSIBLE_TO_OMBUDSMAN_MAP
} from './mappings.js';

/**
 * Canonização de texto: remove acentos, converte para lowercase e limpa espaços extras.
 */
export function canonText(v) {
    if (v === null || v === undefined || String(v).trim() === "") return "";
    let s = String(v).trim();
    // Remover acentos
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, "");
    // Lowercase
    s = s.toLowerCase();
    // Limpar espaços extras
    s = s.replace(/\s+/g, ' ');
    return s.trim();
}

/**
 * Converte para Title Case no padrão PT-BR (preserva conectivos em minúsculo).
 */
export function toProperCasePT(text) {
    if (!text || typeof text !== 'string' || !text.trim()) return text;
    const conectivos = ['de', 'da', 'do', 'dos', 'das', 'e', 'a', 'o', 'em'];
    const acronyms = ["uac", "upa", "uph", "cer", "iv", "ubs", "cm", "psf"];

    const words = text.toLowerCase().split(/\s+/);
    const capitalized = words.map((word, index) => {
        if (acronyms.includes(word)) return word.toUpperCase();
        if (index === 0 || !conectivos.includes(word)) {
            return word.charAt(0).toUpperCase() + word.slice(1);
        }
        return word;
    });

    return capitalized.join(' ');
}

// Criar versões normalizadas dos mapas para lookup rápido
const NORM_THEME_SECRETARIAT = Object.fromEntries(
    Object.entries(THEME_TO_SECRETARIAT_MAP).map(([k, v]) => [canonText(k), v])
);

const NORM_THEME_OMBUDSMAN = Object.fromEntries(
    Object.entries(THEME_TO_OMBUDSMAN_MAP).map(([k, v]) => [canonText(k), v])
);

const NORM_UNIT_NAME = Object.fromEntries(
    Object.entries(UNIT_NAME_MAP).map(([k, v]) => [canonText(k), v])
);

const NORM_RESPONSIBLE_OMBUDSMAN = Object.fromEntries(
    Object.entries(RESPONSIBLE_TO_OMBUDSMAN_MAP).map(([k, v]) => [canonText(k), v])
);

/**
 * Aplica regras de negócio e mapeamentos a um único registro.
 * Aceita tanto snake_case (planilha) quanto camelCase (modelo).
 */
export function cleanRecord(record) {
    const cleaned = { ...record };

    // 1. Tratamento de Tema/Assunto (Regra do Assédio)
    const tema = cleaned.tema || cleaned.Tema || "";
    const assunto = cleaned.assunto || cleaned.Assunto || "";

    const temaRaw = String(tema).trim().toLowerCase();
    const assuntoRaw = String(assunto).trim().toLowerCase();
    const genericSubjects = ["outro", "outros", "na", "n/a", "n\\a", ""];

    if (temaRaw === "não se aplica" || temaRaw === "nao se aplica") {
        if (genericSubjects.includes(assuntoRaw)) {
            cleaned.assunto = "Assédio";
        }
        cleaned.tema = "Assédio";
    }

    // 2. Padronização de Servidor
    const servidorRaw = String(cleaned.servidor || "").trim();
    if (SERVER_NAME_MAP[servidorRaw]) {
        cleaned.servidor = SERVER_NAME_MAP[servidorRaw];
    }

    // 3. Mapeamento de Órgãos (Secretarias) por Tema
    const temaNorm = canonText(cleaned.tema || "");
    if (temaNorm) {
        const orgao = NORM_THEME_SECRETARIAT[temaNorm];
        if (orgao) {
            cleaned.orgaos = orgao;
        } else if (!cleaned.orgaos || String(cleaned.orgaos).trim() === "") {
            cleaned.orgaos = "Secretaria de Comunicação, Relações Públicas, Trabalho, Emprego e Renda";
        }
    }

    // 4. Padronização de Unidade Cadastro/Ouvidoria
    let unidade = String(cleaned.unidade_cadastro || cleaned.unidadeCadastro || "").trim();
    const unidadeNorm = canonText(unidade);

    if (/^ouvidoria\s+setorial$/i.test(unidade)) {
        const tNorm = canonText(cleaned.tema || "");
        if (NORM_THEME_OMBUDSMAN[tNorm]) {
            unidade = NORM_THEME_OMBUDSMAN[tNorm];
        } else {
            unidade = "Ouvidoria Geral";
        }
    } else if (NORM_UNIT_NAME[unidadeNorm]) {
        unidade = NORM_UNIT_NAME[unidadeNorm];
    }

    // Sincronizar campos de unidade
    cleaned.unidadeCadastro = unidade;
    if (cleaned.unidade_cadastro !== undefined) cleaned.unidade_cadastro = unidade;

    // 5. Responsável -> Ouvidoria (Fallback)
    const responsavelRaw = String(cleaned.responsavel || "").trim();
    const respNorm = canonText(responsavelRaw);
    if (NORM_RESPONSIBLE_OMBUDSMAN[respNorm]) {
        cleaned.responsavel = NORM_RESPONSIBLE_OMBUDSMAN[respNorm];
    } else if (/^ouvidoria\s+geral$/i.test(responsavelRaw)) {
        cleaned.responsavel = "Ouvidoria Geral";
    } else if (/^cidadao$|^sim$|^true$/i.test(responsavelRaw)) {
        cleaned.responsavel = "Cidadão";
    }

    // 6. Canal
    const canalValue = String(cleaned.canal || "").trim();
    if (/^Colab Gov$|^Portal Cidadão$|^Fala\.BR$|^Online$/i.test(canalValue)) {
        cleaned.canal = "Aplicativo Colab";
    }

    // 7. Status Demanda / Prazo Restante
    const statusValue = cleaned.status_demanda || cleaned.statusDemanda || "";
    const statusNorm = canonText(statusValue);
    if (statusNorm === "concluida" || statusNorm === "concluída") {
        cleaned.prazoRestante = "Demanda Concluída";
        if (cleaned.prazo_restante !== undefined) cleaned.prazo_restante = "Demanda Concluída";
    }

    // 8. Limpeza de espaços final em todos os campos string
    for (const key in cleaned) {
        if (typeof cleaned[key] === 'string') {
            cleaned[key] = cleaned[key].trim();
        }
    }

    return cleaned;
}
