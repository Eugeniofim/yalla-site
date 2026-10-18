/* =====================================================
   CONTEÚDO DO CLIENTE — o que é da Yalla, não do app

   A camada de operação (operacao.js / operacao-telas.js) nasceu no app da
   EmRoma, com Roma, o Vaticano e o fornecedor de transfer dela escritos no
   código. Tudo o que é de UM cliente mora aqui: as contas, os lugares que
   o leitor de conversa reconhece, as sugestões do "Monte a sua
   experiência", os textos-base de termos e voucher e a demonstração.
   Para outro cliente, troca-se este arquivo (e o config.js) — o resto fica.

   REGRA: nada de política inventada. Onde a regra é DELA (cancelamento,
   espera, multa), o texto é neutro e diz para ela revisar em Ajustes.

   Carrega ANTES de operacao.js.
   ===================================================== */
'use strict';

const CONTEUDO = {
  /* as bandeiras dos dois lados do caixa (os nomes vêm de APP_CONFIG.lados) */
  bandeiras: { brasil: '🇧🇷', europa: '🇦🇪' },

  /* a cidade-base: transfer "daqui" e o resto (outro fornecedor) */
  base: {
    nome: 'Dubai',
    re: /\b(DXB|DWC)\b|dubai|dubái|marina|downtown|jumeirah|deira|bur dubai|palm|business bay/i,
    reFora: /\b(AUH|SHJ|RKT)\b|abu dhabi|abu dabi|sharjah|ras al khaimah|fujairah|al ain|ajman|om[aã]|oman|musandam/i,
  },

  /* Onde ela recebe (reunião de 24/09/2026): uma plataforma no Brasil com
     Pix e cartão em até 12x, que repassa para a conta dela em Dubai.
     "brasil"/"europa" são as chaves internas dos dois lados do caixa;
     o nome que aparece vem de APP_CONFIG.lados. Ela edita em Ajustes. */
  /* pagamento sem conta escolhida: estes métodos caem no lado Brasil (a plataforma) */
  metodosBrasil: ['pix', 'card'],
  contas: [
    { id: 'plat-pix',    nome: 'Plataforma — Pix',              pais: 'brasil', metodo: 'pix' },
    { id: 'plat-cartao', nome: 'Plataforma — cartão (até 12x)', pais: 'brasil', metodo: 'card' },
    { id: 'conta-dubai', nome: 'Conta em Dubai (transferência)', pais: 'europa', metodo: 'transfer' },
    { id: 'dinheiro',    nome: 'Dinheiro (em mãos)',             pais: 'europa', metodo: 'cash' },
  ],

  /* o resto do valor (depois do sinal) é dela, pela plataforma ou pela conta —
     não do guia/motorista em dinheiro no dia (o modelo da EmRoma) */
  restoNoDiaPadrao: false,

  /* o fornecedor de transfer (aba Transfer). Ela põe o nome e o link da
     área de cliente dele em Ajustes; vazio = só a lista pronta para mandar. */
  transfer: {
    fornecedor: { nome: 'Parceiro de transfer', url: '' },
    idioma: 'en',                 /* o pedido pronto para colar vai em inglês */
    servicoPadrao: 'transfer-aeroporto',
  },

  /* ---------- o leitor de conversa colada do WhatsApp ---------- */
  conversa: {
    cidades: [
      ['Dubai', /\bdubai\b|\bdubái\b/], ['Abu Dhabi', /abu dh?abi|abu dabi/], ['Sharjah', /sharjah/],
      ['Ras Al Khaimah', /ras al khaimah/], ['Fujairah', /fujairah/], ['Al Ain', /al ain/],
      ['Omã', /\bom[aã]\b|oman|musandam/], ['Deserto', /deserto|desert|dunas/],
    ],
    servicos: [
      ['transfer', /transfer|traslado|translado|aeroporto|airport|\bdxb\b|\bdwc\b|\bauh\b|motorista|buscar no/],
      ['safari-deserto', /safari|safári|deserto|dunas|quadriciclo|buggy/],
      ['city-tour-dubai', /city ?tour|burj khalifa|dubai mall|souk|creek|frame/],
      ['abu-dhabi-dia', /abu dh?abi|mesquita|sheikh zayed|louvre/],
      ['iate-marina', /iate|yacht|barco|marina/],
    ],
  },

  /* ---------- "Monte a sua experiência" (o questionário do cliente) ---------- */
  roteiro: {
    onde: [
      ['dubai', 'Dubai', 'Dubai', 'Dubái'], ['abudhabi', 'Abu Dhabi', 'Abu Dhabi', 'Abu Dabi'],
      ['sharjah', 'Sharjah', 'Sharjah', 'Sharjah'], ['deserto', 'Deserto', 'Desert', 'Desierto'],
      ['rak', 'Ras Al Khaimah', 'Ras Al Khaimah', 'Ras Al Khaimah'], ['oma', 'Omã (Musandam)', 'Oman (Musandam)', 'Omán (Musandam)'],
    ],
    gosto: [
      ['deserto',     'Deserto e safári',         'Desert & safari',          'Desierto y safari'],
      ['arquitetura', 'Arquitetura e skyline',    'Architecture & skyline',   'Arquitectura y skyline'],
      ['cultura',     'Cultura e história local', 'Culture & local history',  'Cultura e historia local'],
      ['gastronomia', 'Gastronomia',              'Food & dining',            'Gastronomía'],
      ['iate',        'Iate e praia',             'Yacht & beach',            'Yate y playa'],
      ['compras',     'Compras',                  'Shopping',                 'Compras'],
      ['negocios',    'Negócios e networking',    'Business & networking',    'Negocios y networking'],
      ['criancas',    'Programas com crianças',   'Kid-friendly',             'Con niños'],
      ['fotos',       'Lugares para fotos',       'Photo spots',              'Lugares para fotos'],
    ],
    precisa: [
      ['transfer',  'Transfer (aeroporto e hotel)',        'Transfers (airport & hotel)',   'Traslados (aeropuerto y hotel)'],
      ['motorista', 'Carro com motorista',                 'Car with driver',               'Auto con chofer'],
      ['ingressos', 'Ajuda com ingressos e restaurantes',  'Help with tickets & dining',    'Ayuda con entradas y restaurantes'],
      ['hotel',     'Indicação de hotel',                  'Hotel recommendation',          'Recomendación de hotel'],
      ['visto',     'Orientação de visto e chegada',       'Visa & arrival guidance',       'Orientación de visado y llegada'],
      ['evento',    'Evento ou reunião de negócios',       'Event or business meeting',     'Evento o reunión de negocios'],
    ],
    modo: [
      ['guia',        'Com guia particular',                                 'With a private guide',                              'Con guía privado'],
      ['consultoria', 'Sozinho, com roteiro de especialista (consultoria)',  'On my own, with a specialist route (consulting)',   'Por mi cuenta, con ruta de especialista (consultoría)'],
      ['nao-sei',     'Ainda não sei',                                       'Not sure yet',                                      'Aún no lo sé'],
    ],
    /* o que ela ofereceria para quem gosta de cada coisa (passeio fixo) */
    sugestao: { deserto: 'safari-deserto', arquitetura: 'city-tour-dubai', compras: 'city-tour-dubai',
                cultura: 'abu-dhabi-dia', iate: 'iate-marina', fotos: 'city-tour-dubai' },
    /* lugar escolhido → passeio fixo; sem passeio → item livre para ela pôr o valor */
    ondeServico: { abudhabi: 'abu-dhabi-dia', deserto: 'safari-deserto' },
    ondeSemTabela: { sharjah: 'Sharjah', rak: 'Ras Al Khaimah', oma: 'Omã (Musandam)' },
    padrao: 'city-tour-dubai',
    /* gostos que pedem item livre (ela monta) */
    gostoLivre: { negocios: 'Agenda de negócios / visitas técnicas', gastronomia: 'Experiência gastronômica' },
  },

  /* ---------- o Pipeline: o passo a passo de cada cliente ----------
     Pedido dela (01/10/2026): "pipeline com status do andamento com cliente…
     monitora o passo a passo do estágio". As etapas andam SOZINHAS pelo que
     acontece no app (sinal pago, ingressos/transfer/parceiros, guia, o dia). */
  pipeline: [
    ['contato',   'Contato',            'pedido chegou'],
    ['orcamento', 'Orçamento enviado',  'esperando o sinal'],
    ['confirmado','Confirmado',         'sinal pago — falta comprar ou pedir'],
    ['compras',   'Ingressos e transfer', 'tudo comprado — falta o guia'],
    ['guia',      'Guia escalado',      'pronto para o dia'],
    ['viagem',    'Viagem',             'acontecendo'],
    ['posvenda',  'Pós-venda',          'avaliação e indicação'],
    ['perdido',   'Não fechou',         ''],
  ],

  /* ---------- textos-base (ela revisa em Ajustes) ---------- */
  termos: `MODELO — revise e troque pelos seus termos em Ajustes → Termos e condições.

Todos os valores deste orçamento podem mudar sem aviso até a confirmação da reserva.

CONFIRMAÇÃO DA RESERVA
A reserva é confirmada com o pagamento do sinal indicado no orçamento. O sinal bloqueia a agenda e é abatido do total.

PAGAMENTO
Pix ou cartão pela nossa plataforma, ou transferência para a conta em Dubai. O restante segue as datas combinadas no orçamento.

CANCELAMENTO E ALTERAÇÕES
As regras de cancelamento e de mudança de data de cada serviço são as informadas no orçamento.

INGRESSOS, HOTÉIS E TRANSFERS
São comprados com parceiros locais conforme a disponibilidade do momento e, depois de emitidos, seguem a política de cada fornecedor.`,

  voucher: {
    pagamento: `PAGAMENTO
Os valores e as datas de pagamento estão no seu orçamento. Qualquer dúvida, fale com a gente pelo WhatsApp.`,
    suporte: `SUPORTE
Durante a sua viagem, fale com a Yalla Experiences pelo WhatsApp. Salve o nosso número antes de embarcar.

INFORMAÇÕES GERAIS
Leve um documento com foto em todos os passeios.`,
    trocado: `DINHEIRO
Leve alguns dirhams (AED) em espécie para gorjetas e pequenas compras.`,
    transferAeroporto: `TRANSFER DE CHEGADA — AEROPORTO
Ao pousar, ligue o celular e confira o WhatsApp. As instruções de encontro com o motorista estão abaixo.`,
    transferPartida: `TRANSFER DA PARTIDA
Confira o horário de saída do hotel indicado abaixo e esteja pronto na recepção alguns minutos antes.`,
    transferPorto: `TRANSFER DE CHEGADA — PORTO
Ao desembarcar do navio, ligue o celular e confira o WhatsApp. As instruções de encontro estão abaixo.`,
    transferTrem: '',
    passeios: `PASSEIOS
Chegue alguns minutos antes no ponto de encontro. Em mesquitas e locais religiosos, use roupa que cubra ombros e joelhos.`,
    fechamento: `Yalla!
Que a sua viagem seja inesquecível. Estamos à disposição para o que precisar.

Milla
YALLA EXPERIENCES · Travel. Connect. Ascend.
@yalla_experiences`,
  },
  /* para escolher o bloco de transfer do voucher */
  voucherRe: {
    aero: /\b(dxb|dwc|auh|shj)\b|aeroport|airport/i,
    porto: /\bporto\b|port rashid|cruise|navio|cruzeiro/i,
    trem: /(?!)/,          /* sem trem nos Emirados */
  },
  dicas: {
    transfer: 'Ao pousar, ligue o celular e confira o WhatsApp: as instruções de encontro com o motorista chegam por lá.',
    walk: 'Use sapato confortável e leve água. Chegue 10 minutos antes no ponto de encontro.',
    day: 'Esteja pronto na recepção do hotel no horário combinado. Leve documento, água e protetor solar.',
  },
  /* passeio que pede cuidado especial (a regra é de quem recebe, não dela) */
  dicasEspeciais: [
    [/mesquita|mosque|sheikh zayed/i, 'Mesquita: roupa que cubra braços e pernas; para mulheres, também o cabelo. '],
  ],

  /* ---------- a aba "Tabela de preços" (as planilhas dela) ----------
     Exemplos marcados: ela troca pelos valores reais (ou apaga a linha).
     cartao: acréscimo do cartão (0,10 = 10%; 0 = sem coluna de cartão).
     noturnoVeic: adicional noturno por veículo (0 = sem coluna noturna). */
  precos: {
    regras: { cartao: 0, noturnoVeic: 0 },
    tabelas: [
      { id: 'transfer', nome: 'Transfer', tipo: 'transfer' },
      { id: 'guia', nome: 'Guias', tipo: 'guia' },
      { id: 'motorista', nome: 'Passeios com motorista', tipo: 'bv' },
    ],
    seed: {
      transfer: [{ titulo: 'Aeroporto DXB ↔ hotel em Dubai (exemplo)', linhas: [
        { pax: '1 ou 2 pessoas', paxN: 2, veic: '2 malas grandes e 2 de mão (sedan)', veicN: 1, preco: 150, custo: 100 },
        { pax: '3 ou 4 pessoas', paxN: 4, veic: '4 malas grandes e 4 de mão (minivan)', veicN: 1, preco: 200, custo: 140 },
        { pax: '5 a 7 pessoas', paxN: 7, veic: '7 malas grandes e 7 de mão (van)', veicN: 1, preco: 280, custo: 200 },
      ] }],
      guia: [{ titulo: 'City tour Dubai (exemplo)', linhas: [
        { pax: '1 ou 2 pessoas', paxN: 2, dur: '5 horas', preco: 600, custo: 400, ingressos: 0 },
        { pax: '3 ou 4 pessoas', paxN: 4, dur: '5 horas', preco: 800, custo: 500, ingressos: 0 },
      ] }],
      bv: [{ titulo: 'Abu Dhabi com motorista — 10 horas (exemplo)', linhas: [
        { pax: 'Até 3 pessoas', paxN: 3, preco: 1200, custo: 900 },
        { pax: 'Até 6 pessoas', paxN: 6, preco: 1600, custo: 1200 },
      ] }],
    },
  },

  /* ---------- a demonstração (só sem nuvem e com exemplos ligados) ---------- */
  demo: {
    /* pela presença destes nomes o app sabe que os dados ainda são de exemplo */
    marcadores: { equipe: 'op-m1', clientes: ['Mariana Costa', 'Família Rocha'] },
    equipe: [
      ['g1', 'Ahmed Al Mansoori', 'guia', '+971 50 123 4567', ['Dubai', 'Deserto'], 'árabe, inglês'],
      ['g2', 'Carolina Reis', 'guia', '+971 50 222 3344', ['Dubai'], 'português, inglês, espanhol'],
      ['g3', 'Rafael Antunes', 'guia', '+971 50 555 6677', ['Dubai', 'Abu Dhabi'], 'português, inglês'],
      ['g4', 'Beatriz Lopes', 'guia', '+971 50 777 8899', ['Abu Dhabi'], 'português'],
      ['m1', 'Omar (motorista)', 'motorista', '+971 55 100 3001', ['Dubai'], 'árabe, inglês'],
      ['m2', 'Faisal (motorista)', 'motorista', '+971 55 100 3002', ['Dubai', 'Abu Dhabi'], 'inglês'],
    ],
    /* o dia de hoje e os próximos, como numa semana normal dela */
    reservas: [
      { quem: ['Mariana Costa', 'mari.costa@email.com', '+55 11 99876 5501'], tourId: 'transfer-aeroporto', d: 0, time: '14:40', pax: 3,
        voo: 'EK 262 (GRU→DXB)', origem: 'DXB Terminal 3, desembarque', destino: 'Hotel em Downtown Dubai', pres: 'op-m1', sinalPago: 'plat-pix',
        group: [{ nome: 'Pedro Costa', nasc: '1980-04-12' }, { nome: 'Lia Costa', nasc: '2014-09-03' }] },
      { quem: ['Roberto Farias', 'roberto.farias@email.com', '+55 21 98765 4402'], tourId: 'city-tour-dubai', d: 0, time: '09:00', pax: 2,
        pres: 'op-g2', sinalPago: 'plat-cartao', obsOp: 'Casal, primeira vez em Dubai. Ela é vegetariana.',
        group: [{ nome: 'Helena Farias', nasc: '' }] },
      { quem: ['Família Rocha', 'familia.rocha@email.com', '+55 31 99654 3303'], tourId: 'safari-deserto', d: 1, time: '15:00', pax: 4,
        sinalPago: 'plat-pix', obsOp: 'Duas crianças (8 e 11 anos).' },
      { quem: ['Mariana Costa', 'mari.costa@email.com', '+55 11 99876 5501'], tourId: 'abu-dhabi-dia', d: 2, time: '08:00', pax: 3,
        sinalPago: 'plat-pix', pres: 'op-g3' },
      { quem: ['Grupo Inova (empresa)', 'viagens@inova.example.com', '+55 11 3333 4405'], tourId: 'iate-marina', d: 3, time: '17:00', pax: 8,
        pagoTudo: 'conta-dubai', restoPara: 'ingrid', obsOp: 'Empresa: já pagou tudo. A Yalla acerta com o parceiro do barco.' },
    ],
    /* respostas das guias para amanhã de manhã */
    disp: [['op-g1', 'ocupada', 'já tem grupo'], ['op-g3', 'livre', 'até 13h'], ['op-g4', 'livre', '']],
    /* um pedido que chegou de madrugada pelo WhatsApp, esperando por ela */
    conversa: (hoje, addDays) => {
      const d = (iso) => iso.slice(8, 10) + '/' + iso.slice(5, 7);
      const c = `${hoje.slice(8, 10)}/${hoje.slice(5, 7)}/${hoje.slice(2, 4)}`;
      return `[${c} 03:12] Fernanda Lima: Oi Milla! Tudo bem? Vi seu perfil no Instagram 😊
[${c} 03:13] Fernanda Lima: Somos 4 pessoas (2 adultos e 2 crianças), chegamos em Dubai dia ${d(addDays(hoje, 20))} e ficamos até ${d(addDays(hoje, 26))}
[${c} 03:14] Fernanda Lima: Queremos transfer de chegada, um safári no deserto e conhecer a mesquita em Abu Dhabi
[${c} 03:15] Fernanda Lima: Meu WhatsApp é +55 48 99612 7788`;
    },
    pontos: [
      ['hotel', 'No seu hotel', '', 'O motorista busca na recepção do hotel no horário combinado.'],
      ['dxb', 'Aeroporto DXB — Terminal 3, desembarque', 'Dubai International Airport, Terminal 3', 'Depois de pegar as malas, na saída do desembarque.'],
      ['marina', 'Dubai Marina — píer do barco', 'Dubai Marina', 'O ponto exato vai junto do voucher.'],
    ],
    ligacoes: [
      ['transfer-aeroporto', ['dxb', 'hotel'], 'dxb'],
      ['safari-deserto', ['hotel'], 'hotel'], ['city-tour-dubai', ['hotel'], 'hotel'], ['abu-dhabi-dia', ['hotel'], 'hotel'],
      ['iate-marina', ['marina'], 'marina'],
    ],
    interesse: { ids: ['safari-deserto', 'city-tour-dubai', 'abu-dhabi-dia', 'iate-marina', 'transfer-aeroporto', 'privativas', 'imersoes'],
                 peso: [4, 3, 3, 2, 3, 2, 1] },
    parceiros: [
      { nome: 'Agência Horizonte (exemplo)', tipo: 'agencia', contato: '@agenciahorizonte', cupom: 'HORIZONTE', desconto: 0, comissao: 10, obs: 'Agência parceira no Brasil',
        cliente: 'Grupo Inova (empresa)', veioPor: 'agencia' },
      { nome: 'Carol pelo Mundo (exemplo)', tipo: 'influencer', contato: '@carolpelomundo', cupom: 'CAROL10', desconto: 10, comissao: 8,
        cliente: 'Família Rocha', veioPor: 'influencer' },
    ],
    /* os parceiros-fornecedores (aba Parceiros) — exemplos */
    fornecedores: [
      { chave: 'transfer', nome: 'Omar Transfers (exemplo)', tipo: 'transfer', whats: '+971 55 100 3001', comissao: 0, obs: 'Sedan, minivan e van. Pedir até 18h do dia anterior.' },
      { chave: 'ingressos', nome: 'Ingressos Dubai (exemplo)', tipo: 'ingressos', whats: '+971 50 400 1000', comissao: 5, obs: 'Museus, Burj Khalifa, parques.' },
      { chave: 'hotel', nome: 'Hotel parceiro Downtown (exemplo)', tipo: 'hotel', email: 'reservas@hotel.example.com', comissao: 10 },
      { chave: 'barco', nome: 'Marina Yachts (exemplo)', tipo: 'passeio', whats: '+971 52 300 2000', comissao: 0 },
    ],
    pedidosFor: [
      { cliente: 'Mariana Costa', tourId: 'abu-dhabi-dia', fornecedor: 'ingressos', tipo: 'ingressos', desc: 'Louvre Abu Dhabi tickets — 3 guests', custo: 189, status: 'apedir' },
      { cliente: 'Grupo Inova (empresa)', tourId: 'iate-marina', fornecedor: 'barco', tipo: 'passeio', desc: 'Yacht 2h — 8 guests', custo: 900, status: 'confirmado' },
      { cliente: 'Família Rocha', tourId: 'safari-deserto', fornecedor: 'hotel', tipo: 'hotel', desc: '2 nights, family room', custo: 0, status: 'pedido' },
    ],
    indicacoes: { quem: 'Patrícia Menezes', indicou: ['Roberto Farias', 'Mariana Costa'], pais: 'Brasil (São Paulo)' },
    tarefas: (hoje, ctx) => [
      { texto: 'Confirmar com o Omar o transfer da Mariana (voo EK 262)', prazo: hoje, hora: '10:00', cliente: 'Mariana Costa', pessoaId: 'op-m1' },
      { texto: 'Comprar os ingressos de Abu Dhabi para a Mariana (3 pessoas)', prazo: hoje, cliente: 'Mariana Costa' },
      { texto: 'Responder a Patrícia sobre o Réveillon em Dubai', prazo: ctx.addDays(hoje, -1), cliente: 'Patrícia Menezes', clienteKey: 'patricia.menezes@email.com' },
      { texto: 'Pagar o parceiro do barco (Grupo Inova)', prazo: ctx.addDays(hoje, 4), hora: '18:00', cliente: 'Grupo Inova (empresa)' },
      { texto: 'Montar a tabela de preços do safári com o parceiro', detalhe: 'Por número de pessoas, como os outros passeios fixos.' },
      { texto: 'Mandar o extrato do mês para o contador', repete: 'mensal', prazoTexto: 'todo dia 01' },
      { texto: 'Renovar a licença de guia', prazo: ctx.addDays(hoje, -2), feita: true },
      { tipo: 'nota', texto: 'O Omar prefere receber a lista de transfers até as 18h do dia anterior.', fixa: true },
      { tipo: 'nota', texto: 'Ideia: pacote "Dubai em 3 dias" para famílias — deserto, city tour e aquário.' },
    ],
  },
};
