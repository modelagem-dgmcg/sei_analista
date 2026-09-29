// ============================================================
// SEI ANALISTA v23.0 — app.js
// Versão 23 — integra todas as funcionalidades do v22 + botão Assumir.
//  - Processos e documentos agora vivem no backend (planilha compartilhada),
//    não mais só no localStorage do navegador — necessário para o processo
//    poder tramitar entre funcionários.
//  - Login alinhado aos nomes de campo do backend (email/senha_hash).
//  - sha256 não depende mais de biblioteca externa (usa Web Crypto do navegador).
//  - Prompts de IA com trava contra invenção de achados, exigência de citar
//    o par de valores divergentes, checagem de teto condicionada à presença
//    do valor nos documentos, campo "verificar" por achado, e remoção do
//    veredito "aprovado" da revisão final (a IA aponta, não aprova).
//  - Nova função: encaminhar processo para outro usuário (tramitação).
// ============================================================

// ==================== REGISTRO DE AUTORIA ====================
// © 2026 Secretaria de Estado de Saúde de Pernambuco (SES-PE) — DGMCG/GGPCG.
// Desenvolvido por Antonio Cleuton Eufrasio Vieira, Analista Administrativo - CTD,
// matrícula 18515045.
//
// Titularidade dos direitos econômicos: SES-PE (Lei nº 9.609/98, art. 4º — software
// desenvolvido no âmbito do vínculo funcional do autor com o órgão público).
// Direito de paternidade preservado ao autor a qualquer tempo, independentemente da
// titularidade econômica (Lei nº 9.609/98, art. 2º, §1º; Lei nº 9.610/98, art. 24, I).
const BUILD_VERSION = '2026-09-29 v23.5';
const BUILD_DATE    = '29/09/2026';
console.log("%cSES-PE — DGMCG/GGPCG", "color: #364fc7; font-size: 16px; font-weight: bold;");
console.log("%cSEI Analista " + BUILD_VERSION, "color: #495057; font-size: 13px; font-weight: bold;");
console.log("%cDesenvolvido por Cleuton Vieira.", "color: #495057; font-size: 13px;");

let GEMINI_KEY = localStorage.getItem('sei_gemini_key') || '';
let GROQ_KEY = localStorage.getItem('sei_groq_key') || '';
let KIMI_KEY = localStorage.getItem('sei_kimi_key') || '';
let OPENROUTER_KEY = localStorage.getItem('sei_openrouter_key') || '';
let DEEPSEEK_KEY = localStorage.getItem('sei_deepseek_key') || '';
let OLLAMA_URL = localStorage.getItem('sei_ollama_url') || 'http://localhost:11434';
let OLLAMA_MODEL = localStorage.getItem('sei_ollama_model') || 'qwen2.5:7b';

function _lerHabilitado(chave) {
  const v = localStorage.getItem(chave);
  return v === null ? true : v === 'true';
}
let GEMINI_ATIVO     = _lerHabilitado('sei_gemini_ativo');
let GROQ_ATIVO       = _lerHabilitado('sei_groq_ativo');
let KIMI_ATIVO       = _lerHabilitado('sei_kimi_ativo');
let OPENROUTER_ATIVO = _lerHabilitado('sei_openrouter_ativo');
let DEEPSEEK_ATIVO   = _lerHabilitado('sei_deepseek_ativo');
let OLLAMA_ATIVO     = _lerHabilitado('sei_ollama_ativo');

let ORDEM_PROVEDORES_IDS = JSON.parse(localStorage.getItem('sei_ordem_provedores') || '["gemini","groq","kimi","openrouter","deepseek","ollama"]');
// Ordem gravada por versão antiga pode estar sem algum provedor (o v22 gravava sem o
// DeepSeek). Quem faltar entra no fim da fila, antes do Ollama, em vez de nunca ser tentado.
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

// URL do Backend (Apps Script) — planilha compartilhada:
let API_URL = 'https://script.google.com/macros/s/AKfycbzzcJEAQPUCwY5YC2o1O5bj500pRE2mOFfZrLCy-e2kFzIgoDkebamJBgQK_yV2Ez0b/exec';

let usuarioAtual = null;
let processoAtual = null;      // { id, numero_sei, titulo, unidade, oss, gerencia, status, responsavel_atual, ... }
let textoIntegralAtual = '';   // texto consolidado dos documentos do processo aberto (vem do backend, não do localStorage)
let _ultimoTextoRevisadoHash = null; // hash do texto que passou pela Revisão Final — usado como aviso (não bloqueio) ao Finalizar
let _ultimaTramitacaoRecebida = null; // { de_usuario, para_usuario, data, observacao } — usado pelo botão "Devolver"
let _arquivoPrePreenchido = null; // { nome, texto } — cache do arquivo lido na tela "Importar Processo", pra não reprocessar ao criar
let painelEvidenciasWin = null;
window.memoriaEvidencias = {};
window.achadosAtuais = [];

window.onload = () => {
  verificarIA();
  injetarMarcaDagua();
  injetarBotaoSobre();
  _garantirEstiloNotificacoes();
};

function injetarMarcaDagua() {
  const rodape = document.createElement('div');
  rodape.innerHTML = `&copy; 2026 SES-PE — DGMCG/GGPCG. Desenvolvido por <strong>Cleuton Vieira</strong>. <span id='build-tag' style='color:#6c757d; margin-left:8px;' title='app.js / Code.gs'>app v${BUILD_VERSION} · backend …</span>`;
  rodape.style = "text-align: center; padding: 15px; font-size: 0.75rem; color: #adb5bd; margin-top: auto; border-top: 1px solid #dee2e6;";
  document.getElementById('content').parentElement.appendChild(rodape);
}


// ==================== "O QUE É ISSO?" NA TELA DE LOGIN ====================
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
    duplicados ou copiados incorretamente. Se a soma de uma tabela não bater com o total
    citado, ou se um número divergir entre os documentos, ele aponta o trecho exato.
  </p>
  <p style="font-size:0.87rem; line-height:1.6; margin-bottom:12px;">
    Se você precisar consultar normas ou decisões de tribunais, o sistema busca e apresenta
    as fontes estaduais e federais aplicáveis.
  </p>
  <p style="font-size:0.87rem; line-height:1.6; margin-bottom:12px;">
    Precisa localizar um dado sem reler o processo inteiro? Basta fazer a pergunta
    e o sistema traz a resposta exata, indicando o documento de origem.
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
    Antes de qualquer texto ser enviado para análise externa, os dados pessoais e as
    informações sensíveis são ocultados automaticamente, conforme a LGPD.
  </p>
  <h3 style="font-size:1rem; margin-bottom:8px;">Base legal e titularidade</h3>
  <p style="font-size:0.87rem; line-height:1.6; margin-bottom:18px;">
    Os direitos econômicos deste software pertencem à SES-PE (Lei nº 9.609/98, art. 4º).
    O direito de paternidade é preservado ao autor a qualquer tempo
    (Lei nº 9.609/98, art. 2º, §1º; Lei nº 9.610/98, art. 24, I).
  </p>
  <h3 style="font-size:1rem; margin-bottom:8px;">Desenvolvido por</h3>
  <p style="font-size:0.85rem; color:var(--text-muted); line-height:1.6;">
    Secretaria de Estado de Saúde de Pernambuco, por meio da DGMCG e da GGPCG.
    Criado por Antonio Cleuton Eufrasio Vieira, Analista Administrativo,
    para uso exclusivo da equipe da Gerência de Gestão de Processos dos Contratos de Gestão.
  </p>
`;

function abrirSobreFerramenta() {
  criarModal(`<div style="max-height:70vh; overflow-y:auto; padding-right:6px;">${TEXTO_SOBRE_FERRAMENTA}</div>`);
}

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

// ==================== API (backend compartilhado) ====================
const API_TIMEOUT_MS = 25000;
async function api(action, body = null) {
  const url = API_URL + '?action=' + encodeURIComponent(action);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), API_TIMEOUT_MS);
  const opts = { method: body ? 'POST' : 'GET', signal: controller.signal };
  if (body) { opts.headers = { 'Content-Type': 'text/plain' }; opts.body = JSON.stringify(body); }
  try {
    const resp = await fetch(url, opts);
    const texto = await resp.text();
    return JSON.parse(texto);
  } catch (e) {
    if (e.name === 'AbortError') return { ok: false, erro: `Servidor não respondeu em ${API_TIMEOUT_MS / 1000}s. Tente novamente.` };
    return { ok: false, erro: e.message };
  } finally {
    clearTimeout(timer);
  }
}

// ==================== HASH DE SENHA (Web Crypto — sem dependência externa) ====================
async function sha256(txt) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== LOGIN ====================
async function fazerLogin() {
  try {
    const usuario = document.getElementById('login-usuario').value.trim();
    const senhaInput = document.getElementById('login-senha').value;
    if (!usuario || !senhaInput) { mostrarErroLogin('Preencha login e senha.'); return; }

    const hash = await sha256(senhaInput);
    // Nomes de campo alinhados ao backend: email / senha_hash (não usuario / senha)
    const res = await api('auth/login', { email: usuario, senha_hash: hash });

    if (res.ok) {
      usuarioAtual = res.usuario; // { id, nome, email, gerencia }
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      document.getElementById('sidebar-nome').textContent = usuarioAtual.nome;
      document.getElementById('sidebar-gerencia').textContent = usuarioAtual.gerencia;
      document.getElementById('sidebar-email').textContent = usuarioAtual.email;
      showView('dashboard', 'entrada');
    } else {
      mostrarErroLogin(res.erro || 'Erro ao conectar. Credenciais inválidas ou bloqueio de permissão no Google.');
    }
  } catch (e) { mostrarErroLogin('Erro no motor JS: ' + e.message); }
}

function mostrarErroLogin(msg) {
  const errDiv = document.getElementById('login-error');
  if (errDiv) { errDiv.innerText = msg; errDiv.classList.remove('hidden'); } else { alert(msg); }
}

function logout() { location.reload(); }

// ==================== NAVEGAÇÃO ====================
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
    novo: 'Importar Processo', config: 'Configuração IA Premium'
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
          <span style="font-size:0.8rem; color:var(--text-muted);">Opcional — .pdf, .docx, .xlsx, .txt, .csv, .md ou .pptx. Confira tudo antes de salvar; a IA sugere, não afirma.</span>
        </div>
        <input type="file" id="np-arquivo" accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv,.md,.pptx,.ppt" style="display:none" onchange="prePreencherDeArquivo(this.files[0])">
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
    const opcoesPrioridade = (id) => [1,2,3,4,5,6].map(n =>
      `<option value="${n}" ${ORDEM_PROVEDORES_IDS.indexOf(id)+1 === n ? 'selected' : ''}>${n}</option>`
    ).join('');
    const checkboxAtivo = (id, ativo) => `
      <div style="display:flex;align-items:center;gap:10px;margin-top:6px;flex-wrap:wrap;">
        <label style="display:flex;align-items:center;gap:4px;font-size:0.72rem;color:var(--text-muted);cursor:pointer;white-space:nowrap;">
          <input type="checkbox" id="ativo-${id}" ${ativo ? 'checked' : ''} style="cursor:pointer;"> Habilitado
        </label>
        <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.72rem;padding:2px 10px;" onclick="testarConexaoProvedor('${id}')">Testar conexão</button>
        <span id="teste-${id}" style="font-size:0.75rem;"></span>
      </div>`;

    content.innerHTML = `
      <div style="max-width:640px;background:#fff;padding:24px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <p style="font-size:0.82rem;color:var(--text-muted);margin-bottom:16px;">
          O número ao lado é a ordem de tentativa — 1 é tentado primeiro. "Habilitado" desliga o provedor
          sem apagar a chave. Ollama exige estar instalado e aberto na máquina.
        </p>
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
          <select id="prio-gemini" title="Ordem" style="width:48px;padding:8px 2px;border:1px solid #ced4da;border-radius:6px;font-weight:700;text-align:center;">${opcoesPrioridade('gemini')}</select>
          <div class="form-group" style="flex:1;margin-bottom:0;"><label>Gemini</label>
            <input type="password" id="cfg-gemini" value="${GEMINI_KEY}" placeholder="Chave do Google AI Studio...">
            ${checkboxAtivo('gemini', GEMINI_ATIVO)}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
          <select id="prio-groq" title="Ordem" style="width:48px;padding:8px 2px;border:1px solid #ced4da;border-radius:6px;font-weight:700;text-align:center;">${opcoesPrioridade('groq')}</select>
          <div class="form-group" style="flex:1;margin-bottom:0;"><label>Groq (grátis)</label>
            <input type="password" id="cfg-groq" value="${GROQ_KEY}" placeholder="Chave grátis em console.groq.com...">
            ${checkboxAtivo('groq', GROQ_ATIVO)}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
          <select id="prio-kimi" title="Ordem" style="width:48px;padding:8px 2px;border:1px solid #ced4da;border-radius:6px;font-weight:700;text-align:center;">${opcoesPrioridade('kimi')}</select>
          <div class="form-group" style="flex:1;margin-bottom:0;"><label>Kimi (Moonshot AI)</label>
            <input type="password" id="cfg-kimi" value="${KIMI_KEY}" placeholder="Chave em platform.moonshot.ai...">
            ${checkboxAtivo('kimi', KIMI_ATIVO)}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
          <select id="prio-openrouter" title="Ordem" style="width:48px;padding:8px 2px;border:1px solid #ced4da;border-radius:6px;font-weight:700;text-align:center;">${opcoesPrioridade('openrouter')}</select>
          <div class="form-group" style="flex:1;margin-bottom:0;"><label>OpenRouter (grátis)</label>
            <input type="password" id="cfg-openrouter" value="${OPENROUTER_KEY}" placeholder="Chave grátis em openrouter.ai/keys...">
            ${checkboxAtivo('openrouter', OPENROUTER_ATIVO)}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
          <select id="prio-deepseek" title="Ordem" style="width:48px;padding:8px 2px;border:1px solid #ced4da;border-radius:6px;font-weight:700;text-align:center;">${opcoesPrioridade('deepseek')}</select>
          <div class="form-group" style="flex:1;margin-bottom:0;"><label>DeepSeek</label>
            <input type="password" id="cfg-deepseek" value="${DEEPSEEK_KEY}" placeholder="Chave em platform.deepseek.com/api-keys...">
            ${checkboxAtivo('deepseek', DEEPSEEK_ATIVO)}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:16px;">
          <select id="prio-ollama" title="Ordem" style="width:48px;padding:8px 2px;border:1px solid #ced4da;border-radius:6px;font-weight:700;text-align:center;">${opcoesPrioridade('ollama')}</select>
          <div class="form-group" style="flex:1;margin-bottom:0;"><label>Ollama (local — opcional)</label>
            <input type="text" id="cfg-ollama-url" value="${OLLAMA_URL}" placeholder="http://localhost:11434" style="margin-bottom:6px;">
            <input type="text" id="cfg-ollama-model" value="${OLLAMA_MODEL}" placeholder="qwen2.5:7b">
            ${checkboxAtivo('ollama', OLLAMA_ATIVO)}</div>
        </div>
        <button class="btn btn-primary" onclick="salvarConfig()"><i class="ti ti-check"></i> Salvar</button>
      </div>`;
  }
}

// ==================== SIDEBAR: BADGES + CAIXA FLUTUANTE DE ENCAMINHADOS ====================
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
const INTERVALO_MONITORAMENTO_MS = 45000;
let _alertasCache = [];

async function carregarAlertasSidebar() {
  if (!usuarioAtual) return;
  try {
    const res = await api('processos/alertas', { usuario: usuarioAtual.email });
    _alertasCache = (res.ok && res.alertas) ? res.alertas : [];
  } catch(e) { _alertasCache = []; }
  _renderAlertasSidebar();
}

function _renderAlertasSidebar() {
  const area = document.getElementById('area-alertas-sidebar');
  if (!area) return;
  if (!_alertasCache.length) { area.innerHTML = ''; return; }
  const corMaisUrgente = ['vermelho','amarelo','laranja','azul'].find(c => _alertasCache.some(a => a.cor === c)) || 'azul';
  const cor = COR_ALERTA[corMaisUrgente] || '#868e96';
  area.innerHTML = `<a href="#" onclick="showView('dashboard','panorama'); return false;"
    style="display:flex;align-items:center;gap:6px;padding:5px 10px 5px 12px;text-decoration:none;
           border-left:3px solid ${cor};background:rgba(0,0,0,0.15);border-radius:0 4px 4px 0;margin:0 0 4px;">
    <i class="ti ti-bell" style="color:${cor};font-size:13px;"></i>
    <span style="font-size:0.72rem;color:${cor};font-weight:600;">${_alertasCache.length} alerta(s) — ver Panorama</span>
  </a>`;
}

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
    .toast-chegada { background: #2b2f36; color: #f1f3f5; padding: 12px 16px; border-radius: 8px;
      font-size: 0.85rem; box-shadow: 0 6px 20px rgba(0,0,0,0.25); max-width: 300px;
      opacity: 0; transform: translateX(12px); transition: opacity 0.25s ease, transform 0.25s ease;
      display: flex; align-items: flex-start; gap: 10px; }
    .toast-chegada.visivel { opacity: 1; transform: translateX(0); }
    .toast-chegada i { color: #74c0fc; font-size: 1rem; margin-top: 1px; }
  `;
  document.head.appendChild(style);
}

function pulsarElemento(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('pulso-chegada');
  void el.offsetWidth;
  el.classList.add('pulso-chegada');
  setTimeout(() => el.classList.remove('pulso-chegada'), 2600);
}

function mostrarToast(mensagem) {
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
  }, 4500);
}

function iniciarMonitoramentoNovosItens() {
  if (_intervaloMonitoramento) clearInterval(_intervaloMonitoramento);
  _ultimaContagemEntrada = null;
  _ultimaContagemAchadosPendentes = null;
  _verificarNovosItens();
  _intervaloMonitoramento = setInterval(_verificarNovosItens, INTERVALO_MONITORAMENTO_MS);
}

async function _verificarNovosItens() {
  if (!usuarioAtual) return;
  try {
    const [resContagens, resPendentes] = await Promise.all([
      api('processos/contagens', { responsavel: usuarioAtual.email }),
      api('achados/contar-pendentes', { usuario: usuarioAtual.email })
    ]);
    if (resContagens.ok) {
      const entradaAtual = resContagens.contagens.entrada || 0;
      if (_ultimaContagemEntrada !== null && entradaAtual > _ultimaContagemEntrada) {
        pulsarElemento('nav-entrada');
        const diff = entradaAtual - _ultimaContagemEntrada;
        mostrarToast(diff === 1 ? 'Chegou um processo novo na Caixa de Entrada.' : `Chegaram ${diff} processos novos na Caixa de Entrada.`);
      }
      _ultimaContagemEntrada = entradaAtual;
      const badgeEntrada = document.getElementById('badge-entrada');
      if (badgeEntrada) badgeEntrada.textContent = entradaAtual > 0 ? entradaAtual : '';
    }
    if (resPendentes.ok) {
      const pendentesAtual = resPendentes.pendentes || 0;
      if (_ultimaContagemAchadosPendentes !== null && pendentesAtual > _ultimaContagemAchadosPendentes) {
        pulsarElemento('nav-entrada');
        mostrarToast('Um colega pediu sua opinião sobre um achado. Veja na aba "Perguntas".');
      }
      _ultimaContagemAchadosPendentes = pendentesAtual;
    }
  } catch(e) { console.warn('Falha na checagem periódica:', e.message); }
}

// ==================== DASHBOARD MULTI-CAIXAS ====================

async function renderPanorama(content, abasHtml) {
  const [resContagens, resPerguntas, resAlertas, resEnc] = await Promise.all([
    api('processos/contagens', { responsavel: usuarioAtual.email }),
    api('achados/contar-pendentes', { usuario: usuarioAtual.email }),
    api('processos/alertas', { usuario: usuarioAtual.email }),
    api('processos/listar', { responsavel: usuarioAtual.email, caixa: 'encaminhados' })
  ]);
  const c = resContagens.ok ? resContagens.contagens : {};
  const qtdEntrada      = c.entrada      || 0;
  const qtdAndamento    = c.andamento    || 0;
  const qtdEncaminhados = (resEnc.ok && resEnc.processos) ? resEnc.processos.length : 0;
  const qtdConcluidos   = c.concluidos   || 0;
  const qtdPerguntas    = (resPerguntas.ok && resPerguntas.pendentes) || 0;
  const alertas         = (resAlertas.ok && resAlertas.alertas) || [];
  const qtdAlertas      = alertas.length;

  const bloco = (icone, rotulo, qtd, caixa, cor, destaque) => `
    <div onclick="showView('dashboard','${caixa}')" style="
      cursor:pointer; padding:16px 20px; border-radius:10px; background:#fff;
      border:1px solid ${destaque ? cor : '#dee2e6'}; border-left:4px solid ${cor};
      display:flex; align-items:center; gap:14px; transition:box-shadow .15s;"
      onmouseenter="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'"
      onmouseleave="this.style.boxShadow='none'">
      <div style="font-size:1.6rem; color:${cor}; line-height:1;"><i class="ti ${icone}"></i></div>
      <div>
        <div style="font-size:1.8rem; font-weight:700; color:${cor}; line-height:1;">${qtd}</div>
        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">${rotulo}</div>
      </div>
    </div>`;

  const blocoAlerta = (a) => {
    const cor = COR_ALERTA[a.cor] || '#868e96';
    return `<div onclick="abrirProcesso('${escAttr(a.numero_sei||String(a.processo_id))}')" style="
      cursor:pointer; padding:8px 12px; border-radius:6px; background:#fff;
      border-left:3px solid ${cor}; border:1px solid ${cor}33; font-size:0.8rem;
      display:flex; gap:10px; align-items:flex-start;"
      onmouseenter="this.style.background='#f8f9fa'" onmouseleave="this.style.background='#fff'">
      <span style="color:${cor}; font-size:1rem; margin-top:1px;"><i class="ti ${ICONE_ALERTA[a.cor]||'ti-bell'}"></i></span>
      <div>
        <div style="font-weight:600; color:${cor};">${escHtml(a.mensagem)}</div>
        <div style="color:var(--text-muted); font-size:0.75rem;">${escHtml(a.titulo||a.numero_sei||'')}</div>
      </div>
    </div>`;
  };

  content.innerHTML = abasHtml + `
    <div style="margin-bottom:20px;">
      <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:10px;">
        Panorama — ${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}
      </div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; margin-bottom:18px;">
        ${bloco('ti-inbox',            'Na caixa de entrada',     qtdEntrada,      'entrada',      '#0b509e', qtdEntrada > 0)}
        ${bloco('ti-loader',           'Em andamento',            qtdAndamento,    'andamento',    '#6f42c1', false)}
        ${bloco('ti-share',            'Encaminhados',            qtdEncaminhados, 'encaminhados', '#0d6efd', false)}
        ${bloco('ti-archive',          'Concluídos',              qtdConcluidos,   'concluidos',   '#198754', false)}
        ${bloco('ti-message-question', 'Perguntas pendentes',     qtdPerguntas,    'perguntas',    '#fd7e14', qtdPerguntas > 0)}
      </div>
      ${qtdAlertas ? `
        <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px;">Alertas ativos (${qtdAlertas})</div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${alertas.slice(0,6).map(blocoAlerta).join('')}
          ${qtdAlertas > 6 ? `<div style="font-size:0.75rem; color:var(--text-muted); padding:4px 0;">+${qtdAlertas-6} alerta(s)</div>` : ''}
        </div>` : `
        <div style="font-size:0.82rem; color:#2b8a3e;"><i class="ti ti-check"></i> Nenhum alerta no momento.</div>`}
    </div>`;
}

async function renderDashboard(caixa = 'entrada') {
  const content = document.getElementById('content');
  content.innerHTML = '<span class="spinner"></span> Carregando processos...';
  await atualizarContagensSidebar();

  const abasHtml = `
    <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; border-bottom:1px solid #dee2e6; padding-bottom:12px;">
      <button class="btn btn-sm ${caixa === 'entrada' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','entrada')"><i class="ti ti-inbox"></i> Caixa de Entrada</button>
      <button class="btn btn-sm ${caixa === 'andamento' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','andamento')"><i class="ti ti-loader"></i> Em Andamento</button>
      <button class="btn btn-sm ${caixa === 'encaminhados' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','encaminhados')"><i class="ti ti-share"></i> Encaminhados</button>
      <button class="btn btn-sm ${caixa === 'concluidos' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','concluidos')"><i class="ti ti-archive"></i> Concluídos</button>
    </div>`;

  // "Concluídos" delega pro Registro consolidado (documento final + achados + chat) já validado
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
    lista.forEach(p => {
      const qtdAlertas = p.ultima_auditoria_qtd_achados;
      const badgeAlertas = qtdAlertas === null || qtdAlertas === undefined ? ''
        : qtdAlertas > 0
          ? `<span class="badge-status" style="background:#f8d7da;color:#842029;">${qtdAlertas} alerta(s)</span>`
          : `<span class="badge-status" style="background:#d1e7dd;color:#0f5132;">sem alertas</span>`;

      let infoTramitacao = '';
      if (p.ultima_tramitacao) {
        infoTramitacao = `<div style="font-size:0.75rem; color:#0b509e; margin-top:4px;"><i class="ti ti-clock"></i> Tramitado para <strong>${escHtml(p.ultima_tramitacao.para_usuario)}</strong> em ${new Date(p.ultima_tramitacao.data).toLocaleString('pt-BR')}</div>`;
      }

      const botaoParar = caixa === 'encaminhados'
        ? `<div style="margin-top:10px; border-top:1px dashed #dee2e6; padding-top:8px;">
             <button class="btn btn-secondary btn-sm" style="width:100%; font-size:0.75rem;" onclick="pararAcompanhamento(event, ${p.id})"><i class="ti ti-eye-off"></i> Terminar Acompanhamento</button>
           </div>` : '';

      // Excluir só é permitido pra quem importou o processo — o que foi recebido de
      // outra pessoa não se apaga, se devolve (botão "Devolver" dentro do processo).
      const podeExcluir = String(p.criado_por).toLowerCase() === usuarioAtual.email.toLowerCase();
      const botaoExcluir = podeExcluir
        ? `<button onclick="deletarProcessoRemoto(event, ${p.id})" title="Excluir processo" style="position:absolute; top:12px; right:12px; background:none; border:none; color:#adb5bd; cursor:pointer; font-size:0.9rem; padding:4px;" onmouseover="this.style.color='#dc3545'" onmouseout="this.style.color='#adb5bd'"><i class="ti ti-trash"></i></button>`
        : '';

      const botaoAssumirHtml = (caixa === 'entrada')
        ? `<div style="margin-top:10px;border-top:1px dashed #dee2e6;padding-top:8px;"><button class="btn btn-primary btn-sm" style="width:100%;font-size:0.75rem;" onclick="assumirProcesso(event,${p.id})"><i class="ti ti-hand-stop"></i> Assumir para análise</button></div>`
        : '';

      html += `
      <div class="process-card" style="position:relative;">
        <div onclick="abrirProcesso('${escAttr(p.numero_sei || p.id)}')" style="cursor:pointer;">
          <div style="display:flex;justify-content:space-between;margin-bottom:8px; align-items:center; padding-right: 25px;">
            <span class="sei-num">${escHtml(p.numero_sei || '(sem nº SEI)')}</span> ${badgeAlertas}
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
    });
  }
  content.innerHTML = html + '</div>';
}


async function assumirProcesso(e, id) {
  e.stopPropagation();
  // O processo da Entrada já está com a pessoa; assumir é só iniciar a análise.
  // Não usa "encaminhar para si mesmo", que criaria uma tramitação falsa no histórico.
  const res = await api('processos/atualizar-status', { id, status: 'Em Análise' });
  if (!res.ok) { alert('Não foi possível assumir: ' + (res.erro || 'erro desconhecido')); return; }
  api('log/registrar', { usuario: usuarioAtual.email, acao: 'ASSUMIR', processo_id: id, detalhes: 'Análise iniciada a partir da Entrada' }).catch(() => {});
  // Confere de verdade se o servidor passou a mostrar o processo em Andamento.
  const conf = await api('processos/listar', { responsavel: usuarioAtual.email, caixa: 'andamento' });
  const apareceu = conf.ok && (conf.processos || []).some(p => String(p.id) === String(id));
  if (apareceu) {
    mostrarToast('Processo assumido. Ele está agora em Andamento.');
    showView('dashboard', 'andamento');
  } else {
    alert('O status mudou para "Em Análise", mas o servidor ainda não mostra o processo em Andamento.\n\nIsso indica que o Code.gs não está classificando esse status na caixa Andamento. Me avise que ajustamos o backend.');
    showView('dashboard', 'entrada');
  }
}

async function renderPerguntasAchados() {
  const area = document.getElementById('area-perguntas');
  if (!area) return;
  const res = await api('achados/meus', { usuario: usuarioAtual.email });
  if (!res.ok) {
    area.innerHTML = `<div class="alert alert-danger">Não foi possível carregar as perguntas: ${escHtml(res.erro || '')}.</div>`;
    return;
  }
  const recebidas = (res.recebidas || []).sort((a,b) => (a.resposta ? 1 : 0) - (b.resposta ? 1 : 0));
  const enviadas  = res.enviadas  || [];
  const linkProcesso = q => `<a href="#" onclick="abrirProcesso('${escAttr(q.numero_sei||q.processo_id)}'); return false;">${escHtml(q.numero_sei || 'processo ' + q.processo_id)}</a>`;
  const cartao = (q, tipo) => {
    const pendente = !q.resposta;
    const cor = pendente ? (tipo==='recebida' ? '#fff9db;border-left:3px solid #f5c518' : '#f8f9fa;border-left:3px solid #adb5bd') : '#e7f5ff;border-left:3px solid #339af0';
    const quem = tipo==='recebida' ? `De <strong>${escHtml(q.de_usuario)}</strong>` : `Para <strong>${escHtml(q.para_usuario)}</strong>`;
    const quando = q.data_envio ? ` · há ${_tempoDecorridoDesde(q.data_envio)}` : '';
    const resposta = q.resposta
      ? `<div style="margin-top:6px;color:#1864ab;"><strong>Resposta:</strong> ${escHtml(q.resposta)}</div>`
      : (tipo==='recebida'
          ? `<textarea id="resp-caixa-${q.id}" placeholder="Sua resposta..." style="width:100%;margin-top:8px;padding:6px;border:1px solid #ced4da;border-radius:4px;min-height:50px;"></textarea>
             <button class="btn btn-primary btn-sm" style="margin-top:6px;" onclick="responderPerguntaNaCaixa(${q.id})">Responder</button>`
          : `<div style="margin-top:6px;color:var(--text-muted);"><i class="ti ti-clock"></i> Aguardando resposta.</div>`);
    return `<div style="background:${cor};padding:10px 14px;border-radius:6px;margin-bottom:10px;font-size:0.85rem;">
      <div style="font-size:0.78rem;color:var(--text-muted);">${quem}${quando} · Processo ${linkProcesso(q)}</div>
      <div style="margin-top:4px;"><strong>Achado:</strong> ${escHtml(q.achado_referencia)}</div>
      <div style="margin-top:4px;"><strong>Pergunta:</strong> ${escHtml(q.mensagem||'(sem mensagem)')}</div>
      ${resposta}
    </div>`;
  };
  area.innerHTML = `
    <h3 style="font-size:1rem;margin-bottom:10px;">Recebidas</h3>
    ${recebidas.length ? recebidas.map(q => cartao(q,'recebida')).join('') : '<p class="text-muted" style="font-size:0.85rem;">Nenhuma pergunta recebida.</p>'}
    <h3 style="font-size:1rem;margin:20px 0 10px;">Enviadas</h3>
    ${enviadas.length ? enviadas.map(q => cartao(q,'enviada')).join('') : '<p class="text-muted" style="font-size:0.85rem;">Nenhuma pergunta enviada.</p>'}`;
}

async function responderPerguntaNaCaixa(id) {
  const campo = document.getElementById('resp-caixa-' + id);
  const resposta = (campo?.value || '').trim();
  if (!resposta) return alert('Escreva a resposta antes de enviar.');
  const res = await api('achados/responder', { id, resposta });
  if (!res.ok) return alert('Erro ao responder: ' + (res.erro || ''));
  mostrarToast('Resposta enviada.');
  renderPerguntasAchados();
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


// ==================== MENSAGEIRO ====================
let _msgConversaAtual = null;

async function toggleMensageiro() {
  const painel = document.getElementById('painel-mensageiro');
  if (!painel) return;
  if (painel.style.display === 'none') {
    painel.style.display = 'block';
    await abrirListaContatos();
  } else {
    painel.style.display = 'none';
    _msgConversaAtual = null;
  }
}

async function abrirListaContatos() {
  const listaEl = document.getElementById('msg-lista-contatos');
  const convEl  = document.getElementById('msg-conversa');
  if (!listaEl || !convEl) return;
  convEl.style.display = 'none';
  listaEl.style.display = 'block';
  listaEl.innerHTML = '<div style="padding:8px 10px;font-size:0.72rem;color:#adb5bd;"><span class="spinner" style="width:10px;height:10px;border-width:2px;margin:0 4px 0 0;"></span> Carregando...</div>';
  const res = await api('mensagens/contatos', { usuario: usuarioAtual.email });
  if (!res.ok) { listaEl.innerHTML = '<div style="padding:8px 10px;font-size:0.72rem;color:#f87171;">Erro ao carregar contatos.</div>'; return; }
  let html = '';
  if (res.grupos?.length) {
    html += '<div style="padding:4px 10px 2px;font-size:0.65rem;font-weight:700;color:#adb5bd;text-transform:uppercase;">Grupos</div>';
    html += res.grupos.map(g => `
      <div onclick="abrirConversa('${escAttr(g.conversa_id)}','${escAttr(g.nome)}','grupo')"
           style="padding:6px 10px;cursor:pointer;font-size:0.78rem;display:flex;align-items:center;gap:6px;"
           onmouseenter="this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background=''">
        <i class="ti ti-users" style="color:#6f42c1;font-size:0.9rem;"></i>
        <span>${escHtml(g.nome)}</span>
      </div>`).join('');
  }
  if (res.individuais?.length) {
    html += '<div style="padding:4px 10px 2px;margin-top:4px;font-size:0.65rem;font-weight:700;color:#adb5bd;text-transform:uppercase;">Individual</div>';
    html += res.individuais.map(c => `
      <div onclick="abrirConversa('${escAttr(c.conversa_id)}','${escAttr(c.nome)}','dm')"
           style="padding:6px 10px;cursor:pointer;font-size:0.78rem;display:flex;align-items:center;gap:6px;"
           onmouseenter="this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background=''">
        <i class="ti ti-user" style="color:#0b509e;font-size:0.9rem;"></i>
        <span>${escHtml(c.nome)}</span>
      </div>`).join('');
  }
  listaEl.innerHTML = html || '<div style="padding:8px 10px;font-size:0.72rem;color:#adb5bd;">Nenhum contato.</div>';
}

async function abrirConversa(conversaId, nome, tipo) {
  _msgConversaAtual = conversaId;
  const listaEl = document.getElementById('msg-lista-contatos');
  const convEl  = document.getElementById('msg-conversa');
  const nomeEl  = document.getElementById('msg-conversa-nome');
  const histEl  = document.getElementById('msg-historico');
  if (!listaEl || !convEl || !nomeEl || !histEl) return;
  listaEl.style.display = 'none';
  convEl.style.display  = 'block';
  nomeEl.textContent    = nome;
  histEl.innerHTML      = '<div style="font-size:0.72rem;color:#adb5bd;text-align:center;padding:8px;">Carregando...</div>';
  const res = await api('mensagens/listar', { conversa_id: conversaId, usuario: usuarioAtual.email });
  if (!res.ok) { histEl.innerHTML = '<div style="font-size:0.72rem;color:#f87171;text-align:center;padding:8px;">Erro ao carregar.</div>'; return; }
  _renderMensagens(res.mensagens || []);
  document.getElementById('msg-input')?.focus();
}

function _renderMensagens(msgs) {
  const histEl = document.getElementById('msg-historico');
  if (!histEl) return;
  if (!msgs.length) { histEl.innerHTML = '<div style="font-size:0.72rem;color:#adb5bd;text-align:center;padding:8px;">Sem mensagens ainda.</div>'; return; }
  histEl.innerHTML = msgs.map(m => {
    const meu = String(m.de_usuario).toLowerCase() === String(usuarioAtual.email).toLowerCase();
    const hora = m.enviado_em ? new Date(m.enviado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';
    return `<div style="max-width:90%;padding:5px 8px;border-radius:8px;font-size:0.76rem;line-height:1.4;
      align-self:${meu?'flex-end':'flex-start'};
      background:${meu?'#0b509e':'rgba(255,255,255,0.12)'};color:#fff;">
      ${!meu?`<div style="font-size:0.65rem;color:#93c5fd;margin-bottom:2px;">${escHtml(m.de_nome)}</div>`:''}
      ${escHtml(m.texto)}
      <div style="font-size:0.62rem;color:rgba(255,255,255,0.5);text-align:right;margin-top:2px;">${hora}</div>
    </div>`;
  }).join('');
  histEl.scrollTop = histEl.scrollHeight;
}

async function enviarMensagem() {
  const input = document.getElementById('msg-input');
  const texto = (input?.value || '').trim();
  if (!texto || !_msgConversaAtual) return;
  input.value = '';
  const res = await api('mensagens/enviar', { de_usuario: usuarioAtual.email, conversa_id: _msgConversaAtual, texto });
  if (!res.ok) { mostrarToast('Erro ao enviar mensagem.'); return; }
  const hist = await api('mensagens/listar', { conversa_id: _msgConversaAtual, usuario: usuarioAtual.email });
  if (hist.ok) _renderMensagens(hist.mensagens || []);
}

function voltarListaContatos() {
  _msgConversaAtual = null;
  document.getElementById('msg-lista-contatos').style.display = 'block';
  document.getElementById('msg-conversa').style.display = 'none';
}

// ==================== REGISTRO DE CONCLUÍDOS ====================
// Tudo que já passou por "Finalizar" — não é só o que vira SEI assinado: pode ser
// base de relatório, começo de apresentação, ou só um registro pra localizar depois.
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

// Tela consolidada só de leitura: documento final + histórico de achados + histórico do chat
async function abrirRegistroConcluido(id) {
  const content = document.getElementById('content');
  content.innerHTML = '<span class="spinner"></span> Carregando registro...';

  const [resProc, resAud, resCons, resNotas] = await Promise.all([
    api('processos/obter', { id }),
    api('auditorias/listar', { processo_id: id }),
    api('consultas/listar', { processo_id: id }),
    api('notas/listar', { processo_id: id })
  ]);
  if (!resProc.ok) { content.innerHTML = `<div class="alert alert-danger">${escHtml(resProc.erro)}</div>`; return; }

  const proc = resProc.processo;
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
      <h3 style="font-size:1.05rem;margin-bottom:12px;"><i class="ti ti-file-text"></i> Documento Final</h3>
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

function salvarConfig() {
  const inputEl = document.getElementById('cfg-gemini');
  if (!inputEl) return;
  GEMINI_KEY = inputEl.value.trim();
  localStorage.setItem('sei_gemini_key', GEMINI_KEY);
  GROQ_KEY = (document.getElementById('cfg-groq')?.value || '').trim();
  localStorage.setItem('sei_groq_key', GROQ_KEY);
  KIMI_KEY = (document.getElementById('cfg-kimi')?.value || '').trim();
  localStorage.setItem('sei_kimi_key', KIMI_KEY);
  OPENROUTER_KEY = (document.getElementById('cfg-openrouter')?.value || '').trim();
  localStorage.setItem('sei_openrouter_key', OPENROUTER_KEY);
  DEEPSEEK_KEY = (document.getElementById('cfg-deepseek')?.value || '').trim();
  localStorage.setItem('sei_deepseek_key', DEEPSEEK_KEY);
  OLLAMA_URL = (document.getElementById('cfg-ollama-url')?.value || '').trim() || 'http://localhost:11434';
  localStorage.setItem('sei_ollama_url', OLLAMA_URL);
  OLLAMA_MODEL = (document.getElementById('cfg-ollama-model')?.value || '').trim() || 'qwen2.5:7b';
  localStorage.setItem('sei_ollama_model', OLLAMA_MODEL);

  // Salvar flags habilitado/desabilitado
  GEMINI_ATIVO = !!document.getElementById('ativo-gemini')?.checked;
  localStorage.setItem('sei_gemini_ativo', String(GEMINI_ATIVO));
  GROQ_ATIVO = !!document.getElementById('ativo-groq')?.checked;
  localStorage.setItem('sei_groq_ativo', String(GROQ_ATIVO));
  KIMI_ATIVO = !!document.getElementById('ativo-kimi')?.checked;
  localStorage.setItem('sei_kimi_ativo', String(KIMI_ATIVO));
  OPENROUTER_ATIVO = !!document.getElementById('ativo-openrouter')?.checked;
  localStorage.setItem('sei_openrouter_ativo', String(OPENROUTER_ATIVO));
  DEEPSEEK_ATIVO = !!document.getElementById('ativo-deepseek')?.checked;
  localStorage.setItem('sei_deepseek_ativo', String(DEEPSEEK_ATIVO));
  OLLAMA_ATIVO = !!document.getElementById('ativo-ollama')?.checked;
  localStorage.setItem('sei_ollama_ativo', String(OLLAMA_ATIVO));

  // Salvar ordem de prioridade
  const ids = ['gemini','groq','kimi','openrouter','deepseek','ollama'];
  const comPrioridade = ids.map(id => ({ id, p: Number(document.getElementById('prio-'+id)?.value) || 99 }));
  comPrioridade.sort((a,b) => a.p - b.p);
  ORDEM_PROVEDORES_IDS = comPrioridade.map(x => x.id);
  localStorage.setItem('sei_ordem_provedores', JSON.stringify(ORDEM_PROVEDORES_IDS));

  alert('Configurações de IA salvas!');
  verificarIA();
}

async function testarConexaoProvedor(id) {
  const el = document.getElementById('teste-' + id);
  if (el) el.innerHTML = '<span class="spinner" style="width:11px;height:11px;border-width:2px;margin:0;"></span> Testando...';
  // Lê o valor atual do campo antes de testar (sem precisar salvar antes)
  if (id === 'gemini')     GEMINI_KEY     = (document.getElementById('cfg-gemini')?.value     || '').trim();
  if (id === 'groq')       GROQ_KEY       = (document.getElementById('cfg-groq')?.value       || '').trim();
  if (id === 'kimi')       KIMI_KEY       = (document.getElementById('cfg-kimi')?.value       || '').trim();
  if (id === 'openrouter') OPENROUTER_KEY = (document.getElementById('cfg-openrouter')?.value || '').trim();
  if (id === 'deepseek')   DEEPSEEK_KEY   = (document.getElementById('cfg-deepseek')?.value   || '').trim();
  if (id === 'ollama') {
    OLLAMA_URL   = (document.getElementById('cfg-ollama-url')?.value   || '').trim() || 'http://localhost:11434';
    OLLAMA_MODEL = (document.getElementById('cfg-ollama-model')?.value || '').trim() || 'qwen2.5:7b';
  }
  const fns = {
    gemini: invocarGeminiPremium, groq: invocarGroq, kimi: invocarKimi,
    openrouter: invocarOpenRouter, deepseek: invocarDeepSeek, ollama: invocarOllama
  };
  try {
    await fns[id]('Responda só a palavra: ok', true, null);
    if (el) el.innerHTML = '<span style="color:#2b8a3e;font-weight:600;"><i class="ti ti-check"></i> Conectado!</span>';
  } catch(e) {
    if (el) el.innerHTML = '<span style="color:#c92a2a;"><i class="ti ti-x"></i> ' + escHtml(e.message.substring(0,80)) + '</span>';
  }
}

// Lê um documento ANTES de o processo existir — extrai o nº SEI por regex (determinístico,
// sem IA) e usa uma chamada rápida de IA só pra título/unidade/OSS (informação textual,
// não numérica, que regex não pega bem). Tudo fica em campo editável — a IA sugere,
// a pessoa confirma antes de salvar, nunca preenche escondido.
async function prePreencherDeArquivo(file) {
  if (!file) return;
  const status = document.getElementById('np-status-preenchimento');
  status.innerHTML = '<span class="spinner"></span> Lendo o documento...';
  try {
    const buf = await file.arrayBuffer();
    const texto = await extrairTextoArquivo(file.name, buf);
    if (!texto.trim().length) throw new Error('Nenhum texto foi extraído desse arquivo.');
    _arquivoPrePreenchido = { nome: file.name, texto };

    const numsProcesso = extrairNumerosProcesso(texto);
    if (numsProcesso.length) {
      const campoSei = document.getElementById('np-sei');
      campoSei.value = numsProcesso[0].valor;
      _marcarComoSugerido(campoSei);
    }

    status.innerHTML = '<span class="spinner"></span> Identificando título, unidade e OSS...';
    const amostra = texto.substring(0, 6000); // essa info normalmente está no início do documento
    const prompt = `Leia o início de um documento de contrato/aditivo de gestão em saúde pública e extraia,
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
      console.warn('Sugestão de título/unidade/OSS via IA falhou (nº SEI, se achado, continua preenchido):', e.message);
    }

    status.innerHTML = `<div style="background:#d1e7dd; color:#0f5132; padding:8px 12px; border-radius:6px; font-size:0.82rem;">
      <i class="ti ti-check"></i> ${escHtml(file.name)} lido. Confira os campos destacados abaixo antes de salvar.
    </div>`;
  } catch (e) {
    _arquivoPrePreenchido = null;
    status.innerHTML = `<div class="alert alert-danger">Não foi possível ler esse arquivo: ${escHtml(e.message)}</div>`;
  }
}

// Destaque visual discreto pra campo preenchido por sugestão — some sozinho quando
// a pessoa edita o campo, sem atrapalhar nenhum outro comportamento que o campo já tenha.
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

  // Se um arquivo foi usado pra pré-preencher os campos, o texto já foi extraído —
  // anexa direto no processo recém-criado, sem pedir pra subir de novo.
  if (_arquivoPrePreenchido) {
    if (btn) btn.innerHTML = '<span class="spinner"></span> Anexando documento já lido...';
    processoAtual = res.processo; // salvarDocumentoNoBackend depende de processoAtual.id
    try {
      await salvarDocumentoNoBackend(_arquivoPrePreenchido.nome, _arquivoPrePreenchido.texto, detectarSensiveisDoArquivo(_arquivoPrePreenchido.texto, _arquivoPrePreenchido.nome));
    } catch (e) {
      console.warn('Processo criado, mas falhou ao anexar o documento pré-lido:', e.message);
    }
    _arquivoPrePreenchido = null;
  }

  abrirProcesso(res.processo.numero_sei || String(res.processo.id));
}

// ==================== PAINEL DE EVIDÊNCIAS (MODO TELA DUPLA) ====================
// Chamada pela janela do Painel de Evidências (window.opener.salvarNotaEvidencia) —
// a nota persiste de verdade no backend (upsert por processo+referência), então
// sobrevive mesmo se a janela do painel for fechada e reaberta depois.
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
              // Bloco de notas por evidência: sem limite de caracteres, cresce conforme digita
              function ajustarAlturaNota(el) {
                  el.style.height = 'auto';
                  el.style.height = (el.scrollHeight) + 'px';
              }
              // Salva de verdade no backend, com debounce (só grava 800ms depois da
              // última tecla — evita uma chamada de rede por letra digitada).
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

    // Busca se já existe uma nota salva pra essa evidência específica, de uma sessão
    // anterior — pré-preenche em vez de começar sempre em branco.
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

// ==================== CONSTRUTOR DA TELA DE PROCESSO ====================
// Busca o processo no backend e monta o texto integral dos documentos a partir
// de lá (documentos/listar + conteudo/listar) — não mais do localStorage.
const COR_ALERTA   = { vermelho:'#dc3545', amarelo:'#f5c518', laranja:'#fd7e14', azul:'#0dcaf0' };
const ICONE_ALERTA = { vermelho:'ti-alert-octagon', amarelo:'ti-alert-triangle', laranja:'ti-clock-pause', azul:'ti-file-check' };

async function abrirProcesso(identificador) {
  const content = document.getElementById('content');
  if (!content) return;
  content.innerHTML = '<span class="spinner"></span> Carregando processo...';

  const resProc = await api('processos/obter', isNaN(identificador) ? { numero_sei: identificador } : { id: identificador });
  if (!resProc.ok) { content.innerHTML = `<div class="alert alert-danger">Processo não encontrado: ${escHtml(resProc.erro || '')}</div>`; return; }
  processoAtual = resProc.processo;
  api('processos/marcar-lido', { processo_id: resProc.processo.id, usuario: usuarioAtual.email }).catch(()=>{});
  _renderBotoesStatus(resProc.processo.status);
  _ultimoTextoRevisadoHash = null;

  const [resDocs, resConteudo, resTram] = await Promise.all([
    api('documentos/listar', { processo_id: processoAtual.id }),
    api('conteudo/listar', { processo_id: processoAtual.id }),
    api('tramitacoes/listar', { processo_id: processoAtual.id })
  ]);
  const docs = resDocs.documentos || [];
  const blocos = resConteudo.blocos || [];
  // Já vem em ordem decrescente por data — a primeira em que EU aparecer como destinatário
  // é de quem recebi por último (é pra ela que "Devolver" manda de volta)
  const tramitacoes = resTram.tramitacoes || [];
  _ultimaTramitacaoRecebida = tramitacoes.find(t => String(t.para_usuario).toLowerCase() === usuarioAtual.email.toLowerCase()) || null;

  // Reconstrói o texto integral a partir dos blocos, agrupado por documento
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
        } catch (e) { /* resumo antigo ou inválido: só não mostra */ }
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
        <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
          ${_ultimaTramitacaoRecebida ? `<button class="btn btn-sm" onclick="devolverProcesso()" style="background-color:#d97706; color:#fff; border:none; font-weight:bold;"><i class="ti ti-corner-up-left"></i> Devolver</button>` : ''}
          <button class="btn btn-sm" onclick="modalEncaminhar()" style="background-color:#495057; color:#fff; border:none; font-weight:bold;"><i class="ti ti-share"></i> Encaminhar</button>
          <button class="btn btn-sm" onclick="finalizarProcesso()" style="background-color:#16a34a; color:#fff; border:none; font-weight:bold;"><i class="ti ti-check"></i> Finalizar</button>
          <button class="btn btn-sm" onclick="abrirPainelEvidencias()" style="background-color: #0dcaf0; color: #000; border: none; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1);"><i class="ti ti-columns"></i> Tela Dupla</button>
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
      <div style="margin-top:15px;display:flex;gap:10px;">
        <button class="btn btn-primary btn-sm" onclick="modalUploadZIP()"><i class="ti ti-cloud-upload"></i> Importar Arquivos</button>
        <button class="btn btn-secondary btn-sm" onclick="abrirTabelaDadosProcesso()"><i class="ti ti-table"></i> Gerar tabela de dados</button>
        <button class="btn btn-secondary btn-sm" onclick="modalImportarVersaoAssinada('processo')"><i class="ti ti-file-check"></i> Importar versão assinada</button>
        <div id="btn-status-processo" style="display:inline-flex;gap:6px;align-items:center;"></div>
      </div>
    </div>

    <!-- 1. PAINEL DE CHECAGEM -->
    <div style="background:#fff;border:1px solid #dee2e6;padding:20px;border-radius:8px;margin-bottom:16px;">
      <h3 style="font-size:1.1rem; color:var(--text-dark); margin-bottom:15px;"><i class="ti ti-microscope"></i> 1. Verificar Processo</h3>

      <!-- Fontes de análise — três cartões clicáveis -->
      <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:14px;">

        <!-- Camada 1: sempre ativa -->
        <div style="border:0.5px solid #dee2e6; border-radius:8px; padding:10px 14px; background:#f8f9fa; display:flex; align-items:flex-start; gap:10px;">
          <div style="width:32px;height:32px;border-radius:6px;background:#e7f5ff;color:#1c7ed6;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;"><i class="ti ti-file-text"></i></div>
          <div style="flex:1;">
            <div style="font-size:0.82rem;font-weight:600;color:#212529;display:flex;align-items:center;gap:6px;">
              Documentos do processo
              <span style="font-size:0.68rem;background:#d1e7dd;color:#0f5132;padding:2px 7px;border-radius:10px;">Sempre ativo</span>
            </div>
            <div style="font-size:0.75rem;color:#6c757d;margin-top:2px;line-height:1.4;">Contrato, aditivos, ofícios e despachos importados do SEI — lidos na ordem estruturante. Conferência de contas por código roda antes da IA.</div>
          </div>
        </div>

        <!-- Camada 2: Drive — ligado por padrão -->
        <div id="card-drive" style="border:0.5px solid #a3cfbb; border-radius:8px; padding:10px 14px; background:#e8f5e9; display:flex; align-items:flex-start; gap:10px; cursor:pointer;" onclick="toggleFonte('drive')">
          <div style="width:16px;height:16px;border-radius:4px;border:0.5px solid #adb5bd;background:#2563eb;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:8px;" id="chk-drive-box"><span style="color:#fff;font-size:10px;">✓</span></div>
          <input type="checkbox" id="chk-historico-unidade" checked style="display:none;">
          <div style="width:32px;height:32px;border-radius:6px;background:#d1fae5;color:#065f46;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;"><i class="ti ti-brand-google-drive"></i></div>
          <div style="flex:1;">
            <div style="font-size:0.82rem;font-weight:600;color:#212529;display:flex;align-items:center;gap:6px;">
              Histórico da unidade
              <span style="font-size:0.68rem;background:#d1fae5;color:#065f46;padding:2px 7px;border-radius:10px;">Google Drive</span>
            </div>
            <div style="font-size:0.75rem;color:#6c757d;margin-top:2px;line-height:1.4;">Busca o contrato de referência na pasta LEIS E DECRETOS pelo nome da unidade. Achados sempre marcados para confirmar.</div>
          </div>
        </div>
        <div id="status-fonte-historico" style="font-size:0.75rem; padding-left:14px;"></div>

        <!-- Camada 3: Web — desligado por padrão -->
        <div id="card-web" style="border:0.5px solid #dee2e6; border-radius:8px; padding:10px 14px; background:#f8f9fa; display:flex; align-items:flex-start; gap:10px; cursor:pointer;" onclick="toggleFonte('web')">
          <div style="width:16px;height:16px;border-radius:4px;border:0.5px solid #adb5bd;background:#f8f9fa;display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:8px;" id="chk-web-box"></div>
          <input type="checkbox" id="chk-legislacao-jurisprudencia" style="display:none;">
          <div style="width:32px;height:32px;border-radius:6px;background:#fef3c7;color:#92400e;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;"><i class="ti ti-world"></i></div>
          <div style="flex:1;">
            <div style="font-size:0.82rem;font-weight:600;color:#212529;display:flex;align-items:center;gap:6px;">
              Busca jurídica na web
              <span style="font-size:0.68rem;background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:10px;">Experimental · mais lento</span>
            </div>
            <div style="font-size:0.75rem;color:#6c757d;margin-top:2px;line-height:1.4;">Pesquisa em fontes públicas: Diário Oficial, legislação federal e estadual, TCU, TCE-PE, TCM-PE, STJ, STF, AGU. Confirme a fonte antes de citar em parecer.</div>
          </div>
        </div>

      </div>

      <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap; margin-bottom:10px;">
        <button class="btn btn-warning" onclick="rodarRaioX()"><i class="ti ti-bolt"></i> Executar Checagem</button>
        <span id="contador-checagem" style="font-weight:bold; font-size:0.95rem;"></span>
      </div>
      <div id="ia-status" style="margin-top:6px;"></div>
      <div id="painel-cards" style="margin-top:20px;"></div>
    </div>

    <!-- 2. PERGUNTAS AO PROCESSO -->
    <div style="background:#fff;border:1px solid #dee2e6;padding:20px;border-radius:8px;margin-bottom:16px;">
      <h3 style="font-size:1.1rem; color:var(--text-dark); margin-bottom:10px;"><i class="ti ti-message-circle"></i> 2. Perguntas ao Processo</h3>
      <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Faça perguntas específicas sobre os documentos anexados. A IA investigará e trará a resposta exata.</p>
      <div id="chat-history" style="margin-bottom: 15px; max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; background: #f8f9fa; padding: 15px; border-radius: 6px; border: 1px inset #e9ecef;">
          <div style="color: #adb5bd; font-size: 0.85rem; text-align: center; font-style: italic;">O histórico do chat aparecerá aqui...</div>
      </div>
      <div style="display:flex; gap:10px;">
         <input type="text" id="chat-input" placeholder="Ex: Qual o índice de reajuste da cláusula 4?" style="flex:1; padding:12px; border:1px solid #ced4da; border-radius:6px; outline:none; font-size: 0.95rem;" onkeypress="if(event.key === 'Enter') fazerPerguntaAoProcesso()">
         <button class="btn btn-primary" onclick="fazerPerguntaAoProcesso()" id="btn-perguntar"><i class="ti ti-send"></i> Perguntar</button>
      </div>
    </div>

    <!-- 3. PAINEL DE REVISÃO E LINGUAGEM SIMPLES -->
    <div style="background:#f8f9fa; border:1px dashed #adb5bd; padding:20px; border-radius:8px; margin-bottom:30px;">
      <h3 style="font-size:1.1rem; color:var(--text-dark); margin-bottom:10px;"><i class="ti ti-robot"></i> 3. Revisão Técnica e Textual</h3>
      <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Cole o seu parecer finalizado abaixo. A IA cruzará o seu texto com os documentos originais e fará apontamentos de mérito e clareza — a decisão de aprovar é sempre sua.</p>
      <textarea id="editor-final" placeholder="Cole o seu parecer do Word ou do SEI aqui para ser revisado..." style="width:100%; height:150px; padding:15px; border:1px solid #ced4da; border-radius:6px; font-family: inherit; font-size: 0.95rem; margin-bottom: 15px; outline:none; resize:vertical;"></textarea>
      <div style="display: flex; align-items: center; gap: 15px; flex-wrap:wrap;">
          <button class="btn btn-secondary" onclick="abrirCriarDocumento()"><i class="ti ti-file-plus"></i> Criar documento</button>
          <button class="btn btn-warning" onclick="rodarRevisaoFinal()"><i class="ti ti-search"></i> Executar Análise Completa</button>
          <span id="contador-revisao" style="font-weight: bold; font-size: 0.95rem;"></span>
      </div>
      <div id="status-revisao" style="margin-top:15px;"></div>
    </div>
  `;
  content.innerHTML = html;

  // Recarrega o histórico de perguntas/respostas salvo — sem isso a conversa
  // sumia toda vez que a pessoa saía e voltava pro processo
  api('consultas/listar', { processo_id: processoAtual.id }).then(resConsultas => {
    const consultas = resConsultas.consultas || [];
    if (!consultas.length) return;
    const historyEl = document.getElementById('chat-history');
    if (!historyEl) return;
    historyEl.innerHTML = consultas.map(c => `
      <div style="background:#e9ecef; padding:10px 15px; border-radius:15px 15px 15px 0; align-self:flex-start; max-width:85%; font-size: 0.9rem; color: #212529;">
          <strong><i class="ti ti-user"></i> Você:</strong><br>${escHtml(c.pergunta)}
      </div>
      <div style="background:#e7f5ff; border: 1px solid #74c0fc; padding:10px 15px; border-radius:15px 15px 0 15px; align-self:flex-end; max-width:85%; font-size: 0.9rem; color: #0b509e;">
          <strong><i class="ti ti-robot"></i> IA Investigadora:</strong><br>
          <div style="white-space: pre-wrap; margin-top:5px;">${escHtml(c.resposta)}</div>
      </div>`).join('');
    historyEl.scrollTop = historyEl.scrollHeight;
  }).catch(e => console.warn('Falha ao carregar histórico de consultas:', e.message));

  // Restaura a última Checagem já salva — sem isso, os alertas "zeravam" toda vez que
  // a pessoa saía e voltava pro processo, mesmo já tendo sido analisado antes.
  api('auditorias/listar', { processo_id: processoAtual.id }).then(resAud => {
    const auditorias = resAud.auditorias || [];
    const ultima = auditorias.find(a => a.tipo_checkpoint === 'GERAL' || a.tipo_checkpoint === 'ENTRADA');
    if (!ultima) return;
    let achados = [];
    try { achados = JSON.parse(ultima.achados_json || '[]'); } catch (e) { /* mantém vazio se inválido */ }

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


// ==================== BOTÕES DE FLUXO DE STATUS ====================
const _FLUXO_STATUS = [
  { de: 'Aguardando Revisão Inicial',   para: 'Em Análise',               label: 'Iniciar análise',      icone: 'ti-player-play',  cor: '#0b509e' },
  { de: 'Em Análise',                   para: 'Aguardando Revisão Final',  label: 'Enviar para revisão',  icone: 'ti-send',         cor: '#6f42c1' },
  { de: 'Aguardando Revisão Final',     para: 'Pronto para Assinar no SEI',label: 'Aprovar para assinar', icone: 'ti-circle-check', cor: '#2b8a3e' },
];

function _renderBotoesStatus(statusAtual) {
  const el = document.getElementById('btn-status-processo');
  if (!el) return;
  const acao = _FLUXO_STATUS.find(f => f.de === statusAtual);
  const badge = `<span style="font-size:0.72rem;background:#f8f9fa;border:0.5px solid #dee2e6;padding:3px 10px;border-radius:10px;color:#6c757d;">${escHtml(statusAtual)}</span>`;
  if (!acao) { el.innerHTML = badge; return; }
  el.innerHTML = badge + `
    <button class="btn btn-sm" style="background:${acao.cor};color:#fff;border:none;padding:4px 12px;border-radius:6px;font-size:0.78rem;cursor:pointer;"
      onclick="avancarStatusProcesso('${escAttr(acao.para)}','${escAttr(acao.label)}')">
      <i class="ti ${acao.icone}"></i> ${escHtml(acao.label)}
    </button>`;
}

async function avancarStatusProcesso(novoStatus, label) {
  if (!processoAtual) return;
  if (!confirm(`Mover processo para "${novoStatus}"?`)) return;
  const res = await api('processos/atualizar-status', { id: processoAtual.id, status: novoStatus });
  if (!res.ok) return alert('Erro ao atualizar: ' + (res.erro || ''));
  processoAtual.status = novoStatus;
  _renderBotoesStatus(novoStatus);
  mostrarToast(`Processo movido para "${novoStatus}".`);
  await atualizarContagensSidebar();
}

// ==================== ENCAMINHAR PROCESSO (tramitação entre usuários) ====================
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

  await api('log/registrar', { usuario: usuarioAtual.email, acao: 'ENCAMINHAR', processo_id: processoAtual.id, detalhes: 'Para: ' + destinatario });
  fecharModal();
  showView('dashboard', 'encaminhados'); // quem encaminhou passa a acompanhar automaticamente
}

// Devolve o processo direto pra quem enviou por último — sem precisar abrir o modal e
// escolher destinatário de novo. Só existe o botão quando há de fato uma tramitação
// anterior em que a pessoa logada foi a destinatária.
async function devolverProcesso() {
  if (!_ultimaTramitacaoRecebida) return;
  const paraQuem = _ultimaTramitacaoRecebida.de_usuario;
  if (!confirm(`Devolver este processo para ${paraQuem}?`)) return;

  const res = await api('processos/encaminhar', {
    processo_id: processoAtual.id, de: usuarioAtual.email, para: paraQuem, observacao: 'Devolvido'
  });
  if (!res.ok) { alert('Erro ao devolver: ' + res.erro); return; }

  await api('log/registrar', { usuario: usuarioAtual.email, acao: 'DEVOLVER', processo_id: processoAtual.id, detalhes: 'Para: ' + paraQuem });
  showView('dashboard', 'entrada');
}

// Finaliza o processo sem transferir para ninguém — usado quando a mesma pessoa que
// revisou é quem vai levar pro SEI assinar. É um AVISO, não um bloqueio: a ferramenta
// é um auxílio, a decisão de seguir sempre fica com o funcionário.
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

  const res = await api('processos/atualizar-status', { id: processoAtual.id, status: 'Concluído', documento_final: textoAtual });
  if (!res.ok) { alert('Erro ao finalizar: ' + res.erro); return; }

  await api('log/registrar', {
    usuario: usuarioAtual.email, acao: 'FINALIZAR', processo_id: processoAtual.id,
    detalhes: revisadoEIgual ? 'Revisão final confirmada' : 'Finalizado sem revisão final confirmada'
  });
  showView('dashboard', 'concluidos');
}

// ==================== UPLOAD (agora grava no backend, não no localStorage) ====================

// ==================== VERSÃO ASSINADA (volta do SEI) ====================
let _origemVersaoAssinada = 'processo';

function modalImportarVersaoAssinada(origem) {
  _origemVersaoAssinada = origem || 'processo';
  criarModal(`
    <h2 style="margin-bottom:8px; font-size:1.15rem;">Importar versão assinada (SEI)</h2>
    <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:14px;">Depois de assinar no SEI, exporte o documento e importe aqui. Ele fica marcado como a versão oficial deste processo.</p>
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
    await salvarDocumentoNoBackend(file.name, texto, detectarSensiveisDoArquivo(texto, file.name), 'FINAL_ASSINADO');
    await api('log/registrar', { usuario: usuarioAtual.email, acao: 'VERSAO_ASSINADA', processo_id: processoAtual.id, detalhes: file.name });
    status.innerHTML = '<div class="alert alert-success" style="background:#d1e7dd;color:#0f5132;padding:10px;border-radius:6px;">✓ Versão assinada registrada neste processo.</div>';
    setTimeout(() => {
      fecharModal();
      abrirProcesso(processoAtual.numero_sei || String(processoAtual.id));
    }, 1500);
  } catch(e) {
    status.innerHTML = `<div class="alert alert-danger">Não foi possível importar: ${escHtml(e.message)}</div>`;
  }
}

function abrirCriarDocumento() {
  criarModal(`
    <h2 style="margin-bottom:8px; font-size:1.15rem;">Criar documento</h2>
    <p style="font-size:0.88rem; line-height:1.6;">Esta função está aguardando os modelos padrão de nota técnica, parecer, minuta e ofício da DGMCG/GGPCG.</p>
    <p style="font-size:0.85rem; line-height:1.6; color:var(--text-muted);">Enquanto isso, use "Gerar tabela de dados" pra levar os números do processo pro seu documento, com a origem de cada um.</p>`);
}

function abrirTabelaDadosProcesso() {
  if (!textoIntegralAtual || textoIntegralAtual.trim().length < 20) return alert('Importe os documentos do processo primeiro.');
  const docs = dividirPorDocumento(textoIntegralAtual);
  const linhas = [];
  docs.forEach(d => {
    extrairValoresMonetarios(d.texto).forEach(v => linhas.push({ tipo:'Valor', valor:v.valor, trecho:v.contexto, doc:d.nome }));
    extrairDatas(d.texto).forEach(v => linhas.push({ tipo:'Data', valor:v.valor, trecho:v.contexto, doc:d.nome }));
    extrairCEPs(d.texto).forEach(v => linhas.push({ tipo:'CEP', valor:v.valor, trecho:v.contexto, doc:d.nome }));
  });
  if (!linhas.length) return alert('Nenhum valor, data ou CEP encontrado nos documentos.');
  const th = 'style="border:1px solid #ccc;padding:4px 8px;background:#eee;text-align:left;font-size:0.8rem;"';
  const td = 'style="border:1px solid #ccc;padding:4px 8px;font-size:0.8rem;vertical-align:top;"';
  const tabela = `<table style="border-collapse:collapse;width:100%;">
    <tr><th ${th}>Tipo</th><th ${th}>Valor</th><th ${th}>Trecho</th><th ${th}>Documento</th></tr>
    ${linhas.map(l => `<tr><td ${td}>${escHtml(l.tipo)}</td><td ${td}><strong>${escHtml(l.valor)}</strong></td><td ${td}>${escHtml(l.trecho)}</td><td ${td}>${escHtml(l.doc)}</td></tr>`).join('')}
  </table>`;
  criarModal(`
    <h2 style="margin-bottom:12px;font-size:1.15rem;">Tabela de dados do processo</h2>
    <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:10px;">Dados extraídos diretamente dos documentos por código — sem IA. Cole no Word ou no SEI.</p>
    <div style="display:flex;gap:8px;margin-bottom:10px;">
      <button class="btn btn-primary btn-sm" onclick="
        const el=document.getElementById('area-tab-dados');
        const sel=window.getSelection();sel.removeAllRanges();
        const range=document.createRange();range.selectNodeContents(el);sel.addRange(range);
        document.execCommand('copy');sel.removeAllRanges();
        mostrarToast('Tabela copiada — cole no documento.');
      "><i class="ti ti-copy"></i> Copiar tabela</button>
    </div>
    <div id="area-tab-dados" style="max-height:50vh;overflow:auto;">${tabela}</div>`, false);
}

function modalUploadZIP() {
  criarModal(`
    <h2 style="margin-bottom:15px; font-size:1.2rem;">Importar Arquivos</h2>
    <div class="dropzone" id="dz-upload"
         ondragover="event.preventDefault(); this.style.borderColor='var(--action-amber)'; this.style.backgroundColor='#fff3cd';"
         ondragleave="event.preventDefault(); this.style.borderColor='#ced4da'; this.style.backgroundColor='#f8f9fa';"
         ondrop="event.preventDefault(); this.style.borderColor='#ced4da'; this.style.backgroundColor='#f8f9fa'; document.getElementById('file-up').files = event.dataTransfer.files; processarUploadZIP(event.dataTransfer.files);"
         onclick="document.getElementById('file-up').click()">
      <i class="ti ti-cloud-download" style="font-size:2.5rem; margin-bottom:10px; color:var(--action-primary);"></i><br>
      <strong>Arraste um ou mais arquivos aqui</strong><br>
      <span style="font-size:0.85rem;">ZIP, PDF, DOCX, XLSX, TXT, CSV, MD ou PPTX — pode soltar vários juntos, sem precisar zipar antes</span>
    </div>
    <input type="file" id="file-up" multiple style="display:none" onchange="processarUploadZIP(this.files)">
    <div id="up-status" style="margin-top:15px;"></div>
  `);
}

// Envia um documento já extraído para o backend, quebrando o texto em blocos
// (o Sheets tem limite prático de tamanho por célula).
const BLOCO_MAX_CHARS = 45000;
async function salvarDocumentoNoBackend(nomeArquivo, texto, sensiveis, tipoDocumento) {
  const res = await api('documentos/adicionar-completo', {
    processo_id: processoAtual.id, nome_arquivo: nomeArquivo, texto, adicionado_por: usuarioAtual.email,
    resumo_sensiveis: sensiveis && sensiveis.length ? JSON.stringify(sensiveis) : '',
    tipo_documento: tipoDocumento || ''
  });
  if (!res.ok) throw new Error('Falha ao salvar documento: ' + res.erro);
}

// Todo tipo de arquivo que o sistema sabe extrair — usado tanto pra upload direto
// quanto pra decidir o que processar dentro de um ZIP. Qualquer arquivo fora dessa
// lista, dentro de um ZIP, é EXPLICITAMENTE avisado como não importado — nunca some
// em silêncio (é exatamente esse tipo de perda que compromete a auditoria).
const EXTENSOES_SUPORTADAS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls', '.txt', '.csv', '.md', '.pptx', '.ppt'];

async function extrairTextoArquivo(nomeArquivo, buf) {
  const nome = nomeArquivo.toLowerCase();
  if (nome.endsWith('.pdf')) return extrairTextoPDF(buf);

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

  // Texto puro — não precisa de biblioteca nenhuma, é só decodificar os bytes.
  if (nome.endsWith('.txt') || nome.endsWith('.csv') || nome.endsWith('.md')) {
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
  }

  // .pptx é um ZIP com um XML por slide — reaproveita o JSZip que já carregamos pra
  // .zip, sem precisar de nenhuma biblioteca nova.
  if (nome.endsWith('.pptx')) {
    if (typeof JSZip === 'undefined') throw new Error('Biblioteca JSZip não carregada — necessária pra abrir .pptx.');
    const zip = await JSZip.loadAsync(buf);
    const slideFiles = Object.keys(zip.files)
      .filter(k => /^ppt\/slides\/slide\d+\.xml$/.test(k))
      .sort((a, b) => parseInt(a.match(/slide(\d+)\.xml/)[1], 10) - parseInt(b.match(/slide(\d+)\.xml/)[1], 10));
    if (!slideFiles.length) throw new Error('Não foi possível encontrar slides dentro do arquivo — pode estar corrompido ou vazio.');
    let textoCompleto = '';
    for (let i = 0; i < slideFiles.length; i++) {
      const xml = await zip.files[slideFiles[i]].async('string');
      const textos = [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map(m => _decodeXmlEntities(m[1]));
      textoCompleto += `\n--- Slide ${i + 1} ---\n` + textos.join(' ') + '\n';
    }
    return textoCompleto;
  }

  // .ppt (formato binário antigo, pré-2007) não é ZIP — não temos biblioteca capaz de
  // ler esse formato. Em vez de tentar e falhar em silêncio, avisa exatamente o motivo.
  if (nome.endsWith('.ppt')) {
    throw new Error('Formato antigo do PowerPoint (.ppt) não tem suporte de leitura nesta ferramenta — salve/exporte como .pptx e importe de novo.');
  }

  throw new Error('Tipo de arquivo não suportado.');
}

function _decodeXmlEntities(s) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

// Processa TODOS os arquivos soltados de uma vez — sejam eles arquivos soltos (PDF/
// DOCX/XLSX individuais), um ou mais ZIPs, ou uma mistura dos dois. Antes, só o primeiro
// arquivo da lista era processado e o resto desaparecia em silêncio; agora nada se perde
// sem avisar o motivo.
async function processarUploadZIP(files) {
  const status = document.getElementById('up-status');
  const listaArquivos = Array.from(files || []);
  if (!listaArquivos.length) return;

  const avisos = [];
  let importados = 0;

  for (const file of listaArquivos) {
    const nomeLower = file.name.toLowerCase();

    if (nomeLower.endsWith('.zip')) {
      status.innerHTML = `<span class="spinner"></span> Mapeando ${escHtml(file.name)}...`;
      try {
        const zip = new JSZip();
        const contents = await zip.loadAsync(file);
        const todosArquivos = Object.keys(contents.files).filter(k => !contents.files[k].dir);
        const arquivosSuportados = todosArquivos.filter(k => EXTENSOES_SUPORTADAS.some(ext => k.toLowerCase().endsWith(ext)));
        const arquivosIgnorados = todosArquivos.filter(k => !arquivosSuportados.includes(k));

        for (const filename of arquivosSuportados) {
          status.innerHTML = `<span class="spinner"></span> Processando ${escHtml(filename.substring(0, 30))}...`;
          try {
            const buf = await contents.files[filename].async('arraybuffer');
            const texto = await extrairTextoArquivo(filename, buf);
            if (texto.trim().length > 20) { await salvarDocumentoNoBackend(filename, texto, detectarSensiveisDoArquivo(texto, filename)); importados++; }
            else avisos.push(`${filename}: nenhum texto extraído (pode ser imagem/escaneado sem OCR) — NÃO importado`);
          } catch (e) { avisos.push(`${filename}: ${e.message}`); }
        }
        // Nunca silencia: qualquer arquivo dentro do ZIP que não seja de tipo suportado é avisado, não some.
        arquivosIgnorados.forEach(f => avisos.push(`${f}: tipo de arquivo não suportado — NÃO foi importado`));
      } catch (e) {
        avisos.push(`${file.name}: não foi possível abrir o ZIP (${e.message})`);
      }

    } else if (EXTENSOES_SUPORTADAS.some(ext => nomeLower.endsWith(ext))) {
      status.innerHTML = `<span class="spinner"></span> Extraindo texto de ${escHtml(file.name)}...`;
      try {
        const buf = await file.arrayBuffer();
        const texto = await extrairTextoArquivo(file.name, buf);
        if (!texto.trim().length) throw new Error('nenhum texto extraído (pode ser um arquivo escaneado/imagem, sem OCR)');
        await salvarDocumentoNoBackend(file.name, texto, detectarSensiveisDoArquivo(texto, file.name));
        importados++;
      } catch (e) {
        avisos.push(`${file.name}: ${e.message}`);
      }

    } else {
      avisos.push(`${file.name}: tipo de arquivo não suportado — NÃO foi importado`);
    }
  }

  status.innerHTML = avisos.length
    ? `<div class="alert alert-warning"><strong>${importados} importado(s), ${avisos.length} aviso(s):</strong><br>${avisos.map(escHtml).join('<br>')}</div>`
    : `<div class="alert alert-success" style="background:#d1e7dd; color:#0f5132; padding:10px; border-radius:6px;">✓ ${importados} documento(s) importado(s) com sucesso!</div>`;
  setTimeout(() => { fecharModal(); abrirProcesso(processoAtual.numero_sei || String(processoAtual.id)); }, avisos.length ? 4500 : 1800);
}

async function extrairTextoPDF(buf) {
  if (typeof pdfjsLib === 'undefined') return '';
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  let txt = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const content = await (await pdf.getPage(i)).getTextContent();
    txt += _reconstruirLinhasPDF(content.items) + '\n';
  }
  return txt;
}

// pdf.js devolve cada trecho de texto como um item isolado, sem indicar quebra de
// linha — juntar tudo com espaço (como era antes) destrói a estrutura de tabelas,
// já que cada célula é um item separado. Aqui, agrupamos os itens pela posição
// vertical (mesma linha = mesmo Y, com uma margem de tolerância) e ordenamos cada
// linha da esquerda pra direita, reconstruindo a ordem visual real — inclusive de
// linhas de tabela — antes de virar texto corrido.
function _reconstruirLinhasPDF(items) {
  if (!items.length) return '';
  const TOLERANCIA_Y = 2; // pontos — itens dentro dessa margem contam como a mesma linha

  const linhas = [];
  items.forEach(item => {
    const y = item.transform ? item.transform[5] : 0;
    const x = item.transform ? item.transform[4] : 0;
    let linha = linhas.find(l => Math.abs(l.y - y) <= TOLERANCIA_Y);
    if (!linha) { linha = { y, itens: [] }; linhas.push(linha); }
    linha.itens.push({ x, str: item.str });
  });

  // PDF tem Y crescendo de baixo pra cima — ordena do topo da página pra baixo
  linhas.sort((a, b) => b.y - a.y);
  return linhas.map(l => l.itens.sort((a, b) => a.x - b.x).map(it => it.str).join(' ')).join('\n');
}

// ==================== GEMINI PREMIUM ====================
const GEMINI_TIMEOUT_MS = 60000;

async function invocarGeminiPremium(prompt, isChat = false, statusEl = null) {
  if (!GEMINI_KEY || GEMINI_KEY.trim() === '') throw new Error("Chave da IA não configurada. Vá em Configuração IA e cole sua chave.");

  const NOME_MODELO = 'gemini-3.6-flash';
  let genConfig = { temperature: 0.1 };
  if (!isChat) genConfig.responseMimeType = "application/json";

  // 503 (servidor sobrecarregado) e 429 (limite de taxa) são erros TRANSITÓRIOS do
  // lado do Google, não um problema de configuração — vale tentar de novo com espera
  // crescente antes de mostrar erro pro usuário.
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
      if (e.name === 'AbortError') throw new Error(`O Gemini não respondeu em ${GEMINI_TIMEOUT_MS / 1000}s. Tente novamente.`);
      throw new Error('Falha de rede ao chamar o Gemini: ' + e.message);
    }
    clearTimeout(timer);

    if ((resposta.status === 503 || resposta.status === 429) && tentativa < MAX_TENTATIVAS) {
      const espera = ESPERAS_MS[tentativa - 1];
      if (statusEl) statusEl.innerHTML = `<span class="spinner"></span> Google sobrecarregado (HTTP ${resposta.status}) — tentando de novo em ${espera / 1000}s... (tentativa ${tentativa}/${MAX_TENTATIVAS})`;
      await new Promise(r => setTimeout(r, espera));
      continue;
    }

    if (!resposta.ok) throw new Error(`Erro na API do Google (HTTP ${resposta.status}):\n${await resposta.text()}`);

    const resJson = await resposta.json();
    const candidato = resJson.candidates?.[0];
    if (!candidato || !candidato.content?.parts?.length) {
      throw new Error('O Gemini não retornou uma resposta válida (pode ter sido bloqueada ou instável). Tente novamente.');
    }
    let txt = candidato.content.parts.map(pt => pt.text || '').join('');
    return isChat ? txt : txt.replace(/```json/g, '').replace(/```/g, '').trim();
  }
  throw new Error('O Google continuou sobrecarregado após múltiplas tentativas. Tente novamente em alguns minutos.');
}

// ==================== MOTOR MULTI-PROVEDOR (Gemini → Groq → Ollama) ====================
// Ordem fixa: Gemini primeiro (já com retry interno pra 503/429). Se falhar de verdade
// (não só demorar), tenta Groq — outro provedor em nuvem, mesmo nível de exposição de
// dados que o Gemini (decisão consciente, não efeito colateral). Se Groq também falhar
// ou não estiver configurado, tenta Ollama local — só funciona se estiver instalado e
// rodando na máquina. Cada etapa só entra em ação se a anterior der erro de verdade.
const PROVEDOR_TIMEOUT_MS = 60000;

// Painel visual de provedores — mostra os 3 (Gemini/Groq/Ollama) com estado (pendente/
// tentando/ok/falhou/pulado), pra nunca ficar "rodando" sem saber qual está sendo usado.
const ORDEM_PROVEDORES = [
  { id: 'gemini', nome: 'Gemini' },
  { id: 'groq', nome: 'Groq' },
  { id: 'kimi', nome: 'Kimi' },
  { id: 'openrouter', nome: 'OpenRouter' },
  { id: 'deepseek', nome: 'DeepSeek' },
  { id: 'ollama', nome: 'Ollama' }
];
function renderPainelProvedores(statusEl, estados, mensagem) {
  if (!statusEl) return;
  const cores = {
    pendente: { bg: '#f1f3f5', cor: '#868e96' },
    tentando: { bg: '#e7f5ff', cor: '#1c7ed6' },
    ok:       { bg: '#ebfbee', cor: '#2b8a3e' },
    falhou:   { bg: '#fff5f5', cor: '#c92a2a' },
    pulado:   { bg: '#f8f9fa', cor: '#adb5bd' }
  };
  const icones = { pendente: 'ti-minus', ok: 'ti-check', falhou: 'ti-x', pulado: 'ti-slash' };

  const pills = ORDEM_PROVEDORES.map(p => {
    const estado = estados[p.id] || 'pendente';
    const c = cores[estado];
    const iconeHtml = estado === 'tentando'
      ? '<span class="spinner" style="width:11px;height:11px;border-width:2px;margin:0;"></span>'
      : `<i class="ti ${icones[estado]}"></i>`;
    return `<span style="display:inline-flex; align-items:center; gap:5px; background:${c.bg}; color:${c.cor}; padding:4px 10px; border-radius:20px; font-size:0.78rem; font-weight:600;">${iconeHtml} ${p.nome}</span>`;
  }).join('');

  statusEl.innerHTML = `
    <div style="display:flex; gap:8px; margin-bottom:8px; flex-wrap:wrap;">${pills}</div>
    ${mensagem ? `<div style="font-size:0.82rem; color:var(--text-muted);">${escHtml(mensagem)}</div>` : ''}`;
}

// ==================== MASCARAMENTO DE DADOS PESSOAIS (LGPD) ====================
// Aplicado SOMENTE ao texto que vai pra provedores em nuvem (Gemini/Groq/OpenRouter).
// O Ollama, por rodar na própria máquina, recebe o texto original sem máscara.
//
// Duas camadas, nessa ordem:
// 1. BLOCO DE QUALIFICAÇÃO — contrato costuma ter um trecho padrão tipo "neste ato
//    representado por [NOME], CPF nº..., RG nº...". Em vez de tentar reconhecer o
//    NOME em si (impossível com confiança via regex), mascara o BLOCO INTEIRO onde
//    ele mora — é mais grosseiro, mas muito mais confiável que caçar nome solto.
// 2. Regex de formato conhecido (CPF, RG, e-mail, telefone, bancário) — pega o que
//    sobrar FORA de qualquer bloco de qualificação (ex.: CPF citado numa tabela
//    solta, não dentro da cláusula de qualificação das partes).
//
// LIMITE HONESTO: o bloco de qualificação é achado por uma frase-âncora ("neste ato
// representado por", "representado(a) neste ato por", "por seu representante legal")
// e captura até um limite de caracteres ou até o próximo ponto final — não é um
// parser de contrato de verdade, então cláusula redigida de um jeito muito fora do
// padrão pode escapar. CEP e valor monetário continuam fora da máscara (ver camada 2).
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
      // Os dois últimos argumentos do replace são sempre (posição, texto completo)
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
  // CPF primeiro, pra não ser "roubado" pela regra mais genérica de telefone
  substituir(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, 'CPF');
  substituir(/\b\d{1,2}\.\d{3}\.\d{3}-[\dxX]\b/g, 'RG');
  substituir(/[\w.+-]+@[\w-]+\.[\w.-]+/g, 'EMAIL');
  substituir(/\(\d{2}\)\s?9?\d{4}-?\d{4}\b/g, 'TELEFONE');
  substituir(/\b(?:ag[êe]ncia|conta corrente|c\/c)\s*:?\s*\d{3,10}-?\d?\b/gi, 'BANCARIO');
  return { textoMascarado, mapa, totalMascarado: mapa.size, detalhes };
}

// Último "--- DOC: nome ---" e "--- PÁGINA N ---" antes de um ponto do texto —
// é assim que se sabe de qual documento e página veio cada dado mascarado.
function _localizarOrigem(textoAntes) {
  const docMatches = [...textoAntes.matchAll(/--- DOC: (.+?) ---/g)];
  const pagMatches = [...textoAntes.matchAll(/--- PÁGINA (\d+) ---/g)];
  return {
    doc: docMatches.length ? docMatches[docMatches.length - 1][1].trim() : null,
    pagina: pagMatches.length ? pagMatches[pagMatches.length - 1][1] : null
  };
}

// Só DETECTA (não mascara): usado na importação, pra já mostrar em cada documento
// quantos dados sensíveis ele tem, antes de existir qualquer checagem.
function detectarSensiveisDoArquivo(texto, nomeArquivo) {
  const { detalhes } = mascararDadosSensiveis(texto);
  return detalhes.map(d => ({ tipo: d.tipo, doc: nomeArquivo, pagina: d.pagina }));
}

// Painel "o que foi mascarado e onde", mostrado depois da Checagem e da Revisão.
function renderPainelMascaramento(detalhes) {
  if (!detalhes || !detalhes.length) return '';
  const rotulos = { CPF: 'CPF', RG: 'RG', EMAIL: 'E-mail', TELEFONE: 'Telefone', BANCARIO: 'Dado bancário', QUALIFICACAO: 'Bloco de qualificação (nome e documento)' };
  const vistos = new Set();
  const unicos = detalhes.filter(d => { const k = d.tipo + '|' + (d.doc || '') + '|' + (d.pagina || ''); if (vistos.has(k)) return false; vistos.add(k); return true; });
  const linhas = unicos.map(d => {
    const origemTxt = [d.doc ? `doc. <strong>${escHtml(d.doc)}</strong>` : null, d.pagina ? `página ${escHtml(d.pagina)}` : null]
      .filter(Boolean).join(', ') || 'origem não identificada';
    return `<li style="margin-bottom:3px;"><span style="font-weight:600;">${escHtml(rotulos[d.tipo] || d.tipo)}</span> — ${origemTxt}</li>`;
  }).join('');
  return `
    <details style="margin-top:10px; background:#fff9db; border:1px solid #f5c518; border-radius:6px; padding:10px 14px;">
      <summary style="cursor:pointer; font-size:0.82rem; font-weight:600; color:#7c5a00;">
        <i class="ti ti-eye-off"></i> ${unicos.length} dado(s) pessoal(is) mascarado(s) antes de enviar à nuvem — ver o quê e onde
      </summary>
      <ul style="margin:8px 0 0 18px; font-size:0.8rem; color:#5c4600; padding:0;">${linhas}</ul>
    </details>`;
}

function desmascararTexto(texto, mapa) {
  if (!mapa || !mapa.size) return texto;
  let resultado = texto;
  for (const [marcador, original] of mapa) resultado = resultado.split(marcador).join(original);
  return resultado;
}


const PROVEDORES_INFO = {
  gemini:     { nome: 'Gemini' },
  groq:       { nome: 'Groq' },
  kimi:       { nome: 'Kimi' },
  openrouter: { nome: 'OpenRouter' },
  deepseek:   { nome: 'DeepSeek' },
  ollama:     { nome: 'Ollama' }
};

async function invocarIAComFallback(prompt, isChat = false, statusEl = null) {
  const erros = [];
  const estados = {};
  ORDEM_PROVEDORES_IDS.forEach(id => { estados[id] = 'pendente'; });

  // Marca como pulado os que estão sem chave ou desabilitados
  if (!GEMINI_KEY     || !GEMINI_ATIVO)     estados.gemini     = 'pulado';
  if (!GROQ_KEY       || !GROQ_ATIVO)       estados.groq       = 'pulado';
  if (!KIMI_KEY       || !KIMI_ATIVO)       estados.kimi       = 'pulado';
  if (!OPENROUTER_KEY || !OPENROUTER_ATIVO) estados.openrouter = 'pulado';
  if (!DEEPSEEK_KEY   || !DEEPSEEK_ATIVO)   estados.deepseek   = 'pulado';
  if (!OLLAMA_ATIVO)                         estados.ollama     = 'pulado';

  const { textoMascarado: promptMascarado, mapa, totalMascarado, detalhes } = mascararDadosSensiveis(prompt);
  window._ultimoMascaramentoDetalhes = detalhes;
  (window._mascaramentoAcumulado = window._mascaramentoAcumulado || []).push(...detalhes);
  const avisoMascara = totalMascarado > 0
    ? ` (${totalMascarado} dado(s) sensível(is) mascarado(s) antes de enviar à nuvem)` : '';

  // Mapa de invocadores — Ollama usa prompt original (local, sem necessidade de máscara)
  const MAPA_INVOCAR = {
    gemini:     { ativo: !!(GEMINI_KEY     && GEMINI_ATIVO),     fn: () => invocarGeminiPremium(promptMascarado, isChat, statusEl) },
    groq:       { ativo: !!(GROQ_KEY       && GROQ_ATIVO),       fn: () => invocarGroq(promptMascarado, isChat, statusEl) },
    kimi:       { ativo: !!(KIMI_KEY       && KIMI_ATIVO),       fn: () => invocarKimi(promptMascarado, isChat, statusEl) },
    openrouter: { ativo: !!(OPENROUTER_KEY && OPENROUTER_ATIVO), fn: () => invocarOpenRouter(promptMascarado, isChat, statusEl) },
    deepseek:   { ativo: !!(DEEPSEEK_KEY   && DEEPSEEK_ATIVO),   fn: () => invocarDeepSeek(promptMascarado, isChat, statusEl) },
    ollama:     { ativo: !!OLLAMA_ATIVO,                          fn: () => invocarOllama(prompt, isChat, statusEl) }
  };

  // Itera na ordem configurada pelo usuário (ORDEM_PROVEDORES_IDS)
  const pulados = [];
  for (const id of ORDEM_PROVEDORES_IDS) {
    const provedor = MAPA_INVOCAR[id];
    if (!provedor) continue;
    if (!provedor.ativo) {
      const nomeP = PROVEDORES_INFO[id] ? PROVEDORES_INFO[id].nome : id;
      const chaves = { gemini: GEMINI_KEY, groq: GROQ_KEY, kimi: KIMI_KEY, openrouter: OPENROUTER_KEY, deepseek: DEEPSEEK_KEY };
      const ativos = { gemini: GEMINI_ATIVO, groq: GROQ_ATIVO, kimi: KIMI_ATIVO, openrouter: OPENROUTER_ATIVO, deepseek: DEEPSEEK_ATIVO, ollama: OLLAMA_ATIVO };
      if (id !== 'ollama' && !chaves[id]) pulados.push(nomeP + ': PULADO_SEM_CHAVE');
      else if (!ativos[id]) pulados.push(nomeP + ': PULADO_DESLIGADO');
      continue;
    }

    const info = PROVEDORES_INFO[id];
    estados[id] = 'tentando';
    renderPainelProvedores(statusEl, estados, `Chamando ${info ? info.nome : id}...${id !== 'ollama' ? avisoMascara : ''}`);

    try {
      const r = await provedor.fn();
      estados[id] = 'ok';
      renderPainelProvedores(statusEl, estados, 'Concluído.');
      // Ollama é local — resposta não foi mascarada, não precisa desmascarar
      return id === 'ollama' ? r : desmascararTexto(r, mapa);
    } catch (e) {
      estados[id] = 'falhou';
      erros.push((info ? info.nome : id) + ': ' + e.message);
    }
  }

  renderPainelProvedores(statusEl, estados, 'Nenhum provedor respondeu.');
  if (!erros.length) throw new Error('Todos os provedores de IA falharam:\n' + pulados.join('\n') + '\n(Nenhum serviço em nuvem está ligado com chave neste navegador. Vá em "Motor de IA".)');
  throw new Error('Todos os provedores de IA falharam:\n' + erros.concat(pulados).join('\n'));
}

async function invocarGroq(prompt, isChat, statusEl) {
  if (statusEl) statusEl.innerHTML = `<span class="spinner"></span> Chamando Groq...`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVEDOR_TIMEOUT_MS);

  const body = { model: 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: prompt }], temperature: 0.1 };
  if (!isChat) body.response_format = { type: 'json_object' };

  let resposta;
  try {
    resposta = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + GROQ_KEY },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error(`não respondeu em ${PROVEDOR_TIMEOUT_MS / 1000}s`);
    throw new Error('falha de rede: ' + e.message);
  }
  clearTimeout(timer);

  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}: ${(await resposta.text()).substring(0, 200)}`);
  const json = await resposta.json();
  const txt = json.choices?.[0]?.message?.content;
  if (!txt) throw new Error('resposta vazia');
  return isChat ? txt : txt.replace(/```json/g, '').replace(/```/g, '').trim();
}

// "openrouter/free" é o roteador oficial de modelos gratuitos da OpenRouter (lançado
// fev/2026) — escolhe automaticamente entre os modelos gratuitos disponíveis no
// momento, evitando o problema comum de fixar um modelo específico que pode saltar
// pra fora do catálogo gratuito sem aviso. API compatível com OpenAI, igual o Groq.
async function invocarOpenRouter(prompt, isChat, statusEl) {
  if (statusEl) statusEl.innerHTML = `<span class="spinner"></span> Chamando OpenRouter...`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVEDOR_TIMEOUT_MS);

  const body = { model: 'openrouter/free', messages: [{ role: 'user', content: prompt }], temperature: 0.1 };
  if (!isChat) body.response_format = { type: 'json_object' };

  let resposta;
  try {
    resposta = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + OPENROUTER_KEY,
        'HTTP-Referer': location.origin, // OpenRouter recomenda identificar a origem da chamada
        'X-Title': 'SEI Analista'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error(`não respondeu em ${PROVEDOR_TIMEOUT_MS / 1000}s`);
    throw new Error('falha de rede: ' + e.message);
  }
  clearTimeout(timer);

  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}: ${(await resposta.text()).substring(0, 200)}`);
  const json = await resposta.json();
  const txt = json.choices?.[0]?.message?.content;
  if (!txt) throw new Error('resposta vazia');
  return isChat ? txt : txt.replace(/```json/g, '').replace(/```/g, '').trim();
}

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
    if (e.name === 'AbortError') throw new Error('A Kimi não respondeu em ' + (KIMI_TIMEOUT_MS/1000) + 's — modelo de raciocínio pode demorar mais. Tente de novo.');
    throw new Error('Falha de rede ao chamar a Kimi: ' + e.message);
  } finally { clearTimeout(timer); }
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ': ' + (await resp.text()).substring(0, 200));
  const json = await resp.json();
  const txt = json.choices?.[0]?.message?.content;
  if (!txt) throw new Error('Kimi não devolveu conteúdo.');
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
  } catch(e) {
    if (e.name === 'AbortError') throw new Error('DeepSeek não respondeu no tempo esperado.');
    throw new Error('Falha de rede ao chamar o DeepSeek: ' + e.message);
  } finally { clearTimeout(timer); }
  if (!resp.ok) throw new Error('HTTP ' + resp.status + ': ' + (await resp.text()).substring(0, 200));
  const json = await resp.json();
  const txt = json.choices?.[0]?.message?.content;
  if (!txt) throw new Error('DeepSeek não devolveu conteúdo.');
  return isChat ? txt : txt.replace(/```json/g, '').replace(/```/g, '').trim();
}

async function invocarOllama(prompt, isChat, statusEl) {
  if (statusEl) statusEl.innerHTML = `<span class="spinner"></span> Chamando Ollama local (${escHtml(OLLAMA_MODEL)})...`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVEDOR_TIMEOUT_MS);

  const body = { model: OLLAMA_MODEL, prompt, stream: false };
  if (!isChat) body.format = 'json';

  let resposta;
  try {
    resposta = await fetch(OLLAMA_URL + '/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: controller.signal
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error(`não respondeu em ${PROVEDOR_TIMEOUT_MS / 1000}s`);
    throw new Error('não foi possível conectar (o Ollama está rodando? "ollama serve")');
  }
  clearTimeout(timer);

  if (!resposta.ok) throw new Error(`HTTP ${resposta.status}`);
  const json = await resposta.json();
  const txt = json.response;
  if (!txt) throw new Error('resposta vazia');
  return isChat ? txt : txt.replace(/```json/g, '').replace(/```/g, '').trim();
}

// Busca de normas externas (leis, decretos, portarias) via Google Search grounding.
// IMPORTANTE: essa chamada NUNCA pode usar responseMimeType "application/json" — a API do
// Google rejeita a combinação de busca (tools: google_search) com modo JSON forçado (erro 400).
// Por isso é uma chamada separada da checagem estruturada; o resultado entra como texto no
// prompt principal, que aí sim continua em JSON normalmente (sem tools).
async function buscarNormasExternas(p) {
  if (!GEMINI_KEY || GEMINI_KEY.trim() === '') throw new Error("Chave da IA não configurada.");
  const NOME_MODELO = 'gemini-3.6-flash';

  const prompt = `Pesquise na web quais leis, decretos, portarias ou normas estaduais de Pernambuco (SES-PE)
regem Contratos de Gestão com Organizações Sociais de Saúde (OSS), com atenção especial a qualquer
norma aplicável à unidade "${p.unidade}" e à OSS "${p.oss}". Liste os principais dispositivos
normativos encontrados (nome, número, ano) com uma frase objetiva resumindo o que cada um estabelece.
Priorize fontes oficiais (diário oficial de PE, site da SES-PE, ALEPE). Se não encontrar nada
específico e confiável, diga isso claramente em vez de generalizar.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let resposta;
  try {
    resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${NOME_MODELO}:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1 } // sem responseMimeType — incompatível com google_search
      }),
      signal: controller.signal
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`A busca externa não respondeu em ${GEMINI_TIMEOUT_MS / 1000}s. Tente novamente ou desmarque a opção.`);
    throw new Error('Falha de rede na busca externa: ' + e.message);
  } finally {
    clearTimeout(timer);
  }

  if (!resposta.ok) throw new Error(`Erro na busca externa (HTTP ${resposta.status}): ${await resposta.text()}`);

  const resJson = await resposta.json();
  const candidato = resJson.candidates?.[0];
  if (!candidato || !candidato.content?.parts?.length) {
    // Falha conhecida: em buscas complexas o Gemini pode retornar sem candidato/texto
    // (TOO_MANY_TOOL_CALLS ou instabilidade). Trata como falha da busca, não da checagem inteira.
    throw new Error('A busca externa não retornou resposta (instabilidade do Gemini com busca na web). Tente novamente ou desmarque a opção.');
  }

  const texto = candidato.content.parts.map(pt => pt.text || '').join('');
  const chunks = candidato.groundingMetadata?.groundingChunks || [];
  const fontes = chunks.map(c => c.web ? { titulo: c.web.title, url: c.web.uri } : null).filter(Boolean);

  return { texto, fontes };
}

// Mesmo padrão de buscarNormasExternas — busca automática, grounding via Google Search,
// não é exclusiva de nenhum perfil (a mesma lógica de cruzamento vale pra qualquer pessoa,
// só a exibição do achado que pode variar depois por perfil).
async function buscarJurisprudencia(p) {
  if (!GEMINI_KEY || GEMINI_KEY.trim() === '') throw new Error("Chave da IA não configurada.");
  const NOME_MODELO = 'gemini-3.6-flash';

  const prompt = `Pesquise na web decisões do TCE-PE (Tribunal de Contas do Estado de Pernambuco) e do TCU
(Tribunal de Contas da União) sobre Contratos de Gestão com Organizações Sociais de Saúde (OSS) — com
atenção especial a decisões sobre divergência de valor contratual, aditivo sem justificativa técnica,
estouro de teto financeiro, ou irregularidade de CEP/endereço em contrato de gestão em saúde pública.
Liste as decisões encontradas (órgão, número/ano, uma frase objetiva do que decidiram) que sejam
relevantes pro tipo de inconsistência já identificada nos documentos deste processo (unidade
"${p.unidade}", OSS "${p.oss}"). Se não encontrar nada específico e confiável, diga isso claramente em
vez de generalizar.`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_TIMEOUT_MS);

  let resposta;
  try {
    resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${NOME_MODELO}:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.1 }
      }),
      signal: controller.signal
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new Error(`A busca de jurisprudência não respondeu em ${GEMINI_TIMEOUT_MS / 1000}s. Tente novamente ou desmarque a opção.`);
    throw new Error('Falha de rede na busca de jurisprudência: ' + e.message);
  } finally {
    clearTimeout(timer);
  }

  if (!resposta.ok) throw new Error(`Erro na busca de jurisprudência (HTTP ${resposta.status}): ${await resposta.text()}`);

  const resJson = await resposta.json();
  const candidato = resJson.candidates?.[0];
  if (!candidato || !candidato.content?.parts?.length) {
    throw new Error('A busca de jurisprudência não retornou resposta (instabilidade do Gemini com busca na web). Tente novamente ou desmarque a opção.');
  }

  const texto = candidato.content.parts.map(pt => pt.text || '').join('');
  const chunks = candidato.groundingMetadata?.groundingChunks || [];
  const fontes = chunks.map(c => c.web ? { titulo: c.web.title, url: c.web.uri } : null).filter(Boolean);

  return { texto, fontes };
}

// === EXPORTADOR DE RELATÓRIO DE ACHADOS ===
function exportarRelatorioAchados() {
  if (!window.achadosAtuais || window.achadosAtuais.length === 0) return alert('Nenhum achado para exportar.');
  const sei = processoAtual.numero_sei || String(processoAtual.id);

  let htmlReport = `
  <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
  <head><meta charset='utf-8'><title>Relatório de Achados Técnicos</title></head>
  <body style="font-family: 'Times New Roman', serif; font-size: 12pt; line-height: 1.5;">
      <h2 style="text-align: center; font-size: 14pt;">RELATÓRIO DE ACHADOS PRELIMINARES</h2>
      <p style="text-align: center; font-weight: bold;">Processo SEI: ${sei}</p>
      <p style="text-align: center; font-size: 10pt; color:#555;">Gerado por IA — cada achado deve ser conferido manualmente antes de uso formal.</p>
      <hr style="margin-bottom: 20px;">
  `;

  window.achadosAtuais.forEach((c, index) => {
    let doc = c.doc_origem && c.doc_origem !== 'undefined' ? c.doc_origem : 'Não identificado';
    const marcaVerificar = c.verificar === false ? '' : ' [REQUER VERIFICAÇÃO MANUAL]';
    htmlReport += `
      <div style="margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 15px;">
          <p><strong>${index + 1}. [${(c.tag || '').toUpperCase()}]${marcaVerificar} ${c.titulo}</strong></p>
          <p style="margin: 5px 0;"><strong>Setor de Análise:</strong> ${c.setor || ''}</p>
          <p style="margin: 5px 0;"><strong>Documento de Origem:</strong> ${doc}</p>
          <p style="margin: 5px 0;"><strong>Constatação Técnica:</strong> ${c.explicacao || ''}</p>
          <p style="margin: 5px 0; font-style: italic; color: #555;"><strong>Evidência Extraída:</strong> "${c.evidencia || ''}"</p>
      </div>`;
  });

  htmlReport += "</body></html>";

  const blob = new Blob(['\ufeff', htmlReport], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `Achados_${sei}.doc`;
  document.body.appendChild(link); link.click(); document.body.removeChild(link);
}

// ==================== EXTRAÇÃO DETERMINÍSTICA (regex — nunca "alucina" um número) ====================
// Esta camada roda ANTES da IA e não depende dela: valores, datas, nº de processo e CEP são
// extraídos por código puro. A IA recebe essa lista já curada, com a origem de cada item, em vez
// de ter que "notar" divergências lendo o texto bruto inteiro — reduz bastante o risco de erro
// justamente na categoria mais sensível (comparação numérica entre documentos).

function extrairContexto(texto, termo, raio) {
  const idx = texto.indexOf(termo);
  if (idx === -1) return '';
  const ini = Math.max(0, idx - raio);
  const fim = Math.min(texto.length, idx + termo.length + raio);
  return texto.substring(ini, fim).replace(/\s+/g, ' ').trim();
}
function extrairValoresMonetarios(texto) {
  const regex = /R\$\s?[\d.]+,\d{2}/g;
  return [...new Set(texto.match(regex) || [])].slice(0, 25).map(v => ({ valor: v, contexto: extrairContexto(texto, v, 55) }));
}
function extrairDatas(texto) {
  const regex = /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g;
  return [...new Set(texto.match(regex) || [])].slice(0, 25).map(v => ({ valor: v, contexto: extrairContexto(texto, v, 55) }));
}
function extrairNumerosProcesso(texto) {
  const regex = /\d{4,}\.\d{5,6}\/\d{4}-\d{2}/g;
  return [...new Set(texto.match(regex) || [])].slice(0, 10).map(v => ({ valor: v, contexto: extrairContexto(texto, v, 40) }));
}
// Aceita os dois formatos encontrados na prática: com ponto (50.751-535) e sem (52061-080)
function extrairCEPs(texto) {
  const regex = /\b\d{2}\.?\d{3}-\d{3}\b/g;
  return [...new Set(texto.match(regex) || [])].slice(0, 10).map(v => ({ valor: v, contexto: extrairContexto(texto, v, 45) }));
}

// Separa o texto integral (que vem com marcadores "--- DOC: nome ---") em documentos individuais
function dividirPorDocumento(textoIntegral) {
  const partes = textoIntegral.split(/--- DOC: (.+?) ---/).filter(p => p.trim().length > 0);
  const docs = [];
  for (let i = 0; i < partes.length; i += 2) {
    if (partes[i + 1] !== undefined) docs.push({ nome: partes[i].trim(), texto: partes[i + 1] });
  }
  return docs;
}

// Monta o bloco de dados já extraídos, agrupado por documento, para entrar no prompt da IA
function montarDadosExtraidos(textoIntegral) {
  const docs = dividirPorDocumento(textoIntegral);
  if (!docs.length) return '(nenhum documento identificado para extração)';

  return docs.map(d => {
    const valores = extrairValoresMonetarios(d.texto);
    const datas = extrairDatas(d.texto);
    const numsProcesso = extrairNumerosProcesso(d.texto);
    const ceps = extrairCEPs(d.texto);

    let bloco = `\n--- ${d.nome} ---\n`;
    if (valores.length)      bloco += 'VALORES:\n'      + valores.map(v => `  • ${v.valor}  (trecho: "...${v.contexto}...")`).join('\n') + '\n';
    if (datas.length)        bloco += 'DATAS:\n'        + datas.map(v => `  • ${v.valor}  (trecho: "...${v.contexto}...")`).join('\n') + '\n';
    if (numsProcesso.length)  bloco += 'Nº PROCESSO:\n'  + numsProcesso.map(v => `  • ${v.valor}`).join('\n') + '\n';
    if (ceps.length)          bloco += 'CEP:\n'          + ceps.map(v => `  • ${v.valor}  (trecho: "...${v.contexto}...")`).join('\n') + '\n';
    if (!valores.length && !datas.length && !numsProcesso.length && !ceps.length) bloco += '(nenhum valor/data/nº de processo/CEP detectado)\n';
    return bloco;
  }).join('\n');
}


function toggleFonte(tipo) {
  if (tipo === 'drive') {
    const chk = document.getElementById('chk-historico-unidade');
    const box = document.getElementById('chk-drive-box');
    const card = document.getElementById('card-drive');
    chk.checked = !chk.checked;
    if (chk.checked) {
      box.innerHTML = '<span style="color:#fff;font-size:10px;">✓</span>';
      box.style.background = '#2563eb';
      card.style.borderColor = '#a3cfbb';
      card.style.background = '#e8f5e9';
    } else {
      box.innerHTML = '';
      box.style.background = '#f8f9fa';
      card.style.borderColor = '#dee2e6';
      card.style.background = '#f8f9fa';
    }
  } else {
    const chk = document.getElementById('chk-legislacao-jurisprudencia');
    const box = document.getElementById('chk-web-box');
    const card = document.getElementById('card-web');
    chk.checked = !chk.checked;
    if (chk.checked) {
      box.innerHTML = '<span style="color:#fff;font-size:10px;">✓</span>';
      box.style.background = '#d97706';
      card.style.borderColor = '#d97706';
      card.style.background = '#fef3c7';
    } else {
      box.innerHTML = '';
      box.style.background = '#f8f9fa';
      card.style.borderColor = '#dee2e6';
      card.style.background = '#f8f9fa';
    }
  }
}


// ==================== CONFERÊNCIA DE CONTAS POR CÓDIGO ====================
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
function _numerosDaLinha(linha) {
  const limpa = linha
    .replace(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g, ' ')
    .replace(/\d{4,}\s*\.\s*\d{5,6}\s*\/\s*\d{4}\s*-\s*\d{2}/g, ' ')
    .replace(/\b\d{2}\.?\d{3}-\d{3}\b/g, ' ');
  return (limpa.match(/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?/g) || [])
    .map(_numeroBR).filter(n => n !== null);
}
function _paginaNaPosicao(texto, posicao) {
  const marcas = [...texto.substring(0, posicao).matchAll(/--- PÁGINA (\d+) ---/g)];
  return marcas.length ? marcas[marcas.length - 1][1] : null;
}
function conferirSomasPorCodigo(textoIntegral) {
  const achados = [];
  const vistosPorDoc = {};
  dividirPorDocumento(textoIntegral).forEach(d => {
    vistosPorDoc[d.nome] = new Set();
    let achadosNesteDoc = 0;
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
      const colunas = mesmaQtd ? numsTotal.map((_,c) => c) : [null];
      colunas.forEach(c => {
        const valorTotal = c === null ? numsTotal[numsTotal.length-1] : numsTotal[c];
        const soma = itens.reduce((acc,n) => acc + (c===null ? n[n.length-1] : n[c]), 0);
        if (Math.abs(soma - valorTotal) <= 0.01) return;
        if (achadosNesteDoc >= 3) return;
        const assinatura = `${_formatarBR(soma)}→${_formatarBR(valorTotal)}`;
        if (vistosPorDoc[d.nome].has(assinatura)) return;
        vistosPorDoc[d.nome].add(assinatura);
        achadosNesteDoc++;
        const pagina = _paginaNaPosicao(d.texto, posicaoDaLinha[i]);
        achados.push({
          tag: 'Cálculo', setor: 'SFCG',
          titulo: 'Soma da tabela não bate com o total informado',
          evidencia: linha.trim(),
          explicacao: `As ${itens.length} linha(s) acima somam ${_formatarBR(soma)}, mas o total informado é ${_formatarBR(valorTotal)} (diferença de ${_formatarBR(Math.abs(soma-valorTotal))}). Conta feita por código, não pela IA.`,
          sugestao: `Refaça a soma${pagina?' (página '+pagina+')':''} e corrija o valor errado — pode ser o total ou uma das linhas.`,
          doc_origem: d.nome, pagina, verificar: true, conferido_por_codigo: true
        });
      });
    });
  });
  return achados;
}
function conferirValoresRotuladosPorCodigo(textoIntegral) {
  const porRotulo = {};
  const regex = /(valor\s+(?:global|total|mensal|anual|estimado|contratual|do\s+contrato)(?:\s+do\s+contrato)?(?:\s+de\s+gest[aã]o)?)[^\n]{0,60}?(R\$\s?[\d.]+,\d{2})/gi;
  dividirPorDocumento(textoIntegral).forEach(d => {
    let m;
    while ((m = regex.exec(d.texto)) !== null) {
      const rotulo = m[1].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
      (porRotulo[rotulo] = porRotulo[rotulo]||[]).push({ valorTxt: m[2], valor: _numeroBR(m[2]), doc: d.nome, pagina: _paginaNaPosicao(d.texto, m.index) });
    }
    regex.lastIndex = 0;
  });
  const achados = [];
  Object.entries(porRotulo).forEach(([rotulo, ocorrencias]) => {
    const distintos = [...new Set(ocorrencias.map(o => o.valor))];
    if (distintos.length < 2) return;
    const lista = ocorrencias.slice(0,8).map(o => `${o.valorTxt} em ${o.doc}${o.pagina?' (pág.'+o.pagina+')':''}`).join('; ');
    achados.push({
      tag: 'Cálculo', setor: 'SFCG',
      titulo: `"${rotulo}" aparece com valores diferentes no processo`,
      evidencia: lista,
      explicacao: `O mesmo tipo de valor aparece com ${distintos.length} números diferentes: ${lista}.`,
      sugestao: 'Se um aditivo alterou esse valor, a diferença é esperada — confirme o documento mais recente. Se nenhum documento explica a mudança, corrija o valor divergente.',
      doc_origem: ocorrencias[0].doc, pagina: ocorrencias[0].pagina, verificar: true, conferido_por_codigo: true
    });
  });
  return achados;
}
function conferirContasPorCodigo(textoIntegral) {
  try {
    const todos = [...conferirSomasPorCodigo(textoIntegral), ...conferirValoresRotuladosPorCodigo(textoIntegral)];
    return todos.slice(0, 10);
  } catch(e) {
    console.warn('Conferência de contas por código falhou:', e.message);
    return [];
  }
}


// ==================== DIVISÃO EM LOTES (processos grandes) ====================
// Nenhum serviço de IA aceita um processo de milhões de caracteres numa chamada só
// (DeepSeek: 1 milhão de tokens; Kimi: limite de tokens por minuto da conta). Aqui o
// texto é dividido por documento em lotes. Cada lote recebe a lista COMPLETA de
// valores/datas/CEP extraídos por código de todos os documentos, então a comparação
// numérica entre documentos continua funcionando mesmo com os textos separados.
const LIMITE_CHARS_LOTE = 300000; // cerca de 85 a 100 mil tokens por chamada

function _dividirEmLotes(textoIntegral, limite) {
  const docs = dividirPorDocumento(textoIntegral);
  if (!docs.length) return [{ texto: textoIntegral, docs: [] }];
  const pedacos = [];
  docs.forEach(d => {
    if (d.texto.length <= limite) { pedacos.push({ nome: d.nome, texto: d.texto }); return; }
    // Documento maior que o lote inteiro: corta em partes, de preferência em quebra de linha
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

// Versão enxuta da lista extraída por código (sem os trechos de contexto), usada só
// quando a lista completa fica grande demais para caber junto em cada lote.
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

// Lê os cards da resposta da IA. Se o JSON vier cortado ou malformado, tenta limpar;
// se ainda assim falhar, recupera os cards completos que vieram antes do defeito.
function _lerCardsDaResposta(txt) {
  const s = String(txt || '');
  try { return JSON.parse(s).cards || []; } catch (e) { /* segue para as tentativas abaixo */ }
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
    if (fim > ini) { try { cards.push(JSON.parse(s.slice(ini, fim + 1))); } catch (e) { /* card defeituoso, pula */ } }
    pos = s.indexOf('"tag"', fim > pos ? fim : pos + 5);
  }
  if (!cards.length) throw new Error('A IA respondeu, mas a resposta não pôde ser lida como lista de achados.');
  return cards;
}

// === 1. CHECAGEM PREMIUM ===
async function rodarRaioX() {
  const st = document.getElementById('ia-status');
  const contadorEl = document.getElementById('contador-checagem');
  contadorEl.innerHTML = '';

  const p = processoAtual;
  if (!textoIntegralAtual || textoIntegralAtual.trim().length < 50) {
    return st.innerHTML = '<div class="alert alert-danger">Nenhum texto encontrado. Por favor, importe os documentos do processo primeiro.</div>';
  }

  // Aviso fixo e visível durante toda a checagem — números REAIS (qtd de documentos,
  // volume de texto, e tempo decorrido). Não é uma barra de "página X de Y": o sistema
  // manda o texto inteiro numa única chamada à IA, então não há como saber "em que
  // página" ela está — fingir isso seria inventar um progresso que não existe. O
  // cronômetro sim é real: conta segundo a segundo, de verdade, enquanto se espera.
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
      intervaloTimer = setInterval(() => {
        segundosDecorridos++;
        bannerTimer.textContent = segundosDecorridos + 's';
      }, 1000);
    }
  }

  try {
    let dadosExtraidos = montarDadosExtraidos(textoIntegralAtual);
    if (dadosExtraidos.length > 150000) dadosExtraidos = _dadosExtraidosCompactos(textoIntegralAtual);
    const achadosCodigo = conferirContasPorCodigo(textoIntegralAtual);
    const promptContas = achadosCodigo.length
      ? 'CONTAS JÁ CONFERIDAS POR CÓDIGO (NÃO repita estes achados — eles já serão mostrados ao analista):\n' + achadosCodigo.map(a => '- ' + a.titulo + ': ' + a.explicacao).join('\n') + '\n\n'
      : '';

  // Cruzamento com o histórico contratual da unidade (pasta Drive "LEIS E DECRETOS") —
  // fonte curada, roda ANTES de qualquer chamada à IA. Ligado por padrão.
  let historicoUnidadeBloco = '';
  const historicoUnidadeAtivo = document.getElementById('chk-historico-unidade')?.checked;
  const statusFonteEl = document.getElementById('status-fonte-historico');
  if (statusFonteEl) statusFonteEl.innerHTML = ''; // limpa resultado de uma checagem anterior antes de decidir o que mostrar agora

  if (!historicoUnidadeAtivo) {
    if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:var(--text-muted);">Cruzamento com o Drive desligado nesta checagem.</span>`;
  } else if (!p.unidade) {
    if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:var(--text-muted);">Processo sem "unidade" definida — não há como buscar na pasta.</span>`;
  } else if (historicoUnidadeAtivo && p.unidade) {
    st.innerHTML = `<span class="spinner"></span> Cruzando com histórico contratual da unidade (${escHtml(p.unidade)})...`;
    try {
      const resHist = await api('normas/buscar-por-unidade', { unidade: p.unidade });
      if (resHist.ok && resHist.encontrado) {
        const nomes = resHist.arquivos.map(a => a.nome).join(', ');
        const totalValores = resHist.arquivos.reduce((s, a) => s + a.valores.length, 0);
        const totalDatas = resHist.arquivos.reduce((s, a) => s + a.datas.length, 0);
        if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:#2b8a3e;"><i class="ti ti-check"></i> Encontrado: <strong>${escHtml(nomes)}</strong> — ${totalValores} valor(es), ${totalDatas} data(s) extraídos</span>`;
        historicoUnidadeBloco = '\n\nHISTÓRICO CONTRATUAL DA UNIDADE (fonte: pasta Drive "LEIS E DECRETOS" — valores/datas/CEP\n' +
          'já extraídos de todo o histórico da unidade, incluindo aditivos anteriores):\n' +
          resHist.arquivos.map(a => {
            let bloco = `\n--- ${a.nome} ---\n`;
            if (a.valores.length)   bloco += 'VALORES:\n'   + a.valores.map(v => `  • ${v.valor}  (trecho: "...${v.contexto}...")`).join('\n') + '\n';
            if (a.datas.length)     bloco += 'DATAS:\n'     + a.datas.map(v => `  • ${v.valor}  (trecho: "...${v.contexto}...")`).join('\n') + '\n';
            if (a.cep.length)       bloco += 'CEP:\n'       + a.cep.map(v => `  • ${v.valor}  (trecho: "...${v.contexto}...")`).join('\n') + '\n';
            return bloco;
          }).join('\n');
      } else if (resHist.ok && !resHist.encontrado) {
        if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:#c92a2a;"><i class="ti ti-x"></i> Nenhum arquivo encontrado na pasta Drive para "${escHtml(p.unidade)}"</span>`;
        historicoUnidadeBloco = `\n\n(Nenhum arquivo de histórico contratual encontrado na pasta Drive para a unidade "${p.unidade}".)`;
      } else {
        if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:#c92a2a;"><i class="ti ti-alert-triangle"></i> Falha ao consultar a pasta Drive: ${escHtml(resHist.erro || 'erro desconhecido')}</span>`;
        historicoUnidadeBloco = `\n\n(Cruzamento com histórico da unidade falhou: ${resHist.erro || 'erro desconhecido'} — checagem segue sem essa fonte.)`;
      }
    } catch (e) {
      if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:#c92a2a;"><i class="ti ti-alert-triangle"></i> Falha ao consultar a pasta Drive: ${escHtml(e.message)}</span>`;
      historicoUnidadeBloco = `\n\n(Cruzamento com histórico da unidade falhou: ${e.message} — checagem segue sem essa fonte.)`;
    }
  }

  // Busca externa de normas (opcional, via checkbox) — chamada separada do modo JSON da checagem
  let normasExternasBloco = '';
  const buscaExternaAtiva = document.getElementById('chk-legislacao-jurisprudencia')?.checked;
  if (buscaExternaAtiva) {
    st.innerHTML = `<span class="spinner"></span> Buscando normas externas na web (SES-PE)...`;
    try {
      const { texto: textoNormas, fontes } = await buscarNormasExternas(p);
      const listaFontes = fontes.length
        ? fontes.map(f => `  • ${f.titulo || '(sem título)'} — ${f.url}`).join('\n')
        : '  (a busca não retornou links de fonte explícitos — trate o conteúdo abaixo com cautela extra)';
      normasExternasBloco = `

NORMAS EXTERNAS ENCONTRADAS NA BUSCA WEB (⚠️ busca automática — pode trazer versão desatualizada,
de outro estado, ou não oficial; CONFIRME a fonte antes de citar isso em parecer):
${textoNormas}

FONTES CITADAS PELA BUSCA:
${listaFontes}`;
    } catch (e) {
      normasExternasBloco = `\n\n(Busca externa de normas falhou: ${e.message} — checagem segue só com os documentos do processo.)`;
    }
  }

  let jurisprudenciaBloco = '';
  const jurisprudenciaAtiva = document.getElementById('chk-legislacao-jurisprudencia')?.checked;
  if (jurisprudenciaAtiva) {
    st.innerHTML = `<span class="spinner"></span> Cruzando com jurisprudência (TCE-PE, TCU)...`;
    try {
      const { texto: textoJuris, fontes } = await buscarJurisprudencia(p);
      const listaFontesJuris = fontes.length
        ? fontes.map(f => `  • ${f.titulo || '(sem título)'} — ${f.url}`).join('\n')
        : '  (a busca não retornou links de fonte explícitos — trate o conteúdo abaixo com cautela extra)';
      jurisprudenciaBloco = `

JURISPRUDÊNCIA ENCONTRADA NA BUSCA WEB (⚠️ busca automática — pode ser decisão de outro contexto,
já superada, ou não oficial; CONFIRME a fonte antes de citar isso em parecer):
${textoJuris}

FONTES CITADAS PELA BUSCA:
${listaFontesJuris}`;
    } catch (e) {
      jurisprudenciaBloco = `\n\n(Busca de jurisprudência falhou: ${e.message} — checagem segue só com os documentos do processo.)`;
    }
  }

  st.innerHTML = `<span class="spinner"></span> Conectando aos servidores Premium do Google Gemini... Processando integralmente.`;

  const prompt = `Atue como Auditor Técnico Sênior (SES-PE). Cheque os documentos abaixo.
Unidade: ${p.unidade} | OSS: ${p.oss}

VALORES, DATAS, Nº DE PROCESSO E CEP JÁ EXTRAÍDOS POR CÓDIGO (100% precisos — extração automática,
não depende de leitura sua). USE ESTA LISTA COMO BASE PRINCIPAL para as checagens de divergência
numérica abaixo, em vez de tentar reler e recomparar os números direto do texto bruto:
${dadosExtraidos}
${historicoUnidadeBloco}

REGRAS DE CHECAGEM:
1. Valide OSS e Unidade.
2. DIVERGÊNCIA DE VALORES: usando a lista de VALORES extraída acima, ao encontrar dois valores de
   documentos diferentes que deveriam representar o mesmo dado (ex.: valor do contrato, valor de uma
   cláusula, meta de atendimento) mas aparecem diferentes, cite OS DOIS valores exatos e o documento
   de origem de cada um. Nunca aponte "há uma divergência" sem mostrar os dois números lado a lado.
3. DIVERGÊNCIA DE CEP: mesma lógica do item 2, usando a lista de CEP extraída acima.
4. ESTOURO DE TETO: só aponte isso se o valor do teto/limite estiver EXPLICITAMENTE presente na lista
   de VALORES extraída acima. Se o teto não estiver nessa lista, não faça essa checagem — não estime
   ou presuma um teto que não foi informado.
5. Indique o setor responsável pela checagem ('SFCG', 'GGPCG', etc.).
6. CONFRONTO DE ESCOPO: o Contrato Assinado é soberano sobre planos de trabalho.
7. IDENTIFICAÇÃO DO DOCUMENTO: identifique exatamente o nome do arquivo de onde extraiu cada evidência, e
   coloque isso SOMENTE no campo "doc_origem" — nunca repita o nome do arquivo dentro do campo "titulo"
   (ele já aparece destacado em outro lugar do card; repetir ali é redundante). O "titulo" deve descrever
   o problema em si (ex.: "Divergência no valor da cláusula 4"), não onde ele foi encontrado.
8. ERROS DE DIGITAÇÃO/REDAÇÃO: para isso (só para isso), pode usar o texto bruto dos documentos abaixo,
   já que não é uma comparação numérica.
9. Para cada achado, marque "verificar": true se depender de conferência manual, ou false apenas se for
   uma certeza absoluta e objetiva (ex.: um número que aparece escrito de duas formas diferentes no mesmo
   parágrafo). Na dúvida, use true.
10. Se houver um bloco "NORMAS EXTERNAS ENCONTRADAS NA BUSCA WEB" abaixo, você pode usá-lo para checar
    se o processo cumpre normas gerais da SES-PE. TODO achado baseado nessas normas externas deve ter
    "verificar": true SEMPRE (nunca false), porque a busca web não garante que a norma esteja atualizada
    ou seja a versão oficial vigente para Pernambuco. Cite explicitamente o nome/número da norma usada.
11. Se houver um bloco "HISTÓRICO CONTRATUAL DA UNIDADE" acima, compare os valores/datas/CEP do processo
    ATUAL contra esse histórico — é o mesmo tipo de checagem do item 2/3, só que contra o registro
    oficial anterior da unidade, não contra outro documento do mesmo processo. Marque
    "baseado_em_historico_unidade": true nesse achado (o casamento do arquivo é por nome, então ainda
    pode errar a unidade — trate como forte indício, não certeza).
12. Se houver um bloco "JURISPRUDÊNCIA ENCONTRADA NA BUSCA WEB" abaixo, use pra checar se o tipo de
    inconsistência já identificada tem precedente em decisão do TCE-PE ou TCU. TODO achado baseado
    nisso deve ter "verificar": true SEMPRE, pelo mesmo motivo do item 10 — busca automática não
    garante que a decisão citada ainda seja válida ou aplicável a este caso exato. Marque
    "baseado_em_jurisprudencia": true nesse achado, e cite explicitamente o número/órgão da decisão.

MUITO IMPORTANTE: se, após análise cuidadosa, não houver nenhuma inconsistência real e verificável, retorne
{"cards": []}. NUNCA invente um achado para preencher a resposta — retornar vazio é sempre preferível a um
achado forçado ou especulativo.

Retorne EXCLUSIVAMENTE um objeto JSON válido, sem markdown:
{"cards": [{"tag": "Financeiro", "setor": "SFCG", "titulo": "Título do Alerta", "evidencia": "trecho extraído (verbatim, o mais curto possível)", "explicacao": "motivo técnico, citando os valores/documentos exatos comparados", "doc_origem": "Nome do Arquivo de Origem", "verificar": true, "baseado_em_norma_externa": false, "baseado_em_historico_unidade": false, "baseado_em_jurisprudencia": false}]}
${normasExternasBloco}
${jurisprudenciaBloco}

${promptContas}TEXTO BRUTO DOS DOCUMENTOS (use apenas para o item 8 — erros de digitação/redação):
___TEXTO_DO_LOTE___`;

  window._mascaramentoAcumulado = [];
  const lotes = _dividirEmLotes(textoIntegralAtual, LIMITE_CHARS_LOTE);
  if (lotes.length > 1) {
    const maiores = dividirPorDocumento(textoIntegralAtual)
      .sort((a, b) => b.texto.length - a.texto.length).slice(0, 5)
      .map(d => `${escHtml(d.nome)} (${Math.round(d.texto.length / 1000)} mil)`).join(', ');
    document.getElementById('aviso-lotes')?.remove();
    st.insertAdjacentHTML('beforebegin', `<div id="aviso-lotes" style="background:#fff3cd;color:#664d03;padding:8px 12px;border-radius:6px;font-size:0.82rem;margin-top:8px;">
      <i class="ti ti-stack-2"></i> Processo grande (${Math.round(textoIntegralAtual.length / 1000)} mil caracteres): a análise será feita em <strong>${lotes.length} lotes</strong>, um depois do outro. Pode levar vários minutos.
      <div style="margin-top:4px;">Maiores documentos: ${maiores}</div></div>`);
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
      // Limite de tokens por minuto: não é falha de verdade, é só esperar a janela virar
      if (/TPM|rate_limit|HTTP 429/i.test(e.message) && !lotes[i]._jaEsperou) {
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
  const jsonStr = respostasIA.join('\n\n--- LOTE ---\n\n');
  const achadosIA = cardsIA.map(c => {
      if (c.baseado_em_norma_externa || c.baseado_em_historico_unidade || c.baseado_em_jurisprudencia || c.baseado_em_fonte_externa) c.verificar = true;
      return c;
    });
    window.achadosAtuais = [...achadosCodigo, ...achadosIA];

    contadorEl.innerHTML = window.achadosAtuais.length > 0
      ? `<span style="background: #f8d7da; color: #842029; padding: 6px 12px; border-radius: 20px;"><i class="ti ti-alert-triangle"></i> ${window.achadosAtuais.length} inconsistência(s)</span>`
      : `<span style="background: #d1e7dd; color: #0f5132; padding: 6px 12px; border-radius: 20px;"><i class="ti ti-check"></i> Processo limpo nesta checagem.</span>`;

    renderizarCards(window.achadosAtuais);
    st.innerHTML = falhasLote.length
      ? `<div style="background:#fff3cd;color:#664d03;padding:8px 12px;border-radius:6px;font-size:0.82rem;"><i class="ti ti-alert-triangle"></i> ${falhasLote.length} de ${lotes.length} lote(s) não foram analisados pela IA (lote ${falhasLote.map(f => f.lote).join(', ')}). Os achados acima cobrem só os demais. Rode a checagem de novo em alguns minutos para completar.</div>`
      : '';
    st.innerHTML += renderPainelMascaramento(window._mascaramentoAcumulado);

    // Registra a checagem como auditoria no backend (mantém histórico e status do processo)
    await api('auditorias/salvar', {
      processo_id: p.id, tipo_checkpoint: 'GERAL',
      achados_json: JSON.stringify(window.achadosAtuais),
      raw_ia: jsonStr, executado_por: usuarioAtual.email
    });
  } catch (e) {
    st.innerHTML = renderErroAmigavel(e.message);
  } finally {
    if (intervaloTimer) clearInterval(intervaloTimer);
    if (banner) banner.classList.add('hidden');
  }
}

function _separadorCamada(titulo, qtd, cor) {
  return `<div style="display:flex;align-items:center;gap:10px;margin:18px 0 8px;">
    <div style="flex:1;height:1px;background:#dee2e6;"></div>
    <span style="font-size:0.72rem;font-weight:700;color:${cor};text-transform:uppercase;letter-spacing:.05em;white-space:nowrap;">
      ${titulo} — ${qtd} achado(s)
    </span>
    <div style="flex:1;height:1px;background:#dee2e6;"></div>
  </div>`;
}

function renderizarCards(cards) {
  const painel = document.getElementById('painel-cards');
  let html = '';
  if (!cards || cards.length === 0) return painel.innerHTML = '<div class="alert alert-success">✓ Nenhum apontamento crítico detectado nesta checagem.</div>';

  html += `<div style="margin-bottom: 15px; text-align: right;">
      <button class="btn btn-secondary btn-sm" onclick="exportarRelatorioAchados()" style="background-color: #6c757d; color: white;"><i class="ti ti-file-type-doc"></i> Exportar Relatório de Achados (.DOC)</button>
  </div>`;

  // Separar por origem
  const codigo   = cards.filter(c => c.conferido_por_codigo);
  const processo = cards.filter(c => !c.conferido_por_codigo && !c.baseado_em_fonte_externa);
  const externos = cards.filter(c => c.baseado_em_fonte_externa);
  if (codigo.length)   html += _separadorCamada('🔢 Conferência de contas por código', codigo.length, '#1864ab');
  if (processo.length) html += _separadorCamada('📄 Documentos do processo', processo.length, '#495057');
  if (externos.length) html += _separadorCamada('🌐 Fonte externa', externos.length, '#e67700');
  const ordenados = [...codigo, ...processo, ...externos];
  ordenados.forEach((c, idx) => {
    const cardId = `rx-${idx}`;
    window.memoriaEvidencias[cardId] = { tag: c.tag, titulo: c.titulo, texto: c.explicacao + (c.sugestao ? '\n\n💡 O que fazer: ' + c.sugestao : ''), doc: c.doc_origem };
    const referenciaAchado = `${c.tag}: ${c.titulo}`;
    // Sem extensão na exibição — o que importa pra localizar no SEI é o identificador,
    // não ".pdf"/".docx" no final, que só polui visualmente o card.
    const nomeDocBruto = c.doc_origem && c.doc_origem !== 'undefined' ? c.doc_origem : 'Não identificado';
    const nomeDoc = nomeDocBruto.replace(/\.(pdf|docx?|xlsx?)$/i, '');
    const tagVerificar = (c.verificar === false ? '' : `<span style="font-size:0.68rem;background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:10px;font-weight:600;margin-left:6px;">⚠ VERIFICAR</span>`) + (c.conferido_por_codigo ? `<span style="font-size:0.68rem;background:#e7f5ff;color:#1864ab;padding:2px 8px;border-radius:10px;font-weight:600;margin-left:6px;">🔢 CONFERIDO POR CÓDIGO</span>` : '');

    html += `
    <div class="rx-card is-obice" id="${cardId}-div" data-referencia-achado="${escAttr(referenciaAchado)}">
      <div class="rx-header" onclick="document.getElementById('${cardId}-div').classList.toggle('open')">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
            <div><span class="rx-tag">${escHtml(c.tag)}</span> <span class="rx-title">${escHtml(c.titulo)}</span>${tagVerificar}</div>
        </div>
      </div>
      <div class="rx-body">
        <div style="margin-bottom: 12px;">
            <span style="font-size:0.75rem; background:#fff3cd; color:#856404; padding:4px 8px; border-radius:4px; border: 1px solid #ffeeba; cursor:pointer;" onclick="navigator.clipboard.writeText('${escAttr(nomeDocBruto)}'); alert('ID do Documento copiado! Vá no SEI e cole para buscar.');" title="Clique para copiar o identificador completo">
               <i class="ti ti-file-type-pdf"></i> ID do Documento: <strong>${escHtml(nomeDoc)}</strong>
            </span>
        </div>
        <div class="rx-evidence">${escHtml(c.evidencia)}</div>
        <p><strong>Setor:</strong> ${escHtml(c.setor)}</p>
        <p>${escHtml(c.explicacao)}</p>
        ${c.sugestao ? `<div style="margin-top:10px;background:#e6fcf5;border-left:3px solid #12b886;border-radius:4px;padding:8px 12px;">
          <div style="font-size:0.72rem;font-weight:700;color:#087f5b;text-transform:uppercase;margin-bottom:3px;"><i class="ti ti-bulb"></i> O que fazer</div>
          <div style="font-size:0.85rem;color:#0b6157;">${escHtml(c.sugestao)}</div>
        </div>` : ''}
        <div style="margin-top: 15px; display: flex; gap: 10px; flex-wrap:wrap;">
          <button class="btn btn-sm" style="background-color: #0dcaf0; color: #000; border: none; font-weight: bold;" onclick="fixarEvidenciaDaMemoria('${cardId}')"><i class="ti ti-pin"></i> Fixar na Tela 2</button>
          <button class="btn btn-sm" style="background-color: #495057; color: #fff; border: none; font-weight: bold;" onclick="modalEncaminharAchado('${escAttr(referenciaAchado)}')"><i class="ti ti-send"></i> Encaminhar este achado</button>
          <button class="btn btn-secondary btn-sm" style="background-color: #f8d7da; color: #842029; border: 1px solid #f5c2c7;" onclick="descartarCard('${cardId}-div')"><i class="ti ti-trash"></i> Ocultar</button>
        </div>
        <div class="status-consulta-achado" style="margin-top:10px;"></div>
      </div>
    </div>`;
  });
  painel.innerHTML = html;
  carregarStatusConsultasAchados();
}

function descartarCard(idDiv) {
  const card = document.getElementById(idDiv);
  if (card) { card.style.transition = '0.3s ease'; card.style.opacity = '0'; setTimeout(() => card.remove(), 300); }
}

// ==================== ENCAMINHAR ACHADO ESPECÍFICO ====================
// Diferente de "Encaminhar" no topo do processo: aqui não transfere responsabilidade
// nenhuma, é só uma consulta pontual sobre UM achado. Quem recebe só vê isso se abrir
// esse mesmo processo depois — não existe aviso/notificação (limite conhecido).
async function modalEncaminharAchado(referenciaAchado) {
  criarModal(`<span class="spinner"></span> Carregando usuários...`);
  const res = await api('usuarios/listar');
  if (!res.ok) { criarModal(`<div class="alert alert-danger">Erro: ${escHtml(res.erro)}</div>`); return; }

  const usuarios = (res.usuarios || []).filter(u => u.email !== usuarioAtual.email);
  if (!usuarios.length) { criarModal(`<div class="alert alert-warning">Não há outro usuário cadastrado.</div>`); return; }

  const opcoes = usuarios.map(u => `<option value="${escAttr(u.email)}">${escHtml(u.nome)} (${escHtml(u.gerencia)})</option>`).join('');
  criarModal(`
    <h2 style="margin-bottom:8px; font-size:1.15rem;">Encaminhar Achado</h2>
    <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:15px;">"${escHtml(referenciaAchado)}"</p>
    <input type="hidden" id="enc-ach-referencia" value="${escAttr(referenciaAchado)}">
    <div class="form-group">
      <label>Enviar para</label>
      <select id="enc-ach-destinatario" style="width:100%;padding:8px;border:1px solid #ced4da;border-radius:6px;">${opcoes}</select>
    </div>
    <div class="form-group">
      <label>Sua pergunta/observação</label>
      <textarea id="enc-ach-mensagem" placeholder="Ex: Você concorda com essa leitura? Confirma esse valor?" style="width:100%;min-height:70px;padding:8px;border:1px solid #ced4da;border-radius:6px;"></textarea>
    </div>
    <div id="enc-ach-status"></div>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-secondary" style="flex:1;" onclick="fecharModal()"><i class="ti ti-x"></i> Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" onclick="confirmarEncaminharAchado()"><i class="ti ti-send"></i> Enviar</button>
    </div>
  `, false);
}

async function confirmarEncaminharAchado() {
  const referencia = document.getElementById('enc-ach-referencia').value;
  const destinatario = document.getElementById('enc-ach-destinatario').value;
  const mensagem = document.getElementById('enc-ach-mensagem').value.trim();
  const statusEl = document.getElementById('enc-ach-status');
  statusEl.innerHTML = '<span class="spinner"></span> Enviando...';

  const res = await api('achados/encaminhar', {
    processo_id: processoAtual.id, achado_referencia: referencia,
    de_usuario: usuarioAtual.email, para_usuario: destinatario, mensagem
  });
  if (!res.ok) { statusEl.innerHTML = `<div class="alert alert-danger">${escHtml(res.erro)}</div>`; return; }

  fecharModal();
  carregarStatusConsultasAchados();
}

// Tempo decorrido REAL desde o envio — nunca um prazo/SLA fingido, só "há quanto tempo
// está esperando", igual já fazemos no cronômetro do banner da Checagem.
function _tempoDecorridoDesde(dataISO) {
  const ms = Date.now() - new Date(dataISO).getTime();
  const minutos = Math.floor(ms / 60000);
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `${horas}h`;
  const dias = Math.floor(horas / 24);
  return dias === 1 ? '1 dia' : `${dias} dias`;
}

async function carregarStatusConsultasAchados() {
  if (!processoAtual) return;
  try {
    const res = await api('achados/listar', { processo_id: processoAtual.id });
    if (!res.ok) return;
    const consultas = res.consultas || [];

    document.querySelectorAll('[data-referencia-achado]').forEach(cardDiv => {
      const referencia = cardDiv.getAttribute('data-referencia-achado');
      const statusEl = cardDiv.querySelector('.status-consulta-achado');
      if (!statusEl) return;
      // A mais recente encaminhada pra essa referência, se houver mais de uma no tempo
      const consulta = consultas.filter(c => c.achado_referencia === referencia)[0];
      if (!consulta) { statusEl.innerHTML = ''; return; }

      if (consulta.resposta) {
        statusEl.innerHTML = `
          <div style="background:#e7f5ff; border-left:3px solid #339af0; padding:8px 12px; border-radius:4px; font-size:0.82rem;">
            <strong>${escHtml(consulta.para_usuario)} respondeu</strong> (${_tempoDecorridoDesde(consulta.data_resposta)} atrás):
            <div style="margin-top:4px; color:#1864ab;">${escHtml(consulta.resposta)}</div>
          </div>`;
      } else if (String(consulta.para_usuario).toLowerCase() === String(usuarioAtual.email).toLowerCase()) {
        // Sou eu que preciso responder — mostra a pergunta e um campo pra responder na hora
        statusEl.innerHTML = `
          <div style="background:#fff9db; border-left:3px solid #f5c518; padding:8px 12px; border-radius:4px; font-size:0.82rem;">
            <strong>${escHtml(consulta.de_usuario)} pediu sua opinião</strong> (há ${_tempoDecorridoDesde(consulta.data_envio)}): "${escHtml(consulta.mensagem)}"
            <textarea id="resposta-${consulta.id}" placeholder="Sua resposta..." style="width:100%; margin-top:8px; padding:6px; border:1px solid #ced4da; border-radius:4px; min-height:50px;"></textarea>
            <button class="btn btn-primary btn-sm" style="margin-top:6px;" onclick="responderConsultaAchado(${consulta.id})">Responder</button>
          </div>`;
      } else {
        statusEl.innerHTML = `
          <div style="font-size:0.78rem; color:var(--text-muted);">
            <i class="ti ti-clock"></i> Enviado para ${escHtml(consulta.para_usuario)} há ${_tempoDecorridoDesde(consulta.data_envio)} — aguardando resposta.
          </div>`;
      }
    });
  } catch (e) { console.warn('Falha ao carregar status de achados encaminhados:', e.message); }
}

async function responderConsultaAchado(id) {
  const textarea = document.getElementById('resposta-' + id);
  const resposta = textarea.value.trim();
  if (!resposta) return alert('Escreva uma resposta antes de enviar.');
  const res = await api('achados/responder', { id, resposta });
  if (!res.ok) { alert('Erro ao responder: ' + res.erro); return; }
  carregarStatusConsultasAchados();
}

// === 2. PERGUNTAS AO PROCESSO ===
// Filtra o texto integral pra só os parágrafos que contêm palavra-chave da pergunta —
// usado apenas quando o texto acumulado é grande (ver LIMIAR_FILTRAGEM no chamador).
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

async function fazerPerguntaAoProcesso() {
  const input = document.getElementById('chat-input');
  const history = document.getElementById('chat-history');
  const btn = document.getElementById('btn-perguntar');

  const pergunta = input.value.trim();
  if (!pergunta) return;

  if (history.innerHTML.includes('O histórico do chat aparecerá aqui')) history.innerHTML = '';

  history.innerHTML += `
      <div style="background:#e9ecef; padding:10px 15px; border-radius:15px 15px 15px 0; align-self:flex-start; max-width:85%; font-size: 0.9rem; color: #212529;">
          <strong><i class="ti ti-user"></i> Você:</strong><br>${escHtml(pergunta)}
      </div>`;

  input.value = '';
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Localizando nos documentos...';
  history.scrollTop = history.scrollHeight;

  // PRIORIDADE: nunca deixar de ler parte do processo por economia — o objetivo da
  // ferramenta é justamente não deixar passar inconsistência nenhuma. Por padrão, manda
  // o texto INTEIRO pra IA. O filtro por relevância (extrairTrechosRelevantes) só entra
  // como válvula de escape em volumes realmente extremos (histórico de unidade com
  // muitos aditivos acumulados), não como economia de rotina.
  const contextoDocs = textoIntegralAtual.length > LIMITE_CHARS_LOTE
    ? extrairTrechosRelevantes(textoIntegralAtual, pergunta).substring(0, LIMITE_CHARS_LOTE)
    : textoIntegralAtual;

  const prompt = `Você é um assistente investigativo sênior. O usuário fará uma pergunta sobre o processo em anexo.
Responda EXCLUSIVAMENTE com base nos documentos. Se a resposta não estiver clara nos documentos, diga "A informação não foi encontrada nos documentos anexados."

MUITO IMPORTANTE — INFORMAÇÃO MAIS RECENTE:
Os documentos podem incluir o contrato original e vários aditivos/apostilamentos ao longo do tempo, cada
um podendo alterar o que veio antes. Ao responder:
1. Se mais de um documento tratar do mesmo dado (ex.: valor, prazo, cláusula) com informações diferentes,
   use APENAS o documento com a data mais recente como resposta — nunca misture ou faça média entre versões.
2. Diga explicitamente qual documento e qual data você usou como base (ex.: "Conforme o 3º Termo Aditivo,
   de 12/08/2024...").
3. Se o documento mais recente que você tem acesso for de anos atrás (ex.: 2024) e a pergunta parecer
   assumir que existe algo mais novo (ex.: 2025) que talvez não tenha sido importado ainda pro sistema,
   avise isso explicitamente: diga que sua resposta reflete o último documento IMPORTADO, e que pode
   existir um aditivo mais recente que ainda não foi trazido pra esse sistema.

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
                <button class="btn btn-sm" style="background-color:#0dcaf0; color:#000; border:none; font-size:0.75rem; font-weight:bold; padding:4px 8px; border-radius:4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);" onclick="fixarEvidenciaDaMemoria('${respId}')"><i class="ti ti-pin"></i> Fixar na Tela 2</button>
            </div>
        </div>`;

    // Persiste no histórico — sem isso a conversa some ao sair da tela (não bloqueia a exibição se falhar)
    api('consultas/salvar', { processo_id: processoAtual.id, pergunta, resposta, usuario: usuarioAtual.email })
      .catch(e => console.warn('Falha ao salvar consulta no histórico:', e.message));
  } catch (e) {
    const { titulo, sugestao } = _mensagemErroAmigavel(e.message);
    history.innerHTML += `<div style="background:#fff7ed; border:1px solid #fed7aa; border-radius:10px; padding:8px 12px; margin-top:5px; max-width:85%; align-self:flex-end; font-size:0.82rem; color:#7c2d12;">
      <i class="ti ti-cloud-exclamation" style="color:#c2410c;"></i> ${escHtml(titulo)} <span style="color:#9a3412;">${escHtml(sugestao)}</span>
    </div>`;
  }

  btn.disabled = false;
  btn.innerHTML = '<i class="ti ti-send"></i> Perguntar';
  history.scrollTop = history.scrollHeight;
}

// === 3. REVISÃO TÉCNICA E TEXTUAL ===
// A IA aponta pontos de atenção; NÃO emite veredito de aprovação — quem decide é sempre o humano.
async function rodarRevisaoFinal() {
  const st = document.getElementById('status-revisao');
  const contadorEl = document.getElementById('contador-revisao');
  contadorEl.innerHTML = '';

  const txtAnalista = document.getElementById('editor-final').value.trim();
  let contextoRevisao = textoIntegralAtual;
  let revisaoResumida = false;
  if (textoIntegralAtual.length > LIMITE_CHARS_LOTE) {
    revisaoResumida = true;
    const trechos = extrairTrechosRelevantes(textoIntegralAtual, txtAnalista.substring(0, 4000));
    contextoRevisao = ('(Processo grande demais para ir inteiro. Abaixo: valores extraídos por código de TODOS os documentos, '
      + 'seguidos dos trechos mais ligados ao texto do analista.)\n\nVALORES EXTRAÍDOS:\n'
      + _dadosExtraidosCompactos(textoIntegralAtual) + '\n\nTRECHOS RELEVANTES:\n' + trechos).substring(0, LIMITE_CHARS_LOTE);
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
apenas aponta pontos de atenção para o analista decidir. Avalie o Parecer Final elaborado pelo analista
seguindo três frentes obrigatórias:

1. REVISÃO DE MÉRITO: verifique se o analista avaliou corretamente as regras (Unidade: ${p.unidade} | OSS: ${p.oss}).
   Para cada crítica de mérito, cite a cláusula/trecho exato do parecer e do documento original a que ela se refere.
2. REVISÃO GRAMATICAL: aponte falhas ortográficas específicas (não generalidades).
3. ADEQUAÇÃO À LINGUAGEM SIMPLES: verifique se há excesso de juridiquês.

Se não houver nenhuma crítica real em determinada frente, não invente uma só para preencher a resposta.

Retorne EXCLUSIVAMENTE um objeto JSON válido, com esta estrutura exata (NÃO inclua nenhum campo de aprovação/veredito):
{
  "criticas": ["Crítica específica, citando o trecho exato do parecer e/ou do documento original: ..."],
  "sugestao_linguagem_simples": "Escreva aqui uma versão em parágrafo único sugerindo como reescrever com clareza, ou string vazia se não houver necessidade."
}

DOCUMENTOS ORIGINAIS:
${contextoRevisao}
------------------------------------------------
PARECER DO ANALISTA:
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
      let criticasHtml = rev.criticas.map(c => `<li style="margin-bottom:6px;">${escHtml(c)}</li>`).join('');
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

    // Registra no histórico (fechava um buraco: só a Checagem salvava, a Revisão Final não)
    const achadosRevisao = (rev.criticas || []).map(c => ({ tipo: 'REVISAO_FINAL', descricao: c, documentos: '', verificar: true }));
    await api('auditorias/salvar', {
      processo_id: p.id, tipo_checkpoint: 'SAIDA',
      achados_json: JSON.stringify(achadosRevisao), raw_ia: jsonStr, executado_por: usuarioAtual.email
    });

    // Guarda o hash do texto revisado — é o que a trava do botão "Finalizar" confere depois
    _ultimoTextoRevisadoHash = await sha256(txtAnalista);

  } catch (e) {
    st.innerHTML = renderErroAmigavel(e.message);
  } finally {
    if (intervaloTimer) clearInterval(intervaloTimer);
    if (banner) banner.classList.add('hidden');
  }
}

// ==================== UTILS ====================

// Traduz uma mensagem de erro técnica em algo que o funcionário entende: uma frase
// objetiva + uma sugestão do que fazer. O detalhe técnico continua acessível (link
// pequeno), só não fica exposto por padrão.
function _motivoCurtoProvedor(m) {
  if (/PULADO_SEM_CHAVE/.test(m)) return 'não tentado: sem chave neste navegador';
  if (/PULADO_DESLIGADO/.test(m)) return 'não tentado: desligado em Motor de IA';
  if (/engine_overloaded/i.test(m)) return 'servidor sobrecarregado — só esperar';
  if (/rate_limit_reached/i.test(m)) return 'limite por minuto/dia da conta';
  if (/exceeded_current_quota|insufficient/i.test(m)) return 'saldo insuficiente';
  if (/maximum context length|context_length|token limit|too long/i.test(m)) return 'processo grande demais para uma chamada';
  if (/TPM|tokens per minute/i.test(m)) return 'limite de tokens por minuto da conta';
  if (/HTTP 429/.test(m)) return 'limite de uso atingido';
  if (/HTTP 40[13]|invalid.*(api.?key|authentication)/i.test(m)) return 'chave inválida';
  if (/não respondeu em|aborted/i.test(m)) return 'demorou demais para responder';
  if (/Failed to fetch|falha de rede|não foi possível conectar/i.test(m)) return 'sem conexão';
  if (/HTTP 5\d\d/.test(m)) return 'serviço fora do ar';
  return 'erro não identificado';
}

function _mensagemErroAmigavel(msg) {
  msg = String(msg || '');
  if (/Todos os provedores de IA falharam/i.test(msg)) {
    const porServico = msg.split('\n').slice(1).filter(l => l.includes(':')).map(l => {
      const i = l.indexOf(':');
      return `${l.slice(0,i).trim()}: ${_motivoCurtoProvedor(l.slice(i+1))}`;
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
    return { titulo: 'A IA demorou demais para responder.', sugestao: 'Verifique sua conexão com a internet e tente novamente.' };
  }
  if (/Todos os provedores de IA falharam/i.test(msg)) {
    return { titulo: 'Nenhum serviço de IA respondeu agora.', sugestao: 'Tente novamente em alguns minutos. Se persistir, confira a configuração em "Motor de IA".' };
  }
  if (/chave.*não configurada/i.test(msg)) {
    return { titulo: 'Nenhuma IA está configurada.', sugestao: 'Vá em "Motor de IA" no menu lateral e cole uma chave válida.' };
  }
  if (/não foi possível conectar/i.test(msg) || /falha de rede/i.test(msg)) {
    return { titulo: 'Não foi possível conectar ao serviço de IA.', sugestao: 'Verifique sua conexão com a internet e tente novamente.' };
  }
  if (/resposta vazia|resposta válida/i.test(msg)) {
    return { titulo: 'A IA respondeu de um jeito inesperado.', sugestao: 'Normalmente resolve na segunda tentativa — tente executar de novo.' };
  }
  return { titulo: 'Algo deu errado ao processar essa etapa.', sugestao: 'Tente novamente em alguns instantes.' };
}

// Monta o bloco visual — frase + sugestão em destaque, detalhe técnico escondido por padrão
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

// Injeta uma vez (não repete se já existir) o CSS de pulsação usado pelo banner
// "ESTOU CONFERINDO OS DOCUMENTOS..." — não depende do style.css, então funciona
// mesmo sem tocar nesse arquivo.
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

function escHtml(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function escAttr(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function criarModal(h, comRodapePadrao = true) {
  fecharModal();
  const m = document.createElement('div');
  m.className = 'modal-overlay'; m.id = 'modal-ov';
  const rodape = comRodapePadrao ? `<div style="text-align:right; margin-top:15px;"><button class="btn btn-secondary" onclick="fecharModal()">Cancelar</button></div>` : '';
  m.innerHTML = `<div class="modal">${h}${rodape}</div>`;
  document.body.appendChild(m);
}
function fecharModal() { document.getElementById('modal-ov')?.remove(); }

function verificarIA() {
  const dot = document.getElementById('ai-dot');
  const txt = document.getElementById('ai-status-txt');
  if (!dot || !txt) return;

  const provedoresAtivos = [];
  if (GEMINI_KEY && GEMINI_KEY.trim()) provedoresAtivos.push('Gemini');
  if (GROQ_KEY && GROQ_KEY.trim()) provedoresAtivos.push('Groq');
  if (OPENROUTER_KEY && OPENROUTER_KEY.trim()) provedoresAtivos.push('OpenRouter');
  if (KIMI_KEY && KIMI_KEY.trim()) provedoresAtivos.push('Kimi');
  if (DEEPSEEK_KEY && DEEPSEEK_KEY.trim()) provedoresAtivos.push('DeepSeek');
  if (OLLAMA_URL) provedoresAtivos.push('Ollama'); // sempre "configurado" (URL tem padrão), só não garante que está rodando

  const algumAtivo = (GEMINI_KEY && GEMINI_ATIVO) || (GROQ_KEY && GROQ_ATIVO) ||
    (KIMI_KEY && KIMI_ATIVO) || (OPENROUTER_KEY && OPENROUTER_ATIVO) || (DEEPSEEK_KEY && DEEPSEEK_ATIVO);
  if (algumAtivo) {
    dot.className = 'ai-dot on';
    txt.innerText = 'IA conectada (' + provedoresAtivos.filter(p => p !== 'Ollama').join(' + ') + ')';
  } else {
    dot.className = 'ai-dot off';
    txt.innerText = 'Nenhuma IA em nuvem configurada — só Ollama, se estiver rodando';
  }
}

/* ============================================================
   NOTAS PARA REVISÃO (Gemini / Cleuton):

   1. index.html precisa continuar tendo os IDs que este arquivo usa:
      login-screen, app, sidebar-nome, sidebar-gerencia, sidebar-email,
      nav-dashboard, nav-novo, nav-config, page-title, content,
      login-usuario, login-senha, login-error, ai-dot, ai-status-txt.
      Nenhum ID novo foi exigido do HTML estático — tudo que é novo
      (encaminhar, cards do dashboard) é montado via JS, igual já era.

   2. O backend (Code.gs) precisa estar na versão com as rotas:
      auth/login, usuarios/listar, processos/listar (aceita ?responsavel=),
      processos/obter, processos/criar, processos/encaminhar,
      processos/remover, documentos/listar, documentos/adicionar,
      conteudo/salvar-bloco, conteudo/listar, auditorias/salvar,
      tramitacoes/listar, log/registrar.

   3. Mudança de comportamento importante: o Dashboard agora mostra
      "processos comigo" (filtra por responsavel_atual = usuário logado),
      não mais "todos os processos". Isso é intencional — é o que permite
      a tramitação entre funcionários funcionar de forma sensata.

   4. Se quiser reintroduzir CryptoJS por algum motivo, NÃO é necessário:
      a função sha256() agora usa a Web Crypto API nativa do navegador
      (window.crypto.subtle), disponível em qualquer contexto HTTPS
      sem precisar carregar biblioteca externa.
   ============================================================ */
