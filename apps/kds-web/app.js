const $=(selector)=>document.querySelector(selector);
const params=new URLSearchParams(location.search);
const state={api:(params.get('api')||sessionStorage.getItem('risto.kds.api')||'http://localhost:3000').replace(/\/$/,''),locationId:params.get('location')||sessionStorage.getItem('risto.kds.location')||'',token:sessionStorage.getItem('risto.kds.token')||'',timer:null,busy:new Set()};
$('#apiInput').value=state.api; $('#locationInput').value=state.locationId; $('#tokenInput').value=state.token;
$('#connectButton').addEventListener('click',connect);
$('#settingsButton').addEventListener('click',showSetup);
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
if(state.locationId&&state.token) connect();

async function connect(){
  state.api=$('#apiInput').value.trim().replace(/\/$/,''); state.locationId=$('#locationInput').value.trim(); state.token=$('#tokenInput').value.trim();
  if(!state.api||!state.locationId||!state.token){ $('#setupError').textContent='Compila tutti i campi.'; return; }
  sessionStorage.setItem('risto.kds.api',state.api); sessionStorage.setItem('risto.kds.location',state.locationId); sessionStorage.setItem('risto.kds.token',state.token);
  $('#connectButton').disabled=true; $('#setupError').textContent='';
  try{ await refresh(); $('#setup').hidden=true; $('#board').hidden=false; setConnection(true); startPolling(); }
  catch(error){ setConnection(false); $('#setupError').textContent=message(error); }
  finally{ $('#connectButton').disabled=false; }
}
function showSetup(){ clearInterval(state.timer); $('#board').hidden=true; $('#setup').hidden=false; setConnection(false); }
function startPolling(){ clearInterval(state.timer); state.timer=setInterval(()=>refresh().catch(()=>setConnection(false)),3000); }

async function refresh(){
  const data=await request(`/v1/kds/locations/${encodeURIComponent(state.locationId)}/orders`);
  setConnection(true); render(data.orders||[]);
}
function render(orders){
  const root=$('#orders'); root.replaceChildren(); $('#queueCount').textContent=`${orders.length} ${orders.length===1?'ordine':'ordini'}`; $('#empty').hidden=orders.length!==0;
  for(const order of orders){
    const ticket=$('#orderTemplate').content.firstElementChild.cloneNode(true); ticket.dataset.id=order.id; ticket.querySelector('.table').textContent=order.tableLabel||'Ordine'; ticket.querySelector('.time').textContent=new Intl.DateTimeFormat('it-IT',{hour:'2-digit',minute:'2-digit'}).format(new Date(order.createdAt)); ticket.querySelector('.status').textContent=pretty(order.kitchenStatus);
    const items=ticket.querySelector('.items');
    for(const item of order.items||[]){ const row=document.createElement('div'); row.className='item'; const qty=document.createElement('span'); qty.className='qty'; qty.textContent=`${item.quantity}×`; const name=document.createElement('strong'); name.textContent=item.name; row.append(qty,name); if(item.notes){ const notes=document.createElement('small'); notes.textContent=item.notes; row.append(notes); } items.append(row); }
    const next=nextState(order.kitchenStatus); const button=ticket.querySelector('.next');
    if(next){ button.textContent=actionLabel(next); button.disabled=state.busy.has(order.id); button.addEventListener('click',()=>advance(order.id,next,button)); } else button.hidden=true;
    root.append(ticket);
  }
}
async function advance(orderId,status,button){
  state.busy.add(orderId); button.disabled=true;
  try{ await request(`/v1/kds/orders/${orderId}/status`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status})}); await refresh(); }
  catch(error){ alert(message(error)); }
  finally{ state.busy.delete(orderId); }
}
function nextState(status){ return ({DISPATCHED:'ACKNOWLEDGED',ACKNOWLEDGED:'PREPARING',PREPARING:'READY',READY:'SERVED'})[status]||null; }
function actionLabel(status){ return ({ACKNOWLEDGED:'Ricevuto',PREPARING:'In preparazione',READY:'Pronto',SERVED:'Servito'})[status]||pretty(status); }
async function request(path,options={}){ const headers=new Headers(options.headers||{}); headers.set('authorization',`Bearer ${state.token}`); const response=await fetch(`${state.api}${path}`,{...options,headers}); const text=await response.text(); let data={}; try{data=text?JSON.parse(text):{};}catch{data={message:text};} if(!response.ok) throw new Error(data.message||`Errore HTTP ${response.status}`); return data; }
function setConnection(online){ const el=$('#connection'); el.textContent=online?'Collegato':'Non collegato'; el.classList.toggle('online',online); }
function pretty(value){ return String(value||'').replaceAll('_',' ').toLowerCase().replace(/^./,(c)=>c.toUpperCase()); }
function message(error){ return error instanceof Error?error.message:'Errore imprevisto'; }
