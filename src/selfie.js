// In-page selfie capture. Resolves with a JPEG File or null when cancelled.
export function captureSelfie(t){
 return new Promise(resolve=>{
  const root=document.querySelector('#camera-root'),app=document.querySelector('#app'),opener=document.activeElement;app.inert=true;
  root.innerHTML=`<div class="camera" role="dialog" aria-modal="true" aria-label="${t.take_selfie}"><div class="camera-box"><video autoplay playsinline muted></video><canvas hidden></canvas><p>${t.camera_help}</p><div class="row"><button type="button" class="btn ghost" data-cam="cancel">${t.cancel}</button><button type="button" class="btn ghost" data-cam="retake" hidden>${t.retake}</button><button type="button" class="btn primary" data-cam="shoot">${t.take_selfie}</button><button type="button" class="btn primary" data-cam="use" hidden>${t.use_photo}</button></div></div></div>`;
  const video=root.querySelector('video'),canvas=root.querySelector('canvas'),btn=k=>root.querySelector(`[data-cam=${k}]`);
  let stream=null,blob=null;
  const finish=value=>{stream?.getTracks().forEach(x=>x.stop());root.innerHTML='';document.removeEventListener('keydown',onKey);app.inert=false;opener?.focus?.();resolve(value);};
  const onKey=e=>{if(e.key==='Escape')finish(null);};
  document.addEventListener('keydown',onKey);
  navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:960},height:{ideal:720}},audio:false}).then(s=>{stream=s;video.srcObject=s;}).catch(()=>{root.querySelector('p').textContent=t.camera_denied;btn('shoot').hidden=true;});
  btn('cancel').onclick=()=>finish(null);
  btn('shoot').onclick=()=>{const w=video.videoWidth||960,h=video.videoHeight||720;canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d');ctx.translate(w,0);ctx.scale(-1,1);ctx.drawImage(video,0,0,w,h);canvas.toBlob(b=>{blob=b;video.hidden=true;canvas.hidden=false;btn('shoot').hidden=true;btn('retake').hidden=false;btn('use').hidden=false;btn('use').focus();},'image/jpeg',.9);};
  btn('retake').onclick=()=>{blob=null;canvas.hidden=true;video.hidden=false;btn('shoot').hidden=false;btn('retake').hidden=true;btn('use').hidden=true;};
  btn('use').onclick=()=>finish(blob?new File([blob],'selfie.jpg',{type:'image/jpeg'}):null);
  btn('cancel').focus();
 });
}
