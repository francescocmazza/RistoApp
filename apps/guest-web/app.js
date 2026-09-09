const $=(selector)=>document.querySelector(selector);
const params=new URLSearchParams(location.search);
const state={api:(params.get('api')||sessionStorage.getItem('risto.api')||'http://localhost:3000').replace(/\/$/,''),qr:params.get('qr')||'',sessionId:null,menu:null,cart:new Map(),restaurant:null,table:null,order:null,pollTimer:null};

const apiInput=$('#apiInput'); const qrInput=$('#qrInput');
apiInput.value=state.api; qrInput.value=state.qr;
$('#openMenuButton').addEventListener('click',openMenu);
$('#cartButton').addEventListener('click',openCart);
$('#closeCart').addEventListener('click',()=>$('#cartDialog').close());
$('#checkoutButton').addEventListener('click',checkout);
$('#backToMenu').addEventListener('click',()=>{ $('#orderView').hidden=true; $('#menuView').hidden=false; });
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
if(state.qr) openMenu();

async function openMenu(){
  state.api=apiInput.value.trim().replace(/\/$/,''); state.qr=qrInput.value.trim();
  if(!state.api||!state.qr) return banner('Inserisci API e QR.');
  sessionStorage.setItem('risto.api',state.api);
  setBusy('#openMenuButton',true,'Apro…');
  try{
    const data=await request(`/v1/public/qr/${encodeURIComponent(state.qr)}/session`,{method:'POST'});
    state.sessionId=data.sessionId; state.menu=data.menu; state.restaurant=data.restaurant; state.table=data.table; state.cart.clear();
    $('#restaurantName').textContent=data.restaurant?.name||'Ristorante'; $('#tableLabel').textContent=data.table?.label||'';
    $('#setup').hidden=true; $('#menuView').hidden=false; $('#orderView').hidden=true; renderMenu(); updateCartBadge();
  }catch(error){ banner(message(error)); }
  finally{ setBusy('#openMenuButton',false,'Apri menu'); }
}

function renderMenu(){
  const root=$('#menu'); root.replaceChildren();
  const groups=[...(state.menu?.categories||[])];
  if(state.menu?.uncategorized?.length) groups.push({id:'other',name:'Altro',items:state.menu.uncategorized});
  for(const group of groups){
    if(!group.items?.length) continue;
    const section=document.createElement('section'); section.className='menu-section';
    const title=document.createElement('h2'); title.textContent=group.name; section.append(title);
    for(const item of group.items) section.append(renderItem(item));
    root.append(section);
  }
}

function renderItem(item){
  const node=$('#itemTemplate').content.firstElementChild.cloneNode(true); node.dataset.id=item.id;
  node.querySelector('h3').textContent=item.name; node.querySelector('p').textContent=item.description||''; node.querySelector('.price').textContent=money(item.priceMinor,item.currency);
  const count=node.querySelector('.quantity span');
  node.querySelector('[data-action=plus]').addEventListener('click',()=>change(item,1,count));
  node.querySelector('[data-action=minus]').addEventListener('click',()=>change(item,-1,count));
  return node;
}

function change(item,delta,countNode){
  const existing=state.cart.get(item.id)||{item,quantity:0}; const quantity=Math.max(0,Math.min(20,existing.quantity+delta));
  if(quantity===0) state.cart.delete(item.id); else state.cart.set(item.id,{item,quantity});
  countNode.textContent=quantity; updateCartBadge();
}
function updateCartBadge(){ $('#cartCount').textContent=[...state.cart.values()].reduce((n,line)=>n+line.quantity,0); }

async function openCart(){
  const lines=$('#cartLines'); lines.replaceChildren(); let total=0; let currency='EUR';
  for(const {item,quantity} of state.cart.values()){
    total+=item.priceMinor*quantity; currency=item.currency;
    const row=document.createElement('div'); row.className='cart-line'; row.innerHTML=`<span><strong></strong><br><small></small></span><strong class="line-price"></strong>`;
    row.querySelector('strong').textContent=item.name; row.querySelector('small').textContent=`${quantity} × ${money(item.priceMinor,item.currency)}`; row.querySelector('.line-price').textContent=money(item.priceMinor*quantity,item.currency); lines.append(row);
  }
  if(!state.cart.size){ const empty=document.createElement('p'); empty.textContent='Il carrello è vuoto.'; lines.append(empty); }
  $('#cartTotal').textContent=money(total,currency); $('#checkoutButton').disabled=!state.cart.size;
  $('#paymentMethod').replaceChildren(); $('#checkoutHint').textContent='';
  try{
    const data=state.sessionId?await request(`/v1/public/sessions/${state.sessionId}/payment-methods`):{methods:[]};
    for(const method of data.methods||[]){ const option=document.createElement('option'); option.value=method.key; option.textContent=paymentLabel(method.key); $('#paymentMethod').append(option); }
    if(!(data.methods||[]).length){ $('#checkoutButton').disabled=true; $('#checkoutHint').textContent='Nessun metodo di pagamento disponibile.'; }
  }catch(error){ $('#checkoutButton').disabled=true; $('#checkoutHint').textContent=message(error); }
  $('#cartDialog').showModal();
}

async function checkout(){
  if(!state.sessionId||!state.cart.size) return;
  const paymentMethod=$('#paymentMethod').value; if(!paymentMethod) return;
  setBusy('#checkoutButton',true,'Pagamento…');
  const checkoutKey=crypto.randomUUID();
  try{
    const order=await request(`/v1/public/sessions/${state.sessionId}/checkout`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({checkoutKey,paymentMethod,returnUrl:location.href,items:[...state.cart.values()].map(({item,quantity})=>({menuItemId:item.id,quantity}))})});
    state.order=order; state.cart.clear(); updateCartBadge(); $('#cartDialog').close(); showOrder(order); startPolling();
  }catch(error){ $('#checkoutHint').textContent=message(error); }
  finally{ setBusy('#checkoutButton',false,'Ordina e paga'); }
}

function showOrder(order){
  $('#menuView').hidden=true; $('#orderView').hidden=false; $('#orderTitle').textContent=order.paymentStatus==='PAID'?'Pagamento confermato':'Stiamo confermando il pagamento';
  const root=$('#orderStatus'); root.replaceChildren();
  for(const [label,value] of [['Pagamento',order.paymentStatus],['Cucina',order.kitchenStatus],['Totale',money(order.totalMinor,order.currency)]]){ const row=document.createElement('div'); row.className='status-chip'; const l=document.createElement('span'); l.textContent=label; const v=document.createElement('strong'); v.textContent=pretty(value); row.append(l,v); root.append(row); }
}
function startPolling(){
  clearInterval(state.pollTimer); if(!state.order?.id||!state.sessionId) return;
  state.pollTimer=setInterval(async()=>{ try{ const next=await request(`/v1/public/sessions/${state.sessionId}/orders/${state.order.id}`); state.order=next; showOrder(next); if(['SERVED'].includes(next.kitchenStatus)||['FAILED','REFUNDED'].includes(next.paymentStatus)) clearInterval(state.pollTimer); }catch{} },4000);
}

async function request(path,options={}){ const response=await fetch(`${state.api}${path}`,options); const text=await response.text(); let data={}; try{data=text?JSON.parse(text):{};}catch{data={message:text};} if(!response.ok) throw new Error(data.message||`Errore HTTP ${response.status}`); return data; }
function money(minor,currency='EUR'){ return new Intl.NumberFormat('it-IT',{style:'currency',currency}).format((minor||0)/100); }
function paymentLabel(key){ return ({mock:'Pagamento demo',paypal:'PayPal',satispay:'Satispay',stripe:'Carta / Wallet',nexi:'Carta / Nexi',klarna:'Klarna','amazon-pay':'Amazon Pay'}[key]||key); }
function pretty(value){ return String(value||'').replaceAll('_',' ').toLowerCase().replace(/^./,(c)=>c.toUpperCase()); }
function banner(text){ const el=$('#statusBanner'); el.textContent=text; el.hidden=false; }
function message(error){ return error instanceof Error?error.message:'Errore imprevisto'; }
function setBusy(selector,busy,label){ const button=$(selector); button.disabled=busy; button.textContent=label; }
