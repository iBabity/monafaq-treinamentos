import {env} from "cloudflare:workers";
export function authorized(req:Request){return req.headers.get("origin")===new URL(req.url).origin && !!req.headers.get("oai-authenticated-user-id")}
export function actor(req:Request){return {id:(req.headers.get("oai-authenticated-user-id")||"").slice(0,128),email:(req.headers.get("oai-authenticated-user-email")||"").slice(0,255)}}
export function auditStatement(req:Request,action:string,details:string){if(!env.DB)throw Error("db unavailable");const u=actor(req);return env.DB.prepare("INSERT INTO audit_log (id, created_at, actor_id, actor_email, action, details) VALUES (?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(),new Date().toISOString(),u.id,u.email,action,details.slice(0,500))}
export async function logAction(req:Request,action:string,details:string){if(!env.DB)throw Error("db unavailable");await auditStatement(req,action,details).run()}
