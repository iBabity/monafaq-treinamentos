const { PDFDocument } = require('pdf-lib');
const { createHash } = require('node:crypto');
const MAX_PDF_BYTES = 20 * 1024 * 1024;
class ManualError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function text(value, name, max, required = false) {
  if (typeof value !== 'string' || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value)) {
    throw new ManualError(`${name} invalido.`);
  }
  const result = value.trim();
  if (required && !result) throw new ManualError(`Informe ${name.toLowerCase()}.`);
  return result;
}
function id(value) {
  if (typeof value !== 'string' || !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value)) throw new ManualError('Identificador invalido.');
  return value;
}
function metadata(data) {
  if (typeof data.published !== 'boolean') throw new ManualError('Situacao invalida.');
  return {
    programId: id(data.programId),
    title: text(data.title, 'Titulo', 160, true),
    description: text(data.description ?? '', 'Descricao', 2000),
    keywords: text(data.keywords ?? '', 'Palavras-chave', 500),
    version: text(data.version ?? '', 'Versao', 50),
    published: data.published,
  };
}
function revision(value) {
  if (!Number.isSafeInteger(value) || value < 1) throw new ManualError('Revisao invalida. Recarregue a lista.');
  return value;
}
function searchTerms(value) {
  const q = normalize(text(value || '', 'Busca', 120));
  return q.split(/\s+/).filter(Boolean).slice(0, 12).map(term => `%${term.replace(/[\\%_]/g, '\\$&')}%`);
}
async function validatePdf(file) {
  if (!file || typeof file.arrayBuffer !== 'function' || !/\.pdf$/i.test(file.name || '')) throw new ManualError('Selecione um arquivo PDF.');
  if (file.size <= 0 || file.size > MAX_PDF_BYTES) throw new ManualError('O PDF deve ter entre 1 byte e 20 MB.', 413);
  if (file.type && !['application/pdf', 'application/octet-stream'].includes(file.type)) throw new ManualError('Tipo de arquivo invalido. Envie um PDF.');
  const pdf = Buffer.from(await file.arrayBuffer());
  if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new ManualError('O arquivo nao e um PDF valido.');
  let pageCount;
  try {
    const document = await PDFDocument.load(pdf, { updateMetadata: false, throwOnInvalidObject: true });
    pageCount = document.getPageCount();
    if (!pageCount || pageCount > 5000) throw new Error('pages');
  } catch { throw new ManualError('PDF invalido, protegido por senha ou com mais de 5.000 paginas.'); }
  const filename = file.name.split(/[\\/]/).pop().replace(/[\r\n\u0000-\u001f]/g, '').slice(-200);
  return { pdf, filename, byteSize: pdf.length, pageCount, sha256: createHash('sha256').update(pdf).digest('hex') };
}
async function readBody(request, max = MAX_PDF_BYTES + 64 * 1024) {
  if (Number(request.headers.get('content-length')) > max) throw new ManualError('Arquivo muito grande.', 413);
  if (!request.body) throw new ManualError('Corpo da requisicao ausente.');
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) { await reader.cancel(); throw new ManualError('Arquivo muito grande.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { headers: { 'content-type': request.headers.get('content-type') || '' } });
}
module.exports = { MAX_PDF_BYTES, ManualError, normalize, text, id, metadata, revision, searchTerms, validatePdf, readBody };
