/* =====================================================
   O LINK DO GUIA — a página que cada guia parceiro abre no celular

   Pedido da reunião de 24/09/2026: os guias da Milla são freelancers e o
   pedido em Dubai vem de última hora. Cada guia (ou motorista) da Equipe
   ganha um link só dele, sem senha e sem instalar nada, onde:
     1. marca os dias e turnos em que está livre (vai para a mesma agenda
        que ela vê na aba Guias — Disp);
     2. vê os serviços que caíram para ele, com o cliente, o ponto de
        encontro, o transfer e o contato do cliente a um toque.

   Quando ela escala o guia num serviço, aquele turno fica OCUPADO sozinho
   (Disp.estado lê as reservas) — ninguém precisa marcar nada.

   Sem nuvem (protótipo), o link funciona no aparelho dela; com o banco
   ligado, cada guia abre o dele de qualquer celular.

   Carrega DEPOIS de app.js e operacao-telas.js.
   ===================================================== */
'use strict';

const GL_TXT = {
  ola:      { pt: 'Oi, {nome}!', en: 'Hi {nome}!', es: '¡Hola, {nome}!' },
  txt:      { pt: 'Toque no dia e marque os turnos em que você está livre. A {guia} vê na hora e te chama quando aparecer um serviço.',
              en: 'Tap a day and mark the shifts you are free. {guia} sees it right away and calls you when a job comes in.',
              es: 'Toca el día y marca los turnos en que estás libre. {guia} lo ve al instante y te llama cuando surja un servicio.' },
  livre:    { pt: 'livre', en: 'free', es: 'libre' },
  ocupado:  { pt: 'ocupado', en: 'busy', es: 'ocupado' },
  servico:  { pt: 'serviço', en: 'job', es: 'servicio' },
  diaTodo:  { pt: 'Livre o dia todo', en: 'Free all day', es: 'Libre todo el día' },
  limpar:   { pt: 'Limpar o dia', en: 'Clear the day', es: 'Borrar el día' },
  salvo:    { pt: 'Salvo ✓', en: 'Saved ✓', es: 'Guardado ✓' },
  seus:     { pt: 'Seus serviços', en: 'Your jobs', es: 'Tus servicios' },
  nenhum:   { pt: 'Nada confirmado ainda.', en: 'Nothing confirmed yet.', es: 'Nada confirmado aún.' },
  cliente:  { pt: 'Cliente', en: 'Guest', es: 'Cliente' },
  semCont:  { pt: 'sem contato cadastrado', en: 'no contact on file', es: 'sin contacto registrado' },
  pessoas:  { pt: 'pessoas', en: 'people', es: 'personas' },
  voo:      { pt: 'Voo', en: 'Flight', es: 'Vuelo' },
  de:       { pt: 'Buscar em', en: 'Pick-up', es: 'Recoger en' },
  para:     { pt: 'Levar para', en: 'Drop-off', es: 'Llevar a' },
  noDia:    { pt: 'Recebe do cliente no dia', en: 'Collect from the guest on the day', es: 'Cobra al cliente el día' },
  obs:      { pt: 'Observação', en: 'Note', es: 'Nota' },
  grupo:    { pt: 'Quem vai', en: 'Who is going', es: 'Quién va' },
  demo:     { pt: 'Protótipo: o link funciona neste aparelho. Com o banco ligado, cada guia abre o dele de qualquer celular.',
              en: 'Prototype: the link works on this device. With the database on, each guide opens theirs from any phone.',
              es: 'Prototipo: el enlace funciona en este dispositivo. Con la base de datos activa, cada guía abre el suyo desde cualquier celular.' },
  semanas:  { pt: ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], es: ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'] },
  turnos:   { pt: { manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' }, en: { manha: 'Morning', tarde: 'Afternoon', noite: 'Evening' }, es: { manha: 'Mañana', tarde: 'Tarde', noite: 'Noche' } },
  /* para ela, no painel */
  link:     { pt: '🔗 link', en: '🔗 link' },
  linkOk:   { pt: 'Link copiado — mande para {nome} no WhatsApp', en: 'Link copied — send it to {nome} on WhatsApp' },
  msgLink:  { pt: 'Oi, {nome}! Este é o seu link da {negocio}. Abra no celular e marque os dias e turnos em que você está livre — eu vejo aqui na hora. Os serviços que forem seus aparecem lá também: {link}',
              en: 'Hi {nome}! This is your {negocio} link. Open it on your phone and mark the days and shifts you are free — I see it here right away. Your jobs show up there too: {link}' },
};
function glt(k, v) {
  const e = GL_TXT[k]; let s = e ? (e[LANG] ?? (LANG !== 'pt' ? e.en : undefined) ?? e.pt) : k;
  if (typeof s !== 'string') return s;
  if (v) for (const x in v) s = s.split('{' + x + '}').join(v[x]);
  return s.split('{guia}').join(guiaNome()).split('{negocio}').join(guiaNegocio());
}
const glLink = (p) => location.origin + location.pathname + '#/guia/' + encodeURIComponent(p.id);

/* os serviços dele, de hoje em diante */
function glServicos(pid) {
  const hoje = isoToday();
  return DB.bookings.filter(b => b.prestadorId === pid && b.status !== 'cancelled' && b.date >= hoje)
    .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
}

let glMes = null, glDia = null;
function viewGuiaLink(id) {
  const p = Equipe.get(decodeURIComponent(id || ''));
  if (!p) return go('/');
  const hoje = isoToday();
  const mes = glMes || hoje.slice(0, 7);
  const [ano, m] = mes.split('-').map(Number);
  const primeiro = new Date(ano, m - 1, 1), dias = new Date(ano, m, 0).getDate();
  const vazios = (primeiro.getDay() + 6) % 7;   /* a semana começa na segunda */
  const nomeMes = primeiro.toLocaleDateString(locale(), { month: 'long', year: 'numeric' });
  const ant = m === 1 ? `${ano - 1}-12` : `${ano}-${String(m - 1).padStart(2, '0')}`;
  const prox = m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, '0')}`;
  const TS = TURNOS.map(x => x[0]);
  /* o resumo do dia: livre / parte / ocupado / nada */
  const resumo = (iso) => {
    const es = TS.map(tu => Disp.estado(p.id, iso, tu));
    if (es.some(e => e.servico)) return 'servico';
    if (es.every(e => e.estado === 'livre')) return 'livre';
    if (es.some(e => e.estado === 'livre')) return 'parte';
    if (es.some(e => e.estado === 'ocupada')) return 'ocupado';
    return '';
  };
  const sel = glDia && glDia.slice(0, 7) === mes ? glDia : '';
  const ps = glServicos(p.id);
  const T = glt('turnos');

  const cartao = (b) => {
    const x = Tours.get(b.tourId) || {};
    const nome = (typeof opNomeServ === 'function') ? opNomeServ(b) : (x.name ? tl(x.name) : '');
    const wa = String(b.whats || '').replace(/\D/g, '');
    const ig = String(b.insta || '').replace(/^@/, '').trim();
    const pt = (typeof pontoDoServico === 'function') ? pontoDoServico(b) : null;
    const nd = (typeof Op !== 'undefined') ? Op.noDia(b) : { valor: 0 };
    const contatos = [
      wa ? `<a class="gpBtn wa" href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>` : '',
      ig ? `<a class="gpBtn ig" href="https://instagram.com/${encodeURIComponent(ig)}" target="_blank" rel="noopener">@${esc(ig)}</a>` : '',
      b.email ? `<a class="gpBtn em" href="mailto:${esc(b.email)}">E-mail</a>` : '',
    ].filter(Boolean).join('');
    const linha = (ico, txt) => txt ? `<div class="gpMeta">${ico} ${txt}</div>` : '';
    return `<div class="gpCard">
      <div class="gpCardTop"><b>${esc(nome)}</b>${(x.type === 'transfer') ? '<span class="gpTag">Transfer</span>' : ''}</div>
      ${linha('📅', `${esc(fmtDate(b.date))} · ${esc(b.time || '')} · 👥 ${b.pax} ${glt('pessoas')}`)}
      ${pt ? linha('📍', esc(pt.nome) + (pt.endereco ? ' — ' + esc(pt.endereco) : '')) : (x.meeting ? linha('📍', esc(tl(x.meeting) || x.meeting)) : '')}
      ${b.voo ? linha('✈️', `${glt('voo')}: ${esc(b.voo)}`) : ''}
      ${b.origem ? linha('🚩', `${glt('de')}: ${esc(b.origem)}`) : ''}
      ${b.destino ? linha('🏁', `${glt('para')}: ${esc(b.destino)}`) : ''}
      ${nd.valor > 0 && nd.para === 'prestador' ? linha('💵', `${glt('noDia')}: <b>${eur(nd.valor)}</b>`) : ''}
      ${b.obsOp ? linha('📝', `${glt('obs')}: ${esc(b.obsOp)}`) : ''}
      <div class="gpCli">${glt('cliente')}: <b>${esc(b.name)}</b>${(b.group || []).length ? ` <small>· ${glt('grupo')}: ${(b.group || []).map(g => esc(g.nome)).join(', ')}</small>` : ''}</div>
      ${contatos ? `<div class="gpContatos">${contatos}</div>` : `<div class="gpMeta" style="opacity:.6">${glt('semCont')}</div>`}
    </div>`;
  };

  app.innerHTML = `
  <header class="topbar">
    <span class="tbrand">${logoMark(24, 'var(--brand-assinatura)')}<b>${esc(guiaNegocio())}</b></span>
    ${langBar('right')}
  </header>
  <main class="wrap gp">
    <h1 class="pageh">${glt('ola', { nome: esc(p.nome.split(' ')[0]) })}</h1>
    <p class="desc lead">${glt('txt')}</p>

    <section class="card">
      <div class="gpNav"><button class="mini" data-glmes="${ant}" aria-label="‹">‹</button>
        <b>${esc(nomeMes[0].toUpperCase() + nomeMes.slice(1))}</b>
        <button class="mini" data-glmes="${prox}" aria-label="›">›</button></div>
      <div class="gpGrade">
        ${glt('semanas').map(d => `<span class="gpDia">${d}</span>`).join('')}
        ${Array.from({ length: vazios }, () => '<span></span>').join('')}
        ${Array.from({ length: dias }, (_, i) => {
          const iso = `${mes}-${String(i + 1).padStart(2, '0')}`;
          const passou = iso < hoje, r = passou ? '' : resumo(iso);
          return `<button class="gpCel ${r === 'livre' ? 'on' : ''} ${r === 'parte' ? 'parte' : ''} ${r === 'servico' ? 'gsvc' : ''} ${r === 'ocupado' ? 'gocup' : ''} ${iso === sel ? 'sel' : ''} ${passou ? 'off' : ''}" ${passou ? 'disabled' : ''} data-gldia="${iso}">${i + 1}</button>`;
        }).join('')}
      </div>
      <div class="gpLeg"><span><i class="gl-on"></i>${glt('livre')}</span><span><i class="gl-svc"></i>${glt('servico')}</span><span><i class="gl-ocup"></i>${glt('ocupado')}</span></div>
      ${sel ? `<div class="gpTurnos">
        <b>${esc(fmtDate(sel))}</b>
        <div class="chips">${TS.map(tu => {
          const e = Disp.estado(p.id, sel, tu);
          if (e.servico) return `<span class="chip on gsvc" title="${esc(typeof opNomeServ === 'function' ? opNomeServ(e.servico) : '')}">${T[tu]} · ${glt('servico')}</span>`;
          return `<button type="button" class="chip ${e.estado === 'livre' ? 'on' : ''} ${e.estado === 'ocupada' ? 'gocup' : ''}" data-glturno="${tu}">${T[tu]}${e.estado === 'livre' ? ' · ' + glt('livre') : e.estado === 'ocupada' ? ' · ' + glt('ocupado') : ''}</button>`;
        }).join('')}</div>
        <div class="btnrow"><button class="mini strong" id="glTodo">${glt('diaTodo')}</button><button class="mini" id="glLimpa">${glt('limpar')}</button></div>
      </div>` : ''}
      <p class="why" id="glMsg"></p>
    </section>

    <section class="card">
      <span class="seclabel">${glt('seus')}</span>
      ${ps.length ? ps.map(cartao).join('') : `<p class="why">${glt('nenhum')}</p>`}
    </section>
    ${(typeof temNuvem === 'function' && temNuvem()) ? '' : `<p class="why center">${glt('demo')}</p>`}
  </main>`;
  bindLang(app);
  if (typeof Coach !== 'undefined') Coach.hide();   /* o tutorial do cliente não é para o guia */
  const salvo = () => { const el = $('#glMsg'); if (el) { el.textContent = glt('salvo'); setTimeout(() => { el.textContent = ''; }, 1200); } };
  $$('[data-glmes]').forEach(b => b.onclick = () => { glMes = b.dataset.glmes; viewGuiaLink(id); });
  $$('[data-gldia]').forEach(b => b.onclick = () => { glDia = glDia === b.dataset.gldia ? null : b.dataset.gldia; viewGuiaLink(id); });
  /* um toque no turno: livre → ocupado → em branco */
  $$('[data-glturno]').forEach(b => b.onclick = () => {
    const tu = b.dataset.glturno, e = Disp.estado(p.id, sel, tu).estado;
    Disp.marca(p.id, sel, tu, e === '' ? 'livre' : e === 'livre' ? 'ocupada' : '', '');
    viewGuiaLink(id); salvo();
  });
  const todo = $('#glTodo'); if (todo) todo.onclick = () => { for (const tu of TS) if (!Disp.estado(p.id, sel, tu).servico) Disp.marca(p.id, sel, tu, 'livre', ''); viewGuiaLink(id); salvo(); };
  const limpa = $('#glLimpa'); if (limpa) limpa.onclick = () => { for (const tu of TS) if (!Disp.estado(p.id, sel, tu).servico) Disp.marca(p.id, sel, tu, '', ''); viewGuiaLink(id); salvo(); };
}

/* ---------- liga no app: a rota #/guia/<id> ---------- */
const _routeSemLinkGuia = route;
route = function () {
  const p = (location.hash.replace(/^#\/?/, '') || '').split('/');
  if (p[0] === 'guia' && p[1]) { document.body.classList.remove('em-adm'); return viewGuiaLink(p[1]); }
  return _routeSemLinkGuia();
};
/* o app.js já registrou o route antigo no hashchange e já desenhou a tela */
addEventListener('hashchange', () => { if (/^#\/guia\//.test(location.hash)) route(); });
if (/^#\/guia\//.test(location.hash)) route();
