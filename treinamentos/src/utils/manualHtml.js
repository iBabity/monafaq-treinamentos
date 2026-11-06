const sanitize = require('sanitize-html');
const { createHash } = require('node:crypto');
const { ManualError } = require('./manualValidation');
const { DOCUMENT_CSS } = require('./manualDocument');
const MAX_HTML_BYTES = 8 * 1024 * 1024;
function imageSource(src = '') {
  const match = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(src);
  if (!match) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.length > 2 * 1024 * 1024 || bytes.length < 12) return false;
  return match[1] === 'png' ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : match[1] === 'jpeg' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 : bytes.toString('ascii',0,4) === 'RIFF' && bytes.toString('ascii',8,12) === 'WEBP';
}
function cleanHtml(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value) > MAX_HTML_BYTES) throw new ManualError('O manual deve ter até 8 MB, incluindo imagens.', 413);
  const html = sanitize(value, {
    allowedTags: ['p','br','h1','h2','h3','strong','b','em','i','u','s','ul','ol','li','blockquote','hr','a','img','span'],
    allowedAttributes: { '*': ['style'], a: ['href','target','rel'], img: ['src','alt','title','width'] },
    allowedSchemes: ['https','http','mailto'], allowedSchemesByTag: { img: ['data'] }, allowProtocolRelative: false,
    allowedStyles: { '*': { color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d{1,3},\s*\d{1,3},\s*\d{1,3}\s*\)$/], 'text-align': [/^(left|center|right|justify)$/], 'font-size': [/^(12|14|16|18|20|24|28|32)px$/] } },
    transformTags: { a: (tag, attrs) => ({ tagName: tag, attribs: { ...attrs, target: '_blank', rel: 'noopener noreferrer' } }) },
    exclusiveFilter: frame => frame.tag === 'img' && (!imageSource(frame.attribs.src) || (frame.attribs.width && !/^(200|400|600|800)$/.test(frame.attribs.width))),
  });
  if (!sanitize(html, { allowedTags: [], allowedAttributes: {} }).trim() && !html.includes('<img')) throw new ManualError('Escreva o conteúdo do manual antes de salvar.');
  return html;
}
function htmlUpload(value) {
  const html = cleanHtml(value);
  return { html, pdf: null, filename: 'manual.html', byteSize: Buffer.byteLength(html), pageCount: 1, sha256: createHash('sha256').update(html).digest('hex') };
}
function renderDocument(html) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Manual · Monalisa</title><style>${DOCUMENT_CSS}</style></head><body><main class="manual-paper">${cleanHtml(html)}</main></body></html>`;
}
module.exports = { cleanHtml, htmlUpload, renderDocument, MAX_HTML_BYTES };
