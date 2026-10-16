import {STRINGS,LOCATIONS,detectLocale} from './i18n.js';
import {captureSelfie} from './selfie.js';
import {enhanceFields,formatDate,closePicker} from './pickers.js';

const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL||'https://kfnsfnytnnpwptklmbip.supabase.co';
const ENDPOINT=`${SUPABASE_URL}/functions/v1/careers-submit`;
const MAX_FILE=5*1024*1024;
const DAYS=['sun','mon','tue','wed','thu','fri','sat'];
const DRAFT_KEY='hd-careers-draft';
// Temporary: required-field checks are off so every step can be clicked through while the
// flow is reviewed. Set back to true before launch. The careers-submit function still
// validates on submit, so an incomplete application is rejected with a message.
const ENFORCE_REQUIRED=false;
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=(sel,root=document)=>root.querySelector(sel);

const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const blank=()=>({first_name:'',last_name:'',email:'',phone:'',city:'',state:'MA',location:'',position:'',at_least_16:'',work_authorized:'',
 earliest_start:today(),hours_per_week:'',availability:Object.fromEntries(DAYS.map(d=>[d,{on:false,from:'09:00',to:'17:00'}])),
 work_experience:'',english_proficiency:'',other_languages:'',pitch:'',referral_source:'',consent:false});

let lang=detectLocale(),t=STRINGS[lang],step=0,data=loadDraft(),files={resume:null,selfie:null},submitting=false,result=null,formError='';

function loadDraft(){try{const raw=sessionStorage.getItem(DRAFT_KEY);if(raw){const saved=JSON.parse(raw);return {...blank(),...saved,availability:{...blank().availability,...(saved.availability||{})}};}}catch{}return blank();}
function saveDraft(){try{sessionStorage.setItem(DRAFT_KEY,JSON.stringify(data));}catch{}}

function setLang(next){lang=next;t=STRINGS[lang];document.documentElement.lang=lang==='pt'?'pt-BR':'en-US';try{localStorage.setItem('hd-careers-lang',lang);}catch{}
 document.querySelectorAll('[data-lang]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.lang===lang)));
 document.querySelectorAll('[data-i18n]').forEach(el=>{el.textContent=t[el.dataset.i18n];});
 document.title=`${t.steps[3]===t.steps[3]?(lang==='pt'?'Carreiras':'Careers'):''} · HOT DOOGY`;
 render();}

// ---- Field helpers ----
const req=()=>ENFORCE_REQUIRED?`<span class="req" aria-hidden="true">*</span>`:'';
const label=(key,text,optional=false)=>`<span id="l-${key}">${e(text)}${optional?`<span class="opt">${t.optional}</span>`:req()}</span>`;
function input(key,text,{type='text',autocomplete='',optional=false,attrs='',full=false}={}){
 return `<label class="field${full?' full':''}" data-field="${key}">${label(key,text,optional)}<input name="${key}" type="${type}" value="${e(data[key])}" ${optional||!ENFORCE_REQUIRED?'':'required'} ${autocomplete?`autocomplete="${autocomplete}"`:''} ${attrs} aria-describedby="e-${key}"><span class="err" id="e-${key}"></span></label>`;}
function select(key,text,options,{optional=false,full=false}={}){
 const value=data[key];
 return `<label class="field${full?' full':''}" data-field="${key}">${label(key,text,optional)}<select name="${key}" ${optional||!ENFORCE_REQUIRED?'':'required'} class="${value?'':'placeholder'}" aria-describedby="e-${key}"><option value="" ${value?'':'selected'} disabled hidden>${t.select}</option>${options.map(([v,l])=>`<option value="${e(v)}" ${String(v)===String(value)?'selected':''}>${e(l)}</option>`).join('')}</select><span class="err" id="e-${key}"></span></label>`;}
function textarea(key,text,{optional=true,attrs=''}={}){
 return `<label class="field full" data-field="${key}">${label(key,text,optional)}<textarea name="${key}" ${attrs}>${e(data[key])}</textarea><span class="err" id="e-${key}"></span></label>`;}
const yesNo=[['true',t.yes],['false',t.no]];
const entries=obj=>Object.entries(obj);

// ---- Steps ----
function stepAbout(){
 return `<h2 class="step-title">${t.about_title}</h2><p class="step-desc">${ENFORCE_REQUIRED?t.about_desc:t.about_desc_open}</p>
 <div class="grid">${input('first_name',t.first_name,{autocomplete:'given-name',attrs:'maxlength="100"'})}${input('last_name',t.last_name,{autocomplete:'family-name',attrs:'maxlength="100"'})}
 ${input('email',t.email,{type:'email',autocomplete:'email',attrs:'maxlength="254" inputmode="email" spellcheck="false" autocapitalize="off"'})}${input('phone',t.phone,{type:'tel',autocomplete:'tel',attrs:'maxlength="32" inputmode="tel"'})}
 ${input('city',t.city,{autocomplete:'address-level2',attrs:'maxlength="100"'})}${input('state',t.state,{autocomplete:'address-level1',attrs:'maxlength="40"'})}</div>
 <div class="divider"></div>
 <div class="grid">${select('location',t.preferred_location,[...LOCATIONS.map(l=>[l.code,l.name]),['either',t.either]])}${select('position',t.position,entries(t.positions))}
 ${select('at_least_16',t.at_least_16,yesNo)}${select('work_authorized',t.work_authorized,yesNo)}</div>`;}

function stepAvailability(){
 return `<h2 class="step-title">${t.avail_title}</h2><p class="step-desc">${t.avail_desc}</p>
 <div class="grid">${input('earliest_start',t.earliest_start,{type:'date',attrs:`min="${today()}"`})}${select('hours_per_week',t.hours_per_week,entries(t.hours))}</div>
 <div class="field full availability" data-field="availability"><div class="availability-head"><strong>${t.days_title}${req()}</strong><p class="hint">${t.days_hint}</p></div>
 <div class="days">${DAYS.map(d=>{const a=data.availability[d];return `<div class="day${a.on?' on':''}" data-day="${d}"><label><input type="checkbox" data-day-toggle="${d}" ${a.on?'checked':''}> ${t.days[d]}</label><div class="times"><input type="time" data-day-from="${d}" value="${a.from}" aria-label="${t.days[d]} · ${t.start_time}" step="900"><span aria-hidden="true">–</span><input type="time" data-day-to="${d}" value="${a.to}" aria-label="${t.days[d]} · ${t.end_time}" step="900"></div><span class="state">${a.on?t.available:t.unavailable}</span></div>`;}).join('')}</div><span class="err" id="e-availability"></span></div>`;}

function fileCard(kind){
 const f=files[kind],isSelfie=kind==='selfie';
 const icon=isSelfie?`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>`
  :`<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>`;
 const chosen=f?`<div class="chosen">${isSelfie?`<img src="${URL.createObjectURL(f)}" alt="">`:''}<span>${e(f.name)} · ${Math.max(1,Math.round(f.size/1024))} KB</span><button type="button" data-remove="${kind}" aria-label="${t.remove}">✕</button></div>`:'';
 return `<div class="upload" data-field="${kind}"><div class="upload-head">${icon}<strong>${isSelfie?t.selfie_title:t.resume_title}</strong></div><small>${isSelfie?t.selfie_hint:t.resume_hint}</small>
 <div class="row"><label class="btn small">${isSelfie?t.choose_photo:t.choose_file}<input type="file" data-file="${kind}" accept="${isSelfie?'image/jpeg,image/png':'application/pdf,image/jpeg,image/png'}" ${isSelfie?'capture="user"':''}></label>${isSelfie&&navigator.mediaDevices?.getUserMedia?`<button type="button" class="btn small" data-camera>${t.take_selfie}</button>`:''}</div>${chosen}<span class="err" id="e-${kind}"></span></div>`;}

function stepExperience(){
 return `<h2 class="step-title">${t.exp_title}</h2><p class="step-desc">${t.exp_desc}</p>
 <div class="grid">${select('work_experience',t.work_experience,entries(t.experience))}${select('english_proficiency',t.english,entries(t.english_levels))}
 ${input('other_languages',t.other_languages,{optional:true,full:true,attrs:'maxlength="200"'})}${textarea('pitch',t.pitch,{attrs:'maxlength="2000" rows="3"'})}${input('referral_source',t.referral,{optional:true,full:true,attrs:'maxlength="200"'})}</div>
 <div class="uploads">${fileCard('resume')}${fileCard('selfie')}</div>`;}

function stepReview(){
 const loc=data.location==='either'?t.either:LOCATIONS.find(l=>l.code===data.location)?.name||'—';
 const avail=DAYS.filter(d=>data.availability[d].on).map(d=>`${t.days[d]}: ${data.availability[d].from}–${data.availability[d].to}`);
 const section=(title,target,body)=>`<section><h3>${title}<button type="button" data-goto="${target}" aria-label="${t.edit}: ${e(title)}">${t.edit}</button></h3>${body}</section>`;
 return `<h2 class="step-title">${t.review_title}</h2><p class="step-desc">${t.review_desc}</p><div class="review">
 ${section(t.contact_position,0,`<p class="name">${e(data.first_name)} ${e(data.last_name)}</p><p class="muted">${e(data.email)}<br>${e(data.phone)}<br>${e(data.city)}, ${e(data.state)}</p><p>${e(t.positions[data.position]||'—')} · ${e(loc)}</p><p class="muted">${t.at_least}: ${data.at_least_16==='true'?t.yes:t.no}<br>${t.authorized}: ${data.work_authorized==='true'?t.yes:t.no}</p>`)}
 ${section(t.avail_title,1,`<p>${t.start_date}: ${e(formatDate(data.earliest_start,lang))} · ${e(t.hours[data.hours_per_week]||'—')}</p><p class="muted">${avail.map(e).join('<br>')||'—'}</p>`)}
 ${section(t.exp_title,2,`<p>${e(t.experience[data.work_experience]||'—')} · ${t.english}: ${e(t.english_levels[data.english_proficiency]||'—')}</p>${data.other_languages?`<p class="muted">${e(data.other_languages)}</p>`:''}${data.pitch?`<p class="muted">“${e(data.pitch)}”</p>`:''}<p class="muted">${files.resume?t.resume_attached:t.no_resume}<br>${files.selfie?t.selfie_attached:t.no_selfie}</p>`)}
 </div>
 <div class="privacy"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg><span>${t.privacy}</span></div>
 <label class="consent" data-field="consent"><input type="checkbox" name="consent" ${data.consent?'checked':''}><span>${t.consent}</span></label>
 <input type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px">`;}

function success(){
 return `<div class="success"><div class="badge"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></div><h2>${t.success_title}</h2><p>${t.success_body}</p><span class="ref">${t.reference} · ${e(result.reference)}</span><button type="button" class="btn ghost" data-restart>${t.another}</button></div>`;}

// ---- Render ----
function render(){
 const form=$('#form');
 $('#side-locations').innerHTML=LOCATIONS.map(l=>`<li><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>${e(l.name)}</li>`).join('');
 $('#side-steps').innerHTML=t.steps.map((s,i)=>`<li ${i===step&&!result?'aria-current="step"':''} class="${i<step||result?'done':''}"><i>${i<step||result?'<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>':String(i+1).padStart(2,'0')}</i>${e(s)}</li>`).join('');
 $('#progress-count').textContent=`${result?4:step+1} / 4`;$('#progress-fill').style.width=`${(result?4:step+1)*25}%`;
 $('#year').textContent=new Date().getFullYear();
 if(result){closePicker();document.body.dataset.step='done';form.innerHTML=`<div class="step-body">${success()}</div>`;return;}
 const body=[stepAbout,stepAvailability,stepExperience,stepReview][step]();
 const last=step===3;
 document.body.dataset.step=String(step);
 form.innerHTML=`<div class="step-body">${body}<p class="form-error" role="alert" ${formError?'':'hidden'}>${e(formError)}</p></div>
 <div class="actions">${step>0?`<button type="button" class="btn ghost" data-back>${t.back}</button>`:`<span class="private"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>${t.private}</span>`}<span class="spacer"></span><button type="submit" class="btn primary" ${submitting?'disabled':''}>${last?(submitting?t.submitting:t.submit):t.continue}</button></div>`;
 enhanceFields(form,{lang,labels:{select:t.select,today:t.today,today_iso:today(),prev_month:t.prev_month,next_month:t.next_month,choose_date:t.choose_date,date_placeholder:t.date_placeholder}});
 if(!formError)form.querySelector('.step-title')?.setAttribute('tabindex','-1');
}

// ---- Validation ----
function setError(key,message){const field=$(`[data-field="${key}"]`);if(!field)return;field.classList.toggle('invalid',!!message);const err=field.querySelector('.err');if(err)err.textContent=message||'';}
function validateStep(){
 if(!ENFORCE_REQUIRED)return true;
 let ok=true;const fail=(k,m)=>{setError(k,m);ok=false;};
 const need=(keys)=>keys.forEach(k=>{setError(k,'');if(!String(data[k]||'').trim())fail(k,t.err_required);});
 const pick=(keys)=>keys.forEach(k=>{setError(k,'');if(!data[k])fail(k,t.err_select);});
 if(step===0){need(['first_name','last_name','email','phone','city','state']);
  if(data.email&&!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email))fail('email',t.err_email);
  if(data.phone&&data.phone.replace(/\D/g,'').length<7)fail('phone',t.err_phone);
  pick(['location','position','at_least_16','work_authorized']);
  if(data.at_least_16==='false')fail('at_least_16',t.err_age);}
 if(step===1){setError('earliest_start','');if(!/^\d{4}-\d{2}-\d{2}$/.test(data.earliest_start)||data.earliest_start<today())fail('earliest_start',t.err_date);
  pick(['hours_per_week']);setError('availability','');const on=DAYS.filter(d=>data.availability[d].on);
  if(!on.length)fail('availability',t.err_days);else if(on.some(d=>!(data.availability[d].from<data.availability[d].to)))fail('availability',t.err_times);}
 if(step===2){pick(['work_experience','english_proficiency']);}
 if(step===3){const c=$('[data-field="consent"]');c?.classList.toggle('invalid',!data.consent);if(!data.consent){ok=false;formError=t.err_consent;}}
 if(!ok){const first=$('.invalid');(first?.querySelector('.picker-trigger,input:not([type=hidden]),textarea')||first)?.focus();first?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
 return ok;}
function checkFile(kind,file){if(!file)return '';const okTypes=kind==='selfie'?['image/jpeg','image/png']:['application/pdf','image/jpeg','image/png'];return (!okTypes.includes(file.type)||file.size>MAX_FILE||file.size===0)?(kind==='selfie'?t.err_photo:t.err_file):'';}

// ---- Submit ----
async function submit(){
 if(submitting)return;submitting=true;formError='';render();
 const fd=new FormData();
 for(const k of ['first_name','last_name','email','phone','city','state','position','at_least_16','work_authorized','earliest_start','hours_per_week','work_experience','english_proficiency','other_languages','pitch','referral_source'])fd.append(k,data[k]??'');
 fd.append('locale',lang);fd.append('consent',String(data.consent));fd.append('any_location',String(data.location==='either'));if(data.location!=='either')fd.append('preferred_location_code',data.location);
 fd.append('availability',JSON.stringify(DAYS.filter(d=>data.availability[d].on).map(d=>({day:d,from:data.availability[d].from,to:data.availability[d].to}))));
 fd.append('website',$('[name=website]')?.value||'');
 if(files.resume)fd.append('resume',files.resume,files.resume.name);if(files.selfie)fd.append('selfie',files.selfie,files.selfie.name);
 try{const r=await fetch(ENDPOINT,{method:'POST',body:fd,signal:AbortSignal.timeout(60000)});const value=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(value.error||t.err_generic);
  result=value;data=blank();files={resume:null,selfie:null};try{sessionStorage.removeItem(DRAFT_KEY);}catch{}
 }catch(err){formError=err.name==='TimeoutError'||err.name==='TypeError'?t.err_network:err.message;}
 finally{submitting=false;render();scrollTop();}
}

function scrollTop(){const body=$('.step-body');if(body)body.scrollTop=0;}
function goStep(next,{push=true}={}){step=Math.max(0,Math.min(3,next));formError='';if(push)history.pushState({step},'');render();scrollTop();$('.step-title')?.focus();}
window.addEventListener('popstate',ev=>{if(result)return;const target=Number.isInteger(ev.state?.step)?ev.state.step:0;step=target;formError='';render();scrollTop();});
history.replaceState({step},'');
const refocusUpload=kind=>$(`[data-field="${kind}"] .btn.small`)?.focus();
// ---- Events ----
const form=$('#form');
form.addEventListener('submit',ev=>{ev.preventDefault();formError='';if(!validateStep()){render();return;}if(step<3)goStep(step+1);else submit();});
form.addEventListener('input',ev=>{const el=ev.target;if(el.name&&el.name in data&&el.type!=='checkbox'){data[el.name]=el.value;el.classList.remove('placeholder');setError(el.name,'');saveDraft();}
 const d=el.dataset.dayFrom||el.dataset.dayTo;if(d){data.availability[d][el.dataset.dayFrom?'from':'to']=el.value;setError('availability','');saveDraft();}});
form.addEventListener('change',async ev=>{const el=ev.target;
 if(el.dataset.dayToggle){const d=el.dataset.dayToggle;data.availability[d].on=el.checked;const row=el.closest('.day');row.classList.toggle('on',el.checked);row.querySelector('.state').textContent=el.checked?t.available:t.unavailable;setError('availability','');saveDraft();return;}
 if(el.name==='consent'){data.consent=el.checked;el.closest('.consent').classList.remove('invalid');formError='';$('.form-error').hidden=true;return;}
 if(el.dataset.file){const kind=el.dataset.file,file=el.files?.[0]||null;const problem=checkFile(kind,file);setError(kind,problem);files[kind]=problem?null:file;render();}});
form.addEventListener('click',async ev=>{const el=ev.target.closest('button');if(!el)return;
 if(el.dataset.back!==undefined)goStep(step-1);
 else if(el.dataset.goto!==undefined)goStep(Number(el.dataset.goto));
 else if(el.dataset.remove){const kind=el.dataset.remove;files[kind]=null;render();refocusUpload(kind);}
 else if(el.dataset.camera!==undefined){const file=await captureSelfie(t);if(file){files.selfie=file;setError('selfie','');render();}refocusUpload('selfie');}
 else if(el.dataset.restart!==undefined){result=null;goStep(0);}});
document.querySelectorAll('[data-lang]').forEach(b=>b.addEventListener('click',()=>setLang(b.dataset.lang)));
window.addEventListener('beforeunload',ev=>{if(!result&&step>0&&!submitting){ev.preventDefault();}});
setLang(lang);
