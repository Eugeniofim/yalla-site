/* Identidade deste app: o UNICO lugar que sabe qual banco usar e de quem
   e o app. cloud.js, auth.js, store.js e app.js leem daqui e nao trazem
   nenhum endereco, nome ou marca fixos.

   Vazio em supabaseUrl = o app roda so no aparelho, sem nuvem. E como a
   Milla ve o app antes de existir banco no nome dela.

   Para ligar a nuvem: criar o projeto no Supabase NA CONTA DELA, rodar
   SEGURANCA.sql no editor SQL e preencher os dois campos abaixo. */
var APP_CONFIG = {
  /* 06/10/2026: o app mora no banco da Ti Artes, numa sala so dele (schema "yalla").
     A chave e a publicavel: quem protege os dados e a regra de acesso (RLS) da sala. */
  supabaseUrl: 'https://uopfqlogjzuqpabptxkb.supabase.co',
  supabaseKey: 'sb_publishable_VKIdd2RNpMf3e4IEDprxJw_TOKPIHT2',
  sala: 'yalla',     /* schema do banco; vazio = public (projeto proprio) */

  /* false = demonstração cheia (clientes, reservas, guias e parceiros de
     exemplo) para a Milla ver cada aba funcionando. Na entrega vira true:
     o app começa limpo e só os passeios dela continuam. */
  semExemplos: false,

  /* a moeda do negócio: tudo que é valor aparece nela.
     28/10/2026, pedido dele: "deixar tudo em dólares, somente dólares" (era
     AED; os passeios no ar já estavam todos em USD e ainda não há reserva). */
  moeda: 'USD',

  /* os dois lados do caixa dela: a plataforma no Brasil (Pix e cartão em
     12x) e a conta em Dubai. As chaves internas ficam as mesmas do app-base. */
  lados: { brasil: 'Brasil', europa: 'Emirados' },

  /* Cofre (repositorio guia-cofre, no Supabase do Eugenio): o assistente
     "ao vivo" usa o Claude de verdade por ali, com limite por dia, sem a
     Milla colar chave nenhuma. Na entrega, troca pela chave dela. */
  cofre: 'https://uopfqlogjzuqpabptxkb.supabase.co/functions/v1/cofre',
  clienteCofre: 'yalla',
  /* o assistente vem no pacote dela (orçamento de 01/10/2026): sem selo de "extra" */
  assistenteIncluido: true,
  /* ela contratou o atendimento automático: a aba Atendimento aparece no menu */
  atendimento: true,
  /* enquanto o Instagram DELA não é ligado, o cartão mostra o robô de
     demonstração da Ti Artes, para ela ver funcionando de verdade */
  agenteInstagram: 'estudio_ti_artes',
  agenteWhatsapp: '', /* vazio = botão escondido. Pôr o número quando o chip chegar */

  /* as línguas do lado do cliente (pedido dela: português, inglês, espanhol) */
  linguas: ['pt', 'en', 'es'],

  guia: {
    nome: 'Milla',
    negocio: 'Yalla Experiences',
    cidade: 'Dubai, Emirados Árabes Unidos',
    whats: '+5511951971111',
    insta: 'yalla_experiences',
    email: 'info@yallaexperiences.com',   /* o e-mail profissional dela (GoDaddy), no rodapé do site */
    /* o selo dela, do brand kit oficial: a coroa dourada para fundo escuro
       e a preta para fundo claro. O logo completo vai nos PDFs. */
    logo:       'arte/coroa.png',
    logoEscuro: 'arte/coroa-escura.png',
    logoCompleto: 'arte/logo-yalla.png',
    logoCompletoEscuro: 'arte/logo-yalla-escuro.png',
    /* o logo oficial deitado (22/10/2026): a coroa e o "YALLA EXPERIENCES" recortados
       do logo do kit, numa cor só — dourado no escuro, preto no claro */
    logoHorizontal:       'arte/logo-horizontal.png',
    logoHorizontalEscuro: 'arte/logo-horizontal-escuro.png',
    /* as palavras dela, do material da marca */
    badge: 'Guia brasileira licenciada nos Emirados · Travel. Connect. Ascend.',
    prefixo: 'YE',                 /* codigo da reserva: YE-4821 */
    /* como ela chama cada tipo (a base diz "a pé" e "dia inteiro") */
    tipos: {
      walk: { pt: 'Experiência', en: 'Experience', es: 'Experiencia' },
      day:  { pt: 'Corporativo', en: 'Corporate', es: 'Corporativo' },
    },
    regioes: [
      ['dubai',     'Dubai',         'Dubai'],
      ['abudhabi',  'Abu Dhabi',     'Abu Dhabi'],
      ['sharjah',   'Sharjah',       'Sharjah'],
      /* 28/10/2026, a Milla: "adicionar todos os Emirados" */
      ['ajman',     'Ajman',         'Ajman'],
      ['uaq',       'Umm Al Quwain', 'Umm Al Quwain'],
      ['rak',       'Ras Al Khaimah', 'Ras Al Khaimah'],
      ['fujairah',  'Fujairah',      'Fujairah'],
      ['deserto',   'Deserto',       'Desert'],
      ['oriente',   'Oriente Médio', 'Middle East'],
    ],
  },
};
