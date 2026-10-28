/* =====================================================
   ORÇAMENTO NOVO + PROPOSTA DE EXPERIÊNCIAS (28/10/2026)

   Pedido do Eugênio, com a planilha e o PDF que a Milla usa hoje: "a montagem
   do orçamento tá confusa… precisa ser prático… os dados básicos, os passeios
   que já existem fáceis de clicar e acrescentar manualmente… o assistente
   precisa montar também e gerar o PDF" e "depois que a Milla gera o orçamento
   o cliente recebe um PDF ou link dos passeios com fotos e todas as infos".

   - O EDITOR (no lugar do admOrcEditor): cliente (nome, WhatsApp, adultos,
     crianças, hotel, chegada e partida com voo), o ROTEIRO dia a dia (cada
     serviço com dia, horário, título, o texto que o cliente lê, o incluso, a
     foto e o valor), o catálogo dela numa janela de um toque com busca, os
     traslados de chegada e de saída num toque, item livre, e os valores
     (total, por pessoa, já pago, pendente, moeda, validade). Salva sozinho.
     O que não é do dia a dia (custo, sinal, textos da proposta, links) fica
     em "Mais opções".
   - A PROPOSTA (o que o cliente recebe), no formato do PDF dela: capa com
     fotos, o roteiro dia a dia com foto e "incluso", o investimento (total e
     por pessoa), condições e cancelamento, o diferencial e a validade. Vai
     como LINK com o botão "Baixar PDF" dentro: o curto (#/p/<código>) mora na
     tabela kits da sala, a mesma do kit da viagem (o cliente lê UM pelo
     código, só a dona grava); sem a tabela ou sem login, o comprido (#/pp/…)
     leva tudo dentro. Mudou o orçamento depois de mandar → o mesmo link curto
     se atualiza sozinho.
   - A página é pública: nunca vai custo, sinal, valor de cada serviço,
     telefone ou e-mail DO CLIENTE.
   ===================================================== */
'use strict';

/* ---------- os textos dela (do PDF de proposta que ela já manda) ---------- */
const PP_POLITICA = 'Até 72 horas antes do cronograma: reembolso integral dos serviços, exceto valores de atividades terceirizadas (deserto, ingressos, iate, helicóptero e tour compartilhado). Até 48 horas: reembolso de 50%. Menos de 48 horas ou não comparecimento: sem reembolso. Taxas bancárias não são reembolsáveis. Política válida inclusive em caso de força maior, como fechamento de aeroportos, condições climáticas e restrições governamentais.';
const PP_CONDICOES = 'Parcelamento em até 12x no cartão.\nHora extra de tour: USD 69, quando aplicável.';
const PP_DIFERENCIAL = 'Experiência nos Emirados desde 2010. Empresa 100% licenciada nos Emirados. Guias brasileiros e parceiros devidamente licenciados. Roteiros planejados para conforto e otimização do tempo, com acompanhamento e suporte no seu idioma preferido.';
const ppTextoPadrao = (k) => {
  const s = DB.settings || {};
  return k === 'politica' ? (s.propPolitica || PP_POLITICA) : k === 'condicoes' ? (s.propCondicoes || PP_CONDICOES) : (s.propDiferencial || PP_DIFERENCIAL);
};
const PP_MOEDA_NOME = { USD: 'dólares americanos', AED: 'dirhams dos Emirados', EUR: 'euros', BRL: 'reais' };

/* ---------- 1. o modelo: o que cada serviço guarda a mais ---------- */
const _oyItemBase = Orc._item;
Orc._item = function (i) {
  i = i || {};
  return Object.assign(_oyItemBase(i), {
    horaFim: String(i.horaFim || '').trim(),
    texto: String(i.texto || '').trim(),           /* o que o cliente lê */
    incluso: String(i.incluso || '').trim(),
    rotulo: String(i.rotulo || '').trim(),         /* "manhã livre", "à noite" (opcional) */
    foto: String(i.foto || '').trim(),             /* arte/… do passeio */
    tipo: ['passeio', 'traslado', 'livre'].includes(i.tipo) ? i.tipo
      : (i.tourId ? 'passeio' : RE_TRANSFER.test(String(i.desc || '')) || /traslado/i.test(String(i.desc || '')) ? 'traslado' : 'livre'),
    auto: !!i.auto,                                /* o valor veio da tabela: muda junto com o nº de pessoas */
  });
};
/* O TOTAL (o que o resto do app já usa: CRM, painel, assistente):
   serviços − desconto = subtotal; + VAT de 5% no fim (28/10/2026, pedido
   dele: "no final do orçamento adicionar 5% de VAT"). O VAT é por orçamento
   (vatPct, em Mais opções), 5% se ela não mudar. */
const OY_VAT = 5;
const oyCent = (v) => Math.round((+v || 0) * 100) / 100;
const oyVatPct = (o) => o && o.vatPct != null && o.vatPct !== '' ? Math.max(0, +o.vatPct || 0) : OY_VAT;
const _oyTotalBase = Orc.total;
Orc.subtotal = function (o) { return Math.max(0, _oyTotalBase(o) - (+(o && o.desconto) || 0)); };
Orc.vat = function (o) { return oyCent(Orc.subtotal(o) * oyVatPct(o) / 100); };
Orc.total = function (o) { return oyCent(Orc.subtotal(o) + Orc.vat(o)); };
/* SÓ DÓLAR (28/10/2026, pedido dele: "deixar tudo em dólares, somente
   dólares"): o orçamento, a proposta e as reservas que saem dele são em USD */
const OY_MOEDA = 'USD';
/* fechou: as reservas somam o que o cliente paga (desconto e VAT repartidos
   na proporção de cada serviço) e saem em dólar */
const _oyFechaBase = Orc.fecha;
Orc.fecha = function (id, opts) {
  const o = Orc.get(id);
  const soma = o ? o.itens.reduce((t, i) => t + (+i.valor || 0), 0) : 0;
  const k = o && soma > 0 ? Orc.total(o) / soma : 1;
  /* os serviços que viram reserva, na mesma ordem e com a mesma regra do Orc.fecha */
  const usados = o ? o.itens.filter(i => { const av = !(i.tourId && Tours.get(i.tourId)); return !(av && (!i.data || !String(i.desc || '').trim() || i.sugestao)); }) : [];
  const bs = _oyFechaBase(id, opts);
  bs.forEach((b, n) => {
    /* o roteiro depois da compra (kit) mostra o que ela escreveu no orçamento */
    const i = usados[n]; if (!i) return;
    Object.assign(b, { orcTitulo: i.desc || '', orcTexto: i.texto || '', orcIncluso: i.incluso || '', orcFoto: i.foto || '' });
    if (i.horaFim) b.horaFim = i.horaFim;
  });
  for (const b of bs) {
    if (!b.moeda) b.moeda = OY_MOEDA;
    if (Math.abs(k - 1) > 1e-9 && +b.total > 0) b.total = oyCent(+b.total * k);
    _opSaveBooking(b);
  }
  return bs;
};

const oyPt = (a) => !a ? '' : typeof a === 'string' ? a : (a.pt || a.en || '');
const oyLista = (a) => (a && !Array.isArray(a) && (a.pt || a.en) ? (a.pt || a.en) : Array.isArray(a) ? a : []).map(s => oyPt(s).trim()).filter(Boolean);
const oyParagrafo = (t) => (String(t || '').split(/\n\s*\n/)[0] || '').trim();
const oyFoto = (p) => /^data:/i.test(String(p || '')) ? '' : String(p || '');
const oyFotosDe = (x) => [...new Set([x && x.photo, ...((x && x.fotos) || [])].map(oyFoto).filter(Boolean))];
const oyHm = (h) => { const m = String(h || '').match(/(\d{1,2})[:h](\d{2})?/); return m ? String(+m[1]).padStart(2, '0') + ':' + (m[2] || '00') : ''; };
function oySoma(hm, min) { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); const t = Math.min(23 * 60 + 59, h * 60 + m + min); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
/* "09h00 – 18h00" → ['09:00','18:00']; "4h" → começa às 09:00 e soma */
function oyHorasDe(x, hora) {
  const d = String((x && x.duration) || '');
  const par = d.match(/(\d{1,2}[:h]\d{2})\s*[–-]\s*(\d{1,2}[:h]\d{2})/);
  if (par) return [oyHm(par[1]), oyHm(par[2])];
  const h = d.match(/^(\d{1,2})(?:[,.](\d))?\s*h/i);
  return [hora, h && hora ? oySoma(hora, +h[1] * 60 + (h[2] ? +h[2] * 6 : 0)) : ''];
}
const oyMoeda = () => OY_MOEDA;
function oyM(v, m) {
  const n = Number(v) || 0;
  return m + ' ' + n.toLocaleString('pt-BR', n % 1 === 0 ? {} : { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
const oyPax = (o) => ((+o.adultos || 0) + (+o.criancas || 0)) || +o.pax || 0;
function oyPaxTexto(o) {
  const a = +o.adultos || 0, c = +o.criancas || 0;
  if (!a && !c) return o.paxNota || (o.pax ? o.pax + (o.pax > 1 ? ' pessoas' : ' pessoa') : '');
  return [a ? a + (a > 1 ? ' adultos' : ' adulto') : '', c ? c + (c > 1 ? ' crianças' : ' criança') : ''].filter(Boolean).join(' + ');
}
const oyPorPessoa = (o) => { const p = oyPax(o); return p ? oyCent(Orc.total(o) / p) : 0; };
const oyPendente = (o) => Math.max(0, Orc.total(o) - (+o.pago || 0));
const oyOrdena = (l) => [...l].sort((a, b) => ((a.data || '9999') + (a.hora || '99')).localeCompare((b.data || '9999') + (b.hora || '99')));
function oyDiasDaViagem(o) {
  const de = o.chegada && o.chegada.data, ate = o.partida && o.partida.data, l = [];
  if (de && ate && de <= ate) for (let d = de; d <= ate && l.length < 31; d = addDays(d, 1)) l.push(d);
  for (const i of o.itens) if (i.data && !l.includes(i.data)) l.push(i.data);
  return l.sort();
}
/* o próximo dia sem passeio (dentro da viagem), senão o dia depois do último serviço */
function oyProximoDia(o) {
  const dias = oyDiasDaViagem(o), ocupados = new Set(o.itens.filter(i => i.tipo === 'passeio' && i.data).map(i => i.data));
  const ch = o.chegada && o.chegada.data, pa = o.partida && o.partida.data;
  const livre = dias.find(d => !ocupados.has(d) && d !== ch && d !== pa) || dias.find(d => !ocupados.has(d));
  if (livre) return livre;
  const ult = oyOrdena(o.itens.filter(i => i.data)).pop();
  return ult ? addDays(ult.data, 1) : '';
}

/* um passeio do catálogo, já com o preço da tabela dela, o texto, o incluso e a foto */
function oyDoCatalogo(o, tourId, extra) {
  extra = extra || {};
  const x = Tours.get(tourId); if (!x) return null;
  const pax = +extra.pax || oyPax(o) || 2;
  const base = Orc.itemDoCatalogo(tourId, { pax, data: extra.data || '', hora: extra.hora || '' });
  /* hora só se for certa: a que ela disse, a do horário fixo do passeio ou a faixa da duração
     ("09h00 – 18h00"). Sem nada disso fica em branco — o 09:00 de reserva seria chute. */
  const regra = (DB.rules || []).find(r => r.tourId === tourId);
  const [h1, h2] = oyHorasDe(x, extra.hora || (regra && regra.time) || '');
  return Orc._item({ ...base, pax, tipo: x.type === 'transfer' ? 'traslado' : 'passeio', auto: !(+extra.valor > 0),
    valor: +extra.valor > 0 ? +extra.valor : base.valor, hora: h1 || '', horaFim: extra.horaFim || h2,
    texto: extra.texto || oyParagrafo(oyPt(x.desc)), incluso: extra.incluso || oyLista(x.includes).join(', '),
    foto: oyFotosDe(x)[0] || '' });
}
/* traslado de chegada ou de saída, com o texto do PDF dela */
function oyTraslado(o, qual) {
  const ch = qual === 'chegada', p = (ch ? o.chegada : o.partida) || {};
  const hotel = o.hotel || 'o hotel';
  const tr = Tours.all().find(x => x.type === 'transfer' && x.status !== 'draft');
  const base = tr ? Orc.itemDoCatalogo(tr.id, { pax: oyPax(o) || 2, data: p.data || '' }) : { valor: 0 };
  /* saída: o carro passa 4 h antes do voo (a regra da planilha dela: voo 09:05, pick up 05:00) */
  const hora = ch ? (p.hora || '') : (p.hora ? oySoma(p.hora, -240) : '');
  return Orc._item({ tipo: 'traslado', tourId: '', auto: false, pax: oyPax(o) || 2, data: p.data || '', hora, voo: p.voo || '',
    valor: +base.valor || 0, desc: ch ? 'Traslado Aeroporto → Hotel' : 'Traslado Hotel → Aeroporto',
    texto: ch ? `Chegada prevista${p.hora ? ' às ' + p.hora : ''}${p.voo ? ' (voo ' + p.voo + ')' : ''}. Recepção e traslado ao ${hotel}.`
      : `Saída do hotel${hora ? ' às ' + hora : ''} para o voo${p.hora ? ' das ' + p.hora : ''}${p.voo ? ' (' + p.voo + ')' : ''}.`,
    incluso: 'Transporte privativo e acompanhamento de guia brasileiro.' });
}
/* o nº de pessoas mudou: quem tinha o grupo todo acompanha, e o preço da tabela refaz */
function oyMudaPax(o, antes) {
  const agora = oyPax(o);
  for (const i of o.itens) {
    if (i.pax === antes || !i.pax) i.pax = agora || 1;
    if (i.auto && i.tourId && Tours.get(i.tourId)) { const n = Orc.itemDoCatalogo(i.tourId, { pax: i.pax, data: i.data, hora: i.hora, opcao: i.opcao }); if (n) i.valor = n.valor; }
  }
  o.pax = agora; o.paxNota = oyPaxTexto(o);
}

/* o roteiro depois da compra (kit-yalla.js): título, texto, foto e incluso do orçamento */
if (typeof kitServico === 'function') {
  const _oyKitServ = kitServico;
  kitServico = function (b, hotel) {
    const sv = _oyKitServ(b, hotel);
    if (b.orcTitulo) sv.nome = b.orcTitulo;
    if (b.orcTexto) sv.resumo = b.orcTexto;
    if (b.orcFoto) sv.foto = b.orcFoto;
    const inc = String(b.orcIncluso || '').split(/\n|,\s*(?=[A-ZÀ-Ú])/).map(t => t.trim()).filter(Boolean);
    if (inc.length) sv.inclui = inc;
    return sv;
  };
}

/* ---------- 2. a proposta: os dados que vão para o cliente ---------- */
function ppDados(o) {
  const g = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.guia) || {};
  const m = oyMoeda(o);
  const regs = Object.fromEntries(regioes().map(r => [r[0], r[1]]));
  return {
    tipo: 'proposta', v: 1, num: o.num, negocio: guiaNegocio(),
    contato: { whats: DB.settings.whats || '', email: g.email || DB.settings.email || '', insta: DB.settings.insta || '' },
    nome: o.cliente.nome || '', pessoas: oyPaxTexto(o), pax: oyPax(o), hotel: o.hotel || '',
    chegada: o.chegada || null, partida: o.partida || null, moeda: m,
    itens: oyOrdena(o.itens).filter(i => !i.sugestao).map(i => {
      const x = i.tourId && Tours.get(i.tourId);
      return { data: i.data || '', hora: i.hora || '', horaFim: i.horaFim || '', rotulo: i.rotulo || '', titulo: i.desc || '',
        texto: i.texto || '', incluso: i.incluso || '', foto: i.foto || '', tipo: i.tipo, voo: i.voo || '',
        cidade: x && regs[x.region] && !['deserto', 'oriente'].includes(x.region) ? regs[x.region] : '' };
    }),
    subtotal: Orc.subtotal(o), vatPct: oyVatPct(o), vat: Orc.vat(o),
    total: Orc.total(o), porPessoa: oyPorPessoa(o), pago: +o.pago || 0, pendente: oyPendente(o),
    validade: o.validade || '', obs: o.obs || '',
    politica: o.politica != null ? o.politica : ppTextoPadrao('politica'),
    condicoes: o.condicoes != null ? o.condicoes : ppTextoPadrao('condicoes'),
    diferencial: o.diferencial != null ? o.diferencial : ppTextoPadrao('diferencial'),
  };
}
const PP_MES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const ppSemana = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' });
const ppDiaMes = (iso) => +iso.slice(8, 10) + ' de ' + PP_MES[+iso.slice(5, 7) - 1];
function ppPeriodo(d) {
  const ds = [d.chegada && d.chegada.data, d.partida && d.partida.data, ...d.itens.map(i => i.data)].filter(Boolean).sort();
  if (!ds.length) return '';
  const a = ds[0], b = ds[ds.length - 1];
  if (a === b) return ppDiaMes(a) + ' de ' + a.slice(0, 4);
  if (a.slice(0, 7) === b.slice(0, 7)) return `${+a.slice(8, 10)} a ${+b.slice(8, 10)} de ${PP_MES[+a.slice(5, 7) - 1]} de ${a.slice(0, 4)}`;
  return `${ppDiaMes(a)} a ${ppDiaMes(b)} de ${b.slice(0, 4)}`;
}
const ppHoras = (i) => i.hora ? (i.horaFim ? `${i.hora}–${i.horaFim}` : i.hora) : '';
const ppEsc = (t) => esc(String(t || '')).replace(/\n/g, '<br>');
const ppFotoUrl = (f) => /^https?:|^\//.test(f) ? f : f;   /* arte/… é relativo ao site: funciona no app e no domínio dela */
function ppHtml(d) {
  const fotos = [...new Set(d.itens.map(i => i.foto).filter(Boolean))];
  const capa = [...fotos, 'arte/capa-arco.jpg', 'arte/skyline.jpg', 'arte/capa.jpg'].filter((f, k, l) => l.indexOf(f) === k).slice(0, 3);
  const cidades = [...new Set(d.itens.map(i => i.cidade).filter(Boolean))];
  const linha = [d.nome, d.pessoas].filter(Boolean).join(' | ');
  /* os serviços por dia; sem dia vai para o fim */
  const dias = []; for (const i of d.itens) { const k = i.data || ''; let g = dias.find(x => x.d === k); if (!g) dias.push(g = { d: k, l: [] }); g.l.push(i); }
  dias.sort((a, b) => (a.d || '9999').localeCompare(b.d || '9999'));
  const tag = (i) => [i.data ? ppSemana(i.data) : '', i.data ? i.data.slice(8, 10) + '/' + i.data.slice(5, 7) : '', ppHoras(i), i.rotulo, i.voo && i.tipo === 'traslado' ? 'voo ' + i.voo : ''].filter(Boolean).join(' | ');
  const cartao = (i) => `<section class="pp-card">
      ${tag(i) ? `<div class="pp-tag">${esc(tag(i))}</div>` : ''}
      <h3 class="pp-tit">${esc(i.titulo)}</h3>
      ${i.foto ? `<div class="pp-foto" role="img" aria-label="${esc(i.titulo)}" style="background-image:url('${esc(ppFotoUrl(i.foto))}')"></div>` : ''}
      ${i.texto ? `<p>${ppEsc(i.texto)}</p>` : ''}
      ${i.incluso ? `<p class="pp-inc"><b>INCLUSO:</b> ${ppEsc(i.incluso)}</p>` : ''}
    </section>`;
  const cabDia = (g) => {
    const cid = [...new Set(g.l.map(i => i.cidade).filter(Boolean))].join(' & ');
    return `<p class="pp-kick">Roteiro personalizado</p><h2 class="pp-h2">${g.d ? esc(ppDiaMes(g.d)) : 'Mais experiências'}${cid ? ` <span>| ${esc(cid)}</span>` : ''}</h2>`;
  };
  const contato = [d.contato.whats && foneBonito(d.contato.whats), d.contato.email, d.contato.insta && '@' + d.contato.insta].filter(Boolean);
  const mNome = PP_MOEDA_NOME[d.moeda] ? `${PP_MOEDA_NOME[d.moeda]} (${d.moeda})` : d.moeda;
  return `
  <section class="pp-capa">
    <div class="pp-fotos" aria-hidden="true">
      ${capa.map((f, k) => `<div class="pp-f pp-f${k + 1}" style="background-image:url('${esc(ppFotoUrl(f))}')"></div>`).join('')}
      <i class="pp-corte pp-c1"></i><i class="pp-corte pp-c2"></i>
    </div>
    <div class="pp-logo"><img src="arte/logo-yalla-escuro.png" alt="${esc(d.negocio)}"></div>
    <div class="pp-capatxt">
      <p class="pp-capak">${esc(d.negocio)}${cidades.length ? ' <i>|</i> ' + esc(cidades.join(' & ')) : ''}</p>
      <h1>Proposta de<br>experiências</h1>
      ${linha ? `<p>${esc(linha)}</p>` : ''}
      ${ppPeriodo(d) ? `<p>${esc(ppPeriodo(d))}</p>` : ''}
      ${d.hotel ? `<p>${esc(d.hotel)}</p>` : ''}
    </div>
  </section>
  ${dias.map(g => `<div class="pp-dia">
    <section class="pp-bloco">${cabDia(g)}${cartao(g.l[0])}</section>
    ${g.l.slice(1).map(cartao).join('')}
  </div>`).join('')}
  ${d.obs ? `<section class="pp-box"><h3>Observações</h3><p>${ppEsc(d.obs)}</p></section>` : ''}
  <section class="pp-inv">
    <div class="pp-invg">
      <div><small>Investimento total</small><b>${esc(oyM(d.total, d.moeda))}</b></div>
      ${d.pax > 1 ? `<div><small>Por pessoa</small><b>${esc(oyM(d.porPessoa, d.moeda))}</b></div>` : ''}
    </div>
    ${d.vatPct > 0 ? `<p class="pp-vat">Subtotal ${esc(oyM(d.subtotal, d.moeda))} + VAT ${esc(String(d.vatPct).replace('.', ','))}% ${esc(oyM(d.vat, d.moeda))}. O total já inclui o VAT.</p>` : ''}
    ${d.pago > 0 ? `<div class="pp-pago"><span>Pago <b>${esc(oyM(d.pago, d.moeda))}</b></span><span>Pendente <b>${esc(oyM(d.pendente, d.moeda))}</b></span></div>` : ''}
    ${d.pax > 1 ? `<div class="pp-ind">Pagamento individual | ${esc(oyM(d.porPessoa, d.moeda))}</div>` : ''}
  </section>
  ${d.politica || d.condicoes ? `<section class="pp-box"><h3>Condições e política de cancelamento</h3>
    ${d.politica ? `<p>${ppEsc(d.politica)}</p>` : ''}
    ${String(d.condicoes || '').split('\n').map(s => s.trim()).filter(Boolean).map(s => `<p class="pp-forte">${esc(s)}</p>`).join('')}</section>` : ''}
  <section class="pp-box">
    ${d.diferencial ? `<h3 class="pp-ouro">O diferencial ${esc(d.negocio)}</h3><p>${ppEsc(d.diferencial)}</p>` : ''}
    <p class="pp-forte">${d.validade ? `Cotação válida até ${esc(d.validade.split('-').reverse().join('/'))}. ` : ''}Valores em ${esc(mNome)}.</p>
  </section>
  ${contato.length ? `<footer class="pp-pe">${contato.map(c => `<span>${esc(c)}</span>`).join('<i aria-hidden="true">|</i>')}</footer>` : ''}`;
}

function ppCss() {
  if (document.getElementById('ppCss')) return;
  const s = document.createElement('style'); s.id = 'ppCss';
  s.textContent = `
  .pp{--pp-fundo:#F5E8C7;--pp-ouro:#C9A23B;--pp-ouro-t:#8A6D1E;--pp-n:#141414;--pp-t:#4A4335;
    background:var(--pp-fundo);color:var(--pp-n);font-family:var(--f-ui,Montserrat,system-ui,sans-serif);max-width:794px;margin:0 auto;padding-bottom:28px}
  .pp p{margin:0 0 8px;font-size:14.5px;line-height:1.55;color:var(--pp-t)}
  .pp-capa{position:relative;aspect-ratio:794/1123;min-height:480px;overflow:hidden;background:#EADBB6;margin-bottom:26px}
  .pp-fotos{position:absolute;inset:0}
  .pp-f{position:absolute;left:0;right:0;background-size:cover;background-position:center}
  .pp-f1{top:0;height:38%}
  .pp-f2{top:33%;height:34%}
  .pp-f3{top:61%;bottom:0}
  .pp-corte{position:absolute;left:-10%;width:120%;height:16px;background:#FBEDE3}
  .pp-c1{top:34.6%;transform:rotate(-4deg)}
  .pp-c2{top:61.6%;transform:rotate(3deg)}
  .pp-logo{position:absolute;top:4%;left:5.5%;background:#fff;border-radius:16px;padding:16px 26px}
  .pp-logo img{display:block;height:54px;width:auto}
  .pp-capatxt{position:absolute;left:0;right:0;bottom:0;padding:26px 6% 34px;background:rgba(20,20,20,.62);color:#fff}
  .pp-capatxt p{color:#fff;margin:6px 0 0;font-size:15px}
  .pp-capak{font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--pp-ouro)!important;font-size:12.5px!important;margin:0 0 10px!important}
  .pp-capak i{font-style:normal;opacity:.7;margin:0 6px}
  .pp-capatxt h1{font-family:var(--f-ui,Montserrat,system-ui,sans-serif);font-weight:800;text-transform:uppercase;font-size:clamp(28px,7vw,40px);line-height:1.08;letter-spacing:.01em;margin:0 0 14px;color:#fff}
  .pp-dia,.pp-box,.pp-inv,.pp-pe{margin-left:5.5%;margin-right:5.5%}
  .pp-bloco{margin:0}
  .pp-kick{font-weight:700;font-size:12.5px!important;letter-spacing:.06em;text-transform:uppercase;color:var(--pp-ouro-t)!important;margin:30px 0 6px!important}
  .pp-h2{font-family:var(--f-display,'Playfair Display',serif);font-weight:600;font-size:clamp(24px,5.6vw,32px);line-height:1.15;margin:0 0 14px;padding-bottom:14px;border-bottom:3px solid var(--pp-ouro);color:var(--pp-n)}
  .pp-h2 span{color:var(--pp-n)}
  .pp-card,.pp-box{background:#fff;border-radius:18px;padding:18px 18px 12px;margin:0 0 16px}
  .pp-box{margin:0 5.5% 16px}
  .pp-tag{background:var(--pp-ouro);color:#1a1405;border-radius:8px;padding:7px 11px;font-weight:800;font-size:11.5px;letter-spacing:.05em;text-transform:uppercase;margin-bottom:12px}
  .pp-tit{font-size:17px;font-weight:800;margin:0 0 10px;color:var(--pp-n);line-height:1.3}
  .pp-foto{height:230px;border-radius:10px;background-size:cover;background-position:center;margin:0 0 12px;background-color:#EADBB6}
  .pp-inc{font-size:13.5px!important}
  .pp-inc b{color:var(--pp-n);font-weight:700}
  .pp-box h3{font-size:16px;font-weight:800;margin:4px 0 10px;color:var(--pp-n)}
  .pp-ouro{color:var(--pp-ouro-t)!important;text-transform:uppercase;letter-spacing:.04em;font-size:14px!important}
  .pp-forte{font-weight:700;color:var(--pp-n)!important;font-size:13.5px!important}
  .pp-inv{background:var(--pp-n);border-radius:18px;padding:22px;margin-bottom:16px;color:#fff}
  .pp-invg{display:grid;grid-template-columns:1fr 1fr;align-items:end;gap:14px;margin:0 0 16px}
  .pp-invg small{display:block;color:var(--pp-ouro);font-weight:800;letter-spacing:.05em;text-transform:uppercase;font-size:12px}
  .pp-invg b{display:block;font-size:clamp(24px,6vw,34px);font-weight:800;margin-top:6px;color:#fff;letter-spacing:-.01em}
  .pp-vat{color:#E9DFC6!important;font-size:13px!important;margin:-6px 0 14px!important}
  .pp-pago{display:flex;flex-wrap:wrap;gap:8px 18px;margin:0 0 14px;color:#E9DFC6;font-size:14px}
  .pp-pago b{color:#fff}
  .pp-ind{background:var(--pp-ouro);color:#1a1405;border-radius:10px;padding:14px;text-align:center;font-weight:800;letter-spacing:.02em}
  .pp-pe{display:flex;flex-wrap:wrap;justify-content:center;gap:4px 0;font-size:12.5px;color:var(--pp-t);padding:18px 0 4px}
  .pp-pe span{white-space:nowrap}
  .pp-pe i{font-style:normal;margin:0 8px;opacity:.6}
  /* a página do cliente: barra de cima (PDF) e o botão de reservar */
  .pp-pg{background:var(--pp-fundo,#F5E8C7);min-height:100svh;padding-bottom:96px}
  .pp-topo{position:sticky;top:0;z-index:50;display:flex;align-items:center;gap:10px;padding:max(10px,env(safe-area-inset-top)) 16px 10px;background:rgba(245,232,199,.92);backdrop-filter:blur(10px);border-bottom:1px solid rgba(138,109,30,.18)}
  .pp-topo img{height:26px;width:auto}
  .pp-topo .mini{margin-left:auto}
  .pp-cta{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(14px + env(safe-area-inset-bottom));z-index:60;display:flex;gap:8px;width:min(560px,calc(100% - 28px))}
  .pp-cta a,.pp-cta button{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:52px;border-radius:999px;font-weight:800;font-size:15px;text-decoration:none;border:0;cursor:pointer}
  .pp-cta .pp-zap{background:#1a1405;color:#F3E0A2;box-shadow:0 14px 30px -14px rgba(0,0,0,.6)}
  .pp-cta .pp-zap svg{width:22px;height:22px}
  .pp-cta a:focus-visible,.pp-cta button:focus-visible{outline:3px solid var(--pp-ouro-t,#8A6D1E);outline-offset:3px}
  .pp-pg .pdfPronto{margin:12px auto}
  @media(min-width:700px){.pp-foto{height:300px}.pp-card,.pp-box{padding:22px 24px 14px}}
  @media print{.pp-cta,.pp-topo{display:none!important}}`;
  document.head.appendChild(s);
}

/* ---------- 3. o link: curto (tabela kits) ou comprido ---------- */
const ppPodeNuvem = () => typeof temNuvem === 'function' && temNuvem() && typeof isLoggedIn === 'function' && isLoggedIn() && !(typeof Kit !== 'undefined' && Kit.semTabela);
const ppBase = () => typeof kitBase === 'function' ? kitBase() : Publico.base();
async function ppLink(o) {
  const d = ppDados(o);
  if (ppPodeNuvem()) {
    o.prop = o.prop || {};
    if (!o.prop.token) { o.prop.token = kitNovoToken(); Orc.salva(o); }
    try {
      const r = await supaFetch('kits', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ token: o.prop.token, dados: d, atualizado_em: new Date().toISOString() }) });
      if (r.ok || r.status === 201 || r.status === 204) {
        o.prop.publicado = o.prop.publicado || new Date().toISOString(); o.prop.atualizado = new Date().toISOString(); Orc.salva(o);
        return ppBase() + '#/p/' + o.prop.token;
      }
      if (r.status === 404 || r.status === 400) { const j = await r.json().catch(() => ({})); if (/kits|relation|schema cache|PGRST205/i.test(JSON.stringify(j)) && typeof Kit !== 'undefined') Kit.semTabela = true; }
    } catch (e) {}
  }
  return ppBase() + '#/pp/' + await Publico.codifica(d);
}
/* mandou e depois mexeu: o mesmo link curto se atualiza */
let _ppRepub = null;
function ppRepublica(o) {
  if (!(o.prop && o.prop.publicado && ppPodeNuvem())) return;
  clearTimeout(_ppRepub);
  _ppRepub = setTimeout(() => { ppLink(Orc.get(o.id) || o).catch(() => {}); }, 2500);
}
function ppMensagem(o, url) {
  const n = opPrimeiro(o.cliente.nome);
  return `Olá${n ? ', ' + n : ''}! Tudo bem? 😊 Preparei a sua proposta de experiências${o.hotel ? '' : ''} com a ${guiaNegocio()}: o roteiro dia a dia, com fotos, o que está incluso e o investimento.\n${url}\n\nSe quiser ajustar alguma coisa, é só me falar aqui. ${guiaNome()}`;
}

/* ---------- a página do cliente: #/p/<código> e #/pp/<tudo dentro> ---------- */
function ppPagina(d) {
  ppCss();
  const nome = d.nome || '';
  document.title = 'Proposta de experiências' + (nome ? ' · ' + nome : '') + ' · ' + (d.negocio || guiaNegocio());
  app.innerHTML = `<div class="pp-pg">
    <header class="pp-topo"><img src="arte/logo-horizontal-escuro.png" alt="${esc(d.negocio || guiaNegocio())}"><button class="mini" id="ppPdf" type="button">Baixar PDF</button></header>
    <main class="pp" id="ppDoc">${ppHtml(d)}</main>
    <div class="pp-cta" data-pdf-fora><a class="pp-zap" target="_blank" rel="noopener" href="${esc(waLink(`Olá! Vi a proposta ${d.num || ''}${nome ? ' (' + nome + ')' : ''} e quero reservar.`))}">${ICONE_WA} Quero reservar</a></div>
  </div>`;
  if (typeof pdfLiga === 'function') pdfLiga($('#ppPdf'), () => $('#ppDoc'), () => 'Yalla_Proposta_' + (nome || 'cliente').replace(/\s+/g, '_'));
  document.querySelectorAll('#vtZap').forEach(e => e.remove());
  scrollTo(0, 0);
}
ROTAS_EXTRA['p'] = async (partes) => {
  const tok = String((partes || [])[0] || '').replace(/[^A-Za-z0-9]/g, '');
  if (!tok) return paginaPublicaErro();
  app.innerHTML = '<main class="wrap"><p class="why center" style="margin-top:40px">Abrindo a sua proposta…</p></main>';
  try {
    const r = await supaFetch('rpc/kit', { method: 'POST', body: JSON.stringify({ p_token: tok }) });
    const d = r.ok ? await r.json() : null;
    if (!d || d.tipo !== 'proposta') return paginaPublicaErro('Esta proposta não existe mais. Peça uma nova pelo WhatsApp.');
    ppPagina(d);
  } catch (e) { paginaPublicaErro('Sem internet para abrir a proposta. Tente de novo em instantes.'); }
};
ROTAS_EXTRA['pp'] = (partes) => abrePublico(partes, (d) => d && d.tipo === 'proposta' ? ppPagina(d) : paginaPublicaErro());

/* ---------- 4. a proposta dentro do painel: conferir, PDF, link, WhatsApp ---------- */
async function ppAdm(id) {
  const o = Orc.get(id); if (!o) return go('/adm/consulta');
  ppCss();
  document.body.classList.add('em-adm');
  const temWa = !!opNum(o.cliente.whats);
  app.innerHTML = `<div class="pp-pg">
    <div class="doc-barra pp-adbar">
      <a class="mini" href="#/adm/consulta/${esc(o.id)}">← editar</a>
      <button class="cta sm" id="ppPdf" type="button">Gerar PDF</button>
      <button class="mini" id="ppLk" type="button" disabled>Preparando o link…</button>
      ${temWa ? `<a class="mini strong" id="ppWa" target="_blank" rel="noopener" aria-disabled="true">WhatsApp</a>` : ''}
      ${o.status === 'fechado' && (o.bookingIds || []).length && typeof Kit !== 'undefined' ? `<button class="mini" id="ppKit" type="button">Roteiro da viagem</button>` : ''}
    </div>
    <p class="why pp-adwhy">É assim que o cliente vê. ${temWa ? '' : 'Sem o WhatsApp do cliente: copie o link e mande você.'}</p>
    <main class="pp" id="ppDoc">${ppHtml(ppDados(o))}</main>
  </div>`;
  if (typeof pdfLiga === 'function') pdfLiga($('#ppPdf'), () => $('#ppDoc'), () => 'Yalla_Proposta_' + (o.cliente.nome || o.num).replace(/\s+/g, '_'),
    { aoEntregar: () => oyMarcaEnviado(o) });
  scrollTo(0, 0);
  const pk = $('#ppKit'); if (pk) pk.onclick = () => { const b = Bookings.get(o.bookingIds[0]); if (b) Kit.abrir(Kit.daReserva(b)); };
  let url = '';
  try { url = await ppLink(o); } catch (e) { url = ''; }
  const lk = $('#ppLk'); if (!lk) return;
  if (!url) { lk.textContent = 'Sem internet para o link'; return; }
  lk.disabled = false; lk.textContent = 'Copiar link';
  lk.onclick = () => opCopia(url).then(() => toast('Link da proposta copiado'));
  const wa = $('#ppWa');
  if (wa) { wa.href = waLink(ppMensagem(o, url), opNum(o.cliente.whats)); wa.removeAttribute('aria-disabled'); wa.onclick = () => oyMarcaEnviado(o); }
}
function oyMarcaEnviado(o) {
  if (['fechado', 'perdido', 'enviado'].includes(o.status)) return;
  o.status = 'enviado'; Orc.salva(o);
  if (typeof Espera !== 'undefined') Espera.orcamento(o);
  toast('Proposta enviada · tarefa "aguardar resposta" criada');
}
const _oyViewAdm = viewAdm;
viewAdm = function (tab, arg) { if (tab === 'proposta' && arg) return ppAdm(arg); return _oyViewAdm(tab, arg); };

/* ---------- 5. o editor ---------- */
const OY_IC = {
  mais: '<path d="M12 5v14M5 12h14"/>',
  aviao: '<path d="M2.5 13.5l7-2.3L13 3.6c.4-.9 1.8-.7 1.8.3l-.6 6.6 6.2-.1c.9 0 1.2 1.2.4 1.6l-6.8 3.5-1.9 5.3c-.3.8-1.5.7-1.6-.2l-.6-4.4-5.9.3c-.8 0-1.2-1-.5-1.5Z"/>',
  livre: '<path d="M4 20h4L19 9l-4-4L4 16v4Z"/><path d="M13.5 6.5l4 4"/>',
  busca: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  seta: '<path d="M9 5l7 7-7 7"/>',
};
const oyIc = (k) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${OY_IC[k]}</svg>`;
const oyDiaLongo = (iso) => { if (!iso) return 'Sem dia definido'; const w = new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' }); return w.charAt(0).toUpperCase() + w.slice(1) + ', ' + iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(2, 4); };
const oyDiaCurto = (iso) => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '') + ' · ' + iso.slice(8, 10) + '/' + iso.slice(5, 7) : 'Sem dia';

function oyTela(id) {
  const o = Orc.get(id);
  if (!o) { go('/adm/consulta'); return; }
  oyCss();
  /* orçamento antigo: completa o que o editor novo usa, sem mexer no resto */
  o.moeda = OY_MOEDA;
  if (o.adultos == null && o.criancas == null) { o.adultos = +o.pax || 0; o.criancas = 0; }
  o.chegada = o.chegada || { data: '', hora: '', voo: '' };
  o.partida = o.partida || { data: '', hora: '', voo: '' };
  const m = oyMoeda(o), S = oyTela._s = oyTela._s && oyTela._s.id === id ? oyTela._s : { id, aberto: '' };
  const itens = oyOrdena(o.itens);
  const grupos = []; for (const i of itens) { const k = i.data || ''; let g = grupos.find(x => x.d === k); if (!g) grupos.push(g = { d: k, l: [] }); g.l.push(i); }
  const nDias = grupos.filter(g => g.d).length;
  const st = (ORC_STATUS.find(s => s[0] === o.status) || ['', o.status])[1];
  const custoTot = o.itens.reduce((s, x) => s + (+x.custo || 0), 0);

  /* os campos de um serviço; "so" = só o que não aparece na linha da planilha */
  const campos = (i, so) => {
    const x = i.tourId && Tours.get(i.tourId), fotos = x ? oyFotosDe(x) : [];
    return `${so ? '' : `<div class="oy-g3">
          <label class="fld">Dia<input type="date" data-k="data" value="${esc(i.data)}"></label>
          <label class="fld">Início<input data-k="hora" value="${esc(i.hora)}" placeholder="09:00" inputmode="numeric"></label>
          <label class="fld">Fim<input data-k="horaFim" value="${esc(i.horaFim)}" placeholder="17:00" inputmode="numeric"></label>
        </div>
        <label class="fld">Título<input data-k="desc" value="${esc(i.desc)}"></label>
        <label class="fld">O que o cliente vai ler<textarea data-k="texto" rows="4">${esc(i.texto)}</textarea></label>`}
        <label class="fld">Incluso<textarea data-k="incluso" rows="2">${esc(i.incluso)}</textarea></label>
        <div class="oy-g3">
          ${i.tipo === 'traslado' ? `<label class="fld">Voo<input data-k="voo" value="${esc(i.voo)}" placeholder="EK323"></label>` : `<label class="fld">Destaque<input data-k="rotulo" value="${esc(i.rotulo)}" placeholder="manhã livre"></label>`}
          <label class="fld">Pessoas<input type="number" min="1" inputmode="numeric" data-k="pax" value="${i.pax}"></label>
          ${so ? `<label class="fld oy-custo2" title="o que você paga a quem faz o serviço — nunca vai para o cliente">Custo (só você vê)<input type="number" min="0" inputmode="decimal" data-k="custo" value="${i.custo || ''}" placeholder="0"></label>`
            : `<label class="fld">Valor ${esc(m)}<input type="number" min="0" inputmode="decimal" data-k="valor" value="${i.valor || ''}" placeholder="0"></label>`}
        </div>
        ${fotos.length > 1 || (fotos.length && !i.foto) ? `<div class="oy-fotos" role="group" aria-label="Foto na proposta">
          <button type="button" class="oy-ft oy-ftno ${!i.foto ? 'on' : ''}" data-foto="" aria-pressed="${!i.foto}">sem foto</button>
          ${fotos.slice(0, 10).map(f => `<button type="button" class="oy-ft ${i.foto === f ? 'on' : ''}" data-foto="${esc(f)}" aria-pressed="${i.foto === f}" aria-label="usar esta foto" style="background-image:url('${esc(f)}')"></button>`).join('')}
        </div>` : ''}
        <div class="oy-itacs">
          ${so ? '' : `<label class="fld oy-custo" title="o que você paga a quem faz o serviço — nunca vai para o cliente">Custo (só você vê)<input type="number" min="0" inputmode="decimal" data-k="custo" value="${i.custo || ''}" placeholder="0"></label>`}
          ${x ? `<button type="button" class="mini" data-recalc="${esc(i.id)}">preço da tabela</button>` : ''}
          <button type="button" class="mini" data-dup="${esc(i.id)}">duplicar</button>
          <button type="button" class="mini danger" data-rmi="${esc(i.id)}">tirar</button>
        </div>`;
  };
  /* celular: um cartão por serviço (toque abre) */
  const linhaItem = (i) => {
    const aberto = S.aberto === i.id;
    return `<article class="oy-it ${aberto ? 'aberto' : ''}" data-it="${esc(i.id)}">
      <button type="button" class="oy-itcab" data-abre="${esc(i.id)}" aria-expanded="${aberto}">
        <span class="oy-ithr">${esc(ppHoras(i) || 'sem horário')}</span>
        <span class="oy-itn"><b>${esc(i.desc || 'Sem título')}</b>${i.tipo === 'traslado' && i.voo ? `<small>voo ${esc(i.voo)}</small>` : ''}${!i.valor ? '<small class="oy-alerta">sem valor</small>' : ''}</span>
        <span class="oy-itv">${i.valor ? esc(oyM(i.valor, m)) : '—'}</span>
        <span class="oy-chev">${oyIc('seta')}</span>
      </button>
      ${aberto ? `<div class="oy-ited">${campos(i, false)}</div>` : ''}
    </article>`;
  };
  /* computador: a PLANILHA, como a dela no Excel — uma faixa por dia e, em cada
     linha, dia · horário · serviço em negrito com os detalhes embaixo · valor.
     Edita direto na linha (Tab passa de campo em campo); o ⋯ guarda o resto. */
  const planilha = () => {
    let ult = null;
    return `<div class="oy-sheet" role="table" aria-label="Roteiro">
      <div class="oy-shh" role="row"><span role="columnheader">Dia</span><span role="columnheader">Horário</span><span role="columnheader">Serviço e detalhes</span><span role="columnheader" class="oy-r">Valor ${esc(m)}</span><span role="columnheader"><span class="sr">Mais</span></span></div>
      ${itens.map(i => {
        const band = i.data !== ult ? `<div class="oy-band" role="row"><span role="cell">${esc(oyDiaLongo(i.data))}</span></div>` : '';
        ult = i.data;
        const aberto = S.aberto === i.id;
        const nl = (i.texto || '').split('\n').length;
        return band + `<div class="oy-row ${aberto ? 'aberto' : ''}" data-it="${esc(i.id)}" role="row">
          <label class="oy-c oy-cd" role="cell"><span class="sr">Dia</span><input type="date" data-k="data" value="${esc(i.data)}"></label>
          <label class="oy-c oy-ch" role="cell"><span class="sr">Horário</span><input data-k="faixa" value="${esc(ppHoras(i))}" placeholder="09:00–17:00"></label>
          <div class="oy-c oy-cs" role="cell">
            <input class="oy-ct" data-k="desc" value="${esc(i.desc)}" placeholder="Serviço (ex.: Tour de até 8 horas em Dubai)" aria-label="Serviço">
            <textarea class="oy-cx" data-k="texto" rows="${Math.min(10, Math.max(2, nl + 1))}" placeholder="Detalhes, um por linha (* Visita ao Miracle Garden…)" aria-label="Detalhes">${esc(i.texto)}</textarea>
            ${i.tipo === 'traslado' && i.voo ? `<small class="oy-cvoo">voo ${esc(i.voo)}</small>` : ''}
          </div>
          <label class="oy-c oy-cv" role="cell"><span class="sr">Valor ${esc(m)}</span><input type="number" min="0" inputmode="decimal" data-k="valor" value="${i.valor || ''}" placeholder="0"></label>
          <span class="oy-c" role="cell"><button type="button" class="oy-cm" data-abre="${esc(i.id)}" aria-expanded="${aberto}" aria-label="Mais deste serviço: incluso, foto, pessoas, custo">⋯</button></span>
        </div>${aberto ? `<div class="oy-rowmais" data-it="${esc(i.id)}">${campos(i, true)}</div>` : ''}`;
      }).join('')}
    </div>`;
  };
  const largo = typeof matchMedia === 'function' && matchMedia('(min-width: 761px)').matches;

  const fechado = o.status === 'fechado';
  admShell('consulta', `
  <div class="oy">
    <div class="oy-top">
      <a class="linkbtn" href="#/adm/consulta">← Orçamentos</a>
      <div class="oy-tit"><h1 class="pageh">${esc(o.num)}</h1><span class="pill">${esc(st)}</span><small class="oy-salvo" id="oySalvo" aria-live="polite"></small></div>
    </div>

    <section class="card oy-card">
      <h2 class="oy-h">Cliente</h2>
      <div class="oy-g2">
        <label class="fld">Nome<input id="oyNome" value="${esc(o.cliente.nome)}" autocomplete="off" placeholder="Nome do cliente"></label>
        <label class="fld">WhatsApp<input id="oyWhats" value="${esc(o.cliente.whats)}" inputmode="tel" autocomplete="off" placeholder="+55 11 99999-9999"></label>
      </div>
      <div class="oy-g2">
        ${['adultos', 'criancas'].map(k => `<div class="fld oy-pax"><span id="oyL-${k}">${k === 'adultos' ? 'Adultos' : 'Crianças'}</span>
          <div class="oy-step" role="group" aria-labelledby="oyL-${k}">
            <button type="button" data-step="${k}" data-d="-1" aria-label="menos">−</button>
            <output id="oy-${k}">${+o[k] || 0}</output>
            <button type="button" data-step="${k}" data-d="1" aria-label="mais">+</button></div></div>`).join('')}
      </div>
      <label class="fld">Hotel<input id="oyHotel" value="${esc(o.hotel || '')}" autocomplete="off" placeholder="Ex.: W Dubai The Palm"></label>
      <div class="oy-g2">
        ${[['chegada', 'Chegada'], ['partida', 'Partida']].map(([k, n]) => `<fieldset class="oy-voo"><legend>${n}</legend>
          <div class="oy-vg">
            <label class="fld"><span class="sr">${n}: dia</span><input type="date" data-v="${k}.data" value="${esc(o[k].data)}" aria-label="${n}: dia"></label>
            <label class="fld"><span class="sr">${n}: hora do voo</span><input data-v="${k}.hora" value="${esc(o[k].hora)}" placeholder="hora" inputmode="numeric" aria-label="${n}: hora do voo"></label>
            <label class="fld"><span class="sr">${n}: voo</span><input data-v="${k}.voo" value="${esc(o[k].voo)}" placeholder="voo" aria-label="${n}: número do voo"></label>
          </div></fieldset>`).join('')}
      </div>
    </section>

    <section class="card oy-card">
      <div class="oy-hrow"><h2 class="oy-h">Roteiro</h2><span class="oy-sub">${o.itens.length ? `${o.itens.length} ${o.itens.length === 1 ? 'serviço' : 'serviços'}${nDias ? ' · ' + nDias + (nDias === 1 ? ' dia' : ' dias') : ''}` : ''}</span></div>
      ${!o.itens.length ? '<p class="why">Nenhum serviço ainda. Comece pelo passeio, pelo traslado de chegada ou por uma linha em branco.</p>'
        : largo ? planilha() : grupos.map(g => `<div class="oy-dia"><h3 class="oy-diah">${esc(oyDiaCurto(g.d))}</h3>${g.l.map(linhaItem).join('')}</div>`).join('')}
      <div class="oy-add" role="group" aria-label="Acrescentar ao roteiro">
        <button type="button" class="oy-addb oy-addf" id="oyAddP">${oyIc('mais')}<span>Passeio</span></button>
        <button type="button" class="oy-addb" data-tr="chegada">${oyIc('aviao')}<span>Traslado chegada</span></button>
        <button type="button" class="oy-addb" data-tr="partida">${oyIc('aviao')}<span>Traslado saída</span></button>
        <button type="button" class="oy-addb" id="oyAddL">${oyIc('livre')}<span>${largo ? 'Linha em branco' : 'Item livre'}</span></button>
      </div>
    </section>

    <section class="card oy-card oy-val" id="oyVal">${oyValoresHtml(o)}</section>

    ${fechado ? (() => { const bs = (o.bookingIds || []).map(bid => Bookings.get(bid)).filter(Boolean);
      return `<section class="card oy-card oy-fechou"><div class="oy-hrow"><h2 class="oy-h">Fechou${o.fechadoEm ? ' em ' + esc(opCurta(o.fechadoEm)) : ''}</h2><span class="oy-sub">${bs.length} ${bs.length === 1 ? 'reserva' : 'reservas'}</span></div>
        ${bs.length && typeof Kit !== 'undefined' ? `<button type="button" class="cta oy-kitb" id="oyKit" data-kitb="${esc(Kit.daReserva(bs[0]))}">Roteiro da viagem</button><p class="why">O que o cliente recebe depois da compra: o roteiro dia a dia com os horários, os encontros e o pagamento, em link ou PDF.</p>` : ''}
        <details class="oy-res"><summary>Ver as reservas</summary>${bs.map(b => opCardServico(b, { comData: true })).join('')}</details></section>`; })()
      : o.status === 'enviado' ? `<section class="card oy-card oy-fechou"><div class="oy-hrow"><h2 class="oy-h">O cliente fechou?</h2></div>
        <p class="why">Cada serviço vira reserva e o roteiro da viagem fica pronto para mandar.</p>
        <button type="button" class="cta" id="oyFecha2">Fechou — criar as reservas</button></section>` : ''}

    <details class="card oy-card oy-mais" ${S.mais ? 'open' : ''}><summary><b>Mais opções</b><small>e-mail, situação, sinal, textos da proposta, arquivos</small></summary>
      <div class="oy-g2">
        <label class="fld">E-mail do cliente<input id="oyEmail" value="${esc(o.cliente.email)}" inputmode="email" autocomplete="off"></label>
        <label class="fld">Situação<select id="oySt">${ORC_STATUS.map(s => `<option value="${s[0]}" ${o.status === s[0] ? 'selected' : ''}>${s[1]}</option>`).join('')}</select></label>
      </div>
      <div class="oy-g2">
        <label class="fld">Sinal para reservar (%)<input type="number" min="0" max="100" inputmode="numeric" id="oyPct" value="${o.sinalPct}"></label>
        <label class="fld">VAT (%)<input type="number" min="0" max="30" step="0.5" inputmode="decimal" id="oyVat" value="${oyVatPct(o)}"></label>
        <div class="fld"><span>Sinal / sua margem</span><b class="oy-num">${esc(oyM(Orc.sinal(o), m))}${custoTot ? ' · ' + esc(oyM(Orc.total(o) - custoTot, m)) : ''}</b></div>
      </div>
      <label class="fld">Observação para o cliente (vai na proposta)<textarea id="oyObs" rows="2">${esc(o.obs)}</textarea></label>
      <label class="fld">Condições e cancelamento<textarea id="oyPol" rows="5">${esc(o.politica != null ? o.politica : ppTextoPadrao('politica'))}</textarea></label>
      <label class="fld">Linhas em destaque (uma por linha)<textarea id="oyCond" rows="2">${esc(o.condicoes != null ? o.condicoes : ppTextoPadrao('condicoes'))}</textarea></label>
      <label class="fld">O diferencial<textarea id="oyDif" rows="3">${esc(o.diferencial != null ? o.diferencial : ppTextoPadrao('diferencial'))}</textarea></label>
      <button type="button" class="mini" id="oyPadrao">usar estes textos em todas as propostas</button>
      ${o.conversa ? `<details class="oy-conv"><summary>A conversa original</summary><pre class="pdmsg">${esc(o.conversa)}</pre></details>` : ''}
      <div class="orc-links"><span class="op-lbl">Arquivo: ${esc(Orc.nomeArquivo(o))}</span>
        ${(o.links || []).map(l => `<a class="mini" target="_blank" rel="noopener" href="${esc(l.url)}">${esc(l.nome)}</a>`).join('')}
        <div class="oy-g2"><label class="fld"><span class="sr">nome do link</span><input id="orLkNome" placeholder="nome (ex.: comprovante)" aria-label="nome do link"></label><label class="fld"><span class="sr">endereço</span><input id="orLkUrl" placeholder="https://drive.google.com/…" aria-label="endereço do link"></label></div>
        <button type="button" class="mini" id="orLkAdd">+ link</button></div>
      <div class="btnrow">${!fechado ? '<button type="button" class="mini strong" id="oyFecha">Fechou — criar as reservas</button>' : ''}<button type="button" class="mini danger" id="oyApaga">apagar orçamento</button></div>
    </details>

    <div class="savebar oy-barra">
      <span class="sbwhat">${esc(oyM(Orc.total(o), m))}${oyPax(o) > 1 ? ' · ' + esc(oyM(oyPorPessoa(o), m)) + '/pessoa' : ''}</span>
      <a class="cta sm" href="#/adm/proposta/${esc(o.id)}">Ver e enviar a proposta</a>
    </div>
  </div>`);
  oyLiga(o);
}

function oyValoresHtml(o) {
  const m = oyMoeda(o), soma = o.itens.reduce((s, i) => s + (+i.valor || 0), 0);
  return `<div class="oy-hrow"><h2 class="oy-h">Valores</h2></div>
    <div class="oy-tot">
      <div><small>Total com VAT</small><b>${esc(oyM(Orc.total(o), m))}</b><small>${esc(oyM(Orc.subtotal(o), m))}${+o.desconto ? ' (com desconto)' : ''} + VAT ${esc(String(oyVatPct(o)).replace('.', ','))}% ${esc(oyM(Orc.vat(o), m))}</small></div>
      <div><small>Por pessoa</small><b>${oyPax(o) ? esc(oyM(oyPorPessoa(o), m)) : '—'}</b><small>${esc(oyPaxTexto(o) || 'informe as pessoas')}</small></div>
      <div><small>Pendente</small><b>${esc(oyM(oyPendente(o), m))}</b></div>
    </div>
    <div class="oy-g3v">
      <label class="fld">Já pago (USD)<input type="number" min="0" inputmode="decimal" id="oyPago" value="${+o.pago || ''}" placeholder="0"></label>
      <label class="fld">Desconto (USD)<input type="number" min="0" inputmode="decimal" id="oyDesc" value="${+o.desconto || ''}" placeholder="0"></label>
      <label class="fld">Válida até<input type="date" id="oyVal2" value="${esc(o.validade)}"></label>
    </div>
    <p class="why oy-usd">Tudo em dólar (USD).</p>`;
}

/* salva o que está na tela (sem redesenhar) */
function oyLe(o) {
  const v = (s) => { const e = document.querySelector(s); return e ? e.value : null; };
  const nome = v('#oyNome'); if (nome == null) return;
  o.cliente = { nome: nome.trim(), whats: (v('#oyWhats') || '').trim(), email: (v('#oyEmail') ?? o.cliente.email ?? '').trim() };
  o.hotel = (v('#oyHotel') || '').trim();
  $$('[data-v]').forEach(e => { const [k, c] = e.dataset.v.split('.'); o[k] = o[k] || {}; o[k][c] = c === 'hora' ? (oyHm(e.value) || e.value.trim()) : e.value.trim(); });
  document.querySelectorAll('.oy [data-it]').forEach(box => {
    const i = o.itens.find(z => z.id === box.dataset.it); if (!i) return;
    box.querySelectorAll('[data-k]').forEach(e => {
      if (e.closest('[data-it]') !== box) return;
      const k = e.dataset.k;
      if (k === 'pax') i.pax = Math.max(1, +e.value || 1);
      else if (k === 'valor') { const n = +e.value || 0; if (n !== i.valor) i.auto = false; i.valor = n; }
      else if (k === 'custo') i.custo = +e.value || 0;
      else if (k === 'hora' || k === 'horaFim') i[k] = oyHm(e.value) || e.value.trim();
      /* "09:00–17:00", "9h às 17h", "19:30" */
      else if (k === 'faixa') { const [a, b] = String(e.value).split(/\s*(?:–|—|-|às|as|até|ate|a)\s*/i); i.hora = oyHm(a) || ''; i.horaFim = oyHm(b) || ''; }
      else i[k] = e.value;
    });
  });
  const n = (s, d) => { const x = v(s); return x == null ? d : (+x || 0); };
  o.pago = n('#oyPago', o.pago); o.desconto = n('#oyDesc', o.desconto);
  o.moeda = OY_MOEDA; o.validade = v('#oyVal2') || o.validade;
  if (v('#oySt')) o.status = v('#oySt');
  if (v('#oyPct') != null) o.sinalPct = +v('#oyPct') || 0;
  if (v('#oyVat') != null && v('#oyVat') !== '') o.vatPct = Math.max(0, +v('#oyVat') || 0);
  if (v('#oyObs') != null) o.obs = v('#oyObs');
  if (v('#oyPol') != null) { o.politica = v('#oyPol'); o.condicoes = v('#oyCond'); o.diferencial = v('#oyDif'); }
  if (o.status === 'novo') o.status = 'rascunho';
}
let _oyT = null;
/* redesenha (a ordem dos dias mudou) e devolve o cursor ao campo para onde ela foi */
function oyRedesenha(o) {
  setTimeout(() => {
    const a = document.activeElement, box = a && a.closest && a.closest('[data-it]');
    const alvo = box && a.dataset.k ? `[data-it="${box.dataset.it}"] [data-k="${a.dataset.k}"]` : (a && a.id ? '#' + a.id : '');
    const y = scrollY; oyTela(o.id); scrollTo(0, y);
    if (alvo) { const e = document.querySelector(alvo); if (e) e.focus({ preventScroll: true }); }
  }, 0);
}
function oySalva(o, redesenha) {
  oyLe(o); Orc.salva(o); ppRepublica(o);
  const s = $('#oySalvo'); if (s) { s.textContent = 'salvo'; clearTimeout(_oyT); _oyT = setTimeout(() => { const z = $('#oySalvo'); if (z) z.textContent = ''; }, 1600); }
  if (redesenha) { oyRedesenha(o); return; }
  const val = $('#oyVal'); if (val && !val.contains(document.activeElement)) { val.innerHTML = oyValoresHtml(o); oyLigaValores(o); }
  const bar = document.querySelector('.oy-barra .sbwhat'); if (bar) bar.textContent = oyM(Orc.total(o), oyMoeda(o)) + (oyPax(o) > 1 ? ' · ' + oyM(oyPorPessoa(o), oyMoeda(o)) + '/pessoa' : '');
}
function oyLigaValores(o) {
  $$('#oyVal input').forEach(e => { e.onchange = () => oySalva(o, false); });
}
function oyLiga(o) {
  const S = oyTela._s, re = () => oySalva(o, true);
  /* digitou: guarda; saiu do campo: redesenha o que depende (valores, ordem dos dias) */
  $$('.oy input, .oy textarea, .oy select').forEach(e => {
    if (e.closest('#oyVal') || e.id === 'orLkNome' || e.id === 'orLkUrl') return;
    e.oninput = () => { clearTimeout(e._t); e._t = setTimeout(() => oySalva(o, false), 700); };
    e.onchange = () => {
      /* só o que muda a ordem ou o preço redesenha; o valor na planilha só refaz os totais */
      const naPlanilha = !!e.closest('.oy-row');
      const muda = e.matches('[data-k="data"],[data-k="hora"],[data-k="faixa"],[data-k="pax"],[data-v$=".data"]') || (!naPlanilha && e.matches('[data-k="valor"]'));
      oySalva(o, muda);
    };
  });
  /* os detalhes crescem com o texto, como a célula do Excel */
  const cresce = (t) => { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; };
  $$('.oy-cx').forEach(t => { cresce(t); t.addEventListener('input', () => cresce(t)); });
  oyLigaValores(o);
  $$('[data-abre]').forEach(b => b.onclick = () => { oyLe(o); Orc.salva(o); S.aberto = S.aberto === b.dataset.abre ? '' : b.dataset.abre; re(); });
  $$('[data-step]').forEach(b => b.onclick = () => {
    oyLe(o); const antes = oyPax(o), k = b.dataset.step;
    o[k] = Math.max(0, (+o[k] || 0) + +b.dataset.d);
    if (k === 'adultos' && !o.adultos && !o.criancas) o.adultos = 1;
    oyMudaPax(o, antes); Orc.salva(o); ppRepublica(o); re();
  });
  $$('[data-foto]').forEach(b => b.onclick = () => { oyLe(o); const i = o.itens.find(z => z.id === S.aberto); if (i) i.foto = b.dataset.foto; Orc.salva(o); re(); });
  $$('[data-rmi]').forEach(b => b.onclick = () => { oyLe(o); o.itens = o.itens.filter(i => i.id !== b.dataset.rmi); S.aberto = ''; Orc.salva(o); re(); });
  $$('[data-dup]').forEach(b => b.onclick = () => { oyLe(o); const i = o.itens.find(z => z.id === b.dataset.dup); if (!i) return; const n = Orc._item({ ...i, id: '' }); o.itens.push(n); S.aberto = n.id; Orc.salva(o); re(); });
  $$('[data-recalc]').forEach(b => b.onclick = () => {
    oyLe(o); const i = o.itens.find(z => z.id === b.dataset.recalc); if (!i) return;
    const n = Orc.itemDoCatalogo(i.tourId, { pax: i.pax, data: i.data, hora: i.hora, opcao: i.opcao });
    if (n) { i.valor = n.valor; i.sinal = n.sinal; i.auto = true; }
    Orc.salva(o); re();
  });
  $$('[data-tr]').forEach(b => b.onclick = () => {
    oyLe(o); const qual = b.dataset.tr, p = o[qual] || {};
    if (!p.data) { toast(`Coloque o dia da ${qual === 'chegada' ? 'chegada' : 'partida'} primeiro`); const e = document.querySelector(`[data-v="${qual}.data"]`); if (e) e.focus(); return; }
    const n = oyTraslado(o, qual === 'chegada' ? 'chegada' : 'saida'); o.itens.push(n); S.aberto = n.id; Orc.salva(o); re();
  });
  $('#oyAddL').onclick = () => { oyLe(o); const n = Orc._item({ tipo: 'livre', desc: '', pax: oyPax(o) || 2, data: oyProximoDia(o) }); o.itens.push(n); S.aberto = matchMedia('(min-width: 761px)').matches ? '' : n.id; Orc.salva(o); re(); setTimeout(() => { const e = document.querySelector(`[data-it="${n.id}"] [data-k="desc"]`); if (e) e.focus(); }, 60); };
  $('#oyAddP').onclick = () => { oyLe(o); Orc.salva(o); oyCatalogo(o); };
  const det = document.querySelector('.oy-mais'); if (det) det.ontoggle = () => { S.mais = det.open; };
  $('#oyPadrao').onclick = () => { oyLe(o); DB.settings.propPolitica = o.politica; DB.settings.propCondicoes = o.condicoes; DB.settings.propDiferencial = o.diferencial; save(); Orc.salva(o); toast('Textos guardados para as próximas propostas'); };
  $('#orLkAdd').onclick = () => { oyLe(o); const r = Orc.linkAdd(o.id, $('#orLkNome').value, $('#orLkUrl').value); if (r && r.erro) return toast(r.erro); re(); };
  $('#oyApaga').onclick = () => { if (confirm('Apagar este orçamento?')) { Orc.remove(o.id); go('/adm/consulta'); } };
  for (const fid of ['#oyFecha', '#oyFecha2']) { const fb = $(fid); if (fb) fb.onclick = () => { oyLe(o); Orc.salva(o); oyFechar(o); }; }
  const kb = $('#oyKit'); if (kb) kb.onclick = () => Kit.abrir(kb.dataset.kitb);
  opLigaCards && opLigaCards(re);
}

/* a janela do catálogo: busca, filtro por região, um toque acrescenta */
function oyCatalogo(o) {
  const m = oyMoeda(o);
  const dias = oyDiasDaViagem(o);
  const C = oyCatalogo._s = { q: '', r: '', dia: oyProximoDia(o), n: 0 };
  const d = opJanela('Acrescentar passeio', `
    <div class="oy-cdias">${dias.length ? `<span class="op-lbl">Para o dia</span><div class="chips" id="oyCDias">${dias.map(x => `<button type="button" class="chip ${x === C.dia ? 'on' : ''}" data-cdia="${x}">${esc(oyDiaCurto(x))}</button>`).join('')}</div>`
      : `<label class="fld">Para o dia<input type="date" id="oyCDia" value="${esc(C.dia)}"></label>`}</div>
    <label class="oy-busca">${oyIc('busca')}<span class="sr">Buscar passeio</span><input type="search" id="oyCQ" placeholder="Buscar: deserto, Burj, Abu Dhabi…" autocomplete="off"></label>
    <div class="chips oy-creg" id="oyCReg"><button type="button" class="chip on" data-creg="">Todos</button>${regioes().filter(r => Tours.all().some(x => x.region === r[0])).map(r => `<button type="button" class="chip" data-creg="${r[0]}">${esc(r[1])}</button>`).join('')}</div>
    <div class="oy-clista" id="oyCL"></div>
    <div class="btnrow oy-cpe"><span class="why" id="oyCN" aria-live="polite"></span><button type="button" class="cta sm" id="oyCOk">Pronto</button></div>`);
  d.classList.add('oy-cdlg');
  const pinta = () => {
    const q = _nomeN(C.q);
    const ja = new Set(o.itens.map(i => i.tourId).filter(Boolean));
    const l = Tours.all().filter(x => x.status !== 'draft' || ja.has(x.id))
      .filter(x => !C.r || x.region === C.r)
      .filter(x => !q || _nomeN(x.name.pt + ' ' + oyPt(x.tagline) + ' ' + (x.region || '')).includes(q));
    d.querySelector('#oyCL').innerHTML = l.length ? l.map(x => {
      const f = oyFotosDe(x)[0], p = Orc.itemDoCatalogo(x.id, { pax: oyPax(o) || 2 });
      const mx = x.moeda || moedaCodigo();
      return `<button type="button" class="oy-cit ${ja.has(x.id) ? 'ja' : ''}" data-cadd="${esc(x.id)}">
        <span class="oy-cft" ${f ? `style="background-image:url('${esc(f)}')"` : ''} aria-hidden="true"></span>
        <span class="oy-cnm"><b>${esc(x.name.pt)}</b><small>${p && p.valor ? esc(oyM(p.valor, mx)) + ' · ' + (oyPax(o) || 2) + 'p' : 'sob consulta'}${ja.has(x.id) ? ' · já no roteiro' : ''}</small></span>
        <span class="oy-cmais">${oyIc('mais')}</span></button>`;
    }).join('') : '<p class="why">Nada com esse nome. Use "Item livre" para escrever à mão.</p>';
    d.querySelectorAll('[data-cadd]').forEach(b => b.onclick = () => {
      const dia = C.dia || '';
      const n = oyDoCatalogo(o, b.dataset.cadd, { data: dia });
      if (!n) return;
      o.itens.push(n); Orc.salva(o); ppRepublica(o); C.n++;
      d.querySelector('#oyCN').textContent = `${C.n} acrescentado${C.n > 1 ? 's' : ''} · ${n.desc}${dia ? ' em ' + opCurta(dia) : ''}`;
      if (dias.length) { const prox = oyProximoDia(o); if (prox && prox !== C.dia && dias.includes(prox)) { C.dia = prox; d.querySelectorAll('[data-cdia]').forEach(c => c.classList.toggle('on', c.dataset.cdia === prox)); } }
      pinta();
    });
  };
  pinta();
  d.querySelector('#oyCQ').oninput = (e) => { C.q = e.target.value; pinta(); };
  d.querySelectorAll('[data-creg]').forEach(b => b.onclick = () => { C.r = b.dataset.creg; d.querySelectorAll('[data-creg]').forEach(c => c.classList.toggle('on', c === b)); pinta(); });
  d.querySelectorAll('[data-cdia]').forEach(b => b.onclick = () => { C.dia = b.dataset.cdia; d.querySelectorAll('[data-cdia]').forEach(c => c.classList.toggle('on', c === b)); });
  const di = d.querySelector('#oyCDia'); if (di) di.onchange = () => { C.dia = di.value; };
  d.querySelector('#oyCOk').onclick = () => d.close();
  d.addEventListener('close', () => { if (location.hash.includes(o.id)) { const y = scrollY; oyTela(o.id); scrollTo(0, y); } });
}

/* fechou: o mesmo de antes (cada serviço vira reserva), numa janelinha */
function oyFechar(o) {
  const sin = Orc.sinal(o), m = oyMoeda(o);
  if (!o.cliente.nome) { toast('Falta o nome do cliente.'); const e = $('#oyNome'); if (e) e.focus(); return; }
  const semData = o.itens.filter(i => i.tourId && !i.data);
  if (semData.length) return toast('Falta o dia em ' + semData.map(i => i.desc).join(', '));
  const d = opJanela('Fechou?', `<p class="why">Cada serviço vira uma reserva, com o cliente, o dia e o sinal. Aparece no Hoje, na agenda e na ficha dele.</p>
    <label class="optin"><input type="checkbox" id="oyFSin" ${sin ? 'checked' : ''}><span><b>O sinal de ${esc(oyM(sin, m))} já caiu</b><small>registra o pagamento na conta abaixo</small></span></label>
    <label class="fld">Conta<select id="oyFConta">${opContaOpts('nubank')}</select></label>
    <div class="btnrow"><button type="button" class="cta sm" id="oyFOk">Fechou — criar as reservas</button></div>`);
  d.querySelector('#oyFOk').onclick = () => {
    const bs = Orc.fecha(o.id, { sinalRecebido: d.querySelector('#oyFSin').checked, conta: d.querySelector('#oyFConta').value });
    d.close(); toast(`${bs.length} ${bs.length === 1 ? 'reserva criada' : 'reservas criadas'} 🎉 · o roteiro da viagem está pronto`); oyTela(o.id); scrollTo(0, 0);
  };
}

function oyCss() {
  if (document.getElementById('oyCss')) return;
  const s = document.createElement('style'); s.id = 'oyCss';
  s.textContent = `
  .oy{max-width:860px;margin:0 auto}
  .oy .sr,.oy-cdlg .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
  .oy-top{margin-bottom:10px}
  .oy-tit{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:6px}
  .oy-tit .pageh{margin:0}
  .oy-salvo{color:var(--ok);font-size:var(--fs-2);min-width:40px}
  .oy-card{margin-bottom:14px}
  .oy-h{font-size:var(--fs-4,18px);margin:0 0 12px}
  .oy-hrow{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
  .oy-sub{color:var(--ink-3);font-size:var(--fs-2)}
  .oy-g2{display:grid;grid-template-columns:1fr 1fr;gap:0 12px}
  .oy-g3{display:grid;grid-template-columns:1.25fr 1fr 1fr;gap:0 8px}
  .oy-g3v{display:grid;grid-template-columns:repeat(3,1fr);gap:0 10px}
  .oy-usd{margin:2px 0 0;font-size:12px}
  .oy .fld input,.oy .fld select,.oy .fld textarea{min-height:44px}
  .oy-pax > span{display:block}
  .oy-step{display:flex;align-items:center;justify-content:space-between;gap:6px;border:1px solid var(--line-2);border-radius:var(--r-pill);padding:3px;background:var(--surface);min-height:44px;margin-top:4px}
  .oy-step button{width:40px;height:40px;border-radius:50%;border:0;background:var(--surface-2);color:var(--ink);font-size:20px;line-height:1;cursor:pointer}
  .oy-step button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .oy-step output{font-weight:700;font-size:var(--fs-4,18px);min-width:24px;text-align:center}
  .oy-voo{border:0;margin:0;padding:0;min-width:0}
  .oy-vg{display:grid;grid-template-columns:1.35fr .8fr 1fr;gap:0 8px}
  .oy-voo legend{font-size:var(--fs-2);font-weight:var(--t-strong);color:var(--ink-2);padding:0;margin-bottom:2px}
  .oy-dia{margin:6px 0 10px}
  .oy-diah{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--accent);margin:12px 0 6px;font-weight:700}
  .oy-it{border:1px solid var(--line);border-radius:var(--r-md,12px);background:var(--surface);margin-bottom:6px;overflow:hidden}
  .oy-it.aberto{border-color:var(--accent-line);box-shadow:var(--sh-1)}
  .oy-itcab{display:grid;grid-template-columns:74px 1fr auto 18px;align-items:center;gap:10px;width:100%;min-height:52px;padding:8px 12px;background:none;border:0;text-align:left;font:inherit;color:var(--ink);cursor:pointer}
  .oy-itcab:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
  .oy-ithr{font-size:var(--fs-2);color:var(--ink-2);font-variant-numeric:tabular-nums}
  .oy-itn{min-width:0}
  .oy-itn b{display:block;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .oy-itn small{display:inline-block;margin-right:8px;color:var(--ink-3);font-size:12px}
  .oy-itn .oy-alerta{color:var(--warn)}
  .oy-itv{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
  .oy-chev svg{width:16px;height:16px;color:var(--ink-3);transition:transform .2s ease}
  .oy-it.aberto .oy-chev svg{transform:rotate(90deg)}
  .oy-ited{padding:4px 12px 12px;border-top:1px solid var(--line)}
  .oy-ited textarea{resize:vertical}
  .oy-aviso{margin:0 0 8px;padding:8px 10px;border-radius:10px;background:var(--warn-wash,#FFF4DA);color:var(--ink);font-size:var(--fs-2)}
  .oy-fotos{display:flex;gap:6px;overflow-x:auto;padding:2px 0 8px;margin-bottom:4px}
  .oy-ft{flex:none;width:64px;height:48px;border-radius:8px;border:2px solid transparent;background:var(--surface-2) center/cover;cursor:pointer;font:inherit;font-size:11px;color:var(--ink-2)}
  .oy-ft.on{border-color:var(--accent)}
  .oy-ft:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .oy-itacs{display:flex;flex-wrap:wrap;align-items:flex-end;gap:8px}
  .oy-custo{flex:1;min-width:140px;margin:0}
  .oy-add{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:12px}
  .oy-addb{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;min-height:64px;padding:8px 4px;border-radius:var(--r-md,12px);border:1px dashed var(--line-2);background:var(--surface-2);color:var(--ink);font:inherit;font-size:12.5px;font-weight:var(--t-strong);text-align:center;line-height:1.15;cursor:pointer}
  .oy-addb svg{width:20px;height:20px}
  .oy-addb:hover{border-color:var(--accent-line);background:var(--accent-wash)}
  .oy-addb:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .oy-addf{border-style:solid;background:var(--accent);border-color:var(--accent);color:var(--accent-ink)}
  .oy-addf:hover{background:var(--accent);filter:brightness(1.06)}
  .oy-tot{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:12px}
  .oy-tot > div{background:var(--surface-2);border-radius:var(--r-md,12px);padding:10px 12px}
  .oy-tot small{display:block;color:var(--ink-3);font-size:12px}
  .oy-tot b{display:block;font-size:clamp(17px,4.4vw,22px);font-variant-numeric:tabular-nums;margin:2px 0}
  .oy-tot .oy-de{text-decoration:line-through}
  .oy-num{display:block;margin-top:12px;font-variant-numeric:tabular-nums}
  .oy-mais summary{cursor:pointer;display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;min-height:32px}
  .oy-mais summary small{color:var(--ink-3)}
  .oy-mais[open] summary{margin-bottom:12px}
  .oy-conv{margin:8px 0}
  .oy-barra{justify-content:space-between}
  .oy-fechou{border:1px solid var(--accent-line);background:var(--accent-wash)}
  .oy-kitb{display:flex;width:100%;justify-content:center;margin:4px 0 6px}
  .oy-res summary{cursor:pointer;margin-top:8px;min-height:32px}
  .oy-barra .cta{flex:none;text-decoration:none}
  /* a PLANILHA (computador): as cores da planilha dela — cabeçalho preto e ouro, faixa por dia */
  .oy-sheet{border:1px solid var(--line);border-radius:var(--r-md,12px);overflow:hidden;background:var(--surface);margin-top:4px}
  .oy-shh,.oy-row{display:grid;grid-template-columns:150px 118px minmax(0,1fr) 112px 44px;align-items:start}
  .oy-shh{background:#141414;color:#D4AF37;font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
  .oy-shh > span{padding:9px 12px}
  .oy-r{text-align:right}
  .oy-band{background:#F7E9BE;color:#1a1405;font-weight:700;font-size:13.5px;padding:7px 12px;border-top:1px solid rgba(138,109,30,.25)}
  .oy-row{border-top:1px solid var(--line)}
  .oy-row.aberto{background:var(--accent-wash)}
  .oy-c{padding:5px 4px;min-width:0}
  .oy-c input,.oy-c textarea{display:block;width:100%;min-height:38px;border:1px solid transparent;border-radius:8px;background:transparent;padding:7px 8px;font:inherit;font-size:var(--fs-3);color:var(--ink);resize:none}
  .oy-c input:hover,.oy-c textarea:hover{border-color:var(--line)}
  .oy-c input:focus,.oy-c textarea:focus{border-color:var(--accent);background:var(--surface);outline:none;box-shadow:0 0 0 3px var(--accent-wash)}
  .oy-cd input{font-size:13px;padding:7px 4px}
  .oy-ch input{font-variant-numeric:tabular-nums}
  .oy-ct{font-weight:700}
  .oy-cx{color:var(--ink-2);line-height:1.45;margin-top:2px;overflow:hidden;min-height:58px}
  .oy-cd input{color:var(--ink-3)}
  .oy-cd input:focus{color:var(--ink)}
  .oy-cvoo{display:block;padding:0 8px 4px;color:var(--ink-3);font-size:12px}
  .oy-cv input{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
  .oy-cm{display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:50%;background:none;color:var(--ink-2);font-size:20px;line-height:1;cursor:pointer}
  .oy-cm:hover,.oy-cm[aria-expanded="true"]{background:var(--surface-2);color:var(--ink)}
  .oy-cm:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .oy-rowmais{padding:10px 14px 14px;background:var(--accent-wash);border-top:1px dashed var(--accent-line)}
  .oy-custo2{min-width:0}
  /* a janela do catálogo */
  .oy-cdlg{width:min(640px,96vw)}
  .oy-cdias .chips,.oy-creg{flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}
  .oy-cdias .chip,.oy-creg .chip{white-space:nowrap;flex:none}
  .oy-busca{display:flex;align-items:center;gap:8px;border:1px solid var(--line-2);border-radius:var(--r-pill);padding:0 14px;background:var(--surface);margin:10px 0 8px;min-height:46px}
  .oy-busca svg{width:18px;height:18px;color:var(--ink-3);flex:none}
  .oy-busca input{border:0;outline:0;background:none;flex:1;min-height:44px;font:inherit}
  .oy-busca:focus-within{border-color:var(--accent)}
  .oy-clista{display:grid;gap:6px;max-height:min(52vh,460px);overflow-y:auto;margin:6px 0 10px;padding-right:2px}
  .oy-cit{display:grid;grid-template-columns:56px 1fr 36px;align-items:center;gap:12px;padding:6px;border:1px solid var(--line);border-radius:var(--r-md,12px);background:var(--surface);text-align:left;font:inherit;color:var(--ink);cursor:pointer;min-height:56px}
  .oy-cit:hover{border-color:var(--accent-line);background:var(--accent-wash)}
  .oy-cit:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .oy-cit.ja{border-color:var(--accent-line)}
  .oy-cft{width:56px;height:44px;border-radius:8px;background:var(--surface-2) center/cover}
  .oy-cnm b{display:block;font-weight:600;font-size:var(--fs-3);line-height:1.25}
  .oy-cnm small{color:var(--ink-3);font-size:12px}
  .oy-cmais{display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:var(--accent);color:var(--accent-ink)}
  .oy-cmais svg{width:18px;height:18px}
  .oy-cpe{justify-content:space-between;align-items:center}
  /* a proposta no painel */
  .pp-adbar{position:sticky;top:0;z-index:50;flex-wrap:wrap}
  .pp-adwhy{max-width:794px;margin:8px auto 10px!important;padding:0 16px!important}
  @media(max-width:600px){
    .oy-g2{grid-template-columns:1fr}
    .oy-g2:has(.oy-pax){grid-template-columns:1fr 1fr}
    .oy-g3v{grid-template-columns:1fr 1fr}
    .oy-g3v .fld:last-child{grid-column:1/-1}
    .oy-g3{grid-template-columns:1.4fr 1fr 1fr}
    .oy-vg{grid-template-columns:1fr 1fr}
    .oy-vg .fld:first-child{grid-column:1/-1}
    .oy-tot{grid-template-columns:1fr 1fr}
    .oy-tot > div:first-child{grid-column:1/-1}
    .oy-add{grid-template-columns:1fr 1fr}
    .oy-itcab{grid-template-columns:1fr auto 14px;grid-template-areas:'hr v ch' 'n n n';gap:2px 8px;padding:10px 12px}
    .oy-ithr{grid-area:hr}.oy-itv{grid-area:v}.oy-chev{grid-area:ch}.oy-itn{grid-area:n}
    .oy-itn b{white-space:normal;overflow:visible}
  }
  /* o botão do Assistente sobe acima da barra de baixo (senão um tapa o outro) */
  @media(max-width:760px){.oy-barra .cta{flex:1;text-align:center;justify-content:center}body:has(.oy-barra) #iaFab{bottom:calc(150px + env(safe-area-inset-bottom))!important}}
  @media(min-width:761px){body:has(.oy-barra) #iaFab{bottom:96px!important}}
  @media(prefers-reduced-motion:reduce){.oy-chev svg{transition:none}}`;
  document.head.appendChild(s);
}

/* o editor novo entra no lugar do antigo (admConsulta chama admOrcEditor) */
admOrcEditor = oyTela;
/* o documento antigo ("ver / imprimir PDF") agora é a proposta */
opDocOrc = (id) => go('/adm/proposta/' + id);

/* ---------- 6. o assistente monta igual: os mesmos campos e a proposta ---------- */
(function () {
  if (typeof IA_FERRAMENTAS === 'undefined' || typeof iaPlano !== 'function') return;
  const acha = (n) => IA_FERRAMENTAS.find(t => t.name === n);
  const VOO = { type: 'object', properties: { data: { type: 'string', description: 'AAAA-MM-DD' }, hora: { type: 'string', description: 'hora do voo, HH:MM' }, voo: { type: 'string' } } };
  const EXTRA = {
    hotel: { type: 'string' }, adultos: { type: 'integer' }, criancas: { type: 'integer' },
    chegada: { ...VOO, description: 'chegada do cliente: dia, hora e voo' }, partida: { ...VOO, description: 'partida: dia, hora e voo' },
    pago: { type: 'number', description: 'quanto o cliente já pagou, em USD' },
    desconto: { type: 'number' }, validade: { type: 'string', description: 'AAAA-MM-DD' },
  };
  const ITEM_EXTRA = { hora_fim: { type: 'string' }, texto: { type: 'string', description: 'o que o cliente lê sobre o serviço (passeio do catálogo já vem preenchido)' },
    incluso: { type: 'string' }, destaque: { type: 'string', description: 'ex.: manhã livre, à noite' }, voo: { type: 'string' },
    tipo: { type: 'string', enum: ['passeio', 'traslado', 'livre'] }, traslado: { type: 'string', enum: ['chegada', 'saida'], description: 'traslado de aeroporto pronto, com o texto e o voo da chegada/partida' } };
  for (const n of ['criar_orcamento', 'editar_orcamento']) {
    const t = acha(n); if (!t) continue;
    Object.assign(t.input_schema.properties, EXTRA);
    const it = t.input_schema.properties.itens && t.input_schema.properties.itens.items;
    if (it && it.properties) Object.assign(it.properties, ITEM_EXTRA);
    t.description += ' Junto: hotel, adultos, criancas, chegada e partida (dia, hora, voo), pago. TUDO EM DÓLAR (USD). Cada serviço com data e hora; passeio_id traz foto, texto e incluso do catálogo; traslado:"chegada"/"saida" monta o traslado de aeroporto.';
  }
  IA_FERRAMENTAS.push({ name: 'proposta_orcamento', description: 'Abre a PROPOSTA do orçamento (o que o cliente recebe: capa com fotos, roteiro dia a dia, investimento, condições) para ela gerar o PDF ou mandar o link no WhatsApp. Você não manda nada: só abre a tela.',
    input_schema: { type: 'object', properties: { numero: { type: 'string', description: 'número ou cliente do orçamento' } }, required: ['numero'] } });

  const campos = (o, i) => {
    const antes = oyPax(o);
    if (i.hotel != null) o.hotel = String(i.hotel);
    if (i.adultos != null) o.adultos = Math.max(0, +i.adultos || 0);
    if (i.criancas != null) o.criancas = Math.max(0, +i.criancas || 0);
    for (const k of ['chegada', 'partida']) if (i[k]) o[k] = { data: isoOk(i[k].data) ? i[k].data : ((o[k] || {}).data || ''), hora: oyHm(i[k].hora) || ((o[k] || {}).hora || ''), voo: i[k].voo || ((o[k] || {}).voo || '') };
    o.moeda = OY_MOEDA; if (i.pago != null) o.pago = +i.pago || 0; if (i.desconto != null) o.desconto = +i.desconto || 0;
    if (isoOk(i.validade)) o.validade = i.validade;
    if (i.adultos != null || i.criancas != null) { o.pax = oyPax(o); o.paxNota = oyPaxTexto(o); }
    return antes;
  };
  /* o serviço do jeito novo (foto, texto, incluso; traslado pronto) */
  const servico = (o, it) => {
    if (it.traslado) return oyTraslado(o, it.traslado === 'chegada' ? 'chegada' : 'saida');
    if (it.passeio_id && Tours.get(it.passeio_id)) return oyDoCatalogo(o, it.passeio_id, { data: isoOk(it.data) ? it.data : '', hora: oyHm(it.hora), horaFim: oyHm(it.hora_fim), pax: it.pessoas, valor: it.valor, texto: it.texto, incluso: it.incluso });
    return null;
  };
  const enriquece = (n, it) => Object.assign(n, {
    ...(it.hora_fim ? { horaFim: oyHm(it.hora_fim) } : {}), ...(it.texto ? { texto: it.texto } : {}), ...(it.incluso ? { incluso: it.incluso } : {}),
    ...(it.destaque ? { rotulo: it.destaque } : {}), ...(it.voo ? { voo: it.voo } : {}), ...(it.tipo ? { tipo: it.tipo } : {}) });

  const _plano = iaPlano;
  iaPlano = function (nome, i) {
    i = i || {};
    if (nome === 'proposta_orcamento') {
      const r = ingAchaOrc(i.numero); if (!r.o) return r;
      return { titulo: 'Abrir a proposta', assumiu: [], linhas: [['Orçamento', `${r.o.num} · ${r.o.cliente.nome || '—'}`], ['Total', oyM(Orc.total(r.o), oyMoeda(r.o))]],
        fazer: () => { go('/adm/proposta/' + r.o.id); return { ok: true, lembrete: 'a proposta está aberta na tela: ela toca em Gerar PDF ou Mandar no WhatsApp' }; } };
    }
    if (nome === 'criar_orcamento') {
      const p = _plano(nome, i); if (!p || !p.fazer) return p;
      const fazer0 = p.fazer;
      const tmp = { itens: [], adultos: i.adultos, criancas: i.criancas, pax: (+i.adultos || 0) + (+i.criancas || 0), hotel: i.hotel, chegada: i.chegada, partida: i.partida };
      if (i.hotel) p.linhas.splice(1, 0, ['Hotel', i.hotel]);
      if (i.adultos || i.criancas) p.linhas.splice(1, 0, ['Pessoas', oyPaxTexto(tmp)]);
      if (i.chegada && i.chegada.data) p.linhas.splice(1, 0, ['Viagem', `${ingData(i.chegada.data)}${i.partida && i.partida.data ? ' a ' + ingData(i.partida.data) : ''}`]);
      p.fazer = () => {
        const res = fazer0(); const o = Orc.all().find(x => x.num === res.numero); if (!o) return res;
        campos(o, i);
        /* refaz os serviços do catálogo e os traslados no formato novo (foto, texto, incluso) */
        const novos = [];
        (i.itens || []).forEach((it, k) => {
          const n = servico(o, it);
          if (n) novos.push(enriquece(n, it));
          else if (o.itens[k]) novos.push(enriquece(o.itens[k], it));
        });
        if (novos.length) o.itens = novos;
        o.moeda = OY_MOEDA;
        Orc.salva(o);
        return { ...res, lembrete: res.lembrete + '. Para o cliente: proposta_orcamento abre a proposta (PDF e link).' };
      };
      return p;
    }
    if (nome === 'editar_orcamento') {
      const r = ingAchaOrc(i.numero); if (!r.o) return r;
      const o = r.o, temNovo = Object.keys(EXTRA).some(k => i[k] != null) || (i.itens || []).some(it => it.traslado || it.texto || it.incluso || it.hora_fim || it.destaque || it.voo);
      const iBase = { ...i, itens: (i.itens || []).filter(it => !it.traslado && !(it.acao === 'adicionar' && it.passeio_id && !it.preco_ref && !it.descricao)) };
      const extras = (i.itens || []).filter(it => it.traslado || (it.acao === 'adicionar' && it.passeio_id && !it.preco_ref && !it.descricao));
      let p = (iBase.itens.length || ['cliente', 'whats', 'email', 'obs', 'bagagem', 'pessoas_nota'].some(k => i[k] != null)) ? _plano(nome, iBase) : null;
      if (p && !p.fazer) return p;
      if (!p && !temNovo && !extras.length) return { erro: 'nada para mudar' };
      p = p || { titulo: `Mudar o orçamento ${o.num}`, assumiu: [], linhas: [['Orçamento', `${o.num} · ${o.cliente.nome}`]], fazer: () => ({ ok: true, numero: o.num }) };
      if (i.hotel) p.linhas.push(['Hotel', i.hotel]);
      if (i.adultos != null || i.criancas != null) p.linhas.push(['Pessoas', oyPaxTexto({ adultos: i.adultos ?? o.adultos, criancas: i.criancas ?? o.criancas })]);
      if (i.pago != null) p.linhas.push(['Já pago', oyM(+i.pago, i.moeda || oyMoeda(o))]);
      extras.forEach(it => p.linhas.push(['Adiciona', it.traslado ? (it.traslado === 'chegada' ? 'Traslado de chegada' : 'Traslado de saída') : ((Tours.get(it.passeio_id) || { name: { pt: it.passeio_id } }).name.pt)]));
      const fazer0 = p.fazer;
      p.fazer = () => {
        const res = fazer0(); const x = Orc.get(o.id); if (!x) return res;
        const antes = campos(x, i);
        if (i.adultos != null || i.criancas != null) oyMudaPax(x, antes);
        for (const it of i.itens || []) {
          if (extras.includes(it)) { const n = servico(x, it); if (n) x.itens.push(enriquece(n, it)); continue; }
          if (it.acao === 'mudar' && (it.texto || it.incluso || it.hora_fim || it.destaque || it.voo)) {
            const s = String(it.item || '').trim();
            const alvo = /^\d+$/.test(s) ? x.itens[+s - 1] : x.itens.find(z => ingN(z.desc).includes(ingN(s)));
            if (alvo) enriquece(alvo, it);
          }
        }
        Orc.salva(x); ppRepublica(x);
        return res;
      };
      return p;
    }
    return _plano(nome, i);
  };

  /* as regras do orçamento no que o assistente lê antes de tudo */
  const _sis = iaSistema;
  iaSistema = function () {
    const b = _sis();
    b.push({ type: 'text', text: `## ORÇAMENTO E PROPOSTA (o jeito dela, desde 28/10/2026)
- Antes de criar, tenha o BÁSICO: nome do cliente, WhatsApp, quantas pessoas (adultos e crianças), hotel e os dias de chegada e partida (com hora e voo, se ela souber). Falta algum? Pergunte UMA coisa por vez — mas não trave: com nome e pessoas já dá para criar e completar depois com editar_orcamento.
- Monte o roteiro DIA A DIA: cada serviço com data e hora. Passeio do catálogo SEMPRE com passeio_id (de ver_passeios): traz preço, foto, texto e incluso. Traslado de aeroporto: item com traslado:"chegada" ou "saida" (pega o voo e o hotel). O resto: descricao + texto.
- Moeda: SOMENTE DÓLAR (USD), sempre. Nunca escreva valor em dirham, real ou euro. Os valores dos serviços são SEM imposto: o app soma 5% de VAT no fim sozinho (nunca some de novo). Total e por pessoa saem sozinhos.
- Depois de criar ou mudar, ofereça em uma linha: "Quer que eu abra a proposta para gerar o PDF ou mandar o link?" → proposta_orcamento. Quem manda é ela.` });
    return b;
  };
})();

/* abriu direto num destes endereços (link da proposta, editor, proposta no painel):
   o route() do começo rodou antes deste arquivo existir — desenha de novo */
if (typeof pubRotaDe === 'function' && pubRotaDe()) route();
else if (/^#\/adm\/(consulta\/[^/]+|proposta\/)/.test(location.hash)) route();
