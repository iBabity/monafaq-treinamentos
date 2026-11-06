import { pool } from '@/utils/db';

const DEFAULT_ONE_API_BASE_URL = 'https://one.monalisasistemas.com.br/api/';
const ONE_MANAGED_PASSWORD = '__one_auth_managed__';

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`;
}

function oneApiBaseUrl() {
  return ensureTrailingSlash((process.env.ONE_API_BASE_URL || DEFAULT_ONE_API_BASE_URL).trim());
}

async function readOneJson(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

function oneErrorMessage(body, fallback) {
  return body?.message || body?.error || fallback;
}

export async function loginWithOne({ email, password, tenantId, businessGroupId }) {
  const response = await fetch(new URL('support-portal/login', oneApiBaseUrl()), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      password,
      tenantId: tenantId || undefined,
      businessGroupId: businessGroupId || undefined,
    }),
    cache: 'no-store',
  });

  const body = await readOneJson(response);
  if (!response.ok) {
    const error = new Error(oneErrorMessage(body, 'Credenciais invalidas no One.'));
    error.status = response.status;
    throw error;
  }

  return body;
}

export async function fetchOnePortalContext(accessToken, businessGroupId) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  if (businessGroupId) headers['X-Business-Group-Id'] = String(businessGroupId);

  const response = await fetch(new URL('support-portal/me', oneApiBaseUrl()), {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  const body = await readOneJson(response);
  if (!response.ok) {
    const error = new Error(oneErrorMessage(body, 'Sessao do One invalida ou expirada.'));
    error.status = response.status;
    throw error;
  }

  return body;
}

function displayName(oneAuth, portalContext) {
  const user = oneAuth?.user || {};
  const fromPortal = portalContext?.name;
  const fromParts = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return fromPortal || fromParts || user.username || user.email || 'Usuario Monalisa';
}

function oneEmail(oneAuth, portalContext) {
  return (portalContext?.email || oneAuth?.user?.email || '').trim().toLowerCase();
}

function selectedBusinessGroupId(portalContext, requestedBusinessGroupId) {
  return portalContext?.selectedBusinessGroupId || requestedBusinessGroupId || null;
}

function selectedStoreId(portalContext) {
  const selectedGroupId = portalContext?.selectedBusinessGroupId;
  const stores = Array.isArray(portalContext?.stores) ? portalContext.stores : [];
  const selectedStore = stores.find((store) => !selectedGroupId || store.businessGroupId === selectedGroupId);
  return selectedStore?.id || null;
}

function configuredAdminEmails() {
  return new Set(
    (process.env.TRAINING_ONE_ADMIN_EMAILS || '')
      .split(',')
      .map((value) => value.trim().toLowerCase())
      .filter(Boolean)
  );
}

function normalizeRoleValue(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function mapRole(oneAuth, email) {
  if (configuredAdminEmails().has(email)) return 'admin';

  const oneValues = [
    oneAuth?.user?.role,
    oneAuth?.user?.type,
    oneAuth?.user?.userType,
    oneAuth?.portalContext?.role,
    oneAuth?.portalContext?.type,
    oneAuth?.portalContext?.userType,
  ].map(normalizeRoleValue);

  if (oneValues.some((value) => ['admin', 'administrator', 'superadmin', 'super_admin', 'staff'].includes(value))) {
    return 'admin';
  }

  return 'student';
}

async function ensureOneColumns() {
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS one_user_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS one_business_group_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS one_store_id INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS one_context JSONB
  `);
  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_one_user_id_key
    ON users (one_user_id)
    WHERE one_user_id IS NOT NULL
  `);
}

export async function ensureTrainingUserFromOne(oneAuth, portalContext, requestedBusinessGroupId) {
  await ensureOneColumns();

  const oneUserId = Number(oneAuth?.user?.id || portalContext?.userId || 0);
  const email = oneEmail(oneAuth, portalContext);
  if (!oneUserId || !email) {
    throw new Error('O One nao retornou usuario e email validos.');
  }

  const name = displayName(oneAuth, portalContext);
  const oneRole = mapRole(oneAuth, email);
  const businessGroupId = selectedBusinessGroupId(portalContext, requestedBusinessGroupId);
  const storeId = selectedStoreId(portalContext);
  const contextJson = JSON.stringify({
    portalContext,
    licensedApps: oneAuth?.licensedApps || [],
    oneExpiresAt: oneAuth?.expiresAt || null,
  });

  const existing = await pool.query(
    'SELECT id, role FROM users WHERE one_user_id = $1 OR email = $2 ORDER BY CASE WHEN one_user_id = $1 THEN 0 ELSE 1 END LIMIT 1',
    [oneUserId, email]
  );
  const id = existing.rows[0]?.id || `one_${oneUserId}`;
  const existingRole = existing.rows[0]?.role;
  const role = existingRole && oneRole !== 'admin' ? existingRole : oneRole;

  const result = await pool.query(
    `INSERT INTO users (
       id, name, email, password, role, track_id, must_change_password,
       one_user_id, one_business_group_id, one_store_id, one_context
     )
     VALUES ($1, $2, $3, $4, $5, 'track_padrao', false, $6, $7, $8, $9::jsonb)
     ON CONFLICT (id) DO UPDATE SET
       name = EXCLUDED.name,
       email = EXCLUDED.email,
       role = EXCLUDED.role,
       track_id = COALESCE(users.track_id, 'track_padrao'),
       must_change_password = false,
       one_user_id = EXCLUDED.one_user_id,
       one_business_group_id = EXCLUDED.one_business_group_id,
       one_store_id = EXCLUDED.one_store_id,
       one_context = EXCLUDED.one_context
     RETURNING id, name, email, role, track_id, must_change_password`,
    [id, name, email, ONE_MANAGED_PASSWORD, role, oneUserId, businessGroupId, storeId, contextJson]
  );

  await pool.query(
    `INSERT INTO user_track_progress (user_id, track_id, progresso_geral)
     VALUES ($1, 'track_padrao', 0)
     ON CONFLICT (user_id, track_id) DO NOTHING`,
    [result.rows[0].id]
  );

  return result.rows[0];
}

export function oneSessionFields(oneAuth, portalContext, requestedBusinessGroupId) {
  return {
    authSource: 'one',
    oneUserId: Number(oneAuth?.user?.id || portalContext?.userId || 0) || null,
    oneBusinessGroupId: selectedBusinessGroupId(portalContext, requestedBusinessGroupId),
    oneStoreId: selectedStoreId(portalContext),
    oneExpiresAt: oneAuth?.expiresAt || null,
  };
}

export function readJwtPayload(token) {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    const normalized = payload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(payload.length / 4) * 4, '=');
    return JSON.parse(Buffer.from(normalized, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}

export function readJwtExpiresAt(token) {
  const decoded = readJwtPayload(token);
  return decoded?.exp ? new Date(decoded.exp * 1000).toISOString() : null;
}
