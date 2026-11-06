const { cleanHtml } = require('./manualHtml');
const { DOCUMENT_CSS } = require('./manualDocument');
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));

function publicManualDocument(manual) {
  const e = escapeHtml;
  const file = `/manuais/${encodeURIComponent(manual.id)}/arquivo`;
  const body = manual.content_type === 'html' ? cleanHtml(manual.html_content) : `<p>Este manual está em PDF.</p><p><a href="${file}" target="_blank" rel="noopener">Abrir PDF</a> · <a href="${file}?download=1">Baixar PDF</a></p><iframe title="Manual em PDF" src="${file}" style="width:100%;height:75vh;border:0"></iframe>`;
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(manual.title)} — Monalisa</title><style>${DOCUMENT_CSS}
  .public-header,.public-invite{max-width:820px;margin:24px auto;padding:24px;background:#fff;border:1px solid #dce3e5;border-radius:12px;box-sizing:border-box}body{margin:0;padding:16px;background:#f3f5f6;color:#273940;font:16px/1.6 system-ui}.public-header h1{margin:8px 0;font-size:26px}.public-header p{margin:4px 0}.public-meta{color:#52656d;font-size:14px}a{color:#176375}.public-invite a{display:inline-block;margin-top:8px;font-weight:600}@media print{.public-invite{display:none}}</style></head><body>
  <header class="public-header"><strong>MONALISA SISTEMAS · Manuais</strong><h1>${e(manual.title)}</h1><p>${e(manual.description)}</p><p class="public-meta">${e(manual.system_name)} · ${e(manual.program_name)}${manual.version ? ` · Versão ${e(manual.version)}` : ''}</p><p class="public-meta">Revisado por: ${e(manual.reviewed_by_name || 'Não informado')}</p></header>
  <main class="manual-paper">${body}</main><aside class="public-invite"><strong>Quer aprender mais e ter acesso ao nosso portal?</strong><br><a href="https://portal.monalisasistemas.com.br/cadastro">Clique aqui e crie seu usuário</a></aside></body></html>`;
}
const publicHeaders = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; img-src data:; style-src 'unsafe-inline'; frame-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'none'",
};
module.exports = { publicManualDocument, publicHeaders, escapeHtml };
