/* =====================================================
   O CRM DO ROBÔ DO INSTAGRAM — app da Yalla (25/11/2026)

   O Eugênio: "as pessoas que são atendidas pelo robô de atendimento devem ser criadas num CRM onde
   aparece a ficha e o histórico da conversa... no app dela, aonde pôr isso?" — e, para a sugestão,
   "sim faz":
     1. Conversas vira a caixa DE VERDADE (sai a demonstração com clientes de exemplo): quem escreveu
        para o Instagram dela e o robô atendeu, com a conversa inteira e o pedido que o robô anotou.
     2. Cada pessoa vira cliente (Clientes), "veio por: Instagram"; a ficha mostra a conversa.
     3. Cada pedido anotado pelo robô vira orçamento em Orçamentos › Em aberto (origem Instagram), com
        o resumo e a conversa em "O pedido" (nada disso vai para a proposta do cliente).
   Quem cria é o app, pelo Cadastro e pelo Orc de sempre: o formato é o da Milla e a nuvem sincroniza
   como qualquer cadastro. O cofre só LÊ (rota /api/atendimento-caixa: só a dona logada, só a conta
   dela). Nunca apaga nada; a mesma pessoa nunca vira dois clientes (igId = o id dela no Instagram)
   e o mesmo pedido nunca vira dois orçamentos (recadoId).
   ===================================================== */
const YR_INTERVALO = 10 * 60 * 1000;          /* fora da tela de Conversas, confere o Instagram a cada 10 min */
let yrCaixa = null, yrCarregando = false, yrErro = '', yrUltSinc = 0, yrAberta = null;
const yrHist = {};                            /* de → { mensagens, erro, carregando, em } */
if (typeof ORIGEM_ORC_TXT !== 'undefined') ORIGEM_ORC_TXT.instagram = 'Instagram (robô)';

const yrLigado = () => typeof COFRE !== 'undefined' && !!COFRE && typeof CLIENTE_COFRE !== 'undefined' && CLIENTE_COFRE === 'yalla'
  && typeof isLoggedIn === 'function' && isLoggedIn();
const yrUsuario = (s) => String(s || '').trim().replace(/^@+/, '').toLowerCase();

async function yrPede(corpo) {
  if (typeof authVencida === 'function' && authVencida() && typeof authEnsure === 'function') { try { await authEnsure(); } catch (e) {} }
  const tok = typeof authToken === 'function' ? authToken() : '';
  const r = await fetch(COFRE + '/api/atendimento-caixa', { method: 'POST', cache: 'no-store',
    headers: { 'content-type': 'application/json', ...(tok ? { authorization: 'Bearer ' + tok } : {}) },
    body: JSON.stringify({ cliente: CLIENTE_COFRE, ...corpo }) });
  const j = await r.json().catch(() => null);
  return { r, j };
}

/* as pessoas: as conversas do Instagram + os recados do robô, juntos pelo id de quem escreveu */
function yrPessoas(cx) {
  const m = new Map();
  for (const c of (cx && cx.conversas) || []) {
    if (!c || !c.de) continue;
    m.set(c.de, { de: c.de, canal: 'instagram', usuario: yrUsuario(c.usuario), quando: c.quando || '', texto: c.texto || '', deQuem: c.deQuem || '', recados: [] });
  }
  for (const r of (cx && cx.recados) || []) {
    if (!r || !r.de) continue;
    let p = m.get(r.de);
    if (!p) { p = { de: r.de, canal: r.canal || 'instagram', usuario: yrUsuario(r.instagram), quando: r.quando || '', texto: r.assunto || '', deQuem: '', recados: [] }; m.set(r.de, p); }
    p.recados.push(r);
    if (!p.usuario && r.instagram) p.usuario = yrUsuario(r.instagram);
  }
  return [...m.values()].sort((a, b) => String(b.quando).localeCompare(String(a.quando)));
}
const yrNome = (p) => { const r = (p.recados || []).find(x => x.nome); return (r && r.nome) || (p.usuario ? '@' + p.usuario : 'Contato do Instagram'); };
const yrDigitos = (s) => String(s || '').replace(/\D/g, '');

/* o cliente desta pessoa: pelo id do Instagram, pelo @, ou (com WhatsApp/e-mail) pelo Cadastro de sempre */
function yrClienteDe(p) {
  const l = Cadastro.all(), u = p.usuario;
  return l.find(c => c.igId && c.igId === p.de) || (u && l.find(c => yrUsuario(c.insta) === u)) || null;
}

/* leva para o CRM: cliente para cada pessoa; orçamento para cada pedido que o robô anotou */
function yrLevaParaCrm(cx) {
  let novos = 0, mudou = false; const orcs = [];
  for (const p of yrPessoas(cx)) {
    const rec = (p.recados || []).find(r => r.nome) || (p.recados || [])[0] || {};
    const whats = yrDigitos(rec.contato).length >= 8 ? String(rec.contato).trim() : '';
    const email = String(rec.email || '').trim(), insta = p.usuario ? '@' + p.usuario : '';
    let c = yrClienteDe(p);
    if (!c && (whats || email)) c = Cadastro.acha({ nome: rec.nome || '', whats, email });
    if (!c) {
      const antes = Cadastro.all().length;
      c = Cadastro.garante({ nome: yrNome(p), whats, email, insta, veioPor: 'instagram' });
      if (!c) continue;
      if (Cadastro.all().length > antes) novos++;
      mudou = true;
    } else {
      for (const [k, v] of [['whats', whats], ['email', email], ['insta', insta]]) if (v && !String(c[k] || '').trim()) { c[k] = v; mudou = true; }
      if (!c.veioPor) { c.veioPor = 'instagram'; mudou = true; }
    }
    /* o nome de verdade (o robô perguntou) vale mais que o @ */
    if (rec.nome && (/^@/.test(c.nome || '') || c.nome === 'Contato do Instagram')) { c.nome = String(rec.nome).trim(); mudou = true; }
    if (c.igId !== p.de) { c.igId = p.de; c.igCanal = p.canal || 'instagram'; mudou = true; }
    if (p.usuario && c.igUsuario !== p.usuario) { c.igUsuario = p.usuario; mudou = true; }
    if (mudou) c.atualizado = new Date().toISOString();
    for (const r of p.recados || []) {
      if (!r.id || Orc.all().some(o => o.recadoId === r.id)) continue;
      const notas = [
        `Pedido anotado pelo robô do Instagram${r.quando ? ' em ' + new Date(r.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}`,
        r.assunto && 'O que quer: ' + r.assunto, r.quando_quer && 'Quando: ' + r.quando_quer, r.dia && 'Dia: ' + r.dia + (r.hora ? ' ' + r.hora : ''),
        r.contato && 'WhatsApp: ' + r.contato, r.email && 'E-mail: ' + r.email, insta && 'Instagram: ' + insta, r.resumo && 'Resumo do robô: ' + r.resumo,
      ].filter(Boolean).join('\n');
      const o = Orc.cria({ origem: 'instagram', status: 'novo', cliente: { nome: c.nome, whats: c.whats || '', email: c.email || '' },
        resumo: [r.assunto, r.quando_quer].filter(Boolean).join(' · ') || 'Pedido pelo Instagram', conversa: notas,
        datas: /^\d{4}-\d{2}-\d{2}$/.test(r.dia || '') ? [r.dia] : [] });
      Object.assign(o, { recadoId: r.id, veioPor: 'instagram', clienteId: c.id, igId: p.de });
      orcs.push(o); mudou = true;
    }
  }
  if (mudou && typeof _opSave === 'function') _opSave();
  return { clientes: novos, orcamentos: orcs };
}

/* o histórico entra no orçamento novo (em "O pedido"), para ela ler sem sair dali */
async function yrConversaNoOrc(o) {
  const h = await yrCarregaHist(o.igId, false, true);
  const ms = (h && h.mensagens) || []; if (!ms.length) return;
  const x = Orc.get(o.id); if (!x || /\n\nConversa no Instagram:\n/.test(x.conversa || '')) return;
  x.conversa = String(x.conversa || '') + '\n\nConversa no Instagram:\n' + ms.map(m => (m.deQuem === 'nos' ? 'Yalla: ' : 'Cliente: ') + m.texto).join('\n');
  if (typeof _opSave === 'function') _opSave();
}

async function yrCarregaHist(de, forca, quieto) {
  const h = yrHist[de];
  if (h && h.carregando) return h;
  if (h && !forca && h.mensagens && h.em && Date.now() - h.em < 120000) return h;
  yrHist[de] = { carregando: true, mensagens: (h && h.mensagens) || [] };
  if (!quieto) yrRedesenha();
  let res;
  try {
    const { r, j } = await yrPede({ acao: 'conversa', de });
    res = r.ok && j && j.ok ? { mensagens: j.mensagens || [], em: Date.now() } : { erro: (j && j.msg) || 'Não consegui ler esta conversa agora.', mensagens: [] };
  } catch (e) { res = { erro: 'Sem conexão agora. Tente de novo em instantes.', mensagens: [] }; }
  yrHist[de] = res;
  if (!quieto) yrRedesenha();
  return res;
}

async function yrSincroniza(forca) {
  if (!yrLigado() || yrCarregando) return;
  if (!forca && Date.now() - yrUltSinc < YR_INTERVALO) return;
  yrCarregando = true; yrErro = ''; yrUltSinc = Date.now(); yrRedesenha();
  let cx = null;
  try {
    const { r, j } = await yrPede({ acao: 'caixa' });
    if (r.ok && j && j.ok && Array.isArray(j.conversas)) cx = j;
    else if (r.status === 401) yrErro = 'Entre de novo no app com a sua conta e tente outra vez.';
    else if (r.ok && j && j.cofre === 'ok') yrErro = 'As conversas ainda não estão ligadas no servidor. Fale com a Ti Artes.';
    else yrErro = (j && j.msg) || 'Não consegui carregar as conversas agora. Tente de novo em instantes.';
  } catch (e) { yrErro = 'Sem conexão agora. Tente de novo em instantes.'; }
  yrCarregando = false;
  if (cx) {
    yrCaixa = cx;
    const res = yrLevaParaCrm(cx);
    if (res.clientes || res.orcamentos.length) {
      const partes = [res.clientes && `${res.clientes} ${res.clientes === 1 ? 'cliente novo' : 'clientes novos'}`, res.orcamentos.length && `${res.orcamentos.length} ${res.orcamentos.length === 1 ? 'pedido novo' : 'pedidos novos'} em Orçamentos`].filter(Boolean);
      if (typeof toast === 'function') toast('Instagram: ' + partes.join(' · '));
      for (const o of res.orcamentos) yrConversaNoOrc(o).catch(() => {});
    }
  }
  yrRedesenha();
}

const yrNaCaixa = () => location.hash.startsWith('#/adm/inbox') && !(typeof ibAba !== 'undefined' && ibAba === 'ensinar');
function yrRedesenha() {
  try {
    if (yrNaCaixa()) { yrTela(); return; }
    if (location.hash.startsWith('#/adm/clients/')) yrFichaPoe();
  } catch (e) {}
}
const yrQuandoTxt = (q) => {
  const d = new Date(q); if (!q || isNaN(d)) return '';
  const hoje = new Date(); const mesmoDia = d.toDateString() === hoje.toDateString();
  return mesmoDia ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
};
const yrCor = (de) => { let h = 0; for (const ch of String(de)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 6; };
const yrAvatar = (p) => `<span class="ibAv" style="--av:${(typeof ibCores !== 'undefined' ? ibCores : ['#8a6d1f'])[yrCor(p.de) % (typeof ibCores !== 'undefined' ? ibCores.length : 1)]}">${esc((yrNome(p).replace(/^@/, '')[0] || '?').toUpperCase())}<i class="ibAvCanal ${p.canal === 'whatsapp' ? 'wa' : 'ig'}"></i></span>`;
const yrResponder = (p) => p.canal === 'whatsapp' ? (yrDigitos(p.de).length >= 8 ? 'https://wa.me/' + yrDigitos(p.de) : '') : (p.usuario ? 'https://ig.me/m/' + encodeURIComponent(p.usuario) : '');
const yrFio = (h) => !h || h.carregando ? '<p class="ibSis">Carregando a conversa…</p>'
  : h.erro ? `<p class="ibSis">${esc(h.erro)}</p>`
  : h.mensagens.length ? h.mensagens.map(m => `<div class="ibMsg ${m.deQuem === 'nos' ? 'minha' : 'dele'}">${esc(m.texto)}</div><p class="ibSis ${m.deQuem === 'nos' ? 'dir' : ''}">${m.deQuem === 'nos' ? 'Yalla · ' : ''}${esc(yrQuandoTxt(m.quando))}</p>`).join('')
  : '<p class="ibSis">Sem mensagens para mostrar.</p>';
const yrRecadoHtml = (r) => `<div class="yrRec"><b>Pedido anotado pelo robô</b>${r.assunto ? `<p>${esc(r.assunto)}</p>` : ''}
  <dl>${[['Quando', r.quando_quer || (r.dia ? (typeof opCurta === 'function' ? opCurta(r.dia) : r.dia) : '')], ['WhatsApp', r.contato], ['E-mail', r.email], ['Resumo', r.resumo]].filter(x => x[1]).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl></div>`;

/* ---------- Conversas: a caixa de verdade ---------- */
function yrTela(arg) {
  if (arg) yrAberta = decodeURIComponent(arg);
  const cx = yrCaixa, ps = yrPessoas(cx), aberta = ps.find(p => p.de === yrAberta) || null;
  const conta = (cx && cx.conta) || (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.agenteInstagram) || 'dubaitourbymilla';
  let aviso = '';
  if (!cx && (yrCarregando || !yrErro)) aviso = '<p class="yrAviso">Carregando as conversas do Instagram…</p>';
  else if (yrErro) aviso = `<p class="yrAviso erro">${esc(yrErro)} <button type="button" class="linkbtn" id="yrDeNovo">tentar de novo</button></p>`;
  else if (cx && !cx.conectado) aviso = `<section class="card yrAvisoCard"><b>O Instagram @${esc(conta)} ainda não está ligado ao robô.</b><p>Quando estiver, as conversas que o robô atender aparecem aqui, e cada pessoa vira cliente no CRM.</p></section>`;
  else if (cx && cx.erro_caixa) aviso = `<p class="yrAviso erro">${esc(cx.erro_caixa)}</p>`;
  const lista = ps.map(p => { const c = yrClienteDe(p); return `<button type="button" class="ibItem ${aberta && p.de === aberta.de ? 'on' : ''}" data-yrconv="${esc(p.de)}">
      ${yrAvatar(p)}<span class="ibItemTxt"><span class="ibItemTopo"><b>${esc(yrNome(p))}</b>${p.recados.length ? '<small class="yrTag">pedido</small>' : ''}</span>
      <span class="ibPrev">${p.deQuem === 'nos' ? 'Yalla: ' : ''}${esc(p.texto || '')}</span><span class="ibEstado">${esc(yrQuandoTxt(p.quando))}${c ? ' · no CRM' : ''}</span></span></button>`; }).join('')
    || `<p class="ibVazio">${cx ? 'Nenhuma conversa ainda.' : ''}</p>`;
  let detalhe = `<div class="ibNada"><span aria-hidden="true">💬</span><p>Escolha uma conversa</p></div>`;
  if (aberta) {
    const c = yrClienteDe(aberta), resp = yrResponder(aberta);
    const orcs = Orc.all().filter(o => o.igId === aberta.de || (aberta.recados || []).some(r => r.id && r.id === o.recadoId));
    detalhe = `<div class="ibConv">
      <header class="ibTopo"><button type="button" class="ibVolta" data-yrvolta aria-label="Voltar às conversas">←</button>${yrAvatar(aberta)}
        <div><b>${esc(yrNome(aberta))}</b><small>${aberta.canal === 'whatsapp' ? 'WhatsApp' : 'Instagram'}${aberta.usuario ? ' · @' + esc(aberta.usuario) : ''}</small></div></header>
      <div class="yrAcoes">${c ? `<a class="mini strong" href="#/adm/clients/${encodeURIComponent('c:' + c.id)}">ficha</a>` : ''}${orcs.map(o => `<a class="mini" href="#/adm/consulta/${esc(o.id)}">orçamento ${esc(o.num)}</a>`).join('')}${resp ? `<a class="mini" href="${esc(resp)}" target="_blank" rel="noopener">responder no ${aberta.canal === 'whatsapp' ? 'WhatsApp' : 'Instagram'}</a>` : ''}</div>
      ${(aberta.recados || []).map(yrRecadoHtml).join('')}
      <div class="ibFio" id="yrFio">${yrFio(yrHist[aberta.de])}</div></div>`;
  }
  admShell('inbox', `${ibCabecalho('conversas')}
    ${aviso}
    <div class="yrBarra"><button type="button" class="mini" id="yrAtualiza" ${yrCarregando ? 'disabled' : ''}>${yrCarregando ? 'carregando…' : '↻ atualizar conversas'}</button></div>
    <div class="ibApp ${aberta ? 'comConversa' : ''}">
      <aside class="ibLista"><div class="ibItens">${lista}</div></aside>
      <section class="ibDetalhe">${detalhe}</section></div>
    <p class="ibRodape">As conversas vêm do Instagram @${esc(conta)}. Cada pessoa vira cliente (Clientes), e cada pedido que o robô anota vira orçamento em Orçamentos › Em aberto.</p>`);
  if (typeof ligaAbasIb === 'function') ligaAbasIb();
  $$('[data-yrconv]').forEach(b => b.onclick = () => { yrAberta = b.dataset.yrconv; yrTela(); yrCarregaHist(yrAberta); });
  $$('[data-yrvolta]').forEach(b => b.onclick = () => { yrAberta = null; yrTela(); });
  const at = $('#yrAtualiza'); if (at) at.onclick = () => { yrSincroniza(true); if (yrAberta) yrCarregaHist(yrAberta, true); };
  const dn = $('#yrDeNovo'); if (dn) dn.onclick = () => yrSincroniza(true);
  const fio = $('#yrFio'); if (fio) fio.scrollTop = fio.scrollHeight;
  if (typeof ylAtendPoe === 'function') ylAtendPoe();
  if (!yrCaixa && !yrCarregando && !yrErro) yrSincroniza(true);
  if (aberta && !yrHist[aberta.de]) yrCarregaHist(aberta.de);
}

/* ---------- a ficha do cliente: a conversa do Instagram ---------- */
function yrFichaPoe() {
  const m = /^#\/adm\/clients\/(.+)$/.exec(location.hash); if (!m) return;
  const c = typeof cadastroDaRota === 'function' ? cadastroDaRota(m[1]) : null;
  const velho = document.getElementById('yrFicha');
  if (!c || !c.igId || !yrLigado()) { if (velho) velho.remove(); return; }
  const p = yrPessoas(yrCaixa).find(x => x.de === c.igId) || { de: c.igId, canal: c.igCanal || 'instagram', usuario: c.igUsuario || yrUsuario(c.insta), recados: [] };
  const resp = yrResponder(p), h = yrHist[c.igId];
  const html = `<section class="card yrFicha" id="yrFicha"><div class="yrFichaTopo"><h3>Conversa no ${p.canal === 'whatsapp' ? 'WhatsApp' : 'Instagram'}${p.usuario ? ' · @' + esc(p.usuario) : ''}</h3>
      <div class="yrAcoes"><a class="mini" href="#/adm/inbox/${encodeURIComponent(c.igId)}">ver em Conversas</a>${resp ? `<a class="mini" href="${esc(resp)}" target="_blank" rel="noopener">responder</a>` : ''}</div></div>
    ${(p.recados || []).map(yrRecadoHtml).join('')}
    <div class="ibFio yrFichaFio">${yrFio(h)}</div></section>`;
  if (velho) velho.outerHTML = html;
  else {
    const ref = document.getElementById('fcViagem') || document.querySelector('#stage .fc-top'); if (!ref) return;
    ref.insertAdjacentHTML('afterend', html);
  }
  const f = document.querySelector('#yrFicha .yrFichaFio'); if (f) f.scrollTop = f.scrollHeight;
  if (!h) yrCarregaHist(c.igId);
}

/* ---------- ligar ---------- */
if (typeof admAtendimento === 'function') {
  const _yrAtend = admAtendimento;
  admAtendimento = function (arg) {
    /* a caixa de verdade só para a dona logada; a aba "Ensinar o agente" segue como era */
    if (!yrLigado() || (typeof ibAba !== 'undefined' && ibAba === 'ensinar' && !arg)) return _yrAtend.apply(this, arguments);
    if (arg && typeof ibAba !== 'undefined') ibAba = 'conversas';   /* veio da ficha ("ver em Conversas") */
    return yrTela(arg);
  };
}
if (typeof admFicha === 'function') {
  const _yrFicha = admFicha;
  admFicha = function () { const r = _yrFicha.apply(this, arguments); try { yrFichaPoe(); } catch (e) {} return r; };
}
if (typeof admShell === 'function') {
  const _yrShell = admShell;
  admShell = function () { const r = _yrShell.apply(this, arguments); try { if (!yrNaCaixa()) setTimeout(() => yrSincroniza(false), 1500); } catch (e) {} return r; };
}
(function () {
  if (typeof document === 'undefined' || document.getElementById('yrCss')) return;
  const st = document.createElement('style'); st.id = 'yrCss';
  st.textContent = `.yrAviso{margin:10px 0;color:var(--ink-2,#555);font-size:14px}.yrAviso.erro{color:var(--danger,#b3261e);font-weight:600}
.yrAvisoCard{margin:12px 0}.yrAvisoCard p{margin:4px 0 0;color:var(--ink-2,#555);font-size:14px}
.yrBarra{display:flex;justify-content:flex-end;margin:8px 0}
.yrTag{font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--accent,#8a6d1f);background:var(--surface-2,#f3efe6);padding:2px 7px;border-radius:999px}
.yrAcoes{display:flex;flex-wrap:wrap;gap:6px;padding:10px 16px}.yrAcoes .mini{min-height:36px;display:inline-flex;align-items:center}
.yrRec{margin:0 16px 10px;padding:10px 12px;border:1px solid var(--line,#e5dfd2);border-radius:12px;background:var(--surface,#fff);font-size:14px}
.yrRec p{margin:4px 0}.yrRec dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:6px 0 0}.yrRec dt{color:var(--ink-3,#777);font-size:12.5px}.yrRec dd{margin:0}
.yrFicha .yrFichaTopo{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:8px}.yrFicha .yrAcoes{padding:0}
.yrFicha .yrRec{margin:8px 0}.yrFichaFio{max-height:360px;border-radius:12px;margin-top:8px}`;
  document.head.appendChild(st);
})();
