export default function ExemploRoteiro() {
  return <main style={{fontFamily:'system-ui, sans-serif',background:'#f8f5f0',minHeight:'100vh',padding:'32px 20px',color:'#193640'}}>
    <div style={{maxWidth:960,margin:'auto'}}>
      <a href="/platform" style={{color:'#205c6b',fontWeight:700,textDecoration:'none'}}>← Voltar ao Treinamentos</a>
      <p style={{margin:'28px 0 6px',color:'#d87415',fontSize:13,fontWeight:750,textTransform:'uppercase',letterSpacing:'.08em'}}>Exemplo de aula · Apresentação / Cadastros</p>
      <h1 style={{margin:'0 0 8px',fontSize:'clamp(28px,5vw,38px)'}}>Usuários</h1>
      <p style={{margin:'0 0 24px',color:'#5e767d'}}>Uma prévia com o vídeo existente e o material correspondente do Gestores.</p>
      <section style={{background:'#fff',border:'1px solid #dce6e8',borderRadius:14,padding:20,marginBottom:18}}>
        <h2 style={{fontSize:20,margin:'0 0 14px'}}>Vídeo: cadastro de usuários</h2>
        <div style={{position:'relative',paddingBottom:'56.25%',background:'#132d36',borderRadius:10,overflow:'hidden'}}>
          <iframe src="https://www.youtube.com/embed/Djpmq4MQ134" title="Vídeo de treinamento sobre usuários" style={{position:'absolute',inset:0,width:'100%',height:'100%',border:0}} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      </section>
      <section style={{background:'#fff',border:'1px solid #dce6e8',borderRadius:14,padding:20}}>
        <h2 style={{fontSize:20,margin:'0 0 8px'}}>Material de apoio: usuários no Gestores</h2>
        <p style={{color:'#5e767d'}}>Consulte os passos e as imagens nas páginas 167 a 168 do manual. A página original pode incluir assuntos próximos.</p>
        {[167,168].map(n=><img key={n} src={`/material-gestores/${n}.webp`} alt={`Página ${n} do manual do Gestores`} loading="lazy" style={{display:'block',width:'100%',height:'auto',margin:'16px 0',border:'1px solid #dce6e8',borderRadius:6}} />)}
      </section>
    </div>
  </main>;
}
