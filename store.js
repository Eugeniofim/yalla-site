/* =====================================================
   APP-GUIA — camada de dados
   Persistência: localStorage. A troca para Supabase é
   trocar as funções deste arquivo — as telas não mudam.
   ===================================================== */
'use strict';

/* Chave propria, e nao a 'vi_db_v1' do molde: este app mora no mesmo
   endereco da demonstracao (guia.eugeniofim.com/ingrid/), e o navegador
   guarda os dados por endereco. Com a mesma chave, quem abrisse os dois
   veria os passeios de um dentro do outro. */
const DB_KEY = 'yalla_db_v2';

/* ---------- de onde a pessoa veio (R4, perguntas da Milla de 01/10/2026) ----------
   O robô do WhatsApp/Instagram e a bio mandam o link com ?de=whatsapp,
   ?de=instagram, ?de=tiktok… A primeira página da visita guarda o canal; a
   visita, o "quase reservou", a reserva e o pedido levam o canal junto, e o
   Dashboard mostra a conversão por canal. Sem ?de= = "direto". */
const CANAIS = [['instagram', 'Instagram'], ['whatsapp', 'WhatsApp'], ['tiktok', 'TikTok'], ['youtube', 'YouTube'], ['google', 'Google'], ['site', 'Site'], ['direto', 'Direto / outro']];
function canalAtual() {
  try {
    const q = new URLSearchParams(location.search);
    let c = String(q.get('de') || q.get('utm_source') || '').toLowerCase().trim();
    if (c) { c = c.startsWith('insta') || c === 'ig' ? 'instagram' : c.startsWith('wa') || c.startsWith('whats') ? 'whatsapp' : c.startsWith('tik') ? 'tiktok' : c.startsWith('yt') || c.startsWith('you') ? 'youtube' : c;
             if (!CANAIS.some(x => x[0] === c)) c = 'direto'; sessionStorage.setItem('yalla_canal', c); return c; }
    return sessionStorage.getItem('yalla_canal') || 'direto';
  } catch (e) { return 'direto'; }
}
const canalNome = (c) => (CANAIS.find(x => x[0] === c) || [c, c || 'Direto'])[1];
/* grava o canal já na chegada: o ?de= some quando a pessoa reabre o app */
if (typeof location !== 'undefined' && typeof sessionStorage !== 'undefined') canalAtual();

/* ---------- modelo ----------
Tour       {id, type, region, name:{pt,en}, desc:{pt,en}, meeting, photo,
            price, priceMode:'pp'|'session'|'tabela', tabela:[20 valores], min, max,
            payPolicy:'full'|'split',
            status:'live'|'draft'|'seasonal', order}
Rule       {id, tourId, weekdays:[0-6], time:'16:30', capacity, from:'2026-11-20', until:'2026-12-23'}
Departure  {id, tourId, date:'2026-12-21', time, capacity}  // avulsas; recorrentes são geradas das Rules
Block      {id, from, until, reason}                        // bloqueio global (férias)
Booking    {id, code, tourId, date, time, name, email, whats, insta, pax, total,
            veiculo, malas, sinal,          // so nos transfers (da tabela dela)
            group:[{nome, nasc}],            // quem mais veio, alem de quem reservou
            coupon, discount, policy:'full'|'split'|'sinal',
            adultos, criancas,
            payments:[{amount, date, method, kind:'full'|'deposit'|'balance'}],
            status:'confirmed'|'cancelled', createdAt, origin}
Coupon     {code, pct, until, oncePerPerson, uses:[email]}
------------------------------------------------------ */

/* ---------- quem e o guia ----------
   O config.js da o valor inicial; o guia edita nos Ajustes e o que vale e
   o que esta em DB.settings. Nada disto vem gravado no codigo. */
const GUIA_CFG = (typeof APP_CONFIG !== 'undefined' && APP_CONFIG.guia) || {};
/* Sem banco no config.js o app e uma DEMONSTRACAO: tudo vive no aparelho de
   quem esta olhando e nada sai dali. Meia duzia de telas mudam por causa
   disto, entao a pergunta mora num lugar so. */
function temNuvem() { return !!(typeof APP_CONFIG !== 'undefined' && APP_CONFIG && APP_CONFIG.supabaseUrl); }
const PREFIXO = (GUIA_CFG.prefixo || 'RS').toUpperCase();
function _cfgSettings() { return (typeof DB !== 'undefined' && DB && DB.settings) || {}; }
function guiaNome() { return _cfgSettings().admName || GUIA_CFG.nome || 'Guia'; }
function guiaNegocio() { return _cfgSettings().negocio || GUIA_CFG.negocio || guiaNome(); }
function guiaBase() { return _cfgSettings().base || GUIA_CFG.cidade || ''; }
function regioes() {
  /* O que ela cadastrou no painel vem primeiro. O try e porque DB e "let"
     e pode ainda nao existir quando o arquivo carrega. */
  try {
    const d = DB && DB.settings && DB.settings.regioes;
    if (Array.isArray(d) && d.length) return d;
  } catch (e) {}
  const r = GUIA_CFG.regioes;
  return (r && r.length) ? r : [['cidade', 'Cidade', 'City'], ['arredores', 'Arredores', 'Surroundings']];
}
function regiaoLabel(code) {
  const r = regioes().find(x => x[0] === code);
  if (!r) return code || '';
  return (typeof LANG !== 'undefined' && LANG === 'en') ? r[2] : r[1];
}
function regiaoOpts(cur) {
  const en = typeof LANG !== 'undefined' && LANG === 'en';
  return regioes().map(([v, pt, e]) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${en ? e : pt}</option>`).join('');
}

/* ---------- transfer: pessoas, bagagem e horario ----------

   A tabela dela de 2026 (TABELA VALORES 2026 - Transfer Roma.pdf) cobra por
   TRECHO, nunca por pessoa, e o valor depende de tres coisas:

     1. QUANTAS PESSOAS, de 1 a 20 ("1 ou 2 pessoas" e uma linha so);
     2. para cada quantidade ha DUAS opcoes de veiculo, e quem decide entre
        elas e a BAGAGEM (ex.: 3 pessoas com 2 malas cabem num carro; com 6
        malas precisam de minivan);
     3. a HORA: das 21h as 5h59 vale a coluna "Noturno".

   Cada linha tem tambem o SINAL, que e o que o cliente paga antes para
   garantir. O resto e no dia.

   transfer.linhas = [{ pax, malas, veiculo, dia, noite, sinal }]
   pax 2 = "1 ou 2 pessoas". */
const NOITE_DE = 21, NOITE_ATE = 6;   /* 21:00 as 05:59 = noturno */

function transferNoturno(hora) {
  const h = parseInt(String(hora || '').slice(0, 2), 10);
  if (isNaN(h)) return false;
  return h >= NOITE_DE || h < NOITE_ATE;
}

/* "1 ou 2 pessoas" e a mesma linha na tabela dela */
function transferPax(pax) { return Math.max(2, Math.min(20, +pax || 1)); }

/* as opcoes de veiculo para aquela quantidade, na ordem da tabela */
function transferOpcoes(x, pax) {
  const ls = (x.transfer && Array.isArray(x.transfer.linhas)) ? x.transfer.linhas : [];
  const n = transferPax(pax);
  return ls.filter(l => +l.pax === n);
}

function transferLinha(x, pax, opcao) {
  const ops = transferOpcoes(x, pax);
  return ops[Math.max(0, Math.min(ops.length - 1, +opcao || 0))] || null;
}

function transferPreco(x, pax, opcao, hora) {
  const l = transferLinha(x, pax, opcao);
  if (!l) return 0;
  return +(transferNoturno(hora) ? l.noite : l.dia) || 0;
}

/* o "a partir de": o menor valor diurno da tabela */
function transferMenor(x) {
  const ls = (x.transfer && x.transfer.linhas) || [];
  const v = ls.map(l => +l.dia || 0).filter(v => v > 0);
  return v.length ? Math.min(...v) : 0;
}

/* ate quantas pessoas a tabela responde */
function transferAte(x) {
  const ls = (x.transfer && x.transfer.linhas) || [];
  return ls.reduce((m, l) => Math.max(m, +l.pax || 0), 0);
}

/* ---------- ingressos por idade ----------

   Pedido da Ingrid (18/09/2026): "teria como ja somar o valor de ingressos
   por idade?". Os ingressos nao estao no valor do passeio, e o preco muda com
   a idade — no Vaticano, crianca ate 6 nao paga, jovem ate 18 paga €15 e
   adulto €25. Ela compra os ingressos com antecedencia, entao precisa saber
   o valor certo na hora da reserva.

   x.ingressos = [{ nome:{pt,en}, gratisAte, reduzido, reduzidoAte, inteiro,
                    guia, noDia }]
     gratisAte   = ate esta idade (inclusive) nao paga
     reduzido    = valor reduzido, ate reduzidoAte (inclusive)
     inteiro     = o resto, e todo adulto
     guia        = o ingresso da propria guia, cobrado uma vez (Sao Pedro)
     noDia       = pago no dia, fora do total (os fones do Vaticano)

   Adulto nao informa idade: paga o inteiro. */
function precoIngresso(g, idade) {
  const a = idade === null || idade === undefined ? 99 : +idade;
  const tem = (v) => v !== null && v !== undefined && v !== '';
  if (tem(g.gratisAte) && a <= +g.gratisAte) return 0;
  if (+g.reduzido > 0 && tem(g.reduzidoAte) && a <= +g.reduzidoAte) return +g.reduzido;
  return +g.inteiro || 0;
}

function ingressosDe(x, adultos, idades) {
  const ings = Array.isArray(x.ingressos) ? x.ingressos : [];
  const pessoas = Array(Math.max(0, +adultos || 0)).fill(null)
    .concat((idades || []).map(v => (v === '' || v === null || v === undefined) ? null : +v));
  const linhas = [], noDia = [];
  let total = 0, totalDia = 0;
  for (const g of ings) {
    const porValor = {};
    let soma = 0;
    for (const idade of pessoas) {
      const v = precoIngresso(g, idade);
      soma += v; porValor[v] = (porValor[v] || 0) + 1;
    }
    const guia = +g.guia || 0;
    soma += guia;
    const linha = { nome: g.nome, valor: soma, porValor, guia };
    if (g.noDia) { noDia.push(linha); totalDia += soma; } else { linhas.push(linha); total += soma; }
  }
  return { linhas, total, noDia, totalDia };
}

/* ---------- preco por numero de pessoas ----------

   A Ingrid nao cobra por pessoa nem um valor unico: ela tem uma tabela com
   o valor FECHADO do grupo para cada quantidade, de 1 ate 20. Ela montou
   essa tabela justamente para parar de fazer conta a mao no meio de um dia
   cheio — entao o app so serve para alguma coisa se souber ler a tabela.

   tabela[i] = valor total do grupo com (i+1) pessoas. 0 = "consultar":
   grupo grande, caso raro, ela responde a mao e tudo bem. */
const TABELA_MAX = 20;

function tabelaPreco(x, pax) {
  const tb = Array.isArray(x.tabela) ? x.tabela : [];
  const n = Math.max(1, Math.min(TABELA_MAX, +pax || 1));
  return +tb[n - 1] || 0;
}

/* O menor valor da tabela — e o "a partir de" do cartao da vitrine. */
function tabelaMenor(x) {
  const tb = (Array.isArray(x.tabela) ? x.tabela : []).map(v => +v || 0).filter(v => v > 0);
  return tb.length ? Math.min(...tb) : 0;
}

/* Ate quantas pessoas a tabela responde sozinha. Acima disso o app nao
   inventa preco: manda falar com ela. */
function tabelaAte(x) {
  const tb = Array.isArray(x.tabela) ? x.tabela : [];
  let n = 0;
  for (let i = 0; i < TABELA_MAX; i++) if (+tb[i] > 0) n = i + 1;
  return n;
}

function _blank() {
  return { tours: [], rules: [], departures: [], blocks: [], bookings: [], coupons: [], seatCounts: [],
           /* pedidos de roteiro personalizado (o questionario do cliente) */
           pedidos: [],
           settings: { lang: 'pt', tutorialClient: true, tutorialAdm: true,
           /* quem e o guia — nasce do config.js e o guia edita no painel */
           admName: GUIA_CFG.nome || 'Guia', negocio: GUIA_CFG.negocio || '',
           whats: GUIA_CFG.whats || '', insta: GUIA_CFG.insta || '', placeholderContact: false,
           /* o cliente ve antes de reservar */
           photo: '', badge: GUIA_CFG.badge || '',
           base: GUIA_CFG.cidade || '',
           /* como o cliente paga. Vazio ate ela preencher no ADM — e enquanto
              estiver vazio a tela diz a verdade: ela passa os dados no WhatsApp. */
           /* pixName e pixCity sao exigidos pelo padrao do BR Code:
              sem eles o banco recusa o codigo. */
           pixKey: '', pixName: '', pixCity: '', iban: '', ibanName: '', payNote: '',
           /* Wise: link de pagamento (wise.com/pay/...). Dinheiro no dia: o
              transfer dela e cobrado assim. Vazio/falso = nao aparece. */
           wiseLink: '', dinheiroNoDia: false,
           /* A primeira tela e o "link na bio" dela: redes e os links de
              parceiros que ela ja divulga (hotel, chip, seguro). Ela edita
              tudo no painel, em Aparencia. */
           youtube: '', facebook: '', blog: '',
           links: [],
           /* cidades e regioes da vitrine. Vazio = as do config.js. Ela
              acrescenta uma cidade nova pelo painel, sem nos. */
           regioes: [],
           /* para onde vai o aviso de reserva nova. Vazio = ela ainda nao
              preencheu; quem manda o e-mail e o robo, fora do navegador. */
           admEmail: '',
           /* e-mail PARA O CLIENTE. Nasce desligado de proposito: e-mail
              indo para cliente de verdade so depois que ela ler os textos e
              decidir ligar. */
           avisarClientes: false,
           /* cartao pelo Stripe. Desligado ate a gente provar a cobranca
              de ponta a ponta com dinheiro de verdade. */
           stripeAtivo: false,
           /* A voz dela dentro do e-mail. Vazio = usa o texto padrao.
              Ela NAO edita o e-mail inteiro de proposito: o miolo tem os
              dados da reserva, o Pix e o aviso de que o recibo nao e
              comprovante de pagamento. Apagar esse aviso sem perceber faria
              cliente que nao pagou achar que esta tudo certo. */
           emailReciboIntro: { pt: '', en: '' },
           emailReciboPS:    { pt: '', en: '' },
           emailConfIntro:   { pt: '', en: '' },
           emailConfPS:      { pt: '', en: '' },
           /* margem sobre a cotacao do BCE: cobre o spread de conversao e a
              taxa de quem processa. Sem ela, o euro que chega e menor. */
           /* O guia pediu para tirar a cotacao da tela. A chave antiga
              (mostrarReais) ficou 'true' na nuvem; usar um nome novo desliga
              na hora para todo mundo, sem depender de ela abrir o app. */
           fxMargem: 4, exibirCotacao: false,
           /* a primeira tela: foto de fundo e a frase. Vazio = usa o padrao. */
           homePhoto: '', homeText: { pt: '', en: '' },
           bio: {
             pt: 'Aqui vai a sua apresentação: quem você é, há quanto tempo guia, o que faz o seu passeio ser diferente.\n\nO cliente lê isto antes do preço — quem confia na pessoa aceita melhor o valor.\n\nEdite este texto em Ajustes → Sobre você.',
             en: 'This is where you introduce yourself: who you are, how long you have been guiding, what makes your tour different.\n\nGuests read this before the price — people who trust the person accept the value more easily.\n\nEdit this text in Settings → About you.'
           } } };
}

function _seed() {
  const db = _blank();
  db.demo = true;
  db.seedVer = SEED_VER;

  /* A apresentação dela. Nada aqui foi inventado: sai do perfil e do brand
     kit que ela mandou (24/09/2026). Ela reescreve em Ajustes quando quiser. */
  db.settings.homeText = {
    pt: 'Experiências privativas, imersões de negócios e eventos nos Emirados Árabes Unidos. Cada experiência é única porque cada história também é.',
    en: 'Private experiences, business immersions and events in the United Arab Emirates. Every experience is unique because every story is too.',
    es: 'Experiencias privadas, inmersiones de negocios y eventos en los Emiratos Árabes Unidos. Cada experiencia es única porque cada historia también lo es.',
  };
  db.settings.links = [];
  /* as redes e o vídeo do Linktree dela (linktr.ee/yallaexperiences, 01/10/2026) */
  db.settings.insta2 = 'dubaitourbymilla';
  db.settings.tiktok = 'https://www.tiktok.com/@dubaitourbymilla';
  db.settings.youtube = 'https://www.youtube.com/@dubaitourbymilla';
  db.settings.destaque = { url: 'https://youtube.com/shorts/DY2FT7ia17k',
    titulo: { pt: 'Dubai como você nunca viu', en: 'Dubai like you have never seen it', es: 'Dubái como nunca la viste' },
    sub: { pt: 'Venha viver essa experiência com a Yalla Experiences', en: 'Come live this experience with Yalla Experiences', es: 'Ven a vivir esta experiencia con Yalla Experiences' } };
  /* o destaque FEEDBACK do Instagram dela (vídeos de clientes) */
  db.settings.feedbackIg = 'https://www.instagram.com/stories/highlights/18113434283494470/';
  db.settings.photo = 'arte/milla-rosto.jpg';
  db.settings.homePhoto = '';   /* o fundo é a geometria da marca (marca.css) */
  db.settings.bio = {
    pt: 'Sou Milena Fernandes, a Milla. Moro em Dubai desde 2010 e sou guia brasileira licenciada nos Emirados Árabes Unidos.\n\n'
      + 'A Yalla Experiences nasceu da paixão por conectar culturas, pessoas e oportunidades. Mais do que uma empresa de turismo, desenvolvemos experiências planejadas para apresentar o melhor dos Emirados e do Oriente Médio de forma personalizada, humana e exclusiva.\n\n'
      + 'Ao longo dos anos construí uma rede de parceiros locais e fornecedores selecionados que permite aos nossos clientes viver muito além dos roteiros tradicionais.',
    en: 'I am Milena Fernandes, Milla. I have lived in Dubai since 2010 and I am a Brazilian guide licensed in the United Arab Emirates.\n\n'
      + 'Yalla Experiences was born from a passion for connecting cultures, people and opportunities. More than a tourism company, we design experiences that show the best of the Emirates and the Middle East in a personal, human and exclusive way.\n\n'
      + 'Over the years I have built a network of local partners and selected suppliers that lets our clients go far beyond the usual itineraries.',
    es: 'Soy Milena Fernandes, Milla. Vivo en Dubái desde 2010 y soy guía brasileña con licencia en los Emiratos Árabes Unidos.\n\n'
      + 'Yalla Experiences nació de la pasión por conectar culturas, personas y oportunidades. Más que una empresa de turismo, diseñamos experiencias para mostrar lo mejor de los Emiratos y de Oriente Medio de forma personal, humana y exclusiva.\n\n'
      + 'A lo largo de los años construí una red de socios locales y proveedores seleccionados que permite a nuestros clientes vivir mucho más allá de los itinerarios tradicionales.',
  };

  /* Sob consulta: tabela zerada = o app não inventa preço e manda o pedido
     para o WhatsApp dela (o mesmo caminho do "consulte-nos" da base). */
  const consulta = () => Array(20).fill(0);
  const NOTA_CONSULTA = { pt: 'Sob consulta: cada experiência é montada para você.',
                          en: 'On request: every experience is built around you.',
                          es: 'A consultar: cada experiencia se arma para ti.' };
  db.tours = [
    { id: 'privativas', type: 'walk', region: 'dubai',
      name: { pt: 'Experiências privativas', en: 'Private experiences', es: 'Experiencias privadas' },
      desc: { pt: 'Roteiros personalizados para viajantes individuais, casais, famílias e pequenos grupos que querem conhecer os Emirados de forma autêntica e exclusiva — com guia brasileira licenciada e acesso a lugares que não estão no roteiro comum.',
              en: 'Tailor-made itineraries for solo travellers, couples, families and small groups who want to see the Emirates authentically — with a licensed Brazilian guide and access to places outside the usual route.',
              es: 'Itinerarios a medida para viajeros solos, parejas, familias y grupos pequeños que quieren conocer los Emiratos de forma auténtica y exclusiva, con guía brasileña con licencia y acceso a lugares fuera del recorrido habitual.' },
      meeting: 'No seu hotel em Dubai', duration: 'Sob medida', distance: '', effort: 'easy',
      includes: { pt: ['Guia brasileira licenciada nos Emirados', 'Roteiro montado com você', 'Transporte privativo', 'Acompanhamento antes, durante e depois'],
                  en: ['Licensed Brazilian guide in the UAE', 'Itinerary built with you', 'Private transport', 'Support before, during and after'],
                  es: ['Guía brasileña con licencia en los EAU', 'Itinerario armado contigo', 'Transporte privado', 'Acompañamiento antes, durante y después'] },
      notIncludes: { pt: ['Ingressos e refeições, quando não combinados'], en: ['Tickets and meals, unless agreed'], es: ['Entradas y comidas, salvo acuerdo'] },
      stops: [], photo: 'arte/skyline.jpg',
      price: 0, priceMode: 'tabela', tabela: consulta(), priceNote: NOTA_CONSULTA,
      min: 1, max: 20, payPolicy: 'full', status: 'live', order: 1 },
    { id: 'imersoes', type: 'day', region: 'dubai',
      name: { pt: 'Imersões empresariais', en: 'Business immersions', es: 'Inmersiones empresariales' },
      desc: { pt: 'Programas para empresários, executivos e delegações que querem entender mercados, tendências, inovação e oportunidades no Oriente Médio. Visitas técnicas, agenda de reuniões e leitura cultural de quem vive em Dubai desde 2010.',
              en: 'Programmes for entrepreneurs, executives and delegations who want to understand markets, trends, innovation and opportunities in the Middle East. Technical visits, meeting agenda and cultural guidance from someone living in Dubai since 2010.',
              es: 'Programas para empresarios, ejecutivos y delegaciones que quieren entender mercados, tendencias, innovación y oportunidades en Oriente Medio. Visitas técnicas, agenda de reuniones y lectura cultural de quien vive en Dubái desde 2010.' },
      meeting: 'A combinar, conforme a agenda', duration: 'De 1 a 5 dias', distance: '', effort: 'easy',
      includes: { pt: ['Agenda montada com o seu objetivo', 'Visitas técnicas e reuniões', 'Intérprete de contexto cultural', 'Relatório da imersão'],
                  en: ['Agenda built around your goal', 'Technical visits and meetings', 'Cultural context interpreter', 'Immersion report'],
                  es: ['Agenda armada según tu objetivo', 'Visitas técnicas y reuniones', 'Intérprete de contexto cultural', 'Informe de la inmersión'] },
      notIncludes: { pt: ['Passagens e hospedagem'], en: ['Flights and accommodation'], es: ['Pasajes y alojamiento'] },
      stops: [], photo: 'arte/reuniao.jpg',
      price: 0, priceMode: 'tabela', tabela: consulta(), priceNote: NOTA_CONSULTA,
      min: 1, max: 20, payPolicy: 'full', status: 'live', order: 2 },
    { id: 'eventos', type: 'day', region: 'dubai',
      name: { pt: 'Eventos e lançamentos', en: 'Events and launches', es: 'Eventos y lanzamientos' },
      desc: { pt: 'Planejamento e apoio para eventos corporativos, ativações de marca, lançamentos de produto e experiências VIP nos Emirados — da escolha do lugar aos fornecedores locais de confiança.',
              en: 'Planning and support for corporate events, brand activations, product launches and VIP experiences in the UAE — from choosing the venue to trusted local suppliers.',
              es: 'Planificación y apoyo para eventos corporativos, activaciones de marca, lanzamientos de producto y experiencias VIP en los Emiratos, desde la elección del lugar hasta proveedores locales de confianza.' },
      meeting: 'A combinar', duration: 'Conforme o projeto', distance: '', effort: 'easy',
      includes: { pt: ['Curadoria de local e fornecedores', 'Produção no local', 'Equipe bilíngue', 'Apoio na chegada dos convidados'],
                  en: ['Venue and supplier curation', 'On-site production', 'Bilingual team', 'Guest arrival support'],
                  es: ['Curaduría de lugar y proveedores', 'Producción en el lugar', 'Equipo bilingüe', 'Apoyo en la llegada de los invitados'] },
      notIncludes: { pt: ['Custos de fornecedores e locação'], en: ['Supplier and venue costs'], es: ['Costos de proveedores y alquiler'] },
      stops: [], photo: 'arte/networking.jpg',
      price: 0, priceMode: 'tabela', tabela: consulta(), priceNote: NOTA_CONSULTA,
      min: 1, max: 20, payPolicy: 'full', status: 'live', order: 3 },
    { id: 'personalizadas', type: 'walk', region: 'oriente',
      name: { pt: 'Experiências personalizadas', en: 'Bespoke experiences', es: 'Experiencias personalizadas' },
      desc: { pt: 'Programas sob medida para empresas, grupos, instituições e organizações com necessidades específicas: deserto, iate, arquitetura, cultura ou uma combinação que só existe para você.',
              en: 'Bespoke programmes for companies, groups and institutions with specific needs: desert, yacht, architecture, culture — or a combination that exists only for you.',
              es: 'Programas a medida para empresas, grupos e instituciones con necesidades específicas: desierto, yate, arquitectura, cultura o una combinación que existe solo para ti.' },
      meeting: 'A combinar', duration: 'Sob medida', distance: '', effort: 'easy',
      includes: { pt: ['Projeto desenhado do zero', 'Rede de parceiros locais selecionados', 'Um ponto de contato para tudo'],
                  en: ['Project designed from scratch', 'Selected local partner network', 'One contact for everything'],
                  es: ['Proyecto diseñado desde cero', 'Red de socios locales seleccionados', 'Un solo contacto para todo'] },
      notIncludes: { pt: ['Depende do que for combinado'], en: ['Depends on what is agreed'], es: ['Depende de lo acordado'] },
      stops: [], photo: 'arte/deserto.jpg',
      price: 0, priceMode: 'tabela', tabela: consulta(), priceNote: NOTA_CONSULTA,
      min: 1, max: 20, payPolicy: 'full', status: 'live', order: 4 },
  ];

  /* PASSEIOS FIXOS DE EXEMPLO — em rascunho: o cliente não vê. Servem para
     ela ver o orçamento se montando sozinho com preço e a operação viva.
     Os preços são de exemplo; ela troca pelos dela (ou apaga). */
  const EX = ' (exemplo)';
  db.tours.push(
    { id: 'safari-deserto', type: 'day', region: 'deserto',
      name: { pt: 'Safári no deserto' + EX, en: 'Desert safari' + EX, es: 'Safari en el desierto' + EX },
      desc: { pt: 'Exemplo de passeio fixo: troque pelos dados reais.', en: 'Fixed-tour example: replace with the real details.', es: 'Ejemplo de paseo fijo: cámbialo por los datos reales.' },
      meeting: 'No seu hotel em Dubai', duration: '6 horas', distance: '', effort: 'easy',
      includes: { pt: [], en: [] }, notIncludes: { pt: [], en: [] }, stops: [], photo: 'arte/deserto.jpg',
      price: 350, priceMode: 'pp', min: 1, max: 20, payPolicy: 'split', status: 'draft', order: 10 },
    { id: 'city-tour-dubai', type: 'walk', region: 'dubai',
      name: { pt: 'City tour Dubai' + EX, en: 'Dubai city tour' + EX, es: 'City tour Dubái' + EX },
      desc: { pt: 'Exemplo de passeio fixo: troque pelos dados reais.', en: 'Fixed-tour example: replace with the real details.', es: 'Ejemplo de paseo fijo: cámbialo por los datos reales.' },
      meeting: 'No seu hotel em Dubai', duration: '5 horas', distance: '', effort: 'easy',
      includes: { pt: [], en: [] }, notIncludes: { pt: [], en: [] }, stops: [], photo: 'arte/skyline.jpg',
      price: 300, priceMode: 'pp', min: 1, max: 20, payPolicy: 'split', status: 'draft', order: 11 },
    { id: 'abu-dhabi-dia', type: 'day', region: 'abudhabi',
      name: { pt: 'Abu Dhabi em um dia' + EX, en: 'Abu Dhabi in one day' + EX, es: 'Abu Dabi en un día' + EX },
      desc: { pt: 'Exemplo de passeio fixo com ingresso: troque pelos dados reais.', en: 'Fixed-tour example with a ticket: replace with the real details.', es: 'Ejemplo de paseo fijo con entrada: cámbialo por los datos reales.' },
      meeting: 'No seu hotel em Dubai', duration: '10 horas', distance: '', effort: 'easy',
      includes: { pt: [], en: [] }, notIncludes: { pt: [], en: [] }, stops: [], photo: 'arte/louvre.jpg',
      ingressos: [{ nome: { pt: 'Museu (exemplo)', en: 'Museum (example)' }, gratisAte: 12, reduzido: 0, reduzidoAte: 0, inteiro: 63, guia: 0, noDia: false }],
      price: 450, priceMode: 'pp', min: 1, max: 20, payPolicy: 'split', status: 'draft', order: 12 },
    { id: 'iate-marina', type: 'walk', region: 'dubai',
      name: { pt: 'Iate na Dubai Marina' + EX, en: 'Yacht at Dubai Marina' + EX, es: 'Yate en Dubai Marina' + EX },
      desc: { pt: 'Exemplo de passeio por sessão (valor do barco, não por pessoa).', en: 'Per-session example (price per boat, not per person).', es: 'Ejemplo por sesión (precio por barco, no por persona).' },
      meeting: 'Dubai Marina', duration: '2 horas', distance: '', effort: 'easy',
      includes: { pt: [], en: [] }, notIncludes: { pt: [], en: [] }, stops: [], photo: 'arte/iate.jpg',
      price: 1500, priceMode: 'session', min: 1, max: 12, payPolicy: 'split', status: 'draft', order: 13 },
    { id: 'transfer-aeroporto', type: 'transfer', region: 'dubai',
      name: { pt: 'Transfer aeroporto DXB ↔ hotel' + EX, en: 'DXB airport ↔ hotel transfer' + EX, es: 'Traslado aeropuerto DXB ↔ hotel' + EX },
      desc: { pt: 'Exemplo de transfer por veículo: troque pela tabela real do seu parceiro.', en: 'Per-vehicle transfer example: replace with your partner’s real table.', es: 'Ejemplo de traslado por vehículo: cámbialo por la tabla real de tu socio.' },
      meeting: 'No aeroporto ou no seu hotel', duration: 'Por trecho', distance: '', effort: 'easy',
      includes: { pt: [], en: [] }, notIncludes: { pt: [], en: [] }, stops: [], photo: 'arte/skyline.jpg',
      price: 150, priceMode: 'transfer',
      transfer: { linhas: [
        { pax: 2, veiculo: 'sedan',   malas: '2 malas grandes e 2 de mão', dia: 150, noite: 180, sinal: 50 },
        { pax: 3, veiculo: 'sedan',   malas: '3 malas grandes e 3 de mão', dia: 170, noite: 200, sinal: 60 },
        { pax: 4, veiculo: 'minivan', malas: '4 malas grandes e 4 de mão', dia: 200, noite: 240, sinal: 70 },
        { pax: 5, veiculo: 'van',     malas: '5 malas grandes e 5 de mão', dia: 240, noite: 280, sinal: 80 },
        { pax: 6, veiculo: 'van',     malas: '6 malas grandes e 6 de mão', dia: 260, noite: 300, sinal: 90 },
        { pax: 7, veiculo: 'van',     malas: '7 malas grandes e 7 de mão', dia: 280, noite: 330, sinal: 100 },
      ] },
      min: 1, max: 7, payPolicy: 'sinal', status: 'draft', order: 14 },
  );

  db.rules = [];
  /* Todo passeio no ar tem datas (o pedido sai para o WhatsApp dela). */
  let nRegra = 0;
  for (const x of db.tours) {
    if (db.rules.some(r => r.tourId === x.id)) continue;
    db.rules.push({ id: 'r' + (++nRegra), tourId: x.id, weekdays: [0, 1, 2, 3, 4, 5, 6],
      time: x.type === 'transfer' ? '10:00' : x.type === 'day' ? '08:00' : '09:00',
      capacity: 20, from: isoToday(), until: addDays(isoToday(), 180) });
  }

  db.coupons = [];

  /* ---- clientes e reservas de exemplo (histórico para o Dashboard) ----
     Nomes fictícios. Some quando ela ligar a nuvem / zerar os exemplos. */
  const people = [
    ['Sarah Whitfield',   'sarah.w@example.com',        '+971 50 111 2233',  'sarahw',      'instagram'],
    ['James Carter',      'james.carter@example.com',   '+44 7700 900123',   '',            'site'],
    ['Lucía Gómez',       'lucia.gomez@example.com',    '+34 611 223 344',   'luciagomez',  'instagram'],
    ['Patrícia Menezes',  'patricia.menezes@email.com', '+55 11 98123 4455', 'pat.menezes', 'instagram'],
    ['Rodrigo Tavares',   'rodrigo.tavares@email.com',  '+55 21 99654 1122', '',            'friend'],
    ['Luciana Prado',     'luciana.prado@email.com',    '+55 31 98877 3344', 'lu.prado',    'whatsapp'],
    ['Marcelo Yamada',    'm.yamada@email.com',         '+55 11 97744 2211', '',            'agency'],
  ];
  const plan = [
    /* [pessoa, passeio, dias atrás, pax, quitado?] */
    [3, 'safari-deserto', 44, 2, true], [4, 'city-tour-dubai', 37, 4, true],
    [5, 'abu-dhabi-dia', 30, 2, true],  [6, 'iate-marina', 24, 8, true],
    [0, 'city-tour-dubai', 17, 2, true], [1, 'safari-deserto', 11, 3, true],
    [2, 'abu-dhabi-dia', 6, 2, true],   [3, 'iate-marina', 3, 6, true],
    [4, 'safari-deserto', -6, 4, false], [5, 'city-tour-dubai', -12, 2, false],
  ];
  let n = 0;
  for (const [pi, tourId, back, pax, settled] of plan) {
    const [name, email, whats, insta, origin] = people[pi];
    const x = db.tours.find(z => z.id === tourId);
    const date = addDays(isoToday(), -back);
    const rule = db.rules.find(r => r.tourId === tourId);
    const time = rule ? rule.time : '10:00';
    const total = x.priceMode === 'transfer' ? transferPreco(x, pax, 0, time)
                : x.priceMode === 'tabela' ? tabelaPreco(x, pax)
                : x.priceMode === 'session' ? x.price : x.price * pax;
    const created = addDays(date, -(7 + (n % 9)));
    const payments = [];
    if (x.payPolicy === 'split') {
      payments.push({ amount: Math.round(total / 2), date: created, method: 'pix', kind: 'deposit' });
      if (settled) payments.push({ amount: total - Math.round(total / 2), date: addDays(date, -1), method: 'card', kind: 'balance' });
    } else {
      payments.push({ amount: total, date: created, method: 'card', kind: 'full' });
    }
    db.bookings.push({
      id: 'demo' + (++n), code: PREFIXO + '-' + (2100 + n * 37 % 7800),
      tourId, date, time, name, email, whats, insta, pax, total,
      coupon: null, discount: 0, policy: x.payPolicy, payments,
      consent: { ok: true, at: created + 'T10:00:00.000Z', src: 'checkout' },
      status: 'confirmed', createdAt: created + 'T10:00:00.000Z', origin,
    });
  }
  return typeof traduzSemente === 'function' ? traduzSemente(db) : db;
}

/* apaga tudo — o guia começa do zero */
function clearAll() {
  DB = _blank();
  DB.demo = false;
  save();
}
function restoreDemo() { DB = _seed(); save(); }

/* ---------- migração de ajustes ----------
   Quem já usa o app tem um DB salvo — e a nuvem também. Sem isto,
   todo campo novo que a gente criar nasce vazio para eles e a tela
   quebra em silêncio. Preenche só o que falta; nunca sobrescreve. */
function fillSettings(s) {
  const d = _blank().settings;
  s = s || {};
  for (const k of Object.keys(d)) {
    if (s[k] === undefined || s[k] === null || s[k] === '') s[k] = d[k];
  }
  /* bio é objeto: garante os dois idiomas */
  if (typeof s.bio !== 'object' || !s.bio) s.bio = d.bio;
  else { if (!s.bio.pt) s.bio.pt = d.bio.pt; if (!s.bio.en) s.bio.en = d.bio.en; }
  return s;
}

let DB = null;
/* Versao dos dados de DEMONSTRACAO. Sobe quando o catalogo de exemplo muda.

   Sem isto, quem abriu o link uma vez fica para sempre com os dados daquele
   dia: o navegador guarda a demonstracao e nunca mais olha o catalogo novo.
   Aconteceu em 18/09/2026 — a v1.57 trouxe a tabela de transfer de 2026 e
   os links de parceira, e quem tinha aberto a v1.56 continuava vendo o
   transfer antigo (que nem funcionava mais) e nenhum link.

   So vale para a DEMONSTRACAO e sem nuvem: dados de verdade nunca sao
   trocados por exemplo. Os pedidos de roteiro feitos no aparelho ficam. */
const SEED_VER = 5;   /* 5: ingressos por idade (18/09/2026) */

function load() {
  try { DB = JSON.parse(localStorage.getItem(DB_KEY)) || null; } catch (e) { DB = null; }
  if (DB && DB.demo && !temNuvem() && (+DB.seedVer || 1) < SEED_VER) {
    const pedidos = DB.pedidos || [];
    DB = _seed();
    DB.pedidos = pedidos;
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
  }
  /* O app esta em producao. Aparelho novo (ou navegador limpo) tem que
     comecar VAZIO e receber o que esta na nuvem — nunca publicar um catalogo
     inventado por cima do dela. Antes isto semeava a demonstracao e o save()
     empurrava para a nuvem: bastava ela instalar no celular para os passeios
     reais virarem os ficticios. A demonstracao so volta pelo botao no ADM. */
  if (!DB || !DB.tours) {
    /* Sem nuvem configurada (config.js vazio) o app e um prototipo: nasce com
       os passeios de exemplo, e nao existe nuvem para onde empurra-los.
       Com nuvem, aparelho novo comeca VAZIO e recebe o que esta la. */
    DB = temNuvem() ? _blank() : _seed();
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
  }
  DB.settings = fillSettings(DB.settings);
  return DB;
}
function save() {
  localStorage.setItem(DB_KEY, JSON.stringify(DB));
  if (typeof cloudPushState === 'function') cloudPushState();
  if (typeof itAgendar === 'function') itAgendar();
}
function resetDemo() { DB = _seed(); save(); }

const uid = () => Math.random().toString(36).slice(2, 9);
const bookCode = () => PREFIXO + '-' + Math.floor(1000 + Math.random() * 9000);

/* ---------- passeios ---------- */
const Tours = {
  all()      { return [...DB.tours].sort((a, b) => a.order - b.order); },
  live()     { return Tours.all().filter(t => t.status !== 'draft'); },
  get(id)    { return DB.tours.find(t => t.id === id); },
  create(t)  { t.id = uid(); t.order = DB.tours.length + 1; DB.tours.push(t); save(); return t; },
  update(id, patch) { Object.assign(Tours.get(id), patch); save(); },
  duplicate(id) {
    const src = Tours.get(id); if (!src) return null;
    const cp = JSON.parse(JSON.stringify(src));
    cp.id = uid(); cp.order = DB.tours.length + 1; cp.status = 'draft';
    cp.name = { pt: src.name.pt + ' (cópia)', en: src.name.en + ' (copy)' };
    DB.tours.push(cp); save(); return cp;
  },
  remove(id) {
    DB.tours = DB.tours.filter(t => t.id !== id);
    DB.rules = DB.rules.filter(r => r.tourId !== id);
    DB.departures = DB.departures.filter(d => d.tourId !== id);
    save();
  },
  futureBookings(id) {
    const today = isoToday();
    return DB.bookings.filter(b => b.tourId === id && b.status === 'confirmed' && b.date >= today);
  },
};

/* ---------- calendário ---------- */
function isoToday() { return new Date().toISOString().slice(0, 10); }
function addDays(iso, n) { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); }

const Cal = {
  rulesFor(tourId) { return DB.rules.filter(r => r.tourId === tourId); },
  addRule(r) { r.id = uid(); DB.rules.push(r); save(); return r; },
  removeRule(id) { DB.rules = DB.rules.filter(r => r.id !== id); save(); },
  addDeparture(d) { d.id = uid(); DB.departures.push(d); save(); return d; },
  removeDeparture(id) { DB.departures = DB.departures.filter(d => d.id !== id); save(); },
  addBlock(b) { b.id = uid(); DB.blocks.push(b); save(); return b; },
  removeBlock(id) { DB.blocks = DB.blocks.filter(x => x.id !== id); save(); },
  blocked(date) { return DB.blocks.some(b => date >= b.from && date <= b.until); },

  /* todas as saídas de um passeio num intervalo: regras expandidas + avulsas − bloqueios */
  departures(tourId, fromIso, toIso) {
    const out = [];
    for (const r of Cal.rulesFor(tourId)) {
      let d = fromIso < r.from ? r.from : fromIso;
      const end = toIso < r.until ? toIso : r.until;
      while (d <= end) {
        const wd = new Date(d + 'T12:00:00').getDay();
        if (r.weekdays.includes(wd) && !Cal.blocked(d)) {
          out.push({ tourId, date: d, time: r.time, capacity: r.capacity, ruleId: r.id });
        }
        d = addDays(d, 1);
      }
    }
    for (const dep of DB.departures.filter(x => x.tourId === tourId)) {
      if (dep.date >= fromIso && dep.date <= toIso && !Cal.blocked(dep.date)) out.push(dep);
    }
    out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    return out;
  },

  seatsLeft(tourId, date, time, capacity) {
    /* logada: conta pelas reservas. Visitante: usa a contagem pública,
       que não expõe nome nem telefone de ninguém. */
    const local = DB.bookings
      .filter(b => b.tourId === tourId && b.date === date && b.time === time && b.status === 'confirmed')
      .reduce((s, b) => s + b.pax, 0);
    let taken = local;
    if (Array.isArray(DB.seatCounts) && DB.seatCounts.length) {
      const row = DB.seatCounts.find(c => c.tourId === tourId && c.date === date && c.time === time);
      taken = Math.max(local, row ? row.pax : 0);
    }
    return Math.max(0, capacity - taken);
  },
};

/* ---------- cupons ---------- */
const Coupons = {
  all() { return DB.coupons; },
  create(c) { DB.coupons.push(c); save(); },
  remove(code) { DB.coupons = DB.coupons.filter(c => c.code !== code); save(); },
  validate(code, email) {
    const c = DB.coupons.find(x => x.code.toUpperCase() === String(code).toUpperCase());
    if (!c) return { ok: false, reason: 'notfound' };
    if (c.until && isoToday() > c.until) return { ok: false, reason: 'expired' };
    if (c.oncePerPerson && email && c.uses.includes(email)) return { ok: false, reason: 'used' };
    return { ok: true, coupon: c };
  },
  consume(code, email) {
    const c = DB.coupons.find(x => x.code === code);
    if (c && email && !c.uses.includes(email)) { c.uses.push(email); save(); }
  },
};

/* ---------- reservas e pagamentos ---------- */
const Bookings = {
  all() { return [...DB.bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
  get(id) { return DB.bookings.find(b => b.id === id); },
  byCode(code) { return DB.bookings.find(b => b.code === code); },

  create({ tourId, date, time, name, email, whats, insta, pax, coupon, policy, origin, consent, opcao, group, adultos, criancas, idades, veioPor, indicadoPor, nasc, compradorVai }) {
    const tour = Tours.get(tourId);
    /* Tem que ser o MESMO calculo que a tela mostrou. tour.price * pax ignora
       o preco escalonado (195 para as 3 primeiras, 225 depois) e gravava a
       reserva abaixo do que a pessoa acabou de ler. */
    /* O veiculo tem que vir junto: sem ele, uma reserva de minivan as 22h
       era gravada pelo valor do carro diurno. A tela mostrava 130 e o caixa
       guardava 90, e so o extrato no fim do mes acusaria. */
    const pr0 = Bookings.precoDe(tour, tourId, date, time, pax, { opcao });
    const base = pr0.total;
    let discount = 0, couponCode = null;
    if (coupon) {
      const v = Coupons.validate(coupon, email);
      if (v.ok) { discount = Math.round(base * v.coupon.pct) / 100 * 1; discount = Math.round(base * v.coupon.pct / 100); couponCode = v.coupon.code; }
    }
    /* ingressos por idade: somados ao total, porque e ela quem compra */
    const nAdultos = Number.isFinite(+adultos) && adultos !== undefined ? +adultos : pax;
    const ing = ingressosDe(tour, nAdultos, idades || []);
    const total = base - discount + ing.total;
    const b = {
      id: uid(), code: bookCode(), tourId, date, time,
      name, email, whats, insta: insta || '', pax, total,
      coupon: couponCode, discount, policy,
      /* quem vem: adultos e menores de 18. O preco e pelo total; a divisao e
         para ela saber quem e crianca (ingresso, cadeirinha, ritmo). */
      adultos: Number.isFinite(+adultos) && adultos !== undefined ? +adultos : pax,
      criancas: +criancas || 0,
      idades: (idades || []).map(v => (v === '' || v == null) ? null : +v),
      ingressos: ing.total || ing.totalDia ? { linhas: ing.linhas, total: ing.total, noDia: ing.noDia, totalDia: ing.totalDia } : null,
      veiculo: pr0.veiculo || '', malas: pr0.malas || '',
      /* Transfer: o que se paga antes e o SINAL da tabela dela, nao a metade.
         O resto e no dia. */
      sinal: tour && tour.priceMode === 'transfer' ? (pr0.sinal || 0) : 0,
      /* QUEM MAIS VEM NO GRUPO.

         A Ingrid pediu isto em audio: ate hoje ela so registra quem fez a
         reserva, mas muita gente volta depois por indicacao de alguem que
         VEIO JUNTO e nunca falou com ela. Sem os nomes do grupo, essa
         pessoa nao existe na base dela e a indicacao se perde. */
      group: Array.isArray(group) ? group.filter(g => g && g.nome).map(g => ({
        nome: String(g.nome).trim(),
        nasc: String(g.nasc || '').trim(),
        whats: String(g.whats || '').trim(),
      })) : [],
      /* como conheceu (a coluna "veio por" da planilha dela) */
      veioPor: veioPor || '', indicadoPor: String(indicadoPor || '').trim(),
      /* quem compra pode nao ir (reservou para a mae): entao a data de
         nascimento dele so vale para o ingresso se ele for */
      nasc: String(nasc || '').trim(), compradorVai: compradorVai !== false,
      consent: consent ? { ok: true, at: new Date().toISOString(), src: 'checkout' } : { ok: false },
      payments: [], status: 'confirmed',
      createdAt: new Date().toISOString(), origin: origin || 'site',
      /* de que canal a pessoa chegou (link com ?de=instagram, ?de=whatsapp…) */
      canal: (typeof canalAtual === 'function') ? canalAtual() : '',
      /* Em que idioma ele reservou. Sem isto o e-mail de recibo sai em
         portugues para um frances que leu a tela inteira em ingles. */
      lang: (typeof LANG !== 'undefined' && (LANG === 'en' || LANG === 'es')) ? LANG : 'pt',
    };
    /* Aqui havia um pagamento inventado: toda reserva nascia marcada como paga
       no cartao. O painel, o caixa e os relatorios contavam dinheiro que nunca
       entrou. A reserva nasce sem pagamento nenhum — quem registra e o guia,
       quando o dinheiro cai de verdade. E aqui que o Stripe entra um dia. */
    DB.bookings.push(b);
    /* o cadastro de quem reservou e de cada um do grupo (operacao.js) */
    if (typeof cadastroDaReserva === 'function') cadastroDaReserva(b);
    if (couponCode) Coupons.consume(couponCode, email);
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
    if (typeof cloudPushBooking === 'function') cloudPushBooking(b);
    if (couponCode && typeof cloudPushState === 'function') cloudPushState();
    return b;
  },

  /* Reserva fechada fora do app (WhatsApp, Instagram, na rua). O guia
     informa o que combinou e quanto ja recebeu — nada e inventado aqui. */
  /* Ela aperta "avisar cliente" quando o dinheiro caiu de verdade. Isto so
     MARCA a reserva; quem manda o e-mail e o robo, de meia em meia hora.
     O e-mail nao pode sair daqui: mandar exige a chave do Resend, e chave
     dentro do navegador fica publica para qualquer um.

     Nao ha "desmarcar": uma vez que o e-mail saiu, ele saiu. Deixar
     desmarcar so criaria um botao que promete desfazer o que nao volta. */
  confirmarCliente(id) {
    const b = Bookings.get(id);
    if (!b || b.clienteConfirmado) return null;
    b.clienteConfirmado = { em: new Date().toISOString() };
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
    if (typeof cloudUpdateBooking === 'function') cloudUpdateBooking(b);
    return b;
  },

  criarManual({ tourId, date, time, name, whats, email, pax, total, recebido, metodo, veioPor, indicadoPor }) {
    const b = {
      id: uid(), code: bookCode(), tourId, date, time,
      name, email: email || '', whats: whats || '', insta: '',
      pax: +pax || 1, total: Math.max(0, +total || 0),
      coupon: null, discount: 0, policy: 'full',
      consent: { ok: false },
      payments: [], status: 'confirmed',
      createdAt: new Date().toISOString(), origin: 'manual',
      veioPor: veioPor || '', indicadoPor: String(indicadoPor || '').trim(),
    };
    const val = Math.max(0, Math.min(+recebido || 0, b.total));
    if (val > 0) {
      b.payments.push({ amount: val, date: isoToday(), method: metodo || 'other',
                        kind: val >= b.total ? 'full' : 'deposit' });
    }
    DB.bookings.push(b);
    if (typeof cadastroDaReserva === 'function') cadastroDaReserva(b);
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
    if (typeof cloudPushBooking === 'function') cloudPushBooking(b);
    return b;
  },

  paid(b)   { return b.payments.reduce((s, p) => s + p.amount, 0); },
  /* ---------- preco escalonado ----------
     O guia vende as primeiras vagas de cada data mais barato: 195 para
     os 3 primeiros, 225 depois. O calculo e por DATA, nao por reserva —
     quem chega quando ja ha 2 vendidos leva 1 barato e o resto caro. */
  precoDe(x, tourId, date, time, pax, opt) {
    const cheio = +x.price || 0;
    const tarde = +x.priceLate || 0;
    const vagasBaratas = +x.earlySeats || 0;
    if (x.priceMode === 'transfer') {
      const opcao = (opt && opt.opcao) || 0;
      const l = transferLinha(x, pax, opcao);
      const v = transferPreco(x, pax, opcao, time);
      return { total: v, linhas: [{ qtd: 1, valor: v, fechado: true }],
               veiculo: l ? l.veiculo : '', malas: l ? l.malas : '', sinal: l ? +l.sinal || 0 : 0,
               noturno: transferNoturno(time), consultar: v === 0 };
    }
    if (x.priceMode === 'tabela') {
      const v = tabelaPreco(x, pax);
      return { total: v, linhas: [{ qtd: pax, valor: v, fechado: true }], consultar: v === 0 };
    }
    if (x.priceMode === 'session') return { total: cheio, linhas: [{ qtd: 1, valor: cheio }] };
    if (!tarde || !vagasBaratas) return { total: cheio * pax, linhas: [{ qtd: pax, valor: cheio }] };

    const jaVendidos = Bookings.vendidosEm(tourId, date, time);
    const baratas = Math.max(0, Math.min(pax, vagasBaratas - jaVendidos));
    const caras = pax - baratas;
    const linhas = [];
    if (baratas) linhas.push({ qtd: baratas, valor: cheio });
    if (caras)   linhas.push({ qtd: caras,   valor: tarde });
    return { total: baratas * cheio + caras * tarde, linhas, baratasRestantes: Math.max(0, vagasBaratas - jaVendidos) };
  },

  /* lugares ja vendidos numa saida — base do preco escalonado e das vagas */
  vendidosEm(tourId, date, time) {
    const local = DB.bookings
      .filter(b => b.tourId === tourId && b.date === date && b.time === time && b.status !== 'cancelled')
      .reduce((s, b) => s + b.pax, 0);
    let n = local;
    if (Array.isArray(DB.seatCounts) && DB.seatCounts.length) {
      const row = DB.seatCounts.find(c => c.tourId === tourId && c.date === date && c.time === time);
      if (row) n = Math.max(local, +row.pax);
    }
    return n;
  },
  due(b)    { return Math.max(0, b.total - Bookings.paid(b)); },
  /* Cada passeio tem seu prazo. O de Natal cobra o saldo 30 dias antes,
     nao na vespera — usar um numero fixo aqui cobraria tarde demais. */
  dueDate(b){
    /* transfer: o sinal garante, o resto e no dia */
    if (b.policy === 'sinal') return b.date;
    const x = Tours.get(b.tourId);
    const dias = (x && +x.balanceDays) || 1;
    return addDays(b.date, -dias);
  },
  payBalance(id, method) {
    const b = Bookings.get(id); if (!b) return;
    const due = Bookings.due(b); if (due <= 0) return;
    b.payments.push({ amount: due, date: isoToday(), method: method || 'card', kind: 'balance' });
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
    if (typeof cloudUpdateBooking === 'function') cloudUpdateBooking(b);
  },
  cancel(id) { const b = Bookings.get(id); if (b) { b.status = 'cancelled';
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
    if (typeof cloudUpdateBooking === 'function') cloudUpdateBooking(b); } },

  /* extrato: uma linha por PAGAMENTO (é o que o contador quer) */
  statement(fromIso, toIso) {
    const rows = [];
    for (const b of DB.bookings) {
      for (const p of b.payments) {
        if (p.date >= fromIso && p.date <= toIso) {
          rows.push({ date: p.date, client: b.name, tourId: b.tourId,
                      kind: p.kind, method: p.method, amount: p.amount, code: b.code, conta: p.conta || '' });
        }
      }
    }
    rows.sort((a, b) => a.date.localeCompare(b.date));
    return rows;
  },
};

load();

/* ---------- pedidos de roteiro personalizado ----------
   O que o cliente respondeu em "Monte seu roteiro". A entrega de verdade e
   pelo WhatsApp dela (a mensagem sai pronta); isto aqui e a memoria, para
   ela ver no painel quem pediu, quando, e se ja respondeu.

   Com a nuvem ligada, o pedido de um cliente vive no aparelho DELE ate
   existir uma tabela propria no Supabase — anotado na entrega. */
const Roteiros = {
  all() { return [...(DB.pedidos || [])].sort((a, b) => (b.criado || '').localeCompare(a.criado || '')); },
  cria(r) {
    const limpa = (v) => String(v || '').trim();
    const ped = {
      id: uid(), criado: new Date().toISOString(), respondido: false,
      nome: limpa(r.nome), whats: limpa(r.whats), email: limpa(r.email),
      ini: limpa(r.ini), fim: limpa(r.fim),
      adultos: Math.max(1, +r.adultos || 1), criancas: Math.max(0, +r.criancas || 0), idades: limpa(r.idades),
      onde: [...(r.onde || [])], ondeOutro: limpa(r.ondeOutro),
      gosto: [...(r.gosto || [])], precisa: [...(r.precisa || [])], ritmo: r.ritmo || '',
      obs: limpa(r.obs), modo: r.modo || '',
      lang: (typeof LANG !== 'undefined' && (LANG === 'en' || LANG === 'es')) ? LANG : 'pt',
      canal: (typeof canalAtual === 'function') ? canalAtual() : '',
    };
    DB.pedidos = DB.pedidos || [];
    DB.pedidos.push(ped);
    localStorage.setItem(DB_KEY, JSON.stringify(DB));
    /* o cliente no site: o pedido vai para o banco e chega no celular dela */
    if (typeof itPedidoPublico === 'function' && !(typeof isLoggedIn === 'function' && isLoggedIn())) itPedidoPublico('pedidos', ped);
    return ped;
  },
  marca(id, respondido) {
    const p = (DB.pedidos || []).find(x => x.id === id);
    if (!p) return;
    p.respondido = !!respondido;
    save();
  },
};

/* ---------- clientes (derivados das reservas) ---------- */
const Clients = {
  all() {
    const map = new Map();
    for (const b of DB.bookings) {
      if (b.status === 'cancelled') continue;
      const key = (b.email || b.whats || b.name).toLowerCase();
      const c = map.get(key) || { key, name: b.name, email: b.email, whats: b.whats, insta: b.insta,
                                  tours: 0, spent: 0, last: '', origins: new Set(), consent: false, consentAt: '' };
      c.tours += 1;
      c.spent += Bookings.paid(b);
      if (b.date > c.last) c.last = b.date;
      if (b.origin) c.origins.add(b.origin);
      if (b.consent && b.consent.ok) { c.consent = true; c.consentAt = b.consent.at; }
      if (!c.insta && b.insta) c.insta = b.insta;
      map.set(key, c);

      /* QUEM VEIO JUNTO tambem e cliente.

         A Ingrid explicou o porque: muita gente volta anos depois por
         indicacao de alguem que estava NO GRUPO e nunca falou com ela. Se a
         base so tem quem reservou, essa pessoa chega do nada e a indicacao
         se perde. Aqui ela entra com o nome, a data de nascimento e por
         quem veio.

         Nao tem e-mail nem WhatsApp: a chave e o nome. Homonimo junta os
         dois, e tudo bem — e melhor que nao existir. */
      for (const g of (b.group || [])) {
        /* Trim aqui tambem, e nao so em create(): reserva que chega da nuvem
           nao passa por create, e um nome so com espacos viraria um cliente
           sem nome na base dela. */
        const gnome = String((g && g.nome) || '').trim();
        if (!gnome) continue;
        const gk = 'g:' + gnome.toLowerCase();
        const gc = map.get(gk) || { key: gk, name: gnome, email: '', whats: '', insta: '',
                                    nasc: String((g && g.nasc) || '').trim(), veioCom: b.name, acompanhante: true,
                                    tours: 0, spent: 0, last: '', origins: new Set(),
                                    consent: false, consentAt: '' };
        gc.tours += 1;
        if (b.date > gc.last) gc.last = b.date;
        if (!gc.nasc && g.nasc) gc.nasc = String(g.nasc).trim();
        if (b.origin) gc.origins.add(b.origin);
        map.set(gk, gc);
      }
    }
    /* Acompanhante nao gastou nada por si: ordenar so por gasto jogaria todos
       para o fim da lista. Quem gastou vem primeiro; depois, os mais recentes. */
    return [...map.values()].sort((a, b) =>
      (b.spent - a.spent) || (b.last || '').localeCompare(a.last || ''));
  },
};

/* ---------- relatórios ---------- */
const Reports = {
  /* receita por mês do ano corrente */
  byMonth(year) {
    /* "Recebido" tem que ser dinheiro que ja entrou. Sem este corte, um saldo
       agendado para amanha entrava no grafico como recebido hoje — e o total
       do topo (que so conta ate hoje) discordava do grafico na mesma tela. */
    const hoje = isoToday();
    const out = Array(12).fill(0);
    for (const b of DB.bookings) {
      for (const p of b.payments) {
        if (!p.date || p.date > hoje) continue;
        if (p.date.slice(0, 4) === String(year)) out[+p.date.slice(5, 7) - 1] += p.amount;
      }
    }
    return out;
  },
  /* receita das últimas 8 semanas */
  byWeek(weeks = 8) {
    const out = [];
    let end = isoToday();
    for (let i = 0; i < weeks; i++) {
      const start = addDays(end, -6);
      let sum = 0;
      for (const b of DB.bookings) {
        for (const p of b.payments) if (p.date >= start && p.date <= end) sum += p.amount;
      }
      out.unshift({ label: start.slice(8) + '/' + start.slice(5, 7), value: sum });
      end = addDays(start, -1);
    }
    return out;
  },
  /* desempenho por passeio no intervalo */
  byTour(fromIso, toIso) {
    return Tours.all().map(x => {
      const bs = DB.bookings.filter(b => b.tourId === x.id && b.status !== 'cancelled'
                                    && b.date >= fromIso && b.date <= toIso);
      const deps = new Set(bs.map(b => b.date + b.time));
      const pax = bs.reduce((s, b) => s + b.pax, 0);
      const revenue = bs.reduce((s, b) => s + Bookings.paid(b), 0);
      const seats = deps.size * (x.max || 1);
      return { tour: x, departures: deps.size, pax, revenue,
               occupancy: seats ? Math.round(pax / seats * 100) : 0 };
    }).filter(r => r.departures > 0 || r.revenue > 0);
  },
  /* de onde vieram as reservas */
  byOrigin(fromIso, toIso) {
    const map = {};
    let total = 0;
    for (const b of DB.bookings) {
      if (b.status === 'cancelled' || b.date < fromIso || b.date > toIso) continue;
      const o = b.origin || 'site';
      map[o] = (map[o] || 0) + 1; total++;
    }
    return Object.entries(map)
      .map(([k, n]) => ({ origin: k, n, pct: total ? Math.round(n / total * 100) : 0 }))
      .sort((a, b) => b.n - a.n);
  },
  totals(fromIso, toIso) {
    const bs = DB.bookings.filter(b => b.status !== 'cancelled' && b.date >= fromIso && b.date <= toIso);
    const revenue = DB.bookings.reduce((s, b) =>
      s + b.payments.filter(p => p.date >= fromIso && p.date <= toIso).reduce((t, p) => t + p.amount, 0), 0);
    const pax = bs.reduce((s, b) => s + b.pax, 0);
    const deps = new Set(bs.map(b => b.tourId + b.date + b.time)).size;
    const due = bs.reduce((s, b) => s + Bookings.due(b), 0);
    return { revenue, pax, deps, bookings: bs.length, due,
             ticket: bs.length ? Math.round(revenue / pax || 0) : 0 };
  },
};
