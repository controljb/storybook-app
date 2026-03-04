import { useState, useEffect, useRef } from 'react'

// ─── API ──────────────────────────────────────────────────────────────────────
const API = {
  async newProject() {
    return fetch('/api/projects/new', { method: 'POST' }).then(r => r.json())
  },
  async uploadAsset(pid, type, slug, file) {
    const fd = new FormData()
    fd.append('asset_type', type); fd.append('slug', slug); fd.append('file', file)
    return fetch(`/api/projects/${pid}/assets`, { method: 'POST', body: fd }).then(r => r.json())
  },
  async saveManifest(pid, data) {
    return fetch(`/api/projects/${pid}/manifest`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then(r => r.json())
  },
  async generateImages(pid) {
    return fetch(`/api/projects/${pid}/generate-images`, { method: 'POST' }).then(r => r.json())
  },
  async regenPage(pid, pageIndex, extraInstruction) {
    const fd = new FormData()
    fd.append('page_index', pageIndex)
    fd.append('extra_instruction', extraInstruction || '')
    return fetch(`/api/projects/${pid}/regen-page`, { method: 'POST', body: fd }).then(r => r.json())
  },
  async finalize(pid) {
    return fetch(`/api/projects/${pid}/finalize`, { method: 'POST' }).then(r => r.json())
  },
  async pollJob(jid) {
    return fetch(`/api/jobs/${jid}`).then(r => r.json())
  },
  async getOutputs(pid) {
    return fetch(`/api/projects/${pid}/outputs`).then(r => r.json())
  },
}

// ─── Primitives ───────────────────────────────────────────────────────────────
function Label({ children, required }) {
  return (
    <div style={{ fontFamily:'Cinzel,serif', fontSize:11, letterSpacing:'0.12em',
      textTransform:'uppercase', color:'var(--gold)', marginBottom:7 }}>
      {children}{required && <span style={{color:'var(--red)',marginLeft:3}}>*</span>}
    </div>
  )
}

function Input({ value, onChange, placeholder, type='text' }) {
  const s = { width:'100%', padding:'9px 13px', background:'rgba(255,255,255,0.04)',
    border:'1px solid var(--border)', borderRadius:7, color:'var(--parchment)',
    fontSize:15, outline:'none', transition:'border-color 0.2s', boxSizing:'border-box' }
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)}
    placeholder={placeholder} style={s}
    onFocus={e=>e.target.style.borderColor='var(--gold)'}
    onBlur={e=>e.target.style.borderColor='var(--border)'} />
}

function Textarea({ value, onChange, placeholder, rows=3 }) {
  const s = { width:'100%', padding:'9px 13px', background:'rgba(255,255,255,0.04)',
    border:'1px solid var(--border)', borderRadius:7, color:'var(--parchment)',
    fontSize:15, outline:'none', resize:'vertical', transition:'border-color 0.2s',
    lineHeight:1.55, boxSizing:'border-box' }
  return <textarea rows={rows} value={value} onChange={e=>onChange(e.target.value)}
    placeholder={placeholder} style={s}
    onFocus={e=>e.target.style.borderColor='var(--gold)'}
    onBlur={e=>e.target.style.borderColor='var(--border)'} />
}

function Field({ label, required, children }) {
  return <div style={{display:'flex',flexDirection:'column'}}>
    {label && <Label required={required}>{label}</Label>}
    {children}
  </div>
}

function Card({ children, style={} }) {
  return <div style={{ background:'rgba(255,255,255,0.035)', border:'1px solid var(--border)',
    borderRadius:14, padding:22, animation:'fadeUp 0.3s ease both', ...style }}>{children}</div>
}

function Btn({ children, onClick, disabled, variant='primary', small=false, style:ext={} }) {
  const base = { padding: small?'7px 16px':'11px 26px', borderRadius:7, border:'none',
    fontFamily:'Cinzel,serif', fontWeight:600, fontSize:small?13:15, letterSpacing:'0.04em',
    cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.45:1, transition:'all 0.18s' }
  const vars = {
    primary: { background:'var(--gold)', color:'var(--ink)' },
    ghost:   { background:'transparent', color:'var(--gold)', border:'1px solid var(--border-gold)' },
    danger:  { background:'var(--red)', color:'#fff' },
    forest:  { background:'var(--green-dark)', color:'var(--parchment)', border:'1px solid rgba(255,255,255,0.12)' },
    amber:   { background:'#b87333', color:'#fff' },
  }
  return <button style={{...base,...vars[variant],...ext}} onClick={onClick} disabled={disabled}>{children}</button>
}

function PlusBtn({ onClick, label }) {
  return <button onClick={onClick} style={{ display:'flex', alignItems:'center', gap:8,
    background:'transparent', border:'1px dashed var(--border-gold)', borderRadius:8,
    padding:'9px 18px', color:'var(--gold)', cursor:'pointer', fontFamily:'Cinzel,serif',
    fontSize:13, letterSpacing:'0.06em', transition:'all 0.18s', width:'100%', justifyContent:'center' }}
    onMouseEnter={e=>e.currentTarget.style.background='rgba(200,146,42,0.07)'}
    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
    <span style={{fontSize:18,lineHeight:1}}>+</span> {label}
  </button>
}

function ImgTile({ preview, onFile, hint, label, size=100 }) {
  const ref = useRef()
  return <div onClick={()=>ref.current.click()} title={label} style={{
    border:`2px dashed ${preview?'var(--gold)':'var(--border)'}`, borderRadius:10,
    cursor:'pointer', overflow:'hidden',
    background:preview?'rgba(200,146,42,0.05)':'rgba(255,255,255,0.02)',
    display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
    minHeight:size, transition:'all 0.2s', position:'relative' }}
    onMouseEnter={e=>e.currentTarget.style.borderColor='var(--gold-light)'}
    onMouseLeave={e=>e.currentTarget.style.borderColor=preview?'var(--gold)':'var(--border)'}>
    <input ref={ref} type="file" accept="image/*" style={{display:'none'}}
      onChange={e=>e.target.files[0]&&onFile(e.target.files[0])} />
    {preview
      ? <img src={preview} alt={label} style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}} />
      : <><div style={{fontSize:28,opacity:0.3}}>🖼</div>
          <div style={{fontSize:12,color:'var(--text-muted)',marginTop:6,textAlign:'center',padding:'0 8px'}}>{hint||label}</div></>}
  </div>
}

function DrawingBadge() {
  return (
    <div style={{display:'inline-flex',alignItems:'center',gap:4,
      background:'rgba(138,99,210,0.15)',border:'1px solid rgba(138,99,210,0.4)',
      borderRadius:12,padding:'2px 8px',fontSize:11,color:'#b794f4',
      fontFamily:'Cinzel,serif',letterSpacing:'0.06em'}}>
      ✏️ Drawing
    </div>
  )
}

function SectionHead({ icon, title, subtitle }) {
  return <div style={{marginBottom:20}}>
    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:4}}>
      <span style={{fontSize:20}}>{icon}</span>
      <h2 style={{fontFamily:'Cinzel,serif',fontSize:19,fontWeight:700,
        color:'var(--parchment)',letterSpacing:'0.025em'}}>{title}</h2>
    </div>
    {subtitle && <p style={{color:'var(--text-muted)',fontSize:13,paddingLeft:30,fontStyle:'italic'}}>{subtitle}</p>}
  </div>
}

function Divider() {
  return <div style={{display:'flex',alignItems:'center',gap:12,margin:'32px 0'}}>
    <div style={{flex:1,height:1,background:'var(--border)'}} />
    <div style={{color:'var(--border-gold)',fontSize:14}}>✦</div>
    <div style={{flex:1,height:1,background:'var(--border)'}} />
  </div>
}

function ProgressBar({ pct, error }) {
  return <div style={{background:'rgba(255,255,255,0.06)',borderRadius:4,height:8,overflow:'hidden'}}>
    <div style={{ height:'100%', borderRadius:4, transition:'width 0.6s ease',
      background: error ? 'var(--red)' : 'linear-gradient(90deg,var(--leather),var(--gold),var(--gold-light))',
      width:`${pct}%` }} />
  </div>
}

// ─── Review Screen ─────────────────────────────────────────────────────────────
function ReviewScreen({ projectId, outputs, onFinalize, finalJobData, finalOutputs }) {
  const [regenJobs, setRegenJobs]       = useState({})
  const [instructions, setInstructions] = useState({})
  const [finalizing, setFinalizing]     = useState(false)

  const allPages = [
    ...(outputs.title ? [{ key:'title', label:'Title Page', src:outputs.title, index:0 }] : []),
    ...(outputs.images||[]).map((src,i) => ({ key:`page_${i+1}`, label:`Page ${i+1}`, src, index:i+1 })),
  ]

  useEffect(() => {
    const active = Object.entries(regenJobs).filter(([,j]) => j.status==='running')
    if (active.length===0) return
    const tid = setInterval(async () => {
      const updates = {}
      for (const [key,job] of active) {
        const d = await API.pollJob(job.jobId)
        updates[key] = { ...job, status:d.status, log:d.log, progress:d.progress }
      }
      setRegenJobs(prev => ({ ...prev, ...updates }))
    }, 2000)
    return () => clearInterval(tid)
  }, [regenJobs])

  const handleRegen = async (page) => {
    const instruction = instructions[page.key] || ''
    const { job_id } = await API.regenPage(projectId, page.index, instruction)
    setRegenJobs(prev => ({ ...prev, [page.key]: { jobId:job_id, status:'running', log:[], progress:0 } }))
  }

  const handleFinalize = async () => { setFinalizing(true); onFinalize() }
  const anyRunning = Object.values(regenJobs).some(j => j.status==='running')

  return (
    <div style={{display:'flex',flexDirection:'column',gap:24}}>
      <Card>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
          <div>
            <div style={{fontFamily:'Cinzel,serif',fontSize:18,color:'var(--gold)',marginBottom:4}}>
              ✅ Images Ready — Review Each Page
            </div>
            <p style={{color:'var(--text-muted)',fontSize:14,fontStyle:'italic'}}>
              Not happy with a page? Add instructions and hit Regenerate. When everything looks good, click Finalize.
            </p>
          </div>
          <Btn onClick={handleFinalize} disabled={anyRunning||finalizing} style={{fontSize:16,padding:'12px 32px'}}>
            {finalizing ? '⏳ Finalizing…' : '🎬 Finalize Book & Video'}
          </Btn>
        </div>
      </Card>

      {finalJobData && (
        <Card>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
            <span style={{fontFamily:'Cinzel,serif',fontSize:14,
              color:finalJobData.status==='done'?'var(--gold)':finalJobData.status==='error'?'#ff6b6b':'var(--parchment)'}}>
              {finalJobData.status==='done'?'✨ Done!':finalJobData.status==='error'?'⚠ Error':'⏳ Building…'}
            </span>
            <span style={{fontFamily:'Cinzel,serif',fontSize:13,color:'var(--gold-light)'}}>{finalJobData.progress||0}%</span>
          </div>
          <ProgressBar pct={finalJobData.progress||0} error={finalJobData.status==='error'} />
          {finalJobData.log?.length>0 && (
            <div style={{marginTop:12,maxHeight:120,overflowY:'auto',fontFamily:'monospace',fontSize:12,display:'flex',flexDirection:'column',gap:2}}>
              {finalJobData.log.map((l,i)=><div key={i} style={{color:l.startsWith('FATAL')?'#ff8080':'var(--parchment-mid)',lineHeight:1.5}}>› {l}</div>)}
            </div>
          )}
          {finalJobData.status==='done' && finalOutputs && (
            <div style={{marginTop:16,display:'flex',gap:12,flexWrap:'wrap'}}>
              {finalOutputs.pdf && <a href={finalOutputs.pdf} download="storybook.pdf" style={{textDecoration:'none'}}><Btn variant="primary">📖 Download PDF</Btn></a>}
              {finalOutputs.video && <a href={finalOutputs.video} download="storybook_video.mp4" style={{textDecoration:'none'}}><Btn variant="forest">🎬 Download Video</Btn></a>}
            </div>
          )}
        </Card>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:16}}>
        {allPages.map(page => {
          const job = regenJobs[page.key]
          const running = job?.status==='running'
          const imgSrc = job?.status==='done' ? `${page.src}?v=${Date.now()}` : page.src
          return (
            <Card key={page.key} style={{padding:16,display:'flex',flexDirection:'column',gap:12}}>
              <div style={{fontFamily:'Cinzel,serif',fontSize:13,color:'var(--gold)',letterSpacing:'0.06em'}}>{page.label}</div>
              <div style={{position:'relative',borderRadius:8,overflow:'hidden',background:'#000'}}>
                <img src={imgSrc} alt={page.label} style={{width:'100%',display:'block',opacity:running?0.4:1,transition:'opacity 0.3s'}} />
                {running && (
                  <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',gap:8}}>
                    <div style={{width:32,height:32,border:'3px solid var(--gold)',borderTopColor:'transparent',borderRadius:'50%',animation:'spin 0.8s linear infinite'}} />
                    <span style={{color:'var(--gold)',fontFamily:'Cinzel,serif',fontSize:12}}>{job.progress||0}%</span>
                  </div>
                )}
              </div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                <Textarea value={instructions[page.key]||''} onChange={v=>setInstructions(prev=>({...prev,[page.key]:v}))}
                  placeholder="Optional: describe what to change (e.g. 'make the sky darker', 'add more trees')" rows={2} />
                <Btn variant="amber" small onClick={()=>handleRegen(page)} disabled={running||finalizing}>
                  {running?'⏳ Regenerating…':'🔄 Regenerate This Page'}
                </Btn>
                {job?.log?.length>0 && (
                  <div style={{fontSize:12,fontFamily:'monospace',color:job.status==='error'?'#ff8080':'var(--text-muted)',lineHeight:1.4}}>
                    {job.log[job.log.length-1]}
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}

// ─── Art Style Definitions ────────────────────────────────────────────────────
const ART_STYLES = [
  { id:'lego',     icon:'🧱', label:'LEGO',          hint:'Yellow minifig heads, plastic bricks, studio lighting.' },
  { id:'dino',     icon:'🦕', label:'Dino Toys',      hint:'Physical plastic dinosaur figurines, painted, glossy, posed in a scene.' },
  { id:'plush',    icon:'🧸', label:'Plush / Stuffed', hint:'Soft fabric, button eyes, stitched seams — real stuffed animals.' },
  { id:'wooden',   icon:'🪵', label:'Wooden Toys',    hint:'Painted wooden figurines, visible grain, Scandinavian toy aesthetic.' },
  { id:'minecraft',icon:'⛏️', label:'Minecraft',      hint:'Cubic voxel blocks, pixelated textures, blocky characters.' },
  { id:'roblox',   icon:'🎮', label:'Roblox',         hint:'Blocky Roblox avatars, bright low-poly 3D worlds, shiny surfaces.' },
  { id:'drawing',  icon:'✏️', label:'My Drawing',     hint:'Preserves your hand-drawn style — crayon, marker or pencil look.' },
  { id:'custom',   icon:'🎨', label:'Custom…',        hint:'Describe any art style you want.' },
]

const STYLE_PROMPTS = {
  lego:      "Real LEGO toy photography style. Plastic LEGO minifigures and brick builds, highly detailed, colorful, warm studio lighting. Characters must look exactly like real LEGO minifigures with yellow heads, claw hands, and snap-together bodies.",
  dino:      "Real plastic dinosaur toy photography style. The dinosaurs must look like physical toy figurines — painted plastic, slightly glossy, standing on flat bases. Warm studio lighting, simple colorful backgrounds.",
  plush:     "Real stuffed animal / plush toy photography style. Soft fabric textures, button eyes, stitched seams visible. Characters look like actual stuffed animals posed in a scene. Warm soft lighting.",
  wooden:    "Wooden toy photography style. Characters and objects look like painted wooden figurines — visible grain, smooth lacquer finish, simple rounded shapes. Scandinavian toy aesthetic.",
  minecraft: "Minecraft video game art style. Everything is made of cubic voxel blocks. Characters are blocky Minecraft-style with pixel-art textures. Environments are built from recognizable Minecraft blocks — grass, dirt, stone, wood planks. Warm nostalgic lighting, pixelated textures throughout.",
  roblox:    "Roblox video game art style. Characters are Roblox avatars — blocky 3D figures with rounded box-shaped heads, stubby limbs, and colorful outfits. Environments look like Roblox game worlds — bright saturated colors, clean low-poly 3D geometry, plastic-like shiny surfaces.",
  drawing:   "Children's hand-drawn illustration style. Preserve the naive, hand-made quality of the reference drawings. Crayon, marker or colored pencil textures. Slightly wobbly lines, flat colors, simple shapes — as if drawn by a child. Keep it looking hand-made and charming, not digital or polished.",
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [projectId,    setProjectId]    = useState(null)
  const [apiKey,       setApiKey]       = useState('')
  const [bookTitle,    setBookTitle]    = useState('')
  const [theme,        setTheme]        = useState('light')
  const [artStyle,     setArtStyle]     = useState('dino')
  const [customStyle,  setCustomStyle]  = useState('')
  const [titleFile,    setTitleFile]    = useState(null)
  const [titlePrev,    setTitlePrev]    = useState(null)
  const [characters,   setCharacters]   = useState([{ slug:'', description:'', file:null, preview:null, isDrawing:false }])
  const [locations,    setLocations]    = useState([{ slug:'', tags:'', fileA:null, prevA:null, fileB:null, prevB:null, isDrawing:false }])
  const [pages,        setPages]        = useState([{ narration:'', description:'', motion:'', chars:[], location:'', duration:10, file:null, preview:null, isDrawing:false }])

  const [phase,        setPhase]        = useState('form')
  const [jobId,        setJobId]        = useState(null)
  const [jobData,      setJobData]      = useState(null)
  const [outputs,      setOutputs]      = useState(null)
  const [finalJobId,   setFinalJobId]   = useState(null)
  const [finalJobData, setFinalJobData] = useState(null)
  const [finalOutputs, setFinalOutputs] = useState(null)
  const [error,        setError]        = useState('')
  const [submitting,   setSubmitting]   = useState(false)

  useEffect(() => { API.newProject().then(r => setProjectId(r.project_id)).catch(()=>{}) }, [])

  useEffect(() => {
    if (!jobId || phase!=='generating') return
    const tid = setInterval(async () => {
      const d = await API.pollJob(jobId)
      setJobData(d)
      if (d.status==='review') {
        clearInterval(tid)
        const outs = await API.getOutputs(projectId)
        setOutputs(outs); setPhase('review')
      } else if (d.status==='error') {
        clearInterval(tid); setPhase('form'); setSubmitting(false)
      }
    }, 3000)
    return () => clearInterval(tid)
  }, [jobId, phase, projectId])

  useEffect(() => {
    if (!finalJobId) return
    const tid = setInterval(async () => {
      const d = await API.pollJob(finalJobId)
      setFinalJobData(d)
      if (d.status==='done') {
        clearInterval(tid)
        const outs = await API.getOutputs(projectId)
        setFinalOutputs(outs)
      } else if (d.status==='error') { clearInterval(tid) }
    }, 3000)
    return () => clearInterval(tid)
  }, [finalJobId, projectId])

  const ext = f => f?.name?.slice(f.name.lastIndexOf('.')) || '.png'

  const handleGenerate = async () => {
    setError('')
    if (!apiKey.trim())    return setError('Please enter your xAI API key.')
    if (!bookTitle.trim()) return setError('Please enter a book title.')
    if (pages.some(p => !p.narration.trim())) return setError('Every page needs page text.')
    setSubmitting(true)
    try {
      const charAssets = {}; const charDescs = {}
      for (const c of characters.filter(c => c.slug && c.file)) {
        const slug = c.slug.trim().toLowerCase().replace(/\s+/g,'_')
        await API.uploadAsset(projectId, 'character', slug, c.file)
        charAssets[slug] = {
          path: `assets/characters/${slug}${ext(c.file)}`,
          tags: [slug],
          is_drawing: c.isDrawing,
        }
        // Build description — prepend drawing note if flagged
        let desc = c.description || ''
        if (c.isDrawing) {
          desc = `This character reference is a hand-drawn sketch. Use the drawing's shapes, colors and design as the character's defining features. Bring the drawn character to life while staying true to the sketch. ${desc}`
        }
        if (desc) charDescs[slug] = desc
      }

      const locAssets = {}
      for (const l of locations.filter(l => l.slug && (l.fileA||l.fileB))) {
        const slug = l.slug.trim().toLowerCase().replace(/\s+/g,'_')
        const refs = []
        if (l.fileA) { await API.uploadAsset(projectId,'location',`${slug}_a`,l.fileA); refs.push(`assets/locations/${slug}_a${ext(l.fileA)}`) }
        if (l.fileB) { await API.uploadAsset(projectId,'location',`${slug}_b`,l.fileB); refs.push(`assets/locations/${slug}_b${ext(l.fileB)}`) }
        locAssets[slug] = {
          refs, tags: l.tags ? l.tags.split(',').map(t=>t.trim()).filter(Boolean) : [slug],
          is_drawing: l.isDrawing,
        }
      }

      let titleBase = null
      if (titleFile) { await API.uploadAsset(projectId,'location','title_ref',titleFile); titleBase=`assets/locations/title_ref${ext(titleFile)}` }

      const builtPages = []
      for (let i=0; i<pages.length; i++) {
        const p = pages[i]; let base = null
        if (p.file) {
          const slug=`page_ref_${i+1}`
          await API.uploadAsset(projectId,'location',slug,p.file)
          base=`assets/locations/${slug}${ext(p.file)}`
        }
        let desc = p.description
        if (p.isDrawing && base) {
          desc = `The reference image for this page is a hand-drawn sketch. Use it as a guide for the scene composition, characters and layout. Bring the drawing to life while preserving its spirit and design. ${desc}`
        }
        builtPages.push({
          raw_narration_text:  p.narration,
          raw_description:     desc,
          motion_prompt:       p.motion,
          include_characters:  p.chars.length>0 ? p.chars : Object.keys(charAssets),
          location:            p.location || undefined,
          duration_seconds:    p.duration || 10,
          is_drawing_ref:      p.isDrawing,
          ...(base ? { base_image: base } : {}),
        })
      }

      const stylePrompt = artStyle==='custom'
        ? (customStyle || "Warm, colorful children's book illustration style.")
        : (STYLE_PROMPTS[artStyle] || STYLE_PROMPTS.drawing)

      // For drawing mode: override consistency rules to be sketch-friendly
      const drawingMode = artStyle === 'drawing'

      const manifest = {
        api_key:             apiKey.trim(),
        theme,
        art_style:           artStyle,
        drawing_mode:        drawingMode,
        global_style_prompt: stylePrompt,
        title: {
          raw_description: `${bookTitle} — an adventure begins`,
          title_text:      bookTitle,
          ...(titleBase ? { base_image: titleBase } : {}),
        },
        assets:                  { characters: charAssets, locations: locAssets },
        character_descriptions:  charDescs,
        pages:                   builtPages,
      }

      await API.saveManifest(projectId, manifest)
      const { job_id } = await API.generateImages(projectId)
      setJobId(job_id); setPhase('generating')
    } catch(e) {
      setError(`Failed to start: ${e.message}`)
      setSubmitting(false)
    }
  }

  const handleFinalize = async () => {
    setPhase('finalizing')
    const { job_id } = await API.finalize(projectId)
    setFinalJobId(job_id)
  }

  const setChar = (i,p) => setCharacters(cs => cs.map((c,j) => j===i?{...c,...p}:c))
  const setLoc  = (i,p) => setLocations(ls => ls.map((l,j) => j===i?{...l,...p}:l))
  const setPage = (i,p) => setPages(ps => ps.map((pg,j) => j===i?{...pg,...p}:pg))
  const togglePageChar = (pi, slug) => {
    const p = pages[pi]
    setPage(pi, { chars: p.chars.includes(slug) ? p.chars.filter(c=>c!==slug) : [...p.chars,slug] })
  }
  const charSlugs = characters.map(c=>c.slug.trim()).filter(Boolean)
  const locSlugs  = locations.map(l=>l.slug.trim()).filter(Boolean)
  const isDrawingMode = artStyle === 'drawing'

  return (
    <div style={{minHeight:'100vh',position:'relative'}}>
      <div style={{ position:'fixed', inset:0, zIndex:0, pointerEvents:'none',
        background:`radial-gradient(ellipse 60% 40% at 15% 5%, rgba(122,79,45,0.18) 0%, transparent 60%),
          radial-gradient(ellipse 50% 35% at 85% 90%, rgba(36,61,26,0.15) 0%, transparent 55%), #100c06` }} />

      <div style={{position:'relative',zIndex:1,maxWidth:900,margin:'0 auto',padding:'40px 24px 80px'}}>

        {/* Header */}
        <div style={{textAlign:'center',marginBottom:48}}>
          <div style={{fontFamily:'Cinzel,serif',fontSize:11,letterSpacing:'0.25em',
            textTransform:'uppercase',color:'var(--gold)',marginBottom:14,opacity:0.8}}>
            ✦ &nbsp; A Story Forged From Your Imagination &nbsp; ✦
          </div>
          <h1 style={{fontFamily:'Cinzel,serif',fontSize:'clamp(26px,5vw,42px)',fontWeight:700,
            color:'var(--parchment)',letterSpacing:'0.04em',lineHeight:1.2,
            textShadow:'0 0 40px rgba(200,146,42,0.25)',marginBottom:12}}>
            Storybook Generator
          </h1>
          <p style={{color:'var(--text-muted)',fontStyle:'italic',fontSize:16,maxWidth:540,margin:'0 auto'}}>
            Upload photos, toy sets, or hand-drawn pictures · write your pages · review · create your book
          </p>
        </div>

        {/* ── GENERATING ── */}
        {phase==='generating' && (
          <Card>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:12}}>
              <span style={{fontFamily:'Cinzel,serif',fontSize:15,color:'var(--parchment)'}}>⏳ Generating page images…</span>
              <span style={{fontFamily:'Cinzel,serif',fontSize:13,color:'var(--gold-light)'}}>{jobData?.progress||0}%</span>
            </div>
            <ProgressBar pct={jobData?.progress||0} error={false} />
            {jobData?.log?.length>0 && (
              <div style={{marginTop:14,maxHeight:200,overflowY:'auto',display:'flex',flexDirection:'column',gap:3}}>
                {jobData.log.map((l,i)=>(
                  <div key={i} style={{fontFamily:'monospace',fontSize:12,
                    color:l.startsWith('FATAL')?'#ff8080':'var(--parchment-mid)',lineHeight:1.5}}>› {l}</div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── REVIEW ── */}
        {(phase==='review'||phase==='finalizing') && outputs && (
          <ReviewScreen projectId={projectId} outputs={outputs}
            onFinalize={handleFinalize} finalJobData={finalJobData} finalOutputs={finalOutputs} />
        )}

        {/* ── FORM ── */}
        {phase==='form' && (
          <div style={{display:'flex',flexDirection:'column',gap:0}}>

            {/* SETUP */}
            <section>
              <SectionHead icon="⚙️" title="Setup"
                subtitle="Your xAI API key is sent directly to xAI — never stored on any server." />
              <Card>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
                  <Field label="xAI API Key" required>
                    <Input value={apiKey} onChange={setApiKey} placeholder="xai-…" type="password" />
                  </Field>
                  <Field label="Book Title" required>
                    <Input value={bookTitle} onChange={setBookTitle} placeholder="Grayson and the Dino Adventure" />
                  </Field>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18,marginBottom:18}}>
                  <Field label="Cover Reference Image (optional)">
                    <ImgTile preview={titlePrev} hint="Photo, toy set, or drawing for the cover"
                      label="Cover image" onFile={f=>{setTitleFile(f);setTitlePrev(URL.createObjectURL(f))}} size={100} />
                  </Field>
                  <Field label="Lighting Mood">
                    <div style={{display:'flex',gap:10,height:100,alignItems:'stretch'}}>
                      {['light','dark'].map(t=>(
                        <button key={t} onClick={()=>setTheme(t)} style={{
                          flex:1, borderRadius:8, cursor:'pointer',
                          border:`2px solid ${theme===t?'var(--gold)':'var(--border)'}`,
                          background:theme===t?'rgba(200,146,42,0.09)':'rgba(255,255,255,0.02)',
                          display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:6,
                          transition:'all 0.2s', color:theme===t?'var(--gold)':'var(--text-muted)',
                          fontFamily:'Cinzel,serif', fontSize:12, letterSpacing:'0.06em'}}>
                          <span style={{fontSize:20}}>{t==='light'?'☀️':'🌙'}</span>
                          {t==='light'?'Bright & Warm':'Dark & Moody'}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>

                {/* ── ART STYLE PICKER ── */}
                <div>
                  <Label>Art Style</Label>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
                    {ART_STYLES.map(s=>(
                      <button key={s.id} onClick={()=>setArtStyle(s.id)} style={{
                        borderRadius:8, cursor:'pointer', padding:'10px 6px',
                        border:`2px solid ${artStyle===s.id?'var(--gold)':'var(--border)'}`,
                        background:artStyle===s.id?'rgba(200,146,42,0.09)':'rgba(255,255,255,0.02)',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:5,
                        transition:'all 0.2s'}}>
                        <span style={{fontSize:22}}>{s.icon}</span>
                        <span style={{fontFamily:'Cinzel,serif',fontSize:10,
                          color:artStyle===s.id?'var(--gold)':'var(--text-muted)',
                          letterSpacing:'0.04em',textAlign:'center',lineHeight:1.3}}>{s.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Description blurb */}
                  <div style={{marginTop:10,padding:'10px 14px',background:'rgba(255,255,255,0.03)',
                    borderRadius:8,fontSize:13,color:'var(--text-muted)',fontStyle:'italic',lineHeight:1.6,
                    border:`1px solid ${artStyle==='drawing'?'rgba(138,99,210,0.3)':artStyle==='custom'?'var(--border-gold)':'var(--border)'}`}}>
                    {ART_STYLES.find(s=>s.id===artStyle)?.hint}
                    {artStyle==='drawing' && (
                      <div style={{marginTop:6,color:'#b794f4',fontStyle:'normal',fontSize:12}}>
                        💡 Tip: upload your drawings as character/location references below and toggle the ✏️ Drawing toggle on each one.
                      </div>
                    )}
                  </div>

                  {artStyle==='custom' && (
                    <div style={{marginTop:10}}>
                      <Textarea value={customStyle} onChange={setCustomStyle} rows={3}
                        placeholder="Describe any art style, e.g. 'Watercolor illustration, soft pastel colors, hand-drawn look, whimsical and dreamy'" />
                    </div>
                  )}
                </div>
              </Card>
            </section>

            <Divider />

            {/* CHARACTERS */}
            <section>
              <SectionHead icon="🧑‍🤝‍🧑" title="Characters"
                subtitle={isDrawingMode
                  ? "Upload your drawings of each character. Toggle ✏️ Drawing on so the AI knows to bring them to life."
                  : "Upload a photo or screenshot of each character and give them a short slug name."} />
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {characters.map((c,i)=>(
                  <Card key={i} style={{display:'grid',gridTemplateColumns:'110px 1fr',gap:18,alignItems:'start'}}>
                    <div>
                      <Label>Image</Label>
                      <ImgTile preview={c.preview} hint={isDrawingMode?"Upload drawing":"Photo or screenshot"} label={`Character ${i+1}`}
                        onFile={f=>setChar(i,{file:f,preview:URL.createObjectURL(f)})} />
                      {/* Drawing toggle */}
                      <button onClick={()=>setChar(i,{isDrawing:!c.isDrawing})} style={{
                        marginTop:6, width:'100%', padding:'5px 0', borderRadius:6, cursor:'pointer',
                        border:`1px solid ${c.isDrawing?'rgba(138,99,210,0.6)':'var(--border)'}`,
                        background:c.isDrawing?'rgba(138,99,210,0.15)':'transparent',
                        color:c.isDrawing?'#b794f4':'var(--text-muted)',
                        fontSize:11, fontFamily:'Cinzel,serif', letterSpacing:'0.05em',
                        transition:'all 0.2s'}}>
                        {c.isDrawing ? '✏️ Drawing ✓' : '✏️ Drawing?'}
                      </button>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:12}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <Label>Character {i+1}</Label>
                          {c.isDrawing && <DrawingBadge />}
                        </div>
                        {characters.length>1 && <button onClick={()=>setCharacters(cs=>cs.filter((_,j)=>j!==i))}
                          style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:18,lineHeight:1}}>×</button>}
                      </div>
                      <Field label="Name / Slug" required>
                        <Input value={c.slug} onChange={v=>setChar(i,{slug:v})} placeholder="e.g. trex, steggy, dad" />
                      </Field>
                      <Field label={c.isDrawing ? "Describe your drawing (optional)" : "🔒 Appearance Lock — describe EXACT colors"}>
                        <Textarea value={c.description} onChange={v=>setChar(i,{description:v})} rows={2}
                          placeholder={c.isDrawing
                            ? "e.g. A friendly T-Rex with big eyes drawn in red crayon"
                            : "e.g. Girl, PURPLE shirt always, brown pigtails, blue jeans. NEVER change shirt color."} />
                      </Field>
                    </div>
                  </Card>
                ))}
                <PlusBtn onClick={()=>setCharacters(cs=>[...cs,{slug:'',description:'',file:null,preview:null,isDrawing:isDrawingMode}])}
                  label="Add Another Character" />
              </div>
            </section>

            <Divider />

            {/* LOCATIONS */}
            <section>
              <SectionHead icon="🏰" title="Locations"
                subtitle={isDrawingMode
                  ? "Upload drawings of your locations/backgrounds. Toggle ✏️ Drawing on each one."
                  : "Upload photos of places. Tags let the AI auto-match locations to page descriptions."} />
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                {locations.map((l,i)=>(
                  <Card key={i} style={{display:'grid',gridTemplateColumns:'110px 110px 1fr',gap:18,alignItems:'start'}}>
                    <div>
                      <Label>View A</Label>
                      <ImgTile preview={l.prevA} hint={isDrawingMode?"Drawing":"Close-up"} label="View A"
                        onFile={f=>setLoc(i,{fileA:f,prevA:URL.createObjectURL(f)})} />
                    </div>
                    <div>
                      <Label>View B</Label>
                      <ImgTile preview={l.prevB} hint={isDrawingMode?"Drawing":"Wide view"} label="View B"
                        onFile={f=>setLoc(i,{fileB:f,prevB:URL.createObjectURL(f)})} />
                      <button onClick={()=>setLoc(i,{isDrawing:!l.isDrawing})} style={{
                        marginTop:6, width:'100%', padding:'5px 0', borderRadius:6, cursor:'pointer',
                        border:`1px solid ${l.isDrawing?'rgba(138,99,210,0.6)':'var(--border)'}`,
                        background:l.isDrawing?'rgba(138,99,210,0.15)':'transparent',
                        color:l.isDrawing?'#b794f4':'var(--text-muted)',
                        fontSize:11, fontFamily:'Cinzel,serif', letterSpacing:'0.05em',
                        transition:'all 0.2s'}}>
                        {l.isDrawing ? '✏️ Drawing ✓' : '✏️ Drawing?'}
                      </button>
                    </div>
                    <div style={{display:'flex',flexDirection:'column',gap:12}}>
                      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <Label>Location {i+1}</Label>
                          {l.isDrawing && <DrawingBadge />}
                        </div>
                        {locations.length>1 && <button onClick={()=>setLocations(ls=>ls.filter((_,j)=>j!==i))}
                          style={{background:'none',border:'none',color:'var(--text-muted)',cursor:'pointer',fontSize:18,lineHeight:1}}>×</button>}
                      </div>
                      <Field label="Name / Slug" required>
                        <Input value={l.slug} onChange={v=>setLoc(i,{slug:v})} placeholder="e.g. jungle, cave, volcano" />
                      </Field>
                      <Field label="Tags (comma-separated)">
                        <Input value={l.tags} onChange={v=>setLoc(i,{tags:v})} placeholder="e.g. jungle, forest, trees" />
                      </Field>
                    </div>
                  </Card>
                ))}
                <PlusBtn onClick={()=>setLocations(ls=>[...ls,{slug:'',tags:'',fileA:null,prevA:null,fileB:null,prevB:null,isDrawing:isDrawingMode}])}
                  label="Add Another Location" />
              </div>
            </section>

            <Divider />

            {/* PAGES */}
            <section>
              <SectionHead icon="📄" title="Pages"
                subtitle="Page Text is what your child reads. Scene Description guides the AI. Reference images are optional." />
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {pages.map((p,i)=>(
                  <Card key={i}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
                      <div style={{display:'flex',alignItems:'center',gap:12}}>
                        <div style={{width:30,height:30,borderRadius:'50%',background:'var(--leather-dark)',
                          border:'2px solid var(--border-gold)',display:'flex',alignItems:'center',justifyContent:'center',
                          fontFamily:'Cinzel,serif',fontSize:13,color:'var(--gold-light)',fontWeight:700}}>{i+1}</div>
                        <span style={{fontFamily:'Cinzel,serif',fontSize:15,color:'var(--parchment)'}}>Page {i+1}</span>
                        {p.isDrawing && <DrawingBadge />}
                      </div>
                      {pages.length>1 && <Btn variant="ghost" small onClick={()=>setPages(ps=>ps.filter((_,j)=>j!==i))}
                        style={{color:'var(--red)',borderColor:'rgba(139,32,32,0.4)',padding:'5px 12px'}}>Remove</Btn>}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
                      <div style={{display:'flex',flexDirection:'column',gap:14}}>
                        <Field label="Page Text (what the child reads)" required>
                          <Textarea value={p.narration} onChange={v=>setPage(i,{narration:v})}
                            placeholder="e.g. The big T-Rex stomped through the jungle!" rows={3} />
                        </Field>
                        <Field label="Scene Description (for AI image generation)">
                          <Textarea value={p.description} onChange={v=>setPage(i,{description:v})}
                            placeholder="e.g. T-Rex and small dinosaur walking through tall green jungle" rows={3} />
                        </Field>
                        <Field label="Animation / Motion Hint">
                          <Input value={p.motion} onChange={v=>setPage(i,{motion:v})}
                            placeholder="e.g. dinosaur stomping, leaves falling" />
                        </Field>
                      </div>
                      <div style={{display:'flex',flexDirection:'column',gap:14}}>
                        <Field label={p.isDrawing ? "Your Drawing for this Page (optional)" : "Reference Image (optional)"}>
                          <ImgTile preview={p.preview}
                            hint={p.isDrawing ? "Upload your scene drawing" : "Upload a scene photo"}
                            label={`Page ${i+1} reference`}
                            onFile={f=>setPage(i,{file:f,preview:URL.createObjectURL(f)})} size={110} />
                          {/* Per-page drawing toggle */}
                          <button onClick={()=>setPage(i,{isDrawing:!p.isDrawing})} style={{
                            marginTop:6, padding:'5px 0', borderRadius:6, cursor:'pointer', width:'100%',
                            border:`1px solid ${p.isDrawing?'rgba(138,99,210,0.6)':'var(--border)'}`,
                            background:p.isDrawing?'rgba(138,99,210,0.15)':'transparent',
                            color:p.isDrawing?'#b794f4':'var(--text-muted)',
                            fontSize:11, fontFamily:'Cinzel,serif', letterSpacing:'0.05em',
                            transition:'all 0.2s'}}>
                            {p.isDrawing ? '✏️ This is a drawing ✓' : '✏️ This is a drawing?'}
                          </button>
                        </Field>
                        {charSlugs.length>0 && (
                          <Field label="Characters in this scene">
                            <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
                              {charSlugs.map(slug=>{
                                const on=p.chars.includes(slug)
                                return <button key={slug} onClick={()=>togglePageChar(i,slug)} style={{
                                  padding:'5px 14px',borderRadius:20,
                                  border:`1px solid ${on?'var(--gold)':'var(--border)'}`,
                                  background:on?'rgba(200,146,42,0.12)':'transparent',
                                  color:on?'var(--gold-light)':'var(--text-muted)',
                                  fontSize:13,cursor:'pointer',transition:'all 0.15s'}}>{slug}</button>
                              })}
                            </div>
                          </Field>
                        )}
                        {locSlugs.length>0 && (
                          <Field label="Location (blank = auto-detect)">
                            <select value={p.location} onChange={e=>setPage(i,{location:e.target.value})}
                              style={{width:'100%',padding:'9px 13px',background:'rgba(255,255,255,0.04)',
                                border:'1px solid var(--border)',borderRadius:7,color:'var(--parchment)',fontSize:15,cursor:'pointer'}}>
                              <option value="" style={{background:'#100c06'}}>(auto-detect)</option>
                              {locSlugs.map(s=><option key={s} value={s} style={{background:'#100c06'}}>{s}</option>)}
                            </select>
                          </Field>
                        )}
                        <Field label="Video Duration (seconds)">
                          <Input value={String(p.duration)} onChange={v=>setPage(i,{duration:parseInt(v)||10})} />
                        </Field>
                      </div>
                    </div>
                  </Card>
                ))}
                <PlusBtn onClick={()=>setPages(ps=>[...ps,{narration:'',description:'',motion:'',chars:[],location:'',duration:10,file:null,preview:null,isDrawing:isDrawingMode}])}
                  label="Add Another Page" />
              </div>
            </section>

            <Divider />

            {/* GENERATE */}
            <section style={{textAlign:'center'}}>
              {error && (
                <div style={{background:'rgba(139,32,32,0.15)',border:'1px solid rgba(139,32,32,0.4)',
                  borderRadius:8,padding:'12px 18px',marginBottom:20,color:'#ff9999',fontSize:14}}>
                  ⚠ {error}
                </div>
              )}
              <Btn onClick={handleGenerate} disabled={submitting||!projectId} style={{fontSize:17,padding:'14px 48px',borderRadius:10}}>
                {submitting ? '⏳ Uploading…' : '🖼 Generate Page Images'}
              </Btn>
              <p style={{color:'var(--text-muted)',fontSize:13,marginTop:14,fontStyle:'italic'}}>
                Step 1 of 2 — generates images only so you can review before spending tokens on video.
              </p>
            </section>

          </div>
        )}
      </div>
    </div>
  )
}
