'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TextStyleKit } from '@tiptap/extension-text-style';
import TextAlign from '@tiptap/extension-text-align';
import { DEFAULT_MANUAL_HTML, DOCUMENT_CSS } from '@/utils/manualDocument';
import { Icons } from './Icons';

async function api(url, options) {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir. Tente novamente.');
  return data;
}
const json = (method, data) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
export default function ManualWriter({ item, tree, initialSystemId, initialProgramId, busy, error, onClose, onSave }) {
  const templateMode = !!item.templateMode;
  const dialog = useRef(null);
  const dirty = useRef(false);
  const form = useRef(null);
  const [menu, setMenu] = useState(null);
  const imageInput = useRef(null);
  const [system, setSystem] = useState(item.system_id || initialSystemId || tree[0]?.id || '');
  const [data, setData] = useState({ id: item.id, revision: item.revision, programId: item.program_id || initialProgramId || '', title: item.title || '', description: item.description || '', keywords: item.keywords || '', version: item.version || '', published: item.published || false });
  const [preview, setPreview] = useState(false);
  const [help, setHelp] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [selected, setSelected] = useState('default');
  const [template, setTemplate] = useState(null);
  const [name, setName] = useState('');
  const [savePanel, setSavePanel] = useState(false);
  const [saveMode, setSaveMode] = useState('new');
  const [saveTarget, setSaveTarget] = useState(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  const [localError, setLocalError] = useState('');
  const [link, setLink] = useState(null);
  const [pending, setPending] = useState(null);
  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [1,2,3] }, link: { openOnClick: false, protocols: ['http','https','mailto'] } }), Image.configure({ allowBase64: true }), TextStyleKit, TextAlign.configure({ types: ['heading','paragraph'] })],
    content: item.html_content || DEFAULT_MANUAL_HTML,
    immediatelyRender: false,
    editorProps: { transformPastedHTML: html => { const doc = new DOMParser().parseFromString(html, 'text/html'); doc.querySelectorAll('img').forEach(img => { if (!/^data:image\/(png|jpeg|webp);base64,/.test(img.getAttribute('src') || '')) img.remove(); }); return doc.body.innerHTML; }, attributes: { class: 'manual-paper', role: 'textbox', 'aria-label': 'Conteúdo do manual', 'aria-multiline': 'true' }, handlePaste: (view, event) => {
      const file = Array.from(event.clipboardData?.files || [])[0];
      if (file) { event.preventDefault(); insertImage(file); return true; }
      return false;
    }, handleDrop: (view, event) => { if (event.dataTransfer?.files.length) { event.preventDefault(); setLocalError('Use o botão Imagem ou cole com Ctrl+V.'); return true; } return false; } },
    onUpdate: () => { dirty.current = true; setNotice(''); },
  });
  const state = useEditorState({ editor, selector: ({ editor: e }) => e ? ({ bold: e.isActive('bold'), italic: e.isActive('italic'), underline: e.isActive('underline'), bullet: e.isActive('bulletList'), ordered: e.isActive('orderedList'), image: e.isActive('image'), heading: [1,2,3].find(level => e.isActive('heading', { level })) || 0 }) : {} });
  const locked = busy || working;
  useEffect(() => { editor?.setEditable(!locked && !pending, false); }, [editor, locked, pending]);
  const reloadTemplates = () => api('/api/manuals/templates').then(setTemplates);
  useEffect(() => { dialog.current.showModal(); reloadTemplates().catch(err => setLocalError(err.message)); }, []);
  useEffect(() => {
    const warn = event => { if (dirty.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);
  function ask(message, action) { setPending({ message, action }); }
  function close() { if (locked) return; if (dirty.current) ask('Descartar as alterações não salvas?', onClose); else onClose(); }
  function escapeEditor(event) { event.preventDefault(); event.stopPropagation(); if (pending) setPending(null); else if (help) setHelp(false); else if (link !== null) setLink(null); else if (menu) { const trigger = dialog.current.querySelector('[data-writer-menu=' + menu + ']'); setMenu(null); trigger?.focus(); } else close(); }
  function field(key) { return { value: data[key], onChange: e => { dirty.current = true; setLocalError(''); setData({ ...data, [key]: e.target.value }); } }; }
  async function run(work) { setWorking(true); setLocalError(''); setNotice(''); try { await work(); } catch (err) { setLocalError(err.message); } finally { setWorking(false); } }
  async function insertImage(file) {
    if (!editor || locked) return;
    await run(async () => {
      if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) throw new Error('Escolha uma imagem PNG, JPEG ou WebP de até 2 MB.');
      const src = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Não foi possível ler a imagem.')); reader.readAsDataURL(file); });
      if (editor.getHTML().length + src.length > 8 * 1024 * 1024) throw new Error('O manual atingiu 8 MB. Reduza o tamanho das imagens.');
      editor.chain().focus().setImage({ src, alt: file.name.replace(/\.[^.]+$/, '') }).run();
    });
  }
  function button(label, action, active = false, text = label) { return <button type="button" title={label} aria-label={label} aria-pressed={active} className={active ? 'active' : ''} disabled={locked || !!pending || !editor} onClick={action}>{text}</button>; }
  async function applyTemplate(confirmed = false) {
    if (dirty.current && !confirmed) { ask('Substituir o conteúdo atual pelo modelo escolhido?', () => applyTemplate(true)); return; }
    await run(async () => {
      const model = await api(`/api/manuals/templates?id=${encodeURIComponent(selected)}`);
      editor.commands.setContent(model.html_content); setTemplate(model); setName(model.name);
      dirty.current = !templateMode; setPreview(false); setMenu(null); setNotice(templateMode ? 'Modelo aberto para edição.' : 'Modelo aplicado. Edite o conteúdo e salve o manual.');
    });
  }
  async function openSavePanel() {
    await run(async () => {
      const current = selected !== 'default' ? await api(`/api/manuals/templates?id=${encodeURIComponent(selected)}`) : null;
      setMenu('model'); setSaveTarget(current); setSaveMode('new'); setName(current?.name || ''); setSavePanel(true);
    });
  }
  async function saveTemplate(copy, target = template) {
    if (!editor || editor.isEmpty) { setLocalError('Escreva o conteúdo antes de salvar o modelo.'); return; }
    if (!copy && (!target || target.id === 'default')) { setLocalError('O modelo original é uma base. Salve como um novo modelo.'); return; }
    if (!name.trim()) { setLocalError('Informe o nome do modelo.'); return; }
    await run(async () => {
      const saved = await api('/api/manuals/templates', json('POST', { name, html: editor.getHTML(), ...(!copy ? { id: target.id, revision: target.revision } : {}) }));
      setTemplate({ ...saved, name: name.trim() }); setSelected(saved.id); setSavePanel(false); setMenu(null);
      if (templateMode) dirty.current = false;
      await reloadTemplates(); setNotice(copy ? 'Novo modelo criado. Ele já está disponível na lista.' : 'Modelo atualizado. Os manuais existentes foram mantidos.');
    });
  }
  return <dialog ref={dialog} className="manual-dialog manual-writer" onKeyDown={event => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); if (!locked && !pending) form.current.requestSubmit(); } }} aria-label={templateMode ? 'Modelos de manual' : 'Editor de manual'} onKeyDownCapture={event => { if (event.key === 'Escape') escapeEditor(event); }} onCancel={escapeEditor}>
    <header><div className="writer-heading"><h3>{templateMode ? 'Modelos de manual' : item.id ? 'Editar manual' : 'Novo manual'}</h3><span className="manual-muted">{templateMode ? template?.name || 'Novo modelo' : data.title || 'Sem título'}</span></div><div className="manual-actions"><div className="writer-view"><button type="button" aria-pressed={!preview} onClick={() => { setPreview(false); setMenu(null); }}>Editar</button><button type="button" aria-pressed={preview} onClick={() => { setPreview(true); setMenu(null); }}>Prévia</button></div><button type="button" className="btn-primary writer-save" disabled={locked || !!pending || !editor} onClick={() => form.current.requestSubmit()}>{locked ? 'Salvando…' : 'Salvar'}</button><button type="button" className="manual-icon" aria-label="Como usar o editor" title="Como usar" onClick={() => { setHelp(!help); setMenu(null); }}>{Icons.help}</button><button type="button" className="manual-icon" aria-label="Fechar editor" disabled={locked} onClick={close}>{Icons.close}</button></div></header>
    {pending && <aside className="writer-confirm" role="alertdialog" aria-label="Confirmar alteração"><strong>{pending.message}</strong><div className="manual-actions"><button type="button" className="btn-ghost" onClick={() => setPending(null)}>Voltar</button><button type="button" className="btn-primary" onClick={() => { const action = pending.action; setPending(null); action(); }}>Confirmar</button></div></aside>}
    {help && <aside className="writer-help"><button type="button" className="manual-icon writer-help-close" aria-label="Fechar ajuda" onClick={() => setHelp(false)}>{Icons.close}</button><strong>Como usar</strong><p>O editor ocupa toda a tela. Use Arquivo para informar título e programa; a opção de publicação fica no rodapé; Modelo para aplicar ou salvar uma base; Inserir para imagens e links; Formatar para as opções completas. Os menus se fecham com Escape ou ao clicar no documento.</p><p>Comece com um modelo ou escreva na folha. Selecione o texto para formatar, mudar a cor ou inserir um link. Use Imagem ou Ctrl+V para incluir capturas (até 2 MB cada). Clique na imagem para ajustar o tamanho ou use Delete para removê-la.</p><p>Modelos são bases independentes: alterar um modelo não modifica manuais já criados. Use “Salvar como modelo”, no menu Modelo, para criar um novo ou substituir o modelo selecionado. A substituição pede confirmação. O modelo Monalisa original sempre fica disponível e só pode ser usado como base para um novo.</p><p>Confira a prévia antes de salvar. Informe programa, título e conteúdo. Rascunhos são exclusivos dos administradores; “Publicado — acesso público por link” libera a leitura. As alterações são salvas somente ao clicar em Salvar.</p></aside>}
    <form ref={form} noValidate onSubmit={event => { event.preventDefault(); if (!editor || locked || pending) return; if (templateMode) { if (!template || template.id === 'default') openSavePanel(); else ask(`Substituir o modelo “${template.name}” pelo conteúdo atual?`, () => saveTemplate(false)); } else { if (!data.programId || !data.title.trim()) { setMenu('file'); setLocalError('Informe o programa e o título na biblioteca antes de salvar.'); return; } if (editor.isEmpty) { setLocalError('Escreva o conteúdo antes de salvar.'); return; } onSave({ ...data, contentType: 'html', html: editor.getHTML() }); } }}>
      <fieldset disabled={locked || !!pending} className="writer-fields">
          <input hidden ref={imageInput} type="file" accept="image/png,image/jpeg,image/webp" onChange={e => { if (e.target.files[0]) insertImage(e.target.files[0]); e.target.value = ''; }} />
        <nav className="writer-menubar" aria-label="Menus do editor">{[['file','Arquivo'],['model','Modelo'],['insert','Inserir'],['format','Formatar']].map(([id,label]) => <button key={id} data-writer-menu={id} type="button" aria-expanded={menu === id} aria-controls={`writer-menu-${id}`} disabled={(id === 'insert' || id === 'format') && preview} onClick={() => { setMenu(menu === id ? null : id); setHelp(false); }}>{label}<span aria-hidden="true">⌄</span></button>)}</nav>
        <section id="writer-menu-file" className="writer-menu-panel" aria-label="Arquivo" hidden={menu !== 'file'}>
          <div className="writer-panel-title"><strong>{templateMode ? 'Dados do modelo' : 'Dados do manual'}</strong><button type="button" className="manual-icon" aria-label="Fechar menu Arquivo" onClick={() => setMenu(null)}>{Icons.close}</button></div>
        {!templateMode && <div className="writer-metadata"><label>Sistema<select value={system} onChange={e => { dirty.current = true; setSystem(e.target.value); setData({ ...data, programId: '' }); }}>{tree.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label>Programa<select required {...field('programId')}><option value="">Selecione</option>{(tree.find(s => s.id === system)?.programs || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label className="writer-title">Título na biblioteca<input required maxLength={160} placeholder="Ex.: Como cadastrar um produto" {...field('title')} /></label></div>}

        {!templateMode && <details className="writer-details"><summary>Descrição, palavras-chave e versão</summary><label>Descrição<textarea rows={2} maxLength={2000} {...field('description')} /></label><div className="manual-form-grid"><label>Palavras-chave<input maxLength={500} {...field('keywords')} /></label><label>Versão<input maxLength={50} {...field('version')} /></label></div></details>}
        {templateMode && !savePanel && <details open className="writer-details"><summary>{templateMode ? 'Salvar modelo' : 'Guardar este conteúdo como modelo'}</summary><div className="writer-inline"><label>Nome do modelo<input maxLength={100} value={name} onChange={e => { setName(e.target.value); if (templateMode) dirty.current = true; }} /></label><button type="button" disabled={!editor} onClick={() => saveTemplate(true)}>{templateMode ? 'Salvar cópia' : 'Salvar como modelo'}</button>{templateMode && template && template.id !== 'default' && <button type="button" onClick={() => { ask('Excluir este modelo? Os manuais existentes serão mantidos.', () => run(async () => { await api('/api/manuals/templates', json('DELETE', template)); setTemplate(null); setSelected('default'); setName(''); await reloadTemplates(); setNotice('Modelo excluído.'); })); }}>Excluir modelo</button>}</div></details>}

          <button type="button" className="btn-ghost" onClick={() => setMenu(null)}>Voltar ao documento</button>
        </section>
        <section id="writer-menu-model" className="writer-menu-panel" aria-label="Modelo" hidden={menu !== 'model'}>
          <div className="writer-panel-title"><strong>Modelos de manual</strong><button type="button" className="manual-icon" aria-label="Fechar menu Modelo" onClick={() => setMenu(null)}>{Icons.close}</button></div>
        <div className="writer-models"><label>Modelo<select value={selected} onChange={e => { setSelected(e.target.value); setSavePanel(false); }}>{templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><button type="button" className="btn-ghost" onClick={() => applyTemplate()} disabled={!editor}>{templateMode ? 'Abrir modelo' : 'Aplicar modelo'}</button><button type="button" className="btn-ghost" onClick={() => { const clear = () => { editor.commands.setContent('<p></p>'); setTemplate(null); setName(''); dirty.current = true; }; if (dirty.current) ask('Limpar o conteúdo atual?', clear); else clear(); }}>Em branco</button><button type="button" className="btn-ghost" aria-expanded={savePanel} aria-controls="writer-save-template" disabled={!editor} onClick={() => savePanel ? setSavePanel(false) : openSavePanel()}>Salvar como modelo</button></div>
        {savePanel && <section id="writer-save-template" className="writer-save-template" aria-label="Salvar como modelo">
          <strong>Salvar como modelo</strong>
          <div className="writer-save-options" role="group" aria-label="Destino do modelo">
            <label><input type="radio" name="save-template-mode" checked={saveMode === 'new'} onChange={() => setSaveMode('new')} />Criar novo</label>
            <label><input type="radio" name="save-template-mode" checked={saveMode === 'replace'} disabled={!saveTarget} onChange={() => setSaveMode('replace')} />Substituir modelo atual</label>
          </div>
          <p className="manual-muted">{saveMode === 'replace' ? `O conteúdo de “${saveTarget.name}” será substituído. Manuais já criados não serão alterados.` : saveTarget ? 'Crie um modelo independente com o conteúdo desta página.' : 'O Manual Monalisa é a base original. Salve suas alterações como um novo modelo.'}</p>
          <div className="writer-inline"><label>Nome do modelo<input autoFocus maxLength={100} value={name} onChange={e => setName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') e.preventDefault(); }} /></label><button type="button" disabled={!name.trim() || !editor} onClick={() => saveMode === 'new' ? saveTemplate(true) : ask(`Substituir o modelo “${saveTarget.name}” pelo conteúdo atual?`, () => saveTemplate(false, saveTarget))}>{saveMode === 'new' ? 'Criar modelo' : 'Substituir modelo'}</button><button type="button" onClick={() => setSavePanel(false)}>Cancelar</button></div>
        </section>}
        </section>
        <section id="writer-menu-insert" className="writer-menu-panel writer-command-panel" aria-label="Inserir" hidden={menu !== 'insert'}>
          {button('Inserir imagem', () => { imageInput.current.click(); setMenu(null); }, false, 'Imagem do computador…')}
          {button('Inserir link', () => { setLink(editor.getAttributes('link').href || ''); setMenu(null); }, false, 'Link…')}
          {button('Divisor', () => { editor.chain().focus().setHorizontalRule().run(); setMenu(null); }, false, 'Linha divisória')}
          {button('Destaque', () => { editor.chain().focus().toggleBlockquote().run(); setMenu(null); }, false, 'Bloco de destaque')}
        </section>
        <section id="writer-menu-format" className="writer-menu-panel" aria-label="Formatar" hidden={menu !== 'format'}>
        {!preview && <div className="writer-toolbar" role="toolbar" aria-label="Formatação do manual">
          <select aria-label="Estilo do texto" value={state?.heading || 0} onChange={e => { const level = Number(e.target.value); level ? editor.chain().focus().setHeading({ level }).run() : editor.chain().focus().setParagraph().run(); }}><option value="0">Texto normal</option><option value="1">Título</option><option value="2">Seção</option><option value="3">Subseção</option></select>
          {button('Negrito', () => editor.chain().focus().toggleBold().run(), state?.bold, <b>N</b>)}{button('Itálico', () => editor.chain().focus().toggleItalic().run(), state?.italic, <i>I</i>)}{button('Sublinhado', () => editor.chain().focus().toggleUnderline().run(), state?.underline, <u>S</u>)}
          <select aria-label="Cor do texto" defaultValue="" onChange={e => e.target.value ? editor.chain().focus().setColor(e.target.value).run() : editor.chain().focus().unsetColor().run()}><option value="">Cor do texto</option><option value="#24343b">Grafite</option><option value="#156c80">Azul Monalisa</option><option value="#2456a6">Azul</option><option value="#a85616">Laranja</option><option value="#237044">Verde</option><option value="#b33232">Vermelho</option><option value="#754394">Roxo</option></select><input type="color" aria-label="Cor personalizada" title="Cor personalizada" defaultValue="#24343b" onInput={e => editor.chain().focus().setColor(e.target.value).run()} />
          <select aria-label="Tamanho do texto" defaultValue="" onChange={e => e.target.value ? editor.chain().focus().setFontSize(e.target.value).run() : editor.chain().focus().unsetFontSize().run()}><option value="">Tamanho</option>{[12,14,16,18,20,24,28,32].map(s => <option key={s} value={`${s}px`}>{s}</option>)}</select>
          {button('Lista com marcadores', () => editor.chain().focus().toggleBulletList().run(), state?.bullet, '• Lista')}{button('Lista numerada', () => editor.chain().focus().toggleOrderedList().run(), state?.ordered, '1. Lista')}
          <select aria-label="Alinhamento" defaultValue="left" onChange={e => editor.chain().focus().setTextAlign(e.target.value).run()}><option value="left">Esquerda</option><option value="center">Centro</option><option value="right">Direita</option><option value="justify">Justificado</option></select>
          {button('Inserir link', () => setLink(editor.getAttributes('link').href || ''), false, 'Link')}{button('Inserir imagem', () => imageInput.current.click(), false, 'Imagem')}{button('Destaque', () => editor.chain().focus().toggleBlockquote().run())}{button('Divisor', () => editor.chain().focus().setHorizontalRule().run())}{button('Desfazer', () => editor.chain().focus().undo().run(), false, '↶')}{button('Refazer', () => editor.chain().focus().redo().run(), false, '↷')}

        </div>}
        </section>
        {!preview && <div className="writer-quickbar writer-toolbar" role="toolbar" aria-label="Formatação rápida">
          <select aria-label="Estilo rápido do texto" value={state?.heading || 0} onChange={e => { const level = Number(e.target.value); level ? editor.chain().focus().setHeading({ level }).run() : editor.chain().focus().setParagraph().run(); }}><option value="0">Texto normal</option><option value="1">Título</option><option value="2">Seção</option><option value="3">Subseção</option></select>
          {button('Negrito', () => editor.chain().focus().toggleBold().run(), state?.bold, <b>N</b>)}{button('Itálico', () => editor.chain().focus().toggleItalic().run(), state?.italic, <i>I</i>)}{button('Sublinhado', () => editor.chain().focus().toggleUnderline().run(), state?.underline, <u>S</u>)}
          {button('Lista com marcadores', () => editor.chain().focus().toggleBulletList().run(), state?.bullet, '• Lista')}{button('Desfazer', () => editor.chain().focus().undo().run(), false, '↶')}{button('Refazer', () => editor.chain().focus().redo().run(), false, '↷')}
        </div>}
        {link !== null && <div className="writer-inline writer-link-panel"><label>Endereço do link<input type="url" value={link} placeholder="https://..." onChange={e => setLink(e.target.value)} /></label><button type="button" onClick={() => { if (!/^(https?:\/\/|mailto:)/i.test(link)) { setLocalError('Use um endereço http, https ou mailto.'); return; } editor.chain().focus().extendMarkRange('link').setLink({ href: link }).run(); setLink(null); setLocalError(''); }}>Aplicar link</button><button type="button" onClick={() => { editor.chain().focus().unsetLink().run(); setLink(null); }}>Remover link</button><button type="button" onClick={() => setLink(null)}>Cancelar</button></div>}
        {state?.image && !preview && <div className="writer-inline"><span>Imagem selecionada</span>{[200,400,600,800].map(width => <button type="button" key={width} onClick={() => editor.chain().focus().updateAttributes('image', { width }).run()}>{width}px</button>)}<button type="button" onClick={() => editor.chain().focus().deleteSelection().run()}>Remover imagem</button></div>}
        <div className="writer-canvas" onPointerDown={() => { setMenu(null); setHelp(false); }}>{preview ? <iframe title="Prévia do manual" sandbox="" srcDoc={`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>${DOCUMENT_CSS}</style></head><body><main class="manual-paper">${editor?.getHTML() || ''}</main></body></html>`} /> : <EditorContent editor={editor} />}</div>
      </fieldset>
      {(localError || error) && <p className="manual-error" role="alert">{localError || error}</p>}{notice && <p role="status" className="writer-notice">{notice}</p>}
      <footer>{!templateMode && <label className="manual-publish"><input type="checkbox" disabled={locked || !!pending} checked={data.published} onChange={e => { dirty.current = true; setData({ ...data, published: e.target.checked }); }} />Publicado — acesso público por link</label>}<span className="manual-muted">{templateMode ? 'Modelos para novos manuais' : 'Alterações salvas ao clicar em Salvar'}</span></footer>
    </form>
  </dialog>;
}
