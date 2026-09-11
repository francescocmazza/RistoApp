const $=(selector)=>document.querySelector(selector);
const params=new URLSearchParams(location.search);
const state={
  api:(params.get('api')||sessionStorage.getItem('risto.kds.api')||'http://localhost:3000').replace(/\/$/,''),
  locationId:params.get('location')||sessionStorage.getItem('risto.kds.location')||'',
  station:params.get('station')||sessionStorage.getItem('risto.kds.station')||'',
  token:sessionStorage.getItem('risto.kds.token')||'',
  streamAbort:null,
  busy:new Set(),
};

$('#apiInput').value=state.api;
$('#locationInput').value=state.locationId;
$('#stationInput').value=state.station;
$('#tokenInput').value=state.token;
$('#connectButton').addEventListener('click',connect);
$('#settingsButton').addEventListener('click',showSetup);
if('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
if(state.locationId&&state.token) connect();

async function connect(){
  stopRealtime();
  state.api=$('#apiInput').value.trim().replace(/\/$/,'');
  state.locationId=$('#locationInput').value.trim();
  state.station=$('#stationInput').value.trim();
  state.token=$('#tokenInput').value.trim();
  if(!state.api||!state.locationId||!state.token){ $('#setupError').textContent='Compila API, ID sede e token.'; return; }

  sessionStorage.setItem('risto.kds.api',state.api);
  sessionStorage.setItem('risto.kds.location',state.locationId);
  sessionStorage.setItem('risto.kds.station',state.station);
  sessionStorage.setItem('risto.kds.token',state.token);
  $('#connectButton').disabled=true;
  $('#setupError').textContent='';
  try{
    await refresh();
    $('#setup').hidden=true;
    $('#board').hidden=false;
    setConnection(true);
    startRealtime();
  }catch(error){
    setConnection(false);
    $('#setupError').textContent=message(error);
  }finally{
    $('#connectButton').disabled=false;
  }
}

function showSetup(){
  stopRealtime();
  $('#board').hidden=true;
  $('#setup').hidden=false;
  setConnection(false);
}

async function refresh(){
  const data=await request(queuePath(false));
  setConnection(true);
  render(data.tickets||[]);
}

function render(tickets){
  const root=$('#orders');
  root.replaceChildren();
  $('#queueCount').textContent=`${tickets.length} ${tickets.length===1?'ticket':'ticket'}`;
  $('#empty').hidden=tickets.length!==0;

  for(const ticketData of tickets){
    const ticket=$('#orderTemplate').content.firstElementChild.cloneNode(true);
    const ticketKey=`${ticketData.orderId}:${ticketData.stationCode}`;
    ticket.dataset.id=ticketKey;
    ticket.querySelector('.table').textContent=`${ticketData.tableLabel||'Ordine'} · ${ticketData.stationCode}`;
    ticket.querySelector('.time').textContent=new Intl.DateTimeFormat('it-IT',{hour:'2-digit',minute:'2-digit'}).format(new Date(ticketData.createdAt));
    ticket.querySelector('.status').textContent=pretty(ticketData.status);

    const items=ticket.querySelector('.items');
    for(const item of ticketData.items||[]){
      const row=document.createElement('div');
      row.className='item';
      const qty=document.createElement('span');
      qty.className='qty';
      qty.textContent=`${item.quantity}×`;
      const name=document.createElement('strong');
      name.textContent=item.name;
      row.append(qty,name);
      const details=[];
      for(const modifier of item.modifiers||[]) details.push(modifier.option);
      if(item.notes) details.push(`Nota: ${item.notes}`);
      if(details.length){
        const notes=document.createElement('small');
        notes.textContent=details.join(' · ');
        row.append(notes);
      }
      items.append(row);
    }

    const next=nextState(ticketData.status);
    const button=ticket.querySelector('.next');
    if(next){
      button.textContent=actionLabel(next);
      button.disabled=state.busy.has(ticketKey);
      button.addEventListener('click',()=>advance(ticketData.orderId,ticketData.stationCode,next,button));
    }else{
      button.hidden=true;
    }
    root.append(ticket);
  }
}

async function advance(orderId,stationCode,status,button){
  const key=`${orderId}:${stationCode}`;
  state.busy.add(key);
  button.disabled=true;
  try{
    await request(`/v1/kds/orders/${encodeURIComponent(orderId)}/stations/${encodeURIComponent(stationCode)}/status`,{
      method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({status}),
    });
    await refresh();
  }catch(error){
    alert(message(error));
  }finally{
    state.busy.delete(key);
  }
}

function startRealtime(){
  stopRealtime();
  const controller=new AbortController();
  state.streamAbort=controller;
  void streamLoop(controller.signal);
}

function stopRealtime(){
  if(state.streamAbort) state.streamAbort.abort();
  state.streamAbort=null;
}

async function streamLoop(signal){
  while(!signal.aborted){
    try{
      $('#boardMode').textContent='Realtime';
      const response=await fetch(`${state.api}${queuePath(true)}`,{
        headers:{authorization:`Bearer ${state.token}`,accept:'text/event-stream'},
        cache:'no-store',signal,
      });
      if(!response.ok){
        const error=new Error(`Errore HTTP ${response.status}`);
        error.status=response.status;
        throw error;
      }
      if(!response.body) throw new Error('Stream SSE non disponibile');
      setConnection(true);
      await consumeSse(response.body,signal);
      if(!signal.aborted) throw new Error('Stream SSE terminato');
    }catch(error){
      if(signal.aborted) return;
      setConnection(false);
      if(error?.status===401||error?.status===403){
        $('#setupError').textContent='Token KDS non valido o fuori scope.';
        showSetup();
        return;
      }
      $('#boardMode').textContent='Fallback polling';
      await refresh().catch(()=>setConnection(false));
      await delay(3000,signal).catch(()=>{});
    }
  }
}

async function consumeSse(body,signal){
  const reader=body.getReader();
  const decoder=new TextDecoder();
  let buffer='';
  try{
    while(!signal.aborted){
      const {done,value}=await reader.read();
      if(done) return;
      buffer+=decoder.decode(value,{stream:true}).replace(/\r\n/g,'\n');
      let boundary=buffer.indexOf('\n\n');
      while(boundary>=0){
        const block=buffer.slice(0,boundary);
        buffer=buffer.slice(boundary+2);
        const event=parseSseBlock(block);
        if(event.type==='kds'&&event.data){
          const data=JSON.parse(event.data);
          render(data.tickets||[]);
          setConnection(true);
          $('#boardMode').textContent='Realtime';
        }else if(event.type==='heartbeat'){
          setConnection(true);
        }
        boundary=buffer.indexOf('\n\n');
      }
    }
  }finally{
    await reader.cancel().catch(()=>{});
  }
}

function parseSseBlock(block){
  let type='';
  const data=[];
  for(const line of block.split('\n')){
    if(line.startsWith('event:')) type=line.slice(6).trim();
    if(line.startsWith('data:')) data.push(line.slice(5).trimStart());
  }
  return {type,data:data.join('\n')};
}

function queuePath(events){
  const suffix=events?'/events':'';
  const query=state.station?`?station=${encodeURIComponent(state.station)}`:'';
  return `/v1/kds/locations/${encodeURIComponent(state.locationId)}/orders${suffix}${query}`;
}

function nextState(status){ return ({DISPATCHED:'ACKNOWLEDGED',ACKNOWLEDGED:'PREPARING',PREPARING:'READY',READY:'SERVED'})[status]||null; }
function actionLabel(status){ return ({ACKNOWLEDGED:'Ricevuto',PREPARING:'In preparazione',READY:'Pronto',SERVED:'Servito'})[status]||pretty(status); }

async function request(path,options={}){
  const headers=new Headers(options.headers||{});
  headers.set('authorization',`Bearer ${state.token}`);
  const response=await fetch(`${state.api}${path}`,{...options,headers});
  const text=await response.text();
  let data={};
  try{ data=text?JSON.parse(text):{}; }catch{ data={message:text}; }
  if(!response.ok){
    const error=new Error(data.message||`Errore HTTP ${response.status}`);
    error.status=response.status;
    throw error;
  }
  return data;
}

function delay(milliseconds,signal){
  return new Promise((resolve,reject)=>{
    if(signal.aborted){ reject(new DOMException('Aborted','AbortError')); return; }
    const timer=setTimeout(resolve,milliseconds);
    signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});
  });
}

function setConnection(online){
  const element=$('#connection');
  element.textContent=online?'Collegato':'Non collegato';
  element.classList.toggle('online',online);
}
function pretty(value){ return String(value||'').replaceAll('_',' ').toLowerCase().replace(/^./,(c)=>c.toUpperCase()); }
function message(error){ return error instanceof Error?error.message:'Errore imprevisto'; }
