/* =====================================================
   O ROTEIRO DA VIAGEM NO PADRÃO DA MILLA (28/10/2026)

   Pedido do Eugênio, com o PDF "Roteiro" que a Milla manda depois da compra:
   "o roteiro depois que o cliente comprou, deixa isso fácil… no padrão do PDF".
   É o MESMO kit da viagem (kit-yalla.js: as reservas confirmadas, o link curto,
   o PDF, a agenda) — só o desenho muda para o dela:
   - faixa champanhe no topo com o logo e "NOME • MÊS ANO";
   - a abertura "SUA VIAGEM • 20 A 23 DE OUTUBRO": a base (hotel e ponto de
     encontro), chegada e partida, a programação dia a dia e o horário local;
   - UMA página por dia ("21 OUT • QUARTA-FEIRA", título em Playfair, horário,
     foto larga e os blocos: o programa, incluído e encontro, para o dia,
     pagamento) — dois passeios no mesmo dia ficam na mesma página;
   - "Informações importantes": os textos do voucher dela, o cancelamento, as
     dicas, os descontos e o atendimento;
   - rodapé "YALLA EXPERIENCES • @instagram".
   Os ganchos do kit continuam (data-kt-ics, data-kt-qr, kt-tela = só na tela).
   ===================================================== */
'use strict';

const RT_MES = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
const rtSemana = (iso) => new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' }).toUpperCase();
const rtDiaCurto = (iso) => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) : '';
/* "09:00" → "09h"; "19:30" → "19h30" (como ela escreve) */
const rtH = (hm) => { const m = String(hm || '').match(/(\d{1,2}):(\d{2})/); return m ? String(+m[1]).padStart(2, '0') + 'h' + (m[2] === '00' ? '' : m[2]) : ''; };
function rtFaixa(s) {
  const ini = rtH(s.hora); if (!ini) return '';
  /* o fim só se veio dela (28/10/2026): calcular pela duração ("10h" → 09h às 19h) punha no
     roteiro do cliente um horário que ninguém combinou */
  const fim = s.horaFim ? rtH(s.horaFim) : '';
  return fim && fim !== ini ? `${ini} às ${fim}` : ini;
}
const RT_CHEGA = /aeroporto\s*(→|->|-|–|para|x)\s*hotel|chegada|arrival/i;
const RT_SAI = /hotel\s*(→|->|-|–|para|x)\s*aeroporto|partida|sa[ií]da|departure/i;
const RT_AERO = /aeroport|airport|\b(dxb|dwc|auh|shj)\b/i;
/* chegada ou saída: o destino manda (vai para o aeroporto = saída), depois a origem, depois o nome */
function rtTipoTransfer(s) {
  if (RT_AERO.test(s.destino || '')) return 'saida';
  if (RT_AERO.test(s.origem || '')) return 'chegada';
  const t = s.nome || '';
  return RT_SAI.test(t) ? 'saida' : RT_CHEGA.test(t) ? 'chegada' : '';
}
/* lista do jeito certo: itens curtos viram "a, b e c."; frases (com ponto) viram lista */
function rtJunta(l) {
  l = rtLista(l).map(x => String(x).trim()).filter(Boolean);
  if (!l.length) return '';
  if (l.some(x => /[.!?]$/.test(x) || x.length > 70)) return `<ul class="rt-ul">${l.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`;
  return `<p>${l.map(esc).join(', ')}.</p>`;
}
const rtLista = (a) => Array.isArray(a) ? a.filter(Boolean) : [];
const rtP = (t) => esc(String(t || '').trim()).replace(/\n+/g, '<br>');

function rtDocHtml(d) {
  const sv = (d.servicos || []).slice().sort((a, b) => ((a.data || '') + (a.hora || '')).localeCompare((b.data || '') + (b.hora || '')));
  const neg = d.negocio || guiaNegocio(), base = (typeof baseNome === 'function' && baseNome()) || 'Dubai';
  const insta = d.insta ? '@' + String(d.insta).replace(/^@/, '') : '';
  const pes = Math.max(0, ...sv.map(s => +s.pessoas || 0));
  const linhaCli = [d.nome, pes ? pes + (pes > 1 ? ' pessoas' : ' pessoa') : ''].filter(Boolean).join(' | ');
  const mesAno = sv[0] && sv[0].data ? new Date(sv[0].data + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }).replace(' de ', ' ') : '';
  const fotoTopo = (sv.find(s => s.foto && s.tipo !== 'transfer') || sv.find(s => s.foto) || {}).foto || 'arte/skyline.jpg';
  const hotel = (sv.find(s => s.hotel) || {}).hotel || '';
  const enc = (() => { const c = {}; for (const s of sv) if (s.tipo !== 'transfer' && s.encontro) c[s.encontro] = (c[s.encontro] || 0) + 1; return Object.keys(c).sort((a, b) => c[b] - c[a])[0] || ''; })();
  const trf = sv.filter(s => s.tipo === 'transfer'), passeios = sv.filter(s => s.tipo !== 'transfer');
  const pagina = (kick, titulo, sub, foto, corpo, cls) => `<section class="rt-pg kt-bl ${cls || ''}">
      <div class="rt-faixa"><img src="arte/logo-yalla-escuro.png" alt="${esc(neg)}"><span>${esc([d.nome, mesAno].filter(Boolean).join(' • ').toUpperCase())}</span></div>
      <div class="rt-miolo">
        ${kick ? `<p class="rt-kick">${esc(kick)}</p>` : ''}
        <h2 class="rt-tit">${esc(titulo)}</h2>
        ${sub ? `<p class="rt-sub">${esc(sub)}</p>` : ''}
        ${foto ? `<div class="rt-foto" role="img" aria-label="${esc(titulo)}" style="background-image:url('${esc(foto)}')"></div>` : ''}
        ${corpo}
      </div>
      <p class="rt-pe"><span>${esc(neg.toUpperCase())}${insta ? ' • ' + esc(insta) : ''}</span></p>
    </section>`;
  const bloco = (t, html) => html ? `<div class="rt-bl kt-bl"><h3>${esc(t)}</h3>${html}</div>` : '';

  /* a abertura: a viagem numa página */
  const linhaTrf = (s) => { const k = rtTipoTransfer(s), h = rtH(s.hora);
    return `${esc(rtDiaCurto(s.data))} • ${k === 'saida' ? `Saída${h ? ' às ' + esc(h) : ''}` : k === 'chegada' ? `Chegada${h ? ' às ' + esc(h) : ''}` : esc(s.nome) + (h ? ' às ' + esc(h) : '')}${s.voo ? ' (voo ' + esc(s.voo) + ')' : ''}${s.guia ? ', com ' + esc(s.guia) : ''}.`; };
  const porDia = []; for (const s of passeios) { let g = porDia.find(x => x.d === s.data); if (!g) porDia.push(g = { d: s.data, l: [] }); g.l.push(s); }
  const abertura = pagina(
    `SUA VIAGEM${d.periodo ? ' • ' + String(d.periodo).toUpperCase() : ''}`, base, linhaCli, fotoTopo,
    bloco(`Sua base em ${base}`, hotel || enc ? `<p>${hotel ? esc(hotel) : ''}${hotel && enc ? '<br>' : ''}${enc ? 'Ponto de encontro para os passeios: ' + esc(enc) + '.' : ''}</p>` : '')
    + bloco('Chegada e partida', trf.length ? `<p>${trf.map(linhaTrf).join('<br>')}</p>` : '')
    + bloco('Sua programação', porDia.length ? `<p>${porDia.map(g => `${esc(rtDiaCurto(g.d))} • ${g.l.map(s => esc(s.nome) + (rtFaixa(s) ? ', ' + esc(rtFaixa(s).replace(/^(\d)/, 'das $1')) : '')).join('; ')}.`).join('<br>')}</p>` : '')
    + bloco('Horário local', '<p>Todos os horários seguem o horário dos Emirados Árabes Unidos.</p>')
    + (sv.length > 1 ? `<nav class="kt-lista rt-lista kt-tela" aria-label="Ir direto para">${sv.map(s => { const k = (d.servicos || []).indexOf(s);
        return `<a href="#kt-sv-${k}" data-kt-ir="${k}"><span>${esc(rtDiaCurto(s.data))}${s.hora ? ' · ' + esc(s.hora) : ''}</span><b>${esc(s.nome)}</b></a>`; }).join('')}</nav>` : '')
    + `<div class="rt-acs kt-tela">${d.whats ? `<a class="rt-bt rt-forte" href="${esc(waLink('Olá! Sobre a minha viagem…', d.whats))}" target="_blank" rel="noopener">${typeof ICONE_WA !== 'undefined' ? ICONE_WA : ''}WhatsApp</a>` : ''}<button type="button" class="rt-bt" data-kt-ics>Pôr tudo na minha agenda</button></div>`,
    'rt-abre');

  /* os blocos de um serviço */
  const pagamento = (s) => {
    const pago = +s.pago || 0, falta = +s.restante || 0, m = typeof kitMoeda === 'function' ? kitMoeda(s, d) : '', v = (x) => typeof kitValor === 'function' ? kitValor(x, m) : eur(x);
    if (!(pago > 0) && !(falta > 0)) return '';
    const l = [];
    if (pago > 0 && !s.soDia) l.push(`Pago <b>${esc(v(pago))}</b>.`);
    if (falta > 0) l.push(`${s.noDia ? 'Pagar no dia, a quem faz o serviço,' : 'Falta pagar'} <b>${esc(v(falta))}</b>${s.vence && !s.noDia ? ' até ' + esc(rtDiaCurto(s.vence)) : ''}.`);
    else l.push('Tudo pago ✓');
    return bloco('Pagamento', `<p>${l.join(' ')}</p>${s.pagarUrl ? `<a class="rt-bt rt-forte kt-pagar kt-tela" href="${esc(s.pagarUrl)}" target="_blank" rel="noopener">Pagar ${esc(v(s.pagarValor || falta))} pelo link seguro</a>` : ''}`);
  };
  const servico = (s, varios) => {
    const t = s.tipo === 'transfer', k = t ? rtTipoTransfer(s) : '';
    const mapa = typeof kitMapaDe === 'function' ? kitMapaDe(s) : '';
    const inclui = rtLista(s.inclui), levar = rtLista(s.levar), par = rtLista(s.paradas);
    /* a hora exata do encontro (09:00); o título usa o jeito dela (09h às 13h) */
    const encontro = [s.encontro ? `${t ? (k === 'saida' ? 'Saída' : 'Encontro') : 'Encontro'}: ${esc(s.encontro)}${s.hora ? ' às ' + esc(s.hora) : ''}.` : (s.hora ? `Às ${esc(s.hora)}.` : ''),
      s.encontroObs ? esc(s.encontroObs) : '', t && s.voo ? `Voo: ${esc(s.voo)}.` : '', t && s.origem ? `Buscar em: ${esc(s.origem)}.` : '', t && s.destino ? `Levar para: ${esc(s.destino)}.` : '',
      s.guia ? `${t ? 'Motorista' : 'Guia'}: ${esc(s.guia)}.` : '', s.veiculo ? esc(s.veiculo) + '.' : '', !t && s.hotel ? `Hospedagem: ${esc(s.hotel)}.` : '',
      `${+s.pessoas || 1} ${+s.pessoas > 1 ? 'pessoas' : 'pessoa'} · código ${esc(s.code || '')}`].filter(Boolean).join(' ');
    return `<span class="rt-ancora" id="kt-sv-${(d.servicos || []).indexOf(s)}"></span>${varios ? `<h3 class="rt-tit2">${esc(s.nome)}</h3>${rtFaixa(s) ? `<p class="rt-sub">${esc(rtFaixa(s))}</p>` : ''}${s.foto ? `<div class="rt-foto rt-foto2" role="img" aria-label="${esc(s.nome)}" style="background-image:url('${esc(s.foto)}')"></div>` : ''}` : ''}
      ${bloco(t ? (k === 'saida' ? 'Traslado ao aeroporto' : 'Recepção e traslado') : 'O programa', (s.resumo ? `<p>${rtP(s.resumo)}</p>` : '') + (par.length ? `<ol class="rt-par">${par.map(p => `<li><b>${esc(p.n)}</b>${p.d ? ` — ${esc(p.d)}` : ''}</li>`).join('')}</ol>` : ''))}
      ${bloco(t ? 'Seu encontro com a equipe' : 'Incluso e encontro', `${rtJunta(inclui)}<p>${encontro}</p>${mapa ? `<a class="rt-lk kt-tela" href="${esc(mapa)}" target="_blank" rel="noopener">Abrir o ponto de encontro no mapa</a>` : ''}`)}
      ${rtLista(s.naoInclui).length ? bloco('Não incluso', rtJunta(s.naoInclui)) : ''}
      ${levar.length ? bloco('Para o dia', rtJunta(levar)) : ''}
      ${s.obs ? `<div class="rt-obs kt-bl"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8.5 8.5 0 0 1-12.6 7.4L3 21l1.6-5.2A8.5 8.5 0 1 1 21 12Z"/></svg><p>${rtP(s.obs)}</p></div>` : ''}
      ${pagamento(s)}
      <p class="rt-ag kt-tela"><a class="rt-lk" href="${esc(typeof kitGoogle === 'function' ? kitGoogle(s, d) : '#')}" target="_blank" rel="noopener">Pôr no Google Agenda</a></p>`;
  };
  /* um dia por página (dois serviços no mesmo dia ficam juntos) */
  const dias = []; for (const s of sv) { let g = dias.find(x => x.d === s.data); if (!g) dias.push(g = { d: s.data, l: [] }); g.l.push(s); }
  const paginasDias = dias.map((g, n) => {
    const kick = g.d ? `${g.d.slice(8, 10)} ${RT_MES[+g.d.slice(5, 7) - 1]} • ${rtSemana(g.d)}` : 'SEM DATA';
    const so = g.l.length === 1 ? g.l[0] : null;
    const tk = so && so.tipo === 'transfer' ? rtTipoTransfer(so) : '';
    const titulo = tk === 'chegada' ? `Bem-vindos a ${base}` : tk === 'saida' ? `Até a próxima, ${base}` : so ? so.nome : g.l.map(s => s.nome).join(' e ');
    const sub = so ? [tk ? (rtH(so.hora) ? (tk === 'saida' ? 'Saída às ' : 'Chegada às ') + rtH(so.hora) : '') : rtFaixa(so), tk ? (tk === 'chegada' ? 'Aeroporto → hotel' : 'Hotel → aeroporto') : (so.duracao && !/conforme/i.test(so.duracao) ? so.duracao : '')].filter(Boolean).join(' | ') : '';
    return pagina(kick, titulo, sub, so ? so.foto : '', g.l.map(s => servico(s, !so)).join(''), '') + (n === 0 ? '' : '');
  }).join('');

  /* as informações importantes */
  const pol = (DB.settings && DB.settings.propPolitica) || (typeof PP_POLITICA !== 'undefined' ? PP_POLITICA : '');
  const contato = [d.whats ? `WhatsApp: ${esc(typeof foneBonito === 'function' ? foneBonito(d.whats) : d.whats)}` : '', d.email ? esc(d.email) : '', insta ? `Instagram: ${esc(insta)}` : ''].filter(Boolean);
  const info = pagina('DETALHES DA SUA RESERVA', 'Informações importantes', linhaCli, '',
    rtLista(d.blocos).map(b => `<div class="rt-bl kt-bl">${b.titulo ? `<h3 class="rt-up">${esc(b.titulo)}</h3>` : ''}${typeof kitFmt === 'function' ? kitFmt(b.texto) : `<p>${rtP(b.texto)}</p>`}</div>`).join('')
    + (pol ? bloco('Cancelamento', `<p>${rtP(pol)}</p>`) : '')
    + (rtLista(d.dicas).length ? bloco('Dicas para a viagem', `<ul class="rt-ul">${d.dicas.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`) : '')
    + (rtLista(d.parceiros).length ? bloco('Descontos para você', `<ul class="rt-ul">${d.parceiros.map(p => `<li><b>${esc(p.nome)}</b>${+p.desconto ? ` — ${esc(String(p.desconto))}%` : ''}${p.como ? ` · ${esc(p.como)}` : ''}</li>`).join('')}</ul>`) : '')
    + (rtLista(d.brindes).length ? bloco('Presentes', d.brindes.map(b => `<p><a class="rt-lk" href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.titulo)}</a></p>`).join('')) : '')
    + (d.roteiro ? bloco('O seu roteiro personalizado', `<p><a class="rt-lk" href="${esc(d.roteiro)}" target="_blank" rel="noopener">Abrir o roteiro</a></p>`) : '')
    + bloco(`Seu atendimento ${neg}`, contato.length ? `<p>${contato.join('<br>')}</p>` : '')
    + `<div class="rt-guarde kt-tela"><div class="kt-qr" data-kt-qr></div><p><b>Guarde este link no celular.</b> Tudo da sua viagem num lugar só; se algo mudar, você vê aqui.</p></div>`, 'rt-info');

  return `<article class="ktDoc rtDoc">${abertura}${paginasDias}${info}</article>`;
}

function rtCss() {
  if (document.getElementById('rtCss')) return;
  const s = document.createElement('style'); s.id = 'rtCss';
  s.textContent = `
  .rtDoc{--rt-f:#F4F3F0;--rt-c:#F3E0A2;--rt-o:#9A7A2E;--rt-n:#1E1E1E;--rt-t:#3A3A3A;--rt-l:#D8C9A0;max-width:794px;margin:0 auto;background:transparent;color:var(--rt-n);font-family:Montserrat,var(--f-ui),system-ui,sans-serif;border-radius:0;box-shadow:none;padding:0}
  .rt-pg{background:var(--rt-f);margin:0 0 18px;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.06)}
  .rt-faixa{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--rt-c);padding:16px 7%}
  .rt-faixa img{height:44px;width:auto;display:block}
  .rt-faixa span{font-weight:700;font-size:12px;letter-spacing:.06em;color:#7A6020;text-align:right}
  .rt-miolo{padding:26px 7% 10px}
  .rt-kick{margin:0 0 10px;color:var(--rt-o);font-size:14px;letter-spacing:.04em;text-transform:uppercase}
  .rtDoc .rt-tit{font-family:'Playfair Display',Georgia,serif;font-weight:500;font-size:clamp(30px,6.4vw,44px);line-height:1.12;margin:0 0 10px;color:var(--rt-n)}
  .rtDoc .rt-tit2{font-family:'Playfair Display',Georgia,serif;font-weight:500;font-size:clamp(24px,5vw,32px);line-height:1.15;margin:22px 0 6px;color:var(--rt-n)}
  .rt-sub{margin:0 0 16px;font-size:16px;color:var(--rt-t)}
  .rt-foto{height:clamp(170px,38vw,290px);background-size:cover;background-position:center;background-color:#E8E0CC;margin:4px 0 20px}
  .rt-foto2{height:clamp(140px,30vw,220px)}
  .rt-bl{margin:0 0 14px}
  .rtDoc .rt-bl h3{font-size:18px;font-weight:500;margin:0 0 6px;color:var(--rt-n)}
  .rt-bl p{margin:0 0 6px;font-size:15.5px;line-height:1.55;color:var(--rt-t)}
  .rt-bl p b{color:var(--rt-n)}
  .rtDoc .rt-bl h3.rt-up{font-size:13px;font-weight:700;letter-spacing:.07em;color:var(--rt-o);margin-top:14px}
  .rt-par,.rt-ul{margin:4px 0 6px;padding-left:20px;font-size:15px;line-height:1.5;color:var(--rt-t)}
  .rt-par li,.rt-ul li{margin:3px 0}
  .rt-lista{display:grid;gap:6px;margin:4px 0 14px}
  .rt-lista a{display:grid;grid-template-columns:auto 1fr;gap:4px 12px;align-items:baseline;padding:10px 14px;border-radius:12px;background:#fff;color:var(--rt-n);text-decoration:none;border:1px solid transparent}
  .rt-lista a:hover{border-color:var(--rt-l)}
  .rt-lista a span{font-size:12.5px;color:var(--rt-o);font-weight:600;white-space:nowrap}
  .rt-lista a b{font-weight:600;font-size:14.5px}
  .rt-lista a:focus-visible{outline:2px solid var(--rt-o);outline-offset:2px}
  .rt-obs{display:flex;gap:10px;align-items:flex-start;margin:4px 0 14px;padding:11px 14px;border-radius:14px 14px 14px 4px;background:#FBF3DC;border:1px solid #EAD9A6}
  .rt-obs svg{flex:none;width:18px;height:18px;margin-top:3px;color:var(--rt-o)}
  .rt-obs p{margin:0;font-size:15px;line-height:1.5;color:var(--rt-n)}
  .rt-ancora{display:block;position:relative;top:-70px}
  .rt-lk{color:var(--rt-o);font-weight:600;font-size:13px;letter-spacing:.03em;text-transform:uppercase;text-decoration:none}
  .rt-lk:hover{text-decoration:underline}
  .rt-ag{margin:-4px 0 12px}
  .rt-acs{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 14px}
  .rt-bt{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:46px;padding:0 18px;border-radius:999px;border:1px solid var(--rt-l);background:#fff;color:var(--rt-n);font:600 14px/1 var(--f-ui,Montserrat,system-ui,sans-serif);text-decoration:none;cursor:pointer}
  .rt-bt svg{width:18px;height:18px}
  .rt-forte{background:#141414;border-color:#141414;color:#F3E0A2}
  .rt-bt:focus-visible,.rt-lk:focus-visible{outline:2px solid var(--rt-o);outline-offset:2px}
  .rt-pe{display:flex;justify-content:space-between;gap:10px;margin:8px 7% 0;padding:14px 0 18px;border-top:1px solid var(--rt-l);font-size:12px;letter-spacing:.04em;color:var(--rt-o)}
  .rt-guarde{display:flex;gap:14px;align-items:center;margin:10px 0 16px;padding:14px;border-radius:12px;background:#fff}
  .rt-guarde p{margin:0;font-size:14px;color:var(--rt-t)}
  .rt-guarde .kt-qr{flex:none;width:96px}
  .rt-guarde .kt-qr:empty{display:none}
  .rt-guarde .kt-qr svg{display:block;width:100%;height:auto}
  /* no PDF: cada página do roteiro é uma folha A4 (um dia por folha, rodapé embaixo, como o PDF dela) */
  .em-pdf .rt-pg{min-height:1122px;margin:0;border-radius:0;box-shadow:none;display:flex;flex-direction:column}
  .em-pdf .rt-miolo{flex:1}
  .em-pdf .rt-pe{margin-top:auto}
  @media(max-width:620px){.rt-faixa img{height:34px}.rt-faixa span{font-size:10.5px}.rt-miolo{padding:20px 18px 6px}.rt-pe{margin:6px 18px 0}}
  @media print{.kt-tela{display:none!important}}`;
  document.head.appendChild(s);
}

/* o kit passa a usar este desenho (painel, link do cliente e PDF) */
if (typeof kitDocHtml === 'function') {
  kitDocHtml = function (d) { rtCss(); return rtDocHtml(d); };
}

/* abriu direto no kit (painel ou link do cliente): o route() do começo rodou
   antes deste arquivo — desenha de novo, já no padrão dela */
if (/^#\/(adm\/kit\/|k\/|kt\/)/.test(location.hash)) { if (typeof route === 'function') { route._pub = ''; route(); } }
