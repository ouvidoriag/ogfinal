import { cleanRecord, canonText, toProperCasePT } from '../../src/utils/cleaner/cleaner.js';

console.log('🧪 Iniciando testes do Data Cleaner...\n');

const testCases = [
    {
        name: "Regra do Assédio (Não se aplica + vazio)",
        input: { tema: "Não se aplica", assunto: "" },
        validate: (output) => output.tema === "Assédio" && output.assunto === "Assédio"
    },
    {
        name: "Regra do Assédio (Não se aplica + Outro)",
        input: { tema: "não se aplica", assunto: "outro" },
        validate: (output) => output.tema === "Assédio" && output.assunto === "Assédio"
    },
    {
        name: "Padronização de Servidor (Lucia Helenba)",
        input: { servidor: "Lucia Helenba Tinoco Pacheco Varella" },
        validate: (output) => output.servidor === "Lúcia Helena Tinoco Pacheco Varella"
    },
    {
        name: "Padronização de Servidor (Stephanie Santos)",
        input: { servidor: "Stéphanie Santoa" },
        validate: (output) => output.servidor === "Stephanie dos Santos Silva"
    },
    {
        name: "Mapeamento de Órgão por Tema (Saúde)",
        input: { tema: "Saúde" },
        validate: (output) => output.orgaos === "Secretaria de Saúde"
    },
    {
        name: "Unidade Cadastro (Ouvidoria Setorial + Educação)",
        input: { unidade_cadastro: "Ouvidoria Setorial", tema: "Educação" },
        validate: (output) => output.unidadeCadastro === "Ouvidoria Setorial de Educação"
    },
    {
        name: "Canal (Fala.BR -> Aplicativo Colab)",
        input: { canal: "Fala.BR" },
        validate: (output) => output.canal === "Aplicativo Colab"
    },
    {
        name: "Status Concluída -> Prazo Restante",
        input: { status_demanda: "Concluída", prazo_restante: "10" },
        validate: (output) => output.prazoRestante === "Demanda Concluída"
    },
    {
        name: "Canonização de Texto (Remover acentos)",
        input: null,
        testFn: () => canonText("Sãó Jõãõ") === "sao joao"
    },
    {
        name: "Proper Case PT",
        input: null,
        testFn: () => toProperCasePT("SECRETARIA DE SAUDE") === "Secretaria de Saude"
    }
];

let passed = 0;
let failed = 0;

testCases.forEach((tc, index) => {
    try {
        let result = false;
        if (tc.testFn) {
            result = tc.testFn();
        } else {
            const output = cleanRecord(tc.input);
            result = tc.validate(output);
            if (!result) {
                console.log(`\n❌ Falha em: ${tc.name}`);
                console.log(`   Input:  `, tc.input);
                console.log(`   Output: `, output);
            }
        }

        if (result) {
            passed++;
            process.stdout.write('.');
        } else {
            failed++;
        }
    } catch (err) {
        console.error(`\n❌ Erro ao processar: ${tc.name}`);
        console.error(err);
        failed++;
    }
});

console.log(`\n\n📊 Resultados: ${passed} passaram, ${failed} falharam.`);

if (failed === 0) {
    console.log('✅ Todos os testes passaram com sucesso!\n');
    process.exit(0);
} else {
    console.log('❌ Alguns testes falharam.\n');
    process.exit(1);
}
