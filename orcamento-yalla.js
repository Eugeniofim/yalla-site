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
    criancas: Math.max(0, Math.min(+i.criancas || 0, Math.max(1, +i.pax || 1))),   /* das pessoas, quantas são crianças */
    naoIncluso: String(i.naoIncluso || '').trim(),
    aParte: !!i.aParte,                            /* "(a parte)": entra no roteiro, por conta do cliente, sem valor */
    horas: Math.max(0, Math.round(+i.horas || 0)), /* passeio POR HORA (o iate): quantas horas (28/10/2026) */
  });
};
/* O TOTAL (o que o resto do app já usa: CRM, painel, assistente):
   serviços − desconto = subtotal; + VAT de 5% no fim (28/10/2026, pedido
   dele: "no final do orçamento adicionar 5% de VAT"). O VAT é por orçamento
   (vatPct, em Mais opções), 5% se ela não mudar. */
const OY_VAT = 5;
const oyCent = (v) => Math.round((+v || 0) * 100) / 100;
/* COM OU SEM VAT (28/10/2026, ele: "colocar opção de incluir ou não o VAT"): semVat desliga só neste orçamento */
const oyVatPct = (o) => o && o.semVat ? 0 : o && o.vatPct != null && o.vatPct !== '' ? Math.max(0, +o.vatPct || 0) : OY_VAT;
const _oyTotalBase = Orc.total;
/* O TOTAL QUE ELA INFORMA vale (28/10/2026, ele: "não pode recriar nada, tem que respeitar o
   que ela pede"): com totalInformado, o total é esse número e o VAT de 5% fica DENTRO dele. */
const oyTotInf = (o) => +(o && o.totalInformado) || 0;
Orc.subtotal = function (o) { return oyTotInf(o) > 0 ? oyCent(oyTotInf(o) / (1 + oyVatPct(o) / 100)) : Math.max(0, _oyTotalBase(o) - (+(o && o.desconto) || 0)); };
Orc.vat = function (o) { return oyTotInf(o) > 0 ? oyCent(oyTotInf(o) - Orc.subtotal(o)) : oyCent(Orc.subtotal(o) * oyVatPct(o) / 100); };
Orc.total = function (o) { return oyTotInf(o) > 0 ? oyCent(oyTotInf(o)) : oyCent(Orc.subtotal(o) + Orc.vat(o)); };
/* os hotéis por período ("07-11/11 Sofitel *a parte · 11-12/11 Conrad Abu Dhabi *incluso") */
function oyHoteis(o, comVazios) {
  const l = Array.isArray(o.hoteis) ? o.hoteis.filter(h => h && (comVazios || String(h.nome || '').trim())) : [];
  return l.length ? l : (o.hotel ? [{ de: '', ate: '', nome: o.hotel, situacao: '' }] : []);
}
/* SÓ DÓLAR (28/10/2026, pedido dele: "deixar tudo em dólares, somente
   dólares"): o orçamento, a proposta e as reservas que saem dele são em USD */
const OY_MOEDA = 'USD';
/* fechou: as reservas somam o que o cliente paga (desconto e VAT repartidos
   na proporção de cada serviço) e saem em dólar */
const _oyFechaBase = Orc.fecha;
Orc.fecha = function (id, opts) {
  const o = Orc.get(id);
  if (o) oyLigaCliente(o);
  const soma = o ? o.itens.reduce((t, i) => t + (+i.valor || 0), 0) : 0;
  const k = o && soma > 0 ? Orc.total(o) / soma : 1;
  /* os serviços que viram reserva, na mesma ordem e com a mesma regra do Orc.fecha */
  const usados = o ? o.itens.filter(i => { const av = !(i.tourId && Tours.get(i.tourId)); return !(av && (!i.data || !String(i.desc || '').trim() || i.sugestao)); }) : [];
  const bs = _oyFechaBase(id, opts);
  bs.forEach((b, n) => {
    /* o roteiro depois da compra (kit) mostra o que ela escreveu no orçamento */
    const i = usados[n]; if (!i) return;
    Object.assign(b, { orcTitulo: i.desc || '', orcTexto: i.texto || '', orcIncluso: i.incluso || '', orcFoto: i.foto || '', orcObs: /^Sem preço na tabela/.test(i.obs || '') ? '' : (i.obs || '') });
    const par = oyParceiroDe(o); if (par && !b.parceiroId) b.parceiroId = par.id;
    if (i.horaFim) b.horaFim = i.horaFim;
    /* serviço sem horário no orçamento: a reserva guarda 09:00 por dentro (a agenda precisa de uma
       hora), mas o roteiro que vai para o cliente NÃO mostra horário nenhum (28/10/2026) */
    if (!i.hora) b.semHora = true;
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
/* a hora do jeito que ela digitar (28/10/2026, "os horários não estão deixando mudar"): 14:30,
   14h30, 14.30, 14 30, 1430, 930, 14h, 14 → "14:30"/"09:30"/"14:00". Hora ou minuto impossível → vazio. */
const oyHm = (h) => {
  const t = String(h || '').trim().toLowerCase(), ok = (H, M) => +H <= 23 && +M <= 59 ? String(+H).padStart(2, '0') + ':' + String(+M).padStart(2, '0') : '';
  let m = t.match(/(\d{1,2})\s*[:h.,\s]\s*(\d{2})/); if (m) return ok(m[1], m[2]);
  m = t.match(/^(\d{1,2})(\d{2})$/); if (m) return ok(m[1], m[2]);
  m = t.match(/^(\d{1,2})\s*h?$/); if (m) return ok(m[1], 0);
  return '';
};
/* "09:00–17:00", "9h às 17h", "20h às 22h30", "10h-12h" → [início, fim]. O "às" tem acento e o \b do
   JavaScript não enxerga letra acentuada: "20h às 22h30" virava só 22:30 (28/10/2026) */
const oyFaixaPartes = (v) => String(v || '').trim().split(/\s*(?:–|—|-)\s*|\s+(?:às|as|até|ate|a)\s+/i);
function oySoma(hm, min) { if (!hm) return ''; const [h, m] = hm.split(':').map(Number); const t = Math.min(23 * 60 + 59, h * 60 + m + min); return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }
/* "09h00 – 18h00" → ['09:00','18:00']; "4h" → começa às 09:00 e soma */
/* NADA DE HORÁRIO INVENTADO (28/10/2026, ele: "veio informação errada inventada" na proposta):
   antes o app fazia o fim pela duração ("10h" → 09:00–19:00) e a faixa fixa do catálogo passava
   por cima da hora que ela deu. Agora: a hora dela manda e o fim só vem dela; sem hora dela, só a
   faixa que ela mesma escreveu no passeio ("09h00 – 18h00"). */
function oyHorasDe(x, hora) {
  if (hora) return [hora, ''];
  const par = String((x && x.duration) || '').match(/(\d{1,2}[:h]\d{2})\s*[–-]\s*(\d{1,2}[:h]\d{2})/);
  return par ? [oyHm(par[1]), oyHm(par[2])] : ['', ''];
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
/* POR ADULTO E POR CRIANÇA (28/10/2026, ele: "por casal não precisa; no por pessoa separe o valor
   por adulto e por criança"). Em cada serviço a criança paga o preço de criança da tabela (na mesma
   proporção, se ela mudou o valor); sem preço de criança, paga como adulto. A parte das crianças
   passa pela mesma régua do total (desconto, VAT, total que ela fechou) e os adultos dividem o
   resto — então adultos × por adulto + crianças × por criança = o total. */
function oyPorTipo(o) {
  const A = +o.adultos || 0, C = +o.criancas || 0, tot = Orc.total(o);
  if (!C) { const p = A || oyPax(o); return { adulto: p ? oyCent(tot / p) : 0, crianca: 0 }; }
  let soma = 0, partC = 0;
  for (const i of o.itens || []) {
    const v = +i.valor || 0; if (i.aParte || !v) continue;
    soma += v;
    const pax = Math.max(1, +i.pax || 1), x = i.tourId && Tours.get(i.tourId);
    /* serviço livre ou traslado do grupo todo: as crianças do grupo estão nele */
    const c = Math.min(pax, +i.criancas > 0 ? +i.criancas : (!x && pax >= oyPax(o) ? C : 0));
    if (!c) continue;
    let uc = v / pax;
    const pc = x ? oyPrecoCrianca(x, i.opcao) : 0;
    if (pc > 0) { const tab = oyPrecoItem(x, { ...i, criancas: c }).total || 0; uc = Math.min(v / c, pc * (tab > 0 ? v / tab : 1)); }
    partC += uc * c;
  }
  partC = soma > 0 ? partC * tot / soma : 0;
  return { adulto: A ? oyCent((tot - partC) / A) : 0, crianca: oyCent(partC / C) };
}
/* O LINK DE PAGAMENTO COBRA O TOTAL, POR PESSOA OU POR CASAL (28/10/2026, ele: "no link de pagamento
   colocar para gerar link de pagamento: total, por casal ou por pessoa"). A plataforma dela (Pix e
   cartão em 12x) ainda não conversa com o app: o app mostra o valor certo de cada jeito, ela cria o
   link lá com esse valor e cola aqui; a proposta mostra o botão certo. Com criança, "por pessoa"
   tem dois links (adulto e criança). */
const OY_PAG = [['total', 'Grupo'], ['casal', 'Casal'], ['pessoa', 'Individual']];   /* as palavras dela (28/10): "dividir o valor total por grupo, casal, individual" */
const oyPagModo = (o) => OY_PAG.some(x => x[0] === o.pagModo) ? o.pagModo : 'total';
function oyPagValor(o) {
  const t = oyPorTipo(o), modo = oyPagModo(o), cri = +o.criancas > 0;
  if (modo === 'pessoa') return { modo, v: t.adulto, rot: cri ? 'por adulto' : 'por pessoa', vc: cri ? t.crianca : 0 };
  if (modo === 'casal') return { modo, v: oyCent(t.adulto * 2), rot: 'por casal', vc: 0 };
  const p = +o.pago > 0;
  return { modo, v: p ? oyPendente(o) : Orc.total(o), rot: p ? 'do grupo (o que falta pagar)' : 'do grupo (total)', vc: 0 };
}
/* "NÃO INCLUSO" DE UM TOQUE (28/10/2026, a Milla: "dá pra colocar 'Acompanhamento de guia' como opção de
   só clicar? É muito usado"). O botão põe ou tira a frase do campo. Além do pedido dela, aparecem as
   frases que ela mesma mais escreveu nos orçamentos (2+ vezes) — nada inventado. */
const OY_RAP_FIXO = ['Acompanhamento de guia'];
const oyFrases = (t) => String(t || '').split(/\n|[,;]/).map(x => x.trim().replace(/\.$/, '')).filter(Boolean);
const oyTemFrase = (t, f) => oyFrases(t).some(x => x.toLowerCase() === f.toLowerCase());
function oyRapidos() {
  const n = {};
  for (const o of DB.orcamentos || []) for (const i of o.itens || []) for (const f of oyFrases(i.naoIncluso)) if (f.length <= 40) { const k = f.toLowerCase(); n[k] = n[k] || { f, c: 0 }; n[k].c++; }
  const deEla = Object.values(n).filter(x => x.c >= 2).sort((a, b) => b.c - a.c).map(x => x.f);
  return [...OY_RAP_FIXO, ...deEla].filter((f, k, l) => l.findIndex(y => y.toLowerCase() === f.toLowerCase()) === k).slice(0, 6);
}
/* "USD 1.050 por adulto · USD 525 por criança" (sem criança: "USD 1.050 por pessoa") */
function oyPorTipoTexto(o, curto) {
  const t = oyPorTipo(o), m = oyMoeda(o);
  if (!(+o.criancas > 0)) return oyPax(o) > 1 ? oyM(t.adulto, m) + (curto ? '/pessoa' : ' por pessoa') : '';
  return oyM(t.adulto, m) + (curto ? '/adulto · ' : ' por adulto · ') + oyM(t.crianca, m) + (curto ? '/criança' : ' por criança');
}
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

/* AS OPÇÕES DE CADA PASSEIO E O PREÇO DE CRIANÇA (28/10/2026, pedido da Milla: "aqui precisa
   ter as opções dentro de cada: adulto/criança OU non-prime/prime"). A opção escolhida traz o
   preço; a criança paga o preço de criança da opção (ou do passeio), como no site. */
const oyOpcoes = (x) => Array.isArray(x && x.opcoes) ? x.opcoes : [];
const oyOpNome = (op) => oyPt(op && op.nome).trim();
const oyTemOpcoes = (x) => oyOpcoes(x).length > 1;
const oyPrecoCrianca = (x, k) => +((oyOpcoes(x)[+k || 0] || {}).precoCrianca || (x && x.precoCrianca) || 0);
function oyPrecoItem(x, i) {
  const pax = Math.max(1, +i.pax || 1), cri = Math.min(pax, Math.max(0, +i.criancas || 0));
  const pr = Bookings.precoDe(x, x.id, i.data || isoToday(), i.hora || '09:00', pax, { opcao: +i.opcao || 0, idades: Array(cri).fill(0), horas: +i.horas || 0 });
  return pr || { total: 0 };
}
/* a opção pelo nome que ela diz: exato → palavra inteira ("prime" NÃO pega "non-prime") → trecho */
function oyAchaOpcao(x, nome) {
  const n = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const q = n(nome); if (!q) return 0;
  const l = oyOpcoes(x).map(op => n(oyOpNome(op)));
  const qe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let k = l.findIndex(v => v === q);
  if (k < 0) k = l.findIndex(v => new RegExp('(^|[^a-z0-9-])' + qe + '($|[^a-z0-9-])').test(v));
  if (k < 0) k = l.findIndex(v => v.includes(q));
  return Math.max(0, k);
}
/* o nome do serviço com a opção ("Burj Khalifa – At The Top · Após 16:00 (prime)") */
const oyTituloDe = (x, k) => oyPt(x.name) + (oyTemOpcoes(x) && oyOpNome(oyOpcoes(x)[+k || 0]) ? ' · ' + oyOpNome(oyOpcoes(x)[+k || 0]) : '');
/* um passeio do catálogo, já com o preço da tabela dela, a opção, o texto, o incluso e a foto */
function oyDoCatalogo(o, tourId, extra) {
  extra = extra || {};
  const x = Tours.get(tourId); if (!x) return null;
  const pax = +extra.pax || oyPax(o) || 2;
  const opcao = Math.max(0, Math.min(+extra.opcao || 0, Math.max(0, oyOpcoes(x).length - 1)));
  const criancas = Math.min(pax, extra.criancas != null ? +extra.criancas || 0 : (+o.criancas || 0));
  const base = Orc.itemDoCatalogo(tourId, { pax, data: extra.data || '', hora: extra.hora || '', opcao });
  const horas = x.priceMode === 'hora' ? Math.max(+x.minHoras || 1, Math.round(+extra.horas || 0)) : 0;
  base.valor = oyPrecoItem(x, { pax, criancas, opcao, horas, data: extra.data, hora: extra.hora }).total || base.valor;
  /* hora só se for certa: a que ela disse, a do horário fixo do passeio ou a faixa da duração
     ("09h00 – 18h00"). Sem nada disso fica em branco — o 09:00 de reserva seria chute. */
  const regra = (DB.rules || []).find(r => r.tourId === tourId);
  const [h1, h2] = oyHorasDe(x, extra.hora || (regra && regra.time) || '');
  return Orc._item({ ...base, obs: extra.obs || '', pax, criancas, opcao, horas, desc: oyTituloDe(x, opcao), tipo: x.type === 'transfer' ? 'traslado' : 'passeio', auto: !(+extra.valor > 0),
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
    if (i.pax === antes || !i.pax) { i.pax = agora || 1; i.criancas = Math.min(i.pax, +o.criancas || 0); }
    const x = i.tourId && Tours.get(i.tourId);
    if (i.auto && x) i.valor = oyPrecoItem(x, i).total || i.valor;
  }
  o.pax = agora; o.paxNota = oyPaxTexto(o);
}

/* ---------- PARCEIROS: o link de cada um (?p=CUPOM) e a comissão sozinha ----------
   O link marca o visitante (store.js, parceiroDaVisita); aqui: a marca vai na
   mensagem do WhatsApp, entra no orçamento (do site, do pedido de roteiro ou
   da conversa colada com "Indicação: CUPOM"), vira parceiroId nas reservas do
   Fechou, e a reserva feita no site com a marca conta para o parceiro. */
const oyParPorCodigo = (c) => { const k = String(c || '').toUpperCase(); return k && typeof Parceiros !== 'undefined' ? Parceiros.all().find(p => p.cupom && p.cupom === k) || null : null; };
function oyParceiroDe(o) {
  if (!o || typeof Parceiros === 'undefined') return null;
  return (o.parceiroId && Parceiros.get(o.parceiroId)) || oyParPorCodigo(o.parceiroCodigo);
}
const OY_RE_INDIC = /indica[cç][aã]o:\s*([A-Za-z0-9_-]{2,24})/i;
/* a mensagem que o cliente manda do site leva o código (ela vê no WhatsApp; o app lê ao colar a conversa) */
if (typeof waLink === 'function') {
  const _oyWa = waLink;
  waLink = function (text, num) {
    const c = !num && typeof parceiroDaVisita === 'function' && !/^#\/adm/.test(location.hash) && !(typeof isLoggedIn === 'function' && isLoggedIn()) ? parceiroDaVisita() : '';
    return _oyWa(c && text && !OY_RE_INDIC.test(text) ? text + '\n\n(Indicação: ' + c + ')' : text, num);
  };
}
/* o orçamento nasce com o parceiro: do site, do pedido de roteiro ou da conversa colada */
const _oyCria = Orc.cria;
Orc.cria = function (d) {
  const o = _oyCria.call(this, d);
  let c = '';
  if (typeof parceiroDaVisita === 'function' && !(typeof isLoggedIn === 'function' && isLoggedIn()) && !/^#\/adm/.test(location.hash)) c = parceiroDaVisita();
  if (!c && d && d.pedidoId) { const ped = (DB.pedidos || []).find(x => x.id === d.pedidoId); if (ped && ped.parceiroCodigo) c = ped.parceiroCodigo; }
  if (!c && d && d.conversa) { const m = String(d.conversa).match(OY_RE_INDIC); if (m) c = m[1].toUpperCase(); }
  if (c) { o.parceiroCodigo = c; const par = oyParPorCodigo(c); if (par) o.parceiroId = par.id; Orc.salva(o); }
  return o;
};
if (typeof Parceiros !== 'undefined') {
  /* reserva feita no site com a marca do link também é do parceiro */
  const _oyParRes = Parceiros.reservas;
  Parceiros.reservas = function (p) {
    const a = _oyParRes.call(this, p);
    if (!p || !p.cupom) return a;
    const ja = new Set(a.map(b => b.id));
    /* o cupom que o cliente DIGITOU vale mais que o link (nunca conta para dois) */
    const mais = DB.bookings.filter(b => b.status !== 'cancelled' && !ja.has(b.id) && !b.parceiroId && !(b.coupon && oyParPorCodigo(b.coupon)) && String(b.parceiroCodigo || '').toUpperCase() === p.cupom);
    return mais.length ? a.concat(mais).sort((x, y) => String(y.date).localeCompare(String(x.date))) : a;
  };
  const _oyParDa = Parceiros.daReserva;
  Parceiros.daReserva = function (b) { return _oyParDa.call(this, b) || (b && !b.parceiroId ? oyParPorCodigo(b.parceiroCodigo) : null); };
}
const oyLinkParceiro = (p) => p && p.cupom ? ppBase() + '?p=' + encodeURIComponent(p.cupom) : '';
/* a tela "Indicações e cupons": o link de cada parceiro, para copiar e mandar a ele */
if (typeof admParcerias === 'function') {
  const _oyAdmPar = admParcerias;
  admParcerias = function () {
    const r = _oyAdmPar.apply(this, arguments);
    for (const p of Parceiros.all()) {
      const bt = document.querySelector(`[data-pared="${CSS.escape(p.id)}"]`), card = bt && bt.closest('.par-card');
      if (!card || card.querySelector('.par-link')) continue;
      const u = oyLinkParceiro(p);
      const div = document.createElement('div'); div.className = 'par-link';
      div.innerHTML = u ? `<span class="op-lbl">Link do parceiro</span><code>${esc(u)}</code><button type="button" class="mini strong">copiar o link</button>
        <small class="why">Quem chega por este link fica marcado por ${PARCEIRO_DIAS} dias: reserva, pedido e WhatsApp vêm com o código, e a comissão entra aqui sozinha.</small>`
        : `<small class="why">Dê um cupom a este parceiro para ele ganhar o link próprio.</small>`;
      const b = div.querySelector('button'); if (b) b.onclick = () => opCopia(u).then(() => toast('Link do ' + p.nome + ' copiado'));
      const pe = card.querySelector('.btnrow'); card.insertBefore(div, pe || null);
    }
    if (!document.getElementById('parLinkCss')) { const st = document.createElement('style'); st.id = 'parLinkCss';
      st.textContent = '.par-link{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;margin:10px 0 4px;padding:10px 12px;border-radius:12px;background:var(--accent-wash)}.par-link code{font-size:13px;overflow-wrap:anywhere;flex:1;min-width:180px}.par-link small{flex-basis:100%}';
      document.head.appendChild(st); }
    return r;
  };
}

/* o roteiro depois da compra (kit-yalla.js): título, texto, foto e incluso do orçamento */
if (typeof kitServico === 'function') {
  const _oyKitServ = kitServico;
  kitServico = function (b, hotel) {
    const sv = _oyKitServ(b, hotel);
    if (b.orcTitulo) sv.nome = b.orcTitulo;
    if (b.orcTexto) sv.resumo = b.orcTexto;
    if (b.orcFoto) sv.foto = b.orcFoto;
    if (b.horaFim) sv.horaFim = b.horaFim;
    if (b.semHora) sv.hora = '';
    if (b.orcObs) sv.obs = b.orcObs;
    const inc = String(b.orcIncluso || '').split(/\n|,\s*(?=[A-ZÀ-Ú])/).map(t => t.trim()).filter(Boolean);
    if (inc.length) sv.inclui = inc;
    return sv;
  };
}

/* ---------- A FICHA DO CLIENTE (28/10/2026, ele: "cada cliente precisa ter uma FICHA com todas
   as infos do passeio e os dados de contato") ----------
   O orçamento acha ou cria o cadastro (WhatsApp, e-mail ou nome) e guarda o clienteId. Não liga
   a cada letra digitada (criaria "Ro", "Ros"…): liga quando ela sai do campo, abre a proposta,
   fecha, ou quando o assistente cria o orçamento. */
function oyLigaCliente(o) {
  if (!o || typeof Cadastro === 'undefined') return null;
  const nome = String((o.cliente && o.cliente.nome) || '').trim(); if (nome.length < 2) return null;
  let c = o.clienteId && Cadastro.get(o.clienteId);
  if (!c) { const par = oyParceiroDe(o); c = Cadastro.garante({ nome, whats: o.cliente.whats || '', email: o.cliente.email || '', ...(par ? { parceiroId: par.id, veioPor: par.tipo === 'agencia' ? 'agencia' : 'influencer' } : {}) }); }
  if (!c) return null;
  const muda = {};
  if (o.cliente.whats && !c.whats) muda.whats = o.cliente.whats;
  if (o.cliente.email && !c.email) muda.email = o.cliente.email;
  /* nome corrigido no orçamento, cadastro ainda sem reserva: acompanha */
  if (c.nome !== nome && !Cadastro.reservas(c).length && (Orc.all().filter(x => x.clienteId === c.id).length <= 1)) muda.nome = nome;
  if (Object.keys(muda).length) Cadastro.salva(c.id, muda);
  if (o.clienteId !== c.id) { o.clienteId = c.id; const x = Orc.get(o.id); if (x) x.clienteId = c.id; _opSave(); }
  return c;
}
/* os orçamentos de um cliente (pela ficha, pelo WhatsApp ou pelo nome) */
function oyOrcsDoCliente(c) {
  const w = String(c.whats || '').replace(/\D/g, '').slice(-8), n = _nomeN(c.nome || '');
  return Orc.all().filter(o => o.clienteId === c.id || (w.length >= 8 && String(o.cliente.whats || '').replace(/\D/g, '').slice(-8) === w) || (!o.clienteId && n && _nomeN(o.cliente.nome || '') === n));
}
const oyDM = (iso) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';
function oyFichaHtml(c) {
  const l = oyOrcsDoCliente(c); if (!l.length) return '';
  /* a viagem: a do orçamento fechado; senão, a do mais recente que tem dados de viagem */
  const temViagem = (x) => (x.chegada && x.chegada.data) || (x.partida && x.partida.data) || oyHoteis(x).length || x.itens.length;
  const o = l.find(x => x.status === 'fechado') || l.find(temViagem) || l[0];
  const ch = o.chegada || {}, pa = o.partida || {}, hs = oyHoteis(o);
  const st = (x) => (ORC_STATUS.find(s2 => s2[0] === x.status) || ['', x.status])[1];
  return `<section class="card fc-viagem" id="fcViagem">
    <h3>Viagem e orçamentos</h3>
    <div class="fc-vg">
      ${ch.data ? `<div><small>Chegada</small><b>${esc(oyDM(ch.data))}${ch.hora ? ' · ' + esc(ch.hora) : ''}</b>${ch.voo ? `<span>voo ${esc(ch.voo)}</span>` : ''}</div>` : ''}
      ${pa.data ? `<div><small>Partida</small><b>${esc(oyDM(pa.data))}${pa.hora ? ' · ' + esc(pa.hora) : ''}</b>${pa.voo ? `<span>voo ${esc(pa.voo)}</span>` : ''}</div>` : ''}
      ${oyPax(o) ? `<div><small>Pessoas</small><b>${esc(oyPaxTexto(o))}</b></div>` : ''}
    </div>
    ${hs.length ? `<div class="fc-hots">${hs.map(h => `<p><b>${esc(h.nome)}</b>${h.de || h.ate ? ` <span>${esc([oyDM(h.de), oyDM(h.ate)].filter(Boolean).join(' a '))}</span>` : ''}${h.situacao ? ` <em>${h.situacao === 'incluso' ? 'incluso' : 'à parte'}</em>` : ''}</p>`).join('')}</div>` : ''}
    <div class="fc-orcs">${l.map(x => { const ds = oyOrdena(x.itens).filter(i => i.data);
      return `<div class="fc-orc"><div><b>${esc(x.num)}</b> <span class="pill">${esc(st(x))}</span><small>${ds.length ? esc(oyDM(ds[0].data) + (ds.length > 1 ? ' a ' + oyDM(ds[ds.length - 1].data) : '')) + ' · ' : ''}${x.itens.length} ${x.itens.length === 1 ? 'serviço' : 'serviços'} · ${esc(oyM(Orc.total(x), OY_MOEDA))}</small></div>
        <div class="fc-orc-acs"><a class="mini" href="#/adm/consulta/${esc(x.id)}">abrir</a><a class="mini" href="#/adm/proposta/${esc(x.id)}">proposta</a>${x.status === 'fechado' && (x.bookingIds || []).length && typeof Kit !== 'undefined' ? `<button type="button" class="mini strong" data-fckit="${esc(x.id)}">roteiro</button>` : ''}</div></div>`; }).join('')}</div>
  </section>`;
}
if (typeof admFicha === 'function') {
  const _oyFicha = admFicha;
  admFicha = function (arg) {
    const r = _oyFicha.apply(this, arguments);
    try {
      const c = cadastroDaRota(arg); if (!c || document.getElementById('fcViagem')) return r;
      const html = oyFichaHtml(c); if (!html) return r;
      const top = document.querySelector('#stage .fc-top'); if (!top) return r;
      top.insertAdjacentHTML('afterend', html);
      document.querySelectorAll('[data-fckit]').forEach(b => b.onclick = () => { const x = Orc.get(b.dataset.fckit), bk = x && Bookings.get(x.bookingIds[0]); if (bk) Kit.abrir(Kit.daReserva(bk)); });
      if (!document.getElementById('fcViagemCss')) { const st = document.createElement('style'); st.id = 'fcViagemCss';
        st.textContent = `.fc-vg{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px;margin:6px 0 10px}
          .fc-vg>div{background:var(--surface-2);border-radius:12px;padding:10px 12px}.fc-vg small{display:block;color:var(--ink-3);font-size:12px}.fc-vg b{display:block}.fc-vg span{font-size:12.5px;color:var(--ink-2)}
          .fc-hots p{margin:4px 0}.fc-hots span{color:var(--ink-2);font-size:13px}.fc-hots em{font-style:normal;font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--accent)}
          .fc-orcs{display:grid;gap:6px;margin-top:10px}.fc-orc{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px;align-items:center;border:1px solid var(--line);border-radius:12px;padding:10px 12px}
          .fc-orc small{display:block;color:var(--ink-3);margin-top:2px}.fc-orc-acs{display:flex;gap:6px;flex-wrap:wrap}`;
        document.head.appendChild(st); }
    } catch (e) {}
    return r;
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
    hoteis: oyHoteis(o).map(h => ({ nome: String(h.nome || '').trim(), de: h.de || '', ate: h.ate || '', situacao: h.situacao || '' })),
    chegada: o.chegada || null, partida: o.partida || null, moeda: m,
    itens: oyOrdena(o.itens).filter(i => !i.sugestao).map(i => {
      const x = i.tourId && Tours.get(i.tourId);
      return { ...(o.mostraValores ? { valor: i.aParte ? null : +i.valor || 0 } : {}), data: i.data || '', hora: i.hora || '', horaFim: i.horaFim || '', rotulo: i.rotulo || '', titulo: i.desc || '', horas: x && x.priceMode === 'hora' ? +i.horas || +x.minHoras || 1 : 0,
        texto: i.texto || '', incluso: i.incluso || '', naoIncluso: i.naoIncluso || '', aParte: !!i.aParte,
        obs: i.sugestao || /^Sem preço na tabela/.test(i.obs || '') ? '' : (i.obs || ''), foto: i.foto || '', tipo: i.tipo, voo: i.voo || '',
        cidade: x && regs[x.region] && !['deserto', 'oriente'].includes(x.region) ? regs[x.region] : '' };
    }),
    subtotal: Orc.subtotal(o), vatPct: oyVatPct(o), vat: Orc.vat(o),
    total: Orc.total(o), porPessoa: oyPorPessoa(o), porAdulto: oyPorTipo(o).adulto, porCrianca: oyPorTipo(o).crianca, criancas: +o.criancas || 0, pago: +o.pago || 0, pendente: oyPendente(o),
    validade: o.validade || '', obs: o.obs || '',
    pagar: /^https:\/\//i.test(String(o.linkPagamento || '').trim()) ? String(o.linkPagamento).trim() : '',
    pagarCrianca: oyPagModo(o) === 'pessoa' && +o.criancas > 0 && /^https:\/\//i.test(String(o.linkPagamentoCrianca || '').trim()) ? String(o.linkPagamentoCrianca).trim() : '',
    pagarModo: oyPagModo(o), pagarValor: oyPagValor(o).v, pagarValorCrianca: oyPagValor(o).vc,
    politica: o.politica != null ? o.politica : ppTextoPadrao('politica'),
    condicoes: o.condicoes != null ? o.condicoes : ppTextoPadrao('condicoes'),
    diferencial: o.diferencial != null ? o.diferencial : ppTextoPadrao('diferencial'),
  };
}
/* O QUADRO DO INVESTIMENTO mostra SÓ o jeito de cobrar que ela escolheu no orçamento (28/10/2026, a
   Milla: "aqui aparecer só a opção clicada na montagem do orçamento — o link que gerei é total, então é
   irrelevante a info do quadro mostarda"). Total: só o total. Por pessoa: por adulto/criança e o
   quadro "Pagamento individual". Por casal: por casal e "Pagamento por casal". */
function ppInvestimento(d) {
  const m = d.moeda, modo = d.pagarModo || 'total', cri = +d.criancas > 0, vat = d.vatPct > 0
    ? `<p class="pp-vat">${d.itens.some(i => 'valor' in i) ? 'Valores dos serviços sem VAT. ' : ''}Subtotal ${esc(oyM(d.subtotal, m))} + VAT ${esc(String(d.vatPct).replace('.', ','))}% ${esc(oyM(d.vat, m))}. O total já inclui o VAT.</p>` : '';
  const pago = d.pago > 0 ? `<div class="pp-pago"><span>Pago <b>${esc(oyM(d.pago, m))}</b></span><span>Pendente <b>${esc(oyM(d.pendente, m))}</b></span></div>` : '';
  const caixa = (rot, v) => `<div><small>${rot}</small><b>${esc(oyM(v, m))}</b></div>`;
  let extra = '', ind = '';
  if (modo === 'pessoa' && d.pax > 1) {
    extra = cri ? caixa('Por adulto', d.porAdulto) + caixa('Por criança', d.porCrianca) : caixa('Por pessoa', d.porPessoa);
    ind = `<div class="pp-ind">Pagamento individual | ${cri ? `adulto ${esc(oyM(d.porAdulto, m))} · criança ${esc(oyM(d.porCrianca, m))}` : esc(oyM(d.porPessoa, m))}</div>`;
  } else if (modo === 'casal') {
    extra = caixa('Por casal', d.pagarValor);
    ind = `<div class="pp-ind">Pagamento por casal | ${esc(oyM(d.pagarValor, m))}</div>`;
  }
  return `<div class="pp-invg${modo === 'pessoa' && cri ? ' pp-tres' : ''}">${caixa('Investimento total', d.total)}${extra}</div>${vat}${pago}${ind}`;
}
/* "Pagar agora · USD 2.817" / "Pagar por adulto · USD 971" + "Pagar por criança · USD 873" / "Pagar por casal · USD 1.943" */
function ppBotoesPagar(d, cls, curto) {
  if (!d.pagar) return '';
  const m = d.moeda, modo = d.pagarModo || 'total', v = +d.pagarValor || 0, cri = +d.criancas > 0;
  const rot = modo === 'pessoa' ? (cri ? 'Pagar por adulto' : 'Pagar por pessoa') : modo === 'casal' ? 'Pagar por casal' : 'Pagar agora';
  const b = (href, txt) => `<a class="${cls}" data-pdf-fora href="${esc(href)}" target="_blank" rel="noopener">${esc(txt)}</a>`;
  return b(d.pagar, rot + (v ? ' · ' + oyM(v, m) : '') + (curto ? '' : ' · Pix ou cartão'))
    + (d.pagarCrianca ? b(d.pagarCrianca, 'Pagar por criança' + (+d.pagarValorCrianca ? ' · ' + oyM(+d.pagarValorCrianca, m) : '')) : '');
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
  const tag = (i) => [i.data ? ppSemana(i.data) : '', i.data ? i.data.slice(8, 10) + '/' + i.data.slice(5, 7) : '', ppHoras(i), i.horas ? i.horas + (i.horas > 1 ? ' horas' : ' hora') : '', i.rotulo, i.voo && i.tipo === 'traslado' ? 'voo ' + i.voo : ''].filter(Boolean).join(' | ');
  const cartao = (i) => `<section class="pp-card">
      ${tag(i) ? `<div class="pp-tag">${esc(tag(i))}</div>` : ''}
      <h3 class="pp-tit">${esc(i.titulo)}${i.aParte ? ' <span class="pp-aparte">(à parte)</span>' : ''}${'valor' in i && !i.aParte && +i.valor > 0 ? ` <span class="pp-preco">${esc(oyM(+i.valor, d.moeda))}</span>` : ''}</h3>
      ${i.foto ? `<div class="pp-foto" role="img" aria-label="${esc(i.titulo)}" style="background-image:url('${esc(ppFotoUrl(i.foto))}')"></div>` : ''}
      ${i.texto ? `<p>${ppEsc(i.texto)}</p>` : ''}
      ${i.incluso ? `<p class="pp-inc"><b>INCLUSO:</b> ${ppEsc(i.incluso)}</p>` : ''}
      ${i.naoIncluso ? `<p class="pp-inc"><b>NÃO INCLUSO:</b> ${ppEsc(i.naoIncluso)}</p>` : ''}
      ${i.obs ? `<div class="pp-obs"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12Z"/></svg><p>${ppEsc(i.obs)}</p></div>` : ''}
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
      ${(d.hoteis || []).length > 1 ? `<p>${esc(d.hoteis.map(h => h.nome).join(' · '))}</p>` : d.hotel ? `<p>${esc(d.hotel)}</p>` : ''}
    </div>
  </section>
  ${dias.map(g => `<div class="pp-dia">
    <section class="pp-bloco">${cabDia(g)}${cartao(g.l[0])}</section>
    ${g.l.slice(1).map(cartao).join('')}
  </div>`).join('')}
  ${d.obs ? `<section class="pp-box"><h3>Observações</h3><p>${ppEsc(d.obs)}</p></section>` : ''}
  ${(d.hoteis || []).length ? `<section class="pp-box"><h3>Hospedagem</h3>${d.hoteis.map(h => `<p class="pp-hot"><b>${esc(h.nome)}</b>${h.de || h.ate ? `<span>${esc([h.de, h.ate].filter(Boolean).map(x => x.slice(8, 10) + '/' + x.slice(5, 7)).join(' a '))}</span>` : ''}${h.situacao ? `<em>${h.situacao === 'incluso' ? 'incluso' : 'à parte'}</em>` : ''}</p>`).join('')}</section>` : ''}
  <section class="pp-inv">
    ${ppInvestimento(d)}
    ${ppBotoesPagar(d, 'pp-pagar')}
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
    background:var(--pp-fundo);color:var(--pp-n);font-family:Montserrat,var(--f-ui),system-ui,sans-serif;max-width:794px;margin:0 auto;padding-bottom:28px}
  .pp p{margin:0 0 8px;font-size:14.5px;line-height:1.55;color:var(--pp-t)}
  .pp-capa{position:relative;aspect-ratio:794/1123;min-height:480px;overflow:hidden;background:#EADBB6;margin-bottom:26px}
  /* na tela a capa cabe na tela (o nome e as datas aparecem sem rolar); no PDF ocupa a folha inteira */
  .pp-pg .pp-capa{max-height:calc(100svh - 56px)}
  .em-pdf .pp-capa{max-height:none!important}
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
  .pp-h2{font-family:Montserrat,var(--f-ui),system-ui,sans-serif;font-weight:800;letter-spacing:-.01em;font-size:clamp(24px,5.6vw,32px);line-height:1.15;margin:0 0 14px;padding-bottom:14px;border-bottom:3px solid var(--pp-ouro);color:var(--pp-n)}
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
  .pp-tres>div:first-child{grid-column:1/-1}
  .pp-preco{float:right;margin-left:12px;font-weight:800;white-space:nowrap;color:#141414}
  .pp-invg small{display:block;color:var(--pp-ouro);font-weight:800;letter-spacing:.05em;text-transform:uppercase;font-size:12px}
  .pp-invg b{display:block;font-size:clamp(24px,6vw,34px);font-weight:800;margin-top:6px;color:#fff;letter-spacing:-.01em}
  .pp-vat{color:#E9DFC6!important;font-size:13px!important;margin:-6px 0 14px!important}
  .pp-obs{display:flex;gap:10px;align-items:flex-start;margin:6px 0 10px;padding:11px 14px;border-radius:14px 14px 14px 4px;background:#FBF3DC;border:1px solid #EAD9A6}
  .pp-obs svg{flex:none;width:18px;height:18px;margin-top:2px;color:var(--pp-ouro-t)}
  .pp-obs p{margin:0!important;color:var(--pp-n)!important;font-size:14px!important}
  .pp-aparte{font-weight:500;color:var(--pp-t);font-size:14px}
  .pp-hot{display:flex;flex-wrap:wrap;gap:4px 12px;align-items:baseline;padding:6px 0;border-top:1px solid #EFE6CF}
  .pp-hot:first-of-type{border-top:0}
  .pp-hot b{color:var(--pp-n)}
  .pp-hot span{color:var(--pp-t);font-size:13.5px}
  .pp-hot em{font-style:normal;font-size:12px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:var(--pp-ouro-t)}
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
  .pp-cta .pp-pg-pagar{background:#C9A23B;color:#1a1405;box-shadow:0 14px 30px -14px rgba(0,0,0,.5)}
  .pp-pagar{display:flex;align-items:center;justify-content:center;min-height:52px;margin-top:12px;border-radius:999px;background:#fff;color:#141414;font-weight:800;text-decoration:none}
  .pp-pagar:focus-visible{outline:3px solid #C9A23B;outline-offset:3px}
  .pp-cta a:focus-visible,.pp-cta button:focus-visible{outline:3px solid var(--pp-ouro-t,#8A6D1E);outline-offset:3px}
  .pp-pg .pdfPronto{margin:12px auto}
  @media(min-width:700px){.pp-foto{height:300px}.pp-card,.pp-box{padding:22px 24px 14px}}
  /* no papel a foto é mais baixa: cabe título + foto + texto na mesma folha, sem buraco */
  .em-pdf .pp-foto{height:200px}
  .em-pdf .pp-kick{margin-top:18px}.em-pdf .pp-h2{margin-bottom:10px}.em-pdf .pp-tag{margin-bottom:10px}
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
    <div class="pp-cta" data-pdf-fora>${ppBotoesPagar(d, 'pp-pg-pagar', true)}<a class="pp-zap" target="_blank" rel="noopener" href="${esc(waLink(`Olá! Vi a proposta ${d.num || ''}${nome ? ' (' + nome + ')' : ''} e quero reservar.`))}">${ICONE_WA} ${d.pagar ? 'Falar' : 'Quero reservar'}</a></div>
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
  oyLigaCliente(o);
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
    return `${so ? '' : `<div class="oy-g3 oy-quando">
          <label class="fld">Dia<input type="date" data-k="data" value="${esc(i.data)}"></label>
          <label class="fld">Início<input type="time" data-k="hora" value="${esc(oyHm(i.hora) || '')}"></label>
          <label class="fld">Fim<input type="time" data-k="horaFim" value="${esc(oyHm(i.horaFim) || '')}"></label>
        </div>
        <label class="fld">Título<input data-k="desc" value="${esc(i.desc)}"></label>
        <label class="fld">O que o cliente vai ler<textarea data-k="texto" rows="4">${esc(i.texto)}</textarea></label>`}
        <label class="fld">Incluso<textarea data-k="incluso" rows="2">${esc(i.incluso)}</textarea></label>
        <label class="fld">Não incluso<textarea data-k="naoIncluso" rows="2">${esc(i.naoIncluso || '')}</textarea></label>
        <div class="oy-rap" role="group" aria-label="Não incluso de um toque">${oyRapidos().map(t => `<button type="button" class="chip ${oyTemFrase(i.naoIncluso, t) ? 'on' : ''}" data-rap="${esc(t)}" aria-pressed="${oyTemFrase(i.naoIncluso, t)}">${esc(t)}</button>`).join('')}</div>
        <label class="fld">Observação <small class="why">(aparece num balão na proposta e no roteiro)</small><textarea data-k="obs" rows="2" placeholder="Ex.: volta para o hotel por conta do cliente · Sugestão: jantar em Dubai Marina">${esc(/^Sem preço na tabela/.test(i.obs || '') ? '' : (i.obs || ''))}</textarea></label>
        <label class="optin oy-aparte"><input type="checkbox" data-k="aParte" ${i.aParte ? 'checked' : ''}><span><b>À parte</b><small>entra no roteiro, por conta do cliente, sem valor (ex.: Beach Club, brunch)</small></span></label>
        ${x ? (() => { const pc = oyPrecoCrianca(x, i.opcao), idade = +((oyOpcoes(x)[+i.opcao || 0] || {}).idadeCrianca || x.idadeCrianca || 0);
          return `<div class="oy-g3 oy-opc">
          ${oyTemOpcoes(x) ? `<label class="fld oy-opsel">Opção<select data-k="opcao">${oyOpcoes(x).map((op, k) => `<option value="${k}" ${+i.opcao === k ? 'selected' : ''}>${esc(oyOpNome(op) || 'Opção ' + (k + 1))} · ${esc(oyM(+op.preco || 0, m))}</option>`).join('')}</select></label>` : ''}
          <label class="fld">Adultos<input type="number" min="0" inputmode="numeric" data-k="adultosIt" value="${Math.max(0, (+i.pax || 1) - (+i.criancas || 0))}"></label>
          <label class="fld">Crianças<input type="number" min="0" inputmode="numeric" data-k="criancas" value="${+i.criancas || 0}"></label>
          ${x.priceMode === 'hora' ? `<label class="fld">Horas<input type="number" min="${+x.minHoras || 1}" step="1" inputmode="numeric" data-k="horas" value="${+i.horas || +x.minHoras || 1}"></label>` : ''}
        </div>
        ${x.priceMode === 'hora' ? `<p class="why oy-pcri">Por hora: ${esc(oyM(+x.price || 0, m))} a hora${+x.minHoras > 1 ? ', mínimo ' + x.minHoras + ' horas' : ''}. O valor refaz ao mudar as horas.</p>` : ''}
        <p class="why oy-pcri">${pc > 0 ? `Criança${idade ? ' até ' + idade + ' anos' : ''} paga ${esc(oyM(pc, m))}.` : 'Este passeio não tem preço de criança: criança paga como adulto.'} O valor refaz sozinho ao mudar a opção ou as pessoas.</p>`; })() : ''}
        <div class="oy-g3">
          ${i.tipo === 'traslado' ? `<label class="fld">Voo<input data-k="voo" value="${esc(i.voo)}" placeholder="EK323"></label>` : `<label class="fld">Destaque<input data-k="rotulo" value="${esc(i.rotulo)}" placeholder="manhã livre"></label>`}
          ${x ? '' : `<label class="fld">Pessoas<input type="number" min="1" inputmode="numeric" data-k="pax" value="${i.pax}"></label>`}
          ${so ? `<label class="fld oy-custo2" title="o que você paga a quem faz o serviço — nunca vai para o cliente">Custo (só você vê)<input type="number" min="0" inputmode="decimal" data-k="custo" value="${i.custo || ''}" placeholder="0"></label>`
            : `<label class="fld">Valor ${esc(m)}<input type="number" min="0" inputmode="decimal" data-k="valor" value="${i.valor || ''}" placeholder="0"></label>`}
        </div>
        ${`<span class="op-lbl">Foto na proposta</span><div class="oy-fotos" role="group" aria-label="Foto na proposta">
          <button type="button" class="oy-ft oy-ftno ${!i.foto ? 'on' : ''}" data-foto="" aria-pressed="${!i.foto}">sem foto</button>
          ${(i.foto && !fotos.includes(i.foto) ? [i.foto, ...fotos] : fotos).slice(0, 12).map(f => `<button type="button" class="oy-ft ${i.foto === f ? 'on' : ''}" data-foto="${esc(f)}" aria-pressed="${i.foto === f}" aria-label="usar esta foto" style="background-image:url('${esc(f)}')"></button>`).join('')}
        <label class="oy-ft oy-ftup" title="enviar uma foto (hotel, restaurante, o que não está no catálogo)">+ foto<input type="file" accept="image/*" data-fotoup hidden></label></div>`}
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
      <button type="button" class="oy-itcab" data-oyabre="${esc(i.id)}" aria-expanded="${aberto}">
        <span class="oy-ithr">${esc(ppHoras(i) || 'sem horário')}</span>
        <span class="oy-itn">${i.foto ? `<span class="oy-itf" style="background-image:url('${esc(i.foto)}')" aria-hidden="true"></span>` : ''}<b>${esc(i.desc || 'Sem título')}</b>${i.tipo === 'traslado' && i.voo ? `<small>voo ${esc(i.voo)}</small>` : ''}${i.aParte ? '<small>à parte</small>' : !i.valor ? '<small class="oy-alerta">sem valor</small>' : ''}</span>
        <span class="oy-itv">${i.aParte ? 'à parte' : i.valor ? esc(oyM(i.valor, m)) : '—'}</span>
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
        const band = i.data !== ult ? `<div class="oy-band" role="row"><span role="cell">${esc(oyDiaLongo(i.data))}</span>${i.data ? `<button type="button" class="oy-band-add" data-adddia="${esc(i.data)}" aria-label="Acrescentar passeio em ${esc(oyDiaLongo(i.data))}">+ neste dia</button>` : ''}</div>` : '';
        ult = i.data;
        const aberto = S.aberto === i.id;
        const nl = (i.texto || '').split('\n').length;
        return band + `<div class="oy-row ${aberto ? 'aberto' : ''}" data-it="${esc(i.id)}" role="row">
          <label class="oy-c oy-cd" role="cell"><span class="sr">Dia</span><input type="date" data-k="data" value="${esc(i.data)}"></label>
          <label class="oy-c oy-ch" role="cell"><span class="sr">Horário</span><input data-k="faixa" value="${esc(ppHoras(i))}" placeholder="horário" aria-label="Horário (ex.: 09:00–17:00)"></label>
          <div class="oy-c oy-cs" role="cell">
            <input class="oy-ct" data-k="desc" value="${esc(i.desc)}" placeholder="Serviço (ex.: Tour de até 8 horas em Dubai)" aria-label="Serviço">
            <textarea class="oy-cx" data-k="texto" rows="${Math.min(10, Math.max(2, nl + 1))}" placeholder="detalhes (opcional)" aria-label="Detalhes, um por linha">${esc(i.texto)}</textarea>
            ${i.foto ? `<button type="button" class="oy-cfoto" data-oyabre="${esc(i.id)}" style="background-image:url('${esc(i.foto)}')" aria-label="Foto deste serviço na proposta (toque para trocar)" title="foto na proposta"></button>` : ''}
            ${i.tipo === 'traslado' && i.voo ? `<small class="oy-cvoo">voo ${esc(i.voo)}</small>` : ''}
            ${i.obs && !/^Sem preço na tabela/.test(i.obs) ? `<small class="oy-cobs" title="${esc(i.obs)}">obs: ${esc(i.obs.length > 60 ? i.obs.slice(0, 60) + '…' : i.obs)}</small>` : ''}
          </div>
          <label class="oy-c oy-cv" role="cell"><span class="sr">Valor ${esc(m)}</span>${i.aParte ? '<span class="oy-aparte-v">à parte</span>' : `<input type="number" min="0" inputmode="decimal" data-k="valor" value="${i.valor || ''}" placeholder="0">`}</label>
          <span class="oy-c oy-cacs" role="cell"><button type="button" class="oy-cm" data-oyabre="${esc(i.id)}" aria-expanded="${aberto}" aria-label="Mais deste serviço: incluso, foto, pessoas, custo, observação">⋯</button><button type="button" class="oy-cm oy-crm" data-rmi="${esc(i.id)}" aria-label="Tirar este serviço" title="tirar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="width:17px;height:17px"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6"/></svg></button></span>
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
      <div class="oy-tit"><h1 class="pageh">${esc(o.num)}</h1><span class="pill">${esc(st)}</span><small class="oy-salvo" id="oySalvo" aria-live="polite">${o.salvoEm ? 'salvo às ' + esc(o.salvoEm) : 'salva sozinho'}</small></div>
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
      <div class="oy-hots"><span class="op-lbl">Hotéis</span>
        ${(oyHoteis(o, true).length ? oyHoteis(o, true) : [{ de: '', ate: '', nome: '', situacao: '' }]).map((h, k) => `<div class="oy-hot" data-h="${k}">
          <label class="fld"><span class="sr">Hotel</span><input data-hk="nome" value="${esc(h.nome || '')}" placeholder="Ex.: Sofitel Downtown" aria-label="Hotel" autocomplete="off"></label>
          <label class="fld"><span class="sr">De</span><input type="date" data-hk="de" value="${esc(h.de || '')}" aria-label="Entrada"></label>
          <label class="fld"><span class="sr">Até</span><input type="date" data-hk="ate" value="${esc(h.ate || '')}" aria-label="Saída"></label>
          <label class="fld"><span class="sr">Situação</span><select data-hk="situacao" aria-label="Situação"><option value="">—</option><option value="incluso" ${h.situacao === 'incluso' ? 'selected' : ''}>incluso</option><option value="a parte" ${h.situacao === 'a parte' ? 'selected' : ''}>à parte</option></select></label>
          <button type="button" class="mini ghost" data-hrm="${k}" aria-label="Tirar este hotel">✕</button></div>`).join('')}
        <button type="button" class="mini" id="oyHotAdd">+ hotel</button></div>
      ${typeof Parceiros !== 'undefined' && Parceiros.all().length ? (() => { const par = oyParceiroDe(o); return `<label class="fld">Indicado por (parceiro)<select id="oyPar"><option value="">ninguém</option>${Parceiros.all().map(p => `<option value="${esc(p.id)}" ${par && par.id === p.id ? 'selected' : ''}>${esc(p.nome)}${p.cupom ? ' · ' + esc(p.cupom) : ''}${p.comissao ? ' · ' + p.comissao + '%' : ''}</option>`).join('')}</select></label>`; })() : ''}
      <div class="oy-g2">
        ${[['chegada', 'Chegada'], ['partida', 'Partida']].map(([k, n]) => `<fieldset class="oy-voo"><legend>${n}</legend>
          <div class="oy-vg">
            <label class="fld"><span class="sr">${n}: dia</span><input type="date" data-v="${k}.data" value="${esc(o[k].data)}" aria-label="${n}: dia"></label>
            <label class="fld"><span class="sr">${n}: hora do voo</span><input type="time" data-v="${k}.hora" value="${esc(oyHm(o[k].hora) || '')}" aria-label="${n}: hora do voo"></label>
            <label class="fld"><span class="sr">${n}: voo</span><input data-v="${k}.voo" value="${esc(o[k].voo)}" placeholder="voo" aria-label="${n}: número do voo"></label>
          </div></fieldset>`).join('')}
      </div>
    </section>

    <section class="card oy-card">
      <div class="oy-hrow"><h2 class="oy-h">Roteiro</h2><span class="oy-sub">${o.itens.length ? `${o.itens.length} ${o.itens.length === 1 ? 'serviço' : 'serviços'}${nDias ? ' · ' + nDias + (nDias === 1 ? ' dia' : ' dias') : ''}` : ''}</span></div>
      ${!o.itens.length ? '<p class="why">Nenhum serviço ainda. Comece pelo passeio, pelo traslado de chegada ou por uma linha em branco.</p>'
        : largo ? planilha() : grupos.map(g => `<div class="oy-dia"><h3 class="oy-diah"><span>${esc(oyDiaCurto(g.d))}</span>${g.d ? `<button type="button" class="oy-band-add" data-adddia="${esc(g.d)}" aria-label="Acrescentar passeio em ${esc(oyDiaCurto(g.d))}">+ neste dia</button>` : ''}</h3>${g.l.map(linhaItem).join('')}</div>`).join('')}
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
        <p class="why">Cada serviço vira reserva e abre o roteiro da viagem, pronto para mandar no WhatsApp, por link ou PDF.</p>
        <button type="button" class="cta" id="oyFecha2">Fechou — criar as reservas</button></section>` : ''}

    <details class="card oy-card oy-mais" ${S.mais ? 'open' : ''}><summary><b>Mais opções</b><small>e-mail, situação, sinal, textos da proposta, arquivos</small></summary>
      <div class="oy-g2">
        <label class="fld">E-mail do cliente<input id="oyEmail" value="${esc(o.cliente.email)}" inputmode="email" autocomplete="off"></label>
        <label class="fld">Situação<select id="oySt">${ORC_STATUS.map(s => `<option value="${s[0]}" ${o.status === s[0] ? 'selected' : ''}>${s[1]}</option>`).join('')}</select></label>
      </div>
      <div class="oy-g2">
        <label class="fld">Sinal para reservar (%)<input type="number" min="0" max="100" inputmode="numeric" id="oyPct" value="${o.sinalPct}"></label>
        <label class="fld">VAT (%)<input type="number" min="0" max="30" step="0.5" inputmode="decimal" id="oyVat" value="${o.vatPct != null && o.vatPct !== '' ? +o.vatPct : OY_VAT}"></label>
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
      <span class="sbwhat">${esc(oyBarraTexto(o))}</span>
      <div class="oy-barra-acs"><button type="button" class="mini strong oy-salvar" id="oySalvar">Salvar</button><a class="cta sm" href="#/adm/proposta/${esc(o.id)}">Ver e enviar a proposta</a></div>
    </div>
  </div>`);
  S.pendente = false;
  oyLiga(o);
}

/* os três números do alto (sem campo dentro: refazem a cada mudança, mesmo com ela digitando ao lado) */
function oyTotHtml(o) {
  const m = oyMoeda(o), soma = o.itens.reduce((s, i) => s + (+i.valor || 0), 0), pv = String(oyVatPct(o)).replace('.', ',');
  const t = oyPorTipo(o), cri = +o.criancas > 0;
  return `<div><small>${oyTotInf(o) ? 'Total que você fechou' : oyVatPct(o) ? 'Total com VAT' : 'Total sem VAT'}</small><b>${esc(oyM(Orc.total(o), m))}</b><small>${oyTotInf(o)
      ? (oyVatPct(o) ? 'já com VAT ' + esc(pv) + '% (' + esc(oyM(Orc.vat(o), m)) + ') dentro · ' : 'sem VAT · ') + 'serviços somam ' + esc(oyM(soma, m))
      : esc(oyM(Orc.subtotal(o), m)) + (+o.desconto ? ' (com desconto)' : '') + (oyVatPct(o) ? ' + VAT ' + esc(pv) + '% ' + esc(oyM(Orc.vat(o), m)) : ' · sem VAT')}</small></div>
    <div class="oy-pp"><small>Por pessoa</small>${!oyPax(o) ? '<b>—</b>' : cri
      ? `<b>${esc(oyM(t.adulto, m))} <i>adulto</i></b><b>${esc(oyM(t.crianca, m))} <i>criança</i></b>`
      : `<b>${esc(oyM(t.adulto, m))}</b>`}<small>${esc(oyPaxTexto(o) || 'informe as pessoas')}</small></div>
    <div><small>Pendente</small><b>${esc(oyM(oyPendente(o), m))}</b></div>`;
}
function oyPagValHtml(o) {
  const p = oyPagValor(o), m = oyMoeda(o);
  const linha = (rot, v, k) => `<div class="oy-pagv"><span>Valor ${esc(rot)}</span><b>${esc(oyM(v, m))}</b><button type="button" class="mini" data-copia="${v.toFixed(2)}" aria-label="Copiar o valor ${esc(rot)}">copiar</button></div>`;
  return linha(p.rot, p.v) + (p.vc ? linha('por criança', p.vc) : '');
}
function oyValoresHtml(o) {
  return `<div class="oy-hrow"><h2 class="oy-h">Valores</h2></div>
    <div class="oy-tot" id="oyTot">${oyTotHtml(o)}</div>
    <label class="optin oy-vatck"><input type="checkbox" id="oyComVat" ${o.semVat ? '' : 'checked'}><span><b>Incluir VAT de ${esc(String(o.vatPct != null && o.vatPct !== '' ? +o.vatPct : OY_VAT).replace('.', ','))}%</b><small>desmarque quando este orçamento for sem VAT</small></span></label>
    <div class="oy-g3v">
      <label class="fld">Já pago (USD)<input type="number" min="0" inputmode="decimal" id="oyPago" value="${+o.pago || ''}" placeholder="0"></label>
      <label class="fld">Desconto (USD)<input type="number" min="0" inputmode="decimal" id="oyDesc" value="${+o.desconto || ''}" placeholder="0"></label>
      <label class="fld" title="o total que você fecha com o cliente; em branco, o app soma os serviços e põe o VAT">Total que você fecha (USD)<input type="number" min="0" step="0.01" inputmode="decimal" id="oyTotInf" value="${oyTotInf(o) || ''}" placeholder="soma dos serviços"></label>
      <label class="fld">Válida até<input type="date" id="oyVal2" value="${esc(o.validade)}"></label>
    </div>
    <label class="optin oy-vatck"><input type="checkbox" id="oyMostraVal" ${o.mostraValores ? 'checked' : ''}><span><b>Mostrar o valor de cada serviço na proposta</b><small>desmarcado, a proposta mostra só o total</small></span></label>
    <div class="oy-pag"><span class="op-lbl">Dividir o valor por</span>
      <div class="chips" role="group" aria-label="Dividir o valor por">${OY_PAG.map(([k, n]) => `<button type="button" class="chip ${oyPagModo(o) === k ? 'on' : ''}" data-pagmodo="${k}" aria-pressed="${oyPagModo(o) === k}">${n}</button>`).join('')}</div>
      <div id="oyPagV">${oyPagValHtml(o)}</div>
      <label class="fld">Link ${esc(oyPagValor(o).rot)} (Pix e cartão — da sua plataforma)<input type="url" inputmode="url" id="oyLinkPag" value="${esc(o.linkPagamento || '')}" placeholder="https://…" autocomplete="off"></label>
      ${oyPagModo(o) === 'pessoa' && +o.criancas > 0 ? `<label class="fld">Link por criança<input type="url" inputmode="url" id="oyLinkPagC" value="${esc(o.linkPagamentoCrianca || '')}" placeholder="https://…" autocomplete="off"></label>` : ''}
    </div>
    <p class="why oy-usd">Tudo em dólar (USD). Crie o link na sua plataforma com o valor acima e cole aqui: a proposta mostra o botão "Pagar".</p>`;
}

/* salva o que está na tela (sem redesenhar) */
function oyLe(o) {
  const v = (s) => { const e = document.querySelector(s); return e ? e.value : null; };
  const nome = v('#oyNome'); if (nome == null) return;
  o.cliente = { nome: nome.trim(), whats: (v('#oyWhats') || '').trim(), email: (v('#oyEmail') ?? o.cliente.email ?? '').trim() };
  const hs = [...document.querySelectorAll('.oy-hot')].map(r => { const g = (k) => (r.querySelector(`[data-hk="${k}"]`) || {}).value || ''; return { nome: g('nome').trim(), de: g('de'), ate: g('ate'), situacao: g('situacao') }; });
  if (hs.length) { o.hoteis = hs; o.hotel = (hs.find(h => h.nome) || {}).nome || ''; }
  if (v('#oyPar') != null) { o.parceiroId = v('#oyPar'); if (!o.parceiroId) o.parceiroCodigo = ''; }
  $$('[data-v]').forEach(e => { const [k, c] = e.dataset.v.split('.'); o[k] = o[k] || {}; o[k][c] = c === 'hora' ? (oyHm(e.value) || e.value.trim()) : e.value.trim(); });
  document.querySelectorAll('.oy [data-it]').forEach(box => {
    const i = o.itens.find(z => z.id === box.dataset.it); if (!i) return;
    const antes = { opcao: +i.opcao || 0, pax: +i.pax || 1, cri: +i.criancas || 0, horas: +i.horas || 0 }, x = i.tourId && Tours.get(i.tourId);
    const tituloAuto = x && i.desc === oyTituloDe(x, antes.opcao);
    const ad = box.querySelector('[data-k="adultosIt"]'), cr = box.querySelector('[data-k="criancas"]');
    if (ad && cr && ad.closest('[data-it]') === box) { const a = Math.max(0, +ad.value || 0), c = Math.max(0, +cr.value || 0); i.pax = Math.max(1, a + c); i.criancas = Math.min(c, i.pax); }
    box.querySelectorAll('[data-k]').forEach(e => {
      if (e.closest('[data-it]') !== box) return;
      const k = e.dataset.k;
      if (k === 'pax') i.pax = Math.max(1, +e.value || 1);
      else if (k === 'valor') { const n = +e.value || 0; if (n !== i.valor) i.auto = false; i.valor = n; }
      else if (k === 'custo') i.custo = +e.value || 0;
      else if (k === 'hora' || k === 'horaFim') i[k] = oyHm(e.value) || e.value.trim();
      /* "09:00–17:00", "9h às 17h", "19:30" */
      else if (k === 'faixa') { const v = String(e.value).trim(); if (!v) { i.hora = ''; i.horaFim = ''; } else { const [a, b] = oyFaixaPartes(v); i.hora = oyHm(a) || String(a || '').trim(); i.horaFim = b ? (oyHm(b) || String(b).trim()) : ''; } }
      else if (k === 'opcao') i.opcao = Math.max(0, +e.value || 0);
      else if (k === 'horas') i.horas = Math.max(x && +x.minHoras || 1, Math.round(+e.value || 1));
      else if (k === 'aParte') { i.aParte = !!e.checked; if (i.aParte) { i.valor = 0; i.auto = false; } }
      else if (k === 'adultosIt' || k === 'criancas') { /* já lidos acima */ }
      else i[k] = e.value;
    });
    /* mudou a opção ou as pessoas: o preço da tabela refaz (e o título leva a opção nova) */
    if (x && (i.opcao !== antes.opcao || i.pax !== antes.pax || (+i.criancas || 0) !== antes.cri || (+i.horas || 0) !== antes.horas)) {
      if ((+i.horas || 0) !== antes.horas) i.auto = true;
      if (i.opcao !== antes.opcao) i.auto = true;
      if (i.auto) i.valor = oyPrecoItem(x, i).total || i.valor;
      if (tituloAuto && i.opcao !== antes.opcao) i.desc = oyTituloDe(x, i.opcao);
    }
  });
  const n = (s, d) => { const x = v(s); return x == null ? d : (+x || 0); };
  o.pago = n('#oyPago', o.pago); o.desconto = n('#oyDesc', o.desconto); o.totalInformado = n('#oyTotInf', o.totalInformado || 0);
  if (v('#oyLinkPag') != null) o.linkPagamento = String(v('#oyLinkPag')).trim();
  if (v('#oyLinkPagC') != null) o.linkPagamentoCrianca = String(v('#oyLinkPagC')).trim();
  o.moeda = OY_MOEDA; o.validade = v('#oyVal2') || o.validade;
  if (v('#oySt')) o.status = v('#oySt');
  if (v('#oyPct') != null) o.sinalPct = +v('#oyPct') || 0;
  if (v('#oyVat') != null && v('#oyVat') !== '') o.vatPct = Math.max(0, +v('#oyVat') || 0);
  const cv = document.getElementById('oyComVat'); if (cv) o.semVat = !cv.checked;
  const mv = document.getElementById('oyMostraVal'); if (mv) o.mostraValores = !!mv.checked;
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
  oyLe(o);
  const d = new Date(); o.salvoEm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  Orc.salva(o); ppRepublica(o);
  const s = $('#oySalvo'); if (s) s.textContent = 'salvo às ' + o.salvoEm;
  const tot = $('#oyTot'); if (tot) tot.innerHTML = oyTotHtml(o);
  const pv = $('#oyPagV'); if (pv) { pv.innerHTML = oyPagValHtml(o); oyLigaCopia(); }
  const bar = document.querySelector('.oy-barra .sbwhat'); if (bar) bar.textContent = oyBarraTexto(o);
  if (redesenha === 'quieto') { const S = oyTela._s; if (S) S.pendente = true; oyQuieto(o); }
  else if (redesenha) oyRedesenha(o);
}
/* DATA E HORÁRIO (28/10/2026, ele: "data e horário não estava dando pra mudar"): ela mudava a hora,
   tocava na data e o app redesenhava a tela na hora — o campo em que ela acabara de tocar era trocado
   por outro (no celular o calendário fechava; no computador "23" virava "03"). Agora o que só muda a
   ORDEM (dia, hora, faixa, valor do cartão) espera ela sair de todos os campos para reorganizar.
   O que muda o preço (opção, pessoas, à parte) continua redesenhando na hora. */
const oyNumCampo = () => { const a = document.activeElement; return !!(a && a.closest && a.closest('.oy') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)); };
/* dedo (ou mouse) apertado: espera soltar — redesenhar no meio do clique engolia o toque no botão */
let oyDedo = false;
if (typeof addEventListener === 'function') {
  addEventListener('pointerdown', () => { oyDedo = true; }, true);
  for (const ev of ['pointerup', 'pointercancel']) addEventListener(ev, () => { oyDedo = false; }, true);
}
function oyQuieto(o) {
  setTimeout(() => {
    const S = oyTela._s; if (!S || !S.pendente || oyNumCampo()) return;
    if (oyDedo) return oyQuieto(o);
    if (!document.querySelector('.oy') || location.hash !== '#/adm/consulta/' + o.id) { S.pendente = false; return; }
    S.pendente = false; oyRedesenha(o);
  }, 220);
}
const oyBarraTexto = (o) => oyM(Orc.total(o), oyMoeda(o)) + (oyPorTipoTexto(o, true) ? ' · ' + oyPorTipoTexto(o, true) : '');
function oyLigaValores(o) {
  $$('#oyVal input').forEach(e => { e.onchange = () => oySalva(o, false); });
  $$('[data-pagmodo]').forEach(b => b.onclick = () => { oyLe(o); o.pagModo = b.dataset.pagmodo; oySalva(o, true); });
  oyLigaCopia();
}
function oyLigaCopia() {
  $$('[data-copia]').forEach(b => b.onclick = async () => {
    try { await navigator.clipboard.writeText(b.dataset.copia); toast('Valor copiado: ' + b.dataset.copia); } catch (e) { toast('Valor: ' + b.dataset.copia); }
  });
}
function oyLiga(o) {
  /* BOTÕES (28/10/2026, ela: "não está me dando a opção de adicionar mais hotel"): cada botão já lê a
     tela (oyLe) ANTES de mexer; depois só grava e redesenha. Antes o "re" relia a tela velha e
     desfazia o que o botão tinha acabado de fazer — "+ hotel" sumia, o ✕ do hotel voltava, o "preço
     da tabela" e o −/+ de adultos não refaziam o valor na planilha. */
  const S = oyTela._s, re = () => {
    const d = new Date(); o.salvoEm = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
    Orc.salva(o); ppRepublica(o); oyRedesenha(o);
  };
  /* digitou: guarda; saiu do campo: redesenha o que depende (valores, ordem dos dias) */
  $$('.oy input, .oy textarea, .oy select').forEach(e => {
    if (e.closest('#oyVal') || e.id === 'orLkNome' || e.id === 'orLkUrl') return;
    e.oninput = () => { clearTimeout(e._t); e._t = setTimeout(() => oySalva(o, false), 700); };
    /* DATA (28/10/2026, "as datas selecionadas estão mudando/bugando"): no computador o campo de
       data dispara "change" a cada dígito do ano (0002 → 0020 → 0202 → 2026); redesenhar ali
       tirava o cursor no meio e a data ficava errada. Agora: enquanto mexe, só guarda; ao SAIR do
       campo, reorganiza os dias uma vez. */
    if (e.type === 'date' || e.type === 'time') { e.onchange = () => oySalva(o, 'quieto'); return; }
    e.onchange = () => {
      if (['oyNome', 'oyWhats', 'oyEmail'].includes(e.id)) { oyLe(o); Orc.salva(o); oyLigaCliente(o); }
      /* só o que muda a ordem ou o preço redesenha; o valor na planilha só refaz os totais */
      const naPlanilha = !!e.closest('.oy-row');
      const muda = e.matches('[data-k="aParte"],[data-k="pax"],[data-k="opcao"],[data-k="adultosIt"],[data-k="criancas"],[data-k="horas"],#oyVat');
      const ordem = e.matches('[data-k="faixa"]') || (!naPlanilha && e.matches('[data-k="valor"]'));
      oySalva(o, muda ? true : ordem ? 'quieto' : false);
    };
  });
  const raiz = document.querySelector('.oy'); if (raiz) raiz.addEventListener('focusout', () => { if (S.pendente) oyQuieto(o); });
  /* os detalhes crescem com o texto, como a célula do Excel */
  const cresce = (t) => { t.style.height = 'auto'; t.style.height = (t.scrollHeight + 2) + 'px'; };
  $$('.oy-cx').forEach(t => { cresce(t); t.addEventListener('input', () => cresce(t)); });
  oyLigaValores(o);
  $$('[data-oyabre]').forEach(b => b.onclick = () => { oyLe(o); Orc.salva(o); S.aberto = S.aberto === b.dataset.oyabre ? '' : b.dataset.oyabre; re(); });
  $$('[data-step]').forEach(b => b.onclick = () => {
    oyLe(o); const antes = oyPax(o), k = b.dataset.step;
    o[k] = Math.max(0, (+o[k] || 0) + +b.dataset.d);
    if (k === 'adultos' && !o.adultos && !o.criancas) o.adultos = 1;
    oyMudaPax(o, antes); Orc.salva(o); ppRepublica(o); re();
  });
  $$('[data-rap]').forEach(b => b.onclick = () => {
    const box = b.closest('[data-it]'), ta = box && box.querySelector('[data-k="naoIncluso"]'); if (!ta) return;
    const l = oyFrases(ta.value), f = b.dataset.rap, tem = l.some(x => x.toLowerCase() === f.toLowerCase());
    ta.value = (tem ? l.filter(x => x.toLowerCase() !== f.toLowerCase()) : [...l, f]).join(', ');
    b.classList.toggle('on', !tem); b.setAttribute('aria-pressed', String(!tem)); oySalva(o, false);
  });
  /* FOTO PARA O QUE NÃO ESTÁ NO CATÁLOGO (28/10/2026, a Milla: "incluir foto quando for algo que não está
     no catálogo, tipo hotel"): sobe para a pasta de fotos e vale para a proposta e o roteiro */
  $$('[data-fotoup]').forEach(inp => inp.onchange = async () => {
    const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
    const box = inp.closest('[data-it]'); oyLe(o); const i = box && o.itens.find(z => z.id === box.dataset.it); if (!i) return;
    toast('Subindo a foto…');
    try {
      let src = await readImageResized(f, 1400, 0.82);
      if (typeof fotoNaNuvem === 'function') src = await fotoNaNuvem(src, 'orc-' + o.id);
      i.foto = src; re(); toast('Foto na proposta ✓');
    } catch (e) { toast('Não consegui ler essa foto'); }
  });
  $$('[data-foto]').forEach(b => b.onclick = () => { oyLe(o); const i = o.itens.find(z => z.id === S.aberto); if (i) i.foto = b.dataset.foto; Orc.salva(o); re(); });
  $$('[data-rmi]').forEach(b => b.onclick = () => {
    oyLe(o); const k = o.itens.findIndex(i => i.id === b.dataset.rmi); if (k < 0) return;
    const [tirado] = o.itens.splice(k, 1); S.aberto = ''; S.desfazer = { item: tirado, k }; Orc.salva(o); re();
    setTimeout(() => oyDesfazBarra(o), 60);
  });
  $$('[data-dup]').forEach(b => b.onclick = () => { oyLe(o); const i = o.itens.find(z => z.id === b.dataset.dup); if (!i) return; const n = Orc._item({ ...i, id: '' }); o.itens.push(n); S.aberto = n.id; Orc.salva(o); re(); });
  $$('[data-recalc]').forEach(b => b.onclick = () => {
    oyLe(o); const i = o.itens.find(z => z.id === b.dataset.recalc); if (!i) return;
    const x = Tours.get(i.tourId), n = Orc.itemDoCatalogo(i.tourId, { pax: i.pax, data: i.data, hora: i.hora, opcao: i.opcao });
    if (x) { i.valor = oyPrecoItem(x, i).total || (n && n.valor) || 0; if (n) i.sinal = n.sinal; i.auto = true; }
    Orc.salva(o); re();
  });
  $$('[data-tr]').forEach(b => b.onclick = () => {
    oyLe(o); const qual = b.dataset.tr, p = o[qual] || {};
    if (!p.data) { toast(`Coloque o dia da ${qual === 'chegada' ? 'chegada' : 'partida'} primeiro`); const e = document.querySelector(`[data-v="${qual}.data"]`); if (e) e.focus(); return; }
    const n = oyTraslado(o, qual === 'chegada' ? 'chegada' : 'saida'); o.itens.push(n); S.aberto = n.id; Orc.salva(o); re();
  });
  $('#oyAddL').onclick = () => { oyLe(o); const ult = oyOrdena(o.itens.filter(i => i.data)).pop(); const n = Orc._item({ tipo: 'livre', desc: '', pax: oyPax(o) || 2, data: S.ultimoDia || (ult && ult.data) || oyProximoDia(o) }); o.itens.push(n); S.aberto = matchMedia('(min-width: 761px)').matches ? '' : n.id; Orc.salva(o); re(); setTimeout(() => { const e = document.querySelector(`[data-it="${n.id}"] [data-k="desc"]`); if (e) e.focus(); }, 60); };
  $('#oyAddP').onclick = () => { oyLe(o); Orc.salva(o); oyCatalogo(o); };
  $$('[data-adddia]').forEach(b => b.onclick = () => { oyLe(o); Orc.salva(o); S.ultimoDia = b.dataset.adddia; oyCatalogo(o, b.dataset.adddia); });
  /* SALVAR (28/10/2026, "onde está o botão de salvar?"): o app já salva sozinho; o botão confirma */
  $('#oySalvar').onclick = () => { oySalva(o, S.pendente ? true : false); oyLigaCliente(o); toast('Orçamento salvo ✓'); };
  $('#oyHotAdd').onclick = () => { oyLe(o); o.hoteis = [...oyHoteis(o, true), { nome: '', de: '', ate: '', situacao: '' }]; Orc.salva(o); re(); };
  $$('[data-hrm]').forEach(b => b.onclick = () => { oyLe(o); o.hoteis = oyHoteis(o, true).filter((_, k) => k !== +b.dataset.hrm); o.hotel = (o.hoteis.find(h => String(h.nome || '').trim()) || {}).nome || ''; Orc.salva(o); re(); });
  const det = document.querySelector('.oy-mais'); if (det) det.ontoggle = () => { S.mais = det.open; };
  $('#oyPadrao').onclick = () => { oyLe(o); DB.settings.propPolitica = o.politica; DB.settings.propCondicoes = o.condicoes; DB.settings.propDiferencial = o.diferencial; save(); Orc.salva(o); toast('Textos guardados para as próximas propostas'); };
  $('#orLkAdd').onclick = () => { oyLe(o); const r = Orc.linkAdd(o.id, $('#orLkNome').value, $('#orLkUrl').value); if (r && r.erro) return toast(r.erro); re(); };
  $('#oyApaga').onclick = () => { if (confirm('Apagar este orçamento?')) { Orc.remove(o.id); go('/adm/consulta'); } };
  for (const fid of ['#oyFecha', '#oyFecha2']) { const fb = $(fid); if (fb) fb.onclick = () => { oyLe(o); Orc.salva(o); oyFechar(o); }; }
  const kb = $('#oyKit'); if (kb) kb.onclick = () => Kit.abrir(kb.dataset.kitb);
  opLigaCards && opLigaCards(re);
}

/* "Serviço tirado · desfazer" por 8 segundos */
function oyDesfazBarra(o) {
  const S = oyTela._s; if (!S || !S.desfazer) return;
  document.querySelectorAll('.oy-desfaz').forEach(e => e.remove());
  const el = document.createElement('div'); el.className = 'oy-desfaz'; el.setAttribute('role', 'status');
  el.innerHTML = `<span>Tirado: ${esc(S.desfazer.item.desc || 'serviço')}</span><button type="button">desfazer</button>`;
  document.body.appendChild(el);
  const some = setTimeout(() => { el.remove(); if (S.desfazer) S.desfazer = null; }, 8000);
  el.querySelector('button').onclick = () => {
    clearTimeout(some); el.remove(); const x = Orc.get(o.id), d = S.desfazer; if (!x || !d) return;
    x.itens.splice(Math.min(d.k, x.itens.length), 0, d.item); S.desfazer = null; Orc.salva(x); toast('Voltou'); const y = scrollY; oyTela(o.id); scrollTo(0, y);
  };
}

/* a janela do catálogo: busca, filtro por região, um toque acrescenta */
/* 28/10/2026, ele: "quando ela clica em + está indo pra outra data" — antes, depois de cada
   passeio acrescentado, o dia pulava sozinho para o próximo dia livre. Agora o dia escolhido
   fica até ela trocar; o "+ neste dia" de cada faixa abre já naquele dia. */
function oyCatalogo(o, diaFixo) {
  const m = oyMoeda(o);
  const dias = oyDiasDaViagem(o); if (diaFixo && !dias.includes(diaFixo)) { dias.push(diaFixo); dias.sort(); }
  const S0 = oyTela._s || {};
  const C = oyCatalogo._s = { q: '', r: '', dia: diaFixo || S0.ultimoDia || oyProximoDia(o), n: 0 };
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
    const pax = oyPax(o) || 2, cri = Math.min(pax, +o.criancas || 0);
    const grupo = `${pax - cri} ${pax - cri === 1 ? 'adulto' : 'adultos'}${cri ? ' + ' + cri + (cri === 1 ? ' criança' : ' crianças') : ''}`;
    const preco = (x, k) => oyPrecoItem(x, { pax, criancas: cri, opcao: k }).total || 0;
    d.querySelector('#oyCL').innerHTML = l.length ? l.map(x => {
      const f = oyFotosDe(x)[0], ops = oyOpcoes(x);
      const foto = `<span class="oy-cft" ${f ? `style="background-image:url('${esc(f)}')"` : ''} aria-hidden="true"></span>`;
      /* com opções: uma linha por opção (preço do adulto e da criança, e o total do grupo) */
      if (oyTemOpcoes(x)) return `<div class="oy-cit oy-citop ${ja.has(x.id) ? 'ja' : ''}">${foto}
        <div class="oy-cnm"><b>${esc(x.name.pt)}</b><small>${esc(grupo)}${ja.has(x.id) ? ' · já no roteiro' : ''}</small>
          <div class="oy-cops" role="group" aria-label="Opções de ${esc(x.name.pt)}">${ops.map((op, k) => { const v = preco(x, k), pc = +op.precoCrianca || 0;
            return `<button type="button" class="oy-cop" data-cadd="${esc(x.id)}" data-cop="${k}"><span><b>${esc(oyOpNome(op) || 'Opção ' + (k + 1))}</b><small>${esc(oyM(+op.preco || 0, OY_MOEDA))}${pc ? ' · criança ' + esc(oyM(pc, OY_MOEDA)) : ''}</small></span><em>${v ? esc(oyM(v, OY_MOEDA)) : 'consultar'}</em>${oyIc('mais')}</button>`; }).join('')}</div></div></div>`;
      const v = preco(x, 0), pc = oyPrecoCrianca(x, 0);
      return `<button type="button" class="oy-cit ${ja.has(x.id) ? 'ja' : ''}" data-cadd="${esc(x.id)}">${foto}
        <span class="oy-cnm"><b>${esc(x.name.pt)}</b><small>${v ? esc(oyM(v, OY_MOEDA)) + ' · ' + esc(grupo) : 'sob consulta'}${pc ? ' · criança ' + esc(oyM(pc, OY_MOEDA)) : ''}${ja.has(x.id) ? ' · já no roteiro' : ''}</small></span>
        <span class="oy-cmais">${oyIc('mais')}</span></button>`;
    }).join('') : '<p class="why">Nada com esse nome. Use "Item livre" para escrever à mão.</p>';
    d.querySelectorAll('[data-cadd]').forEach(b => b.onclick = () => {
      const dia = C.dia || '';
      const n = oyDoCatalogo(o, b.dataset.cadd, { data: dia, opcao: +b.dataset.cop || 0 });
      if (!n) return;
      o.itens.push(n); Orc.salva(o); ppRepublica(o); C.n++;
      d.querySelector('#oyCN').textContent = `${C.n} acrescentado${C.n > 1 ? 's' : ''} · ${n.desc}${dia ? ' em ' + opCurta(dia) : ''}`;
      S0.ultimoDia = C.dia;   /* o próximo passeio vai para o MESMO dia, até ela escolher outro */
      pinta();
    });
  };
  pinta();
  d.querySelector('#oyCQ').oninput = (e) => { C.q = e.target.value; pinta(); };
  if (typeof matchMedia === 'function' && matchMedia('(pointer: fine)').matches) setTimeout(() => d.querySelector('#oyCQ').focus(), 30);
  d.querySelectorAll('[data-creg]').forEach(b => b.onclick = () => { C.r = b.dataset.creg; d.querySelectorAll('[data-creg]').forEach(c => c.classList.toggle('on', c === b)); pinta(); });
  d.querySelectorAll('[data-cdia]').forEach(b => b.onclick = () => { C.dia = b.dataset.cdia; S0.ultimoDia = C.dia; d.querySelectorAll('[data-cdia]').forEach(c => c.classList.toggle('on', c === b)); });
  /* o dia escolhido aparece na tela (no celular o "+ neste dia" de um dia lá do fim ficava escondido à direita) */
  const diaOn = d.querySelector('#oyCDias .chip.on'), fila = d.querySelector('#oyCDias');
  if (diaOn && fila) fila.scrollLeft += diaOn.getBoundingClientRect().left - fila.getBoundingClientRect().left - (fila.clientWidth - diaOn.offsetWidth) / 2;
  const di = d.querySelector('#oyCDia'); if (di) di.onchange = () => { C.dia = di.value; S0.ultimoDia = C.dia; };
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
    d.close();
    /* fechou → já abre o ROTEIRO DA VIAGEM, pronto para mandar (WhatsApp, link ou PDF) */
    if (bs.length && typeof Kit !== 'undefined') { toast(`${bs.length} ${bs.length === 1 ? 'reserva criada' : 'reservas criadas'} 🎉 · agora é só mandar o roteiro`); Kit.abrir(Kit.daReserva(bs[0])); }
    else { toast(`${bs.length} ${bs.length === 1 ? 'reserva criada' : 'reservas criadas'} 🎉`); oyTela(o.id); scrollTo(0, 0); }
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
  /* chegada/partida: o dia numa linha, hora e voo embaixo (o voo "EK262" aparecia cortado em "EK") */
  .oy-vg{display:grid;grid-template-columns:1fr 1fr;gap:0 8px}
  .oy-vg .fld:first-child{grid-column:1/-1}
  .oy .fld{min-width:0}.oy .fld input{min-width:0}
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
  .oy-pp b + b{margin-top:0}
  .oy-pp b i{font-style:normal;font-size:12px;font-weight:600;color:var(--ink-3)}
  .oy-vatck{margin:0 0 12px}
  .oy-pag{display:grid;gap:8px;margin:4px 0 8px}
  .oy-rap{display:flex;flex-wrap:wrap;gap:6px;margin:-4px 0 12px}
  .oy-ftup{display:flex;align-items:center;justify-content:center;cursor:pointer;font-weight:600;font-size:13px;border:1px dashed var(--line-2);background:var(--surface)}
  .oy-cfoto{display:block;width:96px;height:64px;margin:6px 0 2px;border:0;border-radius:8px;background-size:cover;background-position:center;background-color:var(--surface-2);cursor:pointer}
  .oy-itf{float:left;width:40px;height:40px;margin-right:10px;border-radius:8px;background-size:cover;background-position:center}
  .oy-rap .chip{min-height:36px}
  .oy-pag .chips{display:flex;flex-wrap:wrap;gap:6px}
  .oy-pagv{display:flex;align-items:center;gap:10px;background:var(--surface-2);border-radius:var(--r-md,12px);padding:8px 12px}
  .oy-pagv span{color:var(--ink-3);font-size:13px}.oy-pagv b{margin-left:auto;font-variant-numeric:tabular-nums}
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
  .oy-shh,.oy-row{display:grid;grid-template-columns:150px 118px minmax(0,1fr) 112px 84px;align-items:start}
  .oy-cacs{display:flex;gap:2px}
  .oy-crm:hover{color:var(--danger);background:var(--danger-wash)}
  .oy-barra-acs{display:flex;gap:8px;align-items:center}
  .oy-desfaz{position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:300;display:flex;align-items:center;gap:14px;padding:10px 10px 10px 16px;border-radius:999px;background:var(--ink);color:var(--paper);box-shadow:var(--sh-2);max-width:92vw}
  .oy-desfaz span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:14px}
  .oy-desfaz button{border:0;border-radius:999px;padding:8px 14px;background:var(--accent);color:var(--accent-ink);font:inherit;font-weight:700;cursor:pointer}
  .oy-shh{background:#141414;color:#D4AF37;font-size:11.5px;font-weight:700;letter-spacing:.07em;text-transform:uppercase}
  .oy-shh > span{padding:9px 12px}
  .oy-r{text-align:right}
  .oy-band{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#F7E9BE;color:#1a1405;font-weight:700;font-size:13.5px;padding:5px 8px 5px 12px;border-top:1px solid rgba(138,109,30,.25)}
  .oy-band-add{border:1px solid rgba(138,109,30,.35);background:rgba(255,255,255,.6);color:#5C4812;border-radius:999px;min-height:30px;padding:0 12px;font:inherit;font-size:12.5px;font-weight:700;cursor:pointer}
  .oy-band-add:hover{background:#fff}
  .oy-band-add:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .oy-diah{display:flex;align-items:center;justify-content:space-between;gap:8px}
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
  .oy-cobs{display:inline-block;margin:2px 8px 4px;padding:3px 9px;border-radius:10px 10px 10px 3px;background:var(--accent-wash);color:var(--ink-2);font-size:12px}
  .oy-cvoo{display:block;padding:0 8px 4px;color:var(--ink-3);font-size:12px}
  .oy-cv input{text-align:right;font-weight:700;font-variant-numeric:tabular-nums}
  .oy-cm{display:grid;place-items:center;width:38px;height:38px;border:0;border-radius:50%;background:none;color:var(--ink-2);font-size:20px;line-height:1;cursor:pointer}
  .oy-cm:hover,.oy-cm[aria-expanded="true"]{background:var(--surface-2);color:var(--ink)}
  .oy-cm:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .oy-rowmais{padding:10px 14px 14px;background:var(--accent-wash);border-top:1px dashed var(--accent-line)}
  .oy-custo2{min-width:0}
  .oy-opc{align-items:end}
  .oy-hots{margin:4px 0 10px}
  .oy-hot{display:grid;grid-template-columns:minmax(0,1.6fr) 1fr 1fr .9fr 40px;gap:0 8px;align-items:end}
  .oy-hot .fld{margin-bottom:6px}
  .oy-aparte{margin:2px 0 10px}
  .oy-aparte-v{display:block;padding:9px 8px;text-align:right;color:var(--ink-3);font-style:italic}
  .oy-opsel select{min-width:0}
  .oy-pcri{margin:-4px 0 10px;font-size:12.5px}
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
  .oy-citop{grid-template-columns:56px 1fr;cursor:default;align-items:start}
  .oy-citop:hover{background:var(--surface);border-color:var(--line)}
  .oy-cops{display:grid;gap:4px;margin-top:8px}
  .oy-cop{display:grid;grid-template-columns:1fr auto 32px;align-items:center;gap:8px;min-height:44px;padding:6px 6px 6px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface-2);text-align:left;font:inherit;color:var(--ink);cursor:pointer}
  .oy-cop:hover{border-color:var(--accent-line);background:var(--accent-wash)}
  .oy-cop:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
  .oy-cop b{display:block;font-size:13.5px;font-weight:600}
  .oy-cop small{display:block;color:var(--ink-3);font-size:12px}
  .oy-cop em{font-style:normal;font-weight:700;font-variant-numeric:tabular-nums;font-size:13.5px}
  .oy-cop svg{width:30px;height:30px;padding:6px;border-radius:50%;background:var(--accent);color:var(--accent-ink)}
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
    .oy-hot{grid-template-columns:1fr 1fr 40px}
    .oy-hot .fld:first-child{grid-column:1/-1}
    .oy-quando{grid-template-columns:1fr 1fr}
    .oy-quando .fld:first-child{grid-column:1/-1}
    .oy-tot{grid-template-columns:1fr 1fr}
    .oy-tot > div:first-child{grid-column:1/-1}
    .oy-add{grid-template-columns:1fr 1fr}
    .oy-itcab{grid-template-columns:1fr auto 14px;grid-template-areas:'hr v ch' 'n n n';gap:2px 8px;padding:10px 12px}
    .oy-ithr{grid-area:hr}.oy-itv{grid-area:v}.oy-chev{grid-area:ch}.oy-itn{grid-area:n}
    .oy-itn b{white-space:normal;overflow:visible}
  }
  /* o botão do Assistente sobe acima da barra de baixo (senão um tapa o outro) */
  @media(max-width:760px){.oy-barra-acs{flex:1}.oy-barra-acs .cta{flex:1}.oy-barra .cta{flex:1;text-align:center;justify-content:center}body:has(.oy-barra) #iaFab{bottom:calc(150px + env(safe-area-inset-bottom))!important}}
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
    link_pagamento: { type: 'string', description: 'link de pagamento da plataforma dela (https://…): vira o botão Pagar agora na proposta' },
    total_informado: { type: 'number', description: 'o TOTAL que ela fechou (USD, com centavos). Vale exatamente esse número; o VAT fica dentro.' },
    pagamento_por: { type: 'string', enum: ['total', 'pessoa', 'casal'], description: 'o que o link de pagamento cobra (padrão: total)' },
    com_vat: { type: 'boolean', description: 'false = orçamento SEM VAT (ela disse "sem VAT", "não cobrar VAT"); sem este campo fica como está (novo nasce com VAT de 5%)' },
    hoteis: { type: 'array', description: 'hotéis por período, como ela escreve ("07-11/11 Sofitel Downtown *a parte")', items: { type: 'object', properties: { nome: { type: 'string' }, de: { type: 'string', description: 'AAAA-MM-DD' }, ate: { type: 'string', description: 'AAAA-MM-DD' }, situacao: { type: 'string', enum: ['incluso', 'a parte'] } } } },
  };
  const ITEM_EXTRA = { hora_fim: { type: 'string', description: 'SÓ se ela disse o horário de término' }, texto: { type: 'string', description: 'SOMENTE o texto que ELA escreveu, copiado. Nunca escreva um texto seu. Passeio do catálogo já vem com o texto dele; serviço fora do catálogo sem texto dela fica sem texto.' },
    incluso: { type: 'string' }, destaque: { type: 'string', description: 'ex.: manhã livre, à noite' }, voo: { type: 'string' },
    nao_incluso: { type: 'string', description: 'o NÃO INCLUSO do serviço, como ela escreveu' },
    obs: { type: 'string', description: 'observação do serviço (vira um balão na proposta), ex.: "Não incluso volta para o hotel (por conta da cliente)", "Sugestão: jantar em Dubai Marina"' },
    a_parte: { type: 'boolean', description: 'serviço "(a parte)": entra no roteiro, por conta do cliente, sem valor' },
    opcao: { type: 'string', description: 'a opção do passeio, pelo nome (ex.: "prime", "17 minutos", "com serviço de mesa") — ver_passeios mostra as opções' },
    criancas: { type: 'integer', description: 'quantas das pessoas são crianças (o preço de criança entra sozinho)' },
    horas: { type: 'integer', description: 'passeio POR HORA (ex.: iate): quantas horas ela disse; o preço é a hora × horas (nunca menos que o mínimo do passeio)' },
    hora: { type: 'string', description: 'HH:MM — SÓ o horário que ela disse; não disse = deixe sem' },
    tipo: { type: 'string', enum: ['passeio', 'traslado', 'livre'] }, traslado: { type: 'string', enum: ['chegada', 'saida'], description: 'traslado de aeroporto pronto, com o texto e o voo da chegada/partida' } };
  for (const n of ['criar_orcamento', 'editar_orcamento']) {
    const t = acha(n); if (!t) continue;
    Object.assign(t.input_schema.properties, EXTRA);
    const it = t.input_schema.properties.itens && t.input_schema.properties.itens.items;
    if (it && it.properties) Object.assign(it.properties, ITEM_EXTRA);
    t.description += ' Junto: hotel ou hoteis por período, adultos, criancas, chegada e partida (dia, hora, voo), pago, total_informado. TUDO EM DÓLAR (USD). Use EXATAMENTE o que ela mandou. Cada serviço com data e hora; passeio_id traz foto, texto e incluso do catálogo; traslado:"chegada"/"saida" monta o traslado de aeroporto.';
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
    if (/^https:\/\//i.test(String(i.link_pagamento || ''))) o.linkPagamento = String(i.link_pagamento).trim();
    if (i.total_informado != null) o.totalInformado = Math.max(0, +i.total_informado || 0);
    if (i.com_vat != null) o.semVat = i.com_vat === false;
    if (['total', 'pessoa', 'casal'].includes(i.pagamento_por)) o.pagModo = i.pagamento_por;
    if (Array.isArray(i.hoteis)) { o.hoteis = i.hoteis.map(h => ({ nome: String(h.nome || '').trim(), de: isoOk(h.de) ? h.de : '', ate: isoOk(h.ate) ? h.ate : '', situacao: /incl/i.test(h.situacao || '') ? 'incluso' : /parte/i.test(h.situacao || '') ? 'a parte' : '' })).filter(h => h.nome); o.hotel = (o.hoteis[0] || {}).nome || o.hotel || ''; }
    if (i.adultos != null || i.criancas != null) { o.pax = oyPax(o); o.paxNota = oyPaxTexto(o); }
    return antes;
  };
  /* o serviço do jeito novo (foto, texto, incluso; traslado pronto) */
  const servico = (o, it) => {
    if (it.traslado) return oyTraslado(o, it.traslado === 'chegada' ? 'chegada' : 'saida');
    const x = it.passeio_id && Tours.get(it.passeio_id);
    if (x) {
      const k = oyAchaOpcao(x, it.opcao);
      return oyDoCatalogo(o, it.passeio_id, { data: isoOk(it.data) ? it.data : '', hora: oyHm(it.hora), horaFim: oyHm(it.hora_fim), pax: it.pessoas, criancas: it.criancas, opcao: Math.max(0, k), horas: it.horas, valor: it.valor, texto: it.texto, incluso: it.incluso });
    }
    return null;
  };
  const enriquece = (n, it) => Object.assign(n, {
    ...(it.nao_incluso ? { naoIncluso: it.nao_incluso } : {}), ...(it.obs ? { obs: it.obs } : {}), ...(it.a_parte ? { aParte: true, valor: 0, auto: false } : {}),
    ...(it.hora_fim ? { horaFim: oyHm(it.hora_fim) } : {}), ...(it.texto ? { texto: it.texto } : {}), ...(it.incluso ? { incluso: it.incluso } : {}),
    ...(it.destaque ? { rotulo: it.destaque } : {}), ...(it.voo ? { voo: it.voo } : {}), ...(it.tipo ? { tipo: it.tipo } : {}) });

  /* SÓ O QUE VEIO DELA (28/10/2026, ele: "veio informação errada inventada" na proposta). O
     assistente escrevia um texto de propaganda para serviço fora do catálogo (o SeaWorld do
     ORC-0007) e punha horário que ninguém deu. Agora o app confere ANTES de gravar: texto, incluso,
     não incluso, observação, destaque e horário de cada serviço só entram se estão no que ela
     escreveu no chat, num orçamento que já existe ou no catálogo dela. Veio de imagem? Não dá para
     conferir aqui: entra, mas o cartão mostra o texto para ela ver antes do sim. */
  let falaAgora = { texto: '', imagem: false };
  if (typeof iaConversa === 'function') {
    const _conv = iaConversa;
    iaConversa = function (texto, fotos) {
      falaAgora = { texto: String(texto || ''), imagem: Array.isArray(fotos) ? fotos.length > 0 : !!fotos };
      return _conv.apply(this, arguments);
    };
  }
  const oyN = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const horasDe = (t) => new Set([...String(t || '').matchAll(/(\d{1,2})\s*(?:[:h.]\s*(\d{2})|h\b|hs\b|horas?\b)/gi)].map(m => oyHm(m[1] + ':' + (m[2] || '00'))).filter(Boolean));
  function fonteDela(i) {
    let txt = falaAgora.texto, img = falaAgora.imagem;
    try {
      const us = (typeof iaLe === 'function' && typeof IA_HIST !== 'undefined' ? iaLe(IA_HIST, []) : []).filter(m => m && m.role === 'user');
      us.forEach((m, k) => {
        if (typeof m.content === 'string') { txt += '\n' + m.content; return; }
        for (const b of m.content || []) {
          if (b.type === 'text') txt += '\n' + b.text;
          else if (b.type === 'tool_result') txt += '\n' + (typeof b.content === 'string' ? b.content : JSON.stringify(b.content));
          else if ((b.type === 'image' || b.type === 'document') && k >= us.length - 3) img = true;
        }
      });
    } catch (e) {}
    /* os orçamentos de que ela falou (número ou nome do cliente) e o que está sendo mudado: dá para copiar deles */
    const nt = ' ' + oyN(txt) + ' ';
    const alvo = i && i.numero && typeof ingAchaOrc === 'function' ? ingAchaOrc(i.numero).o : null;
    const refs = (DB.orcamentos || []).filter(o => o === alvo || (o.num && nt.includes(' ' + oyN(o.num) + ' ')) || (oyN(o.cliente && o.cliente.nome).length > 2 && nt.includes(' ' + oyN(o.cliente.nome) + ' ')));
    const deOrc = refs.flatMap(o => (o.itens || []).map(x => [x.desc, x.texto, x.incluso, x.naoIncluso, x.obs, x.rotulo, x.hora, x.horaFim].join(' \n '))).join(' \n ');
    const cat = Tours.all().map(x => [oyPt(x.name), oyPt(x.desc), oyLista(x.includes).join(', ')].join(' \n ')).join(' \n ');
    return { n: ' ' + oyN(txt + ' \n ' + deOrc + ' \n ' + cat) + ' ', horas: horasDe(txt + ' \n ' + deOrc), imagem: img };
  }
  /* o texto está no que ela deu? (3 palavras seguidas batendo em pelo menos 60% do texto) */
  function deEla(t, f) {
    const w = oyN(t).split(' ').filter(Boolean); if (!w.length) return true;
    if (w.length < 3) return f.n.includes(' ' + w.join(' ') + ' ');
    let ok = 0; for (let k = 0; k + 2 < w.length; k++) if (f.n.includes(' ' + w.slice(k, k + 3).join(' ') + ' ')) ok++;
    return ok / (w.length - 2) >= 0.6;
  }
  const CAMPOS_TXT = [['texto', 'texto'], ['incluso', 'incluso'], ['nao_incluso', 'não incluso'], ['obs', 'observação'], ['destaque', 'destaque']];
  function soDela(i) {
    if (!Array.isArray(i.itens) || !i.itens.length) return { i, fora: [], conferir: [] };
    const f = fonteDela(i), fora = [], conferir = [];
    const itens = i.itens.map(it => {
      const n = { ...it }, x = it.passeio_id && Tours.get(it.passeio_id);
      const nome = it.descricao || (x ? oyPt(x.name) : it.traslado ? 'traslado de ' + it.traslado : it.item || 'serviço');
      for (const [k, rot] of CAMPOS_TXT) {
        if (!String(n[k] || '').trim()) continue;
        if (f.imagem) { if (k === 'texto' && !x) conferir.push([`Texto de "${nome}"`, String(n[k]).slice(0, 140) + (String(n[k]).length > 140 ? '…' : '') + ' (lido da imagem — confira)']); continue; }
        if (!deEla(n[k], f)) { fora.push(`${rot} de "${nome}"`); delete n[k]; }
      }
      for (const k of ['hora', 'hora_fim']) {
        if (!n[k] || f.imagem) continue;
        if (!f.horas.has(oyHm(n[k]))) { fora.push(`${k === 'hora' ? 'início' : 'fim'} ${n[k]} de "${nome}"`); delete n[k]; }
      }
      return n;
    });
    return { i: { ...i, itens }, fora, conferir };
  }
  const avisaFora = (p, sd) => {
    p.linhas = p.linhas.map(l => [l[0], String(l[1]).replace(/US\$\s?/g, 'USD ')]);   /* tudo em dólar escrito do jeito dela */
    if (sd.fora.length) p.linhas.push(['Não entrou', sd.fora.join(' · ') + ' — não veio de você']);
    if (sd.conferir.length) p.linhas.push(...sd.conferir);
    if (sd.fora.length) { const f0 = p.fazer; p.fazer = () => { const r = f0(); return { ...r, nao_entrou: sd.fora, aviso: 'o app tirou o que não veio dela (' + sd.fora.join('; ') + '). Diga isso em uma linha e pergunte se ela quer passar esses dados — nunca invente.' }; }; }
    return p;
  };

  const _plano = iaPlano;
  iaPlano = function (nome, i) {
    i = i || {};
    let sd = null;
    if (nome === 'criar_orcamento' || nome === 'editar_orcamento') { sd = soDela(i); i = sd.i; }
    const p = iaPlanoOrc(nome, i);
    return sd && p && p.fazer ? avisaFora(p, sd) : p;
  };
  function iaPlanoOrc(nome, i) {
    if (nome === 'proposta_orcamento') {
      const r = ingAchaOrc(i.numero); if (!r.o) return r;
      return { titulo: 'Abrir a proposta', assumiu: [], linhas: [['Orçamento', `${r.o.num} · ${r.o.cliente.nome || '—'}`], ['Total', oyM(Orc.total(r.o), oyMoeda(r.o))]],
        fazer: () => { go('/adm/proposta/' + r.o.id); return { ok: true, lembrete: 'a proposta está aberta na tela: ela toca em Gerar PDF ou Mandar no WhatsApp' }; } };
    }
    if (nome === 'criar_orcamento') {
      /* serviço sem "pessoas" é do grupo todo (antes saía 2 por padrão, mesmo com 4 adultos) */
      const grupo = (+i.adultos || 0) + (+i.criancas || 0);
      if (grupo > 0) i = { ...i, itens: (i.itens || []).map(it => it.pessoas ? it : { ...it, pessoas: grupo }) };
      const p = _plano(nome, i); if (!p || !p.fazer) return p;
      /* as linhas dos serviços no cartão, do jeito dela ("à parte", USD) */
      const ehServ = (l) => l[0] === '—' || /^\d{2}\/\d{2}/.test(String(l[0]));
      const k0 = p.linhas.findIndex(ehServ);
      if (k0 >= 0) {
        const serv = (i.itens || []).slice(0, 12).map(it => [it.data ? ingData(it.data) : '—', `${it.traslado ? (it.traslado === 'chegada' ? 'Traslado de chegada' : 'Traslado de saída') : (it.descricao || (Tours.get(it.passeio_id) ? oyPt(Tours.get(it.passeio_id).name) + (it.opcao ? ' · ' + it.opcao : '') : '?'))} · ${it.pessoas || grupo || 2}p · ${it.a_parte ? 'à parte' : +it.valor > 0 ? oyM(+it.valor, OY_MOEDA) : it.passeio_id || it.traslado ? 'preço da tabela' : 'sem valor'}`]);
        p.linhas = [...p.linhas.slice(0, k0), ...serv, ...p.linhas.filter((l, k) => k > k0 && !ehServ(l))];
      }
      const fazer0 = p.fazer;
      const tmp = { itens: [], adultos: i.adultos, criancas: i.criancas, pax: (+i.adultos || 0) + (+i.criancas || 0), hotel: i.hotel, chegada: i.chegada, partida: i.partida };
      if (i.hotel) p.linhas.splice(1, 0, ['Hotel', i.hotel]);
      if (i.adultos || i.criancas) p.linhas.splice(1, 0, ['Pessoas', oyPaxTexto(tmp)]);
      if (i.chegada && i.chegada.data) p.linhas.splice(1, 0, ['Viagem', `${ingData(i.chegada.data)}${i.partida && i.partida.data ? ' a ' + ingData(i.partida.data) : ''}`]);
      if (Array.isArray(i.hoteis) && i.hoteis.length) p.linhas.splice(1, 0, ['Hotéis', i.hoteis.map(h => h.nome + (h.situacao ? ' (' + h.situacao + ')' : '')).join(' · ')]);
      /* o total que ela fechou é o que aparece (nada de soma recalculada) */
      if (+i.total_informado > 0) p.linhas = p.linhas.filter(l => l[0] !== 'Sinal').map(l => l[0] === 'Total' ? ['Total', oyM(+i.total_informado, OY_MOEDA) + (i.com_vat === false ? ' (o que você fechou, sem VAT)' : ' (o que você fechou, VAT dentro)')] : l);
      if (i.com_vat === false) p.linhas.push(['VAT', 'sem VAT neste orçamento']);
      p.fazer = () => {
        const res = fazer0(); const o = Orc.all().find(x => x.num === res.numero); if (!o) return res;
        campos(o, i);
        /* refaz os serviços do catálogo e os traslados no formato novo (foto, texto, incluso) */
        /* a base só cria os serviços com preco_ref, passeio_id ou descricao (o traslado pronto ela pula):
           conta a posição de cada um nela — antes o índice era o da lista dela, e um traslado no começo
           fazia o texto/obs/hora de um serviço cair no seguinte (28/10/2026) */
        const novos = []; let j = -1;
        (i.itens || []).forEach((it) => {
          const naBase = !!(it.preco_ref || it.passeio_id || it.descricao); if (naBase) j++;
          const n = servico(o, it);
          if (n) novos.push(enriquece(n, it));
          else if (naBase && o.itens[j]) novos.push(enriquece(o.itens[j], it));
        });
        if (novos.length) o.itens = novos;
        o.moeda = OY_MOEDA;
        Orc.salva(o); oyLigaCliente(o);
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
      if (i.com_vat != null) p.linhas.push(['VAT', i.com_vat === false ? 'tirar o VAT' : 'cobrar o VAT de ' + (o.vatPct != null && o.vatPct !== '' ? +o.vatPct : OY_VAT) + '%']);
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
  }

  /* ver_passeios mostra as opções de cada passeio (nome, preço, preço de criança) */
  if (typeof iaLeitura === 'function') {
    const _ler = iaLeitura;
    iaLeitura = function (nome, i) {
      const r = _ler(nome, i);
      if (nome !== 'ver_passeios' || !Array.isArray(r)) return r;
      return r.map(p => { const x = Tours.get(p.id); if (!x) return p;
        const ops = oyOpcoes(x).map(op => ({ nome: oyOpNome(op), preco: +op.preco || 0, ...(+op.precoCrianca ? { preco_crianca: +op.precoCrianca, crianca_ate_anos: +op.idadeCrianca || +x.idadeCrianca || null } : {}) }));
        return { ...p, moeda: OY_MOEDA, ...(+x.precoCrianca ? { preco_crianca: +x.precoCrianca } : {}), ...(ops.length > 1 ? { opcoes: ops } : {}) }; });
    };
  }

  /* as regras do orçamento no que o assistente lê antes de tudo — e o CATÁLOGO inteiro
     (ele, 28/10: "o assistente precisa ser inteligente e ler todo o app"): acha o passeio
     certo de primeira, com as opções e os preços, sem precisar consultar */
  const catalogo = () => Tours.all().filter(x => x.status !== 'draft').map(x => {
    const ops = oyOpcoes(x);
    return `${x.id}: ${oyPt(x.name)} — ${ops.length > 1 ? ops.map(op => `${oyOpNome(op)} USD ${+op.preco || 0}${+op.precoCrianca ? ' (criança ' + op.precoCrianca + ')' : ''}`).join(' | ') : (+x.price ? 'USD ' + x.price : 'sob consulta')}${x.priceMode === 'session' ? ' por grupo' : x.priceMode === 'hora' ? ' por hora (mínimo ' + (+x.minHoras || 1) + 'h)' : x.priceMode === 'pp' ? ' por pessoa' : ''}${+x.precoCrianca ? ' · criança ' + x.precoCrianca : ''}`;
  }).join('\n');
  const _sis = iaSistema;
  iaSistema = function () {
    const b = _sis();
    b.push({ type: 'text', text: `## O CATÁLOGO DELA (id: nome — preço). Use o id em passeio_id.\n${catalogo()}` });
    b.push({ type: 'text', text: `## ORÇAMENTO E PROPOSTA (o jeito dela, desde 28/10/2026)
- Antes de criar, tenha o BÁSICO: nome do cliente, WhatsApp, quantas pessoas (adultos e crianças), hotel e os dias de chegada e partida (com hora e voo, se ela souber). Falta algum? Pergunte UMA coisa por vez — mas não trave: com nome e pessoas já dá para criar e completar depois com editar_orcamento.
- Monte o roteiro DIA A DIA: cada serviço com data e hora. Passeio do catálogo SEMPRE com passeio_id (de ver_passeios): traz preço, foto, texto e incluso. Passeio com opções (prime/non-prime, minutos de voo, com/sem serviço de mesa): passe opcao com o nome; tem criança no grupo? passe criancas — o preço de criança entra sozinho. Traslado de aeroporto: item com traslado:"chegada" ou "saida" (pega o voo e o hotel). Fora do catálogo: descricao com o nome que ELA deu (texto só se ela escreveu).
- NUNCA ESCREVA NADA SEU NO ORÇAMENTO (vai para o cliente como verdade): nada de descrição, incluso, não incluso, horário ou dia que ela não deu. Não sabe o horário? Deixe sem — nada de 09:00/10:00 por conta própria, nem fim calculado. Dia: exatamente o que ela disse; nunca mova um serviço de dia. Observação dela num serviço ("Início às 15:00", "Término no Dubai Mall", "sem guia brasileiro") vai em obs, sempre — e se for horário de início, também em hora. Refazendo um orçamento que já existe: copie os serviços, dias, horários e observações dele, sem tirar nada. O app confere e tira o que não veio dela.
- RESPEITE O QUE ELA MANDOU, SEM RECRIAR NADA: se ela passou os serviços, os dias, os horários, os textos (descrição, INCLUSO, NÃO INCLUSO), os valores ou o TOTAL, use EXATAMENTE isso. Valor de cada serviço que ela disse → valor; o total dela → total_informado (o app usa esse número e põe o VAT dentro). NUNCA recalcule pela tabela o que ela deu, nunca acrescente nem tire serviço, nunca troque data, hora ou texto, nunca resuma o texto dela. Do catálogo, só complete o que ela NÃO disse (foto; texto/incluso se ela não escreveu). Serviço "(a parte)" → a_parte:true, sem valor. Hotéis por período ("07-11/11 Sofitel *a parte") → hoteis. Cola uma planilha/texto inteiro? Monte tudo de uma vez num criar_orcamento só.
- Moeda: SOMENTE DÓLAR (USD), sempre. Nunca escreva valor em dirham, real ou euro. Os valores dos serviços são SEM imposto: o app soma 5% de VAT no fim sozinho (nunca some de novo). Ela disse "sem VAT" / "não cobrar VAT"? com_vat:false (e com_vat:true volta). Total, por adulto e por criança saem sozinhos (não existe "por casal").
- "(Indicação: CÓDIGO)" na conversa = veio pelo link de um parceiro: o app liga o orçamento a ele sozinho e a comissão entra em Indicações e cupons.
- Depois de criar ou mudar, ofereça em uma linha: "Quer que eu abra a proposta para gerar o PDF ou mandar o link?" → proposta_orcamento. Quem manda é ela.` });
    return b;
  };
})();

/* abriu direto num destes endereços (link da proposta, editor, proposta no painel):
   o route() do começo rodou antes deste arquivo existir — desenha de novo */
if (typeof pubRotaDe === 'function' && pubRotaDe()) route();
else if (/^#\/adm\/(consulta\/[^/]+|proposta\/)/.test(location.hash)) route();
