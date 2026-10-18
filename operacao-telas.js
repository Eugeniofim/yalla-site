/* =====================================================
   OPERACAO — as telas (pedido de 28/09/2026)

   HOJE         a planilha dela, em cartoes: cliente, voo, quem faz,
                quanto paga no dia e para quem. Busca de emergencia.
   GUIAS        quem esta livre, por preferencia; perguntar pelo WhatsApp;
                escalar; a semana de cada guia.
   FICHA        tudo de um cliente num lugar so (#/adm/clients/<chave>).
   CONTABILIDADE  por conta, Brasil de um lado, Europa do outro; acertos.
   SOB CONSULTA   pedidos -> orcamento com termos -> reservas.
   VOUCHER / ORCAMENTO  paginas para imprimir (PDF) ou mandar no WhatsApp.
   MEU PEDIDO   (cliente) junta varios servicos num pedido so.

   Carrega ANTES do app.js: aqui so ha funcoes; elas usam $, esc, eur,
   admShell... na hora em que sao chamadas, quando o app.js ja rodou.
   ===================================================== */
'use strict';

/* frase em pt/en (e es, nas telas do cliente; sem es cai no ingles) */
/* o logo completo do brand kit nos documentos (orçamento, voucher), no
   papel claro; sem arquivo no config, o selo + o nome */
function docLogo() {
  const g = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.guia) || {};
  const f = g.logoCompletoEscuro || g.logoCompleto;
  return f ? `<img class="doc-logo" src="${esc(f)}" alt="${esc(guiaNegocio())}">` : logoFull({ mark: 34 });
}
const L = (pt, en, es) => (LANG === 'en' ? en : LANG === 'es' ? (es || en) : pt);
/* quem recebe o restante (conteudo.js): no dia, a quem faz (EmRoma) ou a ela */
const _restoNoDia = () => !(typeof CONTEUDO !== 'undefined' && CONTEUDO.restoNoDiaPadrao === false);
/* os pedidos aos parceiros (aba Parceiros) de um serviço, em etiquetas: ficha e cartão */
function pedForPills(b) {
  if (typeof PedidosFor === 'undefined') return '';
  return PedidosFor.daReserva(b).map(p => { const f = Fornecedores.get(p.fornecedorId), st = (PED_FOR_ST.find(x => x[0] === p.status) || [p.status, p.status])[1];
    return `<a class="pill ${p.status === 'confirmado' ? 'ok' : 'warn'}" href="#/adm/parceiros" title="${esc(f ? f.nome : 'parceiro')}">${fornTipo(p.tipo)[1]} ${esc(p.desc || fornTipo(p.tipo)[2])}${f ? ' · ' + esc(f.nome) : ''} · ${esc(st)}${p.ref ? ' · nº ' + esc(p.ref) : ''}</a>`; }).join(' ');
}
function restoTexto() { return _restoNoDia() ? 'é pago no dia, a quem faz cada serviço' : 'é pago a ' + guiaNegocio() + ' até a data combinada'; }
function restoRotulo() { return _restoNoDia() ? 'No dia, a quem faz cada serviço' : 'Restante, até a data combinada'; }
const OP_ICO = { transfer: '🚐', walk: '🏛️', day: '🚗', papal: '⛪', conexao: '🚢', trem: '🚆' };
function opNomeServ(b) { if (b.servicoTxt) return b.servicoTxt; const x = Tours.get(b.tourId); return x ? (x.name[LANG] || x.name.pt) : '?'; }
function opNum(n) { return String(n || '').replace(/\D/g, ''); }
function opCurta(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : ''; }
function opFicha(b) { return '#/adm/clients/' + encodeURIComponent(b.clienteId ? 'c:' + b.clienteId : chaveCliente(b)); }
function opPapel(b) {
  const x = Tours.get(b.tourId);
  return x && (x.priceMode === 'transfer' || x.type === 'transfer') ? 'motorista' : 'guia';
}
function opPrimeiro(n) { return String(n || '').split(' ')[0]; }
function opBaixa(nome, linhas) {
  const csv = linhas.map(l => l.map(v => String(v ?? '').replace(/;/g, ',').replace(/\n/g, ' ')).join(';')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nome; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
async function opCopia(txt) {
  try { await navigator.clipboard.writeText(txt); toast(L('Copiado', 'Copied')); }
  catch (e) { const ta = document.createElement('textarea'); ta.value = txt; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); toast(L('Copiado', 'Copied')); }
}
function opContaOpts(sel) {
  const g = (pais, rot) => {
    const cs = Contas.all().filter(c => c.pais === pais);
    return cs.length ? `<optgroup label="${rot}">${cs.map(c => `<option value="${esc(c.id)}" ${sel === c.id ? 'selected' : ''}>${esc(c.nome)}</option>`).join('')}</optgroup>` : '';
  };
  return g('brasil', ladoNome('brasil')) + g('europa', ladoNome('europa'))
    + `<optgroup label="Fora do seu caixa"><option value="${CONTA_PRESTADOR}" ${sel === CONTA_PRESTADOR ? 'selected' : ''}>Pago no dia direto ao guia/motorista</option></optgroup>`;
}

/* A mensagem para quem vai fazer o servico — "manda um WhatsApp aqui
   dentro mesmo pro motorista". Tudo que a guia precisa saber, sem ligar. */
function opMsgPrestador(b) {
  const nd = Op.noDia(b);
  const linhas = [
    `Oi ${opPrimeiro((Equipe.get(b.prestadorId) || {}).nome)}! Confirmando o serviço:`,
    `• ${opNomeServ(b)}`,
    `• ${fmtDate(b.date)} às ${b.time} · ${b.pax} ${b.pax > 1 ? 'pessoas' : 'pessoa'}${b.veiculo ? ' · ' + b.veiculo : ''}`,
    `• Cliente: ${b.name}${b.whats ? ' · ' + b.whats : ''}`,
  ];
  if (b.voo) linhas.push(`• Voo: ${b.voo}`);
  if (b.origem) linhas.push(`• Buscar em: ${b.origem}`);
  if (b.destino) linhas.push(`• Levar para: ${b.destino}`);
  if (nd.valor > 0 && nd.para === 'prestador') linhas.push(`• O cliente paga a você no dia: ${eur(nd.valor)}`);
  else linhas.push('• O cliente não paga nada no dia (já está tudo pago comigo).');
  if (b.obsOp) linhas.push(`• Obs.: ${b.obsOp}`);
  linhas.push('', 'Obrigada! ' + guiaNome());
  return linhas.join('\n');
}

/* =====================================================
   O CARTAO DE UM SERVICO — usado no Hoje, na ficha e na busca
===================================================== */
function opCardServico(b, o) {
  o = o || {};
  const x = Tours.get(b.tourId);
  const ico = (x && OP_ICO[x.type]) || '📌';
  const pres = b.prestadorId ? Equipe.get(b.prestadorId) : null;
  const papel = opPapel(b);
  const nd = Op.noDia(b);
  const pago = Bookings.paid(b);
  let din;
  if (b.status === 'cancelled') din = `<span class="pill n">${L('Cancelado', 'Cancelled')}</span>`;
  else if (nd.valor <= 0) din = `<span class="svc-din ok">✓ Tudo pago · ${eur(pago)}</span>`;
  else if (nd.para === 'prestador') din = `<span class="svc-din warn">💵 Paga no dia: <b>${eur(nd.valor)}</b> ${pres ? 'para ' + esc(opPrimeiro(pres.nome)) : (papel === 'motorista' ? 'ao motorista' : 'à guia')}
      <small>já pagou ${eur(pago)} de ${eur(b.total)}</small></span>`;
  else din = `<span class="svc-din bad">Falta pagar a você: <b>${eur(nd.valor)}</b>
      <small>já pagou ${eur(pago)} de ${eur(b.total)} · até ${fmtDate(Bookings.dueDate(b))}</small></span>`;

  const presLinha = pres
    ? `<span>👤 ${papel === 'motorista' ? 'Motorista' : 'Guia'}: <b>${esc(pres.nome)}</b>
        ${pres.whats ? `<a class="mini wa-mini" target="_blank" rel="noopener" href="${waLink(opMsgPrestador(b), opNum(pres.whats))}">💬 mandar o serviço</a>` : ''}
        <a class="mini" href="#/adm/servico/${esc(b.id)}" title="a ordem de serviço completa, para imprimir ou salvar em PDF">📄 PDF</a></span>`
    : (b.status !== 'cancelled' ? `<span class="svc-alerta">⚠ Sem ${papel} — <a href="#/adm/guias/servico:${esc(b.id)}">achar ${papel === 'motorista' ? 'motorista' : 'guia'}</a></span>` : '');
  const part = participantesDe(b);
  const grupo = `<span>👥 ${part.map(p => esc(opPrimeiro(p.nome)) + (idadeDe(p.nasc, b.date) != null && idadeDe(p.nasc, b.date) < 18 ? ` <small>(${idadeDe(p.nasc, b.date)})</small>` : '')).join(', ') || 'ninguém cadastrado'}${part.length < b.pax ? ` <span class="pill warn">faltam ${b.pax - part.length} nome(s)</span>` : ''}</span>`
    + (Op.precisaIngresso(b) && !PedidosFor.daReserva(b).some(p => p.tipo === 'ingressos') ? (b.ingressosOk ? ' <span class="pill ok">🎟 ingressos comprados</span>' : ' <span class="pill warn">🎟 comprar ingressos</span>') : '')
    + (PedidosFor.daReserva(b).length ? ' ' + pedForPills(b) : '')
    + ((b.links || []).length ? `<span>${b.links.map(l => `<a class="mini" target="_blank" rel="noopener" href="${esc(l.url)}">🔗 ${esc(l.nome)}</a>`).join(' ')}</span>` : '');
  const trajeto = (b.origem || b.destino) ? `<span>📍 ${esc(b.origem || '?')}${b.destino ? ' → ' + esc(b.destino) : ''}</span>` : '';
  const cliWa = b.whats ? `<a class="mini" target="_blank" rel="noopener" href="${waLink(t('waHi', { name: opPrimeiro(b.name), tour: opNomeServ(b), when: fmtDate(b.date) + ' ' + b.time }), opNum(b.whats))}">WhatsApp</a>` : '';

  return `<article class="svc ${b.status === 'cancelled' ? 'cancel' : ''}" id="svc-${esc(b.id)}">
    <div class="svc-hora"><b>${esc(b.time)}</b>${o.comData ? `<small>${opCurta(b.date)}</small>` : `<small>${turnoNome(turnoDaHora(b.time))}</small>`}</div>
    <div class="svc-corpo">
      <div class="svc-top">${ico} <b>${esc(opNomeServ(b))}</b> <small>· ${b.pax} ${b.pax > 1 ? 'pessoas' : 'pessoa'}${b.veiculo ? ' · ' + esc(b.veiculo) : ''} · <span class="mono">${esc(b.code)}</span></small></div>
      <div class="svc-cli"><a href="${opFicha(b)}">${esc(b.name)}</a> ${cliWa}${b.compradorVai === false ? ' <small class="why">(comprou, não vai)</small>' : ''}</div>
      <div class="svc-linhas">
        ${b.voo ? `<span>✈ ${esc(b.voo)}</span>` : ''}${trajeto}${grupo}
        ${presLinha}
        ${din}
        ${b.obsOp ? `<span class="svc-obs">📝 ${esc(b.obsOp)}</span>` : ''}
      </div>
      <div class="tacts">
        <a class="mini" href="${opFicha(b)}">Ficha</a>
        <a class="mini" href="#/adm/voucher/${esc(b.id)}">Voucher</a>
        ${b.status !== 'cancelled' && Bookings.due(b) > 0 ? `<button class="mini strong" data-abre="pg-${esc(b.id)}">Registrar pagamento</button>` : ''}
        <button class="mini" data-abre="dt-${esc(b.id)}">Detalhes</button>
      </div>
      ${opFormPagamento(b)}
      ${opFormDetalhes(b)}
    </div>
  </article>`;
}
function opFormPagamento(b) {
  const due = Bookings.due(b);
  if (b.status === 'cancelled' || due <= 0) return '';
  const sug = (!Bookings.paid(b) && b.sinal) ? Math.min(b.sinal, due) : due;
  return `<div class="svc-form" id="pg-${esc(b.id)}" hidden>
    <div class="frow">
      <label class="fld">Valor recebido<input type="number" min="0" step="0.01" id="pgv-${esc(b.id)}" value="${sug}"></label>
      <label class="fld">Onde caiu<select id="pgc-${esc(b.id)}">${opContaOpts(Op.restoPara(b) === 'prestador' && Bookings.paid(b) > 0 ? CONTA_PRESTADOR : 'nubank')}</select></label>
      <label class="fld">Data<input type="date" id="pgd-${esc(b.id)}" value="${isoToday()}"></label>
    </div>
    <div class="frow">
      <label class="fld">Comprovante (link do arquivo)<input id="pgk-${esc(b.id)}" placeholder="https://drive.google.com/…"></label>
      <label class="fld sm">Em R$ (se foi Pix)<input type="number" min="0" step="0.01" id="pgr-${esc(b.id)}" placeholder="0"></label>
    </div>
    <p class="why">Falta ${eur(due)}. A conta decide para qual contador vai (${esc(ladoNome('brasil'))} ou ${esc(ladoNome('europa'))}). "Pago direto ao guia/motorista" não entra no seu caixa.</p>
    <button class="cta sm" data-pgok="${esc(b.id)}">Registrar</button>
  </div>`;
}
function opFormDetalhes(b) {
  const opts = (tipo) => Equipe.all(tipo).map(p => `<option value="${esc(p.id)}" ${b.prestadorId === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('');
  return `<div class="svc-form" id="dt-${esc(b.id)}" hidden>
    <div class="frow">
      <label class="fld">Voo<input id="dtv-${esc(b.id)}" value="${esc(b.voo || '')}" placeholder="EK 262 · chega 14:40"></label>
      <label class="fld">Buscar em / encontro<input id="dto-${esc(b.id)}" value="${esc(b.origem || '')}" placeholder="DXB Terminal 3"></label>
      <label class="fld">Levar para<input id="dtd-${esc(b.id)}" value="${esc(b.destino || '')}" placeholder="Hotel, endereço"></label>
    </div>
    <div class="frow">
      <label class="fld">Quem faz<select id="dtp-${esc(b.id)}"><option value="">— ninguém ainda —</option>
        <optgroup label="Guias">${opts('guia')}</optgroup><optgroup label="Motoristas">${opts('motorista')}</optgroup></select></label>
      <label class="fld">Você paga a quem faz (${moedaSigla()})<input type="number" min="0" id="dtc-${esc(b.id)}" value="${+b.custo || ''}" placeholder="0"></label>
      <label class="fld">O resto é pago<select id="dtr-${esc(b.id)}">
        <option value="" ${!b.restoPara ? 'selected' : ''}>automático (${Op.restoPara(Object.assign({}, b, { restoPara: '' })) === 'prestador' ? 'no dia, a quem faz' : 'a você'})</option>
        <option value="prestador" ${b.restoPara === 'prestador' ? 'selected' : ''}>no dia, a quem faz o serviço</option>
        <option value="ingrid" ${b.restoPara === 'ingrid' ? 'selected' : ''}>a você (você acerta com quem faz)</option></select></label>
    </div>
    ${Pontos.doPasseio(b.tourId).length ? `<label class="fld">Ponto de encontro (sai no voucher)<select id="dtpt-${esc(b.id)}">${Pontos.doPasseio(b.tourId).map(p => `<option value="${esc(p.id)}" ${(pontoDoServico(b) || {}).id === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>` : ''}
    <label class="fld">Observação da operação<textarea id="dtn-${esc(b.id)}" rows="2">${esc(b.obsOp || '')}</textarea></label>
    <button class="cta sm" data-dtok="${esc(b.id)}">Salvar</button>
    ${opPartHtml(b)}
    ${opLinksHtml(b)}
  </div>`;
}
/* QUEM VAI (os ingressos sao nominais): nome e nascimento de cada um */
function opPartHtml(b) {
  const part = participantesDe(b), idades = part.map(p => idadeDe(p.nasc, b.date));
  const adultos = idades.filter(a => a == null || a >= 18).length, menores = idades.filter(a => a != null && a < 18);
  return `<div class="op-part"><span class="op-lbl">Quem vai · ${part.length} de ${b.pax}${menores.length ? ` · ${adultos} adulto(s) e ${menores.length} menor(es): ${menores.join(', ')} anos no dia` : ''}</span>
    <label class="optin"><input type="checkbox" id="ptVai-${esc(b.id)}" ${b.compradorVai !== false ? 'checked' : ''}><span><b>${esc(b.name)} (quem comprou) também vai</b></span></label>
    <div id="ptRows-${esc(b.id)}">
      <div class="grow pt-comprador" ${b.compradorVai !== false ? '' : 'hidden'}><input value="${esc(b.name)}" disabled><input class="gnasc" id="ptNasc-${esc(b.id)}" value="${esc(b.nasc || '')}" placeholder="dd/mm/aaaa"></div>
      ${(b.group || []).map(g => `<div class="grow"><input class="gnome" value="${esc(g.nome)}" placeholder="Nome e sobrenome"><input class="gnasc" value="${esc(g.nasc || '')}" placeholder="dd/mm/aaaa"></div>`).join('')}
    </div>
    <div class="btnrow"><button class="mini" data-ptadd="${esc(b.id)}">+ pessoa</button><button class="mini strong" data-ptok="${esc(b.id)}">Salvar quem vai</button>
      ${Op.precisaIngresso(b) ? `<label class="optin tf-ing"><input type="checkbox" data-ingok="${esc(b.id)}" ${b.ingressosOk ? 'checked' : ''}><span><b>🎟 Ingressos comprados</b></span></label>` : ''}</div></div>`;
}
/* os links do servico: PDF do ingresso, QR code, voucher do parceiro */
function opLinksHtml(b) {
  return `<div class="op-links"><span class="op-lbl">Ingressos, QR codes e links</span>
    ${(b.links || []).map(l => `<div class="deprow"><a target="_blank" rel="noopener" href="${esc(l.url)}">🔗 ${esc(l.nome)}</a><button class="mini ghost danger" data-lkrm="${esc(b.id)}|${esc(l.id)}" aria-label="tirar">✕</button></div>`).join('') || '<p class="why">Nenhum link ainda. Guarde o PDF no Drive e cole o link aqui.</p>'}
    <div class="frow"><label class="fld grow"><input id="lkN-${esc(b.id)}" placeholder="nome (ex.: Ingresso do museu — PDF)"></label><label class="fld grow"><input id="lkU-${esc(b.id)}" placeholder="https://drive.google.com/…"></label><button class="mini strong" data-lkadd="${esc(b.id)}">+ link</button></div></div>`;
}
function opLigaCards(redesenha) {
  $$('[data-ptadd]').forEach(bt => bt.onclick = () => { const box = document.getElementById('ptRows-' + bt.dataset.ptadd); box.insertAdjacentHTML('beforeend', grupoLinha()); mascaraNasc(box.lastElementChild.querySelector('.gnasc')); });
  $$('[id^="ptRows-"] .gnasc').forEach(el => { if (!el.dataset.m) { el.dataset.m = 1; mascaraNasc(el); } });
  $$('[id^="ptVai-"]').forEach(ck => ck.onchange = () => { const r = document.querySelector('#ptRows-' + ck.id.slice(6) + ' .pt-comprador'); if (r) r.hidden = !ck.checked; });
  $$('[data-ptok]').forEach(bt => bt.onclick = () => {
    const id = bt.dataset.ptok, b = Bookings.get(id), box = document.getElementById('ptRows-' + id);
    const grupo = [...box.querySelectorAll('.grow:not(.pt-comprador)')].map(r => ({ nome: r.querySelector('.gnome').value.trim(), nasc: r.querySelector('.gnasc').value.trim() })).filter(g => g.nome);
    const ruim = grupo.find(g => g.nasc && !nascOk(g.nasc)); if (ruim) return toast(`Nascimento de ${ruim.nome}: dd/mm/aaaa`);
    const nasc = ($('#ptNasc-' + id) || {}).value || '';
    if (nasc && !nascOk(nasc)) return toast('Nascimento de quem comprou: dd/mm/aaaa');
    const antes = b.group || [];
    b.group = grupo.map(g => ({ ...g, clienteId: (antes.find(a => _nomeN(a.nome) === _nomeN(g.nome)) || {}).clienteId || '' }));
    b.compradorVai = document.getElementById('ptVai-' + id).checked; b.nasc = nasc;
    cadastroDaReserva(b); _opSaveBooking(b);
    toast(`Salvo: ${participantesDe(b).length} de ${b.pax} pessoa(s)`); redesenha();
  });
  $$('[data-ingok]').forEach(ck => ck.onchange = () => { Op.ingressosOk(ck.dataset.ingok, ck.checked); toast(ck.checked ? '🎟 Ingressos comprados' : 'Ingressos: a comprar'); redesenha(); });
  $$('[data-lkadd]').forEach(bt => bt.onclick = () => { const id = bt.dataset.lkadd; const r = Op.linkAdd(id, $('#lkN-' + id).value, $('#lkU-' + id).value); if (r && r.erro) return toast(r.erro); toast('Link guardado'); redesenha(); });
  $$('[data-lkrm]').forEach(bt => bt.onclick = () => { const [id, lid] = bt.dataset.lkrm.split('|'); Op.linkRemove(id, lid); redesenha(); });
  $$('[data-abre]').forEach(btn => btn.onclick = () => {
    const el = document.getElementById(btn.dataset.abre);
    if (el) { el.hidden = !el.hidden; if (!el.hidden) { const i = el.querySelector('input,select'); if (i) i.focus(); } }
  });
  $$('[data-pgok]').forEach(btn => btn.onclick = () => {
    const id = btn.dataset.pgok;
    const kurl = ($('#pgk-' + id) || {}).value || '';
    if (kurl && !/^https?:\/\//i.test(kurl.trim())) return toast('O comprovante precisa ser um link (https://…).');
    const p = registraPagamento(id, { valor: +$('#pgv-' + id).value, conta: $('#pgc-' + id).value, data: $('#pgd-' + id).value });
    if (!p) return toast('Valor inválido (maior que zero e até o que falta).');
    if (kurl.trim()) p.comprovante = kurl.trim();
    if (+(($('#pgr-' + id) || {}).value) > 0) p.reais = +$('#pgr-' + id).value;
    _opSaveBooking(Bookings.get(id));
    toast(`${eur(p.amount)} registrado · ${Contas.nome(p.conta)}`);
    redesenha();
  });
  $$('[data-dtok]').forEach(btn => btn.onclick = () => {
    const id = btn.dataset.dtok;
    Op.detalhes(id, { voo: $('#dtv-' + id).value, origem: $('#dto-' + id).value, destino: $('#dtd-' + id).value,
      prestadorId: $('#dtp-' + id).value, custo: $('#dtc-' + id).value, restoPara: $('#dtr-' + id).value, obsOp: $('#dtn-' + id).value });
    if ($('#dtpt-' + id)) escolhePonto(id, $('#dtpt-' + id).value);
    toast('Salvo');
    redesenha();
  });
}

/* =====================================================
   HOJE COMO NO PROTÓTIPO DA BIA (16/10/2026)
   Pedido do Eugênio: "atualiza o HOJE dela como temos no protótipo BIA
   Londres" (guia.eugeniofim.com/londres/ → carol-adm.js + boas-vindas.js).
   O dia de hoje vira "o que precisa de você agora", em blocos — e só
   aparece o bloco que tem alguma coisa. Os serviços completos (com guia,
   voo, pagamento) continuam embaixo, por turno: é a operação dela.
   Ícones de traço (sem emoji), como na capa.
   ===================================================== */
const HJ_IC = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const HJ = {
  sol:      HJ_IC('<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M4.6 4.6 6 6M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>'),
  pago:     HJ_IC('<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6.5 9.5h.01M17.5 14.5h.01"/>'),
  msg:      HJ_IC('<path d="M4 5h16v11H9l-5 4z"/><path d="M8 9.5h8M8 12.5h5"/>'),
  sino:     HJ_IC('<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/>'),
  sacola:   HJ_IC('<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
  pessoa:   HJ_IC('<circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/>'),
  cobrar:   HJ_IC('<circle cx="12" cy="12" r="8.5"/><path d="M12 6.8v10.4M14.7 9.6c-.4-1-1.4-1.6-2.7-1.6-1.5 0-2.6.8-2.6 2s1.1 1.6 2.6 2 2.6.8 2.6 2-1.1 2-2.6 2c-1.3 0-2.4-.6-2.8-1.6"/>'),
  estrela:  HJ_IC('<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>'),
  check:    HJ_IC('<rect x="4" y="4" width="16" height="16" rx="4"/><path d="m8.5 12.2 2.4 2.4 4.8-4.9"/>'),
  agenda:   HJ_IC('<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>'),
  roteiro:  HJ_IC('<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M8 18h6.5a3.5 3.5 0 0 0 0-7h-5a3.5 3.5 0 0 1 0-7H16"/>'),
  orc:      HJ_IC('<path d="M6 3h9l3 3v15H6z"/><path d="M9 9h6M9 13h6M9 17h3"/>'),
  alerta:   HJ_IC('<path d="M12 4 2.8 19.5h18.4z"/><path d="M12 10v4.5M12 17.2h.01"/>'),
};
const hjTurno = (h) => { const n = +String(h || '').slice(0, 2); return !String(h || '').trim() ? 'dia' : n < 12 ? 'manha' : n < 18 ? 'tarde' : 'noite'; };
const HJ_TURNOS = [['manha', 'Manhã'], ['tarde', 'Tarde'], ['noite', 'Noite'], ['dia', 'Sem hora marcada']];
const hjFicha = (b) => b.clienteId ? '#/adm/clients/' + encodeURIComponent('c:' + b.clienteId) : '#/adm/clients/' + encodeURIComponent(chaveCliente(b));
/* a mensagem de véspera, pronta para o WhatsApp do cliente */
function hjLembrete(b) {
  const x = Tours.get(b.tourId) || {};
  const pres = b.prestadorId && Equipe.get(b.prestadorId);
  const encontro = b.origem || (x.meeting ? (x.meeting[LANG] || x.meeting.pt || '') : '');
  const falta = Op.restoPara(b) === 'ingrid' ? Bookings.due(b) : 0;
  const L = [
    `Olá, ${opPrimeiro(b.name)}! Aqui é ${guiaNome()}, da ${guiaNegocio()}. Passando para lembrar do nosso compromisso de amanhã:`, '',
    `📍 ${opNomeServ(b)}`,
    `🗓 ${opCurta(b.date)}${b.time ? ' · ' + b.time : ''}`,
    encontro ? `🚩 Encontro: ${encontro}` : '',
    b.voo ? `✈ Voo: ${b.voo}` : '',
    pres ? `👤 ${opPapel(b) === 'motorista' ? 'Motorista' : 'Guia'}: ${pres.nome}` : '',
    falta > 0 ? `💳 Saldo a acertar: ${eur(falta)}` : '',
    '', 'Qualquer imprevisto, é só me chamar aqui. Até amanhã!',
  ];
  return L.filter((l, i, a) => l !== '' || (a[i - 1] !== '' && i > 0)).join('\n');
}
function hjPainel(hoje) {
  const ativas = DB.bookings.filter(b => b.status !== 'cancelled');
  const wa = (num, txt, rot, extra = '') => opNum(num).length >= 8 ? `<a class="mini" target="_blank" rel="noopener" ${extra} href="${waLink(txt, opNum(num))}">${rot}</a>` : '';
  const lnk = (href, rot, cls = 'mini') => `<a class="${cls}" href="${href}">${rot}</a>`;
  const it = (ic, tit, sub, acoes = '', cls = '') => `<div class="hjItem ${cls}"><span class="hjIc">${ic}</span><div class="hjTx"><b>${tit}</b>${sub ? `<small>${sub}</small>` : ''}</div>${acoes ? `<span class="hjAcoes">${acoes}</span>` : ''}</div>`;
  const bloco = (ic, tit, n, corpo, cls = '') => `<section class="card hj ${cls}"><h3><span class="hjH">${ic}</span><span class="hjT">${tit}</span>${n ? `<span class="hjN">${n}</span>` : ''}</h3>${corpo}</section>`;
  const B = [];

  /* 1. hoje, por turno (o resumo; os cartões completos ficam embaixo) */
  const doDia = Op.doDia(hoje).filter(b => b.status !== 'cancelled');
  const linhasHoje = HJ_TURNOS.map(([k, nome]) => {
    const l = doDia.filter(b => hjTurno(b.time) === k);
    if (!l.length) return '';
    return `<p class="rotMini">${nome}</p>` + l.map(b => {
      const pres = b.prestadorId && Equipe.get(b.prestadorId), falta = Op.restoPara(b) === 'ingrid' ? Bookings.due(b) : 0;
      return it(HJ.agenda, `${esc(b.time || '')}${b.time ? ' · ' : ''}${esc(opNomeServ(b))}`,
        `${esc(b.name)} · ${b.pax} ${+b.pax === 1 ? 'pessoa' : 'pessoas'} · ${pres ? esc(opPrimeiro(pres.nome)) : '<span class="bad">sem ' + opPapel(b) + '</span>'}${falta > 0 ? ` · <span class="bad">falta ${eur(falta)}</span>` : ''}`,
        `<button class="mini" data-hjvai="${esc(b.id)}">Abrir</button>`, pres ? 'cheio' : 'alerta');
    }).join('');
  }).join('');
  B.push(bloco(HJ.sol, 'Hoje', doDia.length ? `${doDia.length}` : '', linhasHoje || `<p class="empty">Nenhum serviço hoje.</p><p class="why">${lnk('#/adm/agenda', 'Ver a agenda')}</p>`, 'hjHoje'));

  /* 2. tarefas de hoje (as atrasadas primeiro) */
  const G = Tarefas.grupos(hoje), tfs = [...G.atrasadas, ...G.hoje];
  if (tfs.length) B.push(bloco(HJ.check, 'Tarefas de hoje', tfs.length, tfs.slice(0, 6).map(t => {
    const atr = G.atrasadas.includes(t);
    const acoes = t.etapa === 'aguardar'
      ? `<button class="mini" data-res="${esc(t.id)}|respondeu">Respondeu</button><button class="mini ghost" data-res="${esc(t.id)}|cutucar">Não respondeu</button>`
      : `<button class="mini" data-conclui="${esc(t.id)}">Feito</button>`;
    return it(atr ? HJ.alerta : HJ.check, esc(t.texto), [atr ? '<span class="bad">atrasada</span>' : '', t.hora ? esc(t.hora) : '', t.clienteNome ? esc(t.clienteNome) : ''].filter(Boolean).join(' · '), acoes, atr ? 'alerta' : '');
  }).join('') + (tfs.length > 6 ? `<p class="why">${lnk('#/adm/tarefas', `Ver as ${tfs.length} tarefas`)}</p>` : '')));

  /* 3. cobranças: atrasadas ou vencendo até depois de amanhã */
  const dev = Lembretes.devedores(hoje).filter(d => d.prazo <= addDays(hoje, 2));
  if (dev.length) B.push(bloco(HJ.cobrar, 'Cobranças', dev.length, dev.slice(0, 5).map(d => it(HJ.cobrar, `${esc(d.nome)} · ${eur(d.total)}`,
    `${d.atrasado ? '<span class="bad">venceu ' + opCurta(d.prazo) + '</span>' : 'vence ' + opCurta(d.prazo)} · ${esc(opNomeServ(d.servicos[0]))}`,
    wa(d.whats, t('waCharge', { name: opPrimeiro(d.nome), v: eur(d.total), tour: opNomeServ(d.servicos[0]), when: fmtDate(d.servicos[0].date) }), 'Cobrar', `data-cobra="${esc(d.chave)}"`) + lnk('#/adm/clients/' + encodeURIComponent(d.chave), 'Ficha'), d.atrasado ? 'alerta' : '')).join('')));

  /* 4. quem pagou (7 dias) — como o "Quem pagou" da Bia */
  const pagos = [];
  for (const b of ativas) for (const p of (b.payments || [])) if (p.date >= addDays(hoje, -7) && p.date <= hoje) pagos.push({ b, p });
  pagos.sort((x, y) => String(y.p.date).localeCompare(String(x.p.date)));
  if (pagos.length) B.push(bloco(HJ.pago, 'Quem pagou', pagos.length, pagos.slice(0, 5).map(({ b, p }) => it(HJ.pago, `${esc(b.name)} · ${eur(p.amount)}`,
    `${esc(opNomeServ(b))} · ${opCurta(b.date)} · ${esc(Contas.nome(p.conta) || ({ pix: 'Pix', card: 'cartão', cash: 'dinheiro', transfer: 'transferência' })[p.method] || 'outro')} · pago ${opCurta(p.date)}`, lnk(hjFicha(b), 'Ficha'))).join('')
    + '<p class="why">Cada pagamento já está na ficha do cliente e na Contabilidade.</p>'));

  /* 5. pedidos esperando resposta (orçamento, "Monte seu roteiro" e os recados do atendimento) */
  const orcs = Orc.all().filter(o => o.status === 'novo' || o.status === 'rascunho');
  const rots = Roteiros.all().filter(p => !p.respondido && !(DB.orcamentos || []).some(o => o.pedidoId === p.id));
  const recs = (typeof conversas === 'function' && typeof CLIENTES !== 'undefined') ? conversas().filter(v => v.estado === 'pendente').map(v => ({ v, c: CLIENTES.find(c => c.id === v.id) })).filter(x => x.c) : [];
  if (orcs.length || rots.length || recs.length) B.push(bloco(HJ.msg, 'Pedidos esperando resposta', orcs.length + rots.length + recs.length,
    recs.slice(0, 3).map(({ v, c }) => it(HJ.msg, `${esc(c.nome)} · ${c.canal === 'whats' ? 'WhatsApp' : 'Instagram'}`, esc(String(c.msg || '').slice(0, 90)), lnk('#/adm/inbox/' + v.id, 'Responder'))).join('') +
    orcs.slice(0, 4).map(o => it(HJ.orc, `${esc(o.cliente.nome || 'Cliente')} · ${esc(o.num)}`, `${o.status === 'novo' ? 'pedido novo' : 'em montagem'}${o.origem ? ' · veio pelo ' + esc(o.origem === 'whats' ? 'WhatsApp' : o.origem) : ''}${Orc.total(o) ? ' · ' + eur(Orc.total(o)) : ''}`,
      lnk('#/adm/consulta/' + o.id, 'Montar'))).join('')
    + rots.slice(0, 4).map(p => it(HJ.roteiro, `${esc(p.nome)} · Monte seu roteiro`, [p.ini ? opCurta(p.ini) + (p.fim ? ' a ' + opCurta(p.fim) : '') : '', `${(+p.adultos || 0) + (+p.criancas || 0)} pessoas`, p.canal && p.canal !== 'direto' ? 'veio pelo ' + esc(canalNome(p.canal)) : ''].filter(Boolean).join(' · '),
      wa(p.whats, `Olá, ${opPrimeiro(p.nome)}! Aqui é ${guiaNome()}, da ${guiaNegocio()}. Recebi o seu pedido de roteiro e já estou montando a sua proposta.`, 'Responder') + lnk('#/adm/consulta', 'Ver'))).join('')));

  /* 6. amanhã — lembrete de véspera, e os próximos 14 dias */
  const amanha = addDays(hoje, 1);
  const am = ativas.filter(b => b.date === amanha).sort((a, b) => String(a.time).localeCompare(String(b.time)));
  const prox = ativas.filter(b => b.date > amanha && b.date <= addDays(hoje, 14)).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  B.push(bloco(HJ.sino, 'Amanhã — lembrete de véspera', am.length || '',
    (am.length ? am.map(b => it(HJ.sino, `${esc(b.name)} · ${esc(opNomeServ(b))}`, `${esc(b.time || '')} · ${b.pax} ${+b.pax === 1 ? 'pessoa' : 'pessoas'}`,
      wa(b.whats, hjLembrete(b), 'Mandar lembrete') + lnk(hjFicha(b), 'Ficha'))).join('') : '<p class="empty">Nenhum serviço amanhã.</p>')
    + (prox.length ? `<p class="rotMini">Próximos dias</p>${prox.slice(0, 4).map(b => it(HJ.agenda, `${opCurta(b.date)} · ${esc(opPrimeiro(b.name))}`, `${esc(opNomeServ(b))}${b.time ? ' · ' + esc(b.time) : ''}`, lnk('#/adm/today/' + b.date, 'Ver o dia'))).join('')}` : '')
    + '<p class="why">A mensagem vem pronta: serviço, dia e hora, encontro, voo, quem faz e o saldo, se houver.</p>'));

  /* 7. compras e parceiros (ingressos, transfer, hotel) — próximos 14 dias */
  const compras = ativas.filter(b => b.date >= hoje && b.date <= addDays(hoje, 14)).map(b => ({ b, f: pendenciasCompra(b) })).filter(x => x.f.length);
  if (compras.length) B.push(bloco(HJ.sacola, 'Compras e parceiros', compras.length, compras.slice(0, 5).map(({ b, f }) =>
    it(HJ.sacola, `${esc(b.name)} · ${opCurta(b.date)}`, `${esc(opNomeServ(b))} · ${esc(f.join(' · '))}`, lnk('#/adm/parceiros', 'Parceiros'), b.date <= addDays(hoje, 3) ? 'alerta' : '')).join('')));

  /* 8. sem guia ou motorista (3 dias) */
  const sem = Op.semPrestador(3);
  if (sem.length) B.push(bloco(HJ.pessoa, 'Sem guia ou motorista', sem.length, sem.slice(0, 5).map(b =>
    it(HJ.pessoa, `${opCurta(b.date)} ${esc(b.time || '')} · ${esc(opNomeServ(b))}`, `${esc(b.name)} · ${b.pax} ${+b.pax === 1 ? 'pessoa' : 'pessoas'}`, lnk('#/adm/guias/servico:' + b.id, 'Escalar'), 'alerta')).join('')));

  /* 9. pedir avaliação: quem já fez o serviço nos últimos 10 dias */
  const aval = ativas.filter(b => b.date < hoje && b.date >= addDays(hoje, -10) && !b.avaliacaoEm && b.whats);
  if (aval.length) B.push(bloco(HJ.estrela, 'Pedir avaliação', aval.length, aval.slice(0, 4).map(b =>
    it(HJ.estrela, `${esc(b.name)} · ${esc(opNomeServ(b))}`, `foi em ${opCurta(b.date)}`, wa(b.whats, msgAvaliacao(b), 'Pedir', `data-hjaval="${esc(b.id)}"`))).join('')));

  return `<div class="hjGrade">${B.join('')}</div>`;
}
function hjLiga(redesenha) {
  $$('[data-hjvai]').forEach(bt => bt.onclick = () => {
    const el = document.getElementById('svc-' + bt.dataset.hjvai);
    if (el) { el.classList.add('foco'); el.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); setTimeout(() => el.classList.remove('foco'), 2400); }
  });
  $$('[data-hjaval]').forEach(a => a.addEventListener('click', () => { marcaAvaliacao(a.dataset.hjaval); setTimeout(() => { toast('Avaliação pedida · vai para Finalizado'); redesenha(); }, 400); }));
  $$('#stage [data-cobra]').forEach(a => a.addEventListener('click', () => {
    const d = Lembretes.devedores(isoToday()).find(x => x.chave === a.dataset.cobra);
    if (d) { Espera.pagamento(d); setTimeout(() => { toast('Cobrança enviada · o app fica aguardando o pagamento'); redesenha(); }, 400); }
  }));
}
/* boas-vindas na primeira vez (como na Bia): três passos e pronto */
const BV_CHAVE = 'yalla_boasvindas';
function hjBoasVindas() {
  try { if (localStorage.getItem(BV_CHAVE) === '1') return ''; } catch (e) { return ''; }
  const nome = opPrimeiro((DB.settings && DB.settings.admName) || guiaNome());
  return `<section class="card bvCard" id="bvCard">
    <button class="bvX" id="bvX" aria-label="Fechar">×</button>
    <h2 class="bvTit">Boas-vindas ao seu app, ${esc(nome)}!</h2>
    <p class="bvSub">Aqui é o seu lado: o painel onde você comanda tudo. Os seus clientes, as suas reservas e os seus números moram aqui. Dê uma volta à vontade; nada quebra.</p>
    <div class="bvPassos">
      <a class="bvP" href="#/adm/tours"><span class="bvN">1</span><span><b>Veja as suas experiências</b><small>Os quatro pilares já estão aqui. Toque para ajustar fotos, textos e preços.</small></span></a>
      <button class="bvP" type="button" id="bvAssist"><span class="bvN">2</span><span><b>Fale com o assistente</b><small>O botão no canto. Peça por escrito ou por voz: ele mexe em todas as abas e mostra antes de gravar.</small></span></button>
      <a class="bvP" href="#/" target="_blank" rel="noopener"><span class="bvN">3</span><span><b>Veja o que o cliente vê</b><small>Abre a primeira tela do app, do jeito que o seu cliente abre.</small></span></a>
    </div>
    <button class="cta bvOk" id="bvOk">Vamos começar</button>
  </section>`;
}
function hjLigaBoasVindas() {
  const card = document.getElementById('bvCard'); if (!card) return;
  const fechar = () => { try { localStorage.setItem(BV_CHAVE, '1'); } catch (e) {} card.remove(); };
  document.getElementById('bvOk').onclick = fechar;
  document.getElementById('bvX').onclick = fechar;
  document.getElementById('bvAssist').onclick = () => { fechar(); if (typeof iaAbre === 'function') { if (typeof iaMonta === 'function' && !document.querySelector('.ia-gaveta, #iaG')) iaMonta(); iaAbre(); } };
}

/* =====================================================
   HOJE — a planilha de 15 anos, agora no app
===================================================== */
function admHoje(arg) {
  const hoje = isoToday();
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(arg || '') ? arg : hoje;
  const lista = Op.doDia(dia);
  const late = Bookings.all().filter(b => b.status === 'confirmed' && Bookings.due(b) > 0 && Op.restoPara(b) === 'ingrid' && Bookings.dueDate(b) < hoje);
  const semPres = Op.semPrestador(3);
  const sozinhas = Tarefas.sincroniza(hoje);
  const tfHoje = Tarefas.grupos(hoje);
  const tfDia = dia === hoje ? [...tfHoje.atrasadas, ...tfHoje.hoje] : Tarefas.doDia(dia).filter(t => t.tipo === 'tarefa' && !t.feita);
  const novos = Orc.all().filter(o => o.status === 'novo').length
    + Roteiros.all().filter(p => !p.respondido && !(DB.orcamentos || []).some(o => o.pedidoId === p.id)).length;
  const noDia = lista.reduce((s, b) => { const n = Op.noDia(b); return s + (n.para === 'prestador' ? n.valor : 0); }, 0);
  const pax = lista.filter(b => b.status !== 'cancelled').reduce((s, b) => s + (+b.pax || 0), 0);
  const dias = [[hoje, 'Hoje'], [addDays(hoje, 1), 'Amanhã'], [addDays(hoje, 2), 'Depois de amanhã']];
  admShell('today', `
    <div class="pagehead"><h1 class="pageh">${dia === hoje ? t('goodMorning') : 'Dia ' + opCurta(dia)}</h1>
      <div class="chips">
        ${dias.map(([d, l]) => `<button class="chip ${d === dia ? 'on' : ''}" data-dia="${d}">${l}</button>`).join('')}
        <button class="mini" data-dia="${addDays(dia, -1)}" aria-label="dia anterior">←</button>
        <input type="date" id="hjData" class="op-date" value="${dia}" aria-label="escolher dia">
        <button class="mini" data-dia="${addDays(dia, 1)}" aria-label="próximo dia">→</button>
      </div></div>
    ${dia === hoje ? hjBoasVindas() : ''}
    <div class="op-busca">
      <input id="hjBusca" type="search" autocomplete="off" placeholder="🔎 Emergência? Nome do cliente, voo, código ou telefone">
      <div id="hjRes"></div>
    </div>
    ${dia === hoje ? hjPainel(hoje) : ''}
    ${dia !== hoje && (late.length || semPres.length || novos) ? `<div class="op-pend">
      ${novos ? `<a class="alert warn" href="#/adm/consulta">🧾 ${novos} ${novos > 1 ? 'pedidos esperando orçamento' : 'pedido esperando orçamento'} →</a>` : ''}
      ${(() => { const n = transfersDe(isoToday(), addDays(isoToday(), 7), 'roma').filter(b => !b.ncc).length; return n ? `<a class="alert warn" href="#/adm/transfer">🚐 ${n} ${n > 1 ? 'transfers' : 'transfer'} dos próximos 7 dias ainda não ${n > 1 ? 'pedidos' : 'pedido'} ao ${esc(nccConfig().nome)} →</a>` : ''; })()}
      ${semPres.length ? `<a class="alert warn" href="#/adm/guias">👤 ${semPres.length} ${semPres.length > 1 ? 'serviços' : 'serviço'} sem guia/motorista nos próximos 3 dias →</a>` : ''}
      ${late.length ? `<a class="alert bad" href="#/adm/bookings">⚠ ${late.length} ${late.length > 1 ? 'pagamentos atrasados' : 'pagamento atrasado'} · ${eur(late.reduce((s, b) => s + Bookings.due(b), 0))} →</a>` : ''}
    </div>` : ''}
    <p class="op-resumo"><b>${fmtDate(dia)}</b> · ${lista.length} ${lista.length === 1 ? 'serviço' : 'serviços'} · ${pax} pessoas${noDia ? ` · <b>${eur(noDia)}</b> pagos no dia a guias e motoristas` : ''}</p>
    ${(() => {
      /* A AGENDA DO DIA (espelha o TI ARTES): serviços e tarefas numa linha do
         tempo única, em ordem de horário. As atrasadas vêm primeiro. */
      if (dia === hoje) {
        const l = lista.filter(b => b.status !== 'cancelled');
        if (!l.length) return '';
        const avisosH = sozinhas.length ? `<div class="card md-avisos">${sozinhas.map(x => `<p class="why">✨ ${esc(x.texto)} — ${esc(x.obsFim)}</p>`).join('')}</div>` : '';
        return `<div class="md-ag-cab"><h3>Os serviços de hoje</h3><a class="mini" href="#/adm/agenda">agenda</a></div>${avisosH}`
          + HJ_TURNOS.map(([k, nome]) => { const t0 = l.filter(b => hjTurno(b.time) === k); return t0.length ? `<p class="rotMini hjTurnoRot">${nome}</p>${t0.map(b => opCardServico(b)).join('')}` : ''; }).join('');
      }
      const taskHoje = Tarefas.doDia(dia).filter(x => x.tipo === 'tarefa' && !x.feita);
      const linha = [...lista.map(b => ({ h: b.time || '99:99', k: 'svc', b })), ...taskHoje.map(x => ({ h: x.hora || '99:98', k: 'task', x }))]
        .sort((a, b) => String(a.h).localeCompare(String(b.h)));
      const atrasadas = dia === hoje ? tfHoje.atrasadas : [];
      if (!linha.length && !atrasadas.length && !sozinhas.length) return `<div class="emptybox"><p>Nada marcado para este dia.</p><a class="mini" href="#/adm/consulta">Ver pedidos sob consulta</a></div>`;
      const cab = `<div class="md-ag-cab"><h3>📅 Agenda ${dia === hoje ? 'de hoje' : 'do dia'}</h3>${atrasadas.length ? `<span class="tf-bad">${atrasadas.length} atrasada${atrasadas.length > 1 ? 's' : ''}</span>` : ''}<a class="mini" href="#/adm/tarefas">todas as tarefas</a></div>`;
      const avisos = sozinhas.length ? `<div class="card md-avisos">${sozinhas.map(x => `<p class="why">✨ ${esc(x.texto)} — ${esc(x.obsFim)}</p>`).join('')}</div>` : '';
      const atr = atrasadas.map(x => `<div class="card tf-item atrasada">${tfLinha(x, hoje)}</div>`).join('');
      const corpo = linha.map(it => it.k === 'svc' ? opCardServico(it.b) : `<div class="card tf-item">${tfLinha(it.x, hoje)}</div>`).join('');
      return cab + avisos + atr + corpo;
    })()}
    ${dia === hoje ? (() => {
      const prox = [];
      for (let i = 1; i <= 21 && prox.length < 6; i++) {
        const d = addDays(hoje, i), l = Op.doDia(d).filter(b => b.status !== 'cancelled');
        if (l.length) prox.push({ d, n: l.length, pax: l.reduce((s, b) => s + (+b.pax || 0), 0), nomes: [...new Set(l.map(b => opPrimeiro(b.name)))].slice(0, 3).join(', ') });
      }
      return prox.length ? `<section class="card md-prox"><div class="rp-cab"><h3>📅 Próximos dias</h3><a class="mini" href="#/adm/agenda">ver agenda completa</a></div>
        ${prox.map(x => `<button class="md-dia" data-dia="${x.d}"><span class="md-data">${esc(fmtDate(x.d))}</span><span class="md-n">${x.n} ${x.n === 1 ? 'serviço' : 'serviços'} · ${x.pax}p</span><small class="md-nomes">${esc(x.nomes)}</small></button>`).join('')}</section>` : '';
    })() : ''}
  `);
  const vai = (d) => go('/adm/today/' + d);
  $$('[data-dia]').forEach(b => b.onclick = () => vai(b.dataset.dia));
  $('#hjData').onchange = (e) => { if (e.target.value) vai(e.target.value); };
  const res = $('#hjRes');
  $('#hjBusca').oninput = (e) => {
    const r = Op.busca(e.target.value).slice(0, 8);
    res.innerHTML = r.length ? `<div class="op-resbusca">${r.map(b => `<button class="op-achado" data-ir="${esc(b.id)}">
        <b>${esc(b.name)}</b><small>${fmtDate(b.date)} ${esc(b.time)} · ${esc(opNomeServ(b))}${b.voo ? ' · ✈ ' + esc(b.voo) : ''} · ${esc(b.code)}</small></button>`).join('')}</div>`
      : (e.target.value.trim().length >= 2 ? '<p class="why">Nada encontrado.</p>' : '');
    $$('[data-ir]', res).forEach(btn => btn.onclick = () => {
      const b = Bookings.get(btn.dataset.ir);
      admHoje._foco = b.id; vai(b.date);
    });
  };
  opLigaCards(() => admHoje(dia));
  tfLigaMini(() => admHoje(dia));
  if (dia === hoje) { hjLiga(() => admHoje(dia)); hjLigaBoasVindas(); }
  /* o backup do dia sai sozinho na primeira abertura do painel */
  setTimeout(() => bkpDoDia(), 600);
  if (admHoje._foco) {
    const el = document.getElementById('svc-' + admHoje._foco);
    admHoje._foco = null;
    if (el) { el.classList.add('foco'); setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 60); }
  }
  Coach.start([
    { sel: '#hjBusca',     audio: 'adm-5', txt: { pt: 'Emergência: digite um pedaço do nome, o voo ou o telefone e o serviço aparece na hora.', en: 'Emergency: type part of the name, the flight or the phone and the service shows up at once.' } },
    { sel: '#nb-guias',    audio: 'adm-6', txt: { pt: 'Suas guias e motoristas: quem está livre, por preferência, e o WhatsApp pronto para perguntar.', en: 'Your guides and drivers: who is free, by preference, with the WhatsApp message ready.' } },
    { sel: '#nb-consulta', audio: 'adm-7', txt: { pt: 'Pedidos sob consulta: o app deixa o orçamento pronto, você confere e manda.', en: 'Quote requests: the app drafts the quote, you check and send it.' } },
    { sel: '#nb-money',    audio: 'adm-8', txt: { pt: 'Contabilidade: cada conta no seu lado — ' + ladoNome('brasil') + ' para um contador, ' + ladoNome('europa') + ' para o outro.', en: 'Accounting: each account on its side — Brazil for one accountant, Europe for the other.' } },
  ], 'tutorialAdm');
}

/* =====================================================
   GUIAS — bater a agenda delas com os passeios
===================================================== */
function admGuias(arg) {
  const S = admGuias._s = admGuias._s || { data: addDays(isoToday(), 1), turno: 'manha', cidade: baseNome(), tipo: 'guia', servico: '', sem: isoToday(), ed: '' };
  if (arg && arg.startsWith('servico:')) {
    const b = Bookings.get(arg.slice(8));
    if (b) {
      const x = Tours.get(b.tourId), tt = turnosDoServico(b);
      S.servico = b.id; S.data = b.date; S.turno = tt.length > 1 ? 'dia' : tt[0];
      S.tipo = opPapel(b);
      S.cidade = x && (x.region === ((typeof regioes === 'function' && (regioes()[0] || [])[0]) || '') || x.type === 'transfer' || x.region === 'transfer') ? baseNome() : '';
    }
    history.replaceState(null, '', '#/adm/guias');
  }
  const doDia = Op.doDia(S.data);
  if (S.servico && !doDia.some(b => b.id === S.servico)) S.servico = '';
  const serv = S.servico ? Bookings.get(S.servico) : null;
  const r = Disp.quem({ data: S.data, turno: S.turno, cidade: S.cidade, tipo: S.tipo });
  const cidades = Equipe.cidades();
  const turnoTxt = S.turno === 'manha' ? 'de manhã' : S.turno === 'tarde' ? 'à tarde' : S.turno === 'noite' ? 'à noite' : 'o dia inteiro';
  const msgPara = (p) => serv
    ? `Oi ${opPrimeiro(p.nome)}! Tudo bem? Você tem disponibilidade dia ${opCurta(S.data)} ${turnoTxt} para ${opNomeServ(serv)}? São ${serv.pax} ${serv.pax > 1 ? 'pessoas' : 'pessoa'}, às ${serv.time}. Se puder, me diz até que horas você fica livre. Obrigada! ${guiaNome()}`
    : `Oi ${opPrimeiro(p.nome)}! Tudo bem? Você tem disponibilidade dia ${opCurta(S.data)} ${turnoTxt}${S.cidade ? ' em ' + S.cidade : ''}? Me diz até que horas você fica livre. Obrigada! ${guiaNome()}`;

  const linha = (it, i) => {
    const p = it.p;
    const pill = it.estado === 'livre' ? `<span class="pill ok">✓ livre${it.nota ? ' · ' + esc(it.nota) : ''}</span>`
      : it.estado === 'ocupada' ? `<span class="pill bad">✕ ocupada${it.servico ? ' · ' + esc(opNomeServ(it.servico)) + ' ' + esc(it.servico.time) : it.nota ? ' · ' + esc(it.nota) : ''}</span>`
      : '<span class="pill n">não perguntei</span>';
    const podeEscalar = serv && it.estado !== 'ocupada' && serv.prestadorId !== p.id;
    return `<div class="gl-row ${it.estado}">
      <span class="gl-pref">${i}</span>
      <div class="gl-nome"><b>${esc(p.nome)}</b><small>${esc((p.cidades || []).join(', '))}${p.idiomas ? ' · ' + esc(p.idiomas) : ''}</small></div>
      ${pill}
      <div class="tacts">
        ${p.whats ? `<a class="mini cta-ish" target="_blank" rel="noopener" data-pergunta="${esc(p.id)}" href="${waLink(msgPara(p), opNum(p.whats))}">💬 Perguntar</a>` : ''}
        ${it.servico ? '' : `<button class="mini" data-mk="${esc(p.id)}|livre">Livre</button>
        <button class="mini" data-mk="${esc(p.id)}|ocupada">Ocupada</button>
        ${it.estado ? `<button class="mini ghost" data-mk="${esc(p.id)}|">Limpar</button>` : ''}`}
        ${podeEscalar ? `<button class="mini strong" data-esc="${esc(p.id)}">Escalar</button>` : ''}
        ${serv && serv.prestadorId === p.id ? '<span class="pill ok">escalada neste serviço</span>' : ''}
      </div>
    </div>`;
  };
  const ordem = (lista, off) => lista.map((it, k) => linha(it, off + k + 1)).join('');

  /* a semana: gente x dias x turnos, como a planilha dela */
  const dias7 = Array.from({ length: 7 }, (_, i) => addDays(S.sem, i));
  const tts = ['manha', 'tarde', 'noite'];
  const gente = Equipe.all(S.tipo).filter(p => Equipe.atende(p, S.cidade));
  const WD = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  const grade = `<div class="gsem-wrap"><table class="gsem"><thead>
      <tr><th></th>${dias7.map(d => `<th colspan="3" class="${d === S.data ? 'on' : ''}">${WD[new Date(d + 'T12:00:00').getDay()]} ${opCurta(d)}</th>`).join('')}</tr>
      <tr><th></th>${dias7.map(() => tts.map(tu => `<th class="tu">${tu === 'manha' ? 'M' : tu === 'tarde' ? 'T' : 'N'}</th>`).join('')).join('')}</tr></thead>
    <tbody>${gente.map(p => `<tr><th class="gnome">${esc(opPrimeiro(p.nome))}</th>${dias7.map(d => tts.map(tu => {
      const e = Disp.estado(p.id, d, tu);
      const tit = e.servico ? opNomeServ(e.servico) + ' ' + e.servico.time + ' · ' + e.servico.name : (e.nota || '');
      return `<td class="gc ${e.estado} ${e.servico ? 'serv' : ''}" data-gc="${esc(p.id)}|${d}|${tu}" title="${esc(tit)}">${e.estado === 'livre' ? '✓' : e.estado === 'ocupada' ? (e.servico ? '●' : '✕') : '·'}</td>`;
    }).join('')).join('')}</tr>`).join('') || `<tr><td class="why" colspan="22">Ninguém cadastrado ${S.cidade ? 'em ' + esc(S.cidade) : ''}.</td></tr>`}</tbody></table></div>`;

  const semP = Op.semPrestador(14);
  const ed = S.ed ? Equipe.get(S.ed) : null;

  admShell('guias', `
    <div class="pagehead"><h1 class="pageh">Guias e motoristas</h1>
      <div class="chips">
        <button class="chip ${S.tipo === 'guia' ? 'on' : ''}" data-tipo="guia">Guias</button>
        <button class="chip ${S.tipo === 'motorista' ? 'on' : ''}" data-tipo="motorista">Motoristas</button>
      </div></div>

    <section class="card">
      <h3>Quem está livre?</h3>
      <div class="frow">
        <label class="fld">Dia<input type="date" id="gqData" value="${S.data}"></label>
        <label class="fld">Turno<select id="gqTurno">${[...TURNOS.map(x => x[0]), 'dia'].map(tu => `<option value="${tu}" ${S.turno === tu ? 'selected' : ''}>${turnoNome(tu)}</option>`).join('')}</select></label>
        <label class="fld">Cidade<select id="gqCid"><option value="">Todas</option>${cidades.map(c => `<option ${S.cidade === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      </div>
      <label class="fld">Para qual serviço (opcional)<select id="gqServ"><option value="">— só perguntar a disponibilidade —</option>
        ${doDia.map(b => `<option value="${esc(b.id)}" ${S.servico === b.id ? 'selected' : ''}>${esc(b.time)} · ${esc(opNomeServ(b))} · ${esc(b.name)} (${b.pax}p)${b.prestadorId ? ' — com ' + esc(opPrimeiro((Equipe.get(b.prestadorId) || {}).nome)) : ' — sem ' + opPapel(b)}</option>`).join('')}</select></label>
      ${serv && serv.prestadorId ? `<div class="alert">✓ ${esc(opNomeServ(serv))} já está com <b>${esc((Equipe.get(serv.prestadorId) || {}).nome || '')}</b>
        <a class="mini cta-ish" target="_blank" rel="noopener" href="${waLink(opMsgPrestador(serv), opNum((Equipe.get(serv.prestadorId) || {}).whats))}">💬 mandar o serviço</a>
        <a class="mini" href="#/adm/servico/${esc(serv.id)}">📄 PDF do serviço</a>
        <button class="mini ghost" data-desescala="1">tirar</button></div>` : ''}

      <div class="gl-grupo"><span class="op-lbl">Livres · por preferência</span>${r.livres.length ? ordem(r.livres, 0) : '<p class="why">Ninguém confirmou ainda.</p>'}</div>
      <div class="gl-grupo"><span class="op-lbl">Sem resposta</span>${r.semResposta.length ? ordem(r.semResposta, r.livres.length) : '<p class="why">—</p>'}
        ${r.semResposta.filter(it => it.p.whats).length > 1 ? `<button class="mini" id="gqTodas">💬 Perguntar a todas de uma vez (${r.semResposta.filter(it => it.p.whats).length})</button>` : ''}
        <div id="gqLote"></div></div>
      <div class="gl-grupo"><span class="op-lbl">Ocupadas</span>${r.ocupadas.length ? ordem(r.ocupadas, r.livres.length + r.semResposta.length) : '<p class="why">—</p>'}</div>
    </section>

    <section class="card">
      <div class="pagehead"><h3 style="margin:0;flex:1">A semana${S.cidade ? ' · ' + esc(S.cidade) : ''}</h3>
        <div class="chips" style="margin:0">
          <button class="mini" id="gsPrev">←</button><button class="mini" id="gsHoje">esta semana</button><button class="mini" id="gsNext">→</button></div></div>
      <p class="why">Toque num quadrinho para marcar: · não perguntei → ✓ livre → ✕ ocupada. ● é serviço que você já passou para ela.</p>
      ${grade}
    </section>

    <section class="card">
      <h3>Serviços sem guia ou motorista · próximos 14 dias</h3>
      ${semP.length ? semP.map(b => `<div class="deprow"><b class="mono">${opCurta(b.date)} ${esc(b.time)}</b>
        <span>${esc(opNomeServ(b))} · ${esc(b.name)} · ${b.pax}p</span>
        <a class="mini strong" href="#/adm/guias/servico:${esc(b.id)}">achar ${opPapel(b)}</a></div>`).join('') : '<p class="why">Tudo escalado. 👏</p>'}
    </section>

    <section class="card">
      <h3>${ed ? 'Editar ' + esc(ed.nome) : 'Cadastrar ' + (S.tipo === 'motorista' ? 'motorista' : 'guia')}</h3>
      <div class="frow">
        <label class="fld">Nome<input id="geNome" value="${esc(ed ? ed.nome : '')}"></label>
        <label class="fld">WhatsApp<input id="geWa" value="${esc(ed ? ed.whats : '')}" placeholder="+39 ..."></label>
        <label class="fld">É<select id="geTipo"><option value="guia" ${(ed ? ed.tipo : S.tipo) === 'guia' ? 'selected' : ''}>Guia</option><option value="motorista" ${(ed ? ed.tipo : S.tipo) === 'motorista' ? 'selected' : ''}>Motorista / parceiro de transfer</option></select></label>
      </div>
      <div class="frow">
        <label class="fld">Cidades que atende<input id="geCid" value="${esc(ed ? (ed.cidades || []).join(', ') : (S.cidade || baseNome()))}" placeholder="Dubai, Abu Dhabi"></label>
        <label class="fld">Idiomas<input id="geIdi" value="${esc(ed ? ed.idiomas : '')}" placeholder="português, inglês, árabe"></label>
      </div>
      <label class="fld">Observação<input id="geObs" value="${esc(ed ? ed.obs : '')}" placeholder="ex.: ótima com crianças, não faz deserto"></label>
      <div class="btnrow"><button class="cta sm" id="geSalva">${ed ? 'Salvar' : 'Cadastrar'}</button>${ed ? '<button class="mini" id="geCancela">cancelar</button>' : ''}</div>
      <div class="rulesep"></div>
      <span class="op-lbl">Ordem de preferência — ${S.tipo === 'motorista' ? 'motoristas' : 'guias'}</span>
      ${Equipe.all(S.tipo).map((p, i) => `<div class="gl-row">
        <span class="gl-pref">${i + 1}</span>
        <div class="gl-nome"><b>${esc(p.nome)}</b><small>${esc((p.cidades || []).join(', '))}${p.whats ? ' · ' + esc(p.whats) : ''}${p.obs ? ' · ' + esc(p.obs) : ''}</small></div>
        <div class="tacts"><button class="mini" data-mv="${esc(p.id)}|-1" aria-label="subir">↑</button><button class="mini" data-mv="${esc(p.id)}|1" aria-label="descer">↓</button>
          <button class="mini" data-gllink="${esc(p.id)}" title="o link dele: marca os dias livres e vê os serviços">🔗 link</button>${p.whats ? `<a class="mini" target="_blank" rel="noopener" href="${waLink(glt('msgLink', { nome: opPrimeiro(p.nome), link: glLink(p) }), opNum(p.whats))}" title="mandar o link no WhatsApp dele">📲</a>` : ''}
          <button class="mini" data-ed="${esc(p.id)}">editar</button><button class="mini danger" data-rm="${esc(p.id)}">remover</button></div>
      </div>`).join('') || '<p class="why">Ninguém cadastrado ainda.</p>'}
    </section>`);

  const re = () => admGuias();
  $$('[data-tipo]').forEach(b => b.onclick = () => { S.tipo = b.dataset.tipo; S.servico = ''; re(); });
  $('#gqData').onchange = (e) => { S.data = e.target.value || S.data; S.servico = ''; re(); };
  $('#gqTurno').onchange = (e) => { S.turno = e.target.value; re(); };
  $('#gqCid').onchange = (e) => { S.cidade = e.target.value; re(); };
  $('#gqServ').onchange = (e) => {
    S.servico = e.target.value;
    const b = Bookings.get(S.servico);
    if (b) { const tt = turnosDoServico(b); S.turno = tt.length > 1 ? 'dia' : tt[0]; S.tipo = opPapel(b); }
    re();
  };
  $$('[data-mk]').forEach(b => b.onclick = () => {
    const [id, estado] = b.dataset.mk.split('|');
    Disp.marca(id, S.data, S.turno, estado, estado === 'livre' ? (prompt('Até que horas? (opcional)') || '') : estado === 'ocupada' ? '' : '');
    re();
  });
  /* perguntou: nasce "aguardar a resposta da guia", que fecha quando ela marcar livre/ocupada */
  $$('[data-pergunta]').forEach(a => a.addEventListener('click', () => {
    const p = Equipe.get(a.dataset.pergunta); if (!p) return;
    Espera.guia(p, S.data, S.turno, serv);
    setTimeout(() => toast(`Aguardando ${opPrimeiro(p.nome)} · a tarefa fecha quando você marcar livre ou ocupada`), 300);
  }));
  $$('[data-esc]').forEach(b => b.onclick = () => {
    Op.escala(S.servico, b.dataset.esc);
    const p = Equipe.get(b.dataset.esc);
    toast(`${opNomeServ(serv)} → ${p.nome}. Mande o serviço pelo WhatsApp.`);
    re();
  });
  $('[data-desescala]')?.addEventListener('click', () => { Op.escala(S.servico, ''); re(); });
  const lote = $('#gqTodas');
  if (lote) lote.onclick = () => {
    const alvo = r.semResposta.filter(it => it.p.whats);
    $('#gqLote').innerHTML = `<div class="gq-lote"><p class="why">O WhatsApp não deixa mandar para várias pessoas com um toque só: abra uma por uma (cada botão já leva a mensagem escrita) ou copie o texto para a sua lista de transmissão.</p>
      <div class="tacts">${alvo.map(it => `<a class="mini cta-ish" target="_blank" rel="noopener" href="${waLink(msgPara(it.p), opNum(it.p.whats))}">💬 ${esc(opPrimeiro(it.p.nome))}</a>`).join('')}
      <button class="mini" id="gqCopia">copiar a mensagem</button></div></div>`;
    $('#gqCopia').onclick = () => opCopia(msgPara({ nome: '' }).replace('Oi !', 'Oi!'));
  };
  $$('[data-gc]').forEach(td => td.onclick = () => {
    const [id, d, tu] = td.dataset.gc.split('|');
    const e = Disp.estado(id, d, tu);
    if (e.servico) return toast(`Ocupada: ${opNomeServ(e.servico)} ${e.servico.time} · ${e.servico.name}`);
    Disp.marca(id, d, tu, e.estado === '' ? 'livre' : e.estado === 'livre' ? 'ocupada' : '', e.nota || '');
    re();
  });
  $('#gsPrev').onclick = () => { S.sem = addDays(S.sem, -7); re(); };
  $('#gsNext').onclick = () => { S.sem = addDays(S.sem, 7); re(); };
  $('#gsHoje').onclick = () => { S.sem = isoToday(); re(); };
  $('#geSalva').onclick = () => {
    const p = Equipe.salva({ id: S.ed, nome: $('#geNome').value, whats: $('#geWa').value, tipo: $('#geTipo').value,
      cidades: $('#geCid').value, idiomas: $('#geIdi').value, obs: $('#geObs').value });
    if (!p) { $('#geNome').focus(); return toast('Falta o nome.'); }
    toast(S.ed ? 'Salvo' : `${p.nome} cadastrada`);
    S.ed = ''; S.tipo = p.tipo; re();
  };
  $('#geCancela')?.addEventListener('click', () => { S.ed = ''; re(); });
  $$('[data-mv]').forEach(b => b.onclick = () => { const [id, d] = b.dataset.mv.split('|'); Equipe.move(id, +d); re(); });
  $$('[data-ed]').forEach(b => b.onclick = () => { S.ed = b.dataset.ed; re(); setTimeout(() => $('#geNome').scrollIntoView({ block: 'center' }), 30); });
  /* o link do guia (guia-link.js): copia e avisa */
  $$('[data-gllink]').forEach(b => b.onclick = () => {
    const p = Equipe.get(b.dataset.gllink); if (!p || typeof glLink !== 'function') return;
    opCopia(glLink(p)).then(() => toast(glt('linkOk', { nome: opPrimeiro(p.nome) })));
  });
  $$('[data-rm]').forEach(b => b.onclick = () => {
    const p = Equipe.get(b.dataset.rm);
    if (p && confirm(`Remover ${p.nome}? Os serviços com ela ficam sem ${p.tipo}.`)) { Equipe.remove(p.id); re(); }
  });
}

/* =====================================================
   FICHA DO CLIENTE
===================================================== */
/* O topo da aba Clientes: as duas partes dela */
function cliTopo(qual) {
  return `<div class="cli-seg" role="tablist">
    <a class="cli-seg-b ${qual === 'planilha' ? 'on' : ''}" href="#/adm/planilha" role="tab">📋 Planilha</a>
    <a class="cli-seg-b ${qual === 'crm' ? 'on' : ''}" href="#/adm/consulta" role="tab">📨 Orçamentos</a>
    <a class="cli-seg-b ${qual === 'clientes' ? 'on' : ''}" href="#/adm/clients" role="tab">👤 Clientes</a></div>`;
}
/* acha o cadastro pela rota: "c:<id>", a chave antiga (e-mail/WhatsApp/nome) ou "g:<nome>" */
function cadastroDaRota(arg) {
  const k = decodeURIComponent(arg || '');
  if (k.startsWith('c:')) return Cadastro.get(k.slice(2));
  if (k.startsWith('g:')) return Cadastro.acha({ nome: k.slice(2) }) || Cadastro.all().find(c => _nomeN(c.nome) === _nomeN(k.slice(2))) || null;
  const b = DB.bookings.find(x => chaveCliente(x) === k);
  if (b && b.clienteId) return Cadastro.get(b.clienteId);
  return Cadastro.acha({ nome: k, email: k, whats: k });
}
const fichaHref = (c) => '#/adm/clients/' + encodeURIComponent('c:' + c.id);

/* =====================================================
   FICHA DO CLIENTE — a planilha "2026_10_26 Camyla Foresti", no app
===================================================== */
function admFicha(arg) {
  const c = cadastroDaRota(arg);
  if (!c) { admShell('clients', cliTopo('clientes') + '<h1 class="pageh">Cliente não encontrado</h1><a class="mini" href="#/adm/clients">← clientes</a>'); return; }
  const hoje = isoToday(), R = Cadastro.resumo(c, hoje);
  const k = DB.bookings.find(b => b.clienteId === c.id) ? chaveCliente(DB.bookings.find(b => b.clienteId === c.id)) : String(c.email || c.whats || c.nome).toLowerCase();
  const f = Fichas.get(k);
  const bs = Cadastro.reservas(c);
  const ativas = bs.filter(b => b.status !== 'cancelled');
  const prox = ativas.filter(b => b.date >= hoje).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const passadas = bs.filter(b => !(b.status !== 'cancelled' && b.date >= hoje));
  const quemComprou = c.grupoDe ? Cadastro.get(c.grupoDe) : null;
  const indicou = Cadastro.indicou(c), trouxe = Cadastro.trouxe(c);
  const ind = c.indicadoPor ? Cadastro.get(c.indicadoPor) : null, par = c.parceiroId ? Parceiros.get(c.parceiroId) : null;
  const idade = idadeDe(c.nasc);
  const { pedidos, orcamentos } = Fichas.doCliente(k, c.whats, c.email);
  const tfs = Tarefas.doCliente(k, c.whats).concat(Tarefas.all().filter(t => t.clienteKey === 'c:' + c.id));
  const v = c.viagem || {};
  /* quem viaja com ela: todo mundo que ja esteve num passeio com ela */
  const junto = new Map();
  for (const b of ativas) for (const p of participantesDe(b)) if (p.clienteId !== c.id && _nomeN(p.nome) !== _nomeN(c.nome)) {
    const kk = p.clienteId || _nomeN(p.nome); const x = junto.get(kk) || { ...p, vezes: 0 }; x.vezes++; junto.set(kk, x);
  }
  /* a tabela dos servicos, como a planilha dela */
  const linhaServ = (b) => {
    const nd = Op.noDia(b), pres = b.prestadorId ? Equipe.get(b.prestadorId) : null, pago = Bookings.paid(b);
    const part = participantesDe(b);
    return `<tr class="fc-serv ${b.status === 'cancelled' ? 'cancel' : ''}">
      <td class="mono">${fmtDate(b.date)}</td><td class="mono">${esc(b.time)}</td>
      <td><b>${esc(nomeDoServico(b))}</b>${b.voo ? `<br><small>✈ ${esc(b.voo)}</small>` : ''}${b.origem || b.destino ? `<br><small>📍 ${esc([b.origem, b.destino].filter(Boolean).join(' → '))}</small>` : ''}
        <div class="fc-quem">👥 ${part.length ? part.map(p => `${p.clienteId ? `<a href="${fichaHref({ id: p.clienteId })}">` : '<span>'}${esc(opPrimeiro(p.nome))}${idadeDe(p.nasc) != null ? ` <small>(${idadeDe(p.nasc)})</small>` : ''}${p.clienteId ? '</a>' : '</span>'}`).join(', ') : '<span class="why">ninguém cadastrado</span>'}
          ${part.length < b.pax ? `<span class="pill warn">faltam ${b.pax - part.length} nome(s)</span>` : ''}</div>
        <div class="fc-links">${Op.precisaIngresso(b) && !PedidosFor.daReserva(b).some(p => p.tipo === 'ingressos') ? (b.ingressosOk ? '<span class="pill ok">🎟 ingressos comprados</span>' : '<span class="pill warn">🎟 comprar ingressos</span>') : ''} ${pedForPills(b)}
          ${(b.links || []).map(l => `<a class="mini" target="_blank" rel="noopener" href="${esc(l.url)}">🔗 ${esc(l.nome)}</a>`).join('')}</div></td>
      <td class="mono right">${eur(b.total)}</td><td class="mono right">${eur(pago)}</td>
      <td class="mono right">${nd.valor ? eur(nd.valor) + (nd.para === 'prestador' ? '<br><small>no dia</small>' : '<br><small>a você</small>') : '✓'}</td>
      <td>${pres ? esc(opPrimeiro(pres.nome)) : `<a href="#/adm/guias/servico:${esc(b.id)}" class="fc-sem">escalar</a>`}</td>
      <td><button class="mini" data-abre="fc-${esc(b.id)}" aria-label="abrir o serviço">abrir</button></td></tr>
      <tr class="fc-det" id="fc-${esc(b.id)}" hidden><td colspan="8">${opCardServico(b, { comData: true })}</td></tr>`;
  };
  const somaTot = prox.reduce((s2, b) => s2 + (+b.total || 0), 0), somaPago = prox.reduce((s2, b) => s2 + Bookings.paid(b), 0), somaDia = prox.reduce((s2, b) => s2 + Op.noDia(b).valor, 0);
  /* o historico: tudo em ordem, do mais novo para o mais antigo */
  const hist = [];
  for (const b of bs) hist.push({ d: b.date, ico: b.status === 'cancelled' ? '✕' : '🏛️', txt: `${nomeDoServico(b)} · ${b.pax}p${b.clienteId !== c.id ? ' (veio junto)' : ''}${b.status === 'cancelled' ? ' · cancelado' : ''}`, v: b.clienteId === c.id ? eur(b.total) : '' });
  for (const b of bs.filter(x => x.clienteId === c.id)) for (const p of b.payments || []) hist.push({ d: p.date, ico: '💵', txt: `pagou ${eur(p.amount)} · ${Contas.nome(p.conta) || formaPg(p.method)}${p.comprovante ? ' · comprovante' : ''}`, href: p.comprovante || '' });
  for (const o of orcamentos) hist.push({ d: String(o.criado).slice(0, 10), ico: '🧾', txt: `orçamento ${o.num} · ${o.status}`, v: eur(Orc.total(o)), link: '#/adm/consulta/' + o.id });
  for (const t of tfs) hist.push({ d: String(t.feitaEm || t.criada).slice(0, 10), ico: t.tipo === 'nota' ? '📝' : t.feita ? '✅' : '⏳', txt: t.texto });
  hist.sort((a, b) => String(b.d).localeCompare(String(a.d)));

  admShell('clients', `${cliTopo('clientes')}
    <a class="linkbtn" href="#/adm/clients">← todos os clientes</a>
    <section class="card fc-top">
      <div class="fc-id">
        <h1 class="pageh" style="margin:0">${esc(c.nome)}</h1>
        <div class="chips" style="margin:8px 0 0">
          ${c.veioPor ? `<span class="pill conta">veio por: ${esc(veioPorNome(c.veioPor))}${ind ? ` — <a href="${fichaHref(ind)}">${esc(ind.nome)}</a>` : c.indicadoNome ? ' — ' + esc(c.indicadoNome) : ''}</span>` : '<span class="pill warn">veio por: ?</span>'}
          ${par ? `<span class="pill conta">🤝 ${esc(par.nome)}${par.cupom ? ' · ' + esc(par.cupom) : ''}</span>` : ''}
          ${quemComprou ? `<span class="pill">veio junto de <a href="${fichaHref(quemComprou)}">${esc(quemComprou.nome)}</a></span>` : ''}
          ${R.reservas > 1 ? `<span class="pill ok">${R.reservas} passeios</span>` : ''}
          ${String(f.tags || '').split(',').map(x => x.trim()).filter(Boolean).map(x => `<span class="pill conta">${esc(x)}</span>`).join('')}
        </div>
        <p class="fc-dados">${[idade != null ? `${idade} anos (${esc(c.nasc)})` : '', c.pais, c.idioma, c.criado ? 'cliente desde ' + new Date(c.criado).toLocaleDateString('pt-BR') : ''].filter(Boolean).join(' · ')}</p>
      </div>
      <div class="tacts">
        ${c.whats ? `<a class="mini cta-ish" target="_blank" rel="noopener" href="${waLink('', opNum(c.whats))}">WhatsApp ${esc(c.whats)}</a>` : quemComprou && quemComprou.whats ? `<a class="mini" target="_blank" rel="noopener" href="${waLink('', opNum(quemComprou.whats))}">falar com ${esc(opPrimeiro(quemComprou.nome))} (quem comprou)</a>` : ''}
        ${c.email ? `<a class="mini" href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}
        ${c.insta ? `<a class="mini" target="_blank" rel="noopener" href="https://instagram.com/${esc(String(c.insta).replace(/^@/, ''))}">@${esc(String(c.insta).replace(/^@/, ''))}</a>` : ''}
        ${!quemComprou ? `<a class="mini strong" href="#/adm/consulta" id="fcOrc">+ orçamento</a>` : ''}
      </div>
      <div class="kpis">
        <div class="kpi"><small>Passeios</small><b>${R.reservas}</b></div>
        <div class="kpi"><small>Já pagou</small><b>${eur(R.gasto)}</b></div>
        <div class="kpi ${R.deve ? 'warn' : ''}"><small>Deve a você</small><b>${eur(R.deve)}</b></div>
        <div class="kpi"><small>Indicou</small><b>${R.indicou}</b></div>
        <div class="kpi"><small>Trouxe junto</small><b>${R.trouxe}</b></div>
      </div>
    </section>

    <section class="card">
      <div class="rp-cab"><h3>A viagem</h3><button class="mini" data-abre="fcViagem">editar</button></div>
      <div class="fc-viagem"><span><small>Hotel</small><b>${esc(v.hotel || '—')}</b></span><span><small>Chegada</small><b>${esc(v.chegada || '—')}</b></span>
        <span><small>Partida</small><b>${esc(v.partida || '—')}</b></span><span><small>Bagagem</small><b>${esc(v.bagagem || '—')}</b></span></div>
      <div class="svc-form" id="fcViagem" hidden><div class="frow">
        <label class="fld">Hotel<input id="fvHotel" value="${esc(v.hotel || '')}"></label><label class="fld">Chegada (voo, dia)<input id="fvCheg" value="${esc(v.chegada || '')}"></label></div>
        <div class="frow"><label class="fld">Partida<input id="fvPart" value="${esc(v.partida || '')}"></label><label class="fld">Bagagem<input id="fvBag" value="${esc(v.bagagem || '')}" placeholder="2x23kg + 2x10kg"></label></div>
        <button class="cta sm" id="fvSalva">Salvar</button></div>

      <h3 style="margin-top:16px">Serviços ${prox.length ? '· próximos' : ''}</h3>
      ${prox.length ? `<div class="fc-tab-wrap"><table class="tbl fc-tab"><thead><tr><th>Data</th><th>Hora</th><th>Serviço · quem vai · ingressos e links</th><th class="right">Total</th><th class="right">Sinal/pago</th><th class="right">${_restoNoDia() ? 'Pagar no dia' : 'Falta pagar'}</th><th>Guia</th><th></th></tr></thead>
        <tbody>${prox.map(linhaServ).join('')}</tbody>
        <tfoot><tr><td colspan="3"><b>Total da viagem</b></td><td class="mono right"><b>${eur(somaTot)}</b></td><td class="mono right"><b>${eur(somaPago)}</b></td><td class="mono right"><b>${eur(somaDia)}</b></td><td colspan="2"></td></tr></tfoot></table></div>` : '<p class="why">Nenhum serviço marcado.</p>'}
      ${passadas.length ? `<details><summary class="why">Passeios anteriores · ${passadas.length}</summary><div class="fc-tab-wrap"><table class="tbl fc-tab"><tbody>${passadas.map(linhaServ).join('')}</tbody></table></div></details>` : ''}
    </section>

    <div class="two-col">
      <div>
        <section class="card"><h3>Histórico</h3>
          <ul class="fc-hist">${hist.slice(0, 40).map(h => `<li><span class="mono">${h.d ? crmData(h.d) + '/' + h.d.slice(2, 4) : ''}</span><span>${h.ico} ${h.link ? `<a href="${h.link}">${esc(h.txt)}</a>` : h.href ? `<a target="_blank" rel="noopener" href="${esc(h.href)}">${esc(h.txt)}</a>` : esc(h.txt)}</span><b class="mono">${h.v || ''}</b></li>`).join('') || '<li class="why">Nada ainda.</li>'}</ul>
        </section>
        <section class="card"><h3>Cadastro</h3>
          <div class="frow"><label class="fld">Nome completo<input id="fcNome" value="${esc(c.nome)}"></label><label class="fld">Nascimento<input id="fcNasc" value="${esc(c.nasc || '')}" placeholder="dd/mm/aaaa"></label></div>
          <div class="frow"><label class="fld">WhatsApp<input id="fcWa" value="${esc(c.whats || '')}"></label><label class="fld">E-mail<input id="fcEm" value="${esc(c.email || '')}"></label></div>
          <div class="frow"><label class="fld">Instagram<input id="fcIg" value="${esc(c.insta || '')}"></label><label class="fld">País / cidade<input id="fcPais" value="${esc(c.pais || '')}"></label></div>
          <div class="frow"><label class="fld">Veio por<select id="fcVeio"><option value="">—</option>${VEIO_POR.map(([vv, nn]) => `<option value="${vv}" ${c.veioPor === vv ? 'selected' : ''}>${nn}</option>`).join('')}</select></label>
            <label class="fld">Indicado por<input id="fcInd" list="fcClis" value="${esc(ind ? ind.nome : c.indicadoNome || '')}" placeholder="nome de quem indicou"></label></div>
          <div class="frow"><label class="fld">Parceiro / cupom<select id="fcPar"><option value="">—</option>${Parceiros.all().map(p => `<option value="${esc(p.id)}" ${c.parceiroId === p.id ? 'selected' : ''}>${esc(p.nome)}${p.cupom ? ' · ' + esc(p.cupom) : ''}</option>`).join('')}</select></label>
            <label class="fld">Idioma<input id="fcIdi" value="${esc(c.idioma || '')}" placeholder="pt, en…"></label></div>
          <datalist id="fcClis">${Cadastro.all().filter(x => x.id !== c.id).map(x => `<option value="${esc(x.nome)}">`).join('')}</datalist>
          <button class="cta sm" id="fcSalvaCad">Salvar cadastro</button>
        </section>
      </div>
      <div>
        <section class="card"><h3>Anotações</h3>
          <label class="fld">Etiquetas<input id="fcTags" value="${esc(f.tags || '')}" placeholder="VIP, vegana, alergia a lactose"></label>
          <label class="fld">O que você sabe dela<textarea id="fcNotas" rows="5" placeholder="Gostos, restrições, como chegou…">${esc(f.notas || '')}</textarea></label>
          <button class="cta sm" id="fcSalva">Salvar anotações</button>
          <div class="rulesep"></div>
          ${tfsHtmlFicha(tfs)}
          <div class="frow" style="margin-top:8px"><label class="fld grow"><input id="fcTf" placeholder="Nova tarefa: mandar o voucher sexta 10h"></label><button class="mini strong" id="fcTfAdd">+ tarefa</button><button class="mini" id="fcNtAdd">+ anotação</button></div>
        </section>
        <section class="card"><h3>Quem viaja com ${esc(opPrimeiro(c.nome))}</h3>
          ${[...junto.values()].map(p => `<div class="deprow">${p.clienteId ? `<a href="${fichaHref({ id: p.clienteId })}">${esc(p.nome)}</a>` : esc(p.nome)}<small class="mono">${idadeDe(p.nasc) != null ? idadeDe(p.nasc) + ' anos' : esc(p.nasc || '')}${p.vezes > 1 ? ' · ' + p.vezes + ' passeios' : ''}</small></div>`).join('') || '<p class="why">Ninguém ainda.</p>'}
        </section>
        ${indicou.length ? `<section class="card"><h3>Indicou · ${indicou.length}</h3>${indicou.map(x => `<div class="deprow"><a href="${fichaHref(x)}">${esc(x.nome)}</a><small>${x.criado ? new Date(x.criado).toLocaleDateString('pt-BR') : ''}</small></div>`).join('')}</section>` : ''}
        <section class="card" id="fcArqs"><h3>📁 Arquivos <small class="why">comprovantes e documentos</small></h3>
          ${Arquivos.lista({ clienteId: c.id }).map(a => `<div class="deprow"><a href="#" data-arq="${esc(a.id)}">${a.tipo === 'comprovante' ? '🧾' : '📄'} ${esc(a.nome)}</a><small>${a.drive ? '✓ no Drive' : '⏳ ainda não subiu para o Drive'}</small></div>`).join('') || '<p class="why">Nenhum arquivo ainda. O que você mandar pelo assistente ou pelo 💵 Pagamento aparece aqui.</p>'}
          <p class="why">No Google Drive: <b>${esc(guiaNegocio())} › Clientes › ${esc(drvNome(c.nome))}</b></p>
          <label class="mini fc-arq-add">+ guardar um arquivo<input type="file" id="fcArq" accept="image/*,application/pdf" hidden></label>
        </section>
        ${(() => {
          /* de quem é o cliente + a comissão de cada serviço (paga ou não) */
          const comPar = ativas.map(b => ({ b, p: Parceiros.daReserva(b) })).filter(x => x.p);
          const semLigar = c.parceiroId ? ativas.filter(b => !Parceiros.daReserva(b)) : [];
          if (!comPar.length && !semLigar.length) return '';
          const devida = comPar.reduce((s, x) => s + Parceiros.comissaoDe(x.b), 0);
          const paga = comPar.reduce((s, x) => s + ((Parceiros.pagaDaReserva(x.b) || {}).valor || 0), 0);
          return `<section class="card fc-com"><h3>Comissão <small class="why">de quem é este cliente</small></h3>
            ${comPar.map(({ b, p }) => { const pg = Parceiros.pagaDaReserva(b); return `<div class="deprow">
              <span><b>${esc(p.nome)}</b> · ${+p.comissao || 0}% · ${esc(opNomeServ(b))} · ${opCurta(b.date)}</span>
              <span class="mono">${eur(Parceiros.comissaoDe(b))}</span>
              ${pg ? `<span class="pill ok">paga ${opCurta(pg.data)}</span><button class="mini" data-compaga="${esc(b.id)}|0">desfazer</button>`
                   : `<button class="mini strong" data-compaga="${esc(b.id)}|1">marcar paga</button>`}</div>`; }).join('')}
            ${semLigar.length && par ? `<p class="why">${semLigar.length} serviço(s) deste cliente ainda não estão ligados a ${esc(par.nome)}. <button class="mini" id="fcLigaPar">ligar a ${esc(par.nome)}</button></p>` : ''}
            ${comPar.length ? `<p class="why">Comissão deste cliente: <b>${eur(devida)}</b> · paga ${eur(paga)} · falta <b>${eur(Math.max(0, devida - paga))}</b></p>` : ''}
          </section>`;
        })()}
        <section class="card"><h3>Pedidos e orçamentos</h3>
          ${orcamentos.map(o => `<div class="deprow"><a href="#/adm/consulta/${esc(o.id)}">${esc(o.num)}</a><span>${o.itens.length} itens · ${eur(Orc.total(o))}</span>${opOrcPill(o)}</div>`).join('')}
          ${pedidos.map(p => `<div class="deprow"><span>🗺️ Monte seu roteiro · ${p.ini ? opCurta(p.ini) : ''}</span><span class="pill ${p.respondido ? 'ok' : 'warn'}">${p.respondido ? 'respondido' : 'novo'}</span></div>`).join('')}
          ${!orcamentos.length && !pedidos.length ? '<p class="why">Nenhum.</p>' : ''}
        </section>
      </div>
    </div>`);
  const re = () => admFicha(arg);
  opLigaCards(re); tfLigaMini(re);
  $$('[data-compaga]').forEach(b => b.onclick = () => { const [id, v] = b.dataset.compaga.split('|'); Parceiros.pagaReserva(id, v === '1'); toast(v === '1' ? 'Comissão marcada como paga' : 'Desfeito'); re(); });
  if ($('#fcLigaPar')) $('#fcLigaPar').onclick = () => { for (const b of ativas) if (!Parceiros.daReserva(b)) { b.parceiroId = c.parceiroId; _opSaveBooking(b); } toast('Ligado ao parceiro'); re(); };
  $('#fcArq').onchange = (e) => { const f = e.target.files[0]; if (!f) return; Arquivos.guarda({ blob: f, nome: `${isoToday()} ${f.name}`, tipo: /comprov|pix|recibo/i.test(f.name) ? 'comprovante' : 'documento', clienteId: c.id, clienteNome: c.nome }); toast('Arquivo guardado'); re(); };
  $('#fvSalva').onclick = () => { Cadastro.salva(c.id, { viagem: { hotel: $('#fvHotel').value.trim(), chegada: $('#fvCheg').value.trim(), partida: $('#fvPart').value.trim(), bagagem: $('#fvBag').value.trim() } }); toast('Viagem salva'); re(); };
  $('#fcSalvaCad').onclick = () => {
    const indNome = $('#fcInd').value.trim(), indC = indNome ? Cadastro.all().find(x => x.id !== c.id && _nomeN(x.nome) === _nomeN(indNome)) : null;
    const nasc = $('#fcNasc').value.trim();
    if (nasc && !nascOk(nasc)) { $('#fcNasc').focus(); return toast('Nascimento em dd/mm/aaaa'); }
    Cadastro.salva(c.id, { nome: $('#fcNome').value, nasc, whats: $('#fcWa').value, email: $('#fcEm').value, insta: $('#fcIg').value, pais: $('#fcPais').value,
      veioPor: $('#fcVeio').value, indicadoPor: indC ? indC.id : '', indicadoNome: indC ? indC.nome : indNome, parceiroId: $('#fcPar').value, idioma: $('#fcIdi').value });
    toast('Cadastro salvo'); re();
  };
  mascaraNasc($('#fcNasc'));
  $('#fcSalva').onclick = () => { Fichas.salva(k, { notas: $('#fcNotas').value, tags: $('#fcTags').value }); toast('Anotações salvas'); re(); };
  const nova = (tipo) => {
    const t0 = $('#fcTf').value.trim(); if (!t0) { $('#fcTf').focus(); return toast('Escreva a tarefa.'); }
    const p = lerPrazo(t0);
    Tarefas.cria({ tipo, texto: t0, prazo: tipo === 'nota' ? '' : p.data, hora: tipo === 'nota' ? '' : p.hora, repete: p.repete, clienteKey: k, clienteNome: c.nome, whats: c.whats });
    toast(tipo === 'nota' ? 'Anotação salva' : 'Tarefa criada'); re();
  };
  $('#fcTfAdd').onclick = () => nova('tarefa');
  $('#fcNtAdd').onclick = () => nova('nota');
  const fo = $('#fcOrc'); if (fo) fo.onclick = (e) => { e.preventDefault(); const o = Orc.cria({ origem: 'manual', status: 'rascunho', clienteKey: k, cliente: { nome: c.nome, whats: c.whats, email: c.email } }); go('/adm/consulta/' + o.id); };
}
function tfsHtmlFicha(tfs) {
  const abertas = tfs.filter(t => t.tipo === 'tarefa' && !t.feita), notas = tfs.filter(t => t.tipo === 'nota');
  return (abertas.length ? tfMiniHtml(abertas, isoToday(), '') : '<p class="why">Nenhuma tarefa aberta.</p>')
    + notas.map(n => `<div class="nt-card mini"><b>${esc(n.texto)}</b>${n.detalhe ? `<p>${esc(n.detalhe)}</p>` : ''}<small class="why">${new Date(n.criada).toLocaleDateString('pt-BR')}</small></div>`).join('');
}

/* =====================================================
   FOLLOW-UP — quem está esperando um retorno da Ingrid
   (vive dentro de Clientes, como um filtro "⏰ Follow-up")
===================================================== */
function followupMotivo(c, r, hoje) {
  if (!c || !r) return null;
  if (r.deve > 0) return { urg: 0, cor: 'bad', rotulo: 'Cobrar', txt: `deve ${eur(r.deve)}`, acao: 'cobrar',
    msg: `Oi ${opPrimeiro(c.nome)}! Passando só pra acertar o restante (${eur(r.deve)}) do passeio. Qualquer coisa estou à disposição 😊` };
  if (r.prox) {
    const d = _dias(hoje, r.prox.date);
    if (d >= 0 && d <= 3) return { urg: 1, cor: 'warn', rotulo: 'Confirmar', txt: `passeio ${d === 0 ? 'hoje' : 'em ' + d + ' dia' + (d > 1 ? 's' : '')} · ${nomeDoServico(r.prox)}`, acao: 'confirmar',
      msg: `Oi ${opPrimeiro(c.nome)}! Tudo certo pro seu ${nomeDoServico(r.prox)}${d === 0 ? ' de hoje' : ' em ' + crmData(r.prox.date)}? Fico à disposição, um beijo da ${guiaNome()} 💚` };
    return null;
  }
  if (r.ultima) {
    const d = _dias(r.ultima, hoje);
    if (d >= 150) return { urg: 3, cor: 'n', rotulo: 'Retomar', txt: `${Math.round(d / 30)} meses sem passeio`, acao: 'retomar',
      msg: `Oi ${opPrimeiro(c.nome)}! Saudades por aqui 😊 Se pensar em voltar a ${baseNome() || 'viajar'} — ou indicar alguém — é só me chamar. Um beijo da ${guiaNome()}!` };
  }
  return null;
}
function fupListaHtml(lista, resumo, hoje) {
  if (!lista.length) return '<p class="empty">Ninguém precisa de retorno agora. Tudo em dia 💚</p>';
  return '<p class="why" style="margin:0 0 10px">Quem está esperando um retorno seu — do mais urgente ao mais tranquilo. O botão já abre o WhatsApp com a mensagem escrita; você só revisa e envia.</p>'
    + lista.slice(0, 200).map(c => {
      const r = resumo.get(c.id), m = followupMotivo(c, r, hoje); if (!m) return '';
      const num = opNum(c.whats || (c.grupoDe && (Cadastro.get(c.grupoDe) || {}).whats));
      return `<div class="fu-row">
        <span class="cl-nome"><b>${esc(c.nome)}</b><small>${esc(m.txt)}</small></span>
        <span class="pill ${m.cor}">${m.rotulo}</span>
        <span class="fu-btns">${num ? `<a class="mini strong" target="_blank" rel="noopener" href="${waLink(m.msg, num)}">💬 ${m.acao}</a>` : '<small class="why">sem WhatsApp</small>'}<a class="mini" href="${fichaHref(c)}">ficha</a></span>
      </div>`;
    }).join('');
}

/* =====================================================
   CLIENTES — o dashboard (quem sao, de onde vem, quem indica)
===================================================== */
function admClientes() {
  const S = admClientes._s = admClientes._s || { q: '', f: 'todos' };
  const hoje = isoToday(), mes = +hoje.slice(5, 7), mesIso = hoje.slice(0, 7);
  const todos = Cadastro.all();
  const resumo = new Map(todos.map(c => [c.id, Cadastro.resumo(c, hoje)]));
  const compradores = todos.filter(c => !c.grupoDe);
  const novos = todos.filter(c => String(c.criado || '').slice(0, 7) === mesIso).length;
  const voltaram = compradores.filter(c => DB.bookings.filter(b => b.clienteId === c.id && b.status !== 'cancelled').length > 1).length;
  const porIndic = compradores.filter(c => c.veioPor === 'indicacao').length;
  const aniv = todos.map(c => ({ c, dia: aniversarioNoMes(c.nasc, mes) })).filter(x => x.dia).sort((a, b) => a.dia - b.dia);
  const origens = VEIO_POR.map(([v, nome]) => ({ v, nome, n: compradores.filter(c => c.veioPor === v).length })).filter(o => o.n);
  const semOrigem = compradores.filter(c => !c.veioPor).length;
  const indicadores = todos.map(c => ({ c, n: Cadastro.indicou(c).length + Cadastro.trouxe(c).length, ind: Cadastro.indicou(c).length, tr: Cadastro.trouxe(c).length })).filter(x => x.n).sort((a, b) => b.n - a.n).slice(0, 6);
  const n = (v) => _nomeN(v), q = n(S.q), dig = String(S.q).replace(/\D/g, '');
  let lista = todos.filter(c => !q || n(c.nome).includes(q) || n(c.email).includes(q) || (dig.length >= 4 && String(c.whats || '').replace(/\D/g, '').includes(dig)));
  const F = {
    todos: () => true, compradores: (c) => !c.grupoDe, junto: (c) => !!c.grupoDe,
    marcado: (c) => !!resumo.get(c.id).prox, devem: (c) => resumo.get(c.id).deve > 0, voltaram: (c) => DB.bookings.filter(b => b.clienteId === c.id).length > 1,
    followup: (c) => !!followupMotivo(c, resumo.get(c.id), hoje),
  };
  const paraRetorno = todos.filter(c => !!followupMotivo(c, resumo.get(c.id), hoje)).length;
  lista = lista.filter(F[S.f] || (c => c.veioPor === S.f));
  if (S.f === 'followup') lista.sort((a, b) => { const ma = followupMotivo(a, resumo.get(a.id), hoje) || {}, mb = followupMotivo(b, resumo.get(b.id), hoje) || {}; return (ma.urg ?? 9) - (mb.urg ?? 9) || resumo.get(b.id).deve - resumo.get(a.id).deve || a.nome.localeCompare(b.nome); });
  else lista.sort((a, b) => { const ra = resumo.get(a.id), rb = resumo.get(b.id); return (rb.prox ? 1 : 0) - (ra.prox ? 1 : 0) || String((ra.prox || {}).date || '').localeCompare(String((rb.prox || {}).date || '')) || rb.gasto - ra.gasto || a.nome.localeCompare(b.nome); });
  const maxO = Math.max(1, ...origens.map(o => o.n));
  admShell('clients', `${cliTopo('clientes')}
    <div class="pagehead"><h1 class="pageh">Clientes</h1>
      <div class="chips"><button class="mini strong" id="clNovo">+ novo cliente</button><button class="mini" id="clCsv">baixar planilha</button></div></div>
    <div class="rp-tiles cl-tiles">
      ${rpTile('Clientes', String(todos.length), `<span class="rp-d n">${compradores.length} compraram · ${todos.length - compradores.length} vieram junto</span>`, '', '')}
      ${rpTile('Novos este mês', String(novos), '', '', 'cadastros feitos este mês')}
      ${rpTile('Voltaram', String(voltaram), `<span class="rp-d ok">${compradores.length ? Math.round(voltaram / compradores.length * 100) : 0}% dos que compraram</span>`, '', 'mais de uma reserva')}
      ${rpTile('Por indicação', compradores.length ? Math.round(porIndic / compradores.length * 100) + '%' : '—', '', '', `${porIndic} clientes indicados por alguém`)}
      ${rpTile('Aniversários este mês', String(aniv.length), '', '', 'bom motivo para mandar uma mensagem')}
      ${rpTile('Devem a você', eur([...resumo.values()].reduce((s2, r) => s2 + r.deve, 0)), '', '', `${[...resumo.values()].filter(r => r.deve).length} clientes`)}
      ${rpTile('Para dar retorno', String(paraRetorno), paraRetorno ? '<span class="rp-d n">tem gente esperando</span>' : '<span class="rp-d ok">tudo em dia</span>', '', 'use o filtro ⏰ Follow-up')}
    </div>
    <div class="two-col rp-duas">
      <section class="card"><h3>De onde vêm</h3>
        ${origens.length ? `<div class="rp-hbars">${origens.map(o => `<button class="rp-hb cl-orig" data-f="${o.v}"><span class="rp-hb-nome">${esc(o.nome)}</span><span class="rp-hb-pista"><i style="width:${Math.max(2, o.n / maxO * 100)}%"></i><em>${o.n} · ${Math.round(o.n / compradores.length * 100)}%</em></span></button>`).join('')}</div>` : '<p class="why">Sem dados ainda.</p>'}
        ${semOrigem ? `<p class="why">${semOrigem} sem "veio por" — preencha na ficha para o mapa ficar certo.</p>` : ''}
      </section>
      <section class="card"><h3>Quem mais indica e traz gente</h3>
        ${indicadores.map(x => `<div class="deprow"><a href="${fichaHref(x.c)}">${esc(x.c.nome)}</a><small>${x.ind ? x.ind + ' indicado(s)' : ''}${x.ind && x.tr ? ' · ' : ''}${x.tr ? x.tr + ' junto' : ''}</small></div>`).join('') || '<p class="why">Ninguém ainda.</p>'}
        ${aniv.length ? `<div class="rulesep"></div><span class="op-lbl">Aniversários este mês</span>${aniv.map(x => `<div class="deprow"><a href="${fichaHref(x.c)}">${esc(x.c.nome)}</a><small class="mono">dia ${x.dia}${idadeDe(x.c.nasc) != null ? ' · faz ' + (idadeDe(x.c.nasc) + (x.dia >= +hoje.slice(8, 10) ? 1 : 0)) : ''}</small>
          ${(x.c.whats || (x.c.grupoDe && (Cadastro.get(x.c.grupoDe) || {}).whats)) ? `<a class="mini" target="_blank" rel="noopener" href="${waLink(`Oi ${opPrimeiro(x.c.nome)}! Feliz aniversário! 🎉 Um beijo da ${guiaNome()}, de Roma.`, opNum(x.c.whats || Cadastro.get(x.c.grupoDe).whats))}">💬 parabéns</a>` : ''}</div>`).join('')}` : ''}
      </section>
    </div>
    <div class="crm-filtros">
      <input id="clQ" type="search" placeholder="🔎 nome, WhatsApp ou e-mail" value="${esc(S.q)}">
      <div class="chips" style="margin:0">${[['followup', `⏰ Follow-up${paraRetorno ? ' (' + paraRetorno + ')' : ''}`], ['todos', 'Todos'], ['compradores', 'Compraram'], ['junto', 'Vieram junto'], ['marcado', 'Com serviço marcado'], ['devem', 'Devem'], ['voltaram', 'Voltaram']].map(([f, l]) => `<button class="chip ${S.f === f ? 'on' : ''}${f === 'followup' ? ' chip-fup' : ''}" data-f="${f}">${l}</button>`).join('')}
        ${VEIO_POR.some(v => v[0] === S.f) ? `<button class="chip on" data-f="${S.f}">${esc(veioPorNome(S.f))} ✕</button>` : ''}</div>
    </div>
    <section class="card cl-lista">
      ${S.f === 'followup' ? fupListaHtml(lista, resumo, hoje) : lista.length ? lista.slice(0, 200).map(c => { const r = resumo.get(c.id), dono = c.grupoDe ? Cadastro.get(c.grupoDe) : null;
        return `<a class="cl-row" href="${fichaHref(c)}">
          <span class="cl-nome"><b>${esc(c.nome)}</b><small>${c.veioPor ? esc(veioPorNome(c.veioPor)) + (c.indicadoNome ? ' — ' + esc(c.indicadoNome) : '') : 'veio por: ?'}${dono ? ' · veio com ' + esc(dono.nome) : ''}${idadeDe(c.nasc) != null ? ' · ' + idadeDe(c.nasc) + ' anos' : ''}</small></span>
          <span class="cl-prox">${r.prox ? `<small>próximo</small><b>${crmData(r.prox.date)} · ${esc(nomeDoServico(r.prox).slice(0, 34))}</b>` : r.ultima ? `<small>último</small><b>${crmData(r.ultima)}/${r.ultima.slice(2, 4)}</b>` : '<small>sem serviço</small>'}</span>
          <span class="cl-num"><small>${r.reservas} passeio(s)</small><b>${eur(r.gasto)}</b></span>
          ${r.deve ? `<span class="pill bad">deve ${eur(r.deve)}</span>` : '<span></span>'}
        </a>`; }).join('') : '<p class="empty">Nenhum cliente com esse filtro.</p>'}
      ${lista.length > 200 ? `<p class="why">Mostrando 200 de ${lista.length}. Use a busca.</p>` : ''}
    </section>
    <details class="card" id="clNovoBox"><summary><b>+ Novo cliente</b></summary>
      <div class="frow"><label class="fld">Nome completo<input id="ncNome"></label><label class="fld">WhatsApp<input id="ncWa"></label></div>
      <div class="frow"><label class="fld">Veio por<select id="ncVeio"><option value="">—</option>${VEIO_POR.map(([vv, nn]) => `<option value="${vv}">${nn}</option>`).join('')}</select></label><label class="fld">Indicado por<input id="ncInd" list="clClis"></label></div>
      <datalist id="clClis">${todos.map(x => `<option value="${esc(x.nome)}">`).join('')}</datalist>
      <button class="cta sm" id="ncSalva">Cadastrar</button></details>`);
  const re = () => admClientes();
  $$('[data-f]').forEach(b => b.onclick = () => { S.f = S.f === b.dataset.f && b.classList.contains('cl-orig') ? 'todos' : b.dataset.f; re(); });
  $('#clQ').oninput = (e) => { S.q = e.target.value; clearTimeout(admClientes._t); admClientes._t = setTimeout(() => { re(); const i2 = $('#clQ'); if (i2) { i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); } }, 250); };
  $('#clNovo').onclick = () => { const d = $('#clNovoBox'); d.open = true; d.scrollIntoView({ block: 'center' }); $('#ncNome').focus(); };
  $('#ncSalva').onclick = () => {
    const nome = $('#ncNome').value.trim(); if (!nome) return toast('Falta o nome.');
    const indN = $('#ncInd').value.trim(), indC = indN ? Cadastro.all().find(x => _nomeN(x.nome) === _nomeN(indN)) : null;
    const c = Cadastro.novo({ nome, whats: $('#ncWa').value, veioPor: $('#ncVeio').value || (indN ? 'indicacao' : ''), indicadoPor: indC ? indC.id : '', indicadoNome: indC ? indC.nome : indN });
    if (c) go(fichaHref(c).slice(1)); else toast('Não cadastrou');
  };
  $('#clCsv').onclick = () => {
    const linhas = [['Nome', 'WhatsApp', 'E-mail', 'Instagram', 'Nascimento', 'Idade', 'País/cidade', 'Veio por', 'Indicado por', 'Veio com', 'Passeios', 'Pagou', 'Deve', 'Próximo serviço', 'Cliente desde'],
      ...todos.map(c => { const r = resumo.get(c.id), dono = c.grupoDe ? Cadastro.get(c.grupoDe) : null;
        return [c.nome, c.whats, c.email, c.insta, c.nasc, idadeDe(c.nasc) ?? '', c.pais, veioPorNome(c.veioPor), c.indicadoNome, dono ? dono.nome : '', r.reservas, r.gasto, r.deve, r.prox ? r.prox.date : '', String(c.criado || '').slice(0, 10)]; })];
    opBaixa('clientes-' + negocioArquivo() + '-' + hoje + '.csv', linhas);
  };
}

/* =====================================================
   CONTABILIDADE
===================================================== */
function admContabilidade() {
  const S = admContabilidade._s = admContabilidade._s || { mes: isoToday().slice(0, 7), ano: false };
  const hoje = isoToday();
  const de = S.modo === 'custom' && S.de ? S.de : S.ano ? S.mes.slice(0, 4) + '-01-01' : S.mes + '-01';
  const ate = S.modo === 'custom' && S.ate ? S.ate : S.ano ? S.mes.slice(0, 4) + '-12-31' : addDays(addDays(S.mes + '-28', 4).slice(0, 7) + '-01', -1);
  const rows = extratoContas(de, ate);
  const lado = (l) => rows.filter(r => r.lado === l);
  const soma = (a) => a.reduce((s, r) => s + r.amount, 0);
  const br = lado('brasil'), eu = lado('europa'), pr = lado('prestador');
  const porConta = {};
  for (const r of rows) { const k = r.conta || ('metodo:' + r.method); (porConta[k] = porConta[k] || { n: 0, v: 0, lado: r.lado, nome: r.conta ? Contas.nome(r.conta) : formaPg(r.method) + ' (sem conta)' }); porConta[k].n++; porConta[k].v += r.amount; }
  const ac = acertos(de, ate);
  const KIND = { full: 'integral', deposit: 'sinal/parcial', balance: 'restante' };
  const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dd = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4);
  const titulo = S.modo === 'custom' ? `${dd(de)} a ${dd(ate)}` : S.ano ? 'Ano de ' + S.mes.slice(0, 4) : MESES[+S.mes.slice(5, 7) - 1] + ' de ' + S.mes.slice(0, 4);
  /* o que ainda falta repassar a guias/motoristas (acertos não marcados) */
  const aRepassar = ac.filter(a => a.custo && !a.acertado && a.saldo > 0).reduce((s, a) => s + a.saldo, 0);
  const seuCaixa = soma(br) + soma(eu);
  const saidas = saidasDoPeriodo(de, ate), totSai = saidas.reduce((s2, x) => s2 + x.valor, 0);
  const liquido = Math.round((seuCaixa - totSai) * 100) / 100;
  const margens = margensDoPeriodo(de, ate);
  const SAI_TIPO = { servico: '👤 Guia/motorista', parceiro: '🤝 Parceiro', comissao: '💸 Comissão', despesa: '🧾 Despesa' };
  const tabela = (lista, vazio) => lista.length ? `<table class="tbl"><thead><tr><th>Data</th><th>Cliente</th><th>Serviço</th><th>Tipo</th><th>Conta</th><th class="right">Valor</th></tr></thead>
    <tbody>${lista.map(r => `<tr><td class="mono">${r.date}</td><td>${esc(r.client)}</td><td>${esc(opNomeServ(r))}</td><td>${KIND[r.kind] || r.kind}</td>
      <td>${esc(r.conta ? Contas.nome(r.conta) : formaPg(r.method))}</td><td class="mono right">${eur(r.amount)}</td></tr>`).join('')}</tbody>
    <tfoot><tr><td colspan="5"><b>Total</b></td><td class="mono right"><b>${eur(soma(lista))}</b></td></tr></tfoot></table>` : `<p class="empty">${vazio}</p>`;

  admShell('money', `
    <div class="pagehead"><h1 class="pageh">Contabilidade · ${titulo}</h1>
      <div class="chips">
        <button class="mini" id="ctPrev">←</button>
        <button class="chip ${!S.ano && S.modo !== 'custom' && S.mes === hoje.slice(0, 7) ? 'on' : ''}" id="ctEste">este mês</button>
        <button class="chip ${S.ano && S.modo !== 'custom' ? 'on' : ''}" id="ctAno">o ano</button>
        <button class="mini" id="ctNext">→</button>
        <button class="mini" id="ctPrint">imprimir / PDF</button>
      </div></div>
    <div class="per-datas"><span class="per-lbl">Ou escolha o período:</span><input type="date" id="ctDe" value="${esc(S.modo === 'custom' ? de : '')}" aria-label="de"><span>até</span><input type="date" id="ctAte" value="${esc(S.modo === 'custom' ? ate : '')}" aria-label="até"><button class="mini ${S.modo === 'custom' ? 'strong' : ''}" id="ctVer">ver</button></div>
    <div class="kpis">
      <div class="kpi kpi-forte"><small>Seu caixa (${esc(ladoNome('brasil'))} + ${esc(ladoNome('europa'))})</small><b>${eur(seuCaixa)}</b><em>${rows.filter(r => r.lado !== 'prestador').length} pagamento(s)</em></div>
      <div class="kpi"><small>🇧🇷 Brasil</small><b>${eur(soma(br))}</b></div>
      <div class="kpi"><small>${ladoBandeira('europa')} ${esc(ladoNome('europa'))}</small><b>${eur(soma(eu))}</b></div>
      <div class="kpi"><small>Saídas</small><b>${eur(totSai)}</b><em>${saidas.length} lançamento(s)</em></div>
      <div class="kpi kpi-forte"><small>Líquido do caixa</small><b class="${liquido < 0 ? 'kpi-warn' : ''}">${eur(liquido)}</b><em>o que entrou − o que saiu no período</em></div>
      <div class="kpi"><small>Margem dos serviços</small><b>${eur(margens.reduce((s2, m) => s2 + m.margem, 0))}</b><em>dos ${margens.length} serviço(s) do período</em></div>
      <div class="kpi"><small>A repassar a guias/motoristas</small><b class="${aRepassar > 0 ? 'kpi-warn' : ''}">${eur(aRepassar)}</b><em>${aRepassar > 0 ? 'ainda não acertado' : 'tudo em dia'}</em></div>
      <div class="kpi"><small>Pago na mão às guias no dia</small><b>${eur(soma(pr))}</b><em>fora do seu caixa</em></div>
    </div>
    <section class="card">
      <h3>Por conta</h3>
      ${Object.keys(porConta).length ? `<table class="tbl"><thead><tr><th>Conta</th><th>Lado</th><th class="right">Pagamentos</th><th class="right">Total</th></tr></thead><tbody>
        ${Object.values(porConta).sort((a, b) => b.v - a.v).map(c => `<tr><td>${esc(c.nome)}</td><td>${c.lado === 'brasil' ? ladoBandeira('brasil') + ' ' + ladoNome('brasil') : c.lado === 'europa' ? ladoBandeira('europa') + ' ' + ladoNome('europa') : 'fora do caixa'}</td><td class="right">${c.n}</td><td class="mono right">${eur(c.v)}</td></tr>`).join('')}
      </tbody></table>` : '<p class="empty">Nenhum pagamento no período.</p>'}
      <p class="why">As suas contas e de que lado do caixa cada uma fica estão em Ajustes → Suas contas.</p>
    </section>
    <section class="card">
      <div class="pagehead"><span class="seclabel" style="flex:1">${ladoBandeira('europa')} Para o contador — ${esc(ladoNome('europa'))}</span><button class="mini" id="csvEu">baixar planilha (CSV)</button></div>
      ${tabela(eu, 'Nada entrou nas contas — ' + ladoNome('europa') + ' — no período.')}
    </section>
    <section class="card">
      <div class="pagehead"><span class="seclabel" style="flex:1">🇧🇷 Para o contador do Brasil</span><button class="mini" id="csvBr">baixar planilha (CSV)</button></div>
      ${tabela(br, 'Nada entrou nas contas — ' + ladoNome('brasil') + ' — no período.')}
    </section>
    <section class="card">
      <div class="pagehead"><h3 style="margin:0;flex:1">Tudo que sai</h3><button class="mini" id="csvSai">baixar saídas (CSV)</button></div>
      ${saidas.length ? `<table class="tbl"><thead><tr><th>Data</th><th>Tipo</th><th>O quê</th><th class="right">Valor</th><th></th></tr></thead><tbody>
        ${saidas.map(x => `<tr><td class="mono">${opCurta(x.data)}</td><td>${SAI_TIPO[x.tipo] || x.tipo}</td><td>${esc(x.desc)}</td><td class="mono right">${eur(x.valor)}</td>
          <td>${x.tipo === 'despesa' ? `<button class="mini danger" data-dsrm="${esc(x.id)}" aria-label="tirar">✕</button>` : ''}</td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="3"><b>Total que sai</b></td><td class="mono right"><b>${eur(totSai)}</b></td><td></td></tr></tfoot></table>` : '<p class="empty">Nada saiu no período.</p>'}
      <div class="frow ds-add">
        <label class="fld sm">Data<input type="date" id="dsData" value="${hoje}"></label>
        <label class="fld grow">Despesa<input id="dsDesc" placeholder="ex.: licença de guia, anúncio no Instagram, combustível"></label>
        <label class="fld sm">Valor (${moedaSigla()})<input id="dsVal" type="number" min="0" step="0.01"></label>
        <label class="fld sm">Tipo<select id="dsCat">${DESP_CAT.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select></label>
        <button class="cta sm" id="dsAdd">+ lançar</button>
      </div>
      <p class="why">O custo de guia/motorista vem do campo "custo" de cada serviço; o dos parceiros, da aba Parceiros; a comissão, de Indicações e cupons. Aqui você lança o que não é de um serviço.</p>
    </section>
    <section class="card">
      <h3>Margem por serviço <small class="why">o que o cliente paga − o que sai por ele</small></h3>
      ${margens.length ? `<table class="tbl"><thead><tr><th>Dia</th><th>Serviço · cliente</th><th class="right">Cliente paga</th><th class="right">Custos</th><th class="right">Fica com você</th></tr></thead><tbody>
        ${margens.map(m => `<tr><td class="mono">${opCurta(m.b.date)}</td><td>${esc(opNomeServ(m.b))} · ${esc(m.b.name)}</td><td class="mono right">${eur(m.receita)}</td><td class="mono right">${eur(m.custo)}</td><td class="mono right"><b>${eur(m.margem)}</b></td></tr>`).join('')}
      </tbody><tfoot><tr><td colspan="2"><b>Total</b></td><td class="mono right"><b>${eur(margens.reduce((s2, m) => s2 + m.receita, 0))}</b></td><td class="mono right"><b>${eur(margens.reduce((s2, m) => s2 + m.custo, 0))}</b></td><td class="mono right"><b>${eur(margens.reduce((s2, m) => s2 + m.margem, 0))}</b></td></tr></tfoot></table>` : '<p class="empty">Nenhum serviço no período.</p>'}
    </section>
    <section class="card">
      <h3>Acerto com guias e motoristas</h3>
      <p class="why">"Custo" é o que você paga a quem fez o serviço (preencha em Detalhes, no cartão do serviço). O que a pessoa recebeu do cliente no dia já conta como pagamento a ela.</p>
      ${ac.length ? `<table class="tbl"><thead><tr><th>Dia</th><th>Quem</th><th>Serviço</th><th class="right">Custo</th><th class="right">Recebeu do cliente</th><th>Acerto</th><th></th></tr></thead><tbody>
        ${ac.map(a => `<tr class="${a.acertado ? 'ok' : ''}"><td class="mono">${opCurta(a.b.date)}</td><td>${esc(a.pessoa ? a.pessoa.nome : '?')}</td><td>${esc(opNomeServ(a.b))} · ${esc(a.b.name)}</td>
          <td class="mono right">${a.custo ? eur(a.custo) : '—'}</td><td class="mono right">${eur(a.comPrestador)}</td>
          <td>${!a.custo ? '<small class="why">falta o custo</small>' : a.saldo > 0 ? `você paga <b>${eur(a.saldo)}</b>` : a.saldo < 0 ? `devolve a você <b>${eur(-a.saldo)}</b>` : 'zerado'}</td>
          <td>${a.custo ? `<button class="mini ${a.acertado ? '' : 'strong'}" data-acert="${esc(a.b.id)}|${a.acertado ? '0' : '1'}">${a.acertado ? '✓ acertado' : 'marcar acertado'}</button>` : ''}</td></tr>`).join('')}
      </tbody></table>` : '<p class="empty">Nenhum serviço com guia ou motorista no período.</p>'}
      <div class="btnrow"><button class="mini" id="csvAc">baixar acertos (CSV)</button><button class="mini" id="csvTudo">baixar tudo (CSV)</button></div>
    </section>`);
  const mudaMes = (n) => { S.modo = ''; const d = new Date(S.mes + '-15T12:00:00'); d.setMonth(d.getMonth() + (S.ano ? n * 12 : n)); S.mes = d.toISOString().slice(0, 7); admContabilidade(); };
  $('#ctPrev').onclick = () => mudaMes(-1);
  $('#ctNext').onclick = () => mudaMes(1);
  $('#ctEste').onclick = () => { S.modo = ''; S.mes = hoje.slice(0, 7); S.ano = false; admContabilidade(); };
  $('#ctAno').onclick = () => { S.modo = ''; S.ano = !S.ano; admContabilidade(); };
  $('#ctVer') && ($('#ctVer').onclick = () => { const d1 = $('#ctDe').value, d2 = $('#ctAte').value; if (!d1 || !d2 || d1 > d2) return toast('Escolha as duas datas (de ≤ até)'); S.modo = 'custom'; S.de = d1; S.ate = d2; admContabilidade(); });
  $('#ctPrint').onclick = () => print();
  $('#dsAdd').onclick = () => { const r = Despesas.salva({ data: $('#dsData').value, desc: $('#dsDesc').value, valor: $('#dsVal').value, categoria: $('#dsCat').value }); if (r.erro) return toast(r.erro); toast('Despesa lançada'); admContabilidade(); };
  $$('[data-dsrm]').forEach(b => b.onclick = () => { if (confirm('Tirar esta despesa?')) { Despesas.remove(b.dataset.dsrm); admContabilidade(); } });
  $('#csvSai').onclick = () => opBaixa(`saidas-${de}-a-${ate}.csv`, [['Data', 'Tipo', 'O quê', 'Valor (' + moedaCodigo() + ')'], ...saidas.map(x => [x.data, SAI_TIPO[x.tipo] || x.tipo, x.desc, String(x.valor).replace('.', ',')])]);
  const cab = ['Data', 'Cliente', 'Serviço', 'Tipo', 'Conta', 'Lado', 'Valor (' + moedaCodigo() + ')', 'Código'];
  const lin = (l) => l.map(r => [r.date, r.client, opNomeServ(r), KIND[r.kind] || r.kind, r.conta ? Contas.nome(r.conta) : formaPg(r.method), r.lado, String(r.amount).replace('.', ','), r.code]);
  $('#csvEu').onclick = () => opBaixa(`contador-${ladoNome('europa').toLowerCase().replace(/\s+/g, '-')}-${de}-a-${ate}.csv`, [cab, ...lin(eu)]);
  $('#csvBr').onclick = () => opBaixa(`contador-brasil-${de}-a-${ate}.csv`, [cab, ...lin(br)]);
  $('#csvTudo').onclick = () => opBaixa(`recebimentos-${de}-a-${ate}.csv`, [cab, ...lin(rows)]);
  $('#csvAc').onclick = () => opBaixa(`acertos-${de}-a-${ate}.csv`, [['Dia', 'Quem', 'Serviço', 'Cliente', 'Custo', 'Recebeu do cliente', 'Saldo (positivo = você paga)', 'Acertado'],
    ...ac.map(a => [a.b.date, a.pessoa ? a.pessoa.nome : '', opNomeServ(a.b), a.b.name, a.custo, a.comPrestador, a.saldo, a.acertado ? 'sim' : 'não'])]);
  $$('[data-acert]').forEach(b => b.onclick = () => { const [id, v] = b.dataset.acert.split('|'); marcaAcertado(id, v === '1'); admContabilidade(); });
}

/* =====================================================
   SOB CONSULTA — pedidos e orcamentos
===================================================== */
function opOrcPill(o) {
  const st = ORC_STATUS.find(s => s[0] === o.status) || ORC_STATUS[0];
  const cl = { novo: 'warn', rascunho: 'warn', enviado: 'n', fechado: 'ok', perdido: 'bad' }[o.status] || 'n';
  return `<span class="pill ${cl}">${L(st[1], st[2])}</span>`;
}
const ORIGEM_ORC = { whats: '💬 WhatsApp', site: '🧾 pelo app', roteiro: '🗺️ Monte seu roteiro', manual: '✍️ você' };
/* O CRM DELA — a planilha "CRM" dentro do app.
   As mesmas abas (CRM, Confirmado, Avaliar, Finalizado, Perdido), as mesmas
   colunas na vista Planilha, e em cartoes a PROXIMA ACAO de cada pedido. */
function crmEtapaPill(e, st) {
  const cls = { aberto: 'warn', confirmado: 'ok', avaliar: 'warn', finalizado: 'ok', perdido: 'bad' }[e] || 'n';
  const txt = e === 'aberto' ? ({ novo: 'Novo', rascunho: 'Em montagem', enviado: 'Enviado' }[st] || 'Aberto') : (CRM_ETAPAS.find(x => x[0] === e) || [0, e])[1];
  return `<span class="pill ${cls}">${esc(txt)}</span>`;
}
/* as colunas de link da planilha dela: o que o app gera (PDF do orcamento,
   voucher) e o que ela colou (pelo nome do link) */
function crmLinksCels(r) {
  const o = r.tipo === 'orcamento' ? r.o : (r.b && r.b.orcamentoId ? Orc.get(r.b.orcamentoId) : null);
  const todos = [...(r.links || []), ...((o && o.links) || [])];
  const acha = (re) => todos.filter(l => re.test(l.nome)).map(l => `<a target="_blank" rel="noopener" href="${esc(l.url)}">${esc(l.nome)}</a>`).join('<br>');
  const comprov = r.b ? (r.b.payments || []).filter(p => p.comprovante || p.arquivoId).map((p, k) => p.arquivoId ? `<a href="#" data-arq="${esc(p.arquivoId)}">📎 comprovante ${k + 1}</a>` : `<a target="_blank" rel="noopener" href="${esc(p.comprovante)}">comprovante ${k + 1}</a>`).join('<br>') : '';
  const aval = r.b && r.b.avaliacaoEm ? (DB.settings.linkAvaliacao ? `<a target="_blank" rel="noopener" href="${esc(DB.settings.linkAvaliacao)}">pedida ${crmData(r.b.avaliacaoEm)}</a>` : 'pedida ' + crmData(r.b.avaliacaoEm)) : '';
  return [esc(r.arquivo || (o ? Orc.nomeArquivo(o) : String(r.dataServ || '').replace(/-/g, '_') + ' ' + r.nome)),
    `${o ? `<a href="#/adm/orcdoc/${esc(o.id)}">PDF do orçamento</a>` : ''}${acha(/pdf/i) ? '<br>' + acha(/pdf/i) : ''}`,
    acha(/or[cç]amento|planilha/i),
    `${r.b ? `<a href="#/adm/voucher/${esc(r.b.id)}">voucher</a>` : ''}${acha(/voucher/i) ? '<br>' + acha(/voucher/i) : ''}`,
    `${comprov}${acha(/comprov/i) ? '<br>' + acha(/comprov/i) : ''}`,
    aval];
}
/* as colunas da planilha, na ordem dela, em grupos que ela pode esconder
   (como ocultar colunas no Google Planilhas). O NOME fica sempre fixo a esquerda. */
const CRM_GRUPOS = [['cli', 'Cliente'], ['serv', 'Serviço'], ['val', 'Valores'], ['par', 'Parceria'], ['st', 'Status'], ['rep', 'Repescagem'], ['arq', 'Arquivos e links']];
function crmColunas() {
  const m = (v) => v ? eur(v) : '';
  const rpx = (r, k) => (r.repescagens || []).find(y => y.n === k);
  const rp = (k) => (r) => { const x = rpx(r, k); return x && x.data ? crmData(x.data) : ''; };
  const rs = (k) => (r) => { const x = rpx(r, k); return x ? esc(x.resultado) : ''; };
  const lk = (i) => (r) => crmLinksCels(r)[i];
  const dd = (iso) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(2, 4) : '';
  const T = (c, val, t, extra) => ({ c, t: t || 'txt', val, ...(extra || {}) });
  const soOrc = (ed) => (r) => r.tipo === 'orcamento' ? ed : null;
  const linkUrl = (nome) => (r) => ((r.links || []).find(l => l.nome === nome) || {}).url || '';
  const VEIO_OPC = [['', '—'], ...Object.entries(VEIO_CURTO)];
  const ed = {
    data: soOrc(T('dataPedido', r => dd(r.dataPedido), 'data')), veio: () => T('veio', r => r.veioPor || '', 'sel', { opc: VEIO_OPC }), indicou: () => T('indicou', r => r.indicou || '', 'txt', { lista: 'crmQuemL' }),
    whats: () => T('whats', r => r.whats || ''), dataServ: () => T('dataServ', r => dd(r.dataServ), 'data'), hora: () => T('hora', r => r.hora || ''), pax: () => T('pax', r => String(r.pax || ''), 'num'),
    servico: () => T('servico', r => r.tipo === 'orcamento' ? ((r.o.itens.find(i => i.id === r.itemId) || {}).desc || '') : (r.b.servicoTxt || nomeDoServico(r.b)), 'txt', { lista: 'crmServL' }),
    obs: () => T('obs', r => r.obs || ''), cidade: () => T('cidade', r => r.cidade || ''),
    clientePaga: () => T('clientePaga', r => r.clientePaga ? String(r.clientePaga).replace('.', ',') : '', 'num'), ingridPaga: () => T('ingridPaga', r => r.ingridPaga ? String(r.ingridPaga).replace('.', ',') : '', 'num'),
    sinal: (r) => r.tipo === 'orcamento' ? T('sinal', x => x.sinal ? String(x.sinal).replace('.', ',') : '', 'num') : T('pagto', null, 'pagto'),
    forma: (r) => r.tipo === 'orcamento' ? T('forma', x => x.forma || '') : T('pagto', null, 'pagto'),
    emReal: (r) => r.tipo === 'orcamento' ? T('emReal', x => x.emReal ? String(x.emReal).replace('.', ',') : '', 'num') : T('pagto', null, 'pagto'),
    parceiro: () => T('parceiro', r => r.parceiro || ''), comVendor: () => T('comVendor', r => r.comVendor ? String(r.comVendor).replace('.', ',') : '', 'num'), comIndic: () => T('comIndic', r => r.comIndic ? String(r.comIndic).replace('.', ',') : '', 'num'),
    status: (r) => T('status', x => x.etapa === 'aberto' ? (x.status === 'enviado' ? 'enviado' : 'rascunho') : x.etapa, 'sel', { opc: CRM_STATUS_OPC[r.tipo] }),
    motivo: () => T('motivo', r => r.motivo || '', 'sel', { opc: [['', '—'], ...MOTIVOS_PERDA.map(m => [m, m])] }),
    arquivo: () => T('arquivo', r => r.arquivo || ''),
  };
  const edRep = (k) => soOrc(T('rep' + k, r => { const x = rpx(r, k); return x && x.data ? dd(x.data) : ''; }, 'data'));
  const edRes = (k) => soOrc(T('res' + k, r => { const x = rpx(r, k); return x ? x.resultado : ''; }));
  const edLk = (campo, nome) => () => T(campo, linkUrl(nome), 'url');
  return [
    { g: 'cli', ed: ed.data, h: 'Data', dica: 'a data do pagamento (se ainda não pagou, a do pedido)', v: r => r.tipo === 'reserva' && !r.dataPago ? `<span class="crm-sem" title="ainda sem pagamento — data do pedido">${crmDataSem(r.dataPedido)}</span>` : crmDataSem(r.dataPedido), c: 'mono' },
    { g: 'cli', ed: ed.veio, h: 'veio por', v: r => esc(r.veio) },
    { g: 'cli', ed: ed.indicou, h: 'Agência · indicação · influencer', dica: 'quem mandou o cliente: a agência, a pessoa que indicou ou o influencer', v: r => r.indicou ? `<b class="crm-quem">${esc(r.indicou)}</b>` : '' },
    { g: 'cli', ed: ed.whats, h: 'WhatsApp', v: r => r.whats ? `<a target="_blank" rel="noopener" href="${waLink('', opNum(r.whats))}">${esc(r.whats)}</a>` : '', c: 'mono' },
    { g: 'serv', ed: ed.dataServ, h: 'Data serviço', v: r => crmDataSem(r.dataServ), c: 'mono' },
    { g: 'serv', ed: ed.hora, h: 'Hora', v: r => esc(r.hora), c: 'mono' },
    { g: 'serv', ed: ed.pax, h: 'PAX', v: r => esc(r.pax), c: 'mono right', soma: r => +r.pax || 0, fmt: v => v },
    { g: 'serv', ed: ed.servico, h: 'Serviço pedido', v: r => esc(r.servico), c: 'crm-serv' },
    { g: 'serv', ed: ed.obs, h: 'Obs', v: r => esc(r.obs), c: 'crm-obs' },
    { g: 'serv', ed: ed.cidade, h: 'Cidade', v: r => esc(r.cidade) },
    { g: 'val', ed: ed.clientePaga, h: 'Cliente paga', v: r => m(r.clientePaga), c: 'mono right', soma: r => r.clientePaga || 0 },
    { g: 'val', ed: ed.ingridPaga, h: 'Custo (você paga)', v: r => m(r.ingridPaga), c: 'mono right', soma: r => r.ingridPaga || 0 },
    { g: 'val', h: 'Total', v: (r, prim) => prim ? m(r.totalPedido) : '<span class="crm-idem">〃</span>', c: 'mono right', somaPedido: r => r.totalPedido || 0 },
    { g: 'val', ed: ed.sinal, h: 'Sinal', v: r => m(r.sinal), c: 'mono right', soma: r => r.sinal || 0 },
    { g: 'val', ed: ed.forma, h: 'forma Pagamento', v: r => esc(r.forma) },
    { g: 'val', ed: ed.emReal, h: 'Em Real (se fez PIX)', v: r => r.emReal ? 'R$ ' + String(r.emReal).replace('.', ',') : '', c: 'mono right' },
    { g: 'par', ed: ed.parceiro, h: 'Parceiro', v: r => esc(r.parceiro) },
    { g: 'par', ed: ed.comVendor, h: 'Comissão vendor', v: r => m(r.comVendor), c: 'mono right', soma: r => r.comVendor || 0 },
    { g: 'par', ed: ed.comIndic, h: 'Comissão indicação', v: r => m(r.comIndic), c: 'mono right', soma: r => r.comIndic || 0 },
    { g: 'st', ed: ed.status, h: 'Status', v: r => crmEtapaPill(r.etapa, r.status) },
    { g: 'st', ed: ed.motivo, h: 'Motivo da perda', v: r => esc(r.motivo) },
    { g: 'rep', ed: edRep(1), h: 'Repescagem 1', v: rp(1), c: 'mono' }, { g: 'rep', ed: edRes(1), h: 'Resultado 1', v: rs(1) }, { g: 'rep', ed: edRep(2), h: 'Repescagem 2', v: rp(2), c: 'mono' }, { g: 'rep', ed: edRes(2), h: 'Resultado 2', v: rs(2) },
    { g: 'rep', ed: edRep(3), h: 'Repescagem 3', v: rp(3), c: 'mono' }, { g: 'rep', ed: edRes(3), h: 'Resultado 3', v: rs(3) },
    { g: 'arq', ed: ed.arquivo, h: 'Nome do arquivo', v: lk(0) }, { g: 'arq', ed: edLk('lPdf', 'PDF'), h: 'Link PDF', v: lk(1) }, { g: 'arq', ed: edLk('lOrc', 'Orçamento'), h: 'Link Orçamento', v: lk(2) },
    { g: 'arq', ed: edLk('lVoucher', 'Voucher'), h: 'Link Voucher', v: lk(3) }, { g: 'arq', ed: edLk('lComprov', 'Comprovante'), h: 'Link Comprov', v: lk(4) }, { g: 'arq', ed: edLk('lAval', 'Avaliação'), h: 'Link Avaliação', v: lk(5) },
  ];
}
const CRM_MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const crmChave = (r) => [r.tipo, r.id, r.itemId || ''].join('|');
function crmPlanilha(linhas, cols, editavel) {
  const vis = crmColunas().filter(c => !cols.includes(c.g));
  const grupos = []; vis.forEach(c => { const g = grupos[grupos.length - 1]; if (g && g.g === c.g) g.n++; else grupos.push({ g: c.g, n: 1 }); });
  const nomeG = Object.fromEntries(CRM_GRUPOS);
  const vistos = new Set();
  let mesAnt = null, corpo = '';
  for (const r of linhas) {
    const mes = String(r.dataServ || '').slice(0, 7) || 'sem data';
    if (mes !== mesAnt) {
      mesAnt = mes;
      const doMes = linhas.filter(x => (String(x.dataServ || '').slice(0, 7) || 'sem data') === mes);
      const nm = mes === 'sem data' ? 'Sem data de serviço' : CRM_MESES[+mes.slice(5, 7) - 1] + ' ' + mes.slice(0, 4);
      corpo += `<tr class="crm-mes"><td class="crm-fix">${nm}</td><td colspan="${vis.length}">${doMes.length} ${doMes.length === 1 ? 'serviço' : 'serviços'} · cliente paga ${eur(doMes.reduce((s2, x) => s2 + (x.clientePaga || 0), 0))}</td></tr>`;
    }
    const prim = !vistos.has(r.pedido); vistos.add(r.pedido);
    const alvo = r.tipo === 'orcamento' ? '#/adm/consulta/' + r.o.id : '#/adm/clients/' + encodeURIComponent('c:' + (r.b.clienteId || ''));
    const k = linhas.indexOf(r);
    const cel = (c) => { const e = editavel && c.ed ? c.ed(r) : null;
      return `<td class="${c.c || ''}${e ? ' crm-ed' + (e.t === 'pagto' ? ' crm-pg' : '') : ''}"${e ? ` data-k="${k}" data-c="${e.c}"` : ''}${e && e.t === 'pagto' ? ' title="entra pelo 💵 Pagamento"' : ''}>${c.v(r, prim) || ''}</td>`; };
    corpo += `<tr ${editavel ? '' : `data-ir="${esc(alvo)}"`} data-row="${esc(crmChave(r))}" class="crm-e-${r.etapa}${prim ? '' : ' crm-cont'}"><td class="crm-fix${editavel ? ' crm-ed' : ''}"${editavel ? ` data-k="${k}" data-c="nome"` : ''}><b>${prim || editavel ? esc((editavel ? r.nome : r.nomePlan || r.nome) || '') || '<span class="crm-vazio">nome…</span>' : '<span class="crm-idem">〃 ' + esc(opPrimeiro(r.nome)) + '</span>'}</b>
      ${editavel ? `<span class="crm-fix-acoes"><a class="crm-abre" href="${esc(alvo)}" title="${r.tipo === 'orcamento' ? 'abrir o orçamento' : 'abrir a ficha'}" aria-label="abrir">↗</a>${r.tipo === 'orcamento' && prim && r.etapa === 'aberto' ? `<button class="crm-mais" data-mais="${esc(r.o.id)}" title="mais um serviço neste pedido" aria-label="mais um serviço">＋</button>` : ''}</span>` : ''}</td>
      ${vis.map(cel).join('')}</tr>`;
  }
  const pedidos = new Map(linhas.map(r => [r.pedido, r]));
  const pe = vis.map(c => { const v = c.soma ? linhas.reduce((s2, r) => s2 + c.soma(r), 0) : c.somaPedido ? [...pedidos.values()].reduce((s2, r) => s2 + c.somaPedido(r), 0) : null;
    return `<td class="${c.c || ''}">${v == null ? '' : c.fmt ? c.fmt(v) : eur(v)}</td>`; }).join('');
  return `<div class="crm-plan-wrap"><table class="crm-plan"><thead>
      <tr class="crm-grp"><th class="crm-fix" rowspan="2">Nome</th>${grupos.map(g => `<th colspan="${g.n}" class="crm-g-${g.g}">${nomeG[g.g]}</th>`).join('')}</tr>
      <tr>${vis.map(c => `<th class="crm-g-${c.g}"${c.dica ? ` title="${esc(c.dica)}"` : ''}>${c.h}${c.dica ? ' <span class="crm-dica" aria-hidden="true">ⓘ</span>' : ''}</th>`).join('')}</tr></thead>
    <tbody>${corpo || `<tr><td class="crm-fix why">Nada aqui.</td><td colspan="${vis.length}"></td></tr>`}</tbody>
    ${linhas.length ? `<tfoot><tr><td class="crm-fix">${linhas.length} ${linhas.length === 1 ? 'serviço' : 'serviços'} · ${pedidos.size} ${pedidos.size === 1 ? 'pedido' : 'pedidos'}</td>${pe}</tr></tfoot>` : ''}</table></div>`;
}
function crmData(iso) { return iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '—'; }
/* dia da semana curto, como na planilha da Ingrid ("qui.", "sex.") */
const DIAS_SEM = ['dom.', 'seg.', 'ter.', 'qua.', 'qui.', 'sex.', 'sáb.'];
function diaSemanaCurto(iso) { if (!iso || iso.length < 10) return ''; const d = new Date(iso + 'T12:00:00'); return isNaN(d) ? '' : DIAS_SEM[d.getDay()]; }
/* data completa pra Planilha: dia/mês/ano + dia da semana (01/10/26 · qui.) */
function crmDataSem(iso) { if (!iso) return '—'; const s = diaSemanaCurto(iso); return iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(2, 4) + (s ? ` <span class="crm-dow">${s}</span>` : ''); }

/* =====================================================
   TABELA DE PREÇOS — as 4 abas do Excel dela, editáveis e com
   recálculo automático (ver precos.js). Amarra no orçamento.
===================================================== */
function prNum(n) { n = +n || 0; return (Number.isInteger(n) ? String(n) : n.toFixed(2)).replace('.', ','); }
const PR_COLS = {
  transfer: [
    { h: 'Pessoas', get: c => esc(c.pax) }, { h: 'Veículo', get: c => esc(c.veic), cls: 'pr-veic' },
    { h: PRECO_CARTAO ? 'Dinheiro' : 'Preço', key: 'preco', ed: 1 },
    ...(PRECO_CARTAO ? [{ h: 'Cartão', key: 'cartao' }] : []), ...(PRECO_NOTURNO_VEIC ? [{ h: 'Noturno', key: 'noturno' }] : []),
    ...(PRECO_CARTAO && PRECO_NOTURNO_VEIC ? [{ h: 'Not. cartão', key: 'noturnoCartao' }] : []),
    { h: 'por pessoa', key: 'porPessoa', pp: 1 }, { h: 'Custo', key: 'custo', ed: 1 }, { h: 'Sinal', key: 'sinal', forte: 1 },
  ],
  guia: [
    { h: 'Pessoas', get: c => esc(c.pax) }, { h: 'Duração', get: c => esc(c.dur) },
    { h: 'Cliente', key: 'preco', ed: 1 }, { h: 'por pessoa', key: 'porPessoa', pp: 1 }, { h: 'Custo', key: 'custo', ed: 1 }, { h: 'Sinal', key: 'sinal', forte: 1 }, { h: 'Ingressos', key: 'ingressos', ed: 1 },
  ],
  bv: [
    { h: 'Pessoas', get: c => esc(c.pax) }, { h: 'Cliente', key: 'preco', ed: 1 },
    { h: 'por pessoa', key: 'porPessoa', pp: 1 }, { h: 'Custo', key: 'custo', ed: 1 }, { h: 'Sinal', key: 'sinal', forte: 1 },
  ],
};
function admPrecos(sub) {
  const tabs = Precos.all();
  const atual = tabs.find(t => t.id === sub) || tabs[0];
  const tipo = Precos.base(atual).tipo, deriva = !!atual.derivaDe, editavel = !deriva;
  const cols = PR_COLS[tipo];
  const secoes = Precos.secoesView(atual);
  const seg = `<div class="pr-seg">${tabs.map(t => `<a class="pr-seg-b ${t.id === atual.id ? 'on' : ''}" href="#/adm/precos/${t.id}">${esc(t.nome)}</a>`).join('')}</div>`;
  const cel = (col, c) => {
    if (col.get) return `<td class="${col.cls || ''}">${col.get(c)}</td>`;
    const v = c[col.key];
    if (col.ed && editavel) return `<td class="pr-edc"><input class="pr-in" data-f="${col.key}" value="${prNum(v)}" inputmode="decimal" aria-label="${col.h}"></td>`;
    return `<td class="pr-c${col.pp ? ' pr-pp' : ''}${col.forte ? ' pr-forte' : ''}${col.ed ? ' pr-base' : ''}" data-c="${col.key}">${eur(v)}</td>`;
  };
  const linha = (s, c) => `<tr data-tab="${atual.id}" data-sec="${s.id}" data-lin="${c.ref}" data-tipo="${tipo}" data-paxn="${c.paxN}" data-veicn="${c.veicN || 1}">
      ${cols.map(col => cel(col, c)).join('')}
      <td class="pr-acao"><button class="mini pr-orc" data-orc="${atual.id}|${s.id}|${c.ref}" title="gerar um orçamento já com este item">➕ orçamento</button></td></tr>`;
  const bloco = (s) => `<section class="card pr-bloco"><h3 class="pr-sec">${esc(s.titulo)}</h3>
    <div class="pr-wrap"><table class="pr-tab"><thead><tr>${cols.map(c => `<th${c.ed ? ' class="pr-th-ed"' : ''}>${c.h}${c.ed && editavel ? ' ✏️' : ''}</th>`).join('')}<th></th></tr></thead>
    <tbody>${s.linhas.map(c => linha(s, c)).join('')}</tbody></table></div></section>`;
  const ajuda = editavel
    ? `Edite só o que está em <b>branco</b> (${tipo === 'transfer' ? (PRECO_CARTAO ? 'Dinheiro' : 'Preço') + ' e Custo' : tipo === 'guia' ? 'Cliente, Custo e Ingressos' : 'Cliente e Custo'}). O resto — por pessoa, sinal${tipo === 'transfer' && (PRECO_CARTAO || PRECO_NOTURNO_VEIC) ? ', cartão, noturno' : ''} — o app calcula sozinho, como no Excel. <b>Sinal = preço − custo</b> (a sua margem).`
    : `Esta tabela é a <b>${esc((Precos.base(atual) || {}).nome || '')}</b> com desconto. Mexeu nela, aqui acompanha sozinho — por isso ela não se edita direto.`;
  admShell('precos', `
    <div class="pagehead"><h1 class="pageh">Tabela de preços</h1>
      <span class="why">as suas tabelas do Excel, aqui dentro — e ligadas ao orçamento</span></div>
    ${seg}
    ${deriva ? `<section class="card pr-desc"><label class="fld sm">Desconto desta tabela<span class="pr-descin"><input id="prDesc" type="number" min="0" max="100" step="0.5" value="${Precos.descontoPct(atual)}"> %</span></label><button class="mini strong" id="prDescOk">aplicar</button></section>` : ''}
    <p class="why pr-ajuda">💡 ${ajuda}</p>
    ${secoes.map(bloco).join('') || '<p class="empty">Tabela vazia.</p>'}
  `);
  /* recálculo ao vivo + salvar */
  $$('.pr-tab tbody tr').forEach(tr => {
    const recalc = () => {
      const base = { preco: _precoNum((tr.querySelector('[data-f="preco"]') || {}).value || 0),
        custo: _precoNum((tr.querySelector('[data-f="custo"]') || {}).value || 0),
        ingressos: _precoNum((tr.querySelector('[data-f="ingressos"]') || {}).value || 0),
        paxN: +tr.dataset.paxn || 1, veicN: +tr.dataset.veicn || 1 };
      const c = Precos.calc(tr.dataset.tipo, base, 1);
      tr.querySelectorAll('.pr-c').forEach(td => { const k = td.dataset.c; if (c[k] != null) td.textContent = eur(c[k]); });
    };
    tr.querySelectorAll('.pr-in').forEach(inp => {
      inp.oninput = recalc;
      inp.onchange = () => { Precos.editaValor(tr.dataset.tab, tr.dataset.sec, tr.dataset.lin, inp.dataset.f, inp.value); recalc(); };
    });
  });
  $$('.pr-orc').forEach(b => b.onclick = () => {
    const it = Precos.itemOrc(b.dataset.orc); if (!it) return toast('Não consegui montar o item.');
    const o = Orc.cria({ origem: 'tabela', status: 'rascunho', itens: [it] });
    toast('Orçamento criado com este item · agora é só pôr o cliente');
    go('/adm/consulta/' + o.id);
  });
  if (deriva) { const bt = $('#prDescOk'); if (bt) bt.onclick = () => { Precos.setDesconto(atual.id, $('#prDesc').value); admPrecos(atual.id); }; }
}
/* modo 'planilha' = a aba Planilha: a planilha dela, para preencher celula por
   celula. Sem modo = a aba Orcamentos: o painel e os cartoes com a proxima acao. */
function admConsulta(arg, modo) {
  if (arg) return admOrcEditor(arg);
  const P = modo === 'planilha';
  let colsSalvas = []; try { colsSalvas = JSON.parse(localStorage.getItem('yalla_crm_cols') || '[]'); } catch (e) {}
  const S = P ? (admConsulta._sp = admConsulta._sp || { e: 'todos', vista: 'planilha', q: '', mes: '', cols: Array.isArray(colsSalvas) ? colsSalvas : [] })
              : (admConsulta._s = admConsulta._s || { e: 'aberto', vista: 'cartoes', q: '', mes: '', cols: Array.isArray(colsSalvas) ? colsSalvas : [] });
  if (P) S.vista = 'planilha';
  const hoje = isoToday();
  const todas = crmLinhas(hoje);
  const conta = Object.fromEntries(CRM_ETAPAS.map(([e]) => [e, new Set(todas.filter(r => r.etapa === e).map(r => r.pedido)).size]));
  const n = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const q = n(S.q).trim();
  let linhas = todas.filter(r => S.e === 'todos' || r.etapa === S.e)
    .filter(r => !q || [r.nome, r.whats, r.servico, r.obs, r.cidade, r.veio, r.indicou, r.parceiro].some(v => n(v).includes(q)))
    .filter(r => !S.mes || String(r.dataServ || '').slice(0, 7) === S.mes);
  if (S.e === 'finalizado' || S.e === 'perdido') linhas = linhas.reverse();
  /* os pedidos (cartoes): as linhas do mesmo pedido juntas */
  const pedidos = [];
  for (const r of linhas) { let p = pedidos.find(x => x.pedido === r.pedido); if (!p) { p = { pedido: r.pedido, linhas: [], r }; pedidos.push(p); } p.linhas.push(r); }
  const rotSemOrc = Roteiros.all().filter(p => !Orc.all().some(o => o.pedidoId === p.id));
  const doMes = todas.filter(r => !S.mes || String(r.dataServ || '').slice(0, 7) === S.mes);
  const pn = crmPainel(doMes, hoje);
  const ICO = { repescar: '🔁', montar: '✍️', sinal: '💵', avaliar: '⭐' };
  const agoraAcao = (a) => {
    if (a.tipo === 'montar') return `<a class="mini strong" href="#/adm/consulta/${esc(a.o.id)}">montar e mandar</a>`;
    if (a.tipo === 'repescar') return a.o.cliente.whats ? `<a class="mini strong" target="_blank" rel="noopener" data-repesca="${esc(a.o.id)}" href="${waLink(`Oi ${opPrimeiro(a.o.cliente.nome)}! Tudo bem? Conseguiu ver o orçamento que te mandei (${a.o.num})? Se quiser, ajusto alguma coisa. ${guiaNome()}`, opNum(a.o.cliente.whats))}">💬 repescar</a>` : `<a class="mini" href="#/adm/consulta/${esc(a.o.id)}">abrir</a>`;
    if (a.tipo === 'sinal') return `<a class="mini" href="#/adm/clients/${encodeURIComponent('c:' + (a.r.b.clienteId || ''))}">ficha</a>${a.r.whats ? `<a class="mini strong" target="_blank" rel="noopener" href="${waLink(`Oi ${opPrimeiro(a.r.nome)}! Para garantir a sua reserva (${nomeDoServico(a.r.b)}, ${opCurta(a.r.dataServ)}), falta só o sinal. Te mando os dados para pagamento? ${guiaNome()}`, opNum(a.r.whats))}">💬 cobrar sinal</a>` : ''}`;
    return a.r.whats ? `<a class="mini strong" target="_blank" rel="noopener" data-avalia="${esc(a.ids.join(','))}" href="${waLink(msgAvaliacao(a.r.b), opNum(a.r.whats))}">⭐ pedir avaliação</a>` : `<button class="mini" data-final="${esc(a.ids.join(','))}">já pedi</button>`;
  };
  const mesNome = S.mes ? CRM_MESES[+S.mes.slice(5, 7) - 1] + ' ' + S.mes.slice(0, 4) : 'todos os meses';
  const painel = P ? `<section class="crm-painel crm-painel-p" aria-label="Painel">
    <div class="crm-tiles">
      <button class="crm-tile t-warn" data-e="aberto"><small>Em aberto</small><b>${pn.abertos.n}</b><span>${pn.abertos.valor ? eur(pn.abertos.valor) : 'pedidos'}</span></button>
      <button class="crm-tile t-ok" data-e="confirmado"><small>Confirmados a fazer</small><b>${eur(pn.confirmados.valor)}</b><span>${pn.confirmados.n} pedidos</span></button>
      <button class="crm-tile" data-e="confirmado"><small>Falta receber</small><b>${eur(pn.confirmados.falta)}</b><span>sinal recebido ${eur(pn.confirmados.recebido)}</span></button>
      <button class="crm-tile" data-e="todos"><small>Fechamento</small><b>${pn.fecha.taxa == null ? '—' : Math.round(pn.fecha.taxa * 100) + '%'}</b><span>${pn.fecha.fechados} fechados · ${pn.fecha.perdidos} perdidos</span></button>
      <a class="crm-tile" href="#/adm/consulta"><small>⚡ Precisa de você</small><b>${pn.agora.length}</b><span>ver na aba Orçamentos</span></a>
    </div></section>` : `<section class="crm-painel" aria-label="Painel do CRM">
    <div class="crm-painel-top"><h2>Painel · ${esc(mesNome)}</h2><small class="why">toque num quadro para ver os pedidos</small></div>
    <div class="crm-tiles">
      <button class="crm-tile t-warn" data-e="aberto"><small>Em aberto</small><b>${pn.abertos.n}</b><span>${pn.abertos.n === 1 ? 'pedido' : 'pedidos'}${pn.abertos.valor ? ' · ' + eur(pn.abertos.valor) : ''}</span>${pn.abertos.naoMandados ? `<em>${pn.abertos.naoMandados} ainda não ${pn.abertos.naoMandados === 1 ? 'mandado' : 'mandados'}</em>` : ''}</button>
      <button class="crm-tile t-ok" data-e="confirmado"><small>Confirmados a fazer</small><b>${eur(pn.confirmados.valor)}</b><span>${pn.confirmados.n} ${pn.confirmados.n === 1 ? 'pedido' : 'pedidos'}</span></button>
      <button class="crm-tile" data-e="confirmado"><small>Falta receber</small><b>${eur(pn.confirmados.falta)}</b><span>sinal já recebido ${eur(pn.confirmados.recebido)}</span></button>
      <button class="crm-tile" data-e="todos"><small>Taxa de fechamento</small><b>${pn.fecha.taxa == null ? '—' : Math.round(pn.fecha.taxa * 100) + '%'}</b><span>${pn.fecha.fechados} fechados · ${pn.fecha.perdidos} perdidos</span>${pn.fecha.motivo ? `<em>perde mais por: ${esc(pn.fecha.motivo[0])}</em>` : ''}</button>
      <a class="crm-tile" href="#/adm/coupons"><small>Comissões a pagar</small><b>${eur(pn.comissoes.valor)}</b><span>${pn.comissoes.n ? pn.comissoes.n + (pn.comissoes.n === 1 ? ' parceiro' : ' parceiros') : 'tudo em dia'}</span></a>
    </div>
    <div class="crm-agora"><h3>⚡ Precisa de você ${pn.agora.length ? `<b>${pn.agora.length}</b>` : ''}</h3>
      ${pn.agora.length ? `<ul>${pn.agora.slice(0, S.agoraTudo ? 99 : 5).map(a => `<li><span class="crm-ag-i" aria-hidden="true">${ICO[a.tipo]}</span><div><b>${esc(a.nome || 'Sem nome')}</b><small>${esc(a.txt)}</small></div><div class="tacts">${agoraAcao(a)}</div></li>`).join('')}</ul>
        ${pn.agora.length > 5 ? `<button class="mini ghost" id="crmAgoraTudo">${S.agoraTudo ? 'mostrar menos' : `ver os ${pn.agora.length}`}</button>` : ''}` : '<p class="why">Nada esperando por você. 🎉</p>'}
    </div></section>`;
  const meses = [...new Set(todas.map(r => String(r.dataServ || '').slice(0, 7)).filter(Boolean))].sort();
  const MESN = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

  const acoes = (p) => {
    const r = p.r, b = r.b, o = r.o;
    if (r.tipo === 'orcamento' && r.etapa === 'aberto') return `<a class="mini strong" href="#/adm/consulta/${esc(o.id)}">${o.status === 'enviado' ? 'abrir' : 'montar e mandar'}</a>
      ${o.cliente.whats && o.status === 'enviado' ? `<a class="mini" target="_blank" rel="noopener" data-repesca="${esc(o.id)}" href="${waLink(`Oi ${opPrimeiro(o.cliente.nome)}! Tudo bem? Conseguiu ver o orçamento que te mandei (${o.num})? Se quiser, ajusto alguma coisa. ${guiaNome()}`, opNum(o.cliente.whats))}">💬 repescar</a>` : ''}
      <button class="mini" data-fecha="${esc(o.id)}">fechou ✓</button><button class="mini ghost" data-perde="${esc(o.id)}">perdido</button>`;
    if (r.tipo === 'orcamento' && r.etapa === 'perdido') return `<span class="why">${esc(o.motivoPerda || '')}</span><button class="mini ghost" data-reabre="${esc(o.id)}">reabrir</button>`;
    const ficha = `<a class="mini" href="#/adm/clients/${encodeURIComponent('c:' + (b.clienteId || ''))}">ficha</a>`;
    if (r.etapa === 'confirmado') return `${ficha}<a class="mini" href="#/adm/voucher/${esc(b.id)}">voucher</a>`;
    if (r.etapa === 'avaliar') return `${ficha}${b.whats ? `<a class="mini strong" target="_blank" rel="noopener" data-avalia="${esc(p.linhas.map(x => x.id).join(','))}" href="${waLink(msgAvaliacao(b), opNum(b.whats))}">⭐ pedir avaliação</a>` : ''}
      <button class="mini ghost" data-final="${esc(p.linhas.map(x => x.id).join(','))}">finalizado</button>`;
    return ficha;
  };
  const cartoes = pedidos.map(p => {
    const r = p.r, tot = r.totalPedido || p.linhas.reduce((s2, x) => s2 + (x.clientePaga || 0), 0);
    const rp = (r.repescagens || []).map(x => `${x.n}ª ${crmData(x.data)} · ${x.resultado}`).join(' | ');
    return `<article class="crm-card">
      <div class="crm-top"><b class="crm-nome">${esc(r.nome || 'Sem nome')}</b>${crmEtapaPill(r.etapa, r.status)}
        ${r.veio ? `<span class="crm-veio">${esc(r.veio)}${r.indicou ? ': <b>' + esc(r.indicou) + '</b>' : ''}</span>` : ''}${r.parceiro ? `<span class="crm-veio">🤝 ${esc(r.parceiro)}</span>` : ''}</div>
      <ul class="crm-linhas">${p.linhas.map(x => `<li><span class="mono">${crmData(x.dataServ)}${x.hora ? ' ' + esc(x.hora) : ''}</span><span>${esc(x.servico)}${x.pax ? ` <small>· ${esc(x.pax)}p</small>` : ''}${x.obs ? `<small> · ${esc(x.obs)}</small>` : ''}</span><b class="mono">${x.clientePaga ? eur(x.clientePaga) : '—'}</b></li>`).join('')}</ul>
      <div class="crm-pe"><span>Total <b>${eur(tot)}</b>${r.sinal ? ` · sinal ${eur(r.sinal)}` : ''}${r.forma ? ` · ${esc(r.forma)}` : ''}</span>
        ${rp ? `<small class="crm-rp">Repescagem: ${esc(rp)}</small>` : ''}
        <div class="tacts">${acoes(p)}${r.whats ? `<a class="mini ghost" target="_blank" rel="noopener" href="${waLink('', opNum(r.whats))}">WhatsApp</a>` : ''}</div></div>
    </article>`;
  }).join('');
  const colChips = `<div class="crm-cols"><span class="why">Colunas:</span>${CRM_GRUPOS.map(([g, nome]) => `<button class="chip ${S.cols.includes(g) ? '' : 'on'}" data-col="${g}" aria-pressed="${!S.cols.includes(g)}">${S.cols.includes(g) ? '' : '✓ '}${nome}</button>`).join('')}</div>`;
  admConsulta._linhas = linhas;
  const semPlanilha = !DB.bookings.some(b => b.origin === 'planilha') && !Orc.all().some(o => o.chavePlanilha);
  const planilha = (P ? `<div class="crm-plan-barra"><button class="cta sm" id="crmLinha">＋ nova linha</button><span class="why">Toque numa célula e escreva · <b>Enter</b> ou <b>Tab</b> vai para a próxima · Status <b>CONFIRMADO</b> vira reserva</span><span class="crm-salvo ${admConsulta._salvoEm ? 'ok' : ''}" role="status">${admConsulta._salvoEm ? '✓ Salvo às ' + admConsulta._salvoEm : '💾 Salva sozinha — não precisa de botão'}</span></div>` : '')
    + colChips + crmPlanilha(linhas, S.cols, P)
    + (P ? `<datalist id="crmServL">${Tours.all().filter(x => x.status !== 'draft').map(x => `<option value="${esc(x.name.pt)}">`).join('')}</datalist><datalist id="crmQuemL">${Parceiros.all().map(x => `<option value="${esc(x.nome)}">`).join('')}</datalist>` : '');

  admShell(P ? 'planilha' : 'consulta', `${cliTopo(P ? 'planilha' : 'crm')}
    ${P && semPlanilha ? `<section class="card crm-traga"><div><h3>📥 Comece trazendo a sua planilha CRM</h3>
      <p class="why">No Google Planilhas: <b>Arquivo › Fazer download › Valores separados por vírgula (.csv)</b>. Depois toque em <b>Importar a planilha</b> e escolha o arquivo. "Enviado" vira orçamento, "CONFIRMADO" vira reserva com o sinal — nada se perde, e importar de novo não duplica.</p></div>
      <button class="cta sm" id="crmTraga">Importar a planilha</button></section>` : ''}
    <div class="pagehead"><h1 class="pageh">${P ? 'Planilha · CRM' : 'Orçamentos'}</h1>
      <div class="chips">
        <button class="mini strong" id="crmNovo">+ novo orçamento</button>
        <button class="mini" id="crmImp">importar a planilha</button>
        <button class="mini" id="crmBaixa">baixar planilha</button>
      </div></div>
    ${painel}
    <div class="crm-etapas" role="tablist">${[...CRM_ETAPAS, ['todos', 'Todos']].map(([e, nome], k) =>
      `${k && k < CRM_ETAPAS.length - 1 ? '<span class="crm-seta" aria-hidden="true">→</span>' : ''}<button class="crm-etapa ${S.e === e ? 'on' : ''}" data-e="${e}" role="tab" aria-selected="${S.e === e}">${e === 'aberto' ? '📨 Em aberto' : nome}${e !== 'todos' ? ` <b>${conta[e]}</b>` : ''}</button>`).join('')}</div>
    <div class="crm-filtros">
      <input id="crmQ" type="search" placeholder="🔎 nome, WhatsApp, serviço, hotel…" value="${esc(S.q)}">
      <select id="crmMes"><option value="">todos os meses</option>${meses.map(m => `<option value="${m}" ${S.mes === m ? 'selected' : ''}>${MESN[+m.slice(5, 7) - 1]} ${m.slice(0, 4)}</option>`).join('')}</select>
      ${P ? '' : `<div class="chips crm-vistas" style="margin:0"><button class="chip ${S.vista === 'cartoes' ? 'on' : ''}" data-vista="cartoes">🗂️ cartões</button><button class="chip ${S.vista === 'planilha' ? 'on' : ''}" data-vista="planilha">📋 planilha</button></div>`}
    </div>
    <section class="card" id="crmNovoBox" ${Orc.all().length ? 'hidden' : ''}>
      <h3>+ Novo orçamento <small class="why">cole a conversa do WhatsApp ou comece em branco</small></h3>
      <label class="fld">Conversa do WhatsApp / Instagram / e-mail<textarea id="ccTxt" rows="5" placeholder="Cole aqui a conversa inteira. O app tira nome, telefone, datas, quantas pessoas, cidades e serviços."></textarea></label>
      <div class="btnrow"><button class="cta sm" id="ccLer">Ler e montar o rascunho</button><button class="mini" id="ccBranco">começar em branco</button></div>
      <div id="ccPrev"></div>
    </section>
    <section class="card" id="crmImpBox" hidden><h3>Importar a planilha CRM <small class="why">no Google Planilhas: Arquivo → Fazer download → .csv</small></h3>
      <p class="why">O app lê as colunas pelo nome (Data, veio por, Whatsapp, Nome, Data Serviço, Hora, PAX, Serviço pedido, Obs, Cliente Paga, Custo, Cidade). Cada linha vira uma reserva e cada nome um cadastro. Importar de novo não duplica.</p>
      <label class="fld">Arquivo .csv<input type="file" id="crmArq" accept=".csv,text/csv"></label><div id="crmImpPrev"></div></section>
    ${rotSemOrc.length ? `<section class="card"><h3>🗺️ Monte seu roteiro · ${rotSemOrc.length}</h3>
      ${rotSemOrc.map(p => `<div class="orc-row"><div class="tinfo"><b>${esc(p.nome)}</b><small>${[p.ini && opCurta(p.ini), p.fim && opCurta(p.fim)].filter(Boolean).join(' → ')} · ${p.adultos} adultos${p.criancas ? ' + ' + p.criancas + ' crianças' : ''} · ${(p.onde || []).join(', ')}${p.modo === 'consultoria' ? ' · <b>consultoria</b>' : ''}</small></div>
        <button class="mini strong" data-rot="${esc(p.id)}">Montar orçamento</button></div>`).join('')}</section>` : ''}
    ${S.vista === 'planilha' ? planilha : (cartoes || '<p class="empty">Nada nesta etapa.</p>')}`);

  const re = () => admConsulta(undefined, modo);
  if (P) crmLigaEdicao(re);
  $('#crmTraga')?.addEventListener('click', () => { const d = $('#crmImpBox'); d.hidden = false; d.scrollIntoView({ block: 'start' }); $('#crmArq').click(); });
  $$('[data-e]').forEach(b => b.onclick = () => { S.e = b.dataset.e; re(); });
  $$('[data-vista]').forEach(b => b.onclick = () => { S.vista = b.dataset.vista; re(); });
  $('#crmMes').onchange = (e) => { S.mes = e.target.value; re(); };
  $('#crmQ').oninput = (e) => { S.q = e.target.value; clearTimeout(admConsulta._t); admConsulta._t = setTimeout(() => { re(); const i2 = $('#crmQ'); if (i2) { i2.focus(); i2.setSelectionRange(i2.value.length, i2.value.length); } }, 250); };
  $('#crmNovo').onclick = () => { const d = $('#crmNovoBox'); d.hidden = false; d.scrollIntoView({ block: 'start' }); $('#ccTxt').focus(); };
  $('#crmImp').onclick = () => { const d = $('#crmImpBox'); d.hidden = false; d.scrollIntoView({ block: 'start' }); };
  $$('[data-col]').forEach(b => b.onclick = () => { const g = b.dataset.col; S.cols = S.cols.includes(g) ? S.cols.filter(x => x !== g) : [...S.cols, g]; try { localStorage.setItem('yalla_crm_cols', JSON.stringify(S.cols)); } catch (e) {} re(); });
  if ($('#crmAgoraTudo')) $('#crmAgoraTudo').onclick = () => { S.agoraTudo = !S.agoraTudo; re(); };
  $('#crmBaixa').onclick = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + crmCsv(todas)], { type: 'text/csv;charset=utf-8' })); a.download = 'CRM-' + negocioArquivo() + '-' + hoje + '.csv'; a.click(); };
  $('#crmArq').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const txt = await f.text(), sim = importarPlanilha(txt, true), box = $('#crmImpPrev');
    if (sim.erro) { box.innerHTML = `<div class="alert bad">${esc(sim.erro)}</div>`; return; }
    box.innerHTML = `<div class="alert warn bkp-volta"><div><b>${sim.linhas.length} linhas de ${sim.clientes} clientes</b><br><small>viram ${sim.orcamentos} ${sim.orcamentos === 1 ? 'orçamento em aberto ou perdido' : 'orçamentos (em aberto ou perdidos)'} e ${sim.reservas} ${sim.reservas === 1 ? 'reserva confirmada' : 'reservas confirmadas'}, pelo Status de cada linha</small>${sim.pulou.length ? `<br><small>${sim.pulou.length} linha(s) sem data de serviço ficaram de fora</small>` : ''}</div><button class="cta sm" id="crmImpOk">Importar</button></div>`;
    $('#crmImpOk').onclick = () => { const r = importarPlanilha(txt); if (P) S.e = 'todos'; toast(r.erro || `${r.orcamentos ? r.orcamentos + ' orçamentos · ' : ''}${r.criadas} reservas importadas${r.repetidas ? ` · ${r.repetidas} já estavam no app` : ''}`); S.e = 'todos'; re(); };
  };
  $$('tr[data-ir]').forEach(tr => tr.onclick = (e) => { if (!e.target.closest('a')) location.hash = tr.dataset.ir; });
  $$('[data-fecha]').forEach(b => b.onclick = () => go('/adm/consulta/' + b.dataset.fecha));
  $$('[data-perde]').forEach(b => b.onclick = () => {
    const box = b.closest('.tacts');
    box.innerHTML = `<select class="crm-motivo">${MOTIVOS_PERDA.map(m => `<option>${m}</option>`).join('')}</select><button class="mini strong" data-perdeok="${esc(b.dataset.perde)}">marcar perdido</button>`;
    box.querySelector('[data-perdeok]').onclick = () => { perdeOrcamento(b.dataset.perde, box.querySelector('.crm-motivo').value); Tarefas.sincroniza(); toast('Marcado como perdido'); re(); };
  });
  $$('[data-reabre]').forEach(b => b.onclick = () => { Orc.status(b.dataset.reabre, 'enviado'); re(); });
  $$('[data-avalia]').forEach(a => a.addEventListener('click', () => { a.dataset.avalia.split(',').forEach(marcaAvaliacao); setTimeout(() => { toast('Avaliação pedida · foi para Finalizado'); re(); }, 400); }));
  $$('[data-final]').forEach(b => b.onclick = () => { b.dataset.final.split(',').forEach(marcaAvaliacao); re(); });
  $$('[data-repesca]').forEach(a => a.addEventListener('click', () => {
    const o = Orc.get(a.dataset.repesca); const t0 = Tarefas.all().find(t => !t.feita && t.orcId === o.id && t.etapa === 'aguardar');
    if (t0) Tarefas.conclui(t0.id, 'cutucar'); else { o.repescagens = o.repescagens || []; o.repescagens.push({ n: o.repescagens.length + 1, data: isoToday(), resultado: 'mandada' }); _opSave(); }
    const nov = Tarefas.all().find(t => !t.feita && t.orcId === o.id && t.etapa !== 'aguardar'); if (nov) Tarefas.conclui(nov.id);
    setTimeout(() => { toast('Repescagem registrada · aguardando resposta'); re(); }, 400);
  }));
  $('#ccBranco').onclick = () => { const o = Orc.cria({ origem: 'manual', status: 'rascunho' }); go('/adm/consulta/' + o.id); };
  $('#ccLer').onclick = () => {
    const txt = $('#ccTxt').value;
    if (!txt.trim()) return toast('Cole a conversa primeiro.');
    const c = lerConversa(txt), itens = rascunhoDaConversa(c);
    $('#ccPrev').innerHTML = `<div class="cc-lido"><p><b>O que o app entendeu</b> — confira:</p>
      <ul><li>Nome: <b>${esc(c.nome || '?')}</b></li><li>WhatsApp: <b>${esc(c.whats || '?')}</b></li><li>Resumo: ${esc(c.resumo || '—')}</li><li>Rascunho: ${itens.length} ${itens.length === 1 ? 'serviço' : 'serviços'} com preço da tabela</li></ul>
      <button class="cta sm" id="ccCria">Criar o orçamento</button></div>`;
    $('#ccCria').onclick = () => {
      const o = Orc.cria({ origem: 'whats', status: 'rascunho', cliente: { nome: c.nome, whats: c.whats }, conversa: txt, resumo: c.resumo, pax: c.pax, datas: c.datas, itens });
      Tarefas.cria({ tipo: 'nota', origem: 'whats', texto: `Resumo do WhatsApp — ${c.nome || 'cliente novo'}`, detalhe: c.resumo, orcId: o.id, clienteNome: c.nome, whats: c.whats });
      go('/adm/consulta/' + o.id);
    };
  };
  $$('[data-rot]').forEach(b => b.onclick = () => {
    const p = (DB.pedidos || []).find(x => x.id === b.dataset.rot); if (!p) return;
    const o = Orc.cria({ origem: 'roteiro', status: 'rascunho', pedidoId: p.id, cliente: { nome: p.nome, whats: p.whats, email: p.email },
      resumo: msgRoteiro(p).split('\n').slice(1, 6).join(' · '), itens: rascunhoDoRoteiro(p), pax: (+p.adultos || 0) + (+p.criancas || 0) });
    go('/adm/consulta/' + o.id);
  });
}

/* A EDICAO NA PLANILHA: toque na celula -> campo; Enter grava (e desce),
   Tab grava e vai para a direita, Esc desiste. Depois de gravar a tela e
   redesenhada no MESMO lugar (a rolagem da planilha e da pagina volta). */
function crmLigaEdicao(re) {
  const wrap = $('.crm-plan-wrap'); if (!wrap) return;
  const redesenha = (row, campo, dir) => {
    const w0 = $('.crm-plan-wrap'), sl = w0 ? w0.scrollLeft : 0, st = w0 ? w0.scrollTop : 0, sy = scrollY;
    re();
    const w1 = $('.crm-plan-wrap'); if (w1) { w1.scrollLeft = sl; w1.scrollTop = st; } scrollTo(0, sy);
    if (!dir) return;
    const tr = [...document.querySelectorAll('.crm-plan tr[data-row]')].find(x => x.dataset.row === row); if (!tr) return;
    let alvo = null;
    if (dir === 'dir' || dir === 'esq') { const cs = [...tr.querySelectorAll('td[data-c]')], i = cs.findIndex(td => td.dataset.c === campo); alvo = cs[i + (dir === 'dir' ? 1 : -1)]; }
    else if (dir === 'baixo') { let n = tr.nextElementSibling; while (n && !n.dataset.row) n = n.nextElementSibling; alvo = n && n.querySelector(`td[data-c="${campo}"]`); }
    if (alvo) crmCelula(alvo, redesenha);
  };
  wrap.addEventListener('click', (e) => {
    if (e.target.closest('a,button,input,select')) return;
    const td = e.target.closest('td[data-c]'); if (td && !td.classList.contains('crm-editando')) crmCelula(td, redesenha);
  });
  $$('[data-mais]').forEach(b => b.onclick = () => { const it = crmMaisServico(b.dataset.mais); const o = Orc.get(b.dataset.mais);
    redesenha(crmChave({ tipo: 'orcamento', id: o.id, itemId: it.id }), 'nome', null);
    const tr = [...document.querySelectorAll('.crm-plan tr[data-row]')].find(x => x.dataset.row === crmChave({ tipo: 'orcamento', id: o.id, itemId: it.id }));
    const td = tr && tr.querySelector('td[data-c="servico"]'); if (td) { td.scrollIntoView({ block: 'nearest', inline: 'center' }); crmCelula(td, redesenha); } });
  $('#crmLinha')?.addEventListener('click', () => {
    const o = crmNovaLinha(); const S = admConsulta._sp; if (S) { S.e = 'todos'; S.q = ''; S.mes = ''; }
    const row = crmChave({ tipo: 'orcamento', id: o.id, itemId: o.itens[0].id });
    re();
    const tr = [...document.querySelectorAll('.crm-plan tr[data-row]')].find(x => x.dataset.row === row);
    const td = tr && tr.querySelector('td[data-c="nome"]'); if (td) { tr.scrollIntoView({ block: 'center' }); crmCelula(td, redesenha); }
  });
}
function crmCelula(td, redesenha) {
  const r = (admConsulta._linhas || [])[+td.dataset.k]; if (!r) return;
  const campo = td.dataset.c, row = crmChave(r);
  if (campo === 'pagto') { ATALHO.pagto(r.b); return; }
  const col = campo === 'nome' ? { t: 'txt', val: x => x.nome || '' } : (() => { for (const c of crmColunas()) { const e = c.ed && c.ed(r); if (e && e.c === campo) return e; } return null; })();
  if (!col) return;
  const atual = String(col.val(r) ?? '');
  td.classList.add('crm-editando');
  td.innerHTML = col.t === 'sel'
    ? `<select aria-label="${esc(campo)}">${col.opc.map(([v, l]) => `<option value="${esc(v)}" ${v === atual ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`
    : `<input aria-label="${esc(campo)}" value="${esc(atual)}" ${col.t === 'num' ? 'inputmode="decimal"' : ''} ${col.t === 'data' ? 'placeholder="dd/mm" inputmode="numeric"' : ''} ${col.t === 'url' ? 'placeholder="https://…" inputmode="url"' : ''} ${col.lista ? `list="${col.lista}"` : ''}>`;
  const inp = td.firstElementChild; inp.focus(); if (inp.select && col.t !== 'sel') inp.select();
  let feito = false;
  const salva = (dir) => {
    if (feito) return; feito = true;
    const v = inp.value;
    if (v !== atual) {
      const res = crmEdita({ tipo: r.tipo, id: r.id, itemId: r.itemId }, campo, v);
      if (res.erro) { toast(res.erro); redesenha(row, campo, null); return; }
      if (res.reservas != null) toast(`✓ Confirmado: ${res.reservas} ${res.reservas === 1 ? 'reserva criada' : 'reservas criadas'} na agenda`);
      admConsulta._salvoEm = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    redesenha(row, campo, dir);
  };
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); salva('baixo'); }
    else if (e.key === 'Tab') { e.preventDefault(); salva(e.shiftKey ? 'esq' : 'dir'); }
    else if (e.key === 'Escape') { e.preventDefault(); feito = true; redesenha(row, campo, null); }
  });
  if (col.t === 'sel') inp.addEventListener('change', () => salva(null));
  inp.addEventListener('blur', () => setTimeout(() => salva(null), 0));
}

function opMsgOrc(o) {
  const nome = opPrimeiro(o.cliente.nome) || '';
  const tot = Orc.total(o), sin = Orc.sinal(o);
  const l = [`Olá${nome ? ' ' + nome : ''}! Segue o seu orçamento ${o.num} — ${guiaNegocio()}`, ''];
  o.itens.forEach((i, n) => l.push(`${n + 1}. ${i.desc}${i.data ? ' — ' + opCurta(i.data) + (i.hora ? ' ' + i.hora : '') : ''} · ${i.pax} ${i.pax > 1 ? 'pessoas' : 'pessoa'} — ${i.valor ? eur(i.valor) : 'a definir'}`));
  if (o.paxNota || o.bagagem) l.push('', [o.paxNota && 'Pessoas: ' + o.paxNota, o.bagagem && 'Bagagem: ' + o.bagagem].filter(Boolean).join(' · '));
  l.push('', `Total: ${eur(tot)}`);
  if (sin) l.push(`Para reservar: sinal de ${eur(sin)}. O restante (${eur(Math.max(0, tot - sin))}) ${restoTexto()}.`);
  const formas = [DB.settings.pixKey && 'Pix', DB.settings.wiseLink && 'Wise', DB.settings.iban && 'transferência (IBAN)'].filter(Boolean);
  if (formas.length) l.push('Formas de pagamento: ' + formas.join(' · '));
  l.push(`Orçamento válido até ${opCurta(o.validade)}.`);
  if (o.termos) l.push('', 'Ao pagar o sinal você declara que leu e aceita os termos e condições:', termosTexto().replace(/^MODELO.*\n\n?/, ''));
  l.push('', guiaNome());
  return l.join('\n');
}

function admOrcEditor(id) {
  const o = Orc.get(id);
  if (!o) { go('/adm/consulta'); return; }
  const tours = Tours.all();
  const tot = Orc.total(o), sin = Orc.sinal(o);
  const linhaItem = (i) => `<div class="orc-item ${i.sugestao ? 'sug' : ''}" data-item="${esc(i.id)}">
    <div class="frow">
      <label class="fld grow">Serviço<input data-k="desc" value="${esc(i.desc)}"></label>
      <label class="fld">Dia<input type="date" data-k="data" value="${esc(i.data)}"></label>
      <label class="fld sm">Hora<input data-k="hora" value="${esc(i.hora)}" placeholder="09:00"></label>
      <label class="fld sm">Pessoas<input type="number" min="1" data-k="pax" value="${i.pax}"></label>
      <label class="fld sm">Valor ${moedaSigla()}<input type="number" min="0" data-k="valor" value="${i.valor}"></label>
      <label class="fld sm">Sinal ${moedaSigla()}<input type="number" min="0" data-k="sinal" value="${i.sinal ?? ''}" placeholder="${Orc.sinalDoItem(o, i)}"></label>
      <label class="fld sm" title="o que você paga a quem faz o serviço">Custo ${moedaSigla()}<input type="number" min="0" data-k="custo" value="${i.custo || ''}" placeholder="0"></label>
      ${(Tours.get(i.tourId) || {}).priceMode === 'transfer' ? `<label class="fld sm">Voo<input data-k="voo" value="${esc(i.voo || '')}" placeholder="AZ 673"></label>` : ''}
    </div>
    <div class="orc-item-pe">
      ${i.tourId ? `<small class="why">da tabela: ${esc((Tours.get(i.tourId) || { name: { pt: '?' } }).name.pt)}</small>` : '<small class="why">item avulso (não vira reserva)</small>'}
      ${i.sugestao ? '<span class="pill warn">sugestão do app — confira</span>' : ''}
      <input class="orc-obs" data-k="obs" value="${esc(i.obs)}" placeholder="observação para o cliente">
      ${i.tourId ? `<button class="mini" data-recalc="${esc(i.id)}">preço da tabela</button>` : ''}
      <button class="mini danger" data-rmi="${esc(i.id)}">tirar</button>
    </div>
  </div>`;
  admShell('consulta', `
    <a class="linkbtn" href="#/adm/consulta">← Orçamentos</a>
    <div class="pagehead"><h1 class="pageh">${esc(o.num)} ${opOrcPill(o)}</h1>
      <div class="chips">
        <a class="mini" href="#/adm/orcdoc/${esc(o.id)}">ver / imprimir PDF</a>
        ${o.cliente.whats ? `<a class="mini cta-ish" id="orWa" target="_blank" rel="noopener" href="${waLink(opMsgOrc(o), opNum(o.cliente.whats))}">💬 mandar no WhatsApp</a>` : ''}
        <button class="mini" id="orCopia">copiar texto</button>
      </div></div>
    ${o.conversa || o.resumo ? `<details class="card"><summary><b>O pedido</b> <small class="why">${esc(o.resumo || '')}</small></summary>
      ${o.conversa ? `<pre class="pdmsg">${esc(o.conversa)}</pre>` : ''}</details>` : ''}
    <section class="card">
      <h3>Cliente</h3>
      <div class="frow">
        <label class="fld">Nome<input id="orNome" value="${esc(o.cliente.nome)}"></label>
        <label class="fld">WhatsApp<input id="orWhats" value="${esc(o.cliente.whats)}"></label>
        <label class="fld">E-mail<input id="orEmail" value="${esc(o.cliente.email)}"></label>
      </div>
    </section>
    <section class="card">
      <h3>Serviços</h3>
      <div id="orItens">${o.itens.map(linhaItem).join('') || '<p class="why">Nenhum serviço ainda.</p>'}</div>
      <div class="frow orc-add">
        <label class="fld grow">Acrescentar da sua tabela<select id="orAddT"><option value="">escolha…</option>
          ${regioes().map(([rg, pt]) => { const ts = tours.filter(x => x.region === rg); return ts.length ? `<optgroup label="${esc(pt)}">${ts.map(x => `<option value="${esc(x.id)}">${esc(x.name.pt)}</option>`).join('')}</optgroup>` : ''; }).join('')}
          ${typeof Precos !== 'undefined' ? Precos.all().map(t => Precos.secoesView(t).map(s => s.linhas.length ? `<optgroup label="${esc('💵 ' + t.nome + ' · ' + s.titulo.slice(0, 44))}">${s.linhas.map(c => `<option value="${esc(t.id + '|' + s.id + '|' + c.ref)}">${esc(Precos.rotuloCurto(t, c))}</option>`).join('')}</optgroup>` : '').join('')).join('') : ''}
        </select></label>
        <label class="fld sm">Pessoas<input type="number" min="1" id="orAddP" value="${o.pax || 2}"></label>
        <label class="fld">Dia<input type="date" id="orAddD"></label>
        <button class="mini strong" id="orAdd">+ acrescentar</button>
        <button class="mini" id="orAvulso">+ item avulso</button>
      </div>
    </section>
    <section class="card">
      <div class="frow">
        <label class="fld sm">Sinal (% nos passeios)<input type="number" min="0" max="100" id="orPct" value="${o.sinalPct}"></label>
        <label class="fld">Válido até<input type="date" id="orVal" value="${esc(o.validade)}"></label>
        <label class="fld">Situação<select id="orSt">${ORC_STATUS.map(s => `<option value="${s[0]}" ${o.status === s[0] ? 'selected' : ''}>${s[1]}</option>`).join('')}</select></label>
      </div>
      <label class="optin"><input type="checkbox" id="orTermos" ${o.termos ? 'checked' : ''}><span><b>Incluir os termos e condições</b><small>Pagou o sinal = aceitou. Edite os seus em Ajustes.${DB.settings.termos && DB.settings.termos.pt ? '' : ' <b>Hoje ainda é o MODELO.</b>'}</small></span></label>
      <label class="fld">Observações para o cliente<textarea id="orObs" rows="2">${esc(o.obs)}</textarea></label>
      <div class="orc-tot"><span>Total <b>${eur(tot)}</b></span><span>Sinal <b>${eur(sin)}</b></span><span>No dia <b>${eur(Math.max(0, tot - sin))}</b></span>${o.itens.some(x => x.custo) ? `<span>Sua margem <b>${eur(tot - o.itens.reduce((s2, x) => s2 + (+x.custo || 0), 0))}</b></span>` : ''}</div>
      <div class="orc-links"><span class="op-lbl">Arquivo: ${esc(Orc.nomeArquivo(o))}</span>
        ${(o.links || []).map(l => `<a class="mini" target="_blank" rel="noopener" href="${esc(l.url)}">🔗 ${esc(l.nome)}</a>`).join('')}
        <div class="frow"><label class="fld grow"><input id="orLkNome" placeholder="nome (ex.: PDF do orçamento)"></label><label class="fld grow"><input id="orLkUrl" placeholder="https://drive.google.com/…"></label><button class="mini" id="orLkAdd">+ link</button></div></div>
      ${(o.repescagens || []).length ? `<p class="why">Repescagem: ${o.repescagens.map(x => `${x.n}ª ${crmData(x.data)} · ${esc(x.resultado)}`).join(' | ')}</p>` : ''}
      <div class="btnrow"><button class="cta sm" id="orSalva">Salvar</button><button class="mini danger" id="orApaga">apagar</button></div>
    </section>
    ${o.status !== 'fechado' ? `<section class="card orc-fecha">
      <h3>Fechou?</h3>
      <p class="why">Cada serviço da sua tabela vira uma reserva, com o cliente, o dia e o sinal. Aparece no Hoje, na agenda e na ficha dele.</p>
      <label class="optin"><input type="checkbox" id="orSinalOk" checked><span><b>O sinal de ${eur(sin)} já caiu</b><small>registra o pagamento na conta abaixo</small></span></label>
      <label class="fld">Conta<select id="orConta">${opContaOpts('nubank')}</select></label>
      <button class="cta sm" id="orFecha">Fechou — criar as reservas</button>
    </section>` : `<section class="card"><h3>✓ Fechado${o.fechadoEm ? ' em ' + opCurta(o.fechadoEm) : ''}</h3>
      ${(o.bookingIds || []).map(bid => Bookings.get(bid)).filter(Boolean).map(b => opCardServico(b, { comData: true })).join('')}</section>`}`);

  const lerTela = () => {
    o.cliente = { nome: $('#orNome').value.trim(), whats: $('#orWhats').value.trim(), email: $('#orEmail').value.trim() };
    o.itens = o.itens.map(i => {
      const el = document.querySelector(`[data-item="${i.id}"]`); if (!el) return i;
      const v = (k) => el.querySelector(`[data-k="${k}"]`).value;
      return { ...i, desc: v('desc'), data: v('data'), hora: v('hora'), pax: +v('pax') || 1, valor: +v('valor') || 0,
               sinal: v('sinal') === '' ? null : +v('sinal'), obs: v('obs'), custo: +v('custo') || 0,
               voo: el.querySelector('[data-k="voo"]') ? v('voo') : (i.voo || '') };
    });
    o.sinalPct = +$('#orPct').value || 0; o.validade = $('#orVal').value; o.status = $('#orSt').value;
    o.termos = $('#orTermos').checked; o.obs = $('#orObs').value;
    if (o.status === 'novo') o.status = 'rascunho';
    Orc.salva(o);
  };
  const re = () => admOrcEditor(id);
  $('#orSalva').onclick = () => { lerTela(); toast('Orçamento salvo'); re(); };
  $('#orCopia').onclick = () => { lerTela(); opCopia(opMsgOrc(Orc.get(id))); };
  const wa = $('#orWa');
  /* mandou o orcamento: o app ja fica aguardando a resposta (fecha sozinha quando fechar) */
  if (wa) wa.onclick = () => { lerTela(); wa.href = waLink(opMsgOrc(Orc.get(id)), opNum(o.cliente.whats)); if (o.status !== 'fechado') { o.status = 'enviado'; Orc.salva(o); Espera.orcamento(o); setTimeout(() => { toast('Orçamento enviado · tarefa "aguardar resposta" criada'); re(); }, 300); } };
  $('#orApaga').onclick = () => { if (confirm('Apagar este orçamento?')) { Orc.remove(id); go('/adm/consulta'); } };
  $('#orAdd').onclick = () => {
    const tid = $('#orAddT').value; if (!tid) return toast('Escolha um serviço.');
    lerTela();
    let it;
    if (tid.includes('|') && typeof Precos !== 'undefined') { it = Precos.itemOrc(tid, { data: $('#orAddD').value }); const p = +$('#orAddP').value; if (it && p) it.pax = p; }
    else it = Orc.itemDoCatalogo(tid, { pax: +$('#orAddP').value || 1, data: $('#orAddD').value });
    if (!it) return toast('Não consegui montar o item.');
    o.itens.push(it); Orc.salva(o); re();
  };
  $('#orLkAdd').onclick = () => { lerTela(); const r = Orc.linkAdd(id, $('#orLkNome').value, $('#orLkUrl').value); if (r && r.erro) return toast(r.erro); re(); };
  $('#orAvulso').onclick = () => { lerTela(); o.itens.push(Orc._item({ desc: 'Roteiro com consultoria de especialista', pax: o.pax || 2 })); Orc.salva(o); re(); };
  $$('[data-rmi]').forEach(b => b.onclick = () => { lerTela(); o.itens = o.itens.filter(i => i.id !== b.dataset.rmi); Orc.salva(o); re(); });
  $$('[data-recalc]').forEach(b => b.onclick = () => {
    lerTela();
    const i = o.itens.find(z => z.id === b.dataset.recalc);
    const n = Orc.itemDoCatalogo(i.tourId, { pax: i.pax, data: i.data, hora: i.hora, opcao: i.opcao });
    Object.assign(i, { valor: n.valor, sinal: n.sinal }); Orc.salva(o); re();
  });
  $('#orFecha')?.addEventListener('click', () => {
    lerTela();
    if (!o.cliente.nome) { $('#orNome').focus(); return toast('Falta o nome do cliente.'); }
    const semData = o.itens.filter(i => i.tourId && !i.data);
    if (semData.length) return toast('Falta o dia em ' + semData.map(i => i.desc).join(', '));
    const bs = Orc.fecha(id, { sinalRecebido: $('#orSinalOk').checked, conta: $('#orConta').value });
    toast(`${bs.length} ${bs.length === 1 ? 'reserva criada' : 'reservas criadas'} 🎉`);
    re();
  });
  opLigaCards(re);
}

/* =====================================================
   DOCUMENTOS — voucher e orcamento, para imprimir ou mandar
===================================================== */
function opDoc(titulo, corpo, acoes) {
  document.body.classList.add('em-adm');
  app.innerHTML = `<div class="doc-barra">
      <button class="mini" id="docVolta">← voltar</button>
      ${acoes || ''}
      <button class="cta sm" id="docPrint">imprimir / salvar PDF</button>
    </div>
    <article class="doc">
      <header class="doc-cab">${docLogo()}<div><b>${esc(titulo)}</b><small>${esc(guiaNegocio())} · ${esc(guiaNome())}${DB.settings.whats ? ' · WhatsApp ' + esc(DB.settings.whats) : ''}</small></div></header>
      ${corpo}
    </article>`;
  $('#docVolta').onclick = () => history.length > 1 ? history.back() : go('/adm/today');
  $('#docPrint').onclick = () => print();
}
function opVoucherTexto(b) {
  const x = Tours.get(b.tourId);
  const nd = Op.noDia(b);
  const pres = b.prestadorId ? Equipe.get(b.prestadorId) : null;
  const l = [`VOUCHER ${b.code} — ${guiaNegocio()}`, '', `${opNomeServ(b)}`, `${fmtDate(b.date)} às ${b.time} · ${b.pax} ${b.pax > 1 ? 'pessoas' : 'pessoa'}${b.veiculo ? ' · ' + b.veiculo : ''}`,
    `Cliente: ${b.name}${(b.group || []).length ? ' + ' + b.group.map(g => g.nome).join(', ') : ''}`];
  if (b.voo) l.push(`Voo: ${b.voo}`);
  const pt = pontoDoServico(b);
  if (pt) { l.push(`Encontro: ${pt.nome}${pt.endereco ? ' — ' + pt.endereco : ''}`); if (pt.instrucoes) l.push(pt.instrucoes); if (linkMapa(pt)) l.push('Mapa: ' + linkMapa(pt)); }
  else l.push(`Encontro: ${b.origem || noIdioma(x && x.meeting) || 'combinado pelo WhatsApp'}`);
  if (b.destino) l.push(`Destino: ${b.destino}`);
  if (pres) l.push(`${opPapel(b) === 'motorista' ? 'Motorista' : 'Guia'}: ${pres.nome}`);
  l.push('', nd.valor > 0 ? (nd.para === 'prestador'
    ? `No dia: pague ${eur(nd.valor)} em dinheiro ${opPapel(b) === 'motorista' ? 'ao motorista' : 'à guia'}.`
    : `Falta pagar ${eur(nd.valor)} até ${fmtDate(Bookings.dueDate(b))}.`) : 'Tudo pago. Não há nada a pagar no dia.');
  l.push('', 'Dicas: ' + dicasDo(b));
  if (DB.settings.plantao) l.push('', `Plantão (emergências): ${DB.settings.plantao}`);
  l.push(`WhatsApp: ${DB.settings.whats || ''}`);
  return l.join('\n');
}
/* deixa o texto de um bloco bonito: TÍTULOS MAIÚSCULOS viram cabeçalho,
   "Sub-títulos:" ficam em negrito, "- item" vira lista. */
function vchFmt(txt) {
  const linhas = String(txt || '').split('\n');
  let html = '', emLista = false;
  const fecha = () => { if (emLista) { html += '</ul>'; emLista = false; } };
  for (const raw of linhas) {
    const t = raw.trim();
    if (!t) { fecha(); continue; }
    if (/^[-•·]\s*/.test(t)) { if (!emLista) { html += '<ul class="vch-ul">'; emLista = true; } html += `<li>${esc(t.replace(/^[-•·]\s*/, ''))}</li>`; continue; }
    fecha();
    const base = t.replace(/\([^)]*\)/g, '').replace(/[—–]/g, '').trim();
    const semAc = base.normalize('NFD').replace(/[̀-ͯ]/g, '');
    if (base && semAc === semAc.toUpperCase() && /[A-Z]/.test(semAc) && t.length <= 70) html += `<h4 class="vch-h">${esc(t)}</h4>`;
    else if (/:$/.test(t) && t.length <= 55) html += `<p class="vch-sub">${esc(t)}</p>`;
    else html += `<p>${esc(t)}</p>`;
  }
  fecha();
  return html;
}
/* a ABA VOUCHER — edita os textos padrão; cada reserva monta o seu sozinho */
function admVoucher() {
  const grupos = [...new Set(VOUCHER_BLOCOS_META.map(m => m.grupo))];
  const umaReserva = (DB.bookings || []).filter(b => b.status !== 'cancelled').sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
  admShell('voucher', `
    <div class="pagehead"><h1 class="pageh">Voucher</h1>
      <span class="why">o voucher se monta sozinho em cada reserva — aqui você edita os textos padrão</span></div>
    <p class="why vch-ajuda">💡 Cada reserva gera o seu voucher automaticamente: junta o <b>resumo da reserva</b> + o <b>ponto de encontro</b> (que você cadastra em Ajustes → Pontos de encontro) + os blocos abaixo, escolhendo sozinho os certos — transfer de chegada, de partida, porto, trem, ou passeio. O que você edita aqui vale para todos os vouchers.${umaReserva ? ` <a href="#/adm/voucher/${esc(umaReserva.id)}">ver um voucher de exemplo →</a>` : ''}</p>
    ${grupos.map(g => `<h3 class="vch-grp">${esc(g)}</h3>
      ${VOUCHER_BLOCOS_META.filter(m => m.grupo === g).map(m => `<section class="card vch-ed">
        <div class="vch-ed-top"><b>${esc(m.nome)}</b><small class="why">aparece ${esc(m.quando)}</small></div>
        <textarea class="vch-ta" data-bl="${m.k}" rows="6">${esc(voucherBlocoTxt(m.k))}</textarea>
        <details class="vch-prev"><summary>como fica no voucher</summary><div class="vch-bloco vch-preview" data-prev="${m.k}">${vchFmt(voucherBlocoTxt(m.k))}</div></details>
      </section>`).join('')}`).join('')}`);
  $$('.vch-ta').forEach(ta => {
    ta.oninput = () => { const pv = document.querySelector(`.vch-preview[data-prev="${ta.dataset.bl}"]`); if (pv) pv.innerHTML = vchFmt(ta.value); };
    ta.onchange = () => { voucherSalvaBloco(ta.dataset.bl, ta.value); toast('Bloco salvo'); };
  });
}
/* o que a reserva já tem além do básico: ingressos (status e links), os links
   (ingresso em PDF, comprovante, mapa) e o que foi reservado com parceiros.
   'cliente' = só o que interessa a ele; 'guia' = tudo, com status e números. */
function docExtrasReserva(b, para) {
  const ing = Op.precisaIngresso(b), links = (b.links || []).filter(l => /^https?:\/\//i.test(l.url || ''));
  const peds = PedidosFor.daReserva(b).filter(p => para === 'guia' || p.status === 'confirmado');
  if (!ing && !links.length && !peds.length) return '';
  return `<div class="doc-extras">
    ${ing ? `<p><b>🎟 Ingressos:</b> ${b.ingressosOk ? 'comprados ✓' : (para === 'guia' ? '<b>ainda a comprar</b>' : 'estamos comprando — chegam antes do passeio')}</p>` : ''}
    ${links.length ? `<p><b>🔗 Seus links:</b></p><ul class="vch-ul">${links.map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.nome || 'link')}</a></li>`).join('')}</ul>` : ''}
    ${peds.length ? `<p><b>🤝 ${para === 'guia' ? 'Com parceiros' : 'Já reservado para você'}:</b></p><ul class="vch-ul">${peds.map(p => { const f = Fornecedores.get(p.fornecedorId);
      return `<li>${fornTipo(p.tipo)[1]} ${esc(p.desc || fornTipo(p.tipo)[2])}${f ? ' — ' + esc(f.nome) : ''}${p.ref ? ' · nº ' + esc(p.ref) : ''}${para === 'guia' ? ' · <i>' + esc(PED_FOR_ST.find(x => x[0] === p.status)[1]) + '</i>' : ''}</li>`; }).join('')}</ul>` : ''}
  </div>`;
}
/* A ORDEM DE SERVIÇO DO GUIA — pedido da Milla (01/10/2026): "quando passeio
   estiver confirmado, Yalla envia para o guia um PDF completo com todas as infos
   do cliente e passeio, ingressos, transfer". Abre como página para imprimir ou
   salvar em PDF; o botão do WhatsApp manda o resumo em texto junto. */
function opDocServico(id) {
  const b = Bookings.get(id);
  if (!b) return go('/adm/today');
  const x = Tours.get(b.tourId), pres = b.prestadorId ? Equipe.get(b.prestadorId) : null;
  const nd = Op.noDia(b), pt = pontoDoServico(b);
  const quem = participantesDe(b);
  const corpo = `
    <div class="doc-grande"><small>Serviço</small><b class="mono">${esc(b.code)}</b></div>
    <h2>${esc(opNomeServ(b))}</h2>
    <dl class="doc-dl">
      <dt>Quando</dt><dd>${fmtDate(b.date)} às ${esc(b.time)}${x && x.duration ? ' · ' + esc(x.duration) : ''}</dd>
      <dt>${opPapel(b) === 'motorista' ? 'Motorista' : 'Guia'}</dt><dd>${pres ? esc(pres.nome) : '<b>ainda sem ninguém escalado</b>'}</dd>
      <dt>Cliente</dt><dd><b>${esc(b.name)}</b>${b.whats ? ` · <a href="https://wa.me/${opNum(b.whats)}">${esc(b.whats)}</a>` : ''}${b.email ? ` · ${esc(b.email)}` : ''}${b.insta ? ` · @${esc(String(b.insta).replace(/^@/, ''))}` : ''}</dd>
      <dt>Quem vai</dt><dd>${quem.map(q => `${esc(q.nome)}${idadeDe(q.nasc) != null ? ' (' + idadeDe(q.nasc) + ')' : ''}`).join(', ') || esc(b.name)} · ${b.pax} ${b.pax > 1 ? 'pessoas' : 'pessoa'}</dd>
      ${b.veiculo ? `<dt>Veículo</dt><dd>${esc(b.veiculo)}${b.malas ? ' · ' + esc(b.malas) : ''}</dd>` : ''}
      ${b.voo ? `<dt>Voo</dt><dd>${esc(b.voo)}</dd>` : ''}
      <dt>Encontro</dt><dd>${pt ? `${esc(pt.nome)}${pt.endereco ? `<br><small>${esc(pt.endereco)}</small>` : ''}${pt.instrucoes ? `<br><small>${esc(pt.instrucoes)}</small>` : ''}` : esc(b.origem || noIdioma(x && x.meeting) || 'combinar')}</dd>
      ${b.destino ? `<dt>Levar para</dt><dd>${esc(b.destino)}</dd>` : ''}
      ${b.obsOp ? `<dt>Observação</dt><dd>${esc(b.obsOp)}</dd>` : ''}
      ${(b.viagem || (Cadastro.get(b.clienteId) || {}).viagem || {}).hotel ? `<dt>Hotel</dt><dd>${esc((b.viagem || (Cadastro.get(b.clienteId) || {}).viagem).hotel)}</dd>` : ''}
    </dl>
    <div class="doc-pag ${nd.valor > 0 && nd.para === 'prestador' ? 'falta' : 'ok'}">
      ${nd.valor > 0 && nd.para === 'prestador' ? `<b>Receber do cliente no dia: ${eur(nd.valor)}.</b>` : `<b>Nada a receber do cliente no dia.</b>`}
      ${+b.custo > 0 ? `<small>Seu valor pelo serviço: ${eur(b.custo)}</small>` : ''}
    </div>
    ${docExtrasReserva(b, 'guia')}
    ${typeof dicasDo === 'function' && dicasDo(b) ? `<div class="vch-bloco"><h4 class="vch-h">DICAS PARA O DIA</h4><p>${esc(dicasDo(b))}</p></div>` : ''}`;
  opDoc('Ordem de serviço', corpo, pres && pres.whats ? `<a class="mini cta-ish" target="_blank" rel="noopener" href="${waLink(opMsgPrestador(b), opNum(pres.whats))}">💬 mandar ao ${opPapel(b) === 'motorista' ? 'motorista' : 'guia'}</a>` : '');
}
function opDocVoucher(id) {
  const b = Bookings.get(id);
  if (!b) return go('/adm/today');
  const x = Tours.get(b.tourId);
  const nd = Op.noDia(b);
  const pres = b.prestadorId ? Equipe.get(b.prestadorId) : null;
  const pago = Bookings.paid(b);
  const corpo = `
    <div class="doc-grande"><small>Código</small><b class="mono">${esc(b.code)}</b></div>
    <h2>${esc(opNomeServ(b))}</h2>
    <dl class="doc-dl">
      <dt>Quando</dt><dd>${fmtDate(b.date)} às ${esc(b.time)}</dd>
      <dt>Quem</dt><dd>${esc(b.name)}${(b.group || []).length ? '<br>' + b.group.map(g => esc(g.nome)).join(', ') : ''} · ${b.pax} ${b.pax > 1 ? 'pessoas' : 'pessoa'}</dd>
      ${b.veiculo ? `<dt>Veículo</dt><dd>${esc(b.veiculo)}${b.malas ? ' · ' + esc(b.malas) : ''}</dd>` : ''}
      ${b.voo ? `<dt>Voo</dt><dd>${esc(b.voo)}</dd>` : ''}
      <dt>Encontro</dt><dd>${(() => { const pt = pontoDoServico(b); return pt
        ? `${esc(pt.nome)}${pt.endereco ? `<br><small>${esc(pt.endereco)}</small>` : ''}${pt.instrucoes ? `<br><small>${esc(pt.instrucoes)}</small>` : ''}${linkMapa(pt) ? `<br><a href="${esc(linkMapa(pt))}" target="_blank" rel="noopener">abrir no mapa</a>` : ''}`
        : esc(b.origem || noIdioma(x && x.meeting) || 'combinado pelo WhatsApp'); })()}</dd>
      ${b.destino ? `<dt>Destino</dt><dd>${esc(b.destino)}</dd>` : ''}
      ${pres ? `<dt>${opPapel(b) === 'motorista' ? 'Motorista' : 'Guia'}</dt><dd>${esc(pres.nome)}</dd>` : ''}
    </dl>
    <div class="doc-pag ${nd.valor > 0 ? 'falta' : 'ok'}">
      ${nd.valor > 0 ? (nd.para === 'prestador'
        ? `<b>No dia, pague ${eur(nd.valor)} em dinheiro ${opPapel(b) === 'motorista' ? 'ao motorista' : 'à guia'}.</b><small>Já pago: ${eur(pago)} de ${eur(b.total)}</small>`
        : `<b>Falta pagar ${eur(nd.valor)} até ${fmtDate(Bookings.dueDate(b))}.</b><small>Já pago: ${eur(pago)} de ${eur(b.total)}</small>`)
        : `<b>✓ Tudo pago.</b><small>Não há nada a pagar no dia.</small>`}
    </div>
    ${docExtrasReserva(b, 'cliente')}
    ${voucherBlocosDe(b).map(k => { const txt = voucherBlocoTxt(k); return txt ? `<div class="vch-bloco">${vchFmt(txt)}</div>` : ''; }).join('')}`;
  /* o ponto de encontro: ela escolhe o deste cliente (so aparece aqui, nao no PDF) */
  const opcoes = Pontos.doPasseio(b.tourId), atual = pontoDoServico(b);
  const sel = opcoes.length ? `<label class="doc-ponto-sel">Ponto de encontro <select id="docPonto">${opcoes.map(p => `<option value="${esc(p.id)}" ${atual && atual.id === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>` : '';
  opDoc('Voucher', corpo, sel + (b.whats ? `<a class="mini cta-ish" id="docVoucherWa" target="_blank" rel="noopener" href="${waLink(opVoucherTexto(b), opNum(b.whats))}">💬 mandar ao cliente</a>` : ''));
  const ds = $('#docPonto'); if (ds) ds.onchange = () => { escolhePonto(b.id, ds.value); opDocVoucher(id); toast('Ponto de encontro escolhido'); };
  /* mandou: o lembrete "mandar o voucher" some sozinho */
  const vw = $('#docVoucherWa');
  if (vw) vw.addEventListener('click', () => { b.voucherEm = isoToday(); _opSaveBooking(b); });
}
function opDocOrc(id) {
  const o = Orc.get(id);
  if (!o) return go('/adm/consulta');
  const tot = Orc.total(o), sin = Orc.sinal(o);
  const termos = termosTexto();
  const modelo = /^MODELO/.test(termos);
  const corpo = `
    <div class="doc-grande"><small>Orçamento</small><b class="mono">${esc(o.num)}</b></div>
    <p>Para <b>${esc(o.cliente.nome || '')}</b>${o.cliente.whats ? ' · ' + esc(o.cliente.whats) : ''} · emitido em ${opCurta(o.criado.slice(0, 10))} · válido até ${opCurta(o.validade)}</p>
    ${o.paxNota || o.bagagem ? `<p>${o.paxNota ? '<b>Pessoas:</b> ' + esc(o.paxNota) : ''}${o.paxNota && o.bagagem ? ' · ' : ''}${o.bagagem ? '<b>Bagagem:</b> ' + esc(o.bagagem) : ''}</p>` : ''}
    <table class="tbl doc-tbl"><thead><tr><th>Serviço</th><th>Dia</th><th class="right">Pessoas</th><th class="right">Valor</th></tr></thead><tbody>
      ${o.itens.map(i => `<tr><td>${esc(i.desc)}${i.obs && !i.sugestao ? `<br><small>${esc(i.obs)}</small>` : ''}</td><td class="mono">${i.data ? opCurta(i.data) + (i.hora ? ' ' + esc(i.hora) : '') : '—'}</td><td class="right">${i.pax}</td><td class="mono right">${i.valor ? eur(i.valor) : 'a definir'}</td></tr>`).join('')}
    </tbody><tfoot>
      <tr><td colspan="3"><b>Total</b></td><td class="mono right"><b>${eur(tot)}</b></td></tr>
      ${sin ? `<tr><td colspan="3">Sinal para reservar</td><td class="mono right">${eur(sin)}</td></tr>
      <tr><td colspan="3">${restoRotulo()}</td><td class="mono right">${eur(Math.max(0, tot - sin))}</td></tr>` : ''}
    </tfoot></table>
    ${o.obs ? `<p>${esc(o.obs).replace(/\n/g, '<br>')}</p>` : ''}
    <h3>Como pagar o sinal</h3>
    <p>${[DB.settings.pixKey && 'Pix: ' + esc(DB.settings.pixKey), DB.settings.wiseLink && 'Wise: ' + esc(DB.settings.wiseLink), DB.settings.iban && 'IBAN: ' + esc(DB.settings.iban) + (DB.settings.ibanName ? ' (' + esc(DB.settings.ibanName) + ')' : '')].filter(Boolean).join('<br>') || 'Os dados de pagamento seguem pelo WhatsApp.'}</p>
    ${o.termos ? `<h3>Termos e condições</h3>
      ${modelo ? '<div class="alert warn nao-imprime">Estes ainda são os termos MODELO. Cole os seus em Ajustes → Termos e condições.</div>' : ''}
      <p class="doc-termos">${esc(termos.replace(/^MODELO.*\n\n?/, '')).replace(/\n/g, '<br>')}</p>
      <p><b>Ao pagar o sinal, você declara que leu e aceita estes termos.</b></p>` : ''}`;
  opDoc('Orçamento', corpo, `<a class="mini" href="#/adm/consulta/${esc(o.id)}">editar</a>`);
}

/* =====================================================
   AJUSTES — contas, termos e plantao
===================================================== */
function opAjustesHtml() {
  const s = DB.settings.termos || {};
  return bkpAjustesHtml() + avAjustesHtml() + `<section class="card" id="opPontos">
      <h3>Pontos de encontro</h3>
      <p class="why">A lista única de onde os clientes encontram a guia ou o motorista. Em cada passeio você marca quais valem; no voucher, escolhe o do cliente — e só ele sai no voucher.</p>
      ${Pontos.all().map(p => `<div class="pt-row"><div class="tinfo"><b>${esc(p.nome)}</b><small>${esc(p.endereco || '')}${p.instrucoes ? ' · ' + esc(p.instrucoes) : ''}</small></div>
        <div class="tacts">${linkMapa(p) ? `<a class="mini" target="_blank" rel="noopener" href="${esc(linkMapa(p))}">mapa</a>` : ''}<button class="mini" data-pted="${esc(p.id)}">editar</button><button class="mini ghost danger" data-ptrm="${esc(p.id)}">✕</button></div></div>`).join('') || '<p class="why">Nenhum ponto ainda.</p>'}
      <div class="svc-form" id="ptForm">
        <input type="hidden" id="ptId">
        <div class="frow"><label class="fld">Nome<input id="ptNome" placeholder="Dubai Mall — entrada principal"></label><label class="fld">Endereço<input id="ptEnd" placeholder="Financial Centre Rd, Downtown Dubai"></label></div>
        <label class="fld">Link do mapa (opcional)<input id="ptMapa" placeholder="https://maps.app.goo.gl/…"></label>
        <label class="fld">Instruções para o cliente<textarea id="ptIns" rows="2" placeholder="Em frente à entrada; a guia estará com a plaquinha ${esc(guiaNegocio())}. Chegue 15 min antes."></textarea></label>
        <button class="cta sm" id="ptSalva">Salvar ponto</button></div>
    </section>
    <section class="card" id="opContas">
      <h3>Suas contas</h3>
      <p class="why">Onde o dinheiro cai. Na hora de registrar um pagamento você escolhe a conta, e a contabilidade separa: cada lado (${esc(ladoNome('brasil'))}, ${esc(ladoNome('europa'))}) para o seu contador.</p>
      ${Contas.all().map(c => `<div class="frow conta-row" data-conta="${esc(c.id)}">
        <label class="fld grow">Nome<input data-ck="nome" value="${esc(c.nome)}"></label>
        <label class="fld">Lado<select data-ck="pais"><option value="brasil" ${c.pais === 'brasil' ? 'selected' : ''}>🇧🇷 Brasil</option><option value="europa" ${c.pais === 'europa' ? 'selected' : ''}>${ladoBandeira('europa')} ${esc(ladoNome('europa'))}</option></select></label>
        <label class="fld">Tipo<select data-ck="metodo">${[['pix', 'Pix'], ['transfer', 'Transferência bancária'], ['card', 'Cartão'], ['cash', 'Dinheiro'], ['other', 'Outro']].map(([v, l]) => `<option value="${v}" ${c.metodo === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <button class="mini danger" data-crm="${esc(c.id)}" aria-label="remover">✕</button>
      </div>`).join('')}
      <div class="btnrow"><button class="mini" id="ctNova">+ conta</button><button class="cta sm" id="ctSalva">Salvar contas</button></div>
    </section>
    <section class="card">
      <h3>Termos e condições</h3>
      <p class="why">Saem no orçamento: pagou o sinal, aceitou — como passagem aérea. Cole aqui os seus.</p>
      <label class="fld">Português<textarea id="tmPt" rows="8" placeholder="${esc(TERMOS_MODELO)}">${esc(s.pt || '')}</textarea></label>
      <label class="fld">English<textarea id="tmEn" rows="4">${esc(s.en || '')}</textarea></label>
      <label class="fld">Número de plantão (sai no voucher)<input id="tmPlantao" value="${esc(DB.settings.plantao || '')}" placeholder="+39 ..."></label>
      <button class="cta sm" id="tmSalva">Salvar</button>
    </section>
    <section class="card" id="zeraCard">
      <h3>Começar do zero</h3>
      <p class="why">Apaga os <b>exemplos</b> — clientes, reservas, guias, parceiros e tarefas — para você começar com os seus dados de verdade. O <b>catálogo de passeios, os preços e os pontos de encontro continuam</b>.</p>
      ${(() => { const n = (DB.bookings || []).filter(b => b.status !== 'cancelled').length, c = Cadastro.all().length; return (n || c) ? `<p class="why">Agora há <b>${c} ${c === 1 ? 'cliente' : 'clientes'}</b> e <b>${n} ${n === 1 ? 'reserva' : 'reservas'}</b> de exemplo.</p>` : '<p class="why">✓ O app já está zerado — pode começar.</p>'; })()}
      <button class="mini ghost danger" id="zeraTudo">Apagar os exemplos e começar do zero</button>
    </section>`;
}
function opAjustesLiga() {
  bkpAjustesLiga();
  avAjustesLiga();
  visualLiga();
  $('#zeraTudo')?.addEventListener('click', () => {
    if (!confirm('Apagar os exemplos (clientes, reservas, guias, parceiros e tarefas) e começar do zero?\n\nO catálogo de passeios, os preços e os pontos de encontro continuam.')) return;
    zerarExemplos();
    toast('Pronto — app zerado. É só começar!');
    setTimeout(() => go('/adm/today'), 500);
  });
  $('#ptSalva').onclick = () => {
    const r = Pontos.salva({ id: $('#ptId').value, nome: $('#ptNome').value, endereco: $('#ptEnd').value, mapa: $('#ptMapa').value, instrucoes: $('#ptIns').value });
    if (r.erro) return toast(r.erro);
    toast('Ponto salvo'); admSettings(); setTimeout(() => $('#opPontos') && $('#opPontos').scrollIntoView(), 30);
  };
  $$('[data-pted]').forEach(b => b.onclick = () => { const p = Pontos.get(b.dataset.pted); $('#ptId').value = p.id; $('#ptNome').value = p.nome; $('#ptEnd').value = p.endereco; $('#ptMapa').value = p.mapa; $('#ptIns').value = p.instrucoes; $('#ptNome').focus(); });
  $$('[data-ptrm]').forEach(b => b.onclick = () => { const p = Pontos.get(b.dataset.ptrm); if (p && confirm(`Tirar "${p.nome}" da lista?`)) { Pontos.remove(p.id); admSettings(); } });
  const lerContas = () => $$('[data-conta]').forEach(row => {
    const c = Contas.get(row.dataset.conta); if (!c) return;
    const v = (k) => row.querySelector(`[data-ck="${k}"]`).value;
    Object.assign(c, { nome: v('nome').trim() || c.nome, pais: v('pais'), metodo: v('metodo') });
  });
  $('#ctSalva').onclick = () => { lerContas(); save(); toast('Contas salvas'); };
  $('#ctNova').onclick = () => { lerContas(); Contas.salva({ nome: 'Nova conta', pais: 'europa', metodo: 'transfer' }); admSettings(); setTimeout(() => $('#opContas').scrollIntoView(), 30); };
  $$('[data-crm]').forEach(b => b.onclick = () => {
    const c = Contas.get(b.dataset.crm);
    if (c && confirm(`Remover a conta "${c.nome}"? Os pagamentos já registrados nela continuam no extrato.`)) { lerContas(); Contas.remove(c.id); admSettings(); }
  });
  $('#tmSalva').onclick = () => {
    DB.settings.termos = { pt: $('#tmPt').value.trim(), en: $('#tmEn').value.trim() };
    DB.settings.plantao = $('#tmPlantao').value.trim();
    save(); toast('Salvo');
  };
}

/* =====================================================
   MEU PEDIDO — o cliente junta varios servicos num orcamento so
   "ela quer fazer o orcamento de varias coisas: o passeio, o transfer,
   um passeio em Florenca, o transfer de partida em Milao"
===================================================== */
const CESTA_KEY = 'yalla_cesta_v1';
function cesta() { try { return JSON.parse(localStorage.getItem(CESTA_KEY)) || []; } catch (e) { return []; } }
function cestaSalva(l) { try { localStorage.setItem(CESTA_KEY, JSON.stringify(l)); } catch (e) {} }
function cestaAdd(it) { const l = cesta(); l.push({ ...it, id: uid() }); cestaSalva(l); }
function cestaBarra(rota) {
  const velha = document.getElementById('cestaBar'); if (velha) velha.remove();
  if (rota === 'adm' || rota === 'pedido') return;
  const n = cesta().length; if (!n) return;
  const el = document.createElement('a');
  el.id = 'cestaBar'; el.className = 'cesta-bar'; el.href = '#/pedido';
  el.innerHTML = `🧾 <b>${L('Meu pedido', 'My request', 'Mi pedido')}</b> · ${n} ${n === 1 ? L('serviço', 'service') : L('serviços', 'services')} <span>${L('ver e enviar', 'review & send')} →</span>`;
  document.body.appendChild(el);
}
function viewPedido() {
  const itens = cesta();
  const tot = itens.reduce((s, i) => s + (+i.valor || 0), 0);
  app.innerHTML = `
  <header class="topbar">
    <button class="backbtn" id="bk" aria-label="${t('back')}">←</button>
    <span class="tbrand">${logoMark(24, 'var(--brand-assinatura)')}<b>${esc(guiaNome())}</b></span>
    ${langBar('right')}
  </header>
  <main class="wrap roteiro">
    <h1 class="pageh">${L('Meu pedido', 'My request', 'Mi pedido')}</h1>
    <p class="rtintro">${L(`Junte tudo o que você quer — passeios, transfers, outras cidades — e mande de uma vez. ${esc(guiaNome())} confere e responde com o orçamento completo.`,
      `Gather everything you want — tours, transfers, other cities — and send it at once. ${esc(guiaNome())} checks it and replies with the full quote.`)}</p>
    <section class="card">
      ${itens.length ? itens.map(i => `<div class="deprow"><div class="tinfo"><b>${esc(i.nome)}</b><small>${i.data ? fmtDate(i.data) + (i.hora ? ' ' + esc(i.hora) : '') : ''} · ${i.pax} ${i.pax > 1 ? L('pessoas', 'people', 'personas') : L('pessoa', 'person', 'persona')}${i.valor ? ' · ' + eur(i.valor) : ''}</small></div>
        <button class="mini danger" data-tira="${esc(i.id)}">${L('tirar', 'remove', 'quitar')}</button></div>`).join('')
        : `<p class="why">${L('Nenhum serviço ainda.', 'Nothing yet.', 'Ningún servicio aún.')}</p>`}
      <a class="mini" href="#/tours">+ ${L('acrescentar da vitrine', 'add from the showcase', 'agregar de la vitrina')}</a>
      ${tot ? `<p class="why">${L('Valor de referência pela tabela', 'Reference price', 'Precio de referencia')}: <b>${eur(tot)}</b>. ${L('O orçamento final vem de ' + esc(guiaNome()) + '.', 'The final quote comes from ' + esc(guiaNome()) + '.')}</p>` : ''}
    </section>
    <section class="card">
      <label class="fld">${L('O que mais você quer?', 'Anything else?', '¿Qué más quieres?')}<textarea id="pdMais" rows="3" placeholder="${L('Ex.: passeio em Abu Dhabi dia 14, transfer de saída, jantar no deserto...', 'E.g.: Abu Dhabi tour on the 14th, departure transfer, desert dinner...', 'Ej.: paseo en Abu Dabi el 14, traslado de salida, cena en el desierto...')}"></textarea></label>
      <div class="frow">
        <label class="fld">${t('fullName')}<input id="pdNome" autocomplete="name"></label>
        <label class="fld">${t('whatsLbl')}<input id="pdWa" placeholder="+55 ..."></label>
      </div>
      <label class="fld">${t('email')}<input id="pdEmail" type="email" autocomplete="email"></label>
      <button class="cta" id="pdEnvia">${L('Enviar pedido para', 'Send request to', 'Enviar pedido a')} ${esc(guiaNome())}</button>
      <p class="fine">${L('Nada é cobrado agora. Você recebe o orçamento com os termos e o valor do sinal.', 'Nothing is charged now. You will get the quote with the terms and the deposit.', 'No se cobra nada ahora. Recibes el presupuesto con los términos y el valor de la seña.')}</p>
    </section>
  </main>`;
  $('#bk').onclick = () => history.length > 1 ? history.back() : go('/');
  $$('[data-tira]').forEach(b => b.onclick = () => { cestaSalva(cesta().filter(i => i.id !== b.dataset.tira)); viewPedido(); });
  $('#pdEnvia').onclick = () => {
    const nome = $('#pdNome').value.trim(), wa = $('#pdWa').value.trim(), mais = $('#pdMais').value.trim();
    if (!nome || !wa) return toast(L('Preencha nome e WhatsApp.', 'Fill in name and WhatsApp.', 'Completa nombre y WhatsApp.'));
    if (!itens.length && !mais) return toast(L('Conte o que você quer.', 'Tell us what you want.', 'Cuéntanos qué quieres.'));
    const o = Orc.cria({
      origem: 'site', status: 'novo', cliente: { nome, whats: wa, email: $('#pdEmail').value.trim() }, obs: '',
      resumo: mais, conversa: mais,
      itens: itens.map(i => (i.tourId && Tours.get(i.tourId))
        ? { ...Orc.itemDoCatalogo(i.tourId, { pax: i.pax, data: i.data, hora: i.hora, opcao: i.opcao }), obs: '' }
        : { desc: i.nome, pax: i.pax, data: i.data, valor: i.valor || 0 }),
    });
    if (typeof itPedidoPublico === 'function') itPedidoPublico('orcamentos', o);
    const msg = [L(`Olá ${guiaNome()}! Meu pedido (${o.num}):`, `Hi ${guiaNome()}! My request (${o.num}):`), '',
      ...itens.map((i, n) => `${n + 1}. ${i.nome}${i.data ? ' — ' + opCurta(i.data) + (i.hora ? ' ' + i.hora : '') : ''} · ${i.pax}p`),
      ...(mais ? ['', mais] : []), '', `${nome} · ${wa}`].join('\n');
    cestaSalva([]);
    window.open(waLink(msg), '_blank');
    app.querySelector('main').innerHTML = `<div class="okc">✓</div><h2 class="okh">${L('Pedido enviado', 'Request sent', 'Pedido enviado')}</h2>
      <p class="hint center">${L(`${esc(guiaNome())} recebeu tudo e responde com o orçamento.`, `${esc(guiaNome())} got everything and will reply with the quote.`)}</p>
      <a class="cta soft" href="#/">${L('Voltar ao início', 'Back to start', 'Volver al inicio')}</a>`;
  };
}

/* =====================================================
   RELATORIOS — o painel de numeros dela

   Um numero principal (o dinheiro que entrou), marcadores com a comparacao
   contra o periodo anterior e um mini-grafico de 12 semanas, e graficos que
   respondem perguntas dela: o que ja esta vendido para as proximas semanas,
   quando a semana aperta (para as guias), o que mais vende, de onde vem o
   cliente, com quanta antecedencia reservam, como vao os orcamentos.

   Regras dos graficos (guia de visualizacao): uma cor so por serie (o vinho
   dela), destaque em vinho e o resto em cinza, grade em linha fina e solida,
   rotulo so onde importa, dica ao passar o dedo/mouse e, em todo grafico,
   "ver em tabela" — nenhum numero fica preso so no desenho.
===================================================== */
const RP_ORIGEM = { site: 'Site', instagram: 'Instagram', whatsapp: 'WhatsApp', agency: 'Agência', friend: 'Indicação',
                    orcamento: 'Orçamento', manual: 'Lançada por você' };
function rpEur(v) {
  const n = Math.round(+v || 0);
  if (Math.abs(n) >= 10000) return moedaSigla() + ' ' + (n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' mil';
  return eur(n);
}
function rpPct(x) { return x == null ? '—' : Math.round(x * 100) + '%'; }
function rpTopo(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v))), f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
/* a setinha do marcador: sobe/desce com texto, nunca so cor */
function rpDelta(d, bomSubir, antNome) {
  if (d == null) return `<span class="rp-d n" title="sem base de comparação">novo · ${esc(antNome)} sem movimento</span>`;
  const r = Math.round(d * 100);
  if (r === 0) return `<span class="rp-d n">= igual a ${esc(antNome)}</span>`;
  const bom = (r > 0) === (bomSubir !== false);
  return `<span class="rp-d ${bom ? 'ok' : 'bad'}">${r > 0 ? '▲ +' : '▼ '}${r}% <span class="rp-vs">vs ${esc(antNome)}</span></span>`;
}
/* mini-grafico: 12 semanas em cinza, a atual em vinho */
function rpSpark(vals) {
  const W = 120, H = 30, n = vals.length;
  if (!n) return '';
  const max = Math.max(1, ...vals), x = (i) => 2 + i * ((W - 6) / Math.max(1, n - 1)), y = (v) => H - 4 - (v / max) * (H - 8);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg class="rp-spark" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true">
    <polygon points="${x(0)},${H - 4} ${pts} ${x(n - 1)},${H - 4}" fill="var(--cv-mute)" opacity=".18"/>
    <polyline points="${pts}" fill="none" stroke="var(--cv-mute)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(n - 1)}" cy="${y(vals[n - 1])}" r="4" fill="var(--cv-main)" stroke="var(--surface)" stroke-width="2"/></svg>`;
}
function rpTile(rotulo, valor, delta, spark, extra) {
  return `<div class="rp-tile"><small>${rotulo}</small><b>${valor}</b>${delta || ''}${extra ? `<span class="rp-extra">${extra}</span>` : ''}${spark || ''}</div>`;
}
function rpTabela(cabecalho, linhas) {
  return `<details class="rp-tab"><summary>ver em tabela</summary><div class="rp-tabwrap"><table class="tbl"><thead><tr>${cabecalho.map((c, i) => `<th class="${i ? 'right' : ''}">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${linhas.map(l => `<tr>${l.map((c, i) => `<td class="${i ? 'mono right' : ''}">${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details>`;
}

/* colunas em SVG, na largura real do cartao. Uma serie: destaque em vinho,
   o resto em cinza. Duas (empilhadas): o mesmo vinho em dois tons, com
   legenda. A dica sai do atributo data-tip (texto puro). */
function rpColunas(el, dados, opt) {
  if (!el) return;
  const W = Math.max(260, el.clientWidth || 600), H = opt.h || 190;
  const tot = (d) => opt.pilha ? d.partes.reduce((s, p) => s + p.v, 0) : d.v;
  const topo = rpTopo(Math.max(0, ...dados.map(tot)) * 1.05);
  const fmtE = (t) => opt.fmtEixo ? opt.fmtEixo(t) : rpEur(t);
  /* 10px mono: ~6.2px por letra. A margem cabe o maior numero do eixo. */
  const pL = Math.ceil(Math.max(...[0, topo / 2, topo].map(t => fmtE(t).length)) * 6.2) + 12;
  const pR = 6, pT = 24, pB = 26, w = W - pL - pR, h = H - pT - pB;
  const Y = (v) => pT + h - (v / topo) * h;
  const banda = w / dados.length, bw = Math.min(24, banda * 0.62);
  const max = Math.max(...dados.map(tot));
  /* rotulos que nao cabem nao encavalam: com coluna estreita, mostra uma data
     sim outra nao (a da coluna em destaque sempre); o valor da maior coluna so
     aparece se ela nao estiver colada na coluna em destaque */
  const cada = Math.max(1, Math.ceil((Math.max(...dados.map(d => String(d.rot).length)) * 6.2 + 10) / banda));
  const iDest = dados.findIndex(d => d.destaque);
  const iMax = dados.findIndex(d => tot(d) === max);
  const mostraValor = (i) => i === iDest || (i === iMax && (iDest < 0 || Math.abs(iMax - iDest) > 1));
  let g = '';
  for (const t of [0, topo / 2, topo]) {
    g += `<line x1="${pL}" x2="${W - pR}" y1="${Y(t)}" y2="${Y(t)}" stroke="var(--cv-grid)" stroke-width="1"/>`
       + `<text x="${pL - 8}" y="${Y(t) + 4}" text-anchor="end" class="rp-ax">${esc(fmtE(t))}</text>`;
  }
  const colTopo = (x, y0, y1, cor, arred) => {
    const hh = y0 - y1; if (hh <= 0.5) return '';
    const r = arred ? Math.min(4, hh, bw / 2) : 0;
    return `<path d="M${x},${y0} V${y1 + r} Q${x},${y1} ${x + r},${y1} H${x + bw - r} Q${x + bw},${y1} ${x + bw},${y1 + r} V${y0} Z" fill="${cor}"/>`;
  };
  dados.forEach((d, i) => {
    const x = pL + i * banda + (banda - bw) / 2;
    if (opt.pilha) {
      let base = Y(0);
      d.partes.forEach((p, k) => {
        const topoY = Y(d.partes.slice(0, k + 1).reduce((s, q) => s + q.v, 0));
        const ultimo = d.partes.slice(k + 1).every(q => q.v <= 0);
        /* 2px de fundo entre os pedacos: separa sem desenhar borda */
        g += colTopo(x, base - (k ? 2 : 0), topoY, p.cor, ultimo);
        if (p.v > 0) base = topoY;
      });
    } else {
      g += colTopo(x, Y(0), Y(d.v), d.cor || (d.destaque ? 'var(--cv-main)' : (opt.cor || 'var(--cv-mute)')), true);
    }
    const v = tot(d);
    if (mostraValor(i) && v > 0 && !opt.semRotulo) {
      const txt = opt.fmt ? opt.fmt(v) : rpEur(v), meia = txt.length * 3.6;
      const cx = Math.min(W - 2 - meia, Math.max(pL + meia, x + bw / 2));
      g += `<text x="${cx}" y="${Y(v) - 7}" text-anchor="middle" class="rp-val">${esc(txt)}</text>`;
    }
    if (d.destaque || (opt.rotDoInicio ? i : dados.length - 1 - i) % cada === 0) g += `<text x="${x + bw / 2}" y="${H - 8}" text-anchor="middle" class="rp-ax ${d.destaque ? 'on' : ''}">${esc(d.rot)}</text>`;
    g += `<rect class="rp-hit" x="${pL + i * banda}" y="${pT}" width="${banda}" height="${h}" fill="transparent" tabindex="0" role="img"
      aria-label="${esc(d.tip.join(' · '))}" data-tip="${esc(JSON.stringify(d.tip))}"/>`;
  });
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" class="rp-svg">${g}</svg>`;
}
/* barras deitadas em HTML: nome, barra fina e o valor na ponta */
function rpBarras(lista, opt) {
  const max = Math.max(1, ...lista.map(r => r.v));
  return `<div class="rp-hbars">${lista.map(r => `<div class="rp-hb" tabindex="0" data-tip="${esc(JSON.stringify(r.tip || [r.rotulo, String(r.v)]))}">
      <span class="rp-hb-nome">${esc(r.rotulo)}${r.sub ? `<small>${esc(r.sub)}</small>` : ''}</span>
      <span class="rp-hb-pista"><i style="width:${Math.max(2, r.v / max * 100)}%;${r.cor ? 'background:' + r.cor : ''}"></i><em>${esc(r.txt)}</em></span>
    </div>`).join('')}</div>`;
}
/* a dica: uma so para a tela toda, texto puro (textContent) */
function rpLigaDicas(raiz) {
  let tip = document.getElementById('rpTip');
  if (!tip) { tip = document.createElement('div'); tip.id = 'rpTip'; tip.className = 'rp-tip'; tip.hidden = true; document.body.appendChild(tip); }
  const mostra = (alvo, x, y) => {
    let linhas; try { linhas = JSON.parse(alvo.dataset.tip); } catch (e) { return; }
    tip.textContent = '';
    linhas.forEach((l, i) => { const el = document.createElement(i ? 'span' : 'b'); el.textContent = l; tip.appendChild(el); });
    tip.hidden = false;
    const r = tip.getBoundingClientRect();
    tip.style.left = Math.max(8, Math.min(innerWidth - r.width - 8, x - r.width / 2)) + 'px';
    tip.style.top = Math.max(8, y - r.height - 14) + 'px';
    alvo.classList.add('rp-on');
  };
  const some = (alvo) => { tip.hidden = true; if (alvo) alvo.classList.remove('rp-on'); };
  raiz.querySelectorAll('[data-tip]').forEach(a => {
    a.addEventListener('pointermove', (e) => mostra(a, e.clientX, e.clientY));
    a.addEventListener('pointerleave', () => some(a));
    a.addEventListener('focus', () => { const r = a.getBoundingClientRect(); mostra(a, r.left + r.width / 2, r.top); });
    a.addEventListener('blur', () => some(a));
  });
}

function admRelatorios() {
  const S = admRelatorios._s = admRelatorios._s || { p: 'mes' };
  const hoje = isoToday();
  const P = (S.p === 'custom' && S.de && S.ate) ? Painel.periodoCustom(S.de, S.ate) : Painel.periodo(S.p, hoje);
  const rec = Painel.recebido(P.de, P.ate), recA = Painel.recebido(P.antDe, P.antAte);
  const ven = Painel.vendido(P.de, P.ate), venA = Painel.vendido(P.antDe, P.antAte);
  const srv = Painel.servicos(P.de, P.ate), srvA = Painel.servicos(P.antDe, P.antAte);
  const mg = Painel.margem(P.de, P.ate);
  const ar = Painel.aReceber(hoje);
  const oc = Painel.orcamentos(P.de, P.ate);
  const cli = Painel.clientes(P.de, P.ate);
  const fut = Painel.futuro(8, hoje);
  const calor = Painel.calor(P.de, P.ate);
  const porS = Painel.porServico(P.de, P.ate);
  const ori = Painel.origens(P.de, P.ate);
  const eq = Painel.equipe(P.de, P.ate);
  const ant = Painel.antecedencia(P.de, P.ate);
  const ticket = ven.n ? ven.valor / ven.n : 0, ticketA = venA.n ? venA.valor / venA.n : 0;
  const sem12 = (fn) => Painel.semanas(12, hoje, fn).map(s => s.v);
  const semEntre = (de, ate, fn) => { const out = []; let a = de; while (a <= ate && out.length < 27) { const z = addDays(a, 6), zz = z > ate ? ate : z; out.push({ de: a, ate: zz, v: fn(a, zz) }); a = addDays(z, 1); } return out; };
  const entrada = S.p === 'ano'
    ? Painel.meses(+hoje.slice(0, 4), (a, z) => Painel.recebido(a, z > hoje ? hoje : z).voce).map((m, i) => ({ ...m, destaque: i === +hoje.slice(5, 7) - 1 }))
    : S.p === 'custom'
    ? semEntre(P.de, P.ate, (a, z) => Painel.recebido(a, z).voce).map((s, i, arr) => ({ ...s, destaque: i === arr.length - 1 }))
    : Painel.semanas(12, hoje, (a, z) => Painel.recebido(a, z).voce).map((s, i, arr) => ({ ...s, destaque: i === arr.length - 1 }));
  const futTot = fut.reduce((s, f) => s + f.total, 0), futPago = fut.reduce((s, f) => s + f.pago, 0);
  const DIAS = ['seg', 'ter', 'qua', 'qui', 'sex', 'sáb', 'dom'];
  const TUR = [['manha', 'Manhã'], ['tarde', 'Tarde'], ['noite', 'Noite']];
  const calMax = Math.max(0, ...calor.flatMap(d => TUR.map(([k]) => d[k])));
  const passo = (n) => !n ? 0 : Math.min(4, Math.max(1, Math.ceil(n / calMax * 4)));
  let pico = null;
  const DIAS_EXT = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
  const TUR_EXT = { manha: 'de manhã', tarde: 'à tarde', noite: 'à noite' };
  calor.forEach((d, i) => TUR.forEach(([k]) => { if (d[k] && (!pico || d[k] > pico.n)) pico = { n: d[k], txt: DIAS_EXT[i] + ' ' + TUR_EXT[k] }; }));

  /* o que os numeros dizem, em frases — o "detalhe incrivel" e ler isto */
  const frases = [];
  if (porS[0]) { const x = Tours.get(porS[0].tourId); frases.push(`<b>${esc(x ? x.name.pt : '?')}</b> é o serviço que mais rende no período: ${rpEur(porS[0].valor)} em ${porS[0].n} ${porS[0].n > 1 ? 'reservas' : 'reserva'}.`); }
  if (futTot) frases.push(`Você já tem <b>${rpEur(futTot)}</b> vendidos para as próximas 8 semanas — ${rpEur(futPago)} já entraram e ${rpEur(futTot - futPago)} ainda vão chegar.`);
  if (pico) frases.push(`O turno mais cheio é <b>${pico.txt}</b> (${pico.n} ${pico.n > 1 ? 'serviços' : 'serviço'}). É onde vale ter guias confirmadas com antecedência.`);
  if (ant.mediana != null) frases.push(`Metade dos clientes reserva com até <b>${ant.mediana} ${ant.mediana === 1 ? 'dia' : 'dias'}</b> de antecedência — é esse o prazo para começar a divulgar uma data.`);
  if (cli.junto) frases.push(`<b>${cli.junto} ${cli.junto > 1 ? 'pessoas vieram' : 'pessoa veio'} junto</b> com quem reservou. Estão na sua base com o nome de quem trouxe: são as suas próximas indicações.`);
  if (cli.voltaram) frases.push(`<b>${cli.voltaram} de ${cli.n}</b> clientes do período já tinham viajado com você antes.`);
  if (mg.semCusto && srv.n) frases.push(`Em ${mg.semCusto} ${mg.semCusto > 1 ? 'serviços' : 'serviço'} falta o custo da guia/motorista. Preencha em Detalhes para ver a sua margem real.`);
  if (rec.prest) frases.push(`${rpEur(rec.prest)} foram pagos no dia direto às guias e motoristas — não contam como entrada sua.`);

  admShell('reports', `
    <div class="pagehead"><h1 class="pageh">Dashboard</h1>
      <div class="chips">${[['semana', '7 dias'], ['mes', 'Este mês'], ['90', '90 dias'], ['ano', 'Este ano']].map(([v, l]) =>
        `<button class="chip ${S.p === v ? 'on' : ''}" data-rp="${v}">${l}</button>`).join('')}</div></div>
    <div class="per-datas"><span class="per-lbl">Ou escolha o período:</span><input type="date" id="rpDe" value="${esc(S.de || '')}" aria-label="de"><span>até</span><input type="date" id="rpAte" value="${esc(S.ate || '')}" aria-label="até"><button class="mini ${S.p === 'custom' ? 'strong' : ''}" id="rpVer">ver</button></div>
    <p class="why rp-per">${fmtDate(P.de)} a ${fmtDate(P.ate)} · comparado com ${esc(P.ant)} (${opCurta(P.antDe)} a ${opCurta(P.antAte)})</p>

    <section class="card rp-hero">
      <div class="rp-hero-num">
        <small>Entrou para você · ${esc(P.nome)}</small>
        <b>${eur(rec.voce)}</b>
        ${rpDelta(Painel.delta(rec.voce, recA.voce), true, P.antCurto)}
        <span class="rp-extra">${rec.n} ${rec.n === 1 ? 'pagamento' : 'pagamentos'}${rec.prest ? ` · + ${rpEur(rec.prest)} pagos direto às guias e motoristas` : ''}</span>
      </div>
      <div class="rp-hero-graf">
        <span class="op-lbl">${S.p === 'ano' ? 'Mês a mês' : S.p === 'custom' ? 'Semana a semana no período' : 'Semana a semana · últimas 12'}</span>
        <div id="rpEntrada" class="rp-plot"></div>
      </div>
      <div class="rp-full">${rpTabela([S.p === 'ano' ? 'Mês' : 'Semana', 'Entrou'], entrada.map(e => [S.p === 'ano' ? e.rot : `${opCurta(e.de)} a ${opCurta(e.ate)}`, eur(e.v)]))}</div>
    </section>

    ${frases.length ? `<section class="card rp-frases"><h3>O que os números dizem</h3><ul>${frases.map(f => `<li>${f}</li>`).join('')}</ul></section>` : ''}

    <div class="rp-tiles">
      ${rpTile('Vendido no período', eur(ven.valor), rpDelta(Painel.delta(ven.valor, venA.valor), true, P.antCurto), rpSpark(sem12((a, z) => Painel.vendido(a, z).valor)), `${ven.n} ${ven.n === 1 ? 'reserva' : 'reservas'} feitas`)}
      ${rpTile('Serviços no período', `${srv.n} <span class="rp-un">· ${srv.pax} pessoas</span>`, rpDelta(Painel.delta(srv.pax, srvA.pax), true, P.antCurto), rpSpark(sem12((a, z) => Painel.servicos(a, z).pax)), 'a setinha compara as pessoas')}
      ${rpTile('Ticket médio', eur(Math.round(ticket)), rpDelta(Painel.delta(ticket, ticketA), true, P.antCurto), '', 'por reserva vendida')}
      ${rpTile('Sua margem', mg.n ? eur(mg.margem) : '—', mg.n ? `<span class="rp-d n">${rpPct(mg.pct)} do valor dos serviços</span>` : '', '', mg.n ? `em ${mg.n} ${mg.n > 1 ? 'serviços' : 'serviço'} com custo preenchido` : 'preencha o custo em Detalhes')}
      ${rpTile('A receber', eur(ar.comVoce), ar.atrasado ? `<span class="rp-d bad">⚠ ${eur(ar.atrasado)} atrasados</span>` : `<span class="rp-d ok">✓ nada atrasado</span>`, '', `+ ${rpEur(ar.noDia)} que os clientes pagam no dia às guias e motoristas`)}
      ${rpTile('Orçamentos', oc.taxa == null ? `${oc.n}` : rpPct(oc.taxa), oc.taxa == null ? `<span class="rp-d n">nenhum decidido ainda</span>` : `<span class="rp-d n">fecharam ${oc.fechados} de ${oc.fechados + oc.perdidos}</span>`, '', `${oc.n} no período · ${rpEur(oc.valorFechado)} fechados`)}
    </div>

    <section class="card">
      <div class="rp-cab"><h3>Já vendido para as próximas 8 semanas</h3>
        <span class="rp-leg"><i style="background:var(--cv-main)"></i>já entrou <i style="background:var(--cv-soft)"></i>falta receber</span></div>
      <p class="why">${rpEur(futTot)} em serviços marcados daqui para frente · ${rpEur(futPago)} já pagos. Cada coluna é uma semana, a partir de hoje.</p>
      <div id="rpFuturo" class="rp-plot"></div>
      ${rpTabela(['Semana', 'Serviços', 'Pessoas', 'Já entrou', 'Falta', 'Total'], fut.map(f => [`${opCurta(f.de)} a ${opCurta(f.ate)}`, f.n, f.pax, eur(f.pago), eur(f.falta), eur(f.total)]))}
    </section>

    <div class="two-col rp-duas">
      <section class="card">
        <h3>Quando a semana aperta</h3>
        <p class="why">Serviços por dia e turno no período. Onde está mais escuro é onde você mais precisa de guia confirmada.</p>
        <div class="rp-calor" role="table" aria-label="Serviços por dia da semana e turno">
          <span></span>${DIAS.map(d => `<span class="rp-cd">${d}</span>`).join('')}
          ${TUR.map(([k, nome]) => `<span class="rp-ct">${nome}</span>${calor.map((d, i) => `<span class="rp-cel s${passo(d[k])}" tabindex="0"
             data-tip="${esc(JSON.stringify([d[k] + (d[k] === 1 ? ' serviço' : ' serviços'), DIAS[i] + ' · ' + nome.toLowerCase()]))}">${d[k] || ''}</span>`).join('')}`).join('')}
        </div>
        <div class="rp-escala"><span>menos</span>${[1, 2, 3, 4].map(n => `<i class="s${n}"></i>`).join('')}<span>mais</span></div>
        ${rpTabela(['Turno', ...DIAS], TUR.map(([k, nome]) => [nome, ...calor.map(d => d[k])]))}
      </section>
      <section class="card">
        <h3>Com quanta antecedência reservam</h3>
        <p class="why">${ant.n ? `Dias entre a reserva e o serviço. Mediana: <b>${ant.mediana} ${ant.mediana === 1 ? 'dia' : 'dias'}</b> (${ant.n} ${ant.n > 1 ? 'reservas' : 'reserva'}).` : 'Sem reservas no período.'}</p>
        <div id="rpAntec" class="rp-plot"></div>
        ${rpTabela(['Antecedência', 'Reservas'], ant.faixas.map(f => [f.rot, f.n]))}
      </section>
    </div>

    <div class="two-col rp-duas">
      <section class="card">
        <h3>Os serviços que mais rendem</h3>
        ${porS.length ? rpBarras(porS.slice(0, 7).map(r => { const x = Tours.get(r.tourId); const nm = x ? x.name.pt : '?';
          return { rotulo: nm, sub: `${r.n} ${r.n > 1 ? 'reservas' : 'reserva'} · ${r.pax} pessoas`, v: r.valor, txt: rpEur(r.valor), tip: [eur(r.valor), nm, `${r.n} reservas · ${r.pax} pessoas`] }; })) : '<p class="empty">Nenhum serviço no período.</p>'}
        ${porS.length > 7 ? `<p class="why">+ ${porS.length - 7} outros serviços na tabela abaixo.</p>` : ''}
        ${rpTabela(['Serviço', 'Reservas', 'Pessoas', 'Valor'], porS.map(r => [(Tours.get(r.tourId) || { name: { pt: '?' } }).name.pt, r.n, r.pax, eur(r.valor)]))}
      </section>
      <section class="card">
        <h3>De onde vêm os clientes</h3>
        ${ori.length ? rpBarras(ori.map(o => ({ rotulo: RP_ORIGEM[o.origem] || o.origem, v: o.n, txt: `${rpPct(o.pct)} · ${o.n}`,
          tip: [`${o.n} ${o.n > 1 ? 'reservas' : 'reserva'} (${rpPct(o.pct)})`, RP_ORIGEM[o.origem] || o.origem] }))) : '<p class="empty">Nenhum serviço no período.</p>'}
        <div class="rp-mini">
          <div><b>${cli.novos}</b><small>clientes novos</small></div>
          <div><b>${cli.voltaram}</b><small>voltaram</small></div>
          <div><b>${cli.junto}</b><small>vieram junto · indicações</small></div>
        </div>
        ${rpTabela(['Origem', 'Reservas', '%'], ori.map(o => [RP_ORIGEM[o.origem] || o.origem, o.n, rpPct(o.pct)]))}
      </section>
    </div>

    <div class="two-col rp-duas">
      <section class="card">
        <h3>Guias e motoristas no período</h3>
        ${eq.lista.length ? rpBarras(eq.lista.map(r => ({ rotulo: r.pessoa.nome, sub: `${r.pessoa.tipo === 'motorista' ? 'motorista' : 'guia'} · ${r.pax} pessoas`, v: r.n,
          txt: `${r.n} ${r.n > 1 ? 'serviços' : 'serviço'}`, tip: [`${r.n} serviços · ${r.pax} pessoas`, r.pessoa.nome, `${eur(r.noDia)} pagos pelos clientes no dia`] }))) : '<p class="empty">Ninguém escalado no período.</p>'}
        ${eq.sem ? `<p class="why">⚠ ${eq.sem} ${eq.sem > 1 ? 'serviços' : 'serviço'} do período sem guia ou motorista. <a href="#/adm/guias">Escalar</a></p>` : ''}
        ${rpTabela(['Quem', 'Serviços', 'Pessoas', 'Recebeu no dia'], eq.lista.map(r => [r.pessoa.nome, r.n, r.pax, eur(r.noDia)]))}
      </section>
      <section class="card">
        <h3>Sob consulta: do pedido ao fechado</h3>
        ${oc.n ? rpBarras([
          { rotulo: 'Pedidos que chegaram', v: oc.n, txt: String(oc.n), cor: 'var(--cv-s1)', tip: [oc.n + ' pedidos', 'chegaram no período'] },
          { rotulo: 'Orçamentos enviados', v: oc.enviados + oc.fechados + oc.perdidos, txt: String(oc.enviados + oc.fechados + oc.perdidos), cor: 'var(--cv-s2)', tip: [(oc.enviados + oc.fechados + oc.perdidos) + ' enviados', 'inclui os que já fecharam ou não fecharam'] },
          { rotulo: 'Fecharam', v: oc.fechados, txt: `${oc.fechados} · ${rpEur(oc.valorFechado)}`, cor: 'var(--cv-s4)', tip: [oc.fechados + ' fechados', rpEur(oc.valorFechado)] },
        ]) : '<p class="empty">Nenhum pedido no período.</p>'}
        ${oc.novos ? `<p class="why">${oc.novos} ${oc.novos > 1 ? 'pedidos esperando' : 'pedido esperando'} você montar o orçamento. <a href="#/adm/consulta">Abrir</a></p>` : ''}
        ${rpTabela(['Etapa', 'Quantos'], [['Chegaram', oc.n], ['Em montagem', oc.novos], ['Enviados (aguardando)', oc.enviados], ['Fecharam', oc.fechados], ['Não fecharam', oc.perdidos]])}
      </section>
    </div>`);

  /* ---- o relatorio completo: cliques e conversao, clientes, parcerias ---- */
  const fun = Interesse.funil(P.de, P.ate).slice(0, 10), pc = v => (v * 100).toFixed(1).replace('.', ',') + '%';
  const vt = fun.reduce((s2, r) => s2 + r.visitas, 0), qt = fun.reduce((s2, r) => s2 + r.quase, 0), st = fun.reduce((s2, r) => s2 + r.peloSite, 0);
  const cads = Cadastro.all(), compr = cads.filter(c => !c.grupoDe), novosP = cads.filter(c => String(c.criado || '').slice(0, 10) >= P.de && String(c.criado || '').slice(0, 10) <= P.ate).length;
  const volt = compr.filter(c => DB.bookings.filter(b => b.clienteId === c.id && b.status !== 'cancelled').length > 1).length;
  const topCli = compr.map(c => ({ c, r: Cadastro.resumo(c) })).filter(x => x.r.gasto).sort((a, b) => b.r.gasto - a.r.gasto).slice(0, 6);
  const parcs = Parceiros.all().map(p => ({ p, c: Parceiros.conta(p) })).filter(x => x.c.reservas);
  const extra = document.createElement('div');
  const canais = Interesse.porCanal(P.de, P.ate);
  extra.innerHTML = `${canais.length ? `<section class="card"><h3>De onde vêm os cliques <small class="why">por canal</small></h3>
      <p class="why">O link da bio e o robô mandam o endereço com o canal (<code>?de=instagram</code>, <code>?de=whatsapp</code>…). Conversão = reservas e pedidos ÷ aberturas.</p>
      <table class="tbl"><thead><tr><th>Canal</th><th class="right">Abriram</th><th class="right">Quase</th><th class="right">Reservas</th><th class="right">Pedidos</th><th class="right">Conversão</th></tr></thead><tbody>
      ${canais.map(r => `<tr><td>${esc(r.nome)}</td><td class="mono right">${r.visitas}</td><td class="mono right">${r.quase}</td><td class="mono right">${r.reservas}</td><td class="mono right">${r.pedidos}</td><td class="mono right">${r.conv == null ? '—' : pc(r.conv)}</td></tr>`).join('')}
      </tbody></table></section>` : ''}<section class="card"><h3>Cliques e conversão por passeio</h3>
      <p class="why">Quantas vezes abriram cada passeio no app, quantos chegaram a preencher os dados ("quase reservaram") e quantos reservaram — pelo site ou pelo WhatsApp. ${temNuvem() ? '' : 'Na demonstração os números são de exemplo; com o banco ligado, contam os visitantes de verdade.'}</p>
      <div class="rp-mini"><div><b>${vt}</b><small>aberturas de passeio</small></div><div><b>${qt}</b><small>quase reservaram</small></div><div><b>${vt ? pc(fun.reduce((s2, r) => s2 + r.reservas, 0) / vt) : '—'}</b><small>viraram reserva${st ? ` (${st} pelo site)` : ''}</small></div></div>
      ${fun.length ? `<div class="fun-tab-wrap"><table class="tbl"><thead><tr><th>Passeio</th><th class="right">Abriram</th><th class="right">Quase</th><th class="right">Reservas</th><th class="right">Conversão</th><th>Funil</th></tr></thead><tbody>
        ${fun.map(r => `<tr><td>${esc(r.nome)}</td><td class="mono right">${r.visitas}</td><td class="mono right">${r.quase}</td><td class="mono right">${r.reservas}</td><td class="mono right">${r.conv == null ? '—' : pc(r.conv)}</td>
          <td><span class="fun-bar" title="${r.visitas} abriram · ${r.quase} quase · ${r.reservas} reservaram"><i style="width:100%"></i><i class="q" style="width:${r.visitas ? Math.max(2, r.quase / r.visitas * 100) : 0}%"></i><i class="r" style="width:${r.visitas ? Math.max(r.reservas ? 2 : 0, Math.min(100, r.reservas / r.visitas * 100)) : 0}%"></i></span></td></tr>`).join('')}</tbody></table></div>
        <p class="why">${(() => { const topo = Math.max(0, ...fun.map(r => r.visitas)), muito = fun.filter(r => r.visitas >= Math.max(20, topo / 2)).sort((a, b) => (a.conv || 0) - (b.conv || 0))[0]; const melhor = fun.filter(r => r.visitas >= 10 && r.conv).sort((a, b) => b.conv - a.conv)[0];
          return [muito ? `<b>${esc(muito.nome)}</b> é muito visto (${muito.visitas}) e vende pouco — vale rever foto, preço ou texto.` : '', melhor ? `<b>${esc(melhor.nome)}</b> é o que mais converte (${pc(melhor.conv)}).` : ''].filter(Boolean).join(' '); })()}</p>` : '<p class="empty">Sem visitas no período.</p>'}
    </section>
    <div class="two-col rp-duas">
      <section class="card"><h3>Clientes no período</h3>
        <div class="rp-mini"><div><b>${novosP}</b><small>cadastros novos</small></div><div><b>${volt}</b><small>já voltaram (total)</small></div><div><b>${compr.length ? Math.round(compr.filter(c => c.veioPor === 'indicacao').length / compr.length * 100) : 0}%</b><small>vieram por indicação</small></div></div>
        <span class="op-lbl">Quem mais comprou</span>
        ${topCli.map(x => `<div class="deprow"><a href="${fichaHref(x.c)}">${esc(x.c.nome)}</a><small>${x.r.reservas} passeio(s)</small><b class="mono">${eur(x.r.gasto)}</b></div>`).join('') || '<p class="why">—</p>'}
        <a class="mini" href="#/adm/clients">ver todos os clientes</a>
      </section>
      <section class="card"><h3>Parcerias <small class="why">(desde o começo)</small></h3>
        ${parcs.length ? parcs.map(x => `<div class="deprow"><b>${esc(x.p.nome)}</b><small>${x.c.reservas} reserva(s) · ${eur(x.c.faturado)}</small><span class="pill ${x.c.saldo > 0 ? 'warn' : 'ok'}">${x.c.saldo > 0 ? 'comissão ' + eur(x.c.saldo) : '✓ em dia'}</span></div>`).join('') : '<p class="why">Nenhuma reserva veio por parceiro ainda.</p>'}
        <a class="mini" href="#/adm/coupons">cupons e parcerias</a>
      </section>
    </div>`;
  $('#stage').appendChild(extra);
  $$('[data-rp]').forEach(b => b.onclick = () => { S.p = b.dataset.rp; admRelatorios(); });
  $('#rpVer') && ($('#rpVer').onclick = () => { const de = $('#rpDe').value, ate = $('#rpAte').value; if (!de || !ate || de > ate) return toast('Escolha as duas datas (de ≤ até)'); S.de = de; S.ate = ate; S.p = 'custom'; admRelatorios(); });
  const desenha = () => {
    rpColunas($('#rpEntrada'), entrada.map(e => ({ rot: e.rot, v: e.v, destaque: e.destaque,
      tip: [eur(e.v), S.p === 'ano' ? e.rot + ' ' + hoje.slice(0, 4) : `semana de ${opCurta(e.de)} a ${opCurta(e.ate)}`] })), { h: 180 });
    rpColunas($('#rpFuturo'), fut.map(f => ({ rot: f.rot, pilha: true,
      partes: [{ v: f.pago, cor: 'var(--cv-main)' }, { v: f.falta, cor: 'var(--cv-soft)' }],
      tip: [eur(f.total), `semana de ${opCurta(f.de)} a ${opCurta(f.ate)}`, `${eur(f.pago)} já entrou · ${eur(f.falta)} falta`, `${f.n} serviços · ${f.pax} pessoas`] })), { h: 200, pilha: true, rotDoInicio: true });
    const cores = ['var(--cv-s1)', 'var(--cv-s2)', 'var(--cv-s3)', 'var(--cv-s4)'];
    /* faixas de antecedencia em ordem: um tom do vinho por faixa, do claro ao escuro */
    rpColunas($('#rpAntec'), ant.faixas.map((f, i) => ({ rot: f.curto, v: f.n, cor: cores[i],
      tip: [`${f.n} ${f.n === 1 ? 'reserva' : 'reservas'}`, f.rot + ' antes'] })), { h: 170, fmt: (v) => String(v), fmtEixo: (v) => String(Math.round(v * 10) / 10) });
    rpLigaDicas($('#stage'));
  };
  desenha();
  clearTimeout(admRelatorios._t);
  if (!admRelatorios._ro) {
    admRelatorios._ro = true;
    addEventListener('resize', () => { clearTimeout(admRelatorios._t); admRelatorios._t = setTimeout(() => { if (location.hash.startsWith('#/adm/reports')) admRelatorios(); }, 200); });
  }
}

/* =====================================================
   TAREFAS E ANOTACOES — com lembretes e agenda ligada

   A tarefa e INTELIGENTE: ao marcar "mandei a mensagem", o app ja cria
   "aguardar resposta" com prazo; "nao respondeu" vira um lembrete; a espera
   de pagamento, de orcamento e da guia se fecha sozinha quando acontece.
   Os lembretes ("o app lembra") sao calculados: clientes que devem,
   orcamentos para montar ou vencendo, voucher para mandar, guia para escalar.
===================================================== */
const ETAPA_ICO = { mensagem: '✉', cobrar: '💵', orcamento: '🧾', guia: '👤', aguardar: '⏳', fechar: '🤝', escalar: '👤' };
function tfPrazoTxt(t, hoje) {
  if (!t.prazo) return '';
  const q = t.prazo === hoje ? 'hoje' : t.prazo === addDays(hoje, 1) ? 'amanhã' : t.prazo === addDays(hoje, -1) ? 'ontem' : fmtDate(t.prazo);
  return q + (t.hora ? ' · ' + t.hora : '');
}
function tfClienteHref(t) {
  if (t.clienteKey) return '#/adm/clients/' + encodeURIComponent(t.clienteKey);
  return '';
}
function tfBaixaIcs(t) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([icsTarefa(t)], { type: 'text/calendar;charset=utf-8' }));
  a.download = 'tarefa-' + (t.prazo || 'sem-data') + '.ics'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  toast('Abra o arquivo para pôr na agenda do celular (aviso 30 min antes).');
}
/* uma linha de tarefa: o circulo conclui; na espera, os botoes dizem o que houve */
function tfLinha(t, hoje) {
  const atras = t.prazo && t.prazo < hoje && !t.feita;
  const et = ETAPAS[t.etapa];
  const pes = t.pessoaId ? Equipe.get(t.pessoaId) : null;
  const wa = (t.whats || (pes && pes.whats)) ? waLink('', opNum(t.whats || pes.whats)) : '';
  const cli = tfClienteHref(t);
  const abrir = t.etapa === 'fechar' && t.orcId ? `<a class="mini strong" href="#/adm/consulta/${esc(t.orcId)}">abrir o orçamento</a>`
    : (t.etapa === 'escalar' || t.etapa === 'guia') && (t.bookingId || (t.liga && t.liga.bookingId)) ? `<a class="mini strong" href="#/adm/guias/servico:${esc(t.bookingId || t.liga.bookingId)}">abrir Guias</a>`
    : t.orcId ? `<a class="mini" href="#/adm/consulta/${esc(t.orcId)}">orçamento</a>` : '';
  if (t.feita) return `<div class="tf-row feita">
      <button class="tf-ck on" data-desfaz="${esc(t.id)}" aria-label="desfazer">✓</button>
      <div class="tf-corpo"><span class="tf-txt">${esc(t.texto)}</span>
        <small>${t.obsFim ? esc(t.obsFim) + ' · ' : ''}feita ${t.feitaEm ? new Date(t.feitaEm).toLocaleDateString('pt-BR') : ''}</small></div></div>`;
  return `<div class="tf-row ${atras ? 'atras' : ''} ${t.etapa === 'aguardar' ? 'espera' : ''}" id="tf-${esc(t.id)}">
    <button class="tf-ck" data-conclui="${esc(t.id)}" aria-label="concluir: ${esc(t.texto)}" title="${t.etapa === 'aguardar' ? 'Concluir a espera' : 'Feito'}"></button>
    <div class="tf-corpo">
      <span class="tf-txt">${t.etapa && ETAPA_ICO[t.etapa] ? ETAPA_ICO[t.etapa] + ' ' : ''}${esc(t.texto)}</span>
      <span class="tf-meta">
        ${t.prazo ? `<span class="tf-quando ${atras ? 'bad' : t.prazo === hoje ? 'hoje' : ''}">${atras ? '⚠ ' : ''}${esc(tfPrazoTxt(t, hoje))}</span>` : ''}
        ${t.prio === 'alta' ? '<span class="tf-prio alta">alta</span>' : t.prio === 'baixa' ? '<span class="tf-prio baixa">baixa</span>' : ''}
        ${t.cat === 'pessoal' ? '<span class="tf-prio pessoal">pessoal</span>' : ''}
        ${cli ? `<a href="${cli}">${esc(t.clienteNome || 'cliente')}</a>` : t.clienteNome ? `<span>${esc(t.clienteNome)}</span>` : ''}
        ${pes ? `<span>👤 ${esc(pes.nome)}</span>` : ''}
        ${t.tentativa > 1 ? `<span>${t.tentativa}ª tentativa</span>` : ''}
        ${et && et.depois ? `<span class="tf-dep">depois: ${esc(et.depois)}</span>` : ''}
        ${t.fechaQuando ? `<span class="tf-dep">✨ fecha sozinha quando ${t.fechaQuando === 'pago' ? 'o cliente pagar' : t.fechaQuando === 'orc-decidido' ? 'o orçamento fechar' : 'a guia responder'}</span>` : ''}
      </span>
      ${t.detalhe ? `<small class="tf-det">${esc(t.detalhe)}</small>` : ''}
      <div class="tacts">
        ${t.etapa === 'aguardar' ? `<button class="mini strong" data-res="${esc(t.id)}|respondeu">✓ ${t.fechaQuando === 'pago' ? 'pagou' : 'respondeu'}</button>
          <button class="mini" data-res="${esc(t.id)}|cutucar">não ${t.fechaQuando === 'pago' ? 'pagou' : 'respondeu'}: lembrar</button>
          <button class="mini ghost" data-adia="${esc(t.id)}">+2 dias</button>` : ''}
        ${abrir}
        ${wa ? `<a class="mini" target="_blank" rel="noopener" href="${wa}">💬 WhatsApp</a>` : ''}
        <button class="mini ghost" data-ics="${esc(t.id)}" title="pôr na agenda do celular">📅 agenda</button>
        <button class="mini ghost" data-tfed="${esc(t.id)}">editar</button>
        <button class="mini ghost danger" data-tfrm="${esc(t.id)}" aria-label="apagar">✕</button>
      </div>
      <div class="svc-form" id="tfe-${esc(t.id)}" hidden>
        <label class="fld">Tarefa<input id="tfeT-${esc(t.id)}" value="${esc(t.texto)}"></label>
        <div class="frow"><label class="fld">Dia<input type="date" id="tfeD-${esc(t.id)}" value="${esc(t.prazo)}"></label>
          <label class="fld sm">Hora<input id="tfeH-${esc(t.id)}" value="${esc(t.hora)}" placeholder="09:00"></label></div>
        <label class="fld">Detalhe<textarea id="tfeX-${esc(t.id)}" rows="2">${esc(t.detalhe)}</textarea></label>
        <button class="cta sm" data-tfsalva="${esc(t.id)}">Salvar</button>
      </div>
    </div></div>`;
}
/* o que o app lembra: clientes que devem e o resto, calculado na hora */
function tfLembretesHtml(hoje) {
  const dev = Lembretes.devedores(hoje);
  const lem = Lembretes.lista(hoje);
  const GI = { orcamentos: '🧾', servicos: '🚐' };
  if (!dev.length && !lem.length) return '';
  return `<section class="card tf-lembra">
    <h3>O app lembra</h3>
    ${dev.length ? `<span class="op-lbl">Clientes que devem · ${eur(dev.reduce((s, d) => s + d.total, 0))}</span>
      ${dev.map(d => `<div class="tf-lem ${d.atrasado ? 'bad' : ''}">
        <div class="tf-corpo"><span class="tf-txt"><a href="#/adm/clients/${encodeURIComponent(d.chave)}">${esc(d.nome)}</a> deve <b>${eur(d.total)}</b></span>
          <small>${d.atrasado ? '⚠ atrasado desde ' : 'até '}${fmtDate(d.prazo)} · ${d.servicos.map(b => esc(opNomeServ(b))).join(', ')}</small></div>
        <div class="tacts">${d.whats ? `<a class="mini strong" target="_blank" rel="noopener" data-cobra="${esc(d.chave)}"
            href="${waLink(t('waCharge', { name: opPrimeiro(d.nome), v: eur(d.total), tour: opNomeServ(d.servicos[0]), when: fmtDate(d.servicos[0].date) }), opNum(d.whats))}">💬 cobrar</a>` : ''}
          <a class="mini" href="#/adm/clients/${encodeURIComponent(d.chave)}">registrar pagamento</a></div>
      </div>`).join('')}` : ''}
    ${lem.length ? `<span class="op-lbl">Para fazer</span>
      ${lem.map(l => `<div class="tf-lem ${l.nivel}">
        <div class="tf-corpo"><span class="tf-txt">${GI[l.grupo] || '•'} ${esc(l.txt)}</span>${l.sub ? `<small>${esc(l.sub)}</small>` : ''}</div>
        <div class="tacts"><a class="mini strong" href="${esc(l.href)}">abrir</a>
          <button class="mini ghost" data-visto="${esc(l.chave)}">✓ feito</button></div>
      </div>`).join('')}` : ''}
  </section>`;
}
function admTarefas(arg) {
  const S = admTarefas._s = admTarefas._s || { v: 'tarefas', busca: '' };
  S.f = S.f || 'todas'; S.cat = S.cat || 'tudo';
  if (arg === 'notas') S.v = 'notas';
  const hoje = isoToday();
  const sozinhas = Tarefas.sincroniza(hoje);
  const G0 = Tarefas.grupos(hoje);
  /* filtros como nas Tarefas da Bia: Hoje / Semana / Todas / Feitas e
     Tudo / Profissional / Pessoal. Dentro de cada grupo, a alta vem antes. */
  const PRIO = { alta: 0, media: 1, baixa: 2 };
  const filtra = (l) => l.filter(t => S.cat === 'tudo' || (t.cat || 'profissional') === S.cat).sort((a, b) => (PRIO[a.prio] ?? 1) - (PRIO[b.prio] ?? 1));
  const G = Object.fromEntries(Object.entries(G0).map(([k, l]) => [k, filtra(l)]));
  const mostra = (k) => S.f === 'feitas' ? k === 'feitas' : S.f === 'hoje' ? ['atrasadas', 'hoje'].includes(k) : S.f === 'semana' ? ['atrasadas', 'hoje', 'semana'].includes(k) : k !== 'feitas';
  /* recados do atendimento (robô do WhatsApp/Instagram) que esperam por ela */
  const recados = (typeof conversas === 'function' && typeof CLIENTES !== 'undefined') ? conversas().filter(v => v.estado === 'pendente').map(v => ({ v, c: CLIENTES.find(c => c.id === v.id) })).filter(x => x.c) : [];
  const abertas = G.atrasadas.length + G.hoje.length + G.semana.length + G.depois.length + G.semData.length;
  const notas = Tarefas.notas(S.busca);
  const clientes = Clients.all().filter(c => !c.acompanhante);
  const grupo = (tit, lista, cls) => lista.length ? `<section class="card tf-grupo ${cls || ''}"><h3>${tit} <span class="tf-n">${lista.length}</span></h3>${lista.map(t => tfLinha(t, hoje)).join('')}</section>` : '';
  const recentes = Tarefas.all().filter(t => t.feita && /sozinha/.test(t.obsFim || '') && t.feitaEm && t.feitaEm.slice(0, 10) >= addDays(hoje, -1));

  admShell('tarefas', `
    <div class="pagehead"><h1 class="pageh">Tarefas e anotações</h1>
      <div class="chips">
        <button class="chip ${S.v === 'tarefas' ? 'on' : ''}" data-tv="tarefas">Tarefas · ${abertas}</button>
        <button class="chip ${S.v === 'notas' ? 'on' : ''}" data-tv="notas">Anotações · ${Tarefas.notas('').length}</button>
        <a class="mini" href="#/adm/agenda">ver na agenda</a>
      </div></div>
    <datalist id="tfClis">${clientes.map(c => `<option value="${esc(c.name)}">`).join('')}</datalist>

    ${S.v === 'tarefas' ? `
    <div class="tf-filtros" role="group" aria-label="Filtrar tarefas">
      <div class="chips">${[['hoje', 'Hoje'], ['semana', 'Semana'], ['todas', 'Todas'], ['feitas', 'Feitas']].map(([k, n]) => `<button class="chip ${S.f === k ? 'on' : ''}" data-tff="${k}" aria-pressed="${S.f === k}">${n}</button>`).join('')}</div>
      <div class="chips">${[['tudo', 'Tudo'], ['profissional', 'Profissional'], ['pessoal', 'Pessoal']].map(([k, n]) => `<button class="chip ${S.cat === k ? 'on' : ''}" data-tfc="${k}" aria-pressed="${S.cat === k}">${n}</button>`).join('')}</div>
    </div>
    <section class="card tf-nova">
      <label class="fld">O que precisa fazer?<input id="tfTexto" autocomplete="off" placeholder="Ex.: mandar o roteiro para a Patrícia amanhã 10h (ou peça ao assistente)"></label>
      <div class="frow">
        <label class="fld">Dia<input type="date" id="tfData"></label>
        <label class="fld sm">Hora<input id="tfHora" placeholder="09:00"></label>
        <label class="fld sm">Prioridade<select id="tfPrio"><option value="alta">alta</option><option value="media" selected>média</option><option value="baixa">baixa</option></select></label>
        <label class="fld sm">Tipo<select id="tfCat"><option value="profissional">profissional</option><option value="pessoal">pessoal</option></select></label>
      </div>
      <div class="frow">
        <label class="fld grow">Cliente (opcional)<input id="tfCli" list="tfClis" autocomplete="off"></label>
        <button class="cta sm" id="tfAdd">Anotar</button>
      </div>
      <p class="why" id="tfPrev">O app entende "hoje", "amanhã", "sexta", "12/10" e "9h" escritos no texto. Tarefa de mandar mensagem, cobrar ou orçamento já vem com o passo seguinte.</p>
    </section>
    ${sozinhas.length || recentes.length ? `<section class="card tf-sozinha"><h3>✨ Concluídas sozinhas</h3>
      ${[...new Map([...sozinhas, ...recentes].map(t => [t.id, t])).values()].map(t => `<div class="tf-row feita"><span class="tf-ck on">✓</span><div class="tf-corpo"><span class="tf-txt">${esc(t.texto)}</span><small>${esc(t.obsFim)}</small></div></div>`).join('')}
    </section>` : ''}
    ${recados.length && S.f !== 'feitas' ? `<section class="card tf-grupo tf-recados"><h3>Recados <span class="tf-n">${recados.length}</span></h3>
      <p class="why">O que chega pelo atendimento (WhatsApp e Instagram) e precisa de você.</p>
      ${recados.map(({ v, c }) => `<div class="tf-row"><span class="tf-ck rec" aria-hidden="true">${c.canal === 'whats' ? 'WA' : 'IG'}</span><div class="tf-corpo"><span class="tf-txt">${esc(c.nome)}</span>
        <small class="tf-det">${esc(c.msg)}</small><div class="tacts"><a class="mini strong" href="#/adm/inbox/${esc(v.id)}">Responder</a></div></div></div>`).join('')}</section>` : ''}
    ${S.f !== 'feitas' ? tfLembretesHtml(hoje) : ''}
    ${mostra('atrasadas') ? grupo('Atrasadas', G.atrasadas, 'bad') : ''}
    ${mostra('hoje') ? grupo('Hoje', G.hoje, 'hoje') : ''}
    ${mostra('semana') ? grupo('Próximos 7 dias', G.semana) : ''}
    ${mostra('depois') ? grupo('Mais para frente', G.depois) : ''}
    ${mostra('semData') ? grupo('Sem data', G.semData) : ''}
    ${S.f !== 'feitas' && !['atrasadas', 'hoje', 'semana', 'depois', 'semData'].some(k => mostra(k) && G[k].length) ? `<div class="emptybox"><p>${S.f === 'hoje' ? 'Nada para hoje.' : S.f === 'semana' ? 'Nada para esta semana.' : 'Nenhuma tarefa aberta.'}</p></div>` : ''}
    ${S.f === 'feitas' ? (G.feitas.length ? `<section class="card tf-grupo"><h3>Feitas <span class="tf-n">${G.feitas.length}</span></h3>${G.feitas.map(t => tfLinha(t, hoje)).join('')}</section>` : '<div class="emptybox"><p>Nenhuma feita ainda.</p></div>')
      : G.feitas.length ? `<details class="card tf-grupo"><summary><b>Feitas</b> <span class="tf-n">${G.feitas.length}</span></summary>${G.feitas.map(t => tfLinha(t, hoje)).join('')}</details>` : ''}
    ` : `
    <section class="card tf-nova">
      <label class="fld">Nova anotação<textarea id="ntTexto" rows="3" placeholder="O que você quer lembrar? Fornecedor, ideia, detalhe de um cliente..."></textarea></label>
      <div class="frow">
        <label class="fld grow">Cliente (opcional)<input id="ntCli" list="tfClis" autocomplete="off"></label>
        <label class="optin"><input type="checkbox" id="ntFixa"><span><b>Fixar no topo</b></span></label>
        <button class="cta sm" id="ntAdd">Salvar</button>
      </div>
      <p class="why">Quando o WhatsApp estiver ligado, o resumo de cada conversa nova cai aqui, para você conferir de manhã.</p>
    </section>
    <div class="op-busca"><input id="ntBusca" type="search" placeholder="🔎 Procurar nas anotações" value="${esc(S.busca)}"></div>
    <div class="nt-grade">${notas.map(n => `<article class="nt-card ${n.fixa ? 'fixa' : ''}">
        <div class="nt-top">${n.fixa ? '<span title="fixada">📌</span>' : ''}${n.origem === 'whats' ? '<span class="pill warn">💬 resumo do WhatsApp</span>' : ''}
          <small>${new Date(n.criada).toLocaleDateString('pt-BR')}</small></div>
        <b>${esc(n.texto)}</b>
        ${n.detalhe ? `<p>${esc(n.detalhe).replace(/\n/g, '<br>')}</p>` : ''}
        ${n.clienteNome ? (n.clienteKey ? `<a href="#/adm/clients/${encodeURIComponent(n.clienteKey)}">${esc(n.clienteNome)}</a>` : `<span class="why">${esc(n.clienteNome)}</span>`) : ''}
        <div class="tacts">
          ${n.orcId ? `<a class="mini strong" href="#/adm/consulta/${esc(n.orcId)}">abrir o orçamento</a>` : ''}
          <button class="mini ghost" data-fixa="${esc(n.id)}">${n.fixa ? 'soltar' : 'fixar'}</button>
          <button class="mini ghost" data-virar="${esc(n.id)}">virar tarefa</button>
          <button class="mini ghost danger" data-tfrm="${esc(n.id)}" aria-label="apagar">✕</button>
        </div>
      </article>`).join('') || '<p class="empty">Nenhuma anotação.</p>'}</div>`}`);

  const re = () => admTarefas();
  $$('[data-tv]').forEach(b => b.onclick = () => { S.v = b.dataset.tv; re(); });
  $$('[data-tff]').forEach(b => b.onclick = () => { S.f = b.dataset.tff; re(); });
  $$('[data-tfc]').forEach(b => b.onclick = () => { S.cat = b.dataset.tfc; re(); });
  const cliDe = (nome) => { const c = clientes.find(x => x.name.toLowerCase() === String(nome || '').trim().toLowerCase()); return { clienteKey: c ? c.key : '', clienteNome: String(nome || '').trim(), whats: c ? c.whats : '' }; };
  const tx = $('#tfTexto');
  if (tx) {
    const prev = () => {
      const p = lerPrazo(tx.value, hoje), et = ETAPAS[etapaDoTexto(tx.value)];
      const d = $('#tfData').value || p.data, h = $('#tfHora').value || p.hora;
      $('#tfPrev').textContent = tx.value.trim()
        ? [d ? '📅 ' + fmtDate(d) + (h ? ' · ' + h : '') : 'sem data', et && et.depois ? 'depois de feita: ' + et.depois : ''].filter(Boolean).join(' · ')
        : 'O app entende "hoje", "amanhã", "sexta", "12/10" e "9h" escritos no texto. Tarefa de mandar mensagem, cobrar ou orçamento já vem com o passo seguinte.';
    };
    tx.oninput = prev; $('#tfData').onchange = prev;
    const adiciona = () => {
      if (!tx.value.trim()) { tx.focus(); return toast('Escreva a tarefa.'); }
      const p = lerPrazo(tx.value, hoje);
      const t2 = Tarefas.cria({ texto: tx.value, prazo: $('#tfData').value || p.data, hora: $('#tfHora').value.trim() || p.hora, prio: $('#tfPrio').value, cat: $('#tfCat').value, ...cliDe($('#tfCli').value) });
      toast('Tarefa criada' + (t2.prazo ? ' para ' + tfPrazoTxt(t2, hoje) : ''));
      re(); setTimeout(() => $('#tfTexto') && $('#tfTexto').focus(), 30);
    };
    $('#tfAdd').onclick = adiciona;
    tx.onkeydown = (e) => { if (e.key === 'Enter') adiciona(); };
  }
  $$('[data-conclui]').forEach(b => b.onclick = () => {
    const t0 = Tarefas.get(b.dataset.conclui);
    const nova = Tarefas.conclui(t0.id, t0.etapa === 'aguardar' ? 'respondeu' : '');
    toast(nova ? `Feito ✓ · próximo passo: ${nova.texto}${nova.prazo ? ' (' + tfPrazoTxt(nova, hoje) + ')' : ''}` : 'Feito ✓');
    re();
  });
  $$('[data-res]').forEach(b => b.onclick = () => {
    const [id, r] = b.dataset.res.split('|');
    const nova = Tarefas.conclui(id, r);
    toast(nova ? `Próximo passo: ${nova.texto}` : 'Feito ✓');
    re();
  });
  $$('[data-adia]').forEach(b => b.onclick = () => { Tarefas.adia(b.dataset.adia, 2); toast('Espera adiada 2 dias'); re(); });
  $$('[data-desfaz]').forEach(b => b.onclick = () => { Tarefas.marca(b.dataset.desfaz, false); re(); });
  $$('[data-ics]').forEach(b => b.onclick = () => tfBaixaIcs(Tarefas.get(b.dataset.ics)));
  $$('[data-tfed]').forEach(b => b.onclick = () => { const el = document.getElementById('tfe-' + b.dataset.tfed); if (el) el.hidden = !el.hidden; });
  $$('[data-tfsalva]').forEach(b => b.onclick = () => {
    const id = b.dataset.tfsalva;
    Tarefas.salva(id, { texto: $('#tfeT-' + id).value, prazo: $('#tfeD-' + id).value, hora: $('#tfeH-' + id).value, detalhe: $('#tfeX-' + id).value });
    toast('Salvo'); re();
  });
  $$('[data-tfrm]').forEach(b => b.onclick = () => { if (confirm('Apagar?')) { Tarefas.remove(b.dataset.tfrm); re(); } });
  $$('[data-visto]').forEach(b => b.onclick = () => { Lembretes.marca(b.dataset.visto); re(); });
  /* cobrou pelo WhatsApp: nasce "aguardar o pagamento", que fecha sozinha quando ele pagar */
  $$('[data-cobra]').forEach(a => a.addEventListener('click', () => {
    const d = Lembretes.devedores(hoje).find(x => x.chave === a.dataset.cobra);
    if (d) { Espera.pagamento(d); setTimeout(() => { toast('Cobrança enviada · o app fica aguardando o pagamento'); re(); }, 400); }
  }));
  const nt = $('#ntTexto');
  if (nt) {
    $('#ntAdd').onclick = () => {
      if (!nt.value.trim()) { nt.focus(); return toast('Escreva a anotação.'); }
      const linhas = nt.value.trim().split('\n');
      Tarefas.cria({ tipo: 'nota', texto: linhas[0], detalhe: linhas.slice(1).join('\n'), fixa: $('#ntFixa').checked, ...cliDe($('#ntCli').value) });
      toast('Anotação salva'); re();
    };
    $('#ntBusca').oninput = (e) => { S.busca = e.target.value; clearTimeout(admTarefas._b); admTarefas._b = setTimeout(() => { re(); const i = $('#ntBusca'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 250); };
    $$('[data-fixa]').forEach(b => b.onclick = () => { const n = Tarefas.get(b.dataset.fixa); Tarefas.salva(n.id, { fixa: !n.fixa }); re(); });
    $$('[data-virar]').forEach(b => b.onclick = () => {
      const n = Tarefas.get(b.dataset.virar);
      const p = lerPrazo(n.texto + ' ' + n.detalhe, hoje);
      Tarefas.cria({ texto: n.texto, detalhe: n.detalhe, prazo: p.data, hora: p.hora, clienteKey: n.clienteKey, clienteNome: n.clienteNome, whats: n.whats, orcId: n.orcId });
      S.v = 'tarefas'; toast('Virou tarefa'); re();
    });
  }
}
/* bloco pequeno para o Hoje e para a ficha: as tarefas abertas de um recorte */
function tfMiniHtml(lista, hoje, vazio) {
  return lista.length ? lista.map(t => tfLinha(t, hoje)).join('') : `<p class="why">${vazio}</p>`;
}
function tfLigaMini(redesenha) {
  $$('[data-conclui]').forEach(b => b.onclick = () => { const t0 = Tarefas.get(b.dataset.conclui); const nova = Tarefas.conclui(t0.id, t0.etapa === 'aguardar' ? 'respondeu' : ''); toast(nova ? `Feito ✓ · próximo passo: ${nova.texto}` : 'Feito ✓'); redesenha(); });
  $$('[data-res]').forEach(b => b.onclick = () => { const [id, r] = b.dataset.res.split('|'); const nova = Tarefas.conclui(id, r); toast(nova ? `Próximo passo: ${nova.texto}` : 'Feito ✓'); redesenha(); });
  $$('[data-adia]').forEach(b => b.onclick = () => { Tarefas.adia(b.dataset.adia, 2); redesenha(); });
  $$('[data-desfaz]').forEach(b => b.onclick = () => { Tarefas.marca(b.dataset.desfaz, false); redesenha(); });
  $$('[data-ics]').forEach(b => b.onclick = () => tfBaixaIcs(Tarefas.get(b.dataset.ics)));
  $$('[data-tfed]').forEach(b => b.onclick = () => { const el = document.getElementById('tfe-' + b.dataset.tfed); if (el) el.hidden = !el.hidden; });
  $$('[data-tfsalva]').forEach(b => b.onclick = () => { const id = b.dataset.tfsalva; Tarefas.salva(id, { texto: $('#tfeT-' + id).value, prazo: $('#tfeD-' + id).value, hora: $('#tfeH-' + id).value, detalhe: $('#tfeX-' + id).value }); redesenha(); });
  $$('[data-tfrm]').forEach(b => b.onclick = () => { if (confirm('Apagar?')) { Tarefas.remove(b.dataset.tfrm); redesenha(); } });
}

/* =====================================================
   GOOGLE DRIVE — a pasta EmRoma (backup + arquivos dos clientes)

   A ponte com o Drive e a PASTA: ela instala o Google Drive para computador
   e liga, uma vez, a pasta "Meu Drive > EmRoma". O app grava dentro dela e o
   Drive sobe sozinho:
     EmRoma › Backups              um arquivo por dia (os ultimos 60)
     EmRoma › CRM › CRM-EmRoma.csv a planilha dela, atualizada todo dia
     EmRoma › Clientes › <nome>    comprovantes e documentos (o assistente guarda)
   O Chrome guarda a permissao; as vezes, depois de reiniciar, pede um toque.
   Sem pasta (iPhone, Safari): o arquivo fica guardado no app e o backup sai
   como download. O que nao subiu fica na fila e sobe na proxima vez.
===================================================== */
const BKP_IDB = 'app-backup';
function bkpIdb() {
  return new Promise((ok, falha) => {
    const r = indexedDB.open(BKP_IDB, 2);
    r.onupgradeneeded = () => { for (const st of ['h', 'arq']) if (!r.result.objectStoreNames.contains(st)) r.result.createObjectStore(st); };
    r.onsuccess = () => ok(r.result); r.onerror = () => falha(r.error);
  });
}
async function arqIdb(modo, id, valor) {
  try {
    const db = await bkpIdb();
    return await new Promise((ok) => {
      const tx = db.transaction('arq', modo === 'get' ? 'readonly' : 'readwrite'), st = tx.objectStore('arq');
      if (modo === 'get') { const g = st.get(id); g.onsuccess = () => ok(g.result || null); g.onerror = () => ok(null); }
      else { st.put(valor, id); tx.oncomplete = () => ok(true); tx.onerror = () => ok(false); }
    });
  } catch (e) { return modo === 'get' ? null : false; }
}
const DRV_BACKUPS = 'Backups', DRV_CRM = 'CRM', DRV_CLIENTES = 'Clientes';
function drvNome(t) { return String(t || '').replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Sem nome'; }
/* a pasta, com a permissao do Chrome. comToque = veio de um clique (pode pedir) */
async function drvLiberada(comToque) {
  const h = await bkpPasta(); if (!h) return drvMarca({ erro: 'sem-pasta' });
  let perm = 'prompt';
  try { perm = await h.queryPermission({ mode: 'readwrite' }); } catch (e) {}
  if (perm !== 'granted' && comToque) { try { perm = await h.requestPermission({ mode: 'readwrite' }); } catch (e) {} }
  return drvMarca(perm === 'granted' ? { h, pasta: h.name } : { erro: 'precisa-toque', pasta: h.name });
}
/* o estado fica guardado para a tela e o assistente saberem sem esperar */
let drvEstado = { pasta: '', liberada: false, visto: false };
function drvMarca(r) {
  drvEstado = { pasta: r.pasta || '', liberada: !!r.h, visto: true };
  $$('.drv-bt').forEach(b => { b.classList.toggle('ok', drvEstado.liberada); b.classList.toggle('warn', !!drvEstado.pasta && !drvEstado.liberada); });
  return r;
}
async function drvGrava(h, caminho, nome, conteudo) {
  let d = h;
  for (const p of caminho) d = await d.getDirectoryHandle(drvNome(p), { create: true });
  const f = await d.getFileHandle(nome, { create: true });
  const w = await f.createWritable(); await w.write(conteudo); await w.close();
  return [h.name, ...caminho.map(drvNome), nome].join(' › ');
}
/* ARQUIVOS: o comprovante (ou documento) fica no app E na pastinha do cliente
   no Drive. No app: o arquivo no IndexedDB do aparelho e a ficha em DB.arquivos
   (que vai no backup e na nuvem). drive = onde ficou no Drive ('' = na fila). */
const Arquivos = {
  lista(f = {}) { return (DB.arquivos || []).filter(a => (!f.clienteId || a.clienteId === f.clienteId) && (!f.bookingId || a.bookingId === f.bookingId)).sort((a, b) => b.criado.localeCompare(a.criado)); },
  get(id) { return (DB.arquivos || []).find(a => a.id === id) || null; },
  pendentes() { return (DB.arquivos || []).filter(a => !a.drive); },
  /* devolve a ficha na hora; gravar no aparelho e no Drive acontece por tras */
  guarda({ src, blob, nome, tipo, clienteId, clienteNome, bookingId, descricao }) {
    const ext = (String(src || '').match(/^data:([^;]+)/) || [])[1] || (blob && blob.type) || 'image/jpeg';
    const fim = /pdf/.test(ext) ? '.pdf' : /png/.test(ext) ? '.png' : '.jpg';
    const base = drvNome(nome || `${isoToday()} ${tipo || 'arquivo'}`).replace(/\.(jpe?g|png|pdf)$/i, '');
    const a = { id: uid(), nome: base + fim, tipo: tipo || 'documento', clienteId: clienteId || '', clienteNome: clienteNome || '', bookingId: bookingId || '',
                descricao: descricao || '', criado: new Date().toISOString(), mime: ext, drive: '' };
    DB.arquivos = DB.arquivos || []; DB.arquivos.push(a); _opSave();
    const feito = (async () => {
      const b = blob || await (await fetch(src)).blob();
      await arqIdb('put', a.id, b);
      const r = await Arquivos.paraDrive(a, false);
      if (r.ok) toast('📁 No Google Drive: ' + r.caminho);
      return r;
    })();
    return { arquivo: a, feito };
  },
  async paraDrive(a, comToque) {
    const l = await drvLiberada(comToque); if (l.erro) return l;
    const b = await arqIdb('get', a.id); if (!b) return { erro: 'nao-esta-aqui' };
    a.drive = await drvGrava(l.h, [DRV_CLIENTES, a.clienteNome || 'Sem cliente'], a.nome, b);
    _opSave();
    return { ok: true, caminho: a.drive };
  },
  /* sobe o que ficou na fila (celular, ou Chrome pedindo toque) */
  async sobeFila(comToque) {
    let n = 0;
    for (const a of Arquivos.pendentes()) { const r = await Arquivos.paraDrive(a, comToque); if (r.ok) n++; else if (r.erro !== 'nao-esta-aqui') break; }
    return n;
  },
  async abre(id) {
    const a = Arquivos.get(id), b = await arqIdb('get', id);
    if (b) { window.open(URL.createObjectURL(b), '_blank'); return; }
    toast(a && a.drive ? 'Este arquivo está no Google Drive: ' + a.drive : 'Este arquivo foi guardado em outro aparelho.');
  },
};
/* qualquer link de arquivo guardado no app: data-arq="id" */
document.addEventListener('click', (e) => { const el = e.target.closest && e.target.closest('[data-arq]'); if (!el) return; e.preventDefault(); Arquivos.abre(el.dataset.arq); });
async function bkpPasta(nova) {
  try {
    const db = await bkpIdb();
    return await new Promise((ok) => {
      const tx = db.transaction('h', nova === undefined ? 'readonly' : 'readwrite'), st = tx.objectStore('h');
      if (nova === undefined) { const g = st.get('pasta'); g.onsuccess = () => ok(g.result || null); g.onerror = () => ok(null); }
      else { (nova ? st.put(nova, 'pasta') : st.delete('pasta')); tx.oncomplete = () => ok(nova); tx.onerror = () => ok(null); }
    });
  } catch (e) { return null; }
}
const bkpTemPasta = () => typeof window.showDirectoryPicker === 'function';
async function bkpEscolherPasta() {
  if (!bkpTemPasta()) { toast('Este navegador não deixa escolher pasta. Use o Chrome no computador — ou o botão Baixar.'); return null; }
  try {
    const h = await window.showDirectoryPicker({ id: 'app-backup', mode: 'readwrite', startIn: 'documents' });
    await bkpPasta(h);
    return h;
  } catch (e) { return null; }
}
/* grava o arquivo do dia na pasta. comToque = veio de um clique (pode pedir permissao) */
async function bkpNaPasta(comToque) {
  const l = await drvLiberada(comToque); if (l.erro) return l;
  const h = l.h, nome = Backup.nome();
  const caminho = await drvGrava(h, [DRV_BACKUPS], nome, JSON.stringify(pacoteBackup(), null, 2));
  /* a planilha dela, sempre a mais nova, pronta para abrir no Google Planilhas */
  try { await drvGrava(h, [DRV_CRM], 'CRM-' + negocioArquivo() + '.csv', '\ufeff' + crmCsv(crmLinhas())); } catch (e) {}
  /* guarda os ultimos 60 dias; o resto sai para a pasta nao crescer para sempre */
  try {
    const limite = Backup.nome(addDays(isoToday(), -60)), d = await h.getDirectoryHandle(DRV_BACKUPS);
    for await (const [n, e] of d.entries()) if (e.kind === 'file' && new RegExp('^' + negocioArquivo() + '-backup-\\d{4}-\\d{2}-\\d{2}\\.json$').test(n) && n < limite) await d.removeEntry(n);
  } catch (e) {}
  try { await Arquivos.sobeFila(false); } catch (e) {}
  Backup.marca('pasta', caminho);
  return { ok: true, pasta: h.name, arquivo: nome, caminho };
}
function bkpBaixa() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(pacoteBackup(), null, 2)], { type: 'application/json' }));
  a.download = Backup.nome(); a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  Backup.marca('download', Backup.nome());
  return { ok: true, baixado: Backup.nome() };
}
/* "fazer backup agora": na pasta se tiver, senao baixa */
async function bkpAgora(comToque) {
  const r = await bkpNaPasta(comToque);
  if (r.ok) return r;
  if (r.erro === 'precisa-toque' && !comToque) return r;
  return bkpBaixa();
}
/* O AUTOMATICO: uma vez por dia, quando ela abre o painel */
async function bkpDoDia() {
  if (Backup.feitoHoje() || bkpDoDia._rodou) return;
  bkpDoDia._rodou = true;
  if (!DB.bookings.length && !DB.tours.length) return;
  const r = await bkpNaPasta(false);
  if (r.ok) { toast(`💾 Backup de hoje salvo em ${r.pasta}`); return; }
  /* nao deu sozinho (sem pasta, ou o Chrome pede um toque): um aviso discreto no Hoje */
  const st = document.getElementById('stage');
  if (!st || document.getElementById('bkpAviso')) return;
  const el = document.createElement('div');
  el.id = 'bkpAviso'; el.className = 'alert warn bkp-aviso';
  el.innerHTML = r.erro === 'precisa-toque'
    ? `💾 Backup de hoje: o Chrome pede um toque para usar a pasta "${esc(r.pasta)}". <button class="mini strong" id="bkpToque">Salvar agora</button>`
    : `💾 Você ainda não fez o backup de hoje. <button class="mini strong" id="bkpToque">Salvar agora</button> <a class="mini" href="#/adm/settings">escolher a pasta do Drive</a>`;
  const ph = st.querySelector('.pagehead'); if (ph) ph.after(el); else st.prepend(el);
  el.querySelector('#bkpToque').onclick = async () => { const x = await bkpAgora(true); el.remove(); toast(x.ok ? `💾 Backup salvo${x.pasta ? ' em ' + x.pasta : ' (baixado)'}` : 'Não salvou — tente em Ajustes'); };
}
/* o cartao dos Ajustes */
function bkpAjustesHtml() {
  const u = Backup.ultimo();
  return `<section class="card" id="bkpCartao">
    <h3>Backup automático · computador e Google Drive</h3>
    <p class="why">Todo dia, na primeira vez que você abre o painel, o app salva tudo (clientes, reservas, pagamentos, guias, orçamentos, tarefas) na pasta <b>${esc(guiaNegocio())}</b> do seu Google Drive: o backup em <b>Backups</b>, a planilha em <b>CRM</b> e os comprovantes em <b>Clientes</b>.</p>
    <button class="mini strong" data-at="drive">📁 Abrir o painel do Google Drive</button>
    <ol class="bkp-passos">
      <li>No computador, instale o <b>Google Drive para computador</b> (google.com/drive/download) e entre com a sua conta.</li>
      <li>No Drive, crie a pasta <b>${esc(guiaNegocio())}</b>.</li>
      <li>Toque em <b>Escolher a pasta</b> e escolha: Google Drive › Meu Drive › ${esc(guiaNegocio())}.</li>
    </ol>
    <p class="bkp-estado" id="bkpEstado">${u.em ? `✓ Último backup: <b>${new Date(u.em).toLocaleString('pt-BR')}</b> · ${u.onde === 'pasta' ? 'na pasta ' + esc(u.arquivo) : 'baixado (' + esc(u.arquivo) + ')'}` : 'Nenhum backup ainda.'}</p>
    <div class="btnrow">
      ${bkpTemPasta() ? '<button class="cta sm" id="bkpPastaBt">Escolher a pasta</button>' : ''}
      <button class="mini strong" id="bkpJa">Fazer backup agora</button>
      <button class="mini" id="bkpDown">Baixar um arquivo</button>
    </div>
    ${bkpTemPasta() ? '' : '<p class="why">Neste navegador não dá para escolher pasta (iPhone e Safari). O backup sai como arquivo baixado — no computador, use o Chrome.</p>'}
    <div class="rulesep"></div>
    <b>Voltar um backup</b>
    <p class="why">Trocou de computador ou perdeu os dados? Escolha o arquivo de backup: o app mostra o que tem dentro e só troca depois que você confirmar.</p>
    <label class="fld">Arquivo de backup (.json)<input type="file" id="bkpArq" accept="application/json,.json"></label>
    <div id="bkpPrev"></div>
  </section>`;
}
async function bkpAjustesLiga() {
  const h = await bkpPasta();
  const est = document.getElementById('bkpEstado');
  if (h && est) est.insertAdjacentHTML('beforeend', `<br>📁 Pasta escolhida: <b>${esc(h.name)}</b>`);
  const re = () => { const c = document.getElementById('bkpCartao'); if (c) { c.outerHTML = bkpAjustesHtml(); bkpAjustesLiga(); } };
  $('#bkpPastaBt')?.addEventListener('click', async () => { const p = await bkpEscolherPasta(); if (p) { const r = await bkpNaPasta(true); toast(r.ok ? `💾 Pasta "${p.name}" escolhida e backup de hoje salvo` : 'Pasta escolhida'); re(); } });
  $('#bkpJa')?.addEventListener('click', async () => { const r = await bkpAgora(true); toast(r.ok ? (r.pasta ? `💾 Salvo em ${r.pasta}` : '💾 Backup baixado') : 'Não salvou'); re(); });
  $('#bkpDown')?.addEventListener('click', () => { bkpBaixa(); toast('💾 Backup baixado'); re(); });
  $('#bkpArq')?.addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const txt = await f.text(); const r = lerBackup(txt);
    const box = document.getElementById('bkpPrev');
    if (r.erro) { box.innerHTML = `<div class="alert bad">${esc(r.erro)}</div>`; return; }
    const s = r.resumo;
    box.innerHTML = `<div class="alert warn bkp-volta"><div><b>Backup de ${s.salvoEm ? new Date(s.salvoEm).toLocaleString('pt-BR') : '?'}</b><br>
      ${s.reservas} reservas · ${s.clientes} clientes · ${s.passeios} passeios · ${s.guias} guias/motoristas · ${s.orcamentos} orçamentos · ${s.tarefas} tarefas e anotações<br>
      <small>O que está no app AGORA será trocado por isto. Antes, o app baixa uma cópia do que existe hoje, por segurança.</small></div>
      <button class="cta sm" id="bkpVoltaOk">Voltar este backup</button></div>`;
    document.getElementById('bkpVoltaOk').onclick = () => {
      bkpBaixa();   /* copia de seguranca do que existe agora */
      const x = restauraBackup(txt);
      if (x.erro) return toast(x.erro);
      toast(`Backup restaurado: ${x.resumo.reservas} reservas, ${x.resumo.tarefas} tarefas`);
      setTimeout(() => go('/adm/today'), 400);
    };
  });
}

/* =====================================================
   QUEM VAI NO PASSEIO (a reserva do cliente)

   Pedido de 29/09: cada pessoa que vai — adulto ou crianca — com nome
   completo e data de nascimento, porque os ingressos sao nominais. So quem
   compra da WhatsApp e e-mail: a Ingrid fala so com ele. E quem compra pode
   estar reservando para outra pessoa ("a filha reservou para a mae").
===================================================== */
function nascOk(v) {
  const m = String(v || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/); if (!m) return false;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  return d.getMonth() === +m[2] - 1 && d.getFullYear() > 1900 && d <= new Date();
}
/* dd/mm/aaaa enquanto digita — no celular ninguem acha a barra */
function mascaraNasc(el) {
  el.addEventListener('input', () => {
    const d = el.value.replace(/\D/g, '').slice(0, 8);
    el.value = d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  });
}
function participantesHtml(x, S) {
  const obrig = x.priceMode !== 'transfer';
  const vai = S.compradorVai !== false;
  const n = Math.max(0, S.pax - (vai ? 1 : 0));
  return `<div class="grupo part">
    <b>${L('Quem vai no passeio', 'Who is coming')} · ${S.pax} ${S.pax > 1 ? L('pessoas', 'people', 'personas') : L('pessoa', 'person', 'persona')}</b>
    <small class="why">${obrig ? L('Nome completo e data de nascimento de cada pessoa, adulto ou criança — os ingressos são nominais. Nós falamos só com você.',
      'Full name and date of birth of each person, adult or child — tickets are issued by name. We only contact you.')
      : L('Opcional no transfer: o nome de quem vem junto ajuda o motorista.', 'Optional for transfers: names help the driver.')}</small>
    <label class="optin"><input type="checkbox" id="fVai" ${vai ? 'checked' : ''}><span><b>${L('Eu também vou', 'I am coming too')}</b><small>${L('Desmarque se estiver reservando para outra pessoa.', 'Untick if you are booking for someone else.')}</small></span></label>
    <label class="fld" id="fNascBox" ${vai ? '' : 'hidden'}>${L('Sua data de nascimento', 'Your date of birth')}<input id="fNasc" placeholder="dd/mm/aaaa" inputmode="numeric" maxlength="10" autocomplete="bday"></label>
    <div id="grpRows">${Array.from({ length: n }, grupoLinha).join('')}</div>
  </div>
  <div class="grupo veio">
    <b>${L('Como você conheceu a', 'How did you find')} ${esc(guiaNegocio())}?</b>
    <select id="fVeio"><option value="">${L('Escolha…', 'Choose…')}</option>
      ${VEIO_POR.filter(v => v[0] !== 'junto').map(([v, n2]) => `<option value="${v}">${esc(v === 'voltou' ? L('Já viajei com ' + guiaNome(), 'I have travelled with ' + guiaNome()) : n2)}</option>`).join('')}</select>
    <label class="fld" id="fIndBox" hidden>${L('Quem indicou?', 'Who referred you?')}<input id="fInd" placeholder="${L('nome de quem indicou', 'name')}"></label>
  </div>`;
}
function ligaParticipantes(book, S) {
  const rows = book.querySelector('#grpRows');
  $$('.gnasc', book).forEach(mascaraNasc); const fn = book.querySelector('#fNasc'); if (fn) mascaraNasc(fn);
  book.querySelector('#fVai').onchange = (e) => {
    S.compradorVai = e.target.checked;
    book.querySelector('#fNascBox').hidden = !e.target.checked;
    if (e.target.checked) { const ult = rows.lastElementChild; if (ult) ult.remove(); }
    else { rows.insertAdjacentHTML('beforeend', grupoLinha()); mascaraNasc(rows.lastElementChild.querySelector('.gnasc')); }
  };
  book.querySelector('#fVeio').onchange = (e) => { book.querySelector('#fIndBox').hidden = e.target.value !== 'indicacao'; };
}
function lerParticipantes(x) {
  const vai = $('#fVai') ? $('#fVai').checked : true;
  const nasc = vai && $('#fNasc') ? $('#fNasc').value.trim() : '';
  const grupo = $$('.grow').map(r => ({ nome: r.querySelector('.gnome').value.trim(), nasc: r.querySelector('.gnasc').value.trim() }));
  if (x.priceMode !== 'transfer') {
    if (vai && !nascOk(nasc)) { $('#fNasc').focus(); return { erro: L('Falta a sua data de nascimento (dd/mm/aaaa) — é para o ingresso.', 'Your date of birth is missing (dd/mm/yyyy) — it is for the ticket.') }; }
    const k = grupo.findIndex(g => !g.nome || g.nome.split(/\s+/).length < 2 || !nascOk(g.nasc));
    if (k >= 0) { const r = $$('.grow')[k]; (r.querySelector('.gnome').value.trim().split(/\s+/).length < 2 ? r.querySelector('.gnome') : r.querySelector('.gnasc')).focus();
      return { erro: L(`Falta o nome completo ou a data de nascimento da pessoa ${k + (vai ? 2 : 1)} — os ingressos são nominais.`, `Full name or date of birth missing for person ${k + (vai ? 2 : 1)} — tickets are issued by name.`) }; }
  }
  return { vai, nasc, grupo: grupo.filter(g => g.nome), veioPor: ($('#fVeio') || {}).value || '', indicadoPor: ($('#fInd') || {}).value || '' };
}

/* =====================================================
   CUPONS E PARCERIAS — influencer, agencia, parceiro
   Cada um com o cupom dele; o app conta reservas, faturado e comissao.
===================================================== */
function admParcerias() {
  const S = admParcerias._s = admParcerias._s || { ed: '' };
  const ps = Parceiros.all(), contas = new Map(ps.map(p => [p.id, Parceiros.conta(p)]));
  const tot = (k) => [...contas.values()].reduce((s2, c) => s2 + c[k], 0);
  const ed = S.ed ? Parceiros.get(S.ed) : null;
  const avulsos = DB.coupons.filter(c => !c.parceiroId);
  admShell('coupons', `
    <div class="pagehead"><h1 class="pageh">Indicações e cupons</h1><span class="why">quem traz cliente para você (agência, influencer, indicação) e a comissão de cada um</span></div>
    <div class="rp-tiles">
      ${rpTile('Parceiros', String(ps.length), '', '', 'influencers, agências e parceiros')}
      ${rpTile('Reservas por parceiros', String(tot('reservas')), '', '', `${tot('clientes')} clientes trazidos`)}
      ${rpTile('Faturado com eles', eur(tot('faturado')), '', '', 'valor dos serviços')}
      ${rpTile('Comissão a pagar', eur(tot('saldo')), tot('saldo') > 0 ? '<span class="rp-d warn">pendente</span>' : '<span class="rp-d ok">✓ em dia</span>', '', `${eur(tot('paga'))} já pagos`)}
    </div>
    ${ps.map(p => { const c = contas.get(p.id), bs = Parceiros.reservas(p);
      return `<section class="card par-card"><div class="rp-cab"><h3>${esc(p.nome)} <small class="why">${esc((TIPOS_PARCEIRO.find(t2 => t2[0] === p.tipo) || [0, p.tipo])[1])}${p.contato ? ' · ' + esc(p.contato) : ''}</small></h3>
        ${p.cupom ? `<span class="pill conta">cupom <b>${esc(p.cupom)}</b>${p.desconto ? ' · ' + p.desconto + '% para o cliente' : ''}</span>` : ''}</div>
        <div class="par-nums"><span><small>Reservas</small><b>${c.reservas}</b></span><span><small>Clientes</small><b>${c.clientes}</b></span><span><small>Faturado</small><b>${eur(c.faturado)}</b></span>
          <span><small>Comissão ${p.comissao}%</small><b>${eur(c.devida)}</b></span><span><small>Já pago</small><b>${eur(c.paga)}</b></span><span class="${c.saldo > 0 ? 'par-deve' : ''}"><small>A pagar</small><b>${eur(c.saldo)}</b></span></div>
        ${bs.length ? `<details><summary class="why">as ${bs.length} reservas</summary>${bs.map(b => `<div class="deprow"><span class="mono">${crmData(b.date)}</span><a href="${opFicha(b)}">${esc(b.name)}</a><span>${esc(nomeDoServico(b))}</span><b class="mono">${eur(b.total)}</b></div>`).join('')}</details>` : '<p class="why">Nenhuma reserva ainda.</p>'}
        <div class="btnrow">
          ${c.saldo > 0 ? `<input type="number" min="0" step="0.01" class="par-val" id="pv-${esc(p.id)}" value="${c.saldo}"><button class="mini strong" data-parpaga="${esc(p.id)}">registrar comissão paga</button>` : ''}
          <button class="mini" data-pared="${esc(p.id)}">editar</button><button class="mini ghost danger" data-parrm="${esc(p.id)}">remover</button></div>
      </section>`; }).join('') || '<div class="emptybox"><p>Nenhum parceiro ainda. Cadastre influencers e agências para saber quanto cada um traz.</p></div>'}
    <section class="card" id="parForm"><h3>${ed ? 'Editar ' + esc(ed.nome) : '+ Novo parceiro'}</h3>
      <div class="frow"><label class="fld">Nome<input id="pfNome" value="${esc(ed ? ed.nome : '')}" placeholder="Carol pelo Mundo"></label>
        <label class="fld">É<select id="pfTipo">${TIPOS_PARCEIRO.map(([v, l]) => `<option value="${v}" ${(ed ? ed.tipo : 'influencer') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="fld">Contato<input id="pfCont" value="${esc(ed ? ed.contato : '')}" placeholder="@instagram ou WhatsApp"></label></div>
      <div class="frow"><label class="fld">Cupom<input id="pfCupom" value="${esc(ed ? ed.cupom : '')}" placeholder="CAROL10"></label>
        <label class="fld sm">Desconto %<input type="number" min="0" max="100" id="pfDesc" value="${ed ? ed.desconto : 10}"></label>
        <label class="fld sm">Comissão %<input type="number" min="0" max="100" id="pfCom" value="${ed ? ed.comissao : 10}"></label></div>
      <label class="fld">Observação<input id="pfObs" value="${esc(ed ? ed.obs : '')}"></label>
      <p class="why">O cupom vale na reserva pelo app. Quem usar entra no cadastro como "veio por influencer/agência", ligado a este parceiro. A comissão é sobre o valor dos serviços.</p>
      <div class="btnrow"><button class="cta sm" id="pfSalva">${ed ? 'Salvar' : 'Cadastrar parceiro'}</button>${ed ? '<button class="mini" id="pfCanc">cancelar</button>' : ''}</div></section>
    <section class="card"><h3>Outros cupons</h3>
      ${avulsos.map(c => `<div class="deprow"><b class="mono">${esc(c.code)}</b><span>${c.pct}% · até ${c.until ? crmData(c.until) + '/' + c.until.slice(2, 4) : '—'} · usado ${(c.uses || []).length}×</span><button class="mini ghost danger" data-cuprm="${esc(c.code)}">apagar</button></div>`).join('') || '<p class="why">Nenhum.</p>'}
      <div class="frow"><label class="fld">Código<input id="cpC" placeholder="VOLTA10"></label><label class="fld sm">%<input type="number" id="cpP" value="10"></label><label class="fld">Validade<input type="date" id="cpV"></label><button class="mini strong" id="cpAdd">+ cupom</button></div>
    </section>`);
  const re = () => admParcerias();
  $('#pfSalva').onclick = () => {
    const r = Parceiros.salva({ id: S.ed, nome: $('#pfNome').value, tipo: $('#pfTipo').value, contato: $('#pfCont').value, cupom: $('#pfCupom').value,
      desconto: $('#pfDesc').value, comissao: $('#pfCom').value, obs: $('#pfObs').value });
    if (r.erro) return toast(r.erro);
    toast(S.ed ? 'Salvo' : `${r.nome} cadastrado${r.cupom ? ' · cupom ' + r.cupom : ''}`); S.ed = ''; re();
  };
  $('#pfCanc')?.addEventListener('click', () => { S.ed = ''; re(); });
  $$('[data-pared]').forEach(b => b.onclick = () => { S.ed = b.dataset.pared; re(); setTimeout(() => $('#parForm').scrollIntoView({ block: 'center' }), 30); });
  $$('[data-parrm]').forEach(b => b.onclick = () => { const p = Parceiros.get(b.dataset.parrm); if (p && confirm(`Remover ${p.nome}? O cupom ${p.cupom || ''} deixa de valer.`)) { Parceiros.remove(p.id); re(); } });
  $$('[data-parpaga]').forEach(b => b.onclick = () => { const v = +$('#pv-' + b.dataset.parpaga).value; if (!(v > 0)) return toast('Valor da comissão paga'); Parceiros.paga(b.dataset.parpaga, v); toast('Comissão registrada'); re(); });
  $$('[data-cuprm]').forEach(b => b.onclick = () => { if (confirm('Apagar o cupom ' + b.dataset.cuprm + '?')) { Coupons.remove(b.dataset.cuprm); re(); } });
  $('#cpAdd').onclick = () => {
    const code = $('#cpC').value.toUpperCase().replace(/\s+/g, ''), pct = +$('#cpP').value;
    if (!code || !(pct > 0 && pct <= 100)) return toast('Código e desconto de 1 a 100%');
    if (DB.coupons.some(c => c.code === code)) return toast('Esse cupom já existe');
    Coupons.create({ code, pct, until: $('#cpV').value || '2099-12-31', oncePerPerson: true, uses: [] }); re();
  };
}

/* =====================================================
   ATALHOS — o que ela mais faz, a um toque, em TODAS as abas
   (pedido de 29/09: "ela precisa ter facil orcamento pra enviar, voucher e
   cadastro cliente"). Cada um abre uma janelinha; nada de procurar a aba.
===================================================== */
function atalhosHtml() {
  return `<nav class="atalhos" aria-label="Atalhos">
    <button class="at-b at-forte" data-at="orc">＋ Orçamento</button>
    <button class="at-b" data-at="voucher">🎫 Voucher</button>
    <button class="at-b" data-at="cliente">👤 Novo cliente</button>
    <button class="at-b" data-at="pagto">💵 Pagamento</button>
    <button class="at-b drv-bt ${drvEstado.liberada ? 'ok' : drvEstado.pasta ? 'warn' : ''}" data-at="drive"><i class="drv-dot" aria-hidden="true"></i>📁 Google Drive</button>
  </nav>`;
}
/* a janelinha (dialog nativo: Esc fecha, o foco fica dentro) */
function opJanela(titulo, corpo) {
  document.querySelectorAll('dialog.op-dlg').forEach(d => d.remove());
  const d = document.createElement('dialog');
  d.className = 'op-dlg';
  d.innerHTML = `<div class="op-dlg-top"><h2>${titulo}</h2><button class="op-dlg-x" aria-label="Fechar">✕</button></div><div class="op-dlg-corpo">${corpo}</div>`;
  document.body.appendChild(d);
  d.querySelector('.op-dlg-x').onclick = () => d.close();
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.showModal();
  return d;
}
/* achar a reserva: por nome, codigo ou WhatsApp; sem busca, as proximas */
function atReservas(q, soDevendo) {
  const n = _nomeN(q), dig = String(q || '').replace(/\D/g, ''), hoje = isoToday();
  return DB.bookings.filter(b => b.status !== 'cancelled' && (!soDevendo || Bookings.due(b) > 0))
    .filter(b => !n || _nomeN(b.name).includes(n) || String(b.code || '').toLowerCase().includes(String(q).toLowerCase()) || (dig.length >= 4 && String(b.whats || '').replace(/\D/g, '').includes(dig)))
    .sort((a, b) => ((a.date >= hoje) === (b.date >= hoje) ? (a.date >= hoje ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)) : a.date >= hoje ? -1 : 1))
    .slice(0, 12);
}
function atLinhaReserva(b) {
  return `<button class="at-res" data-res="${esc(b.id)}"><b>${esc(b.name)}</b><span>${crmData(b.date)} · ${esc(nomeDoServico(b))}</span><small>${esc(b.code || '')}${Bookings.due(b) > 0 ? ' · falta ' + eur(Bookings.due(b)) : ' · pago ✓'}</small></button>`;
}
function atBusca(d, soDevendo, escolhe) {
  const inp = d.querySelector('.at-q'), box = d.querySelector('.at-lista');
  const pinta = () => { const l = atReservas(inp.value, soDevendo); box.innerHTML = l.map(atLinhaReserva).join('') || '<p class="why">Nenhuma reserva com esse nome.</p>';
    box.querySelectorAll('[data-res]').forEach(x => x.onclick = () => escolhe(Bookings.get(x.dataset.res))); };
  inp.oninput = pinta; pinta(); inp.focus();
}
const ATALHO = {
  orc() {
    const d = opJanela('＋ Novo orçamento', `<p class="why">Cole a conversa do WhatsApp (ou Instagram, e-mail). O app monta o rascunho com os preços da sua tabela; você confere e manda.</p>
      <label class="fld">Conversa<textarea id="atConv" rows="7" placeholder="Cole aqui a conversa inteira"></textarea></label>
      <div class="btnrow"><button class="cta sm" id="atLer">Ler e montar o rascunho</button><button class="mini" id="atBranco">começar em branco</button></div>`);
    d.querySelector('#atConv').focus();
    d.querySelector('#atBranco').onclick = () => { const o = Orc.cria({ origem: 'manual', status: 'rascunho' }); d.close(); go('/adm/consulta/' + o.id); };
    d.querySelector('#atLer').onclick = () => {
      const txt = d.querySelector('#atConv').value; if (!txt.trim()) return toast('Cole a conversa primeiro.');
      const c = lerConversa(txt), itens = rascunhoDaConversa(c);
      const o = Orc.cria({ origem: 'whats', status: 'rascunho', cliente: { nome: c.nome, whats: c.whats }, conversa: txt, resumo: c.resumo, pax: c.pax, datas: c.datas, itens });
      Tarefas.cria({ tipo: 'nota', origem: 'whats', texto: `Resumo do WhatsApp — ${c.nome || 'cliente novo'}`, detalhe: c.resumo, orcId: o.id, clienteNome: c.nome, whats: c.whats });
      d.close(); toast(`Rascunho montado: ${itens.length} ${itens.length === 1 ? 'serviço' : 'serviços'}`); go('/adm/consulta/' + o.id);
    };
  },
  voucher() {
    const d = opJanela('🎫 Voucher', `<p class="why">De quem é o voucher? Digite o nome, o código ou o WhatsApp.</p>
      <input class="at-q" type="search" placeholder="🔎 nome, código ou WhatsApp"><div class="at-lista"></div>`);
    atBusca(d, false, (b) => { d.close(); go('/adm/voucher/' + b.id); });
  },
  cliente() {
    const d = opJanela('👤 Novo cliente', `
      <div class="frow"><label class="fld">Nome completo<input id="atNome" autocomplete="off"></label><label class="fld">WhatsApp<input id="atWa" inputmode="tel" autocomplete="off"></label></div>
      <div class="frow"><label class="fld">E-mail<input id="atEm" type="email" autocomplete="off"></label><label class="fld">Nascimento<input id="atNasc" placeholder="dd/mm/aaaa" inputmode="numeric"></label></div>
      <div class="frow"><label class="fld">Veio por<select id="atVeio"><option value="">—</option>${VEIO_POR.filter(v => v[0] !== 'junto').map(([vv, nn]) => `<option value="${vv}">${nn}</option>`).join('')}</select></label>
        <label class="fld">Agência · indicação · influencer<input id="atQuem" list="atQuemL" placeholder="quem mandou esta cliente"></label></div>
      <datalist id="atQuemL">${[...Parceiros.all().map(p => p.nome), ...Cadastro.all().map(c => c.nome)].map(x => `<option value="${esc(x)}">`).join('')}</datalist>
      <button class="cta sm" id="atCad">Cadastrar e abrir a ficha</button>`);
    mascaraNasc(d.querySelector('#atNasc')); d.querySelector('#atNome').focus();
    d.querySelector('#atCad').onclick = () => {
      const nome = d.querySelector('#atNome').value.trim(); if (!nome) return toast('Falta o nome.');
      const nasc = d.querySelector('#atNasc').value.trim(); if (nasc && !nascOk(nasc)) return toast('Nascimento em dd/mm/aaaa');
      const quem = d.querySelector('#atQuem').value.trim(), par = quem ? Parceiros.all().find(p => _nomeN(p.nome) === _nomeN(quem)) : null;
      const indC = quem && !par ? Cadastro.all().find(x => _nomeN(x.nome) === _nomeN(quem)) : null;
      let veio = d.querySelector('#atVeio').value || (par ? (par.tipo === 'agencia' ? 'agencia' : 'influencer') : quem ? 'indicacao' : '');
      const c = Cadastro.novo({ nome, whats: d.querySelector('#atWa').value, email: d.querySelector('#atEm').value, nasc, veioPor: veio,
        parceiroId: par ? par.id : '', indicadoPor: indC ? indC.id : '', indicadoNome: par ? par.nome : indC ? indC.nome : quem });
      if (!c) return toast('Não cadastrou');
      d.close(); toast('Cliente cadastrada'); go(fichaHref(c).slice(1));
    };
  },
  pagto(jaEscolhida) {
    const d = opJanela('💵 Registrar pagamento', `<p class="why">Quem pagou?</p><input class="at-q" type="search" placeholder="🔎 nome, código ou WhatsApp"><div class="at-lista"></div><div id="atPg"></div>`);
    const escolhe = (b) => {
      const falta = Bookings.due(b);
      d.querySelector('.at-lista').innerHTML = atLinhaReserva(b); d.querySelector('.at-q').hidden = true;
      d.querySelector('#atPg').innerHTML = `
        <div class="frow"><label class="fld">Valor (${moedaSigla()})<input id="atVal" inputmode="decimal" value="${falta}"></label>
          <label class="fld">Onde caiu<select id="atConta"><option value="">escolha…</option>${Contas.all().map(c => `<option value="${esc(c.id)}">${esc(c.nome)}</option>`).join('')}<option value="${CONTA_PRESTADOR}">${esc(Contas.nome(CONTA_PRESTADOR))}</option></select></label></div>
        <label class="fld">Comprovante (foto ou PDF) — vai para a ficha e para a pasta do cliente no Google Drive<input id="atArq" type="file" accept="image/*,application/pdf"></label>
        <button class="cta sm" id="atPgOk">Registrar ${eur(falta)}</button>`;
      const val = d.querySelector('#atVal'), bt = d.querySelector('#atPgOk');
      val.oninput = () => { bt.textContent = 'Registrar ' + eur(+String(val.value).replace(',', '.') || 0); };
      bt.onclick = async () => {
        const conta = d.querySelector('#atConta').value; if (!conta) return toast('Em que conta caiu?');
        const p = registraPagamento(b.id, { valor: +String(val.value).replace(',', '.') || 0, conta }); if (!p) return toast('Nada a registrar (já está pago?)');
        const f = d.querySelector('#atArq').files[0];
        if (f) {
          const c = b.clienteId ? Cadastro.get(b.clienteId) : null;
          const { arquivo } = Arquivos.guarda({ blob: f, nome: `${isoToday()} comprovante ${eur(p.amount).replace(/\s/g, '')} ${b.code || ''}`.trim(), tipo: 'comprovante', clienteId: b.clienteId, clienteNome: (c && c.nome) || b.name, bookingId: b.id });
          p.arquivoId = arquivo.id; _opSaveBooking(b);
        }
        Tarefas.sincroniza();
        d.close(); toast(`💵 ${eur(p.amount)} registrado · ${Contas.nome(conta)}${Bookings.due(b) ? ' · ainda falta ' + eur(Bookings.due(b)) : ' · pago ✓'}`);
        route();
      };
    };
    if (jaEscolhida && jaEscolhida.id) { if (Bookings.due(jaEscolhida) <= 0) { d.close(); toast('Esta reserva já está paga ✓'); return; } escolhe(jaEscolhida); } else atBusca(d, true, escolhe);
  },
  async drive() {
    const u = Backup.ultimo(), temPasta = bkpTemPasta(), fila = Arquivos.pendentes().length;
    const l = await drvLiberada(false);
    const d = opJanela('📁 Google Drive e backup', `
      <div class="drv-estado ${l.h ? 'ok' : l.pasta ? 'warn' : ''}">${l.h ? `✓ Ligado à pasta <b>${esc(l.pasta)}</b> do seu Google Drive` : l.pasta ? `A pasta <b>${esc(l.pasta)}</b> está escolhida, mas o Chrome pede um toque para usar.` : temPasta ? 'O Google Drive ainda não está ligado.' : 'Neste aparelho não dá para ligar pasta (celular, Safari). Os arquivos ficam guardados no app; ligue o Drive no computador, pelo Chrome.'}</div>
      <p class="drv-ultimo">${u.em ? `💾 Último backup: <b>${new Date(u.em).toLocaleString('pt-BR')}</b><br><small>${esc(u.onde === 'pasta' ? u.arquivo : 'baixado: ' + u.arquivo)}</small>` : '💾 Nenhum backup ainda.'}</p>
      <div class="btnrow">
        ${temPasta ? (l.h ? '' : l.pasta ? '<button class="cta sm" id="drvToque">Liberar a pasta</button>' : '<button class="cta sm" id="drvLiga">Ligar o Google Drive</button>') : ''}
        <button class="mini strong" id="drvJa">Fazer backup agora</button>
        ${fila && l.h ? `<button class="mini" id="drvFila">Mandar ${fila} ${fila === 1 ? 'arquivo' : 'arquivos'} que ficaram na fila</button>` : ''}
        <a class="mini" href="https://drive.google.com/drive/my-drive" target="_blank" rel="noopener">Abrir o Google Drive ↗</a>
        ${temPasta && l.pasta ? '<button class="mini ghost" id="drvTroca">trocar a pasta</button>' : ''}
      </div>
      <h3>O que vai para lá</h3>
      <ul class="drv-arvore">
        <li>📁 <b>${esc(l.pasta || guiaNegocio())}</b>
          <ul><li>📁 <b>Backups</b> — tudo do app, um arquivo por dia (ficam os últimos 60 dias)</li>
            <li>📁 <b>CRM</b> — <i>CRM-${esc(negocioArquivo())}.csv</i>: a sua planilha, atualizada todo dia (abre no Google Planilhas)</li>
            <li>📁 <b>Clientes</b> › <i>nome do cliente</i> — comprovantes e documentos que você manda pelo assistente ou pelo 💵 Pagamento</li></ul></li>
      </ul>
      ${fila ? `<p class="why">⏳ ${fila} ${fila === 1 ? 'arquivo ainda não subiu' : 'arquivos ainda não subiram'} para o Drive — ${fila === 1 ? 'está guardado' : 'estão guardados'} no app e ${fila === 1 ? 'sobe' : 'sobem'} quando a pasta estiver ligada.</p>` : ''}
      ${l.h ? '' : `<details ${temPasta && !l.pasta ? 'open' : ''}><summary><b>Como ligar (uma vez só, no computador)</b></summary><ol class="bkp-passos">
        <li>Instale o <b>Google Drive para computador</b> (google.com/drive/download) e entre com a sua conta.</li>
        <li>No Drive, crie a pasta <b>${esc(guiaNegocio())}</b> (em Meu Drive).</li>
        <li>Aqui, toque em <b>Ligar o Google Drive</b> e escolha: Google Drive › Meu Drive › ${esc(guiaNegocio())}.</li></ol></details>`}
      <h3>☁️ Nuvem (celular e computador juntos)</h3>
      <p class="why">${temNuvem() ? '✓ Ligada: o que você faz num aparelho aparece no outro sozinho.' : 'Ainda desligada: cada aparelho guarda o seu. Liga quando o banco de dados da ${esc(guiaNegocio())} for criado — aí celular e computador ficam sempre iguais, sem fazer nada.'}</p>`);
    const re = () => { d.close(); setTimeout(() => ATALHO.drive(), 50); };
    const liga = async () => { const p = await bkpEscolherPasta(); if (!p) return; const r = await bkpNaPasta(true); toast(r.ok ? `📁 Ligado à pasta "${p.name}" · backup de hoje salvo` : 'Pasta escolhida'); re(); };
    d.querySelector('#drvLiga')?.addEventListener('click', liga);
    d.querySelector('#drvTroca')?.addEventListener('click', liga);
    d.querySelector('#drvToque')?.addEventListener('click', async () => { const r = await bkpNaPasta(true); toast(r.ok ? '📁 Pasta liberada · backup de hoje salvo' : 'O Chrome não liberou'); re(); });
    d.querySelector('#drvJa').onclick = async () => { const r = await bkpAgora(true); toast(r.ok ? (r.caminho ? '💾 Salvo em ' + r.caminho : '💾 Backup baixado') : 'Não salvou'); re(); };
    d.querySelector('#drvFila')?.addEventListener('click', async () => { const n = await Arquivos.sobeFila(true); toast(`📁 ${n} ${n === 1 ? 'arquivo mandado' : 'arquivos mandados'} para o Drive`); re(); });
  },
};
document.addEventListener('click', (e) => { const b = e.target.closest && e.target.closest('[data-at]'); if (!b || !ATALHO[b.dataset.at]) return; e.preventDefault(); ATALHO[b.dataset.at](); });
/* a bolinha do botao do Drive: verde ligado, amarela pede toque */
setTimeout(() => { if (typeof bkpPasta === 'function' && window.indexedDB) drvLiberada(false).catch(() => {}); }, 800);

/* =====================================================
   VISUAL DO PAINEL (Ajustes) — pedido de 29/09: "ta meio denso e escuro
   demais". Claro por padrao, 5 cores e "letra maior e mais espaco". So o
   painel, so neste aparelho: o site dos clientes segue a marca.
===================================================== */
const VIS_KEY = 'yalla_visual';
const VIS_CORES = [['ouro', 'Dourado'], ['mar', 'Mar'], ['oliva', 'Oliva'], ['terracota', 'Terracota'], ['lavanda', 'Lavanda']];
function visualPref() {
  const pad = { tema: 'claro', cor: 'ouro', conforto: true };
  try { return Object.assign(pad, JSON.parse(localStorage.getItem(VIS_KEY) || '{}')); } catch (e) { return pad; }
}
function visualSalva(mudou) { const v = Object.assign(visualPref(), mudou); try { localStorage.setItem(VIS_KEY, JSON.stringify(v)); } catch (e) {} visualAplica(true); return v; }
function visualAplica(noPainel) {
  const r = document.documentElement, v = visualPref();
  const doSite = () => { const t = typeof temaAtual === 'function' ? temaAtual() : 'auto'; if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t); };
  if (noPainel) {
    r.setAttribute('data-painel', '1');
    if (v.tema === 'auto') doSite(); else r.setAttribute('data-theme', v.tema === 'escuro' ? 'dark' : 'light');
    r.setAttribute('data-skin', v.cor); r.setAttribute('data-conforto', v.conforto ? '1' : '0');
  } else if (r.hasAttribute('data-painel')) {
    ['data-painel', 'data-skin', 'data-conforto'].forEach(a => r.removeAttribute(a)); doSite();
  }
}
function visualHtml() {
  const v = visualPref();
  return `<section class="card vis-cartao" id="visCartao">
    <h3>🎨 Visual do painel</h3>
    <p class="why">Muda só o painel, neste aparelho. O site que os clientes veem continua com as cores da marca.</p>
    <span class="op-lbl">Claro ou escuro</span>
    <div class="vis-temas">${[['claro', '☀️', 'Claro'], ['escuro', '🌙', 'Escuro'], ['auto', '💻', 'Igual ao computador']].map(([k, i, n]) => `<button class="vis-tema vis-t-${k} ${v.tema === k ? 'on' : ''}" data-vistema="${k}" aria-pressed="${v.tema === k}"><span class="vis-prev" aria-hidden="true"><i></i><i></i><i></i></span><b>${i} ${n}</b></button>`).join('')}</div>
    <span class="op-lbl">Cor</span>
    <div class="vis-cores">${VIS_CORES.map(([k, n]) => `<button class="vis-cor ${v.cor === k ? 'on' : ''}" data-viscor="${k}" aria-pressed="${v.cor === k}"><i class="vis-bola vis-c-${k}" aria-hidden="true"></i>${n}</button>`).join('')}</div>
    <label class="vis-conf"><input type="checkbox" id="visConf" ${v.conforto ? 'checked' : ''}> <span><b>Letra maior e mais espaço</b><small>mais fácil de ler, menos apertado</small></span></label>
  </section>`;
}
function visualLiga() {
  const c = document.getElementById('visCartao'); if (!c) return;
  const re = () => { c.outerHTML = visualHtml(); visualLiga(); };
  c.querySelectorAll('[data-vistema]').forEach(b => b.onclick = () => { visualSalva({ tema: b.dataset.vistema }); re(); });
  c.querySelectorAll('[data-viscor]').forEach(b => b.onclick = () => { visualSalva({ cor: b.dataset.viscor }); re(); });
  c.querySelector('#visConf').onchange = (e) => { visualSalva({ conforto: e.target.checked }); re(); };
}

/* =====================================================
   ABA TRANSFER — os transfers de Roma pedidos na New Star (NCCGest)
===================================================== */
function admTransfer() {
  const S = admTransfer._s = admTransfer._s || { ver: 'falta' };
  const hoje = isoToday(), cfg = nccConfig();
  const todos = transfersDe(hoje, '', 'roma'), falta = todos.filter(b => !b.ncc), feitos = todos.filter(b => b.ncc), fora = transfersDe(hoje, '', 'fora');
  const lista = S.ver === 'falta' ? falta : S.ver === 'feitos' ? feitos : todos;
  const card = (b) => `<article class="tr-card ${b.ncc ? 'ok' : ''}">
      <div class="tr-top"><b class="mono">${crmData(b.date)} · ${esc(b.time || '?')}</b><b>${esc(b.name)}</b><span class="why">${b.pax || 1} pax</span>
        ${b.ncc ? `<span class="pill ok">✓ pedido na ${esc(cfg.nome)}${b.ncc.codigo ? ' · nº ' + esc(b.ncc.codigo) : ''}</span>` : '<span class="pill warn">falta pedir</span>'}</div>
      <div class="tr-rota">${esc(nomeDoServico(b))}${b.voo ? ` · ✈ ${esc(b.voo)}` : ''}${b.origem || b.destino ? `<br>📍 ${esc(b.origem || '?')} → ${esc(b.destino || '?')}` : ''}${b.obsOp ? `<br><small>${esc(b.obsOp)}</small>` : ''}</div>
      <div class="tacts">
        <button class="mini strong" data-trcopia="${esc(b.id)}">📋 Copiar os dados</button>
        <a class="mini" href="${esc(cfg.url)}" target="_blank" rel="noopener">Abrir a ${esc(cfg.nome)} ↗</a>
        ${b.ncc ? `<button class="mini ghost" data-trdesfaz="${esc(b.id)}">desmarcar</button>` : `<span class="tr-ok"><input data-trnum="${esc(b.id)}" placeholder="nº da reserva deles" aria-label="número da reserva na ${esc(cfg.nome)}"><button class="mini" data-trok="${esc(b.id)}">✓ Pedido feito</button></span>`}
        ${b.clienteId ? `<a class="mini ghost" href="#/adm/clients/${encodeURIComponent('c:' + b.clienteId)}">ficha</a>` : ''}
      </div></article>`;
  admShell('transfer', `
    <div class="pagehead"><h1 class="pageh">🚐 Transfer</h1>
      <div class="chips"><a class="cta sm" href="${esc(cfg.url)}" target="_blank" rel="noopener">Abrir a ${esc(cfg.nome)} ↗</a></div></div>
    <section class="card tr-como"><h3>Como pedir o transfer ao ${esc(cfg.nome)} <small class="why">— só transfers de ${esc(baseNome())}</small></h3>
      <ol class="bkp-passos"><li>Toque em <b>📋 Copiar os dados</b> — sai pronto, ${(((typeof CONTEUDO !== 'undefined' && CONTEUDO.transfer) || {}).idioma === 'en') ? 'em inglês' : 'na língua deles'}, do jeito que eles leem.</li>
        <li>Toque em <b>Abrir a ${esc(cfg.nome)}</b>, entre com o seu login de cliente e cole no pedido.</li>
        <li>Volte aqui, escreva o <b>nº da reserva deles</b> e toque em <b>✓ Pedido feito</b>.</li></ol>
      <p class="why">Com o contato técnico da ${esc(cfg.nome)}, o app passa a mandar o pedido sozinho.</p></section>
    <div class="crm-etapas" role="tablist">${[['falta', 'Falta pedir', falta.length], ['feitos', 'Já pedidos', feitos.length], ['todos', 'Todos', todos.length]].map(([k, n, c]) =>
      `<button class="crm-etapa ${S.ver === k ? 'on' : ''}" data-trver="${k}" role="tab" aria-selected="${S.ver === k}">${n} <b>${c}</b></button>`).join('')}</div>
    ${lista.length ? lista.map(card).join('') : `<p class="empty">${S.ver === 'falta' ? 'Nenhum transfer de ' + baseNome() + ' esperando pedido. 🎉' : 'Nenhum transfer aqui.'}</p>`}
    ${fora.length ? `<details class="card tr-fora"><summary><b>🗺️ Fora de ${esc(baseNome())} · ${fora.length}</b> <small class="why">não é com o ${esc(cfg.nome)} — outro fornecedor</small></summary>
      ${fora.map(b => `<div class="deprow"><span><b class="mono">${crmData(b.date)} · ${esc(b.time || '?')}</b> ${esc(b.name)} · ${b.pax || 1} pax<br><small class="why">${esc(nomeDoServico(b))}${b.origem || b.destino ? ' · ' + esc(b.origem || '?') + ' → ' + esc(b.destino || '?') : ''}</small></span>
        <button class="mini" data-trcopia="${esc(b.id)}">📋 Copiar os dados</button></div>`).join('')}</details>` : ''}
    <details class="card"><summary><b>Trocar a plataforma</b> <small class="why">nome e link da área de cliente</small></summary>
      <div class="frow"><label class="fld">Nome<input id="trNome" value="${esc(cfg.nome)}"></label><label class="fld">Link da área de cliente<input id="trUrl" value="${esc(cfg.url)}" inputmode="url"></label></div>
      <button class="mini strong" id="trSalva">Salvar</button></details>`);
  const re = () => admTransfer();
  $$('[data-trver]').forEach(b => b.onclick = () => { S.ver = b.dataset.trver; re(); });
  $$('[data-trcopia]').forEach(b => b.onclick = async () => {
    const t = nccTexto(Bookings.get(b.dataset.trcopia));
    try { await navigator.clipboard.writeText(t); toast('📋 Copiado — agora cole na ' + cfg.nome); }
    catch (e) { opJanela('📋 Dados do transfer', `<p class="why">Selecione e copie:</p><textarea rows="9" readonly style="width:100%">${esc(t)}</textarea>`); }
  });
  $$('[data-trok]').forEach(b => b.onclick = () => { const inp = document.querySelector(`[data-trnum="${b.dataset.trok}"]`); nccMarca(b.dataset.trok, inp ? inp.value : ''); toast('✓ Marcado como pedido na ' + cfg.nome); re(); });
  $$('[data-trdesfaz]').forEach(b => b.onclick = () => { nccMarca(b.dataset.trdesfaz, null); re(); });
  $('#trSalva').onclick = () => {
    const url = $('#trUrl').value.trim(); if (url && !/^https?:\/\//i.test(url)) return toast('O link precisa começar com http');
    DB.settings.ncc = { nome: $('#trNome').value.trim() || NCC_PADRAO.nome, url: url || NCC_PADRAO.url }; save(); toast('Salvo'); re();
  };
}

/* =====================================================
   AVALIACOES DO SITE (Ajustes) — ela cola as de verdade
===================================================== */
function avAjustesHtml() {
  const l = Avaliacoes.all(), st = DB.settings;
  return `<section class="card" id="avCartao">
    <h3>⭐ Avaliações do site</h3>
    <p class="why">Aparecem no menu da frente do app, em <b>⭐ Avaliações</b>. Só avaliações de verdade: copie do Google ou do WhatsApp (com a permissão do cliente).</p>
    <div class="frow"><label class="fld">Link para deixar avaliação (Google)<input id="avLink" inputmode="url" placeholder="https://g.page/r/…/review" value="${esc(st.linkAvaliacao || '')}"></label>
      <label class="fld">Link para ver todas (opcional)<input id="avVer" inputmode="url" placeholder="https://…" value="${esc(st.linkAvaliacoesVer || '')}"></label></div>
    <p class="why">O primeiro link também vai na mensagem "⭐ pedir avaliação" do CRM.</p>
    <button class="mini strong" id="avLinks">Salvar os links</button>
    <div class="rulesep"></div>
    ${l.map(a => `<div class="deprow"><span><b>${esc(a.nome)}</b> <span class="av-est-p">${'★'.repeat(a.nota)}</span><br><small class="why">${esc(a.texto.slice(0, 90))}${a.texto.length > 90 ? '…' : ''}</small></span><button class="mini ghost danger" data-avrm="${esc(a.id)}" aria-label="apagar a avaliação de ${esc(a.nome)}">✕</button></div>`).join('') || '<p class="why">Nenhuma avaliação ainda.</p>'}
    <details><summary><b>+ Colar uma avaliação</b></summary>
      <div class="frow"><label class="fld">Nome<input id="avNome"></label><label class="fld">Cidade / país<input id="avCid" placeholder="São Paulo"></label></div>
      <div class="frow"><label class="fld">Estrelas<select id="avNota">${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${'★'.repeat(n)} (${n})</option>`).join('')}</select></label>
        <label class="fld">Passeio<input id="avPas" list="avPasL" placeholder="Safári no deserto"></label></div>
      <datalist id="avPasL">${Tours.all().filter(x => x.status !== 'draft').map(x => `<option value="${esc(x.name.pt)}">`).join('')}</datalist>
      <div class="frow"><label class="fld">Data<input id="avData" placeholder="dd/mm/aaaa"></label><label class="fld">De onde<input id="avFonte" placeholder="Google, WhatsApp…"></label></div>
      <label class="fld">O que o cliente escreveu<textarea id="avTxt" rows="4"></textarea></label>
      <button class="cta sm" id="avAdd">Pôr no site</button></details>
  </section>`;
}
function avAjustesLiga() {
  const c = document.getElementById('avCartao'); if (!c) return;
  const re = () => { c.outerHTML = avAjustesHtml(); avAjustesLiga(); };
  c.querySelector('#avLinks').onclick = () => {
    const a = c.querySelector('#avLink').value.trim(), v = c.querySelector('#avVer').value.trim();
    if ((a && !/^https?:\/\//i.test(a)) || (v && !/^https?:\/\//i.test(v))) return toast('O link precisa começar com http');
    DB.settings.linkAvaliacao = a; DB.settings.linkAvaliacoesVer = v; save(); toast('Links salvos'); re();
  };
  c.querySelector('#avAdd').onclick = () => {
    const r = Avaliacoes.salva({ nome: c.querySelector('#avNome').value, cidade: c.querySelector('#avCid').value, nota: c.querySelector('#avNota').value,
      passeio: c.querySelector('#avPas').value, data: c.querySelector('#avData').value, fonte: c.querySelector('#avFonte').value, texto: c.querySelector('#avTxt').value });
    if (r.erro) return toast(r.erro);
    toast('⭐ Avaliação no site'); re();
  };
  c.querySelectorAll('[data-avrm]').forEach(b => b.onclick = () => { if (confirm('Tirar esta avaliação do site?')) { Avaliacoes.remove(b.dataset.avrm); re(); } });
}

/* =====================================================
   PARCEIROS — o "one stop shop" dela (pedido de 01/10/2026)
   Transfer, ingressos, hotel e o que mais o cliente precisar: quem são os
   parceiros, e o que foi pedido a cada um em cada reserva.
===================================================== */
function admParceiros() {
  const S = admParceiros._s = admParceiros._s || { tipo: '', ed: '', ver: 'abertos' };
  const hoje = isoToday();
  const todos = PedidosFor.todos({ deData: addDays(hoje, -30) });
  const abertos = todos.filter(x => x.p.status !== 'confirmado' && x.b.date >= addDays(hoje, -1));
  const lista = S.ver === 'abertos' ? abertos : todos;
  const ed = S.ed ? Fornecedores.get(S.ed) : null;
  const prox = DB.bookings.filter(b => b.status !== 'cancelled' && b.date >= hoje).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const optTipo = (sel) => FORN_TIPOS.map(([k, ic, n]) => `<option value="${k}" ${sel === k ? 'selected' : ''}>${ic} ${n}</option>`).join('');
  const optForn = (sel, tipo) => '<option value="">— escolha —</option>' + Fornecedores.all().filter(f => !tipo || f.tipo === tipo || f.id === sel)
    .map(f => `<option value="${esc(f.id)}" ${sel === f.id ? 'selected' : ''}>${fornTipo(f.tipo)[1]} ${esc(f.nome)}</option>`).join('');
  const linha = ({ b, p, f }) => `<div class="pf-row pf-${p.status}">
      <div class="pf-top"><b>${fornTipo(p.tipo)[1]} ${esc(p.desc || fornTipo(p.tipo)[2])}</b>
        <span class="pill ${p.status === 'confirmado' ? 'ok' : p.status === 'pedido' ? '' : 'warn'}">${PED_FOR_ST.find(x => x[0] === p.status)[1]}</span></div>
      <div class="why"><a href="${opFicha(b)}">${esc(b.name)}</a> · ${esc(opNomeServ(b))} · ${opCurta(b.date)}${b.time ? ' ' + esc(b.time) : ''}${f ? ' · com <b>' + esc(f.nome) + '</b>' : ' · <b>sem parceiro</b>'}${p.custo ? ' · custo ' + eur(p.custo) : ''}${p.ref ? ' · nº ' + esc(p.ref) : ''}</div>
      <div class="tacts">
        ${f && f.whats ? `<a class="mini cta-ish" target="_blank" rel="noopener" href="${waLink(msgFornecedor(b, p), opNum(f.whats))}">💬 pedir no WhatsApp</a>` : ''}
        ${f && f.email && !f.whats ? `<a class="mini" href="mailto:${esc(f.email)}?subject=${encodeURIComponent(guiaNegocio() + ' — ' + (p.desc || ''))}&body=${encodeURIComponent(msgFornecedor(b, p))}">✉ pedir por e-mail</a>` : ''}
        <select class="mini" data-pfst="${esc(b.id)}|${esc(p.id)}">${PED_FOR_ST.map(([k, n]) => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <input class="mini pf-ref" data-pfref="${esc(b.id)}|${esc(p.id)}" value="${esc(p.ref || '')}" placeholder="nº da reserva deles">
        <button class="mini danger" data-pfrm="${esc(b.id)}|${esc(p.id)}" aria-label="tirar">✕</button>
      </div></div>`;
  admShell('parceiros', `
    <div class="pagehead"><h1 class="pageh">Parceiros</h1><span class="why">o seu one stop shop: transfer, ingressos, hotel — com quem você confia</span></div>

    <section class="card">
      <div class="pagehead"><h3 style="margin:0;flex:1">Pedidos aos parceiros</h3>
        <div class="chips"><button class="chip ${S.ver === 'abertos' ? 'on' : ''}" data-pfver="abertos">em aberto · ${abertos.length}</button><button class="chip ${S.ver === 'todos' ? 'on' : ''}" data-pfver="todos">todos</button></div></div>
      ${lista.length ? lista.map(linha).join('') : `<p class="empty">${S.ver === 'abertos' ? 'Nada esperando parceiro. 🎉' : 'Nenhum pedido ainda.'}</p>`}
    </section>

    <section class="card">
      <h3>+ Novo pedido a um parceiro</h3>
      <div class="frow">
        <label class="fld grow">Reserva<select id="pfRes"><option value="">— escolha a reserva —</option>${prox.map(b => `<option value="${esc(b.id)}">${opCurta(b.date)} · ${esc(b.name)} · ${esc(opNomeServ(b))}</option>`).join('')}</select></label>
        <label class="fld">O quê<select id="pfTipo">${optTipo('ingressos')}</select></label>
      </div>
      <div class="frow">
        <label class="fld grow">Parceiro<select id="pfForn">${optForn('', '')}</select></label>
        <label class="fld">Custo (${moedaSigla()})<input id="pfCusto" type="number" min="0" placeholder="0"></label>
      </div>
      <label class="fld">Descrição<input id="pfDesc" placeholder="ex.: 3 ingressos para o museu · 2 noites, quarto família · transfer DXB → hotel"></label>
      <button class="cta sm" id="pfCria">Criar pedido</button>
    </section>

    <section class="card">
      <h3>${ed ? 'Editar parceiro' : '+ Cadastrar parceiro'}</h3>
      <div class="frow">
        <label class="fld grow">Nome<input id="fnNome" value="${esc(ed ? ed.nome : '')}" placeholder="ex.: Omar Transfers"></label>
        <label class="fld">Tipo<select id="fnTipo">${optTipo(ed ? ed.tipo : 'transfer')}</select></label>
      </div>
      <div class="frow">
        <label class="fld">WhatsApp<input id="fnWa" value="${esc(ed ? ed.whats : '')}" placeholder="+971 …"></label>
        <label class="fld">E-mail<input id="fnEm" value="${esc(ed ? ed.email : '')}"></label>
        <label class="fld sm">Comissão que você recebe (%)<input id="fnCom" type="number" min="0" max="100" value="${ed ? ed.comissao : ''}" placeholder="0"></label>
      </div>
      <label class="fld">Site / link<input id="fnSite" value="${esc(ed ? ed.site : '')}" placeholder="https://…"></label>
      <label class="fld">Observação<input id="fnObs" value="${esc(ed ? ed.obs : '')}" placeholder="ex.: pedir até 18h do dia anterior"></label>
      <div class="btnrow"><button class="cta sm" id="fnSalva">${ed ? 'Salvar' : 'Cadastrar'}</button>${ed ? '<button class="mini" id="fnCancela">cancelar</button>' : ''}</div>
    </section>

    ${FORN_TIPOS.map(([k, ic, n]) => { const fs = Fornecedores.all(k); if (!fs.length) return ''; return `<section class="card">
      <h3>${ic} ${n} <small class="why">${fs.length}</small></h3>
      ${fs.map(f => { const pend = todos.filter(x => x.f && x.f.id === f.id && x.p.status !== 'confirmado').length; return `<div class="gl-row">
        <div class="gl-nome"><b>${esc(f.nome)}</b><small>${[f.whats, f.email, f.comissao ? 'comissão ' + f.comissao + '%' : '', f.obs].filter(Boolean).map(esc).join(' · ')}${pend ? ` · <b>${pend} pedido(s) em aberto</b>` : ''}</small></div>
        <div class="tacts">${f.whats ? `<a class="mini" target="_blank" rel="noopener" href="${waLink('Olá, ' + f.nome + '!', opNum(f.whats))}">💬</a>` : ''}${linkExterno(f.site) ? `<a class="mini" target="_blank" rel="noopener" href="${esc(f.site)}">↗</a>` : ''}
          <button class="mini" data-fned="${esc(f.id)}">editar</button><button class="mini danger" data-fnrm="${esc(f.id)}">remover</button></div></div>`; }).join('')}
    </section>`; }).join('') || '<section class="card"><p class="why">Nenhum parceiro cadastrado ainda. Comece pelo transfer e pelos ingressos.</p></section>'}`);
  const re = () => admParceiros();
  $$('[data-pfver]').forEach(b => b.onclick = () => { S.ver = b.dataset.pfver; re(); });
  $$('[data-pfst]').forEach(sel => sel.onchange = () => { const [bid, id] = sel.dataset.pfst.split('|'); PedidosFor.muda(bid, id, { status: sel.value }); toast('Atualizado'); re(); });
  $$('[data-pfref]').forEach(inp => inp.onchange = () => { const [bid, id] = inp.dataset.pfref.split('|'); PedidosFor.muda(bid, id, { ref: inp.value }); toast('Número salvo'); });
  $$('[data-pfrm]').forEach(b => b.onclick = () => { const [bid, id] = b.dataset.pfrm.split('|'); if (confirm('Tirar este pedido?')) { PedidosFor.remove(bid, id); re(); } });
  $('#pfTipo').onchange = () => { $('#pfForn').innerHTML = optForn('', $('#pfTipo').value); };
  $('#pfForn').innerHTML = optForn('', $('#pfTipo').value);
  $('#pfCria').onclick = () => {
    const bid = $('#pfRes').value; if (!bid) return toast('Escolha a reserva');
    const r = PedidosFor.cria(bid, { tipo: $('#pfTipo').value, fornecedorId: $('#pfForn').value, desc: $('#pfDesc').value, custo: $('#pfCusto').value });
    if (r.erro) return toast(r.erro); toast('Pedido criado'); re();
  };
  $('#fnSalva').onclick = () => {
    const r = Fornecedores.salva({ id: S.ed || '', nome: $('#fnNome').value, tipo: $('#fnTipo').value, whats: $('#fnWa').value, email: $('#fnEm').value,
      comissao: $('#fnCom').value, site: $('#fnSite').value, obs: $('#fnObs').value });
    if (r.erro) return toast(r.erro); S.ed = ''; toast('Parceiro salvo'); re();
  };
  if ($('#fnCancela')) $('#fnCancela').onclick = () => { S.ed = ''; re(); };
  $$('[data-fned]').forEach(b => b.onclick = () => { S.ed = b.dataset.fned; re(); setTimeout(() => $('#fnNome').scrollIntoView({ block: 'center' }), 30); });
  $$('[data-fnrm]').forEach(b => b.onclick = () => { const f = Fornecedores.get(b.dataset.fnrm); if (f && confirm(`Remover ${f.nome}? Os pedidos já feitos continuam nas reservas.`)) { Fornecedores.remove(f.id); re(); } });
}

/* =====================================================
   PIPELINE — o funil (kanban) dos pedidos, como no TI ARTES.
   Colunas = as etapas do CRM; cada cartão é um pedido. Toca para abrir.
===================================================== */
/* O Pipeline com as etapas dela: cada pedido (orçamento, reserva ou pedido do
   "Monte a sua experiência") cai na etapa pelo que já aconteceu, e o cartão diz
   o próximo passo. Um pedido com vários serviços fica na etapa do mais atrasado. */
function admPipelinePasso() {
  const hoje = isoToday();
  const ordem = PIPE_ETAPAS.map(e => e[0]);
  const linhas = crmLinhas(hoje).filter(r => r.tipo !== 'reserva' || r.b.date >= addDays(hoje, -30) || r.etapa === 'avaliar');
  for (const p of (DB.pedidos || [])) if (!p.respondido && !p.orcamentoId)
    linhas.push({ tipo: 'pedido', id: p.id, pedido: 'ped:' + p.id, nome: p.nome, dataServ: p.ini || '', servico: 'Monte a sua experiência', totalPedido: 0, veio: 'App' });
  /* um cartão por CLIENTE e por VIAGEM: os serviços da mesma pessoa com
     menos de 10 dias entre um e outro são a mesma viagem */
  const viagemDe = new Map();
  const porCli = {};
  for (const r of linhas) if (r.tipo === 'reserva') { const k = r.b.clienteId || chaveCliente(r.b); (porCli[k] = porCli[k] || []).push(r); }
  for (const [k, rs] of Object.entries(porCli)) {
    rs.sort((a, b) => a.b.date.localeCompare(b.b.date));
    let n = 0, ult = '';
    for (const r of rs) { if (ult && r.b.date > addDays(ult, 10)) n++; ult = r.b.date; viagemDe.set(r, 'cli:' + k + ':' + n); }
  }
  const ped = new Map();
  for (const r of linhas) {
    const e = etapaPasso(r, hoje);
    r.pedido = viagemDe.get(r) || r.pedido;
    let p = ped.get(r.pedido); if (!p) { p = { pedido: r.pedido, r, linhas: [], etapas: [] }; ped.set(r.pedido, p); }
    p.linhas.push(r); p.etapas.push(e);
  }
  for (const p of ped.values()) {
    const vivas = p.etapas.filter(e => e !== 'perdido');
    p.etapa = !vivas.length ? 'perdido' : vivas.includes('viagem') ? 'viagem' : vivas.sort((a, b) => ordem.indexOf(a) - ordem.indexOf(b))[0];
    p.r = p.linhas[p.etapas.indexOf(p.etapa)] || p.r;
  }
  const todos = [...ped.values()];
  const soma = (ps) => ps.reduce((s, p) => s + (p.r.totalPedido || p.linhas.reduce((s2, x) => s2 + (x.clientePaga || 0), 0)), 0);
  const card = (p) => {
    const r = p.r, tot = r.totalPedido || p.linhas.reduce((s2, x) => s2 + (x.clientePaga || 0), 0);
    const alvo = r.tipo === 'orcamento' ? '#/adm/consulta/' + r.o.id : r.tipo === 'pedido' ? '#/adm/consulta' : '#/adm/clients/' + encodeURIComponent('c:' + (r.b.clienteId || ''));
    const serv = p.linhas.length === 1 ? esc(p.linhas[0].servico) : p.linhas.length + ' serviços';
    const passo = proximoPassoPipe(r, p.etapa, hoje);
    return `<a class="pl-card pl-e-${p.etapa}" href="${alvo}">
      <b class="pl-nome">${esc(r.nome || 'Sem nome')}</b>
      <span class="pl-serv">${serv}${r.dataServ ? ` · ${crmData(r.dataServ)}` : ''}</span>
      ${passo ? `<span class="pl-passo">→ ${esc(passo)}</span>` : ''}
      <span class="pl-pe"><b class="mono">${tot ? eur(tot) : '—'}</b>${r.veio ? `<small>${esc(r.veio)}</small>` : ''}</span>
    </a>`;
  };
  admShell('pipeline', `
    <div class="pagehead"><h1 class="pageh">Pipeline</h1>
      <div class="chips"><a class="mini" href="#/adm/consulta">ver em lista</a><button class="mini strong" id="plNovo">+ novo orçamento</button></div></div>
    <p class="why">O passo a passo de cada cliente. Ninguém precisa arrastar: o cartão anda sozinho quando o sinal entra, os ingressos e o transfer são comprados, o guia é escalado e chega o dia.</p>
    <div class="pl-board">
      ${PIPE_ETAPAS.map(([e, nome, sub]) => { const ps = todos.filter(p => p.etapa === e); if (e === 'perdido' && !ps.length) return ''; return `<section class="pl-col pl-col-${e}">
        <header class="pl-cab"><b>${esc(nome)}</b><span class="pl-n">${ps.length}</span></header>
        ${sub ? `<div class="pl-sub">${esc(sub)}</div>` : ''}
        ${soma(ps) ? `<div class="pl-soma">${eur(soma(ps))}</div>` : ''}
        <div class="pl-cards">${ps.map(card).join('') || '<p class="pl-vazio">vazio</p>'}</div>
      </section>`; }).join('')}
    </div>`);
  $('#plNovo') && ($('#plNovo').onclick = () => { const o = Orc.cria({ origem: 'manual', status: 'rascunho' }); go('/adm/consulta/' + o.id); });
}
function admPipeline() {
  if (PIPE_ETAPAS) return admPipelinePasso();
  const hoje = isoToday();
  const COLS = [['aberto', 'Em aberto'], ['confirmado', 'Confirmado'], ['avaliar', '⭐ Avaliar'], ['finalizado', '💚 Finalizado'], ['perdido', 'Perdido']];
  const ped = new Map();
  for (const r of crmLinhas(hoje)) { let p = ped.get(r.pedido); if (!p) { p = { pedido: r.pedido, r, linhas: [] }; ped.set(r.pedido, p); } p.linhas.push(r); }
  const todos = [...ped.values()];
  const col = (e) => todos.filter(p => p.r.etapa === e);
  const soma = (ps) => ps.reduce((s, p) => s + (p.r.totalPedido || p.linhas.reduce((s2, x) => s2 + (x.clientePaga || 0), 0)), 0);
  const card = (p) => {
    const r = p.r, tot = r.totalPedido || p.linhas.reduce((s2, x) => s2 + (x.clientePaga || 0), 0);
    const alvo = r.tipo === 'orcamento' ? '#/adm/consulta/' + r.o.id : '#/adm/clients/' + encodeURIComponent('c:' + (r.b.clienteId || ''));
    const serv = p.linhas.length === 1 ? esc(p.linhas[0].servico) : p.linhas.length + ' serviços';
    const rp = (r.repescagens || []).length;
    return `<a class="pl-card pl-e-${r.etapa}" href="${alvo}">
      <b class="pl-nome">${esc(r.nome || 'Sem nome')}</b>
      <span class="pl-serv">${serv}${r.dataServ ? ` · ${crmData(r.dataServ)}` : ''}</span>
      <span class="pl-pe"><b class="mono">${tot ? eur(tot) : '—'}</b>${r.veio ? `<small>${esc(r.veio)}</small>` : ''}${rp ? `<small class="pl-rp">🔁 ${rp}</small>` : ''}</span>
    </a>`;
  };
  admShell('pipeline', `
    <div class="pagehead"><h1 class="pageh">Pipeline</h1>
      <div class="chips"><a class="mini" href="#/adm/consulta">ver em lista</a><button class="mini strong" id="plNovo">+ novo orçamento</button></div></div>
    <p class="why">O caminho de cada pedido, da chegada ao finalizado. Toque num cartão para abrir e mover de etapa.</p>
    <div class="pl-board">
      ${COLS.map(([e, nome]) => { const ps = col(e); return `<section class="pl-col pl-col-${e}">
        <header class="pl-cab"><b>${nome}</b><span class="pl-n">${ps.length}</span></header>
        ${soma(ps) ? `<div class="pl-soma">${eur(soma(ps))}</div>` : ''}
        <div class="pl-cards">${ps.map(card).join('') || '<p class="pl-vazio">vazio</p>'}</div>
      </section>`; }).join('')}
    </div>`);
  $('#plNovo') && ($('#plNovo').onclick = () => { const o = Orc.cria({ origem: 'manual', status: 'rascunho' }); go('/adm/consulta/' + o.id); });
}
