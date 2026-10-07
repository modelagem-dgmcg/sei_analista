// ============================================================
// SEI ANALISTA v24.5 — app.js
// Versão gerada em 07/10/2026 10:40 (horário de Recife)
// Junção do v22.3 (sessão, segurança, histórico de perguntas, registro no servidor) com o
// v23.5 (DeepSeek, Panorama, Mensageiro, Assumir, botões de fluxo, lotes, diagnóstico da IA).
// ============================================================

// ==================== REGISTRO DE AUTORIA ====================
// © 2026 Secretaria de Estado de Saúde de Pernambuco (SES-PE) — DGMCG/GGPCG.
// Desenvolvido por Antonio Cleuton Eufrasio Vieira, Analista Administrativo - CTD,
// matrícula 18515045.
console.log("%cSES-PE — DGMCG/GGPCG", "color: #364fc7; font-size: 16px; font-weight: bold;");
console.log("%cDesenvolvido por Cleuton Vieira.", "color: #495057; font-size: 13px;");

// ==================== VERSÃO ====================
// Atualizar a cada nova entrega. Aparece no rodapé da tela junto com a versão do
// servidor (Code.gs), para conferir de relance se os dois estão atualizados.
const VERSAO_APP = 'v24.5';
const VERSAO_APP_DATA = '07/10/2026 10:40';
console.log('SEI Analista ' + VERSAO_APP + ' — ' + VERSAO_APP_DATA);

// As chaves de IA são cadastradas pelo gestor no SEI Gestão e entregues pelo servidor
// depois do login (ver _carregarChavesDaGestao). Ficam só na memória desta aba; chaves
// antigas guardadas no navegador são apagadas para não ficarem esquecidas ali.
let GEMINI_KEY = '', GROQ_KEY = '', KIMI_KEY = '', OPENROUTER_KEY = '', DEEPSEEK_KEY = '';
let CHAVES_DA_GESTAO = []; // [{ servico, nome, rotulo, final }] — sem a chave
['gemini', 'groq', 'kimi', 'openrouter', 'deepseek'].forEach(s => { try { localStorage.removeItem('sei_' + s + '_key'); } catch (e) { /* sem acesso ao armazenamento */ } });
let OLLAMA_URL = localStorage.getItem('sei_ollama_url') || 'http://localhost:11434';
let OLLAMA_MODEL = localStorage.getItem('sei_ollama_model') || 'qwen2.5:7b';

// Habilitado/desabilitado — SEPARADO da chave, de propósito. Desligar um provedor não
// apaga a chave dele (pra não precisar colar tudo de novo depois); só faz o motor pular
// esse provedor por ora. Padrão: habilitado (só desliga quem a pessoa desligar de fato).
function _lerHabilitado(chaveStorage) {
  const v = localStorage.getItem(chaveStorage);
  return v === null ? true : v === 'true';
}
let GEMINI_ATIVO = _lerHabilitado('sei_gemini_ativo');
let GROQ_ATIVO = _lerHabilitado('sei_groq_ativo');
let KIMI_ATIVO = _lerHabilitado('sei_kimi_ativo');
let OPENROUTER_ATIVO = _lerHabilitado('sei_openrouter_ativo');
let DEEPSEEK_ATIVO = _lerHabilitado('sei_deepseek_ativo');
let OLLAMA_ATIVO = _lerHabilitado('sei_ollama_ativo');

// Ordem de tentativa dos provedores — cada pessoa pode reordenar (tela "Motor de IA"),
// porque o provedor que funciona rápido pra uma pessoa pode não ser o mesmo pra outra
// (rede, cota, região). Padrão de fábrica: Gemini primeiro, igual sempre foi.
let ORDEM_PROVEDORES_IDS = (() => { try { return JSON.parse(localStorage.getItem('sei_ordem_provedores') || 'null'); } catch (e) { return null; } })();
// Ordem gravada por versão antiga pode estar sem algum provedor (as versões anteriores
// gravavam sem o DeepSeek). Quem faltar entra antes do Ollama, em vez de nunca ser tentado.
(function _completarOrdemProvedores() {
  const todos = ['gemini', 'groq', 'kimi', 'openrouter', 'deepseek', 'ollama'];
  if (!Array.isArray(ORDEM_PROVEDORES_IDS)) ORDEM_PROVEDORES_IDS = todos.slice();
  ORDEM_PROVEDORES_IDS = ORDEM_PROVEDORES_IDS.filter(id => todos.includes(id));
  todos.forEach(id => {
    if (ORDEM_PROVEDORES_IDS.includes(id)) return;
    const posOllama = ORDEM_PROVEDORES_IDS.indexOf('ollama');
    if (id !== 'ollama' && posOllama >= 0) ORDEM_PROVEDORES_IDS.splice(posOllama, 0, id);
    else ORDEM_PROVEDORES_IDS.push(id);
  });
})();

let API_URL = 'https://script.google.com/macros/s/AKfycbzzcJEAQPUCwY5YC2o1O5bj500pRE2mOFfZrLCy-e2kFzIgoDkebamJBgQK_yV2Ez0b/exec';

let usuarioAtual = null;
// Token da sessão — fica só na memória desta janela (não é gravado no navegador).
// Recarregar a página ou fechar o app = entrar de novo, como já era antes.
let SESSAO_TOKEN = null;
let _sessaoExpiradaAviso = false;
// Gravações recusadas porque a sessão venceu. As da lista SEGURAS_PARA_REENVIAR são
// reenviadas sozinhas depois que a pessoa entra de novo (quem as chamou não mostra erro
// nem espera resposta — sem reenvio, o resultado da checagem, uma pergunta ao processo
// ou uma anotação sumiriam em silêncio). As demais já mostraram erro na tela; aqui só
// guardamos o nome delas para avisar o que precisa ser refeito.
const SEGURAS_PARA_REENVIAR = ['auditorias/salvar', 'notas/salvar', 'log/registrar'];
const NOMES_ACOES = {
  'processos/criar': 'a criação do processo',
  'processos/encaminhar': 'o encaminhamento do processo',
  'processos/atualizar-status': 'a finalização do processo',
  'processos/remover': 'a remoção do processo',
  'processos/parar-acompanhamento': 'o fim do acompanhamento',
  'documentos/adicionar-completo': 'a importação de documento',
  'achados/encaminhar': 'o encaminhamento do achado',
  'achados/responder': 'a resposta ao colega'
};
let _reenviarAposLogin = [];
let _refazerAposLogin = new Set();
let processoAtual = null;
let textoIntegralAtual = '';
let _ultimoTextoRevisadoHash = null;
let _ultimaTramitacaoRecebida = null;
let _arquivoPrePreenchido = null;
let painelEvidenciasWin = null;
window.memoriaEvidencias = {};
window.achadosAtuais = [];


// ==================== AVISO DE VERSÃO NOVA ====================
// Cada aparelho compara a versão que está rodando com a que está publicada. Se mudou, aparece
// uma faixa com o botão Atualizar. Nada recarrega sozinho, para não perder o que você está escrevendo.
let _ultimaChecagemVersao = 0;
function _mostrarFaixaVersaoNova(rotulo) {
  if (document.getElementById('faixa-versao-nova')) return;
  const f = document.createElement('div');
  f.id = 'faixa-versao-nova';
  f.style.cssText = 'position:fixed; left:50%; transform:translateX(-50%); bottom:18px; z-index:2000; background:#1a1d20; color:#f8f9fa; padding:10px 14px; border-radius:8px; font-size:0.85rem; display:flex; gap:12px; align-items:center; flex-wrap:wrap; justify-content:center; box-shadow:0 6px 20px rgba(0,0,0,0.3); max-width:92vw;';
  f.innerHTML = `<span>Há uma versão nova (${String(rotulo).replace(/</g, '&lt;')}). Salve o que estiver escrevendo e atualize.</span>
    <button class="btn btn-sm" style="background:#d97706; color:#fff;" onclick="atualizarParaVersaoNova()">Atualizar</button>
    <button class="btn btn-sm btn-secondary" onclick="document.getElementById('faixa-versao-nova').remove()">Depois</button>`;
  document.body.appendChild(f);
}
async function atualizarParaVersaoNova() {
  try { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.update())); } catch (e) { /* sem service worker */ }
  try { const chaves = await caches.keys(); await Promise.all(chaves.map(k => caches.delete(k))); } catch (e) { /* sem cache */ }
  location.reload();
}
function _iniciarVigiaDeVersao() {
  setTimeout(() => verificarVersaoNova(true), 4000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') verificarVersaoNova(); });
  setInterval(() => verificarVersaoNova(), 15 * 60 * 1000);
}

async function verificarVersaoNova(forcar = false) {
  if (!forcar && Date.now() - _ultimaChecagemVersao < 5 * 60 * 1000) return;
  _ultimaChecagemVersao = Date.now();
  try {
    const r = await fetch('app.js?v=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const t = await r.text();
    const v = t.match(/const VERSAO_APP\s*=\s*'([^']+)'/), d = t.match(/const VERSAO_APP_DATA\s*=\s*'([^']+)'/);
    if (v && (v[1] !== VERSAO_APP || (d && d[1] !== VERSAO_APP_DATA))) _mostrarFaixaVersaoNova(v[1] + (d ? ' · ' + d[1] : ''));
  } catch (e) { /* sem rede: tenta de novo mais tarde */ }
}

window.onload = () => {
  window.name = 'sei_analista';
  _iniciarVigiaDeVersao();
  _entrarComPasse('analista');
  verificarIA();
  injetarMarcaDagua();
  injetarBotaoSobre();
  _garantirEstiloNotificacoes();
};

function injetarMarcaDagua() {
  const rodape = document.createElement('div');
  rodape.innerHTML = `&copy; 2026 SES-PE — DGMCG/GGPCG. Desenvolvido por <strong>Cleuton Vieira</strong>.
    <div id="rodape-versao" style="margin-top:4px; font-size:0.68rem; color:#ced4da;">App ${VERSAO_APP} · ${VERSAO_APP_DATA}</div>`;
  rodape.style = "text-align: center; padding: 15px; font-size: 0.75rem; color: #adb5bd; margin-top: auto; border-top: 1px solid #dee2e6;";
  document.getElementById('content').parentElement.appendChild(rodape);
}

// ==================== "O QUE É ISSO?" NA TELA DE LOGIN ====================
// Texto final, decantado ao longo de várias rodadas de revisão — prosa corrida, sem
// lista com negrito (evita o padrão de texto gerado por IA), em linguagem simples.
const TEXTO_SOBRE_FERRAMENTA = `
  <h2 style="margin-bottom:4px; font-size:1.25rem;">O que é o SEI Analista</h2>
  <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:18px;">
    Ferramenta da DGMCG e da GGPCG para apoiar a análise de processos de Contrato de Gestão
    com Organizações Sociais de Saúde na SES-PE.
  </p>

  <h3 style="font-size:1rem; margin-bottom:10px;">O que ele faz por você</h3>
  <p style="font-size:0.87rem; line-height:1.6; margin-bottom:12px;">
    Antes de assinar qualquer documento, ele confere o processo inteiro. Verifica valores,
    datas, cálculos e indicadores de metas contratuais, além de identificar textos
    duplicados ou copiados incorretamente. Somas de tabelas, valores anuais e mensais e valores
    por extenso são conferidos por código, como numa calculadora. Se uma conta não bater, ou
    se um número divergir entre os documentos, ele aponta o trecho exato e a provável correção.
  </p>
  <p style="font-size:0.87rem; line-height:1.6; margin-bottom:12px;">
    Se você precisar consultar normas ou decisões de tribunais, o sistema pode buscar fontes
    estaduais e federais. Essa busca é experimental: confirme a fonte antes de citar em um parecer.
  </p>
  <p style="font-size:0.87rem; line-height:1.6; margin-bottom:12px;">
    Precisa localizar um dado sem precisar reler o processo inteiro? Basta fazer a pergunta
    e o sistema traz a resposta exata, indicando o documento de origem.
  </p>
  <p style="font-size:0.87rem; line-height:1.6; margin-bottom:12px;">
    Antes de enviar um parecer, nota técnica ou ofício, ele revisa o conteúdo junto com você,
    avaliando mérito, gramática e clareza textual.
  </p>
  <p style="font-size:0.87rem; line-height:1.6; margin-bottom:18px;">
    Caso queira debater um ponto com um colega antes de decidir, é possível encaminhar o
    achado específico ou o processo inteiro diretamente pela ferramenta.
  </p>

  <h3 style="font-size:1rem; margin-bottom:8px;">O que ele não faz</h3>
  <p style="font-size:0.87rem; line-height:1.6; margin-bottom:18px;">
    Ele não toma decisões e nem substitui o servidor. Cada apontamento é uma sugestão
    técnica para sua conferência. A palavra final e a aprovação são sempre do analista.
  </p>

  <h3 style="font-size:1rem; margin-bottom:8px;">Sobre os dados</h3>
  <p style="font-size:0.87rem; line-height:1.6; margin-bottom:18px;">
    Antes de qualquer texto ser enviado para análise externa, o sistema oculta os dados pessoais
    que reconhece, como CPF, RG, contatos, dados bancários e a qualificação das partes, e mostra
    o que foi protegido e em qual documento estava. A ocultação reduz o risco, mas não substitui
    a sua conferência.
  </p>
  <p style="font-size:0.87rem; line-height:1.6; margin-bottom:18px;">
    As ações feitas na ferramenta, como entrar, abrir, encaminhar ou concluir um processo, ficam
    registradas com data, hora e usuário. Esse registro dá segurança e rastreabilidade ao trabalho
    e pode ser consultado pela gestão. O conteúdo dos documentos não é copiado para o registro.
  </p>

  <h3 style="font-size:1rem; margin-bottom:8px;">Base legal e titularidade</h3>
  <p style="font-size:0.87rem; line-height:1.6; margin-bottom:18px;">
    Os direitos econômicos deste software pertencem à SES-PE, por ter sido desenvolvido no
    âmbito do vínculo funcional do autor com o órgão público (Lei nº 9.609/98, art. 4º). O
    direito de paternidade da criação, porém, é preservado ao autor a qualquer tempo,
    independentemente da titularidade econômica (Lei nº 9.609/98, art. 2º, §1º; Lei nº
    9.610/98, art. 24, I).
  </p>

  <h3 style="font-size:1rem; margin-bottom:8px;">Desenvolvido por</h3>
  <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.6;">
    Secretaria de Estado de Saúde de Pernambuco, por meio da DGMCG e da GGPCG. Ferramenta
    criada por Antonio Cleuton Eufrasio Vieira, Analista Administrativo, para uso exclusivo
    da equipe da Gerência de Gestão de Processos dos Contratos de Gestão.
  </p>
`;

function abrirSobreFerramenta() {
  criarModal(`<div style="max-height:70vh; overflow-y:auto; padding-right:6px;">${TEXTO_SOBRE_FERRAMENTA}</div>`);
}

// Injeta o botão "?" dentro da caixa de login, sem precisar tocar no index.html —
// mesmo padrão já usado pra rodapé/marca d'água.
function injetarBotaoSobre() {
  const loginBox = document.querySelector('#login-screen .login-box');
  if (!loginBox || document.getElementById('link-sobre-ferramenta')) return;
  const link = document.createElement('button');
  link.id = 'link-sobre-ferramenta';
  link.type = 'button';
  link.innerHTML = '<i class="ti ti-info-circle"></i> O que é o SEI Analista?';
  link.style = "display:block; width:100%; text-align:center; margin-top:18px; padding:0; border:none; background:none; font-size:0.85rem; color:#495057; text-decoration:underline; cursor:pointer;";
  link.addEventListener('click', abrirSobreFerramenta);
  loginBox.appendChild(link);
}

const API_TIMEOUT_MS = 25000;
// Toda chamada ao backend vai por POST, com o token da sessão dentro do corpo — nunca
// no endereço, porque endereço fica gravado em histórico de navegador e de servidor.
// opcoes.fundo = chamada automática (aviso de processo novo): não conta como uso da sessão.
async function api(action, body = null, opcoes = {}) {
  const url = API_URL + '?action=' + encodeURIComponent(action);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const corpo = Object.assign({}, body || {}, { token: SESSAO_TOKEN });
  if (opcoes.fundo) corpo._fundo = true;
  const opts = {
    method: 'POST', signal: controller.signal,
    headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(corpo)
  };
  try {
    const resp = await fetch(url, opts);
    const texto = await resp.text();
    let res;
    try { res = JSON.parse(texto); }
    catch (e) {
      // O Google devolveu uma página em vez de dados (implantação fora do ar, permissão, etc.).
      return { ok: false, erro: 'O servidor respondeu de um jeito inesperado. Tente de novo em instantes; se continuar, avise o responsável pelo sistema.' };
    }
    // Resposta que é dado válido mas não é o formato esperado (ex.: vazia) — mesma mensagem,
    // em vez de deixar a tela quebrar ao ler "res.ok".
    if (!res || typeof res !== 'object' || Array.isArray(res)) {
      return { ok: false, erro: 'O servidor respondeu de um jeito inesperado. Tente de novo em instantes; se continuar, avise o responsável pelo sistema.' };
    }
    if (res.sessao_expirada && action !== 'auth/login' && action !== 'auth/logout') {
      if (SEGURAS_PARA_REENVIAR.includes(action)) _reenviarAposLogin.push({ action, body: body || {} });
      else if (NOMES_ACOES[action]) _refazerAposLogin.add(NOMES_ACOES[action]);
      _tratarSessaoExpirada();
    }
    return res;
  } catch (e) {
    if (e.name === 'AbortError') return { ok: false, erro: `Servidor não respondeu em ${API_TIMEOUT_MS / 1000}s. Tente novamente.` };
    return { ok: false, erro: e.message };
  } finally {
    clearTimeout(timer);
  }
}

// Sessão venceu no meio do trabalho: esconde o app (sem apagar nada do que está na
// tela — o conteúdo continua lá, só fica escondido) e mostra o login de novo. Ao entrar
// com o mesmo usuário, a pessoa volta exatamente para onde estava.
function _tratarSessaoExpirada() {
  if (_sessaoExpiradaAviso || !usuarioAtual) return;
  _sessaoExpiradaAviso = true;
  SESSAO_TOKEN = null; window.__seiLogado = false;
  if (_intervaloMonitoramento) { clearInterval(_intervaloMonitoramento); _intervaloMonitoramento = null; }
  document.getElementById('app')?.classList.add('hidden');
  document.getElementById('login-screen')?.classList.remove('hidden');
  const campoUsuario = document.getElementById('login-usuario');
  if (campoUsuario) campoUsuario.value = usuarioAtual.email;
  const campoSenha = document.getElementById('login-senha');
  if (campoSenha) { campoSenha.value = ''; campoSenha.focus(); }
  mostrarErroLogin('Sua sessão expirou. Entre de novo para continuar: o que está na tela não foi apagado. A última ação pode não ter sido salva; confira depois de entrar.');
}

async function sha256(txt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function fazerLogin() {
  try {
    const usuario = document.getElementById('login-usuario').value.trim();
    const senhaInput = document.getElementById('login-senha').value;
    if (!usuario || !senhaInput) { mostrarErroLogin('Preencha login e senha.'); return; }
    const hash = await sha256(senhaInput);
    const res = await api('auth/login', { email: usuario, senha_hash: hash, app: 'analista' });
    if (res.ok) {
      await _entrarComResposta(res);
    } else {
      mostrarErroLogin(res.erro || 'Erro ao conectar. Credenciais inválidas ou bloqueio de permissão no Google.');
    }
  } catch (e) { mostrarErroLogin('Erro no motor JS: ' + e.message); }
}

// Entrada depois que o servidor aceitou: vale para o login com senha e para o passe vindo do SEI Gestão.
async function _entrarComResposta(res) {
  {
    {
      SESSAO_TOKEN = res.token;
      window.__seiLogado = true;
      document.getElementById('login-senha').value = '';
      document.getElementById('login-error')?.classList.add('hidden');
      const mesmaPessoa = usuarioAtual && String(usuarioAtual.email).toLowerCase() === String(res.usuario.email).toLowerCase();
      const eraReentrada = _sessaoExpiradaAviso && mesmaPessoa;
      _sessaoExpiradaAviso = false;
      fecharModal();

      if (eraReentrada) {
        // Volta para onde estava, sem recarregar a tela.
        usuarioAtual = res.usuario;
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        iniciarMonitoramentoNovosItens();
        _carregarChavesDaGestao();
        await _concluirPendenciasAposLogin();
        return;
      }

      // Outra pessoa entrou numa tela que era de outro usuário: limpa o que era dele —
      // inclusive gravações pendentes, que jamais podem ir no nome de quem entrou agora.
      _reenviarAposLogin = []; _refazerAposLogin = new Set();
      if (usuarioAtual && !mesmaPessoa) {
        processoAtual = null; textoIntegralAtual = ''; window.achadosAtuais = []; window.memoriaEvidencias = {};
        window._historicoConsultas = [];
        if (painelEvidenciasWin && !painelEvidenciasWin.closed) painelEvidenciasWin.close();
      }

      usuarioAtual = res.usuario;
      _mostrarVersaoServidor(res.versao_backend);
      _carregarChavesDaGestao();
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      document.getElementById('sidebar-nome').textContent = usuarioAtual.nome;
      document.getElementById('sidebar-gerencia').textContent = usuarioAtual.gerencia;
      document.getElementById('sidebar-email').textContent = usuarioAtual.email;
      showView('dashboard', 'panorama');
      iniciarMonitoramentoNovosItens();
      carregarAlertasSidebar();
      _mostrarBotaoGestao();
      if (!window._intervaloAlertas) window._intervaloAlertas = setInterval(carregarAlertasSidebar, 300000);
    }
  }
}

// Depois de entrar de novo: reenvia o que era seguro reenviar e avisa, com clareza, o que
// ficou para trás e precisa ser refeito pela pessoa.
async function _concluirPendenciasAposLogin() {
  const reenviar = _reenviarAposLogin; _reenviarAposLogin = [];
  const refazer = [..._refazerAposLogin]; _refazerAposLogin = new Set();
  let falharam = 0;
  for (const item of reenviar) {
    const r = await api(item.action, item.body);
    if (!r || !r.ok) falharam++;
  }
  let salvos = reenviar.length - falharam;
  const perguntasPendentes = (window._historicoConsultas || []).filter(c => c.estado === 'falhou');
  for (const c of perguntasPendentes) {
    if (await salvarConsultaNoHistorico(c.tempId)) salvos++; else falharam++;
  }
  const partes = ['Sessão renovada.'];
  if (salvos) partes.push(`${salvos} registro(s) que estavam pendentes foram salvos agora.`);
  if (falharam) partes.push(`${falharam} registro(s) não puderam ser salvos.`);
  if (refazer.length) partes.push('Precisa ser refeito: ' + refazer.join(', ') + '.');
  if (!salvos && !falharam && !refazer.length) partes.push('Nada ficou pendente.');
  // Aviso de algo a refazer fica mais tempo na tela — não pode passar despercebido.
  mostrarToast(partes.join(' '), (refazer.length || falharam) ? 15000 : 5000);
}

// O servidor informa a própria versão no login. Se ele ainda for o antigo (sem versão),
// o rodapé diz isso — é o sinal de que falta publicar a nova versão da implantação.
function _mostrarVersaoServidor(versaoBackend) {
  const el = document.getElementById('rodape-versao');
  if (!el) return;
  el.textContent = `App ${VERSAO_APP} · ${VERSAO_APP_DATA} — Servidor ${versaoBackend || 'sem versão (antigo)'}`;
}

function mostrarErroLogin(msg) {
  const errDiv = document.getElementById('login-error');
  if (errDiv) { errDiv.innerText = msg; errDiv.classList.remove('hidden'); } else { alert(msg); }
}

// Sair encerra a sessão também no servidor (o token deixa de valer na hora).
async function logout() {
  try { if (SESSAO_TOKEN) await api('auth/logout'); } catch (e) { /* sai de qualquer jeito */ }
  SESSAO_TOKEN = null; window.__seiLogado = false;
  location.reload();
}

async function showView(v, subCaixa = 'entrada') {
  document.querySelectorAll('#sidebar nav a, #caixa-flutuante-encaminhados a').forEach(a => a.classList.remove('active'));
  if (v === 'dashboard') {
    caixaAtualAtiva = subCaixa;
    let navItem = document.getElementById('nav-' + subCaixa);
    if (navItem) navItem.classList.add('active');
  } else {
    let navItem = document.getElementById('nav-' + v);
    if (navItem) navItem.classList.add('active');
  }
  const titulos = {
    dashboard_entrada: 'Caixa de Entrada',
    dashboard_andamento: 'Processos em Andamento',
    dashboard_encaminhados: 'Processos Encaminhados (Acompanhamento)',
    dashboard_concluidos: 'Registro de Concluídos',
    dashboard_panorama: 'Panorama',
    dashboard_perguntas: 'Perguntas sobre achados',
    novo: 'Importar Processo', config: 'Configurações'
  };
  const tituloKey = v === 'dashboard' ? 'dashboard_' + subCaixa : v;
  let pageTitle = document.getElementById('page-title');
  if (pageTitle) pageTitle.textContent = titulos[tituloKey] || v;
  const content = document.getElementById('content');
  if (!content) return;
  if (v === 'dashboard') {
    await renderDashboard(subCaixa);
  } else if (v === 'novo') {
    content.innerHTML = `
      <div style="max-width:600px;background:#fff;padding:24px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <div class="dropzone" id="dz-prefill"
             ondragover="event.preventDefault(); this.style.borderColor='var(--action-primary)';"
             ondragleave="this.style.borderColor='#ced4da';"
             ondrop="event.preventDefault(); this.style.borderColor='#ced4da'; prePreencherDeArquivo(event.dataTransfer.files[0]);"
             onclick="document.getElementById('np-arquivo').click()" style="margin-bottom:20px; padding:24px;">
          <i class="ti ti-wand" style="font-size:1.8rem; color:var(--action-primary); margin-bottom:6px;"></i><br>
          <strong style="font-size:0.9rem;">Solte um documento aqui pra preencher os campos automaticamente</strong><br>
          <span style="font-size:0.8rem; color:var(--text-muted);">Opcional — .pdf, .docx, .xlsx, .txt, .csv, .md, .pptx, .html (despacho SEI GOV), .png, .jpg ou .zip. Foto de documento/página escaneada é lida por OCR (mais lento). Confira tudo antes de salvar; a IA sugere, não afirma.</span>
        </div>
        <input type="file" id="np-arquivo" accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv,.md,.pptx,.ppt,.png,.jpg,.jpeg,.html,.htm,.zip" style="display:none" onchange="prePreencherDeArquivo(this.files[0])">
        <div id="np-status-preenchimento" style="margin-bottom:15px;"></div>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Dica: Cole o nome do arquivo (ex: SEI_230...) no campo abaixo e o sistema limpa o número, se não usar o preenchimento automático.</p>
        <div class="form-group"><label>Número SEI *</label><input id="np-sei" placeholder="Ex: 230000..." oninput="formatarSEI(this)"></div>
        <div class="form-group"><label>Título / Objeto *</label><input id="np-titulo" placeholder="Ex: 1º Termo Aditivo"></div>
        <div class="form-group"><label>Unidade</label><input id="np-unidade" placeholder="Ex: HRA"></div>
        <div class="form-group"><label>OSS</label><input id="np-oss" placeholder="Ex: ISG"></div>
        <div class="form-group"><label>Gerência</label><input id="np-gerencia" placeholder="Ex: GGPCG" value="${usuarioAtual?.gerencia || ''}"></div>
        <button class="btn btn-primary" id="btn-criar-processo" onclick="salvarNovoProcesso()"><i class="ti ti-device-floppy"></i> Criar Processo na Bancada</button>
      </div>`;
  } else if (v === 'config') {
    const ativoDe = { gemini: GEMINI_ATIVO, groq: GROQ_ATIVO, kimi: KIMI_ATIVO, openrouter: OPENROUTER_ATIVO, deepseek: DEEPSEEK_ATIVO };
    const nomes = { gemini: 'Gemini', groq: 'Groq', kimi: 'Kimi', openrouter: 'OpenRouter', deepseek: 'DeepSeek' };
    const liberados = CHAVES_DA_GESTAO.map(c => c.servico);
    const ordemTela = [...liberados, ...Object.keys(nomes).filter(s => !liberados.includes(s))];
    const cartao = (id) => {
      const k = CHAVES_DA_GESTAO.find(c => c.servico === id);
      if (!k) return `<div style="display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px solid #e9ecef; border-radius:8px; margin-bottom:8px; background:#f8f9fa; opacity:.6;">
          <i class="ti ti-lock" style="font-size:1.1rem; color:#adb5bd;"></i>
          <div><b>${nomes[id]}</b><div style="font-size:0.75rem; color:var(--text-muted);">Não liberado pela gestão para o seu usuário.</div></div></div>`;
      return `<div style="display:flex; align-items:center; gap:12px; padding:12px 14px; border:1px solid #dee2e6; border-radius:8px; margin-bottom:8px; background:#fff; flex-wrap:wrap;">
          <i class="ti ti-plug-connected" style="font-size:1.1rem; color:#495057;"></i>
          <div style="flex:1; min-width:180px;"><b>${nomes[id]}</b>
            <div style="font-size:0.75rem; color:var(--text-muted);">${escHtml(k.rotulo)} · chave fornecida pela gestão (final ••••${escHtml(k.final)})</div></div>
          <label style="display:flex; align-items:center; gap:5px; font-size:0.8rem; cursor:pointer; white-space:nowrap;">
            <input type="checkbox" id="ativo-${id}" ${ativoDe[id] ? 'checked' : ''} onchange="salvarConfig()"> Habilitado</label>
          <button type="button" class="btn btn-secondary btn-sm" onclick="testarConexaoProvedor('${id}')">Testar conexão</button>
          <span id="teste-${id}" style="font-size:0.75rem; width:100%;"></span></div>`;
    };
    content.innerHTML = `
      <div style="max-width:680px;background:#fff;padding:24px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <h3 style="font-size:1.05rem; margin-bottom:6px;"><i class="ti ti-sparkles"></i> Serviços de inteligência artificial</h3>
        <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:14px;">
          As chaves são fornecidas pela gestão. Aqui você liga ou desliga cada serviço liberado para você e testa a conexão.
          Desligar não apaga nada; só faz o sistema pular esse serviço. A ordem de tentativa é definida pela gestão.</p>
        ${ordemTela.map(cartao).join('')}
        <h3 style="font-size:0.95rem; margin:20px 0 6px;"><i class="ti ti-device-desktop"></i> Ollama (opcional, roda no seu computador)</h3>
        <div style="padding:12px 14px; border:1px solid #dee2e6; border-radius:8px;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <input type="text" id="cfg-ollama-url" value="${escHtml(OLLAMA_URL)}" placeholder="http://localhost:11434" style="flex:2; min-width:180px; padding:7px; border:1px solid #ced4da; border-radius:6px;">
            <input type="text" id="cfg-ollama-model" value="${escHtml(OLLAMA_MODEL)}" placeholder="qwen2.5:7b" style="flex:1; min-width:120px; padding:7px; border:1px solid #ced4da; border-radius:6px;">
          </div>
          <div style="display:flex; align-items:center; gap:10px; margin-top:8px; flex-wrap:wrap;">
            <label style="display:flex; align-items:center; gap:5px; font-size:0.8rem; cursor:pointer;"><input type="checkbox" id="ativo-ollama" ${OLLAMA_ATIVO ? 'checked' : ''}> Habilitado</label>
            <button type="button" class="btn btn-secondary btn-sm" onclick="testarConexaoProvedor('ollama')">Testar conexão</button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="salvarConfig()">Salvar endereço</button>
            <span id="teste-ollama" style="font-size:0.75rem;"></span></div>
        </div>

      </div>`;
  }
}

let caixaAtualAtiva = 'entrada';

async function atualizarContagensSidebar() {
  if (!usuarioAtual) return;
  const res = await api('processos/contagens', { responsavel: usuarioAtual.email });
  if (!res.ok) return;
  const c = res.contagens;
  const badgeEntrada = document.getElementById('badge-entrada');
  if (badgeEntrada) badgeEntrada.textContent = c.entrada > 0 ? c.entrada : '';
  const badgeAndamento = document.getElementById('badge-andamento');
  if (badgeAndamento) badgeAndamento.textContent = c.andamento > 0 ? c.andamento : '';
  let caixaFlutuante = document.getElementById('caixa-flutuante-encaminhados');
  if (!caixaFlutuante) {
    const navEl = document.querySelector('#sidebar nav');
    if (navEl) {
      caixaFlutuante = document.createElement('div');
      caixaFlutuante.id = 'caixa-flutuante-encaminhados';
      caixaFlutuante.style = "margin:10px 16px; padding:10px; background:rgba(255,193,7,0.12); border-radius:6px; border-left:3px solid #ffc107;";
      navEl.parentNode.insertBefore(caixaFlutuante, navEl.nextSibling);
    }
  }
  if (caixaFlutuante) {
    if (c.encaminhados > 0) {
      caixaFlutuante.style.display = 'block';
      caixaFlutuante.innerHTML = `
        <a href="#" onclick="showView('dashboard', 'encaminhados'); return false;" style="display:flex; justify-content:space-between; align-items:center; text-decoration:none; color:inherit; font-size:0.85rem;">
          <span><i class="ti ti-share" style="color:#d97706; margin-right:5px;"></i> Encaminhados (acompanhando)</span>
          <span style="background:#ffc107; color:#000; padding:1px 7px; border-radius:10px; font-size:0.72rem; font-weight:bold;">${c.encaminhados}</span>
        </a>`;
    } else {
      caixaFlutuante.style.display = 'none';
    }
  }
}

// ==================== AVISO DE CHEGADA (processo novo / achado pendente) ====================
// Checagem periódica discreta — o backend (Apps Script) não sustenta conexão aberta,
// então isso não é "em tempo real", é "a cada X segundos". Pra esse tipo de aviso,
// imperceptível na prática. Não usa a cor de alerta de achado (bordô) de propósito —
// aqui é só "chegou algo", não "achamos um problema".
const INTERVALO_MONITORAMENTO_MS = 45000;
let _intervaloMonitoramento = null;
let _ultimaContagemEntrada = null;
let _ultimaContagemAchadosPendentes = null;

function _garantirEstiloNotificacoes() {
  if (document.getElementById('estilo-notificacoes-chegada')) return;
  const style = document.createElement('style');
  style.id = 'estilo-notificacoes-chegada';
  style.textContent = `
    @keyframes pulsoChegada { 0%,100% { box-shadow: 0 0 0 0 rgba(74,144,226,0.35); } 50% { box-shadow: 0 0 0 7px rgba(74,144,226,0); } }
    .pulso-chegada { animation: pulsoChegada 1.2s ease-out 2; border-radius: 6px; }
    #toast-container { position: fixed; bottom: 24px; right: 24px; z-index: 900; display: flex; flex-direction: column; gap: 10px; }
    .toast-chegada {
      background: #2b2f36; color: #f1f3f5; padding: 12px 16px; border-radius: 8px;
      font-size: 0.85rem; box-shadow: 0 6px 20px rgba(0,0,0,0.25); max-width: 300px;
      opacity: 0; transform: translateX(12px); transition: opacity 0.25s ease, transform 0.25s ease;
      display: flex; align-items: flex-start; gap: 10px;
    }
    .toast-chegada.visivel { opacity: 1; transform: translateX(0); }
    .toast-chegada i { color: #74c0fc; font-size: 1rem; margin-top: 1px; }
  `;
  document.head.appendChild(style);
}

function pulsarElemento(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('pulso-chegada');
  // Força reflow pra reiniciar a animação, caso já tenha rodado antes.
  void el.offsetWidth;
  el.classList.add('pulso-chegada');
  setTimeout(() => el.classList.remove('pulso-chegada'), 2600);
}

function mostrarToast(mensagem, duracaoMs = 4500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast-chegada';
  toast.innerHTML = `<i class="ti ti-bell"></i><span>${escHtml(mensagem)}</span>`;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visivel'));
  setTimeout(() => {
    toast.classList.remove('visivel');
    setTimeout(() => toast.remove(), 300);
  }, duracaoMs);
}

function iniciarMonitoramentoNovosItens() {
  if (_intervaloMonitoramento) clearInterval(_intervaloMonitoramento);
  _ultimaContagemEntrada = null; _ultimaContagemAchadosPendentes = null;
  _verificarNovosItens(); // primeira leitura só define a base — o guard "!== null" impede aviso aqui
  _intervaloMonitoramento = setInterval(_verificarNovosItens, INTERVALO_MONITORAMENTO_MS);
}

async function _verificarNovosItens() {
  if (!usuarioAtual) return;
  try {
    const [resContagens, resPendentes] = await Promise.all([
      api('processos/contagens', { responsavel: usuarioAtual.email }, { fundo: true }),
      api('achados/contar-pendentes', { usuario: usuarioAtual.email }, { fundo: true })
    ]);

    if (resContagens.ok) {
      const entradaAtual = resContagens.contagens.entrada || 0;
      if (_ultimaContagemEntrada !== null && entradaAtual > _ultimaContagemEntrada) {
        pulsarElemento('nav-entrada');
        const diferenca = entradaAtual - _ultimaContagemEntrada;
        mostrarToast(diferenca === 1 ? 'Chegou um processo novo na Caixa de Entrada.' : `Chegaram ${diferenca} processos novos na Caixa de Entrada.`);
      }
      _ultimaContagemEntrada = entradaAtual;
      const badgeEntrada = document.getElementById('badge-entrada');
      if (badgeEntrada) badgeEntrada.textContent = entradaAtual > 0 ? entradaAtual : '';
    }

    if (resPendentes.ok) {
      const pendentesAtual = resPendentes.pendentes || 0;
      if (_ultimaContagemAchadosPendentes !== null && pendentesAtual > _ultimaContagemAchadosPendentes) {
        pulsarElemento('nav-entrada');
        mostrarToast('Um colega pediu sua opinião sobre um achado.');
      }
      _ultimaContagemAchadosPendentes = pendentesAtual;
    }
  } catch (e) {
    console.warn('Falha na checagem periódica de novos itens:', e.message);
  }
}

async function renderDashboard(caixa = 'entrada') {
  const content = document.getElementById('content');
  content.innerHTML = '<span class="spinner"></span> Carregando processos...';
  await atualizarContagensSidebar();
  const abasHtml = `
    <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; border-bottom:1px solid #dee2e6; padding-bottom:12px;">
      <button class="btn btn-sm ${caixa === 'panorama' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','panorama')"><i class="ti ti-layout-dashboard"></i> Panorama</button>
      <button class="btn btn-sm ${caixa === 'entrada' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','entrada')"><i class="ti ti-inbox"></i> Caixa de Entrada</button>
      <button class="btn btn-sm ${caixa === 'andamento' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','andamento')"><i class="ti ti-loader"></i> Em Andamento</button>
      <button class="btn btn-sm ${caixa === 'encaminhados' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','encaminhados')"><i class="ti ti-share"></i> Encaminhados</button>
      <button class="btn btn-sm ${caixa === 'concluidos' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','concluidos')"><i class="ti ti-archive"></i> Concluídos</button>
      <button class="btn btn-sm ${caixa === 'perguntas' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','perguntas')"><i class="ti ti-message-question"></i> Perguntas</button>
    </div>`;
  if (caixa === 'panorama') { await renderPanorama(content, abasHtml); return; }
  if (caixa === 'perguntas') {
    content.innerHTML = abasHtml + '<div id="area-perguntas"><span class="spinner"></span> Carregando perguntas...</div>';
    await renderPerguntasAchados();
    return;
  }
  if (caixa === 'concluidos') {
    content.innerHTML = abasHtml + '<div id="area-finalizados"><span class="spinner"></span></div>';
    await renderFinalizados('', 'area-finalizados');
    return;
  }
  const res = await api('processos/listar', { responsavel: usuarioAtual.email, caixa });
  if (!res.ok) { content.innerHTML = abasHtml + `<div class="alert alert-danger">Erro ao carregar processos: ${escHtml(res.erro)}</div>`; return; }
  const lista = res.processos || [];
  let html = abasHtml + '<div class="cards-grid">';
  if (lista.length === 0) {
    const msgsVazio = {
      entrada: 'Sua Caixa de Entrada está vazia. Clique em "Importar Processo" no menu ao lado, ou aguarde um colega te encaminhar um.',
      andamento: 'Nenhum processo em andamento no momento.',
      encaminhados: 'Nenhum processo sob seu acompanhamento no momento.'
    };
    html += `<div style="color:var(--text-muted); font-style:italic; grid-column: 1/-1;">${escHtml(msgsVazio[caixa] || 'Nenhum processo nesta caixa.')}</div>`;
  } else {
    for (const p of lista) {
      const qtdAlertas = p.ultima_auditoria_qtd_achados;
      const badgeAlertas = qtdAlertas === null || qtdAlertas === undefined ? ''
        : qtdAlertas > 0
          ? `<span class="badge-status" style="background:#f8d7da;color:#842029;">${qtdAlertas} alerta(s)</span>`
          : `<span class="badge-status" style="background:#d1e7dd;color:#0f5132;">sem alertas</span>`;

      // Já vem pronto na lista (um pedido só ao servidor, em vez de um por cartão).
      const badgePerguntaPendente = p.perguntas_pendentes_para_mim > 0
        ? `<span class="badge-status" style="background:#fff3cd; color:#856404; border:1px solid #ffeeba;"><i class="ti ti-message-circle"></i> 💬 Pergunta pendente</span>`
        : '';

      let infoTramitacao = '';
      if (p.ultima_tramitacao) {
        const lidoInfo = p.ultima_tramitacao.lido_em
          ? `<span style="color:#2b8a3e; margin-left:8px;"><i class="ti ti-eye-check"></i> Visto ${new Date(p.ultima_tramitacao.lido_em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>`
          : (caixa === 'encaminhados' ? `<span style="color:var(--text-muted); margin-left:8px;"><i class="ti ti-eye-off"></i> Ainda não aberto</span>` : '');
        infoTramitacao = `<div style="font-size:0.75rem; color:#0b509e; margin-top:4px;"><i class="ti ti-clock"></i> Tramitado para <strong>${escHtml(p.ultima_tramitacao.para_usuario)}</strong> em ${new Date(p.ultima_tramitacao.data).toLocaleString('pt-BR')} ${lidoInfo}</div>`;
      }
      const botaoParar = caixa === 'encaminhados'
        ? `<div style="margin-top:10px; border-top:1px dashed #dee2e6; padding-top:8px;">
             <button class="btn btn-secondary btn-sm" style="width:100%; font-size:0.75rem;" onclick="pararAcompanhamento(event, ${p.id})"><i class="ti ti-eye-off"></i> Terminar Acompanhamento</button>
           </div>` : '';
      const podeExcluir = String(p.criado_por).toLowerCase() === usuarioAtual.email.toLowerCase();
      const botaoExcluir = podeExcluir
        ? `<button onclick="deletarProcessoRemoto(event, ${p.id})" title="Excluir processo" style="position:absolute; top:12px; right:12px; background:none; border:none; color:#adb5bd; cursor:pointer; font-size:0.9rem; padding:4px;" onmouseover="this.style.color='#dc3545'" onmouseout="this.style.color='#adb5bd'"><i class="ti ti-trash"></i></button>`
        : '';
      const botaoAssumirHtml = caixa === 'entrada'
        ? `<div style="margin-top:10px; border-top:1px dashed #dee2e6; padding-top:8px;"><button class="btn btn-primary btn-sm" style="width:100%; font-size:0.75rem;" onclick="assumirProcesso(event, ${p.id})"><i class="ti ti-hand-stop"></i> Assumir para análise</button></div>`
        : '';
      html += `
      <div class="process-card" style="position:relative;">
        <div onclick="abrirProcesso('${escAttr(p.numero_sei || p.id)}')" style="cursor:pointer;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px; align-items:center; padding-right: 25px; flex-wrap:wrap; gap:5px;">
            <span class="sei-num">${escHtml(p.numero_sei || '(sem nº SEI)')}</span>
            <div style="display:flex; gap:4px; flex-wrap:wrap;">${badgePerguntaPendente} ${badgeAlertas}</div>
          </div>
          <div class="titulo" style="font-weight:600; font-size:0.95rem;">${escHtml(p.titulo)}</div>
          <div style="font-size:0.8rem;color:var(--text-muted); margin-top:8px;"><i class="ti ti-building-hospital"></i> ${escHtml(p.unidade || 'Sem unidade')} ${p.oss ? '· ' + escHtml(p.oss) : ''}</div>
          <div style="font-size:0.75rem;color:var(--text-muted); margin-top:4px;"><i class="ti ti-flag"></i> ${escHtml(p.status || '')}</div>
          <div style="font-size:0.75rem;color:#6c757d; margin-top:2px;"><i class="ti ti-user"></i> Com: ${escHtml(p.responsavel_atual)}</div>
          ${infoTramitacao}
        </div>
        ${botaoAssumirHtml}
        ${botaoParar}
        ${botaoExcluir}
      </div>`;
    }
  }
  content.innerHTML = html + '</div>';
}


// ==================== CHAVES DE IA ENTREGUES PELA GESTÃO ====================
async function _carregarChavesDaGestao() {
  const res = await api('ia/minhas-chaves', {});
  const lista = (res && res.ok && res.chaves) || [];
  const chave = s => (lista.find(c => c.servico === s) || {}).chave || '';
  GEMINI_KEY = chave('gemini'); GROQ_KEY = chave('groq'); KIMI_KEY = chave('kimi');
  OPENROUTER_KEY = chave('openrouter'); DEEPSEEK_KEY = chave('deepseek');
  CHAVES_DA_GESTAO = lista.map(c => ({ servico: c.servico, nome: c.nome, rotulo: c.rotulo, final: c.final, ordem: c.ordem }));
  // A ordem de tentativa é a definida pelo gestor; o Ollama (local) fica por último.
  const daGestao = lista.map(c => c.servico);
  ORDEM_PROVEDORES_IDS = [...daGestao, ...['gemini', 'groq', 'kimi', 'openrouter', 'deepseek'].filter(s => !daGestao.includes(s)), 'ollama'];
  verificarIA();
  if (!res || !res.ok) console.warn('Não foi possível buscar as chaves de IA:', res && res.erro);
}

// ==================== BOTÃO "ABRIR SEI GESTÃO" (só para quem tem acesso) ====================
// Quem decide o acesso de verdade é o servidor, no login do Gestão; o botão só evita
// mostrar um caminho que a pessoa não vai conseguir usar.
function _mostrarBotaoGestao() {
  document.getElementById('nav-gestao')?.remove();        // link antigo da barra lateral, se existir
  const existente = document.getElementById('btn-ir-gestao');
  const apps = Array.isArray(usuarioAtual?.apps) ? usuarioAtual.apps : [];
  const temAcesso = usuarioAtual && usuarioAtual.perfil === 'admin' && (!apps.length || apps.includes('gestao'));
  if (!temAcesso) { existente?.remove(); return; }
  if (existente) return;
  const sair = document.querySelector('header button[onclick="logout()"]');
  if (!sair) return;
  const botao = document.createElement('button');
  botao.id = 'btn-ir-gestao'; botao.className = 'btn btn-secondary btn-sm'; botao.style.marginRight = '8px';
  botao.innerHTML = '<i class="ti ti-chart-dots"></i> Ir para o Gestão';
  botao.title = 'Abre o SEI Gestão em outra aba, sem pedir a senha de novo';
  botao.addEventListener('click', () => irParaOutroApp('gestao'));
  sair.parentNode.insertBefore(botao, sair);
}

// ==================== TROCA ENTRE OS APPS (passe de uso único) ====================
// O primeiro clique abre o outro app numa aba própria; os seguintes só trazem essa aba
// para a frente. O passe vale 60 segundos, uma vez só, e só para quem o pediu.
async function irParaOutroApp(destino) {
  const nomeAba = destino === 'gestao' ? 'sei_gestao' : 'sei_analista';
  // Endereço completo, sempre a partir da pasta do repositório (ex.: /sei_analista/), para não
  // depender de o endereço atual terminar ou não com barra.
  const repo = '/' + (location.pathname.split('/').filter(Boolean)[0] || 'sei_analista') + '/';
  const endereco = location.origin + repo + (destino === 'gestao' ? 'gestao/' : '');
  let aba = null;
  try { aba = window.open('', nomeAba); } catch (e) { aba = null; }   // abre já no clique (evita bloqueio de pop-up)
  try { if (aba && aba.__seiLogado) { aba.focus(); return; } } catch (e) { /* aba de outro endereço */ }
  const res = await api('auth/ponte-criar', { destino });
  if (!res.ok) {
    try { if (aba && aba.location.href === 'about:blank') aba.close(); } catch (e) { /* ignora */ }
    alert('Não foi possível abrir: ' + (res.erro || 'erro desconhecido'));
    return;
  }
  try { localStorage.setItem('sei_ponte', JSON.stringify({ codigo: res.codigo, destino, criado: Date.now() })); } catch (e) { /* sem armazenamento: o outro app pede senha */ }
  if (aba) { aba.location.href = endereco; aba.focus(); } else window.location.href = endereco;
}

// Ao abrir: se veio um passe para este app, entra sem pedir senha. O passe sai do navegador na hora.
async function _entrarComPasse(app) {
  let passe = null;
  try { passe = JSON.parse(localStorage.getItem('sei_ponte') || 'null'); } catch (e) { passe = null; }
  if (!passe || passe.destino !== app) return false;
  try { localStorage.removeItem('sei_ponte'); } catch (e) { /* ignora */ }
  if (Date.now() - Number(passe.criado || 0) > 60000) return false;
  const res = await api('auth/ponte-usar', { codigo: passe.codigo, app });
  if (!res.ok) { mostrarErroLogin(res.erro || 'Não foi possível entrar pelo atalho. Entre com login e senha.'); return false; }
  await _entrarComResposta(res);
  return true;
}

// ==================== CORES DOS ALERTAS ====================
const COR_ALERTA   = { vermelho: '#dc3545', amarelo: '#f5c518', laranja: '#fd7e14', azul: '#0dcaf0' };
const ICONE_ALERTA = { vermelho: 'ti-alert-octagon', amarelo: 'ti-alert-triangle', laranja: 'ti-clock-pause', azul: 'ti-file-check' };

// Tempo decorrido real desde uma data — nunca um prazo fingido, só "há quanto tempo".
function _tempoDecorridoDesde(dataISO) {
  const minutos = Math.floor((Date.now() - new Date(dataISO).getTime()) / 60000);
  if (minutos < 60) return `${Math.max(minutos, 0)} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

// ==================== ALERTAS NA BARRA LATERAL ====================
let _alertasCache = [];
async function carregarAlertasSidebar() {
  if (!usuarioAtual) return;
  try {
    const res = await api('processos/alertas', {}, { fundo: true });
    _alertasCache = (res.ok && res.alertas) ? res.alertas : [];
  } catch (e) { _alertasCache = []; }
  const area = document.getElementById('area-alertas-sidebar');
  if (!area) return;
  if (!_alertasCache.length) { area.innerHTML = ''; return; }
  const corMaisUrgente = ['vermelho', 'amarelo', 'laranja', 'azul'].find(c => _alertasCache.some(a => a.cor === c)) || 'azul';
  const cor = COR_ALERTA[corMaisUrgente];
  area.innerHTML = `<a href="#" onclick="showView('dashboard','panorama'); return false;"
    style="display:flex;align-items:center;gap:6px;padding:5px 10px 5px 12px;text-decoration:none;border-left:3px solid ${cor};background:rgba(0,0,0,0.15);border-radius:0 4px 4px 0;margin:0 0 4px;">
    <i class="ti ti-bell" style="color:${cor};font-size:13px;"></i>
    <span style="font-size:0.72rem;color:${cor};font-weight:600;">${_alertasCache.length} alerta(s) — ver Panorama</span></a>`;
}

// ==================== PANORAMA ====================
async function renderPanorama(content, abasHtml) {
  content.innerHTML = abasHtml + '<span class="spinner"></span> Montando o panorama...';
  const [resContagens, resPerguntas, resAlertas] = await Promise.all([
    api('processos/contagens', { responsavel: usuarioAtual.email }),
    api('achados/contar-pendentes', {}),
    api('processos/alertas', {})
  ]);
  const c = resContagens.ok ? resContagens.contagens : {};
  const qtdPerguntas = (resPerguntas.ok && resPerguntas.pendentes) || 0;
  const alertas = (resAlertas.ok && resAlertas.alertas) || [];
  const bloco = (icone, rotulo, qtd, caixa, cor, destaque) => `
    <div onclick="showView('dashboard','${caixa}')" style="cursor:pointer; padding:16px 20px; border-radius:10px; background:#fff;
      border:1px solid ${destaque ? cor : '#dee2e6'}; border-left:4px solid ${cor}; display:flex; align-items:center; gap:14px;"
      onmouseenter="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" onmouseleave="this.style.boxShadow='none'">
      <div style="font-size:1.6rem; color:${cor}; line-height:1;"><i class="ti ${icone}"></i></div>
      <div><div style="font-size:1.8rem; font-weight:700; color:${cor}; line-height:1;">${qtd || 0}</div>
        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">${rotulo}</div></div>
    </div>`;
  const blocoAlerta = a => {
    const cor = COR_ALERTA[a.cor] || '#868e96';
    return `<div onclick="abrirProcesso('${escAttr(a.numero_sei || String(a.processo_id))}')" style="cursor:pointer; padding:8px 12px; border-radius:6px; background:#fff; border:1px solid ${cor}33; border-left:3px solid ${cor}; font-size:0.8rem; display:flex; gap:10px; align-items:flex-start;"
      onmouseenter="this.style.background='#f8f9fa'" onmouseleave="this.style.background='#fff'">
      <span style="color:${cor}; font-size:1rem; margin-top:1px;"><i class="ti ${ICONE_ALERTA[a.cor] || 'ti-bell'}"></i></span>
      <div><div style="font-weight:600; color:${cor};">${escHtml(a.mensagem)}</div>
        <div style="color:var(--text-muted); font-size:0.75rem;">${escHtml(a.titulo || a.numero_sei || '')}</div></div>
    </div>`;
  };
  content.innerHTML = abasHtml + `
    <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:10px;">
      Panorama — ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
    <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; margin-bottom:18px;">
      ${bloco('ti-inbox', 'Na caixa de entrada', c.entrada, 'entrada', '#0b509e', c.entrada > 0)}
      ${bloco('ti-loader', 'Em andamento', c.andamento, 'andamento', '#6f42c1', false)}
      ${bloco('ti-share', 'Encaminhados', c.encaminhados, 'encaminhados', '#0d6efd', false)}
      ${bloco('ti-archive', 'Concluídos', c.concluidos, 'concluidos', '#198754', false)}
      ${bloco('ti-message-question', 'Perguntas pendentes', qtdPerguntas, 'perguntas', '#fd7e14', qtdPerguntas > 0)}
    </div>
    ${alertas.length ? `
      <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px;">Alertas ativos (${alertas.length})</div>
      <div style="display:flex; flex-direction:column; gap:6px;">${alertas.slice(0, 8).map(blocoAlerta).join('')}
        ${alertas.length > 8 ? `<div style="font-size:0.75rem; color:var(--text-muted);">+${alertas.length - 8} alerta(s)</div>` : ''}</div>`
      : '<div style="font-size:0.82rem; color:#2b8a3e;"><i class="ti ti-check"></i> Nenhum alerta no momento.</div>'}`;
}

// ==================== ABA PERGUNTAS (recebidas e enviadas, em qualquer processo) ====================
async function renderPerguntasAchados() {
  const area = document.getElementById('area-perguntas');
  if (!area) return;
  const res = await api('achados/meus', {});
  if (!res.ok) { area.innerHTML = `<div class="alert alert-danger">Não foi possível carregar as perguntas: ${escHtml(res.erro || '')}</div>`; return; }
  const recebidas = (res.recebidas || []).sort((a, b) => (a.resposta ? 1 : 0) - (b.resposta ? 1 : 0));
  const enviadas = res.enviadas || [];
  const linkProcesso = q => `<a href="#" onclick="abrirProcesso('${escAttr(q.numero_sei || q.processo_id)}'); return false;">${escHtml(q.numero_sei || 'processo ' + q.processo_id)}</a>${q.titulo_processo ? ' — ' + escHtml(q.titulo_processo) : ''}`;
  const cartao = (q, tipo) => {
    const cor = !q.resposta ? (tipo === 'recebida' ? '#fff9db; border-left:3px solid #f5c518' : '#f8f9fa; border-left:3px solid #adb5bd') : '#e7f5ff; border-left:3px solid #339af0';
    const quem = tipo === 'recebida' ? `De <strong>${escHtml(q.de_usuario)}</strong>` : `Para <strong>${escHtml(q.para_usuario)}</strong>`;
    const quando = q.data_envio ? ` · há ${_tempoDecorridoDesde(q.data_envio)}` : '';
    const resposta = q.resposta
      ? `<div style="margin-top:6px; color:#1864ab;"><strong>Resposta:</strong> ${escHtml(q.resposta)}</div>`
      : (tipo === 'recebida'
          ? `<textarea id="resp-caixa-${q.id}" placeholder="Sua resposta..." style="width:100%; margin-top:8px; padding:6px; border:1px solid #ced4da; border-radius:4px; min-height:50px;"></textarea>
             <button class="btn btn-primary btn-sm" style="margin-top:6px;" onclick="responderPerguntaNaCaixa(${q.id})">Responder</button>`
          : '<div style="margin-top:6px; color:var(--text-muted);"><i class="ti ti-clock"></i> Aguardando resposta.</div>');
    return `<div style="background:${cor}; padding:10px 14px; border-radius:6px; margin-bottom:10px; font-size:0.85rem;">
      <div style="font-size:0.78rem; color:var(--text-muted);">${quem}${quando} · Processo ${linkProcesso(q)}</div>
      <div style="margin-top:4px;"><strong>Achado:</strong> ${escHtml(q.achado_referencia)}</div>
      <div style="margin-top:4px;"><strong>Pergunta:</strong> ${escHtml(q.mensagem || '(sem mensagem)')}</div>${resposta}</div>`;
  };
  area.innerHTML = `
    <h3 style="font-size:1rem; margin-bottom:10px;">Recebidas</h3>
    ${recebidas.length ? recebidas.map(q => cartao(q, 'recebida')).join('') : '<p class="text-muted" style="font-size:0.85rem;">Nenhuma pergunta recebida.</p>'}
    <h3 style="font-size:1rem; margin:20px 0 10px;">Enviadas</h3>
    ${enviadas.length ? enviadas.map(q => cartao(q, 'enviada')).join('') : '<p class="text-muted" style="font-size:0.85rem;">Nenhuma pergunta enviada.</p>'}`;
}

async function responderPerguntaNaCaixa(id) {
  const resposta = (document.getElementById('resp-caixa-' + id)?.value || '').trim();
  if (!resposta) return alert('Escreva a resposta antes de enviar.');
  const res = await api('achados/responder', { id, resposta });
  if (!res.ok) return alert('A resposta NÃO foi enviada: ' + (res.erro || 'erro desconhecido'));
  mostrarToast('Resposta enviada.');
  renderPerguntasAchados();
}

// ==================== ASSUMIR (Entrada → Andamento) ====================
// O processo da Entrada já está com a pessoa; assumir é iniciar a análise. O servidor
// registra a mudança de status sozinho.
async function assumirProcesso(e, id) {
  e.stopPropagation();
  const res = await api('processos/atualizar-status', { id, status: 'Em Análise' });
  if (!res.ok) { alert('Não foi possível assumir: ' + (res.erro || 'erro desconhecido')); return; }
  mostrarToast('Processo assumido. Ele está agora em Andamento.');
  showView('dashboard', 'andamento');
}

// ==================== BOTÕES DE FLUXO DE STATUS (dentro do processo) ====================
const _FLUXO_STATUS = [
  { de: 'Aguardando Revisão Inicial', para: 'Em Análise',                 label: 'Iniciar análise',      icone: 'ti-player-play',  cor: '#0b509e' },
  { de: 'Em Análise',                 para: 'Aguardando Revisão Final',   label: 'Enviar para revisão',  icone: 'ti-send',         cor: '#6f42c1' },
  { de: 'Aguardando Revisão Final',   para: 'Pronto para Assinar no SEI', label: 'Aprovar para assinar', icone: 'ti-circle-check', cor: '#2b8a3e' }
];

function _renderBotoesStatus(statusAtual) {
  const el = document.getElementById('btn-status-processo');
  if (!el) return;
  const acao = _FLUXO_STATUS.find(f => f.de === statusAtual);
  const badge = `<span style="font-size:0.72rem; background:#f8f9fa; border:1px solid #dee2e6; padding:3px 10px; border-radius:10px; color:#6c757d;">${escHtml(statusAtual || '')}</span>`;
  el.innerHTML = badge + (acao ? `
    <button class="btn btn-sm" style="background:${acao.cor}; color:#fff; border:none; padding:4px 12px; border-radius:6px; font-size:0.78rem;"
      onclick="avancarStatusProcesso('${escAttr(acao.para)}')"><i class="ti ${acao.icone}"></i> ${escHtml(acao.label)}</button>` : '');
}

async function avancarStatusProcesso(novoStatus) {
  if (!processoAtual) return;
  if (!confirm(`Mover o processo para "${novoStatus}"?`)) return;
  const res = await api('processos/atualizar-status', { id: processoAtual.id, status: novoStatus });
  if (!res.ok) return alert('Erro ao atualizar: ' + (res.erro || ''));
  processoAtual.status = novoStatus;
  _renderBotoesStatus(novoStatus);
  mostrarToast(`Processo movido para "${novoStatus}".`);
  atualizarContagensSidebar();
}

// ==================== MENSAGEIRO ====================
let _msgConversaAtual = null;

async function toggleMensageiro() {
  const painel = document.getElementById('painel-mensageiro');
  if (!painel) return;
  if (painel.style.display === 'none') { painel.style.display = 'block'; await abrirListaContatos(); }
  else { painel.style.display = 'none'; _msgConversaAtual = null; }
}

async function abrirListaContatos() {
  const listaEl = document.getElementById('msg-lista-contatos');
  const convEl = document.getElementById('msg-conversa');
  if (!listaEl || !convEl) return;
  convEl.style.display = 'none'; listaEl.style.display = 'block';
  listaEl.innerHTML = '<div style="padding:8px 10px; font-size:0.72rem; color:#adb5bd;">Carregando...</div>';
  const res = await api('mensagens/contatos', {});
  if (!res.ok) { listaEl.innerHTML = `<div style="padding:8px 10px; font-size:0.72rem; color:#f87171;">Erro ao carregar contatos: ${escHtml(res.erro || '')}</div>`; return; }
  const item = (c, icone, cor) => `
    <div onclick="abrirConversa('${escAttr(c.conversa_id)}','${escAttr(c.nome)}')" style="padding:6px 10px; cursor:pointer; font-size:0.78rem; display:flex; align-items:center; gap:6px;"
      onmouseenter="this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background=''">
      <i class="ti ${icone}" style="color:${cor}; font-size:0.9rem;"></i><span>${escHtml(c.nome)}</span></div>`;
  const titulo = t => `<div style="padding:4px 10px 2px; font-size:0.65rem; font-weight:700; color:#adb5bd; text-transform:uppercase;">${t}</div>`;
  let html = '';
  if (res.grupos?.length) html += titulo('Grupos') + res.grupos.map(g => item(g, 'ti-users', '#b197fc')).join('');
  if (res.individuais?.length) html += titulo('Individual') + res.individuais.map(c => item(c, 'ti-user', '#74c0fc')).join('');
  listaEl.innerHTML = html || '<div style="padding:8px 10px; font-size:0.72rem; color:#adb5bd;">Nenhum contato encontrado.</div>';
}

async function abrirConversa(conversaId, nome) {
  _msgConversaAtual = conversaId;
  const histEl = document.getElementById('msg-historico');
  if (!histEl) return;
  document.getElementById('msg-lista-contatos').style.display = 'none';
  document.getElementById('msg-conversa').style.display = 'block';
  document.getElementById('msg-conversa-nome').textContent = nome;
  histEl.innerHTML = '<div style="font-size:0.72rem; color:#adb5bd; text-align:center; padding:8px;">Carregando...</div>';
  const res = await api('mensagens/listar', { conversa_id: conversaId });
  if (!res.ok) { histEl.innerHTML = `<div style="font-size:0.72rem; color:#f87171; text-align:center; padding:8px;">${escHtml(res.erro || 'Erro ao carregar mensagens.')}</div>`; return; }
  _renderMensagens(res.mensagens || []);
  document.getElementById('msg-input')?.focus();
}

function _renderMensagens(msgs) {
  const histEl = document.getElementById('msg-historico');
  if (!histEl) return;
  if (!msgs.length) { histEl.innerHTML = '<div style="font-size:0.72rem; color:#adb5bd; text-align:center; padding:8px;">Sem mensagens ainda.</div>'; return; }
  histEl.innerHTML = msgs.map(m => {
    const meu = String(m.de_usuario).toLowerCase() === String(usuarioAtual.email).toLowerCase();
    const hora = m.enviado_em ? new Date(m.enviado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
    return `<div style="max-width:90%; padding:5px 8px; border-radius:8px; font-size:0.76rem; line-height:1.4; align-self:${meu ? 'flex-end' : 'flex-start'}; background:${meu ? '#495057' : 'rgba(255,255,255,0.12)'}; color:#fff;">
      ${!meu ? `<div style="font-size:0.65rem; color:#a5d8ff; margin-bottom:2px;">${escHtml(m.de_nome)}</div>` : ''}${escHtml(m.texto)}
      <div style="font-size:0.62rem; color:rgba(255,255,255,0.5); text-align:right; margin-top:2px;">${hora}</div></div>`;
  }).join('');
  histEl.scrollTop = histEl.scrollHeight;
}

async function enviarMensagem() {
  const input = document.getElementById('msg-input');
  const texto = (input?.value || '').trim();
  if (!texto || !_msgConversaAtual) return;
  input.value = '';
  const res = await api('mensagens/enviar', { conversa_id: _msgConversaAtual, texto });
  if (!res.ok) { input.value = texto; mostrarToast('A mensagem NÃO foi enviada: ' + (res.erro || '')); return; }
  const hist = await api('mensagens/listar', { conversa_id: _msgConversaAtual });
  if (hist.ok) _renderMensagens(hist.mensagens || []);
}

function voltarListaContatos() {
  _msgConversaAtual = null;
  document.getElementById('msg-lista-contatos').style.display = 'block';
  document.getElementById('msg-conversa').style.display = 'none';
}

async function pararAcompanhamento(e, id) {
  e.stopPropagation();
  if (!confirm('Encerrar o acompanhamento deste processo? Ele sumirá da sua caixa de Encaminhados.')) return;
  const res = await api('processos/parar-acompanhamento', { processo_id: id, usuario: usuarioAtual.email });
  if (!res.ok) { alert('Erro: ' + res.erro); return; }
  showView('dashboard', 'encaminhados');
}

async function deletarProcessoRemoto(e, id) {
  e.stopPropagation();
  if (!confirm('Deseja realmente remover este processo? Isso apaga também os documentos e o histórico de auditoria dele.')) return;
  const res = await api('processos/remover', { id });
  if (!res.ok) { alert('Erro ao remover: ' + res.erro); return; }
  showView('dashboard', caixaAtualAtiva);
}

async function renderFinalizados(termoBusca, containerId) {
  containerId = containerId || 'content';
  const content = document.getElementById(containerId);
  content.innerHTML = '<span class="spinner"></span> Carregando registro...';
  const params = { caixa: 'concluidos', responsavel: usuarioAtual.email };
  if (termoBusca) params.busca = termoBusca;
  const res = await api('processos/listar', params);
  if (!res.ok) { content.innerHTML = `<div class="alert alert-danger">Erro ao carregar: ${escHtml(res.erro)}</div>`; return; }
  const lista = res.processos || [];
  let html = `
    <div style="margin-bottom:16px;">
      <input type="text" id="busca-finalizados" placeholder="Buscar por nº SEI, título ou unidade..."
        value="${escAttr(termoBusca || '')}"
        style="width:100%;max-width:500px;padding:10px 14px;border:1px solid #ced4da;border-radius:6px;font-size:0.9rem;"
        onkeypress="if(event.key==='Enter') renderFinalizados(this.value, '${containerId}')">
      <button class="btn btn-primary btn-sm" onclick="renderFinalizados(document.getElementById('busca-finalizados').value, '${containerId}')"><i class="ti ti-search"></i> Buscar</button>
    </div>`;
  if (!lista.length) {
    html += `<div style="color:var(--text-muted); font-style:italic;">${termoBusca ? 'Nenhum resultado para essa busca.' : 'Nenhum processo concluído ainda.'}</div>`;
  } else {
    html += '<div class="cards-grid">';
    lista.forEach(p => {
      const podeExcluirConcluido = String(p.criado_por).toLowerCase() === usuarioAtual.email.toLowerCase();
      html += `
      <div class="process-card" style="cursor:pointer; position:relative;" onclick="abrirRegistroConcluido(${p.id})">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px;align-items:center; padding-right:25px;">
          <span class="sei-num">${escHtml(p.numero_sei || '(sem nº SEI)')}</span>
          <span class="badge-status" style="background:#d1e7dd;color:#0f5132;">Concluído</span>
        </div>
        <div class="titulo" style="font-weight:600; font-size:0.95rem;">${escHtml(p.titulo)}</div>
        <div style="font-size:0.8rem;color:var(--text-muted); margin-top:8px;"><i class="ti ti-building-hospital"></i> ${escHtml(p.unidade || 'Sem unidade')}</div>
        <div style="font-size:0.75rem;color:var(--text-muted); margin-top:4px;"><i class="ti ti-clock"></i> ${escHtml(p.atualizado_em ? new Date(p.atualizado_em).toLocaleDateString('pt-BR') : '')}</div>
        ${podeExcluirConcluido ? `<button onclick="deletarProcessoRemoto(event, ${p.id})" title="Excluir processo" style="position:absolute; top:12px; right:12px; background:none; border:none; color:#adb5bd; cursor:pointer; font-size:0.9rem; padding:4px;" onmouseover="this.style.color='#dc3545'" onmouseout="this.style.color='#adb5bd'"><i class="ti ti-trash"></i></button>` : ''}
      </div>`;
    });
    html += '</div>';
  }
  content.innerHTML = html;
}

async function abrirRegistroConcluido(id) {
  const content = document.getElementById('content');
  content.innerHTML = '<span class="spinner"></span> Carregando registro...';
  const [resProc, resAud, resCons, resNotas, resDocs] = await Promise.all([
    api('processos/obter', { id }),
    api('auditorias/listar', { processo_id: id }),
    api('consultas/listar', { processo_id: id }),
    api('notas/listar', { processo_id: id }),
    api('documentos/listar', { processo_id: id })
  ]);
  if (!resProc.ok) { content.innerHTML = `<div class="alert alert-danger">${escHtml(resProc.erro)}</div>`; return; }
  const proc = resProc.processo;
  // Necessário pra importar a versão assinada daqui mesmo (salvarDocumentoNoBackend usa processoAtual)
  processoAtual = proc;
  const assinados = (resDocs.documentos || []).filter(d => d.tipo_documento === 'FINAL_ASSINADO');
  const assinadosHtml = assinados.length
    ? '<ul style="margin:0 0 10px 18px; font-size:0.85rem;">' + assinados.map(d => `<li>✓ ${escHtml(d.nome_arquivo)} <span style="color:var(--text-muted); font-size:0.75rem;">— importado em ${d.adicionado_em ? new Date(d.adicionado_em).toLocaleString('pt-BR') : ''}</span></li>`).join('') + '</ul>'
    : '<p style="font-size:0.85rem; color:#856404; margin-bottom:10px;"><i class="ti ti-alert-triangle"></i> A versão assinada no SEI ainda não foi importada. O texto abaixo é o rascunho revisado, que pode ter mudado antes da assinatura.</p>';
  const auditorias = resAud.auditorias || [];
  const consultas = resCons.consultas || [];
  const notas = resNotas.notas || [];
  const achadosHtml = auditorias.length ? auditorias.map(a => {
    let achados = [];
    try { achados = JSON.parse(a.achados_json || '[]'); } catch (e) { /* mantém vazio */ }
    return `<div style="border:1px solid var(--border); border-radius:6px; padding:10px 14px; margin-bottom:10px;">
      <div style="font-size:0.75rem; color:var(--text-muted); margin-bottom:6px;">
        <i class="ti ti-clock"></i> ${new Date(a.data).toLocaleString('pt-BR')} — ${escHtml(a.tipo_checkpoint)} — ${achados.length} achado(s)
      </div>
      ${achados.length ? achados.map(ac => `<div style="font-size:0.85rem; margin-bottom:4px;">• <strong>${escHtml(ac.tipo)}</strong>: ${escHtml(ac.descricao)}</div>`).join('') : '<div style="font-size:0.85rem; color:var(--text-muted);">Nenhum achado nesta checagem.</div>'}
    </div>`;
  }).join('') : '<p class="text-muted">Nenhuma checagem registrada para este processo.</p>';
  const consultasHtml = consultas.length ? consultas.map(c => `
    <div style="margin-bottom:12px;">
      <div style="font-size:0.85rem; font-weight:600;"><i class="ti ti-user"></i> ${escHtml(c.pergunta)}</div>
      <div style="font-size:0.85rem; color:#374151; margin-top:4px; padding-left:16px; border-left:2px solid #74c0fc;">${escHtml(c.resposta)}</div>
    </div>`).join('') : '<p class="text-muted">Nenhuma consulta registrada para este processo.</p>';
  const notasHtml = notas.length ? notas.map(n => `
    <div style="margin-bottom:12px; padding:10px 14px; background:#fffbeb; border-left:3px solid #f59f00; border-radius:4px;">
      ${n.referencia ? `<div style="font-size:0.75rem; font-weight:600; color:#7c5a00; margin-bottom:4px;"><i class="ti ti-pin"></i> ${escHtml(n.referencia)}</div>` : `<div style="font-size:0.75rem; font-weight:600; color:#7c5a00; margin-bottom:4px;"><i class="ti ti-note"></i> Nota geral do processo</div>`}
      <div style="font-size:0.85rem; color:#212529; white-space:pre-wrap;">${escHtml(n.nota)}</div>
      <div style="font-size:0.7rem; color:var(--text-muted); margin-top:6px;">${escHtml(n.usuario)} — ${new Date(n.data).toLocaleString('pt-BR')}</div>
    </div>`).join('') : '<p class="text-muted">Nenhuma anotação registrada para este processo.</p>';
  content.innerHTML = `
    <button class="btn btn-secondary btn-sm" onclick="showView('dashboard','concluidos')" style="margin-bottom:16px;"><i class="ti ti-arrow-left"></i> Voltar ao Registro</button>
    <div style="background:#fff;border-radius:8px;padding:20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
      <h2 style="font-size:1.2rem;margin-bottom:5px;">${escHtml(proc.numero_sei || proc.id)}</h2>
      <p style="font-weight:600; font-size:1.05rem;">${escHtml(proc.titulo)}</p>
      <div style="font-size:0.85rem;color:var(--text-muted);margin-top:6px;">
        Unidade: ${escHtml(proc.unidade)} | OSS: ${escHtml(proc.oss)} | Concluído em: ${proc.atualizado_em ? new Date(proc.atualizado_em).toLocaleString('pt-BR') : '—'}
      </div>
    </div>
    <div style="background:#fff;border:1px solid #dee2e6;padding:20px;border-radius:8px;margin-bottom:16px;">
      <h3 style="font-size:1.05rem;margin-bottom:12px;"><i class="ti ti-file-check"></i> Versão final assinada (SEI)</h3>
      ${assinadosHtml}
      <button class="btn btn-secondary btn-sm" onclick="modalImportarVersaoAssinada('registro')" style="margin-bottom:18px;"><i class="ti ti-file-check"></i> Importar versão assinada (SEI)</button>
      <h3 style="font-size:1.05rem;margin-bottom:12px;"><i class="ti ti-file-text"></i> Rascunho revisado na ferramenta</h3>
      ${proc.documento_final
        ? `<pre style="white-space:pre-wrap; font-family:inherit; font-size:0.88rem; color:#212529;">${escHtml(proc.documento_final)}</pre>`
        : '<p class="text-muted">Nenhum texto de parecer foi registrado ao finalizar este processo.</p>'}
    </div>
    <div style="background:#fff;border:1px solid #dee2e6;padding:20px;border-radius:8px;margin-bottom:16px;">
      <h3 style="font-size:1.05rem;margin-bottom:12px;"><i class="ti ti-microscope"></i> Histórico de Checagens</h3>
      ${achadosHtml}
    </div>
    <div style="background:#fff;border:1px solid #dee2e6;padding:20px;border-radius:8px;margin-bottom:16px;">
      <h3 style="font-size:1.05rem;margin-bottom:12px;"><i class="ti ti-message-circle"></i> Histórico de Consultas</h3>
      ${consultasHtml}
    </div>
    <div style="background:#fff;border:1px solid #dee2e6;padding:20px;border-radius:8px;margin-bottom:16px;">
      <h3 style="font-size:1.05rem;margin-bottom:12px;"><i class="ti ti-note"></i> Notas do Processo</h3>
      ${notasHtml}
    </div>`;
}

function formatarSEI(input) {
  let val = input.value;
  if (val.includes('SEI_')) {
    val = val.replace('SEI_', '').replace('.zip', '').replace('.pdf', '');
    val = val.replace(/_/g, '/');
  }
  input.value = val;
}

// Testa UM provedor específico direto, sem passar pela fila de fallback (não faz
// sentido testar Gemini e, se falhar, o teste "vazar" pro Groq — a pessoa quer saber
// exatamente SE AQUELE ali funciona). Usa o valor que está no campo agora, mesmo que
// ainda não tenha clicado "Salvar" — não devia precisar salvar só pra testar.
async function testarConexaoProvedor(id) {
  const resultadoEl = document.getElementById('teste-' + id);
  if (resultadoEl) resultadoEl.innerHTML = '<span class="spinner" style="width:11px;height:11px;border-width:2px;margin:0;"></span> Testando...';

  if (id === 'ollama') {
    OLLAMA_URL = (document.getElementById('cfg-ollama-url')?.value || '').trim() || 'http://localhost:11434';
    OLLAMA_MODEL = (document.getElementById('cfg-ollama-model')?.value || '').trim() || 'qwen2.5:7b';
  }

  const info = PROVEDORES_INFO[id];
  if (!info) return;

  try {
    await info.invocar('Responda só a palavra: ok', true, null);
    if (resultadoEl) resultadoEl.innerHTML = `<span style="color:#2b8a3e; font-weight:600;"><i class="ti ti-check"></i> Conectado!</span>`;
  } catch (e) {
    if (resultadoEl) resultadoEl.innerHTML = `<span style="color:#c92a2a;"><i class="ti ti-x"></i> ${escHtml(e.message)}</span>`;
  }
}

function salvarConfig() {
  const marcado = (id, atual) => { const el = document.getElementById('ativo-' + id); return el ? el.checked : atual; };
  GEMINI_ATIVO = marcado('gemini', GEMINI_ATIVO); GROQ_ATIVO = marcado('groq', GROQ_ATIVO); KIMI_ATIVO = marcado('kimi', KIMI_ATIVO);
  OPENROUTER_ATIVO = marcado('openrouter', OPENROUTER_ATIVO); DEEPSEEK_ATIVO = marcado('deepseek', DEEPSEEK_ATIVO); OLLAMA_ATIVO = marcado('ollama', OLLAMA_ATIVO);
  [['gemini', GEMINI_ATIVO], ['groq', GROQ_ATIVO], ['kimi', KIMI_ATIVO], ['openrouter', OPENROUTER_ATIVO], ['deepseek', DEEPSEEK_ATIVO], ['ollama', OLLAMA_ATIVO]]
    .forEach(([id, v]) => localStorage.setItem('sei_' + id + '_ativo', String(v)));
  const url = document.getElementById('cfg-ollama-url'), modelo = document.getElementById('cfg-ollama-model');
  if (url) { OLLAMA_URL = url.value.trim() || 'http://localhost:11434'; localStorage.setItem('sei_ollama_url', OLLAMA_URL); }
  if (modelo) { OLLAMA_MODEL = modelo.value.trim() || 'qwen2.5:7b'; localStorage.setItem('sei_ollama_model', OLLAMA_MODEL); }
  verificarIA();
  mostrarToast('Configurações salvas.');
}

async function prePreencherDeArquivo(file) {
  if (!file) return;
  const status = document.getElementById('np-status-preenchimento');
  status.innerHTML = '<span class="spinner"></span> Lendo o documento...';
  try {
    let arquivosLidos; // sempre uma lista — [{nome, texto}] — mesmo pra 1 arquivo só, evita caso especial
    if (file.name.toLowerCase().endsWith('.zip')) {
      const { arquivos, avisos } = await abrirZipEExtrairArquivos(file, (nome) => {
        status.innerHTML = `<span class="spinner"></span> Lendo ${escHtml(nome.substring(0, 40))}...`;
      });
      if (!arquivos.length) throw new Error('Nenhum arquivo legível dentro do ZIP.' + (avisos.length ? ' (' + avisos[0] + ')' : ''));
      arquivosLidos = arquivos;
    } else {
      const buf = await file.arrayBuffer();
      const texto = await extrairTextoArquivo(file.name, buf, (msg) => { status.innerHTML = `<span class="spinner"></span> ${escHtml(msg)}`; });
      if (!texto.trim().length) throw new Error('Nenhum texto foi extraído desse arquivo.');
      arquivosLidos = [{ nome: file.name, texto, sensiveis: detectarSensiveisDoArquivo(texto, file.name) }];
    }
    _arquivoPrePreenchido = arquivosLidos;

    // Nº do processo: procura em todos os arquivos lidos, usa o primeiro que achar
    let achouNumeroProcesso = false;
    for (const a of arquivosLidos) {
      const nums = extrairNumerosProcesso(a.texto);
      if (nums.length) {
        const campoSei = document.getElementById('np-sei');
        campoSei.value = nums[0].valor;
        _marcarComoSugerido(campoSei);
        achouNumeroProcesso = true;
        break;
      }
    }
    if (!achouNumeroProcesso) {
      console.warn('Nenhum número de processo (formato XXXXXXX.XXXXXX/AAAA-XX) encontrado nos arquivos lidos — preencha manualmente.');
    }

    status.innerHTML = '<span class="spinner"></span> Identificando título, unidade e OSS...';
    // Amostra pra IA: concatena o início de cada arquivo, até um limite total —
    // suficiente pra achar título/unidade/OSS sem mandar o processo inteiro nessa etapa.
    const LIMITE_AMOSTRA_TOTAL = 8000;
    let amostra = '';
    for (const a of arquivosLidos) {
      if (amostra.length >= LIMITE_AMOSTRA_TOTAL) break;
      amostra += `\n--- ${a.nome} ---\n` + a.texto.substring(0, LIMITE_AMOSTRA_TOTAL - amostra.length);
    }
    const prompt = `Leia o início de um ou mais documentos de contrato/aditivo de gestão em saúde pública e extraia,
SOMENTE se estiverem claramente explícitos no texto:
- "titulo": um título curto pro tipo de documento (ex: "1º Termo Aditivo", "Contrato de Gestão")
- "unidade": nome da unidade de saúde envolvida (ex: "UPA Curado", "Hospital Regional de Araripina")
- "oss": sigla ou nome da Organização Social de Saúde contratada

NÃO invente nada que não esteja no texto — deixe "" se não encontrar com clareza.
Retorne EXCLUSIVAMENTE um JSON: {"titulo": "", "unidade": "", "oss": ""}

TEXTO:
${amostra}`;
    try {
      const jsonStr = await invocarIAComFallback(prompt, false, null);
      const sugestao = JSON.parse(jsonStr);
      if (sugestao.titulo)  { const el = document.getElementById('np-titulo');  el.value = sugestao.titulo;  _marcarComoSugerido(el); }
      if (sugestao.unidade) { const el = document.getElementById('np-unidade'); el.value = sugestao.unidade; _marcarComoSugerido(el); }
      if (sugestao.oss)     { const el = document.getElementById('np-oss');     el.value = sugestao.oss;     _marcarComoSugerido(el); }
    } catch (e) {
      console.warn('Sugestão de título/unidade/OSS via IA falhou:', e.message);
    }
    const nomesLidos = arquivosLidos.map(a => a.nome).join(', ');
    const avisoSemNumero = !achouNumeroProcesso
      ? `<div style="margin-top:6px; color:#856404;"><i class="ti ti-alert-triangle"></i> Não achei um número de processo no formato SEI (ex: 2300002.104000/2022-91) — preencha o campo manualmente.</div>`
      : '';
    status.innerHTML = `<div style="background:#d1e7dd; color:#0f5132; padding:8px 12px; border-radius:6px; font-size:0.82rem;">
      <i class="ti ti-check"></i> ${arquivosLidos.length > 1 ? `${arquivosLidos.length} arquivos lidos (${escHtml(nomesLidos)})` : escHtml(nomesLidos)}. Confira os campos destacados abaixo antes de salvar.
      ${avisoSemNumero}
    </div>`;
  } catch (e) {
    _arquivoPrePreenchido = null;
    status.innerHTML = `<div class="alert alert-danger">Não foi possível ler esse arquivo: ${escHtml(e.message)}</div>`;
  }
}

function _marcarComoSugerido(el) {
  el.style.background = '#fff9db';
  el.style.borderColor = '#f5c518';
  const limpar = () => { el.style.background = ''; el.style.borderColor = ''; el.removeEventListener('input', limpar); };
  el.addEventListener('input', limpar);
}

async function salvarNovoProcesso() {
  const sei = document.getElementById('np-sei').value.trim();
  const titulo = document.getElementById('np-titulo').value.trim();
  const unidade = document.getElementById('np-unidade').value.trim() || 'HRA';
  const oss = document.getElementById('np-oss').value.trim() || 'ISG';
  const gerencia = document.getElementById('np-gerencia').value.trim();
  if (!titulo) return alert('Preencha ao menos o Título/Objeto.');
  const btn = document.getElementById('btn-criar-processo');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Criando...'; }
  const res = await api('processos/criar', {
    numero_sei: sei, titulo, unidade, oss, gerencia,
    criado_por: usuarioAtual.email
  });
  if (!res.ok) {
    alert('Erro ao criar processo: ' + res.erro);
    if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-device-floppy"></i> Criar Processo na Bancada'; }
    return;
  }
  if (_arquivoPrePreenchido && _arquivoPrePreenchido.length) {
    processoAtual = res.processo;
    for (let i = 0; i < _arquivoPrePreenchido.length; i++) {
      const a = _arquivoPrePreenchido[i];
      if (btn) btn.innerHTML = `<span class="spinner"></span> Anexando documento já lido (${i + 1}/${_arquivoPrePreenchido.length})...`;
      try {
        await salvarDocumentoNoBackend(a.nome, a.texto, a.sensiveis);
      } catch (e) {
        console.warn(`Processo criado, mas falhou ao anexar "${a.nome}":`, e.message);
      }
    }
    _arquivoPrePreenchido = null;
    window._autoChecagemPendente = true;
  }
  abrirProcesso(res.processo.numero_sei || String(res.processo.id));
}

async function salvarNotaEvidencia(referencia, nota) {
  if (!processoAtual) return;
  try {
    await api('notas/salvar', { processo_id: processoAtual.id, referencia, nota, usuario: usuarioAtual.email });
  } catch (e) {
    console.warn('Falha ao salvar nota da evidência:', e.message);
  }
}

function abrirPainelEvidencias() {
  if (painelEvidenciasWin && !painelEvidenciasWin.closed) { painelEvidenciasWin.focus(); return; }
  painelEvidenciasWin = window.open('', 'PainelEvidencias', 'width=550,height=850,left=2000,top=100');
  painelEvidenciasWin.document.write(`
      <html>
      <head>
          <title>Painel de Evidências - SEI Analista</title>
          <style>
              body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f1f3f5; color: #212529; padding: 20px; margin: 0; }
              h2 { font-size: 1.3rem; border-bottom: 3px solid #0dcaf0; padding-bottom: 10px; margin-top: 0; color: #343a40; }
              .evidencia-card { background: #fff; border-left: 5px solid #0dcaf0; padding: 15px; margin-bottom: 15px; border-radius: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
              .evidencia-tag { font-size: 0.75rem; font-weight: bold; background: #e9ecef; padding: 4px 10px; border-radius: 12px; margin-bottom: 10px; display: inline-block; color: #495057; text-transform: uppercase; letter-spacing: 0.5px;}
              .evidencia-title { font-weight: bold; font-size: 1rem; margin-bottom: 5px; color: #212529;}
              .evidencia-doc { font-size: 0.75rem; background: #fff3cd; color: #856404; padding: 4px 8px; border-radius: 4px; margin-bottom: 10px; display: inline-block; border: 1px solid #ffeeba; cursor: pointer;}
              .evidencia-text { font-size: 0.9rem; line-height: 1.6; color: #495057; white-space: pre-wrap;}
              .evidencia-nota { width: 100%; border: 1px solid #dee2e6; border-radius: 6px; padding: 8px 10px; font-size: 0.85rem; font-family: inherit; color: #212529; margin-top: 10px; resize: none; overflow: hidden; min-height: 34px; box-sizing: border-box; }
              .evidencia-nota:focus { outline: none; border-color: #0dcaf0; box-shadow: 0 0 0 2px rgba(13,202,240,0.15); }
              .evidencia-nota-label { font-size: 0.72rem; color: #868e96; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 10px; display: block; }
              .watermark { text-align: center; margin-top: 30px; font-size: 0.75rem; color: #adb5bd; border-top: 1px solid #dee2e6; padding-top: 15px; }
              .btn-remove { background: #ffe3e3; color: #e03131; border: 1px solid #ffc9c9; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; float: right; font-weight: bold; transition: 0.2s;}
              .btn-remove:hover { background: #fa5252; color: white;}
          </style>
      </head>
      <body>
          <h2>📌 Painel de Evidências</h2>
          <p style="font-size: 0.85rem; color: #6c757d; margin-bottom: 20px;">As informações que você alfinetar no Monitor 1 aparecerão aqui. As anotações abaixo de cada card são salvas automaticamente no processo — pode fechar esta janela sem perder nada.</p>
          <div id="evidencias-container"></div>
          <div class="watermark">&copy; 2026 SES-PE — DGMCG/GGPCG.<br>Desenvolvido por Cleuton Vieira.</div>
          <script>
              function removerEvidencia(id) { var el = document.getElementById(id); if(el) el.remove(); }
              function copiarDocID(texto) { navigator.clipboard.writeText(texto).then(() => alert('Documento Copiado: ' + texto + '\\n\\nCole na barra de pesquisa do SEI!')); }
              function ajustarAlturaNota(el) {
                  el.style.height = 'auto';
                  el.style.height = (el.scrollHeight) + 'px';
              }
              var _debounceNotas = {};
              function salvarNotaComDebounce(referencia, valor, cardId) {
                  clearTimeout(_debounceNotas[cardId]);
                  _debounceNotas[cardId] = setTimeout(function() {
                      if (window.opener && window.opener.salvarNotaEvidencia) {
                          window.opener.salvarNotaEvidencia(referencia, valor);
                      }
                  }, 800);
              }
          </script>
      </body>
      </html>
  `);
  painelEvidenciasWin.document.close();
}

async function fixarEvidenciaDaMemoria(id) {
  const dados = window.memoriaEvidencias[id];
  if (!dados) return alert("Erro: Dados não encontrados na memória.");
  if (!painelEvidenciasWin || painelEvidenciasWin.closed) abrirPainelEvidencias();
  const doc = painelEvidenciasWin.document;
  if (doc.getElementById('ev-' + id)) { painelEvidenciasWin.focus(); return; }
  const container = doc.getElementById('evidencias-container');
  if (container) {
    const referencia = `${dados.tag}: ${dados.titulo}`;
    const referenciaAttr = escAttr(referencia);
    let notaExistente = '';
    try {
      const resNotas = await api('notas/listar', { processo_id: processoAtual.id });
      const encontrada = (resNotas.notas || []).find(n => n.referencia === referencia);
      if (encontrada) notaExistente = encontrada.nota;
    } catch (e) { console.warn('Falha ao buscar nota existente:', e.message); }
    let htmlDoc = dados.doc ? `<div class="evidencia-doc" onclick="copiarDocID('${dados.doc}')" title="Clique para copiar">📄 Origem: ${dados.doc}</div>` : '';
    const html = `
        <div class="evidencia-card" id="ev-${id}">
            <button class="btn-remove" onclick="removerEvidencia('ev-${id}')">Remover</button>
            <div class="evidencia-tag">${dados.tag}</div>
            <div class="evidencia-title">${dados.titulo}</div>
            ${htmlDoc}
            <div class="evidencia-text">${dados.texto}</div>
            <label class="evidencia-nota-label">Sua anotação (salva automaticamente)</label>
            <textarea class="evidencia-nota" placeholder="Digite aqui uma observação sobre essa evidência..." rows="1"
              oninput="ajustarAlturaNota(this); salvarNotaComDebounce('${referenciaAttr}', this.value, '${id}')">${escHtml(notaExistente)}</textarea>
        </div>`;
    container.insertAdjacentHTML('afterbegin', html);
    const textareaNova = doc.getElementById('ev-' + id).querySelector('.evidencia-nota');
    if (textareaNova) { textareaNova.style.height = 'auto'; textareaNova.style.height = textareaNova.scrollHeight + 'px'; }
    painelEvidenciasWin.focus();
  }
}

async function abrirProcesso(identificador) {
  const content = document.getElementById('content');
  if (!content) return;
  content.innerHTML = '<span class="spinner"></span> Carregando processo...';
  const resProc = await api('processos/obter', isNaN(identificador) ? { numero_sei: identificador } : { id: identificador });
  if (!resProc.ok) { content.innerHTML = `<div class="alert alert-danger">Processo não encontrado: ${escHtml(resProc.erro || '')}</div>`; return; }
  processoAtual = resProc.processo;
  // Registra que o destinatário abriu o processo (aparece como "Visto" para quem encaminhou)
  api('processos/marcar-lido', { processo_id: processoAtual.id }, { fundo: true }).catch(() => {});
  _ultimoTextoRevisadoHash = null;
  const [resDocs, resConteudo, resTram] = await Promise.all([
    api('documentos/listar', { processo_id: processoAtual.id }),
    api('conteudo/listar', { processo_id: processoAtual.id }),
    api('tramitacoes/listar', { processo_id: processoAtual.id })
  ]);
  const docs = resDocs.documentos || [];
  window._docsDoProcesso = docs;
  const blocos = resConteudo.blocos || [];
  const tramitacoes = resTram.tramitacoes || [];
  _ultimaTramitacaoRecebida = tramitacoes.find(t => String(t.para_usuario).toLowerCase() === usuarioAtual.email.toLowerCase()) || null;
  const _textosVistos = new Set();
  textoIntegralAtual = docs.map(d => {
    const textoDoc = blocos.filter(b => String(b.documento_id) === String(d.id))
      .sort((a, b) => a.bloco_num - b.bloco_num)
      .map(b => b.conteudo || '').join('');
    // Mesmo conteúdo importado mais de uma vez só entra uma vez no texto enviado à IA
    if (textoDoc.length > 200 && _textosVistos.has(textoDoc)) return '';
    _textosVistos.add(textoDoc);
    return `\n\n--- DOC: ${d.nome_arquivo} ---\n` + textoDoc;
  }).join('');
  let docsHtml = '<span style="color:var(--text-muted); font-size:0.85rem; font-style:italic;">Nenhum documento anexado ainda.</span>';
  if (docs.length > 0) {
    docsHtml = '<ul style="margin:0; padding-left:20px; font-size:0.85rem; color:#495057; max-height: 120px; overflow-y: auto;">';
    docs.forEach(d => {
      let resumoTxt = '';
      if (d.resumo_sensiveis) {
        try {
          const lista = JSON.parse(d.resumo_sensiveis);
          resumoTxt = lista.length
            ? ` <span style="color:#b45309; font-size:0.72rem;">(${lista.length} dado(s) sensível(is) coberto(s))</span>`
            : ' <span style="color:#868e96; font-size:0.72rem;">(nenhum dado sensível)</span>';
        } catch (e) { /* resumo antigo ou inválido — só não mostra */ }
      }
      const seloAssinado = d.tipo_documento === 'FINAL_ASSINADO'
        ? ' <span style="background:#d1e7dd; color:#0f5132; font-size:0.68rem; padding:1px 7px; border-radius:10px; font-weight:600;">✓ VERSÃO ASSINADA</span>' : '';
      docsHtml += `<li style="margin-bottom:3px;"><i class="ti ti-file-type-pdf" style="color:#dc3545; margin-right:5px;"></i> ${escHtml(d.nome_arquivo)}${seloAssinado}${resumoTxt}</li>`;
    });
    docsHtml += '</ul>';
  }
  const p = processoAtual;
  const sei = p.numero_sei || String(p.id);
  let html = `
    <div id="banner-conferindo" class="hidden" style="position:fixed; top:76px; right:24px; z-index:500; background:var(--alert-bordeaux-light, #f8d7da); border:1px solid var(--alert-bordeaux, #8e1628); border-radius:var(--border-radius, 6px); padding:12px 18px; max-width:280px; box-shadow:0 4px 14px rgba(0,0,0,0.12);">
      <div style="display:flex; align-items:center; gap:8px;">
        <span style="width:9px; height:9px; border-radius:50%; background:var(--alert-bordeaux, #8e1628); flex-shrink:0;"></span>
        <strong id="banner-conferindo-titulo" style="color:var(--alert-bordeaux, #8e1626); font-size:0.82rem; letter-spacing:0.2px;">ESTOU CONFERINDO OS DOCUMENTOS...</strong>
      </div>
      <div id="banner-conferindo-detalhe" style="font-size:0.75rem; color:#6b1521; margin-top:4px; margin-left:17px;"></div>
      <div style="font-size:0.72rem; color:#6b1521; margin-top:2px; margin-left:17px;">Tempo decorrido: <span id="banner-conferindo-timer">0s</span></div>
    </div>
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom:15px;">
        <button class="btn btn-secondary btn-sm" onclick="showView('dashboard', caixaAtualAtiva)"><i class="ti ti-arrow-left"></i> Voltar</button>
        <div style="display:flex; gap:10px; flex-wrap:wrap;">
          ${_ultimaTramitacaoRecebida ? `<button class="btn btn-sm" onclick="devolverProcesso()" style="background-color:#d97706; color:#fff; border:none; font-weight:bold;"><i class="ti ti-corner-up-left"></i> Devolver</button>` : ''}
          <button class="btn btn-sm" onclick="modalEncaminhar()" style="background-color:#495057; color:#fff; border:none; font-weight:bold;"><i class="ti ti-share"></i> Encaminhar</button>
          <button class="btn btn-sm" onclick="finalizarProcesso()" style="background-color:#16a34a; color:#fff; border:none; font-weight:bold;"><i class="ti ti-check"></i> Finalizar</button>
          <button class="btn btn-sm" onclick="abrirPainelEvidencias()" style="background-color: #0dcaf0; color: #000; border: none; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><i class="ti ti-columns"></i> Abrir Modo Tela Dupla</button>
        </div>
    </div>
    <div style="background:#fff;border-radius:8px;padding:20px;margin-bottom:20px;box-shadow:0 1px 3px rgba(0,0,0,0.1); border-left: 4px solid var(--action-primary);">
      <h2 style="font-size:1.2rem;color:var(--text-dark); margin-bottom:5px;">${escHtml(sei)}</h2>
      <p style="font-weight:600; font-size:1.05rem;">${escHtml(p.titulo)}</p>
      <div style="margin-top:10px;font-size:0.85rem;color:var(--text-muted);">
        <i class="ti ti-building"></i> Unidade: ${escHtml(p.unidade)} | OSS: ${escHtml(p.oss)}
        &nbsp;·&nbsp; <i class="ti ti-flag"></i> ${escHtml(p.status)}
        &nbsp;·&nbsp; <i class="ti ti-user"></i> Com: ${escHtml(p.responsavel_atual)}
      </div>
      <div style="margin-top:15px; background:#f8f9fa; border:1px solid #dee2e6; padding:12px; border-radius:6px;">
        <div style="font-weight:600; font-size:0.85rem; color:var(--text-dark); margin-bottom:8px;"><i class="ti ti-paperclip"></i> Documentos Integrados (${docs.length}):</div>
        ${docsHtml}
      </div>
      <div style="margin-top:15px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
        <button class="btn btn-primary btn-sm" onclick="modalUploadZIP()"><i class="ti ti-cloud-upload"></i> Adicionar mais arquivos</button>
        <button class="btn btn-secondary btn-sm" onclick="abrirTabelaDadosProcesso()"><i class="ti ti-table"></i> Gerar tabela de dados</button>
        <button class="btn btn-secondary btn-sm" onclick="modalImportarVersaoAssinada('processo')"><i class="ti ti-file-check"></i> Importar versão assinada (SEI)</button>
        <div id="btn-status-processo" style="display:inline-flex; gap:6px; align-items:center; flex-wrap:wrap;"></div>
      </div>
    </div>

    <!-- 1. PAINEL DE CHECAGEM -->
    <div style="background:#fff;border:1px solid #dee2e6;padding:20px;border-radius:8px;margin-bottom:16px;">
      <h3 style="font-size:1.1rem; color:var(--text-dark); margin-bottom:15px;"><i class="ti ti-microscope"></i> 1. Verificar Processo</h3>
      <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:14px;">
        <div style="border:1px solid #dee2e6; border-radius:8px; padding:10px 14px; background:#f8f9fa; display:flex; align-items:flex-start; gap:10px;">
          <div style="width:32px;height:32px;border-radius:6px;background:#e7f5ff;color:#1c7ed6;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;"><i class="ti ti-file-text"></i></div>
          <div style="flex:1;">
            <div style="font-size:0.82rem;font-weight:600;color:#212529;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">Documentos do processo
              <span style="font-size:0.68rem;background:#d1e7dd;color:#0f5132;padding:2px 7px;border-radius:10px;">Sempre ativo</span></div>
            <div style="font-size:0.75rem;color:#6c757d;margin-top:2px;line-height:1.4;">Contrato, aditivos, ofícios e despachos importados do SEI. A conferência de contas por código roda antes da IA.</div>
          </div>
        </div>
        <div id="card-drive" onclick="toggleFonte('drive')" style="border:1px solid #a3cfbb; border-radius:8px; padding:10px 14px; background:#e8f5e9; display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
          <div id="chk-drive-box" style="width:16px;height:16px;border-radius:4px;border:1px solid #adb5bd;background:#495057;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:8px;"><span style="color:#fff;font-size:10px;">✓</span></div>
          <input type="checkbox" id="chk-historico-unidade" checked style="display:none;">
          <div style="width:32px;height:32px;border-radius:6px;background:#d1fae5;color:#065f46;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;"><i class="ti ti-brand-google-drive"></i></div>
          <div style="flex:1;">
            <div style="font-size:0.82rem;font-weight:600;color:#212529;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">Histórico da unidade
              <span style="font-size:0.68rem;background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:10px;">Google Drive</span></div>
            <div style="font-size:0.75rem;color:#6c757d;margin-top:2px;line-height:1.4;">Compara com os contratos antigos da mesma unidade na pasta LEIS E DECRETOS. A busca é pelo nome do arquivo e pode confundir unidades parecidas, por isso o achado sempre vem marcado para você confirmar.</div>
          </div>
        </div>
        <div id="status-fonte-historico" style="font-size:0.75rem; padding-left:14px;"></div>
        <div id="card-web" onclick="toggleFonte('web')" style="border:1px solid #dee2e6; border-radius:8px; padding:10px 14px; background:#f8f9fa; display:flex; align-items:flex-start; gap:10px; cursor:pointer;">
          <div id="chk-web-box" style="width:16px;height:16px;border-radius:4px;border:1px solid #adb5bd;background:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:8px;"></div>
          <input type="checkbox" id="chk-legislacao-jurisprudencia" style="display:none;">
          <div style="width:32px;height:32px;border-radius:6px;background:#fef3c7;color:#92400e;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;"><i class="ti ti-world"></i></div>
          <div style="flex:1;">
            <div style="font-size:0.82rem;font-weight:600;color:#212529;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">Busca jurídica na web
              <span style="font-size:0.68rem;background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:10px;">Experimental · mais lento</span></div>
            <div style="font-size:0.75rem;color:#6c757d;margin-top:2px;line-height:1.4;">Pesquisa em fontes públicas: Diário Oficial, legislação federal e estadual, TCU, TCE-PE, TCM-PE, STJ, STF e AGU. Pode trazer fonte não oficial ou desatualizada: confirme antes de citar em parecer.</div>
          </div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
        <button class="btn btn-warning" onclick="rodarRaioX()"><i class="ti ti-bolt"></i> Executar Checagem</button>
        <span id="contador-checagem" style="font-weight:bold; font-size:0.95rem;"></span>
      </div>
      <div id="ia-status" style="margin-top:15px;"></div>
      <div id="painel-cards" style="margin-top:20px;"></div>
    </div>

    <!-- 2. PERGUNTAS AO PROCESSO -->
    <div style="background:#fff;border:1px solid #dee2e6;padding:20px;border-radius:8px;margin-bottom:16px;">
      <h3 style="font-size:1.1rem; color:var(--text-dark); margin-bottom:10px;"><i class="ti ti-message-circle"></i> 2. Pergunte ao Processo</h3>
      <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Tire dúvidas específicas sobre os anexos, ou peça um texto (nota técnica, despacho, parecer, ofício): o sistema confirma com você o tipo e os temas e monta o rascunho no card 3. <a href="#" onclick="usarExemploPedido(); return false;">Usar um exemplo de pedido</a></p>
      <div style="display:flex; gap:16px; flex-wrap:wrap; align-items:stretch;">
        <div style="flex:1 1 420px; min-width:0; display:flex; flex-direction:column;">
          <div style="font-size:0.78rem; font-weight:600; color:#495057; margin-bottom:6px;"><i class="ti ti-messages"></i> Conversa de agora</div>
          <div id="chat-history" style="flex:1; min-height:160px; margin-bottom: 15px; max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px inset #e9ecef;">
              <div id="chat-vazio" style="color: #adb5bd; font-size: 0.85rem; text-align: center; font-style: italic;">Faça uma pergunta abaixo. Tudo o que for perguntado neste processo fica guardado no histórico ao lado.</div>
          </div>
          <div style="display:flex; gap:10px;">
             <input type="text" id="chat-input" placeholder="Pergunte (ex.: qual o índice de reajuste da cláusula 4?) ou peça um texto (ex.: preciso de um despacho sobre...)" style="flex:1; min-width:0; padding:12px; border:1px solid #ced4da; border-radius:6px; outline:none; font-size: 0.95rem;" onkeypress="if(event.key === 'Enter') fazerPerguntaAoProcesso()">
             <button class="btn btn-primary" onclick="fazerPerguntaAoProcesso()" id="btn-perguntar"><i class="ti ti-send"></i> Perguntar</button>
          </div>
        </div>
        <aside style="flex:0 1 340px; min-width:260px; background:#f1f3f5; border:1px solid #dee2e6; border-radius:6px; padding:12px; display:flex; flex-direction:column; max-height:480px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;">
            <strong style="font-size:0.85rem; color:#343a40;"><i class="ti ti-history"></i> Histórico deste processo</strong>
            <span id="contador-historico-consultas" style="font-size:0.72rem; color:#6c757d; white-space:nowrap;"></span>
          </div>
          <div id="lista-historico-consultas" style="overflow-y:auto; flex:1; padding-right:2px;"></div>
        </aside>
      </div>
    </div>

    <!-- 3. PAINEL DE REVISÃO E LINGUAGEM SIMPLES -->
    <div style="background:#f8f9fa; border:1px dashed #adb5bd; padding:20px; border-radius:8px; margin-bottom:30px;">
      <h3 style="font-size:1.1rem; color:var(--text-dark); margin-bottom:10px;"><i class="ti ti-robot"></i> 3. Redação e Revisão</h3>
      <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Peça um rascunho no card 2, escrevendo o que precisa (por exemplo: "Preciso de uma nota técnica sobre a necessidade de ampliação de leitos ou o não atingimento de metas desta unidade. Monte um modelo."). O rascunho aparece aqui, já preenchido com o que foi lido dos documentos e do histórico da unidade. Você também pode escrever ou colar um texto seu. A revisão cruza o texto com o processo e aponta melhorias de mérito e consistência. A palavra final e a aprovação são sempre suas.</p>
      <div id="redacao-notas"></div>
      <textarea id="editor-final" placeholder="O rascunho pedido no card 2 aparece aqui. Ou escreva/cole um texto seu, para ser revisado..." style="width:100%; height:150px; padding:15px; border:1px solid #ced4da; border-radius:6px; font-family: inherit; font-size: 0.95rem; margin-bottom: 15px; outline:none; resize:vertical;"></textarea>
      <div style="display: flex; align-items: center; gap: 15px;">
          <button class="btn btn-secondary" onclick="abrirCriarDocumento()"><i class="ti ti-file-plus"></i> Criar documento</button>
          <button class="btn btn-warning" onclick="rodarRevisaoFinal()"><i class="ti ti-search"></i> Executar Análise Completa</button>
          <span id="contador-revisao" style="font-weight: bold; font-size: 0.95rem;"></span>
      </div>
      <div id="status-revisao" style="margin-top:15px;"></div>
    </div>
  `;
  content.innerHTML = html;
  _renderBotoesStatus(processoAtual.status);
  _montarCoberturaLeitura();
  if (window._autoChecagemPendente) {
    window._autoChecagemPendente = false;
    setTimeout(() => rodarRaioX(true), 400);   // checagem automática depois de importar
  }
  window._historicoConsultas = [];
  carregarHistoricoConsultas(processoAtual.id);
  api('auditorias/listar', { processo_id: processoAtual.id }).then(resAud => {
    const auditorias = resAud.auditorias || [];
    const ultima = auditorias.find(a => a.tipo_checkpoint === 'GERAL' || a.tipo_checkpoint === 'ENTRADA');
    if (!ultima) return;
    let achados = [];
    try { achados = JSON.parse(ultima.achados_json || '[]'); } catch (e) { /* vazio */ }
    window.achadosAtuais = achados;
    const contadorEl = document.getElementById('contador-checagem');
    if (contadorEl) {
      contadorEl.innerHTML = achados.length > 0
        ? `<span style="background: #f8d7da; color: #842029; padding: 6px 12px; border-radius: 20px;"><i class="ti ti-alert-triangle"></i> ${achados.length} inconsistência(s)</span>`
        : `<span style="background: #d1e7dd; color: #0f5132; padding: 6px 12px; border-radius: 20px;"><i class="ti ti-check"></i> Processo limpo.</span>`;
    }
    renderizarCards(achados);
    const statusEl = document.getElementById('ia-status');
    if (statusEl) statusEl.innerHTML = `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:4px;"><i class="ti ti-history"></i> Última checagem: ${new Date(ultima.data).toLocaleString('pt-BR')} — execute de novo se os documentos mudaram desde então.</div>`;
  }).catch(e => console.warn('Falha ao carregar última checagem:', e.message));
}

async function modalEncaminhar() {
  criarModal(`<span class="spinner"></span> Carregando lista de usuários...`);
  const res = await api('usuarios/listar');
  if (!res.ok) { criarModal(`<div class="alert alert-danger">Erro ao carregar usuários: ${escHtml(res.erro)}</div>`); return; }
  const usuarios = (res.usuarios || []).filter(u => u.email !== usuarioAtual.email);
  if (!usuarios.length) { criarModal(`<div class="alert alert-warning">Não há outro usuário cadastrado para encaminhar.</div>`); return; }
  const opcoes = usuarios.map(u => `<option value="${escAttr(u.email)}">${escHtml(u.nome)} (${escHtml(u.gerencia)})</option>`).join('');
  criarModal(`
    <h2 style="margin-bottom:15px; font-size:1.2rem;">Encaminhar Processo</h2>
    <div class="form-group">
      <label>Encaminhar para</label>
      <select id="enc-destinatario" style="width:100%;padding:8px;border:1px solid #ced4da;border-radius:6px;">${opcoes}</select>
    </div>
    <div class="form-group">
      <label>Observação (opcional)</label>
      <textarea id="enc-observacao" placeholder="Ex: Favor revisar cláusula 4 antes de assinar." style="width:100%;min-height:70px;padding:8px;border:1px solid #ced4da;border-radius:6px;"></textarea>
    </div>
    <div id="enc-status"></div>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-secondary" style="flex:1;" onclick="fecharModal()"><i class="ti ti-x"></i> Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" onclick="confirmarEncaminhar()"><i class="ti ti-share"></i> Enviar</button>
    </div>
  `, false);
}

async function confirmarEncaminhar() {
  const destinatario = document.getElementById('enc-destinatario').value;
  const observacao = document.getElementById('enc-observacao').value.trim();
  const statusEl = document.getElementById('enc-status');
  statusEl.innerHTML = '<span class="spinner"></span> Encaminhando...';
  const res = await api('processos/encaminhar', {
    processo_id: processoAtual.id, de: usuarioAtual.email, para: destinatario, observacao
  });
  if (!res.ok) { statusEl.innerHTML = `<div class="alert alert-danger">${escHtml(res.erro)}</div>`; return; }
  fecharModal();
  showView('dashboard', 'encaminhados');
}

async function devolverProcesso() {
  if (!_ultimaTramitacaoRecebida) return;
  const paraQuem = _ultimaTramitacaoRecebida.de_usuario;
  if (!confirm(`Devolver este processo para ${paraQuem}?`)) return;
  const res = await api('processos/encaminhar', {
    processo_id: processoAtual.id, de: usuarioAtual.email, para: paraQuem, observacao: 'Devolvido'
  });
  if (!res.ok) { alert('Erro ao devolver: ' + res.erro); return; }
  showView('dashboard', 'entrada');
}

async function finalizarProcesso() {
  const textoAtual = (document.getElementById('editor-final')?.value || '').trim();
  const hashAtual = textoAtual ? await sha256(textoAtual) : null;
  const revisadoEIgual = _ultimoTextoRevisadoHash && hashAtual && hashAtual === _ultimoTextoRevisadoHash;
  let mensagem;
  if (!textoAtual) {
    mensagem = '⚠️ Nenhum parecer foi colado na caixa de Revisão Final.\n\nFinalizar mesmo assim?';
  } else if (!revisadoEIgual) {
    mensagem = '⚠️ Este texto ainda não passou pela Revisão Final (ou foi alterado depois dela).\n\nFinalizar mesmo assim?';
  } else {
    mensagem = 'Marcar este processo como concluído?';
  }
  if (!confirm(mensagem)) return;
  // O registro de atividades é feito pelo servidor; "revisao_confirmada" vai junto só para
  // constar no registro se o texto passou pela Revisão Final antes de finalizar.
  const res = await api('processos/atualizar-status', {
    id: processoAtual.id, status: 'Concluído', documento_final: textoAtual, revisao_confirmada: !!revisadoEIgual
  });
  if (!res.ok) { alert('Erro ao finalizar: ' + res.erro); return; }
  showView('dashboard', 'concluidos');
}

// ==================== TABELA DE DADOS DO PROCESSO ====================
// Monta uma tabela com valores, datas, nº de processo e CEP extraídos POR CÓDIGO dos
// documentos — nenhum número é escrito pela IA. Cada linha diz de qual documento e
// página veio, pra quem for usar a tabela num parecer poder conferir na fonte.
function montarLinhasTabelaDados() {
  const linhas = [];
  dividirPorDocumento(textoIntegralAtual).forEach(d => {
    const tipos = [
      ['Valor', extrairValoresMonetarios(d.texto)],
      ['Data', extrairDatas(d.texto)],
      ['Nº de processo', extrairNumerosProcesso(d.texto)],
      ['CEP', extrairCEPs(d.texto)]
    ];
    tipos.forEach(([tipo, itens]) => itens.forEach(it => {
      const pos = d.texto.indexOf(it.valor);
      linhas.push({ doc: d.nome, pagina: pos >= 0 ? _paginaNaPosicao(d.texto, pos) : null, tipo, valor: it.valor, trecho: it.contexto || '' });
    }));
  });
  return linhas;
}

// Estado da tabela personalizada — vive enquanto o modal está aberto.
// Os VALORES nunca são editáveis aqui (vêm da extração por código); o que a pessoa
// ajusta é recorte, colunas, título e as observações que ela mesma escreve.
const COLUNAS_TABELA = [
  { id: 'doc', nome: 'Documento' },
  { id: 'pagina', nome: 'Pág.' },
  { id: 'tipo', nome: 'Tipo' },
  { id: 'valor', nome: 'Valor' },
  { id: 'trecho', nome: 'Trecho' },
  { id: 'obs', nome: 'Observação' }
];

function _htmlTabelaDados(linhas, cfg) {
  const th = 'style="border:1px solid #999; padding:4px 8px; background:#eee; text-align:left;"';
  const td = 'style="border:1px solid #999; padding:4px 8px; vertical-align:top;"';
  const cols = COLUNAS_TABELA.filter(c => cfg.colunas[c.id]);
  const celula = (l, c) => {
    if (c.id === 'valor') return `<strong>${escHtml(l.valor)}</strong>`;
    if (c.id === 'pagina') return escHtml(l.pagina || '—');
    return escHtml(l[c.id] || '');
  };
  const titulo = cfg.titulo.trim() ? `<p style="font-weight:bold; margin:0 0 6px 0;">${escHtml(cfg.titulo.trim())}</p>` : '';
  const rodape = cfg.rodape
    ? `<p style="font-size:0.75em; color:#555; margin:4px 0 0 0;">Fonte: dados extraídos dos documentos do processo SEI ${escHtml(processoAtual?.numero_sei || '')}, com indicação de documento e página.</p>` : '';
  return `${titulo}<table style="border-collapse:collapse; font-size:0.8rem; width:100%;">
    <tr>${cols.map(c => `<th ${th}>${c.nome}</th>`).join('')}</tr>
    ${linhas.map(l => `<tr>${cols.map(c => `<td ${td}>${celula(l, c)}</td>`).join('')}</tr>`).join('')}
  </table>${rodape}`;
}

function abrirTabelaDadosProcesso() {
  if (!textoIntegralAtual || textoIntegralAtual.trim().length < 20) return alert('Importe os documentos do processo primeiro.');
  const linhas = montarLinhasTabelaDados().map((l, i) => ({ ...l, id: i, incluida: true, obs: '' }));
  const docs = [...new Set(linhas.map(l => l.doc))];
  window._tab = {
    linhas,
    cfg: {
      titulo: '', busca: '', rodape: true,
      colunas: { doc: true, pagina: true, tipo: true, valor: true, trecho: false, obs: false },
      tipos: { 'Valor': true, 'Data': true, 'Nº de processo': false, 'CEP': false },
      docs: Object.fromEntries(docs.map(d => [d, true]))
    }
  };
  const chk = (grupo, chave, rotulo, marcado) =>
    `<label style="display:inline-flex; align-items:center; gap:4px; margin:0 10px 4px 0; font-size:0.78rem; cursor:pointer;">
      <input type="checkbox" ${marcado ? 'checked' : ''} onchange="_tab.cfg.${grupo}[${JSON.stringify(chave).replace(/"/g, '&quot;')}]=this.checked; _atualizarTabelaDados()"> ${escHtml(rotulo)}</label>`;
  const cfg = window._tab.cfg;
  criarModal(`
    <h2 style="margin-bottom:6px; font-size:1.15rem;">Tabela de dados do processo</h2>
    <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px;">Os números vêm direto dos documentos e não podem ser editados aqui. Você escolhe o que entra, as colunas, o título, e pode escrever observações.</p>

    <div style="background:#f8f9fa; border:1px solid #dee2e6; border-radius:6px; padding:10px 12px; margin-bottom:10px;">
      <input type="text" placeholder="Título da tabela (opcional) — ex.: Valores contratuais por documento" oninput="_tab.cfg.titulo=this.value; _atualizarTabelaDados()" style="width:100%; padding:6px 8px; border:1px solid #ced4da; border-radius:6px; margin-bottom:8px;">
      <input type="text" placeholder="Buscar nos trechos (ex.: consultas, aditivo, meta)" oninput="_tab.cfg.busca=this.value; _atualizarTabelaDados()" style="width:100%; padding:6px 8px; border:1px solid #ced4da; border-radius:6px; margin-bottom:8px;">
      <div style="font-size:0.75rem; font-weight:600; margin-bottom:2px;">Tipos de dado</div>
      <div>${Object.keys(cfg.tipos).map(t => chk('tipos', t, t, cfg.tipos[t])).join('')}</div>
      <div style="font-size:0.75rem; font-weight:600; margin:6px 0 2px;">Colunas</div>
      <div>${COLUNAS_TABELA.map(c => chk('colunas', c.id, c.nome, cfg.colunas[c.id])).join('')}</div>
      <div style="font-size:0.75rem; font-weight:600; margin:6px 0 2px;">Documentos</div>
      <div style="max-height:70px; overflow:auto;">${Object.keys(cfg.docs).map(d => chk('docs', d, d, true)).join('')}</div>
      <label style="display:inline-flex; align-items:center; gap:4px; margin-top:6px; font-size:0.78rem; cursor:pointer;">
        <input type="checkbox" checked onchange="_tab.cfg.rodape=this.checked"> Incluir linha de fonte no rodapé</label>
    </div>

    <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px; flex-wrap:wrap;">
      <button class="btn btn-primary btn-sm" onclick="copiarTabelaDados()"><i class="ti ti-copy"></i> Copiar tabela</button>
      <span id="contagem-tabela-dados" style="font-size:0.78rem; color:var(--text-muted);"></span>
      <span id="status-copia-tabela" style="font-size:0.78rem;"></span>
    </div>
    <div id="area-tabela-dados" style="max-height:40vh; overflow:auto;"></div>`);
  _atualizarTabelaDados();
}

// Linhas que passam nos filtros (tipo, documento, busca). A caixinha de cada linha
// decide se ela entra na tabela copiada.
function _linhasVisiveis() {
  const { linhas, cfg } = window._tab;
  const busca = cfg.busca.trim().toLowerCase();
  return linhas.filter(l => cfg.tipos[l.tipo] && cfg.docs[l.doc]
    && (!busca || (l.trecho + ' ' + l.valor + ' ' + l.doc).toLowerCase().includes(busca)));
}

function _atualizarTabelaDados() {
  const area = document.getElementById('area-tabela-dados');
  if (!area) return;
  const { cfg } = window._tab;
  const visiveis = _linhasVisiveis();
  const incluidas = visiveis.filter(l => l.incluida).length;
  document.getElementById('contagem-tabela-dados').textContent = `${incluidas} de ${visiveis.length} linha(s) selecionada(s)`;
  if (!visiveis.length) { area.innerHTML = '<p class="text-muted">Nenhum dado com esses filtros.</p>'; return; }

  const cols = COLUNAS_TABELA.filter(c => cfg.colunas[c.id]);
  const th = 'style="border:1px solid #ccc; padding:4px 6px; background:#eee; text-align:left; font-size:0.75rem;"';
  const td = 'style="border:1px solid #ccc; padding:4px 6px; vertical-align:top; font-size:0.78rem;"';
  area.innerHTML = `<table style="border-collapse:collapse; width:100%;">
    <tr><th ${th}>Incluir</th>${cols.map(c => `<th ${th}>${c.nome}</th>`).join('')}</tr>
    ${visiveis.map(l => `<tr style="${l.incluida ? '' : 'opacity:0.4;'}">
      <td ${td}><input type="checkbox" ${l.incluida ? 'checked' : ''} onchange="_tab.linhas[${l.id}].incluida=this.checked; _atualizarTabelaDados()"></td>
      ${cols.map(c => c.id === 'obs'
        ? `<td ${td}><input type="text" value="${escHtml(l.obs)}" placeholder="Sua observação" oninput="_tab.linhas[${l.id}].obs=this.value" style="width:100%; min-width:120px; padding:3px; border:1px solid #ced4da; border-radius:4px; font-size:0.78rem;"></td>`
        : `<td ${td}>${c.id === 'valor' ? '<strong>' + escHtml(l.valor) + '</strong>' : escHtml(c.id === 'pagina' ? (l.pagina || '—') : (l[c.id] || ''))}</td>`).join('')}
    </tr>`).join('')}
  </table>`;
}

// Copia como HTML (mantém a tabela ao colar no Word/SEI) e como texto separado por
// tabulação (fallback pra onde não aceitar HTML). Só as linhas marcadas.
async function copiarTabelaDados() {
  const { cfg } = window._tab;
  const linhas = _linhasVisiveis().filter(l => l.incluida);
  const status = document.getElementById('status-copia-tabela');
  if (!linhas.length) { status.innerHTML = '<span style="color:#c92a2a;">Nenhuma linha selecionada.</span>'; return; }
  const cols = COLUNAS_TABELA.filter(c => cfg.colunas[c.id]);
  const html = _htmlTabelaDados(linhas, cfg);
  const texto = [
    cfg.titulo.trim(),
    cols.map(c => c.nome).join('\t'),
    ...linhas.map(l => cols.map(c => c.id === 'pagina' ? (l.pagina || '—') : (l[c.id] || '')).join('\t'))
  ].filter(Boolean).join('\n');
  try {
    if (window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([texto], { type: 'text/plain' })
      })]);
    } else {
      await navigator.clipboard.writeText(texto);
    }
    status.innerHTML = '<span style="color:#2b8a3e;"><i class="ti ti-check"></i> Copiada — cole no documento.</span>';
  } catch (e) {
    status.innerHTML = `<span style="color:#c92a2a;">Não foi possível copiar: ${escHtml(e.message)}</span>`;
  }
}

// ==================== VERSÃO ASSINADA (volta do SEI) ====================
// Depois de assinar no SEI, a pessoa importa o documento oficial de volta. É ELE que
// compõe o banco de dados — o rascunho revisado aqui pode ter mudado antes da assinatura.
let _origemVersaoAssinada = 'processo';

function modalImportarVersaoAssinada(origem) {
  _origemVersaoAssinada = origem || 'processo';
  criarModal(`
    <h2 style="margin-bottom:8px; font-size:1.15rem;">Importar versão assinada (SEI)</h2>
    <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:14px;">Depois de assinar no SEI, exporte o documento (o SEI gera .html ou .pdf) e importe aqui. Ele fica marcado como a versão oficial deste processo.</p>
    <input type="file" id="arquivo-versao-assinada" accept=".html,.htm,.pdf,.docx,.doc" onchange="processarVersaoAssinada(this.files[0])">
    <div id="status-versao-assinada" style="margin-top:12px;"></div>`);
}

async function processarVersaoAssinada(file) {
  if (!file) return;
  const status = document.getElementById('status-versao-assinada');
  status.innerHTML = '<span class="spinner"></span> Lendo o documento assinado...';
  try {
    const buf = await file.arrayBuffer();
    const texto = await extrairTextoArquivo(file.name, buf, (msg) => { status.innerHTML = `<span class="spinner"></span> ${escHtml(msg)}`; });
    if (!texto.trim().length) throw new Error('Nenhum texto foi extraído desse arquivo.');
    const sensiveis = detectarSensiveisDoArquivo(texto, file.name);
    await salvarDocumentoNoBackend(file.name, texto, sensiveis, 'FINAL_ASSINADO');
    status.innerHTML = '<div class="alert alert-success" style="background:#d1e7dd; color:#0f5132; padding:10px; border-radius:6px;">✓ Versão assinada registrada neste processo.</div>';
    setTimeout(() => {
      fecharModal();
      if (_origemVersaoAssinada === 'registro') abrirRegistroConcluido(processoAtual.id);
      else abrirProcesso(processoAtual.numero_sei || String(processoAtual.id));
    }, 1500);
  } catch (e) {
    status.innerHTML = `<div class="alert alert-danger">Não foi possível importar: ${escHtml(e.message)}</div>`;
  }
}

// ==================== CRIAR DOCUMENTO (aguardando modelos padrão) ====================
// O botão já existe; os modelos (nota técnica, parecer, minuta, ofício) serão montados a
// partir de exemplos reais já assinados pela equipe, quando forem catalogados.
function abrirCriarDocumento() {
  criarModal(`
    <h2 style="margin-bottom:8px; font-size:1.15rem;">Criar documento</h2>
    <p style="font-size:0.88rem; line-height:1.6;">Descreva o que precisa no card 2 (Pergunte ao Processo). O sistema confirma o tipo e os temas e monta o rascunho no card 3, já preenchido com o que foi lido dos documentos.</p>
    <p style="font-size:0.85rem; line-height:1.6; color:var(--text-muted);">Exemplo: “${escHtml(EXEMPLO_PEDIDO_REDACAO)}”</p>
    <button class="btn btn-primary btn-sm" onclick="usarExemploPedido()"><i class="ti ti-pencil"></i> Usar este exemplo no card 2</button>`);
}

// Identidade de um documento do SEI: o número que vem no nome do arquivo (ex.: 93592445 em
// "[28]-93592445_GOVPE___Parecer_Tecnico_272.html"). O "[28]" é só a posição na árvore.
function _chaveDoDocumento(nome) {
  const n = String(nome || '');
  const sei = n.match(/(?:^|[^\d])(\d{6,})(?=[_\-. ]|$)/);
  if (sei) return 'sei:' + sei[1];
  return 'nome:' + n.replace(/^\s*\[\d+\]\s*-?\s*/, '').replace(/\.[a-z0-9]{2,5}$/i, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}
function _documentosJaIntegrados() {
  return new Set((window._docsDoProcesso || []).map(d => _chaveDoDocumento(d.nome_arquivo)));
}

function modalUploadZIP() {
  criarModal(`
    <h2 style="margin-bottom:6px; font-size:1.2rem;">Adicionar arquivos ao processo</h2>
    <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:12px; line-height:1.5;">
      Os arquivos novos se juntam aos ${(window._docsDoProcesso || []).length} já integrados, e a checagem considera todos. Pode trazer em quantos lotes quiser:
      o que já está no processo (mesmo número SEI) é pulado, sem duplicar. Ao terminar, a checagem roda sozinha.</p>
    <div class="dropzone" id="dz-upload"
         ondragover="event.preventDefault(); this.style.borderColor='var(--action-amber)'; this.style.backgroundColor='#fff3cd';"
         ondragleave="event.preventDefault(); this.style.borderColor='#ced4da'; this.style.backgroundColor='#f8f9fa';"
         ondrop="event.preventDefault(); this.style.borderColor='#ced4da'; this.style.backgroundColor='#f8f9fa'; document.getElementById('file-up').files = event.dataTransfer.files; processarUploadZIP(event.dataTransfer.files);"
         onclick="document.getElementById('file-up').click()">
      <i class="ti ti-cloud-download" style="font-size:2.5rem; margin-bottom:10px; color:var(--action-primary);"></i><br>
      <strong>Arraste um ou mais arquivos aqui</strong><br>
      <span style="font-size:0.85rem;">ZIP, PDF, DOCX, XLSX, TXT, CSV, MD, PPTX, HTML (despacho SEI GOV), PNG ou JPG — pode soltar vários juntos, sem precisar zipar antes. Foto de documento/página escaneada é lida por OCR (mais lento).</span>
    </div>
    <input type="file" id="file-up" multiple style="display:none" onchange="processarUploadZIP(this.files)">
    <div id="up-status" style="margin-top:15px;"></div>
    <div id="up-progresso-lista" style="margin-top:10px; font-size:0.8rem;"></div>
  `);
}

async function salvarDocumentoNoBackend(nomeArquivo, texto, sensiveis, tipoDocumento) {
  const res = await api('documentos/adicionar-completo', {
    processo_id: processoAtual.id, nome_arquivo: nomeArquivo, texto, adicionado_por: usuarioAtual.email,
    resumo_sensiveis: sensiveis && sensiveis.length ? JSON.stringify(sensiveis) : '',
    tipo_documento: tipoDocumento || ''
  });
  if (!res.ok) throw new Error('Falha ao salvar documento: ' + res.erro);
}

const EXTENSOES_SUPORTADAS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt', '.csv', '.md', '.pptx', '.ppt', '.png', '.jpg', '.jpeg', '.html', '.htm'];

// ==================== OCR (leitura de imagem/PDF escaneado) ====================
// Usa Tesseract.js — roda no navegador, sem precisar de servidor. É lento (alguns
// segundos por página), então só entra como PLANO B: pra imagem solta (.png/.jpg), é
// o único jeito de ler; pra página de PDF, só roda quando a extração normal de texto
// não encontrou quase nada (indício de página escaneada/foto, não texto real).
async function ocrImagem(fonte) {
  if (typeof Tesseract === 'undefined') throw new Error('Biblioteca de OCR (Tesseract.js) não carregada no index.html — necessária pra ler imagem ou PDF escaneado.');
  const resultado = await Tesseract.recognize(fonte, 'por');
  return (resultado?.data?.text) || '';
}

async function extrairTextoArquivo(nomeArquivo, buf, onProgresso) {
  const nome = nomeArquivo.toLowerCase();
  if (nome.endsWith('.pdf')) return extrairTextoPDF(buf, onProgresso);
  if (nome.endsWith('.docx') || nome.endsWith('.doc')) {
    if (typeof mammoth === 'undefined') throw new Error('Biblioteca de leitura de Word (mammoth) não carregada no index.html.');
    const resultado = await mammoth.extractRawText({ arrayBuffer: buf });
    return resultado.value || '';
  }
  if (nome.endsWith('.xlsx') || nome.endsWith('.xls')) {
    if (typeof XLSX === 'undefined') throw new Error('Biblioteca de leitura de Excel (SheetJS/XLSX) não carregada no index.html.');
    const wb = XLSX.read(buf, { type: 'array' });
    return wb.SheetNames.map(nomeAba => `--- Planilha: ${nomeAba} ---\n` + XLSX.utils.sheet_to_csv(wb.Sheets[nomeAba])).join('\n\n');
  }
  if (nome.endsWith('.txt') || nome.endsWith('.csv') || nome.endsWith('.md')) {
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
  }
  // Despacho exportado direto do SEI GOV vem em .html — usa o interpretador de HTML
  // nativo do navegador (DOMParser) pra tirar só o texto legível, sem tag nenhuma
  // sobrando no meio (senão a IA ficaria lendo "<div>" e "<span>" junto do conteúdo).
  if (nome.endsWith('.html') || nome.endsWith('.htm')) {
    const htmlBruto = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    if (typeof DOMParser === 'undefined') throw new Error('Leitor de HTML não disponível neste navegador.');
    const doc = new DOMParser().parseFromString(htmlBruto, 'text/html');
    const texto = (doc.body?.textContent || '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    if (!texto.length) throw new Error('Nenhum texto legível encontrado nesse HTML.');
    return texto;
  }
  // Imagem solta (foto de documento, print de tela) — só dá pra ler via OCR, não tem
  // texto embutido nenhum pra extrair.
  if (nome.endsWith('.png') || nome.endsWith('.jpg') || nome.endsWith('.jpeg')) {
    if (onProgresso) onProgresso('Lendo imagem via OCR (pode levar alguns segundos)...');
    const mime = nome.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const blob = new Blob([buf], { type: mime });
    const texto = await ocrImagem(blob);
    if (!texto.trim().length) throw new Error('OCR não encontrou nenhum texto legível nessa imagem.');
    return texto;
  }
  if (nome.endsWith('.pptx')) {
    if (typeof JSZip === 'undefined') throw new Error('Biblioteca JSZip não carregada — necessária pra abrir .pptx.');
    const zip = await JSZip.loadAsync(buf);
    const slideFiles = Object.keys(zip.files)
      .filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort((a, b) => parseInt(a.match(/slide(\d+)\.xml/)[1], 10) - parseInt(b.match(/slide(\d+)\.xml/)[1], 10));
    if (!slideFiles.length) throw new Error('Não foi possível encontrar slides dentro do arquivo.');
    let textoCompleto = '';
    for (let i = 0; i < slideFiles.length; i++) {
      const xml = await zip.files[slideFiles[i]].async('string');
      const textos = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => _decodeXmlEntities(m[1]));
      textoCompleto += `\n--- Slide ${i + 1} ---\n` + textos.join(' ') + '\n';
    }
    return textoCompleto;
  }
  if (nome.endsWith('.ppt')) {
    throw new Error('Formato antigo do PowerPoint (.ppt) não tem suporte — salve como .pptx.');
  }
  throw new Error('Tipo de arquivo não suportado.');
}

function _decodeXmlEntities(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// Abre um .zip e extrai texto de cada arquivo suportado dentro dele — reutilizada tanto
// no upload de arquivos dentro de um processo já criado quanto no pré-preenchimento da
// tela "Importar Processo" (antes, só o primeiro sabia abrir ZIP; os dois divergiam e foi
// exatamente isso que quebrou ao soltar um ZIP na tela de importar processo).
async function abrirZipEExtrairArquivos(file, onProgresso) {
  const resultado = { arquivos: [], avisos: [] };
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);
  const todosArquivos = Object.keys(contents.files).filter(k => !contents.files[k].dir);
  const arquivosSuportados = todosArquivos.filter(k => EXTENSOES_SUPORTADAS.some(ext => k.toLowerCase().endsWith(ext)));
  const arquivosIgnorados = todosArquivos.filter(k => !arquivosSuportados.includes(k));

  for (const filename of arquivosSuportados) {
    if (onProgresso) onProgresso(filename);
    try {
      const buf = await contents.files[filename].async('arraybuffer');
      const texto = await extrairTextoArquivo(filename, buf, (msg) => { if (onProgresso) onProgresso(`${filename} — ${msg}`); });
      if (texto.trim().length > 20) {
        const sensiveis = detectarSensiveisDoArquivo(texto, filename);
        resultado.arquivos.push({ nome: filename, texto, sensiveis });
      } else {
        resultado.avisos.push(`${filename}: nenhum texto extraído — NÃO importado`);
      }
    } catch (e) { resultado.avisos.push(`${filename}: ${e.message}`); }
  }
  arquivosIgnorados.forEach(f => resultado.avisos.push(`${f}: tipo não suportado — NÃO importado`));
  return resultado;
}

// Uma linha da lista progressiva de importação — mostra o que já foi coberto nesse
// arquivo específico, sem esperar o restante do lote terminar.
function _linhaProgressoArquivo(nome, sensiveis) {
  const resumo = sensiveis && sensiveis.length
    ? `${sensiveis.length} dado(s) sensível(is): ` + sensiveis.map(s => `${s.tipo}${s.pagina ? ' pág.' + s.pagina : ''}`).join(', ')
    : 'nenhum dado sensível detectado';
  return `<div style="margin-bottom:3px;">☑ <strong>${escHtml(nome)}</strong> — concluído (${escHtml(resumo)})</div>`;
}

async function processarUploadZIP(files) {
  const status = document.getElementById('up-status');
  const listaProgresso = document.getElementById('up-progresso-lista');
  if (listaProgresso) listaProgresso.innerHTML = '';
  const listaArquivos = Array.from(files || []);
  if (!listaArquivos.length) return;
  const avisos = [];
  let importados = 0, jaExistiam = 0;
  const integrados = _documentosJaIntegrados();
  const _eNovo = nome => {
    const k = _chaveDoDocumento(nome);
    if (integrados.has(k)) { jaExistiam++; return false; }
    integrados.add(k);
    return true;
  };
  for (const file of listaArquivos) {
    const nomeLower = file.name.toLowerCase();
    if (nomeLower.endsWith('.zip')) {
      status.innerHTML = `<span class="spinner"></span> Mapeando ${escHtml(file.name)}...`;
      try {
        const { arquivos, avisos: avisosZip } = await abrirZipEExtrairArquivos(file, (nome) => {
          status.innerHTML = `<span class="spinner"></span> Processando ${escHtml(nome.substring(0, 70))}...`;
        });
        for (const a of arquivos) {
          if (!_eNovo(a.nome)) continue;
          try {
            await salvarDocumentoNoBackend(a.nome, a.texto, a.sensiveis);
            importados++;
            if (listaProgresso) listaProgresso.insertAdjacentHTML('beforeend', _linhaProgressoArquivo(a.nome, a.sensiveis));
          } catch (e) { avisos.push(`${a.nome}: ${e.message}`); }
        }
        avisos.push(...avisosZip);
      } catch (e) {
        avisos.push(`${file.name}: não foi possível abrir o ZIP (${e.message})`);
      }
    } else if (EXTENSOES_SUPORTADAS.some(ext => nomeLower.endsWith(ext))) {
      if (!_eNovo(file.name)) continue;
      status.innerHTML = `<span class="spinner"></span> Extraindo texto de ${escHtml(file.name)}...`;
      try {
        const buf = await file.arrayBuffer();
        const texto = await extrairTextoArquivo(file.name, buf, (msg) => { status.innerHTML = `<span class="spinner"></span> ${escHtml(msg)}`; });
        if (!texto.trim().length) throw new Error('nenhum texto extraído');
        const sensiveis = detectarSensiveisDoArquivo(texto, file.name);
        await salvarDocumentoNoBackend(file.name, texto, sensiveis);
        importados++;
        if (listaProgresso) listaProgresso.insertAdjacentHTML('beforeend', _linhaProgressoArquivo(file.name, sensiveis));
      } catch (e) {
        avisos.push(`${file.name}: ${e.message}`);
      }
    } else {
      avisos.push(`${file.name}: tipo não suportado — NÃO importado`);
    }
  }
  _guardarFalhasImportacao(avisos);
  const repetidosTxt = jaExistiam ? ` ${jaExistiam} já estava(m) no processo e foi(ram) pulado(s).` : '';
  status.innerHTML = avisos.length
    ? `<div class="alert alert-warning"><strong>${importados} novo(s) importado(s), ${avisos.length} aviso(s):</strong>${repetidosTxt}<br>${avisos.map(escHtml).join('<br>')}</div>`
    : `<div class="alert alert-success" style="background:#d1e7dd; color:#0f5132; padding:10px; border-radius:6px;">✓ ${importados} documento(s) novo(s) importado(s).${repetidosTxt}${importados ? ' A checagem vai rodar sozinha.' : ''}</div>`;
  if (importados > 0) window._autoChecagemPendente = true;
  setTimeout(() => { fecharModal(); abrirProcesso(processoAtual.numero_sei || String(processoAtual.id)); }, (avisos.length || jaExistiam) ? 4500 : 1800);
}

async function extrairTextoPDF(buf, onProgresso) {
  if (typeof pdfjsLib === 'undefined') return '';
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let txt = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    let textoPagina = _reconstruirLinhasPDF(content.items);

    // Página sem texto extraível de verdade — indício forte de página escaneada/foto,
    // não texto real. Tenta OCR como plano B (mais lento, por isso só entra aqui).
    if (textoPagina.trim().length < 15) {
      try {
        if (onProgresso) onProgresso(`Página ${i}/${pdf.numPages} sem texto — lendo via OCR (pode ser lento)...`);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        const textoOcr = await ocrImagem(canvas);
        if (textoOcr.trim().length > textoPagina.trim().length) textoPagina = '[leitura por OCR]\n' + textoOcr;
      } catch (e) {
        console.warn(`OCR falhou na página ${i}:`, e.message);
      }
    }

    // Marcador de página — não usa o mesmo formato "--- DOC: ... ---" (usado para separar
    // documentos) de propósito, pra dividirPorDocumento() continuar funcionando sem confundir
    // "página" com "documento". Serve pra localizar onde um dado mascarado apareceu.
    txt += `\n--- PÁGINA ${i} ---\n` + textoPagina + '\n';
  }
  return txt;
}

function _reconstruirLinhasPDF(items) {
  if (!items.length) return '';
  const TOLERANCIA_Y = 2;
  const linhas = [];
  items.forEach(item => {
    const y = item.transform ? item.transform[5] : 0;
    const x = item.transform ? item.transform[4] : 0;
    let linha = linhas.find(l => Math.abs(l.y - y) <= TOLERANCIA_Y);
    if (!linha) { linha = { y, itens: [] }; linhas.push(linha); }
    linha.itens.push({ x, str: item.str });
  });
  linhas.sort((a, b) => b.y - a.y);
  return linhas.map(l => l.itens.sort((a, b) => a.x - b.x).map(it => it.str).join(' ')).join('\n');
}

// ==================== GEMINI PREMIUM & MASCARAMENTO ====================
const GEMINI_TIMEOUT_MS = 60000;

async function invocarGeminiPremium(prompt, isChat = false, statusEl = null) {
  if (!GEMINI_KEY || GEMINI_KEY.trim() === '') throw new Error("Chave da IA não configurada.");
  const NOME_MODELO = 'gemini-3.6-flash';
  let genConfig = { temperature: 0.1 };
  if (!isChat) genConfig.responseMimeType = "application/json";
  const MAX_TENTATIVAS = 3;
  const ESPERAS_MS = [2000, 5000, 10000];
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);
    let resposta;
    try {
      resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${NOME_MODELO}:generateContent?key=${GEMINI_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: genConfig }),
        signal: controller.signal
      });
    } catch (e) {
      clearTimeout(timer);
      if (e.name === 'AbortError') throw new Error(`O Gemini não respondeu em ${GEMINI_TIMEOUT_MS / 1000}s.`);
      throw new Error('Falha de rede ao chamar o Gemini: ' + e.message);
    }
    clearTimeout(timer);
    if ((resposta.status === 503 || resposta.status === 429) && tentativa < MAX_TENTATIVAS) {
      const espera = ESPERAS_MS[tentativa - 1];
      if (statusEl) statusEl.innerHTML = `<span class="spinner"></span> Google sobrecarregado — tentando de novo em ${espera / 1000}s...`;
      await new Promise(r => setTimeout(r, espera));
      continue;
    }
    if (!resposta.ok) throw new Error(`Erro na API do Google (HTTP ${resposta.status}):\n${await resposta.text()}`);
    const resJson = await resposta.json();
    const candidato = resJson.candidates?.[0];
    if (!candidato || !candidato.content?.parts?.length) {
      throw new Error('O Gemini não retornou uma resposta válida.');
    }
    let txt = candidato.content.parts.map(pt => pt.text || '').join('');
    return isChat ? txt : txt.replace(/```json/g, '').replace(/```/g, '').trim();
  }
  throw new Error('O Google continuou sobrecarregado.');
}

const PROVEDOR_TIMEOUT_MS = 60000;
// Metadados de cada provedor — usado tanto pra montar o painel visual quanto pro motor
// de fallback. A ORDEM em que tenta é ORDEM_PROVEDORES_IDS (configurável), não esta lista.
const PROVEDORES_INFO = {
  gemini:     { nome: 'Gemini',     temChave: () => !!GEMINI_KEY && GEMINI_ATIVO,         invocar: invocarGeminiPremium },
  groq:       { nome: 'Groq',       temChave: () => !!GROQ_KEY && GROQ_ATIVO,             invocar: invocarGroq },
  kimi:       { nome: 'Kimi',       temChave: () => !!KIMI_KEY && KIMI_ATIVO,             invocar: invocarKimi },
  openrouter: { nome: 'OpenRouter', temChave: () => !!OPENROUTER_KEY && OPENROUTER_ATIVO, invocar: invocarOpenRouter },
  deepseek:   { nome: 'DeepSeek',   temChave: () => !!DEEPSEEK_KEY && DEEPSEEK_ATIVO,     invocar: invocarDeepSeek },
  ollama:     { nome: 'Ollama',     temChave: () => OLLAMA_ATIVO,                         invocar: invocarOllama }
};

function renderPainelProvedores(statusEl, estados, mensagem) {
  if (!statusEl) return;
  const cores = {
    pendente: { bg: '#f1f3f5', cor: '#868e96' },
    tentando: { bg: '#e7f5ff', cor: '#1c7ed6' },
    ok:        { bg: '#ebfbee', cor: '#2b8a3e' },
    falhou:    { bg: '#fff5f5', cor: '#c92a2a' },
    pulado:    { bg: '#f8f9fa', cor: '#adb5bd' }
  };
  const icones = { pendente: 'ti-minus', ok: 'ti-check', falhou: 'ti-x', pulado: 'ti-slash' };
  const pills = ORDEM_PROVEDORES_IDS.map(id => {
    const info = PROVEDORES_INFO[id];
    if (!info) return '';
    const estado = estados[id] || 'pendente';
    const c = cores[estado];
    const iconeHtml = estado === 'tentando'
      ? '<span class="spinner" style="width:11px;height:11px;border-width:2px;margin:0;"></span>'
      : `<i class="ti ${icones[estado]}"></i>`;
    return `<span style="display:inline-flex; align-items:center; gap:5px; background:${c.bg}; color:${c.cor}; padding:4px 10px; border-radius:20px; font-size:0.78rem; font-weight:600;">${iconeHtml} ${info.nome}</span>`;
  }).join('');
  statusEl.innerHTML = `
    <div style="display:flex; gap:8px; margin-bottom:8px; flex-wrap:wrap;">${pills}</div>
    ${mensagem ? `<div style="font-size:0.82rem; color:var(--text-muted);">${escHtml(mensagem)}</div>` : ''}`;
}

// Acha, dentro do texto ANTES de um dado ponto, o último "--- DOC: nome ---" e o último
// "--- PÁGINA N ---" que apareceram — é assim que sabemos de qual documento/página um
// dado mascarado veio, sem precisar mudar a estrutura do texto que já existia.
function _localizarOrigem(textoAntes) {
  const docMatches = [...textoAntes.matchAll(/--- DOC: (.+?) ---/g)];
  const pagMatches = [...textoAntes.matchAll(/--- PÁGINA (\d+) ---/g)];
  return {
    doc: docMatches.length ? docMatches[docMatches.length - 1][1].trim() : null,
    pagina: pagMatches.length ? pagMatches[pagMatches.length - 1][1] : null
  };
}

// Duas camadas: 1) bloco de qualificação (nome+CPF+RG juntos, achado por frase-âncora
// de contrato); 2) regex de formato conhecido pro que sobrar fora dos blocos.
// "detalhes" (novo) guarda, pra cada item mascarado, tipo + de onde veio — é o que
// alimenta o painel visual "O que foi mascarado" mostrado depois da Checagem/Revisão.
function mascararBlocosQualificacao(texto) {
  const mapa = new Map();
  const detalhes = [];
  let contador = 0;
  const LIMITE_CAPTURA = 220;
  const ancoras = [
    /neste\s+ato\s+representad[oa]\s+por/gi,
    /representad[oa]\s+neste\s+ato\s+por/gi,
    /por\s+seu[a]?\s+representante\s+legal[,:]?/gi
  ];
  let textoComBlocosMascarados = texto;
  ancoras.forEach(ancora => {
    textoComBlocosMascarados = textoComBlocosMascarados.replace(ancora, (match, offset, textoCompleto) => {
      const inicioResto = offset + match.length;
      const resto = textoCompleto.substring(inicioResto, inicioResto + LIMITE_CAPTURA);
      const pontoFinal = resto.search(/[.;]\s/);
      const trechoCapturado = pontoFinal >= 0 ? resto.substring(0, pontoFinal) : resto;
      contador++;
      const marcador = `[QUALIFICACAO-${contador}]`;
      const origem = _localizarOrigem(textoCompleto.substring(0, offset));
      mapa.set(marcador, match + trechoCapturado);
      detalhes.push({ tipo: 'QUALIFICACAO', marcador, doc: origem.doc, pagina: origem.pagina });
      return marcador;
    });
  });
  for (const [marcador, textoOriginalCompleto] of mapa) {
    const matchAncora = textoOriginalCompleto.match(/^(neste\s+ato\s+representad[oa]\s+por|representad[oa]\s+neste\s+ato\s+por|por\s+seu[a]?\s+representante\s+legal[,:]?)/i);
    if (!matchAncora) continue;
    const ancoraOriginal = matchAncora[0];
    const trechoCapturado = textoOriginalCompleto.substring(ancoraOriginal.length);
    if (trechoCapturado) {
      textoComBlocosMascarados = textoComBlocosMascarados.replace(marcador + trechoCapturado, marcador);
    }
    mapa.set(marcador, trechoCapturado.replace(/^,?\s*/, '').trim() || ancoraOriginal.trim());
  }
  return { textoComBlocosMascarados, mapaBlocos: mapa, detalhesBlocos: detalhes };
}

function mascararDadosSensiveis(texto) {
  const mapa = new Map();
  const detalhes = [];
  const contador = { CPF: 0, RG: 0, EMAIL: 0, TELEFONE: 0, BANCARIO: 0 };
  const { textoComBlocosMascarados, mapaBlocos, detalhesBlocos } = mascararBlocosQualificacao(texto);
  let textoMascarado = textoComBlocosMascarados;
  for (const [marcador, original] of mapaBlocos) mapa.set(marcador, original);
  detalhes.push(...detalhesBlocos);

  function substituir(regex, tipo) {
    const marcadorPorValor = new Map();
    textoMascarado = textoMascarado.replace(regex, (match, ...args) => {
      // Os últimos 2 argumentos do replace são sempre (offset, textoCompleto) —
      // pega-os pela posição a partir do fim, já que args também inclui grupos de captura.
      const offset = args[args.length - 2];
      const textoCompleto = args[args.length - 1];
      if (marcadorPorValor.has(match)) return marcadorPorValor.get(match);
      contador[tipo]++;
      const marcador = `[${tipo}-${contador[tipo]}]`;
      const origem = _localizarOrigem(textoCompleto.substring(0, offset));
      marcadorPorValor.set(match, marcador);
      mapa.set(marcador, match);
      detalhes.push({ tipo, marcador, doc: origem.doc, pagina: origem.pagina });
      return marcador;
    });
  }
  // Ordem importa: CPF (com pontuação) primeiro, pra não ser "roubado" pela regex
  // mais genérica de telefone antes de ter a chance de casar.
  substituir(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, 'CPF');
  substituir(/\b\d{1,2}\.\d{3}\.\d{3}-[\dxX]\b/g, 'RG');
  substituir(/[\w.+-]+@[\w-]+\.[\w.-]+/g, 'EMAIL');
  substituir(/\(\d{2}\)\s?9?\d{4}-?\d{4}\b/g, 'TELEFONE');
  substituir(/\b(?:ag[êe]ncia|conta corrente|c\/c)\s*:?\s*\d{3,10}-?\d?\b/gi, 'BANCARIO');
  return { textoMascarado, mapa, totalMascarado: mapa.size, detalhes };
}

// Detecta dados sensíveis num arquivo recém-lido, ANTES mesmo de existir Checagem —
// reaproveita o mesmo motor de mascararDadosSensiveis (mesmos padrões, mesma forma de
// achar página) só que aqui é puramente informativo: não mascara nada, só lista o que
// tem, pra já aparecer na importação em vez de só depois que a Checagem rodar.
function detectarSensiveisDoArquivo(texto, nomeArquivo) {
  const { detalhes } = mascararDadosSensiveis(texto);
  return detalhes.map(d => ({ tipo: d.tipo, doc: nomeArquivo, pagina: d.pagina }));
}

function desmascararTexto(texto, mapa) {
  if (!mapa || !mapa.size) return texto;
  let resultado = texto;
  for (const [marcador, original] of mapa) resultado = resultado.split(marcador).join(original);
  return resultado;
}

// Monta o HTML do painel "O que foi mascarado" — chamado depois de qualquer chamada de
// IA que tenha mascarado algo, pra nunca deixar isso invisível pro analista.
function renderPainelMascaramento(detalhes) {
  if (!detalhes || !detalhes.length) return '';
  const rotulos = { CPF: 'CPF', RG: 'RG', EMAIL: 'E-mail', TELEFONE: 'Telefone', BANCARIO: 'Dado bancário', QUALIFICACAO: 'Bloco de qualificação (nome+documento)' };
  const linhas = detalhes.map(d => {
    const origemTxt = [d.doc ? `doc. <strong>${escHtml(d.doc)}</strong>` : null, d.pagina ? `página ${escHtml(d.pagina)}` : null]
      .filter(Boolean).join(', ') || 'origem não identificada';
    return `<li style="margin-bottom:3px;"><span style="font-weight:600;">${escHtml(rotulos[d.tipo] || d.tipo)}</span> — ${origemTxt}</li>`;
  }).join('');
  return `
    <details style="margin-top:10px; background:#fff9db; border:1px solid #f5c518; border-radius:6px; padding:10px 14px;">
      <summary style="cursor:pointer; font-size:0.82rem; font-weight:600; color:#7c5a00;">
        <i class="ti ti-eye-off"></i> ${detalhes.length} dado(s) pessoal(is) mascarado(s) antes de enviar à nuvem — ver o quê e onde
      </summary>
      <ul style="margin:8px 0 0 18px; font-size:0.8rem; color:#5c4600; padding:0;">${linhas}</ul>
    </details>`;
}


async function invocarIAComFallback(prompt, isChat = false, statusEl = null) {
  _iaTrabalhando(true);
  try { return await _invocarIAComFallbackInterno(prompt, isChat, statusEl); }
  finally { _iaTrabalhando(false); }
}

async function _invocarIAComFallbackInterno(prompt, isChat = false, statusEl = null) {
  const erros = [];
  const estados = {};
  ORDEM_PROVEDORES_IDS.forEach(id => {
    const info = PROVEDORES_INFO[id];
    estados[id] = (info && info.temChave()) ? 'pendente' : 'pulado';
  });

  const { textoMascarado: promptMascarado, mapa, totalMascarado, detalhes } = mascararDadosSensiveis(prompt);
  // Exposto globalmente pra quem chamou (rodarRaioX, rodarRevisaoFinal) poder montar o
  // painel "o que foi mascarado" depois que a chamada terminar — o Ollama (local) não
  // mascara nada, mas se ele for usado DEPOIS de uma tentativa em nuvem que já mascarou,
  // esse registro do que teria sido mascarado continua valendo (foi calculado antes).
  window._ultimoMascaramentoDetalhes = detalhes;
  (window._mascaramentoAcumulado = window._mascaramentoAcumulado || []).push(...detalhes);

  const pulados = [];
  const chaves = { gemini: GEMINI_KEY, groq: GROQ_KEY, kimi: KIMI_KEY, openrouter: OPENROUTER_KEY, deepseek: DEEPSEEK_KEY };
  for (const id of ORDEM_PROVEDORES_IDS) {
    const info = PROVEDORES_INFO[id];
    if (!info) continue;
    if (!info.temChave()) {
      pulados.push(info.nome + (id !== 'ollama' && !chaves[id] ? ': PULADO_SEM_CHAVE' : ': PULADO_DESLIGADO'));
      continue;
    }
    estados[id] = 'tentando';
    renderPainelProvedores(statusEl, estados, `Chamando ${info.nome}...`);
    try {
      // Ollama roda local — usa o prompt ORIGINAL, sem máscara (não há por quê mascarar
      // pra si mesmo). Todo o resto (nuvem) usa a versão mascarada.
      const promptDesteProvedor = id === 'ollama' ? prompt : promptMascarado;
      const r = await info.invocar(promptDesteProvedor, isChat, statusEl);
      estados[id] = 'ok';
      (window._provedoresQueResponderam = window._provedoresQueResponderam || new Set()).add(info ? info.nome : id);
      renderPainelProvedores(statusEl, estados, 'Concluído.');
      return id === 'ollama' ? r : desmascararTexto(r, mapa);
    } catch (e) {
      estados[id] = 'falhou';
      erros.push(`${info.nome}: ${e.message}`);
    }
  }
  renderPainelProvedores(statusEl, estados, 'Nenhum provedor respondeu.');
  throw new Error('Todos os provedores de IA falharam:\n' + erros.concat(pulados).join('\n'));
}


async function invocarGroq(prompt, isChat, statusEl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVEDOR_TIMEOUT_MS);
  const body = { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.1 };
  if (!isChat) body.response_format = { type: 'json_object' };
  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
    body: JSON.stringify(body), signal: controller.signal
  });
  clearTimeout(timer);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).substring(0, 300)}`);
  const json = await resp.json();
  const txt = json.choices?.[0]?.message?.content;
  return isChat ? txt : txt.replace(/```json/g, '').replace(/```/g, '').trim();
}

// Kimi (Moonshot AI) — mesmo padrão compatível com a API da OpenAI que Groq/OpenRouter
// já usam. Endpoint e modelo confirmados na documentação oficial da Moonshot.
// Tempo de espera próprio pra Kimi — bem maior que os outros. Ela é um modelo "de
// raciocínio" (pensa antes de responder) e, com processo grande (documento com muitos
// tokens), isso pode levar minutos — confirmado na prática: um teste real gastou tempo
// suficiente pra estourar os 60s padrão, mesmo a Kimi tendo respondido (o pedido aparece
// cobrado no painel da Moonshot), só que depois do nosso limite já ter cortado a conexão.
const KIMI_TIMEOUT_MS = 240000;

async function invocarKimi(prompt, isChat, statusEl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), KIMI_TIMEOUT_MS);
  const body = { model: 'kimi-k2.6', messages: [{ role: 'user', content: prompt }] };
  if (!isChat) body.response_format = { type: 'json_object' };
  let resp;
  try {
    resp = await fetch('https://api.moonshot.ai/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + KIMI_KEY },
      body: JSON.stringify(body), signal: controller.signal
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`A Kimi não respondeu em ${KIMI_TIMEOUT_MS / 1000}s — com documento grande, o modelo de raciocínio dela pode levar mais tempo. Tente de novo.`);
    throw new Error('Falha de rede ao chamar a Kimi: ' + e.message);
  } finally {
    clearTimeout(timer);
  }
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).substring(0, 300)}`);
  const json = await resp.json();
  const txt = json.choices?.[0]?.message?.content;
  return isChat ? txt : txt.replace(/```json/g, '').replace(/```/g, '').trim();
}

async function invocarOpenRouter(prompt, isChat, statusEl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVEDOR_TIMEOUT_MS);
  const body = { model: 'openrouter/free', messages: [{ role: 'user', content: prompt }], temperature: 0.1 };
  if (!isChat) body.response_format = { type: 'json_object' };
  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + OPENROUTER_KEY, 'HTTP-Referer': location.origin, 'X-Title': 'SEI Analista' },
    body: JSON.stringify(body), signal: controller.signal
  });
  clearTimeout(timer);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).substring(0, 300)}`);
  const json = await resp.json();
  const txt = json.choices?.[0]?.message?.content;
  return isChat ? txt : txt.replace(/```json/g, '').replace(/```/g, '').trim();
}

async function invocarDeepSeek(prompt, isChat, statusEl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVEDOR_TIMEOUT_MS);
  const body = { model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], temperature: 0.3 };
  if (!isChat) body.response_format = { type: 'json_object' };
  let resp;
  try {
    resp = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + DEEPSEEK_KEY },
      body: JSON.stringify(body), signal: controller.signal
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`O DeepSeek não respondeu em ${PROVEDOR_TIMEOUT_MS / 1000}s.`);
    throw new Error('Falha de rede ao chamar o DeepSeek: ' + e.message);
  } finally { clearTimeout(timer); }
  if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${(await resp.text()).substring(0, 300)}`);
  const json = await resp.json();
  const txt = json.choices?.[0]?.message?.content;
  if (!txt) throw new Error('O DeepSeek não devolveu conteúdo.');
  return isChat ? txt : txt.replace(/```json/g, '').replace(/```/g, '').trim();
}

async function invocarOllama(prompt, isChat, statusEl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVEDOR_TIMEOUT_MS);
  const body = { model: OLLAMA_MODEL, prompt, stream: false };
  if (!isChat) body.format = 'json';
  const resp = await fetch(OLLAMA_URL + '/api/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: controller.signal
  });
  clearTimeout(timer);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const json = await resp.json();
  const txt = json.response;
  return isChat ? txt : txt.replace(/```json/g, '').replace(/```/g, '').trim();
}

async function buscarNormasExternas(p) {
  if (!GEMINI_KEY) throw new Error("Chave não configurada.");
  const prompt = `Pesquise normas de PE (SES-PE) para Contratos de Gestão com OSS, unidade "${p.unidade}", OSS "${p.oss}".`;
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] })
  });
  const json = await resp.json();
  const texto = json.candidates?.[0]?.content?.parts?.map(pt => pt.text || '').join('') || '';
  const fontes = json.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web ? { titulo: c.web.title, url: c.web.uri } : null).filter(Boolean) || [];
  return { texto, fontes };
}

async function buscarJurisprudencia(p) {
  if (!GEMINI_KEY) throw new Error("Chave não configurada.");
  const prompt = `Pesquise decisões do TCE-PE e TCU sobre Contratos de Gestão com OSS para unidade "${p.unidade}".`;
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${GEMINI_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] })
  });
  const json = await resp.json();
  const texto = json.candidates?.[0]?.content?.parts?.map(pt => pt.text || '').join('') || '';
  const fontes = json.candidates?.[0]?.groundingMetadata?.groundingChunks?.map(c => c.web ? { titulo: c.web.title, url: c.web.uri } : null).filter(Boolean) || [];
  return { texto, fontes };
}

// Acha, dentro do texto de um achado (título/explicação/evidência), qualquer coisa que
// pareça dado pessoal — reaproveita os mesmos padrões do mascaramento, mas aqui é só
// DETECÇÃO (não mascara nada): o objetivo é avisar antes do dado sair da ferramenta
// dentro de um arquivo exportado, não impedir que o analista veja o valor real.
function _escanearDadosPessoais(texto) {
  const achados = [];
  const testes = [
    { tipo: 'CPF', regex: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g },
    { tipo: 'RG', regex: /\b\d{1,2}\.\d{3}\.\d{3}-[\dxX]\b/g },
    { tipo: 'E-mail', regex: /[\w.+-]+@[\w-]+\.[\w.-]+/g },
    { tipo: 'Telefone', regex: /\(\d{2}\)\s?9?\d{4}-?\d{4}\b/g },
    { tipo: 'Nome (bloco de qualificação)', regex: /neste\s+ato\s+representad[oa]\s+por|representad[oa]\s+neste\s+ato\s+por|por\s+seu[a]?\s+representante\s+legal/gi }
  ];
  testes.forEach(({ tipo, regex }) => { if (regex.test(texto)) achados.push(tipo); });
  return achados;
}

function exportarRelatorioAchados() {
  if (!window.achadosAtuais || window.achadosAtuais.length === 0) return alert('Nenhum achado para exportar.');

  // Varre título+explicação+evidência de cada achado — é o que efetivamente vai pro
  // arquivo .doc que sai da ferramenta (e-mail, pen-drive, etc.), então é aqui que o
  // aviso importa, não na tela de trabalho.
  const avisos = [];
  window.achadosAtuais.forEach((c, idx) => {
    const textoJunto = [c.titulo, c.explicacao, c.evidencia, c.sugestao].filter(Boolean).join(' — ');
    const tipos = _escanearDadosPessoais(textoJunto);
    tipos.forEach(tipo => avisos.push({ tipo, achadoNum: idx + 1, titulo: c.titulo, doc: c.doc_origem || 'não identificado' }));
  });

  const painel = document.getElementById('painel-cards');
  if (avisos.length && painel) {
    const linhas = avisos.map(a => `<li style="margin-bottom:3px;"><strong>${escHtml(a.tipo)}</strong> — achado ${a.achadoNum} ("${escHtml(a.titulo)}"), doc. ${escHtml(a.doc)}</li>`).join('');
    const idAviso = 'aviso-export-' + Date.now();
    const avisoHtml = `
      <div id="${idAviso}" style="background:#fff3cd; border:1px solid #ffeeba; border-radius:6px; padding:12px 16px; margin-bottom:15px;">
        <div style="font-weight:600; color:#856404; font-size:0.88rem; margin-bottom:6px;"><i class="ti ti-alert-triangle"></i> Este relatório vai sair da ferramenta com dado pessoal identificável:</div>
        <ul style="margin:0 0 10px 18px; font-size:0.82rem; color:#5c4600; padding:0;">${linhas}</ul>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-secondary btn-sm" onclick="document.getElementById('${idAviso}').remove()">Cancelar</button>
          <button class="btn btn-warning btn-sm" onclick="document.getElementById('${idAviso}').remove(); _gerarArquivoRelatorioAchados();">Exportar mesmo assim</button>
        </div>
      </div>`;
    painel.insertAdjacentHTML('afterbegin', avisoHtml);
    document.getElementById(idAviso).scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    return;
  }

  _gerarArquivoRelatorioAchados();
}

function _gerarArquivoRelatorioAchados() {
  const sei = processoAtual.numero_sei || String(processoAtual.id);
  let htmlReport = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body style="font-family:'Times New Roman',serif;font-size:12pt;"><h2>RELATÓRIO DE ACHADOS</h2><p>Processo: ${sei}</p><hr/>`;
  window.achadosAtuais.forEach((c, index) => {
    htmlReport += `<p><strong>${index + 1}. [${c.tag}] ${c.titulo}</strong><br/>Origem: ${c.doc_origem || ''}<br/>Explicação: ${c.explicacao}`;
    if (Array.isArray(c.calculo) && c.calculo.length) htmlReport += `<br/><strong>Memória de cálculo:</strong><br/>` + c.calculo.map(l => `${escHtml(l[0])}: <strong>${escHtml(l[1])}</strong>`).join('<br/>');
    if (c.sugestao) htmlReport += `<br/><strong>O que fazer:</strong> ${c.sugestao}`;
    htmlReport += `</p>`;
  });
  htmlReport += "</body></html>";
  const blob = new Blob(['\ufeff', htmlReport], { type: 'application/msword' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob); link.download = `Achados_${sei}.doc`;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

function extrairContexto(texto, termo, raio) {
  const idx = texto.indexOf(termo);
  if (idx === -1) return '';
  return texto.substring(Math.max(0, idx - raio), Math.min(texto.length, idx + termo.length + raio)).replace(/\s+/g, ' ').trim();
}
function extrairValoresMonetarios(texto) { return [...new Set(texto.match(/R\$\s?[\d.]+,\d{2}/g) || [])].slice(0, 25).map(v => ({ valor: v, contexto: extrairContexto(texto, v, 55) })); }
function extrairDatas(texto) { return [...new Set(texto.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g) || [])].slice(0, 25).map(v => ({ valor: v, contexto: extrairContexto(texto, v, 55) })); }
function extrairNumerosProcesso(texto) {
  // Tolera espaço solto ao redor de ".", "/" e "-" — a extração de PDF junta trechos de
  // texto separados com espaço simples, e o número do processo pode vir fragmentado em
  // pedaços assim, principalmente em PDF escaneado ou gerado por certos sistemas.
  const encontrados = [...new Set(texto.match(/\d{4,}\s*\.\s*\d{5,6}\s*\/\s*\d{4}\s*-\s*\d{2}/g) || [])];
  return encontrados.slice(0, 10).map(original => ({
    valor: original.replace(/\s+/g, ''),
    contexto: extrairContexto(texto, original, 40)
  }));
}
function extrairCEPs(texto) { return [...new Set(texto.match(/\b\d{2}\.?\d{3}-\d{3}\b/g) || [])].slice(0, 10).map(v => ({ valor: v, contexto: extrairContexto(texto, v, 45) })); }

function dividirPorDocumento(textoIntegral) {
  // split com grupo devolve [antes, nome1, texto1, nome2, texto2, ...]. Um documento de texto vazio
  // continua existindo (texto ''), em vez de desalinhar o nome dos documentos seguintes.
  const partes = String(textoIntegral || '').split(/--- DOC: (.+?) ---/);
  const docs = [];
  for (let i = 1; i < partes.length; i += 2) docs.push({ nome: partes[i].trim(), texto: partes[i + 1] !== undefined ? partes[i + 1] : '' });
  return docs;
}

// ==================== CONFERÊNCIA DE CONTAS POR CÓDIGO ====================
// Faz a conta com regra fixa, como uma calculadora — não depende da IA "notar". É a
// parte que mais pesa pro erário, então tem cobertura garantida em toda Checagem,
// mesmo que a IA falhe. LIMITE: só confere o que reconhece como tabela com linha de
// "Total" ou como valor com rótulo claro. Não substitui a IA, soma a ela.

// Converte número no formato brasileiro ("1.200", "17.292.449,28", "R$ 5,00") em número.
function _numeroBR(txt) {
  let t = String(txt).replace(/R\$\s?/g, '').replace(/\s+/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else t = t.replace(/\./g, '');
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

function _formatarBR(n) {
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Todos os números "de valor" de uma linha, da esquerda pra direita — ignora data, nº de
// processo e CEP, que têm dígitos mas não entram em soma.
function _numerosDaLinha(linha) {
  const limpa = linha
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, ' ')
    .replace(/\d{4,}\s*\.\s*\d{5,6}\s*\/\s*\d{4}\s*-\s*\d{2}/g, ' ')
    .replace(/\b\d{2}\.?\d{3}-\d{3}\b/g, ' ');
  const achados = limpa.match(/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?/g) || [];
  return achados.map(_numeroBR).filter(n => n !== null);
}

function _paginaNaPosicao(texto, posicao) {
  const marcas = [...texto.substring(0, posicao).matchAll(/--- PÁGINA (\d+) ---/g)];
  return marcas.length ? marcas[marcas.length - 1][1] : null;
}

// 1) Tabelas com linha "Total": soma as linhas logo acima e compara com o total informado.
// Se todas as linhas têm a mesma quantidade de números, confere coluna por coluna; se
// não, confere só o último número de cada linha.
function conferirSomasPorCodigo(textoIntegral) {
  const achados = [];
  dividirPorDocumento(textoIntegral).forEach(d => {
    const linhas = d.texto.split('\n');
    let posicao = 0;
    const posicaoDaLinha = linhas.map(l => { const p = posicao; posicao += l.length + 1; return p; });

    linhas.forEach((linha, i) => {
      if (!/\btotal\b/i.test(linha)) return;
      const numsTotal = _numerosDaLinha(linha);
      if (!numsTotal.length) return;

      const itens = [];
      for (let j = i - 1; j >= 0 && itens.length < 40; j--) {
        const l = linhas[j];
        if (/--- PÁGINA \d+ ---/.test(l) || /total/i.test(l)) break;
        const nums = _numerosDaLinha(l);
        if (!nums.length) break;
        itens.unshift(nums);
      }
      if (itens.length < 2) return;

      const mesmaQtd = itens.every(n => n.length === numsTotal.length);
      const colunas = mesmaQtd ? numsTotal.map((_, c) => c) : [null];
      colunas.forEach(c => {
        _cobCodigo.somas++;
        const valorTotal = c === null ? numsTotal[numsTotal.length - 1] : numsTotal[c];
        const soma = itens.reduce((acc, n) => acc + (c === null ? n[n.length - 1] : n[c]), 0);
        if (Math.abs(soma - valorTotal) <= 0.01) return;
        const pagina = _paginaNaPosicao(d.texto, posicaoDaLinha[i]);
        achados.push({
          tag: 'Cálculo', setor: 'SFCG',
          titulo: 'Soma da tabela não bate com o total informado',
          evidencia: linha.trim(),
          explicacao: `As ${itens.length} linhas logo acima do total somam ${_formatarBR(soma)}, mas o total informado é ${_formatarBR(valorTotal)} (diferença de ${_formatarBR(Math.abs(soma - valorTotal))}). Conta feita por código, não pela IA.`,
          sugestao: `Refaça a soma das linhas dessa tabela${pagina ? ' (página ' + pagina + ')' : ''} e corrija o valor errado — pode ser o total ou uma das linhas. Antes, confira se a tabela não continua em outra página: tabela quebrada entre páginas pode enganar a conferência.`,
          doc_origem: d.nome, pagina, verificar: true, conferido_por_codigo: true
        });
      });
    });
  });
  return achados;
}

// 2) Mesmo valor rotulado ("valor global", "valor mensal"...) com números diferentes
// dentro do processo. Pode ser alteração legítima por aditivo — por isso sai sempre
// como "verificar", e a sugestão manda confirmar qual documento é o mais recente.
function conferirValoresRotuladosPorCodigo(textoIntegral) {
  const porRotulo = {};
  const regex = /(valor\s+(?:global|total|mensal|anual|estimado|contratual|do\s+contrato)(?:\s+do\s+contrato)?(?:\s+de\s+gest[aã]o)?)[^\n]{0,60}?(R\$\s?[\d.]+,\d{2})/gi;
  dividirPorDocumento(textoIntegral).forEach(d => {
    let m;
    while ((m = regex.exec(d.texto)) !== null) {
      const rotulo = m[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim();
      (porRotulo[rotulo] = porRotulo[rotulo] || []).push({
        valorTxt: m[2].replace(/\s+/g, ' '), valor: _numeroBR(m[2]), doc: d.nome, pagina: _paginaNaPosicao(d.texto, m.index)
      });
    }
    regex.lastIndex = 0;
  });

  const achados = [];
  _cobCodigo.rotulos += Object.keys(porRotulo).length;
  Object.entries(porRotulo).forEach(([rotulo, ocorrencias]) => {
    const distintos = [...new Set(ocorrencias.map(o => o.valor))];
    if (distintos.length < 2) return;
    const lista = ocorrencias.slice(0, 8)
      .map(o => `${o.valorTxt} em ${o.doc}${o.pagina ? ' (pág. ' + o.pagina + ')' : ''}`).join('; ');
    achados.push({
      tag: 'Cálculo', setor: 'SFCG',
      titulo: `"${rotulo}" aparece com valores diferentes no processo`,
      evidencia: lista,
      explicacao: `O mesmo tipo de valor aparece com ${distintos.length} números diferentes: ${lista}. Conferência feita por código, não pela IA.`,
      sugestao: 'Se um documento mais recente (aditivo, apostilamento) alterou esse valor, a diferença é esperada — confirme qual é o documento mais recente e se ele cita a alteração. Se nenhum documento explica a mudança, corrija o valor divergente.',
      doc_origem: ocorrencias[0].doc, pagina: ocorrencias[0].pagina, verificar: true, conferido_por_codigo: true
    });
  });
  return achados;
}

// 3) Valor ANUAL x valor MENSAL (ex.: orçamento anual de um anexo x repasse mensal de um
// aditivo). Faz a conta por código — anual ÷ 12 contra o mensal — e mostra a memória de
// cálculo no cartão. Só compara valores da mesma ordem de grandeza, para não cruzar o
// orçamento do contrato com o valor mensal de um item qualquer.
const REGEX_VALOR_ANUAL = /(valor\s+(?:global\s+)?anual|or[çc]amento\s+anual|valor\s+global\s+do\s+exerc[íi]cio)[^\n]{0,90}?(R\$\s?[\d.]+,\d{2})/gi;
const REGEX_VALOR_MENSAL = /(valor\s+(?:global\s+)?mensal(?:\s+de\s+repasse)?|repasse\s+mensal|parcela\s+mensal)[^\n]{0,90}?(R\$\s?[\d.]+,\d{2})/gi;

function _coletarRotulados(textoIntegral, regex) {
  const achados = [];
  dividirPorDocumento(textoIntegral).forEach(d => {
    let m;
    regex.lastIndex = 0;
    while ((m = regex.exec(d.texto)) !== null) {
      const valor = _numeroBR(m[2]);
      if (valor) achados.push({ valor, valorTxt: m[2].replace(/\s+/g, ' '), rotulo: m[1].replace(/\s+/g, ' ').trim(), doc: d.nome, pagina: _paginaNaPosicao(d.texto, m.index), trecho: m[0].replace(/\s+/g, ' ').trim() });
    }
  });
  return achados;
}

const _inicial = s => s.charAt(0).toUpperCase() + s.slice(1);

function _reais(n) {
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function conferirAnualMensalPorCodigo(textoIntegral) {
  const anuais = _coletarRotulados(textoIntegral, REGEX_VALOR_ANUAL);
  const mensais = _coletarRotulados(textoIntegral, REGEX_VALOR_MENSAL);
  const vistos = new Set(), achados = [];
  anuais.forEach(a => mensais.forEach(m => {
    const equivalente = Math.round(a.valor / 12 * 100) / 100;
    const razao = m.valor / equivalente;
    if (razao < 0.5 || razao > 1.5) return;             // ordens de grandeza diferentes: não é o mesmo valor
    _cobCodigo.anualMensal++;
    const difMensal = Math.round((equivalente - m.valor) * 100) / 100;
    if (Math.abs(difMensal) <= 0.01) return;             // bate: nada a apontar
    const chave = a.valor + '|' + m.valor;
    if (vistos.has(chave) || achados.length >= 3) return;
    vistos.add(chave);
    const difAnual = Math.round(difMensal * 12 * 100) / 100;
    const onde = x => x.doc + (x.pagina ? ' (pág. ' + x.pagina + ')' : '');
    achados.push({
      tag: 'Cálculo', setor: 'SFCG',
      titulo: 'Valor anual e valor mensal não batem',
      evidencia: `"${a.trecho}" — "${m.trecho}"`,
      explicacao: `${onde(a)} informa ${a.rotulo.toLowerCase()} de ${_reais(a.valor)}, o que dá ${_reais(equivalente)} por mês. ${onde(m)} informa ${m.rotulo.toLowerCase()} de ${_reais(m.valor)}. A diferença é de ${_reais(Math.abs(difMensal))} por mês, ${_reais(Math.abs(difAnual))} em 12 meses. Conta feita por código, não pela IA.`,
      sugestao: `Confira se o valor mensal mudou a partir de um mês específico (por aditivo ou apostilamento): nesse caso, o valor anual pode combinar dois valores mensais e a diferença pode ser legítima. Se não houve mudança no meio do ano, retifique o documento com o valor desatualizado ou registre a justificativa formal.`,
      calculo: [
        [_inicial(`${a.rotulo} (${onde(a)})`), _reais(a.valor)],
        ['Equivalente mensal (anual ÷ 12)', _reais(equivalente)],
        [_inicial(`${m.rotulo} (${onde(m)})`), _reais(m.valor)],
        [difMensal > 0 ? 'Mensal informado está ABAIXO do equivalente em' : 'Mensal informado está ACIMA do equivalente em', _reais(Math.abs(difMensal)) + ' por mês'],
        ['Efeito em 12 meses', _reais(Math.abs(difAnual))],
        ['Mensal informado × 12', _reais(Math.round(m.valor * 12 * 100) / 100)]
      ],
      doc_origem: m.doc, pagina: m.pagina, verificar: true, conferido_por_codigo: true
    });
  }));
  return achados;
}

// 4) Valor por extenso: escreve o número por extenso por código e compara com o que o
// documento traz entre parênteses logo depois do valor. Só vira achado quando NÃO bate.
const _UNID = ['', 'um', 'dois', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
const _DEZ = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const _CEM = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];

function _trioPorExtenso(n) {
  if (n === 100) return 'cem';
  const partes = [], c = Math.floor(n / 100), r = n % 100;
  if (c) partes.push(_CEM[c]);
  if (r && r < 20) partes.push(_UNID[r]);
  else if (r) partes.push(_DEZ[Math.floor(r / 10)] + (r % 10 ? ' e ' + _UNID[r % 10] : ''));
  return partes.join(' e ');
}

function _inteiroPorExtenso(n) {
  if (n === 0) return 'zero';
  const grupos = [['bilhao', 'bilhoes'], ['milhao', 'milhoes'], ['mil', 'mil'], ['', '']];
  const partes = [];
  let resto = n;
  [1e9, 1e6, 1e3, 1].forEach((div, i) => {
    const q = Math.floor(resto / div); resto = resto % div;
    if (!q) return;
    const nome = q === 1 ? grupos[i][0] : grupos[i][1];
    partes.push((i === 2 && q === 1 ? '' : _trioPorExtenso(q)) + (nome ? ' ' + nome : ''));
  });
  return partes.join(' ').trim();
}

function valorPorExtenso(valor) {
  const reais = Math.floor(valor + 1e-9), centavos = Math.round((valor - reais) * 100);
  const partes = [];
  if (reais) partes.push(_inteiroPorExtenso(reais) + (reais % 1e6 === 0 ? ' de' : '') + (reais === 1 ? ' real' : ' reais'));
  if (centavos) partes.push(_inteiroPorExtenso(centavos) + (centavos === 1 ? ' centavo' : ' centavos'));
  return partes.join(' e ') || 'zero reais';
}

// Forma comparável: sem acento, sem pontuação, sem "e"/"de", "hum" = "um", "um mil" = "mil"
function _normalizarExtenso(t) {
  const p = String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s]/g, ' ')
    .split(/\s+/).filter(x => x && x !== 'e' && x !== 'de').map(x => x === 'hum' ? 'um' : x === 'catorze' ? 'quatorze' : x);
  const saida = [];
  p.forEach((x, i) => { if (x === 'um' && p[i + 1] === 'mil' && (i === 0 || !_ehNumeroPorExtenso(p[i - 1]))) return; saida.push(x); });
  return saida.join(' ');
}
function _ehNumeroPorExtenso(x) {
  return _UNID.includes(x) || _DEZ.includes(x) || _CEM.includes(x) || x === 'cem';
}

function conferirExtensoPorCodigo(textoIntegral) {
  const achados = [], vistos = new Set();
  const regex = /R\$\s?([\d.]+,\d{2})\s*\(([^)]{6,260})\)/g;
  dividirPorDocumento(textoIntegral).forEach(d => {
    let m;
    regex.lastIndex = 0;
    while ((m = regex.exec(d.texto)) !== null) {
      const escrito = m[2].replace(/\s+/g, ' ').trim();
      if (!/\b(reais|real|centavos?)\b/i.test(escrito)) continue;   // parênteses que não são o extenso
      const valor = _numeroBR(m[1]);
      if (valor === null) continue;
      _cobCodigo.extensos++;
      const correto = valorPorExtenso(valor);
      if (_normalizarExtenso(escrito) === _normalizarExtenso(correto)) continue;
      const chave = m[1] + '|' + _normalizarExtenso(escrito);
      if (vistos.has(chave) || achados.length >= 10) continue;
      vistos.add(chave);
      const pagina = _paginaNaPosicao(d.texto, m.index);
      achados.push({
        tag: 'Cálculo', setor: 'SFCG',
        titulo: 'Valor por extenso não corresponde ao número',
        evidencia: m[0].replace(/\s+/g, ' ').trim(),
        explicacao: `O documento traz R$ ${m[1]}, mas o extenso escrito ao lado diz outra coisa. Comparação feita por código, não pela IA.`,
        sugestao: 'Confira qual dos dois está certo (o número ou o extenso) e corrija o outro. Em contratos e aditivos, a divergência entre número e extenso costuma gerar questionamento sobre qual vale.',
        calculo: [
          ['Valor em número', 'R$ ' + m[1]],
          ['Extenso no documento', escrito],
          ['Extenso correto do número', correto.replace(/milhao/g, 'milhão').replace(/milhoes/g, 'milhões').replace(/bilhao/g, 'bilhão').replace(/bilhoes/g, 'bilhões').replace(/\btres\b/g, 'três')]
        ],
        doc_origem: d.nome, pagina, verificar: true, conferido_por_codigo: true
      });
    }
  });
  return achados;
}

// O que cada conferência por código examinou (não só o que achou): é isso que mostra que o
// silêncio significa "conferi e está certo", e não "não olhei".
const _cobCodigo = { somas: 0, rotulos: 0, anualMensal: 0, extensos: 0, achados: { somas: 0, rotulos: 0, anualMensal: 0, extensos: 0 } };

function conferirContasPorCodigo(textoIntegral) {
  _cobCodigo.somas = _cobCodigo.rotulos = _cobCodigo.anualMensal = _cobCodigo.extensos = 0;
  try {
    const a = conferirSomasPorCodigo(textoIntegral), b = conferirValoresRotuladosPorCodigo(textoIntegral),
          c = conferirAnualMensalPorCodigo(textoIntegral), d = conferirExtensoPorCodigo(textoIntegral);
    _cobCodigo.achados = { somas: a.length, rotulos: b.length, anualMensal: c.length, extensos: d.length };
    return [...a, ...b, ...c, ...d];
  } catch (e) {
    console.warn('Conferência de contas por código falhou:', e.message);
    return [];
  }
}

function montarDadosExtraidos(textoIntegral) {
  const docs = dividirPorDocumento(textoIntegral);
  if (!docs.length) return '(nenhum documento)';
  return docs.map(d => {
    const valores = extrairValoresMonetarios(d.texto);
    const datas = extrairDatas(d.texto);
    const numsProcesso = extrairNumerosProcesso(d.texto);
    const ceps = extrairCEPs(d.texto);
    let bloco = `\n--- ${d.nome} ---\n`;
    if (valores.length) bloco += 'VALORES:\n' + valores.map(v => `  • ${v.valor}  (trecho: "...${v.contexto}...")`).join('\n') + '\n';
    if (datas.length) bloco += 'DATAS:\n' + datas.map(v => `  • ${v.valor}  (trecho: "...${v.contexto}...")`).join('\n') + '\n';
    if (numsProcesso.length) bloco += 'Nº PROCESSO:\n' + numsProcesso.map(v => `  • ${v.valor}`).join('\n') + '\n';
    if (ceps.length) bloco += 'CEP:\n' + ceps.map(v => `  • ${v.valor}  (trecho: "...${v.contexto}...")`).join('\n') + '\n';
    if (!valores.length && !datas.length && !numsProcesso.length && !ceps.length) bloco += '(nenhum valor/data/nº de processo/CEP detectado)\n';
    return bloco;
  }).join('\n');
}


// Liga e desliga as fontes opcionais da checagem (cartões clicáveis). Grafite quando ligado;
// o âmbar fica para a busca na web, que é experimental.
function toggleFonte(tipo) {
  const cfg = tipo === 'drive'
    ? { chk: 'chk-historico-unidade', box: 'chk-drive-box', card: 'card-drive', cor: '#495057', borda: '#a3cfbb', fundo: '#e8f5e9' }
    : { chk: 'chk-legislacao-jurisprudencia', box: 'chk-web-box', card: 'card-web', cor: '#d97706', borda: '#d97706', fundo: '#fef3c7' };
  const chk = document.getElementById(cfg.chk), box = document.getElementById(cfg.box), card = document.getElementById(cfg.card);
  if (!chk || !box || !card) return;
  chk.checked = !chk.checked;
  box.innerHTML = chk.checked ? '<span style="color:#fff;font-size:10px;">✓</span>' : '';
  box.style.background = chk.checked ? cfg.cor : '#fff';
  card.style.borderColor = chk.checked ? cfg.borda : '#dee2e6';
  card.style.background = chk.checked ? cfg.fundo : '#f8f9fa';
}


// ==================== DIVISÃO EM LOTES (processos grandes) ====================
// Nenhum serviço de IA aceita um processo de milhões de caracteres numa chamada só
// (DeepSeek: 1 milhão de tokens; Kimi: limite de tokens por minuto da conta). O texto é
// dividido por documento em lotes; cada lote recebe a lista COMPLETA de valores, datas e
// CEPs de todos os documentos, então a comparação numérica entre documentos continua valendo.
const LIMITE_CHARS_LOTE = 300000; // cerca de 85 a 100 mil tokens por chamada

function _dividirEmLotes(textoIntegral, limite) {
  const docs = dividirPorDocumento(textoIntegral);
  if (!docs.length) return [{ texto: textoIntegral, docs: [] }];
  const pedacos = [];
  docs.forEach(d => {
    if (d.texto.length <= limite) { pedacos.push({ nome: d.nome, texto: d.texto }); return; }
    let ini = 0, parte = 1;
    while (ini < d.texto.length) {
      let fim = Math.min(ini + limite, d.texto.length);
      if (fim < d.texto.length) { const q = d.texto.lastIndexOf('\n', fim); if (q > ini + limite * 0.5) fim = q; }
      pedacos.push({ nome: d.nome + ' (parte ' + parte + ')', texto: d.texto.substring(ini, fim) });
      ini = fim; parte++;
    }
  });
  const lotes = [];
  let atual = { texto: '', docs: [] };
  pedacos.forEach(pc => {
    const bloco = '\n\n--- DOC: ' + pc.nome + ' ---\n' + pc.texto;
    if (atual.texto.length && atual.texto.length + bloco.length > limite) { lotes.push(atual); atual = { texto: '', docs: [] }; }
    atual.texto += bloco; atual.docs.push(pc.nome);
  });
  if (atual.texto.length) lotes.push(atual);
  return lotes;
}

// Lista extraída sem os trechos de contexto, usada quando a completa fica grande demais
// para ir junto em cada lote.
function _dadosExtraidosCompactos(textoIntegral) {
  return dividirPorDocumento(textoIntegral).map(d => {
    const v = extrairValoresMonetarios(d.texto).map(x => x.valor);
    const dt = extrairDatas(d.texto).map(x => x.valor);
    const c = extrairCEPs(d.texto).map(x => x.valor);
    let b = '\n--- ' + d.nome + ' ---\n';
    if (v.length) b += 'VALORES: ' + v.join('; ') + '\n';
    if (dt.length) b += 'DATAS: ' + dt.join('; ') + '\n';
    if (c.length) b += 'CEP: ' + c.join('; ') + '\n';
    return b;
  }).join('');
}

// Lê os cards da resposta da IA. Se o JSON vier cortado ou malformado, tenta limpar e,
// em último caso, recupera os cards completos que vieram antes do defeito.
function _lerCardsDaResposta(txt) {
  const s = String(txt || '');
  try { return JSON.parse(s).cards || []; } catch (e) { /* segue */ }
  try {
    const limpo = s.replace(/[\x00-\x1F\x7F]/g, ' ').replace(/,\s*}/g, '}').replace(/,\s*]/g, ']');
    return JSON.parse(limpo).cards || [];
  } catch (e) { /* segue */ }
  const cards = [];
  let pos = s.indexOf('"tag"');
  while (pos >= 0) {
    const ini = s.lastIndexOf('{', pos);
    let prof = 0, fim = -1;
    for (let i = ini; ini >= 0 && i < s.length; i++) {
      if (s[i] === '{') prof++;
      else if (s[i] === '}') { prof--; if (prof === 0) { fim = i; break; } }
    }
    if (fim > ini) { try { cards.push(JSON.parse(s.slice(ini, fim + 1))); } catch (e) { /* card defeituoso */ } }
    pos = s.indexOf('"tag"', fim > pos ? fim : pos + 5);
  }
  if (!cards.length) throw new Error('A IA respondeu, mas a resposta não pôde ser lida como lista de achados.');
  return cards;
}


// A IA às vezes devolve como "achado" algo que ela conferiu e estava certo ("o extenso está
// correto", "nenhuma ação necessária"). Isso não é achado: sai da lista, mas fica visível
// numa linha discreta, para nada sumir sem você saber.
function _eConferenciaSemProblema(c) {
  if (!c || c.conferido_por_codigo) return false;
  const sug = String(c.sugestao || '').trim();
  const exp = String(c.explicacao || '');
  const semAcao = /^(nenhuma\s+(a[çc][ãa]o|corre[çc][ãa]o|provid[êe]ncia)|n[ãa]o\s+h[áa]\s+(nada|a[çc][ãa]o|necessidade)|nada\s+a\s+(fazer|corrigir)|sem\s+a[çc][ãa]o)/i.test(sug);
  const semProblema = /n[ãa]o\s+h[áa]\s+(nenhuma\s+)?(inconsist[êe]ncia|diverg[êe]ncia|erro|problema)(\s+real)?(\s+neste\s+item)?\s*[.;]?\s*$/i.test(exp)
    || /n[ãa]o\s+h[áa]\s+(nenhuma\s+)?(inconsist[êe]ncia|diverg[êe]ncia)\s+real/i.test(exp);
  return semAcao || semProblema;
}

function _avisoConferidosCorretos(lista) {
  if (!lista || !lista.length) return '';
  return `<details style="margin-top:8px; font-size:0.8rem; color:#6c757d;">
    <summary style="cursor:pointer;"><i class="ti ti-circle-check"></i> ${lista.length} item(ns) conferido(s) pela IA estavam corretos e não viraram achado</summary>
    <ul style="margin:6px 0 0 18px; padding:0;">${lista.map(c => `<li>${escHtml(c.titulo || '')}${c.doc_origem ? ' — ' + escHtml(c.doc_origem) : ''}</li>`).join('')}</ul>
  </details>`;
}

// ==================== COBERTURA DA LEITURA ====================
// Mostra o que entrou, o que faltou e com que qualidade foi lido, antes de qualquer achado
// ser tratado como confiável. "Li tudo" só vale se isto estiver sem pontos de atenção.
function _chaveFalhas() { return 'sei_falhas_' + (processoAtual ? processoAtual.id : 'x'); }
function _lerFalhasImportacao() { try { return JSON.parse(localStorage.getItem(_chaveFalhas()) || '[]'); } catch (e) { return []; } }
function _guardarFalhasImportacao(avisos) {
  if (!avisos || !avisos.length) return;
  const atuais = _lerFalhasImportacao(), agora = new Date().toISOString();
  avisos.forEach(a => atuais.push({ texto: String(a).slice(0, 300), quando: agora }));
  try { localStorage.setItem(_chaveFalhas(), JSON.stringify(atuais.slice(-50))); } catch (e) { /* sem armazenamento */ }
}
function dispensarFalhasImportacao() { try { localStorage.removeItem(_chaveFalhas()); } catch (e) { /* ignora */ } _atualizarCoberturaLeitura(); }
function _chaveFaltasOk() { return 'sei_faltas_ok_' + (processoAtual ? processoAtual.id : 'x'); }
function _lerFaltasDispensadas() { try { return JSON.parse(localStorage.getItem(_chaveFaltasOk()) || '[]'); } catch (e) { return []; } }
function dispensarFaltasSequencia() {
  const a = analisarCoberturaLeitura();
  try { localStorage.setItem(_chaveFaltasOk(), JSON.stringify([...new Set([..._lerFaltasDispensadas(), ...a.faltam])])); } catch (e) { /* ignora */ }
  _atualizarCoberturaLeitura();
}

function analisarCoberturaLeitura() {
  const nomes = (window._docsDoProcesso || []).map(d => d.nome_arquivo);
  const docsTexto = _docsDoTextoAtual();
  const textoPorChave = new Map(docsTexto.map(d => [_chaveDoDocumento(d.nome), d]));
  const res = { total: nomes.length, temSequencia: false, ultimo: null, faltam: [], faltamDispensadas: [], duplicados: [], semTexto: [], ocr: [], fracas: [], repetidos: [], falhas: _lerFalhasImportacao() };
  const ordens = nomes.map(n => { const m = String(n).match(/^\s*\[(\d+)\]/); return m ? parseInt(m[1], 10) : null; });
  const comOrdem = ordens.filter(x => x !== null);
  if (nomes.length && comOrdem.length / nomes.length >= 0.6) {
    res.temSequencia = true;
    res.ultimo = Math.max(...comOrdem);
    const vistos = new Map();
    comOrdem.forEach(n => vistos.set(n, (vistos.get(n) || 0) + 1));
    const dispensadas = new Set(_lerFaltasDispensadas());
    for (let i = 1; i <= res.ultimo; i++) {
      if (vistos.has(i)) continue;
      (dispensadas.has(i) ? res.faltamDispensadas : res.faltam).push(i);
    }
    res.duplicados = [...vistos.entries()].filter(([, q]) => q > 1).map(([n]) => n);
  }
  nomes.forEach(nome => {
    const d = textoPorChave.get(_chaveDoDocumento(nome));
    if (!d) { res.repetidos.push(nome); return; }       // texto idêntico a outro documento: contado uma vez
    const corpo = d.texto.replace(/--- PÁGINA \d+ ---/g, '').replace(/\[leitura por OCR\]/g, '').trim();
    if (corpo.length < 30) { res.semTexto.push(nome); return; }
    const re = /--- PÁGINA (\d+) ---\n([\s\S]*?)(?=\n--- PÁGINA \d+ ---|$)/g;
    let m, total = 0; const fracas = [], ocr = [];
    while ((m = re.exec(d.texto)) !== null) {
      total++;
      const corpoPag = m[2].trim();
      if (/^\[leitura por OCR\]/.test(corpoPag)) ocr.push(parseInt(m[1], 10));
      if (corpoPag.replace(/^\[leitura por OCR\]/, '').trim().length < 60) fracas.push(parseInt(m[1], 10));
    }
    if (ocr.length) res.ocr.push({ nome, total, paginas: ocr });
    if (fracas.length) res.fracas.push({ nome, total, paginas: fracas });
  });
  return res;
}

function _htmlCoberturaLeitura() {
  const a = analisarCoberturaLeitura(), c = window._cobChecagem;
  let atencao = 0;
  const rot = n => '[' + String(n).padStart(2, '0') + ']';
  const nomeCurto = n => { const f = _nomeAmigavelDoc(n); return escHtml(f.nome) + (f.sei ? ' (SEI nº ' + escHtml(f.sei) + ')' : ''); };
  const linha = (t, cor) => `<div style="font-size:0.82rem; line-height:1.55; ${cor ? 'color:' + cor + ';' : ''}">${t}</div>`;
  const secao = (titulo, corpo) => `<div style="margin-top:12px;"><div style="font-size:0.72rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.04em; margin-bottom:4px;">${titulo}</div>${corpo}</div>`;
  const AVISO = '#854d0e';

  let docs = linha(`${a.total} documento(s) integrado(s)${a.temSequencia ? ', numerados até ' + rot(a.ultimo) : ''}.`);
  if (a.faltam.length) {
    atencao++;
    docs += linha(`<i class="ti ti-alert-triangle"></i> Faltam na sequência: ${a.faltam.map(rot).join(', ')}. Confira no SEI se foram cancelados ou se não chegaram a ser importados. <button class="btn btn-secondary btn-sm" style="margin-left:6px;" onclick="dispensarFaltasSequencia()">Está certo, ignorar</button>`, AVISO);
  }
  if (a.faltamDispensadas.length) docs += linha(`Números que você marcou como corretos: ${a.faltamDispensadas.map(rot).join(', ')}.`, 'var(--text-muted)');
  if (a.duplicados.length) { atencao++; docs += linha(`<i class="ti ti-alert-triangle"></i> Número repetido na sequência: ${a.duplicados.map(rot).join(', ')}.`, AVISO); }
  if (a.repetidos.length) docs += linha(`${a.repetidos.length} documento(s) têm texto idêntico a outro e entram na análise uma vez só: ${a.repetidos.slice(0, 4).map(nomeCurto).join('; ')}${a.repetidos.length > 4 ? '…' : ''}.`, 'var(--text-muted)');

  let qual = '';
  a.semTexto.forEach(n => { atencao++; qual += linha(`<i class="ti ti-alert-triangle"></i> ${nomeCurto(n)}: nenhum texto foi lido. O conteúdo deste documento NÃO foi conferido.`, AVISO); });
  a.ocr.forEach(o => { atencao++; qual += linha(`<i class="ti ti-eye"></i> ${nomeCurto(o.nome)}: ${o.paginas.length} de ${o.total} página(s) lidas por OCR (${o.paginas.slice(0, 8).join(', ')}${o.paginas.length > 8 ? '…' : ''}). Confira os números dessas páginas.`, AVISO); });
  a.fracas.forEach(f => {
    const grave = f.paginas.length / f.total >= 0.5;
    if (grave) atencao++;
    qual += linha(`${grave ? '<i class="ti ti-alert-triangle"></i> ' : ''}${nomeCurto(f.nome)}: ${f.paginas.length} de ${f.total} página(s) com pouco texto (${f.paginas.slice(0, 8).join(', ')}${f.paginas.length > 8 ? '…' : ''}). ${grave ? 'Pode ser documento escaneado ou em imagem.' : 'Pode ser página de assinatura ou de imagem.'}`, grave ? AVISO : 'var(--text-muted)');
  });
  if (!qual) qual = linha('Todos os documentos tiveram texto lido, sem páginas em OCR e sem páginas vazias.', '#2b8a3e');

  let imp = '';
  if (a.falhas.length) {
    atencao++;
    imp = a.falhas.slice(-8).map(f => linha(`<i class="ti ti-alert-triangle"></i> ${escHtml(f.texto)} <span style="color:var(--text-muted);">(${new Date(f.quando).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })})</span>`, AVISO)).join('')
      + `<button class="btn btn-secondary btn-sm" style="margin-top:6px;" onclick="dispensarFalhasImportacao()">Já resolvi, dispensar avisos</button>`;
  }

  let chec;
  if (!c) chec = linha('Ainda não houve checagem deste processo nesta sessão.', 'var(--text-muted)');
  else {
    chec = '';
    if (c.codigo) {
      const k = c.codigo, tot = k.achados.somas + k.achados.rotulos + k.achados.anualMensal + k.achados.extensos;
      chec += linha(`<i class="ti ti-calculator"></i> Por código: ${k.somas} soma(s) de tabela, ${k.rotulos} valor(es) com rótulo, ${k.anualMensal} par(es) anual × mensal e ${k.extensos} valor(es) por extenso examinados. Divergências: ${tot}.`);
    }
    if (c.iaPulada) { atencao++; chec += linha(`<i class="ti ti-player-pause"></i> A IA ainda não analisou: o processo é grande (${c.lotes} lotes). Toque em "Executar Checagem".`, AVISO); }
    else if (c.iaFalhou) { atencao++; chec += linha('<i class="ti ti-alert-triangle"></i> A IA não respondeu nesta checagem. Só valem as conferências por código.', AVISO); }
    else if (c.lotes) {
      const falhos = (c.lotesFalhos || []).length, ok = c.lotes - falhos;
      if (falhos) atencao++;
      chec += linha(`${falhos ? '<i class="ti ti-alert-triangle"></i> ' : '<i class="ti ti-check"></i> '}IA: ${ok} de ${c.lotes} lote(s) analisado(s), cobrindo ${c.docsNaIA} de ${c.docsTotal} documento(s)${(c.servicos || []).length ? ' · ' + c.servicos.map(escHtml).join(', ') : ''}${falhos ? '. Lote(s) sem análise: ' + c.lotesFalhos.join(', ') + '.' : '.'}`, falhos ? AVISO : '');
    }
    chec += linha(`Última checagem: ${new Date(c.quando).toLocaleString('pt-BR')}.`, 'var(--text-muted)');
  }

  const chip = atencao
    ? `<span style="background:#fff3cd; color:#664d03; padding:2px 10px; border-radius:10px; font-size:0.75rem;">${atencao} ponto(s) de atenção</span>`
    : '<span style="background:#d1e7dd; color:#0f5132; padding:2px 10px; border-radius:10px; font-size:0.75rem;">leitura completa</span>';
  return `<details ${atencao ? 'open' : ''} style="background:#fff; border:1px solid #dee2e6; border-radius:8px; padding:12px 16px;">
    <summary style="cursor:pointer; font-size:0.95rem; font-weight:600;"><i class="ti ti-eye-check"></i> Cobertura da leitura ${chip}</summary>
    ${secao('Documentos', docs)}${secao('Qualidade da leitura', qual)}${imp ? secao('Avisos da importação', imp) : ''}${secao('Conferência', chec)}
  </details>`;
}

function _atualizarCoberturaLeitura() {
  const cont = document.getElementById('cobertura-leitura');
  if (!cont || !processoAtual) return;
  try { cont.innerHTML = _htmlCoberturaLeitura(); }
  catch (e) { cont.innerHTML = `<div style="font-size:0.8rem; color:#a61e4d;">Não foi possível montar a cobertura da leitura: ${escHtml(e.message)}</div>`; }
}
function _montarCoberturaLeitura() {
  let cont = document.getElementById('cobertura-leitura');
  if (!cont) {
    cont = document.createElement('div');
    cont.id = 'cobertura-leitura';
    cont.style.marginBottom = '16px';
    const alvo = document.getElementById('chk-historico-unidade')?.closest('div[style*="padding:20px"]');
    if (alvo && alvo.parentNode) alvo.parentNode.insertBefore(cont, alvo);
    else document.getElementById('content')?.appendChild(cont);
  }
  _atualizarCoberturaLeitura();
}

const LIMITE_LOTES_AUTOMATICO = 6;

async function rodarRaioX(automatica = false) {
  const st = document.getElementById('ia-status');
  const contadorEl = document.getElementById('contador-checagem');
  contadorEl.innerHTML = '';
  const p = processoAtual;
  window._provedoresQueResponderam = new Set();
  window._cobChecagem = { quando: new Date().toISOString(), iaFalhou: false };
  if (!textoIntegralAtual || textoIntegralAtual.trim().length < 50) {
    return st.innerHTML = '<div class="alert alert-danger">Importe os documentos primeiro.</div>';
  }

  // Aviso fixo e visível durante toda a checagem, com números REAIS (não é barra de
  // "página X de Y" fingida — o sistema manda o texto numa única chamada, não tem como
  // saber "em que página" está). O cronômetro sim é real, conta segundo a segundo.
  _garantirEstiloPulso();
  const banner = document.getElementById('banner-conferindo');
  const bannerDetalhe = document.getElementById('banner-conferindo-detalhe');
  const bannerTimer = document.getElementById('banner-conferindo-timer');
  const bannerTitulo = document.getElementById('banner-conferindo-titulo');
  let segundosDecorridos = 0;
  let intervaloTimer = null;
  if (banner) {
    if (bannerTitulo) bannerTitulo.textContent = 'ESTOU CONFERINDO OS DOCUMENTOS...';
    banner.classList.remove('hidden');
    if (bannerDetalhe) {
      const qtdDocs = (textoIntegralAtual.match(/--- DOC: /g) || []).length;
      bannerDetalhe.textContent = `${qtdDocs} documento(s) — ${Math.round(textoIntegralAtual.length / 1000)} mil caracteres`;
    }
    if (bannerTimer) {
      bannerTimer.textContent = '0s';
      intervaloTimer = setInterval(() => { segundosDecorridos++; bannerTimer.textContent = segundosDecorridos + 's'; }, 1000);
    }
  }

  let achadosCodigo = [];
  try {
    let dadosExtraidos = montarDadosExtraidos(textoIntegralAtual);
    if (dadosExtraidos.length > 150000) dadosExtraidos = _dadosExtraidosCompactos(textoIntegralAtual);
    // Contas conferidas por código ANTES da IA — cobertura garantida, mesmo se a IA falhar.
    achadosCodigo = conferirContasPorCodigo(textoIntegralAtual);
    window._cobChecagem.codigo = JSON.parse(JSON.stringify(_cobCodigo));
    // As contas por código não dependem da IA: aparecem já, enquanto a IA ainda trabalha.
    if (achadosCodigo.length) {
      window.achadosAtuais = achadosCodigo;
      renderizarCards(achadosCodigo);
      contadorEl.innerHTML = `<span style="background:#f8d7da; color:#842029; padding:6px 12px; border-radius:20px;">${achadosCodigo.length} inconsistência(s) de conta até agora — a IA ainda está conferindo</span>`;
    }

    // Checkbox 1 — histórico contratual da unidade (pasta Drive "LEIS E DECRETOS").
    // Ligado por padrão; roda ANTES de qualquer chamada à IA (é busca determinística).
    let historicoUnidadeBloco = '';
    const historicoUnidadeAtivo = document.getElementById('chk-historico-unidade')?.checked;
    const statusFonteEl = document.getElementById('status-fonte-historico');
    if (statusFonteEl) statusFonteEl.innerHTML = '';
    if (!historicoUnidadeAtivo) {
      if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:var(--text-muted);">Cruzamento com o histórico da unidade desligado nesta checagem.</span>`;
    } else if (!p.unidade) {
      if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:var(--text-muted);">Processo sem "unidade" definida — não há como buscar.</span>`;
    } else {
      st.innerHTML = `<span class="spinner"></span> Comparando com contratos antigos de "${escHtml(p.unidade)}"...`;
      try {
        const resHist = await api('normas/buscar-por-unidade', { unidade: p.unidade });
        if (resHist.ok && resHist.encontrado) {
          const nomes = resHist.arquivos.map(a => a.nome).join(', ');
          if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:#2b8a3e;"><i class="ti ti-check"></i> Encontrado: <strong>${escHtml(nomes)}</strong></span>`;
          historicoUnidadeBloco = '\n\nHISTÓRICO CONTRATUAL DA UNIDADE (contratos/aditivos anteriores dessa mesma unidade —\n' +
            'o casamento do arquivo é por nome, então pode confundir unidades parecidas; trate como forte\n' +
            'indício, não certeza):\n' +
            resHist.arquivos.map(a => {
              let bloco = `\n--- ${a.nome} ---\n`;
              if (a.valores?.length) bloco += 'VALORES:\n' + a.valores.map(v => `  • ${v.valor}`).join('\n') + '\n';
              if (a.datas?.length) bloco += 'DATAS:\n' + a.datas.map(v => `  • ${v.valor}`).join('\n') + '\n';
              if (a.cep?.length) bloco += 'CEP:\n' + a.cep.map(v => `  • ${v.valor}`).join('\n') + '\n';
              return bloco;
            }).join('\n');
        } else if (resHist.ok && !resHist.encontrado) {
          if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:#c92a2a;"><i class="ti ti-x"></i> Nenhum arquivo encontrado para "${escHtml(p.unidade)}"</span>`;
        } else {
          if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:#c92a2a;"><i class="ti ti-alert-triangle"></i> Falha ao consultar: ${escHtml(resHist.erro || 'erro desconhecido')}</span>`;
        }
      } catch (e) {
        if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:#c92a2a;"><i class="ti ti-alert-triangle"></i> Falha ao consultar: ${escHtml(e.message)}</span>`;
      }
    }

    // Checkbox 2 — legislação + jurisprudência unificadas. Desligado por padrão
    // (é busca automática na web, mais lenta, e todo achado baseado nela sai "verificar").
    let externasBloco = '';
    const legislacaoJurisprudenciaAtiva = document.getElementById('chk-legislacao-jurisprudencia')?.checked;
    if (legislacaoJurisprudenciaAtiva) {
      st.innerHTML = `<span class="spinner"></span> Buscando normas e decisões de tribunais na web...`;
      try {
        const [resNormas, resJuris] = await Promise.all([buscarNormasExternas(p), buscarJurisprudencia(p)]);
        externasBloco = `

NORMAS EXTERNAS ENCONTRADAS NA BUSCA WEB (⚠️ busca automática — pode estar desatualizada ou não
oficial; CONFIRME antes de citar em parecer):
${resNormas.texto}

JURISPRUDÊNCIA ENCONTRADA NA BUSCA WEB (⚠️ mesmo aviso acima):
${resJuris.texto}`;
      } catch (e) {
        externasBloco = `\n\n(Busca de normas/jurisprudência falhou: ${e.message} — checagem segue só com os documentos do processo.)`;
      }
    }

    st.innerHTML = `<span class="spinner"></span> Analisando documentos...`;
    const prompt = `Atue como Auditor Técnico Sênior (SES-PE). Cheque os documentos da unidade ${p.unidade} e OSS ${p.oss}.

VALORES, DATAS, Nº DE PROCESSO E CEP JÁ EXTRAÍDOS POR CÓDIGO (100% precisos — extração automática,
não depende de leitura sua). USE ESTA LISTA COMO BASE PRINCIPAL para qualquer comparação NUMÉRICA
(valor divergente, data divergente, CEP divergente) — é mais confiável que reler o número direto do
texto bruto, que fica abaixo:
${dadosExtraidos}${historicoUnidadeBloco}${externasBloco}

REGRAS DE CHECAGEM:
1. DIVERGÊNCIA DE VALOR/DATA/CEP: usando a lista extraída acima, ao achar dois valores que deveriam
   ser o mesmo dado mas aparecem diferentes, cite OS DOIS valores exatos e o documento de origem de
   cada um. Nunca diga "há divergência" sem mostrar os dois lado a lado.
2. TEXTO DUPLICADO OU COPIADO DO LUGAR ERRADO, TÍTULO QUE NÃO BATE COM O CORPO/TABELA, ATRIBUIÇÃO OU
   DESCRIÇÃO TROCADA ENTRE ITENS: para isso, USE O TEXTO BRUTO dos documentos (abaixo) — não é
   comparação numérica, é comparação de redação. Ex.: um título de meta dizendo um número enquanto a
   tabela detalhada logo depois soma outro; a descrição de um cargo/item copiada do item errado.
3. Se algum achado se basear no histórico da unidade ou na busca de normas/jurisprudência, marque
   "baseado_em_fonte_externa": true nesse achado E "verificar": true SEMPRE (nunca false).
4. Para cada achado, marque "verificar": true se depender de conferência manual, ou false apenas se
   for uma certeza absoluta e objetiva. Na dúvida, use true.
5. Escreva um campo "sugestao": o que fazer para resolver isso, em linguagem simples e direta (nada
   de juridiquês, nada de "verificar a divergência" de forma vaga). Diga exatamente qual documento
   corrigir e qual valor/texto parece o correto, com base no que os documentos já mostram (ex.: "a
   tabela detalhada soma 1.200, então o título com 1.920 parece erro de digitação — corrija o
   título"). Quando não houver como saber qual versão está certa, diga isso claramente e oriente o
   que confirmar antes de decidir, em vez de chutar um lado. Nunca invente uma sugestão sem base.

MUITO IMPORTANTE: se não houver inconsistência real e verificável, retorne {"cards": []}. Nunca
invente achado pra preencher a resposta. NÃO inclua itens que você conferiu e estão corretos: só entra
no JSON o que precisa de correção ou de verificação humana. Valores por extenso, somas de tabela e a
relação entre valor anual e mensal já são conferidos por código; não repita essas conferências.
FORMATO DE CADA CARD: o título diz o problema numa frase curta, sem jargão; a explicação tem no máximo
2 frases curtas, cita valores e documentos pelo número SEI (ex.: "documento 83015982") e NÃO repete a
evidência; a sugestão diz o que fazer em 1 frase. A evidência deve ser copiada EXATAMENTE como está no
documento, sem resumir, sem corrigir e sem juntar trechos de lugares diferentes.
Páginas marcadas com [leitura por OCR] foram lidas de imagem e podem ter dígitos trocados: se um achado
depender de número dessas páginas, marque verificar=true e diga na explicação que o número vem de OCR.

Retorne EXCLUSIVAMENTE um JSON válido, sem markdown:
{"cards": [{"tag": "Financeiro", "setor": "SFCG", "titulo": "Título", "evidencia": "trecho extraído (verbatim, o mais curto possível)", "explicacao": "motivo técnico, citando os valores/documentos exatos comparados", "sugestao": "o que fazer, em linguagem simples", "doc_origem": "doc", "verificar": true, "baseado_em_fonte_externa": false}]}

${achadosCodigo.length ? 'CONTAS JÁ CONFERIDAS POR CÓDIGO (NÃO repita estes achados — eles já serão mostrados ao analista):\n' + achadosCodigo.map(a => '- ' + a.titulo + ': ' + a.explicacao).join('\n') + '\n\n' : ''}TEXTO BRUTO DOS DOCUMENTOS (use para a regra 2 — texto duplicado/copiado/título divergente da tabela):
___TEXTO_DO_LOTE___`;
    window._mascaramentoAcumulado = [];
    const lotes = _dividirEmLotes(textoIntegralAtual, LIMITE_CHARS_LOTE);
    document.getElementById('aviso-lotes')?.remove();
    if (lotes.length > 1) {
      const maiores = dividirPorDocumento(textoIntegralAtual)
        .sort((a, b) => b.texto.length - a.texto.length).slice(0, 5)
        .map(d => `${escHtml(d.nome)} (${Math.round(d.texto.length / 1000)} mil)`).join(', ');
      st.insertAdjacentHTML('beforebegin', `<div id="aviso-lotes" style="background:#fff3cd;color:#664d03;padding:8px 12px;border-radius:6px;font-size:0.82rem;margin-top:8px;">
        <i class="ti ti-stack-2"></i> Processo grande (${Math.round(textoIntegralAtual.length / 1000)} mil caracteres): a análise será feita em <strong>${lotes.length} lotes</strong>, um depois do outro. Pode levar vários minutos.
        <div style="margin-top:4px;">Maiores documentos: ${maiores}</div></div>`);
    }
    const _nomesBase = lotes.flatMap(l => l.docs).map(n => n.replace(/ \(parte \d+\)$/, ''));
    Object.assign(window._cobChecagem, { lotes: lotes.length, docsTotal: new Set(_nomesBase).size });
    if (automatica && lotes.length > LIMITE_LOTES_AUTOMATICO) {
      window._cobChecagem.iaPulada = true;
      // Processo muito grande: não gasta a cota de IA sem você pedir.
      st.innerHTML = `<div style="background:#fff3cd;color:#664d03;padding:8px 12px;border-radius:6px;font-size:0.85rem;"><i class="ti ti-player-pause"></i> Este processo é grande (${lotes.length} lotes de IA). Mostrei só as contas conferidas por código. Toque em "Executar Checagem" para a IA analisar também.</div>`;
      contadorEl.innerHTML = achadosCodigo.length
        ? `<span style="background:#f8d7da; color:#842029; padding:6px 12px; border-radius:20px;">${achadosCodigo.length} inconsistência(s) de conta, IA aguardando você</span>` : '';
      return;
    }
    const cardsIA = [], respostasIA = [], falhasLote = [];
    for (let i = 0; i < lotes.length; i++) {
      if (lotes.length > 1) {
        if (bannerTitulo) bannerTitulo.textContent = `CONFERINDO LOTE ${i + 1} DE ${lotes.length}...`;
        if (bannerDetalhe) bannerDetalhe.textContent = `${lotes[i].docs.length} documento(s) neste lote`;
      }
      const aviso = lotes.length > 1
        ? `(Este é o lote ${i + 1} de ${lotes.length} do processo. A lista de valores extraídos acima cobre TODOS os documentos; o texto abaixo cobre só os documentos deste lote.)\n`
        : '';
      const promptLote = prompt.replace('___TEXTO_DO_LOTE___', () => aviso + lotes[i].texto);
      try {
        const resposta = await invocarIAComFallback(promptLote, false, st);
        respostasIA.push(resposta);
        cardsIA.push(..._lerCardsDaResposta(resposta));
      } catch (e) {
        // Limite de tokens por minuto não é falha de verdade: espera a janela virar e tenta de novo, uma vez
        if (/TPM|tokens per minute|rate_limit|HTTP 429/i.test(e.message) && !lotes[i]._jaEsperou) {
          lotes[i]._jaEsperou = true;
          for (let s = 60; s > 0; s--) {
            if (bannerDetalhe) bannerDetalhe.textContent = `Limite por minuto da conta atingido — retomando em ${s}s`;
            await new Promise(r => setTimeout(r, 1000));
          }
          i--; continue;
        }
        falhasLote.push({ lote: i + 1, erro: e.message });
        if (lotes.length === 1) throw e;
      }
    }
    if (falhasLote.length === lotes.length) throw new Error(falhasLote[0].erro);
    const _okBase = new Set(lotes.filter((_, i) => !falhasLote.some(f => f.lote === i + 1)).flatMap(l => l.docs).map(n => n.replace(/ \(parte \d+\)$/, '')));
    Object.assign(window._cobChecagem, { lotesFalhos: falhasLote.map(f => f.lote), docsNaIA: _okBase.size, servicos: [...(window._provedoresQueResponderam || [])] });
    const jsonStr = respostasIA.join('\n\n--- LOTE ---\n\n');
    const conferidosCorretos = cardsIA.filter(_eConferenciaSemProblema);
    const achadosIA = cardsIA.filter(c => !_eConferenciaSemProblema(c)).map(c => {
      // Trava reforçada: não confia só na IA marcar "verificar" certo pra achado de fonte externa.
      if (c.baseado_em_fonte_externa) c.verificar = true;
      return c;
    });
    window.achadosAtuais = [...achadosCodigo, ...achadosIA];
    contadorEl.innerHTML = `<span style="background:#f8d7da; color:#842029; padding:6px 12px; border-radius:20px;">${window.achadosAtuais.length} inconsistência(s)</span>`;
    renderizarCards(window.achadosAtuais);
    st.innerHTML = (falhasLote.length
      ? `<div style="background:#fff3cd;color:#664d03;padding:8px 12px;border-radius:6px;font-size:0.82rem;"><i class="ti ti-alert-triangle"></i> ${falhasLote.length} de ${lotes.length} lote(s) não foram analisados pela IA (lote ${falhasLote.map(f => f.lote).join(', ')}). Os achados acima cobrem só os demais. Rode a checagem de novo em alguns minutos para completar.</div>`
      : '') + _avisoConferidosCorretos(conferidosCorretos) + renderPainelMascaramento(window._mascaramentoAcumulado);
    await api('auditorias/salvar', { processo_id: p.id, tipo_checkpoint: 'GERAL', achados_json: JSON.stringify(window.achadosAtuais), raw_ia: jsonStr, executado_por: usuarioAtual.email });
  } catch (e) {
    window._cobChecagem.iaFalhou = true;
    st.innerHTML = renderErroAmigavel(e.message);
    // A IA falhou, mas a conferência de contas por código não depende dela — mostra o
    // que ela achou, pra parte financeira nunca ficar sem cobertura.
    if (achadosCodigo.length) {
      window.achadosAtuais = achadosCodigo;
      renderizarCards(achadosCodigo);
      contadorEl.innerHTML = `<span style="background:#f8d7da; color:#842029; padding:6px 12px; border-radius:20px;">${achadosCodigo.length} inconsistência(s) de conta — a análise da IA não rodou</span>`;
    }
  } finally {
    if (intervaloTimer) clearInterval(intervaloTimer);
    if (banner) banner.classList.add('hidden');
    _atualizarCoberturaLeitura();
  }
}


// ==================== CARTÃO DO ACHADO: ONDE ESTÁ E TRECHO NO DOCUMENTO ====================
// Nome de documento legível: tira a posição na árvore ("[28]"), a extensão e os sublinhados;
// o número SEI (o que se digita no SEI para achar o documento) fica separado.
function _nomeAmigavelDoc(bruto) {
  let n = String(bruto || '').replace(/\.[a-z0-9]{2,5}$/i, '').replace(/^\s*\[\d+\]\s*-?\s*/, '');
  const m = n.match(/(?:^|[^\d])(\d{6,})(?=[_\-. ]|$)/);
  const sei = m ? m[1] : '';
  if (sei) n = n.replace(sei, ' ');
  n = n.replace(/_+/g, ' ').replace(/^\s*(GOVPE|SES)\s+/i, '').replace(/\s*SEI\s*[\d. ]+$/i, '').replace(/\s{2,}/g, ' ').replace(/^[-\s]+|[-\s]+$/g, '');
  return { nome: n || 'Documento', sei };
}

let _cacheDocs = { t: null, docs: [] };
function _docsDoTextoAtual() {
  if (_cacheDocs.t !== textoIntegralAtual) _cacheDocs = { t: textoIntegralAtual, docs: dividirPorDocumento(textoIntegralAtual) };
  return _cacheDocs.docs;
}

// A evidência pode trazer uma ou duas citações entre aspas (ex.: valor anual e valor mensal).
function _segmentosDaEvidencia(ev) {
  const s = String(ev || '').trim();
  if (!s) return [];
  const aspas = [...s.matchAll(/["“]([^"”]{6,400})["”]/g)].map(m => m[1].trim());
  return (aspas.length ? aspas : [s]).slice(0, 2);
}
function _regexDoTrecho(seg) {
  return new RegExp(seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'i');
}
function _acharNoDocumento(d, seg) {
  let m = _regexDoTrecho(seg).exec(d.texto), exato = true;
  if (!m && seg.length > 80) {                       // citação longa: tenta o começo e o fim
    m = _regexDoTrecho(seg.slice(0, 60)).exec(d.texto) || _regexDoTrecho(seg.slice(-60)).exec(d.texto);
    exato = false;
  }
  return m ? { pos: m.index, len: m[0].length, exato } : null;
}
function _limparTrechoDeTela(t) {
  return String(t).replace(/--- PÁGINA \d+ ---/g, '').replace(/\[leitura por OCR\]\n?/g, '').replace(/\n{3,}/g, '\n\n');
}
function _contextoDoTrecho(d, a) {
  const t = d.texto;
  const ini = Math.max(0, a.pos - 260), fim = Math.min(t.length, a.pos + a.len + 260);
  return { antes: _limparTrechoDeTela(t.slice(ini, a.pos)), trecho: t.slice(a.pos, a.pos + a.len), depois: _limparTrechoDeTela(t.slice(a.pos + a.len, fim)),
    pagina: _paginaNaPosicao(t, a.pos), exato: a.exato };
}
// Procura o trecho no texto REAL dos documentos. Se não achar, o achado vira suspeito
// ("trecho não localizado"): a IA pode ter lido errado ou inventado a citação.
function _localizarTrechos(c, emTodos = true) {
  const docs = _docsDoTextoAtual();
  const chave = c.doc_origem && c.doc_origem !== 'undefined' ? _chaveDoDocumento(c.doc_origem) : null;
  const preferidos = chave ? docs.filter(d => _chaveDoDocumento(d.nome) === chave) : [];
  const ordem = emTodos ? [...preferidos, ...docs.filter(d => !preferidos.includes(d))] : preferidos;
  return _segmentosDaEvidencia(c.evidencia).map(seg => {
    for (const d of ordem) {
      const a = _acharNoDocumento(d, seg);
      if (a) return Object.assign({ doc: d.nome, seg }, _contextoDoTrecho(d, a));
    }
    return { doc: null, seg, naoAchou: true };
  });
}

function _htmlOndeEsta(c, locs) {
  const docs = [];
  const add = (nome, pagina) => {
    if (!nome || nome === 'undefined') return;
    const k = _chaveDoDocumento(nome), ex = docs.find(x => x.k === k);
    if (ex) { if (!ex.pagina && pagina) ex.pagina = pagina; return; }
    docs.push({ k, nome, pagina });
  };
  (locs || []).forEach(l => { if (l.doc) add(l.doc, l.pagina); });
  add(c.doc_origem, c.pagina);
  if (!docs.length) return '<div style="font-size:0.8rem; color:var(--text-muted); margin-top:10px;"><i class="ti ti-file-unknown"></i> Documento de origem não identificado.</div>';
  return `<div style="margin-top:12px;"><div style="font-size:0.72rem; color:var(--text-muted); margin-bottom:4px;">Onde está</div>` + docs.map(d => {
    const f = _nomeAmigavelDoc(d.nome);
    return `<div style="display:flex; align-items:center; gap:10px; padding:6px 0; border-top:1px solid #f1f3f5;">
      <i class="ti ti-file-text" style="font-size:1.1rem; color:#6c757d;"></i>
      <div style="flex:1; min-width:0;"><div style="font-size:0.85rem; color:var(--text-dark);">${escHtml(f.nome)}</div>
        <div style="font-size:0.75rem; color:var(--text-muted);">${f.sei ? 'SEI nº ' + escHtml(f.sei) : 'sem número SEI no nome'}${d.pagina ? ' · página ' + escHtml(d.pagina) : ''}</div></div>
      ${f.sei ? `<button class="btn btn-secondary btn-sm" title="Copiar o número SEI para buscar no SEI" onclick="navigator.clipboard.writeText('${escAttr(f.sei)}'); mostrarToast('Número SEI copiado.');"><i class="ti ti-copy"></i></button>` : ''}
    </div>`;
  }).join('') + '</div>';
}

function abrirTrechoDocumento(cardId) {
  const c = window.memoriaCards && window.memoriaCards[cardId];
  if (!c) return;
  let locs = (window.memoriaTrechos || {})[cardId] || [];
  if (locs.some(l => l.naoAchou)) locs = _localizarTrechos(c, true);   // última tentativa, em todos os documentos
  window.memoriaTrechos[cardId] = locs;
  const blocos = locs.map(l => {
    if (l.naoAchou) return `<div style="margin-bottom:14px;"><div style="font-size:0.82rem; color:#854d0e; background:#fef9c3; padding:8px 10px; border-radius:6px; line-height:1.5;">
        <i class="ti ti-alert-triangle"></i> Não encontrei este trecho no texto dos documentos importados. Pode ser diferença de leitura do PDF ou a IA ter errado a citação. Confira no SEI antes de aceitar o achado.</div>
        <div style="font-size:0.72rem; color:var(--text-muted); margin:8px 0 4px;">O que a IA citou</div>
        <div style="font-size:0.85rem; font-style:italic; padding:8px 10px; background:#f8f9fa; border-radius:6px;">${escHtml(l.seg)}</div></div>`;
    const f = _nomeAmigavelDoc(l.doc);
    return `<div style="margin-bottom:14px;">
      <div style="font-size:0.88rem; font-weight:600;">${escHtml(f.nome)}</div>
      <div style="font-size:0.75rem; color:var(--text-muted);">${f.sei ? 'SEI nº ' + escHtml(f.sei) : ''}${l.pagina ? (f.sei ? ' · ' : '') + 'página ' + escHtml(l.pagina) : ''}</div>
      <div style="background:#f8f9fa; border:1px solid #dee2e6; border-radius:6px; padding:10px 12px; margin-top:6px; font-size:0.85rem; line-height:1.7; white-space:pre-wrap; max-height:38vh; overflow:auto;"><span style="color:var(--text-muted);">…</span>${escHtml(l.antes)}<mark style="background:#fff3bf; color:#5f3b00; padding:0 2px; border-radius:3px;">${escHtml(l.trecho)}</mark>${escHtml(l.depois)}<span style="color:var(--text-muted);">…</span></div>
      ${l.exato === false ? '<div style="font-size:0.72rem; color:var(--text-muted); margin-top:4px;">Parte da citação, porque o texto completo não bateu exatamente.</div>' : ''}</div>`;
  }).join('') || '<div style="font-size:0.85rem; color:var(--text-muted);">Este achado não trouxe um trecho para mostrar.</div>';
  criarModal(`<h2 style="font-size:1.1rem; margin-bottom:4px;">Trecho no documento</h2>
    <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px;">${escHtml(c.titulo || '')}</div>
    ${blocos}
    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
      <button class="btn btn-secondary btn-sm" onclick="copiarTrechoAchado('${escAttr(cardId)}')"><i class="ti ti-copy"></i> Copiar trecho</button>
      <button class="btn btn-secondary btn-sm" onclick="fixarEvidenciaDaMemoria('${escAttr(cardId)}'); fecharModal(); abrirPainelEvidencias();"><i class="ti ti-columns"></i> Abrir em tela dupla</button>
    </div>`);
}
function copiarTrechoAchado(cardId) {
  const locs = (window.memoriaTrechos || {})[cardId] || [];
  const texto = locs.map(l => l.naoAchou ? l.seg : l.trecho).join('\n\n');
  if (texto) { navigator.clipboard.writeText(texto); mostrarToast('Trecho copiado.'); }
}

function renderizarCards(cards) {
  const painel = document.getElementById('painel-cards');
  if (!cards || cards.length === 0) return painel.innerHTML = '<div class="alert alert-success">✓ Nenhum apontamento crítico detectado nesta checagem.</div>';
  let html = `<div style="margin-bottom:15px; text-align:right;"><button class="btn btn-secondary btn-sm" onclick="exportarRelatorioAchados()"><i class="ti ti-file-type-doc"></i> Exportar Relatório (.DOC)</button></div>`;
  cards.forEach((c, idx) => {
    const cardId = `rx-${idx}`;
    window.memoriaEvidencias[cardId] = { tag: c.tag, titulo: c.titulo, texto: c.explicacao + (Array.isArray(c.calculo) && c.calculo.length ? '\n\nMemória de cálculo:\n' + c.calculo.map(l => `• ${l[0]}: ${l[1]}`).join('\n') : '') + (c.sugestao ? `\n\n💡 O que fazer: ${c.sugestao}` : ''), doc: c.doc_origem };
    const ref = `${c.tag}: ${c.titulo}`;
    (window.memoriaCards = window.memoriaCards || {})[cardId] = c;
    (window.memoriaTrechos = window.memoriaTrechos || {})[cardId] = c.evidencia ? _localizarTrechos(c, textoIntegralAtual.length <= 1500000) : [];
    const locsDoCard = window.memoriaTrechos[cardId];
    const trechoNaoAchado = !!c.evidencia && !c.conferido_por_codigo && locsDoCard.some(l => l.naoAchou);
    // Sem extensão na exibição — o que importa pra localizar no SEI é o identificador, não ".pdf" no final
    const nomeDocBruto = c.doc_origem && c.doc_origem !== 'undefined' ? c.doc_origem : 'Não identificado';
    const nomeDoc = nomeDocBruto.replace(/\.(pdf|docx?|xlsx?)$/i, '');
    const tagVerificar = (c.verificar === false ? '' : `<span style="font-size:0.68rem;background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:10px;font-weight:600;margin-left:6px;">⚠ VERIFICAR</span>`)
      + (trechoNaoAchado ? `<span title="A IA citou um trecho que não aparece no texto dos documentos. Confira antes de aceitar o achado." style="font-size:0.68rem;background:#ffe3e3;color:#a61e4d;padding:2px 8px;border-radius:10px;font-weight:600;margin-left:6px;">TRECHO NÃO LOCALIZADO</span>` : '')
      + (c.conferido_por_codigo ? `<span title="Conta feita por regra fixa no código, não pela IA" style="font-size:0.68rem;background:#e7f5ff;color:#1864ab;padding:2px 8px;border-radius:10px;font-weight:600;margin-left:6px;">🔢 CONFERIDO POR CÓDIGO</span>` : '');
    html += `<div class="rx-card is-obice" id="${cardId}-div" data-referencia-achado="${escAttr(ref)}">
      <div class="rx-header" onclick="document.getElementById('${cardId}-div').classList.toggle('open')">
        <div><span class="rx-tag">${escHtml(c.tag)}</span> <span class="rx-title">${escHtml(c.titulo)}</span>${tagVerificar}</div>
      </div>
      <div class="rx-body">
        <p style="font-size:0.9rem; line-height:1.6; margin:0;">${escHtml(c.explicacao)}</p>
        ${_htmlOndeEsta(c, locsDoCard)}
        ${c.setor ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">Setor responsável: ${escHtml(c.setor)}</div>` : ''}
        ${Array.isArray(c.calculo) && c.calculo.length ? `
        <div style="margin-top:10px; border:1px solid #dee2e6; border-radius:6px; overflow:hidden;">
          <div style="font-size:0.72rem; font-weight:700; color:#495057; text-transform:uppercase; letter-spacing:0.4px; padding:6px 10px; background:#f8f9fa;"><i class="ti ti-calculator"></i> Memória de cálculo (feita por código)</div>
          <table style="width:100%; border-collapse:collapse; font-size:0.82rem;">${c.calculo.map(l => `<tr><td style="padding:5px 10px; border-top:1px solid #f1f3f5;">${escHtml(l[0])}</td><td style="padding:5px 10px; border-top:1px solid #f1f3f5; text-align:right; white-space:nowrap; font-weight:600;">${escHtml(l[1])}</td></tr>`).join('')}</table>
        </div>` : ''}
        ${c.sugestao ? `
        <div style="margin-top:10px; background:#e6fcf5; border-left:3px solid #12b886; border-radius:4px; padding:8px 12px;">
          <div style="font-size:0.72rem; font-weight:700; color:#087f5b; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:3px;"><i class="ti ti-bulb"></i> O que fazer</div>
          <div style="font-size:0.85rem; color:#0b6157;">${escHtml(c.sugestao)}</div>
        </div>` : ''}
        <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
          ${c.evidencia ? `<button class="btn btn-sm btn-secondary" onclick="abrirTrechoDocumento('${cardId}')"><i class="ti ti-quote"></i> Ver trecho no documento</button>` : ''}
          <button class="btn btn-sm" style="background:#0dcaf0;" onclick="fixarEvidenciaDaMemoria('${cardId}')"><i class="ti ti-pin"></i> Fixar</button>
          <button class="btn btn-sm" style="background:#495057; color:#fff;" onclick="modalEncaminharAchado('${escAttr(ref)}')"><i class="ti ti-send"></i> Encaminhar Achado</button>
        </div>
        <div class="status-consulta-achado" style="margin-top:10px;"></div>
      </div>
    </div>`;
  });
  painel.innerHTML = html;
  carregarStatusConsultasAchados();
}

async function modalEncaminharAchado(ref) {
  const res = await api('usuarios/listar');
  const usuarios = (res.usuarios || []).filter(u => u.email !== usuarioAtual.email);
  const opcoes = usuarios.map(u => `<option value="${escAttr(u.email)}">${escHtml(u.nome)}</option>`).join('');
  criarModal(`<h2>Encaminhar Achado</h2><input type="hidden" id="enc-ach-referencia" value="${escAttr(ref)}"><select id="enc-ach-destinatario" style="width:100%;padding:8px;margin-bottom:10px;">${opcoes}</select><textarea id="enc-ach-mensagem" placeholder="Sua pergunta..." style="width:100%;min-height:70px;padding:8px;margin-bottom:10px;"></textarea><button class="btn btn-primary" onclick="confirmarEncaminharAchado()">Enviar</button>`, false);
}

async function confirmarEncaminharAchado() {
  const referencia = document.getElementById('enc-ach-referencia').value;
  const destinatario = document.getElementById('enc-ach-destinatario').value;
  const mensagem = document.getElementById('enc-ach-mensagem').value.trim();
  await api('achados/encaminhar', { processo_id: processoAtual.id, achado_referencia: referencia, de_usuario: usuarioAtual.email, para_usuario: destinatario, mensagem });
  fecharModal();
  carregarStatusConsultasAchados();
}

async function carregarStatusConsultasAchados() {
  if (!processoAtual) return;
  try {
    const res = await api('achados/listar', { processo_id: processoAtual.id });
    const consultas = res.consultas || [];
    document.querySelectorAll('[data-referencia-achado]').forEach(cardDiv => {
      const ref = cardDiv.getAttribute('data-referencia-achado');
      const statusEl = cardDiv.querySelector('.status-consulta-achado');
      if (!statusEl) return;
      const consulta = consultas.find(c => c.achado_referencia === ref);
      if (!consulta) return;
      if (consulta.resposta) {
        statusEl.innerHTML = `<div style="background:#e7f5ff;padding:8px;border-radius:4px;"><strong>Resposta:</strong> ${escHtml(consulta.resposta)}</div>`;
      } else if (String(consulta.para_usuario).toLowerCase() === String(usuarioAtual.email).toLowerCase()) {
        statusEl.innerHTML = `<div style="background:#fff9db;padding:8px;border-radius:4px;"><strong>Pergunta de ${escHtml(consulta.de_usuario)}:</strong> "${escHtml(consulta.mensagem)}"<textarea id="resp-${consulta.id}" style="width:100%;margin-top:5px;"></textarea><button class="btn btn-sm btn-primary" onclick="responderConsultaAchado(${consulta.id})">Responder</button></div>`;
      }
    });
  } catch (e) {}
}

async function responderConsultaAchado(id) {
  const resp = document.getElementById('resp-' + id).value.trim();
  if (!resp) return;
  await api('achados/responder', { id, resposta: resp });
  carregarStatusConsultasAchados();
}

// Filtra o texto integral pra só os parágrafos que contêm palavra-chave da pergunta —
// usado apenas quando o texto acumulado é grande (ver LIMIAR_FILTRAGEM no chamador).
// Sem isso, processo muito grande podia demorar demais ou estourar limite da IA.
function extrairTrechosRelevantes(textoIntegral, pergunta) {
  const palavrasChave = pergunta.toLowerCase()
    .replace(/[^\w\sáéíóúâêîôûãõç]/g, '')
    .split(/\s+/)
    .filter(p => p.length > 3);
  if (!palavrasChave.length) return textoIntegral.substring(0, 15000);

  const trechosDocumento = textoIntegral.split('--- DOC: ');
  let blocosRelevantes = [];
  trechosDocumento.forEach(docTexto => {
    if (!docTexto.trim()) return;
    const linhas = docTexto.split('\n');
    const nomeDoc = linhas[0] || 'Desconhecido';
    const corpo = linhas.slice(1).join('\n');
    corpo.split(/\n\s*\n/).forEach(par => {
      const parLower = par.toLowerCase();
      const score = palavrasChave.reduce((s, pal) => s + (parLower.includes(pal) ? 1 : 0), 0);
      if (score > 0) blocosRelevantes.push({ doc: nomeDoc, texto: par, score });
    });
  });
  blocosRelevantes.sort((a, b) => b.score - a.score);
  if (!blocosRelevantes.length) return textoIntegral.substring(0, 20000); // nada bateu — melhor mandar algo do que nada

  return 'TRECHOS MAIS RELEVANTES ENCONTRADOS NOS DOCUMENTOS PARA ESTA PERGUNTA:\n' +
    blocosRelevantes.slice(0, 8).map((b, i) => `\n[${i + 1}] Documento: ${b.doc}\nTrecho: "${b.texto.trim()}"\n`).join('');
}

// ==================== HISTÓRICO DE PERGUNTAS DO PROCESSO ====================
// Coluna ao lado da conversa, com TODAS as perguntas já feitas neste processo (por você e
// pelos colegas), da mais recente para a mais antiga. Cada uma mostra quem perguntou e
// quando; clicando, abre a resposta.
window._historicoConsultas = [];
let _mapaNomesUsuarios = null;

async function _garantirNomesUsuarios() {
  if (_mapaNomesUsuarios) return;
  const res = await api('usuarios/listar');
  if (res.ok) {
    _mapaNomesUsuarios = {};
    (res.usuarios || []).forEach(u => { _mapaNomesUsuarios[String(u.email).toLowerCase()] = u.nome; });
  }
}

function _nomeDeQuemPerguntou(email) {
  const e = String(email || '').toLowerCase();
  if (usuarioAtual && e === String(usuarioAtual.email).toLowerCase()) return 'Você';
  return (_mapaNomesUsuarios && _mapaNomesUsuarios[e]) || email || 'Colega';
}

// Carrega do servidor, com até 3 tentativas se ele estiver ocupado. Se não conseguir,
// diz isso na tela e oferece "Tentar de novo" — nunca fica vazio sem explicação.
async function carregarHistoricoConsultas(processoId, tentativa = 1) {
  const lista = document.getElementById('lista-historico-consultas');
  if (!lista) return;
  if (tentativa === 1) lista.innerHTML = '<span class="spinner"></span> <span style="font-size:0.8rem;">Carregando histórico...</span>';
  const res = await api('consultas/listar', { processo_id: processoId });
  // A pessoa pode ter trocado de processo enquanto carregava — não mistura históricos.
  if (!processoAtual || String(processoAtual.id) !== String(processoId)) return;
  const listaAgora = document.getElementById('lista-historico-consultas');
  if (!listaAgora) return;
  if (!res.ok) {
    if (res.sessao_expirada) return;
    if (tentativa < 3) {
      listaAgora.innerHTML = `<span class="spinner"></span> <span style="font-size:0.8rem;">Servidor ocupado, tentando de novo (${tentativa + 1}/3)...</span>`;
      await new Promise(r => setTimeout(r, tentativa * 2500));
      return carregarHistoricoConsultas(processoId, tentativa + 1);
    }
    listaAgora.innerHTML = `<div style="font-size:0.8rem; color:#495057;">Não foi possível carregar o histórico agora.
      <a href="#" onclick="carregarHistoricoConsultas('${escAttr(String(processoId))}'); return false;">Tentar de novo</a></div>
      <div style="font-size:0.7rem; color:#868e96; margin-top:4px;">${escHtml(res.erro || '')}</div>`;
    return;
  }
  await _garantirNomesUsuarios();
  // Mantém as perguntas desta tela que ainda não foram confirmadas pelo servidor.
  const naoConfirmadas = (window._historicoConsultas || []).filter(c => c.estado === 'salvando' || c.estado === 'falhou');
  window._historicoConsultas = (res.consultas || []).map(c => Object.assign({}, c, { estado: 'salvo' })).concat(naoConfirmadas);
  renderHistoricoConsultas();
}

function renderHistoricoConsultas() {
  const lista = document.getElementById('lista-historico-consultas');
  const contador = document.getElementById('contador-historico-consultas');
  if (!lista) return;
  const itens = [...(window._historicoConsultas || [])].sort((a, b) => new Date(b.data) - new Date(a.data));
  if (contador) contador.textContent = itens.length ? `${itens.length} pergunta(s)` : '';
  if (!itens.length) {
    lista.innerHTML = '<div style="font-size:0.8rem; color:#868e96; font-style:italic;">Nenhuma pergunta feita neste processo ainda.</div>';
    return;
  }
  lista.innerHTML = itens.map(c => {
    const chave = c.id ? 'hist-' + c.id : c.tempId;
    const quando = c.data ? new Date(c.data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    const situacao = c.estado === 'salvando'
      ? ' · <span style="color:#868e96;">salvando...</span>'
      : c.estado === 'falhou'
        ? ` · <span style="color:#495057;">não foi salva — <a href="#" onclick="event.preventDefault(); event.stopPropagation(); salvarConsultaNoHistorico('${escAttr(c.tempId)}');">tentar de novo</a></span>`
        : '';
    return `<details style="background:#fff; border:1px solid #dee2e6; border-radius:6px; padding:8px 10px; margin-bottom:8px;">
      <summary style="cursor:pointer; font-size:0.82rem; color:#212529;">
        <span style="font-weight:600;">${escHtml(c.pergunta)}</span>
        <div style="font-size:0.7rem; color:#6c757d; margin-top:2px;">${escHtml(_nomeDeQuemPerguntou(c.usuario))} · ${escHtml(quando)}${situacao}</div>
      </summary>
      <div style="font-size:0.82rem; color:#343a40; white-space:pre-wrap; margin-top:8px; padding-top:8px; border-top:1px dashed #dee2e6;">${escHtml(c.resposta)}</div>
      <div style="text-align:right; margin-top:6px;">
        <button class="btn btn-sm btn-secondary" style="font-size:0.72rem; padding:2px 8px;" onclick="fixarConsultaDoHistorico('${escAttr(chave)}')"><i class="ti ti-pin"></i> Fixar na Tela 2</button>
      </div>
    </details>`;
  }).join('');
}

// Grava uma pergunta no histórico, conferindo a resposta do servidor. Se ele estiver
// ocupado, tenta mais 2 vezes; se ainda assim falhar, marca "não foi salva" com botão
// para tentar de novo. Devolve true se salvou.
async function salvarConsultaNoHistorico(tempId, tentativa = 1) {
  const item = (window._historicoConsultas || []).find(c => c.tempId === tempId);
  if (!item) return false;
  item.estado = 'salvando';
  renderHistoricoConsultas();
  const res = await api('consultas/salvar', {
    processo_id: item.processo_id, pergunta: item.pergunta, resposta: item.resposta, usuario: usuarioAtual.email
  });
  if (res.ok) {
    item.estado = 'salvo';
    if (res.consulta) { item.id = res.consulta.id; item.data = res.consulta.data; }
    renderHistoricoConsultas();
    return true;
  }
  // Sessão vencida: fica "não foi salva" e é salva sozinha quando a pessoa entrar de novo.
  if (!res.sessao_expirada && tentativa < 3) {
    await new Promise(r => setTimeout(r, tentativa * 2500));
    return salvarConsultaNoHistorico(tempId, tentativa + 1);
  }
  item.estado = 'falhou';
  renderHistoricoConsultas();
  return false;
}

function fixarConsultaDoHistorico(chave) {
  const c = (window._historicoConsultas || []).find(x => (x.id ? 'hist-' + x.id : x.tempId) === chave);
  if (!c) return;
  window.memoriaEvidencias[chave] = { tag: 'Investigação', titulo: `P: ${c.pergunta}`, texto: c.resposta, doc: 'Histórico de perguntas' };
  fixarEvidenciaDaMemoria(chave);
}

// ==================== PEDIDO DE TEXTO NO "PERGUNTE AO PROCESSO" ====================
// O card 2 vira o lugar de pedir ("preciso de uma nota técnica sobre..."); o sistema confirma o
// tipo e os temas e monta o rascunho no card 3, já preenchido com o que foi lido dos documentos
// e do histórico da unidade, com a fonte de cada fato entre colchetes e o que faltar como [preencher].
const EXEMPLO_PEDIDO_REDACAO = 'Preciso de uma nota técnica sobre a necessidade de ampliação de leitos ou o não atingimento de metas desta unidade. Monte um modelo.';

const TIPOS_REDACAO = [
  { nome: 'nota técnica', re: 'nota\\s+t[ée]cnica' },
  { nome: 'parecer técnico', re: 'parecer(?:\\s+t[ée]cnico)?' },
  { nome: 'despacho', re: 'despacho' },
  { nome: 'ofício', re: 'of[ií]cio' },
  { nome: 'relatório', re: 'relat[óo]rio' },
  { nome: 'minuta', re: 'minuta' },
  { nome: 'memorando', re: 'memorando' }
];

const ESTRUTURAS_RASCUNHO = {
  'nota técnica': 'cabeçalho (NOTA TÉCNICA Nº [preencher]/ANO, assunto, unidade, OSS e processo SEI); 1. OBJETO; 2. HISTÓRICO E FUNDAMENTAÇÃO CONTRATUAL (contrato, aditivos e apostilamentos em ordem de data); 3. ANÁLISE (uma subseção por tema, com previsto, realizado e diferença quando houver números); 4. CONCLUSÃO E ENCAMINHAMENTO; local, data e assinatura em [preencher]',
  'parecer técnico': 'ementa; 1. RELATÓRIO; 2. ANÁLISE TÉCNICA (um item por tema); 3. CONCLUSÃO; local, data e assinatura em [preencher]',
  'despacho': 'DESPACHO; destinatário [preencher]; um parágrafo de referência ao processo; um a dois parágrafos de síntese dos pontos; um parágrafo com a providência solicitada; fecho em [preencher]',
  'ofício': 'OFÍCIO Nº [preencher]; local e data; destinatário [preencher]; assunto; saudação; corpo em dois a quatro parágrafos; fecho; assinatura [preencher]',
  'relatório': 'cabeçalho; 1. OBJETO; 2. CONTEXTO; 3. ANÁLISE (uma subseção por tema); 4. CONCLUSÃO; assinatura em [preencher]',
  'minuta': 'cabeçalho; 1. OBJETO; 2. CONTEXTO; 3. ANÁLISE (uma subseção por tema); 4. CONCLUSÃO; assinatura em [preencher]',
  'memorando': 'cabeçalho; 1. OBJETO; 2. CONTEXTO; 3. ANÁLISE (uma subseção por tema); 4. CONCLUSÃO; assinatura em [preencher]'
};

// Só considera pedido de texto quando há verbo de redigir ligado ao tipo de documento
// ("fazer uma nota técnica", "preciso de um despacho"). "O que fazer com o despacho?" é pergunta.
function _detectarPedidoDeRedacao(texto) {
  const t = String(texto || '');
  const det = '(?:(?:um|uma|o|a|os|as|nova|novo|outra|outro|essa|esse|nossa|nosso|minha|meu)\\s+){0,2}';
  const verbos = '(?:fazer|redigir|montar|monte|escrever|escreva|elaborar|elabore|preparar|prepare|produzir|criar|crie|gerar|gere|minutar|minute|rascunhar|rascunhe)';
  for (const tp of TIPOS_REDACAO) {
    const p1 = new RegExp('\\b' + verbos + '\\s+' + det + tp.re + '\\b', 'i');
    const p2 = new RegExp('\\b(?:preciso|precisamos|quero|queremos|necessito|necessitamos)\\s+d[eoa]\\s+' + det + tp.re + '\\b', 'i');
    if (p1.test(t) || p2.test(t)) return { tipo: tp.nome, temas: _extrairTemasDoPedido(t) };
  }
  return null;
}

function _extrairTemasDoPedido(t) {
  const m = String(t).match(/\b(?:sobre|acerca\s+d[eoa]s?|a\s+respeito\s+d[eoa]s?|referente\s+(?:a|ao|à)s?|com\s+foco\s+em|com\s+base\s+em)\s+(.+)/i);
  if (!m) return [];
  let resto = m[1].split(/[.!?\n]/)[0];
  resto = resto.replace(/\s+(?:desta|dessa|da|nesta|nessa)\s+unidade\b.*$/i, '');   // "desta unidade" não é tema
  return resto.split(/\s+(?:ou|e)\s+|,|;/i)
    .map(s => s.trim().replace(/^(?:a|o|as|os|um|uma)\s+/i, ''))
    .filter(s => s.length > 3).slice(0, 5);
}

function usarExemploPedido() {
  fecharModal();
  const i = document.getElementById('chat-input');
  if (!i) return;
  i.value = EXEMPLO_PEDIDO_REDACAO;
  i.scrollIntoView({ behavior: 'smooth', block: 'center' });
  i.focus();
}

function _mostrarConfirmacaoRedacao(pergunta, pedido) {
  const history = document.getElementById('chat-history');
  document.getElementById('redacao-confirma')?.remove();
  window._redacaoPendente = { pergunta, tipo: pedido.tipo, temas: pedido.temas };
  const temas = pedido.temas.map(t => `<label style="display:flex; gap:6px; align-items:flex-start; font-size:0.85rem; margin:3px 0;"><input type="checkbox" class="redacao-tema" value="${escAttr(t)}" checked style="margin-top:3px;"> <span>${escHtml(t)}</span></label>`).join('');
  history.insertAdjacentHTML('beforeend', `<div id="redacao-confirma" style="background:#fff; border:1px solid #adb5bd; border-radius:10px; padding:12px 14px; max-width:94%; font-size:0.88rem;">
    <div style="margin-bottom:6px;"><i class="ti ti-file-text"></i> Entendi como pedido de texto: <strong>${escHtml(pedido.tipo)}</strong></div>
    <div style="font-size:0.78rem; color:var(--text-muted); margin-bottom:6px;">Seu pedido: “${escHtml(pergunta)}”</div>
    ${temas ? `<div style="font-size:0.78rem; color:var(--text-muted);">Temas (desmarque o que não quer no texto):</div>${temas}` : '<div style="font-size:0.82rem; color:#854d0e;">Não identifiquei o tema. Escreva abaixo.</div>'}
    <input id="redacao-outro-tema" placeholder="Outro tema ou observação (opcional)" style="width:100%; margin:8px 0; padding:8px; border:1px solid #ced4da; border-radius:6px; font-size:0.85rem;">
    <div style="display:flex; gap:8px; flex-wrap:wrap;">
      <button class="btn btn-primary btn-sm" id="btn-montar-rascunho" onclick="montarRascunhoRedacao()"><i class="ti ti-pencil"></i> Montar rascunho no card 3</button>
      <button class="btn btn-secondary btn-sm" onclick="tratarComoPergunta()">Não, é uma pergunta</button>
    </div></div>`);
  history.scrollTop = history.scrollHeight;
}

function tratarComoPergunta() {
  const pend = window._redacaoPendente;
  document.getElementById('redacao-confirma')?.remove();
  if (pend) fazerPerguntaAoProcesso(pend.pergunta);
}

function _lerRespostaDoRascunho(resposta) {
  const s = String(resposta || '');
  let obj = null;
  try { obj = JSON.parse(s); } catch (e) { obj = null; }
  if (!obj) {
    const m = s.match(/"texto"\s*:\s*"([\s\S]*?)"\s*(?:,\s*"[a-z_]+"\s*:|\})\s*$/);
    if (m) {
      try { obj = { texto: JSON.parse('"' + m[1] + '"') }; } catch (e) { obj = { texto: m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"') }; }
    }
  }
  if (obj && typeof obj.texto === 'string' && obj.texto.trim()) {
    return { texto: obj.texto.trim(), assumi: Array.isArray(obj.assumi) ? obj.assumi : [], faltou: Array.isArray(obj.faltou) ? obj.faltou : [] };
  }
  return { texto: s.replace(/```json|```/g, '').trim(), assumi: [], faltou: [] };
}

async function montarRascunhoRedacao() {
  const pend = window._redacaoPendente;
  if (!pend || !processoAtual) return;
  const marcados = [...document.querySelectorAll('.redacao-tema:checked')].map(c => c.value);
  const outro = (document.getElementById('redacao-outro-tema')?.value || '').trim();
  const temas = outro ? [...marcados, outro] : marcados;
  if (!temas.length) { alert('Escolha ou escreva pelo menos um tema.'); return; }
  const botao = document.getElementById('btn-montar-rascunho');
  if (botao) botao.disabled = true;
  const notas = document.getElementById('redacao-notas');
  const p = processoAtual;
  notas.innerHTML = '<div style="font-size:0.85rem;"><span class="spinner"></span> Montando o rascunho a partir dos documentos e do histórico da unidade...</div>';
  notas.scrollIntoView({ behavior: 'smooth', block: 'center' });
  try {
    const consulta = `${pend.tipo} ${temas.join(' ')} ${pend.pergunta}`;
    const contexto = textoIntegralAtual.length > LIMITE_CHARS_LOTE
      ? extrairTrechosRelevantes(textoIntegralAtual, consulta).substring(0, LIMITE_CHARS_LOTE)
      : textoIntegralAtual;
    let valores = '';
    try { valores = _dadosExtraidosCompactos(textoIntegralAtual).substring(0, 40000); } catch (e) { valores = ''; }
    const achados = (window.achadosAtuais || []).slice(0, 30).map(a => `- ${a.titulo}: ${a.explicacao}`).join('\n');
    let historico = '';
    if (p.unidade) {
      try {
        const r = await api('normas/buscar-por-unidade', { unidade: p.unidade });
        if (r.ok && r.encontrado) historico = r.arquivos.map(a => `--- ${a.nome} ---\nVALORES: ${(a.valores || []).map(v => v.valor).join('; ')}\nDATAS: ${(a.datas || []).map(v => v.valor).join('; ')}`).join('\n');
      } catch (e) { historico = ''; }
    }
    const prompt = `Você redige minutas para um analista da Secretaria de Saúde de Pernambuco (contratos de gestão com Organizações Sociais de Saúde). Monte um RASCUNHO de ${pend.tipo}.

PEDIDO DO ANALISTA: "${pend.pergunta}"
TEMAS A TRATAR:
${temas.map(t => '- ' + t).join('\n')}
UNIDADE: ${p.unidade || '[preencher]'} | OSS: ${p.oss || '[preencher]'} | PROCESSO SEI: ${p.numero_sei || '[preencher]'}

REGRAS OBRIGATÓRIAS:
1. Use SOMENTE fatos que estejam nos DOCUMENTOS, nos VALORES EXTRAÍDOS ou no HISTÓRICO abaixo. Nunca invente número, data, cláusula, nome ou norma.
2. Ao lado de cada afirmação de fato, coloque a fonte entre colchetes: [SEI nº NÚMERO, p. PÁGINA]. O número SEI é o que aparece no nome do arquivo (ex.: 83015982_Anexo... vira 83015982); a página vem dos marcadores "--- PÁGINA N ---", quando houver. Sem página, só o número.
3. O que faltar para sustentar um ponto vira um marcador [preencher: o que falta]. Não complete com suposição.
4. Quando os temas vierem ligados por "ou", examine qual deles os documentos sustentam e escreva a conclusão conforme os números. Se os documentos mostrarem que o tema não se sustenta (por exemplo, meta atingida), diga isso com os números. Não force a conclusão.
5. A informação mais recente prevalece: se contrato, aditivos e apostilamentos tratam do mesmo dado, use o mais recente e diga qual.
6. Texto em português claro, parágrafos curtos, linguagem simples e formal. Texto puro: SEM markdown, sem asteriscos e sem listas com hífen no início da linha. Títulos das seções em MAIÚSCULAS e numerados.
7. Deixe [preencher] em número do documento, data, destinatário e assinatura.
8. Os PONTOS APONTADOS PELA CHECAGEM são pontos a confirmar, nunca fatos provados.

ESTRUTURA: ${ESTRUTURAS_RASCUNHO[pend.tipo] || ESTRUTURAS_RASCUNHO['relatório']}

Responda SOMENTE com JSON: {"assumi": ["o que você interpretou ou assumiu do pedido"], "faltou": ["informações que não encontrou nos documentos e ficaram como [preencher]"], "texto": "o rascunho completo"}

VALORES EXTRAÍDOS POR CÓDIGO, POR DOCUMENTO:
${valores || '(nenhum)'}

HISTÓRICO CONTRATUAL DA UNIDADE (pasta do Drive; o casamento é por nome, confirme):
${historico || '(nada encontrado)'}

PONTOS APONTADOS PELA CHECAGEM:
${achados || '(a checagem ainda não foi feita ou não apontou nada)'}

DOCUMENTOS DO PROCESSO:
${contexto}`;
    const resposta = await invocarIAComFallback(prompt, false, notas);
    const r = _lerRespostaDoRascunho(resposta);
    const editor = document.getElementById('editor-final');
    if (editor.value.trim() && !confirm('O card 3 já tem um texto. Substituir pelo rascunho? (Cancelar coloca o rascunho abaixo do texto atual.)')) {
      editor.value = editor.value.trim() + '\n\n---------- RASCUNHO ----------\n\n' + r.texto;
    } else {
      editor.value = r.texto;
    }
    const cob = analisarCoberturaLeitura();
    const aviso = [];
    if (cob.faltam.length) aviso.push('faltam documentos na sequência (' + cob.faltam.map(n => '[' + String(n).padStart(2, '0') + ']').join(', ') + ')');
    if (cob.semTexto.length) aviso.push(cob.semTexto.length + ' documento(s) sem texto lido');
    if (cob.ocr.length) aviso.push(cob.ocr.length + ' documento(s) com páginas lidas por OCR');
    if (cob.falhas.length) aviso.push(cob.falhas.length + ' aviso(s) de importação em aberto');
    const lista = (titulo, itens) => itens.length ? `<div style="margin-top:6px;"><strong>${titulo}</strong><ul style="margin:4px 0 0 18px; padding:0;">${itens.map(i => `<li>${escHtml(i)}</li>`).join('')}</ul></div>` : '';
    notas.innerHTML = `<div style="background:#e7f5ff; border-left:3px solid #339af0; padding:10px 12px; border-radius:4px; margin-bottom:12px; font-size:0.85rem; line-height:1.5;">
      <strong>Rascunho de ${escHtml(pend.tipo)} montado abaixo.</strong> As fontes ficam entre colchetes, e o que faltou ficou como [preencher]. Confira cada fonte e apague os colchetes antes de assinar.
      ${lista('O que assumi do seu pedido:', r.assumi)}${lista('O que faltou nos documentos:', r.faltou)}
      ${aviso.length ? `<div style="margin-top:8px; color:#854d0e;"><i class="ti ti-alert-triangle"></i> A leitura do processo tem pontos de atenção (${escHtml(aviso.join('; '))}). O rascunho pode estar incompleto. Veja a Cobertura da leitura.</div>` : ''}
    </div>`;
    document.getElementById('redacao-confirma')?.remove();
    document.getElementById('chat-history').insertAdjacentHTML('beforeend', `<div style="color:#2b8a3e; font-size:0.85rem;"><i class="ti ti-check"></i> Rascunho de ${escHtml(pend.tipo)} montado no card 3 (${escHtml(temas.join('; '))}).</div>`);
    window._redacaoPendente = null;
    editor.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (e) {
    notas.innerHTML = renderErroAmigavel(e.message);
    if (botao) botao.disabled = false;
  }
}

async function fazerPerguntaAoProcesso(textoForcado = null) {
  const input = document.getElementById('chat-input');
  const history = document.getElementById('chat-history');
  const btn = document.getElementById('btn-perguntar');
  const pergunta = (typeof textoForcado === 'string' ? textoForcado : input.value).trim();
  if (!pergunta) return;
  if (!textoIntegralAtual || textoIntegralAtual.trim().length < 20) {
    history.innerHTML += `<div style="color:#c92a2a; font-size:0.85rem;">Nenhum documento importado neste processo ainda — importe antes de perguntar.</div>`;
    return;
  }

  document.getElementById('chat-vazio')?.remove();
  // Pedido de texto ("preciso de uma nota técnica sobre...") vai para a confirmação e para o card 3.
  if (typeof textoForcado !== 'string') {
    const pedido = _detectarPedidoDeRedacao(pergunta);
    if (pedido) { input.value = ''; _mostrarConfirmacaoRedacao(pergunta, pedido); return; }
  }
  history.innerHTML += `
      <div style="background:#e9ecef; padding:10px 15px; border-radius:15px 15px 15px 0; align-self:flex-start; max-width:85%; font-size: 0.9rem; color: #212529;">
          <strong><i class="ti ti-user"></i> Você:</strong><br>${escHtml(pergunta)}
      </div>`;
  input.value = '';
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Localizando nos documentos...'; }
  history.scrollTop = history.scrollHeight;

  // Por padrão manda o texto INTEIRO — o objetivo da ferramenta é não deixar passar
  // inconsistência nenhuma. O filtro por relevância só entra em volume realmente grande,
  // como válvula de escape, não como economia de rotina.
  const contextoDocs = textoIntegralAtual.length > LIMITE_CHARS_LOTE
    ? extrairTrechosRelevantes(textoIntegralAtual, pergunta).substring(0, LIMITE_CHARS_LOTE)
    : textoIntegralAtual;

  const prompt = `Você é um assistente investigativo sênior. O usuário fará uma pergunta sobre o processo em anexo.
Responda EXCLUSIVAMENTE com base nos documentos. Se a resposta não estiver clara nos documentos, diga
"A informação não foi encontrada nos documentos anexados."

MUITO IMPORTANTE — INFORMAÇÃO MAIS RECENTE:
Os documentos podem incluir o contrato original e vários aditivos/apostilamentos ao longo do tempo, cada
um podendo alterar o que veio antes. Ao responder:
1. Se mais de um documento tratar do mesmo dado com informações diferentes, use APENAS o documento com
   a data mais recente como resposta — nunca misture ou faça média entre versões.
2. Diga explicitamente qual documento e qual data você usou como base.
3. Se o documento mais recente que você tem acesso parecer antigo e a pergunta assumir que existe algo
   mais novo ainda não importado, avise isso explicitamente.

Seja analítico, claro e vá direto ao ponto. Sempre cite o NOME DO ARQUIVO que você usou para responder.

PERGUNTA DO USUÁRIO: "${pergunta}"

DOCUMENTOS:
${contextoDocs}`;

  try {
    const resposta = await invocarIAComFallback(prompt, true);
    const respId = `chat-${Date.now()}`;
    window.memoriaEvidencias[respId] = { tag: 'Investigação', titulo: `P: ${pergunta}`, texto: resposta, doc: 'Resposta do Chat' };
    history.innerHTML += `
        <div style="background:#e7f5ff; border: 1px solid #74c0fc; padding:10px 15px; border-radius:15px 15px 0 15px; align-self:flex-end; max-width:85%; font-size: 0.9rem; color: #0b509e;">
            <strong><i class="ti ti-robot"></i> IA Investigadora:</strong><br>
            <div style="white-space: pre-wrap; margin-top:5px;">${escHtml(resposta)}</div>
            <div style="text-align:right; margin-top:10px;">
                <button class="btn btn-sm" style="background-color:#0dcaf0; color:#000; border:none; font-size:0.75rem; font-weight:bold; padding:4px 8px; border-radius:4px;" onclick="fixarEvidenciaDaMemoria('${respId}')"><i class="ti ti-pin"></i> Fixar na Tela 2</button>
            </div>
        </div>`;
    // Entra no histórico ao lado na hora, marcado "salvando...", e só vira "salvo" quando
    // o servidor confirmar — nada de sumir em silêncio.
    const item = {
      tempId: 'tmp' + Date.now() + Math.floor(Math.random() * 1000),
      processo_id: processoAtual.id, pergunta, resposta,
      usuario: usuarioAtual.email, data: new Date().toISOString(), estado: 'salvando'
    };
    window._historicoConsultas = window._historicoConsultas || [];
    window._historicoConsultas.push(item);
    renderHistoricoConsultas();
    salvarConsultaNoHistorico(item.tempId);
  } catch (e) {
    const { titulo, sugestao } = _mensagemErroAmigavel(e.message);
    history.innerHTML += `<div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:8px 12px; margin-top:5px; max-width:85%; align-self:flex-end; font-size:0.82rem; color:#7c2d12;">
      <i class="ti ti-cloud-exclamation" style="color:#c2410c;"></i> ${escHtml(titulo)} <span style="color:#9a3412;">${escHtml(sugestao)}</span>
    </div>`;
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-send"></i> Perguntar'; }
  history.scrollTop = history.scrollHeight;
}

async function rodarRevisaoFinal() {
  const st = document.getElementById('status-revisao');
  const contadorEl = document.getElementById('contador-revisao');
  contadorEl.innerHTML = '';
  const txtAnalista = document.getElementById('editor-final').value.trim();
  // Processo grande demais para ir inteiro: valores de todos os documentos + trechos ligados ao texto.
  let contextoRevisao = textoIntegralAtual;
  let revisaoResumida = false;
  if (textoIntegralAtual.length > LIMITE_CHARS_LOTE) {
    revisaoResumida = true;
    contextoRevisao = ('(Processo grande demais para ir inteiro. Abaixo: valores extraídos por código de TODOS os documentos, '
      + 'seguidos dos trechos mais ligados ao texto do analista.)\n\nVALORES EXTRAÍDOS:\n'
      + _dadosExtraidosCompactos(textoIntegralAtual) + '\n\nTRECHOS RELEVANTES:\n'
      + extrairTrechosRelevantes(textoIntegralAtual, txtAnalista.substring(0, 4000))).substring(0, LIMITE_CHARS_LOTE);
  }
  if (!txtAnalista) return st.innerHTML = '<div class="alert alert-danger">Cole o seu parecer na caixa de texto primeiro.</div>';
  const p = processoAtual;
  st.innerHTML = `<span class="spinner"></span> Revisando cruzamento entre parecer e documentos...`;

  _garantirEstiloPulso();
  const banner = document.getElementById('banner-conferindo');
  const bannerDetalhe = document.getElementById('banner-conferindo-detalhe');
  const bannerTimer = document.getElementById('banner-conferindo-timer');
  const bannerTitulo = document.getElementById('banner-conferindo-titulo');
  let segundosDecorridos = 0;
  let intervaloTimer = null;
  if (banner) {
    if (bannerTitulo) bannerTitulo.textContent = 'ESTOU REVISANDO O PARECER...';
    if (bannerDetalhe) bannerDetalhe.textContent = `${Math.round(txtAnalista.length / 1000)} mil caracteres no parecer`;
    banner.classList.remove('hidden');
    if (bannerTimer) {
      bannerTimer.textContent = '0s';
      intervaloTimer = setInterval(() => { segundosDecorridos++; bannerTimer.textContent = segundosDecorridos + 's'; }, 1000);
    }
  }

  const prompt = `Você é um Revisor Técnico (SES-PE) auxiliando um analista humano — você NUNCA aprova ou reprova,
apenas aponta pontos de atenção para o analista decidir. Avalie o texto (parecer, nota técnica ou ofício)
elaborado pelo analista seguindo três frentes obrigatórias:

1. REVISÃO DE MÉRITO: verifique se o analista avaliou corretamente as regras (Unidade: ${p.unidade} | OSS: ${p.oss}).
   Para cada crítica de mérito, cite a cláusula/trecho exato do texto e do documento original a que ela se refere.
2. REVISÃO GRAMATICAL: aponte falhas ortográficas específicas (não generalidades).
3. ADEQUAÇÃO À LINGUAGEM SIMPLES: verifique se há excesso de juridiquês.

Se não houver nenhuma crítica real em determinada frente, não invente uma só para preencher a resposta.

Retorne EXCLUSIVAMENTE um objeto JSON válido, com esta estrutura exata (NÃO inclua campo de aprovação/veredito):
{
  "criticas": ["Crítica específica, citando o trecho exato do texto e/ou do documento original: ..."],
  "sugestao_linguagem_simples": "Uma versão em parágrafo único sugerindo como reescrever com clareza, ou string vazia se não houver necessidade."
}

DOCUMENTOS ORIGINAIS:
${contextoRevisao}
------------------------------------------------
TEXTO DO ANALISTA:
${txtAnalista}`;

  try {
    const jsonStr = await invocarIAComFallback(prompt, false, st);
    let rev;
    try { rev = JSON.parse(jsonStr); }
    catch (e) { rev = JSON.parse(String(jsonStr).replace(/[\x00-\x1F\x7F]/g, ' ').replace(/,\s*}/g, '}').replace(/,\s*]/g, ']')); }
    const qtdCriticas = (rev.criticas || []).length;

    contadorEl.innerHTML = qtdCriticas > 0
      ? `<span style="background: #f8d7da; color: #842029; padding: 6px 12px; border-radius: 20px;"><i class="ti ti-alert-triangle"></i> ${qtdCriticas} ponto(s) de atenção</span>`
      : `<span style="background: #d1e7dd; color: #0f5132; padding: 6px 12px; border-radius: 20px;"><i class="ti ti-check"></i> Sem críticas nesta revisão.</span>`;

    let htmlResultado = '';
    if (qtdCriticas > 0) {
      const criticasHtml = rev.criticas.map(c => `<li style="margin-bottom:6px;">${escHtml(c)}</li>`).join('');
      htmlResultado += `<div class="alert alert-danger" style="background:#f8d7da; color:#842029; margin-bottom:15px;"><strong>Pontos de atenção (a decisão final é sua):</strong><ul style="margin-top:8px; margin-left:20px;">${criticasHtml}</ul></div>`;
    } else {
      htmlResultado += `<div class="alert alert-success" style="background:#d1e7dd; color:#0f5132; margin-bottom:15px;"><strong>✓ Nenhum ponto de atenção identificado nesta revisão.</strong></div>`;
    }
    if (rev.sugestao_linguagem_simples) {
      htmlResultado += `<div style="background:#fff; border:1px solid #ced4da; padding:15px; border-radius:6px;">
        <h4 style="color:#d97706; font-size:0.95rem; margin-bottom:8px;"><i class="ti ti-bulb"></i> Sugestão de Linguagem Simples:</h4>
        <p style="font-size:0.9rem; color:#495057; line-height:1.5;">${escHtml(rev.sugestao_linguagem_simples)}</p>
      </div>`;
    }
    if (revisaoResumida) htmlResultado = `<div style="background:#fff3cd;color:#664d03;padding:8px 12px;border-radius:6px;font-size:0.82rem;margin-bottom:10px;"><i class="ti ti-alert-triangle"></i> Processo muito grande: a revisão comparou seu texto com os valores de todos os documentos e com os trechos mais relacionados, não com o processo inteiro.</div>` + htmlResultado;
    st.innerHTML = htmlResultado + renderPainelMascaramento(window._ultimoMascaramentoDetalhes);

    // Registra no histórico — sem isso, a Revisão Final não deixava rastro nenhum.
    const achadosRevisao = (rev.criticas || []).map(c => ({ tipo: 'REVISAO_FINAL', descricao: c, documentos: '', verificar: true }));
    await api('auditorias/salvar', {
      processo_id: p.id, tipo_checkpoint: 'SAIDA',
      achados_json: JSON.stringify(achadosRevisao), raw_ia: jsonStr, executado_por: usuarioAtual.email
    });

    _ultimoTextoRevisadoHash = await sha256(txtAnalista);
  } catch (e) {
    st.innerHTML = renderErroAmigavel(e.message);
  } finally {
    if (intervaloTimer) clearInterval(intervaloTimer);
    if (banner) banner.classList.add('hidden');
  }
}

// Traduz o erro de UM serviço numa expressão curta, para a lista "por serviço".
function _motivoCurtoProvedor(m) {
  if (/PULADO_SEM_CHAVE/.test(m)) return 'não tentado: sem chave neste navegador';
  if (/PULADO_DESLIGADO/.test(m)) return 'não tentado: desligado em Motor de IA';
  if (/maximum context length|context_length|token limit|too long/i.test(m)) return 'processo grande demais para uma chamada';
  if (/TPM|tokens per minute/i.test(m)) return 'limite de tokens por minuto da conta';
  if (/engine_overloaded/i.test(m)) return 'servidor sobrecarregado — só esperar';
  if (/rate_limit_reached/i.test(m)) return 'limite por minuto/dia do nível da conta';
  if (/exceeded_current_quota|insufficient/i.test(m)) return 'saldo insuficiente';
  if (/HTTP 429/.test(m)) return 'limite de uso atingido';
  if (/HTTP 40[13]|API key not valid|API_KEY_INVALID|invalid.*(api.?key|authentication)/i.test(m)) return 'chave inválida';
  if (/não respondeu em|aborted/i.test(m)) return 'demorou demais para responder';
  if (/Failed to fetch|falha de rede|não foi possível conectar/i.test(m)) return 'sem conexão (se for o Ollama, ele não está aberto)';
  if (/HTTP 5\d\d/.test(m)) return 'serviço fora do ar';
  if (/HTTP 400/.test(m)) return 'pedido recusado pelo serviço';
  return 'erro não identificado';
}

function _mensagemErroAmigavel(msg) {
  msg = String(msg || '');
  // Vem antes das outras regras: quando todos falham, cada um pode ter falhado por um
  // motivo diferente — resumir numa frase só escondia o resto.
  if (/Todos os provedores de IA falharam/i.test(msg)) {
    const porServico = msg.split('\n').slice(1).filter(l => l.includes(':')).map(l => {
      const i = l.indexOf(':');
      return `${l.slice(0, i).trim()}: ${_motivoCurtoProvedor(l.slice(i + 1))}`;
    });
    return { titulo: 'Nenhum serviço de IA respondeu agora.', sugestao: porServico.join(' · ') || 'Confira a configuração em "Motor de IA".' };
  }
  if (/HTTP 503/.test(msg) || /sobrecarregad[oa]/i.test(msg)) {
    return { titulo: 'O serviço de IA está sobrecarregado no momento.', sugestao: 'Isso costuma passar rápido — aguarde um minuto e tente de novo.' };
  }
  if (/HTTP 429/.test(msg)) {
    return { titulo: 'O limite de uso da IA foi atingido por agora.', sugestao: 'Aguarde alguns minutos antes de tentar de novo.' };
  }
  if (/não respondeu em \d+s/.test(msg)) {
    return { titulo: 'A IA demorou demais para responder.', sugestao: 'Se o processo for muito grande, isso pode ser normal — tente de novo, e se persistir, verifique sua conexão.' };
  }
  if (/chave.*não configurada/i.test(msg)) {
    return { titulo: 'Nenhuma IA está configurada.', sugestao: 'Vá em "Motor de IA" no menu lateral e cole uma chave válida.' };
  }
  if (/não foi possível conectar/i.test(msg) || /falha de rede/i.test(msg)) {
    return { titulo: 'Não foi possível conectar ao serviço de IA.', sugestao: 'Verifique sua conexão com a internet e tente de novo.' };
  }
  if (/resposta vazia|resposta válida/i.test(msg)) {
    return { titulo: 'A IA respondeu de um jeito inesperado.', sugestao: 'Normalmente resolve na segunda tentativa — tente executar de novo.' };
  }
  return { titulo: 'Algo deu errado ao processar essa etapa.', sugestao: 'Tente novamente em alguns instantes.' };
}

function renderErroAmigavel(mensagemTecnica) {
  const { titulo, sugestao } = _mensagemErroAmigavel(mensagemTecnica);
  const detalheId = 'detalhe-erro-' + Date.now() + '-' + Math.floor(Math.random() * 1000);
  return `
    <div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:16px 18px;">
      <div style="display:flex; gap:12px; align-items:flex-start;">
        <i class="ti ti-cloud-exclamation" style="font-size:1.3rem; color:#c2410c; flex-shrink:0; margin-top:1px;"></i>
        <div style="flex:1; min-width:0;">
          <div style="font-weight:600; color:#7c2d12; font-size:0.9rem;">${escHtml(titulo)}</div>
          <div style="font-size:0.83rem; color:#9a3412; margin-top:4px;">${escHtml(sugestao)}</div>
          <a href="#" onclick="document.getElementById('${detalheId}').classList.toggle('hidden'); return false;" style="font-size:0.72rem; color:#c2410c; display:inline-block; margin-top:8px;">Ver detalhe técnico</a>
          <div id="${detalheId}" class="hidden" style="margin-top:8px; font-size:0.7rem; color:#78716c; font-family:monospace; white-space:pre-wrap; background:#fffbeb; padding:8px; border-radius:6px;">${escHtml(mensagemTecnica)}</div>
        </div>
      </div>
    </div>`;
}
function _garantirEstiloPulso() {
  if (document.getElementById('estilo-pulso-conferindo')) return;
  const style = document.createElement('style');
  style.id = 'estilo-pulso-conferindo';
  style.textContent = `
    @keyframes pulseConferindo { 0%,100% { box-shadow: 0 0 0 0 rgba(142,22,40,0.30); } 50% { box-shadow: 0 0 0 8px rgba(142,22,40,0); } }
    #banner-conferindo:not(.hidden) { animation: pulseConferindo 1.6s infinite; }
  `;
  document.head.appendChild(style);
}
function escHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function escAttr(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function criarModal(h, comRodapePadrao = true) {
  fecharModal();
  const m = document.createElement('div');
  m.className = 'modal-overlay'; m.id = 'modal-ov';
  // Estilo inline, forçado por JS — sobrescreve qualquer z-index/position que o CSS
  // tenha, pra garantir que o aviso apareça por cima de TUDO, inclusive da tela de
  // login (que tem sua própria camada e estava escondendo o modal atrás dela).
  m.style.position = 'fixed';
  m.style.top = '0'; m.style.left = '0'; m.style.right = '0'; m.style.bottom = '0';
  m.style.zIndex = '99999';
  m.style.display = 'flex';
  m.style.alignItems = 'center';
  m.style.justifyContent = 'center';
  m.innerHTML = `<div class="modal">${h}${comRodapePadrao ? '<button onclick="fecharModal()">Fechar</button>' : ''}</div>`;
  document.body.appendChild(m);
}
function fecharModal() { document.getElementById('modal-ov')?.remove(); }
// Indicador da IA: o mascote no lugar da bolinha verde. Colorido = há serviço ligado;
// apagado = nenhum; pulsando = a IA está trabalhando agora. Clicar abre as Configurações.
function _garantirMascoteIA() {
  const dot = document.getElementById('ai-dot');
  if (!dot || document.getElementById('ia-mascote')) return;
  if (!document.getElementById('estilo-ia-mascote')) {
    const st = document.createElement('style'); st.id = 'estilo-ia-mascote';
    st.textContent = `
      .ia-mascote { width:26px; height:26px; border-radius:50%; object-fit:cover; flex-shrink:0; transition:filter .4s ease, opacity .4s ease, box-shadow .4s ease; }
      .ia-mascote.off { filter:grayscale(1); opacity:.45; }
      .ia-mascote.on { box-shadow:0 0 0 2px rgba(25,135,84,.7), 0 0 8px rgba(25,135,84,.45); }
      .ia-mascote.trabalhando { animation:iaPulso 1.3s ease-in-out infinite; }
      @keyframes iaPulso { 0%,100% { transform:scale(1); } 50% { transform:scale(1.14); } }
      .ai-status { cursor:pointer; }`;
    document.head.appendChild(st);
  }
  const img = document.createElement('img');
  img.id = 'ia-mascote'; img.className = 'ia-mascote off'; img.alt = 'Assistente de IA'; img.src = 'icons/mascote-analista.png';
  img.onerror = () => { img.remove(); dot.style.display = ''; };   // sem a imagem, volta a bolinha
  dot.style.display = 'none';
  dot.parentNode.insertBefore(img, dot);
  dot.parentNode.addEventListener('click', () => { if (usuarioAtual) showView('config'); });
  const nav = document.getElementById('nav-config');
  if (nav) nav.innerHTML = '<i class="ti ti-settings"></i> Configurações';
}

function _iaTrabalhando(sim) {
  window._iaEmUso = Math.max((window._iaEmUso || 0) + (sim ? 1 : -1), 0);
  document.getElementById('ia-mascote')?.classList.toggle('trabalhando', window._iaEmUso > 0);
}

function verificarIA() {
  _garantirMascoteIA();
  const dot = document.getElementById('ai-dot');
  const txt = document.getElementById('ai-status-txt');
  const img = document.getElementById('ia-mascote');
  if (!txt) return;
  const ligados = [];
  if (GEMINI_KEY && GEMINI_ATIVO) ligados.push('Gemini');
  if (GROQ_KEY && GROQ_ATIVO) ligados.push('Groq');
  if (KIMI_KEY && KIMI_ATIVO) ligados.push('Kimi');
  if (OPENROUTER_KEY && OPENROUTER_ATIVO) ligados.push('OpenRouter');
  if (DEEPSEEK_KEY && DEEPSEEK_ATIVO) ligados.push('DeepSeek');
  const on = ligados.length > 0;
  if (dot) dot.className = 'ai-dot ' + (on ? 'on' : 'off');
  if (img) { img.classList.toggle('on', on); img.classList.toggle('off', !on); }
  let frase;
  if (on) frase = 'IA pronta · ' + ligados.join(', ');
  else if (!usuarioAtual) frase = 'IA: entre para conectar';
  else if (CHAVES_DA_GESTAO.length) frase = 'IA desligada nas Configurações';
  else frase = 'Nenhuma IA liberada para você';
  txt.textContent = frase;
  const dica = on ? 'Conectado: ' + ligados.join(', ') + '. Clique para ver as Configurações.' : frase + '. Clique para ver as Configurações.';
  if (img) img.title = dica;
  txt.title = dica;
}
