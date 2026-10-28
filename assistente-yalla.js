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
