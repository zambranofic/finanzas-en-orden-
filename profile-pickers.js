import {countryInfo,currencyFlagCode,currencyLabel} from './currency-utils.js';
const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function pickerChoice(value,isCountry){
 const country=isCountry&&value?countryInfo(value):null,code=country?country.code:currencyFlagCode(value);
 const label=country?(country.code==='GB'?'Reino Unido (Inglaterra)':country.name)+' · '+country.currency:value?currencyLabel(value):'Selecciona tu país';
 return (code?`<img class="pickerFlag" src="assets/flags/${code.toLowerCase()}.png" width="24" height="18" alt="">`:'')+`<span>${escapeHtml(label)}</span>`;
}
let controls;
export function bindProfilePickers(root=document){
 controls?.abort();controls=new AbortController();const signal=controls.signal,pickers=[];
 for(const id of ['pfCountry','pfPCurrency','pfBCurrency']){
  const select=root.querySelector('#'+id);if(!select)continue;select.hidden=true;
  const wrap=document.createElement('div');wrap.className='flagPicker';
  const button=document.createElement('button');button.type='button';button.className='flagPickerButton';button.id=id+'Button';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',id+'Options');
  const panel=document.createElement('div');panel.className='flagPickerOptions';panel.id=id+'Options';panel.hidden=true;panel.setAttribute('role','listbox');panel.setAttribute('aria-label',select.labels?.[0]?.textContent||'Seleccionar');
  wrap.append(button,panel);select.after(wrap);select.labels?.[0]?.setAttribute('for',button.id);
  const isCountry=id==='pfCountry',labelText=panel.getAttribute('aria-label');
  const close=()=>{panel.hidden=true;button.setAttribute('aria-expanded','false')};
  const refresh=()=>{button.setAttribute('aria-label',labelText+': '+(isCountry?(select.value||'Selecciona tu país'):currencyLabel(select.value)));button.innerHTML=pickerChoice(select.value,isCountry)+'<span class="pickerChevron" aria-hidden="true">⌄</span>';panel.innerHTML=[...select.options].filter(o=>o.value&&!o.disabled||o.selected&&o.value).map(o=>`<button type="button" role="option" aria-selected="${o.value===select.value}" data-value="${escapeHtml(o.value)}">${pickerChoice(o.value,isCountry)}${o.value===select.value?'<span class="pickerCheck" aria-hidden="true">✓</span>':''}</button>`).join('')||'<p>No hay países que coincidan.</p>'};
  const open=(focus=false)=>{pickers.forEach(p=>p.close());refresh();panel.hidden=false;button.setAttribute('aria-expanded','true');if(focus)(panel.querySelector('[aria-selected="true"]')||panel.querySelector('button'))?.focus()};
  button.addEventListener('click',()=>panel.hidden?open():close(),{signal});
  button.addEventListener('keydown',e=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();open(true)}if(e.key==='Escape')close()},{signal});
  panel.addEventListener('click',e=>{const item=e.target.closest('button[data-value]');if(!item)return;select.value=item.dataset.value;select.dispatchEvent(new Event('change',{bubbles:true}));refresh();close();button.focus()},{signal});
  panel.addEventListener('keydown',e=>{const items=[...panel.querySelectorAll('button')],i=items.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const n=e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items[n]?.focus()}if(e.key==='Escape'){e.preventDefault();close();button.focus()}if(e.key==='Tab')close()},{signal});
  refresh();pickers.push({id,wrap,refresh,close,open});
 }
 if(!pickers.length)return;
 root.querySelector('#pfCountrySearch')?.setAttribute('aria-controls','pfCountryOptions');
 root.addEventListener('change',e=>{if(['pfCountry','pfPCurrency','pfBCurrency'].includes(e.target.id))pickers.forEach(p=>p.refresh())},{signal});
 root.addEventListener('input',e=>{if(e.target.id==='pfCountrySearch'){const p=pickers.find(x=>x.id==='pfCountry');p?.refresh();if(e.target.value.trim())p?.open()}},{signal});
 root.addEventListener('click',e=>{for(const p of pickers)if(!e.composedPath().includes(p.wrap)&&e.target.id!=='pfCountrySearch')p.close()},{signal});
}
