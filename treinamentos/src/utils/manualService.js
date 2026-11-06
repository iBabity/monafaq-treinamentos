const { randomUUID } = require('node:crypto');
const v = require('./manualValidation');
const { htmlUpload, cleanHtml } = require('./manualHtml');
const { DEFAULT_MANUAL_HTML } = require('./manualDocument');
const columns = `d.id, d.program_id, d.title, d.description, d.keywords, d.version, d.published,
  d.filename, d.content_type, d.byte_size, d.page_count, d.revision, d.created_at, d.updated_at, d.reviewed_by_name,
  p.name AS program_name, p.system_id, s.name AS system_name`;
const joins = 'FROM system_manuals d JOIN manual_programs p ON p.id=d.program_id JOIN manual_systems s ON s.id=p.system_id';
function createManualService(pool) {
  async function transaction(actor, action, entityId, work) {
    const db = await pool.connect();
    try {
      await db.query('BEGIN');
      const result = await work(db);
      await db.query('INSERT INTO manual_audit(actor_id,action,entity_id) VALUES ($1,$2,$3)', [actor, action, entityId]);
      await db.query('COMMIT');
      return result;
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }
  return {
    async content(admin, entityId) {
      const result = await pool.query(`SELECT ${columns},d.html_content ${joins} WHERE d.id=$1 AND ($2 OR d.published)`, [v.id(entityId), admin]);
      if (!result.rowCount) throw new v.ManualError('Manual não encontrado.', 404);
      const row = result.rows[0];
      if (row.html_content) row.html_content = cleanHtml(row.html_content);
      return row;
    },
    async templates() {
      const result = await pool.query('SELECT id,name,revision,updated_at FROM manual_templates ORDER BY name');
      return [{ id: 'default', name: 'Manual Monalisa', revision: 1 }, ...result.rows];
    },
    async template(entityId) {
      if (entityId === 'default') return { id: 'default', name: 'Manual Monalisa', revision: 1, html_content: DEFAULT_MANUAL_HTML };
      const result = await pool.query('SELECT id,name,revision,html_content FROM manual_templates WHERE id=$1', [v.id(entityId)]);
      if (!result.rowCount) throw new v.ManualError('Modelo não encontrado.', 404);
      return { ...result.rows[0], html_content: cleanHtml(result.rows[0].html_content) };
    },
    async saveTemplate(actor, input) {
      const entityId = input.id ? v.id(input.id) : randomUUID();
      const name = v.text(input.name, 'Nome do modelo', 100, true);
      const html = cleanHtml(input.html);
      if (input.id) v.revision(input.revision);
      return transaction(actor, 'save_template', entityId, async db => {
        await db.query('SELECT pg_advisory_xact_lock(78312219)');
        const usage = await db.query('SELECT count(*)::int AS count,COALESCE(sum(octet_length(html_content)),0)::bigint AS bytes FROM manual_templates');
        if (!input.id && usage.rows[0].count >= 100) throw new v.ManualError('Limite de 100 modelos atingido.', 409);
        const previous = input.id ? (await db.query('SELECT octet_length(html_content) AS bytes FROM manual_templates WHERE id=$1', [entityId])).rows[0]?.bytes || 0 : 0;
        if (Number(usage.rows[0].bytes) - previous + Buffer.byteLength(html) > 100 * 1024 * 1024) throw new v.ManualError('Limite de armazenamento dos modelos atingido.', 409);
        const result = input.id
          ? await db.query('UPDATE manual_templates SET name=$1,html_content=$2,updated_by=$3,revision=revision+1,updated_at=now() WHERE id=$4 AND revision=$5 RETURNING revision', [name,html,actor,entityId,input.revision])
          : await db.query('INSERT INTO manual_templates(id,name,html_content,updated_by) VALUES($1,$2,$3,$4) RETURNING revision', [entityId,name,html,actor]);
        if (!result.rowCount) throw new v.ManualError('O modelo mudou. Reabra antes de salvar.', 409);
        return { id: entityId, revision: result.rows[0].revision };
      });
    },
    async deleteTemplate(actor, input) {
      const entityId = v.id(input.id);
      v.revision(input.revision);
      return transaction(actor, 'delete_template', entityId, async db => {
        const result = await db.query('DELETE FROM manual_templates WHERE id=$1 AND revision=$2', [entityId,input.revision]);
        if (!result.rowCount) throw new v.ManualError('O modelo mudou. Atualize a lista.', 409);
        return { success: true };
      });
    },
    async tree(admin) {
      const result = await pool.query(`SELECT s.id, s.name, p.id AS program_id, p.name AS program_name,
        count(d.id)::int AS manual_count FROM manual_systems s
        LEFT JOIN manual_programs p ON p.system_id=s.id
        LEFT JOIN system_manuals d ON d.program_id=p.id AND ($1 OR d.published)
        GROUP BY s.id,p.id ORDER BY s.name,p.name`, [admin]);
      const systems = new Map();
      for (const row of result.rows) {
        if (!admin && !row.manual_count) continue;
        if (!systems.has(row.id)) systems.set(row.id, { id: row.id, name: row.name, programs: [] });
        if (row.program_id) systems.get(row.id).programs.push({ id: row.program_id, name: row.program_name, manual_count: row.manual_count });
      }
      return [...systems.values()];
    },
    async list(admin, params) {
      const values = [admin];
      const where = ['($1 OR d.published)'];
      for (const [key, column] of [['systemId', 's.id'], ['programId', 'p.id']]) {
        if (params.get(key)) { values.push(v.id(params.get(key))); where.push(`${column}=$${values.length}`); }
      }
      const terms = v.searchTerms(params.get('q'));
      if (terms.length) {
        values.push(terms);
        where.push(`concat_ws(' ',d.search_text,s.search_name,p.search_name) LIKE ALL($${values.length}::text[])`);
      }
      if (admin && ['draft', 'published'].includes(params.get('status'))) {
        values.push(params.get('status') === 'published'); where.push(`d.published=$${values.length}`);
      }
      const page = Number(params.get('page') || 1);
      if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new v.ManualError('Pagina invalida.');
      const filter = `${joins} WHERE ${where.join(' AND ')}`;
      const count = await pool.query(`SELECT count(*)::int AS total ${filter}`, values);
      const result = await pool.query(`SELECT ${columns} ${filter} ORDER BY d.updated_at DESC,d.id LIMIT 30 OFFSET $${values.length + 1}`, [...values, (page - 1) * 30]);
      return { items: result.rows, total: count.rows[0].total, page, pageSize: 30 };
    },
    async saveFolder(actor, input) {
      const kind = input.kind;
      if (!['system', 'program'].includes(kind)) throw new v.ManualError('Tipo de pasta invalido.');
      const name = v.text(input.name, 'Nome', 100, true);
      const entityId = input.id ? v.id(input.id) : randomUUID();
      const table = kind === 'system' ? 'manual_systems' : 'manual_programs';
      const systemId = kind === 'program' ? v.id(input.systemId) : null;
      return transaction(actor, `${input.id ? 'update' : 'create'}_${kind}`, entityId, async db => {
        let result;
        if (input.id) {
          result = await db.query(`UPDATE ${table} SET name=$1,search_name=$2 ${kind === 'program' ? ',system_id=$4' : ''} WHERE id=$3 RETURNING id`,
            kind === 'program' ? [name, v.normalize(name), entityId, systemId] : [name, v.normalize(name), entityId]);
        } else {
          result = await db.query(`INSERT INTO ${table}(id,name,search_name${kind === 'program' ? ',system_id' : ''}) VALUES ($1,$2,$3${kind === 'program' ? ',$4' : ''}) RETURNING id`,
            kind === 'program' ? [entityId, name, v.normalize(name), systemId] : [entityId, name, v.normalize(name)]);
        }
        if (!result.rowCount) throw new v.ManualError('Pasta nao encontrada.', 404);
        return { id: entityId };
      });
    },
    async deleteFolder(actor, input) {
      if (!['system', 'program'].includes(input.kind)) throw new v.ManualError('Tipo de pasta invalido.');
      const entityId = v.id(input.id);
      return transaction(actor, `delete_${input.kind}`, entityId, async db => {
        const result = await db.query(`DELETE FROM ${input.kind === 'system' ? 'manual_systems' : 'manual_programs'} WHERE id=$1`, [entityId]);
        if (!result.rowCount) throw new v.ManualError('Pasta nao encontrada.', 404);
        return { success: true };
      });
    },
    async save(actor, input, file) {
      const data = v.metadata(input);
      const entityId = input.id ? v.id(input.id) : randomUUID();
      if (input.id) v.revision(input.revision);
      if (input.contentType && !['pdf','html'].includes(input.contentType)) throw new v.ManualError('Formato inválido.');
      if (input.contentType === 'html' && file) throw new v.ManualError('Escolha o editor ou o PDF.');
      const upload = input.contentType === 'html' ? htmlUpload(input.html) : file ? await v.validatePdf(file) : null;
      if (!input.id && !upload) throw new v.ManualError('Selecione um arquivo PDF.');
      return transaction(actor, input.id ? 'update_manual' : 'create_manual', entityId, async db => {
        // Serialize the storage budget and use optimistic revisions for concurrent editors.
        await db.query('SELECT pg_advisory_xact_lock(78312219)');
        const old = input.id ? (await db.query('SELECT filename,byte_size,revision FROM system_manuals WHERE id=$1 FOR UPDATE', [entityId])).rows[0] : null;
        if (input.id && !old) throw new v.ManualError('Manual nao encontrado.', 404);
        if (old && old.revision !== input.revision) throw new v.ManualError('Este manual foi alterado. Recarregue antes de salvar.', 409);
        if (upload) {
          const usage = await db.query('SELECT COALESCE(sum(byte_size),0) AS bytes FROM system_manuals');
          const budget = Number(process.env.TRAINING_MANUALS_MAX_BYTES || 1073741824);
          if (!Number.isSafeInteger(budget) || budget < v.MAX_PDF_BYTES) throw new Error('Invalid manuals storage budget');
          if (Number(usage.rows[0].bytes) - (old?.byte_size || 0) + upload.byteSize > budget) throw new v.ManualError('O armazenamento de manuais atingiu o limite. Contate o administrador do ambiente.', 409);
        }
        const search = v.normalize([data.title, data.description, data.keywords, data.version, upload?.filename || old?.filename].join(' '));
        const args = [data.programId,data.title,data.description,data.keywords,data.version,data.published,search,actor,entityId];
        if (old) {
          const replace = upload ? ',pdf=$10,filename=$11,byte_size=$12,page_count=$13,sha256=$14' : '';
          if (upload) args.push(upload.pdf,upload.filename,upload.byteSize,upload.pageCount,upload.sha256);
          await db.query(`UPDATE system_manuals SET program_id=$1,title=$2,description=$3,keywords=$4,version=$5,published=$6,search_text=$7,updated_by=$8,revision=revision+1,updated_at=now()${replace} WHERE id=$9`, args);
        } else {
          args.push(upload.pdf,upload.filename,upload.byteSize,upload.pageCount,upload.sha256);
          await db.query(`INSERT INTO system_manuals(program_id,title,description,keywords,version,published,search_text,updated_by,id,pdf,filename,byte_size,page_count,sha256)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`, args);
        }
        await db.query('UPDATE system_manuals SET reviewed_by_name=(SELECT name FROM users WHERE id=$1) WHERE id=$2', [actor,entityId]);
        if (upload) await db.query('UPDATE system_manuals SET content_type=$1,html_content=$2 WHERE id=$3', [upload.html ? 'html' : 'pdf',upload.html || null,entityId]);
        return { id: entityId };
      });
    },
    async remove(actor, input) {
      const entityId = v.id(input.id);
      v.revision(input.revision);
      return transaction(actor, 'delete_manual', entityId, async db => {
        const result = await db.query('DELETE FROM system_manuals WHERE id=$1 AND revision=$2', [entityId,input.revision]);
        if (!result.rowCount) throw new v.ManualError('O manual mudou ou ja foi excluido. Recarregue a lista.', 409);
        return { success: true };
      });
    },
    async file(admin, entityId) {
      const result = await pool.query('SELECT pdf,filename,byte_size,content_type,html_content FROM system_manuals WHERE id=$1 AND ($2 OR published)', [v.id(entityId),admin]);
      if (!result.rowCount) throw new v.ManualError('Manual nao encontrado.', 404);
      return result.rows[0];
    },
  };
}
module.exports = { createManualService };
