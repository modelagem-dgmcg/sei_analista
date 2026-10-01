/* ============================================================
   SEI ANALISTA + SEI GESTÃO — Code.gs (backend Google Apps Script)
   Versão gerada em 30/09/2026 11:02 (horário de Recife)
   Junção: servidor de 30/09 08:20 (sessão, segurança, registro) + rotas do servidor
   publicado v22 (Mensageiro, alertas, aba Perguntas, visto em, fontes oficiais).
   ============================================================
   © 2026 SES-PE — DGMCG/GGPCG. Desenvolvido por Antonio Cleuton Eufrasio Vieira,
   Analista Administrativo - CTD, matrícula 18515045.

   Um único backend atende os dois aplicativos do ecossistema:
   - SEI Analista (conferência de processos) — app "analista"
   - SEI Gestão (painel administrativo)      — app "gestao"

   COMO USAR (passo a passo):

   1) Crie (ou abra) uma planilha Google Sheets em branco.
   2) Menu Extensões → Apps Script.
   3) Apague o conteúdo padrão do arquivo "Code.gs" e cole TODO este arquivo.
   4) Salve (ícone de disquete ou Ctrl+S).
   5) Volte para a planilha (aba do navegador) e recarregue a página.
      Vai aparecer um novo menu "SEI Analista" na barra de menus.
   6) Clique em "SEI Analista → 1. Configurar planilha" — isso cria
      todas as abas necessárias automaticamente. Só precisa fazer uma vez.
   7) Clique em "SEI Analista → 2. Criar usuário" e cadastre você mesmo
      (nome, e-mail/login, senha, gerência). Repita para cada colega.
   8) Na Apps Script: Implantar → Nova implantação → tipo "App da Web".
        - Executar como: Eu (sua conta)
        - Quem pode acessar: qualquer pessoa com o link que puder no domínio
          (ou "Qualquer pessoa" se quiser acesso fora do login institucional)
          — mantenha a mesma opção que já está em uso na implantação atual.
      Clique em "Implantar" e AUTORIZE as permissões pedidas.
   9) Copie a URL que termina em ".../exec" — essa é a URL da API usada
      pelo SEI Analista e pelo SEI Gestão.

   Sempre que você EDITAR este código depois de já ter implantado, precisa
   fazer "Gerenciar implantações → editar (lápis) → Nova versão → Implantar"
   para as mudanças valerem na URL já publicada.

   SEGURANÇA (desde a versão com sessão):
   - O login gera uma sessão (token temporário). Toda chamada precisa apresentar
     esse token; sem ele, o backend recusa.
   - Quem é a pessoa vem SEMPRE da sessão, nunca do que o navegador escreve.
   - A senha é guardada com um código aleatório diferente para cada pessoa.
     Senhas no formato antigo são convertidas sozinhas no primeiro login.
   - Coluna "apps" da aba Usuarios: vazia = acesso ao SEI Analista (e ao SEI
     Gestão, se o perfil for "admin"). Preenchida (ex.: "analista, gestao")
     = só os apps listados. O SEI Gestão exige sempre perfil "admin".
   ============================================================ */

// ==================== VERSÃO ====================
// Atualizar a cada nova entrega. É enviada ao app no login e aparece no rodapé da tela.
const VERSAO_BACKEND = '30/09/2026 11:02';

// ==================== ESTRUTURA DA PLANILHA ====================

const SHEETS = {
  USUARIOS:        'Usuarios',
  PROCESSOS:       'Processos',
  DOCUMENTOS:      'Documentos',
  CONTEUDO:        'ConteudoBlocos',
  AUDITORIAS:      'Auditorias',
  TRAMITACOES:     'Tramitacoes',
  CONSULTAS:       'Consultas',
  ACOMPANHAMENTOS: 'Acompanhamentos',
  NOTAS:           'Notas',
  ACHADOS_CONSULTAS: 'AchadosConsultas',
  LOG:             'Log',
  MENSAGENS:       'Mensagens'
};

const CABECALHOS = {
  Usuarios:        ['id','nome','email','senha_hash','gerencia','ativo','perfil','apps'],
  Processos:       ['id','numero_sei','titulo','unidade','oss','gerencia','status','responsavel_atual','criado_por','criado_em','atualizado_em','documento_final','tipo_processo','data_limite'],
  Documentos:      ['id','processo_id','nome_arquivo','adicionado_por','adicionado_em','resumo_sensiveis','tipo_documento'],
  ConteudoBlocos:  ['id','documento_id','bloco_num','conteudo'],
  Auditorias:      ['id','processo_id','tipo_checkpoint','data','executado_por','qtd_achados','achados_json','raw_ia'],
  Tramitacoes:     ['id','processo_id','de_usuario','para_usuario','data','observacao','lido_em','lido_por'],
  Mensagens:       ['id','conversa_id','de_usuario','de_nome','texto','enviado_em','lido_por'],
  Consultas:       ['id','processo_id','pergunta','resposta','usuario','data'],
  Acompanhamentos: ['id','processo_id','usuario','ativo'],
  Notas:           ['id','processo_id','referencia','nota','usuario','data'],
  AchadosConsultas: ['id','processo_id','achado_referencia','de_usuario','para_usuario','mensagem','resposta','data_envio','data_resposta'],
  Log:             ['id','data','usuario','acao','processo_id','detalhes','app']
};

// Status possíveis de um processo — o front-end usa esses textos exatos
const STATUS = {
  AGUARDANDO_INICIAL: 'Aguardando Revisão Inicial',
  EM_ANALISE:         'Em Análise',
  AGUARDANDO_FINAL:   'Aguardando Revisão Final',
  PRONTO_ASSINAR:     'Pronto para Assinar no SEI'
};

// Tamanho máximo de um bloco de texto por célula (limite prático do Sheets)
const BLOCO_MAX_CHARS = 45000;

// ==================== CONFIGURAÇÃO DE SEGURANÇA ====================

const APPS_VALIDOS = ['analista', 'gestao'];
const SESSAO_INATIVIDADE_MS = 8 * 60 * 60 * 1000;   // sem uso por 8h → sessão vence
const SESSAO_MAXIMA_MS      = 16 * 60 * 60 * 1000;  // mesmo em uso, vence depois de 16h
const SESSAO_RENOVAR_MS     = 5 * 60 * 1000;        // regrava a sessão no máximo a cada 5 min
const SESSAO_CACHE_S        = 10 * 60;              // cópia rápida da sessão no cache (poupa a cota diária)
const SENHA_ITERACOES       = 500;                  // repetições do cálculo da senha guardada
const LOGIN_MAX_FALHAS      = 5;                    // tentativas erradas seguidas antes do bloqueio
const LOGIN_BLOQUEIO_S      = 15 * 60;              // bloqueio de 15 minutos

// ==================== MENU DA PLANILHA ====================

function onOpen() {
  SpreadsheetApp.getUi().createMenu('SEI Analista')
    .addItem('1. Configurar planilha (rodar uma vez)', 'configurarPlanilha')
    .addItem('2. Criar usuário', 'criarUsuario')
    .addItem('3. Trocar senha de um usuário', 'trocarSenhaUsuario')
    .addItem('4. Encerrar todas as sessões abertas', 'encerrarTodasSessoes')
    .addItem('5. Arquivar agora o registro de atividades antigo', 'menuArquivarLog')
    .addItem('6. Ativar arquivamento automático do registro (mensal)', 'ativarArquivamentoAutomaticoLog')
    .addToUi();
}

function configurarPlanilha() {
  Object.keys(CABECALHOS).forEach(nome => getSheet(nome));
  _protegerSenhasAntigas(lerLinhas(SHEETS.USUARIOS));
  _protegerAbaLog();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ['Página1', 'Sheet1', 'Planilha1'].forEach(n => {
    const sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });
  SpreadsheetApp.getUi().alert(
    'Planilha configurada com sucesso! (versão do servidor: ' + VERSAO_BACKEND + ')\n\nAbas criadas: ' + Object.keys(CABECALHOS).join(', ') +
    '\n\nPróximo passo: menu "SEI Analista → 2. Criar usuário" para cadastrar você e seus colegas.'
  );
}

function criarUsuario() {
  const ui = SpreadsheetApp.getUi();
  const nome = ui.prompt('Novo usuário', 'Nome completo:', ui.ButtonSet.OK_CANCEL);
  if (nome.getSelectedButton() !== ui.Button.OK || !nome.getResponseText().trim()) return;

  const email = ui.prompt('Novo usuário', 'E-mail ou login (precisa ser único):', ui.ButtonSet.OK_CANCEL);
  if (email.getSelectedButton() !== ui.Button.OK || !email.getResponseText().trim()) return;

  const emailValor = email.getResponseText().trim().toLowerCase();
  if (lerLinhas(SHEETS.USUARIOS).some(u => String(u.email).toLowerCase() === emailValor)) {
    ui.alert('Já existe um usuário com esse e-mail/login.');
    return;
  }

  const senha = ui.prompt('Novo usuário', 'Senha inicial (o usuário pode pedir troca depois):', ui.ButtonSet.OK_CANCEL);
  if (senha.getSelectedButton() !== ui.Button.OK || !senha.getResponseText().trim()) return;

  const gerencia = ui.prompt('Novo usuário', 'Gerência/caixa (ex.: GGPCG, GAOCG, Diretoria...):', ui.ButtonSet.OK_CANCEL);
  if (gerencia.getSelectedButton() !== ui.Button.OK) return;

  const perfilResp = ui.prompt('Novo usuário', 'Perfil — digite "admin" para acesso ao SEI Gestão, ou deixe em branco para usuário comum:', ui.ButtonSet.OK_CANCEL);
  if (perfilResp.getSelectedButton() !== ui.Button.OK) return;
  const perfil = perfilResp.getResponseText().trim().toLowerCase() === 'admin' ? 'admin' : 'usuario';

  const id = proximoId(SHEETS.USUARIOS);
  inserirLinha(SHEETS.USUARIOS, {
    id, nome: nome.getResponseText().trim(), email: emailValor,
    // O navegador manda a senha já transformada (sha256); aqui guardamos uma segunda
    // transformação, com código aleatório próprio da pessoa.
    senha_hash: _gerarSenhaArmazenada(sha256Hex(senha.getResponseText())),
    gerencia: gerencia.getResponseText().trim(), ativo: true, perfil, apps: ''
  });
  ui.alert('Usuário "' + nome.getResponseText().trim() + '" criado com sucesso!');
}

function trocarSenhaUsuario() {
  const ui = SpreadsheetApp.getUi();
  const email = ui.prompt('Trocar senha', 'E-mail/login do usuário:', ui.ButtonSet.OK_CANCEL);
  if (email.getSelectedButton() !== ui.Button.OK) return;
  const emailValor = email.getResponseText().trim().toLowerCase();
  const usuarios = lerLinhas(SHEETS.USUARIOS);
  const u = usuarios.find(x => String(x.email).toLowerCase() === emailValor);
  if (!u) { ui.alert('Usuário não encontrado.'); return; }

  const novaSenha = ui.prompt('Trocar senha', 'Nova senha para ' + u.nome + ':', ui.ButtonSet.OK_CANCEL);
  if (novaSenha.getSelectedButton() !== ui.Button.OK || !novaSenha.getResponseText().trim()) return;

  atualizarLinha(SHEETS.USUARIOS, u.id, { senha_hash: _gerarSenhaArmazenada(sha256Hex(novaSenha.getResponseText())) });
  // Senha trocada = qualquer sessão aberta com a senha antiga deixa de valer.
  const encerradas = _encerrarSessoesDoUsuario(emailValor);
  CacheService.getScriptCache().remove('falhas_' + sha256Hex(emailValor));
  ui.alert('Senha atualizada.' + (encerradas ? '\n' + encerradas + ' sessão(ões) aberta(s) desse usuário foram encerradas.' : ''));
}

function encerrarTodasSessoes() {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.alert('Encerrar sessões', 'Todas as pessoas logadas no SEI Analista e no SEI Gestão vão precisar entrar de novo. Continuar?', ui.ButtonSet.YES_NO);
  if (resp !== ui.Button.YES) return;
  let total = 0;
  PropertiesService.getScriptProperties().getKeys().forEach(k => {
    if (k.indexOf('sess_') === 0) { _apagarSessao(k); total++; }
  });
  ui.alert(total + ' sessão(ões) encerrada(s).');
}

// ==================== SENHA ====================

function _bytesHex(bytes) {
  return bytes.map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function sha256Hex(texto) {
  return _bytesHex(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, texto, Utilities.Charset.UTF_8));
}

// Transformação lenta e com código aleatório (salt) próprio de cada pessoa: mesmo que
// alguém leia a aba Usuarios, o que está lá não serve para entrar no sistema.
function _derivarSenha(salt, hashCliente) {
  let bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + hashCliente, Utilities.Charset.UTF_8);
  const extra = Utilities.newBlob(salt).getBytes();
  for (let i = 0; i < SENHA_ITERACOES; i++) {
    bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes.concat(extra));
  }
  return _bytesHex(bytes);
}

function _gerarSenhaArmazenada(hashCliente) {
  const salt = Utilities.getUuid().replace(/-/g, '');
  return 'v2$' + salt + '$' + _derivarSenha(salt, hashCliente);
}

// Devolve { ok, migrar } — "migrar" = senha ainda no formato antigo, converter agora.
function _conferirSenha(armazenado, hashCliente) {
  const s = String(armazenado || '');
  const h = String(hashCliente || '');
  if (!h || !/^[0-9a-f]{64}$/.test(h)) return { ok: false, migrar: false };
  if (s.indexOf('v2$') === 0) {
    const partes = s.split('$');
    if (partes.length !== 3) return { ok: false, migrar: false };
    return { ok: _derivarSenha(partes[1], h) === partes[2], migrar: false };
  }
  return { ok: s.length === 64 && s === h, migrar: true };
}

// ==================== SESSÃO ====================

// Apps a que a pessoa tem acesso. Coluna "apps" vazia = padrão (analista; e gestao se admin).
function _appsDoUsuario(u) {
  const lista = String(u.apps || '').toLowerCase().split(/[\s,;]+/).filter(a => APPS_VALIDOS.indexOf(a) > -1);
  if (lista.length) return lista;
  const padrao = ['analista'];
  if (u.perfil === 'admin') padrao.push('gestao');
  return padrao;
}

function _temAcesso(apps, perfil, app) {
  if (app === 'gestao') return perfil === 'admin' && apps.indexOf('gestao') > -1;
  return apps.indexOf(app) > -1;
}

// A chave guardada é a "impressão digital" do token, não o token em si.
function _chaveSessao(token) { return 'sess_' + sha256Hex(token); }

function _criarSessao(u, apps, app) {
  const token = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  const agora = Date.now();
  const dados = {
    email: String(u.email).toLowerCase(), nome: u.nome, perfil: u.perfil || 'usuario',
    apps, app: app || '', criado: agora, ultimo: agora, conferido: agora
  };
  _salvarSessao(_chaveSessao(token), dados);
  return token;
}

// A sessão fica guardada em dois lugares: nas Propriedades do Script (definitivo) e no
// cache (cópia rápida). Ler do cache primeiro evita estourar a cota diária de leituras
// das Propriedades — cada tela aberta faz uma checagem automática a cada 45 segundos.
function _salvarSessao(chave, dados) {
  const json = JSON.stringify(dados);
  PropertiesService.getScriptProperties().setProperty(chave, json);
  CacheService.getScriptCache().put(chave, json, SESSAO_CACHE_S);
}

function _apagarSessao(chave) {
  PropertiesService.getScriptProperties().deleteProperty(chave);
  CacheService.getScriptCache().remove(chave);
}

// "emSegundoPlano" = chamada automática do app (o aviso de processo novo, a cada 45s).
// Ela NÃO conta como uso: senão, deixar o app aberto num computador sozinho manteria a
// sessão viva para sempre e o limite de 8h sem uso nunca funcionaria.
function _lerSessao(token, emSegundoPlano) {
  if (!token || typeof token !== 'string' || token.length < 32) return null;
  const chave = _chaveSessao(token);
  const cache = CacheService.getScriptCache();
  let bruto = cache.get(chave);
  if (!bruto) {
    bruto = PropertiesService.getScriptProperties().getProperty(chave);
    if (!bruto) return null;
    cache.put(chave, bruto, SESSAO_CACHE_S);
  }
  let s;
  try { s = JSON.parse(bruto); } catch (e) { _apagarSessao(chave); return null; }
  const agora = Date.now();
  if (agora - s.ultimo > SESSAO_INATIVIDADE_MS || agora - s.criado > SESSAO_MAXIMA_MS) {
    _apagarSessao(chave);
    return null;
  }
  let mudou = false;
  // De tempos em tempos, confere se a pessoa continua ativa e atualiza perfil/apps
  // (assim, desativar alguém na planilha derruba a sessão em até 5 min).
  if (agora - (s.conferido || s.criado) > SESSAO_RENOVAR_MS) {
    const u = lerLinhas(SHEETS.USUARIOS).find(x => String(x.email).toLowerCase() === s.email);
    if (!u || String(u.ativo).toUpperCase() === 'FALSE') { _apagarSessao(chave); return null; }
    s.nome = u.nome; s.perfil = u.perfil || 'usuario'; s.apps = _appsDoUsuario(u);
    s.conferido = agora;
    mudou = true;
  }
  if (!emSegundoPlano && agora - s.ultimo > SESSAO_RENOVAR_MS) {
    s.ultimo = agora;
    mudou = true;
  }
  if (mudou) _salvarSessao(chave, s);
  return s;
}

function _limparSessoesVencidas() {
  const todas = PropertiesService.getScriptProperties().getProperties();
  const agora = Date.now();
  Object.keys(todas).forEach(k => {
    if (k.indexOf('sess_') !== 0) return;
    try {
      const s = JSON.parse(todas[k]);
      if (agora - s.ultimo > SESSAO_INATIVIDADE_MS || agora - s.criado > SESSAO_MAXIMA_MS) _apagarSessao(k);
    } catch (e) { _apagarSessao(k); }
  });
}

function _encerrarSessoesDoUsuario(email) {
  const todas = PropertiesService.getScriptProperties().getProperties();
  let total = 0;
  Object.keys(todas).forEach(k => {
    if (k.indexOf('sess_') !== 0) return;
    try {
      if (JSON.parse(todas[k]).email === String(email).toLowerCase()) { _apagarSessao(k); total++; }
    } catch (e) { /* ignora */ }
  });
  return total;
}

// Converte de uma vez TODAS as senhas ainda no formato antigo. Dá para fazer sem saber
// a senha de ninguém, porque o formato antigo é exatamente o que o navegador envia.
// Roda no primeiro login depois da atualização — fecha a janela em que uma senha antiga,
// de quem ainda não entrou, poderia ser usada por quem lesse a planilha.
function _protegerSenhasAntigas(usuarios) {
  let total = 0;
  usuarios.forEach(x => {
    const h = String(x.senha_hash || '');
    if (/^[0-9a-f]{64}$/.test(h)) {
      atualizarLinha(SHEETS.USUARIOS, x.id, { senha_hash: _gerarSenhaArmazenada(h) });
      total++;
    }
  });
  return total;
}

// ==================== HELPERS DE PLANILHA (banco de dados) ====================

// Abas cujo cabeçalho já foi conferido nesta execução — evita ler a primeira linha da
// planilha a cada chamada.
const _cabecalhosConferidos = {};

function getSheet(nome) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nome);
  if (!sh) {
    sh = ss.insertSheet(nome);
    sh.appendRow(CABECALHOS[nome]);
    sh.setFrozenRows(1);
    _cabecalhosConferidos[nome] = true;
    return sh;
  }
  // Migração automática: quando uma coluna nova é criada no código (ex.: apps,
  // tipo_documento), a aba que JÁ EXISTE não ganha o cabeçalho sozinha — o dado seria
  // gravado numa coluna sem nome e nunca lido de volta. Aqui completamos o cabeçalho.
  if (!_cabecalhosConferidos[nome]) {
    const esperado = CABECALHOS[nome];
    const ultimaCol = sh.getLastColumn();
    const atual = ultimaCol > 0 ? sh.getRange(1, 1, 1, ultimaCol).getValues()[0] : [];
    if (atual.length < esperado.length) {
      sh.getRange(1, 1, 1, esperado.length).setValues([esperado]);
    }
    _cabecalhosConferidos[nome] = true;
  }
  return sh;
}

function lerLinhas(nomeAba) {
  const sh = getSheet(nomeAba);
  const dados = sh.getDataRange().getValues();
  if (dados.length < 2) return [];
  const cab = dados[0];
  return dados.slice(1)
    .filter(l => l[0] !== '' && l[0] !== null)
    .map(l => {
      const obj = {};
      cab.forEach((c, i) => obj[c] = l[i]);
      return obj;
    });
}

function proximoId(nomeAba) {
  const linhas = lerLinhas(nomeAba);
  if (!linhas.length) return 1;
  return Math.max(...linhas.map(l => Number(l.id) || 0)) + 1;
}

function inserirLinha(nomeAba, obj) {
  const sh = getSheet(nomeAba);
  const cab = CABECALHOS[nomeAba];
  const linha = cab.map(c => (obj[c] !== undefined && obj[c] !== null) ? obj[c] : '');
  sh.appendRow(linha);
  return obj;
}

function atualizarLinha(nomeAba, id, patch) {
  const sh = getSheet(nomeAba);
  const dados = sh.getDataRange().getValues();
  const cab = dados[0];
  const idxId = cab.indexOf('id');
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][idxId]) === String(id)) {
      Object.keys(patch).forEach(k => {
        const idxCol = cab.indexOf(k);
        if (idxCol > -1) sh.getRange(i + 1, idxCol + 1).setValue(patch[k]);
      });
      return true;
    }
  }
  return false;
}

function excluirLinha(nomeAba, id) {
  const sh = getSheet(nomeAba);
  const dados = sh.getDataRange().getValues();
  const idxId = dados[0].indexOf('id');
  for (let i = dados.length - 1; i >= 1; i--) {
    if (String(dados[i][idxId]) === String(id)) { sh.deleteRow(i + 1); return true; }
  }
  return false;
}

// ==================== ROTEADOR HTTP ====================

function doGet(e)  { return roteador(e); }
function doPost(e) { return roteador(e); }

const ROTAS = {
  'auth/login':                  authLogin,
  'auth/logout':                 authLogout,
  'usuarios/listar':             usuariosListar,
  'processos/listar':            processosListar,
  'processos/obter':             processosObter,
  'processos/criar':             processosCriar,
  'processos/atualizar-status':  processosAtualizarStatus,
  'processos/encaminhar':        processosEncaminhar,
  'processos/contagens':         processosContagens,
  'processos/parar-acompanhamento': processosPararAcompanhamento,
  'processos/remover':           processosRemover,
  'tramitacoes/listar':          tramitacoesListar,
  'consultas/salvar':            consultasSalvar,
  'adm/estatisticas':             admEstatisticas,
  'adm/achados-todos':            admAchadosTodos,
  'adm/log':                      admLog,
  'adm/painel':                   admPainel,
  'notas/salvar':                 notasSalvar,
  'notas/listar':                 notasListar,
  'achados/encaminhar':           achadosEncaminhar,
  'achados/listar':                achadosListar,
  'achados/contar-pendentes':      achadosContarPendentes,
  'achados/responder':            achadosResponder,
  'consultas/listar':            consultasListar,
  'documentos/listar':           documentosListar,
  'documentos/adicionar':        documentosAdicionar,
  'documentos/adicionar-completo': documentosAdicionarCompleto,
  'documentos/remover':          documentosRemover,
  'conteudo/salvar-bloco':       conteudoSalvarBloco,
  'conteudo/listar':             conteudoListar,
  'auditorias/salvar':           auditoriasSalvar,
  'auditorias/listar':           auditoriasListar,
  'normas/buscar-por-unidade':   normasBuscarPorUnidade,
  'log/registrar':               logRegistrar,
  'mensagens/enviar':            mensagensEnviar,
  'mensagens/listar':            mensagensListar,
  'mensagens/contatos':          mensagensContatos,
  'processos/marcar-lido':       processosMarcarLido,
  'processos/alertas':           processosAlertas,
  'achados/meus':                achadosMeus,
  'fontes/testar':               fontesTestar
};

// Rotas que só LEEM a planilha. Elas não entram na fila (trava) das gravações: antes,
// tudo esperava numa fila única de até 10s, e ao abrir um processo (cerca de 6 pedidos
// de uma vez, um deles pesado — o texto dos documentos) a leitura do histórico de
// perguntas podia desistir sozinha e a tela ficava vazia. A trava continua valendo para
// quem GRAVA, que é onde ela é necessária (evita dois registros com o mesmo número).
const ROTAS_SO_LEITURA = {
  'usuarios/listar': true, 'processos/listar': true, 'processos/obter': true,
  'processos/contagens': true, 'tramitacoes/listar': true, 'consultas/listar': true,
  'notas/listar': true, 'achados/listar': true, 'achados/contar-pendentes': true,
  'documentos/listar': true, 'conteudo/listar': true, 'auditorias/listar': true,
  'normas/buscar-por-unidade': true, 'adm/estatisticas': true, 'adm/achados-todos': true,
  'adm/log': true, 'adm/painel': true,
  'mensagens/contatos': true, 'processos/alertas': true, 'achados/meus': true, 'fontes/testar': true
};
const ESPERA_FILA_GRAVACAO_MS = 30000;

// Únicas rotas que funcionam sem sessão válida.
const ROTAS_PUBLICAS = { 'auth/login': true, 'auth/logout': true };

// Campos em que o navegador dizia "quem sou eu". Com a sessão, TODOS passam a ser
// preenchidos pelo backend com o e-mail de quem está logado — o que vier do navegador
// é descartado. Assim ninguém consegue agir ou registrar trabalho em nome de outra pessoa.
// ("responsavel" fica de fora de propósito: é filtro de consulta, tratado dentro de
// processosListar e processosContagens — o gestor pode consultar outra pessoa.)
const CAMPOS_IDENTIDADE = ['criado_por', 'responsavel_atual', 'de', 'usuario',
  'de_usuario', 'adicionado_por', 'executado_por', 'admin_email'];

function _ehGestor(s) { return !!s && _temAcesso(s.apps || [], s.perfil, 'gestao'); }

function roteador(e) {
  const action = ((e && e.parameter && e.parameter.action) || '').trim();
  const lock = ROTAS_SO_LEITURA[action] ? null : LockService.getScriptLock();
  if (lock) {
    try {
      lock.waitLock(ESPERA_FILA_GRAVACAO_MS);
    } catch (err) {
      return saida({ ok: false, erro: 'Sistema ocupado, tente novamente em instantes.' });
    }
  }
  try {
    let body = {};
    if (e.postData && e.postData.contents) {
      try { body = JSON.parse(e.postData.contents); } catch (err) { /* corpo vazio ou inválido */ }
    }
    // Corpo que não é um objeto (ex.: "null", lista, texto) é tratado como vazio.
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
    const emSegundoPlano = body._fundo === true;
    // O token só é aceito no corpo da chamada — nunca no endereço (endereço fica em histórico).
    const token = typeof body.token === 'string' ? body.token : '';
    const params = Object.assign({}, e.parameter, body);
    delete params.token;
    delete params._sessao;
    delete params._fundo;

    const fn = ROTAS[action];
    if (!fn) return saida({ ok: false, erro: 'Ação desconhecida: ' + action });

    let sessao = null;
    if (ROTAS_PUBLICAS[action]) {
      params._token = token;
      // Para registrar "saiu", lê quem é antes de a sessão ser apagada.
      if (action === 'auth/logout') sessao = _lerSessao(token, true);
    } else {
      sessao = _lerSessao(token, emSegundoPlano);
      if (!sessao) {
        return saida({ ok: false, sessao_expirada: true, erro: 'Sua sessão expirou ou não é válida. Entre de novo.' });
      }
      CAMPOS_IDENTIDADE.forEach(c => { params[c] = sessao.email; });
      params._sessao = sessao;
    }

    let resultado;
    try {
      resultado = fn(params) || {};
    } catch (err) {
      _registrarAtividade(action, params, { ok: false, erro: String(err && err.message || err) }, sessao);
      throw err;
    }
    _registrarAtividade(action, params, resultado, sessao);
    // Campos internos (começam com "_") servem só ao registro — não vão para o navegador.
    Object.keys(resultado).forEach(k => { if (k.charAt(0) === '_') delete resultado[k]; });
    if (resultado.ok === false) return saida(resultado);
    return saida(Object.assign({ ok: true }, resultado));
  } catch (err) {
    return saida({ ok: false, erro: String(err && err.message || err) });
  } finally {
    if (lock) lock.releaseLock();
  }
}

function saida(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ==================== AUTENTICAÇÃO ====================

function authLogin(p) {
  const emailValor = String(p.email || '').trim().toLowerCase();
  const app = String(p.app || 'analista').trim().toLowerCase();
  if (APPS_VALIDOS.indexOf(app) === -1) return { ok: false, erro: 'Aplicativo desconhecido.' };
  if (!emailValor) return { ok: false, erro: 'Usuário ou senha inválidos.' };

  // Bloqueio temporário depois de várias senhas erradas seguidas para o mesmo login.
  const cache = CacheService.getScriptCache();
  const chaveFalhas = 'falhas_' + sha256Hex(emailValor);
  const falhas = Number(cache.get(chaveFalhas)) || 0;
  if (falhas >= LOGIN_MAX_FALHAS) {
    return { ok: false, erro: 'Muitas tentativas com senha errada. Aguarde 15 minutos e tente de novo.' };
  }

  const usuarios = lerLinhas(SHEETS.USUARIOS);
  const u = usuarios.find(x =>
    String(x.email).toLowerCase() === emailValor && String(x.ativo).toUpperCase() !== 'FALSE'
  );
  const conferencia = u ? _conferirSenha(u.senha_hash, p.senha_hash) : { ok: false };
  if (!conferencia.ok) {
    cache.put(chaveFalhas, String(falhas + 1), LOGIN_BLOQUEIO_S);
    return { ok: false, erro: 'Usuário ou senha inválidos.' };
  }
  cache.remove(chaveFalhas);

  // Ainda há senha no formato antigo (desta pessoa ou de outras): converte todas agora.
  if (conferencia.migrar || usuarios.some(x => /^[0-9a-f]{64}$/.test(String(x.senha_hash || '')))) {
    _protegerSenhasAntigas(usuarios);
  }

  const perfil = u.perfil || 'usuario';
  const apps = _appsDoUsuario(u);
  if (!_temAcesso(apps, perfil, app)) {
    return { ok: false, erro: app === 'gestao' ? 'Seu usuário não tem acesso ao SEI Gestão.' : 'Seu usuário não tem acesso a este aplicativo.' };
  }

  _limparSessoesVencidas();
  const token = _criarSessao(u, apps, app);
  return { token, versao_backend: VERSAO_BACKEND, usuario: { id: u.id, nome: u.nome, email: u.email, gerencia: u.gerencia, perfil, apps } };
}

function authLogout(p) {
  if (p._token && typeof p._token === 'string' && p._token.length >= 32) {
    _apagarSessao(_chaveSessao(p._token));
  }
  return {};
}

// Lista usuários ativos para popular o seletor de "encaminhar para" — nunca inclui senha_hash
function usuariosListar() {
  const usuarios = lerLinhas(SHEETS.USUARIOS)
    .filter(u => String(u.ativo).toUpperCase() !== 'FALSE')
    .map(u => ({ id: u.id, nome: u.nome, email: u.email, gerencia: u.gerencia }));
  return { usuarios };
}

// ==================== PROCESSOS ====================

function processosListar(p) {
  let lista = lerLinhas(SHEETS.PROCESSOS);
  if (p.gerencia) lista = lista.filter(x => x.gerencia === p.gerencia);

  const s = p._sessao;
  if (p.caixa) {
    const resp = s.email; // caixas são sempre de quem está logado
    const acompanhadosIds = lerLinhas(SHEETS.ACOMPANHAMENTOS)
      .filter(a => String(a.usuario).toLowerCase() === resp && String(a.ativo).toUpperCase() !== 'FALSE')
      .map(a => String(a.processo_id));

    if (p.caixa === 'entrada') {
      lista = lista.filter(x => String(x.responsavel_atual).toLowerCase() === resp && x.status === STATUS.AGUARDANDO_INICIAL);
    } else if (p.caixa === 'andamento') {
      lista = lista.filter(x => String(x.responsavel_atual).toLowerCase() === resp &&
        (x.status === STATUS.EM_ANALISE || x.status === STATUS.AGUARDANDO_FINAL || x.status === STATUS.PRONTO_ASSINAR));
    } else if (p.caixa === 'encaminhados') {
      lista = lista.filter(x => acompanhadosIds.includes(String(x.id)));
    } else if (p.caixa === 'concluidos') {
      lista = lista.filter(x => x.status === 'Concluído' &&
        (String(x.responsavel_atual).toLowerCase() === resp || acompanhadosIds.includes(String(x.id))));
    }
  } else {
    // Sem "caixa" (uso do SEI Gestão): o gestor pode filtrar por qualquer pessoa ou ver
    // todos; quem não é gestor só vê os processos que estão com ele.
    const filtroResp = _ehGestor(s) ? String(p.responsavel || '').toLowerCase() : s.email;
    if (filtroResp) lista = lista.filter(x => String(x.responsavel_atual).toLowerCase() === filtroResp);
    if (p.status)      lista = lista.filter(x => x.status === p.status);
  }

  if (p.busca) {
    const termo = String(p.busca).toLowerCase();
    lista = lista.filter(x => (String(x.numero_sei) + ' ' + String(x.titulo) + ' ' + String(x.unidade)).toLowerCase().includes(termo));
  }

  // Lê cada aba de apoio UMA vez e organiza por processo — antes, cada processo da lista
  // percorria as abas inteiras de novo (fica lento conforme a planilha cresce).
  const qtdDocsPorProc = {};
  lerLinhas(SHEETS.DOCUMENTOS).forEach(d => {
    const k = String(d.processo_id); qtdDocsPorProc[k] = (qtdDocsPorProc[k] || 0) + 1;
  });
  const ultimaAudPorProc = {};
  lerLinhas(SHEETS.AUDITORIAS).forEach(a => {
    const k = String(a.processo_id), atual = ultimaAudPorProc[k];
    if (!atual || new Date(a.data) > new Date(atual.data)) ultimaAudPorProc[k] = a;
  });
  const ultimaTramPorProc = {};
  lerLinhas(SHEETS.TRAMITACOES).forEach(t => {
    const k = String(t.processo_id), atual = ultimaTramPorProc[k];
    if (!atual || new Date(t.data) > new Date(atual.data)) ultimaTramPorProc[k] = t;
  });
  // Perguntas sobre achados esperando resposta DE QUEM ESTÁ LOGADO, por processo. Antes, a
  // tela fazia um pedido ao servidor para cada cartão só para saber isso (20 processos =
  // 20 idas e voltas em sequência); agora vem tudo junto, nesta mesma resposta.
  const pendentesPorProc = {};
  lerLinhas(SHEETS.ACHADOS_CONSULTAS).forEach(a => {
    if (a.resposta || String(a.para_usuario).toLowerCase() !== s.email) return;
    const k = String(a.processo_id); pendentesPorProc[k] = (pendentesPorProc[k] || 0) + 1;
  });

  lista = lista.map(proc => {
    const k = String(proc.id);
    const ultima = ultimaAudPorProc[k];
    const ultimaTram = ultimaTramPorProc[k];
    return Object.assign({}, proc, {
      qtd_documentos: qtdDocsPorProc[k] || 0,
      ultima_auditoria_qtd_achados: ultima ? ultima.qtd_achados : null,
      ultima_auditoria_data: ultima ? ultima.data : null,
      ultima_auditoria_checkpoint: ultima ? ultima.tipo_checkpoint : null,
      ultima_tramitacao: ultimaTram ? { data: ultimaTram.data, para_usuario: ultimaTram.para_usuario, lido_em: ultimaTram.lido_em || '' } : null,
      perguntas_pendentes_para_mim: pendentesPorProc[k] || 0
    });
  });

  lista.sort((a, b) => new Date(b.atualizado_em) - new Date(a.atualizado_em));
  return { processos: lista };
}

function processosObter(p) {
  const lista = lerLinhas(SHEETS.PROCESSOS);
  const proc = lista.find(x => String(x.id) === String(p.id) || (p.numero_sei && x.numero_sei === p.numero_sei));
  if (!proc) return { ok: false, erro: 'Processo não encontrado.' };
  return { processo: proc };
}

function processosCriar(p) {
  if (!p.titulo) return { ok: false, erro: 'Título é obrigatório.' };
  const id = proximoId(SHEETS.PROCESSOS);
  const agora = new Date().toISOString();
  const obj = {
    id,
    numero_sei: p.numero_sei || '',
    titulo: p.titulo,
    unidade: p.unidade || '',
    oss: p.oss || '',
    gerencia: p.gerencia || '',
    status: STATUS.AGUARDANDO_INICIAL,
    responsavel_atual: p.responsavel_atual || p.criado_por || '',
    criado_por: p.criado_por || '',
    criado_em: agora,
    atualizado_em: agora,
    tipo_processo: p.tipo_processo || '',
    data_limite: p.data_limite || ''
  };
  inserirLinha(SHEETS.PROCESSOS, obj);
  return { processo: obj };
}

function processosAtualizarStatus(p) {
  if (!p.id || !p.status) return { ok: false, erro: 'id e status são obrigatórios.' };
  const patch = { status: p.status, atualizado_em: new Date().toISOString() };
  if (p.documento_final !== undefined) patch.documento_final = p.documento_final;
  if (p.tipo_processo   !== undefined) patch.tipo_processo   = p.tipo_processo;
  if (p.data_limite     !== undefined) patch.data_limite     = p.data_limite;
  atualizarLinha(SHEETS.PROCESSOS, p.id, patch);
  return {};
}

// Encaminha um processo para outra pessoa: troca o responsável e grava no histórico de tramitação.
// Sempre para uma pessoa específica (email cadastrado em Usuarios) — nunca para uma gerência genérica.
function processosEncaminhar(p) {
  if (!p.processo_id || !p.para) return { ok: false, erro: 'processo_id e para (e-mail do destinatário) são obrigatórios.' };

  const paraValor = String(p.para).trim().toLowerCase();
  const destinatario = lerLinhas(SHEETS.USUARIOS).find(u => String(u.email).toLowerCase() === paraValor);
  if (!destinatario) return { ok: false, erro: 'Destinatário não encontrado entre os usuários cadastrados.' };

  const proc = lerLinhas(SHEETS.PROCESSOS).find(x => String(x.id) === String(p.processo_id));
  if (!proc) return { ok: false, erro: 'Processo não encontrado.' };

  const agora = new Date().toISOString();
  atualizarLinha(SHEETS.PROCESSOS, p.processo_id, { responsavel_atual: destinatario.email, atualizado_em: agora });

  const idTram = proximoId(SHEETS.TRAMITACOES);
  const tramitacao = {
    id: idTram,
    processo_id: p.processo_id,
    de_usuario: p.de || proc.responsavel_atual || '',
    para_usuario: destinatario.email,
    data: agora,
    observacao: p.observacao || ''
  };
  inserirLinha(SHEETS.TRAMITACOES, tramitacao);

  // Quem encaminha passa a "acompanhar" o processo por padrão (upsert: reativa se já existia)
  const quemEncaminhou = p.de || proc.responsavel_atual || '';
  if (quemEncaminhou) _upsertAcompanhamento(p.processo_id, quemEncaminhou, true);

  return { tramitacao, responsavel_atual: destinatario.email };
}

// Cria ou reativa (nunca duplica) o registro de acompanhamento de um usuário num processo
function _upsertAcompanhamento(processoId, usuario, ativo) {
  const usuarioNorm = String(usuario).toLowerCase();
  const sh = getSheet(SHEETS.ACOMPANHAMENTOS);
  const dados = sh.getDataRange().getValues();
  const cab = dados[0];
  const idxProc = cab.indexOf('processo_id');
  const idxUsu  = cab.indexOf('usuario');
  const idxAtivo = cab.indexOf('ativo');

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][idxProc]) === String(processoId) && String(dados[i][idxUsu]).toLowerCase() === usuarioNorm) {
      sh.getRange(i + 1, idxAtivo + 1).setValue(ativo);
      return;
    }
  }
  inserirLinha(SHEETS.ACOMPANHAMENTOS, { id: proximoId(SHEETS.ACOMPANHAMENTOS), processo_id: processoId, usuario: usuarioNorm, ativo });
}

function processosPararAcompanhamento(p) {
  if (!p.processo_id || !p.usuario) return { ok: false, erro: 'processo_id e usuario são obrigatórios.' };
  _upsertAcompanhamento(p.processo_id, p.usuario, false);
  return {};
}

// Conta quantos processos existem em cada caixa lógica, para os badges da sidebar
function processosContagens(p) {
  // Cada pessoa vê as próprias contagens; o gestor pode pedir as de outra pessoa.
  const s = p._sessao;
  const resp = (_ehGestor(s) && p.responsavel) ? String(p.responsavel).toLowerCase() : s.email;

  const processos = lerLinhas(SHEETS.PROCESSOS);
  const meus = processos.filter(x => String(x.responsavel_atual).toLowerCase() === resp);

  const entrada = meus.filter(x => x.status === STATUS.AGUARDANDO_INICIAL).length;
  const andamento = meus.filter(x => x.status === STATUS.EM_ANALISE || x.status === STATUS.AGUARDANDO_FINAL || x.status === STATUS.PRONTO_ASSINAR).length;

  const acompanhamentos = lerLinhas(SHEETS.ACOMPANHAMENTOS)
    .filter(a => String(a.usuario).toLowerCase() === resp && String(a.ativo).toUpperCase() !== 'FALSE');
  const idsAcompanhados = new Set(acompanhamentos.map(a => String(a.processo_id)));
  const encaminhados = processos.filter(x => idsAcompanhados.has(String(x.id))).length;

  const concluidos = processos.filter(x =>
    x.status === 'Concluído' && (String(x.responsavel_atual).toLowerCase() === resp || idsAcompanhados.has(String(x.id)))
  ).length;

  return { contagens: { entrada, andamento, encaminhados, concluidos } };
}

function tramitacoesListar(p) {
  if (!p.processo_id) return { ok: false, erro: 'processo_id é obrigatório.' };
  const lista = lerLinhas(SHEETS.TRAMITACOES)
    .filter(t => String(t.processo_id) === String(p.processo_id))
    .sort((a, b) => new Date(b.data) - new Date(a.data));
  return { tramitacoes: lista };
}

// ==================== CONSULTAS (histórico do chat "Perguntas ao Processo") ====================

function consultasSalvar(p) {
  if (!p.processo_id || !p.pergunta) return { ok: false, erro: 'processo_id e pergunta são obrigatórios.' };
  const id = proximoId(SHEETS.CONSULTAS);
  const obj = {
    id, processo_id: p.processo_id, pergunta: p.pergunta, resposta: p.resposta || '',
    usuario: p.usuario || '', data: new Date().toISOString()
  };
  inserirLinha(SHEETS.CONSULTAS, obj);
  return { consulta: obj };
}

function consultasListar(p) {
  if (!p.processo_id) return { ok: false, erro: 'processo_id é obrigatório.' };
  const lista = lerLinhas(SHEETS.CONSULTAS)
    .filter(c => String(c.processo_id) === String(p.processo_id))
    .sort((a, b) => new Date(a.data) - new Date(b.data)); // ordem cronológica (conversa)
  return { consultas: lista };
}

// Remove o processo e tudo que pertence a ele em cascata (documentos, blocos de
// conteúdo, auditorias, tramitações) — evita deixar lixo órfão na planilha.
// Só quem criou o processo (ou um admin) pode remover.
function processosRemover(p) {
  if (!p.id) return { ok: false, erro: 'id é obrigatório.' };
  const proc = lerLinhas(SHEETS.PROCESSOS).find(x => String(x.id) === String(p.id));
  if (!proc) return { ok: false, erro: 'Processo não encontrado.' };
  const s = p._sessao;
  if (String(proc.criado_por).toLowerCase() !== s.email && s.perfil !== 'admin') {
    return { ok: false, erro: 'Só quem criou o processo pode removê-lo.' };
  }

  const docsDoProc = lerLinhas(SHEETS.DOCUMENTOS).filter(d => String(d.processo_id) === String(p.id));
  docsDoProc.forEach(d => _removerDocumentoEBlocos(d.id));

  [SHEETS.AUDITORIAS, SHEETS.TRAMITACOES, SHEETS.CONSULTAS, SHEETS.ACOMPANHAMENTOS, SHEETS.NOTAS, SHEETS.ACHADOS_CONSULTAS].forEach(nomeAba => {
    const sh = getSheet(nomeAba);
    const dados = sh.getDataRange().getValues();
    const idxProcId = dados[0].indexOf('processo_id');
    for (let i = dados.length - 1; i >= 1; i--) {
      if (String(dados[i][idxProcId]) === String(p.id)) sh.deleteRow(i + 1);
    }
  });

  excluirLinha(SHEETS.PROCESSOS, p.id);
  return { _removido: { numero_sei: proc.numero_sei, titulo: proc.titulo } };
}

// ==================== DOCUMENTOS ====================

function documentosListar(p) {
  const lista = lerLinhas(SHEETS.DOCUMENTOS).filter(d => String(d.processo_id) === String(p.processo_id));
  return { documentos: lista };
}

function documentosAdicionar(p) {
  if (!p.processo_id || !p.nome_arquivo) return { ok: false, erro: 'processo_id e nome_arquivo são obrigatórios.' };
  const id = proximoId(SHEETS.DOCUMENTOS);
  const obj = {
    id,
    processo_id: p.processo_id,
    nome_arquivo: p.nome_arquivo,
    adicionado_por: p.adicionado_por || '',
    adicionado_em: new Date().toISOString()
  };
  inserirLinha(SHEETS.DOCUMENTOS, obj);
  atualizarLinha(SHEETS.PROCESSOS, p.processo_id, { atualizado_em: new Date().toISOString() });
  return { documento: obj };
}

// Combina "criar documento" + "salvar todos os blocos de texto" numa ÚNICA chamada de
// rede — o gargalo do upload não é ler o arquivo (isso é local, instantâneo), é a
// latência de ida-e-volta ao Apps Script; salvar 1 doc de 5 blocos antes disso custava
// 6 chamadas de rede (1 criar + 5 blocos), agora custa 1.
function documentosAdicionarCompleto(p) {
  if (!p.processo_id || !p.nome_arquivo || p.texto === undefined) {
    return { ok: false, erro: 'processo_id, nome_arquivo e texto são obrigatórios.' };
  }
  const idDoc = proximoId(SHEETS.DOCUMENTOS);
  const doc = {
    id: idDoc, processo_id: p.processo_id, nome_arquivo: p.nome_arquivo,
    adicionado_por: p.adicionado_por || '', adicionado_em: new Date().toISOString(),
    // Detectado no navegador na hora da leitura (mesmo motor do mascaramento) — guardar
    // aqui é o que permite reabrir o processo dias depois e ver o que foi coberto,
    // sem precisar rodar a Checagem de novo só pra saber isso.
    resumo_sensiveis: p.resumo_sensiveis || '',
    // 'FINAL_ASSINADO' = versão oficial, reimportada do SEI depois da assinatura — é
    // essa que compõe o banco de dados, não o rascunho revisado dentro da ferramenta.
    tipo_documento: p.tipo_documento || ''
  };
  inserirLinha(SHEETS.DOCUMENTOS, doc);

  const texto = String(p.texto);
  let idBloco = proximoId(SHEETS.CONTEUDO);
  let blocoNum = 0;
  for (let i = 0; i < texto.length; i += BLOCO_MAX_CHARS) {
    inserirLinha(SHEETS.CONTEUDO, {
      id: idBloco++, documento_id: idDoc, bloco_num: blocoNum++,
      conteudo: texto.substring(i, i + BLOCO_MAX_CHARS)
    });
  }

  atualizarLinha(SHEETS.PROCESSOS, p.processo_id, { atualizado_em: new Date().toISOString() });
  return { documento: doc, blocos_salvos: blocoNum };
}

// Rota pública de remover documento: só quem criou o processo, quem está com ele
// agora ou um admin.
function documentosRemover(p) {
  if (!p.id) return { ok: false, erro: 'id é obrigatório.' };
  const doc = lerLinhas(SHEETS.DOCUMENTOS).find(d => String(d.id) === String(p.id));
  if (!doc) return { ok: false, erro: 'Documento não encontrado.' };
  const proc = lerLinhas(SHEETS.PROCESSOS).find(x => String(x.id) === String(doc.processo_id)) || {};
  const s = p._sessao;
  const pode = s.perfil === 'admin' ||
    String(proc.criado_por).toLowerCase() === s.email ||
    String(proc.responsavel_atual).toLowerCase() === s.email;
  if (!pode) return { ok: false, erro: 'Você não pode remover documentos deste processo.' };
  _removerDocumentoEBlocos(p.id);
  return { _removido: { nome_arquivo: doc.nome_arquivo, processo_id: doc.processo_id } };
}

function _removerDocumentoEBlocos(idDoc) {
  excluirLinha(SHEETS.DOCUMENTOS, idDoc);
  // remove também os blocos de conteúdo associados a esse documento
  const sh = getSheet(SHEETS.CONTEUDO);
  const dados = sh.getDataRange().getValues();
  const idxDocId = dados[0].indexOf('documento_id');
  for (let i = dados.length - 1; i >= 1; i--) {
    if (String(dados[i][idxDocId]) === String(idDoc)) sh.deleteRow(i + 1);
  }
}

// ==================== CONTEÚDO (texto extraído, em blocos) ====================

function conteudoSalvarBloco(p) {
  if (!p.documento_id || p.conteudo === undefined) return { ok: false, erro: 'documento_id e conteudo são obrigatórios.' };
  const conteudo = String(p.conteudo).substring(0, BLOCO_MAX_CHARS);
  const id = proximoId(SHEETS.CONTEUDO);
  inserirLinha(SHEETS.CONTEUDO, { id, documento_id: p.documento_id, bloco_num: p.bloco_num || 0, conteudo });
  return {};
}

function conteudoListar(p) {
  if (!p.processo_id) return { ok: false, erro: 'processo_id é obrigatório.' };
  const docsIds = lerLinhas(SHEETS.DOCUMENTOS)
    .filter(d => String(d.processo_id) === String(p.processo_id))
    .map(d => String(d.id));
  const blocos = lerLinhas(SHEETS.CONTEUDO).filter(b => docsIds.includes(String(b.documento_id)));
  return { blocos };
}

// ==================== AUDITORIAS ====================
// tipo_checkpoint esperado: 'ENTRADA' (antes de começar a mexer) ou 'SAIDA' (antes de assinar no SEI)

function auditoriasSalvar(p) {
  if (!p.processo_id || p.achados_json === undefined) return { ok: false, erro: 'processo_id e achados_json são obrigatórios.' };
  let achados = [];
  try { achados = JSON.parse(p.achados_json); } catch (e) { /* mantém vazio se inválido */ }

  const id = proximoId(SHEETS.AUDITORIAS);
  const obj = {
    id,
    processo_id: p.processo_id,
    tipo_checkpoint: p.tipo_checkpoint || 'GERAL',
    data: new Date().toISOString(),
    executado_por: p.executado_por || '',
    qtd_achados: achados.length,
    achados_json: p.achados_json,
    raw_ia: p.raw_ia || ''
  };
  inserirLinha(SHEETS.AUDITORIAS, obj);

  // Atualiza status do processo automaticamente conforme o checkpoint
  const novoStatus = p.tipo_checkpoint === 'ENTRADA' ? STATUS.EM_ANALISE
                    : p.tipo_checkpoint === 'SAIDA'   ? STATUS.PRONTO_ASSINAR
                    : undefined;
  const patch = { atualizado_em: new Date().toISOString() };
  if (novoStatus) patch.status = novoStatus;
  atualizarLinha(SHEETS.PROCESSOS, p.processo_id, patch);

  return { auditoria: obj };
}

function auditoriasListar(p) {
  if (!p.processo_id) return { ok: false, erro: 'processo_id é obrigatório.' };
  const lista = lerLinhas(SHEETS.AUDITORIAS)
    .filter(a => String(a.processo_id) === String(p.processo_id))
    .sort((a, b) => new Date(b.data) - new Date(a.data));
  return { auditorias: lista };
}

// ==================== LOG ====================

// Registro avulso enviado pelo app. Quase tudo agora é registrado sozinho pelo servidor
// (ver REGISTRO DE ATIVIDADES); esta rota fica para eventos que só o navegador conhece.
function logRegistrar(p) {
  _gravarLinhaLog({
    usuario: p._sessao.email, acao: 'APP: ' + String(p.acao || '').slice(0, 60),
    processo_id: p.processo_id, detalhes: p.detalhes, app: p._sessao.app
  });
  return {};
}

// ==================== REGISTRO DE ATIVIDADES (aba Log) ====================
// Toda ação feita na plataforma é registrada AQUI, pelo servidor, depois de executada —
// o navegador não escolhe o que entra nem em nome de quem (o nome vem da sessão). Nunca
// grava conteúdo de documento, pergunta ou resposta: só quem, o quê, quando e em qual
// processo. Um erro ao registrar nunca impede a ação da pessoa.

// Quanto tempo o registro fica na planilha principal antes de ir para o arquivo do ano.
const LOG_DIAS_NA_PLANILHA = 60;
// "Abriu processo" repetido pela mesma pessoa no mesmo processo em menos de 10 min conta uma vez
// (o app reabre o processo sozinho depois de cada importação).
const LOG_JANELA_ABRIU_S = 10 * 60;

const EVENTOS_POR_ROTA = {
  'processos/obter': (p, r) => ({ acao: 'ABRIU_PROCESSO', processo_id: r.processo && r.processo.id }),
  'processos/criar': (p, r) => ({ acao: 'CRIOU_PROCESSO', processo_id: r.processo && r.processo.id,
    detalhes: 'Nº SEI ' + ((r.processo && r.processo.numero_sei) || '—') }),
  'processos/atualizar-status': p => p.status === 'Concluído'
    ? { acao: 'FINALIZOU_PROCESSO', processo_id: p.id,
        detalhes: (p.revisao_confirmada === true || p.revisao_confirmada === 'true') ? 'Revisão final confirmada' : 'Sem revisão final confirmada' }
    : { acao: 'MUDOU_STATUS', processo_id: p.id, detalhes: 'Para: ' + p.status },
  'processos/encaminhar': (p, r) => ({
    acao: String(p.observacao || '').toLowerCase() === 'devolvido' ? 'DEVOLVEU_PROCESSO' : 'ENCAMINHOU_PROCESSO',
    processo_id: p.processo_id, detalhes: 'Para: ' + (r.responsavel_atual || p.para) }),
  'processos/parar-acompanhamento': p => ({ acao: 'PAROU_ACOMPANHAMENTO', processo_id: p.processo_id }),
  'processos/remover': (p, r) => ({ acao: 'REMOVEU_PROCESSO', processo_id: p.id,
    detalhes: r._removido ? ('Nº SEI ' + (r._removido.numero_sei || '—') + ' — ' + r._removido.titulo) : '' }),
  'documentos/adicionar': p => ({ acao: 'IMPORTOU_DOCUMENTO', processo_id: p.processo_id, detalhes: p.nome_arquivo }),
  'documentos/adicionar-completo': p => ({
    acao: p.tipo_documento === 'FINAL_ASSINADO' ? 'IMPORTOU_VERSAO_ASSINADA' : 'IMPORTOU_DOCUMENTO',
    processo_id: p.processo_id, detalhes: p.nome_arquivo }),
  'documentos/remover': (p, r) => ({ acao: 'REMOVEU_DOCUMENTO',
    processo_id: r._removido && r._removido.processo_id, detalhes: r._removido && r._removido.nome_arquivo }),
  'auditorias/salvar': (p, r) => ({
    acao: p.tipo_checkpoint === 'SAIDA' ? 'REVISOU_PARECER' : 'RODOU_CHECAGEM',
    processo_id: p.processo_id, detalhes: (r.auditoria ? r.auditoria.qtd_achados : '?') + ' achado(s)' }),
  'consultas/salvar': p => ({ acao: 'PERGUNTOU_AO_PROCESSO', processo_id: p.processo_id }),
  // A anotação se salva sozinha enquanto a pessoa digita: registra só quando é criada.
  'notas/salvar': (p, r) => r.atualizada ? null : { acao: 'CRIOU_ANOTACAO', processo_id: p.processo_id },
  'achados/encaminhar': p => ({ acao: 'ENCAMINHOU_ACHADO', processo_id: p.processo_id, detalhes: 'Para: ' + p.para_usuario }),
  'achados/responder': (p, r) => ({ acao: 'RESPONDEU_ACHADO', processo_id: r._processo_id }),
  'adm/estatisticas': () => ({ acao: 'GESTAO_VIU_ESTATISTICAS' }),
  'adm/achados-todos': () => ({ acao: 'GESTAO_VIU_TODOS_OS_ACHADOS' }),
  'adm/log': () => ({ acao: 'GESTAO_VIU_REGISTRO_DE_ATIVIDADES' }),
  'adm/painel': () => ({ acao: 'GESTAO_VIU_PAINEL' })
};

function _gravarLinhaLog(ev) {
  try {
    inserirLinha(SHEETS.LOG, {
      // Identificador sem precisar ler a aba inteira (a aba cresce rápido).
      id: 'L' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36),
      data: new Date().toISOString(),
      usuario: String(ev.usuario || '').slice(0, 120),
      acao: ev.acao,
      processo_id: ev.processo_id === undefined || ev.processo_id === null ? '' : ev.processo_id,
      detalhes: String(ev.detalhes === undefined || ev.detalhes === null ? '' : ev.detalhes).slice(0, 300),
      app: ev.app || ''
    });
  } catch (e) { /* o registro nunca pode derrubar a ação da pessoa */ }
}

function _registrarAtividade(action, p, r, sessao) {
  try {
    if (action === 'log/registrar') return; // a própria rota já grava
    if (action === 'auth/login') {
      const email = String(p.email || '').trim().toLowerCase().slice(0, 120);
      if (r.ok === false) {
        // Login bloqueado por tentativas: registra uma vez por bloqueio, não a cada insistência
        // (senão quem ficasse tentando encheria o registro).
        if (/Muitas tentativas/.test(r.erro || '')) {
          const cache = CacheService.getScriptCache(), chave = 'bloqlog_' + sha256Hex(email);
          if (cache.get(chave)) return;
          cache.put(chave, '1', LOGIN_BLOQUEIO_S);
        }
        _gravarLinhaLog({ usuario: email, acao: 'LOGIN_RECUSADO', detalhes: r.erro, app: String(p.app || '').slice(0, 20) });
      }
      else _gravarLinhaLog({ usuario: email, acao: 'ENTROU', app: String(p.app || 'analista') });
      return;
    }
    if (action === 'auth/logout') {
      if (sessao) _gravarLinhaLog({ usuario: sessao.email, acao: 'SAIU', app: sessao.app });
      return;
    }
    if (!sessao) return;
    const base = { usuario: sessao.email, app: sessao.app };
    if (r.ok === false) {
      // Leitura que falhou não interessa; ação recusada ou com erro, sim (ex.: tentar remover
      // processo de outra pessoa).
      if (ROTAS_SO_LEITURA[action]) return;
      _gravarLinhaLog(Object.assign(base, { acao: 'ACAO_RECUSADA', processo_id: p.processo_id || p.id,
        detalhes: action + ': ' + (r.erro || '') }));
      return;
    }
    const montar = EVENTOS_POR_ROTA[action];
    if (!montar) return;
    const ev = montar(p, r);
    if (!ev) return;
    if (ev.acao === 'ABRIU_PROCESSO') {
      const cache = CacheService.getScriptCache();
      const chave = 'abriu_' + sha256Hex(sessao.email + '|' + ev.processo_id);
      if (cache.get(chave)) return;
      cache.put(chave, '1', LOG_JANELA_ABRIU_S);
    }
    _gravarLinhaLog(Object.assign(base, ev));
  } catch (e) { /* idem: nunca derruba a ação */ }
}

// Consulta do registro pelo SEI Gestão (só gestor). Filtros opcionais: filtro_usuario,
// filtro_acao, filtro_processo, data_inicio, data_fim (AAAA-MM-DD) e limite (padrão 500).
// Mostra só o que está na planilha principal (últimos LOG_DIAS_NA_PLANILHA dias); o mais
// antigo fica no arquivo do ano, no Drive.
function admLog(p) {
  const check = _exigirAdmin(p);
  if (!check.ok) return check;
  let linhas = lerLinhas(SHEETS.LOG);
  const fu = String(p.filtro_usuario || '').trim().toLowerCase();
  const fa = String(p.filtro_acao || '').trim().toUpperCase();
  const fp = String(p.filtro_processo || '').trim();
  const ini = p.data_inicio ? new Date(p.data_inicio + 'T00:00:00-03:00').getTime() : null;
  const fim = p.data_fim ? new Date(p.data_fim + 'T23:59:59-03:00').getTime() : null;
  if (fu) linhas = linhas.filter(l => String(l.usuario).toLowerCase() === fu);
  if (fa) linhas = linhas.filter(l => String(l.acao).toUpperCase().indexOf(fa) > -1);
  if (fp) linhas = linhas.filter(l => String(l.processo_id) === fp);
  if (ini !== null) linhas = linhas.filter(l => new Date(l.data).getTime() >= ini);
  if (fim !== null) linhas = linhas.filter(l => new Date(l.data).getTime() <= fim);
  linhas.sort((a, b) => new Date(b.data) - new Date(a.data));
  const limite = Math.min(Math.max(Number(p.limite) || 500, 1), 5000);
  return { eventos: linhas.slice(0, limite), total: linhas.length };
}

// Move para um arquivo separado do ano ("SEI Analista - Registro de atividades AAAA",
// na mesma pasta do Drive) tudo o que tiver mais de LOG_DIAS_NA_PLANILHA dias — o
// registro cresce todo dia e a planilha principal tem teto de 10 milhões de células.
// Só APAGA da planilha principal depois de copiar para o arquivo.
function arquivarLogAntigo() {
  const lock = LockService.getScriptLock();
  lock.waitLock(ESPERA_FILA_GRAVACAO_MS);
  try {
    const sh = getSheet(SHEETS.LOG);
    const dados = sh.getDataRange().getValues();
    if (dados.length < 2) return 0;
    const cab = CABECALHOS[SHEETS.LOG];
    const idxData = dados[0].indexOf('data');
    const corte = Date.now() - LOG_DIAS_NA_PLANILHA * 86400000;
    const antigas = []; // { linha (nº na planilha), valores }
    for (let i = 1; i < dados.length; i++) {
      const t = new Date(dados[i][idxData]).getTime();
      if (!isNaN(t) && t < corte) antigas.push({ linha: i + 1, valores: cab.map((_, c) => dados[i][c] === undefined ? '' : dados[i][c]) });
    }
    if (!antigas.length) return 0;

    const porAno = {};
    antigas.forEach(a => {
      const ano = new Date(a.valores[idxData]).getFullYear();
      (porAno[ano] = porAno[ano] || []).push(a.valores);
    });
    Object.keys(porAno).forEach(ano => {
      const aba = _planilhaArquivoLog(ano).getSheets()[0];
      aba.getRange(aba.getLastRow() + 1, 1, porAno[ano].length, cab.length).setValues(porAno[ano]);
    });

    // Apaga de baixo para cima, em blocos contínuos. Linhas gravadas por outras pessoas
    // durante o arquivamento entram no fim da aba e não são tocadas.
    const numeros = antigas.map(a => a.linha).sort((a, b) => b - a);
    let i = 0;
    while (i < numeros.length) {
      let fimBloco = numeros[i], inicio = fimBloco;
      while (i + 1 < numeros.length && numeros[i + 1] === inicio - 1) { i++; inicio = numeros[i]; }
      sh.deleteRows(inicio, fimBloco - inicio + 1);
      i++;
    }
    _gravarLinhaLog({ usuario: 'sistema', acao: 'ARQUIVOU_REGISTRO', detalhes: antigas.length + ' linha(s) movidas para o arquivo do ano' });
    return antigas.length;
  } finally {
    lock.releaseLock();
  }
}

function _planilhaArquivoLog(ano) {
  const props = PropertiesService.getScriptProperties();
  const chave = 'log_arquivo_' + ano;
  const id = props.getProperty(chave);
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* apagado ou sem acesso: cria outro */ }
  }
  const nova = SpreadsheetApp.create('SEI Analista - Registro de atividades ' + ano);
  nova.getSheets()[0].getRange(1, 1, 1, CABECALHOS[SHEETS.LOG].length).setValues([CABECALHOS[SHEETS.LOG]]);
  nova.getSheets()[0].setFrozenRows(1);
  try {
    const pastas = DriveApp.getFileById(SpreadsheetApp.getActiveSpreadsheet().getId()).getParents();
    if (pastas.hasNext()) DriveApp.getFileById(nova.getId()).moveTo(pastas.next());
  } catch (e) { /* fica na raiz do Drive — não impede o arquivamento */ }
  props.setProperty(chave, nova.getId());
  return nova;
}

function menuArquivarLog() {
  const total = arquivarLogAntigo();
  SpreadsheetApp.getUi().alert(total
    ? total + ' linha(s) com mais de ' + LOG_DIAS_NA_PLANILHA + ' dias foram movidas para o arquivo do ano, na mesma pasta do Drive.'
    : 'Nada para arquivar: todo o registro tem menos de ' + LOG_DIAS_NA_PLANILHA + ' dias.');
}

function ativarArquivamentoAutomaticoLog() {
  const jaExiste = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'arquivarLogAntigo');
  if (!jaExiste) ScriptApp.newTrigger('arquivarLogAntigo').timeBased().onMonthDay(1).atHour(3).create();
  _protegerAbaLog();
  SpreadsheetApp.getUi().alert(jaExiste
    ? 'O arquivamento automático já estava ativo (todo dia 1º, de madrugada).'
    : 'Arquivamento automático ativado: todo dia 1º, de madrugada, o registro com mais de ' + LOG_DIAS_NA_PLANILHA + ' dias vai para o arquivo do ano.');
}

// Só o dono da planilha (e o sistema, que roda em nome dele) pode mexer na aba Log.
function _protegerAbaLog() {
  try {
    const sh = getSheet(SHEETS.LOG);
    const existentes = sh.getProtections(SpreadsheetApp.ProtectionType.SHEET);
    const prot = existentes.length ? existentes[0] : sh.protect();
    prot.setDescription('Registro de atividades — somente o sistema grava aqui');
    const eu = Session.getEffectiveUser();
    prot.addEditor(eu);
    prot.removeEditors(prot.getEditors().filter(e => e.getEmail() !== eu.getEmail()));
    if (prot.canDomainEdit()) prot.setDomainEdit(false);
  } catch (e) { /* sem permissão para proteger: segue sem travar a configuração */ }
}

// ==================== SEI GESTÃO ====================
// Rotas de agregação — não filtram por responsável, veem TUDO. Por isso exigem que a
// SESSÃO seja de alguém com perfil "admin" e acesso ao app "gestao". Nada que venha
// escrito do navegador (como um e-mail) serve para liberar o acesso.
function _exigirAdmin(p) {
  const s = p._sessao;
  if (!_ehGestor(s)) return { ok: false, erro: 'Acesso restrito a administradores do SEI Gestão.' };
  return { ok: true };
}

// Números agregados pra tela de resumo do Gestão — não devolve os achados em si, só contagens.
function admEstatisticas(p) {
  const check = _exigirAdmin(p);
  if (!check.ok) return check;

  const processos = lerLinhas(SHEETS.PROCESSOS);
  const auditorias = lerLinhas(SHEETS.AUDITORIAS);
  const tramitacoes = lerLinhas(SHEETS.TRAMITACOES);

  const processosPorStatus = {};
  processos.forEach(x => { processosPorStatus[x.status] = (processosPorStatus[x.status] || 0) + 1; });

  let totalAchados = 0;
  const achadosPorTipo = {};
  const achadosPorUnidadeMap = {};
  auditorias.forEach(a => {
    let achados = [];
    try { achados = JSON.parse(a.achados_json || '[]'); } catch (e) { /* ignora entrada inválida */ }
    if (!achados.length) return;
    const proc = processos.find(x => String(x.id) === String(a.processo_id));
    const unidade = proc ? proc.unidade : '(processo removido)';
    achados.forEach(ac => {
      totalAchados++;
      const tipoAc = ac.tipo || ac.tag || '(sem tipo)';
      achadosPorTipo[tipoAc] = (achadosPorTipo[tipoAc] || 0) + 1;
      achadosPorUnidadeMap[unidade] = (achadosPorUnidadeMap[unidade] || 0) + 1;
    });
  });

  const achadosPorUnidade = Object.keys(achadosPorUnidadeMap)
    .map(u => ({ unidade: u, qtd: achadosPorUnidadeMap[u] }))
    .sort((a, b) => b.qtd - a.qtd);

  const devolucoes = tramitacoes.filter(t => String(t.observacao).toLowerCase() === 'devolvido').length;

  return {
    estatisticas: {
      total_processos: processos.length,
      processos_por_status: processosPorStatus,
      total_achados: totalAchados,
      achados_por_tipo: achadosPorTipo,
      achados_por_unidade: achadosPorUnidade,
      devolucoes
    }
  };
}

// Lista plana de TODOS os achados já encontrados, com o contexto do processo (unidade,
// gerência, nº SEI) — serve tanto pra tela de detalhe do Gestão quanto pra outros sistemas
// (Predador de Auditoria, cruzamento de consultas) lerem esses dados prontos.
function admAchadosTodos(p) {
  const check = _exigirAdmin(p);
  if (!check.ok) return check;

  const processos = lerLinhas(SHEETS.PROCESSOS);
  const auditorias = lerLinhas(SHEETS.AUDITORIAS);
  const linhas = [];

  auditorias.forEach(a => {
    let achados = [];
    try { achados = JSON.parse(a.achados_json || '[]'); } catch (e) { return; }
    const proc = processos.find(x => String(x.id) === String(a.processo_id)) || {};
    achados.forEach(ac => {
      linhas.push({
        processo_id: a.processo_id,
        numero_sei: proc.numero_sei || '',
        titulo: proc.titulo || '',
        unidade: proc.unidade || '',
        gerencia: proc.gerencia || '',
        tipo_checkpoint: a.tipo_checkpoint,
        data_auditoria: a.data,
        tipo_achado: ac.tipo || ac.tag || '',
        descricao: ac.descricao || [ac.titulo, ac.explicacao].filter(Boolean).join(': '),
        sugestao: ac.sugestao || '', doc_origem: ac.doc_origem || '', conferido_por_codigo: !!ac.conferido_por_codigo,
        usuario: a.executado_por || '',
        documentos: ac.documentos || '',
        verificar: ac.verificar !== false
      });
    });
  });

  linhas.sort((x, y) => new Date(y.data_auditoria) - new Date(x.data_auditoria));
  return { achados: linhas };
}

// ==================== NOTAS DO PROCESSO ====================
// Nota livre do analista, escrita no Painel de Evidências enquanto trabalha —
// pode estar ligada a uma evidência específica (referencia = "tag: título") ou ser
// uma nota geral do processo (referencia vazia). Upsert por processo+referência:
// editar a mesma nota várias vezes atualiza a linha, não duplica.
function notasSalvar(p) {
  if (!p.processo_id || p.nota === undefined) return { ok: false, erro: 'processo_id e nota são obrigatórios.' };
  const referencia = p.referencia || '';

  const sh = getSheet(SHEETS.NOTAS);
  const dados = sh.getDataRange().getValues();
  const cab = dados[0];
  const idxProc = cab.indexOf('processo_id');
  const idxRef  = cab.indexOf('referencia');
  const idxNota = cab.indexOf('nota');
  const idxData = cab.indexOf('data');

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][idxProc]) === String(p.processo_id) && String(dados[i][idxRef]) === referencia) {
      sh.getRange(i + 1, idxNota + 1).setValue(p.nota);
      sh.getRange(i + 1, idxData + 1).setValue(new Date().toISOString());
      return { atualizada: true };
    }
  }

  const id = proximoId(SHEETS.NOTAS);
  inserirLinha(SHEETS.NOTAS, {
    id, processo_id: p.processo_id, referencia, nota: p.nota,
    usuario: p.usuario || '', data: new Date().toISOString()
  });
  return { atualizada: false };
}

function notasListar(p) {
  if (!p.processo_id) return { ok: false, erro: 'processo_id é obrigatório.' };
  const lista = lerLinhas(SHEETS.NOTAS)
    .filter(n => String(n.processo_id) === String(p.processo_id) && String(n.nota || '').trim() !== '')
    .sort((a, b) => new Date(b.data) - new Date(a.data));
  return { notas: lista };
}

// ==================== ENCAMINHAR ACHADO ESPECÍFICO (não o processo inteiro) ====================
// Diferente de processos/encaminhar: NÃO transfere responsavel_atual, é só uma consulta
// pontual sobre um achado específico.
function achadosEncaminhar(p) {
  if (!p.processo_id || !p.achado_referencia || !p.de_usuario || !p.para_usuario) {
    return { ok: false, erro: 'processo_id, achado_referencia, de_usuario e para_usuario são obrigatórios.' };
  }
  const id = proximoId(SHEETS.ACHADOS_CONSULTAS);
  const obj = {
    id, processo_id: p.processo_id, achado_referencia: p.achado_referencia,
    de_usuario: p.de_usuario, para_usuario: p.para_usuario, mensagem: p.mensagem || '',
    resposta: '', data_envio: new Date().toISOString(), data_resposta: ''
  };
  inserirLinha(SHEETS.ACHADOS_CONSULTAS, obj);
  return { consulta: obj };
}

function achadosListar(p) {
  if (!p.processo_id) return { ok: false, erro: 'processo_id é obrigatório.' };
  const lista = lerLinhas(SHEETS.ACHADOS_CONSULTAS)
    .filter(a => String(a.processo_id) === String(p.processo_id))
    .sort((a, b) => new Date(b.data_envio) - new Date(a.data_envio));
  return { consultas: lista };
}

// Conta achados encaminhados esperando resposta desse usuário, em QUALQUER processo —
// alimenta o aviso de chegada na sidebar.
function achadosContarPendentes(p) {
  if (!p.usuario) return { ok: false, erro: 'usuario é obrigatório.' };
  const email = String(p.usuario).toLowerCase();
  const pendentes = lerLinhas(SHEETS.ACHADOS_CONSULTAS)
    .filter(a => String(a.para_usuario).toLowerCase() === email && !a.resposta);
  return { pendentes: pendentes.length };
}

// Só quem recebeu a pergunta pode respondê-la.
function achadosResponder(p) {
  if (!p.id || p.resposta === undefined) return { ok: false, erro: 'id e resposta são obrigatórios.' };
  const consulta = lerLinhas(SHEETS.ACHADOS_CONSULTAS).find(a => String(a.id) === String(p.id));
  if (!consulta) return { ok: false, erro: 'Pergunta não encontrada.' };
  if (String(consulta.para_usuario).toLowerCase() !== p._sessao.email) {
    return { ok: false, erro: 'Só a pessoa que recebeu a pergunta pode respondê-la.' };
  }
  atualizarLinha(SHEETS.ACHADOS_CONSULTAS, p.id, { resposta: p.resposta, data_resposta: new Date().toISOString() });
  return { _processo_id: consulta.processo_id };
}

// ==================== REFERENCIA CONTRATUAL POR UNIDADE (Google Drive) ====================
const PASTA_LEIS_DECRETOS_ID = '1DYcxUTdPl4KJ-NcLC1kPe5nXJmMBIB11';
const MAX_ARQUIVOS_POR_UNIDADE = 3;

function _normalizarTexto(txt) {
  return String(txt || '').toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, ' ').trim();
}

function normasBuscarPorUnidade(p) {
  if (!p.unidade) return { ok: false, erro: 'Parametro "unidade" e obrigatorio.' };

  let pastaRaiz;
  try { pastaRaiz = DriveApp.getFolderById(PASTA_LEIS_DECRETOS_ID); }
  catch (e) { return { ok: false, erro: 'Nao foi possivel acessar a pasta de referencia no Drive: ' + e.message }; }

  const alvoNormalizado = _normalizarTexto(p.unidade);
  if (!alvoNormalizado) return { ok: true, encontrado: false, arquivos: [] };

  const encontrados = [];
  const subpastas = pastaRaiz.getFolders();
  while (subpastas.hasNext()) {
    const sub = subpastas.next();
    const arquivos = sub.getFiles();
    while (arquivos.hasNext()) {
      const arq = arquivos.next();
      if (_normalizarTexto(arq.getName()).includes(alvoNormalizado)) encontrados.push(arq);
    }
  }

  if (!encontrados.length) return { ok: true, encontrado: false, arquivos: [] };

  const resultado = encontrados.slice(0, MAX_ARQUIVOS_POR_UNIDADE).map(arq => {
    let texto = '';
    try { texto = _extrairTextoArquivoDrive(arq); }
    catch (e) { texto = ''; }
    return {
      nome: arq.getName(),
      valores: _extrairValoresMonetariosTexto(texto),
      datas: _extrairDatasTexto(texto),
      cep: _extrairCEPsTexto(texto)
    };
  });

  return { ok: true, encontrado: true, arquivos: resultado };
}

function _extrairTextoArquivoDrive(arquivo) {
  const mime = arquivo.getMimeType();
  if (mime === MimeType.GOOGLE_DOCS) {
    return _extrairTextoDocComGuias(arquivo.getId());
  }
  if (typeof Drive === 'undefined') {
    throw new Error('Arquivo "' + arquivo.getName() + '" nao e Google Doc nativo, e o servico avancado "Drive API" nao esta habilitado neste projeto Apps Script.');
  }
  const copia = Drive.Files.copy({ title: '_tmp_extracao_' + Date.now() }, arquivo.getId(), { convert: true });
  try {
    return _extrairTextoDocComGuias(copia.id);
  } finally {
    DriveApp.getFileById(copia.id).setTrashed(true);
  }
}

// Documentos Google podem ter várias GUIAS (abas) — nesses arquivos de referência,
// cada aditivo/apostilamento/rerratificação é uma guia separada dentro do mesmo
// arquivo. Sem percorrer todas, só o conteúdo da primeira guia (geralmente o
// contrato original) seria lido — perdendo justamente os aditivos, que é onde
// os valores tendem a mudar ao longo do tempo.
function _extrairTextoDocComGuias(docId) {
  const doc = DocumentApp.openById(docId);
  const tabs = (typeof doc.getTabs === 'function') ? doc.getTabs() : null;

  if (!tabs || !tabs.length) {
    // Documento sem guias (formato antigo/simples) — cai no método direto
    return doc.getBody().getText();
  }

  const partes = [];
  function coletar(tab) {
    try {
      const docTab = tab.asDocumentTab();
      partes.push('--- GUIA: ' + tab.getTitle() + ' ---\n' + docTab.getBody().getText());
    } catch (e) { /* guia em formato não suportado (ex.: planilha embutida) — ignora só essa */ }
    (tab.getChildTabs ? tab.getChildTabs() : []).forEach(coletar);
  }
  tabs.forEach(coletar);
  return partes.join('\n\n');
}

function _extrairContextoTexto(texto, termo, raio) {
  const idx = texto.indexOf(termo);
  if (idx === -1) return '';
  const ini = Math.max(0, idx - raio);
  const fim = Math.min(texto.length, idx + termo.length + raio);
  return texto.substring(ini, fim).replace(/\s+/g, ' ').trim();
}
function _extrairValoresMonetariosTexto(texto) {
  const regex = /R\$\s?[\d.]+,\d{2}/g;
  return [...new Set(texto.match(regex) || [])].slice(0, 40).map(v => ({ valor: v, contexto: _extrairContextoTexto(texto, v, 55) }));
}
function _extrairDatasTexto(texto) {
  const regex = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
  return [...new Set(texto.match(regex) || [])].slice(0, 40).map(v => ({ valor: v, contexto: _extrairContextoTexto(texto, v, 55) }));
}
function _extrairCEPsTexto(texto) {
  const regex = /\b\d{2}\.?\d{3}-\d{3}\b/g;
  return [...new Set(texto.match(regex) || [])].slice(0, 15).map(v => ({ valor: v, contexto: _extrairContextoTexto(texto, v, 45) }));
}

// ============================================================
// ROTAS TRAZIDAS DO SERVIDOR PUBLICADO (v22) — Mensageiro, alertas, aba Perguntas,
// "visto em" e fontes oficiais. Com a sessão, "usuario" e "de_usuario" chegam aqui já
// trocados pelo e-mail de quem está logado (ver CAMPOS_IDENTIDADE no roteador).
// ============================================================

// ---------- MENSAGEIRO ----------
// Individual: conversa_id = "dm:emailA:emailB" (menor e-mail primeiro, pra ser único)
// Grupo:      conversa_id = "grupo:gerencia"
function _conversaIdDM(emailA, emailB) {
  const a = String(emailA).toLowerCase(), b = String(emailB).toLowerCase();
  return 'dm:' + (a < b ? a + ':' + b : b + ':' + a);
}
function _conversaIdGrupo(gerencia) {
  return 'grupo:' + String(gerencia).toLowerCase().replace(/\s+/g, '_');
}
// Conversa individual só pode ser lida ou escrita por quem faz parte dela.
function _podeUsarConversa(conversaId, email) {
  const c = String(conversaId || '');
  if (c.indexOf('grupo:') === 0) return true;
  if (c.indexOf('dm:') === 0) return c.slice(3).split(':').indexOf(String(email).toLowerCase()) > -1;
  return false;
}

function mensagensEnviar(p) {
  if (!p.texto || !p.conversa_id) return { ok: false, erro: 'conversa_id e texto são obrigatórios.' };
  if (!_podeUsarConversa(p.conversa_id, p.de_usuario)) return { ok: false, erro: 'Você não faz parte desta conversa.' };
  const eu = lerLinhas(SHEETS.USUARIOS).find(u => String(u.email).toLowerCase() === String(p.de_usuario).toLowerCase());
  if (!eu) return { ok: false, erro: 'Usuário não encontrado.' };
  const msg = {
    id: Utilities.getUuid(), conversa_id: p.conversa_id,
    de_usuario: eu.email, de_nome: eu.nome,
    texto: String(p.texto).slice(0, 4000), enviado_em: new Date().toISOString(), lido_por: eu.email
  };
  inserirLinha(SHEETS.MENSAGENS, msg);
  return { mensagem: msg };
}

function mensagensListar(p) {
  if (!p.conversa_id) return { ok: false, erro: 'conversa_id é obrigatório.' };
  const email = String(p.usuario).toLowerCase();
  if (!_podeUsarConversa(p.conversa_id, email)) return { ok: false, erro: 'Você não faz parte desta conversa.' };
  const todas = lerLinhas(SHEETS.MENSAGENS)
    .filter(m => m.conversa_id === p.conversa_id)
    .sort((a, b) => new Date(a.enviado_em) - new Date(b.enviado_em))
    .slice(-100);
  todas.forEach(m => {
    if (!String(m.lido_por || '').toLowerCase().split(',').includes(email)) {
      atualizarLinha(SHEETS.MENSAGENS, m.id, { lido_por: (m.lido_por ? m.lido_por + ',' : '') + email });
    }
  });
  return { mensagens: todas };
}

function mensagensContatos(p) {
  const email = String(p.usuario).toLowerCase();
  const todos = lerLinhas(SHEETS.USUARIOS).filter(u => String(u.ativo).toUpperCase() !== 'FALSE');
  const eu = todos.find(u => String(u.email).toLowerCase() === email);
  const individuais = todos
    .filter(u => String(u.email).toLowerCase() !== email)
    .map(u => ({ tipo: 'dm', nome: u.nome, email: u.email, conversa_id: _conversaIdDM(email, u.email) }));
  const gerencias = [...new Set(todos.map(u => u.gerencia).filter(Boolean))];
  const grupos = gerencias.map(g => ({
    tipo: 'grupo', nome: 'Grupo ' + g, gerencia: g, conversa_id: _conversaIdGrupo(g),
    membros: todos.filter(u => u.gerencia === g).map(u => u.nome)
  }));
  return { individuais, grupos, minha_gerencia: (eu && eu.gerencia) || '' };
}

// ---------- "VISTO EM" (quando o destinatário abriu o processo encaminhado) ----------
function processosMarcarLido(p) {
  if (!p.processo_id) return { ok: false, erro: 'processo_id é obrigatório.' };
  const email = String(p.usuario).toLowerCase();
  const trams = lerLinhas(SHEETS.TRAMITACOES)
    .filter(t => String(t.processo_id) === String(p.processo_id)
              && String(t.para_usuario).toLowerCase() === email && !t.lido_em);
  trams.forEach(t => atualizarLinha(SHEETS.TRAMITACOES, t.id, { lido_em: new Date().toISOString(), lido_por: email }));
  return { marcadas: trams.length };
}

// ---------- ALERTAS (Panorama e barra lateral) ----------
const URGENCIA_HORAS = { apostilamento: 24, rescisao: 24, distrato: 24 };
const PADRAO_HORAS_SEM_MOV = 168;
const AVISO_DATA_LIMITE_DIAS = 5;

function processosAlertas(p) {
  const email = String(p.usuario).toLowerCase();
  const agora = new Date();
  const horasDesde = d => d ? (agora - new Date(d)) / 3600000 : 9999;
  const diasAte    = d => d ? (new Date(d) - agora) / 86400000 : null;
  const procs = lerLinhas(SHEETS.PROCESSOS)
    .filter(pr => String(pr.responsavel_atual || pr.criado_por).toLowerCase() === email);
  const docs = lerLinhas(SHEETS.DOCUMENTOS);
  const alertas = [];

  procs.filter(pr => pr.status !== 'Concluído').forEach(pr => {
    const horasSemMov = horasDesde(pr.atualizado_em || pr.criado_em);
    const tipo = String(pr.tipo_processo || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const base = { processo_id: pr.id, numero_sei: pr.numero_sei, titulo: pr.titulo };
    if (URGENCIA_HORAS[tipo] && horasSemMov > URGENCIA_HORAS[tipo]) {
      alertas.push(Object.assign({}, base, { tipo: 'urgencia_tipo', cor: 'vermelho',
        mensagem: (pr.tipo_processo || 'Processo') + ' parado há ' + Math.floor(horasSemMov) + 'h — requer atenção imediata.' }));
      return;
    }
    if (pr.data_limite) {
      const d = diasAte(pr.data_limite);
      if (d !== null && d < 0) {
        alertas.push(Object.assign({}, base, { tipo: 'data_limite_vencida', cor: 'vermelho',
          mensagem: 'Prazo vencido há ' + Math.abs(Math.ceil(d)) + ' dia(s).' }));
        return;
      }
      if (d !== null && d <= AVISO_DATA_LIMITE_DIAS) {
        alertas.push(Object.assign({}, base, { tipo: 'data_limite_proximo', cor: 'amarelo',
          mensagem: 'Prazo em ' + Math.ceil(d) + ' dia(s) (' + new Date(pr.data_limite).toLocaleDateString('pt-BR') + ').' }));
      }
    }
    if (horasSemMov >= PADRAO_HORAS_SEM_MOV && !alertas.find(a => String(a.processo_id) === String(pr.id))) {
      alertas.push(Object.assign({}, base, { tipo: 'sem_movimento', cor: 'laranja',
        mensagem: 'Sem movimentação há ' + Math.floor(horasSemMov / 24) + ' dia(s).' }));
    }
  });
  procs.filter(pr => pr.status === 'Concluído').forEach(pr => {
    if (!docs.some(d => String(d.processo_id) === String(pr.id) && d.tipo_documento === 'FINAL_ASSINADO'))
      alertas.push({ processo_id: pr.id, numero_sei: pr.numero_sei, titulo: pr.titulo,
        tipo: 'sem_assinatura', cor: 'azul', mensagem: 'Concluído sem versão assinada importada.' });
  });
  return { alertas };
}

// ---------- ABA PERGUNTAS (recebidas e enviadas, em qualquer processo) ----------
function achadosMeus(p) {
  const email = String(p.usuario).toLowerCase();
  const processos = {};
  lerLinhas(SHEETS.PROCESSOS).forEach(pr => { processos[String(pr.id)] = pr; });
  const comProcesso = a => {
    const pr = processos[String(a.processo_id)] || {};
    return Object.assign({}, a, { numero_sei: pr.numero_sei || '', titulo_processo: pr.titulo || '', unidade: pr.unidade || '' });
  };
  const todas = lerLinhas(SHEETS.ACHADOS_CONSULTAS).sort((a, b) => new Date(b.data_envio) - new Date(a.data_envio));
  return {
    recebidas: todas.filter(a => String(a.para_usuario).toLowerCase() === email).map(comProcesso),
    enviadas: todas.filter(a => String(a.de_usuario).toLowerCase() === email).map(comProcesso)
  };
}

// ---------- FONTES OFICIAIS (IBGE, sem chave) — por enquanto só testa a conexão ----------
const FONTES_OFICIAIS = {
  ibge_ipca: 'https://servicodados.ibge.gov.br/api/v3/agregados/1737/periodos/-1/variaveis/2266?localidades=N1[all]',
  ibge_localidades: 'https://servicodados.ibge.gov.br/api/v1/localidades/estados/PE/municipios'
};

function fontesTestar(p) {
  const url = FONTES_OFICIAIS[p.fonte];
  if (!url) return { ok: false, erro: 'Fonte desconhecida ou ainda sem conexão.' };
  let resp;
  try { resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true }); }
  catch (e) { return { ok: false, erro: 'Não foi possível acessar o IBGE: ' + e.message }; }
  if (resp.getResponseCode() !== 200) return { ok: false, erro: 'O IBGE respondeu com HTTP ' + resp.getResponseCode() + '.' };
  let dados;
  try { dados = JSON.parse(resp.getContentText()); }
  catch (e) { return { ok: false, erro: 'O IBGE respondeu num formato inesperado.' }; }
  if (p.fonte === 'ibge_ipca') {
    const serie = (((((dados || [])[0] || {}).resultados || [])[0] || {}).series || [])[0];
    const valores = (serie && serie.serie) || {};
    const periodos = Object.keys(valores);
    if (!periodos.length) return { ok: false, erro: 'O IBGE respondeu, mas sem valor do IPCA.' };
    const ultimo = periodos[periodos.length - 1];
    return { resumo: 'IPCA de ' + ultimo.substring(4, 6) + '/' + ultimo.substring(0, 4) + ': número-índice ' + valores[ultimo] };
  }
  if (!Array.isArray(dados) || !dados.length) return { ok: false, erro: 'O IBGE respondeu, mas sem municípios.' };
  return { resumo: dados.length + ' municípios de Pernambuco disponíveis' };
}

// ============================================================
// SEI GESTÃO — PAINEL "HOJE" (uma única chamada entrega tudo)
// ============================================================
// Lê cada aba uma vez e devolve os números de todos os usuários. Só gestor.
const TETO_CELULAS_PLANILHA = 10000000; // limite do Google Sheets por planilha

function _inicioDoDiaRecife(agora) {
  // Recife não tem horário de verão: sempre UTC-3.
  const local = new Date(agora.getTime() - 3 * 3600000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) + 3 * 3600000);
}

function admPainel(p) {
  const check = _exigirAdmin(p);
  if (!check.ok) return check;
  const agora = new Date();
  const iniDia = _inicioDoDiaRecife(agora).getTime();
  const dias = d => d ? Math.floor((agora - new Date(d)) / 86400000) : null;
  const diasParado = Math.max(Number(p.dias_parado) || 7, 1);
  const filtroGer = String(p.gerencia || '').trim();

  const usuarios = lerLinhas(SHEETS.USUARIOS).filter(u => String(u.ativo).toUpperCase() !== 'FALSE')
    .map(u => ({ nome: u.nome, email: String(u.email).toLowerCase(), gerencia: u.gerencia || '' }));
  const nomeDe = {};
  usuarios.forEach(u => { nomeDe[u.email] = u.nome; });
  const gerencias = [...new Set(usuarios.map(u => u.gerencia).filter(Boolean))].sort();
  const pessoas = filtroGer ? usuarios.filter(u => u.gerencia === filtroGer) : usuarios;
  const emailsFiltro = new Set(pessoas.map(u => u.email));

  let processos = lerLinhas(SHEETS.PROCESSOS);
  if (filtroGer) processos = processos.filter(x => x.gerencia === filtroGer || emailsFiltro.has(String(x.responsavel_atual).toLowerCase()));
  const acomp = lerLinhas(SHEETS.ACOMPANHAMENTOS).filter(a => String(a.ativo).toUpperCase() !== 'FALSE');
  const perguntas = lerLinhas(SHEETS.ACHADOS_CONSULTAS);
  const docs = lerLinhas(SHEETS.DOCUMENTOS);
  const auds = lerLinhas(SHEETS.AUDITORIAS);
  const log = lerLinhas(SHEETS.LOG);
  const procPorId = {};
  lerLinhas(SHEETS.PROCESSOS).forEach(x => { procPorId[String(x.id)] = x; });
  const ANDAMENTO = [STATUS.EM_ANALISE, STATUS.AGUARDANDO_FINAL, STATUS.PRONTO_ASSINAR];

  // Última atividade de cada pessoa (registro de atividades)
  const ultimaAtiv = {};
  log.forEach(l => {
    const e = String(l.usuario).toLowerCase(), t = new Date(l.data).getTime();
    if (!ultimaAtiv[e] || t > ultimaAtiv[e]) ultimaAtiv[e] = t;
  });

  const porPessoa = pessoas.map(u => {
    const meus = processos.filter(x => String(x.responsavel_atual).toLowerCase() === u.email);
    return {
      nome: u.nome, email: u.email, gerencia: u.gerencia,
      entrada: meus.filter(x => x.status === STATUS.AGUARDANDO_INICIAL).length,
      andamento: meus.filter(x => ANDAMENTO.indexOf(x.status) > -1).length,
      acompanhando: acomp.filter(a => String(a.usuario).toLowerCase() === u.email).length,
      concluidos_hoje: meus.filter(x => x.status === 'Concluído' && new Date(x.atualizado_em).getTime() >= iniDia).length,
      perguntas_pendentes: perguntas.filter(q => String(q.para_usuario).toLowerCase() === u.email && !q.resposta).length,
      ultima_atividade: ultimaAtiv[u.email] ? new Date(ultimaAtiv[u.email]).toISOString() : ''
    };
  });

  const porStatus = {};
  processos.forEach(x => { porStatus[x.status || '(sem status)'] = (porStatus[x.status || '(sem status)'] || 0) + 1; });

  const parados = processos
    .filter(x => x.status !== 'Concluído' && dias(x.atualizado_em || x.criado_em) >= diasParado)
    .map(x => ({ id: x.id, numero_sei: x.numero_sei, titulo: x.titulo, unidade: x.unidade, status: x.status,
      com: nomeDe[String(x.responsavel_atual).toLowerCase()] || x.responsavel_atual, dias: dias(x.atualizado_em || x.criado_em) }))
    .sort((a, b) => b.dias - a.dias).slice(0, 60);

  const perguntasSemResposta = perguntas
    .filter(q => !q.resposta && (!filtroGer || emailsFiltro.has(String(q.para_usuario).toLowerCase())))
    .map(q => { const pr = procPorId[String(q.processo_id)] || {}; return {
      de: nomeDe[String(q.de_usuario).toLowerCase()] || q.de_usuario, para: nomeDe[String(q.para_usuario).toLowerCase()] || q.para_usuario,
      numero_sei: pr.numero_sei || '', titulo: pr.titulo || '', achado: q.achado_referencia, dias: dias(q.data_envio) }; })
    .sort((a, b) => b.dias - a.dias).slice(0, 60);

  const logHoje = log.filter(l => new Date(l.data).getTime() >= iniDia && (!filtroGer || emailsFiltro.has(String(l.usuario).toLowerCase())));
  const acoesHoje = {}, pessoasHoje = {};
  logHoje.forEach(l => {
    acoesHoje[l.acao] = (acoesHoje[l.acao] || 0) + 1;
    const n = nomeDe[String(l.usuario).toLowerCase()] || l.usuario;
    pessoasHoje[n] = (pessoasHoje[n] || 0) + 1;
  });
  const ultimosEventos = logHoje.sort((a, b) => new Date(b.data) - new Date(a.data)).slice(0, 30)
    .map(l => ({ data: l.data, quem: nomeDe[String(l.usuario).toLowerCase()] || l.usuario, acao: l.acao, processo_id: l.processo_id,
      numero_sei: (procPorId[String(l.processo_id)] || {}).numero_sei || '' }));

  const alertas = [];
  processos.forEach(x => {
    const base = { numero_sei: x.numero_sei, titulo: x.titulo, com: nomeDe[String(x.responsavel_atual).toLowerCase()] || x.responsavel_atual };
    if (x.status !== 'Concluído' && x.data_limite) {
      const faltam = Math.ceil((new Date(x.data_limite) - agora) / 86400000);
      if (faltam < 0) alertas.push(Object.assign(base, { cor: 'vermelho', mensagem: 'Prazo vencido há ' + Math.abs(faltam) + ' dia(s)' }));
      else if (faltam <= AVISO_DATA_LIMITE_DIAS) alertas.push(Object.assign(base, { cor: 'amarelo', mensagem: 'Prazo em ' + faltam + ' dia(s)' }));
    }
    if (x.status === 'Concluído' && !docs.some(d => String(d.processo_id) === String(x.id) && d.tipo_documento === 'FINAL_ASSINADO')) {
      alertas.push(Object.assign({}, base, { cor: 'azul', mensagem: 'Concluído sem versão assinada importada' }));
    }
  });

  const idsComChecagem = new Set(auds.filter(a => a.tipo_checkpoint === 'GERAL' || a.tipo_checkpoint === 'ENTRADA').map(a => String(a.processo_id)));
  const qualidade = {
    total_processos: processos.length,
    sem_checagem: processos.filter(x => !idsComChecagem.has(String(x.id))).length,
    concluidos: processos.filter(x => x.status === 'Concluído').length,
    concluidos_sem_assinatura: alertas.filter(a => a.cor === 'azul').length,
    documentos: docs.length
  };

  return { gerado_em: agora.toISOString(), gerencias, filtro_gerencia: filtroGer, dias_parado: diasParado,
    por_pessoa: porPessoa, por_status: porStatus, parados, perguntas_sem_resposta: perguntasSemResposta,
    atividade_hoje: { total: logHoje.length, por_acao: acoesHoje, por_pessoa: pessoasHoje, ultimos: ultimosEventos },
    alertas: alertas.slice(0, 80), qualidade, banco: _estadoDoBanco() };
}

// Tamanho da planilha (o Google conta as células reservadas, mesmo vazias) e crescimento.
// Guarda uma foto por dia nas propriedades do script, para calcular o ritmo semanal.
function _estadoDoBanco() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const abas = ss.getSheets().map(sh => ({
    nome: sh.getName(), linhas: Math.max(sh.getLastRow() - 1, 0),
    celulas: sh.getMaxRows() * sh.getMaxColumns()
  })).sort((a, b) => b.celulas - a.celulas);
  const total = abas.reduce((s, a) => s + a.celulas, 0);
  const props = PropertiesService.getScriptProperties();
  let hist = [];
  try { hist = JSON.parse(props.getProperty('banco_historico') || '[]'); } catch (e) { hist = []; }
  const hoje = new Date().toISOString().slice(0, 10);
  if (!hist.length || hist[hist.length - 1].d !== hoje) {
    hist.push({ d: hoje, c: total });
    hist = hist.slice(-120);
    try { props.setProperty('banco_historico', JSON.stringify(hist)); } catch (e) { /* só perde o histórico */ }
  }
  const umaSemana = hist.filter(h => (new Date(hoje) - new Date(h.d)) / 86400000 >= 7).pop();
  const porSemana = umaSemana ? Math.round((total - umaSemana.c) * 7 / Math.max((new Date(hoje) - new Date(umaSemana.d)) / 86400000, 1)) : null;
  return {
    total_celulas: total, teto: TETO_CELULAS_PLANILHA,
    percentual: Math.round(total / TETO_CELULAS_PLANILHA * 1000) / 10,
    crescimento_semanal: porSemana,
    semanas_ate_o_teto: porSemana && porSemana > 0 ? Math.floor((TETO_CELULAS_PLANILHA - total) / porSemana) : null,
    abas
  };
}
