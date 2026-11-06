// Interpreta somente os calendários mensais de 2026 do arquivo de escala.
const ExcelJS = require('exceljs');
const names = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

async function parseWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const warnings = [];
  const months = names.map((name, index) => {
    const sheet = wb.worksheets.find(s => String(s.getCell('A1').value || '').trim().toLocaleLowerCase('pt-BR') === `${name} 2026`.toLocaleLowerCase('pt-BR'));
    if (!sheet) throw new Error(`Calendário ${name} 2026 não encontrado.`);
    const firstColumn = (new Date(Date.UTC(2026,index,1)).getUTCDay()+6)%7;
    const daysInMonth = new Date(Date.UTC(2026,index+1,0)).getUTCDate();
    const days = [];
    for (let day=1; day<=daysInMonth; day++) {
      const position = firstColumn + day - 1;
      const cell = sheet.getCell(3 + Math.floor(position/7), 1 + position%7);
      const raw = cell.value && typeof cell.value === 'object' && 'result' in cell.value ? cell.value.result : cell.value;
      const text = raw == null ? '' : String(raw);
      const parts = text.split(/\r?\n/);
      const indicated = Number(parts[0].trim());
      if (!Number.isInteger(indicated) || indicated !== day) {
        warnings.push(`${day.toString().padStart(2,'0')}/${String(index+1).padStart(2,'0')}: a célula mostra ${parts[0].trim() || 'vazio'}.`);
        days.push({day,name:'',holiday:'',invalid:true});
      } else days.push({day,name:(parts[1]||'').trim(),holiday:parts.slice(2).join(' ').trim()});
    }
    return {title:`${name} 2026`,days};
  });
  return {months,warnings};
}
// A nova planilha tem uma lista diária e calendários mensais para dezembro/2026 e 2027.
async function parseNewWorkbook(buffer) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const tabs = ['Dez 2026','Jan 2027','Fev 2027','Mar 2027','Abr 2027','Mai 2027','Jun 2027','Jul 2027','Ago 2027','Set 2027','Out 2027','Nov 2027','Dez 2027'];
  const output = [];
  for (let i = 0; i < tabs.length; i++) {
    const year = i === 0 ? 2026 : 2027, month = i === 0 ? 11 : i - 1;
    const sheet = wb.getWorksheet(tabs[i]);
    if (!sheet) throw new Error(`Calendário ${tabs[i]} não encontrado.`);
    const offset = (new Date(Date.UTC(year,month,1)).getUTCDay()+6)%7;
    const days = [];
    for (let day=1; day<=new Date(Date.UTC(year,month+1,0)).getUTCDate(); day++) {
      const pos=offset+day-1, cell=sheet.getCell(4+Math.floor(pos/7),1+pos%7);
      const raw=cell.value && typeof cell.value==='object' && 'result' in cell.value ? cell.value.result : cell.value;
      const [number, name, ...holiday]=String(raw ?? '').split(/\r?\n/);
      if (Number(number.trim()) !== day) throw new Error(`Data divergente em ${tabs[i]}: dia ${day}.`);
      days.push({day,name:(name||'').trim(),holiday:holiday.join(' ').trim()});
    }
    output.push({title:`${names[month]} ${year}`,days});
  }
  return {december2026:output[0],months2027:output.slice(1)};
}
module.exports = {parseWorkbook,parseNewWorkbook};
