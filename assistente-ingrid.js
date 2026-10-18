/* =====================================================
   ASSISTENTE DA OPERAÇÃO (nasceu no app da EmRoma)

   O motor e o do app-guia (assistente.js, arquivo fechado, igual ao da
   raiz e da Yalla): gaveta, loop com o Claude, cartao "confirma?", gasto,
   modo demonstracao e modo ao vivo pelo cofre. Aqui fica so o que e DELA:

   1. So o assistente. Marketing fica para dezembro (ela pediu) e o
      Atendimento que RESPONDE cliente nao entra: a regra dela e que a IA
      nunca responde sozinha.
   2. Uma ferramenta para cada aba nova (regra do Eugenio: o assistente mexe
      em todo o app): Hoje, Guias, Sob consulta, Tarefas e anotacoes,
      Contabilidade, Ficha do cliente, Termos e plantao, tabela de precos.
   3. O prompt com o jeito dela de trabalhar e o mapa "aba -> ferramenta".

   Carrega depois do assistente.js e so reescreve pelas beiradas: se este
   arquivo sair do index.html, o motor volta a ser o do molde.
   ===================================================== */
'use strict';

/* o motor usa isto do molde novo, que este app nao tem */
function locale() { return LANG === 'en' ? 'en-GB' : 'pt-BR'; }
const LANGS = [['pt', 'PT', 'Português'], ['en', 'EN', 'English']];

/* ---------- 1. so o assistente ---------- */
for (const id of ['marketing', 'inbox']) {
  const k = ADM_TABS.findIndex(([x]) => x === id);
  if (k >= 0) ADM_TABS.splice(k, 1);
}
const ING_FORA = new Set(['ver_marketing', 'salvar_posts', 'mudar_post', 'apagar_post', 'salvar_anuncio', 'apagar_anuncio',
  'criar_criativo', 'mudar_criativo', 'apagar_criativo', 'gerar_imagem', 'ver_ensino', 'ensinar_agente',
  /* estas duas voltam abaixo no modelo dela (relatorio pelo Painel, pagamento com a conta) */
  'ver_relatorio', 'registrar_pagamento', 'ver_clientes']);
for (let k = IA_FERRAMENTAS.length - 1; k >= 0; k--) if (ING_FORA.has(IA_FERRAMENTAS[k].name)) IA_FERRAMENTAS.splice(k, 1);

/* ---------- achar as coisas pelo nome — e perguntar quando der dois ---------- */
const ingN = (v) => String(v || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const ingData = (iso) => iso ? dataCurta(iso) : 'sem data';
function ingAchaGuia(q) {
  if (!q) return { erro: 'diga qual guia ou motorista' };
  const g = Equipe.get(q); if (g) return { g };
  const n = ingN(q);
  const l = Equipe.all().filter(p => ingN(p.nome).includes(n) || ingN(p.nome).split(' ')[0] === n.split(' ')[0]);
  if (l.length === 1) return { g: l[0] };
  if (!l.length) return { erro: `não achei "${q}" entre as guias e motoristas — use ver_guias` };
  return { erro: 'mais de uma pessoa com esse nome — pergunte qual', opcoes: l.map(p => ({ guia_id: p.id, nome: p.nome, tipo: p.tipo })) };
}
function ingAchaCliente(q) {
  if (!q) return { erro: 'diga qual cliente' };
  const n = ingN(q), dig = String(q).replace(/\D/g, '');
  /* o cadastro guardado (operacao.js), no formato que as ferramentas usam */
  const todos = Cadastro.all().map(c => ({ key: chaveFicha(c), id: c.id, name: c.nome, email: c.email, whats: c.whats, veioCom: c.grupoDe ? (Cadastro.get(c.grupoDe) || {}).nome : '' }));
  const exato = todos.filter(c => ingN(c.name) === n);
  const l = exato.length ? exato : todos.filter(c => (n && ingN(c.name).includes(n)) || (c.email && ingN(c.email) === n)
    || (dig.length >= 6 && String(c.whats || '').replace(/\D/g, '').endsWith(dig.slice(-8))));
  if (l.length === 1) return { c: l[0] };
  if (!l.length) return { erro: `não achei o cliente "${q}"` };
  return { erro: 'mais de um cliente com esse nome — pergunte qual', opcoes: l.slice(0, 6).map(c => ({ nome: c.name, contato: c.email || c.whats || '', veio_com: c.veioCom || '' })) };
}
function ingAchaReserva(codigo) {
  const b = Bookings.byCode(String(codigo || '').toUpperCase().trim());
  return b ? { b } : { erro: 'reserva não encontrada — use ver_hoje, buscar ou ver_reservas para achar o código' };
}
function ingAchaOrc(q) {
  const s = String(q || '').trim();
  const num = s.replace(/\D/g, '');
  const o = Orc.all().find(x => x.id === s || (num && +x.num.replace(/\D/g, '') === +num));
  if (o) return { o };
  const l = Orc.all().filter(x => ingN(x.cliente.nome).includes(ingN(s)) && x.status !== 'perdido');
  if (l.length === 1) return { o: l[0] };
  if (!l.length) return { erro: 'orçamento não encontrado — use ver_orcamentos' };
  return { erro: 'mais de um orçamento — pergunte qual', opcoes: l.map(x => ({ numero: x.num, cliente: x.cliente.nome, situacao: x.status })) };
}
function ingAchaTarefa(q) {
  const t0 = Tarefas.get(q); if (t0) return { t: t0 };
  const n = ingN(q);
  const l = Tarefas.all().filter(t => !t.feita && t.tipo === 'tarefa' && ingN(t.texto).includes(n));
  if (l.length === 1) return { t: l[0] };
  if (!l.length) return { erro: 'tarefa não encontrada — use ver_tarefas' };
  return { erro: 'mais de uma tarefa parecida — pergunte qual', opcoes: l.map(t => ({ tarefa_id: t.id, texto: t.texto, dia: t.prazo })) };
}
function ingServ(b) {
  const x = Tours.get(b.tourId), nd = Op.noDia(b), p = b.prestadorId && Equipe.get(b.prestadorId);
  return { codigo: b.code, dia: b.date, hora: b.time, servico: x ? x.name.pt : '?', cliente: b.name, whats: b.whats || '',
    pessoas: b.pax, grupo: (b.group || []).map(g => g.nome), voo: b.voo || '', buscar_em: b.origem || '', levar_para: b.destino || '',
    quem_faz: p ? p.nome : 'ninguém escalado', total: b.total, pago: Bookings.paid(b),
    paga_no_dia: nd.valor ? `${eur(nd.valor)} ${nd.para === 'prestador' ? 'para quem faz o serviço' : 'para ' + guiaNome()}` : 'nada',
    obs: b.obsOp || '', situacao: b.status === 'cancelled' ? 'cancelada' : 'confirmada' };
}
const ING_ABAS = ['today', 'planilha', 'pipeline', 'consulta', 'tarefas', 'guias', 'parceiros', 'transfer', 'agenda', 'bookings', 'clients', 'money', 'tours', 'precos', 'voucher', 'reports', 'coupons', 'look', 'settings'];
const ING_TURNOS = ['manha', 'tarde', 'noite', 'dia'];

/* ---------- 2. as ferramentas das abas dela ---------- */
const contasIds = () => [...Contas.all().map(c => c.id), CONTA_PRESTADOR];
const ING_FERRAMENTAS = [
  /* ler */
  { name: 'ver_hoje', description: 'Os serviços de um dia (padrão: hoje) como na aba Hoje: cliente, voo, de onde para onde, quem faz, quanto o cliente paga no dia e para quem, observação.', input_schema: obj({ data: S_('AAAA-MM-DD') }) },
  { name: 'buscar', description: 'Emergência: acha serviço por pedaço do nome do cliente, do grupo, voo, código ou telefone.', input_schema: obj({ texto: S_() }, ['texto']) },
  { name: 'ver_guias', description: 'Guias e motoristas na ordem de preferência dela: id, nome, tipo, cidades, idiomas, WhatsApp, observação.', input_schema: obj({ tipo: { type: 'string', enum: ['guia', 'motorista'] }, cidade: S_() }) },
  { name: 'quem_esta_livre', description: 'Quem está livre num dia e turno, por preferência: livres (confirmaram), sem resposta, ocupadas (com o quê).', input_schema: obj({ data: S_('AAAA-MM-DD'), turno: { type: 'string', enum: ING_TURNOS }, cidade: S_(), tipo: { type: 'string', enum: ['guia', 'motorista'] } }, ['data', 'turno']) },
  { name: 'ver_orcamentos', description: 'Orçamentos sob consulta: número, cliente, situação, itens, total, sinal.', input_schema: obj({ situacao: { type: 'string', enum: ['abertos', 'novo', 'rascunho', 'enviado', 'fechado', 'perdido', 'todos'] } }) },
  { name: 'ver_tarefas', description: 'Tarefas abertas (atrasadas, hoje, semana, depois, sem data), os lembretes do app e os clientes que devem.', input_schema: obj() },
  { name: 'ver_anotacoes', description: 'Anotações (inclui os resumos do WhatsApp). Com busca opcional.', input_schema: obj({ busca: S_() }) },
  { name: 'ver_contabilidade', description: 'Recebimentos do período por conta, separados nos dois lados do caixa (' + ladoNome('brasil') + ' e ' + ladoNome('europa') + '), o que as guias receberam direto, e o acerto com cada guia/motorista.', input_schema: obj({ de: S_(), ate: S_() }) },
  { name: 'ver_ficha', description: 'Ficha completa de um cliente: contato, serviços, pagamentos, quem veio junto, anotações, tarefas e orçamentos.', input_schema: obj({ cliente: S_('nome, e-mail ou WhatsApp') }, ['cliente']) },
  { name: 'ver_relatorio', description: 'Os números do período (semana, mês, 90 dias, ano): o que entrou, vendido, serviços, ticket, margem, a receber, orçamentos, o que já está vendido para as próximas semanas, serviço que mais rende, turno mais cheio, antecedência.', input_schema: obj({ periodo: { type: 'string', enum: ['semana', 'mes', '90', 'ano'] } }) },
  { name: 'ver_contas', description: 'As contas onde ela recebe (id, nome, ' + ladoNome('brasil') + ' ou ' + ladoNome('europa') + ').', input_schema: obj() },
  { name: 'ver_backup', description: 'Quando foi o último backup, onde (pasta do computador/Google Drive ou baixado) e se o de hoje já foi feito.', input_schema: obj() },
  { name: 'ver_clientes', description: 'Clientes cadastrados: veio por, indicado por, passeios, quanto pagou, quanto deve, próximo serviço. Filtro opcional.', input_schema: obj({ filtro: { type: 'string', enum: ['todos', 'compraram', 'vieram_junto', 'com_servico', 'devem', 'voltaram', 'aniversario_mes'] }, veio_por: S_() }) },
  { name: 'ver_crm', description: 'A PLANILHA dela (aba Planilha / CRM), com TODAS as colunas: data do pagamento, veio por, agência/indicação/influencer, WhatsApp, nome, data serviço, hora, PAX, serviço, obs, cliente paga, custo (ela paga), cidade, parceiro, total, sinal, forma de pagamento, em real, comissões, status, motivo da perda, repescagens e resultados, nome do arquivo e links. Filtre por etapa, cliente ou mês.', input_schema: obj({ etapa: { type: 'string', enum: ['aberto', 'confirmado', 'avaliar', 'finalizado', 'perdido', 'todos'] }, cliente: S_('nome, WhatsApp ou agência'), mes: S_('AAAA-MM do serviço') }) },
  { name: 'ver_painel', description: 'O painel do CRM: em aberto, confirmados, falta receber, taxa de fechamento, motivo que mais perde, comissões a pagar e a lista "precisa de você" (repescar, mandar orçamento, cobrar sinal, pedir avaliação).', input_schema: obj({ mes: S_('AAAA-MM (opcional)') }) },
  { name: 'ver_transfers', description: 'Aba Transfer: os transfers de ' + baseNome() + ' de hoje em diante (os que o parceiro de transfer faz), se já foram pedidos lá (e o número deles) e os dados prontos para colar; e, à parte, os de fora de ' + baseNome() + ' (outro fornecedor).', input_schema: obj({ so_falta: { type: 'boolean' } }) },
  { name: 'ver_arquivos', description: 'Arquivos guardados (comprovantes e documentos), por cliente ou todos, e onde estão no Google Drive.', input_schema: obj({ cliente: S_() }) },
  { name: 'ver_avaliacoes', description: 'As avaliações que estão no site (menu ⭐ Avaliações), a média e os links do Google.', input_schema: obj() },
  { name: 'procurar', description: 'Procura uma palavra em TUDO do app: clientes, planilha/reservas, orçamentos, tarefas e anotações, guias e motoristas, parceiros, transfers, arquivos e avaliações. Use quando não souber em que aba está.', input_schema: obj({ texto: S_() }, ['texto']) },
  { name: 'ver_tudo', description: 'Visão geral do app inteiro de uma vez: quantos clientes, reservas, orçamentos, tarefas, guias, parceiros, transfers, arquivos, avaliações; dinheiro do mês; o que está pendente em cada aba.', input_schema: obj() },
  { name: 'ver_parceiros', description: 'Influencers, agências e parceiros com cupom: reservas trazidas, faturado, comissão devida, paga e a pagar.', input_schema: obj() },
  { name: 'ver_fornecedores', description: 'Aba Parceiros: os fornecedores dela (transfer, ingressos, hotel, passeios, restaurantes) com contato e comissão, e TODOS os pedidos feitos a eles por reserva (a pedir, pedido esperando, confirmado), com custo e a mensagem pronta para mandar.', input_schema: obj({ so_pendentes: { type: 'boolean' } }) },
  { name: 'ver_saidas', description: 'Tudo que SAI no período (custo de guia/motorista, pedidos aos parceiros, comissões pagas, despesas avulsas), o total, o líquido do caixa (entrou − saiu) e a margem de cada serviço.', input_schema: obj({ de: S_('AAAA-MM-DD'), ate: S_('AAAA-MM-DD') }) },
  { name: 'ver_passo_a_passo', description: 'O Pipeline passo a passo: cada cliente/viagem em que etapa está (contato, orçamento, confirmado, compras, guia, viagem, pós-venda) e o PRÓXIMO PASSO que falta.', input_schema: obj({ etapa: S_('filtra por etapa (opcional)') }) },
  { name: 'abrir_aba', description: 'Leva ela até uma tela do app (e, se quiser, a um item).', input_schema: obj({ aba: { type: 'string', enum: ING_ABAS }, item: S_('id do orçamento, código da reserva ou chave do cliente (opcional)') }, ['aba']) },
  /* gravar */
  { name: 'anotar_tarefa', description: 'Cria tarefa (com dia e hora se houver; entende "amanhã 9h" no texto). Mandar mensagem/cobrar/orçamento já vêm com o passo seguinte ("aguardar resposta"). Prioridade (alta/media/baixa) e tipo (profissional/pessoal) como na aba Tarefas.', input_schema: obj({ texto: S_(), dia: S_('AAAA-MM-DD'), hora: S_('HH:MM'), cliente: S_(), detalhe: S_(), prioridade: { type: 'string', enum: ['alta', 'media', 'baixa'] }, tipo: { type: 'string', enum: ['profissional', 'pessoal'] } }, ['texto']) },
  { name: 'concluir_tarefa', description: 'Marca tarefa como feita. Em tarefa de espera diga o resultado: respondeu ou nao_respondeu (vira lembrete). Devolve o próximo passo que o app criou.', input_schema: obj({ tarefa: S_('id ou pedaço do texto'), resultado: { type: 'string', enum: ['feito', 'respondeu', 'nao_respondeu'] } }, ['tarefa']) },
  { name: 'anotar', description: 'Guarda uma anotação (ideia, fornecedor, detalhe), ligada a um cliente se houver.', input_schema: obj({ texto: S_(), cliente: S_(), fixar: { type: 'boolean' } }, ['texto']) },
  { name: 'anotar_cliente', description: 'Acrescenta um fato à ficha do cliente (o que vale para sempre: vegana, VIP, alergia, indicação de quem).', input_schema: obj({ cliente: S_(), texto: S_(), etiqueta: S_() }, ['cliente', 'texto']) },
  { name: 'cadastrar_guia', description: 'Cadastra guia ou motorista no fim da lista de preferência.', input_schema: obj({ nome: S_(), tipo: { type: 'string', enum: ['guia', 'motorista'] }, whats: S_(), cidades: S_('separadas por vírgula'), idiomas: S_(), obs: S_() }, ['nome', 'tipo']) },
  { name: 'mudar_guia', description: 'Muda dados de uma guia/motorista ou a posição na preferência.', input_schema: obj({ guia: S_('id ou nome'), nome: S_(), whats: S_(), cidades: S_(), idiomas: S_(), obs: S_(), preferencia: { type: 'string', enum: ['subir', 'descer', 'primeira'] } }, ['guia']) },
  { name: 'remover_guia', description: 'Tira uma guia/motorista do cadastro.', input_schema: obj({ guia: S_() }, ['guia']) },
  { name: 'marcar_disponibilidade', description: 'Registra o que a guia respondeu: livre, ocupada ou limpar, num dia e turno (dia = o dia inteiro).', input_schema: obj({ guia: S_(), data: S_('AAAA-MM-DD'), turno: { type: 'string', enum: ING_TURNOS }, estado: { type: 'string', enum: ['livre', 'ocupada', 'limpar'] }, nota: S_('ex.: até 13h') }, ['guia', 'data', 'turno', 'estado']) },
  { name: 'escalar', description: 'Passa um serviço para uma guia/motorista (ou tira, com guia "ninguém").', input_schema: obj({ codigo: S_(), guia: S_() }, ['codigo', 'guia']) },
  { name: 'detalhes_servico', description: 'Voo/trem, onde buscar, para onde levar, observação, quanto ela paga a quem faz (custo) e quem recebe o resto (no_dia = a guia/motorista recebe do cliente; dona = ela recebe e acerta).', input_schema: obj({ codigo: S_(), voo: S_(), buscar_em: S_(), levar_para: S_(), obs: S_(), custo: N_(), resto: { type: 'string', enum: ['no_dia', 'dona'] } }, ['codigo']) },
  { name: 'registrar_pagamento', description: 'Registra dinheiro recebido numa reserva, na conta certa (define o lado do caixa na contabilidade). "prestador" = o cliente pagou na mão da guia/motorista. Sem valor = o que falta. Se ela não disse a conta, PERGUNTE.', input_schema: obj({ codigo: S_(), valor: N_(), conta: S_('id de ver_contas ou "prestador"'), anexo: S_('ref do comprovante que ela mandou no chat (anexo1…): fica na ficha e na pasta do cliente no Google Drive') }, ['codigo', 'conta']) },
  { name: 'arquivar', description: 'Guarda um arquivo que ela mandou no chat (anexo1…) na ficha do cliente e na pastinha dele no Google Drive (' + guiaNegocio() + ' › Clientes › nome). Para comprovante de pagamento use registrar_pagamento com anexo — ele já arquiva.', input_schema: obj({ anexo: S_('anexo1, anexo2…'), cliente: S_('nome, código da reserva ou WhatsApp'), descricao: S_('o que é: passaporte, voucher do hotel, bilhete de trem…') }, ['anexo', 'cliente']) },
  { name: 'criar_orcamento', description: 'Cria orçamento sob consulta com vários serviços. Para transfer, guia ou bate-e-volta use preco_ref (de ver_precos): valor, SINAL e custo entram certos da Tabela de preços. passeio_id (de ver_passeios) para o catálogo de passeios. Para MUDAR um orçamento que já existe use editar_orcamento — não crie outro.', input_schema: obj({ cliente: S_(), whats: S_(), email: S_(), pessoas_nota: S_('ex.: 2 adultos + 1 bebê (bebê conta como pessoa)'), bagagem: S_('ex.: 2 malas 23kg + 1 de bordo + carrinho de bebê'), itens: { type: 'array', items: obj({ preco_ref: S_('ref de ver_precos — traz valor, sinal e custo da tabela'), passeio_id: S_(), descricao: S_(), data: S_('AAAA-MM-DD'), hora: S_(), pessoas: { type: 'integer' }, valor: N_() }) }, sinal_pct: N_(), obs: S_() }, ['cliente']) },
  { name: 'ler_conversa', description: 'Lê uma conversa colada do WhatsApp/Instagram/e-mail e monta o rascunho do orçamento + a anotação com o resumo. Nunca responde o cliente.', input_schema: obj({ texto: S_() }, ['texto']) },
  { name: 'mudar_orcamento', description: 'Muda situação, validade ou % de sinal de um orçamento.', input_schema: obj({ numero: S_(), situacao: { type: 'string', enum: ['rascunho', 'enviado', 'perdido'] }, validade: S_(), sinal_pct: N_() }, ['numero']) },
  { name: 'ver_precos', description: 'LÊ a Tabela de preços dela (as abas de preço dela: Transfer, Guias, Passeios com motorista). Acha a linha certa por número de pessoas e serviço e devolve preço, por pessoa, SINAL (= preço − custo), custo, acréscimo de cartão e noturno (se ela cobrar), com um ref para usar em preco_ref. Sem filtro, lista as tabelas e seções.', input_schema: obj({ tabela: { type: 'string', enum: (typeof Precos !== 'undefined' ? Precos.all().map(t => t.id) : ['transfer']) }, pessoas: { type: 'integer', description: 'quantas pessoas (bebê e criança contam)' }, texto: S_('filtra por seção/veículo/duração: aeroporto, hotel, carro, van, 4 horas, 8 horas…') }) },
  { name: 'editar_orcamento', description: 'MUDA um orçamento que já existe (mesmo número): cliente/WhatsApp/e-mail, pessoas_nota, bagagem, obs, e os serviços — adicionar (com preco_ref de ver_precos ou descricao), mudar (data, hora, pessoas, valor, sinal, ou trocar pela linha certa com preco_ref) ou tirar. Use SEMPRE que ela pedir uma alteração: nunca crie um segundo orçamento.', input_schema: obj({ numero: S_('número ou cliente do orçamento'), cliente: S_(), whats: S_(), email: S_(), pessoas_nota: S_(), bagagem: S_(), obs: S_(), itens: { type: 'array', items: obj({ acao: { type: 'string', enum: ['adicionar', 'mudar', 'tirar'] }, item: S_('qual serviço: 1, 2… ou pedaço da descrição (para mudar/tirar)'), preco_ref: S_(), descricao: S_(), data: S_('AAAA-MM-DD'), hora: S_(), pessoas: { type: 'integer' }, valor: N_(), sinal: N_() }, ['acao']) } }, ['numero']) },
  { name: 'fechar_orcamento', description: 'O cliente fechou: cada serviço do catálogo vira reserva com o sinal; registra o sinal na conta se já caiu.', input_schema: obj({ numero: S_(), sinal_recebido: { type: 'boolean' }, conta: S_() }, ['numero', 'sinal_recebido']) },
  { name: 'ajustar_termos', description: 'Termos e condições do orçamento e o número de plantão do voucher.', input_schema: obj({ termos: S_(), plantao: S_() }) },
  { name: 'orcamento_do_roteiro', description: 'Monta o rascunho de orçamento a partir de um pedido do "Monte seu roteiro" (veja pedidos_de_roteiro em ver_orcamentos).', input_schema: obj({ pedido: S_('id ou nome de quem pediu') }, ['pedido']) },
  { name: 'cadastrar_conta', description: 'Acrescenta ou muda uma conta onde ela recebe (define para qual contador vai: ' + ladoNome('brasil') + ' ou ' + ladoNome('europa') + ').', input_schema: obj({ conta: S_('id de ver_contas para mudar; vazio = nova'), nome: S_(), lado: { type: 'string', enum: ['brasil', 'europa'] }, tipo: { type: 'string', enum: ['pix', 'transfer', 'card', 'cash', 'other'] } }, ['nome', 'lado']) },
  { name: 'lembrete_feito', description: 'Marca um lembrete do app (ver_tarefas → lembretes_do_app) como feito, para sumir da lista.', input_schema: obj({ lembrete: S_('pedaço do texto do lembrete') }, ['lembrete']) },
  { name: 'fazer_backup', description: 'Faz o backup de tudo agora: na pasta escolhida (que pode ser a do Google Drive) ou, sem pasta, baixa o arquivo.', input_schema: obj() },
  { name: 'cadastrar_cliente', description: 'Cadastra um cliente novo (quem compra; acompanhante entra pela reserva).', input_schema: obj({ nome: S_(), whats: S_(), email: S_(), nascimento: S_('dd/mm/aaaa'), veio_por: { type: 'string', enum: VEIO_POR.map(v => v[0]) }, indicado_por: S_() }, ['nome']) },
  { name: 'mudar_cliente', description: 'Muda o cadastro: contato, nascimento, país, veio por, indicado por, parceiro, e a viagem (hotel, chegada, partida, bagagem).', input_schema: obj({ cliente: S_(), nome: S_(), whats: S_(), email: S_(), nascimento: S_(), pais: S_(), veio_por: { type: 'string', enum: VEIO_POR.map(v => v[0]) }, indicado_por: S_(), parceiro: S_(), hotel: S_(), chegada: S_(), partida: S_(), bagagem: S_() }, ['cliente']) },
  { name: 'quem_vai', description: 'Registra quem vai num serviço (nome completo e nascimento de cada um — os ingressos são nominais) e se quem comprou também vai.', input_schema: obj({ codigo: S_(), comprador_vai: { type: 'boolean' }, nascimento_comprador: S_(), pessoas: { type: 'array', items: obj({ nome: S_(), nascimento: S_('dd/mm/aaaa') }, ['nome']) } }, ['codigo']) },
  { name: 'ingressos_comprados', description: 'Marca que os ingressos de um serviço já foram comprados (ou desmarca).', input_schema: obj({ codigo: S_(), comprados: { type: 'boolean' } }, ['codigo', 'comprados']) },
  { name: 'link_servico', description: 'Guarda um link no serviço (PDF do ingresso, QR code, voucher do parceiro).', input_schema: obj({ codigo: S_(), nome: S_(), url: S_() }, ['codigo', 'url']) },
  { name: 'marcar_perdido', description: 'Marca um orçamento como perdido, com o motivo.', input_schema: obj({ numero: S_(), motivo: { type: 'string', enum: MOTIVOS_PERDA } }, ['numero', 'motivo']) },
  { name: 'avaliacao_pedida', description: 'Registra que ela já pediu a avaliação ao cliente (o serviço vai para Finalizado). A mensagem ela manda pelo botão do CRM.', input_schema: obj({ codigo: S_() }, ['codigo']) },
  { name: 'cadastrar_parceiro', description: 'Cadastra ou muda um influencer/agência/parceiro com cupom, desconto e comissão.', input_schema: obj({ nome: S_(), tipo: { type: 'string', enum: TIPOS_PARCEIRO.map(t => t[0]) }, contato: S_(), cupom: S_(), desconto: N_(), comissao: N_() }, ['nome']) },
  { name: 'comissao_paga', description: 'Registra comissão paga a um parceiro.', input_schema: obj({ parceiro: S_(), valor: N_() }, ['parceiro', 'valor']) },
  { name: 'cadastrar_fornecedor', description: 'Cadastra ou muda um parceiro fornecedor (transfer, ingressos, hotel, passeio, restaurante): contato e comissão que ele paga a ela.', input_schema: obj({ nome: S_(), tipo: { type: 'string', enum: FORN_TIPOS.map(t => t[0]) }, whats: S_(), email: S_(), site: S_(), comissao: N_('% que o parceiro paga a ela'), obs: S_() }, ['nome']) },
  { name: 'pedir_ao_parceiro', description: 'Registra um pedido a um parceiro para uma reserva (ingresso, transfer, hotel…) com custo, e devolve a mensagem pronta (na língua do parceiro) para ela mandar. Ingresso confirmado marca os ingressos da reserva como comprados.', input_schema: obj({ codigo: S_('código da reserva'), parceiro: S_('nome do fornecedor (de ver_fornecedores) — opcional'), tipo: { type: 'string', enum: FORN_TIPOS.map(t => t[0]) }, descricao: S_('o que foi pedido'), custo: N_('quanto ela paga ao parceiro'), situacao: { type: 'string', enum: PED_FOR_ST.map(x => x[0]) } }, ['codigo']) },
  { name: 'pedido_parceiro', description: 'Muda um pedido já feito a parceiro: situação (pedido, confirmado), número de confirmação, custo.', input_schema: obj({ codigo: S_('código da reserva'), pedido: S_('pedaço da descrição ou do parceiro; vazio = o único da reserva'), situacao: { type: 'string', enum: PED_FOR_ST.map(x => x[0]) }, confirmacao: S_('número/ref. do parceiro'), custo: N_() }, ['codigo']) },
  { name: 'lancar_despesa', description: 'Lança uma despesa avulsa na Contabilidade (licença, anúncio, gasolina, taxa…): entra em "Tudo que sai" e no líquido.', input_schema: obj({ descricao: S_(), valor: N_(), data: S_('AAAA-MM-DD (padrão hoje)'), categoria: { type: 'string', enum: DESP_CAT.map(c => c[0]) }, conta: S_('de qual conta saiu (opcional)') }, ['descricao', 'valor']) },
  { name: 'mudar_tabela', description: 'Muda a tabela de preço por número de pessoas de um passeio (preço do grupo).', input_schema: obj({ passeio_id: S_(), de_pessoas: { type: 'integer' }, ate_pessoas: { type: 'integer' }, valor: N_() }, ['passeio_id', 'de_pessoas', 'valor']) },
];
IA_FERRAMENTAS.push(...ING_FERRAMENTAS);

const ING_LER = {
  ver_precos(i) {
    if (typeof Precos === 'undefined') return E_('a Tabela de preços não carregou');
    const q = { tabela: i.tabela, pessoas: i.pessoas, texto: i.texto };
    if (!q.tabela && !q.pessoas && !q.texto) return { tabelas: Precos.resumo(), dica: 'chame de novo com tabela, pessoas e/ou texto para ver as linhas com valor e sinal' };
    const l = Precos.acha(q);
    if (!l.length) return { nada: 'nenhuma linha com esse filtro', tabelas: Precos.resumo() };
    return { linhas: l.slice(0, 40), total_achado: l.length, como_usar: 'passe o ref em preco_ref (criar_orcamento ou editar_orcamento): valor, sinal e custo entram certos',
      regras: 'sinal = preço − custo (a margem dela)' + (PRECO_CARTAO ? '; cartão = +' + Math.round(PRECO_CARTAO * 100) + '%' : '') + (PRECO_NOTURNO_VEIC ? '; noturno (21h–6h) = +' + eur(PRECO_NOTURNO_VEIC) + ' por veículo' : '') + '; bebê e criança contam como pessoa' };
  },
  ver_hoje(i) {
    const d = isoOk(i.data) ? i.data : hojeIso();
    const l = Op.doDia(d).map(ingServ);
    const tf = Tarefas.doDia(d).filter(t => t.tipo === 'tarefa' && !t.feita).map(t => ({ tarefa_id: t.id, texto: t.texto, hora: t.hora }));
    return { dia: d, servicos: l.length ? l : 'nenhum serviço', tarefas: tf };
  },
  buscar(i) { const l = Op.busca(i.texto).slice(0, 10).map(ingServ); return l.length ? l : 'nada encontrado'; },
  ver_guias(i) {
    const l = Equipe.all(i.tipo).filter(p => Equipe.atende(p, i.cidade)).map((p, k) => ({ preferencia: k + 1, guia_id: p.id, nome: p.nome, tipo: p.tipo,
      cidades: p.cidades, idiomas: p.idiomas, whats: p.whats, obs: p.obs }));
    return l.length ? l : 'ninguém cadastrado';
  },
  quem_esta_livre(i) {
    if (!isoOk(i.data)) return E_('data AAAA-MM-DD');
    const r = Disp.quem({ data: i.data, turno: i.turno || 'manha', cidade: i.cidade || '', tipo: i.tipo || 'guia' });
    const um = (it) => ({ guia_id: it.p.id, nome: it.p.nome, whats: it.p.whats, nota: it.nota || '', com: it.servico ? `${it.servico.name} ${it.servico.time}` : undefined });
    return { dia: i.data, turno: i.turno, livres: r.livres.map(um), sem_resposta: r.semResposta.map(um), ocupadas: r.ocupadas.map(um) };
  },
  ver_orcamentos(i) {
    const st = i.situacao || 'abertos';
    const l = Orc.all().filter(o => st === 'todos' ? true : st === 'abertos' ? ['novo', 'rascunho', 'enviado'].includes(o.status) : o.status === st);
    const rot = (DB.pedidos || []).filter(p => !Orc.all().some(o => o.pedidoId === p.id)).map(p => ({ pedido_id: p.id, nome: p.nome, de: p.ini, ate: p.fim, pessoas: (+p.adultos || 0) + (+p.criancas || 0), onde: p.onde, modo: p.modo || '', respondido: p.respondido }));
    if (!l.length) return { orcamentos: 'nenhum', pedidos_de_roteiro: rot };
    return { pedidos_de_roteiro: rot, orcamentos: l.map(o => ({ numero: o.num, cliente: o.cliente.nome, whats: o.cliente.whats, situacao: o.status, resumo: o.resumo,
      itens: o.itens.map(it => ({ servico: it.desc, data: it.data, pessoas: it.pax, valor: it.valor })), total: Orc.total(o), sinal: Orc.sinal(o), validade: o.validade })) };
  },
  ver_tarefas() {
    const G = Tarefas.grupos(), um = (t) => ({ tarefa_id: t.id, texto: t.texto, dia: t.prazo, hora: t.hora, cliente: t.clienteNome, esperando: t.etapa === 'aguardar' });
    return { atrasadas: G.atrasadas.map(um), hoje: G.hoje.map(um), proximos_7_dias: G.semana.map(um), depois: G.depois.map(um), sem_data: G.semData.map(um),
      lembretes_do_app: Lembretes.lista().map(l => l.txt), clientes_que_devem: Lembretes.devedores().map(d => ({ cliente: d.nome, deve: d.total, ate: d.prazo, atrasado: d.atrasado })) };
  },
  ver_anotacoes(i) { const l = Tarefas.notas(i.busca).map(n => ({ texto: n.texto, detalhe: n.detalhe, cliente: n.clienteNome, dia: String(n.criada).slice(0, 10), fixa: n.fixa })); return l.length ? l : 'nenhuma anotação'; },
  ver_contabilidade(i) {
    const de = isoOk(i.de) ? i.de : hojeIso().slice(0, 8) + '01', ate = isoOk(i.ate) ? i.ate : hojeIso();
    const rs = extratoContas(de, ate), soma = (f) => rs.filter(f).reduce((s, r) => s + r.amount, 0);
    const porConta = {};
    for (const r of rs) { const k = r.conta ? Contas.nome(r.conta) : r.method + ' (sem conta)'; porConta[k] = (porConta[k] || 0) + r.amount; }
    return { periodo: { de, ate }, brasil: soma(r => r.lado === 'brasil'), europa: soma(r => r.lado === 'europa'), direto_com_guias: soma(r => r.lado === 'prestador'),
      por_conta: porConta, acertos: acertos(de, ate).map(a => ({ quem: a.pessoa ? a.pessoa.nome : '?', servico: a.b.name + ' ' + a.b.date, custo: a.custo, saldo: a.saldo, acertado: a.acertado })) };
  },
  ver_ficha(i) {
    const r = ingAchaCliente(i.cliente); if (!r.c) return r;
    const c = r.c, k = c.key, cad = Cadastro.get(c.id), bs = Cadastro.reservas(cad), f = Fichas.get(k), o = Fichas.doCliente(k, c.whats, c.email), R = Cadastro.resumo(cad);
    return { nome: c.name, email: c.email, whats: c.whats, nascimento: cad.nasc, idade: idadeDe(cad.nasc), pais: cad.pais, veio_por: veioPorNome(cad.veioPor), indicado_por: cad.indicadoNome,
      veio_com: c.veioCom || undefined, viagem: cad.viagem || {}, pagou: R.gasto, deve: R.deve, indicou: Cadastro.indicou(cad).map(x => x.nome), trouxe: Cadastro.trouxe(cad).map(x => x.nome),
      etiquetas: f.tags, anotacoes: f.notas,
      servicos: bs.map(b => ({ ...ingServ(b), quem_vai: participantesDe(b).map(p => ({ nome: p.nome, idade: idadeDe(p.nasc, b.date) })), ingressos_comprados: Op.precisaIngresso(b) ? !!b.ingressosOk : 'não precisa', links: (b.links || []).map(l => l.nome + ': ' + l.url) })), tarefas: Tarefas.doCliente(k, c.whats).filter(t => !t.feita).map(t => ({ tarefa_id: t.id, texto: t.texto, dia: t.prazo })),
      orcamentos: o.orcamentos.map(x => ({ numero: x.num, situacao: x.status, total: Orc.total(x) })) };
  },
  ver_relatorio(i) {
    const P = Painel.periodo(i.periodo || 'mes');
    const rec = Painel.recebido(P.de, P.ate), recA = Painel.recebido(P.antDe, P.antAte), ven = Painel.vendido(P.de, P.ate), srv = Painel.servicos(P.de, P.ate);
    const fut = Painel.futuro(8), porS = Painel.porServico(P.de, P.ate), ant = Painel.antecedencia(P.de, P.ate);
    return { periodo: P.nome, de: P.de, ate: P.ate, comparado_com: P.ant, entrou_para_ela: rec.voce, antes: recA.voce, direto_com_guias: rec.prest,
      vendido: ven.valor, reservas_feitas: ven.n, servicos: srv.n, pessoas: srv.pax, margem: Painel.margem(P.de, P.ate), a_receber: Painel.aReceber(),
      orcamentos: Painel.orcamentos(P.de, P.ate), clientes: Painel.clientes(P.de, P.ate),
      vendido_proximas_8_semanas: { total: fut.reduce((s, f) => s + f.total, 0), ja_pago: fut.reduce((s, f) => s + f.pago, 0) },
      servico_que_mais_rende: porS[0] ? { servico: (Tours.get(porS[0].tourId) || { name: { pt: '?' } }).name.pt, valor: porS[0].valor } : null,
      antecedencia_mediana_dias: ant.mediana, origens: Painel.origens(P.de, P.ate) };
  },
  ver_backup() {
    const u = Backup.ultimo();
    return { ultimo: u.em || 'nunca', onde: u.onde === 'pasta' ? 'na pasta ' + u.arquivo : u.onde === 'download' ? 'baixado no computador' : '—', o_de_hoje_ja_foi: Backup.feitoHoje(),
      como_ligar_o_drive: 'Ajustes → Backup automático: instalar o Google Drive para computador e escolher a pasta ' + guiaNegocio() + '' };
  },
  ver_clientes(i) {
    const hoje = hojeIso(), mes = +hoje.slice(5, 7);
    let l = Cadastro.all();
    const f = i.filtro || 'todos';
    if (f === 'compraram') l = l.filter(c => !c.grupoDe); if (f === 'vieram_junto') l = l.filter(c => c.grupoDe);
    if (f === 'com_servico') l = l.filter(c => Cadastro.resumo(c).prox); if (f === 'devem') l = l.filter(c => Cadastro.resumo(c).deve > 0);
    if (f === 'voltaram') l = l.filter(c => DB.bookings.filter(b => b.clienteId === c.id).length > 1); if (f === 'aniversario_mes') l = l.filter(c => aniversarioNoMes(c.nasc, mes));
    if (i.veio_por) l = l.filter(c => c.veioPor === i.veio_por);
    const out = l.slice(0, 80).map(c => { const R = Cadastro.resumo(c); return { nome: c.nome, whats: c.whats, veio_por: veioPorNome(c.veioPor), indicado_por: c.indicadoNome || undefined,
      veio_com: c.grupoDe ? (Cadastro.get(c.grupoDe) || {}).nome : undefined, idade: idadeDe(c.nasc) ?? undefined, passeios: R.reservas, pagou: R.gasto, deve: R.deve, proximo: R.prox ? R.prox.date + ' ' + nomeDoServico(R.prox) : undefined }; });
    return out.length ? { total: l.length, clientes: out } : 'nenhum cliente';
  },
  ver_crm(i) {
    const e = i.etapa || 'todos', q = ingN(i.cliente), dig = String(i.cliente || '').replace(/\D/g, '');
    const todas = crmLinhas().filter(r => e === 'todos' || r.etapa === e)
      .filter(r => !q || [r.nome, r.indicou, r.veio, r.parceiro].some(v => ingN(v).includes(q)) || (dig.length >= 4 && String(r.whats || '').replace(/\D/g, '').includes(dig)))
      .filter(r => !i.mes || String(r.dataServ || '').slice(0, 7) === i.mes);
    const l = todas.slice(0, 150);
    const sem = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== '' && v !== 0 && v != null && !(Array.isArray(v) && !v.length)));
    return l.length ? { linhas: l.map(r => sem({ data_pagamento: r.dataPago ? r.dataPedido : '', data_pedido: r.dataPago ? '' : r.dataPedido, veio_por: r.veio, agencia_indicacao_influencer: r.indicou, whats: r.whats, nome: r.nomePlan || r.nome,
      data_servico: r.dataServ, hora: r.hora, pax: r.pax, servico: r.servico, obs: r.obs, cliente_paga: r.clientePaga, custo_voce_paga: r.ingridPaga, cidade: r.cidade, parceiro: r.parceiro,
      total_pedido: r.totalPedido, sinal: r.sinal, forma_pagamento: r.forma, em_real: r.emReal, comissao_vendor: r.comVendor, comissao_indicacao: r.comIndic, status: crmStatusTxt(r), motivo_perda: r.motivo,
      repescagens: (r.repescagens || []).map(x => `${x.n}ª ${x.data || '?'} → ${x.resultado}`), nome_do_arquivo: r.arquivo, links: (r.links || []).map(x => x.nome + ': ' + x.url),
      numero: r.o ? r.o.num : '', codigo: r.b ? r.b.code : '' })), ...(todas.length > l.length ? { aviso: `mostrando 150 de ${todas.length} — filtre por cliente ou mês` } : {}) } : 'nada com esse filtro';
  },
  ver_painel(i) {
    const P = crmPainel(crmLinhas().filter(r => !i.mes || String(r.dataServ || '').slice(0, 7) === i.mes));
    return { em_aberto: P.abertos, confirmados_a_fazer: P.confirmados, fechamento: { ...P.fecha, taxa: P.fecha.taxa == null ? null : Math.round(P.fecha.taxa * 100) + '%', motivo: P.fecha.motivo ? P.fecha.motivo[0] : null },
      comissoes_a_pagar: P.comissoes, precisa_de_voce: P.agora.map(a => ({ o_que: a.tipo, cliente: a.nome, detalhe: a.txt, numero: a.o ? a.o.num : undefined, codigo: a.r && a.r.b ? a.r.b.code : undefined })) };
  },
  ver_transfers(i) {
    const cfg = nccConfig(), l = transfersDe(hojeIso(), '', 'roma').filter(b => !i.so_falta || !b.ncc), fora = transfersDe(hojeIso(), '', 'fora');
    return l.length || fora.length ? { plataforma: cfg.nome + ' (só transfers de ' + baseNome() + ')', link: cfg.url,
      fora_de_roma_outro_fornecedor: fora.map(b => ({ codigo: b.code, dia: b.date, hora: b.time, cliente: b.name, servico: nomeDoServico(b) })), transfers_de_roma: l.map(b => ({ codigo: b.code, dia: b.date, hora: b.time, cliente: b.name, pax: b.pax, voo: b.voo || undefined, de: b.origem || undefined, para: b.destino || undefined,
      pedido_na_plataforma: b.ncc ? (b.ncc.codigo || 'sim') : 'falta pedir', dados_para_colar: nccTexto(b) })) } : 'nenhum transfer';
  },
  ver_arquivos(i) {
    let l = typeof Arquivos !== 'undefined' ? Arquivos.lista() : [];
    if (i.cliente) { const r = ingAchaCliente(i.cliente); if (!r.c) return r; l = l.filter(a => a.clienteId === r.c.id); }
    return l.length ? l.slice(0, 80).map(a => ({ arquivo: a.nome, tipo: a.tipo, cliente: a.clienteNome, dia: a.criado.slice(0, 10), o_que_e: a.descricao || undefined, google_drive: a.drive || 'ainda na fila (sobe quando a pasta estiver ligada)' })) : 'nenhum arquivo guardado';
  },
  ver_avaliacoes() {
    const l = Avaliacoes.all();
    return { media: Avaliacoes.media(), quantas: l.length, link_para_avaliar: DB.settings.linkAvaliacao || 'não configurado (Ajustes › Avaliações do site)', avaliacoes: l.map(a => ({ nome: a.nome, cidade: a.cidade, estrelas: a.nota, passeio: a.passeio, dia: a.data, texto: a.texto })) };
  },
  procurar(i) {
    const q = ingN(i.texto), dig = String(i.texto || '').replace(/\D/g, ''); if (!q) return E_('procurar o quê?');
    const tem = (...vs) => vs.some(v => ingN(v).includes(q)) || (dig.length >= 4 && vs.some(v => String(v || '').replace(/\D/g, '').includes(dig)));
    const out = {
      clientes: Cadastro.all().filter(c => tem(c.nome, c.whats, c.email, c.indicadoNome, c.pais)).slice(0, 10).map(c => ({ nome: c.nome, whats: c.whats, veio_por: veioPorNome(c.veioPor) })),
      planilha_e_reservas: crmLinhas().filter(r => tem(r.nome, r.whats, r.servico, r.obs, r.cidade, r.indicou, r.parceiro, r.arquivo, r.b && r.b.code, r.o && r.o.num)).slice(0, 15).map(r => ({ nome: r.nome, servico: r.servico, dia: r.dataServ, status: crmStatusTxt(r), codigo: r.b ? r.b.code : undefined, numero: r.o ? r.o.num : undefined })),
      tarefas_e_anotacoes: Tarefas.all().filter(t => tem(t.texto, t.detalhe, t.nota, t.clienteNome)).slice(0, 10).map(t => ({ tarefa_id: t.id, texto: t.texto, dia: t.prazo || undefined, feita: !!t.feita })),
      guias_e_motoristas: Equipe.all().filter(p => tem(p.nome, p.whats, p.obs, (p.cidades || []).join(' '))).map(p => ({ nome: p.nome, tipo: p.tipo, whats: p.whats })),
      parceiros: Parceiros.all().filter(p => tem(p.nome, p.cupom)).map(p => ({ nome: p.nome, tipo: p.tipo, cupom: p.cupom })),
      arquivos: (typeof Arquivos !== 'undefined' ? Arquivos.lista() : []).filter(a => tem(a.nome, a.clienteNome, a.descricao)).slice(0, 10).map(a => ({ arquivo: a.nome, cliente: a.clienteNome, google_drive: a.drive || 'na fila' })),
      avaliacoes: Avaliacoes.all().filter(a => tem(a.nome, a.texto, a.passeio)).map(a => ({ nome: a.nome, estrelas: a.nota })),
      passeios: Tours.all().filter(x => tem(x.name.pt, x.id)).map(x => ({ passeio: x.name.pt, id: x.id, situacao: x.status })),
    };
    for (const k of Object.keys(out)) if (!out[k].length) delete out[k];
    return Object.keys(out).length ? out : `não achei "${i.texto}" em nenhuma aba`;
  },
  ver_tudo() {
    const hoje = hojeIso(), mes = hoje.slice(0, 7), bs = DB.bookings.filter(b => b.status !== 'cancelled');
    const P = crmPainel(crmLinhas()), G = Tarefas.grupos(hoje), tr = transfersDe(hoje);
    const pagosMes = bs.reduce((s, b) => s + (b.payments || []).filter(p => String(p.date || '').slice(0, 7) === mes && p.conta !== CONTA_PRESTADOR).reduce((s2, p) => s2 + p.amount, 0), 0);
    return {
      hoje, clientes: Cadastro.all().length, reservas_por_vir: bs.filter(b => b.date >= hoje).length, reservas_passadas: bs.filter(b => b.date < hoje).length,
      planilha: { linhas: crmLinhas().length, em_aberto: P.abertos, confirmados: P.confirmados, fechamento: P.fecha.taxa == null ? null : Math.round(P.fecha.taxa * 100) + '%', precisa_de_voce: P.agora.length },
      orcamentos: { total: Orc.all().length, por_mandar: Orc.all().filter(o => ['novo', 'rascunho'].includes(o.status)).length, enviados: Orc.all().filter(o => o.status === 'enviado').length },
      tarefas: { atrasadas: G.atrasadas.length, hoje: G.hoje.length, proximas: (G.proximas || []).length, anotacoes: Tarefas.notas ? Tarefas.notas().length : undefined },
      dinheiro_do_mes: { recebido_por_ela: pagosMes, devem_a_ela: Lembretes.devedores(hoje).reduce((s, d) => s + d.total, 0), comissoes_a_pagar: P.comissoes.valor },
      guias: Equipe.all('guia').length, motoristas: Equipe.all('motorista').length, parceiros: Parceiros.all().length,
      transfers: { da_base_por_vir: tr.filter(transferNaBase).length, falta_pedir_ao_parceiro: tr.filter(b => transferNaBase(b) && !b.ncc).length, fora_da_base: tr.filter(b => !transferNaBase(b)).length },
      arquivos: typeof Arquivos !== 'undefined' ? { guardados: Arquivos.lista().length, na_fila_do_drive: Arquivos.pendentes().length } : undefined,
      avaliacoes: { no_site: Avaliacoes.all().length, media: Avaliacoes.media() },
      passeios_no_site: Tours.live().length, backup: Backup.ultimo().em || 'nunca',
    };
  },
  ver_fornecedores(i) {
    const hoje = hojeIso(), stTxt = (k) => (PED_FOR_ST.find(x => x[0] === k) || [k, k])[1];
    const peds = PedidosFor.todos({ deData: addDays(hoje, -7) }).filter(x => !i.so_pendentes || x.p.status !== 'confirmado');
    return {
      fornecedores: Fornecedores.all().map(f => ({ nome: f.nome, tipo: fornTipo(f.tipo)[2], whats: f.whats || undefined, email: f.email || undefined, site: f.site || undefined, comissao_pct: f.comissao || undefined, obs: f.obs || undefined })),
      pedidos: peds.map(({ b, p, f }) => ({ reserva: b.code, dia: b.date, cliente: b.name, servico: nomeDoServico(b), parceiro: f ? f.nome : '(sem parceiro escolhido)', tipo: fornTipo(p.tipo)[2], o_que: p.desc || undefined,
        situacao: stTxt(p.status), confirmacao: p.ref || undefined, custo: p.custo || 0, mensagem_pronta: p.status === 'apedir' ? msgFornecedor(b, p) : undefined })),
      falta_comprar: DB.bookings.filter(b => b.status !== 'cancelled' && b.date >= hoje).map(b => ({ reserva: b.code, dia: b.date, cliente: b.name, falta: pendenciasCompra(b) })).filter(x => x.falta.length),
    };
  },
  ver_saidas(i) {
    const hoje = hojeIso(), de = isoOk(i.de) ? i.de : hoje.slice(0, 8) + '01', ate = isoOk(i.ate) ? i.ate : hoje;
    const sai = saidasDoPeriodo(de, ate), tot = sai.reduce((s2, x) => s2 + (+x.valor || 0), 0);
    /* a mesma conta da tela Contabilidade: os dois lados do caixa dela (o que a guia recebeu na mão fica fora) */
    const entrou = extratoContas(de, ate).filter(r => r.lado === 'brasil' || r.lado === 'europa').reduce((s2, r) => s2 + (+r.amount || 0), 0);
    const mg = margensDoPeriodo(de, ate);
    return { periodo: { de, ate }, entrou: eur(entrou), saiu: eur(tot), liquido_do_caixa: eur(entrou - tot),
      saidas: sai.map(x => ({ dia: x.data, tipo: x.tipo, o_que: x.desc, valor: eur(x.valor) })),
      margem_dos_servicos: mg.map(m => ({ reserva: m.b.code, dia: m.b.date, servico: nomeDoServico(m.b), cliente: m.b.name, cliente_paga: eur(m.receita), sai: eur(m.custo), margem: eur(m.margem) })) };
  },
  ver_passo_a_passo(i) {
    if (!PIPE_ETAPAS) return E_('o passo a passo não está ligado neste app');
    const hoje = hojeIso(), nomeE = (k) => (PIPE_ETAPAS.find(e => e[0] === k) || [k, k])[1];
    const linhas = crmLinhas(hoje).filter(r => r.tipo !== 'reserva' || r.b.date >= addDays(hoje, -30) || r.etapa === 'avaliar');
    for (const p of (DB.pedidos || [])) if (!p.respondido && !p.orcamentoId) linhas.push({ tipo: 'pedido', nome: p.nome, dataServ: p.ini || '', servico: 'Monte a sua experiência' });
    const l = linhas.map(r => { const e = etapaPasso(r, hoje); return { cliente: r.nome, servico: r.servico, dia: r.dataServ || undefined, codigo: r.b ? r.b.code : undefined, numero: r.o ? r.o.num : undefined, etapa: nomeE(e), proximo_passo: proximoPassoPipe(r, e, hoje) || undefined, _e: e }; })
      .filter(x => !i.etapa || ingN(x.etapa).includes(ingN(i.etapa)) || ingN(x._e).includes(ingN(i.etapa))).map(({ _e, ...x }) => x);
    return l.length ? l : 'nada nessa etapa';
  },
  ver_parceiros() { const l = Parceiros.all().map(p => ({ nome: p.nome, tipo: p.tipo, cupom: p.cupom, desconto: p.desconto, comissao_pct: p.comissao, ...Parceiros.conta(p) })); return l.length ? l : 'nenhum parceiro'; },
  ver_contas() { return Contas.all().map(c => ({ conta: c.id, nome: c.nome, lado: c.pais })).concat([{ conta: CONTA_PRESTADOR, nome: 'pago na mão da guia/motorista', lado: 'fora do caixa dela' }]); },
  abrir_aba(i) {
    if (!ING_ABAS.includes(i.aba)) return E_('aba desconhecida');
    const arg = i.item ? '/' + (i.aba === 'clients' ? encodeURIComponent(i.item) : i.item) : '';
    go('/adm/' + i.aba + arg);
    return { ok: true, aberta: i.aba };
  },
};

const ING_PLANO = {
  anotar_tarefa(i) {
    const txt = String(i.texto || '').trim(); if (!txt) return E_('faltou o texto');
    const p = lerPrazo(txt);
    const dia = isoOk(i.dia) ? i.dia : p.data;
    const hora = /^\d{1,2}:\d{2}$/.test(i.hora || '') ? i.hora.padStart(5, '0') : p.hora;
    let cli = { clienteKey: '', clienteNome: i.cliente || '', whats: '' };
    if (i.cliente) { const r = ingAchaCliente(i.cliente); if (r.c) cli = { clienteKey: r.c.key, clienteNome: r.c.name, whats: r.c.whats }; else if (r.opcoes) return r; }
    const et = ETAPAS[etapaDoTexto(txt)];
    return { titulo: 'Anotar tarefa', assumiu: [], linhas: [['Tarefa', txt], ['Quando', dia ? ingData(dia) + (hora ? ' ' + hora : '') : 'sem data'],
      ...(cli.clienteNome ? [['Cliente', cli.clienteNome]] : []), ...(et && et.depois ? [['Depois de feita', et.depois]] : []), ...(i.detalhe ? [['Detalhe', i.detalhe]] : []),
      ...(i.prioridade && i.prioridade !== 'media' ? [['Prioridade', i.prioridade]] : []), ...(i.tipo === 'pessoal' ? [['Tipo', 'pessoal']] : [])],
      fazer: () => { const t = Tarefas.cria({ texto: txt, prazo: dia, hora, detalhe: i.detalhe || '', prio: i.prioridade, cat: i.tipo, ...cli, origem: 'assistente' }); return { ok: true, tarefa_id: t.id }; } };
  },
  concluir_tarefa(i) {
    const r = ingAchaTarefa(i.tarefa); if (!r.t) return r;
    const res = i.resultado === 'nao_respondeu' ? 'cutucar' : i.resultado === 'respondeu' ? 'respondeu' : (r.t.etapa === 'aguardar' ? 'respondeu' : '');
    return { titulo: 'Concluir tarefa', assumiu: [], linhas: [['Tarefa', r.t.texto], ...(res ? [['Resultado', res === 'cutucar' ? 'não respondeu' : 'respondeu']] : [])],
      fazer: () => { const nova = Tarefas.conclui(r.t.id, res); return { ok: true, proximo_passo: nova ? { tarefa_id: nova.id, texto: nova.texto, dia: nova.prazo } : null }; } };
  },
  anotar(i) {
    const txt = String(i.texto || '').trim(); if (!txt) return E_('faltou o texto');
    let cli = { clienteKey: '', clienteNome: i.cliente || '', whats: '' };
    if (i.cliente) { const r = ingAchaCliente(i.cliente); if (r.c) cli = { clienteKey: r.c.key, clienteNome: r.c.name, whats: r.c.whats }; }
    const [tit, ...resto] = txt.split('\n');
    return { titulo: 'Anotar', assumiu: [], linhas: [['Anotação', txt.slice(0, 160)], ...(cli.clienteNome ? [['Cliente', cli.clienteNome]] : [])],
      fazer: () => { const n = Tarefas.cria({ tipo: 'nota', texto: tit, detalhe: resto.join('\n'), fixa: !!i.fixar, ...cli, origem: 'assistente' }); return { ok: true, anotacao_id: n.id }; } };
  },
  anotar_cliente(i) {
    const r = ingAchaCliente(i.cliente); if (!r.c) return r;
    const f = Fichas.get(r.c.key), dia = hojeIso();
    const linha = `[${dia.slice(8, 10)}/${dia.slice(5, 7)}] ${String(i.texto || '').trim()}`;
    const tags = i.etiqueta ? [f.tags, i.etiqueta].filter(Boolean).join(', ') : f.tags;
    return { titulo: 'Anotar na ficha', assumiu: [], linhas: [['Cliente', r.c.name], ['Anotação', linha], ...(i.etiqueta ? [['Etiqueta', i.etiqueta]] : [])],
      fazer: () => { Fichas.salva(r.c.key, { notas: [f.notas, linha].filter(Boolean).join('\n'), tags }); return { ok: true }; } };
  },
  cadastrar_guia(i) {
    if (!String(i.nome || '').trim()) return E_('faltou o nome');
    if (Equipe.all().some(p => ingN(p.nome) === ingN(i.nome))) return E_('já existe alguém com esse nome — use mudar_guia');
    return { titulo: 'Cadastrar ' + (i.tipo === 'motorista' ? 'motorista' : 'guia'), assumiu: i.cidades ? [] : ['cidade: ' + baseNome()],
      linhas: [['Nome', i.nome], ['Cidades', i.cidades || baseNome()], ...(i.whats ? [['WhatsApp', i.whats]] : []), ...(i.idiomas ? [['Idiomas', i.idiomas]] : []), ['Preferência', 'última da lista']],
      fazer: () => { const p = Equipe.salva({ nome: i.nome, tipo: i.tipo, whats: i.whats, cidades: i.cidades || baseNome(), idiomas: i.idiomas, obs: i.obs }); return { ok: true, guia_id: p.id }; } };
  },
  mudar_guia(i) {
    const r = ingAchaGuia(i.guia); if (!r.g) return r;
    const g = r.g, muda = {}, linhas = [['Quem', g.nome]];
    for (const k of ['nome', 'whats', 'cidades', 'idiomas', 'obs']) if (i[k] !== undefined && String(i[k]).trim()) { muda[k] = i[k]; linhas.push([k, String(i[k])]); }
    if (i.preferencia) linhas.push(['Preferência', i.preferencia === 'primeira' ? 'primeira da lista' : i.preferencia]);
    if (linhas.length === 1) return E_('nada para mudar');
    return { titulo: 'Mudar ' + g.tipo, assumiu: [], linhas,
      fazer: () => {
        if (Object.keys(muda).length) Equipe.salva({ ...g, ...muda });
        if (i.preferencia === 'subir') Equipe.move(g.id, -1);
        else if (i.preferencia === 'descer') Equipe.move(g.id, 1);
        else if (i.preferencia === 'primeira') for (let k = 0; k < 30; k++) Equipe.move(g.id, -1);
        return { ok: true };
      } };
  },
  remover_guia(i) {
    const r = ingAchaGuia(i.guia); if (!r.g) return r;
    const n = DB.bookings.filter(b => b.prestadorId === r.g.id && b.date >= hojeIso() && b.status !== 'cancelled').length;
    return { titulo: 'Remover do cadastro', assumiu: [], linhas: [['Quem', r.g.nome], ...(n ? [['⚠', `${n} serviço(s) futuros ficam sem ${r.g.tipo}`]] : [])],
      fazer: () => { Equipe.remove(r.g.id); return { ok: true }; } };
  },
  marcar_disponibilidade(i) {
    const r = ingAchaGuia(i.guia); if (!r.g) return r;
    if (!isoOk(i.data)) return E_('data AAAA-MM-DD');
    const est = i.estado === 'limpar' ? '' : i.estado;
    return { titulo: 'Disponibilidade', assumiu: [], linhas: [['Quem', r.g.nome], ['Quando', `${ingData(i.data)} · ${turnoNome(i.turno)}`], ['Está', i.estado === 'limpar' ? '(apagar a resposta)' : i.estado], ...(i.nota ? [['Nota', i.nota]] : [])],
      fazer: () => { Disp.marca(r.g.id, i.data, i.turno, est, i.nota || ''); const fechou = Tarefas.sincroniza(); return { ok: true, tarefas_que_fecharam_sozinhas: fechou.map(t => t.texto) }; } };
  },
  escalar(i) {
    const rb = ingAchaReserva(i.codigo); if (!rb.b) return rb;
    const b = rb.b;
    if (/^(ningu[eé]m|nenhum|tirar)$/i.test(String(i.guia || '').trim()))
      return { titulo: 'Tirar quem faz', assumiu: [], linhas: [['Serviço', `${b.name} · ${ingData(b.date)} ${b.time}`]], fazer: () => { Op.escala(b.id, ''); return { ok: true }; } };
    const r = ingAchaGuia(i.guia); if (!r.g) return r;
    const ocup = turnosDoServico(b).map(tu => Disp.estado(r.g.id, b.date, tu)).find(e => e.estado === 'ocupada' && (!e.servico || e.servico.id !== b.id));
    return { titulo: 'Escalar', assumiu: ocup ? [`atenção: ${r.g.nome} está marcada como ocupada nesse turno${ocup.servico ? ' (' + ocup.servico.name + ')' : ''}`] : [],
      linhas: [['Serviço', `${(Tours.get(b.tourId) || { name: { pt: '?' } }).name.pt} · ${b.name}`], ['Quando', `${ingData(b.date)} ${b.time}`], ['Quem faz', r.g.nome]],
      fazer: () => { Op.escala(b.id, r.g.id); return { ok: true, lembrete: 'ofereça mandar o serviço para ela pelo WhatsApp (botão "mandar o serviço" no cartão, na aba Hoje)' }; } };
  },
  detalhes_servico(i) {
    const rb = ingAchaReserva(i.codigo); if (!rb.b) return rb;
    const d = {}, linhas = [['Serviço', `${rb.b.name} · ${ingData(rb.b.date)} ${rb.b.time}`]];
    const par = [['voo', 'voo', 'Voo/trem'], ['buscar_em', 'origem', 'Buscar em'], ['levar_para', 'destino', 'Levar para'], ['obs', 'obsOp', 'Observação']];
    for (const [de, para, rot] of par) if (i[de] !== undefined && String(i[de]).trim()) { d[para] = i[de]; linhas.push([rot, i[de]]); }
    if (i.custo !== undefined && i.custo !== null && i.custo !== '') { d.custo = +i.custo; linhas.push(['Ela paga a quem faz', eur(+i.custo)]); }
    if (i.resto) { d.restoPara = i.resto === 'no_dia' ? 'prestador' : 'ingrid'; linhas.push(['O resto', i.resto === 'no_dia' ? 'no dia, a quem faz' : 'com ' + guiaNome()]); }
    if (linhas.length === 1) return E_('nada para mudar');
    return { titulo: 'Detalhes do serviço', assumiu: [], linhas, fazer: () => { Op.detalhes(rb.b.id, d); return { ok: true }; } };
  },
  registrar_pagamento(i) {
    const rb = ingAchaReserva(i.codigo); if (!rb.b) return rb;
    const b = rb.b, falta = Bookings.due(b);
    if (falta <= 0) return E_('essa reserva já está paga');
    if (!contasIds().includes(i.conta)) return E_('em que conta caiu? contas: ' + contasIds().join(', '));
    const valor = +i.valor > 0 ? Math.min(+i.valor, falta) : falta;
    return { titulo: 'Registrar pagamento', assumiu: +i.valor > 0 ? [] : [`valor: o que faltava (${eur(valor)})`],
      linhas: [['Cliente', b.name], ['Código', b.code], ['Valor', eur(valor)], ['Onde caiu', Contas.nome(i.conta)],
        ['Contabilidade', i.conta === CONTA_PRESTADOR ? 'fora do caixa dela' : (Contas.get(i.conta) || {}).pais === 'brasil' ? ladoNome('brasil') : ladoNome('europa')], ['Ainda falta', eur(Math.max(0, falta - valor))],
        ...(i.anexo ? [['Comprovante', `fica na ficha e no Google Drive: ${guiaNegocio()} › Clientes › ${drvNome((Cadastro.get(b.clienteId) || {}).nome || b.name)}`]] : [])],
      fazer: () => {
        const p = registraPagamento(b.id, { valor, conta: i.conta });
        const arq = p && i.anexo ? ingArquiva(i.anexo, b, `${isoToday()} comprovante ${eur(p.amount).replace(/\s/g, '')} ${b.code}`, 'comprovante') : null;
        if (arq && arq.arquivo) { p.arquivoId = arq.arquivo.id; _opSaveBooking(b); }
        const fechou = Tarefas.sincroniza();
        return { ok: true, tarefas_que_fecharam_sozinhas: fechou.map(t => t.texto), ...(arq ? { comprovante: arq.onde || arq.erro } : {}) };
      } };
  },
  arquivar(i) {
    const a = ingAnexos.find(x => x.ref === String(i.anexo || '').trim());
    if (!a) return E_('não achei esse anexo — ela precisa mandar o arquivo aqui no chat (anexo1, anexo2…)');
    let b = null, c = null;
    const rb = ingAchaReserva(i.cliente); if (rb.b) b = rb.b;
    if (!b) { const r = ingAchaCliente(i.cliente); if (!r.c) return r; c = Cadastro.get(r.c.id); }
    const nome = (c && c.nome) || (b && (Cadastro.get(b.clienteId) || {}).nome) || (b && b.name);
    const desc = String(i.descricao || 'documento').trim();
    return { titulo: 'Guardar arquivo', assumiu: [],
      linhas: [['Arquivo', a.nome || i.anexo], ['Cliente', nome], ['O que é', desc], ['Onde fica', `na ficha e no Google Drive: ${guiaNegocio()} › Clientes › ${drvNome(nome)}`]],
      fazer: () => { const r = ingArquiva(i.anexo, b || { clienteId: c.id, name: c.nome }, `${isoToday()} ${desc}`, /comprov|pix|recibo/i.test(desc) ? 'comprovante' : 'documento', desc); return r.erro ? E_(r.erro) : { ok: true, onde: r.onde }; } };
  },
  criar_orcamento(i) {
    if (!String(i.cliente || '').trim()) return E_('faltou o nome do cliente');
    const itens = [], assumiu = [];
    for (const it of i.itens || []) {
      if (it.preco_ref && typeof Precos !== 'undefined') {
        /* a linha certa da Tabela de preços: valor, sinal (= preço − custo) e custo vêm de lá */
        const n = Precos.itemOrc(it.preco_ref, { data: isoOk(it.data) ? it.data : '', hora: it.hora || '' }); if (!n) return E_(`preco_ref ${it.preco_ref} não existe — use ver_precos`);
        if (it.pessoas) n.pax = +it.pessoas;
        if (+it.valor > 0) { n.valor = +it.valor; n.sinal = Math.max(0, n.valor - (n.custo || 0)); }
        itens.push(Orc._item(n)); assumiu.push('valor, sinal e custo da Tabela de preços');
      } else if (it.passeio_id) {
        const x = Tours.get(it.passeio_id); if (!x) return E_(`passeio ${it.passeio_id} não existe — use ver_passeios`);
        const n = Orc.itemDoCatalogo(it.passeio_id, { pax: it.pessoas || 2, data: isoOk(it.data) ? it.data : '', hora: it.hora });
        if (+it.valor > 0) n.valor = +it.valor;
        itens.push(n); assumiu.push('preços do catálogo de passeios');
      } else if (it.descricao) itens.push(Orc._item({ desc: it.descricao, pax: it.pessoas || 2, data: isoOk(it.data) ? it.data : '', hora: it.hora || '', valor: +it.valor || 0 }));
    }
    const o0 = { itens, sinalPct: i.sinal_pct != null ? +i.sinal_pct : 30 };
    return { titulo: 'Criar orçamento', assumiu: [...new Set(assumiu)],
      linhas: [['Cliente', i.cliente], ...(i.pessoas_nota ? [['Pessoas', i.pessoas_nota]] : []), ...(i.bagagem ? [['Bagagem', i.bagagem]] : []),
        ...itens.slice(0, 8).map(x => [x.data ? ingData(x.data) : '—', `${x.desc} · ${x.pax}p · ${x.valor ? eur(x.valor) : 'a definir'}${x.sinal ? ' · sinal ' + eur(x.sinal) : ''}`]), ['Total', eur(Orc.total(o0))], ['Sinal', eur(Orc.sinal(o0))]],
      fazer: () => { const o = Orc.cria({ origem: 'manual', status: 'rascunho', cliente: { nome: i.cliente, whats: i.whats, email: i.email }, itens, sinalPct: o0.sinalPct, obs: i.obs || '' });
        if (i.bagagem || i.pessoas_nota) Orc.salva({ id: o.id, bagagem: i.bagagem || '', paxNota: i.pessoas_nota || '' });
        return { ok: true, numero: o.num, lembrete: `para mudar qualquer coisa depois use editar_orcamento no ${o.num} — não crie outro; ela confere e manda pelo botão (você não manda nada para o cliente)` }; } };
  },
  ler_conversa(i) {
    const c = lerConversa(i.texto); const itens = rascunhoDaConversa(c);
    return { titulo: 'Pedido do WhatsApp', assumiu: ['o rascunho usa os preços da tabela; ela confere antes de mandar'],
      linhas: [['Cliente', c.nome || '?'], ['WhatsApp', c.whats || '?'], ['Resumo', c.resumo || '—'], ['Rascunho', `${itens.length} serviço(s)`]],
      fazer: () => { const o = Orc.cria({ origem: 'whats', status: 'rascunho', cliente: { nome: c.nome, whats: c.whats }, conversa: i.texto, resumo: c.resumo, pax: c.pax, datas: c.datas, itens });
        Tarefas.cria({ tipo: 'nota', origem: 'whats', texto: `Resumo do WhatsApp — ${c.nome || 'cliente novo'}`, detalhe: c.resumo, orcId: o.id, clienteNome: c.nome, whats: c.whats });
        return { ok: true, numero: o.num }; } };
  },
  editar_orcamento(i) {
    const r = ingAchaOrc(i.numero); if (!r.o) return r;
    const o = r.o, itens = o.itens.map(x => ({ ...x })), cli = { ...o.cliente }, linhas = [['Orçamento', `${o.num} · ${o.cliente.nome}`]];
    if (i.cliente) { cli.nome = i.cliente; linhas.push(['Cliente', i.cliente]); }
    if (i.whats) { cli.whats = i.whats; linhas.push(['WhatsApp', i.whats]); }
    if (i.email) { cli.email = i.email; linhas.push(['E-mail', i.email]); }
    const lista = () => itens.map((y, k) => (k + 1) + '. ' + y.desc).join(' · ');
    const acha = (q) => { const s = String(q || '').trim(); if (/^\d+$/.test(s)) return itens[+s - 1]; return itens.find(x => ingN(x.desc).includes(ingN(s))); };
    for (const it of i.itens || []) {
      if (it.acao === 'tirar') {
        const x = acha(it.item); if (!x) return E_(`não achei o serviço "${it.item}" — os serviços são: ${lista()}`);
        itens.splice(itens.indexOf(x), 1); linhas.push(['Tira', x.desc]);
      } else if (it.acao === 'adicionar') {
        let n = null;
        if (it.preco_ref && typeof Precos !== 'undefined') { n = Precos.itemOrc(it.preco_ref, { data: isoOk(it.data) ? it.data : '', hora: it.hora || '' }); if (!n) return E_('preco_ref não existe — use ver_precos'); if (it.pessoas) n.pax = +it.pessoas; }
        else if (it.descricao) n = { desc: it.descricao, pax: it.pessoas || o.pax || 2, data: isoOk(it.data) ? it.data : '', hora: it.hora || '', valor: +it.valor || 0, sinal: it.sinal != null ? +it.sinal : null };
        else return E_('para adicionar, passe preco_ref (de ver_precos) ou descricao');
        if (+it.valor > 0) { n.valor = +it.valor; if (n.custo != null && it.sinal == null) n.sinal = Math.max(0, n.valor - (n.custo || 0)); }
        if (it.sinal != null) n.sinal = +it.sinal;
        itens.push(Orc._item(n)); linhas.push(['Adiciona', `${n.desc} · ${n.pax}p · ${n.valor ? eur(n.valor) : 'a definir'}`]);
      } else {
        const x = acha(it.item); if (!x) return E_(`não achei o serviço "${it.item}" — os serviços são: ${lista()}`);
        if (it.preco_ref && typeof Precos !== 'undefined') { const n = Precos.itemOrc(it.preco_ref); if (!n) return E_('preco_ref não existe — use ver_precos'); Object.assign(x, { desc: n.desc, valor: n.valor, custo: n.custo, sinal: n.sinal, precoRef: n.precoRef, obs: n.obs || x.obs }); if (!it.pessoas) x.pax = n.pax; }
        if (it.descricao) x.desc = it.descricao; if (isoOk(it.data)) x.data = it.data; if (it.hora) x.hora = it.hora; if (it.pessoas) x.pax = +it.pessoas;
        if (+it.valor > 0) { x.valor = +it.valor; if (x.custo != null && it.sinal == null) x.sinal = Math.max(0, x.valor - (x.custo || 0)); }
        if (it.sinal != null) x.sinal = +it.sinal;
        linhas.push(['Muda', `${x.desc} · ${x.data ? ingData(x.data) : '—'}${x.hora ? ' ' + x.hora : ''} · ${x.pax}p · ${x.valor ? eur(x.valor) : 'a definir'}`]);
      }
    }
    if (i.obs != null) linhas.push(['Obs', i.obs]);
    if (i.bagagem != null) linhas.push(['Bagagem', i.bagagem]);
    if (i.pessoas_nota != null) linhas.push(['Pessoas', i.pessoas_nota]);
    if (linhas.length === 1) return E_('nada para mudar');
    const o1 = { ...o, itens };
    linhas.push(['Total', eur(Orc.total(o1))], ['Sinal', eur(Orc.sinal(o1))]);
    return { titulo: `Mudar o orçamento ${o.num}`, assumiu: [], linhas,
      fazer: () => { Orc.salva({ id: o.id, cliente: cli, itens, ...(i.obs != null ? { obs: i.obs } : {}), ...(i.bagagem != null ? { bagagem: i.bagagem } : {}), ...(i.pessoas_nota != null ? { paxNota: i.pessoas_nota } : {}) });
        return { ok: true, numero: o.num, lembrete: 'o mesmo orçamento foi atualizado — nenhum novo foi criado' }; } };
  },
  mudar_orcamento(i) {
    const r = ingAchaOrc(i.numero); if (!r.o) return r;
    const o = r.o, muda = {}, linhas = [['Orçamento', `${o.num} · ${o.cliente.nome}`]];
    if (i.situacao) { muda.status = i.situacao; linhas.push(['Situação', i.situacao]); }
    if (isoOk(i.validade)) { muda.validade = i.validade; linhas.push(['Validade', ingData(i.validade)]); }
    if (i.sinal_pct != null) { muda.sinalPct = +i.sinal_pct; linhas.push(['Sinal', i.sinal_pct + '%']); }
    if (linhas.length === 1) return E_('nada para mudar');
    return { titulo: 'Mudar orçamento', assumiu: [], linhas, fazer: () => { Orc.salva({ ...o, ...muda }); if (muda.status === 'enviado') Espera.orcamento(o); Tarefas.sincroniza(); return { ok: true }; } };
  },
  fechar_orcamento(i) {
    const r = ingAchaOrc(i.numero); if (!r.o) return r;
    const o = r.o; if (o.status === 'fechado') return E_('esse orçamento já foi fechado');
    const semDia = o.itens.filter(x => x.tourId && !x.data); if (semDia.length) return E_('falta o dia em: ' + semDia.map(x => x.desc).join(', '));
    if (i.sinal_recebido && !contasIds().includes(i.conta)) return E_('em que conta caiu o sinal? contas: ' + contasIds().join(', '));
    const n = o.itens.filter(x => x.tourId).length;
    return { titulo: 'Fechar orçamento', assumiu: [], linhas: [['Orçamento', `${o.num} · ${o.cliente.nome}`], ['Vira', `${n} reserva(s)`], ['Sinal', `${eur(Orc.sinal(o))} ${i.sinal_recebido ? '— já caiu em ' + Contas.nome(i.conta) : '— ainda não caiu'}`]],
      fazer: () => { const bs = Orc.fecha(o.id, { sinalRecebido: !!i.sinal_recebido, conta: i.conta }); Tarefas.sincroniza(); return { ok: true, reservas: bs.map(b => b.code) }; } };
  },
  ajustar_termos(i) {
    const linhas = [];
    if (i.termos) linhas.push(['Termos', String(i.termos).slice(0, 200) + (String(i.termos).length > 200 ? '…' : '')]);
    if (i.plantao) linhas.push(['Plantão', i.plantao]);
    if (!linhas.length) return E_('nada para mudar');
    return { titulo: 'Termos e plantão', assumiu: [], linhas, fazer: () => {
      if (i.termos) DB.settings.termos = { ...(DB.settings.termos || {}), pt: String(i.termos).trim() };
      if (i.plantao) DB.settings.plantao = String(i.plantao).trim();
      save(); return { ok: true }; } };
  },
  orcamento_do_roteiro(i) {
    const n = ingN(i.pedido);
    const l = (DB.pedidos || []).filter(p => p.id === i.pedido || ingN(p.nome).includes(n));
    if (!l.length) return E_('pedido de roteiro não encontrado — use ver_orcamentos');
    if (l.length > 1) return { erro: 'mais de um pedido — pergunte qual', opcoes: l.map(p => ({ pedido_id: p.id, nome: p.nome, de: p.ini })) };
    const p = l[0], itens = rascunhoDoRoteiro(p);
    return { titulo: 'Orçamento do roteiro', assumiu: ['sugestões pela tabela e pelo que o cliente gosta; ela confere'], linhas: [['Cliente', p.nome], ['Datas', [p.ini, p.fim].filter(Boolean).map(ingData).join(' a ') || '—'], ['Rascunho', `${itens.length} serviço(s)`]],
      fazer: () => { const o = Orc.cria({ origem: 'roteiro', status: 'rascunho', pedidoId: p.id, cliente: { nome: p.nome, whats: p.whats, email: p.email }, itens, pax: (+p.adultos || 0) + (+p.criancas || 0) }); return { ok: true, numero: o.num }; } };
  },
  cadastrar_conta(i) {
    const antes = i.conta ? Contas.get(i.conta) : null;
    if (i.conta && !antes) return E_('conta não encontrada — use ver_contas');
    return { titulo: antes ? 'Mudar conta' : 'Nova conta', assumiu: [], linhas: [['Conta', i.nome], ['Contador', i.lado === 'brasil' ? ladoNome('brasil') : ladoNome('europa')], ...(i.tipo ? [['Tipo', i.tipo]] : [])],
      fazer: () => { const c = Contas.salva({ id: antes ? antes.id : '', nome: i.nome, pais: i.lado, metodo: i.tipo || (antes ? antes.metodo : 'transfer') }); return { ok: true, conta: c.id }; } };
  },
  lembrete_feito(i) {
    const n = ingN(i.lembrete), l = Lembretes.lista().filter(x => ingN(x.txt).includes(n));
    if (!l.length) return E_('lembrete não encontrado — use ver_tarefas');
    if (l.length > 1) return { erro: 'mais de um lembrete parecido — pergunte qual', opcoes: l.map(x => x.txt) };
    return { titulo: 'Lembrete feito', assumiu: [], linhas: [['Lembrete', l[0].txt]], fazer: () => { Lembretes.marca(l[0].chave); return { ok: true }; } };
  },
  fazer_backup() {
    return { titulo: 'Backup agora', assumiu: [], linhas: [['O quê', 'tudo: clientes, reservas, pagamentos, guias, orçamentos, tarefas'], ['Onde', 'na pasta escolhida em Ajustes (Google Drive) — sem pasta, baixa o arquivo']],
      fazer: async () => { const r = await bkpAgora(true); return r.ok ? { ok: true, onde: r.pasta ? 'pasta ' + r.pasta : 'baixado', arquivo: r.arquivo || r.baixado } : { erro: 'não salvou: ' + (r.erro || '') }; } };
  },
  cadastrar_cliente(i) {
    if (!String(i.nome || '').trim()) return E_('faltou o nome');
    if (Cadastro.acha({ nome: i.nome, whats: i.whats, email: i.email })) return E_('esse cliente já existe — use mudar_cliente');
    if (i.nascimento && !nascOk(i.nascimento)) return E_('nascimento em dd/mm/aaaa');
    const ind = i.indicado_por ? Cadastro.acha({ nome: i.indicado_por }) : null;
    return { titulo: 'Cadastrar cliente', assumiu: [], linhas: [['Nome', i.nome], ...(i.whats ? [['WhatsApp', i.whats]] : []), ...(i.veio_por ? [['Veio por', veioPorNome(i.veio_por)]] : []), ...(i.indicado_por ? [['Indicado por', i.indicado_por]] : [])],
      fazer: () => { const c = Cadastro.novo({ nome: i.nome, whats: i.whats, email: i.email, nasc: i.nascimento, veioPor: i.veio_por || (i.indicado_por ? 'indicacao' : ''), indicadoPor: ind ? ind.id : '', indicadoNome: ind ? ind.nome : (i.indicado_por || '') }); return { ok: true, cliente: c.nome }; } };
  },
  mudar_cliente(i) {
    const r = ingAchaCliente(i.cliente); if (!r.c) return r;
    const c = Cadastro.get(r.c.id), muda = {}, linhas = [['Cliente', c.nome]];
    const par = [['nome', 'nome', 'Nome'], ['whats', 'whats', 'WhatsApp'], ['email', 'email', 'E-mail'], ['nascimento', 'nasc', 'Nascimento'], ['pais', 'pais', 'País/cidade']];
    for (const [de, para, rot] of par) if (i[de]) { muda[para] = i[de]; linhas.push([rot, i[de]]); }
    if (muda.nasc && !nascOk(muda.nasc)) return E_('nascimento em dd/mm/aaaa');
    if (i.veio_por) { muda.veioPor = i.veio_por; linhas.push(['Veio por', veioPorNome(i.veio_por)]); }
    if (i.indicado_por) { const ind = Cadastro.acha({ nome: i.indicado_por }); muda.indicadoPor = ind ? ind.id : ''; muda.indicadoNome = ind ? ind.nome : i.indicado_por; if (!i.veio_por) muda.veioPor = 'indicacao'; linhas.push(['Indicado por', muda.indicadoNome]); }
    if (i.parceiro) { const p = Parceiros.all().find(x => ingN(x.nome).includes(ingN(i.parceiro)) || x.cupom === String(i.parceiro).toUpperCase()); if (!p) return E_('parceiro não encontrado — use ver_parceiros'); muda.parceiroId = p.id; linhas.push(['Parceiro', p.nome]); }
    const v = { ...(c.viagem || {}) }; let mv = false;
    for (const k of ['hotel', 'chegada', 'partida', 'bagagem']) if (i[k]) { v[k] = i[k]; mv = true; linhas.push([k[0].toUpperCase() + k.slice(1), i[k]]); }
    if (mv) muda.viagem = v;
    if (linhas.length === 1) return E_('nada para mudar');
    return { titulo: 'Mudar cadastro', assumiu: [], linhas, fazer: () => { Cadastro.salva(c.id, muda); return { ok: true }; } };
  },
  quem_vai(i) {
    const rb = ingAchaReserva(i.codigo); if (!rb.b) return rb;
    const b = rb.b, pessoas = (i.pessoas || []).filter(p => p && String(p.nome || '').trim());
    const ruim = pessoas.find(p => p.nascimento && !nascOk(p.nascimento)); if (ruim) return E_(`nascimento de ${ruim.nome} em dd/mm/aaaa`);
    if (i.nascimento_comprador && !nascOk(i.nascimento_comprador)) return E_('nascimento de quem comprou em dd/mm/aaaa');
    const vai = i.comprador_vai !== false, total = pessoas.length + (vai ? 1 : 0);
    return { titulo: 'Quem vai no passeio', assumiu: total !== b.pax ? [`a reserva é de ${b.pax} pessoa(s); aqui são ${total}`] : [],
      linhas: [['Serviço', `${nomeDoServico(b)} · ${ingData(b.date)}`], ...(vai ? [[b.name + ' (comprou)', i.nascimento_comprador || b.nasc || 'sem nascimento']] : [['Quem comprou', 'não vai']]), ...pessoas.map(p => [p.nome, p.nascimento || 'sem nascimento'])],
      fazer: () => { b.compradorVai = vai; if (i.nascimento_comprador) b.nasc = i.nascimento_comprador;
        const antes = b.group || []; b.group = pessoas.map(p => ({ nome: p.nome.trim(), nasc: p.nascimento || '', clienteId: (antes.find(a => ingN(a.nome) === ingN(p.nome)) || {}).clienteId || '' }));
        cadastroDaReserva(b); _opSaveBooking(b); return { ok: true, pessoas: participantesDe(b).length }; } };
  },
  ingressos_comprados(i) {
    const rb = ingAchaReserva(i.codigo); if (!rb.b) return rb;
    return { titulo: 'Ingressos', assumiu: [], linhas: [['Serviço', `${nomeDoServico(rb.b)} · ${rb.b.name}`], ['Ingressos', i.comprados ? 'comprados ✓' : 'a comprar']], fazer: () => { Op.ingressosOk(rb.b.id, !!i.comprados); return { ok: true }; } };
  },
  link_servico(i) {
    const rb = ingAchaReserva(i.codigo); if (!rb.b) return rb;
    if (!/^https?:\/\//i.test(String(i.url || ''))) return E_('o link precisa começar com http');
    return { titulo: 'Guardar link', assumiu: [], linhas: [['Serviço', `${nomeDoServico(rb.b)} · ${rb.b.name}`], ['Link', (i.nome || 'link') + ' — ' + i.url]], fazer: () => { Op.linkAdd(rb.b.id, i.nome, i.url); return { ok: true }; } };
  },
  marcar_perdido(i) {
    const r = ingAchaOrc(i.numero); if (!r.o) return r;
    return { titulo: 'Orçamento perdido', assumiu: [], linhas: [['Orçamento', `${r.o.num} · ${r.o.cliente.nome}`], ['Motivo', i.motivo]], fazer: () => { perdeOrcamento(r.o.id, i.motivo); Tarefas.sincroniza(); return { ok: true }; } };
  },
  avaliacao_pedida(i) {
    const rb = ingAchaReserva(i.codigo); if (!rb.b) return rb;
    return { titulo: 'Avaliação pedida', assumiu: [], linhas: [['Cliente', rb.b.name], ['Serviço', nomeDoServico(rb.b)], ['Vai para', '💚 Finalizado']], fazer: () => { marcaAvaliacao(rb.b.id); return { ok: true }; } };
  },
  cadastrar_parceiro(i) {
    const ja = Parceiros.all().find(p => ingN(p.nome) === ingN(i.nome));
    return { titulo: ja ? 'Mudar parceiro' : 'Cadastrar parceiro', assumiu: [], linhas: [['Nome', i.nome], ...(i.cupom ? [['Cupom', String(i.cupom).toUpperCase()]] : []), ['Desconto', (i.desconto ?? (ja ? ja.desconto : 0)) + '%'], ['Comissão', (i.comissao ?? (ja ? ja.comissao : 0)) + '%']],
      fazer: () => { const r = Parceiros.salva({ ...(ja || {}), ...Object.fromEntries(Object.entries({ nome: i.nome, tipo: i.tipo, contato: i.contato, cupom: i.cupom, desconto: i.desconto, comissao: i.comissao }).filter(([, v]) => v !== undefined)) });
        return r.erro ? { erro: r.erro } : { ok: true, cupom: r.cupom }; } };
  },
  comissao_paga(i) {
    const p = Parceiros.all().find(x => ingN(x.nome).includes(ingN(i.parceiro)) || x.cupom === String(i.parceiro).toUpperCase());
    if (!p) return E_('parceiro não encontrado — use ver_parceiros');
    if (!(+i.valor > 0)) return E_('valor maior que zero');
    return { titulo: 'Comissão paga', assumiu: [], linhas: [['Parceiro', p.nome], ['Valor', eur(+i.valor)], ['Ainda a pagar', eur(Math.max(0, Parceiros.conta(p).saldo - +i.valor))]], fazer: () => { Parceiros.paga(p.id, +i.valor); return { ok: true }; } };
  },
  cadastrar_fornecedor(i) {
    const ja = Fornecedores.all().find(f => ingN(f.nome) === ingN(i.nome));
    const d = Object.fromEntries(Object.entries({ nome: i.nome, tipo: i.tipo, whats: i.whats, email: i.email, site: i.site, comissao: i.comissao, obs: i.obs }).filter(([, v]) => v !== undefined));
    return { titulo: ja ? 'Mudar parceiro' : 'Cadastrar parceiro', assumiu: [], linhas: [['Nome', i.nome], ['Tipo', fornTipo(i.tipo || (ja && ja.tipo) || 'outro')[2]], ...(i.whats ? [['WhatsApp', i.whats]] : []), ...(i.comissao != null ? [['Comissão para você', i.comissao + '%']] : [])],
      fazer: () => { const r = Fornecedores.salva({ ...(ja || {}), ...d }); return r.erro ? { erro: r.erro } : { ok: true }; } };
  },
  pedir_ao_parceiro(i) {
    const rb = ingAchaReserva(i.codigo); if (!rb.b) return rb;
    let f = null;
    if (i.parceiro) { const l = Fornecedores.all().filter(x => ingN(x.nome).includes(ingN(i.parceiro))); if (l.length > 1) return { erro: 'mais de um parceiro com esse nome — pergunte qual', opcoes: l.map(x => x.nome) }; f = l[0] || null; if (!f) return E_('parceiro não cadastrado — use ver_fornecedores ou cadastrar_fornecedor'); }
    const tipo = i.tipo || (f ? f.tipo : 'outro'), b = rb.b;
    const prev = { desc: String(i.descricao || '').trim(), tipo };
    return { titulo: 'Pedido ao parceiro', assumiu: f ? [] : ['sem parceiro escolhido (dá para escolher depois na aba Parceiros)'],
      linhas: [['Reserva', `${b.code} · ${b.name} · ${b.date}`], ['Parceiro', f ? f.nome : '—'], ['O quê', prev.desc || fornTipo(tipo)[2]], ['Custo', eur(+i.custo || 0)], ['Situação', (PED_FOR_ST.find(x => x[0] === (i.situacao || 'apedir')) || [])[1] || 'a pedir']],
      fazer: () => { const p = PedidosFor.cria(b.id, { fornecedorId: f ? f.id : '', tipo, desc: prev.desc, custo: +i.custo || 0, status: i.situacao || 'apedir' });
        if (p.erro) return { erro: p.erro };
        if (p.status === 'confirmado') PedidosFor.muda(b.id, p.id, { status: 'confirmado' });
        return { ok: true, mensagem_para_o_parceiro: msgFornecedor(b, p), whats_do_parceiro: f && f.whats ? f.whats : undefined }; } };
  },
  pedido_parceiro(i) {
    const rb = ingAchaReserva(i.codigo); if (!rb.b) return rb;
    const todos = PedidosFor.daReserva(rb.b);
    const l = i.pedido ? todos.filter(p => ingN([p.desc, fornTipo(p.tipo)[2], (Fornecedores.get(p.fornecedorId) || {}).nome].join(' ')).includes(ingN(i.pedido))) : todos;
    if (!l.length) return E_('nenhum pedido a parceiro nessa reserva — use pedir_ao_parceiro');
    if (l.length > 1) return { erro: 'mais de um pedido nessa reserva — diga qual', opcoes: l.map(p => p.desc || fornTipo(p.tipo)[2]) };
    const p = l[0], patch = {};
    if (i.situacao) patch.status = i.situacao; if (i.confirmacao !== undefined) patch.ref = i.confirmacao; if (i.custo !== undefined) patch.custo = +i.custo;
    return { titulo: 'Mudar pedido ao parceiro', assumiu: [], linhas: [['Reserva', `${rb.b.code} · ${rb.b.name}`], ['Pedido', p.desc || fornTipo(p.tipo)[2]],
        ...(patch.status ? [['Situação', (PED_FOR_ST.find(x => x[0] === patch.status) || [])[1]]] : []), ...(patch.ref ? [['Confirmação', patch.ref]] : []), ...(patch.custo !== undefined ? [['Custo', eur(patch.custo)]] : [])],
      fazer: () => { PedidosFor.muda(rb.b.id, p.id, patch); return { ok: true }; } };
  },
  lancar_despesa(i) {
    const v = +i.valor; if (!(v > 0)) return E_('valor maior que zero');
    const cat = DESP_CAT.find(c => c[0] === i.categoria) || DESP_CAT[DESP_CAT.length - 1];
    return { titulo: 'Lançar despesa', assumiu: isoOk(i.data) ? [] : ['data de hoje'], linhas: [['O quê', i.descricao], ['Valor', eur(v)], ['Dia', isoOk(i.data) ? i.data : hojeIso()], ['Categoria', cat[1]]],
      fazer: () => { const r = Despesas.salva({ desc: i.descricao, valor: v, data: isoOk(i.data) ? i.data : hojeIso(), categoria: cat[0], conta: i.conta || '' }); return r.erro ? { erro: r.erro } : { ok: true }; } };
  },
  mudar_tabela(i) {
    const x = Tours.get(i.passeio_id); if (!x) return E_('passeio não encontrado — use ver_passeios');
    if (x.priceMode !== 'tabela') return E_('este passeio não tem tabela por pessoas' + (x.priceMode === 'transfer' ? ' (transfer tem tabela própria: Meus passeios)' : ' — use mudar_preco'));
    const de = Math.max(1, +i.de_pessoas || 1), ate = Math.min(20, Math.max(de, +i.ate_pessoas || de)), v = +i.valor;
    if (!(v > 0)) return E_('valor maior que zero');
    const tb = Array.isArray(x.tabela) ? x.tabela : [];
    return { titulo: 'Mudar tabela', assumiu: [], linhas: [['Passeio', x.name.pt], ['Grupo', de === ate ? `${de} pessoa(s)` : `${de} a ${ate} pessoas`], ['Antes', eur(+tb[de - 1] || 0)], ['Agora', eur(v)]],
      fazer: () => { const nt = Array.from({ length: 20 }, (_, k) => +tb[k] || 0); for (let k = de - 1; k < ate; k++) nt[k] = v; Tours.update(x.id, { tabela: nt }); return { ok: true }; } };
  },
};
for (const k of Object.keys(ING_LER)) IA_LEITURA.add(k);
const _ingLer = iaLeitura;
iaLeitura = function (nome, i) { return ING_LER[nome] ? ING_LER[nome](i || {}) : _ingLer(nome, i); };
const _ingPlano = iaPlano;
iaPlano = function (nome, i) { return ING_PLANO[nome] ? ING_PLANO[nome](i || {}) : _ingPlano(nome, i); };

/* ---------- 3. o que ela vive agora, e o jeito dela ---------- */
iaAgora = function () {
  const hoje = hojeIso(), G = Tarefas.grupos(hoje);
  const serv = (b) => { const s = ingServ(b); return `${s.hora} ${s.servico} · ${s.cliente} (${s.pessoas}p) · ${s.quem_faz} · paga no dia: ${s.paga_no_dia} · ${s.codigo}`; };
  const hj = Op.doDia(hoje), am = Op.doDia(addDays(hoje, 1));
  const dev = Lembretes.devedores(hoje), lem = Lembretes.lista(hoje).slice(0, 6);
  const novos = Orc.all().filter(o => ['novo', 'rascunho'].includes(o.status));
  return [
    linhaHoje(),
    hj.length ? `Serviços de hoje: ${hj.map(serv).join(' | ')}` : 'Hoje não há serviço.',
    am.length ? `Amanhã: ${am.map(serv).join(' | ')}` : 'Amanhã não há serviço.',
    (G.atrasadas.length || G.hoje.length) ? `Tarefas atrasadas/hoje: ${[...G.atrasadas, ...G.hoje].map(t => `${t.texto}${t.hora ? ' ' + t.hora : ''} [${t.id}]`).join(' | ')}` : 'Nenhuma tarefa para hoje.',
    dev.length ? `Clientes que devem a ela: ${dev.map(d => `${d.nome} ${eur(d.total)}${d.atrasado ? ' (atrasado)' : ''}`).join(' | ')}` : '',
    novos.length ? `Pedidos esperando orçamento: ${novos.map(o => `${o.num} ${o.cliente.nome}`).join(' | ')}` : '',
    lem.length ? `O app lembra: ${lem.map(l => l.txt).join(' | ')}` : '',
    `Guias por preferência: ${Equipe.all('guia').map(p => p.nome.split(' ')[0]).join(', ') || '—'}. Motoristas: ${Equipe.all('motorista').map(p => p.nome).join(', ') || '—'}.`,
  ].filter(Boolean).join('\n');
};
iaSaudacao = function () {
  const h = new Date().getHours(), hoje = hojeIso();
  const hj = Op.doDia(hoje), G = Tarefas.grupos(hoje), dev = Lembretes.devedores(hoje);
  const semGuia = hj.filter(b => !b.prestadorId).length;
  const l = [ia(h < 12 ? 'sdBom' : h < 19 ? 'sdBoa' : 'sdNoite', { nome: guiaNome() })];
  l.push(hj.length ? `Hoje ${hj.length === 1 ? 'tem 1 serviço' : `são ${hj.length} serviços`}${semGuia ? `, ${semGuia} ainda sem guia/motorista` : ''}.` : 'Hoje não tem serviço.');
  if (G.atrasadas.length || G.hoje.length) l.push(`${G.hoje.length} tarefa(s) para hoje${G.atrasadas.length ? ` e ${G.atrasadas.length} atrasada(s)` : ''}.`);
  if (dev.length) l.push(`${dev.length} cliente(s) devem ${eur(dev.reduce((s, d) => s + d.total, 0))}.`);
  l.push('É só falar: "quem está livre amanhã de manhã?", "anota ligar para o Luca às 9h", "a Juliana pagou 60 ao motorista".');
  return l.join('\n');
};
iaSistema = function () {
  const mem = Mkt.get().memoria;
  return [
    { type: 'text', cache_control: { type: 'ephemeral' }, text: `${linhaHoje()}

Você é o assistente de ${guiaNome()}, dona da ${guiaNegocio()} — experiências privativas, imersões empresariais e eventos nos Emirados Árabes Unidos, base em ${baseNome()}. Ela é guia brasileira licenciada e AGENCIA: tem guias parceiros e motoristas, e compra ingressos, hotéis e transfers com parceiros locais. Recebe por uma plataforma no Brasil (Pix e cartão em até 12x) e na conta em Dubai, com um contador em cada lado (${ladoNome('brasil')} e ${ladoNome('europa')}).

## Como você é
Uma pessoa de confiança que trabalha com ela há anos: frase curta, sem jargão, resolve. Chama pelo nome de vez em quando. No máximo um emoji. Propositivo: depois de responder, ofereça o próximo passo em uma linha, e pare. Uma pergunta por vez.
Quando ela contar algo solto ("a Mariana pagou 150 ao motorista", "a Carolina não pode dia 25 de manhã", "anota: ligar para o Omar amanhã 9h"), você transforma em ação no app e mostra o cartão de confirmação. O trabalho dela é falar; o de preencher é seu.
Emergência ("o cliente chegou e não acha o motorista"): use buscar e responda em 2 linhas com nome, voo, quem é o motorista, o WhatsApp dele e quanto o cliente paga no dia.

## REGRA ABSOLUTA DELA
Você NUNCA responde cliente, nunca manda mensagem, nunca publica, nunca paga. Você prepara (rascunho de orçamento, texto de mensagem, resumo) e ELA confere e envia pelos botões do app. Não existe ferramenta que mande nada para fora — é de propósito.

## VOCÊ ALCANÇA TODAS AS ABAS
- Hoje (serviços do dia, emergência): ver_hoje, buscar, detalhes_servico, escalar, registrar_pagamento
- Orçamentos (Sob consulta): ver_orcamentos, ler_conversa (conversa colada → rascunho), criar_orcamento, editar_orcamento (MUDA o que já existe: cliente, serviços, datas, valores, bagagem, pessoas), mudar_orcamento (situação/validade/% sinal), fechar_orcamento
- TABELA DE PREÇOS (as abas de preço dela): ver_precos acha a linha certa por pessoas e serviço e devolve preço, por pessoa, SINAL (= preço − custo), custo, cartão e noturno, com um ref. VOCÊ LÊ ESSA TABELA — nunca peça o valor ou o sinal a ela: consulte ver_precos e passe o ref em preco_ref.
- Voucher (o texto de cada reserva, que se monta sozinho) e Pipeline (kanban dos pedidos): abrir_aba voucher / pipeline
- Planilha (o CRM dela, linha por serviço, igual ao Google Planilhas): ver_crm lê TODAS as colunas (filtre por cliente/mês); ver_painel dá os números e o "precisa de você"; para mudar use mudar_orcamento, fechar_orcamento, registrar_pagamento, marcar_perdido ou abrir_aba planilha
- Transfer (o parceiro de transfer dela — SÓ transfers de ${baseNome()}; os de fora são com outro fornecedor): ver_transfers (inclui os dados prontos para colar na plataforma)
- ⭐ Avaliações do site: ver_avaliacoes
- Arquivos: ver_arquivos
- NÃO SABE ONDE ESTÁ? procurar (acha em todas as abas). Pergunta geral sobre o negócio ("como estamos?", "o que tem pendente?") → ver_tudo. Você lê TUDO do app: nunca diga que não tem acesso a uma aba.
- Tarefas e anotações: ver_tarefas (inclui lembretes do app e clientes que devem), anotar_tarefa, concluir_tarefa, ver_anotacoes, anotar
- Guias e motoristas: ver_guias, quem_esta_livre, marcar_disponibilidade, cadastrar_guia, mudar_guia (inclui preferência), remover_guia, escalar
- Agenda: ver_agenda, ver_hoje com a data; tarefas com dia aparecem na Agenda sozinhas
- Reservas: ver_reservas, criar_reserva, alterar_reserva, cancelar_reserva, registrar_pagamento
- Clientes e ficha: ver_clientes (dashboard, filtros), ver_ficha (tudo de um cliente: viagem, serviços com quem vai, ingressos, links, histórico), cadastrar_cliente, mudar_cliente, anotar_cliente
- CRM (a planilha dela, dentro de Clientes): ver_crm (etapas aberto/confirmado/avaliar/finalizado/perdido), marcar_perdido, avaliacao_pedida
- Quem vai no passeio (ingressos nominais): quem_vai, ingressos_comprados, link_servico
- Indicações e cupons (quem traz cliente: agência, influencer): ver_parceiros, cadastrar_parceiro, comissao_paga, ver_cupons, criar_cupom
- Parceiros (fornecedores: transfer, ingressos, hotel) e os pedidos a eles: ver_fornecedores, cadastrar_fornecedor, pedir_ao_parceiro (devolve a mensagem pronta), pedido_parceiro (confirmado, nº de confirmação)
- Pipeline passo a passo (em que etapa está cada cliente e o que falta): ver_passo_a_passo
- Contabilidade: ver_contabilidade (o que entrou), ver_saidas (tudo que sai, líquido e margem), lancar_despesa, ver_contas, registrar_pagamento (a CONTA decide o lado do caixa; "prestador" = pago na mão da guia, fora do caixa dela)
- Arquivos e Google Drive: registrar_pagamento com anexo (comprovante), arquivar (outro documento). Tudo fica na ficha do cliente e na pasta ${guiaNegocio()} › Clientes › nome do cliente no Google Drive.
- Meus passeios: ver_passeios, criar_passeio, alterar_passeio, mudar_preco, mudar_tabela (preço por número de pessoas), adicionar_horario, remover_horario
- Dashboard: ver_relatorio
- Cupons: ver_cupons, criar_cupom, apagar_cupom · Bloqueios: bloquear_datas, liberar_datas
- Ajustes: ver_ajustes, alterar_ajustes, ajustar_termos (termos do orçamento e plantão do voucher), ver_backup, fazer_backup
- Qualquer tela: abrir_aba — nunca diga "faça na aba X" sem antes tentar a ferramenta; se não houver, abra a aba e diga o que tocar.

## ONDE GUARDAR CADA COISA
- Coisa para FAZER (com ou sem dia) → anotar_tarefa. "Mandar/enviar/cobrar/responder" já cria sozinha o passo "aguardar resposta" quando ela concluir.
- Ela conta que fez algo ("mandei o roteiro", "a cliente respondeu", "não respondeu") → concluir_tarefa com o resultado certo.
- Fato que vale para sempre sobre um cliente (vegana, VIP, alergia, indicou alguém) → anotar_cliente.
- Ideia, fornecedor, detalhe solto → anotar.
- A guia respondeu livre/ocupada → marcar_disponibilidade (fecha sozinha a tarefa de espera).
- Dinheiro que entrou → registrar_pagamento com a conta; se ela não disse a conta, PERGUNTE.
- Ela mandou um comprovante no chat (print do Pix, PDF do banco) → leia o valor e o nome, ache a reserva (buscar) e chame registrar_pagamento com anexo. "Pagou tudo" = sem valor (o que falta). Diga onde o comprovante ficou (a ferramenta devolve).
- Outro arquivo do cliente (passaporte, bilhete, voucher do hotel) → arquivar.
- Conversa de cliente colada → ler_conversa.
- Regra de trabalho dela para você lembrar sempre → guardar_memoria.

## ORÇAMENTO — COMO ELA TRABALHA (tudo se conversa)
- Transfer, guia ou bate-e-volta → ver_precos (pessoas + serviço) e passe o ref em preco_ref: valor, SINAL e custo entram certos da Tabela de preços. Sem ref, não invente preço nem sinal.
- Bebê ou criança CONTA como pessoa (entra no número de pessoas da tabela). Escreva no pessoas_nota ("2 adultos + 1 bebê") e lembre de perguntar se tem carrinho de bebê e quantas malas (bagagem) — isso muda o veículo.
- Ela pediu uma mudança num orçamento que já existe → editar_orcamento NO MESMO NÚMERO. Nunca crie um segundo orçamento para o mesmo pedido.
- O orçamento que vai pro cliente nunca mostra o custo (só valor, sinal e o que paga no dia).
- Nunca diga que não consegue ler a tabela ou uma aba: ver_precos, ver_crm, ver_tudo e procurar leem tudo.

## Gravar
Chame a ferramenta direto: o app mostra o cartão "confirma?". Se ela cancelar, não grave e não insista. Na dúvida entre dois registros (duas "Juliana"), a ferramenta devolve as opções: pergunte qual — nunca chute. Datas em AAAA-MM-DD. Nunca invente preço, data, voo ou valor recebido.

## Formato
Português do Brasil, curto. Texto para ela copiar vem pronto. Negrito com parcimônia; nada de tabelas.` },
    { type: 'text', text: `## SITUAÇÃO AGORA (atualizada a cada mensagem)\n${iaAgora()}` },
    { type: 'text', text: `${linhaHoje()} Moeda: ${typeof moedaCodigo === 'function' ? moedaCodigo() : 'euro'}.` + (iaModo() === 'vivo' ? ' Isto é o protótipo em teste: os clientes, guias e valores são de exemplo.' : '') + (iaContexto() ? ` Tela aberta: ${iaContexto().txt}.` : '') +
      (mem.length ? '\n\n## Memória (o que ela ensinou)\n' + mem.map(x => `- [${x.id}] ${x.texto}`).join('\n') : '') },
  ];
};

/* ---------- pedidos prontos (modo demonstração) — rodam as ferramentas de verdade ---------- */
iaCenarios = function () {
  const hoje = hojeIso(), am = addDays(hoje, 1);
  const lista = [];
  lista.push({ id: 'hoje', pede: 'O que tenho hoje?', passos: [['ver_hoje', {}]],
    resposta: () => { const l = Op.doDia(hoje); if (!l.length) return 'Hoje não tem serviço.';
      return 'Hoje:\n' + l.map(b => { const s = ingServ(b); return `• ${s.hora} ${s.servico} — ${s.cliente} (${s.pessoas}p) · ${s.quem_faz}${s.paga_no_dia !== 'nada' ? ' · paga no dia ' + s.paga_no_dia : ''}`; }).join('\n'); } });
  lista.push({ id: 'livre', pede: 'Quem está livre amanhã de manhã em ' + baseNome() + '?', passos: [['quem_esta_livre', { data: am, turno: 'manha', cidade: baseNome() }]],
    resposta: () => { const r = Disp.quem({ data: am, turno: 'manha', cidade: baseNome(), tipo: 'guia' });
      return `Amanhã de manhã, por preferência:\n${r.livres.length ? r.livres.map(x => `• ${x.p.nome} — livre${x.nota ? ' (' + x.nota + ')' : ''}`).join('\n') : '• ninguém confirmou ainda'}${r.semResposta.length ? `\nSem resposta: ${r.semResposta.map(x => x.p.nome.split(' ')[0]).join(', ')}` : ''}\nQuer que eu escale a primeira livre?`; } });
  const cam = DB.bookings.find(b => b.date === am && !b.prestadorId && b.status !== 'cancelled' && (Tours.get(b.tourId) || {}).priceMode !== 'transfer');
  const livre = Disp.quem({ data: am, turno: 'manha', cidade: baseNome(), tipo: 'guia' }).livres[0];
  if (cam && livre) lista.push({ id: 'escala', pede: `Escala ${livre.p.nome.split(' ')[0]} no serviço de ${cam.name} amanhã`, passos: [['escalar', { codigo: cam.code, guia: livre.p.id }]],
    resposta: () => `Pronto: ${livre.p.nome} está com o serviço de ${cam.name}. No cartão do Hoje tem o botão "mandar o serviço" com tudo escrito.` });
  lista.push({ id: 'tarefa', pede: 'Anota: ligar para o Omar amanhã às 9h sobre os transfers da semana', passos: [['anotar_tarefa', { texto: 'Ligar para o Omar sobre os transfers da semana', dia: am, hora: '09:00' }]],
    resposta: () => 'Anotado para amanhã às 9h — está em Tarefas e na Agenda. Se quiser no celular, toque em 📅 agenda na tarefa.' });
  const dev = Lembretes.devedores(hoje)[0];
  lista.push({ id: 'devem', pede: 'Quem está me devendo?', passos: [['ver_tarefas', {}]],
    resposta: () => { const d = Lembretes.devedores(hoje); return d.length ? `${d.length} cliente(s), ${eur(d.reduce((s, x) => s + x.total, 0))} no total:\n${d.map(x => `• ${x.nome} — ${eur(x.total)}${x.atrasado ? ' (atrasado)' : ' até ' + dataCurta(x.prazo)}`).join('\n')}\nEm Tarefas tem o botão "cobrar" de cada um.` : 'Ninguém está devendo. 👏'; } });
  const jul = DB.bookings.find(b => b.date === hoje && Op.restoPara(b) === 'prestador' && Bookings.due(b) > 0 && b.status !== 'cancelled');
  if (jul) lista.push({ id: 'pago', pede: `${jul.name.split(' ')[0]} pagou ${eur(Bookings.due(jul))} na mão de quem fez o serviço`, passos: [['registrar_pagamento', { codigo: jul.code, conta: CONTA_PRESTADOR }]],
    resposta: () => `Registrado: ${jul.name} está quitada. Esse valor ficou com quem fez o serviço, então não entra na sua contabilidade.` });
  if (dev) lista.push({ id: 'nota', pede: `Anota na ficha de ${dev.nome.split(' ')[0]}: prefere falar por áudio`, passos: [['anotar_cliente', { cliente: dev.nome, texto: 'Prefere falar por áudio no WhatsApp.' }]],
    resposta: () => `Anotado na ficha de ${dev.nome}.` });
  return lista;
};

/* o modo "ao vivo" (Claude de verdade pelo cofre) e o modo demonstracao ja
   vem do motor; a gaveta e redesenhada para pegar a saudacao dela */
if (typeof iaAtualizaFab === 'function') iaAtualizaFab();
if (location.hash.startsWith('#/adm') && typeof route === 'function') route();

/* =====================================================
   VOZ — igual ao TI ARTES OS (o assistente do Eugenio)

   FALAR: um toque no microfone, ela fala, e quando para de falar a mensagem
   vai sozinha. Tocar de novo manda na hora; "descartar" joga fora e devolve
   o campo como estava. Faixa com o cronometro enquanto ouve.
   OUVIR: a resposta lida em voz alta, com a melhor voz em portugues do
   Brasil que o aparelho tiver (no iPhone, a "Melhorada" que se baixa em
   Ajustes > Acessibilidade > Conteudo Falado fica muito melhor).

   Ditado do navegador (Web Speech): de graca, precisa de https — funciona
   no link publicado, nao no arquivo aberto do computador.
   ===================================================== */
const ING_VOZ_KEY = 'yalla_voz_v1';
const ingVozCfg = () => iaLe(ING_VOZ_KEY, { ler: false, enviar: true, vel: 1.05 });
const ingVozGrava = (c) => iaGrava(ING_VOZ_KEY, { ...ingVozCfg(), ...c });
const ING_FALA = window.SpeechRecognition || window.webkitSpeechRecognition || null;
const ING_SINTESE = ('speechSynthesis' in window) ? window.speechSynthesis : null;
const ingTemMic = () => !!ING_FALA && (location.protocol === 'https:' || location.hostname === 'localhost');
let ingOuvindo = null, ingOuvJunto = '', ingOuvAntes = '', ingOuvCanc = false, ingOuvRel = 0, ingOuvRel0 = 0, ingVozEspera = false;

/* a melhor voz DESTE aparelho: brasileira primeiro, a "melhorada" na frente */
function ingMelhorVoz() {
  if (!ING_SINTESE) return null;
  const todas = ING_SINTESE.getVoices() || [];
  const br = todas.filter(v => /^pt[-_]?br/i.test(v.lang || '')), pt = todas.filter(v => /^pt/i.test(v.lang || ''));
  const lista = br.length ? br : pt.length ? pt : todas;
  const nota = (v) => { const s = (v.name || '') + ' ' + (v.voiceURI || ''); let n = 0;
    if (/premium|enhanced|melhorad|neural|natural|siri/i.test(s)) n += 6; if (/google/i.test(s)) n += 3;
    if (/pt[-_]br/i.test(v.lang || '')) n += 4; if (v.localService) n += 1; if (/compact|eloquence|novelty/i.test(s)) n -= 8; return n; };
  return lista.slice().sort((a, b) => nota(b) - nota(a))[0] || null;
}
if (ING_SINTESE) { try { ING_SINTESE.getVoices(); ING_SINTESE.onvoiceschanged = () => ING_SINTESE.getVoices(); } catch (e) {} }
/* o que se fala: sem negrito, sem link, sem emoji de enfeite, sem "Copiar" */
function ingParaFalar(t) {
  return String(t || '').replace(/\*\*/g, '').replace(/https?:\/\/\S+/g, 'o link')
    .replace(/[•·]/g, ',').replace(/\b(ER|ORC)-\d+/g, '').replace(/[\u{1F300}-\u{1FAFF}☀-➿]/gu, '')
    .replace(/\n+/g, '. ').replace(/\s+/g, ' ').replace(/(\. ){2,}/g, '. ').trim().slice(0, 1200);
}
function ingFalar(t) {
  if (!ING_SINTESE || !ingVozCfg().ler) return;
  const txt = ingParaFalar(t); if (!txt) return;
  try { ING_SINTESE.cancel(); } catch (e) {}
  const u = new SpeechSynthesisUtterance(txt), v = ingMelhorVoz();
  if (v) { u.voice = v; u.lang = v.lang; } else u.lang = 'pt-BR';
  u.rate = Math.min(1.4, Math.max(0.7, +ingVozCfg().vel || 1)); u.pitch = 1;
  u.onstart = () => ingOrbe('fala', true); u.onend = u.onerror = () => ingOrbe('fala', false);
  try { ING_SINTESE.speak(u); } catch (e) {}
}
const ingPararFala = () => { try { ING_SINTESE && ING_SINTESE.cancel(); } catch (e) {} ingOrbe('fala', false); };
/* O ORBE (igual ao do TI ARTES): respira parado, acende quando ela fala
   (ouve), quando o assistente pensa e quando ele le em voz alta */
function ingOrbe(estado, liga) { const g = iaEl && iaEl.g; if (g) g.classList.toggle('ing-' + estado, !!liga); }
const _ingTravado = iaTravado;
iaTravado = function (sim) { ingOrbe('pensa', sim); return _ingTravado(sim); };

/* a resposta que chega depois de ela perguntar e lida em voz alta —
   o historico redesenhado ao abrir a gaveta, nao */
const _ingBolha = iaBolha;
iaBolha = function (tipo, texto, antesDe, semCopiar, foto) {
  /* o aviso interno dos anexos (⟦…⟧) e para a IA, nao para o balao dela */
  if (tipo === 'user' && typeof texto === 'string') texto = texto.replace(/\s*⟦[\s\S]*?⟧/g, '');
  const el = _ingBolha(tipo, texto, antesDe, semCopiar, foto);
  if (el.querySelectorAll) el.querySelectorAll('img[src^="data:application/pdf"]').forEach(im => { const sp = document.createElement('span'); sp.className = 'ia-pdf'; sp.textContent = '📄 PDF'; im.replaceWith(sp); });
  if (tipo === 'assistant' && ingVozEspera) ingFalar(texto);
  return el;
};
/* ANEXOS: o que ela manda no chat (print do Pix, PDF do comprovante,
   passaporte) vira anexo1, anexo2… desta conversa. Nao vai para as fotos de
   marketing. registrar_pagamento / arquivar guardam na ficha e no Drive. */
let ingAnexos = [];
function ingArquiva(ref, b, nome, tipo, descricao) {
  const a = ingAnexos.find(x => x.ref === ref); if (!a) return { erro: 'anexo não encontrado' };
  if (typeof Arquivos === 'undefined') return { erro: 'arquivos indisponíveis aqui' };
  const c = b && b.clienteId ? Cadastro.get(b.clienteId) : null;
  const { arquivo } = Arquivos.guarda({ src: a.src, nome, tipo, clienteId: (b && b.clienteId) || '', clienteNome: (c && c.nome) || (b && b.name) || '', bookingId: (b && b.id) || '', descricao });
  const onde = `guardado na ficha${drvEstado.liberada ? ' e no Google Drive: ' : '; vai para o Google Drive (' + (drvEstado.pasta ? 'o Chrome pede um toque — botão 📁 Google Drive' : 'ligue a pasta no botão 📁 Google Drive') + '): '}${guiaNegocio()} › Clientes › ${drvNome(arquivo.clienteNome || 'Sem cliente')}`;
  return { arquivo, onde };
}
const _ingMostraAnexo = iaMostraAnexo;
iaMostraAnexo = function () {
  _ingMostraAnexo();
  const el = iaEl && iaEl.g.querySelector('#iaAnexo');
  if (el) el.querySelectorAll('img[src^="data:application/pdf"]').forEach(im => { const sp = document.createElement('span'); sp.className = 'ia-pdf'; sp.textContent = '📄 PDF'; im.replaceWith(sp); });
};
const _ingConversa = iaConversa;
iaConversa = async function (texto, fotos) {
  ingPararFala(); ingVozEspera = true;
  fotos = !fotos ? [] : Array.isArray(fotos) ? fotos : [fotos];
  const base = ingAnexos.length;
  const novos = fotos.map((src, k) => ({ ref: 'anexo' + (base + k + 1), src, nome: /^data:application\/pdf/.test(src) ? 'PDF' : 'imagem' }));
  ingAnexos = ingAnexos.concat(novos).slice(-8);
  /* o Claude lê imagem E PDF: manda os dois para ele ler o comprovante direto */
  const nota = novos.length ? `\n\n⟦Ela anexou ${novos.map(a => `${a.ref} (${a.nome})`).join(', ')} — você CONSEGUE ler (imagem e PDF). Se for comprovante de pagamento: leia o valor e o nome, ache a reserva (buscar) e chame registrar_pagamento com anexo — fica na ficha e na pasta do cliente no Google Drive. Outro documento do cliente → arquivar.⟧` : '';
  /* não salva o anexo nas fotos de marketing nem deixa o motor gerar nota de "foto para criativo" */
  const _gf = guardaFoto; guardaFoto = () => null;
  try { return await _ingConversa((texto || (novos.length ? 'Te mandei um arquivo.' : '')) + nota, fotos); } finally { guardaFoto = _gf; ingVozEspera = false; }
};
const _ingCenario = iaRodaCenario;
iaRodaCenario = async function (c) {
  ingVozEspera = true;
  try { return await _ingCenario(c); } finally { ingVozEspera = false; }
};

function ingOuvPinta() {
  const g = iaEl && iaEl.g; if (!g) return;
  const mic = g.querySelector('#iaMic'), faixa = g.querySelector('#iaOuv');
  ingOrbe('ouve', !!ingOuvindo);
  if (mic) { const mt = mic.querySelector('.mic-t'); if (mt) mt.textContent = ingOuvindo ? 'Mandar' : 'Falar'; }
  if (mic) { mic.classList.toggle('gravando', !!ingOuvindo); mic.setAttribute('aria-label', ingOuvindo ? 'Mandar agora' : 'Falar'); mic.title = ingOuvindo ? 'Ouvindo — toque para mandar agora' : 'Falar — toque, fale, e vai sozinho quando você parar'; }
  if (faixa) faixa.hidden = !ingOuvindo;
}
function ingRelogio(liga) {
  clearInterval(ingOuvRel); ingOuvRel = 0;
  if (!liga) return;
  ingOuvRel0 = Date.now();
  const pinta = () => { const s = Math.floor((Date.now() - ingOuvRel0) / 1000), el = iaEl && iaEl.g.querySelector('#iaOuvRel'); if (el) el.textContent = Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  pinta(); ingOuvRel = setInterval(pinta, 500);
}
function ingOuvir() {
  if (ingOuvindo) { ingOuvManda(); return; }
  if (!ingTemMic()) { toast(ING_FALA ? 'O microfone só funciona no link do app (https).' : 'Este navegador não ouve. No iPhone use o Safari; no computador, o Chrome.'); return; }
  const ta = iaEl.g.querySelector('#iaTxt'); if (!ta) return;
  ingPararFala();
  const r = new ING_FALA();
  r.lang = 'pt-BR'; r.interimResults = true; r.maxAlternatives = 1;
  /* NAO ligar continuous: o fim por silencio e o que manda sozinho (licao do TI ARTES) */
  ingOuvAntes = ta.value.trim(); ingOuvJunto = ''; ingOuvCanc = false;
  const mostra = (meio) => {
    const tudo = [ingOuvAntes, ingOuvJunto, meio].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    ta.value = tudo; ta.style.height = ''; ta.style.height = Math.min(140, ta.scrollHeight) + 'px';
    const t = iaEl.g.querySelector('#iaOuvTxt'); if (t) t.textContent = tudo ? '“' + tudo.slice(-70) + '”' : 'Estou ouvindo — fale normal. Quando parar, eu mando.';
  };
  r.onresult = (e) => { let fim = '', meio = ''; for (let k = e.resultIndex; k < e.results.length; k++) { const t = e.results[k][0].transcript; if (e.results[k].isFinal) fim += t; else meio += t; } if (fim) ingOuvJunto = (ingOuvJunto + ' ' + fim).trim(); mostra(meio); };
  r.onerror = (e) => {
    ingOuvindo = null; ingRelogio(false); ingOuvPinta();
    const q = e && e.error;
    if (q === 'not-allowed' || q === 'service-not-allowed') toast('Falta liberar o microfone: toque no cadeado ao lado do endereço e permita.');
    else if (q === 'no-speech') toast('Não ouvi nada — toque de novo e fale mais perto.');
    else if (q === 'network') toast('Sem internet para transcrever a voz.');
    else if (q !== 'aborted') toast('Deu problema no microfone: ' + (q || '?'));
  };
  r.onend = () => {
    ingOuvindo = null; ingRelogio(false); ingOuvPinta();
    if (ingOuvCanc) { ta.value = ingOuvAntes; return; }
    const txt = ta.value.trim();
    if (txt && ingVozCfg().enviar !== false) iaEl.g.querySelector('#iaForm')?.requestSubmit();
    else ta.focus();
  };
  try { r.start(); ingOuvindo = r; mostra(''); ingRelogio(true); ingOuvPinta(); try { navigator.vibrate && navigator.vibrate(12); } catch (e) {} }
  catch (e) { toast('Não consegui abrir o microfone.'); }
}
function ingOuvManda() { ingOuvCanc = false; try { ingOuvindo && ingOuvindo.stop(); } catch (e) {} }
function ingOuvDescarta() { ingOuvCanc = true; try { ingOuvindo && ingOuvindo.stop(); } catch (e) {} toast('Descartei — o que você falou não foi enviado.'); }

/* a gaveta do motor ganha o microfone, a faixa de "ouvindo" e o "ler em voz alta" */
const _ingDesenha = iaDesenha;
iaDesenha = function () {
  _ingDesenha();
  const g = iaEl && iaEl.g, f = g && g.querySelector('#iaForm');
  const arq = g && g.querySelector('#iaArq');
  if (arq && !arq.dataset.pdf) {
    arq.dataset.pdf = '1'; arq.accept = 'image/*,application/pdf';
    arq.onchange = async () => {
      const files = [...arq.files].slice(0, 4 - iaFoto.length); arq.value = '';
      for (const file of files) {
        try {
          if (/pdf/.test(file.type)) { if (file.size > 5e6) throw new Error('PDF grande demais (máx. 5 MB).'); iaFoto.push(await new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = () => falha(new Error('não li o PDF')); r.readAsDataURL(file); })); }
          else iaFoto.push(await iaReduzFoto(file));
        } catch (e) { iaBolha('erro', e.message); }
      }
      iaMostraAnexo();
    };
  }
  const msgs0 = g && g.querySelector('#iaMsgs');
  if (msgs0 && !g.querySelector('.ingPalco')) msgs0.insertAdjacentHTML('beforebegin', `<div class="ingPalco" aria-hidden="true"><i class="ingOrbe"><i></i></i><span class="ingPalcoT">${ingTemMic() ? 'Toque em <b>Falar</b> e diga o que precisa' : 'Escreva o que precisa'}</span></div>`);
  if (f && !f.querySelector('#iaMic')) {
    f.insertAdjacentHTML('beforebegin', `<div id="iaOuv" class="iaOuv" hidden><span class="ingBarras" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></span><b id="iaOuvRel">0:00</b>
      <span id="iaOuvTxt">Estou ouvindo — fale normal. Quando parar, eu mando.</span>
      <button type="button" id="iaOuvManda">enviar</button><button type="button" id="iaOuvDesc">descartar</button></div>`);
    const ta = f.querySelector('#iaTxt');
    ta.insertAdjacentHTML('beforebegin', `<button type="button" id="iaMic" aria-label="Falar" title="Falar — toque, fale, e vai sozinho quando você parar" ${ingTemMic() ? '' : 'hidden'}>
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg><span class="mic-t">Falar</span></button>`);
    ta.placeholder = ingTemMic() ? 'Fale ou escreva do jeito que você fala…' : ta.placeholder;
    f.querySelector('#iaMic').onclick = ingOuvir;
    g.querySelector('#iaOuvManda').onclick = ingOuvManda;
    g.querySelector('#iaOuvDesc').onclick = ingOuvDescarta;
  }
  const pe = g && g.querySelector('#iaPe');
  if (pe && ING_SINTESE && !pe.querySelector('#iaLer')) {
    pe.insertAdjacentHTML('afterbegin', `<label title="Ler as respostas em voz alta"><input type="checkbox" id="iaLer" ${ingVozCfg().ler ? 'checked' : ''}> 🔈 ler em voz alta</label>`);
    pe.querySelector('#iaLer').onchange = (e) => {
      ingVozGrava({ ler: e.target.checked });
      if (e.target.checked) { const v = ingMelhorVoz(); toast(v ? 'Voz ligada: ' + v.name : 'Voz ligada'); ingFalar('Pronto. Agora eu leio as respostas em voz alta.'); }
      else { ingPararFala(); toast('Voz desligada'); }
    };
  }
  ingOuvPinta();
};
const _ingFecha = iaFecha;
iaFecha = function () { ingPararFala(); if (ingOuvindo) ingOuvDescarta(); return _ingFecha(); };
(function () {
  const st = document.createElement('style');
  st.textContent = `
/* ===== o visual do chat do TI ARTES, com as cores do painel (acompanha o tema e a cor) ===== */
#iaGaveta{background:var(--paper)}
#iaGaveta header{border-bottom:0;padding:14px 10px 6px 18px}
#iaGaveta .iaAv{border-radius:11px;background:linear-gradient(140deg,var(--accent),color-mix(in srgb,var(--accent) 55%,#000));color:var(--accent-ink);box-shadow:0 6px 18px -8px var(--accent)}
.ingPalco{display:flex;flex-direction:column;align-items:center;gap:8px;padding:4px 16px 12px;flex-shrink:0}
.ingPalcoT{font-size:12.5px;color:var(--ink-3)}
.ingOrbe{position:relative;width:74px;height:74px;border-radius:50%;display:block;
  background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--accent) 35%,#fff) 0%,var(--accent) 45%,color-mix(in srgb,var(--accent) 60%,#000) 100%);
  box-shadow:0 0 0 6px color-mix(in srgb,var(--accent) 12%,transparent),0 14px 38px -12px var(--accent);animation:ingRespira 4.2s ease-in-out infinite}
.ingOrbe i{position:absolute;inset:14%;border-radius:50%;background:radial-gradient(circle at 60% 65%,color-mix(in srgb,var(--highlight) 55%,transparent),transparent 62%);opacity:.55;animation:ingGira 9s linear infinite}
@keyframes ingRespira{0%,100%{transform:scale(1)}50%{transform:scale(1.045)}}
@keyframes ingGira{to{transform:rotate(360deg)}}
@keyframes ingPulso{0%,100%{box-shadow:0 0 0 6px color-mix(in srgb,var(--accent) 16%,transparent),0 14px 38px -12px var(--accent)}50%{box-shadow:0 0 0 16px color-mix(in srgb,var(--accent) 6%,transparent),0 18px 46px -10px var(--accent)}}
#iaGaveta.ing-fala .ingOrbe,#iaGaveta.ing-pensa .ingOrbe{animation:ingRespira 1.3s ease-in-out infinite,ingPulso 1.3s ease-in-out infinite}
#iaGaveta.ing-fala .ingOrbe i,#iaGaveta.ing-pensa .ingOrbe i{animation-duration:2.4s;opacity:.9}
#iaGaveta.ing-ouve .ingOrbe{background:radial-gradient(circle at 35% 30%,color-mix(in srgb,var(--danger) 30%,#fff) 0%,var(--danger) 50%,color-mix(in srgb,var(--danger) 60%,#000) 100%);animation:ingRespira .9s ease-in-out infinite}
@media(prefers-reduced-motion:reduce){.ingOrbe,.ingOrbe i,#iaGaveta .ingOrbe{animation:none!important}}
#iaMsgs{background:var(--paper);gap:14px;padding:6px 16px 16px}
.iaB{font-size:14.5px;line-height:1.6;box-shadow:none}
.iaB.assistant{margin-left:38px;border-radius:18px;border-top-left-radius:6px;border:1px solid var(--line);
  background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 5%,var(--surface)),var(--surface));max-width:calc(100% - 38px)}
.iaB.assistant::before{content:'✦';position:absolute;left:-38px;top:0;width:28px;height:28px;border-radius:9px;display:grid;place-items:center;font-size:13px;
  background:linear-gradient(140deg,var(--accent),color-mix(in srgb,var(--accent) 55%,#000));color:var(--accent-ink);box-shadow:0 5px 16px -6px var(--accent)}
.iaB.assistant + .iaB.assistant::before{visibility:hidden}
.iaB.user{border-radius:16px;border-top-right-radius:5px;color:var(--ink);border:1px solid var(--accent-line);
  background:linear-gradient(140deg,color-mix(in srgb,var(--accent) 20%,var(--surface)),color-mix(in srgb,var(--accent) 9%,var(--surface)))}
.iaB.pensa{margin-left:38px}
.iaCard{border-radius:18px;border-color:var(--highlight)}
.iaSug button{border-radius:14px;background:var(--surface)}
#iaForm{margin:6px 12px 8px;padding:9px;border:1px solid var(--line);border-radius:20px;gap:8px;align-items:flex-end;
  background:linear-gradient(160deg,color-mix(in srgb,var(--accent) 5%,var(--surface)),var(--surface));transition:border-color .25s,box-shadow .25s}
#iaForm:focus-within{border-color:color-mix(in srgb,var(--accent) 55%,transparent);box-shadow:0 0 0 4px color-mix(in srgb,var(--accent) 12%,transparent)}
#iaTxt{border:0;background:none;border-radius:12px;padding:10px 6px;min-height:42px}
#iaTxt:focus{outline:none}
#iaClip{width:40px;height:40px;border:0;background:var(--surface-2)}
#iaEnviar{width:42px;height:42px;border-radius:13px}
/* O MICROFONE E O BOTAO PRINCIPAL: grande e com nome ("Falar"), como no TI ARTES */
#iaMic{flex:none;display:inline-flex;align-items:center;gap:7px;height:42px;padding:0 16px;border-radius:13px;border:0;cursor:pointer;touch-action:manipulation;
  background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 70%,#fff),var(--accent));color:var(--accent-ink);font:700 14px var(--f-ui);
  box-shadow:0 8px 22px -10px var(--accent)}
#iaMic:hover{filter:brightness(1.06)}
#iaMic .mic-t{display:inline}
#iaMic.gravando{background:linear-gradient(135deg,color-mix(in srgb,var(--danger) 70%,#fff),var(--danger));color:#fff;animation:iaMicPulsa 1.1s ease-in-out infinite}
@keyframes iaMicPulsa{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--danger) 45%,transparent)}50%{box-shadow:0 0 0 10px transparent}}
@media(prefers-reduced-motion:reduce){#iaMic.gravando{animation:none}}
@media(max-width:400px){#iaMic{padding:0 12px}}
/* "ouvindo": barrinhas de som */
.iaOuv{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin:0 12px 6px;padding:9px 13px;border-radius:14px;background:var(--danger-wash);border:1px solid color-mix(in srgb,var(--danger) 30%,transparent);color:var(--ink);font-size:13px;font-weight:600}
.iaOuv[hidden]{display:none}
.ingBarras{display:flex;gap:2.5px;align-items:flex-end;height:16px;flex-shrink:0}
.ingBarras i{width:3px;height:100%;background:var(--danger);border-radius:2px;animation:ingOnda .9s ease-in-out infinite;transform-origin:bottom}
.ingBarras i:nth-child(2){animation-delay:.12s}.ingBarras i:nth-child(3){animation-delay:.24s}.ingBarras i:nth-child(4){animation-delay:.36s}.ingBarras i:nth-child(5){animation-delay:.48s}
@keyframes ingOnda{0%,100%{transform:scaleY(.3)}50%{transform:scaleY(1)}}
@media(prefers-reduced-motion:reduce){.ingBarras i{animation:none}}
.iaOuv b{font-variant-numeric:tabular-nums}
.iaOuv #iaOuvTxt{flex:1;min-width:120px;color:var(--ink-2);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.iaOuv button{border:0;border-radius:999px;padding:5px 11px;font-weight:600;font-size:12.5px;cursor:pointer;background:var(--surface);color:var(--ink)}
.iaOuv #iaOuvManda{background:var(--accent);color:var(--accent-ink)}
#iaPe{background:var(--paper);border-top:0}
#iaFab{background:linear-gradient(135deg,color-mix(in srgb,var(--accent) 75%,#fff),var(--accent));color:var(--accent-ink);box-shadow:0 10px 28px -10px var(--accent)}`;
  document.head.appendChild(st);
})();
