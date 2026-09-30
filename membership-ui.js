export function membershipState(license, now=Date.now()) {
 const expiry=Date.parse(license?.expires_at);
 const valid=Number.isFinite(expiry), remaining=valid?Math.max(0,Math.ceil((expiry-now)/86400000)):null;
 const active=license?.status==='active'&&valid&&expiry>now;
 return {active,remaining,expiry:valid?expiry:null,warning:valid&&(!active||remaining<=30)};
}
const date=value=>new Intl.DateTimeFormat('es-EC',{dateStyle:'long',timeZone:'America/Guayaquil'}).format(new Date(value));
const price=license=>new Intl.NumberFormat('es-EC',{style:'currency',currency:license?.annual_currency||'USD'}).format(Number(license?.annual_price_minor||2900)/100);
export function membershipBanner(license,now=Date.now()){
 const m=membershipState(license,now);if(!m.warning)return '';
 return `<aside class="membershipNotice" role="status"><div><strong>${m.active?`Tu membresía vence en ${m.remaining} ${m.remaining===1?'día':'días'}`:'Tu membresía ha vencido'}</strong><p>${m.active?'Renueva antes del vencimiento para conservar tu tarifa.':'Renueva para recuperar el acceso a tus herramientas.'}</p></div><a class="primary" href="/renovar.html">Renovar membresía</a></aside>`;
}
export function membershipCard(license,now=Date.now()){
 const m=membershipState(license,now);
 const events=m.expiry?[30,15,7,0].map(days=>`<tr><td>${date(m.expiry-days*86400000)}</td><td>${days?`Recordatorio · ${days} días antes`:'Vencimiento de la membresía'}</td></tr>`).join(''):'';
 return `<section class="card membershipCard"><span class="eyebrow">MI MEMBRESÍA</span><h3>Acceso anual a FINORVE</h3><p><strong>${m.active?'Activa':m.expiry?'Vencida':'Sin membresía activa'}</strong>${m.active?` · Te quedan ${m.remaining} días`:''}</p><p>Vencimiento: <strong>${m.expiry?date(m.expiry):'Pendiente de activación'}</strong></p><p>Tarifa contratada: <strong>${price(license)} USD / año</strong></p><p>Renovación manual. No realizamos cobros automáticos.</p>${membershipBanner(license,now)}<a class="primary" href="/renovar.html">${m.active?'Renovar membresía':'Activar membresía'}</a><p class="sub">Si renuevas antes de vencer, el nuevo año comienza al terminar tu período actual. Conservas tu tarifa mientras mantengas activa la membresía.</p>${events?`<h3>Calendario de membresía</h3><div class="membershipCalendar"><table><thead><tr><th>Fecha</th><th>Evento</th></tr></thead><tbody>${events}</tbody></table></div>`:''}</section>`;
}
