// Themed replacements for native <select>, date and time controls. The native
// element stays in the form (hidden) as the source of truth; the picker writes its
// value and dispatches `input`/`change`, so form code keeps working unchanged.
// Popovers are fixed to the viewport because the application card clips overflow.

const CHEVRON='<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
const CALENDAR='<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>';
const CLOCK='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>';
const CHECK='<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';
const ARROW=d=>`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d==='prev'?'m15 18-6-6 6-6':'m9 18 6-6-6-6'}"/></svg>`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let open=null,uid=0;
// Phones get bottom sheets with a backdrop instead of anchored popovers.
const sheetMode=()=>window.matchMedia('(max-width: 640px)').matches;

const intl=lang=>lang==='pt'?'pt-BR':'en-US';
export function formatDate(iso,lang){if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||''))return '';const [y,m,d]=iso.split('-').map(Number);return new Intl.DateTimeFormat(intl(lang),{month:'2-digit',day:'2-digit',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d)));}
export function formatTime(hhmm,lang){if(!/^\d{2}:\d{2}$/.test(hhmm||''))return '';if(lang==='pt')return hhmm;const [h,m]=hhmm.split(':').map(Number);return `${String(h%12||12).padStart(2,'0')}:${String(m).padStart(2,'0')} ${h<12?'AM':'PM'}`;}
const isoOf=d=>`${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
const utc=iso=>{const [y,m,d]=iso.split('-').map(Number);return new Date(Date.UTC(y,m-1,d));};
const addDays=(iso,n)=>{const d=utc(iso);d.setUTCDate(d.getUTCDate()+n);return isoOf(d);};
const addMonths=(iso,n)=>{const d=utc(iso),day=d.getUTCDate();d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+n);const last=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();d.setUTCDate(Math.min(day,last));return isoOf(d);};

function emit(input,value){input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));}

function place(pop,trigger,{matchWidth=true}={}){
 if(pop.classList.contains('sheet'))return;
 const r=trigger.getBoundingClientRect(),vw=document.documentElement.clientWidth,vh=window.innerHeight,gap=6;
 if(matchWidth)pop.style.width=`${Math.max(r.width,170)}px`;
 const w=pop.offsetWidth,h=pop.offsetHeight,below=vh-r.bottom-gap-12,above=r.top-gap-12;
 const up=h>below&&above>below;
 pop.style.maxHeight=`${Math.max(160,(up?above:below))}px`;
 pop.style.top=`${up?Math.max(12,r.top-gap-Math.min(h,above)):r.bottom+gap}px`;
 pop.style.left=`${Math.min(Math.max(12,r.left),vw-w-12)}px`;
 pop.dataset.side=up?'top':'bottom';
}

export function closePicker(restoreFocus=false){
 if(!open)return;const {pop,trigger,cleanup,backdrop}=open;open=null;cleanup();pop.remove();backdrop?.remove();trigger.setAttribute('aria-expanded','false');trigger.closest('.picker')?.classList.remove('open');if(restoreFocus)trigger.focus();
}

function openPopover(trigger,pop,{matchWidth=true,onKey,title=''}={}){
 closePicker();pop.classList.add('hd-pop');
 let backdrop=null;
 if(sheetMode()){pop.classList.add('sheet');pop.insertAdjacentHTML('afterbegin',`<div class="hd-sheet-head">${esc(title)}</div>`);backdrop=document.createElement('div');backdrop.className='hd-backdrop';backdrop.addEventListener('pointerdown',()=>closePicker(true));document.body.append(backdrop);}
 document.body.append(pop);trigger.setAttribute('aria-expanded','true');trigger.closest('.picker')?.classList.add('open');
 const reposition=()=>{if(!trigger.isConnected){closePicker();return;}place(pop,trigger,{matchWidth});};
 const outside=e=>{if(!pop.contains(e.target)&&!trigger.contains(e.target)&&e.target!==backdrop)closePicker();};
 const key=e=>{if(e.key==='Escape'){e.preventDefault();closePicker(true);}else if(e.key==='Tab'){closePicker();}else onKey?.(e);};
 reposition();
 window.addEventListener('resize',reposition);window.addEventListener('scroll',reposition,true);document.addEventListener('pointerdown',outside,true);pop.addEventListener('keydown',key);
 open={pop,trigger,backdrop,cleanup:()=>{window.removeEventListener('resize',reposition);window.removeEventListener('scroll',reposition,true);document.removeEventListener('pointerdown',outside,true);}};
}

// ---- Listbox (selects and time slots) ----
function openListbox(trigger,options,current,onPick,{label}={}){
 const id=`hd-list-${++uid}`;
 const pop=document.createElement('div');
 pop.innerHTML=`<ul role="listbox" id="${id}" tabindex="-1" aria-label="${esc(label)}">${options.map((o,i)=>`<li role="option" id="${id}-${i}" data-value="${esc(o.value)}" aria-selected="${o.value===current}" class="${o.value===current?'selected':''}"><span>${esc(o.label)}</span>${o.value===current?CHECK:''}</li>`).join('')}</ul>`;
 const list=pop.firstElementChild,items=[...list.children];
 let active=Math.max(0,options.findIndex(o=>o.value===current));
 const setActive=(i,scroll=true)=>{active=Math.max(0,Math.min(items.length-1,i));items.forEach((el,n)=>el.classList.toggle('active',n===active));list.setAttribute('aria-activedescendant',items[active].id);if(scroll)items[active].scrollIntoView({block:'nearest'});};
 const pick=i=>{const o=options[i];closePicker(true);onPick(o.value);};
 let typed='',typedAt=0;
 openPopover(trigger,pop,{title:label,onKey:e=>{
  if(e.key==='ArrowDown'){e.preventDefault();setActive(active+1);}
  else if(e.key==='ArrowUp'){e.preventDefault();setActive(active-1);}
  else if(e.key==='Home'){e.preventDefault();setActive(0);}
  else if(e.key==='End'){e.preventDefault();setActive(items.length-1);}
  else if(e.key==='PageDown'){e.preventDefault();setActive(active+6);}
  else if(e.key==='PageUp'){e.preventDefault();setActive(active-6);}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(active);}
  else if(e.key.length===1&&/\S/.test(e.key)){const now=Date.now();typed=(now-typedAt>700?'':typed)+e.key.toLowerCase();typedAt=now;const hit=options.findIndex(o=>o.label.toLowerCase().startsWith(typed));if(hit>=0)setActive(hit);}
 }});
 list.addEventListener('pointermove',e=>{const li=e.target.closest('[role=option]');if(li)setActive(items.indexOf(li),false);});
 list.addEventListener('click',e=>{const li=e.target.closest('[role=option]');if(li)pick(items.indexOf(li));});
 setActive(active);list.focus({preventScroll:true});
 // Center the current option when the popover scrolls (time slots).
 if(current&&pop.scrollHeight>pop.clientHeight)pop.scrollTop=items[active].offsetTop-pop.clientHeight/2+items[active].offsetHeight/2;
}

function enhanceSelect(select,{placeholder}){
 const wrap=document.createElement('div');wrap.className='picker picker-select';
 const button=document.createElement('button');button.type='button';button.className='picker-trigger';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');
 const labelledby=select.getAttribute('aria-describedby');if(labelledby)button.setAttribute('aria-describedby',labelledby);
 const labelId=select.closest('.field')?.querySelector('[id^="l-"]')?.id;if(labelId)button.setAttribute('aria-labelledby',`${labelId} ${button.id=`hd-trig-${++uid}`}`);
 const options=()=>[...select.options].filter(o=>o.value!=='').map(o=>({value:o.value,label:o.textContent}));
 const paint=()=>{const o=options().find(x=>x.value===select.value);button.innerHTML=`<span class="${o?'':'placeholder'}">${esc(o?.label||placeholder)}</span>${CHEVRON}`;};
 paint();select.classList.add('picker-source');select.tabIndex=-1;select.setAttribute('aria-hidden','true');
 // The trigger goes first so a click on the field label opens it (a label activates its first control).
 select.before(wrap);wrap.append(button);
 const toggle=()=>{if(open?.trigger===button){closePicker(true);return;}openListbox(button,options(),select.value,v=>{emit(select,v);paint();},{label:select.closest('.field')?.querySelector('[id^="l-"]')?.textContent||''});};
 button.addEventListener('click',e=>{e.preventDefault();toggle();});
 button.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();toggle();}});
 select.addEventListener('change',paint);
}

function timeSlots(lang){const out=[];for(let m=0;m<24*60;m+=15){const v=`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;out.push({value:v,label:formatTime(v,lang)});}return out;}
function enhanceTime(input,{lang}){
 const wrap=document.createElement('div');wrap.className='picker picker-time';
 const button=document.createElement('button');button.type='button';button.className='picker-trigger';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label',input.getAttribute('aria-label')||'Time');
 const paint=()=>{button.innerHTML=`<span>${esc(formatTime(input.value,lang)||'--:--')}</span>${CLOCK}`;};
 input.type='hidden';input.after(wrap);wrap.append(button);paint();
 const toggle=()=>{if(open?.trigger===button){closePicker(true);return;}openListbox(button,timeSlots(lang),input.value,v=>{emit(input,v);paint();},{label:input.getAttribute('aria-label')});};
 button.addEventListener('click',e=>{e.preventDefault();toggle();});
 button.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();toggle();}});
}

// ---- Calendar ----
function openCalendar(trigger,input,{lang,labels,onPick}){
 const min=input.min||'',today=labels.today_iso;
 let selected=input.value||today,focus=selected,view=selected.slice(0,7);
 const pop=document.createElement('div');pop.className='hd-calendar-pop';pop.setAttribute('role','dialog');pop.setAttribute('aria-label',labels.choose_date);
 const monthTitle=ym=>new Intl.DateTimeFormat(intl(lang),{month:'long',year:'numeric',timeZone:'UTC'}).format(utc(`${ym}-01`));
 const weekdays=Array.from({length:7},(_,i)=>new Intl.DateTimeFormat(intl(lang),{weekday:'narrow',timeZone:'UTC'}).format(new Date(Date.UTC(2026,1,1+i))));
 const longDay=iso=>new Intl.DateTimeFormat(intl(lang),{weekday:'long',month:'long',day:'numeric',year:'numeric',timeZone:'UTC'}).format(utc(iso));
 const disabled=iso=>!!min&&iso<min;
 function draw(moveFocus){
  const first=utc(`${view}-01`),start=addDays(`${view}-01`,-first.getUTCDay());
  const days=Array.from({length:42},(_,i)=>addDays(start,i));
  const prevDisabled=!!min&&addMonths(`${view}-01`,-1).slice(0,7)<min.slice(0,7);
  pop.innerHTML=`<div class="hd-cal-head"><button type="button" class="hd-cal-nav" data-nav="-1" aria-label="${esc(labels.prev_month)}" ${prevDisabled?'disabled':''}>${ARROW('prev')}</button><strong aria-live="polite">${esc(monthTitle(view))}</strong><button type="button" class="hd-cal-nav" data-nav="1" aria-label="${esc(labels.next_month)}">${ARROW('next')}</button></div>
  <div class="hd-cal-week" aria-hidden="true">${weekdays.map(w=>`<span>${esc(w)}</span>`).join('')}</div>
  <div class="hd-cal-grid" role="grid">${days.map(iso=>{const cls=[iso.slice(0,7)!==view?'outside':'',iso===selected?'selected':'',iso===today?'today':''].filter(Boolean).join(' ');return `<button type="button" role="gridcell" data-date="${iso}" class="${cls}" tabindex="${iso===focus?0:-1}" aria-label="${esc(longDay(iso))}" aria-selected="${iso===selected}" ${disabled(iso)?'disabled':''}>${Number(iso.slice(8))}</button>`;}).join('')}</div>
  <div class="hd-cal-foot"><button type="button" class="hd-cal-today" data-date="${today}" ${disabled(today)?'disabled':''}>${esc(labels.today)}</button></div>`;
  if(moveFocus)pop.querySelector(`[data-date="${focus}"]:not(.hd-cal-today)`)?.focus({preventScroll:true});
  if(open?.pop===pop)place(pop,trigger,{matchWidth:false});
 }
 const moveTo=(iso,f=true)=>{if(disabled(iso))iso=min;focus=iso;if(iso.slice(0,7)!==view)view=iso.slice(0,7);draw(f);};
 pop.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||b.disabled)return;if(b.dataset.nav){view=addMonths(`${view}-01`,Number(b.dataset.nav)).slice(0,7);focus=`${view}-01`;if(disabled(focus))focus=min;draw(false);return;}if(b.dataset.date){closePicker(true);onPick(b.dataset.date);}});
 draw(false);
 openPopover(trigger,pop,{matchWidth:false,title:labels.choose_date,onKey:e=>{
  if(!e.target.closest('.hd-cal-grid'))return;
  const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[e.key];
  if(step){e.preventDefault();moveTo(addDays(focus,step));}
  else if(e.key==='PageUp'){e.preventDefault();moveTo(addMonths(focus,-1));}
  else if(e.key==='PageDown'){e.preventDefault();moveTo(addMonths(focus,1));}
  else if(e.key==='Home'){e.preventDefault();moveTo(addDays(focus,-utc(focus).getUTCDay()));}
  else if(e.key==='End'){e.preventDefault();moveTo(addDays(focus,6-utc(focus).getUTCDay()));}
  else if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!disabled(focus)){closePicker(true);onPick(focus);}}
 }});
 pop.querySelector(`[data-date="${focus}"]:not(.hd-cal-today)`)?.focus({preventScroll:true});
}

function enhanceDate(input,{lang,labels}){
 const wrap=document.createElement('div');wrap.className='picker picker-date';
 const button=document.createElement('button');button.type='button';button.className='picker-trigger';button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-expanded','false');
 const labelId=input.closest('.field')?.querySelector('[id^="l-"]')?.id;if(labelId)button.setAttribute('aria-labelledby',`${labelId} ${button.id=`hd-trig-${++uid}`}`);
 const paint=()=>{const text=formatDate(input.value,lang);button.innerHTML=`<span class="${text?'':'placeholder'}">${esc(text||labels.date_placeholder)}</span>${CALENDAR}`;};
 input.type='hidden';input.after(wrap);wrap.append(button);paint();
 button.addEventListener('click',e=>{e.preventDefault();if(open?.trigger===button){closePicker(true);return;}openCalendar(button,input,{lang,labels,onPick:v=>{emit(input,v);paint();}});});
 button.addEventListener('keydown',e=>{if(e.key==='ArrowDown'){e.preventDefault();button.click();}});
}

export function enhanceFields(root,{lang,labels}){
 closePicker();
 root.querySelectorAll('select:not(.picker-source)').forEach(s=>enhanceSelect(s,{placeholder:labels.select}));
 root.querySelectorAll('input[type=date]').forEach(i=>enhanceDate(i,{lang,labels}));
 root.querySelectorAll('input[type=time]').forEach(i=>enhanceTime(i,{lang}));
}
