/* =====================================================
   TABELA DE PREÇOS — as planilhas de preço dela
   (as tabelas e as regras do cliente estão em conteudo.js)

   A REGRA DE OURO (provada contra a planilha real dela — 1740 contas, 0 erro):
   a Ingrid edita SÓ o preço e o custo. Todo o resto é fórmula, igual no Excel:

     por pessoa       = preço ÷ nº de pessoas
     sinal            = preço − custo            (o sinal é a margem dela)
     Transfer:
       cartão         = dinheiro × 1,10          (taxa do cartão)
       noturno        = dinheiro + €30 por veículo
       noturno cartão = noturno × 1,10
     Guia: além disso tem "gestão de ingressos" (valor por pessoa, à parte).
     Transfer Roma 5% = Transfer Roma com −5% no preço — deriva sozinha; se ela
       mexer no Transfer Roma, o 5% acompanha na proporção.

   Tudo é editável e amarra no ORÇAMENTO: no orçamento, "Acrescentar da sua
   tabela" lista estas linhas; escolher uma preenche valor, custo e sinal.
   ===================================================== */
/* as regras e as tabelas do cliente moram em conteudo.js */
const _PR_CONT = (typeof CONTEUDO !== 'undefined' && CONTEUDO.precos) || {};
const _PR_REGRAS = Object.assign({ cartao: 0.10, noturnoVeic: 30 }, _PR_CONT.regras || {});
const PRECO_NOTURNO_VEIC = +_PR_REGRAS.noturnoVeic || 0;   // adicional noturno por veículo
const PRECO_CARTAO = +_PR_REGRAS.cartao || 0;              // acréscimo do cartão (0,10 = 10%)
const PRECOS_SEED = _PR_CONT.seed || {};

function _prR2(n) { return Math.round((+n || 0) * 100) / 100; }
/* lê o que ela digitou numa célula: "€90,00", "90,5", "90.5", "90" */
function _precoNum(v) {
  let s = String(v == null ? '' : v).replace(/[€R$\s]/g, '').trim(); if (!s) return 0;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.'); else s = s.replace(/,/g, '');
  const n = parseFloat(s); return isNaN(n) ? 0 : n;
}
function _prEur(n) { return (typeof eur === 'function') ? eur(n) : (+n || 0).toFixed(2); }

const Precos = {
  /* instala a planilha dela uma vez. NUNCA apaga o que ela já editou. */
  seeda() {
    if (Array.isArray(DB.precos) && DB.precos.length) return DB.precos;
    const S = (PRECOS_SEED && typeof PRECOS_SEED === 'object') ? PRECOS_SEED : {};
    const secoes = (arr) => (arr || []).map((s, si) => ({ id: 's' + si, titulo: s.titulo,
      linhas: (s.linhas || []).map((l, li) => Object.assign({ id: 'l' + si + '_' + li }, l)) }));
    const TABS = _PR_CONT.tabelas || [{ id: 'transfer', nome: 'Transfer', tipo: 'transfer' }, { id: 'guia', nome: 'Guias', tipo: 'guia' }, { id: 'bv', nome: 'Passeios', tipo: 'bv' }];
    DB.precos = TABS.map(t => t.derivaDe ? Object.assign({}, t) : Object.assign({}, t, { secoes: secoes(S[t.tipo]) }));
    Precos._save(); return DB.precos;
  },
  _save() { if (typeof _opSave === 'function') _opSave(); else if (typeof save === 'function') save(); },
  all() { if (!Array.isArray(DB.precos) || !DB.precos.length) Precos.seeda(); return DB.precos; },
  get(id) { return Precos.all().find(t => t.id === id) || null; },
  /* a tabela onde as linhas MORAM (a derivada aponta pra base) */
  base(t) { return t && t.derivaDe ? Precos.get(t.derivaDe) : t; },
  fator(t) { return t && t.derivaDe ? (+t.fator || 1) : 1; },
  descontoPct(t) { return Math.round((1 - Precos.fator(t)) * 1000) / 10; },

  /* o CORAÇÃO: calcula todos os campos de uma linha (preço × fator) */
  calc(tipo, l, f) {
    f = f || 1;
    const preco = _prR2((+l.preco || 0) * f), custo = +l.custo || 0, paxN = +l.paxN || 1;
    const o = { ref: l.id, pax: l.pax, paxN, veic: l.veic || '', dur: l.dur || '', preco, custo,
      porPessoa: _prR2(preco / paxN), sinal: _prR2(preco - custo) };
    if (tipo === 'transfer') {
      const veicN = +l.veicN || 1, noturno = _prR2(preco + PRECO_NOTURNO_VEIC * veicN);
      return Object.assign(o, { veicN, cartao: _prR2(preco * (1 + PRECO_CARTAO)), noturno, noturnoCartao: _prR2(noturno * (1 + PRECO_CARTAO)) });
    }
    if (tipo === 'guia') return Object.assign(o, { ingressos: +l.ingressos || 0 });
    return o;
  },
  /* as seções já calculadas pra MOSTRAR na tela (aplica o fator da derivada) */
  secoesView(t) {
    const b = Precos.base(t), f = Precos.fator(t);
    return (b && b.secoes || []).map(s => ({ id: s.id, titulo: s.titulo, linhas: s.linhas.map(l => Precos.calc(b.tipo, l, f)) }));
  },

  /* edita UM valor-base (preço, custo ou ingressos). Sempre na tabela base. */
  editaValor(tabelaId, secId, linId, campo, valor) {
    if (!['preco', 'custo', 'ingressos'].includes(campo)) return null;
    const t = Precos.base(Precos.get(tabelaId)); if (!t) return null;
    const s = (t.secoes || []).find(x => x.id === secId), l = s && s.linhas.find(x => x.id === linId);
    if (!l) return null;
    l[campo] = _precoNum(valor); Precos._save(); return l;
  },
  /* muda o desconto da tabela derivada (5 -> 0,95) */
  setDesconto(tabelaId, pct) {
    const t = Precos.get(tabelaId); if (!t || !t.derivaDe) return null;
    t.fator = Math.max(0, Math.min(1, 1 - (+pct || 0) / 100)); Precos._save(); return t.fator;
  },

  /* ---------- a ponte com os ORÇAMENTOS ---------- */
  descLinha(t, s, c) {
    const nome = t.nome.replace(/\s*5%$/, '');
    const comp = c.veic ? c.veic.replace(/.*\(([^)]*)\).*/, '$1') : c.dur ? c.dur : '';
    return `${nome} — ${s.titulo} · ${c.pax}${comp ? ' · ' + comp : ''}`;
  },
  rotuloCurto(t, c) {
    const comp = c.veic ? c.veic.replace(/.*\(([^)]*)\).*/, '$1') : c.dur ? c.dur : '';
    return `${c.pax}${comp ? ' · ' + comp : ''} — ${_prEur(c.preco)}`;
  },
  /* um item de orçamento a partir de "tabId|secId|linId" */
  itemOrc(ref, extra) {
    const p = String(ref || '').split('|'); const t = Precos.get(p[0]); if (!t) return null;
    const b = Precos.base(t), f = Precos.fator(t);
    const s = (b.secoes || []).find(x => x.id === p[1]), l = s && s.linhas.find(x => x.id === p[2]); if (!l) return null;
    const c = Precos.calc(b.tipo, l, f);
    return Object.assign({ desc: Precos.descLinha(t, s, c), pax: c.paxN, valor: c.preco, custo: c.custo, sinal: c.sinal,
      obs: b.tipo === 'guia' && c.ingressos ? `ingressos à parte: ${_prEur(c.ingressos)}/pessoa` : '', precoRef: ref }, extra || {});
  },

  /* ---------- pro ASSISTENTE ler a tabela ---------- */
  /* o que existe (nomes das tabelas e seções) */
  resumo() {
    return Precos.all().map(t => ({ tabela: t.id, nome: t.nome, tipo: Precos.base(t).tipo, desconto_pct: Precos.descontoPct(t) || undefined, secoes: Precos.secoesView(t).map(s => s.titulo) }));
  },
  /* acha as linhas certas: tabela (transfer | guia | bv), pessoas, e um
     texto pra filtrar seção/veículo/duração ("aeroporto", "civitavecchia", "vaticano", "van", "4 horas") */
  acha(q) {
    q = q || {};
    const n = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const qt = n(q.tabela), qs = n(q.secao), qx = n(q.texto), px = +q.pessoas || 0;
    const out = [];
    for (const t of Precos.all()) {
      if (qt && t.id !== q.tabela && !n(t.nome).includes(qt) && Precos.base(t).tipo !== qt) continue;
      for (const s of Precos.secoesView(t)) {
        if (qs && !n(s.titulo).includes(qs)) continue;
        for (const c of s.linhas) {
          const cabe = !px || c.paxN === px || (px === 1 && c.paxN === 2 && /1 ou 2/i.test(c.pax)) || (/^at[eé]\s/i.test(c.pax) && px <= c.paxN);
          if (!cabe) continue;
          if (qx && !n([s.titulo, c.pax, c.veic, c.dur].join(' ')).includes(qx)) continue;
          out.push({ ref: `${t.id}|${s.id}|${c.ref}`, tabela: t.nome, secao: s.titulo, pessoas: c.pax, veiculo: c.veic || undefined, duracao: c.dur || undefined,
            preco: c.preco, por_pessoa: c.porPessoa, sinal: c.sinal, custo: c.custo, cartao: c.cartao, noturno: c.noturno, noturno_cartao: c.noturnoCartao, ingressos_por_pessoa: c.ingressos || undefined });
        }
      }
    }
    return out;
  },
};
