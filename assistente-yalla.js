/* =====================================================
   O ASSISTENTE DA YALLA: APRENDE, LÊ DIREITO E PERGUNTA (28/10/2026)

   Pedidos do Eugênio no mesmo dia: "ela consegue aprender? quando pede algo
   ela aprende?", "não pode recriar nada, tem que respeitar o que ela pede",
   "precisa ser inteligente e ler todo o app", "não está lendo direito as
   imagens e está inventando… quando tiver dúvida, pergunte" e "revisa tudo
   do assistente, precisa funcionar bem".

   1. A MEMÓRIA MORA NA NUVEM: o que ele aprendeu (Mkt.memoria) passa a viver
      em DB.privado.iaMemoria — a coleção privada que já sincroniza só com a
      dona logada. Igual no celular e no computador; o que estava só neste
      aparelho sobe na primeira vez.
   2. APRENDE COM AS CORREÇÕES: quando ela corrige ou diz como prefere, ele
      corrige e já propõe guardar a regra (o cartão de confirmação = um toque).
   3. "O QUE O ASSISTENTE SABE" nos Ajustes: ela vê, edita, apaga e ensina.
   4. LÊ DIREITO: imagem inteira, linha por linha, número exato; com dúvida
      PERGUNTA; orçamento vindo de imagem → mostra o que leu e confirma antes.
      As fotos do chat agora chegam nítidas (iaFotosLer, assistente.js).
   5. LÊ O APP: dado dela (cliente, reserva, orçamento, passeio, valor) ele
      consulta nas ferramentas antes de responder — nunca de cabeça.
   ===================================================== */
'use strict';

/* ---------- 1. a memória na nuvem ---------- */
if (typeof Mkt !== 'undefined') {
  const _mktGet = Mkt.get.bind(Mkt), _mktSalva = Mkt.salva.bind(Mkt);
  const priv = () => { DB.privado = DB.privado && typeof DB.privado === 'object' ? DB.privado : {}; return DB.privado; };
  Mkt.get = function () {
    const d = _mktGet();
    try {
      const p = priv();
      if (Array.isArray(p.iaMemoria)) d.memoria = p.iaMemoria;                       /* a nuvem manda */
      else if (Array.isArray(d.memoria) && d.memoria.length) { p.iaMemoria = d.memoria; save(); }   /* sobe o que estava só aqui */
    } catch (e) {}
    return d;
  };
  Mkt.salva = function () {
    const ok = _mktSalva();
    try { const p = priv(); p.iaMemoria = (this.d && Array.isArray(this.d.memoria)) ? this.d.memoria : []; save(); } catch (e) {}
    return ok;
  };
}
const iaMemoria = () => { try { return (Mkt.get().memoria || []).filter(x => x && String(x.texto || '').trim()); } catch (e) { return []; } };

/* ---------- 2, 4 e 5. o jeito de trabalhar (vai junto em toda conversa) ---------- */
if (typeof iaSistema === 'function') {
  const _iaSis = iaSistema;
  iaSistema = function () {
    const b = _iaSis();
    b.push({ type: 'text', text: `## LER DIREITO E PERGUNTAR (regra dela, vale mais que pressa)
- IMAGEM (print de planilha, de conversa, comprovante): leia a imagem INTEIRA, linha por linha, de cima a baixo — um print comprido chega em várias fatias, na ordem; junte todas. Copie nomes, datas, horários, voos e valores EXATAMENTE como estão (com centavos).
- Datas da planilha dela vêm assim: "Monday, 09 11 26" = 2026-11-09; "07-11/11" = de 07/11 a 11/11. "(a parte)" = por conta do cliente, sem valor.
- Se QUALQUER coisa estiver ilegível, cortada, borrada ou ambígua (um número, uma data, um nome, se é incluso ou à parte): PERGUNTE. Nunca invente, nunca complete com o que "deve ser", nunca arredonde.
- Orçamento a partir de imagem ou de texto longo colado: ANTES de criar, mostre em lista curta o que você leu (cliente e pessoas, datas, hotéis com período e incluso/à parte, cada dia com o serviço e o horário, o total) e pergunte "Confere?". Só chame criar_orcamento depois do sim — ou direto, se ela já disse "pode criar".
- Pergunta sobre o que existe no app (cliente, reserva, orçamento, passeio, valor, quem pagou): CONSULTE as ferramentas antes (procurar, ver_tudo, ver_orcamentos, ver_reservas, ver_ficha, ver_passeios). Nunca responda de cabeça um dado dela.
- Não tem certeza do que ela quer? Uma pergunta curta, com a sua sugestão ("É a opção prime ou non-prime?").

## VOCÊ APRENDE COM ELA
- A Memória (acima) é o que ela já te ensinou: siga sempre, em toda conversa.
- Quando ela CORRIGIR você ou disser como prefere ("não, é…", "sempre…", "nunca…", "prefiro…", "da próxima vez…", "o certo é…"): faça a correção e, na MESMA resposta, chame guardar_memoria com a regra curta e geral (ex.: "Burj Khalifa: usar a opção prime, a não ser que ela diga outra"). O cartão de confirmação deixa ela aceitar com um toque.
- Não guarde na Memória dado de um cliente só (isso é anotar_cliente) nem coisa de um dia (isso é anotar_tarefa).` });
    return b;
  };
}

/* ---------- 3. "O que o assistente sabe", nos Ajustes ---------- */
function iaSabeHtml() {
  const l = iaMemoria();
  return `<section class="card ia-sabe" id="iaSabe">
    <h3>O que o assistente sabe</h3>
    <p class="why">O que ele aprendeu com você. Ele relê isto antes de cada conversa — no celular e no computador. Quando você corrige o assistente, ele propõe guardar aqui.</p>
    <div class="ia-sabe-l">${l.length ? l.map(x => `<div class="ia-sabe-i" data-mid="${esc(x.id)}">
        <textarea rows="2" aria-label="O que ele sabe">${esc(x.texto)}</textarea>
        <button type="button" class="mini ghost danger" data-mrm="${esc(x.id)}" aria-label="Esquecer">esquecer</button></div>`).join('')
      : '<p class="empty">Ainda nada. Ensine pelo chat ("lembra que…") ou escreva abaixo.</p>'}</div>
    <div class="frow"><label class="fld grow"><span class="sr">Ensinar</span><input id="iaSabeNovo" autocomplete="off" placeholder="Ex.: traslado sempre com guia brasileiro; Burj sempre na opção prime" aria-label="Ensinar algo novo"></label><button type="button" class="mini strong" id="iaSabeAdd">ensinar</button></div>
  </section>`;
}
function iaSabeLiga() {
  const m = Mkt.get(), re = () => { const c = document.getElementById('iaSabe'); if (c) { c.outerHTML = iaSabeHtml(); iaSabeLiga(); } };
  document.querySelectorAll('#iaSabe [data-mid] textarea').forEach(t => t.onchange = () => {
    const x = m.memoria.find(y => y.id === t.closest('[data-mid]').dataset.mid); if (!x) return;
    const v = t.value.trim(); if (!v) return;
    x.texto = v; Mkt.salva(); toast('Guardado');
  });
  document.querySelectorAll('#iaSabe [data-mrm]').forEach(b => b.onclick = () => { m.memoria = m.memoria.filter(y => y.id !== b.dataset.mrm); Mkt.salva(); re(); });
  const add = () => { const i = document.getElementById('iaSabeNovo'), v = (i && i.value || '').trim(); if (!v) return i && i.focus(); m.memoria.push({ id: uid(), texto: v, criado: isoToday() }); Mkt.salva(); re(); toast('O assistente aprendeu'); };
  const b = document.getElementById('iaSabeAdd'); if (b) b.onclick = add;
  const i = document.getElementById('iaSabeNovo'); if (i) i.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
}
if (typeof admSettings === 'function') {
  const _admSet = admSettings;
  admSettings = function () {
    const r = _admSet.apply(this, arguments);
    const h1 = document.querySelector('#stage .pageh');
    if (h1 && !document.getElementById('iaSabe')) { h1.insertAdjacentHTML('afterend', iaSabeHtml()); iaSabeLiga(); }
    if (!document.getElementById('iaSabeCss')) {
      const st = document.createElement('style'); st.id = 'iaSabeCss';
      st.textContent = `.ia-sabe-l{display:grid;gap:6px;margin:8px 0 10px}
        .ia-sabe-i{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start}
        .ia-sabe-i textarea{min-height:44px;padding:9px 11px;border:1px solid var(--line-2);border-radius:12px;background:var(--surface);color:var(--ink);font:inherit;resize:vertical}
        .ia-sabe .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}`;
      document.head.appendChild(st);
    }
    return r;
  };
}

/* ---------- 6. FOTOS: galeria do passeio pelo chat e foto leve (28/10/2026) ----------
   A Milla: "mandei as fotos individuais do iate e não baixou… daí incluí a de capa só". Eram três
   furos: o clipe pegava só 4 fotos; cada foto do chat ficava inteira (1600 px) na memória do
   aparelho, que enche em poucas e descartava as seguintes sem aviso; e o assistente não tinha como
   pôr foto na galeria (criar_passeio só tinha a capa e alterar_passeio nenhuma foto).
   fotoNaNuvem: reduz e sobe para a pasta da sala no Storage (yalla-fotos, leitura pública, só a
   dona sobe); sem nuvem ou sem a pasta, devolve a foto reduzida (1100 px) — nunca perde a foto. */
function oyImg(src) { return new Promise((ok, falha) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => falha(new Error('foto ilegível')); i.src = src; }); }
async function oyReduz(src, lado, q) {
  const img = await oyImg(src), k = Math.min(1, lado / Math.max(img.width, img.height)), c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return { url: c.toDataURL('image/jpeg', q), blob: await new Promise(ok => c.toBlob(ok, 'image/jpeg', q)) };
}
async function fotoNaNuvem(src, pasta) {
  src = String(src || '');
  if (!/^data:image\//.test(src)) return src;                       /* já é endereço (arte/…, https://…) */
  try {
    if (typeof authEnsure === 'function') await authEnsure();   /* login vencido: renova antes (o upload caía calado na foto pesada) */
    if (typeof temNuvem === 'function' && temNuvem() && typeof isLoggedIn === 'function' && isLoggedIn() && typeof SUPA_URL !== 'undefined' && SUPA_URL) {
      const { blob } = await oyReduz(src, 1600, 0.84);
      const sala = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.sala) || '', balde = (sala ? sala + '-' : '') + 'fotos';
      const nome = String(pasta || 'geral').replace(/[^a-z0-9-]/gi, '').slice(0, 40) + '/' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
      const r = await fetch(SUPA_URL + '/storage/v1/object/' + balde + '/' + nome, { method: 'POST',
        headers: { apikey: SUPA_KEY, authorization: 'Bearer ' + authToken(), 'content-type': 'image/jpeg' }, body: blob });
      if (r.ok) return SUPA_URL + '/storage/v1/object/public/' + balde + '/' + nome;
    }
  } catch (e) {}
  try { return (await oyReduz(src, 1100, 0.78)).url; } catch (e) { return src; }
}
/* a foto do chat: fica na conversa NA HORA (o assistente já usa o ref) e, em segundos, vira leve */
if (typeof guardaFoto === 'function' && typeof Mkt !== 'undefined') {
  guardaFoto = function (src, nome) {
    const f = { id: 'foto-' + uid(), src, nome: nome || 'foto enviada', criado: hojeIso() };
    Mkt.get().fotos.unshift(f);
    fotoNaNuvem(src, 'chat').then(leve => { f.src = leve; try { Mkt.salva(); } catch (e) {} }).catch(() => {});
    return f;
  };
}

/* o assistente põe fotos na GALERIA e troca a CAPA, inclusive de passeio que já existe */
(function () {
  if (typeof IA_FERRAMENTAS === 'undefined' || typeof iaPlano !== 'function') return;
  const acha = (n) => IA_FERRAMENTAS.find(t => t.name === n);
  const REFS = { type: 'array', items: { type: 'string' } };
  const cp = acha('criar_passeio'), ap = acha('alterar_passeio');
  if (cp) { cp.input_schema.properties.fotos = { ...REFS, description: 'refs de TODAS as fotos que ela mandou para este passeio: vão para a galeria (a capa vai em foto)' }; cp.description += ' Com fotos: todas vão para a galeria.'; }
  if (ap) {
    Object.assign(ap.input_schema.properties, { fotos: { ...REFS, description: 'refs das fotos para ACRESCENTAR na galeria do passeio' }, capa: { type: 'string', description: 'ref da foto que vira a capa' } });
    ap.description = ap.description.replace('Altera nome,', 'Altera fotos (galeria e capa), nome,');
  }
  const _plano = iaPlano;
  iaPlano = function (nome, i) {
    i = i || {};
    const ehCria = nome === 'criar_passeio', ehMuda = nome === 'alterar_passeio';
    if (!ehCria && !ehMuda) return _plano(nome, i);
    const fotos = (Array.isArray(i.fotos) ? i.fotos : []).filter(Boolean), capa = ehCria ? (i.foto || fotos[0] || '') : (i.capa || '');
    if (!fotos.length && !capa) return _plano(nome, i);
    const refs = [...new Set([capa, ...fotos].filter(Boolean))], faltam = refs.filter(r => !fotoSrc(r));
    if (faltam.length) return E_('foto não encontrada: ' + faltam.join(', ') + ' — use os refs das fotos guardadas (ver_fotos)');
    let p;
    if (ehCria) p = _plano(nome, { ...i, foto: capa });
    else {
      const x = Tours.get(i.passeio_id); if (!x) return E_('passeio não encontrado');
      const resto = { ...i }; delete resto.fotos; delete resto.capa;
      const outro = ['nome', 'descricao', 'ponto_encontro', 'duracao', 'min', 'max', 'publicado'].some(k => resto[k] != null && resto[k] !== '');
      p = outro ? _plano(nome, resto) : { titulo: 'Fotos do passeio', assumiu: [], linhas: [['Passeio', nomeTour(x)]], fazer: () => ({ ok: true }) };
    }
    if (!p || !p.fazer) return p;
    p.linhas.push(['Fotos', `${fotos.length ? fotos.length + (fotos.length > 1 ? ' fotos na galeria' : ' foto na galeria') : ''}${fotos.length && capa ? ' · ' : ''}${capa ? 'capa nova' : ''}`]);
    const f0 = p.fazer;
    p.fazer = async () => {
      const r = await f0(); const id = ehCria ? r && r.passeio_id : i.passeio_id; const y = id && Tours.get(id); if (!y) return r;
      const url = {}; for (const ref of refs) url[ref] = await fotoNaNuvem(fotoSrc(ref), id);
      const antes = Array.isArray(y.fotos) ? y.fotos : (y.photo && y.photo !== 'capa.jpg' && !ehCria ? [y.photo] : []);
      const gal = [...new Set([...(capa ? [url[capa]] : []), ...antes, ...fotos.map(f => url[f])].filter(Boolean))];
      Tours.update(id, { fotos: gal, ...(capa ? { photo: url[capa] } : {}) });
      return { ...r, ok: true, fotos_na_galeria: gal.length };
    };
    return p;
  };
})();

/* INCLUSO, NÃO INCLUSO E ORIENTAÇÕES NO LUGAR CERTO (28/10/2026, vídeo da Milla do Majesty 56: tudo
   tinha ido para a descrição e a página mostrava "Está incluído" vazio). criar_passeio e
   alterar_passeio ganham inclui / nao_inclui / orientacoes; e o que for gravado passa pela mesma
   separação do editor (tourSeparaTextos) — o texto dela só muda de lugar, nada é reescrito. */
(function () {
  if (typeof IA_FERRAMENTAS === 'undefined' || typeof iaPlano !== 'function') return;
  const L = { type: 'array', items: { type: 'string' } };
  const CAMPOS = { inclui: { ...L, description: 'o que ESTÁ incluso, um item por linha, como ela escreveu' }, nao_inclui: { ...L, description: 'o que NÃO está incluso, como ela escreveu' },
    orientacoes: { type: 'string', description: 'avisos para o cliente (capacidade, "percurso sujeito a…", o que levar), como ela escreveu' } };
  for (const n of ['criar_passeio', 'alterar_passeio']) {
    const t = IA_FERRAMENTAS.find(f => f.name === n); if (!t) continue;
    Object.assign(t.input_schema.properties, CAMPOS);
    t.description += ' descricao = SÓ o programa (o texto corrido); o incluso, o não incluso e os avisos vão em inclui / nao_inclui / orientacoes — nunca dentro da descrição.';
  }
  const _plano = iaPlano;
  iaPlano = function (nome, i) {
    i = i || {};
    if (nome !== 'criar_passeio' && nome !== 'alterar_passeio') return _plano(nome, i);
    const inc = (i.inclui || []).map(String).filter(s => s.trim()), ninc = (i.nao_inclui || []).map(String).filter(s => s.trim()), ori = String(i.orientacoes || '').trim();
    const resto = { ...i }; delete resto.inclui; delete resto.nao_inclui; delete resto.orientacoes;
    const so = nome === 'alterar_passeio' && (inc.length || ninc.length || ori) && !Object.keys(resto).some(k => k !== 'passeio_id' && resto[k] != null && resto[k] !== '' && !(Array.isArray(resto[k]) && !resto[k].length));
    let p;
    if (so) { const x = Tours.get(i.passeio_id); if (!x) return E_('passeio não encontrado'); p = { titulo: 'Textos do passeio', assumiu: [], linhas: [['Passeio', nomeTour(x)]], fazer: () => ({ ok: true }) }; }
    else p = _plano(nome, resto);
    if (!p || !p.fazer) return p;
    if (inc.length) p.linhas.push(['Incluso', inc.join(' · ')]);
    if (ninc.length) p.linhas.push(['Não incluso', ninc.join(' · ')]);
    if (ori) p.linhas.push(['Orientações', ori]);
    const f0 = p.fazer;
    p.fazer = async () => {
      const r = await f0(); const id = nome === 'criar_passeio' ? r && r.passeio_id : i.passeio_id; const x = id && Tours.get(id); if (!x) return r;
      const muda = {};
      if (inc.length) muda.includes = { ...(Array.isArray(x.includes) ? { pt: x.includes } : (x.includes || {})), pt: inc };
      if (ninc.length) muda.notIncludes = { ...(Array.isArray(x.notIncludes) ? { pt: x.notIncludes } : (x.notIncludes || {})), pt: ninc };
      if (ori) muda.dicas = { ...(x.dicas || {}), pt: ori };
      if (Object.keys(muda).length) Tours.update(id, muda);
      const y = Tours.get(id), z = typeof tourSeparaTextos === 'function' ? tourSeparaTextos(y) : y;
      if (z !== y) Tours.update(id, { desc: z.desc, includes: z.includes, notIncludes: z.notIncludes, dicas: z.dicas, ...(z.minHoras !== y.minHoras ? { minHoras: z.minHoras } : {}) });
      return r;
    };
    return p;
  };
})();

/* =====================================================
   7. O ASSISTENTE DELA DE VERDADE (13/11/2026)

   A Milla: "Assistente é doido! Kkkk". O app chamava o cofre SEM dizer de quem era
   e SEM o login dela: o cofre tratava como visitante da demonstração (modelo antigo,
   resposta curta, 60 mensagens por dia por internet). O cofre nunca anotou um
   centavo de gasto da Yalla, e as outras clientes têm meses inteiros.

   Agora, como no app da Ingrid e no da Mari: vai o cliente ('yalla') e o login dela.
   O cofre confere no banco que é a dona e escolhe o modelo (cofre: _comum/pro.js):
   o dia a dia no Haiku 5.5 e o pedido pesado (foto, PDF, texto comprido) no
   Sonnet 5.5. Prazo de 90 s, nova tentativa em erro passageiro, cache das
   ferramentas e da conversa (a lista de ferramentas é a maior parte do pedido),
   e a resposta cortada nunca roda ação pela metade.
   ===================================================== */
const YL_PRAZO_MS = 90000, YL_TENTA_MS = [0, 1500, 4000];
function ylFetch(url, opts) {
  const ac = new AbortController(), t = setTimeout(() => ac.abort(), YL_PRAZO_MS);
  return fetch(url, { ...(opts || {}), signal: ac.signal }).finally(() => clearTimeout(t));
}
/* erro passageiro (rede, 429 sem ser o limite do dia, 500/502/503/529): tenta de novo até 3x */
async function ylPede(vai) {
  let r = null, corpo = null, falha = null;
  for (let k = 0; k < YL_TENTA_MS.length; k++) {
    if (YL_TENTA_MS[k]) await new Promise(ok => setTimeout(ok, YL_TENTA_MS[k]));
    try { r = await vai(); falha = null; } catch (e) { falha = e; r = null; if (e && e.name === 'AbortError') break; continue; }   /* prazo estourou: não repete (pode já ter sido cobrada) */
    corpo = await r.json().catch(() => null);
    const limiteDoDia = r.status === 429 && corpo && corpo.error && corpo.error.type === 'limite';
    if (r.ok || limiteDoDia || ![429, 500, 502, 503, 529].includes(r.status)) return { r, corpo };
  }
  if (falha) throw new Error(falha.name === 'AbortError' ? 'A resposta demorou demais (mais de 90 s). Tente de novo — se já tiver feito algo, está gravado.' : iaTraduzErro(0));
  return { r, corpo };
}
/* o modelo pensa antes (blocos "thinking" assinados, presos ao prompt com que nasceram — e o nosso
   muda a cada mensagem): nunca voltam para a API nem ficam no histórico (lição da Ingrid, 03/10) */
const ylEhPensamento = (b) => b && (b.type === 'thinking' || b.type === 'redacted_thinking');
function ylSemPensamento(ms) {
  return (ms || []).map(m => {
    if (m.role !== 'assistant' || !Array.isArray(m.content) || !m.content.some(ylEhPensamento)) return m;
    const c = m.content.filter(b => !ylEhPensamento(b));
    return { ...m, content: c.length ? c : [{ type: 'text', text: '…' }] };
  });
}
/* cache: na última ferramenta (a lista não muda entre uma mensagem e outra) e no fim da conversa */
function ylFerramentas() {
  const l = IA_FERRAMENTAS.slice(), k = l.length - 1;
  if (k >= 0) l[k] = { ...l[k], cache_control: { type: 'ephemeral' } };
  return l;
}
function ylComCache(ms) {
  if (!ms.length) return ms;
  const out = ms.slice(), u = out[out.length - 1];
  const blocos = typeof u.content === 'string' ? [{ type: 'text', text: u.content }] : (u.content || []).slice();
  if (!blocos.length) return ms;
  blocos[blocos.length - 1] = { ...blocos[blocos.length - 1], cache_control: { type: 'ephemeral' } };
  out[out.length - 1] = { ...u, content: blocos };
  return out;
}
/* recusa por filtro, resposta vazia ou cortada no meio (max_tokens): nunca balão vazio, nunca ação pela metade */
function ylCortado(corpo) {
  if (!corpo || !Array.isArray(corpo.content)) return corpo;
  if (corpo.stop_reason === 'refusal') {
    const txt = corpo.content.filter(b => b.type === 'text' && b.text.trim());
    corpo.content = txt.length ? txt : [{ type: 'text', text: 'Não consegui responder esse pedido do jeito que veio. Pode dizer de outro jeito?' }];
    corpo.stop_reason = 'end_turn'; return corpo;
  }
  corpo.content = corpo.content.filter(b => !ylEhPensamento(b));
  if (!corpo.content.length) corpo.content = [{ type: 'text', text: 'Não consegui formular a resposta desta vez — pode repetir?' }];
  if (corpo.stop_reason !== 'max_tokens') return corpo;
  corpo.content = corpo.content.filter(b => b.type !== 'tool_use');
  corpo.content.push({ type: 'text', text: '\n\n(A resposta ficou grande demais e foi cortada — me peça em partes menores.)' });
  corpo.stop_reason = 'end_turn';
  return corpo;
}
let ylAvisouSimples = false;
if (typeof iaChamar === 'function') {
  const _ylChamar = iaChamar;
  iaChamar = async function (mensagens) {
    if (iaModo() !== 'vivo') return _ylChamar(mensagens);
    const cliente = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.clienteCofre) || '';
    /* login vencido: renova antes, senão o cofre não reconhece a dona e cai na demonstração */
    if (typeof authVencida === 'function' && authVencida() && typeof authEnsure === 'function') { try { await authEnsure(); } catch (e) {} }
    const tok = typeof isLoggedIn === 'function' && isLoggedIn() && typeof authToken === 'function' ? authToken() : null;
    const corpoTxt = JSON.stringify({ max_tokens: 6000, ...(cliente ? { cliente } : {}), system: iaSistema(), tools: ylFerramentas(),
      messages: ylComCache(ylSemPensamento(mensagensParaEnvio(mensagens))) });
    if (corpoTxt.length > 25e6) throw new Error('Esses arquivos são grandes demais para o assistente. Mande menos fotos de uma vez, ou um PDF menor.');
    const cab = { 'content-type': 'application/json', ...(cliente && tok ? { authorization: 'Bearer ' + tok } : {}) };
    const { r, corpo } = await ylPede(() => ylFetch(COFRE + '/api/claude', { method: 'POST', headers: cab, body: corpoTxt }));
    if (r.status === 429 && corpo && corpo.error && corpo.error.type === 'limite') { marcaEsgotado('claude'); throw Object.assign(new Error(ia('vivoAcabou')), { acabou: true }); }
    if (!r.ok) throw new Error(iaTraduzErro(r.status, corpo));
    /* o cofre não reconheceu a dona (login de outro aparelho, sessão velha): responde a demonstração. Avisa uma vez. */
    if (cliente && corpo && /^claude-haiku-4/.test(String(corpo.model || '')) && !ylAvisouSimples) {
      ylAvisouSimples = true;
      toast('O assistente está no modo simples. Saia e entre de novo no painel para ele usar o modo completo.');
    }
    return ylCortado(corpo);
  };
}

/* =====================================================
   8. ELE APAGA E MUDA (13/11/2026)

   A Milla pediu "apagar ORC-0037" e ouviu "o app não tem essa ferramenta" — com o
   botão "apagar" bem ali na lista. Regra da casa: o assistente alcança tudo o que a
   tela faz. Ganha: apagar_orcamento, apagar_pedido_roteiro (os cartões do "Monte seu
   roteiro"), apagar_tarefa (tarefa ou anotação) e mudar_tarefa. Apagar SEMPRE mostra
   o cartão, mesmo com "Perguntar antes de gravar" desligado.
   ===================================================== */
(function () {
  if (typeof IA_FERRAMENTAS === 'undefined' || typeof iaPlano !== 'function' || typeof Orc === 'undefined') return;
  const S = (d) => ({ type: 'string', ...(d ? { description: d } : {}) });
  const O = (props, req) => ({ type: 'object', properties: props, required: req });
  const NOVAS = [
    { name: 'apagar_orcamento', description: 'APAGA um orçamento: o repetido, o de teste ou o que deu errado. O que já fechou (virou reserva) não se apaga — aí se cancelam as reservas. Mostra o cartão antes.', input_schema: O({ numero: S('número do orçamento (ex.: ORC-0037) ou nome do cliente') }, ['numero']) },
    { name: 'apagar_pedido_roteiro', description: 'APAGA um pedido do "Monte seu roteiro" (os cartões que os clientes preenchem no site pedindo orçamento): de teste, repetido ou de quem desistiu. Mostra o cartão antes.', input_schema: O({ pedido: S('nome de quem pediu ou o pedido_id (de ver_orcamentos → pedidos_de_roteiro)') }, ['pedido']) },
    { name: 'apagar_tarefa', description: 'APAGA uma tarefa ou uma anotação. Para só marcar como feita, use concluir_tarefa. Mostra o cartão antes.', input_schema: O({ tarefa: S('tarefa_id / anotacao_id, ou um pedaço do texto') }, ['tarefa']) },
    { name: 'mudar_tarefa', description: 'Muda uma tarefa que já existe: texto, dia, hora, prioridade ou tipo (profissional/pessoal).', input_schema: O({ tarefa: S('tarefa_id ou um pedaço do texto'), texto: S(), dia: S('AAAA-MM-DD ("" tira a data)'), hora: S('HH:MM'), prioridade: { type: 'string', enum: ['alta', 'media', 'baixa'] }, tipo: { type: 'string', enum: ['profissional', 'pessoal'] } }, ['tarefa']) },
  ];
  for (const t of NOVAS) if (!IA_FERRAMENTAS.some(x => x.name === t.name)) IA_FERRAMENTAS.push(t);

  const N = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const dia = (iso) => iso ? (typeof ingData === 'function' ? ingData(iso) : iso) : '';
  function achaPedido(q) {
    const l = Roteiros.all(), s = String(q || '').trim(), n = N(s);
    const p0 = l.find(p => p.id === s); if (p0) return { p: p0 };
    const m = n ? l.filter(p => N(p.nome).includes(n)) : [];
    if (m.length === 1) return { p: m[0] };
    if (!m.length) return E_('pedido não encontrado — veja pedidos_de_roteiro em ver_orcamentos');
    return { erro: 'mais de um pedido com esse nome — pergunte qual', opcoes: m.map(p => ({ pedido_id: p.id, nome: p.nome, datas: [p.ini, p.fim].filter(Boolean).join(' a '), pedido_em: String(p.criado || '').slice(0, 10) })) };
  }
  function achaTarefa(q) {
    const s = String(q || '').trim(), t0 = Tarefas.get(s); if (t0) return { t: t0 };
    const n = N(s), l = n ? Tarefas.all().filter(t => N(t.texto).includes(n) || N(t.detalhe).includes(n)) : [];
    const abertas = l.filter(t => !t.feita), usa = abertas.length ? abertas : l;
    if (usa.length === 1) return { t: usa[0] };
    if (!usa.length) return E_('não achei — use ver_tarefas ou ver_anotacoes');
    return { erro: 'mais de uma parecida — pergunte qual', opcoes: usa.slice(0, 8).map(t => ({ id: t.id, tipo: t.tipo === 'nota' ? 'anotação' : 'tarefa', texto: t.texto, dia: t.prazo || undefined })) };
  }
  const PLANOS = {
    apagar_orcamento(i) {
      const r = ingAchaOrc(i.numero); if (!r.o) return r;
      const o = r.o;
      if (o.status === 'fechado') return E_(`o ${o.num} já fechou (virou reserva) — não dá para apagar; para desfazer, cancele as reservas`);
      return { titulo: `Apagar o orçamento ${o.num}`, assumiu: [], linhas: [['Orçamento', `${o.num} · ${o.cliente.nome || 'sem nome'}`], ['Situação', o.status], ['Serviços', String((o.itens || []).length)], ['Atenção', 'não dá para desfazer']],
        fazer: () => { Orc.remove(o.id); try { Tarefas.sincroniza(); } catch (e) {} return { ok: true, apagado: o.num }; } };
    },
    apagar_pedido_roteiro(i) {
      const r = achaPedido(i.pedido); if (!r.p) return r;
      const p = r.p, orc = Orc.all().find(o => o.pedidoId === p.id);
      return { titulo: 'Apagar o pedido do Monte seu roteiro', assumiu: [], linhas: [['Pedido de', p.nome || 'sem nome'], ['Datas', [dia(p.ini), dia(p.fim)].filter(Boolean).join(' → ') || '—'],
        ['Pessoas', `${+p.adultos || 0} adultos${+p.criancas ? ' + ' + p.criancas + ' crianças' : ''}`], ...(orc ? [['Orçamento', `o ${orc.num} continua (só o pedido sai)`]] : []), ['Atenção', 'não dá para desfazer']],
        fazer: () => ({ ok: Roteiros.remove(p.id), apagado: p.nome }) };
    },
    apagar_tarefa(i) {
      const r = achaTarefa(i.tarefa); if (!r.t) return r;
      const t = r.t, nota = t.tipo === 'nota';
      return { titulo: nota ? 'Apagar a anotação' : 'Apagar a tarefa', assumiu: [], linhas: [[nota ? 'Anotação' : 'Tarefa', t.texto], ...(t.prazo ? [['Dia', dia(t.prazo) + (t.hora ? ' ' + t.hora : '')]] : []),
        ...(t.clienteNome ? [['Cliente', t.clienteNome]] : []), ['Atenção', 'não dá para desfazer']],
        fazer: () => { Tarefas.remove(t.id); return { ok: true }; } };
    },
    mudar_tarefa(i) {
      const r = achaTarefa(i.tarefa); if (!r.t) return r;
      const t = r.t, d = {}, l = [['Tarefa', t.texto]];
      if (i.texto != null && String(i.texto).trim()) { d.texto = String(i.texto).trim(); l.push(['Texto novo', d.texto]); }
      if (i.dia != null) {
        if (String(i.dia).trim() === '') { d.prazo = ''; d.hora = ''; l.push(['Dia', 'sem data']); }
        else if (isoOk(i.dia)) { d.prazo = i.dia; l.push(['Dia', dia(i.dia)]); }
        else return E_('dia no formato AAAA-MM-DD');
      }
      if (i.hora != null && String(i.hora).trim() !== '') { if (!/^\d{1,2}:\d{2}$/.test(i.hora)) return E_('hora no formato HH:MM'); d.hora = i.hora.padStart(5, '0'); l.push(['Hora', d.hora]); }
      if (i.prioridade) { d.prio = i.prioridade; l.push(['Prioridade', i.prioridade]); }
      if (i.tipo) { d.cat = i.tipo === 'pessoal' ? 'pessoal' : 'profissional'; l.push(['Tipo', d.cat]); }
      if (!Object.keys(d).length) return E_('diga o que muda: texto, dia, hora, prioridade ou tipo');
      return { titulo: 'Mudar a tarefa', assumiu: [], linhas: l, fazer: () => { Tarefas.salva(t.id, d); return { ok: true, tarefa_id: t.id }; } };
    },
  };
  const _plano = iaPlano;
  iaPlano = function (nome, i) { return PLANOS[nome] ? PLANOS[nome](i || {}) : _plano(nome, i); };
  /* as anotações vêm com o id (para apagar a certa) */
  if (typeof iaLeitura === 'function') {
    const _ler = iaLeitura;
    iaLeitura = function (nome, i) {
      if (nome !== 'ver_anotacoes') return _ler(nome, i);
      const l = Tarefas.notas((i || {}).busca).map(n => ({ anotacao_id: n.id, texto: n.texto, detalhe: n.detalhe, cliente: n.clienteNome, dia: String(n.criada || '').slice(0, 10), fixa: n.fixa }));
      return l.length ? l : 'nenhuma anotação';
    };
  }
  /* apagar sempre pergunta, mesmo com "Perguntar antes de gravar" desligado */
  const SEMPRE = new Set(['apagar_orcamento', 'apagar_pedido_roteiro', 'apagar_tarefa']);
  if (typeof iaRodaFerramenta === 'function') {
    const _roda = iaRodaFerramenta;
    iaRodaFerramenta = async function (nome, input) {
      if (!SEMPRE.has(nome) || iaPerguntaAntes()) return _roda(nome, input);
      try {
        const plano = iaPlano(nome, input || {}); if (plano.erro) return plano;
        if (!(await iaPedeConfirmacao(plano))) return { cancelado: true, aviso: 'cancelou; não apague nada e não insista' };
        const r = await plano.fazer(); iaRedesenhaTela(); return r;
      } catch (e) { return E_(String(e && e.message || e)); }
    };
  }
  if (typeof iaSistema === 'function') {
    const _sis = iaSistema;
    iaSistema = function () {
      const b = _sis();
      b.push({ type: 'text', text: `## APAGAR E MUDAR (você consegue)
- Orçamento repetido, de teste ou errado: apagar_orcamento ("apaga o ORC-0037"). O que já fechou não se apaga.
- Pedido do "Monte seu roteiro" (os cartões que os clientes preenchem no site): apagar_pedido_roteiro.
- Tarefa ou anotação: apagar_tarefa; mudar dia, hora, texto ou prioridade: mudar_tarefa.
- Antes de dizer que não consegue, confira a sua lista de ferramentas. Se mesmo assim não der, diga em qual tela ela faz e abra a tela com abrir_aba.` });
      return b;
    };
  }
})();

/* =====================================================
   9. SEGURAR PARA FALAR (13/11/2026, igual ao do Dhalsin na B12)

   O Eugênio: "grava a voz segura o botão pra falar e quando solta o botão vai".
   Antes era um toque: o navegador encerrava na PRIMEIRA pausa e mandava a frase
   pela metade. Agora: segurou, ouve (pausa não corta nada); soltou, manda o que
   juntou. Arrastar o dedo para fora do botão antes de soltar cancela. No teclado,
   segurar Espaço ou Enter no botão faz o mesmo.
   ===================================================== */
(function () {
  if (typeof iaDesenha !== 'function' || typeof ingTemMic !== 'function' || !ING_FALA) return;
  let segurando = false, comecou = 0, fora = false, ultimo = '';
  const gav = () => iaEl && iaEl.g;
  const campo = () => gav() && gav().querySelector('#iaTxt');
  const faixa = (s) => { const t = gav() && gav().querySelector('#iaOuvTxt'); if (t) t.textContent = s; };
  const OUVINDO = 'Ouvindo… fale à vontade. Solte o botão para enviar.';
  function mostra(meio) {
    const t = campo(); if (!t) return;
    const tudo = [ingOuvAntes, ingOuvJunto, meio].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    t.value = tudo; t.style.height = ''; t.style.height = Math.min(140, t.scrollHeight) + 'px';
    if (!fora) faixa(tudo && tudo !== ingOuvAntes ? '“' + tudo.slice(-70) + '”' : OUVINDO);
  }
  function abre() {
    const r = new ING_FALA();
    r.lang = 'pt-BR'; r.interimResults = true; r.continuous = true; r.maxAlternatives = 1;
    r.onresult = (e) => {
      let fim = '', meio = '';
      for (let k = e.resultIndex; k < e.results.length; k++) { const t = e.results[k][0].transcript; if (e.results[k].isFinal) fim += t; else meio += t; }
      if (fim) ingOuvJunto = (ingOuvJunto + ' ' + fim).trim();
      ultimo = meio; mostra(meio);
    };
    r.onerror = (e) => {
      const q = e && e.error;
      if (q === 'aborted' || q === 'no-speech') return;    /* soltou sem falar, ou pausa: não é erro */
      segurando = false; ingOuvCanc = true;                 /* o onend vem depois e não manda nada */
      if (q === 'not-allowed' || q === 'service-not-allowed') toast('Falta liberar o microfone: toque no cadeado ao lado do endereço e permita.');
      else if (q === 'network') toast('Sem internet para transcrever a voz.');
      else toast('Deu problema no microfone: ' + (q || '?'));
    };
    r.onend = () => {
      if (ingOuvindo !== r) return;
      /* o navegador parou sozinho com o dedo ainda no botão: continua ouvindo, sem perder o que já veio */
      if (segurando && !ingOuvCanc) {
        ingOuvJunto = [ingOuvJunto, ultimo].filter(Boolean).join(' ').trim(); ultimo = '';
        try { abre(); return; } catch (e) {}
      }
      termina();
    };
    r.start(); ingOuvindo = r;
  }
  function termina() {
    const canc = ingOuvCanc, t = campo();
    ingOuvindo = null; segurando = false; fora = false; ingRelogio(false); ingOuvPinta();
    const ouv = gav() && gav().querySelector('#iaOuv'); if (ouv) ouv.classList.remove('cancela');
    if (!t) return;
    if (canc) { t.value = ingOuvAntes; return; }
    const novo = [ingOuvJunto, ultimo].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (!novo) { t.value = ingOuvAntes; toast(Date.now() - comecou < 700 ? 'Segure o botão enquanto fala e solte no fim.' : 'Não ouvi nada. Segure o botão e fale mais perto.'); return; }
    t.value = [ingOuvAntes, novo].filter(Boolean).join(' ');
    if (ingVozCfg().enviar !== false) gav().querySelector('#iaForm')?.requestSubmit(); else t.focus();
  }
  function comecar(ev) {
    if (segurando || (ev && ev.button > 0)) return;
    if (ev && ev.cancelable) ev.preventDefault();
    if (!ingTemMic()) { toast(ING_FALA ? 'O microfone só funciona no link do app (https).' : 'Este navegador não ouve. No iPhone use o Safari; no computador, o Chrome.'); return; }
    const t = campo(); if (!t) return;
    if (ingOuvindo) { try { ingOuvindo.abort(); } catch (e) {} ingOuvindo = null; }
    ingPararFala();
    segurando = true; fora = false; comecou = Date.now(); ingOuvCanc = false; ingOuvAntes = t.value.trim(); ingOuvJunto = ''; ultimo = '';
    if (ev && ev.pointerId != null) { try { ev.currentTarget.setPointerCapture(ev.pointerId); } catch (e) {} }
    try { abre(); } catch (e) { segurando = false; ingOuvindo = null; toast('Não consegui abrir o microfone.'); return; }
    mostra(''); ingRelogio(true); ingOuvPinta();
    try { navigator.vibrate && navigator.vibrate(12); } catch (e) {}
  }
  function soltar(ev) {
    if (!segurando) return;
    segurando = false;
    if (ev && ev.pointerId != null) { try { ev.currentTarget.releasePointerCapture(ev.pointerId); } catch (e) {} }
    if (fora) { ingOuvCanc = true; toast('Cancelado. O que você falou não foi enviado.'); }
    if (!ingOuvindo) return termina();
    try { ingOuvindo.stop(); } catch (e) { termina(); }
  }
  function mexe(ev) {
    if (!segurando) return;
    const r = ev.currentTarget.getBoundingClientRect(), m = 48;
    const f = ev.clientX < r.left - m || ev.clientX > r.right + m || ev.clientY < r.top - m || ev.clientY > r.bottom + m;
    if (f === fora) return;
    fora = f; faixa(f ? 'Solte agora para CANCELAR' : OUVINDO);
    const ouv = gav() && gav().querySelector('#iaOuv'); if (ouv) ouv.classList.toggle('cancela', f);
  }
  /* o botão diz o que fazer: "Segure e fale" / "Solte para enviar" */
  const _pinta = ingOuvPinta;
  ingOuvPinta = function () {
    _pinta();
    const mic = gav() && gav().querySelector('#iaMic'); if (!mic) return;
    const mt = mic.querySelector('.mic-t'); if (mt) mt.textContent = ingOuvindo ? 'Solte' : 'Segure';
    mic.setAttribute('aria-label', ingOuvindo ? 'Ouvindo. Solte para enviar' : 'Segure para falar');
    mic.title = ingOuvindo ? 'Ouvindo. Solte para enviar; arraste para fora para cancelar' : 'Segure enquanto fala e solte para enviar';
  };
  const _des = iaDesenha;
  iaDesenha = function () {
    _des();
    const g = gav(), mic = g && g.querySelector('#iaMic');
    if (!mic || mic.dataset.segura) return;
    mic.dataset.segura = '1';
    mic.onclick = (e) => e.preventDefault();
    mic.addEventListener('pointerdown', comecar);
    mic.addEventListener('pointerup', soltar);
    mic.addEventListener('pointercancel', soltar);
    mic.addEventListener('pointermove', mexe);
    mic.addEventListener('contextmenu', (e) => e.preventDefault());
    mic.addEventListener('keydown', (e) => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) comecar(e); else if (e.key === ' ' || e.key === 'Enter') e.preventDefault(); });
    mic.addEventListener('keyup', (e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); soltar(); } });
    const pal = g.querySelector('.ingPalcoT'); if (pal && ingTemMic()) pal.innerHTML = 'Segure o <b>microfone</b> enquanto fala e solte para enviar';
    ingOuvPinta();
  };
  /* o dedo ainda no botão e o celular troca de app (ligação, notificação): solta */
  window.addEventListener('blur', () => soltar());
  const st = document.createElement('style');
  st.textContent = `#iaMic{touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none}
#iaOuv #iaOuvManda,#iaOuv #iaOuvDesc{display:none}
.iaOuv.cancela{background:var(--surface-2);border-color:var(--line-2)}
.iaOuv.cancela #iaOuvTxt{color:var(--danger);font-weight:700}`;
  document.head.appendChild(st);
})();
