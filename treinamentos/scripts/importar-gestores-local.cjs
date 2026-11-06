// Importação aditiva para o banco temporário de teste. Não altera aulas existentes.
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { Client } = require('pg');
const path = require('node:path');
const source = path.join(process.env.MONAFAQ_PUBLIC_DIR || path.resolve(__dirname, '../../faq/public'), 'manual.js');
const items = vm.runInNewContext(fs.readFileSync(source, 'utf8') + ';manual');
const map = {
  Cadastros:'Apresentação / Cadastros', Movimento:'Compras / Faturamento',
  Financeiro:'Financeiro', Fiscal:'Fiscal', Estoque:'Operacional / Gerencial',
  Gerencial:'Operacional / Gerencial', Indicadores:'Operacional / Gerencial',
  Produção:'Operacional / Gerencial', Transporte:'Operacional / Gerencial',
  Segurança:'Extra', Parâmetros:'Extra', Utilitários:'Extra', Backup:'Extra', 'Erros comuns':'Extra',
};
function target(item) {
  if (item.category === 'Backup' && /sincdata/i.test(item.title)) return 'SincData';
  if (item.category === 'Backup' && /\bpdv\b/i.test(item.title)) return 'PDV';
  if (item.category === 'Financeiro' && /caixa/i.test(item.title)) return 'Contabilidade / Caixa';
  return map[item.category];
}
async function main() {
  const db = new Client({host:process.env.DB_HOST || '127.0.0.1',port:Number(process.env.DB_PORT || 5432),user:process.env.DB_USER || 'postgres',password:process.env.DB_PASSWORD,database:process.env.DB_NAME});
  await db.connect();
  try {
    const {rows:categories}=await db.query("SELECT id,name FROM categories WHERE track_id='track_padrao'");
    const ids=new Map(categories.map(x=>[x.name,x.id]));
    const sorted=items.map((x,index)=>({...x,index})).sort((a,b)=>a.page-b.page||a.index-b.index);
    const perCategory=new Map(), totals={};
    await db.query('BEGIN');
    for(const item of sorted) {
      const name=target(item), category=ids.get(name);
      if(!category || !Number.isInteger(item.page) || item.page<1 || item.page>244) throw new Error(`Item sem categoria ou página válida: ${item.title}`);
      if(!perCategory.has(category)) {
        const existing=await db.query('SELECT COALESCE(MAX(sort_order),-1) AS n FROM lessons WHERE category_id=$1',[category]);
        perCategory.set(category,Number(existing.rows[0].n)+1);
      }
      const order=perCategory.get(category);perCategory.set(category,order+1);
      const hash=crypto.createHash('sha256').update(`${item.category}\0${item.title}\0${item.page}\0${item.index}`).digest('hex').slice(0,24);
      const description=item.text || 'Consulte a página original do manual indicada abaixo.';
      const result=await db.query(`INSERT INTO lessons(id,title,subtitle,category_id,video_url,duration,description,views,sort_order) VALUES($1,$2,$3,$4,$5,$6,$7,0,$8) ON CONFLICT(id) DO NOTHING`, [`gestores_pdf_${hash}`,item.title,`Manual Gestores · ${item.category} · página ${item.page}`,category,`/material-gestores/${item.page}.webp`,'Leitura',description,order]);
      totals[name]=(totals[name]||0)+result.rowCount;
    }
    await db.query('COMMIT');
    console.log(JSON.stringify({importados:totals,total:Object.values(totals).reduce((a,b)=>a+b,0)}));
  } catch (e) { await db.query('ROLLBACK'); throw e; } finally { await db.end(); }
}
main().catch(error=>{console.error(error.message);process.exitCode=1});
