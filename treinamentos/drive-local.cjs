// Integração local de teste: tokens protegidos pelo usuário do Windows (DPAPI).
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { parseWorkbook, parseNewWorkbook } = require('./plantoes-parser.cjs');
const dir = path.join(process.env.LOCALAPPDATA, 'MonaFAQ-local');
const clientFile = path.join(dir, 'google-client.json');
const tokenFile = path.join(dir, 'drive-token.dpapi');
const redirect = 'http://127.0.0.1:3081/google-drive/callback';
const pending = new Map();

function client() {
  let data; try { data=JSON.parse(fs.readFileSync(clientFile,'utf8')).installed; } catch { throw new Error('Cliente Google ainda não configurado.'); }
  if (!data?.client_id || !data?.client_secret) throw new Error('Cliente Google inválido.');
  return data;
}
function protect(value, decrypt=false) {
  const cmd = decrypt
    ? '$v=[Console]::In.ReadToEnd();$b=[Convert]::FromBase64String($v);$r=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Text.Encoding]::UTF8.GetString($r))'
    : '$v=[Console]::In.ReadToEnd();$b=[Text.Encoding]::UTF8.GetBytes($v);$r=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Out.Write([Convert]::ToBase64String($r))';
  const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Add-Type -AssemblyName System.Security;${cmd}`],{input:value,encoding:'utf8',windowsHide:true});
  if(result.status!==0) throw new Error('Não foi possível proteger a conexão local.');
  return result.stdout;
}
async function tokenRequest(fields) {
  const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(fields)});
  const body=await r.json(); if(!r.ok) throw new Error('Autorização Google inválida ou expirada.'); return body;
}
function begin(user) {
  const c=client(), state=crypto.randomBytes(24).toString('base64url'), verifier=crypto.randomBytes(48).toString('base64url');
  const challenge=crypto.createHash('sha256').update(verifier).digest('base64url');
  pending.set(state,{verifier,email:user.email,expires:Date.now()+10*60*1000});
  const q=new URLSearchParams({client_id:c.client_id,redirect_uri:redirect,response_type:'code',scope:'https://www.googleapis.com/auth/drive.readonly',access_type:'offline',prompt:'consent',state,code_challenge:challenge,code_challenge_method:'S256'});
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}
async function finish(user,params) {
  const state=params.get('state'), attempt=pending.get(state); pending.delete(state);
  if(!attempt||attempt.email!==user.email||attempt.expires<Date.now()||!params.get('code')) throw new Error('Autorização inválida ou expirada.');
  const c=client(), body=await tokenRequest({code:params.get('code'),client_id:c.client_id,client_secret:c.client_secret,redirect_uri:redirect,grant_type:'authorization_code',code_verifier:attempt.verifier});
  if(!body.refresh_token) throw new Error('O Google não retornou uma conexão renovável.');
  fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(tokenFile,protect(body.refresh_token),{mode:0o600});
}
async function read() {
  const c=client();let token;try{token=protect(fs.readFileSync(tokenFile,'utf8'),true)}catch{throw new Error('Conecte o Google Drive para atualizar os plantões.')}
  const auth=await tokenRequest({client_id:c.client_id,client_secret:c.client_secret,refresh_token:token,grant_type:'refresh_token'});
  const r=await fetch('https://www.googleapis.com/drive/v3/files/1UU80kFHPeAKUWar1tQJ4hcfS5Kmapxcz?alt=media',{headers:{Authorization:`Bearer ${auth.access_token}`}});
  if(!r.ok)throw new Error('Não foi possível ler a planilha no Google Drive.');
  const bytes=Buffer.from(await r.arrayBuffer()); if(bytes.length>10*1024*1024)throw new Error('A planilha excede o limite de 10 MB.');
  const original=await parseWorkbook(bytes);
  let newSchedule=null, newScheduleError='';
  try {
    const exportUrl='https://www.googleapis.com/drive/v3/files/1GUzkm0eacKvCe4cgVPEAJFyrDPgXx7snSr_CQpE3A-Q/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet';
    const response=await fetch(exportUrl,{headers:{Authorization:`Bearer ${auth.access_token}`}});
    if (!response.ok) throw new Error('A conta conectada não consegue ler a nova planilha.');
    const data=Buffer.from(await response.arrayBuffer());
    if (data.length>10*1024*1024) throw new Error('A nova planilha excede o limite de 10 MB.');
    newSchedule=await parseNewWorkbook(data);
  } catch(err) { newScheduleError=err.message || 'Não foi possível ler a nova planilha.'; }
  return {...original,newSchedule,newScheduleError,updatedAt:new Date().toISOString()};
}
module.exports={begin,finish,read,configured:()=>fs.existsSync(clientFile)&&fs.existsSync(tokenFile),clientFile};
