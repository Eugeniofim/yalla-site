/* =====================================================
   OPERACAO — os dados do dia a dia da Ingrid

   Nasceu do pedido de 28/09/2026 (brainstorm "EM roma" + a reuniao do Meet).
   Ela nao e mais a guia: ela AGENCIA. Tem guias e motoristas na Italia
   toda, recebe um sinal e o resto e pago no dia, em dinheiro, para quem
   faz o servico. E recebe em varias contas, no Brasil e na Europa, com um
   contador em cada lado.

   Este arquivo e so a camada de dados — nada de tela. Da para testar sem
   navegador (testes/operacao.test.js). As telas estao em operacao-telas.js.

   Colecoes novas no DB (so no aparelho enquanto nao houver banco; quando
   houver, vao para tabelas PRIVADAS, nunca para o "appstate", que e
   publico):
     DB.equipe     [{id, nome, tipo:'guia'|'motorista', whats, cidades[], idiomas, obs, pref}]
     DB.disp       [{pessoaId, data, turno, estado:'livre'|'ocupada', nota, em}]
     DB.contas     [{id, nome, pais:'brasil'|'europa', metodo}]
     DB.orcamentos [{id, num, criado, status, origem, pedidoId, cliente{}, itens[], ...}]
     DB.fichas     {chaveDoCliente: {notas, tags}}
   E na reserva (Booking), os campos da operacao:
     voo, origem, destino, obsOp, prestadorId, restoPara:'prestador'|'ingrid',
     custo, acertado
   ===================================================== */
'use strict';

/* ---------- turnos ----------
   Ela pensa em MANHA e TARDE ("bloquear a parte da manha ou a parte da
   tarde quando ela ja me fala: nao posso, ja to ocupada"). A noite existe
   porque ha passeio noturno as 19h30. "Dia inteiro" e so um atalho que
   marca os tres. */
const TURNOS = [['manha', 'Manhã', 'Morning'], ['tarde', 'Tarde', 'Afternoon'], ['noite', 'Noite', 'Evening']];
function turnoNome(tu) {
  if (tu === 'dia') return (typeof LANG !== 'undefined' && LANG === 'en') ? 'All day' : 'Dia inteiro';
  const r = TURNOS.find(x => x[0] === tu);
  return r ? ((typeof LANG !== 'undefined' && LANG === 'en') ? r[2] : r[1]) : tu;
}
function turnoDaHora(h) {
  const m = String(h || '').match(/(\d{1,2})/);
  const n = m ? +m[1] : 9;
  return n < 13 ? 'manha' : n < 18 ? 'tarde' : 'noite';
}
/* Um bate e volta ocupa o dia; um passeio de 3h ocupa o turno em que comeca.
   Um de 4h que comeca as 11h entra pela tarde — conta os dois. */
function turnosDoServico(b) {
  const x = typeof Tours !== 'undefined' ? Tours.get(b.tourId) : null;
  if (x && (x.type === 'day' || x.type === 'conexao')) return ['manha', 'tarde'];
  const t0 = turnoDaHora(b.time);
  const hIni = parseInt(String(b.time || '').match(/(\d{1,2})/)?.[1] || '9', 10);
  const dur = parseInt(String((x && x.duration) || '').match(/(\d+)\s*h/)?.[1] || '0', 10);
  if (t0 === 'manha' && dur && hIni + dur > 13) return ['manha', 'tarde'];
  return [t0];
}

/* ---------- guias e motoristas ---------- */
function _opSave() {
  localStorage.setItem(DB_KEY, JSON.stringify(DB));
  /* a linha que mudou sobe para o banco em ~1 s (nuvem-itens.js) */
  if (typeof itAgendar === 'function') itAgendar();
}
function _opSaveBooking(b) {
  _opSave();
  if (b && typeof cloudUpdateBooking === 'function') cloudUpdateBooking(b);
}
const Equipe = {
  /* na ordem de preferencia dela: "eu pego sempre as melhores primeiro" */
  all(tipo) {
    return [...(DB.equipe || [])]
      .filter(p => !tipo || p.tipo === tipo)
      .sort((a, b) => (a.pref || 0) - (b.pref || 0));
  },
  get(id) { return (DB.equipe || []).find(p => p.id === id) || null; },
  salva(p) {
    DB.equipe = DB.equipe || [];
    const limpa = (v) => String(v || '').trim();
    const dados = {
      nome: limpa(p.nome), tipo: p.tipo === 'motorista' ? 'motorista' : 'guia',
      whats: limpa(p.whats), idiomas: limpa(p.idiomas), obs: limpa(p.obs),
      cidades: (Array.isArray(p.cidades) ? p.cidades : String(p.cidades || '').split(','))
        .map(limpa).filter(Boolean),
    };
    if (!dados.nome) return null;
    let x = p.id && Equipe.get(p.id);
    if (x) Object.assign(x, dados);
    else {
      const ult = Math.max(0, ...DB.equipe.map(q => q.pref || 0));
      x = { id: uid(), pref: ult + 1, ...dados };
      DB.equipe.push(x);
    }
    _opSave();
    return x;
  },
  remove(id) {
    DB.equipe = (DB.equipe || []).filter(p => p.id !== id);
    DB.disp = (DB.disp || []).filter(d => d.pessoaId !== id);
    for (const b of DB.bookings) if (b.prestadorId === id) { b.prestadorId = ''; }
    _opSave();
  },
  /* sobe ou desce na ordem de preferencia, dentro do mesmo tipo */
  move(id, dir) {
    const p = Equipe.get(id); if (!p) return;
    const lista = Equipe.all(p.tipo);
    const i = lista.findIndex(q => q.id === id), j = i + (dir < 0 ? -1 : 1);
    if (j < 0 || j >= lista.length) return;
    const tmp = lista[i].pref; lista[i].pref = lista[j].pref; lista[j].pref = tmp;
    if (lista[i].pref === lista[j].pref) lista[j].pref += dir < 0 ? 1 : -1;
    _opSave();
  },
  cidades() {
    const s = new Set();
    for (const p of DB.equipe || []) for (const c of p.cidades || []) s.add(c);
    return [...s].sort((a, b) => a.localeCompare(b));
  },
  atende(p, cidade) {
    if (!cidade) return true;
    const n = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    return (p.cidades || []).some(c => n(c) === n(cidade));
  },
};

/* ---------- disponibilidade ----------
   Ela nao tem a agenda das guias ("elas fazem tudo a mao no papel"). O que
   existe e o que cada uma RESPONDEU: livre ou ocupada, por dia e turno.
   E o servico que ela mesma ja passou para a guia tambem ocupa — esse o
   app sabe sozinho, sem ela marcar nada. */
const Disp = {
  _linha(pessoaId, data, turno) {
    return (DB.disp || []).find(d => d.pessoaId === pessoaId && d.data === data && d.turno === turno);
  },
  /* {estado:'ocupada'|'livre'|'', servico?, nota?} */
  estado(pessoaId, data, turno) {
    const b = DB.bookings.find(x => x.prestadorId === pessoaId && x.date === data
      && x.status !== 'cancelled' && turnosDoServico(x).includes(turno));
    if (b) return { estado: 'ocupada', servico: b };
    const l = Disp._linha(pessoaId, data, turno);
    return l ? { estado: l.estado, nota: l.nota || '' } : { estado: '' };
  },
  /* estado '' apaga a resposta (volta a "nao perguntei") */
  marca(pessoaId, data, turno, estado, nota) {
    DB.disp = DB.disp || [];
    const turnos = turno === 'dia' ? TURNOS.map(x => x[0]) : [turno];
    for (const tu of turnos) {
      DB.disp = DB.disp.filter(d => !(d.pessoaId === pessoaId && d.data === data && d.turno === tu));
      if (estado) DB.disp.push({ pessoaId, data, turno: tu, estado, nota: String(nota || '').trim(), em: new Date().toISOString() });
    }
    _opSave();
  },
  /* "dia 25/10 de manha, que guia de Roma esta livre?" — por preferencia.
     Volta todo mundo, separado em livres, sem resposta e ocupadas: a que
     nao respondeu ainda pode ser a melhor opcao, e ela decide. */
  quem({ data, turno, cidade, tipo }) {
    const turnos = turno === 'dia' ? ['manha', 'tarde'] : [turno];
    const gente = Equipe.all(tipo || 'guia').filter(p => Equipe.atende(p, cidade));
    const livres = [], semResposta = [], ocupadas = [];
    for (const p of gente) {
      const es = turnos.map(tu => Disp.estado(p.id, data, tu));
      const ocup = es.find(e => e.estado === 'ocupada');
      if (ocup) ocupadas.push({ p, ...ocup });
      else if (es.every(e => e.estado === 'livre')) livres.push({ p, estado: 'livre', nota: es.map(e => e.nota).filter(Boolean).join(' · ') });
      else semResposta.push({ p, estado: '' });
    }
    return { livres, semResposta, ocupadas };
  },
};

/* ---------- a reserva vista pela operacao ---------- */
const Op = {
  /* Quem recebe o resto. O caso mais comum dela: sinal na reserva e o resto
     NO DIA, em dinheiro, para a guia ou o motorista. Transfer ja nasce
     assim (politica 'sinal'). Quando ela recebe tudo (agencia, cliente que
     "nao quer tocar em dinheiro"), o resto e com ela. */
  restoPara(b) {
    if (b.restoPara === 'prestador' || b.restoPara === 'ingrid') return b.restoPara;
    /* o cliente decide (conteudo.js): na EmRoma o resto e pago no dia a quem faz;
       na Yalla o cliente paga tudo a ela (plataforma ou conta) */
    const noDia = !(typeof CONTEUDO !== 'undefined' && CONTEUDO.restoNoDiaPadrao === false);
    return b.policy === 'sinal' && noDia ? 'prestador' : 'ingrid';
  },
  /* O caso da semana da reuniao: "Ingrid, o cliente quer pagar 35". Eram 70.
     Esta e a linha que responde isso sem abrir planilha. */
  noDia(b) {
    const falta = Bookings.due(b);
    if (b.status === 'cancelled' || falta <= 0) return { valor: 0, para: '', pessoa: null };
    const para = Op.restoPara(b);
    return { valor: falta, para, pessoa: b.prestadorId ? Equipe.get(b.prestadorId) : null };
  },
  escala(bookingId, pessoaId) {
    const b = Bookings.get(bookingId); if (!b) return null;
    b.prestadorId = pessoaId || '';
    _opSaveBooking(b);
    return b;
  },
  /* voo, onde buscar, para onde, observacao, quem faz, custo, quem recebe */
  detalhes(bookingId, d) {
    const b = Bookings.get(bookingId); if (!b) return null;
    const campos = ['voo', 'origem', 'destino', 'obsOp'];
    for (const k of campos) if (d[k] !== undefined) b[k] = String(d[k] || '').trim();
    if (d.prestadorId !== undefined) b.prestadorId = d.prestadorId || '';
    if (d.custo !== undefined) b.custo = Math.max(0, +d.custo || 0);
    if (d.restoPara !== undefined) b.restoPara = d.restoPara === 'prestador' ? 'prestador' : d.restoPara === 'ingrid' ? 'ingrid' : '';
    _opSaveBooking(b);
    return b;
  },
  /* Os links que ficam no servico, como na ficha dela: PDF do ingresso, QR
     code, voucher do parceiro (ela guarda no Drive e cola o link aqui). */
  linkAdd(bookingId, nome, url) {
    const b = Bookings.get(bookingId); if (!b) return null;
    const u = String(url || '').trim(); if (!/^https?:\/\//i.test(u)) return { erro: 'o link precisa começar com http' };
    b.links = b.links || []; const l = { id: uid(), nome: String(nome || '').trim() || 'link', url: u };
    b.links.push(l); _opSaveBooking(b); return l;
  },
  linkRemove(bookingId, linkId) { const b = Bookings.get(bookingId); if (!b) return; b.links = (b.links || []).filter(l => l.id !== linkId); _opSaveBooking(b); },
  /* ingressos: precisa? ja comprou? (servico com ingresso na tabela do passeio) */
  precisaIngresso(b) { const x = Tours.get(b.tourId); return !!((x && (x.ingressos || []).length) || (b.ingressos && (b.ingressos.total || b.ingressos.totalDia))); },
  ingressosOk(bookingId, sim) { const b = Bookings.get(bookingId); if (!b) return; b.ingressosOk = sim ? isoToday() : ''; _opSaveBooking(b); },
  /* servicos sem guia/motorista nos proximos N dias */
  semPrestador(dias) {
    const hoje = isoToday(), ate = addDays(hoje, dias || 7);
    return DB.bookings.filter(b => b.status !== 'cancelled' && !b.prestadorId && b.date >= hoje && b.date <= ate)
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  },
  doDia(data) {
    return DB.bookings.filter(b => b.status !== 'cancelled' && b.date === data)
      .sort((a, b) => String(a.time).localeCompare(String(b.time)));
  },
  /* Emergencia: "o cliente chegou e nao acha o motorista". Ela digita um
     pedaco do nome, o voo ou o codigo e acha em segundos. */
  busca(q) {
    const n = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const s = n(q).trim(); if (s.length < 2) return [];
    const dig = s.replace(/\D/g, '');
    return DB.bookings.filter(b => {
      if ([b.name, b.code, b.voo, b.origem, b.destino, b.email].some(v => n(v).includes(s))) return true;
      if (dig.length >= 4 && String(b.whats || '').replace(/\D/g, '').includes(dig)) return true;
      return (b.group || []).some(g => n(g.nome).includes(s));
    }).sort((a, b) => Math.abs(new Date(a.date) - new Date(isoToday())) - Math.abs(new Date(b.date) - new Date(isoToday())));
  },
};

/* ---------- contas e pagamentos ----------
   Ela recebe em Nubank (Brasil), Wise Brasil, Wise Europa, Revolut, link de
   cartao (Europa), em dinheiro, e numa conta separada quando ela mesma
   acompanha. Na hora de registrar ela escolhe a conta; a conta sabe de que
   lado do oceano esta, e cada contador recebe so o dele. */
const CONTA_PRESTADOR = 'prestador';
/* os dois lados do caixa: nome e bandeira do cliente (config.js / conteudo.js) */
function ladoNome(k) {
  const c = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.lados) || {};
  return c[k] || (k === 'brasil' ? 'Brasil' : 'Europa');
}
function ladoBandeira(k) {
  const b = (typeof CONTEUDO !== 'undefined' && CONTEUDO.bandeiras) || {};
  return b[k] || (k === 'brasil' ? '🇧🇷' : '🇪🇺');
}
/* a cidade-base do cliente (Dubai, Roma…) */
function baseNome() { return (typeof CONTEUDO !== 'undefined' && CONTEUDO.base && CONTEUDO.base.nome) || ''; }
function contasPadrao() {
  return ((typeof CONTEUDO !== 'undefined' && CONTEUDO.contas) || []).map(c => Object.assign({}, c));
}
const Contas = {
  all() { return DB.contas || []; },
  get(id) { return (DB.contas || []).find(c => c.id === id) || null; },
  salva(c) {
    DB.contas = DB.contas || [];
    const nome = String(c.nome || '').trim(); if (!nome) return null;
    const dados = { nome, pais: c.pais === 'brasil' ? 'brasil' : 'europa', metodo: c.metodo || 'transfer' };
    let x = c.id && Contas.get(c.id);
    if (x) Object.assign(x, dados); else { x = { id: uid(), ...dados }; DB.contas.push(x); }
    _opSave(); return x;
  },
  remove(id) { DB.contas = (DB.contas || []).filter(c => c.id !== id); _opSave(); },
  nome(id) {
    if (id === CONTA_PRESTADOR) return (typeof LANG !== 'undefined' && LANG === 'en') ? 'Paid on the day to the guide/driver' : 'Pago no dia ao guia/motorista';
    const c = Contas.get(id); return c ? c.nome : '';
  },
};
/* De que lado cai o pagamento. Pagamento antigo, sem conta, segue a regra
   de antes (Pix = Brasil, o resto = Europa). 'prestador' nao e dela: e o
   dinheiro que a guia recebeu na mao — nao entra em contabilidade nenhuma. */
function ladoDoPagamento(p) {
  if (p.conta === CONTA_PRESTADOR) return 'prestador';
  const c = p.conta && Contas.get(p.conta);
  if (c) return c.pais;
  const BR = (typeof CONTEUDO !== 'undefined' && CONTEUDO.metodosBrasil) || ['pix'];
  return BR.includes(String(p.method || '').toLowerCase()) ? 'brasil' : 'europa';
}
/* Registrar um pagamento de qualquer valor — o sinal, uma parte, o resto.
   O antigo "recebi o saldo" so sabia dar baixa no total. */
function registraPagamento(bookingId, { valor, conta, data }) {
  const b = Bookings.get(bookingId); if (!b) return null;
  const falta = Bookings.due(b);
  const v = Math.round(Math.min(Math.max(0, +valor || 0), falta) * 100) / 100;
  if (v <= 0) return null;
  const pago = Bookings.paid(b);
  const kind = (pago === 0 && v >= b.total) ? 'full' : (v >= falta ? 'balance' : 'deposit');
  const c = Contas.get(conta);
  const method = conta === CONTA_PRESTADOR ? 'cash' : (c ? c.metodo : 'other');
  const p = { amount: v, date: data || isoToday(), method, kind, conta: conta || '' };
  b.payments.push(p);
  if (conta === CONTA_PRESTADOR) b.restoPara = 'prestador';
  _opSaveBooking(b);
  return p;
}
/* Extrato por conta: o que caiu em cada uma no periodo */
function extratoContas(de, ate) {
  const linhas = [];
  for (const b of DB.bookings) {
    for (const p of b.payments || []) {
      if (p.date < de || p.date > ate) continue;
      linhas.push({ date: p.date, client: b.name, tourId: b.tourId, code: b.code, bookingId: b.id,
                    amount: p.amount, kind: p.kind, method: p.method, conta: p.conta || '',
                    lado: ladoDoPagamento(p) });
    }
  }
  return linhas.sort((a, b) => a.date.localeCompare(b.date));
}
/* O acerto com cada guia/motorista. custo = o que ela paga a pessoa pelo
   servico. Se a pessoa recebeu o resto do cliente no dia, isso ja conta como
   pagamento a ela; a diferenca e o acerto (positivo: Ingrid paga; negativo:
   a guia devolve a Ingrid). */
function acertos(de, ate) {
  const out = [];
  for (const b of DB.bookings) {
    if (b.status === 'cancelled' || !b.prestadorId || b.date < de || b.date > ate) continue;
    const custo = +b.custo || 0;
    const noDiaRecebido = (b.payments || []).filter(p => p.conta === CONTA_PRESTADOR).reduce((s, p) => s + p.amount, 0);
    const aReceberNoDia = Op.restoPara(b) === 'prestador' ? Bookings.due(b) : 0;
    const comPrestador = noDiaRecebido + aReceberNoDia;
    if (!custo && !comPrestador) continue;
    out.push({ b, pessoa: Equipe.get(b.prestadorId), custo, comPrestador, saldo: custo - comPrestador, acertado: !!b.acertado });
  }
  return out.sort((a, b) => a.b.date.localeCompare(b.b.date));
}
function marcaAcertado(bookingId, sim) {
  const b = Bookings.get(bookingId); if (!b) return;
  b.acertado = sim ? isoToday() : '';
  _opSaveBooking(b);
}

/* ---------- ficha do cliente ----------
   A mesma chave que Clients.all() usa, para a ficha achar tudo dele. */
function chaveCliente(b) { return String(b.email || b.whats || b.name || '').toLowerCase(); }
const Fichas = {
  get(k) { DB.fichas = DB.fichas || {}; return DB.fichas[k] || { notas: '', tags: '' }; },
  salva(k, d) {
    DB.fichas = DB.fichas || {};
    DB.fichas[k] = { notas: String(d.notas || ''), tags: String(d.tags || ''), em: new Date().toISOString() };
    _opSave();
  },
  reservas(k) {
    return DB.bookings.filter(b => chaveCliente(b) === k)
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  },
  /* pedidos e orcamentos do mesmo cliente: pelo WhatsApp ou pelo e-mail */
  doCliente(k, whats, email) {
    const w = String(whats || '').replace(/\D/g, '');
    const bate = (x) => {
      const xw = String(x.whats || '').replace(/\D/g, '');
      return (w.length >= 6 && xw && xw.endsWith(w.slice(-8))) || (email && x.email && x.email.toLowerCase() === email.toLowerCase());
    };
    return {
      pedidos: (DB.pedidos || []).filter(bate),
      orcamentos: (DB.orcamentos || []).filter(o => o.clienteKey === k || bate(o.cliente || {})),
    };
  },
};

/* ---------- sob consulta: orcamentos ----------
   O cliente pede varias coisas (transfer, passeio em Roma, passeio em
   Florenca, transfer de saida em Milao). Vira UM orcamento. O app deixa o
   rascunho pronto; ELA confere e manda — nada sai sozinho para o cliente
   ("eu supervisiono tudo que ela ta fazendo antes de mandar"). */
const ORC_STATUS = [
  ['novo', 'Novo', 'New'], ['rascunho', 'Em montagem', 'Drafting'], ['enviado', 'Enviado', 'Sent'],
  ['fechado', 'Fechou', 'Won'], ['perdido', 'Não fechou', 'Lost'],
];
const Orc = {
  all() { return [...(DB.orcamentos || [])].sort((a, b) => (b.criado || '').localeCompare(a.criado || '')); },
  get(id) { return (DB.orcamentos || []).find(o => o.id === id) || null; },
  cria(d) {
    DB.orcamentos = DB.orcamentos || [];
    const n = DB.orcamentos.reduce((m, o) => Math.max(m, +String(o.num || '').replace(/\D/g, '') || 0), 0) + 1;
    const o = {
      id: uid(), num: 'ORC-' + String(n).padStart(4, '0'), criado: new Date().toISOString(),
      status: d.status || 'novo', origem: d.origem || 'manual', pedidoId: d.pedidoId || '',
      cliente: { nome: String((d.cliente && d.cliente.nome) || '').trim(), whats: String((d.cliente && d.cliente.whats) || '').trim(),
                 email: String((d.cliente && d.cliente.email) || '').trim() },
      clienteKey: d.clienteKey || '',
      itens: (d.itens || []).map(Orc._item),
      sinalPct: d.sinalPct != null ? +d.sinalPct : 30,
      validade: d.validade || addDays(isoToday(), 7),
      obs: String(d.obs || ''), resumo: String(d.resumo || ''), conversa: String(d.conversa || ''),
      pax: +d.pax || 0, datas: d.datas || [],
      termos: d.termos !== false, bookingIds: [],
    };
    DB.orcamentos.push(o); _opSave(); return o;
  },
  _item(i) {
    return { id: i.id || uid(), tourId: i.tourId || '', desc: String(i.desc || '').trim(),
             data: i.data || '', hora: i.hora || '', pax: Math.max(1, +i.pax || 1), opcao: +i.opcao || 0,
             valor: Math.max(0, +i.valor || 0), sinal: i.sinal != null && i.sinal !== '' ? Math.max(0, +i.sinal) : null,
             obs: String(i.obs || '').trim(), sugestao: !!i.sugestao, voo: String(i.voo || '').trim(),
             custo: Math.max(0, +i.custo || 0), cidade: String(i.cidade || '').trim() };
  },
  /* um servico do catalogo, ja com o preco da tabela dela para aquele grupo */
  itemDoCatalogo(tourId, { pax, data, hora, opcao } = {}) {
    const x = Tours.get(tourId); if (!x) return null;
    const h = hora || (DB.rules.find(r => r.tourId === tourId) || {}).time || '09:00';
    const pr = Bookings.precoDe(x, tourId, data || isoToday(), h, Math.max(1, +pax || 1), { opcao: +opcao || 0 });
    return Orc._item({ tourId, desc: x.name.pt, data: data || '', hora: h, pax, opcao,
                       valor: pr.total || 0, sinal: x.priceMode === 'transfer' ? (pr.sinal || null) : null,
                       obs: pr.consultar ? 'Sem preço na tabela — defina o valor' : '' });
  },
  total(o) { return (o.itens || []).reduce((s, i) => s + (+i.valor || 0), 0); },
  sinalDoItem(o, i) {
    return i.sinal != null ? +i.sinal : Math.round((+i.valor || 0) * (+o.sinalPct || 0) / 100);
  },
  sinal(o) { return (o.itens || []).reduce((s, i) => s + Orc.sinalDoItem(o, i), 0); },
  salva(o) {
    const x = Orc.get(o.id); if (!x) return null;
    Object.assign(x, o, { itens: (o.itens || x.itens).map(Orc._item) });
    _opSave(); return x;
  },
  status(id, st) { const o = Orc.get(id); if (!o) return; o.status = st; _opSave(); },
  linkAdd(id, nome, url) {
    const o = Orc.get(id); if (!o) return null;
    const u = String(url || '').trim(); if (!/^https?:\/\//i.test(u)) return { erro: 'o link precisa começar com http' };
    o.links = o.links || []; const l = { id: uid(), nome: String(nome || '').trim() || 'link', url: u }; o.links.push(l); _opSave(); return l;
  },
  /* o nome do arquivo como ela ja usa: "2026_05_26 Jo Souza" */
  nomeArquivo(o) { if (o.arquivo) return o.arquivo; const d = (o.itens.map(i => i.data).filter(Boolean).sort()[0] || String(o.criado).slice(0, 10)).replace(/-/g, '_'); return `${d} ${o.cliente.nome || 'Cliente'}`; },
  remove(id) { DB.orcamentos = (DB.orcamentos || []).filter(o => o.id !== id); _opSave(); },
  /* Fechou: cada servico do catalogo vira uma reserva de verdade, com o
     cliente e o sinal. Item avulso (sem servico do catalogo) fica so no
     orcamento — ela lanca a parte, se quiser. */
  fecha(id, { sinalRecebido, conta } = {}) {
    const o = Orc.get(id); if (!o || o.status === 'fechado') return [];
    const criadas = [];
    for (const i of o.itens) {
      /* do catalogo, ou escrito a mao com data (a planilha dela) */
      const avulso = !(i.tourId && Tours.get(i.tourId));
      if (avulso && (!i.data || !String(i.desc || '').trim() || i.sugestao)) continue;
      const b = Bookings.criarManual({
        tourId: avulso ? tourAvulso(RE_TRANSFER.test(i.desc) ? 'transfer' : 'servico') : i.tourId, date: i.data || isoToday(), time: i.hora || '09:00',
        name: o.cliente.nome || 'Cliente', whats: o.cliente.whats, email: o.cliente.email,
        pax: i.pax, total: i.valor, recebido: 0, veioPor: o.veioPor || '',
      });
      b.origin = 'orcamento'; b.orcamentoId = o.id;
      if (avulso) b.servicoTxt = String(i.desc).trim();
      Object.assign(b, { indicou: o.indicou || '', parceiroTxt: o.parceiroTxt || '', arquivo: Orc.nomeArquivo(o), links: [...(o.links || [])] });
      if (i.cidade) b.destino = i.cidade;
      /* o resto e pago no dia a quem faz o servico — o caso mais comum dela */
      b.policy = 'sinal'; b.sinal = Orc.sinalDoItem(o, i);
      if (i.obs && !i.sugestao) b.obsOp = i.obs;
      if (i.voo) b.voo = i.voo;
      if (+i.custo > 0) b.custo = +i.custo;
      _opSaveBooking(b);
      if (sinalRecebido && b.sinal > 0) registraPagamento(b.id, { valor: b.sinal, conta });
      criadas.push(b);
    }
    o.status = 'fechado'; o.bookingIds = criadas.map(b => b.id); o.fechadoEm = isoToday();
    _opSave();
    return criadas;
  },
};

/* ---------- ler uma conversa colada do WhatsApp ----------
   Enquanto a Meta nao libera o numero, ela cola a conversa e o app tira o
   que importa: nome, telefone, datas, quantas pessoas, cidades, servicos.
   E o mesmo "apanhador de informacoes" que ela pediu — so que ela cola em
   vez de o robo ler sozinho. Nunca responde nada. */
const CONV_CIDADES = (typeof CONTEUDO !== 'undefined' && CONTEUDO.conversa && CONTEUDO.conversa.cidades) || [];
const CONV_SERVICOS = (typeof CONTEUDO !== 'undefined' && CONTEUDO.conversa && CONTEUDO.conversa.servicos) || [];
/* o servico de transfer do catalogo (o rascunho do orcamento usa) */
const TRANSFER_PADRAO = (typeof CONTEUDO !== 'undefined' && CONTEUDO.transfer && CONTEUDO.transfer.servicoPadrao) || 'transfer-aeroporto';
const MESES_PT = ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
function _isoDe(d, m, y) {
  const hoje = isoToday();
  let ano = y ? (+y < 100 ? 2000 + +y : +y) : +hoje.slice(0, 4);
  const iso = (a) => `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  if (!(+m >= 1 && +m <= 12 && +d >= 1 && +d <= 31)) return '';
  /* data sem ano que ja passou e do ano que vem */
  if (!y && iso(ano) < hoje) ano += 1;
  return iso(ano);
}
function lerConversa(txt) {
  const bruto = String(txt || '');
  const low = bruto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  /* quem escreveu: "[05/10/26 14:32] Maria Silva: oi" ou "05/10/2026 14:32 - Maria Silva: oi" */
  let nome = '';
  const nomeDono = String((typeof guiaNome === 'function' && guiaNome()) || '').toLowerCase();
  const reAutor = /^(?:\[[^\]]+\]\s*|\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}\s*-\s*)([^:\n]{2,40}):/gm;
  let m;
  while ((m = reAutor.exec(bruto))) {
    const quem = m[1].trim();
    if (nomeDono && quem.toLowerCase().includes(nomeDono)) continue;
    const neg = String((typeof guiaNegocio === 'function' && guiaNegocio()) || '').toLowerCase();
    if (neg && quem.toLowerCase().includes(neg)) continue;
    if (/^\+?[\d\s()-]+$/.test(quem)) continue;
    nome = quem; break;
  }
  if (!nome) { const mm = bruto.match(/(?:meu nome [eé]|me chamo|sou (?:a|o))\s+([A-ZÀ-Ú][\wÀ-ú]+(?:\s+[A-ZÀ-Ú][\wÀ-ú]+)?)/); if (mm) nome = mm[1]; }
  const tel = (bruto.match(/\+\d[\d\s().-]{8,}\d/) || [''])[0].replace(/[^\d+]/g, '');
  /* datas: 5/10, 05/10/2026, "5 de outubro" — tirando as marcas de hora do proprio WhatsApp */
  const semCarimbo = bruto.replace(/^\[[^\]]+\]/gm, '').replace(/^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}\s*-/gm, '');
  const datas = new Set();
  for (const d of semCarimbo.matchAll(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/g)) { const i = _isoDe(d[1], d[2], d[3]); if (i) datas.add(i); }
  const semCarLow = semCarimbo.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  for (const d of semCarLow.matchAll(/\b(\d{1,2})\s+de\s+([a-z]+)/g)) {
    const mi = MESES_PT.indexOf(d[2]); if (mi >= 0) { const i = _isoDe(d[1], mi + 1); if (i) datas.add(i); }
  }
  const num = (re) => { const x = low.match(re); return x ? +x[1] : 0; };
  /* "somos 4 pessoas (2 adultos e 2 criancas)": o total e 4, nao 6 */
  const pessoas = num(/(\d{1,2})\s*(?:pessoas|pax|people)/);
  const adultos = num(/(\d{1,2})\s*(?:adultos?|adults?)/);
  const criancas = num(/(\d{1,2})\s*(?:criancas?|filhos?|kids?|children)/);
  const pax = pessoas || (adultos + criancas) || (/\b(casal|eu e (meu|minha))\b/.test(low) ? 2 : 0);
  const cidades = CONV_CIDADES.filter(([, re]) => re.test(low)).map(([c]) => c);
  const servicos = CONV_SERVICOS.filter(([, re]) => re.test(low)).map(([s]) => s);
  const chegada = /chegada|chego|chegamos|desembarc|pousa|aterriss/.test(low);
  /* "volta" sozinho pegava o "bate e volta" e inventava um transfer de saida */
  const partida = /partida|saida|embarque|vou embora|vamos embora|voo de volta|volta(?:mos)? (?:ao|para o) (?:brasil|aeroporto)/.test(low);
  const voo = (bruto.match(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})\b/) || [])[0] || '';
  const partes = [];
  if (datas.size) partes.push([...datas].sort().map(d => d.slice(8, 10) + '/' + d.slice(5, 7)).join(', '));
  if (pax) partes.push(pax + (criancas ? ` pessoas (${criancas} criança${criancas > 1 ? 's' : ''})` : ' pessoas'));
  if (cidades.length) partes.push(cidades.join(', '));
  if (servicos.length) partes.push(servicos.map(s => s === 'transfer'
    ? 'transfer' + (chegada && partida ? ' (chegada e partida)' : chegada ? ' (chegada)' : partida ? ' (partida)' : '')
    : ((typeof Tours !== 'undefined' && Tours.get(s)) ? Tours.get(s).name.pt : s)).join(', '));
  if (voo) partes.push('voo ' + voo);
  return { nome, whats: tel, datas: [...datas].sort(), adultos, criancas, pax, cidades, servicos, chegada, partida, voo,
           resumo: partes.join(' · ') };
}
/* O rascunho: cada servico reconhecido vira um item com o preco da tabela.
   Marcado como SUGESTAO — e ela quem confere antes de mandar. */
function rascunhoDaConversa(c) {
  const itens = [];
  const pax = c.pax || 2;
  const datas = c.datas || [];
  /* Uma data so costuma ser a CHEGADA: os passeios vao para os dias
     seguintes, um por dia. Com varias datas, segue a ordem delas. */
  let di = 0;
  const proxData = () => {
    /* duas datas = chegada e partida: um passeio por dia entre elas */
    if (datas.length === 2 && c.chegada !== false) {
      const d = addDays(datas[0], ++di);
      return d < datas[1] ? d : addDays(datas[1], -1) > datas[0] ? addDays(datas[1], -1) : datas[1];
    }
    if (datas.length > 1) return datas[Math.min(++di, datas.length - 1)];
    return datas[0] ? addDays(datas[0], ++di) : '';
  };
  for (const s of c.servicos || []) {
    if (s === 'transfer') {
      if (c.chegada || !c.partida) { const it = Orc.itemDoCatalogo(TRANSFER_PADRAO, { pax, data: datas[0] || '' }); if (it) { it.sugestao = true; it.desc += ' — chegada'; it.voo = c.voo || ''; itens.push(it); } }
      if (c.partida) { const it = Orc.itemDoCatalogo(TRANSFER_PADRAO, { pax, data: datas[datas.length - 1] || '' }); if (it) { it.sugestao = true; it.desc += ' — partida'; itens.push(it); } }
      continue;
    }
    const it = Orc.itemDoCatalogo(s, { pax, data: proxData() });
    if (it) { it.sugestao = true; itens.push(it); }
  }
  return itens;
}
/* Do questionario "Monte a sua experiencia" para um rascunho: o que ela
   ofereceria para quem gosta de cada coisa, e o transfer se pediu. O mapa
   (gosto -> passeio, lugar -> passeio) mora em conteudo.js. */
function rascunhoDoRoteiro(ped) {
  const R = (typeof CONTEUDO !== 'undefined' && CONTEUDO.roteiro) || {};
  const itens = [];
  const pax = (+ped.adultos || 1) + (+ped.criancas || 0);
  let dia = ped.ini || '';
  const prox = () => { const d = dia; if (dia) dia = addDays(dia, 1); return d; };
  const poe = (id) => { const it = Orc.itemDoCatalogo(id, { pax, data: prox() }); if (it) { it.sugestao = true; itens.push(it); } };
  if ((ped.precisa || []).includes('transfer')) {
    const it = Orc.itemDoCatalogo(TRANSFER_PADRAO, { pax, data: ped.ini || '' });
    if (it) { it.sugestao = true; it.desc += ' — chegada'; itens.push(it); }
  }
  const vistos = new Set();
  for (const g of ped.gosto || []) {
    const id = (R.sugestao || {})[g];
    if (id && !vistos.has(id) && Tours.get(id)) { vistos.add(id); poe(id); continue; }
    const livre = (R.gostoLivre || {})[g];
    if (livre) itens.push(Orc._item({ desc: livre, pax, data: '', valor: 0, sugestao: true, obs: 'Defina o valor' }));
  }
  for (const o of ped.onde || []) {
    const id = (R.ondeServico || {})[o];
    if (id && !vistos.has(id) && Tours.get(id)) { vistos.add(id); poe(id); }
    const nome = (R.ondeSemTabela || {})[o];
    if (nome) itens.push(Orc._item({ desc: 'Passeio particular em ' + nome, pax, data: '', valor: 0, sugestao: true, obs: 'Defina o valor — ainda não há tabela deste lugar' }));
  }
  if (!itens.some(i => i.tourId && i.tourId !== TRANSFER_PADRAO) && R.padrao && Tours.get(R.padrao) && !vistos.has(R.padrao)) poe(R.padrao);
  if ((ped.precisa || []).includes('transfer') && ped.fim) {
    const it = Orc.itemDoCatalogo(TRANSFER_PADRAO, { pax, data: ped.fim });
    if (it) { it.sugestao = true; it.desc += ' — partida'; itens.push(it); }
  }
  return itens;
}

/* ---------- termos e voucher ---------- */
/* MODELO. Ela ja tem os termos dela e cola por cima em Ajustes. */
const TERMOS_MODELO = [
  'MODELO — troque pelos seus termos em Ajustes → Termos e condições.',
  '',
  '1. A reserva é confirmada com o pagamento do sinal. Ao pagar, você declara que leu e aceita estes termos.',
  '2. O restante é pago nas datas combinadas no orçamento.',
  '3. Cancelamento e mudança de data: conforme informado no orçamento de cada serviço.',
  '4. Ingressos, hotéis e transfers seguem a política de cada fornecedor depois de emitidos.',
].join('\n');
/* O texto-base do cliente (conteudo.js). Entra sozinho nos Ajustes no 1º
   acesso; ela edita por cima. */
const TERMOS_CLIENTE = (typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).termos || '';
function termosTexto() {
  const s = (DB.settings && DB.settings.termos) || {};
  const l = (typeof LANG !== 'undefined' && LANG === 'en') ? 'en' : 'pt';
  return String(s[l] || s.pt || TERMOS_MODELO);
}

/* ---------- VOUCHER inteligente ----------
   O voucher se monta sozinho pelo que a reserva já sabe: transfer de chegada
   (aeroporto/porto) ou de partida, ou passeio — e puxa o ponto de encontro
   dos Pontos. Os textos-base são do cliente (conteudo.js), todos editáveis
   na aba Voucher. */
const VOUCHER_BLOCOS_CLIENTE = (typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).voucher || {};
/* a ordem e o rótulo de cada bloco na aba Voucher */
const VOUCHER_BLOCOS_META = [
  { k: 'pagamento', nome: 'Método de pagamento', grupo: 'Sempre aparece', quando: 'em todo voucher' },
  { k: 'suporte', nome: 'Suporte e informações gerais', grupo: 'Sempre aparece', quando: 'em todo voucher' },
  { k: 'trocado', nome: 'Troco (dinheiro trocado)', grupo: 'Transfer', quando: 'nos transfers' },
  { k: 'transferAeroporto', nome: 'Transfer de chegada — Aeroporto', grupo: 'Transfer', quando: 'chegada de avião' },
  { k: 'transferPartida', nome: 'Transfer da partida', grupo: 'Transfer', quando: 'quando vai para o aeroporto/porto/estação' },
  { k: 'transferPorto', nome: 'Transfer de chegada — Porto', grupo: 'Transfer', quando: 'chegada de navio' },
  { k: 'transferTrem', nome: 'Transfer de chegada — Estação de trem', grupo: 'Transfer', quando: 'chegada de trem' },
  { k: 'passeios', nome: 'Passeios (documentos, vestimenta, ingressos…)', grupo: 'Passeios', quando: 'nos passeios com guia' },
  { k: 'fechamento', nome: 'Fechamento e assinatura', grupo: 'Sempre aparece', quando: 'no fim de todo voucher' },
];
function voucherBlocoTxt(k) {
  const b = (DB.settings && DB.settings.voucher && DB.settings.voucher.blocos) || {};
  return (b[k] != null ? b[k] : VOUCHER_BLOCOS_CLIENTE[k]) || '';
}
function voucherSalvaBloco(k, txt) {
  if (!DB.settings.voucher) DB.settings.voucher = {};
  if (!DB.settings.voucher.blocos) DB.settings.voucher.blocos = Object.assign({}, VOUCHER_BLOCOS_CLIENTE);
  DB.settings.voucher.blocos[k] = String(txt == null ? '' : txt);
  if (typeof save === 'function') save();
}
/* que tipo de transfer é este (pra escolher o bloco certo) */
function voucherTipoTransfer(b) {
  const VR = (typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).voucherRe || {};
  const AERO = VR.aero || /aeroport|airport/i, PORTO = VR.porto || /\bporto\b|navio|cruzeiro/i, TREM = VR.trem || /(?!)/;
  const dest = String(b.destino || '').toLowerCase();
  if (AERO.test(dest) || PORTO.test(dest) || TREM.test(dest)) return 'partida';
  const txt = [b.origem, b.servicoTxt, (typeof nomeDoServico === 'function' ? nomeDoServico(b) : '')].filter(Boolean).join(' ');
  if (PORTO.test(txt)) return 'porto';
  if (TREM.test(txt)) return 'trem';
  return 'aeroporto';
}
/* os blocos que entram NESTE voucher, na ordem */
function voucherBlocosDe(b) {
  const out = ['pagamento', 'suporte'];
  if (typeof ehTransfer === 'function' && ehTransfer(b)) {
    out.push('trocado');
    const t = voucherTipoTransfer(b);
    out.push(t === 'partida' ? 'transferPartida' : t === 'porto' ? 'transferPorto' : t === 'trem' ? 'transferTrem' : 'transferAeroporto');
  } else {
    out.push('passeios');
  }
  out.push('fechamento');
  return out;
}
/* O que o cliente precisa saber NO DIA. Dicas do servico (o editor do
   passeio tem o campo) ou, sem elas, as do tipo de servico. */
const DICAS_PADRAO = Object.assign({ walk: 'Use sapato confortável e leve água. Chegue 10 minutos antes no ponto de encontro.' }, (typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).dicas || {});
function dicasDo(b) {
  const x = Tours.get(b.tourId);
  const l = (typeof LANG !== 'undefined' && LANG === 'en') ? 'en' : 'pt';
  const d = x && x.dicas && (x.dicas[l] || x.dicas.pt);
  if (d) return d;
  for (const [re, txt] of ((typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).dicasEspeciais || [])) {
    if (x && re.test(x.id + ' ' + x.name.pt)) return txt + ((x && DICAS_PADRAO[x.type]) || DICAS_PADRAO.walk);
  }
  return (x && DICAS_PADRAO[x.type]) || DICAS_PADRAO.walk;
}

/* ---------- garante as colecoes, e a demonstracao ----------
   Quem ja usa o app nao tem DB.equipe etc. — nasce vazio sem quebrar nada.
   Na DEMONSTRACAO (sem banco), semeia guias, contas e o dia de hoje com
   servicos de verdade, para ela fazer o test drive com o painel vivo. */
const OP_SEED = 1;
/* ZERAR PARA TRABALHAR: entrega o app limpo para a Ingrid — sem clientes,
   reservas, guias e parceiros de exemplo — MANTENDO o catálogo de passeios,
   os preços e os pontos de encontro (que são dados reais dela). Em config.js,
   semExemplos liga isto para todo aparelho novo; o botão em Ajustes e a
   migração automática abaixo limpam o aparelho que já viu a demonstração. */
const RESET_VER = 1;
const _semExemplos = () => typeof APP_CONFIG !== 'undefined' && !!APP_CONFIG.semExemplos;
/* cheira a demonstração ainda intacta? (para só auto-limpar quem não começou) */
function _pareceDemo() {
  const M = ((typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).demo || {}).marcadores || {};
  return (DB.equipe || []).some(p => p.id === M.equipe)
      || (DB.bookings || []).some(b => (M.clientes || []).includes(b.name));
}
/* apaga o que é de exemplo; guarda catálogo, preços, pontos e os ajustes dela */
function zerarExemplos() {
  DB.bookings = []; DB.clientes = []; DB.equipe = []; DB.disp = [];
  DB.parceiros = []; DB.coupons = []; DB.tarefas = []; DB.orcamentos = []; DB.fornecedores = []; DB.despesas = [];
  DB.pedidos = []; DB.fichas = {}; DB.interesse = {}; DB.interesseCanal = {}; DB.lembretesVistos = {};
  if (Array.isArray(DB.arquivos)) DB.arquivos = [];
  if (DB.settings) DB.settings.avaliacoes = [];
  /* marca para não semear a demonstração de novo */
  DB.opSeed = OP_SEED; DB.interesseSeed = 1; DB.canaisSeed = 1; DB.parceirosSeed = 1; DB.tarefasSeed = 1; DB.fornecedoresSeed = 1;
  DB.cadastroFeito = 1; DB.resetFeito = RESET_VER;
  _opSave();
  return { ok: true };
}
function opGarante() {
  if (!DB) return;
  DB.equipe = DB.equipe || [];
  DB.disp = DB.disp || [];
  DB.orcamentos = DB.orcamentos || [];
  DB.fichas = DB.fichas || {};
  if (!Array.isArray(DB.contas) || !DB.contas.length) DB.contas = contasPadrao();
  if (DB.settings && !DB.settings.termos) DB.settings.termos = { pt: '', en: '' };
  if (DB.settings && DB.settings.termos && !DB.settings.termos.pt && !DB.settings.termosSeed) { DB.settings.termos.pt = TERMOS_CLIENTE; DB.settings.termosSeed = 'cliente1'; }
  if (DB.settings && !DB.settings.voucherSeed) { DB.settings.voucher = DB.settings.voucher || {}; if (!DB.settings.voucher.blocos) DB.settings.voucher.blocos = Object.assign({}, VOUCHER_BLOCOS_CLIENTE); DB.settings.voucherSeed = 'cliente1'; }
  if (DB.settings && DB.settings.plantao === undefined) DB.settings.plantao = '';
  DB.tarefas = DB.tarefas || [];
  DB.lembretesVistos = DB.lembretesVistos || {};
  DB.clientes = DB.clientes || [];
  DB.parceiros = DB.parceiros || [];
  DB.pontos = DB.pontos || [];
  const demo = DB.demo && !(typeof temNuvem === 'function' && temNuvem());
  const limpo = _semExemplos();
  /* pontos de encontro são reais (Vaticano, Coliseu, aeroporto) e ligam ao
     catálogo: entram mesmo no app zerado */
  if (demo && !DB.pontosSeed) { opSemeiaPontos(); DB.pontosSeed = 1; }
  if (demo && !limpo && !DB.interesseSeed) { opSemeiaInteresse(); DB.interesseSeed = 1; }
  if (demo && !limpo && !DB.canaisSeed) { opSemeiaCanais(); DB.canaisSeed = 1; }
  if (demo && !limpo && (+DB.opSeed || 0) < OP_SEED) {
    opSemeiaDemo();
    DB.opSeed = OP_SEED;
  }
  /* o cadastro nasce das reservas que ja existem (uma vez so) */
  if (!DB.cadastroFeito) {
    for (const bk of [...DB.bookings].sort((x, y) => String(x.createdAt).localeCompare(String(y.createdAt)))) cadastroDaReserva(bk);
    DB.cadastroFeito = 1;
  }
  if (demo && !limpo && !DB.parceirosSeed) { opSemeiaParceiros(); DB.parceirosSeed = 1; }
  DB.fornecedores = DB.fornecedores || [];
  if (demo && !limpo && !DB.fornecedoresSeed) { opSemeiaFornecedores(); DB.fornecedoresSeed = 1; }
  /* tarefas de exemplo so uma vez, e so na demonstracao */
  if (demo && !limpo && !DB.tarefasSeed && typeof opSemeiaTarefas === 'function') {
    opSemeiaTarefas();
    DB.tarefasSeed = 1;
  }
  /* o aparelho dela que já viu a demonstração se limpa sozinho uma vez,
     só se os dados ainda são os de exemplo (ela ainda não começou) */
  if (limpo && (+DB.resetFeito || 0) < RESET_VER && _pareceDemo()) { zerarExemplos(); return; }
  _opSave();
}
function opSemeiaDemo() {
  const hoje = isoToday();
  const D = (typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).demo || {};
  /* nomes ficticios — as guias de verdade ela cadastra */
  DB.equipe = (D.equipe || []).map(([id, nome, tipo, whats, cidades, idiomas], i) =>
    ({ id: 'op-' + id, nome, tipo, whats, cidades, idiomas, obs: '', pref: i + 1 }));
  DB.contas = contasPadrao();

  let k = 0;
  for (const s of D.reservas || []) {
    const x = Tours.get(s.tourId); if (!x) continue;
    const date = addDays(hoje, s.d);
    const pr = Bookings.precoDe(x, x.id, date, s.time, s.pax, { opcao: 0 });
    const total = pr.total || 0;
    const sinal = x.priceMode === 'transfer' ? (pr.sinal || 30) : Math.round(total * 0.3);
    const b = {
      id: 'op' + (++k), code: PREFIXO + '-' + (5100 + k * 41),
      tourId: x.id, date, time: s.time, name: s.quem[0], email: s.quem[1], whats: s.quem[2], insta: '',
      pax: s.pax, total, coupon: null, discount: 0, policy: s.pagoTudo ? 'full' : 'sinal', sinal: s.pagoTudo ? 0 : sinal,
      adultos: s.pax, criancas: 0, idades: [], veiculo: pr.veiculo || '', malas: pr.malas || '',
      group: s.group || [], consent: { ok: true, at: addDays(date, -12) + 'T10:00:00.000Z', src: 'checkout' },
      payments: [], status: 'confirmed', createdAt: addDays(date, -12) + 'T10:00:00.000Z', origin: 'whatsapp',
      voo: s.voo || '', origem: s.origem || '', destino: s.destino || '', obsOp: s.obsOp || '',
      prestadorId: s.pres || '', restoPara: s.restoPara || '', custo: s.custo || 0,
    };
    if (s.pagoTudo) b.payments.push({ amount: total, date: addDays(date, -10), method: 'transfer', kind: 'full', conta: s.pagoTudo });
    else if (s.sinalPago) {
      const c = contasPadrao().find(z => z.id === s.sinalPago);
      b.payments.push({ amount: sinal, date: addDays(date, -12), method: c ? c.metodo : 'transfer', kind: 'deposit', conta: s.sinalPago });
    }
    DB.bookings = DB.bookings.filter(z => z.id !== b.id);
    DB.bookings.push(b);
  }
  /* respostas das guias para amanha de manha */
  const am = addDays(hoje, 1);
  DB.disp = (D.disp || []).map(([pessoaId, estado, nota]) => ({ pessoaId, data: am, turno: 'manha', estado, nota, em: new Date().toISOString() }));
  /* um pedido que chegou de madrugada pelo WhatsApp, esperando por ela */
  if (typeof D.conversa === 'function') {
    const conversa = D.conversa(hoje, addDays);
    const c = lerConversa(conversa);
    if (!(DB.orcamentos || []).some(o => o.origem === 'whats' && o.cliente.nome === c.nome)) {
      Orc.cria({ origem: 'whats', status: 'novo', cliente: { nome: c.nome, whats: c.whats }, conversa, resumo: c.resumo,
                 pax: c.pax, datas: c.datas, itens: rascunhoDaConversa(c) });
    }
  }
}

/* ---------- TAREFAS E ANOTACOES ----------
   Tarefa: tem prazo (ou nao), pode estar ligada a um cliente, a um servico,
   a um orcamento ou a uma guia. Anotacao: texto com data — e onde cai o
   resumo que o robo do WhatsApp vai deixar para ela conferir de manha.
   As duas aparecem na Agenda do app e viram evento na agenda do celular.

   Os LEMBRETES nao sao guardados: o app calcula na hora o que precisa ser
   feito (cliente que deve, orcamento sem resposta, voucher para mandar,
   servico sem guia). Ela marca "feito" e o lembrete some. */
const DIAS_SEMANA = ['domingo', 'segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado'];
/* "amanha 9h", "sexta", "12/10 14:30" — o prazo sai do proprio texto */
function lerPrazo(txt, hoje) {
  hoje = hoje || isoToday();
  const low = String(txt || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  let data = '', hora = '';
  if (/\bdepois de amanha\b/.test(low)) data = addDays(hoje, 2);
  else if (/\bamanha\b/.test(low)) data = addDays(hoje, 1);
  else if (/\bhoje\b/.test(low)) data = hoje;
  else {
    const d = low.match(/\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/);
    if (d) data = _isoDe(d[1], d[2], d[3]);
    else {
      const w = DIAS_SEMANA.findIndex(n => new RegExp('\\b' + n + '(-feira)?\\b').test(low));
      if (w >= 0) {
        const hj = new Date(hoje + 'T12:00:00').getDay();
        data = addDays(hoje, ((w - hj + 7) % 7) || 7);
      }
    }
  }
  /* repeticao: "todo dia 01", "toda quinta", "todas as quintas", "todo dia" */
  let repete = '';
  const mDia = low.match(/\btodo (?:o )?dia (\d{1,2})\b/);
  if (mDia) {
    repete = 'mensal';
    const d = +mDia[1], hj = new Date(hoje + 'T12:00:00');
    let alvo = new Date(hj.getFullYear(), hj.getMonth(), d, 12);
    if (alvo.toISOString().slice(0, 10) < hoje) alvo = new Date(hj.getFullYear(), hj.getMonth() + 1, d, 12);
    data = alvo.toISOString().slice(0, 10);
  } else if (/\btod[ao]s? (?:as |os )?(segunda|terca|quarta|quinta|sexta|sabado|domingo)/.test(low)) {
    repete = 'semanal';
    const w = DIAS_SEMANA.findIndex(n => new RegExp('tod[ao]s? (?:as |os )?' + n).test(low));
    const hj = new Date(hoje + 'T12:00:00').getDay();
    data = addDays(hoje, (w - hj + 7) % 7);
  } else if (/\btodo dia\b|\btodos os dias\b|\bdiariamente\b/.test(low)) { repete = 'diario'; data = data || hoje; }
  const h = low.match(/\b(\d{1,2})(?::(\d{2})|h(\d{2})?)\b/);
  if (h && +h[1] < 24) hora = String(+h[1]).padStart(2, '0') + ':' + String(h[2] || h[3] || '00').padStart(2, '0');
  return { data, hora, repete };
}
const Tarefas = {
  all() { return DB.tarefas || []; },
  get(id) { return (DB.tarefas || []).find(t => t.id === id) || null; },
  cria(d) {
    DB.tarefas = DB.tarefas || [];
    const texto = String(d.texto || '').trim(); if (!texto) return null;
    const t = {
      id: uid(), tipo: d.tipo === 'nota' ? 'nota' : 'tarefa', texto, detalhe: String(d.detalhe || '').trim(),
      prazo: d.prazo || '', hora: d.hora || '', feita: false, feitaEm: '', criada: new Date().toISOString(),
      clienteKey: d.clienteKey || '', clienteNome: String(d.clienteNome || '').trim(), whats: String(d.whats || '').trim(),
      bookingId: d.bookingId || '', orcId: d.orcId || '', pessoaId: d.pessoaId || '',
      fixa: !!d.fixa, origem: d.origem || 'manual',
      /* como nas Tarefas da Bia: prioridade e se é do trabalho ou pessoal */
      prio: ['alta', 'media', 'baixa'].includes(d.prio) ? d.prio : 'media',
      cat: d.cat === 'pessoal' ? 'pessoal' : 'profissional',
      /* a tarefa inteligente: que tipo de passo e, quando se fecha sozinha,
         a que esta ligada, e de qual tarefa ela nasceu */
      etapa: d.etapa || (d.tipo === 'nota' ? '' : etapaDoTexto(texto)),
      fechaQuando: d.fechaQuando || '', liga: d.liga || {}, chave: d.chave || '',
      tentativa: +d.tentativa || 1, anterior: d.anterior || '', obsFim: '',
      /* "todo dia 01", "toda quinta": ao concluir, nasce a proxima */
      repete: ['diario', 'semanal', 'mensal'].includes(d.repete) ? d.repete : '',
    };
    DB.tarefas.push(t); _opSave(); return t;
  },
  /* "aguardar" nao se duplica: se ja existe uma aberta com a mesma chave,
     so empurra o prazo */
  garante(d) {
    const ja = d.chave && Tarefas.all().find(t => !t.feita && t.chave === d.chave);
    if (ja) { if (d.prazo) ja.prazo = d.prazo; if (d.hora !== undefined) ja.hora = d.hora; _opSave(); return ja; }
    return Tarefas.cria(d);
  },
  /* CONCLUIR — e aqui que a tarefa vira a proxima. resultado vem dos botoes
     da tarefa de espera: 'respondeu', 'cutucar' (nao respondeu), ou vazio. */
  conclui(id, resultado) {
    const t = Tarefas.get(id); if (!t || t.feita) return null;
    t.feita = true; t.feitaEm = new Date().toISOString();
    t.obsFim = resultado === 'respondeu' ? 'respondeu' : resultado === 'cutucar' ? 'não respondeu' : '';
    /* REPESCAGEM (colunas da planilha dela): a espera de um orcamento que
       acabou vira "Repescagem N · data · resultado" no proprio pedido */
    if (t.orcId && t.etapa === 'aguardar') {
      const o = Orc.get(t.orcId);
      if (o) { o.repescagens = o.repescagens || []; o.repescagens.push({ n: +t.tentativa || 1, data: isoToday(), resultado: t.obsFim || resultado || 'feito' }); }
    }
    if (t.repete && t.prazo) {
      const d0 = new Date(t.prazo + 'T12:00:00');
      if (t.repete === 'mensal') d0.setMonth(d0.getMonth() + 1); else d0.setDate(d0.getDate() + (t.repete === 'semanal' ? 7 : 1));
      let pz = d0.toISOString().slice(0, 10);
      while (pz < isoToday()) { const dd = new Date(pz + 'T12:00:00'); if (t.repete === 'mensal') dd.setMonth(dd.getMonth() + 1); else dd.setDate(dd.getDate() + (t.repete === 'semanal' ? 7 : 1)); pz = dd.toISOString().slice(0, 10); }
      Tarefas.cria({ texto: t.texto, detalhe: t.detalhe, prazo: pz, hora: t.hora, repete: t.repete, clienteKey: t.clienteKey, clienteNome: t.clienteNome, whats: t.whats, etapa: t.etapa === 'aguardar' ? '' : t.etapa });
    }
    const prox = t.repete ? null : proximoPasso(t, resultado);
    const nova = prox ? Tarefas.garante({ ...prox, anterior: t.id, clienteKey: prox.clienteKey ?? t.clienteKey,
      clienteNome: prox.clienteNome ?? t.clienteNome, whats: prox.whats ?? t.whats, bookingId: prox.bookingId ?? t.bookingId,
      orcId: prox.orcId ?? t.orcId, pessoaId: prox.pessoaId ?? t.pessoaId }) : null;
    _opSave();
    return nova;
  },
  adia(id, dias) {
    const t = Tarefas.get(id); if (!t) return;
    t.prazo = addDays(isoToday(), dias || 2); _opSave();
  },
  /* FECHAR SOZINHA: o cliente pagou, o orcamento foi decidido, a guia
     respondeu. Roda antes de desenhar a tela. Devolve o que fechou. */
  sincroniza(hoje) {
    hoje = hoje || isoToday();
    const fechadas = [];
    for (const t of Tarefas.all()) {
      if (t.feita || !t.fechaQuando) continue;
      let motivo = '', resultado = 'respondeu';
      if (t.fechaQuando === 'pago') {
        const bs = t.bookingId ? [Bookings.get(t.bookingId)].filter(Boolean)
          : DB.bookings.filter(b => t.clienteKey && chaveCliente(b) === t.clienteKey && b.status !== 'cancelled' && Op.restoPara(b) === 'ingrid');
        if (bs.length && bs.every(b => b.status === 'cancelled' || Bookings.due(b) <= 0 || Op.restoPara(b) !== 'ingrid')) motivo = 'pagou';
      } else if (t.fechaQuando === 'orc-decidido') {
        const o = Orc.get(t.orcId);
        if (o && o.status === 'fechado') motivo = 'o orçamento fechou';
        else if (o && o.status === 'perdido') { motivo = 'o orçamento não fechou'; resultado = 'perdido'; }
      } else if (t.fechaQuando === 'guia-respondeu' && t.liga && t.liga.data) {
        const tu = t.liga.turno === 'dia' ? 'manha' : t.liga.turno;
        const e = Disp.estado(t.pessoaId, t.liga.data, tu);
        if (e.estado) { motivo = e.estado === 'livre' ? 'a guia respondeu: livre' : 'a guia respondeu: ocupada'; resultado = e.estado; }
      }
      if (!motivo) continue;
      Tarefas.conclui(t.id, resultado);
      t.obsFim = motivo + ' — concluída sozinha';
      fechadas.push(t);
    }
    if (fechadas.length) _opSave();
    return fechadas;
  },
  salva(id, d) {
    const t = Tarefas.get(id); if (!t) return null;
    for (const k of ['texto', 'detalhe', 'prazo', 'hora', 'clienteKey', 'clienteNome', 'fixa', 'prio', 'cat']) if (d[k] !== undefined) t[k] = typeof d[k] === 'string' ? d[k].trim() : d[k];
    _opSave(); return t;
  },
  marca(id, feita) {
    const t = Tarefas.get(id); if (!t) return;
    t.feita = !!feita; t.feitaEm = feita ? new Date().toISOString() : '';
    _opSave();
  },
  remove(id) { DB.tarefas = (DB.tarefas || []).filter(t => t.id !== id); _opSave(); },
  /* as tarefas abertas, na ordem em que ela resolve o dia */
  grupos(hoje) {
    hoje = hoje || isoToday();
    const abertas = Tarefas.all().filter(t => t.tipo === 'tarefa' && !t.feita)
      .sort((a, b) => ((a.prazo || '9999') + (a.hora || '99')).localeCompare((b.prazo || '9999') + (b.hora || '99')));
    const sem7 = addDays(hoje, 7);
    return {
      atrasadas: abertas.filter(t => t.prazo && t.prazo < hoje),
      hoje: abertas.filter(t => t.prazo === hoje),
      semana: abertas.filter(t => t.prazo > hoje && t.prazo <= sem7),
      depois: abertas.filter(t => t.prazo > sem7),
      semData: abertas.filter(t => !t.prazo),
      feitas: Tarefas.all().filter(t => t.tipo === 'tarefa' && t.feita).sort((a, b) => (b.feitaEm || '').localeCompare(a.feitaEm || '')).slice(0, 30),
    };
  },
  notas(busca) {
    const n = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const q = n(busca).trim();
    return Tarefas.all().filter(t => t.tipo === 'nota')
      .filter(t => !q || [t.texto, t.detalhe, t.clienteNome].some(v => n(v).includes(q)))
      .sort((a, b) => (b.fixa - a.fixa) || (b.criada || '').localeCompare(a.criada || ''));
  },
  doDia(data) { return Tarefas.all().filter(t => t.prazo === data).sort((a, b) => (a.hora || '99').localeCompare(b.hora || '99')); },
  /* do mesmo cliente: pela chave da ficha ou pelo WhatsApp */
  doCliente(k, whats) {
    const w = String(whats || '').replace(/\D/g, '');
    return Tarefas.all().filter(t => (k && t.clienteKey === k)
      || (w.length >= 6 && String(t.whats || '').replace(/\D/g, '').endsWith(w.slice(-8))));
  },
};

/* ---------- o fluxo das tarefas inteligentes ----------
   mensagem  -> aguardar resposta (2 dias)
   cobrar    -> aguardar pagamento (fecha sozinha quando o cliente paga)
   orcamento -> aguardar resposta do orcamento (fecha sozinha quando fecha)
   guia      -> aguardar a guia (fecha sozinha quando voce marca livre/ocupada)
   aguardar  -> respondeu: o passo seguinte (fechar, escalar) | nao respondeu:
                mandar um lembrete, que volta a aguardar (ate 3 tentativas) */
const ETAPAS = {
  mensagem:  { nome: 'mensagem', depois: 'aguardar resposta' },
  cobrar:    { nome: 'cobrança', depois: 'aguardar o pagamento' },
  orcamento: { nome: 'orçamento', depois: 'aguardar a resposta do orçamento' },
  guia:      { nome: 'pedir disponibilidade', depois: 'aguardar a guia' },
  aguardar:  { nome: 'aguardando', depois: '' },
  fechar:    { nome: 'fechar', depois: '' },
  escalar:   { nome: 'escalar', depois: 'aguardar a confirmação da guia' },
};
function etapaDoTexto(txt) {
  const low = String(txt || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (/^(cobrar|pedir o pagamento|lembrar .* pagamento)/.test(low)) return 'cobrar';
  if (/orcamento/.test(low) && /^(mandar|enviar|montar)/.test(low)) return 'orcamento';
  if (/^(perguntar|confirmar) (a|o|com a|com o) (guia|motorista)/.test(low)) return 'guia';
  if (/^(aguardar|esperar)/.test(low)) return 'aguardar';
  if (/^(mandar|enviar|responder|perguntar|falar|ligar|escrever|chamar|confirmar|avisar|lembrar)/.test(low)) return 'mensagem';
  return '';
}
function _alvo(t) {
  const p = t.pessoaId && Equipe.get(t.pessoaId);
  return (p && p.nome.split(' ')[0]) || (t.clienteNome && t.clienteNome.split(' ')[0]) || 'o cliente';
}
function proximoPasso(t, resultado) {
  const hoje = isoToday(), alvo = _alvo(t);
  if (t.etapa === 'mensagem')
    return { etapa: 'aguardar', texto: `Aguardar resposta de ${alvo}`, detalhe: 'Depois de: ' + t.texto, prazo: addDays(hoje, 2), chave: 'resp:' + (t.clienteKey || t.whats || t.pessoaId || t.id), tentativa: t.tentativa };
  if (t.etapa === 'cobrar')
    return { etapa: 'aguardar', texto: `Aguardar o pagamento de ${alvo}`, prazo: addDays(hoje, 2), fechaQuando: 'pago', chave: 'pago:' + (t.bookingId || t.clienteKey), tentativa: t.tentativa };
  /* orçamento: o lembrete cai no dia 3 e no dia 7 depois do envio (R3 da
     Milla: no Instagram, depois de 24 h, só ela pode mandar — o app avisa) */
  if (t.etapa === 'orcamento')
    return { etapa: 'aguardar', texto: `Aguardar a resposta de ${alvo} sobre o orçamento`, prazo: addDays(hoje, (+t.tentativa || 1) >= 2 ? 4 : 3), fechaQuando: 'orc-decidido', chave: 'orc:' + t.orcId, tentativa: t.tentativa };
  if (t.etapa === 'guia')
    return { etapa: 'aguardar', texto: `Aguardar a resposta de ${alvo}`, prazo: hoje, fechaQuando: t.liga && t.liga.data ? 'guia-respondeu' : '', liga: t.liga, chave: 'guia:' + t.pessoaId + ':' + ((t.liga && t.liga.data) || ''), tentativa: t.tentativa };
  if (t.etapa === 'escalar')
    return { etapa: 'aguardar', texto: `Aguardar a confirmação de ${alvo}`, prazo: hoje, chave: 'conf:' + t.pessoaId + ':' + t.bookingId };
  if (t.etapa !== 'aguardar') return null;
  /* a espera acabou */
  if (resultado === 'cutucar') {
    const n = (+t.tentativa || 1) + 1;
    if (n > 3) return { etapa: t.orcId ? 'fechar' : '', texto: t.orcId ? `${alvo} não respondeu 3 vezes: marcar o orçamento como "não fechou"?` : `${alvo} não respondeu 3 vezes — decidir o que fazer`, prazo: hoje, chave: 'desiste:' + t.id };
    const cobranca = t.fechaQuando === 'pago';
    return { etapa: cobranca ? 'cobrar' : t.fechaQuando === 'orc-decidido' ? 'orcamento' : t.fechaQuando === 'guia-respondeu' ? 'guia' : 'mensagem',
             texto: cobranca ? `Lembrar ${alvo} do pagamento (${n}ª vez)` : `Mandar um lembrete para ${alvo} (${n}ª vez)`,
             prazo: hoje, tentativa: n, liga: t.liga, chave: 'lembra:' + t.id };
  }
  if (resultado === 'perdido' || resultado === 'ocupada') {
    if (resultado === 'ocupada' && t.liga && t.liga.bookingId && !(Bookings.get(t.liga.bookingId) || {}).prestadorId)
      return { etapa: 'guia', texto: `${alvo} está ocupada: perguntar à próxima da lista`, prazo: hoje, liga: t.liga, pessoaId: '', chave: 'proxima:' + t.liga.bookingId };
    return null;
  }
  if (t.orcId) { const o = Orc.get(t.orcId); if (o && o.status !== 'fechado' && o.status !== 'perdido') return { etapa: 'fechar', texto: `Fechar o orçamento de ${alvo}: registrar o sinal e criar as reservas`, prazo: hoje, chave: 'fechar:' + t.orcId }; }
  if (t.pessoaId && t.liga && t.liga.bookingId) {
    const b = Bookings.get(t.liga.bookingId);
    if (b && !b.prestadorId && resultado !== 'ocupada') return { etapa: 'escalar', texto: `Escalar ${alvo} e mandar o serviço de ${b.name}`, prazo: hoje, bookingId: b.id, chave: 'escalar:' + b.id };
  }
  return null;
}
/* as esperas que as outras telas criam sozinhas */
const Espera = {
  orcamento(o) {
    return Tarefas.garante({ etapa: 'aguardar', texto: `Aguardar a resposta de ${(o.cliente.nome || 'o cliente').split(' ')[0]} sobre o orçamento ${o.num}`,
      prazo: addDays(isoToday(), 3), fechaQuando: 'orc-decidido', orcId: o.id, clienteNome: o.cliente.nome, whats: o.cliente.whats,
      clienteKey: o.clienteKey || '', chave: 'orc:' + o.id, origem: 'app' });
  },
  guia(p, data, turno, b) {
    return Tarefas.garante({ etapa: 'aguardar', texto: `Aguardar a resposta de ${p.nome.split(' ')[0]} (${data.slice(8, 10)}/${data.slice(5, 7)} ${turno === 'manha' ? 'manhã' : turno === 'dia' ? 'dia inteiro' : turno})`,
      prazo: isoToday(), fechaQuando: 'guia-respondeu', pessoaId: p.id, liga: { data, turno, bookingId: b ? b.id : '' },
      clienteNome: b ? b.name : '', chave: 'guia:' + p.id + ':' + data + ':' + turno, origem: 'app' });
  },
  pagamento(dev) {
    return Tarefas.garante({ etapa: 'aguardar', texto: `Aguardar o pagamento de ${dev.nome.split(' ')[0]} (${eur(dev.total)})`,
      prazo: addDays(isoToday(), 2), fechaQuando: 'pago', clienteKey: dev.chave, clienteNome: dev.nome, whats: dev.whats,
      chave: 'pago:' + dev.chave, origem: 'app' });
  },
};

/* o que o app sabe que precisa ser feito — calculado, nunca digitado */
const Lembretes = {
  visto(chave) { return !!((DB.lembretesVistos || {})[chave]); },
  marca(chave) { DB.lembretesVistos = DB.lembretesVistos || {}; DB.lembretesVistos[chave] = isoToday(); _opSave(); },
  /* CLIENTES QUE DEVEM: o que falta pagar a ELA (o resto no dia com a guia
     nao entra — esse a guia recebe). Um por cliente, com o total. */
  devedores(hoje) {
    hoje = hoje || isoToday();
    const map = new Map();
    for (const b of DB.bookings) {
      if (b.status === 'cancelled') continue;
      const falta = Bookings.due(b); if (falta <= 0 || Op.restoPara(b) !== 'ingrid') continue;
      const k = chaveCliente(b);
      const r = map.get(k) || { chave: k, nome: b.name, whats: b.whats, total: 0, prazo: '', servicos: [] };
      r.total += falta; r.servicos.push(b);
      const pz = Bookings.dueDate(b); if (!r.prazo || pz < r.prazo) r.prazo = pz;
      map.set(k, r);
    }
    return [...map.values()].map(r => ({ ...r, atrasado: r.prazo < hoje })).sort((a, b) => a.prazo.localeCompare(b.prazo));
  },
  lista(hoje) {
    hoje = hoje || isoToday();
    const out = [];
    const add = (l) => { if (!Lembretes.visto(l.chave)) out.push(l); };
    for (const o of DB.orcamentos || []) {
      if (o.status === 'novo' || o.status === 'rascunho')
        add({ chave: 'orc-montar:' + o.id, grupo: 'orcamentos', nivel: 'warn', data: String(o.criado).slice(0, 10), txt: `Montar e mandar o orçamento de ${o.cliente.nome || 'um cliente'}`, sub: o.resumo || o.num, href: '#/adm/consulta/' + o.id });
      if (o.status === 'enviado' && o.validade && o.validade <= addDays(hoje, 1))
        add({ chave: 'orc-validade:' + o.id + ':' + o.validade, grupo: 'orcamentos', nivel: o.validade < hoje ? 'bad' : 'warn', data: o.validade, txt: `Orçamento ${o.num} de ${o.cliente.nome} ${o.validade < hoje ? 'venceu' : 'vence'} em ${o.validade.slice(8, 10)}/${o.validade.slice(5, 7)} — perguntar se fecha`, href: '#/adm/consulta/' + o.id, whats: o.cliente.whats });
    }
    for (const p of DB.pedidos || []) {
      if (!p.respondido && !(DB.orcamentos || []).some(o => o.pedidoId === p.id))
        add({ chave: 'roteiro:' + p.id, grupo: 'orcamentos', nivel: 'warn', data: String(p.criado).slice(0, 10), txt: `Responder o pedido de roteiro de ${p.nome}`, href: '#/adm/consulta', whats: p.whats });
    }
    for (const b of DB.bookings) {
      if (b.status === 'cancelled') continue;
      if (b.date >= hoje && b.date <= addDays(hoje, 3) && !b.prestadorId)
        add({ chave: 'escalar:' + b.id, grupo: 'servicos', nivel: b.date <= addDays(hoje, 1) ? 'bad' : 'warn', data: b.date, bookingId: b.id,
              txt: `Escalar ${(Tours.get(b.tourId) || {}).priceMode === 'transfer' ? 'motorista' : 'guia'} para ${b.name} (${b.date.slice(8, 10)}/${b.date.slice(5, 7)} ${b.time})`, href: '#/adm/guias/servico:' + b.id });
      if (b.date >= hoje && b.date <= addDays(hoje, 30) && Op.precisaIngresso(b) && !b.ingressosOk)
        add({ chave: 'ingresso:' + b.id, grupo: 'servicos', nivel: b.date <= addDays(hoje, 7) ? 'bad' : 'warn', data: b.date, bookingId: b.id,
              txt: `Comprar os ingressos de ${b.name} — ${(Tours.get(b.tourId) || { name: { pt: '?' } }).name.pt} (${b.date.slice(8, 10)}/${b.date.slice(5, 7)})`, href: '#/adm/clients/' + encodeURIComponent('c:' + (b.clienteId || '')) });
      if (b.date >= hoje && b.date <= addDays(hoje, 2) && !b.voucherEm)
        add({ chave: 'voucher:' + b.id, grupo: 'servicos', nivel: 'n', data: b.date, bookingId: b.id,
              txt: `Mandar o voucher para ${b.name} (${b.date.slice(8, 10)}/${b.date.slice(5, 7)})`, href: '#/adm/voucher/' + b.id });
      if (+b.custo > 0 && !b.acertado && b.date < hoje && b.prestadorId) {
        const a = acertos(b.date, b.date).find(x => x.b.id === b.id);
        if (a && a.saldo) add({ chave: 'acerto:' + b.id, grupo: 'servicos', nivel: 'n', data: b.date, bookingId: b.id,
          txt: a.saldo > 0 ? `Pagar ${eur(a.saldo)} a ${(a.pessoa || {}).nome || 'quem fez'} (${b.name})` : `Receber ${eur(-a.saldo)} de ${(a.pessoa || {}).nome || 'quem fez'} (${b.name})`, href: '#/adm/money' });
      }
    }
    return out.sort((a, b) => ({ bad: 0, warn: 1, n: 2 }[a.nivel] - { bad: 0, warn: 1, n: 2 }[b.nivel]) || String(a.data).localeCompare(String(b.data)));
  },
};
/* evento para a agenda do celular (Google Agenda, iPhone): com aviso 30 min antes */
function icsTarefa(t) {
  const esc = (v) => String(v || '').replace(/[\\,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const dia = (t.prazo || isoToday()).replace(/-/g, '');
  const linhas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//' + negocioArquivo() + '//Tarefas//PT', 'BEGIN:VEVENT',
    'UID:' + t.id + '@' + negocioArquivo().toLowerCase() + '-tarefas', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z'];
  if (t.hora) {
    const [h, m] = t.hora.split(':').map(Number);
    const fim = String(Math.min(23, h + 1)).padStart(2, '0') + String(m).padStart(2, '0');
    linhas.push('DTSTART:' + dia + 'T' + t.hora.replace(':', '') + '00', 'DTEND:' + dia + 'T' + fim + '00');
  } else {
    linhas.push('DTSTART;VALUE=DATE:' + dia, 'DTEND;VALUE=DATE:' + addDays(t.prazo || isoToday(), 1).replace(/-/g, ''));
  }
  linhas.push('SUMMARY:' + esc(t.texto), 'DESCRIPTION:' + esc([t.detalhe, t.clienteNome && 'Cliente: ' + t.clienteNome].filter(Boolean).join('\n')),
    'BEGIN:VALARM', 'TRIGGER:-PT30M', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(t.texto), 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
  return linhas.join('\r\n');
}
function opSemeiaCanais() {
  const hoje = isoToday(), peso = { instagram: 9, whatsapp: 5, tiktok: 3, direto: 2 };
  DB.interesseCanal = {};
  for (const [k, p] of Object.entries(peso)) {
    const v = {}, q = {};
    for (let d = 0; d < 60; d++) { const dia = addDays(hoje, -d), n = Math.round(p * (0.5 + ((d * 5 + p) % 7) / 8)); if (n) v[dia] = n; if ((d + p) % 4 === 0) q[dia] = Math.max(1, Math.round(n / 4)); }
    DB.interesseCanal[k] = { visitas: v, quase: q };
  }
  const can = ['instagram', 'instagram', 'whatsapp', 'tiktok', 'instagram', 'whatsapp', 'direto'];
  DB.bookings.forEach((b, i) => { if (!b.canal) b.canal = can[i % can.length]; });
}
function opSemeiaInteresse() {
  const I = ((typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).demo || {}).interesse || { ids: [], peso: [] };
  const hoje = isoToday();
  DB.interesse = DB.interesse || {};
  I.ids.forEach((id, k) => {
    if (!Tours.get(id)) return;
    const peso = I.peso[k] || 1;
    const i = DB.interesse[id] = { visitas: {}, quase: {} };
    for (let d = 0; d < 60; d++) { const dia = addDays(hoje, -d), v = Math.max(0, Math.round(peso * (0.6 + ((d * 7 + k * 3) % 10) / 12))); if (v) { i.visitas[dia] = v; if ((d + k) % 3 === 0) i.quase[dia] = 1; } }
  });
}
function opSemeiaPontos() {
  const D = (typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).demo || {};
  const pts = {};
  for (const [chave, nome, endereco, instrucoes] of D.pontos || []) pts[chave] = Pontos.salva({ nome, endereco, instrucoes });
  for (const [id, lista, padrao] of D.ligacoes || []) {
    const x = Tours.get(id); if (!x) continue;
    x.pontos = lista.map(k => pts[k] && pts[k].id).filter(Boolean);
    if (pts[padrao]) x.pontoPadrao = pts[padrao].id;
  }
}
function opSemeiaParceiros() {
  const D = (typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).demo || {};
  const bs = DB.bookings.filter(b => b.status !== 'cancelled');
  for (const p of D.parceiros || []) {
    const { cliente: nomeCli, veioPor, ...dados } = p;
    const par = Parceiros.salva(dados);
    const b = bs.find(z => z.name === nomeCli);
    if (b && par && !par.erro) {
      if (dados.tipo === 'influencer' && dados.cupom) b.coupon = dados.cupom; else b.parceiroId = par.id;
      const c = Cadastro.get(b.clienteId); if (c) { c.veioPor = veioPor; c.parceiroId = par.id; }
    }
  }
  const ind = D.indicacoes;
  if (ind) {
    const quem = Cadastro.acha({ nome: ind.quem });
    for (const n of ind.indicou || []) {
      const c = Cadastro.acha({ nome: n });
      if (quem && c) { c.veioPor = 'indicacao'; c.indicadoPor = quem.id; c.indicadoNome = quem.nome; }
    }
    if (quem) { quem.nasc = quem.nasc || addDays(isoToday(), 5).slice(5).split('-').reverse().join('/') + '/1984'; quem.pais = ind.pais || ''; }
  }
}
function opSemeiaFornecedores() {
  const D = (typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).demo || {};
  const ids = {};
  for (const f of D.fornecedores || []) { const r = Fornecedores.salva(f); if (!r.erro) ids[f.chave || f.nome] = r.id; }
  for (const p of D.pedidosFor || []) {
    const b = DB.bookings.find(z => z.name === p.cliente && (!p.tourId || z.tourId === p.tourId)); if (!b) continue;
    PedidosFor.cria(b.id, { fornecedorId: ids[p.fornecedor] || '', tipo: p.tipo, desc: p.desc, custo: p.custo, status: p.status });
  }
}
function opSemeiaTarefas() {
  const hoje = isoToday();
  const D = (typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).demo || {};
  const lista = typeof D.tarefas === 'function' ? D.tarefas(hoje, { addDays }) : [];
  for (const d of lista) {
    const b = d.cliente ? DB.bookings.find(z => z.name === d.cliente) : null;
    const dados = { texto: d.texto };
    if (d.tipo) dados.tipo = d.tipo;
    if (d.detalhe) dados.detalhe = d.detalhe;
    if (d.fixa) dados.fixa = true;
    if (d.hora) dados.hora = d.hora;
    if (d.pessoaId) dados.pessoaId = d.pessoaId;
    if (d.repete) { dados.repete = d.repete; dados.etapa = ''; }
    if (d.prazoTexto) dados.prazo = lerPrazo(d.prazoTexto, hoje).data; else if (d.prazo) dados.prazo = d.prazo;
    if (d.cliente) { dados.clienteNome = d.cliente; dados.clienteKey = d.clienteKey || (b ? chaveCliente(b) : ''); }
    if (b) dados.bookingId = b.id;
    const t = Tarefas.cria(dados);
    if (t && d.feita) Tarefas.marca(t.id, true);
  }
  const o = (DB.orcamentos || []).find(x => x.origem === 'whats');
  if (o) Tarefas.cria({ tipo: 'nota', origem: 'whats', texto: `Resumo do WhatsApp — ${o.cliente.nome}`, detalhe: o.resumo, orcId: o.id, clienteNome: o.cliente.nome, whats: o.cliente.whats });
}

/* ---------- BACKUP ----------
   Um arquivo so, com TUDO o que ela tem (e o que o assistente aprendeu).
   Serve para guardar (pasta do computador, que pode ser a do Google Drive)
   e para VOLTAR: backup que nao restaura nao e backup. */
/* o nome do negocio nos arquivos: "Yalla Experiences" -> "YallaExperiences" */
function negocioArquivo() { return String((typeof guiaNegocio === 'function' && guiaNegocio()) || 'App').replace(/[^A-Za-z0-9]+/g, '') || 'App'; }
const BKP_VERSAO = 'app-backup-2';
const BKP_KEY = 'yalla_bkp_v1';
function pacoteBackup() {
  let memoria = [];
  try { if (typeof Mkt !== 'undefined') memoria = Mkt.get().memoria || []; } catch (e) {}
  return {
    app: negocioArquivo(), versao: BKP_VERSAO, salvoEm: new Date().toISOString(),
    passeios: DB.tours, regras: DB.rules, datas: DB.departures, bloqueios: DB.blocks, cupons: DB.coupons,
    configuracoes: DB.settings, reservas: DB.bookings, vagasVendidas: DB.seatCounts || [],
    pedidos: DB.pedidos || [], equipe: DB.equipe || [], disponibilidade: DB.disp || [],
    contas: DB.contas || [], orcamentos: DB.orcamentos || [], fichas: DB.fichas || {},
    tarefas: DB.tarefas || [], lembretesVistos: DB.lembretesVistos || {}, memoriaAssistente: memoria,
    clientes: DB.clientes || [], parceiros: DB.parceiros || [], pontos: DB.pontos || [], interesse: DB.interesse || {},
  };
}
function resumoBackup(p) {
  const n = (a) => Array.isArray(a) ? a.length : 0;
  return { salvoEm: p.salvoEm || '', reservas: n(p.reservas), passeios: n(p.passeios), guias: n(p.equipe),
           orcamentos: n(p.orcamentos), tarefas: n(p.tarefas), clientes: new Set((p.reservas || []).map(chaveCliente)).size };
}
/* aceita o arquivo antigo (vi-backup-1, so reservas e passeios) e o novo */
function lerBackup(txt) {
  let p; try { p = typeof txt === 'string' ? JSON.parse(txt.replace(/^﻿/, '')) : txt; } catch (e) { return { erro: 'o arquivo não é um backup do app (não abriu)' }; }
  if (!p || !/^(vi-backup|emroma-backup|app-backup)/.test(String(p.versao || ''))) return { erro: 'este arquivo não é um backup do ' + ((typeof guiaNegocio === 'function' && guiaNegocio()) || 'app') };
  if (!Array.isArray(p.reservas) || !Array.isArray(p.passeios)) return { erro: 'o backup está incompleto (faltam reservas ou passeios)' };
  return { p, resumo: resumoBackup(p) };
}
function restauraBackup(txt) {
  const r = lerBackup(txt); if (r.erro) return r;
  const p = r.p, novo = _blank();
  Object.assign(novo, {
    tours: p.passeios, rules: p.regras || [], departures: p.datas || [], blocks: p.bloqueios || [], coupons: p.cupons || [],
    bookings: p.reservas, seatCounts: p.vagasVendidas || [], pedidos: p.pedidos || [],
    equipe: p.equipe || [], disp: p.disponibilidade || [], contas: p.contas || [], orcamentos: p.orcamentos || [],
    fichas: p.fichas || {}, tarefas: p.tarefas || [], lembretesVistos: p.lembretesVistos || {},
    clientes: p.clientes || [], parceiros: p.parceiros || [], pontos: p.pontos || [], interesse: p.interesse || {},
  });
  novo.cadastroFeito = Array.isArray(p.clientes) ? 1 : 0; novo.parceirosSeed = 1; novo.pontosSeed = 1;
  novo.settings = fillSettings(p.configuracoes || {});
  /* voltou dado de verdade: nao e mais demonstracao, e as sementes nao voltam */
  novo.demo = false; novo.opSeed = OP_SEED; novo.tarefasSeed = 1; novo.seedVer = typeof SEED_VER !== 'undefined' ? SEED_VER : 1;
  /* restaurar é de propósito, como o "apagar tudo": quem estava em dia com a
     nuvem continua, e o backup é o que vale (nuvem-itens.js) */
  if (DB && DB._itensEmDia) novo._itensEmDia = true;
  DB = novo;
  try { if (typeof Mkt !== 'undefined' && Array.isArray(p.memoriaAssistente)) { const m = Mkt.get(); m.memoria = p.memoriaAssistente; Mkt.salva(); } } catch (e) {}
  opGarante();
  if (typeof save === 'function') save();
  return { ok: true, resumo: r.resumo };
}
const Backup = {
  ultimo() { try { return JSON.parse(localStorage.getItem(BKP_KEY)) || {}; } catch (e) { return {}; } },
  marca(onde, arquivo) {
    const u = { em: new Date().toISOString(), onde, arquivo: arquivo || '' };
    try { localStorage.setItem(BKP_KEY, JSON.stringify(u)); localStorage.setItem('yalla_bkp_em', String(Date.now())); } catch (e) {}
    return u;
  },
  feitoHoje(hoje) { const u = Backup.ultimo(); return !!u.em && u.em.slice(0, 10) === (hoje || isoToday()); },
  nome(dia) { return `${negocioArquivo()}-backup-${dia || isoToday()}.json`; },
};

/* ---------- CADASTRO DE CLIENTES ----------
   A planilha dela tem "veio por" em toda linha: e assim que ela sabe de onde
   o cliente chega (Instagram, status do WhatsApp, indicacao de alguem,
   influencer, agencia). Aqui cada pessoa e UM cadastro guardado — quem
   reservou e cada um que veio junto — e ele nasce sozinho na hora da
   reserva. Ninguem precisa digitar de novo.
     DB.clientes [{id, nome, whats, email, insta, nasc, pais, idioma, veioPor,
                   indicadoPor (id), indicadoNome, parceiroId, grupoDe (id),
                   obs, criado, atualizado}] */
/* o nome curto, para a coluna "veio por" da planilha */
const VEIO_CURTO = { instagram: 'Instagram', status: 'Status WhatsApp', indicacao: 'Indicação', influencer: 'Influencer', agencia: 'Agência', google: 'Google / site', voltou: 'Já era cliente', junto: 'Veio junto', outro: 'Outro' };
const VEIO_POR = [
  ['instagram', 'Instagram'], ['status', 'Status do WhatsApp'], ['indicacao', 'Indicação de alguém'],
  ['influencer', 'Influencer / cupom'], ['agencia', 'Agência ou parceiro'], ['google', 'Google / site'],
  ['voltou', 'Já era cliente'], ['junto', 'Veio junto com alguém'], ['outro', 'Outro'],
];
const veioPorNome = (v) => (VEIO_POR.find(x => x[0] === v) || [0, v || '—'])[1];
/* as origens antigas das reservas viram o "veio por" */
const ORIGEM_PARA_VEIO = { instagram: 'instagram', friend: 'indicacao', whatsapp: 'status', agency: 'agencia', site: 'google' };
const _nomeN = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
const _dig8 = (v) => String(v || '').replace(/\D/g, '').slice(-8);
/* o numero do cadastro sai do CONTATO da pessoa: o mesmo cliente criado no
   celular e no computador ao mesmo tempo vira a MESMA linha no banco */
function _hashId(s) { let h = 5381; for (const ch of String(s)) h = ((h << 5) + h + ch.charCodeAt(0)) >>> 0; return h.toString(36); }
function idDoCliente(d) { const w = _dig8(d.whats), em = String(d.email || '').trim().toLowerCase(); return 'c' + _hashId(w.length >= 8 ? 'w:' + w : em ? 'e:' + em : 'n:' + _nomeN(d.nome) + (d.grupoDe ? '|' + d.grupoDe : '')); }
const Cadastro = {
  all() { return DB.clientes || []; },
  get(id) { return (DB.clientes || []).find(c => c.id === id) || null; },
  /* o mesmo cliente: WhatsApp (os 8 ultimos digitos), e-mail, ou o nome igual
     quando nenhum dos dois tem contato que diga o contrario */
  acha(d) {
    const l = Cadastro.all(), w = _dig8(d.whats), em = String(d.email || '').trim().toLowerCase(), n = _nomeN(d.nome);
    if (w.length >= 8) { const c = l.find(x => _dig8(x.whats) === w); if (c) return c; }
    if (em) { const c = l.find(x => String(x.email || '').toLowerCase() === em); if (c) return c; }
    if (n) return l.find(x => _nomeN(x.nome) === n && (!w || !_dig8(x.whats)) && (!em || !x.email)) || null;
    return null;
  },
  /* cria ou completa. Nunca apaga um dado que ja existe com um vazio. */
  garante(d) {
    DB.clientes = DB.clientes || [];
    const campos = ['nome', 'whats', 'email', 'insta', 'nasc', 'pais', 'idioma', 'veioPor', 'indicadoPor', 'indicadoNome', 'parceiroId', 'grupoDe', 'obs'];
    let c = Cadastro.acha(d);
    if (!c) {
      if (!String(d.nome || '').trim()) return null;
      c = { id: Cadastro.get(idDoCliente(d)) ? uid() : idDoCliente(d), criado: d.criado || new Date().toISOString() };
      for (const k of campos) c[k] = String(d[k] || '').trim();
      DB.clientes.push(c);
    } else {
      for (const k of campos) if (!String(c[k] || '').trim() && String(d[k] || '').trim()) c[k] = String(d[k]).trim();
      if (d.criado && (!c.criado || d.criado < c.criado)) c.criado = d.criado;
    }
    c.atualizado = new Date().toISOString();
    return c;
  },
  salva(id, d) {
    const c = Cadastro.get(id); if (!c) return null;
    for (const k of Object.keys(d)) c[k] = typeof d[k] === 'string' ? d[k].trim() : d[k];
    if (c.indicadoPor && !c.indicadoNome) c.indicadoNome = (Cadastro.get(c.indicadoPor) || {}).nome || '';
    c.atualizado = new Date().toISOString(); _opSave(); return c;
  },
  novo(d) { const c = Cadastro.garante(d); _opSave(); return c; },
  remove(id) { DB.clientes = Cadastro.all().filter(c => c.id !== id); _opSave(); },
  /* as reservas desta pessoa: as que ela fez e as em que veio junto */
  reservas(c) {
    return DB.bookings.filter(b => b.clienteId === c.id || (b.group || []).some(g => g.clienteId === c.id))
      .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
  },
  indicou(c) { return Cadastro.all().filter(x => x.indicadoPor === c.id); },
  trouxe(c) { return Cadastro.all().filter(x => x.grupoDe === c.id); },
  /* resumo para o dashboard e a ficha */
  resumo(c, hoje) {
    hoje = hoje || isoToday();
    const bs = Cadastro.reservas(c).filter(b => b.status !== 'cancelled');
    const dele = bs.filter(b => b.clienteId === c.id);
    const prox = bs.filter(b => b.date >= hoje).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))[0] || null;
    return { reservas: bs.length, gasto: dele.reduce((s, b) => s + Bookings.paid(b), 0), deve: dele.filter(b => Op.restoPara(b) === 'ingrid').reduce((s, b) => s + Bookings.due(b), 0),
             ultima: bs.map(b => b.date).filter(d => d < hoje).sort().pop() || '', prox, indicou: Cadastro.indicou(c).length, trouxe: Cadastro.trouxe(c).length };
  },
};
/* NA HORA DA RESERVA: quem reservou e cada um do grupo viram cadastro, e a
   reserva guarda o id de cada um. Chamado pelo store.js (create/criarManual). */
function cadastroDaReserva(b) {
  if (!b || !b.name) return null;
  const parc = b.coupon ? (DB.parceiros || []).find(p => String(p.cupom || '').toUpperCase() === String(b.coupon).toUpperCase()) : null;
  let veio = b.veioPor || (parc ? (parc.tipo === 'agencia' ? 'agencia' : 'influencer') : ORIGEM_PARA_VEIO[b.origin] || '');
  let ind = null;
  if (b.indicadoPor) {
    ind = Cadastro.acha({ nome: b.indicadoPor, whats: b.indicadoPor }) || null;
    if (!veio) veio = 'indicacao';
  }
  const ja = Cadastro.acha({ nome: b.name, whats: b.whats, email: b.email });
  const c = Cadastro.garante({ nome: b.name, whats: b.whats, email: b.email, insta: b.insta, idioma: b.lang, nasc: b.nasc,
    veioPor: ja && Cadastro.reservas(ja).length ? '' : veio, indicadoPor: ind ? ind.id : '', indicadoNome: ind ? ind.nome : (b.indicadoPor || ''),
    parceiroId: parc ? parc.id : '', criado: String(b.createdAt || '').slice(0, 10) ? b.createdAt : '' });
  if (!c) return null;
  b.clienteId = c.id;
  for (const g of b.group || []) {
    if (!g || !String(g.nome || '').trim()) continue;
    const gc = Cadastro.garante({ nome: g.nome, whats: g.whats, nasc: g.nasc, veioPor: 'junto', grupoDe: c.id, criado: b.createdAt });
    if (gc) g.clienteId = gc.id;
  }
  return c;
}

/* reserva que chegou da nuvem (o cliente reservou pelo site) ainda nao tem
   cadastro neste aparelho: completa aqui, antes de desenhar o painel */
/* a chave das anotacoes (Fichas) de um cadastro */
function chaveFicha(c) { const b = DB.bookings.find(x => x.clienteId === c.id); return b ? chaveCliente(b) : String(c.email || c.whats || c.nome || '').toLowerCase(); }
function cadastroEmDia() {
  let n = 0;
  for (const b of DB.bookings || []) if (!b.clienteId && b.name) { cadastroDaReserva(b); n++; }
  if (n) _opSave();
  return n;
}

/* ---------- PARCERIAS E CUPONS DE INFLUENCER ----------
   Influencer, agencia ou parceiro com cupom proprio. O app conta quantas
   reservas vieram por ele, quanto faturou e a comissao que ela deve.
     DB.parceiros [{id, nome, tipo, contato, cupom, desconto, comissao, obs, pagamentos:[{valor, data}]}] */
const TIPOS_PARCEIRO = [['influencer', 'Influencer'], ['agencia', 'Agência'], ['parceiro', 'Parceiro (hotel, loja…)']];
const Parceiros = {
  all() { return DB.parceiros || []; },
  get(id) { return (DB.parceiros || []).find(p => p.id === id) || null; },
  salva(d) {
    DB.parceiros = DB.parceiros || [];
    const nome = String(d.nome || '').trim(); if (!nome) return { erro: 'falta o nome' };
    const cupom = String(d.cupom || '').toUpperCase().replace(/\s+/g, '');
    let p = d.id && Parceiros.get(d.id);
    if (cupom && Parceiros.all().some(x => x.cupom === cupom && x !== p)) return { erro: 'já existe um parceiro com esse cupom' };
    const dados = { nome, tipo: TIPOS_PARCEIRO.some(t => t[0] === d.tipo) ? d.tipo : 'influencer', contato: String(d.contato || '').trim(),
      cupom, desconto: Math.max(0, Math.min(100, +d.desconto || 0)), comissao: Math.max(0, Math.min(100, +d.comissao || 0)), obs: String(d.obs || '').trim() };
    if (p) {
      const antigo = p.cupom;
      Object.assign(p, dados);
      if (antigo && antigo !== cupom) DB.coupons = DB.coupons.filter(c => c.code !== antigo);
    } else { p = { id: uid(), criado: isoToday(), pagamentos: [], ...dados }; DB.parceiros.push(p); }
    /* o cupom de verdade, o que o cliente digita na reserva */
    if (cupom) {
      let c = DB.coupons.find(x => x.code === cupom);
      if (!c) { c = { code: cupom, pct: dados.desconto, until: '2099-12-31', oncePerPerson: false, uses: [] }; DB.coupons.push(c); }
      c.pct = dados.desconto; c.parceiroId = p.id;
    }
    _opSave(); return p;
  },
  remove(id) { const p = Parceiros.get(id); if (!p) return; DB.parceiros = Parceiros.all().filter(x => x.id !== id); if (p.cupom) DB.coupons = DB.coupons.filter(c => c.code !== p.cupom); _opSave(); },
  reservas(p) {
    return DB.bookings.filter(b => b.status !== 'cancelled' && ((p.cupom && String(b.coupon || '').toUpperCase() === p.cupom) || b.parceiroId === p.id))
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  /* comissao sobre o valor dos servicos (total), nao sobre o que ja entrou */
  conta(p) {
    const bs = Parceiros.reservas(p);
    const faturado = bs.reduce((s, b) => s + (+b.total || 0), 0);
    const devida = Math.round(faturado * (+p.comissao || 0)) / 100;
    const paga = (p.pagamentos || []).reduce((s, x) => s + (+x.valor || 0), 0);
    const clientes = new Set(bs.map(b => b.clienteId || chaveCliente(b))).size;
    return { reservas: bs.length, clientes, faturado, devida, paga, saldo: Math.round((devida - paga) * 100) / 100 };
  },
  paga(id, valor, data, ref) { const p = Parceiros.get(id); if (!p || !(+valor > 0)) return null; p.pagamentos = p.pagamentos || []; p.pagamentos.push({ id: uid(), valor: +valor, data: data || isoToday(), ref: ref || '' }); _opSave(); return p; },
  /* o parceiro de UMA reserva (a mesma regra de reservas(): ligado ou pelo cupom) */
  daReserva(b) {
    if (b.parceiroId) return Parceiros.get(b.parceiroId);
    const cup = String(b.coupon || '').toUpperCase();
    return cup ? Parceiros.all().find(p => p.cupom && p.cupom === cup) || null : null;
  },
  comissaoDe(b) { const p = Parceiros.daReserva(b); return p ? Math.round((+b.total || 0) * (+p.comissao || 0)) / 100 : 0; },
  /* "dentro de cada cliente… a parte da comissão, se já pagou ou não" (Milla, 01/10):
     a comissão de UMA reserva marcada como paga entra nos pagamentos do parceiro
     (com a referência da reserva), e desmarcar tira — a conta do parceiro bate sempre */
  pagaReserva(bookingId, pagar) {
    const b = Bookings.get(bookingId), p = b && Parceiros.daReserva(b); if (!p) return null;
    p.pagamentos = (p.pagamentos || []).filter(x => x.ref !== b.id);
    if (pagar) p.pagamentos.push({ id: uid(), valor: Parceiros.comissaoDe(b), data: isoToday(), ref: b.id });
    _opSave(); return Parceiros.pagaDaReserva(b);
  },
  pagaDaReserva(b) { const p = Parceiros.daReserva(b); return p ? (p.pagamentos || []).find(x => x.ref === b.id) || null : null; },
};

/* ---------- PARCEIROS (fornecedores) — o "one stop shop" ----------
   Pedido da Milla (01/10/2026): "CRIAR ABA PARCEIROS — dentro vai ter
   TRANSFER / compra de ingressos.. hotel /// ONE STOP SHOP". O cliente
   resolve tudo com ela; ela compra de quem confia. Aqui ficam:
     DB.fornecedores [{id, nome, tipo, whats, email, site, comissao, obs}]
     Booking.pedidosFor [{id, fornecedorId, tipo, desc, custo, status, ref, em}]
   status: 'apedir' -> 'pedido' -> 'confirmado'. O custo entra nas saídas da
   Contabilidade; o pedido pendente segura a reserva na etapa certa do Pipeline.
   (Os parceiros que TRAZEM cliente — agência, influencer — continuam em
   Cupons e indicações.) */
const FORN_TIPOS = [['transfer', '🚘', 'Transfer'], ['ingressos', '🎟', 'Ingressos'], ['hotel', '🏨', 'Hotel'],
                    ['passeio', '🧭', 'Passeios e guias'], ['restaurante', '🍽', 'Restaurantes'], ['outro', '🔗', 'Outros']];
const PED_FOR_ST = [['apedir', 'a pedir'], ['pedido', 'pedido, esperando'], ['confirmado', 'confirmado']];
const fornTipo = (t) => FORN_TIPOS.find(x => x[0] === t) || FORN_TIPOS[FORN_TIPOS.length - 1];
const Fornecedores = {
  all(tipo) { const l = DB.fornecedores || []; return tipo ? l.filter(f => f.tipo === tipo) : l; },
  get(id) { return (DB.fornecedores || []).find(f => f.id === id) || null; },
  salva(d) {
    const nome = String(d.nome || '').trim(); if (!nome) return { erro: 'falta o nome do parceiro' };
    DB.fornecedores = DB.fornecedores || [];
    const dados = { nome, tipo: FORN_TIPOS.some(x => x[0] === d.tipo) ? d.tipo : 'outro', whats: String(d.whats || '').trim(),
      email: String(d.email || '').trim(), site: String(d.site || '').trim(), comissao: Math.max(0, Math.min(100, +d.comissao || 0)), obs: String(d.obs || '').trim() };
    let f = d.id && Fornecedores.get(d.id);
    if (f) Object.assign(f, dados); else { f = { id: uid(), ...dados }; DB.fornecedores.push(f); }
    _opSave(); return f;
  },
  remove(id) { DB.fornecedores = (DB.fornecedores || []).filter(f => f.id !== id); _opSave(); },
};
const PedidosFor = {
  daReserva(b) { return (b && b.pedidosFor) || []; },
  /* todos os pedidos de reservas ativas, do serviço mais próximo ao mais longe */
  todos({ deData } = {}) {
    const out = [];
    for (const b of DB.bookings) {
      if (b.status === 'cancelled' || (deData && b.date < deData)) continue;
      for (const p of PedidosFor.daReserva(b)) out.push({ b, p, f: Fornecedores.get(p.fornecedorId) });
    }
    return out.sort((x, y) => (x.b.date + (x.b.time || '')).localeCompare(y.b.date + (y.b.time || '')));
  },
  cria(bookingId, d) {
    const b = Bookings.get(bookingId); if (!b) return { erro: 'reserva não encontrada' };
    const f = d.fornecedorId ? Fornecedores.get(d.fornecedorId) : null;
    const p = { id: uid(), fornecedorId: f ? f.id : '', tipo: d.tipo || (f ? f.tipo : 'outro'), desc: String(d.desc || '').trim(),
      custo: Math.max(0, +d.custo || 0), status: PED_FOR_ST.some(x => x[0] === d.status) ? d.status : 'apedir', ref: String(d.ref || '').trim(), em: isoToday() };
    b.pedidosFor = [...PedidosFor.daReserva(b), p]; _opSaveBooking(b); return p;
  },
  muda(bookingId, id, patch) {
    const b = Bookings.get(bookingId); const p = PedidosFor.daReserva(b).find(x => x.id === id); if (!p) return null;
    if (patch.status && PED_FOR_ST.some(x => x[0] === patch.status)) p.status = patch.status;
    /* ingresso confirmado pelo parceiro = ingressos comprados na reserva */
    if (p.tipo === 'ingressos') b.ingressosOk = p.status === 'confirmado' ? (b.ingressosOk || isoToday()) : '';
    if (patch.ref !== undefined) p.ref = String(patch.ref || '').trim();
    if (patch.custo !== undefined) p.custo = Math.max(0, +patch.custo || 0);
    if (patch.desc !== undefined) p.desc = String(patch.desc || '').trim();
    if (patch.fornecedorId !== undefined) p.fornecedorId = patch.fornecedorId;
    _opSaveBooking(b); return p;
  },
  remove(bookingId, id) { const b = Bookings.get(bookingId); if (!b) return; b.pedidosFor = PedidosFor.daReserva(b).filter(x => x.id !== id); _opSaveBooking(b); },
  pendentes(b) { return PedidosFor.daReserva(b).filter(p => p.status !== 'confirmado'); },
  custo(b) { return PedidosFor.daReserva(b).reduce((s, p) => s + (+p.custo || 0), 0); },
};
/* a mensagem pronta para o parceiro (na língua do conteudo.js: em Dubai, inglês) */
function msgFornecedor(b, p) {
  const en = ((typeof CONTEUDO !== 'undefined' && CONTEUDO.transfer && CONTEUDO.transfer.idioma) || 'pt') === 'en';
  const d = b.date ? b.date.slice(8, 10) + '/' + b.date.slice(5, 7) + '/' + b.date.slice(0, 4) : '';
  const L = en
    ? [`Hello! Request from ${guiaNegocio()}:`, `• ${p.desc || nomeDoServico(b)}`, `• Date: ${d}${b.time ? ' · ' + b.time : ''}`, `• Guest: ${b.name} · ${b.pax || 1} pax`,
       b.voo ? `• Flight: ${b.voo}` : '', b.destino ? `• Hotel/destination: ${b.destino}` : '', `• Ref.: ${b.code || b.id}`, 'Please confirm availability and price. Thank you!']
    : [`Olá! Pedido da ${guiaNegocio()}:`, `• ${p.desc || nomeDoServico(b)}`, `• Data: ${d}${b.time ? ' · ' + b.time : ''}`, `• Cliente: ${b.name} · ${b.pax || 1} pessoa(s)`,
       b.voo ? `• Voo: ${b.voo}` : '', b.destino ? `• Hotel/destino: ${b.destino}` : '', `• Ref.: ${b.code || b.id}`, 'Pode confirmar disponibilidade e valor? Obrigada!'];
  return L.filter(Boolean).join('\n');
}
/* o que ainda falta comprar/pedir para esta reserva (ingressos, transfer, parceiros) */
function pendenciasCompra(b) {
  const l = [];
  if (Op.precisaIngresso(b) && !b.ingressosOk && !PedidosFor.daReserva(b).some(p => p.tipo === 'ingressos')) l.push('comprar ingressos');
  if (typeof ehTransfer === 'function' && ehTransfer(b) && !b.ncc && !PedidosFor.daReserva(b).some(p => p.tipo === 'transfer')) l.push('pedir o transfer');
  for (const p of PedidosFor.pendentes(b)) l.push((p.status === 'apedir' ? 'pedir ' : 'confirmar ') + (fornTipo(p.tipo)[2].toLowerCase()) + (Fornecedores.get(p.fornecedorId) ? ' (' + Fornecedores.get(p.fornecedorId).nome + ')' : ''));
  return l;
}

/* ---------- SAÍDAS E LÍQUIDO (pedido da Milla, 01/10/2026: "MELHORAR A
   CONTABILIDADE do app: tudo que entra, tudo que sai, líquido") ----------
   Saem: o custo de quem fez o serviço (guia/motorista), o custo dos pedidos aos
   parceiros (ingressos, transfer, hotel), as comissões pagas a quem indicou e as
   despesas avulsas (DB.despesas). Entradas = os pagamentos recebidos no período;
   saídas = os custos dos serviços DO período (pela data do serviço) + despesas
   e comissões pela data em que foram pagas. */
const DESP_CAT = [['operacao', 'Operação'], ['marketing', 'Marketing'], ['licenca', 'Licenças e taxas'], ['transporte', 'Transporte'], ['outros', 'Outros']];
const Despesas = {
  all() { return [...(DB.despesas || [])].sort((a, b) => String(b.data).localeCompare(String(a.data))); },
  salva(d) {
    const desc = String(d.desc || '').trim(), valor = Math.round((+d.valor || 0) * 100) / 100;
    if (!desc || !(valor > 0)) return { erro: 'falta a descrição ou o valor' };
    DB.despesas = DB.despesas || [];
    const x = { id: d.id || uid(), data: d.data || isoToday(), desc, valor, categoria: DESP_CAT.some(c => c[0] === d.categoria) ? d.categoria : 'outros', conta: d.conta || '' };
    const k = DB.despesas.findIndex(y => y.id === x.id); if (k >= 0) DB.despesas[k] = x; else DB.despesas.push(x);
    _opSave(); return x;
  },
  remove(id) { DB.despesas = (DB.despesas || []).filter(x => x.id !== id); _opSave(); },
};
function saidasDoPeriodo(de, ate) {
  const L = [];
  for (const b of DB.bookings) {
    if (b.status === 'cancelled' || b.date < de || b.date > ate) continue;
    if (+b.custo > 0) L.push({ data: b.date, tipo: 'servico', desc: `${(b.prestadorId && Equipe.get(b.prestadorId) || {}).nome || 'Guia/motorista'} — ${nomeDoServico(b)} · ${b.name}`, valor: +b.custo, b });
    for (const p of PedidosFor.daReserva(b)) if (+p.custo > 0)
      L.push({ data: b.date, tipo: 'parceiro', desc: `${(Fornecedores.get(p.fornecedorId) || {}).nome || 'Parceiro'} — ${p.desc || fornTipo(p.tipo)[2]} · ${b.name}`, valor: +p.custo, b });
  }
  for (const par of DB.parceiros || []) for (const pg of par.pagamentos || [])
    if (pg.data >= de && pg.data <= ate) L.push({ data: pg.data, tipo: 'comissao', desc: `Comissão — ${par.nome}`, valor: +pg.valor || 0 });
  for (const d of DB.despesas || []) if (d.data >= de && d.data <= ate)
    L.push({ data: d.data, tipo: 'despesa', desc: d.desc, valor: d.valor, id: d.id, categoria: d.categoria });
  return L.sort((a, b) => String(a.data).localeCompare(String(b.data)));
}
/* a margem de cada serviço do período: o que o cliente paga − o que sai por ele */
function margensDoPeriodo(de, ate) {
  return DB.bookings.filter(b => b.status !== 'cancelled' && b.date >= de && b.date <= ate).map(b => {
    const custo = (+b.custo || 0) + PedidosFor.custo(b) + (typeof Parceiros !== 'undefined' && Parceiros.comissaoDe ? Parceiros.comissaoDe(b) : 0);
    return { b, receita: +b.total || 0, custo, margem: (+b.total || 0) - custo };
  }).sort((a, b) => a.b.date.localeCompare(b.b.date));
}

/* ---------- idade, servico escrito, comprovante, interesse ---------- */
/* "12/03/1985" ou "1985-03-12" -> anos completos hoje */
function idadeDe(nasc, hoje) {
  const s = String(nasc || '').trim(); let d, m, y;
  let x = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (x) { d = +x[1]; m = +x[2]; y = +x[3]; }
  else if ((x = s.match(/^(\d{4})-(\d{2})-(\d{2})$/))) { y = +x[1]; m = +x[2]; d = +x[3]; } else return null;
  const h = new Date((hoje || isoToday()) + 'T12:00:00');
  let a = h.getFullYear() - y; if (h.getMonth() + 1 < m || (h.getMonth() + 1 === m && h.getDate() < d)) a--;
  return a >= 0 && a < 120 ? a : null;
}
function aniversarioNoMes(nasc, mes) { const s = String(nasc || ''); const x = s.match(/^(\d{1,2})\/(\d{1,2})\//) || s.match(/^\d{4}-(\d{2})-(\d{2})$/); if (!x) return null; return s.includes('/') ? (+x[2] === mes ? +x[1] : null) : (+x[1] === mes ? +x[2] : null); }
/* quem vai no servico: o comprador (se vai) e o grupo */
function participantesDe(b) {
  const l = [];
  if (b.compradorVai !== false) l.push({ nome: b.name, nasc: b.nasc || '', clienteId: b.clienteId || '', comprador: true });
  for (const g of b.group || []) if (g && g.nome) l.push({ nome: g.nome, nasc: g.nasc || '', clienteId: g.clienteId || '' });
  return l;
}
/* a planilha dela descreve o servico com as proprias palavras ("MXP TP 824 x
   Ibis Styles Milano Centro"); quando existe, e isso que aparece */
function nomeDoServico(b) { if (b.servicoTxt) return b.servicoTxt; const x = typeof Tours !== 'undefined' && Tours.get(b.tourId); return x ? (x.name.pt || '') : '?'; }
/* o comprovante do pagamento: o link do arquivo (Drive, foto) */
function comprovante(bookingId, idx, url) {
  const b = Bookings.get(bookingId); if (!b || !b.payments[idx]) return null;
  const u = String(url || '').trim(); if (u && !/^https?:\/\//i.test(u)) return { erro: 'o link precisa começar com http' };
  b.payments[idx].comprovante = u; _opSaveBooking(b); return b.payments[idx];
}
/* quantas vezes abriram cada passeio e quantas chegaram a preencher os dados.
   So conta no aparelho de quem visita; com o banco ligado, vai para a nuvem. */
const Interesse = {
  conta(tourId, tipo) {
    if (!tourId || (tipo !== 'visitas' && tipo !== 'quase')) return;
    DB.interesse = DB.interesse || {};
    const i = DB.interesse[tourId] = DB.interesse[tourId] || {}, c = i[tipo] = i[tipo] || {}, h = isoToday();
    c[h] = (+c[h] || 0) + 1;
    const dias = Object.keys(c).sort(); if (dias.length > 180) for (const d of dias.slice(0, dias.length - 180)) delete c[d];
    /* e por canal (de onde a pessoa veio) */
    const can = (typeof canalAtual === 'function') ? canalAtual() : 'direto';
    const ic = DB.interesseCanal = DB.interesseCanal || {}, cc = (ic[can] = ic[can] || {}), ct = (cc[tipo] = cc[tipo] || {});
    ct[h] = (+ct[h] || 0) + 1;
    _opSave();
  },
  /* por canal: aberturas, "quase", reservas e pedidos no período, conversão */
  porCanal(de, ate) {
    const ic = DB.interesseCanal || {};
    const soma = (o) => Object.entries(o || {}).reduce((n, [d, v]) => n + (d >= de && d <= ate ? (+v || 0) : 0), 0);
    const no = (x) => String(x || '').slice(0, 10);
    return CANAIS.map(([k, nome]) => {
      const visitas = soma((ic[k] || {}).visitas), quase = soma((ic[k] || {}).quase);
      const reservas = DB.bookings.filter(b => b.status !== 'cancelled' && (b.canal || '') === k && no(b.createdAt) >= de && no(b.createdAt) <= ate).length;
      const pedidos = (DB.pedidos || []).filter(p => (p.canal || '') === k && no(p.criado) >= de && no(p.criado) <= ate).length;
      return { canal: k, nome, visitas, quase, reservas, pedidos, conv: visitas ? (reservas + pedidos) / visitas : null };
    }).filter(r => r.visitas || r.reservas || r.pedidos);
  },
  soma(tourId, tipo, de, ate) { const c = ((DB.interesse || {})[tourId] || {})[tipo] || {}; return Object.entries(c).reduce((n, [d, v]) => n + (d >= de && d <= ate ? (+v || 0) : 0), 0); },
  /* por passeio: visitas, quase reservaram, reservas feitas no periodo, conversao.
     Conversao = reservas (por qualquer caminho) / aberturas: quase todo mundo ve
     o passeio no app e fecha pelo WhatsApp, entao so "pelo site" enganaria. */
  funil(de, ate) {
    return Tours.all().map(x => {
      const bs = DB.bookings.filter(b => b.tourId === x.id && b.status !== 'cancelled' && String(b.createdAt || '').slice(0, 10) >= de && String(b.createdAt || '').slice(0, 10) <= ate);
      const visitas = Interesse.soma(x.id, 'visitas', de, ate), quase = Interesse.soma(x.id, 'quase', de, ate);
      const pelo = bs.filter(b => b.origin === 'site').length;
      return { tourId: x.id, nome: x.name.pt, visitas, quase, reservas: bs.length, peloSite: pelo, valor: bs.reduce((s, b) => s + (+b.total || 0), 0),
               conv: visitas ? bs.length / visitas : null };
    }).filter(r => r.visitas || r.reservas).sort((a, b) => b.visitas - a.visitas || b.reservas - a.reservas);
  },
};

/* ---------- IMPORTAR A PLANILHA DELA (o CRM) ----------
   Ela baixa a planilha como CSV (Arquivo > Fazer download > .csv) e o app le
   as colunas pelo NOME do cabecalho, em qualquer ordem: Data, veio por,
   Whatsapp, Nome, Data Servico, Hora, PAX, Servico pedido, Obs, Cliente Paga,
   Ingrid Paga, Cidade. Cada linha vira uma reserva, cada nome um cadastro. */
function lerCsv(txt) {
  const linhas = []; let campo = '', linha = [], aspas = false;
  const t = String(txt || '').replace(/^﻿/, '');
  const sep = (t.split('\n')[0].match(/;/g) || []).length > (t.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (aspas) { if (ch === '"' && t[i + 1] === '"') { campo += '"'; i++; } else if (ch === '"') aspas = false; else campo += ch; continue; }
    if (ch === '"') aspas = true; else if (ch === sep) { linha.push(campo); campo = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && t[i + 1] === '\n') i++; linha.push(campo); linhas.push(linha); linha = []; campo = ''; }
    else campo += ch;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }
  return linhas.filter(l => l.some(c => String(c).trim()));
}
function _dataPlanilha(v) {
  const m = String(v || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) return '';
  const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
  return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}
function _valorPlanilha(v) {
  let s = String(v || '').replace(/[€$R\s]/g, ''); if (!s) return 0;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
  return +s || 0;
}
const COLS_CRM = {
  data: /^data( do)? ?or[cç]amento$|^data$/, veio: /^veio/, indicou: /^agencia|^quem indicou|^quem\??$|influenc/, whats: /whats|telefone|fone/, nome: /^nome( do cliente| completo)?$/, dataServ: /data ?servi/,
  hora: /^hora/, pax: /^pax|pessoas/, servico: /servi[cç]o/, obs: /^obs/, clientePaga: /cliente ?paga/, ingridPaga: /ingrid ?paga|voc[eê] paga|custo/, cidade: /cidade|hotel/,
  parceiro: /^parceiro/, total: /^total/, sinal: /^sinal/, forma: /forma/, emReal: /em real/, comVendor: /comiss.*vend/, comIndic: /comiss.*indic/,
  status: /^status/, motivo: /motivo/, rep1: /^repescagem ?1/, res1: /^resultado ?1/, rep2: /^repescagem ?2/, res2: /^resultado ?2/, rep3: /^repescagem ?3/, res3: /^resultado ?3/,
  arquivo: /nome do arquivo/, lPdf: /link ?pdf/, lOrc: /link ?or/, lVoucher: /link ?voucher/, lComprov: /link ?comprov/, lAval: /link ?avalia/,
};
/* o Status da planilha decide o que a linha vira:
   Enviado (ou vazio)            -> orcamento em aberto (CRM)
   CONFIRMADO / AVALIAR / FINAL. -> reserva (com o sinal na conta certa)
   Perdido                       -> orcamento perdido, com o motivo
   Planilha SEM coluna Status (a lista antiga) -> tudo reserva. */
function _etapaPlanilha(v, temStatus) {
  const t = String(v || '').toLowerCase().normalize('NFD').replace(/[^a-z]/g, '');
  if (!temStatus) return 'confirmado';
  if (/confirm/.test(t)) return 'confirmado';
  if (/avali/.test(t)) return 'avaliar';
  if (/finaliz/.test(t)) return 'finalizado';
  if (/perd|cancel/.test(t)) return 'perdido';
  return 'aberto';
}
function _contaDaForma(v) {
  const t = String(v || '').toLowerCase();
  if (/pix|nubank/.test(t)) return 'nubank';
  if (/wise/.test(t)) return /br|real|brasil/.test(t) ? 'wise-br' : 'wise-eu';
  if (/revolut/.test(t)) return 'revolut';
  if (/cart|card|link|credito|crédito/.test(t)) return 'cartao';
  if (/dinheiro|cash|esp[eé]cie/.test(t)) return 'dinheiro';
  return t ? 'nubank' : '';
}
const LINKS_PLANILHA = [['lPdf', 'PDF'], ['lOrc', 'Orçamento'], ['lVoucher', 'Voucher'], ['lComprov', 'Comprovante'], ['lAval', 'Avaliação']];
/* os dois servicos "avulsos": o que ela escreve a mao (planilha) nao cabe no catalogo */
const RE_TRANSFER = /\b(FCO|CIA|MXP|LIN|BGY|VCE|NAP|FLR|PSA)\b|transfer|aeroporto|porto|esta[cç][aã]o| x /i;
function tourAvulso(tipo) {
  const id = tipo === 'transfer' ? 'avulso-transfer' : 'avulso-servico';
  if (!Tours.get(id)) DB.tours.push({ id, type: tipo === 'transfer' ? 'transfer' : 'walk', region: (typeof regioes === 'function' && (regioes()[0] || [])[0]) || 'base',
    name: { pt: tipo === 'transfer' ? 'Transfer (da planilha)' : 'Serviço (da planilha)', en: tipo === 'transfer' ? 'Transfer' : 'Service' },
    desc: { pt: '', en: '' }, meeting: '', price: 0, priceMode: 'session', min: 1, max: 60, payPolicy: 'sinal', status: 'draft', order: 999, photo: 'capa.jpg' });
  return id;
}
function importarPlanilha(txt, simular) {
  const L = lerCsv(txt);
  const n = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\[[^\]]*\]|\([^)]*\)/g, '').replace(/\s+/g, ' ').trim();
  const hi = L.findIndex(l => l.some(c => /^nome$/.test(n(c))) && l.some(c => /servi/.test(n(c))));
  if (hi < 0) return { erro: 'não achei o cabeçalho (preciso das colunas Nome e Serviço pedido)' };
  const cab = L[hi].map(n), col = {};
  for (const [k, re] of Object.entries(COLS_CRM)) {
    const j = cab.findIndex((c, idx) => re.test(c) && !Object.values(col).includes(idx) && !(k === 'data' && /servi/.test(c)) && !(k === 'servico' && /data|arquivo/.test(c)));
    if (j >= 0) col[k] = j;
  }
  if (col.clientePaga === undefined && col.total !== undefined) { col.clientePaga = col.total; delete col.total; }
  if (col.nome === undefined || col.servico === undefined || col.dataServ === undefined) return { erro: 'faltam colunas: preciso de Nome, Data Serviço e Serviço pedido' };
  const temStatus = col.status !== undefined;
  const out = [], pulou = [];
  for (const l of L.slice(hi + 1)) {
    const get = (k) => col[k] === undefined ? '' : String(l[col[k]] || '').trim();
    let nome = get('nome'); const serv = get('servico').replace(/\s+/g, ' '), dataTxt = get('dataServ'), data = _dataPlanilha(dataTxt);
    if (nome === '-' || (!nome && !serv) || (!nome && !get('whats') && !get('arquivo'))) continue;
    if (!nome || nome === '?') nome = get('arquivo').replace(/^[\d_ ]+/, '').replace(/\?/g, '').trim() || (get('whats') ? 'Cliente ' + get('whats').replace(/\D/g, '').slice(-4) : 'Sem nome');
    const etapa = _etapaPlanilha(get('status'), temStatus);
    if (!data && etapa !== 'aberto' && etapa !== 'perdido') { pulou.push(nome); continue; }
    const ehTransfer = RE_TRANSFER.test(serv);
    const paxTxt = get('pax'), extra = (paxTxt.match(/\((.*)\)/s) || [])[1];
    const reps = [1, 2, 3].map(k => ({ n: k, data: _dataPlanilha(get('rep' + k)), resultado: get('res' + k) || (get('rep' + k) && !_dataPlanilha(get('rep' + k)) ? get('rep' + k) : '') }))
      .filter(x => x.data || x.resultado).map(x => ({ ...x, resultado: x.resultado || 'mandada' }));
    out.push({ nome, whats: get('whats'), veio: get('veio'), indicou: get('indicou'), criado: _dataPlanilha(get('data')), data, dataTxt: data ? '' : dataTxt,
      hora: (get('hora').match(/\d{1,2}:\d{2}/) || [''])[0], pax: parseInt(paxTxt, 10) || 1, paxObs: extra ? extra.replace(/\s+/g, ' ').trim() : '',
      servico: serv || '(sem serviço)', obs: get('obs'), total: _valorPlanilha(get('clientePaga')), custo: _valorPlanilha(get('ingridPaga')),
      cidade: get('cidade'), parceiro: get('parceiro'), totalPedido: _valorPlanilha(get('total')), sinal: _valorPlanilha(get('sinal')), forma: get('forma'),
      emReal: _valorPlanilha(get('emReal')), comVendor: _valorPlanilha(get('comVendor')), comIndic: _valorPlanilha(get('comIndic')),
      etapa, motivo: get('motivo'), repescagens: reps, arquivo: get('arquivo'),
      links: LINKS_PLANILHA.map(([k, nm]) => ({ nome: nm, url: get(k) })).filter(x => /^https?:\/\//i.test(x.url)), tipo: ehTransfer ? 'transfer' : 'servico' });
  }
  /* as linhas do mesmo pedido: o mesmo arquivo (ou o mesmo cliente no mesmo dia) e o mesmo PDF
     (cada pedido tem o seu PDF; sem PDF, o mesmo Total). As duas opcoes da Aline
     (3 pessoas e 5 pessoas) tem o mesmo arquivo e PDFs diferentes: dois pedidos. */
  const chave = (r) => { const pdf = (r.links || []).find(l => l.nome === 'PDF');
    return [_nomeN(r.arquivo) || (_dig8(r.whats) || _nomeN(r.nome)) + '|' + r.criado, pdf ? pdf.url : (r.totalPedido || '')].join('#'); };
  const pedidos = new Map();
  for (const r of out) { const k = chave(r); (pedidos.get(k) || pedidos.set(k, []).get(k)).push(r); }
  const orcs = [...pedidos.entries()].filter(([, rs]) => rs[0].etapa === 'aberto' || rs[0].etapa === 'perdido');
  const res = out.filter(r => r.etapa !== 'aberto' && r.etapa !== 'perdido');
  if (simular) return { linhas: out, pulou, clientes: new Set(out.map(r => _dig8(r.whats) || _nomeN(r.nome))).size, orcamentos: orcs.length, reservas: res.length };
  const garanteAvulso = tourAvulso;
  const VEIO = [[/status/i, 'status'], [/insta/i, 'instagram'], [/indic|amig|filh|m[aã]e|pai|irm/i, 'indicacao'], [/ag[eê]ncia|rpv|viage|turismo|tour/i, 'agencia'], [/google|site/i, 'google'], [/influ|cupom/i, 'influencer']];
  const veioDe = (r) => (VEIO.find(([re]) => re.test(r.veio)) || [0, r.veio ? 'agencia' : ''])[1];
  const quemDe = (r) => r.indicou || (['agencia', 'indicacao', 'influencer'].includes(veioDe(r)) && !/^status|insta|google|site/i.test(r.veio) ? r.veio : '');
  const obsDe = (r) => [r.obs, r.paxObs, r.dataTxt && 'data: ' + r.dataTxt].filter(Boolean).join(' · ');
  let criadas = 0, orcCriados = 0;
  /* orcamentos (Enviado / Perdido) */
  for (const [k, rs] of orcs) {
    const r0 = rs[0];
    if ((DB.orcamentos || []).some(o => o.chavePlanilha === k)) continue;
    const o = Orc.cria({ origem: 'planilha', status: r0.etapa === 'perdido' ? 'perdido' : 'enviado', cliente: { nome: r0.nome, whats: r0.whats }, sinalPct: 0,
      itens: rs.map((r, x) => ({ desc: r.servico, data: r.data, hora: r.hora, pax: r.pax, valor: r.total, custo: r.custo, obs: [obsDe(r), r.cidade].filter(Boolean).join(' · '), sinal: x === 0 ? r0.sinal : 0 })) });
    Object.assign(o, { chavePlanilha: k, veio: r0.veio, veioPor: veioDe(r0), indicou: quemDe(r0), arquivo: r0.arquivo, motivoPerda: r0.etapa === 'perdido' ? (r0.motivo || 'Outro') : '',
      repescagens: r0.repescagens, links: r0.links, parceiroTxt: r0.parceiro, comVendor: r0.comVendor, comIndic: r0.comIndic, validade: addDays(isoToday(), 7) });
    if (r0.criado) o.criado = r0.criado + 'T10:00:00.000Z';
    orcCriados++;
  }
  /* reservas (CONFIRMADO / AVALIAR / FINALIZADO): o Sinal e do pedido inteiro, entra uma vez */
  const restaSinal = new Map();
  for (const r of res) {
    const ja = DB.bookings.some(b => b.date === r.data && _nomeN(b.name) === _nomeN(r.nome) && (b.servicoTxt || '') === r.servico);
    if (ja) continue;
    const b = Bookings.criarManual({ tourId: garanteAvulso(r.tipo), date: r.data, time: r.hora || '09:00', name: r.nome, whats: r.whats, pax: r.pax, total: r.total, recebido: 0,
      veioPor: veioDe(r), indicadoPor: /indic|filh|m[aã]e|reservou/i.test(r.veio) ? r.veio : '' });
    b.servicoTxt = r.servico; b.obsOp = [obsDe(r), r.cidade].filter(Boolean).join(' · '); b.custo = r.custo; b.origin = 'planilha'; b.policy = 'sinal';
    Object.assign(b, { veioTxt: r.veio, indicou: quemDe(r), parceiroTxt: r.parceiro, comVendor: r.comVendor, comIndic: r.comIndic, arquivo: r.arquivo, links: r.links });
    if (r.criado) b.createdAt = r.criado + 'T10:00:00.000Z';
    if (r.etapa === 'finalizado') b.avaliacaoEm = r.data;
    const k = chave(r);
    if (!restaSinal.has(k)) restaSinal.set(k, r.sinal || 0);
    const v = Math.min(restaSinal.get(k), b.total || restaSinal.get(k));
    if (v > 0) {
      const p = registraPagamento(b.id, { valor: v, conta: _contaDaForma(r.forma), data: r.criado || isoToday() });
      if (p) { if (r.emReal && restaSinal.get(k) === r.sinal) { p.reais = r.emReal; _opSaveBooking(b); } restaSinal.set(k, restaSinal.get(k) - p.amount); }
    }
    if (r.veio && !b.indicadoPor) { const c = Cadastro.get(b.clienteId); if (c && !c.obs) c.obs = 'veio por: ' + r.veio; }
    criadas++;
  }
  _opSave();
  return { ok: true, criadas, orcamentos: orcCriados, repetidas: res.length - criadas, pulou };
}

/* ---------- TRANSFER — o fornecedor de transfer dela ----------
   O transfer da cidade-base ela pede ao parceiro (nome e link da area de
   cliente em Ajustes). Enquanto nao ha integracao, o app deixa o pedido
   pronto para colar e guarda o numero da reserva deles. O que e de fora da
   base (outra cidade, outro emirado) fica numa lista a parte. */
const NCC_PADRAO = Object.assign({ nome: 'Parceiro de transfer', url: '' }, ((typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).transfer || {}).fornecedor || {});
function nccConfig() { return Object.assign({}, NCC_PADRAO, (DB.settings && DB.settings.ncc) || {}); }
function ehTransfer(b) { const x = Tours.get(b.tourId); return !!(x && (x.type === 'transfer' || x.region === 'transfer')) || RE_TRANSFER.test(nomeDoServico(b)); }
const RE_BASE = ((typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).base || {}).re || /(?!)/;
const RE_FORA_BASE = ((typeof CONTEUDO !== 'undefined' ? CONTEUDO : {}).base || {}).reFora || /(?!)/;
/* sem pista nenhuma = a cidade-base */
function transferNaBase(b) {
  const txt = [nomeDoServico(b), b.origem, b.destino, b.obsOp].filter(Boolean).join(' ');
  if (RE_BASE.test(txt)) return true;
  return !RE_FORA_BASE.test(txt);
}
/* onde: 'roma' = a base (o parceiro), 'fora' (outro fornecedor) ou vazio (todos) */
function transfersDe(de, ate, onde) {
  return DB.bookings.filter(b => b.status !== 'cancelled' && b.date >= de && (!ate || b.date <= ate) && ehTransfer(b)
      && (!onde || (onde === 'roma') === transferNaBase(b)))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
/* o pedido pronto para colar no parceiro (em ingles, como os de Dubai leem) */
function nccTexto(b) {
  const d = b.date ? b.date.slice(8, 10) + '/' + b.date.slice(5, 7) + '/' + b.date.slice(0, 4) : '';
  return [`Date: ${d}  ·  Time: ${b.time || '?'}`, `Service: ${nomeDoServico(b)}`, `Client: ${b.name}${b.whats ? '  ·  Tel. ' + b.whats : ''}`,
    `Passengers: ${b.pax || 1}`, b.voo ? `Flight: ${b.voo}` : '', b.origem ? `From: ${b.origem}` : '', b.destino ? `To: ${b.destino}` : '',
    b.obsOp ? `Notes: ${b.obsOp}` : '', `Ref. ${(typeof guiaNegocio === 'function' && guiaNegocio()) || ''}: ${b.code || b.id}`].filter(Boolean).join('\n');
}
function nccMarca(id, codigo) {
  const b = Bookings.get(id); if (!b) return null;
  b.ncc = codigo === null ? null : { codigo: String(codigo || '').trim(), em: isoToday() };
  _opSaveBooking(b); return b;
}

/* ---------- AVALIACOES (o menu da frente) ----------
   So avaliacoes de verdade: ela cola as do Google / WhatsApp. Ficam em
   DB.settings.avaliacoes porque sao publicas (vao para o site). O link do
   Google e o mesmo que o CRM usa no "pedir avaliacao". */
const Avaliacoes = {
  all() { return [...((DB.settings && DB.settings.avaliacoes) || [])].sort((a, b) => String(b.data || '').localeCompare(String(a.data || ''))); },
  media() { const l = Avaliacoes.all().filter(a => +a.nota > 0); return l.length ? Math.round(l.reduce((s, a) => s + +a.nota, 0) / l.length * 10) / 10 : null; },
  salva(d) {
    const nome = String(d.nome || '').trim(), texto = String(d.texto || '').trim();
    if (!nome || !texto) return { erro: 'falta o nome ou o texto da avaliação' };
    const nota = Math.min(5, Math.max(1, parseInt(d.nota, 10) || 5));
    let data = d.data ? _dataDigitada(d.data) : isoToday(); if (data === null) return { erro: 'data em dd/mm/aaaa' };
    DB.settings.avaliacoes = DB.settings.avaliacoes || [];
    const a = { id: d.id || uid(), nome, cidade: String(d.cidade || '').trim(), passeio: String(d.passeio || '').trim(), nota, texto, data: data || isoToday(), fonte: String(d.fonte || '').trim() };
    const k = DB.settings.avaliacoes.findIndex(x => x.id === a.id);
    if (k >= 0) DB.settings.avaliacoes[k] = a; else DB.settings.avaliacoes.push(a);
    save(); return a;
  },
  remove(id) { DB.settings.avaliacoes = (DB.settings.avaliacoes || []).filter(a => a.id !== id); save(); },
};

/* ---------- PONTOS DE ENCONTRO ----------
   O modelo de voucher dela lista varios pontos; para cada cliente ela
   escolhia a mao o do passeio dele. Aqui: uma lista unica de pontos (feita
   uma vez), cada passeio diz quais valem e qual e o normal, e no voucher
   ela escolhe — sai so o ponto daquele cliente.
     DB.pontos [{id, nome, endereco, mapa, instrucoes}]
     Tour: pontos [ids], pontoPadrao; Booking: pontoId */
const Pontos = {
  all() { return DB.pontos || []; },
  get(id) { return (DB.pontos || []).find(p => p.id === id) || null; },
  salva(d) {
    DB.pontos = DB.pontos || [];
    const nome = String(d.nome || '').trim(); if (!nome) return { erro: 'falta o nome do ponto' };
    const dados = { nome, endereco: String(d.endereco || '').trim(), mapa: String(d.mapa || '').trim(), instrucoes: String(d.instrucoes || '').trim() };
    if (dados.mapa && !/^https?:\/\//i.test(dados.mapa)) return { erro: 'o link do mapa precisa começar com http' };
    let p = d.id && Pontos.get(d.id);
    if (p) Object.assign(p, dados); else { p = { id: uid(), ...dados }; DB.pontos.push(p); }
    _opSave(); return p;
  },
  remove(id) { DB.pontos = Pontos.all().filter(p => p.id !== id); for (const t of DB.tours) { if (Array.isArray(t.pontos)) t.pontos = t.pontos.filter(x => x !== id); if (t.pontoPadrao === id) t.pontoPadrao = ''; } _opSave(); },
  /* os que valem para o passeio (nenhum marcado = todos) */
  doPasseio(tourId) { const x = Tours.get(tourId); const ids = (x && x.pontos) || []; return ids.length ? ids.map(Pontos.get).filter(Boolean) : Pontos.all(); },
};
/* o ponto deste servico: o que ela escolheu, senao o normal do passeio */
function pontoDoServico(b) {
  const x = Tours.get(b.tourId);
  return Pontos.get(b.pontoId) || (x && Pontos.get(x.pontoPadrao)) || (x && (x.pontos || []).length ? Pontos.get(x.pontos[0]) : null);
}
function escolhePonto(bookingId, pontoId) { const b = Bookings.get(bookingId); if (!b) return; b.pontoId = pontoId || ''; _opSaveBooking(b); }
function linkMapa(p) { return p.mapa || (p.endereco ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.endereco) : ''); }

/* ---------- O CRM DELA ----------
   A planilha "CRM" e a mais importante da vida dela. Uma linha por servico,
   com as colunas dela e as etapas das abas: CRM (enviado) -> CONFIRMADO ->
   AVALIAR (o servico passou: pedir a avaliacao) -> FINALIZADO, ou PERDIDO
   com o motivo. Aqui as linhas saem do que o app ja sabe: orcamentos em
   aberto e reservas. */
const CRM_ETAPAS = [['aberto', 'CRM'], ['confirmado', 'Confirmado'], ['avaliar', '⭐ Avaliar'], ['finalizado', '💚 Finalizado'], ['perdido', 'Perdido']];
const MOTIVOS_PERDA = ['Preço', 'Data não serve', 'Fechou com outro', 'Não respondeu', 'Desistiu da viagem', 'Outro'];
function etapaDaReserva(b, hoje) {
  hoje = hoje || isoToday();
  if (b.status === 'cancelled') return 'perdido';
  if (b.date >= hoje) return 'confirmado';
  return b.avaliacaoEm ? 'finalizado' : 'avaliar';
}
function crmLinhas(hoje) {
  hoje = hoje || isoToday();
  const out = [];
  const contas = (b) => [...new Set((b.payments || []).map(p => p.conta ? Contas.nome(p.conta) : p.method).filter(Boolean))].join(', ');
  /* o "Total" e o "Sinal" da planilha sao do PEDIDO inteiro (a Jo: 2002) */
  const pedidoDe = (b) => b.orcamentoId || ((b.clienteId || chaveCliente(b)) + '|' + String(b.createdAt || '').slice(0, 10));
  const porPedido = {};
  for (const b of DB.bookings) { if (b.status === 'cancelled') continue; const k = pedidoDe(b); (porPedido[k] = porPedido[k] || []).push(b); }
  /* "veio por" = o tipo (agencia, indicacao, influencer, Instagram...); a coluna
     nova diz QUEM (a agencia, quem indicou, o influencer). Parceiro = o vendor
     (hotel, loja). Comissao vendor e comissao indicacao, como na planilha. */
  const quem = (veio, par, txt) => par && par.tipo !== 'parceiro' ? par.nome : (txt || '');
  const comDe = (b, par, tipo) => { const manual = +(tipo === 'vendor' ? b.comVendor : b.comIndic) || 0; if (manual) return manual;
    return par && ((tipo === 'vendor') === (par.tipo === 'parceiro')) ? Math.round((+b.total || 0) * (+par.comissao || 0)) / 100 : 0; };
  /* agencia: o nome de quem viaja vai entre parenteses (nota [2] da planilha dela) */
  const entre = (nome, veioPor) => veioPor === 'agencia' && nome && !/^\(.*\)$/.test(nome.trim()) ? '(' + nome.trim() + ')' : nome;
  for (const b of DB.bookings) {
    const c = b.clienteId ? Cadastro.get(b.clienteId) : null, par = b.parceiroId ? Parceiros.get(b.parceiroId) : (b.coupon ? Parceiros.all().find(x => x.cupom === String(b.coupon).toUpperCase()) : null);
    const irmas = porPedido[pedidoDe(b)] || [b];
    const pagos = (b.payments || []).filter(p => p.conta !== CONTA_PRESTADOR);
    const veioPor = (c && c.veioPor) || (par ? (par.tipo === 'agencia' ? 'agencia' : par.tipo === 'influencer' ? 'influencer' : '') : '');
    out.push({ tipo: 'reserva', id: b.id, b, pedido: pedidoDe(b), etapa: etapaDaReserva(b, hoje),
      /* nota [1] da planilha: a Data e a do PAGAMENTO, nao a do registro */
      dataPedido: pagos.map(p => p.date).filter(Boolean).sort()[0] || String(b.createdAt || '').slice(0, 10), dataPago: !!pagos.length,
      veio: VEIO_CURTO[veioPor] || '', veioPor, indicou: quem(veioPor, par, b.indicou || (c && c.indicadoNome) || ''),
      whats: b.whats || '', nome: b.name, nomePlan: entre(b.name, veioPor), arquivo: b.arquivo || '',
      dataServ: b.date, hora: b.time, pax: b.pax, servico: nomeDoServico(b) + (b.voo ? ' · ' + b.voo : ''), obs: b.obsOp || '',
      clientePaga: +b.total || 0, ingridPaga: +b.custo || 0, cidade: b.destino || b.origem || '', parceiro: par && par.tipo === 'parceiro' ? par.nome : (b.parceiroTxt || ''),
      totalPedido: irmas.reduce((s2, x) => s2 + (+x.total || 0), 0), sinal: pagos.reduce((s2, p) => s2 + p.amount, 0),
      forma: contas(b), emReal: pagos.reduce((s2, p) => s2 + (+p.reais || 0), 0),
      comVendor: comDe(b, par, 'vendor'), comIndic: comDe(b, par, 'indic'), motivo: b.motivoPerda || '',
      repescagens: (b.orcamentoId && (Orc.get(b.orcamentoId) || {}).repescagens) || [], links: b.links || [] });
  }
  for (const o of DB.orcamentos || []) {
    if (o.status === 'fechado') continue;
    const etapa = o.status === 'perdido' ? 'perdido' : 'aberto';
    const itens = o.itens.length ? o.itens : [{ desc: o.resumo || '(sem serviços ainda)', data: (o.datas || [])[0] || '', hora: '', pax: o.pax || 0, valor: 0 }];
    for (const it of itens) out.push({ tipo: 'orcamento', id: o.id, o, itemId: it.id || '', pedido: o.id, etapa, status: o.status,
      dataPedido: String(o.criado || '').slice(0, 10), veio: o.veioPor ? (VEIO_CURTO[o.veioPor] || '') : (ORIGEM_ORC_TXT[o.origem] || ''), veioPor: o.veioPor || '', indicou: o.indicou || '',
      whats: o.cliente.whats || '', nome: o.cliente.nome || '', nomePlan: entre(o.cliente.nome || '', o.veioPor), arquivo: Orc.nomeArquivo(o),
      dataServ: it.data || '', hora: it.hora || '', pax: it.pax || '', servico: it.desc + (it.voo ? ' · ' + it.voo : ''), obs: it.obs || '',
      clientePaga: +it.valor || 0, ingridPaga: +it.custo || 0, cidade: it.cidade || '', parceiro: o.parceiroTxt || '', totalPedido: Orc.total(o), sinal: Orc.sinal(o), forma: o.forma || '', emReal: +o.emReal || 0,
      comVendor: +o.comVendor || 0, comIndic: +o.comIndic || 0, motivo: o.motivoPerda || '',
      repescagens: o.repescagens || [], links: o.links || [] });
  }
  return out.sort((a, b2) => String(a.dataServ || '9999').localeCompare(String(b2.dataServ || '9999')) || String(a.hora).localeCompare(String(b2.hora)));
}
/* ---------- o passo a passo (Pipeline com as etapas do conteudo.js) ---------- */
const PIPE_ETAPAS = (typeof CONTEUDO !== 'undefined' && CONTEUDO.pipeline) || null;
function etapaPasso(r, hoje) {
  hoje = hoje || isoToday();
  if (r.tipo === 'pedido') return 'contato';
  if (r.tipo === 'orcamento') return r.status === 'perdido' ? 'perdido' : r.status === 'enviado' ? 'orcamento' : 'contato';
  const b = r.b;
  if (b.status === 'cancelled' || r.etapa === 'perdido') return 'perdido';
  if (b.date < hoje) return 'posvenda';
  if (b.date === hoje) return 'viagem';
  if (!(Bookings.paid(b) > 0)) return 'orcamento';
  if (pendenciasCompra(b).length) return 'confirmado';
  if (!b.prestadorId) return 'compras';
  return 'guia';
}
function proximoPassoPipe(r, etapa, hoje) {
  hoje = hoje || isoToday();
  if (etapa === 'contato') return r.tipo === 'pedido' ? 'responder e montar o orçamento' : 'montar e mandar o orçamento';
  if (etapa === 'orcamento') return r.tipo === 'orcamento' ? 'aguardar a resposta (lembrete no dia 3 e no dia 7)' : 'aguardar o sinal';
  if (etapa === 'confirmado') return pendenciasCompra(r.b).join(' · ');
  if (etapa === 'compras') return 'escalar ' + (typeof opPapel === 'function' ? opPapel(r.b) : 'o guia');
  if (etapa === 'guia') return 'mandar o voucher ao cliente e o serviço ao ' + (typeof opPapel === 'function' ? opPapel(r.b) : 'guia');
  if (etapa === 'viagem') return 'acompanhar o dia';
  if (etapa === 'posvenda') return r.etapa === 'finalizado' ? 'finalizado 💚' : 'pedir a avaliação';
  return r.motivo || '';
}

/* ---------- A PLANILHA QUE ELA PREENCHE ----------
   Cada celula da aba Planilha grava direto no registro de verdade: a linha de
   orcamento grava no orcamento (e no servico dele), a linha de reserva grava
   na reserva. Status "CONFIRMADO" num orcamento = Fechou (vira reserva). */
const CRM_STATUS_OPC = { orcamento: [['rascunho', 'Rascunho'], ['enviado', 'Enviado'], ['confirmado', 'CONFIRMADO'], ['perdido', 'Perdido']],
                         reserva: [['confirmado', 'CONFIRMADO'], ['avaliar', '⭐AVALIAR'], ['finalizado', '💚FINALIZADO'], ['perdido', 'Perdido']] };
/* "12/06", "12/06/26", "12/06/2026" ou ISO. Sem ano: a proxima vez que cai essa data */
function _dataDigitada(v, hoje) {
  const t = String(v || '').trim(); if (!t) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = t.match(/^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?/); if (!m) return null;
  hoje = hoje || isoToday();
  let y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : +hoje.slice(0, 4);
  const iso = (a) => `${a}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
  if (!m[3] && iso(y) < addDays(hoje, -60)) y++;
  const d = new Date(iso(y) + 'T12:00:00');
  return isNaN(d) || d.getDate() !== +m[1] ? null : iso(y);
}
const _horaDigitada = (v) => { const m = String(v || '').match(/(\d{1,2})\s*[:h]\s*(\d{2})?/); return m ? String(m[1]).padStart(2, '0') + ':' + (m[2] || '00') : ''; };
function crmEdita(ref, campo, valor, hoje) {
  const v = String(valor ?? '').trim(), num = () => _valorPlanilha(v);
  if (ref.tipo === 'orcamento') {
    const o = Orc.get(ref.id); if (!o) return { erro: 'orçamento não encontrado' };
    let it = o.itens.find(x => x.id === ref.itemId) || o.itens[0];
    const precisaItem = ['dataServ', 'hora', 'pax', 'servico', 'obs', 'clientePaga', 'ingridPaga', 'cidade', 'sinal'];
    if (precisaItem.includes(campo) && !it) { it = Orc._item({ desc: '' }); o.itens.push(it); }
    const rp = campo.match(/^(rep|res)([123])$/);
    if (rp) {
      o.repescagens = o.repescagens || []; const n = +rp[2];
      let x = o.repescagens.find(y => y.n === n); if (!x) { x = { n, data: '', resultado: '' }; o.repescagens.push(x); o.repescagens.sort((a, b) => a.n - b.n); }
      if (rp[1] === 'rep') { const d = _dataDigitada(v, hoje); if (d === null) return { erro: 'data em dd/mm' }; x.data = d; } else x.resultado = v;
      if (!x.data && !x.resultado) o.repescagens = o.repescagens.filter(y => y !== x);
      _opSave(); return { ok: true };
    }
    if (CRM_LINK_CAMPO[campo]) return crmLinkPoe(o, CRM_LINK_CAMPO[campo], v);
    switch (campo) {
      case 'nome': o.cliente.nome = v; break;
      case 'whats': o.cliente.whats = v; break;
      case 'veio': o.veioPor = _veioDigitado(v); break;
      case 'indicou': o.indicou = v; break;
      case 'dataPedido': { const d = _dataDigitada(v, hoje); if (d === null) return { erro: 'data em dd/mm' }; o.criado = (d || isoToday()) + 'T10:00:00.000Z'; break; }
      case 'dataServ': { const d = _dataDigitada(v, hoje); if (d === null) return { erro: 'data em dd/mm' }; it.data = d; break; }
      case 'hora': it.hora = _horaDigitada(v); break;
      case 'pax': it.pax = Math.max(1, parseInt(v, 10) || 1); break;
      case 'servico': it.desc = v; break;
      case 'obs': it.obs = v; break;
      case 'clientePaga': it.valor = num(); break;
      case 'ingridPaga': it.custo = num(); break;
      case 'cidade': it.cidade = v; break;
      case 'parceiro': o.parceiroTxt = v; break;
      case 'sinal': o.itens.forEach((x, k) => { x.sinal = k === 0 ? num() : 0; }); break;
      case 'forma': o.forma = v; break;
      case 'emReal': o.emReal = num(); break;
      case 'comVendor': o.comVendor = num(); break;
      case 'comIndic': o.comIndic = num(); break;
      case 'motivo': o.motivoPerda = v; if (v) o.status = 'perdido'; break;
      case 'arquivo': o.arquivo = v; break;
      case 'status': {
        if (v === 'confirmado') {
          const semData = o.itens.filter(x => String(x.desc || '').trim() && !x.data);
          if (semData.length) return { erro: `falta a data do serviço: ${semData.map(x => x.desc).join(', ')}` };
          const bs = Orc.fecha(o.id, { sinalRecebido: false }); return { ok: true, reservas: bs.length };
        }
        if (v === 'perdido') { o.status = 'perdido'; o.motivoPerda = o.motivoPerda || 'Outro'; }
        else if (v === 'enviado' || v === 'rascunho') { o.status = v; o.motivoPerda = ''; if (v === 'enviado' && typeof Espera !== 'undefined') Espera.orcamento(o); }
        else return { erro: 'status desconhecido' };
        break;
      }
      default: return { erro: 'esta coluna não se edita aqui' };
    }
    _opSave(); return { ok: true };
  }
  const b = Bookings.get(ref.id); if (!b) return { erro: 'reserva não encontrada' };
  if (CRM_LINK_CAMPO[campo]) return crmLinkPoe(b, CRM_LINK_CAMPO[campo], v);
  switch (campo) {
    case 'nome': if (v) b.name = v; break;
    case 'whats': b.whats = v; break;
    case 'veio': { const c = b.clienteId && Cadastro.get(b.clienteId); if (c) Cadastro.salva(c.id, { veioPor: _veioDigitado(v) }); else b.veioPor = _veioDigitado(v); break; }
    case 'indicou': b.indicou = v; break;
    case 'dataServ': { const d = _dataDigitada(v, hoje); if (!d) return { erro: 'data em dd/mm' }; b.date = d; break; }
    case 'hora': { const h = _horaDigitada(v); if (h) b.time = h; break; }
    case 'pax': b.pax = Math.max(1, parseInt(v, 10) || 1); break;
    case 'servico': b.servicoTxt = v; break;
    case 'obs': b.obsOp = v; break;
    case 'clientePaga': b.total = num(); break;
    case 'ingridPaga': b.custo = num(); break;
    case 'cidade': b.destino = v; break;
    case 'parceiro': b.parceiroTxt = v; break;
    case 'comVendor': b.comVendor = num(); break;
    case 'comIndic': b.comIndic = num(); break;
    case 'motivo': b.motivoPerda = v; break;
    case 'arquivo': b.arquivo = v; break;
    case 'status':
      if (v === 'perdido') { b.status = 'cancelled'; b.motivoPerda = b.motivoPerda || 'Outro'; }
      else { if (b.status === 'cancelled') b.status = 'confirmed'; b.avaliacaoEm = v === 'finalizado' ? (b.avaliacaoEm || isoToday()) : ''; }
      break;
    default: return { erro: 'na reserva, sinal e forma de pagamento entram pelo 💵 Pagamento' };
  }
  _opSaveBooking(b); return { ok: true };
}
const CRM_LINK_CAMPO = { lPdf: 'PDF', lOrc: 'Orçamento', lVoucher: 'Voucher', lComprov: 'Comprovante', lAval: 'Avaliação' };
function crmLinkPoe(x, nome, url) {
  if (url && !/^https?:\/\//i.test(url)) return { erro: 'o link precisa começar com http' };
  x.links = (x.links || []).filter(l => l.nome !== nome);
  if (url) x.links.push({ nome, url });
  if (x.itens) _opSave(); else _opSaveBooking(x);
  return { ok: true };
}
function _veioDigitado(v) {
  const t = _nomeN(v); if (!t) return '';
  const k = Object.keys(VEIO_CURTO).find(x => x === t || _nomeN(VEIO_CURTO[x]) === t);
  if (k) return k;
  return /insta/.test(t) ? 'instagram' : /status/.test(t) ? 'status' : /indic/.test(t) ? 'indicacao' : /influ|cupom/.test(t) ? 'influencer' : /agenc/.test(t) ? 'agencia' : /google|site/.test(t) ? 'google' : 'outro';
}
/* linha nova na planilha = um pedido novo (orcamento), como ela faz hoje */
function crmNovaLinha(d = {}) {
  return Orc.cria({ origem: 'planilha', status: 'rascunho', cliente: { nome: d.nome || '', whats: d.whats || '' }, sinalPct: 0, itens: [{ desc: '', valor: 0 }] });
}
/* mais um servico no mesmo pedido (a linha de baixo, com o mesmo nome) */
function crmMaisServico(orcId) {
  const o = Orc.get(orcId); if (!o) return null;
  const ult = o.itens[o.itens.length - 1] || {};
  const it = Orc._item({ desc: '', data: ult.data || '', pax: ult.pax || 1, sinal: 0 }); o.itens.push(it); _opSave(); return it;
}
const ORIGEM_ORC_TXT = { whats: 'WhatsApp', site: 'Meu pedido (app)', roteiro: 'Monte seu roteiro', manual: '', planilha: '' };
/* O PAINEL DO CRM (o topo da aba Orcamentos): os numeros que ela olha na
   planilha e a lista "precisa de voce" — o que cada pedido espera dela hoje.
   Recebe as linhas ja filtradas pelo mes que ela escolheu. */
function crmPainel(linhas, hoje) {
  hoje = hoje || isoToday();
  const ped = new Map();
  for (const r of linhas) { const p = ped.get(r.pedido) || { r, linhas: [], etapas: new Set() }; p.linhas.push(r); p.etapas.add(r.etapa); ped.set(r.pedido, p); }
  const P = [...ped.values()];
  const abertos = P.filter(p => p.etapas.has('aberto'));
  const fechados = P.filter(p => ['confirmado', 'avaliar', 'finalizado'].some(e => p.etapas.has(e)));
  const perdidos = P.filter(p => p.etapas.size === 1 && p.etapas.has('perdido'));
  const conf = linhas.filter(r => r.etapa === 'confirmado' && r.b);
  const motivos = {}; perdidos.forEach(p => { const m = p.r.motivo || 'sem motivo'; motivos[m] = (motivos[m] || 0) + 1; });
  const comissoes = Parceiros.all().map(x => ({ x, c: Parceiros.conta(x) })).filter(y => y.c.saldo > 0);
  /* o que espera por ela */
  const agora = [];
  for (const p of abertos) {
    const o = p.r.o; if (!o) continue;
    if (o.status === 'novo' || o.status === 'rascunho') agora.push({ tipo: 'montar', ordem: 2, nome: p.r.nome, o, txt: 'orçamento ainda não mandado' });
    else {
      const t = Tarefas.all().find(t2 => !t2.feita && t2.orcId === o.id && t2.etapa === 'aguardar');
      if (t && t.prazo && t.prazo <= hoje) agora.push({ tipo: 'repescar', ordem: 1, nome: p.r.nome, o, txt: `mandado e sem resposta${(o.repescagens || []).length ? ` · já foram ${o.repescagens.length} repescagem(ns)` : ''}` });
    }
  }
  const semSinal = new Map();
  for (const r of conf) if (!Bookings.paid(r.b) && r.dataServ <= addDays(hoje, 14)) semSinal.set(r.pedido, r);
  for (const r of semSinal.values()) agora.push({ tipo: 'sinal', ordem: 3, nome: r.nome, r, txt: `confirmado para ${r.dataServ.slice(8, 10)}/${r.dataServ.slice(5, 7)} e ainda sem sinal` });
  const avaliar = new Map();
  for (const r of linhas) if (r.etapa === 'avaliar') { const a = avaliar.get(r.pedido) || { r, ids: [] }; a.ids.push(r.id); if (r.dataServ > a.r.dataServ) a.r = r; avaliar.set(r.pedido, a); }
  for (const a of avaliar.values()) agora.push({ tipo: 'avaliar', ordem: 4, nome: a.r.nome, r: a.r, ids: a.ids, txt: `o passeio foi ${a.r.dataServ.slice(8, 10)}/${a.r.dataServ.slice(5, 7)} · pedir a avaliação` });
  agora.sort((x, y) => x.ordem - y.ordem || String(y.r ? y.r.dataServ : '').localeCompare(String(x.r ? x.r.dataServ : '')));
  return {
    abertos: { n: abertos.length, valor: abertos.reduce((s2, p) => s2 + (p.r.totalPedido || 0), 0), naoMandados: abertos.filter(p => p.r.o && (p.r.o.status === 'novo' || p.r.o.status === 'rascunho')).length },
    confirmados: { n: new Set(conf.map(r => r.pedido)).size, valor: conf.reduce((s2, r) => s2 + (r.clientePaga || 0), 0),
      recebido: conf.reduce((s2, r) => s2 + Bookings.paid(r.b), 0), falta: conf.reduce((s2, r) => s2 + Bookings.due(r.b), 0) },
    fecha: { fechados: fechados.length, perdidos: perdidos.length, taxa: fechados.length + perdidos.length ? fechados.length / (fechados.length + perdidos.length) : null,
      motivo: Object.entries(motivos).sort((x, y) => y[1] - x[1])[0] || null },
    comissoes: { n: comissoes.length, valor: Math.round(comissoes.reduce((s2, y) => s2 + y.c.saldo, 0) * 100) / 100 },
    agora,
  };
}
/* pedir a avaliacao: a mensagem sai pronta; ela manda. Depois disso a linha vai para Finalizado */
function msgAvaliacao(b) {
  const link = (DB.settings && DB.settings.linkAvaliacao) || '';
  return `Oi ${String(b.name || '').split(' ')[0]}! Tudo certo com ${nomeDoServico(b)}? Foi um prazer receber vocês. ` +
    `Se puder, deixe sua avaliação — ajuda muito o meu trabalho${link ? ': ' + link : '.'} Obrigada! ${typeof guiaNome === 'function' ? guiaNome() : ''}`;
}
function marcaAvaliacao(bookingId) { const b = Bookings.get(bookingId); if (!b) return; b.avaliacaoEm = isoToday(); _opSaveBooking(b); }
function perdeOrcamento(id, motivo) { const o = Orc.get(id); if (!o) return; o.status = 'perdido'; o.motivoPerda = motivo || 'Outro'; _opSave(); }
/* a planilha de volta para o Google Planilhas, com as colunas dela */
const CRM_COLUNAS = ['Data', 'veio por', 'Agência / indicação / influencer', 'Whatsapp', 'Nome', 'Data Serviço', 'Hora', 'PAX', 'Serviço pedido', 'Obs', 'Cliente Paga', 'Custo (você paga)', 'Cidade', 'Parceiro',
  'Total', 'Sinal', 'forma Pagamento', 'Em Real (se fez PIX)', 'Comissao Vendor', 'Comissao indicacao', 'Status', 'Motivo da perda',
  'Repescagem 1', 'Resultado 1', 'Repescagem 2', 'Resultado 2', 'Repescagem 3', 'Resultado 3', 'Nome do arquivo', 'Link PDF', 'Link Orçamento', 'Link Voucher', 'Link Comprov', 'Link Avaliacao'];
/* o Status com as palavras da planilha dela */
function crmStatusTxt(r) {
  if (r.etapa === 'aberto') return r.status === 'enviado' ? 'Enviado' : 'Rascunho';
  return { confirmado: 'CONFIRMADO', avaliar: '⭐AVALIAR', finalizado: '💚FINALIZADO', perdido: 'Perdido' }[r.etapa] || r.etapa;
}
function crmCsv(linhas) {
  const d = (iso) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(2, 4) : '';
  const q = (v) => { const t = String(v ?? ''); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
  const num = (v) => v ? String(v).replace('.', ',') : '';
  const rp = (r, k) => { const x = (r.repescagens || []).find(y => y.n === k); return x ? [d(x.data), x.resultado] : ['', '']; };
  const lk = (r, re) => (r.links || []).filter(l => re.test(l.nome)).map(l => l.url).join(' ');
  return [CRM_COLUNAS, ...linhas.map(r => [d(r.dataPedido), r.veio, r.indicou, r.whats, r.nomePlan || r.nome, d(r.dataServ), r.hora, r.pax, r.servico, r.obs, num(r.clientePaga), num(r.ingridPaga),
    r.cidade, r.parceiro, num(r.totalPedido), num(r.sinal), r.forma, num(r.emReal), num(r.comVendor), num(r.comIndic), crmStatusTxt(r), r.motivo,
    ...rp(r, 1), ...rp(r, 2), ...rp(r, 3), r.arquivo, lk(r, /pdf/i), lk(r, /or[cç]amento|planilha/i), lk(r, /voucher/i), lk(r, /comprov/i), lk(r, /avalia/i)])]
    .map(l => l.map(q).join(';')).join('\n');
}

/* ---------- PAINEL DE NUMEROS (a aba Relatorios) ----------
   Cada marcador compara com o periodo ANTERIOR de mesmo tamanho: "este mes
   ate hoje" contra "o mes passado ate o mesmo dia". Sem isto, o dia 3 do mes
   sempre pareceria uma queda contra o mes inteiro anterior.

   Dinheiro que a guia ou o motorista recebeu na mao NAO e receita dela: fica
   fora do "recebido" e aparece separado. */
function _dias(a, b) { return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 864e5); }
function _fimDoMes(iso) { const d = new Date(iso.slice(0, 7) + '-15T12:00:00'); d.setMonth(d.getMonth() + 1); d.setDate(0); return d.toISOString().slice(0, 10); }
const Painel = {
  periodo(preset, hoje) {
    hoje = hoje || isoToday();
    if (preset === 'semana') return { de: addDays(hoje, -6), ate: hoje, antDe: addDays(hoje, -13), antAte: addDays(hoje, -7), nome: 'últimos 7 dias', ant: 'os 7 dias antes', antCurto: 'semana anterior' };
    if (preset === '90') return { de: addDays(hoje, -89), ate: hoje, antDe: addDays(hoje, -179), antAte: addDays(hoje, -90), nome: 'últimos 90 dias', ant: 'os 90 dias antes', antCurto: '90 dias antes' };
    if (preset === 'ano') {
      const y = +hoje.slice(0, 4);
      return { de: y + '-01-01', ate: hoje, antDe: (y - 1) + '-01-01', antAte: (y - 1) + hoje.slice(4), nome: 'este ano', ant: 'o mesmo período de ' + (y - 1), antCurto: String(y - 1) };
    }
    /* mes: do dia 1 ate hoje, contra o mes passado ate o mesmo dia */
    const de = hoje.slice(0, 8) + '01';
    const antDe = addDays(de, -1).slice(0, 8) + '01';
    const fimAnt = _fimDoMes(antDe);
    const mesmoDia = antDe.slice(0, 8) + hoje.slice(8, 10);
    return { de, ate: hoje, antDe, antAte: mesmoDia > fimAnt ? fimAnt : mesmoDia, nome: 'este mês', ant: 'o mês passado até o mesmo dia', antCurto: 'mês passado' };
  },
  /* período escolhido à mão (de/até): compara com o período anterior do mesmo tamanho */
  periodoCustom(de, ate) {
    const n = _dias(de, ate) + 1;
    const antAte = addDays(de, -1), antDe = addDays(antAte, -(n - 1));
    const dd = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
    return { de, ate, antDe, antAte, nome: `${dd(de)} a ${dd(ate)}`, ant: 'o período anterior de mesmo tamanho', antCurto: 'período anterior' };
  },
  delta(cur, ant) { return ant ? (cur - ant) / ant : (cur ? null : 0); },
  _ativos() { return DB.bookings.filter(b => b.status !== 'cancelled'); },
  recebido(de, ate) {
    let voce = 0, prest = 0, n = 0;
    for (const b of DB.bookings) for (const p of b.payments || []) {
      if (!p.date || p.date < de || p.date > ate) continue;
      if (ladoDoPagamento(p) === 'prestador') prest += p.amount; else { voce += p.amount; n++; }
    }
    return { voce, prest, n };
  },
  /* o que ela VENDEU no periodo: reservas feitas nele, seja qual for a data do servico */
  vendido(de, ate) {
    const bs = Painel._ativos().filter(b => { const c = String(b.createdAt || '').slice(0, 10); return c >= de && c <= ate; });
    return { valor: bs.reduce((s, b) => s + (+b.total || 0), 0), n: bs.length, pax: bs.reduce((s, b) => s + (+b.pax || 0), 0) };
  },
  /* servicos que acontecem no periodo */
  servicos(de, ate) {
    const bs = Painel._ativos().filter(b => b.date >= de && b.date <= ate);
    return { n: bs.length, pax: bs.reduce((s, b) => s + (+b.pax || 0), 0), lista: bs };
  },
  /* a margem so existe onde ela preencheu o custo (Detalhes do servico) */
  margem(de, ate) {
    const bs = Painel.servicos(de, ate).lista;
    const com = bs.filter(b => +b.custo > 0);
    const receita = com.reduce((s, b) => s + (+b.total || 0), 0), custo = com.reduce((s, b) => s + (+b.custo || 0), 0);
    return { receita, custo, margem: receita - custo, pct: receita ? (receita - custo) / receita : null, n: com.length, semCusto: bs.length - com.length };
  },
  aReceber(hoje) {
    hoje = hoje || isoToday();
    let comVoce = 0, noDia = 0, atrasado = 0;
    for (const b of Painel._ativos()) {
      const falta = Bookings.due(b); if (falta <= 0) continue;
      if (Op.restoPara(b) === 'prestador') { if (b.date >= hoje) noDia += falta; continue; }
      comVoce += falta;
      if (Bookings.dueDate(b) < hoje) atrasado += falta;
    }
    return { comVoce, noDia, atrasado };
  },
  orcamentos(de, ate) {
    const os = (DB.orcamentos || []).filter(o => { const c = String(o.criado || '').slice(0, 10); return c >= de && c <= ate; });
    const conta = (st) => os.filter(o => o.status === st).length;
    const fechados = conta('fechado'), perdidos = conta('perdido'), enviados = conta('enviado');
    const decididos = fechados + perdidos;
    return { n: os.length, novos: conta('novo') + conta('rascunho'), enviados, fechados, perdidos,
             valorFechado: os.filter(o => o.status === 'fechado').reduce((s, o) => s + Orc.total(o), 0),
             taxa: decididos ? fechados / decididos : null };
  },
  /* quem veio: novo ou de volta, e quem veio JUNTO (as indicacoes dela) */
  clientes(de, ate) {
    const bs = Painel.servicos(de, ate).lista;
    const chaves = new Set(bs.map(chaveCliente));
    let voltaram = 0;
    for (const k of chaves) {
      const antes = Painel._ativos().some(b => chaveCliente(b) === k && b.date < de);
      if (antes) voltaram++;
    }
    const junto = bs.reduce((s, b) => s + (b.group || []).filter(g => g && g.nome).length, 0);
    return { n: chaves.size, voltaram, novos: chaves.size - voltaram, junto };
  },
  /* series para os mini-graficos e o grafico de entrada de dinheiro */
  semanas(n, ate, fn) {
    ate = ate || isoToday();
    const out = [];
    let fim = ate;
    for (let i = 0; i < n; i++) {
      const ini = addDays(fim, -6);
      out.unshift({ de: ini, ate: fim, rot: ini.slice(8, 10) + '/' + ini.slice(5, 7), v: fn(ini, fim) });
      fim = addDays(ini, -1);
    }
    return out;
  },
  meses(ano, fn) {
    const MES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return MES.map((m, i) => { const de = `${ano}-${String(i + 1).padStart(2, '0')}-01`; return { de, ate: _fimDoMes(de), rot: m, v: fn(de, _fimDoMes(de)) }; });
  },
  /* O QUE JA ESTA VENDIDO para as proximas semanas: quanto ja entrou e quanto falta */
  futuro(semanas, hoje) {
    hoje = hoje || isoToday();
    const out = [];
    for (let i = 0; i < (semanas || 8); i++) {
      const de = addDays(hoje, i * 7), ate = addDays(de, 6);
      const bs = Painel._ativos().filter(b => b.date >= de && b.date <= ate);
      const total = bs.reduce((s, b) => s + (+b.total || 0), 0);
      const pago = bs.reduce((s, b) => s + Bookings.paid(b), 0);
      out.push({ de, ate, rot: de.slice(8, 10) + '/' + de.slice(5, 7), total, pago, falta: Math.max(0, total - pago), n: bs.length, pax: bs.reduce((s, b) => s + (+b.pax || 0), 0) });
    }
    return out;
  },
  /* dia da semana x turno: onde a semana dela aperta (e onde faltam guias) */
  calor(de, ate) {
    const m = Array.from({ length: 7 }, () => ({ manha: 0, tarde: 0, noite: 0 }));
    for (const b of Painel.servicos(de, ate).lista) {
      const wd = (new Date(b.date + 'T12:00:00').getDay() + 6) % 7; /* segunda = 0 */
      for (const tu of turnosDoServico(b)) m[wd][tu] += 1;
    }
    return m;
  },
  porServico(de, ate) {
    const map = new Map();
    for (const b of Painel.servicos(de, ate).lista) {
      const r = map.get(b.tourId) || { tourId: b.tourId, valor: 0, n: 0, pax: 0 };
      r.valor += +b.total || 0; r.n++; r.pax += +b.pax || 0;
      map.set(b.tourId, r);
    }
    return [...map.values()].sort((a, b) => b.valor - a.valor || b.n - a.n);
  },
  origens(de, ate) {
    const bs = Painel.servicos(de, ate).lista;
    const map = {};
    for (const b of bs) { const o = b.origin || 'site'; map[o] = (map[o] || 0) + 1; }
    return Object.entries(map).map(([origem, n]) => ({ origem, n, pct: bs.length ? n / bs.length : 0 })).sort((a, b) => b.n - a.n);
  },
  equipe(de, ate) {
    const map = new Map();
    let sem = 0;
    for (const b of Painel.servicos(de, ate).lista) {
      if (!b.prestadorId) { sem++; continue; }
      const r = map.get(b.prestadorId) || { pessoa: Equipe.get(b.prestadorId), n: 0, pax: 0, noDia: 0 };
      r.n++; r.pax += +b.pax || 0;
      r.noDia += (b.payments || []).filter(p => p.conta === CONTA_PRESTADOR).reduce((s, p) => s + p.amount, 0)
               + (Op.restoPara(b) === 'prestador' ? Bookings.due(b) : 0);
      map.set(b.prestadorId, r);
    }
    return { lista: [...map.values()].filter(r => r.pessoa).sort((a, b) => b.n - a.n), sem };
  },
  /* com quanta antecedencia reservam: quando comecar a divulgar cada temporada */
  antecedencia(de, ate) {
    const faixas = [['até 7 dias', 0, 7, 'até 7'], ['8 a 30 dias', 8, 30, '8–30'], ['31 a 90 dias', 31, 90, '31–90'], ['mais de 90 dias', 91, 1e9, '+90']];
    const dias = Painel.servicos(de, ate).lista.filter(b => b.createdAt).map(b => Math.max(0, _dias(String(b.createdAt).slice(0, 10), b.date)));
    const ord = [...dias].sort((a, b) => a - b);
    const mediana = ord.length ? (ord.length % 2 ? ord[(ord.length - 1) / 2] : Math.round((ord[ord.length / 2 - 1] + ord[ord.length / 2]) / 2)) : null;
    return { faixas: faixas.map(([rot, a, z, curto]) => ({ rot, curto, n: dias.filter(d => d >= a && d <= z).length })), mediana, n: dias.length };
  },
};

/* ---------- textos das abas novas ---------- */
if (typeof STR !== 'undefined') {
  Object.assign(STR, {
    admGuias:    { pt: 'Guias e motoristas', en: 'Guides & drivers' },
    admPipeline: { pt: 'Pipeline', en: 'Pipeline' },
    admPrecos:   { pt: 'Tabela de preços', en: 'Price list' },
    admVoucher:  { pt: 'Voucher', en: 'Voucher' },
    admConsulta: { pt: 'Orçamentos', en: 'Quotes' },
    hubAval: { pt: 'Avaliações', en: 'Reviews' },
    hubAvalSub: { pt: 'O que dizem os clientes', en: 'What our guests say' },
  admPlanilha: { pt: 'Planilha', en: 'Sheet' },
  admTransfer: { pt: 'Transfer', en: 'Transfers' },
    admTarefas:  { pt: 'Tarefas', en: 'Tasks' },
    admClients:  { pt: 'Clientes', en: 'Clients' },
    admCoupons:  { pt: 'Indicações e cupons', en: 'Referrals & coupons' },
    admMoney:    { pt: 'Contabilidade', en: 'Accounting' },
  });
}

opGarante();
