const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const toast=m=>{const t=$('#toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)};
const dl=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),2000)};
const kb=n=>n>1048576?(n/1048576).toFixed(2)+' MB':(n/1024).toFixed(1)+' KB';
const base=f=>f.name.replace(/\.[^.]+$/,'');

// Dropzone + file list helper
function picker(el,{accept,multiple=false,label='Drop files here or click to browse'}){
  const state={files:[]};
  el.innerHTML=`<div class="drop"><b>📂 ${label}</b><small>Files never leave your device</small><input type="file" hidden accept="${accept}" ${multiple?'multiple':''}></div><ul class="files"></ul>`;
  const d=$('.drop',el),inp=$('input',el),ul=$('.files',el);
  const draw=()=>{ul.innerHTML=state.files.map((f,i)=>`<li><span>${esc(f.name)} · ${kb(f.size)}</span><button data-i="${i}">✕</button></li>`).join('');
    ul.onclick=e=>{const i=e.target.dataset.i;if(i!==undefined){state.files.splice(i,1);draw()}};state.onchange&&state.onchange()};
  const add=fl=>{fl=[...fl];state.files=multiple?state.files.concat(fl):fl.slice(0,1);draw()};
  d.onclick=()=>inp.click();inp.onchange=()=>{add(inp.files);inp.value=''};
  d.ondragover=e=>{e.preventDefault();d.classList.add('over')};d.ondragleave=()=>d.classList.remove('over');
  d.ondrop=e=>{e.preventDefault();d.classList.remove('over');add(e.dataTransfer.files)};
  return state;
}
const shell=(el,t)=>{el.innerHTML=`<div class="panel"><a class="back" href="#/">← All tools</a><h1>${t.icon} ${t.name}</h1><p>${t.desc}</p><div id="body"></div></div>`;return $('#body',el)};
const run=async(btn,out,fn)=>{btn.disabled=true;out.textContent='Processing…';try{await fn();toast('✅ Done!')}catch(e){console.error(e);out.textContent='❌ '+e.message;toast('Something went wrong')}btn.disabled=false};

// ---------- PDF tools ----------
const {PDFDocument,degrees}=window.PDFLib||{};
function pdfTool(t,opts,extraHTML,action){
  return b=>{
    const p=picker(b,{accept:'application/pdf',multiple:opts.multiple,label:opts.multiple?'Select PDF files':'Select a PDF file'});
    const x=document.createElement('div');x.innerHTML=extraHTML||'';b.appendChild(x);
    b.insertAdjacentHTML('beforeend',`<button class="btn">${t.btn}</button><div class="out"></div>`);
    const btn=$('.btn',b),out=$('.out',b);
    btn.onclick=()=>{if(!p.files.length)return toast('Please select a file first');run(btn,out,()=>action(p.files,b,out))};
  };
}
const parseRange=(s,max)=>{const set=[];s.split(',').forEach(part=>{const [a,c]=part.trim().split('-').map(Number);if(!a)return;for(let i=a;i<=(c||a);i++)if(i>=1&&i<=max)set.push(i-1)});return set};

// ---------- Image tools ----------
const loadImg=f=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Cannot read '+f.name));i.src=URL.createObjectURL(f)});
const toBlob=(c,type,q)=>new Promise(r=>c.toBlob(r,type,q));
function imgTool(t,{format,quality,resize}){
  return b=>{
    const p=picker(b,{accept:'image/*',multiple:true,label:'Select images'});
    b.insertAdjacentHTML('beforeend',`<div class="row">
      ${format?`<div><label>Output format</label><select id="fmt"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></div>`:''}
      ${quality?`<div><label>Quality: <span id="qv">80</span>%</label><input id="qual" type="range" min="10" max="100" value="80"></div>`:''}
      ${resize?`<div><label>Width (px)</label><input id="w" type="number" placeholder="e.g. 1200"></div><div><label>Height (px, optional)</label><input id="h" type="number" placeholder="auto"></div>`:''}
    </div><button class="btn">${t.btn}</button><div class="out"></div>`);
    if(quality)$('#qual',b).oninput=e=>$('#qv',b).textContent=e.target.value;
    const btn=$('.btn',b),out=$('.out',b);
    btn.onclick=()=>{if(!p.files.length)return toast('Please select images first');
      run(btn,out,async()=>{let log=[];
        for(const f of p.files){
          const img=await loadImg(f);let w=img.naturalWidth,h=img.naturalHeight;
          if(resize){const nw=+$('#w',b).value,nh=+$('#h',b).value;if(nw&&nh){w=nw;h=nh}else if(nw){h=Math.round(h*nw/w);w=nw}else if(nh){w=Math.round(w*nh/h);h=nh}}
          const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');
          const type=format?$('#fmt',b).value:(quality?'image/jpeg':(f.type==='image/png'?'image/png':'image/jpeg'));
          if(type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,w,h)}
          ctx.drawImage(img,0,0,w,h);
          const blob=await toBlob(c,type,quality?$('#qual',b).value/100:.92);
          const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[type];
          dl(blob,`${base(f)}-edifyle.${ext}`);log.push(`${f.name}: ${kb(f.size)} → ${kb(blob.size)}`);
        }out.innerHTML=log.map(esc).join('<br>');});};
  };
}

// ---------- Text tools ----------
function textTool(t,actions,note){
  return b=>{
    b.innerHTML=`<label>Input</label><textarea id="i" placeholder="Paste here…"></textarea><div style="margin:10px 0">${actions.map((a,i)=>`<button class="btn" data-i="${i}">${a.label}</button>`).join('')}</div><label>Output</label><textarea id="o" readonly></textarea><button class="btn alt" id="cp">📋 Copy output</button><div class="out">${note||''}</div>`;
    b.onclick=e=>{const i=e.target.dataset.i;if(i!==undefined){try{$('#o',b).value=actions[i].fn($('#i',b).value)}catch(er){$('#o',b).value='❌ '+er.message}}
      if(e.target.id==='cp'){navigator.clipboard.writeText($('#o',b).value);toast('Copied!')}};
  };
}
const u8=s=>btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const un8=s=>new TextDecoder().decode(Uint8Array.from(atob(s.trim()),c=>c.charCodeAt(0)));

// ---------- Tool registry ----------
const T=[
 {id:'merge-pdf',g:'PDF',icon:'🧩',name:'Merge PDF',desc:'Combine multiple PDFs into one document.',btn:'Merge PDFs'},
 {id:'split-pdf',g:'PDF',icon:'✂️',name:'Split PDF',desc:'Extract pages or ranges from a PDF.',btn:'Extract pages'},
 {id:'rotate-pdf',g:'PDF',icon:'🔄',name:'Rotate PDF',desc:'Rotate every page of your PDF.',btn:'Rotate PDF'},
 {id:'image-to-pdf',g:'PDF',icon:'🖼️',name:'Image to PDF',desc:'Turn images into a single PDF.',btn:'Create PDF'},
 {id:'image-converter',g:'Image',icon:'🎨',name:'Image Converter',desc:'Convert between JPG, PNG and WebP.',btn:'Convert'},
 {id:'image-compressor',g:'Image',icon:'🗜️',name:'Image Compressor',desc:'Reduce image size with adjustable quality.',btn:'Compress'},
 {id:'image-resizer',g:'Image',icon:'📐',name:'Image Resizer',desc:'Resize images to exact dimensions.',btn:'Resize'},
 {id:'json-formatter',g:'Developer',icon:'🧾',name:'JSON Formatter',desc:'Prettify, minify and validate JSON.'},
 {id:'base64',g:'Developer',icon:'🔐',name:'Base64 Tool',desc:'Encode and decode Base64 (UTF-8 safe).'},
 {id:'url-codec',g:'Developer',icon:'🔗',name:'URL Encoder',desc:'Encode or decode URL components.'},
 {id:'uuid-generator',g:'Developer',icon:'🆔',name:'UUID Generator',desc:'Generate random v4 UUIDs.'},
 {id:'password-generator',g:'Developer',icon:'🛡️',name:'Password Generator',desc:'Create strong random passwords.'},
];
const impl={
 'merge-pdf':pdfTool(T[0],{multiple:true},'',async(files,b,out)=>{const m=await PDFDocument.create();for(const f of files){const d=await PDFDocument.load(await f.arrayBuffer());(await m.copyPages(d,d.getPageIndices())).forEach(p=>m.addPage(p))}const by=await m.save();dl(new Blob([by],{type:'application/pdf'}),'merged-edifyle.pdf');out.textContent=`Merged ${files.length} files · ${m.getPageCount()} pages`}),
 'split-pdf':pdfTool(T[1],{},'<div class="row"><div><label>Pages (e.g. 1-3,5,8)</label><input type="text" id="rng" value="1"></div></div>',async(files,b,out)=>{const s=await PDFDocument.load(await files[0].arrayBuffer());const idx=parseRange($('#rng',b).value,s.getPageCount());if(!idx.length)throw new Error('Invalid page range');const n=await PDFDocument.create();(await n.copyPages(s,idx)).forEach(p=>n.addPage(p));dl(new Blob([await n.save()],{type:'application/pdf'}),base(files[0])+'-split.pdf');out.textContent=`Extracted ${idx.length} page(s) of ${s.getPageCount()}`}),
 'rotate-pdf':pdfTool(T[2],{},'<div class="row"><div><label>Rotation</label><select id="ang"><option value="90">90° clockwise</option><option value="180">180°</option><option value="270">90° counter-clockwise</option></select></div></div>',async(files,b,out)=>{const d=await PDFDocument.load(await files[0].arrayBuffer());const a=+$('#ang',b).value;d.getPages().forEach(p=>p.setRotation(degrees((p.getRotation().angle+a)%360)));dl(new Blob([await d.save()],{type:'application/pdf'}),base(files[0])+'-rotated.pdf');out.textContent='Rotated all pages'}),
 'image-to-pdf':b=>{const p=picker(b,{accept:'image/*',multiple:true,label:'Select images'});b.insertAdjacentHTML('beforeend','<button class="btn">Create PDF</button><div class="out"></div>');const btn=$('.btn',b),out=$('.out',b);
   btn.onclick=()=>{if(!p.files.length)return toast('Select images first');run(btn,out,async()=>{const d=await PDFDocument.create();for(const f of p.files){const img=await loadImg(f);const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;c.getContext('2d').drawImage(img,0,0);const e=await d.embedPng(await (await toBlob(c,'image/png')).arrayBuffer());const pg=d.addPage([e.width,e.height]);pg.drawImage(e,{x:0,y:0,width:e.width,height:e.height})}dl(new Blob([await d.save()],{type:'application/pdf'}),'images-edifyle.pdf');out.textContent=`${p.files.length} image(s) → PDF`})}},
 'image-converter':imgTool(T[4],{format:1,quality:1}),
 'image-compressor':imgTool(T[5],{quality:1}),
 'image-resizer':imgTool(T[6],{resize:1}),
 'json-formatter':textTool(T[7],[{label:'✨ Prettify',fn:s=>JSON.stringify(JSON.parse(s),null,2)},{label:'📦 Minify',fn:s=>JSON.stringify(JSON.parse(s))},{label:'✔ Validate',fn:s=>{JSON.parse(s);return '✅ Valid JSON'}}]),
 'base64':textTool(T[8],[{label:'Encode',fn:u8},{label:'Decode',fn:un8}]),
 'url-codec':textTool(T[9],[{label:'Encode',fn:encodeURIComponent},{label:'Decode',fn:decodeURIComponent}]),
 'uuid-generator':b=>{b.innerHTML='<div class="row"><div><label>How many?</label><input id="n" type="number" value="5" min="1" max="100"></div></div><button class="btn">Generate</button><button class="btn alt" id="cp">📋 Copy</button><textarea id="o" readonly style="margin-top:14px"></textarea>';
   $('.btn',b).onclick=()=>{$('#o',b).value=Array.from({length:Math.min(100,+$('#n',b).value||1)},()=>crypto.randomUUID()).join('\n')};$('.btn',b).click();$('#cp',b).onclick=()=>{navigator.clipboard.writeText($('#o',b).value);toast('Copied!')}},
 'password-generator':b=>{b.innerHTML='<div class="row"><div><label>Length: <span id="lv">16</span></label><input id="len" type="range" min="6" max="64" value="16"></div><div><label>Include symbols</label><select id="sym"><option value="1">Yes</option><option value="0">No</option></select></div></div><button class="btn">Generate</button><button class="btn alt" id="cp">📋 Copy</button><input type="text" id="o" readonly style="margin-top:14px;font-family:monospace;font-size:1.1rem">';
   const gen=()=>{const set='abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'+($('#sym',b).value==='1'?'!@#$%^&*-_=+?':'');const r=crypto.getRandomValues(new Uint32Array(+$('#len',b).value));$('#o',b).value=[...r].map(n=>set[n%set.length]).join('')};
   $('#len',b).oninput=e=>{$('#lv',b).textContent=e.target.value;gen()};$('.btn',b).onclick=gen;gen();$('#cp',b).onclick=()=>{navigator.clipboard.writeText($('#o',b).value);toast('Copied!')}},
};

// ---------- Views ----------
function home(el){
  let cat='All',q='';
  el.innerHTML=`<section class="hero"><h1>100% Private <span class="grad">PDF Tools</span> & Image Converter</h1><p>Fast, secure, professional document tools right in your browser. Your data never leaves your device.</p><div class="badges"><span>🔒 Zero-Server</span><span>⚡ Instant</span><span>💜 Free Forever</span></div>
  <input id="q" type="search" placeholder="Search tools…"><div class="chips">${['All','PDF','Image','Developer'].map(c=>`<button class="chip ${c==='All'?'on':''}">${c}</button>`).join('')}</div></section><div class="grid"></div>
  <div class="stats"><div><b>${T.length}</b><small>Tools</small></div><div><b>100%</b><small>Local Processing</small></div><div><b>0ms</b><small>Upload Wait</small></div><div><b>Free</b><small>Forever</small></div></div>`;
  const g=$('.grid',el);
  const draw=()=>{g.innerHTML=T.filter(t=>(cat==='All'||t.g===cat)&&(t.name+t.desc).toLowerCase().includes(q)).map(t=>`<a class="card" href="#/${t.id}"><div class="ic">${t.icon}</div><h3>${t.name}</h3><p>${t.desc}</p></a>`).join('')||'<p>No tools found.</p>'};
  $('#q',el).oninput=e=>{q=e.target.value.toLowerCase();draw()};
  $('.chips',el).onclick=e=>{if(e.target.classList.contains('chip')){cat=e.target.textContent;document.querySelectorAll('.chip').forEach(c=>c.classList.toggle('on',c===e.target));draw()}};
  draw();
}
function about(el){el.innerHTML='<div class="panel"><a class="back" href="#/">← Back</a><h1>About Edifyle</h1><p>A privacy-first suite of PDF, image and developer tools. Everything runs locally in your browser using JavaScript and the pdf-lib library — no uploads, no accounts, no tracking.</p></div>'}
function route(){
  const id=location.hash.replace('#/','');const el=$('#app');window.scrollTo(0,0);
  if(!id)return home(el);if(id==='about')return about(el);
  const t=T.find(x=>x.id===id);if(!t)return home(el);
  if(t.g==='PDF'&&!window.PDFLib){el.innerHTML='<div class="panel"><p>PDF engine failed to load. Check your internet connection.</p></div>';return}
  impl[id](shell(el,t));
}
addEventListener('hashchange',route);route();
