import { useState } from 'react';
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export default function StudentPicker({users,value,onChange,emptyLabel='Selecione o aluno'}) {
 const [search,setSearch]=useState('');
 const selected=users.find(u=>u.id===value);
 const matches=users.filter(u=>normalize(u.name+' '+u.email).includes(normalize(search))).slice(0,30);
 return <div className="student-picker">
  <input type="search" aria-label="Buscar aluno por nome ou e-mail" placeholder="Buscar aluno por nome ou e-mail" value={search} onChange={e=>setSearch(e.target.value)} />
  {selected && <p>Selecionado: <strong>{selected.name}</strong> ({selected.email}) <button type="button" className="btn-ghost" onClick={()=>onChange('')}>Limpar</button></p>}
  {!selected && <div className="student-picker-results" aria-label="Alunos encontrados">{emptyLabel === 'Todos os alunos' && <button type="button" className="btn-ghost" onClick={()=>onChange('')}>Todos os alunos</button>}{matches.map(u=><button type="button" className="btn-ghost" key={u.id} onClick={()=>{onChange(u.id);setSearch('')}}><strong>{u.name}</strong> <small>{u.email}</small></button>)}{!matches.length && <p>Nenhum aluno encontrado.</p>}</div>}
 </div>;
}
