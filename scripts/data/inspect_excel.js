
import XLSX from 'xlsx';
import path from 'path';

const excelPath = 'c:\\Users\\501379.PMDC\\Desktop\\DRIVE\\Dashboard\\E-mails_Setoriais&Ouvintes2.xlsx';

try {
    const workbook = XLSX.readFile(excelPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Read the first 5 rows to understand the structure
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 0, defval: null });

    console.log('--- Headers (Row 0) ---');
    console.log(data[0]);

    console.log('\n--- First 3 data rows ---');
    console.log(data.slice(1, 4));

} catch (error) {
    console.error("Error reading file:", error);
}
