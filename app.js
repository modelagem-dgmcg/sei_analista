// ============================================================
// SEI ANALISTA v21.0 — app.js
// ============================================================

// ==================== REGISTRO DE AUTORIA ====================
// © 2026 Secretaria de Estado de Saúde de Pernambuco (SES-PE) — DGMCG/GGPCG.
// Desenvolvido por Antonio Cleuton Eufrasio Vieira, Analista Administrativo - CTD,
// matrícula 18515045.
console.log("%cSES-PE — DGMCG/GGPCG", "color: #364fc7; font-size: 16px; font-weight: bold;");
console.log("%cDesenvolvido por Cleuton Vieira.", "color: #495057; font-size: 13px;");

let GEMINI_KEY = localStorage.getItem('sei_gemini_key') || '';
let GROQ_KEY = localStorage.getItem('sei_groq_key') || '';
let KIMI_KEY = localStorage.getItem('sei_kimi_key') || '';
let OPENROUTER_KEY = localStorage.getItem('sei_openrouter_key') || '';
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
let OLLAMA_ATIVO = _lerHabilitado('sei_ollama_ativo');

// Ordem de tentativa dos provedores — cada pessoa pode reordenar (tela "Motor de IA"),
// porque o provedor que funciona rápido pra uma pessoa pode não ser o mesmo pra outra
// (rede, cota, região). Padrão de fábrica: Gemini primeiro, igual sempre foi.
let ORDEM_PROVEDORES_IDS = JSON.parse(localStorage.getItem('sei_ordem_provedores') || '["gemini","groq","kimi","openrouter","ollama"]');

let API_URL = 'https://script.google.com/macros/s/AKfycbzzcJEAQPUCwY5YC2o1O5bj500pRE2mOFfZrLCy-e2kFzIgoDkebamJBgQK_yV2Ez0b/exec';

let usuarioAtual = null;
let processoAtual = null;
let textoIntegralAtual = '';
let _ultimoTextoRevisadoHash = null;
let _ultimaTramitacaoRecebida = null;
let _arquivoPrePreenchido = null;
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
  rodape.innerHTML = `&copy; 2026 SES-PE — DGMCG/GGPCG. Desenvolvido por <strong>Cleuton Vieira</strong>.`;
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
    duplicados ou copiados incorretamente. Se a soma de uma tabela não bater com o total
    citado, ou se um número divergir entre os documentos, ele aponta o trecho exato e a
    provável correção.
  </p>
  <p style="font-size:0.87rem; line-height:1.6; margin-bottom:12px;">
    Se você precisar consultar normas ou decisões de tribunais, o sistema busca e apresenta
    as fontes estaduais e federais aplicáveis.
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
    Antes de qualquer texto ser enviado para análise externa, os dados pessoais e as
    informações sensíveis são ocultados automaticamente, conforme a LGPD. O sistema sempre
    mostra de forma transparente o que foi protegido e em qual documento estava o registro.
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
    const res = await api('auth/login', { email: usuario, senha_hash: hash });
    if (res.ok) {
      usuarioAtual = res.usuario;
      fecharModal();
      document.getElementById('login-screen').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      document.getElementById('sidebar-nome').textContent = usuarioAtual.nome;
      document.getElementById('sidebar-gerencia').textContent = usuarioAtual.gerencia;
      document.getElementById('sidebar-email').textContent = usuarioAtual.email;
      showView('dashboard', 'entrada');
      iniciarMonitoramentoNovosItens();
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
    // Número que aparece pré-selecionado em cada seletor = posição atual de cada
    // provedor na ordem salva — assim a tela sempre reflete o que está configurado
    // agora, não um valor fixo de fábrica.
    const opcoesPrioridade = (id) => [1, 2, 3, 4, 5].map(n =>
      `<option value="${n}" ${ORDEM_PROVEDORES_IDS.indexOf(id) + 1 === n ? 'selected' : ''}>${n}</option>`
    ).join('');
    const checkboxAtivo = (id, ativo) => `
      <div style="display:flex; align-items:center; gap:10px; margin-top:6px; flex-wrap:wrap;">
        <label title="Ligado/desligado — desligar não apaga a chave, só faz o sistema não usar esse provedor por ora" style="display:flex; align-items:center; gap:4px; font-size:0.72rem; color:var(--text-muted); cursor:pointer; white-space:nowrap;">
          <input type="checkbox" id="ativo-${id}" ${ativo ? 'checked' : ''} style="cursor:pointer;"> Habilitado
        </label>
        <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding:2px 10px;" onclick="testarConexaoProvedor('${id}')">Testar conexão</button>
        <span id="teste-${id}" style="font-size:0.75rem;"></span>
      </div>`;
    content.innerHTML = `
      <div style="max-width:640px;background:#fff;padding:24px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:16px;">
          O número ao lado de cada provedor é a ordem de tentativa — 1 é tentado primeiro, e só passa
          pro próximo se o anterior der erro de verdade. Pode repetir número — nesse caso, a ordem entre
          eles fica a de sempre (Gemini, Groq, Kimi, OpenRouter, Ollama). "Habilitado" desliga o provedor
          sem apagar a chave — útil se ele estiver com problema por ora e você não quiser ter que colar
          a chave de novo depois. Ollama, por rodar local, continua exigindo estar instalado e aberto na
          sua máquina.
        </p>
        <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:10px;">
          <select id="prio-gemini" title="Ordem de tentativa" style="width:52px; padding:8px 2px; border:1px solid #ced4da; border-radius:6px; font-weight:700; text-align:center;">${opcoesPrioridade('gemini')}</select>
          <div class="form-group" style="flex:1; margin-bottom:0;"><label>Gemini</label><input type="password" id="cfg-gemini" value="${GEMINI_KEY}" placeholder="Chave do Google AI Studio...">${checkboxAtivo('gemini', GEMINI_ATIVO)}</div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:10px;">
          <select id="prio-groq" title="Ordem de tentativa" style="width:52px; padding:8px 2px; border:1px solid #ced4da; border-radius:6px; font-weight:700; text-align:center;">${opcoesPrioridade('groq')}</select>
          <div class="form-group" style="flex:1; margin-bottom:0;"><label>Groq (grátis)</label><input type="password" id="cfg-groq" value="${GROQ_KEY}" placeholder="Chave grátis em console.groq.com...">${checkboxAtivo('groq', GROQ_ATIVO)}</div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:10px;">
          <select id="prio-kimi" title="Ordem de tentativa" style="width:52px; padding:8px 2px; border:1px solid #ced4da; border-radius:6px; font-weight:700; text-align:center;">${opcoesPrioridade('kimi')}</select>
          <div class="form-group" style="flex:1; margin-bottom:0;"><label>Kimi (Moonshot AI)</label><input type="password" id="cfg-kimi" value="${KIMI_KEY}" placeholder="Chave em platform.moonshot.ai...">${checkboxAtivo('kimi', KIMI_ATIVO)}</div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:10px;">
          <select id="prio-openrouter" title="Ordem de tentativa" style="width:52px; padding:8px 2px; border:1px solid #ced4da; border-radius:6px; font-weight:700; text-align:center;">${opcoesPrioridade('openrouter')}</select>
          <div class="form-group" style="flex:1; margin-bottom:0;"><label>OpenRouter (grátis)</label><input type="password" id="cfg-openrouter" value="${OPENROUTER_KEY}" placeholder="Chave grátis em openrouter.ai/keys...">${checkboxAtivo('openrouter', OPENROUTER_ATIVO)}</div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:16px;">
          <select id="prio-ollama" title="Ordem de tentativa" style="width:52px; padding:8px 2px; border:1px solid #ced4da; border-radius:6px; font-weight:700; text-align:center;">${opcoesPrioridade('ollama')}</select>
          <div class="form-group" style="flex:1; margin-bottom:0;">
            <label>Ollama (local, opcional)</label>
            <input type="text" id="cfg-ollama-url" value="${OLLAMA_URL}" placeholder="http://localhost:11434" style="margin-bottom:6px;">
            <input type="text" id="cfg-ollama-model" value="${OLLAMA_MODEL}" placeholder="qwen2.5:7b">
            ${checkboxAtivo('ollama', OLLAMA_ATIVO)}
          </div>
        </div>
        <button class="btn btn-primary" onclick="salvarConfig()"><i class="ti ti-check"></i> Salvar</button>
        ${htmlFontesOficiais()}
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
  _ultimaContagemEntrada = null; _ultimaContagemAchadosPendentes = null;
  _verificarNovosItens(); // primeira leitura só define a base — o guard "!== null" impede aviso aqui
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
      <button class="btn btn-sm ${caixa === 'entrada' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','entrada')"><i class="ti ti-inbox"></i> Caixa de Entrada</button>
      <button class="btn btn-sm ${caixa === 'andamento' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','andamento')"><i class="ti ti-loader"></i> Em Andamento</button>
      <button class="btn btn-sm ${caixa === 'encaminhados' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','encaminhados')"><i class="ti ti-share"></i> Encaminhados</button>
      <button class="btn btn-sm ${caixa === 'concluidos' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','concluidos')"><i class="ti ti-archive"></i> Concluídos</button>
    </div>`;
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

      let badgePerguntaPendente = '';
      try {
        const resAchados = await api('achados/listar', { processo_id: p.id });
        const consultasAchados = resAchados.consultas || [];
        const temPerguntaParaMim = consultasAchados.some(c =>
          !c.resposta && String(c.para_usuario).toLowerCase() === String(usuarioAtual.email).toLowerCase()
        );
        if (temPerguntaParaMim) {
          badgePerguntaPendente = `<span class="badge-status" style="background:#fff3cd; color:#856404; border:1px solid #ffeeba;"><i class="ti ti-message-circle"></i> 💬 Pergunta pendente</span>`;
        }
      } catch (e) { /* ignora falha pontual */ }

      let infoTramitacao = '';
      if (p.ultima_tramitacao) {
        infoTramitacao = `<div style="font-size:0.75rem; color:#0b509e; margin-top:4px;"><i class="ti ti-clock"></i> Tramitado para <strong>${escHtml(p.ultima_tramitacao.para_usuario)}</strong> em ${new Date(p.ultima_tramitacao.data).toLocaleString('pt-BR')}</div>`;
      }
      const botaoParar = caixa === 'encaminhados'
        ? `<div style="margin-top:10px; border-top:1px dashed #dee2e6; padding-top:8px;">
             <button class="btn btn-secondary btn-sm" style="width:100%; font-size:0.75rem;" onclick="pararAcompanhamento(event, ${p.id})"><i class="ti ti-eye-off"></i> Terminar Acompanhamento</button>
           </div>` : '';
      const podeExcluir = String(p.criado_por).toLowerCase() === usuarioAtual.email.toLowerCase();
      const botaoExcluir = podeExcluir
        ? `<button onclick="deletarProcessoRemoto(event, ${p.id})" title="Excluir processo" style="position:absolute; top:12px; right:12px; background:none; border:none; color:#adb5bd; cursor:pointer; font-size:0.9rem; padding:4px;" onmouseover="this.style.color='#dc3545'" onmouseout="this.style.color='#adb5bd'"><i class="ti ti-trash"></i></button>`
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
        ${botaoParar}
        ${botaoExcluir}
      </div>`;
    }
  }
  content.innerHTML = html + '</div>';
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

  if (id === 'gemini') GEMINI_KEY = (document.getElementById('cfg-gemini')?.value || '').trim();
  if (id === 'groq') GROQ_KEY = (document.getElementById('cfg-groq')?.value || '').trim();
  if (id === 'kimi') KIMI_KEY = (document.getElementById('cfg-kimi')?.value || '').trim();
  if (id === 'openrouter') OPENROUTER_KEY = (document.getElementById('cfg-openrouter')?.value || '').trim();
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

// ==================== FONTES OFICIAIS DE DADOS ====================
// Dados públicos, sem chave. Este espaço mostra para que cada fonte serve e testa a
// conexão. Nenhuma delas entra na Checagem ainda — são propostas registradas.
const FONTES_OFICIAIS_INFO = [
  { id: 'ibge_ipca', nome: 'IBGE — Índices de preço (IPCA)', testavel: true,
    serve: 'Conferir se o percentual de reajuste aplicado nos aditivos bate com o índice oficial do período.' },
  { id: 'ibge_localidades', nome: 'IBGE — Localidades', testavel: true,
    serve: 'Conferir nome e código dos municípios citados nos documentos.' },
  { id: 'cnes', nome: 'CNES — Cadastro Nacional de Estabelecimentos de Saúde', testavel: false,
    serve: 'Comparar nome oficial, número CNES, leitos e serviços da unidade com o que o contrato declara.',
    situacao: 'Em estudo: falta confirmar uma forma estável de consulta ao cadastro.' },
  { id: 'sia_sih', nome: 'SIA/SIH — Produção registrada no SUS', testavel: false,
    serve: 'Comparar atendimentos contratados com os registrados nos sistemas nacionais.',
    situacao: 'Em estudo: os dados saem em arquivos grandes e exigem rotina própria.' }
];

function htmlFontesOficiais() {
  const linhas = FONTES_OFICIAIS_INFO.map(f => `
    <div style="border:1px solid #dee2e6; border-radius:6px; padding:10px 12px; margin-bottom:8px;">
      <div style="font-weight:600; font-size:0.88rem;">${escHtml(f.nome)}</div>
      <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">Para que serve: ${escHtml(f.serve)}</div>
      ${f.testavel
        ? `<div style="display:flex; align-items:center; gap:10px; margin-top:6px; flex-wrap:wrap;">
             <button type="button" class="btn btn-secondary btn-sm" style="font-size:0.72rem; padding:2px 10px;" onclick="testarFonteOficial('${f.id}')">Testar conexão</button>
             <span id="teste-fonte-${f.id}" style="font-size:0.75rem;"></span>
           </div>`
        : `<div style="font-size:0.75rem; color:#856404; margin-top:6px;"><i class="ti ti-clock"></i> ${escHtml(f.situacao)}</div>`}
    </div>`).join('');
  return `
    <h3 style="font-size:1rem; margin:26px 0 6px;">Fontes oficiais de dados</h3>
    <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:12px;">Dados públicos, sem chave. Por enquanto este espaço só testa a conexão: nenhuma fonte entra na Checagem ainda.</p>
    ${linhas}`;
}

async function testarFonteOficial(id) {
  const el = document.getElementById('teste-fonte-' + id);
  if (el) el.innerHTML = '<span class="spinner" style="width:11px;height:11px;border-width:2px;margin:0;"></span> Testando...';
  const res = await api('fontes/testar', { fonte: id });
  if (!el) return;
  el.innerHTML = res.ok
    ? `<span style="color:#2b8a3e; font-weight:600;"><i class="ti ti-check"></i> Conectado — ${escHtml(res.resumo)}</span>`
    : `<span style="color:#c92a2a;"><i class="ti ti-x"></i> ${escHtml(res.erro)}</span>`;
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
  OLLAMA_URL = (document.getElementById('cfg-ollama-url')?.value || '').trim() || 'http://localhost:11434';
  localStorage.setItem('sei_ollama_url', OLLAMA_URL);
  OLLAMA_MODEL = (document.getElementById('cfg-ollama-model')?.value || '').trim() || 'qwen2.5:7b';
  localStorage.setItem('sei_ollama_model', OLLAMA_MODEL);

  GEMINI_ATIVO = !!document.getElementById('ativo-gemini')?.checked;
  localStorage.setItem('sei_gemini_ativo', String(GEMINI_ATIVO));
  GROQ_ATIVO = !!document.getElementById('ativo-groq')?.checked;
  localStorage.setItem('sei_groq_ativo', String(GROQ_ATIVO));
  KIMI_ATIVO = !!document.getElementById('ativo-kimi')?.checked;
  localStorage.setItem('sei_kimi_ativo', String(KIMI_ATIVO));
  OPENROUTER_ATIVO = !!document.getElementById('ativo-openrouter')?.checked;
  localStorage.setItem('sei_openrouter_ativo', String(OPENROUTER_ATIVO));
  OLLAMA_ATIVO = !!document.getElementById('ativo-ollama')?.checked;
  localStorage.setItem('sei_ollama_ativo', String(OLLAMA_ATIVO));

  // Ordena pelo número escolhido em cada seletor — em caso de empate, o sort estável do
  // JS preserva a ordem de partida abaixo (a ordem de fábrica), então empate nunca é
  // ambíguo, sempre cai de volta no padrão de sempre entre os que empataram.
  const idsBase = ['gemini', 'groq', 'kimi', 'openrouter', 'ollama'];
  const comPrioridade = idsBase.map(id => ({ id, prioridade: Number(document.getElementById('prio-' + id)?.value) || 99 }));
  comPrioridade.sort((a, b) => a.prioridade - b.prioridade);
  ORDEM_PROVEDORES_IDS = comPrioridade.map(p => p.id);
  localStorage.setItem('sei_ordem_provedores', JSON.stringify(ORDEM_PROVEDORES_IDS));

  alert('Configurações de IA salvas!');
  verificarIA();
}

// Escolhe o nº do processo com critério, em vez de pegar o primeiro que aparecer (que
// pode ser um processo apenas CITADO num documento). Ordem: 1) nome do arquivo exportado
// do SEI; 2) o número que mais se repete nos documentos (o do próprio processo costuma
// estar no cabeçalho ou rodapé de tudo). Devolve a origem e os outros candidatos.
const REGEX_NUM_PROCESSO = /(\d{4,})\s*\.\s*(\d{5,6})\s*[\/_]\s*(\d{4})\s*-\s*(\d{2})/g;

function escolherNumeroProcesso(nomeArquivo, arquivosLidos) {
  // Nome do ZIP exportado pelo SEI: aceita ponto, sublinhado, hífen, barra ou espaço
  // entre as partes (2300002773.000116_2026-49, 2300002773_000116_2026_49...).
  const m = String(nomeArquivo || '').match(/(\d{4,})[.\s_-]?(\d{6})[\s_\/-](\d{4})[\s_-](\d{2})(?!\d)/);
  const contagem = {}, docsPorNumero = {};
  arquivosLidos.forEach(a => {
    for (const x of (a.texto || '').matchAll(REGEX_NUM_PROCESSO)) {
      const num = `${x[1]}.${x[2]}/${x[3]}-${x[4]}`;
      contagem[num] = (contagem[num] || 0) + 1;
      (docsPorNumero[num] = docsPorNumero[num] || new Set()).add(a.nome);
    }
  });
  const ranking = Object.keys(contagem).sort((a, b) => contagem[b] - contagem[a]);
  if (m) {
    const doNome = `${m[1]}.${m[2]}/${m[3]}-${m[4]}`;
    // Número do nome do ZIP é o do processo — não compete com números citados nos documentos.
    return { valor: doNome, origem: 'tirado do nome do arquivo exportado do SEI', outros: [] };
  }
  if (!ranking.length) return null;
  const escolhido = ranking[0];
  return {
    valor: escolhido,
    origem: `o que mais aparece nos documentos (${contagem[escolhido]} vez(es), em ${docsPorNumero[escolhido].size} documento(s))`,
    outros: ranking.slice(1, 4)
  };
}

// Conferência da importação: compara o que chegou com o que ficou gravado no processo,
// perguntando ao backend (não confia só na contagem feita na tela).
async function conferirImportacao(processoId, docsAntes, recebidos, falhas) {
  let noProcesso = null;
  try {
    const r = await api('documentos/listar', { processo_id: processoId });
    if (r.ok) noProcesso = (r.documentos || []).length - docsAntes;
  } catch (e) { /* sem confirmação do backend — o resumo avisa */ }
  return { recebidos, salvos: noProcesso, falhas };
}

function htmlResumoImportacao(c) {
  const ok = c.salvos === c.recebidos && !c.falhas.length;
  const cor = ok ? 'background:#d1e7dd; color:#0f5132; border:1px solid #badbcc;' : 'background:#fff3cd; color:#664d03; border:1px solid #ffecb5;';
  const salvosTxt = c.salvos === null ? 'não foi possível confirmar quantos ficaram gravados' : `${c.salvos} gravado(s) no processo`;
  const lista = c.falhas.length
    ? `<ul style="margin:6px 0 0 18px; padding:0;">${c.falhas.map(f => `<li>${escHtml(f)}</li>`).join('')}</ul>` : '';
  return `<div id="resumo-importacao" style="${cor} padding:10px 14px; border-radius:6px; font-size:0.84rem; margin-bottom:15px; position:relative;">
    <button onclick="this.parentElement.remove()" title="Fechar" style="position:absolute; top:6px; right:8px; background:none; border:none; cursor:pointer; color:inherit;">✕</button>
    <strong><i class="ti ti-${ok ? 'check' : 'alert-triangle'}"></i> Conferência da importação:</strong> ${c.recebidos} arquivo(s) recebido(s), ${salvosTxt}.
    ${c.falhas.length ? `<div style="margin-top:4px;">Não entraram no processo:</div>${lista}` : ''}
  </div>`;
}

async function prePreencherDeArquivo(file) {
  if (!file) return;
  const status = document.getElementById('np-status-preenchimento');
  status.innerHTML = '<span class="spinner"></span> Lendo o documento...';
  try {
    let arquivosLidos; // sempre uma lista — [{nome, texto}] — mesmo pra 1 arquivo só, evita caso especial
    if (file.name.toLowerCase().endsWith('.zip')) {
      const { arquivos, avisos, total } = await abrirZipEExtrairArquivos(file, (nome) => {
        status.innerHTML = `<span class="spinner"></span> Lendo ${escHtml(nome.substring(0, 40))}...`;
      });
      if (!arquivos.length) throw new Error('Nenhum arquivo legível dentro do ZIP.' + (avisos.length ? ' (' + avisos[0] + ')' : ''));
      arquivosLidos = arquivos;
      window._importacaoInfo = { recebidos: total, avisos };
    } else {
      const buf = await file.arrayBuffer();
      const texto = await extrairTextoArquivo(file.name, buf, (msg) => { status.innerHTML = `<span class="spinner"></span> ${escHtml(msg)}`; });
      if (!texto.trim().length) throw new Error('Nenhum texto foi extraído desse arquivo.');
      arquivosLidos = [{ nome: file.name, texto, sensiveis: detectarSensiveisDoArquivo(texto, file.name) }];
      window._importacaoInfo = { recebidos: 1, avisos: [] };
    }
    _arquivoPrePreenchido = arquivosLidos;

    const escolha = escolherNumeroProcesso(file.name, arquivosLidos);
    const achouNumeroProcesso = !!escolha;
    if (escolha) {
      const campoSei = document.getElementById('np-sei');
      campoSei.value = escolha.valor;
      _marcarComoSugerido(campoSei);
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
    let avisoIA = '';
    try {
      const jsonStr = await invocarIAComFallback(prompt, false, null);
      // Alguns serviços devolvem texto em volta do JSON — pega só o objeto.
      const bloco = String(jsonStr).match(/\{[\s\S]*\}/);
      if (!bloco) throw new Error('A IA respondeu sem o formato esperado.');
      const sugestao = JSON.parse(bloco[0]);
      if (sugestao.titulo)  { const el = document.getElementById('np-titulo');  el.value = sugestao.titulo;  _marcarComoSugerido(el); }
      if (sugestao.unidade) { const el = document.getElementById('np-unidade'); el.value = sugestao.unidade; _marcarComoSugerido(el); }
      if (sugestao.oss)     { const el = document.getElementById('np-oss');     el.value = sugestao.oss;     _marcarComoSugerido(el); }
      if (!sugestao.titulo && !sugestao.unidade && !sugestao.oss) {
        avisoIA = 'A IA não encontrou título, unidade nem OSS claramente escritos no início dos documentos. Preencha manualmente.';
      }
    } catch (e) {
      const { sugestao } = _mensagemErroAmigavel(e.message);
      avisoIA = `Não consegui sugerir título, unidade e OSS (${sugestao}). Preencha manualmente.`;
    }
    const nomesLidos = arquivosLidos.map(a => a.nome).join(', ');
    const avisoSemNumero = !achouNumeroProcesso
      ? `<div style="margin-top:6px; color:#856404;"><i class="ti ti-alert-triangle"></i> Não achei um número de processo no formato SEI (ex: 2300002.104000/2022-91) — preencha o campo manualmente.</div>`
      : `<div style="margin-top:6px;">Nº do processo: ${escHtml(escolha.origem)}.${escolha.outros.length ? ` Outros números citados nos documentos: ${escHtml(escolha.outros.join(', '))} — confira se o escolhido é o certo.` : ''}</div>`;
    const blocoAvisoIA = avisoIA ? `<div style="margin-top:6px; color:#856404;"><i class="ti ti-alert-triangle"></i> ${escHtml(avisoIA)}</div>` : '';
    const blocoNaoLidos = (window._importacaoInfo?.avisos || []).length
      ? `<div style="margin-top:6px; color:#856404;"><i class="ti ti-alert-triangle"></i> ${window._importacaoInfo.avisos.length} arquivo(s) do ZIP não serão importados: ${escHtml(window._importacaoInfo.avisos.join('; '))}</div>` : '';
    status.innerHTML = `<div style="background:#d1e7dd; color:#0f5132; padding:8px 12px; border-radius:6px; font-size:0.82rem;">
      <i class="ti ti-check"></i> ${arquivosLidos.length > 1 ? `${arquivosLidos.length} arquivos lidos (${escHtml(nomesLidos)})` : escHtml(nomesLidos)}. Confira os campos destacados abaixo antes de salvar.
      ${avisoSemNumero}${blocoAvisoIA}${blocoNaoLidos}
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
  // Sem valor padrão: preencher "HRA"/"ISG" por conta própria gravava processo de outra
  // unidade como HRA, e a comparação com o histórico buscava a unidade errada.
  const unidade = document.getElementById('np-unidade').value.trim();
  const oss = document.getElementById('np-oss').value.trim();
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
    const info = window._importacaoInfo || { recebidos: _arquivoPrePreenchido.length, avisos: [] };
    const falhas = [...info.avisos];
    for (let i = 0; i < _arquivoPrePreenchido.length; i++) {
      const a = _arquivoPrePreenchido[i];
      if (btn) btn.innerHTML = `<span class="spinner"></span> Anexando documento já lido (${i + 1}/${_arquivoPrePreenchido.length})...`;
      try {
        await salvarDocumentoNoBackend(a.nome, a.texto, a.sensiveis);
      } catch (e) {
        falhas.push(`${a.nome}: não foi gravado (${e.message})`);
      }
    }
    if (btn) btn.innerHTML = '<span class="spinner"></span> Conferindo a importação...';
    const conf = await conferirImportacao(res.processo.id, 0, info.recebidos, falhas);
    window._resumoImportacaoPendente = htmlResumoImportacao(conf);
    _arquivoPrePreenchido = null;
    window._importacaoInfo = null;
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
  _ultimoTextoRevisadoHash = null;
  const [resDocs, resConteudo, resTram] = await Promise.all([
    api('documentos/listar', { processo_id: processoAtual.id }),
    api('conteudo/listar', { processo_id: processoAtual.id }),
    api('tramitacoes/listar', { processo_id: processoAtual.id })
  ]);
  const docs = resDocs.documentos || [];
  const blocos = resConteudo.blocos || [];
  const tramitacoes = resTram.tramitacoes || [];
  _ultimaTramitacaoRecebida = tramitacoes.find(t => String(t.para_usuario).toLowerCase() === usuarioAtual.email.toLowerCase()) || null;
  textoIntegralAtual = docs.map(d => {
    const textoDoc = blocos.filter(b => String(b.documento_id) === String(d.id))
      .sort((a, b) => a.bloco_num - b.bloco_num)
      .map(b => b.conteudo || '').join('');
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
      <div style="margin-top:15px;display:flex;gap:10px;">
        <button class="btn btn-primary btn-sm" onclick="modalUploadZIP()"><i class="ti ti-cloud-upload"></i> Importar Arquivos</button>
        <button class="btn btn-secondary btn-sm" onclick="abrirTabelaDadosProcesso()"><i class="ti ti-table"></i> Gerar tabela de dados</button>
        <button class="btn btn-secondary btn-sm" onclick="modalImportarVersaoAssinada('processo')"><i class="ti ti-file-check"></i> Importar versão assinada (SEI)</button>
      </div>
    </div>

    <!-- 1. PAINEL DE CHECAGEM -->
    <div style="background:#fff;border:1px solid #dee2e6;padding:20px;border-radius:8px;margin-bottom:16px;">
      <h3 style="font-size:1.1rem; color:var(--text-dark); margin-bottom:15px;"><i class="ti ti-microscope"></i> 1. Verificar Processo</h3>
      <div style="display: flex; align-items: center; gap: 15px; flex-wrap:wrap;">
          <button class="btn btn-warning" onclick="rodarRaioX()"><i class="ti ti-bolt"></i> Executar Checagem</button>
          <span id="contador-checagem" style="font-weight: bold; font-size: 0.95rem;"></span>
      </div>
      <label style="display:block; margin-top:10px; font-size:0.82rem; color:var(--text-muted);">
        <input type="checkbox" id="chk-historico-unidade" checked> "Comparar com contratos antigos da mesma unidade" — A busca é por nome de arquivo, então pode confundir unidades parecidas. Por isso, o achado sempre vem marcado para você confirmar.
      </label>
      <div id="status-fonte-historico" style="margin-top:4px; font-size:0.78rem;"></div>
      <label style="display:block; margin-top:6px; font-size:0.82rem; color:var(--text-muted);">
        <input type="checkbox" id="chk-legislacao-jurisprudencia"> "Buscar normas e decisões de tribunais na web (SES-PE, TCE, TCU)" — Pesquisa automática na internet por leis e jurisprudências. Recurso experimental e mais lento; o resultado pode estar desatualizado ou vir de fontes não oficiais, exigindo confirmação rigorosa antes de ser citado em um parecer.
      </label>
      <div id="ia-status" style="margin-top:15px;"></div>
      <div id="painel-cards" style="margin-top:20px;"></div>
    </div>

    <!-- 2. PERGUNTAS AO PROCESSO -->
    <div style="background:#fff;border:1px solid #dee2e6;padding:20px;border-radius:8px;margin-bottom:16px;">
      <h3 style="font-size:1.1rem; color:var(--text-dark); margin-bottom:10px;"><i class="ti ti-message-circle"></i> 2. Pergunte ao Processo</h3>
      <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Tire dúvidas específicas sobre os anexos. O sistema investiga os arquivos e aponta o embasamento com precisão cirúrgica.</p>
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
      <h3 style="font-size:1.1rem; color:var(--text-dark); margin-bottom:10px;"><i class="ti ti-robot"></i> 3. Revisão e Auditoria de Parecer</h3>
      <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Cole seu parecer, nota técnica, ofício ou qualquer minuta abaixo. A IA cruza seu texto com os documentos originais do processo para apontar melhorias de mérito e consistência. A palavra final e a aprovação são sempre suas.</p>
      <textarea id="editor-final" placeholder="Cole aqui o texto que você escreveu, pra ser revisado..." style="width:100%; height:150px; padding:15px; border:1px solid #ced4da; border-radius:6px; font-family: inherit; font-size: 0.95rem; margin-bottom: 15px; outline:none; resize:vertical;"></textarea>
      <div style="display: flex; align-items: center; gap: 15px;">
          <button class="btn btn-secondary" onclick="abrirCriarDocumento()"><i class="ti ti-file-plus"></i> Criar documento</button>
          <button class="btn btn-warning" onclick="rodarRevisaoFinal()"><i class="ti ti-search"></i> Executar Análise Completa</button>
          <span id="contador-revisao" style="font-weight: bold; font-size: 0.95rem;"></span>
      </div>
      <div id="status-revisao" style="margin-top:15px;"></div>
    </div>
  `;
  content.innerHTML = html;
  if (window._resumoImportacaoPendente) {
    content.insertAdjacentHTML('afterbegin', window._resumoImportacaoPendente);
    window._resumoImportacaoPendente = null;
  }
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
  await api('log/registrar', { usuario: usuarioAtual.email, acao: 'ENCAMINHAR', processo_id: processoAtual.id, detalhes: 'Para: ' + destinatario });
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
  await api('log/registrar', { usuario: usuarioAtual.email, acao: 'DEVOLVER', processo_id: processoAtual.id, detalhes: 'Para: ' + paraQuem });
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
  const res = await api('processos/atualizar-status', { id: processoAtual.id, status: 'Concluído', documento_final: textoAtual });
  if (!res.ok) { alert('Erro ao finalizar: ' + res.erro); return; }
  await api('log/registrar', {
    usuario: usuarioAtual.email, acao: 'FINALIZAR', processo_id: processoAtual.id,
    detalhes: revisadoEIgual ? 'Revisão final confirmada' : 'Finalizado sem revisão final confirmada'
  });
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
    await api('log/registrar', { usuario: usuarioAtual.email, acao: 'VERSAO_ASSINADA', processo_id: processoAtual.id, detalhes: file.name });
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
    <p style="font-size:0.88rem; line-height:1.6;">Esta função está aguardando os modelos padrão de nota técnica, parecer, minuta e ofício da DGMCG/GGPCG.</p>
    <p style="font-size:0.85rem; line-height:1.6; color:var(--text-muted);">Enquanto isso, use "Gerar tabela de dados" (no topo do processo) pra levar os números do processo pro seu documento, com a origem de cada um.</p>`);
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

// Converte o despacho em HTML do SEI em texto que a IA lê bem e com poucos tokens:
// tabela continua tabela (formato Markdown, colunas separadas por "|"), cada parágrafo
// vira uma linha, e estilo, script e marcação somem. Antes, parágrafos colavam um no
// outro e as tabelas viravam texto corrido, sem dar pra saber o que era linha ou coluna.
function htmlParaTextoEstruturado(doc) {
  const body = doc.body;
  if (!body) return '';
  body.querySelectorAll('script, style, noscript').forEach(el => el.remove());
  body.querySelectorAll('table').forEach(tabela => {
    const linhas = [...tabela.querySelectorAll('tr')].map(tr =>
      [...tr.querySelectorAll('th, td')].map(c => c.textContent.replace(/\s+/g, ' ').trim().replace(/\|/g, '/'))
    ).filter(celulas => celulas.some(c => c));
    if (!linhas.length) { tabela.remove(); return; }
    const colunas = Math.max(...linhas.map(l => l.length));
    const md = linhas.map(l => '| ' + [...l, ...Array(colunas - l.length).fill('')].join(' | ') + ' |');
    md.splice(1, 0, '| ' + Array(colunas).fill('---').join(' | ') + ' |');
    tabela.replaceWith(doc.createTextNode('\n' + md.join('\n') + '\n'));
  });
  body.querySelectorAll('br').forEach(br => br.replaceWith(doc.createTextNode('\n')));
  body.querySelectorAll('p, div, li, h1, h2, h3, h4, h5, h6').forEach(el => el.append(doc.createTextNode('\n')));
  return body.textContent
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
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
    const texto = htmlParaTextoEstruturado(doc);
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
  const resultado = { arquivos: [], avisos: [], total: 0 };
  const zip = new JSZip();
  const contents = await zip.loadAsync(file);
  // Arquivos de sistema que o Mac/Windows põem dentro do ZIP não são documentos — não
  // entram na contagem, senão a conferência acusaria "faltando" o que nunca foi documento.
  const todosArquivos = Object.keys(contents.files).filter(k => !contents.files[k].dir
    && !k.startsWith('__MACOSX/') && !k.split('/').pop().startsWith('.'));
  resultado.total = todosArquivos.length;
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
  let importados = 0;
  let recebidos = 0; // arquivos soltos + arquivos de dentro de cada ZIP
  // Quantos documentos o processo já tinha — base pra conferir quantos entraram agora.
  let docsAntes = 0;
  try {
    const r = await api('documentos/listar', { processo_id: processoAtual.id });
    if (r.ok) docsAntes = (r.documentos || []).length;
  } catch (e) { /* segue; a conferência avisa se não conseguir confirmar */ }
  for (const file of listaArquivos) {
    const nomeLower = file.name.toLowerCase();
    if (nomeLower.endsWith('.zip')) {
      status.innerHTML = `<span class="spinner"></span> Mapeando ${escHtml(file.name)}...`;
      try {
        const { arquivos, avisos: avisosZip, total } = await abrirZipEExtrairArquivos(file, (nome) => {
          status.innerHTML = `<span class="spinner"></span> Processando ${escHtml(nome.substring(0, 70))}...`;
        });
        recebidos += total;
        for (const a of arquivos) {
          try {
            await salvarDocumentoNoBackend(a.nome, a.texto, a.sensiveis);
            importados++;
            if (listaProgresso) listaProgresso.insertAdjacentHTML('beforeend', _linhaProgressoArquivo(a.nome, a.sensiveis));
          } catch (e) { avisos.push(`${a.nome}: ${e.message}`); }
        }
        avisos.push(...avisosZip);
      } catch (e) {
        avisos.push(`${file.name}: não foi possível abrir o ZIP (${e.message})`);
        recebidos += 1;
      }
    } else if (EXTENSOES_SUPORTADAS.some(ext => nomeLower.endsWith(ext))) {
      recebidos += 1;
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
      recebidos += 1;
      avisos.push(`${file.name}: tipo não suportado — NÃO importado`);
    }
  }
  // Conferência: pergunta ao backend quantos documentos o processo ganhou, e mostra o
  // resumo no topo da tela do processo (fica lá até a pessoa fechar, não some sozinho).
  status.innerHTML = '<span class="spinner"></span> Conferindo a importação...';
  const conf = await conferirImportacao(processoAtual.id, docsAntes, recebidos, avisos);
  window._resumoImportacaoPendente = htmlResumoImportacao(conf);
  fecharModal();
  abrirProcesso(processoAtual.numero_sei || String(processoAtual.id));
}

async function extrairTextoPDF(buf, onProgresso) {
  if (typeof pdfjsLib === 'undefined') return '';
  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const paginas = [];
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
        if (textoOcr.trim().length > textoPagina.trim().length) textoPagina = textoOcr;
      } catch (e) {
        console.warn(`OCR falhou na página ${i}:`, e.message);
      }
    }

    paginas.push(textoPagina);
  }
  // Marcador de página — não usa o mesmo formato "--- DOC: ... ---" (usado para separar
  // documentos) de propósito, pra dividirPorDocumento() continuar funcionando sem confundir
  // "página" com "documento". Serve pra localizar onde um dado apareceu.
  return removerRepeticoesDePagina(paginas)
    .map((t, i) => `\n--- PÁGINA ${i + 1} ---\n` + t + '\n').join('');
}

// Cabeçalho, rodapé, numeração de página e timbre se repetem em toda página e vão para a
// IA a cada página, sem acrescentar nada — gastam tokens e deixam a checagem mais lenta.
// Regras, todas conservadoras, porque apagar conteúdo real é pior que gastar token:
// 1) Só as 3 primeiras e as 3 últimas linhas de cada página são candidatas (é onde ficam
//    cabeçalho e rodapé). O meio da página nunca é tocado.
// 2) A linha precisa ser IDÊNTICA em pelo menos 3 páginas e em 60% ou mais delas. Números
//    só são ignorados quando a linha TERMINA em numeração de página ("Página 3 de 10",
//    "pg. 4", "fls. 12"), pra essas contarem como a mesma linha.
// 3) Nunca sai: linha curta (menos de 8 caracteres), linha com "total" e linha com valor
//    em R$ — é delas que a conferência de contas depende.
// Fica sempre a primeira ocorrência.
const REGEX_NUMERACAO_PAGINA = /(p[áa]g(ina)?\.?|pg\.|fls?\.|folha)\s*\d+(\s*(de|\/)\s*\d+)?\s*$/i;
const LINHAS_BORDA_PAGINA = 3;

function removerRepeticoesDePagina(paginas) {
  if (paginas.length < 3) return paginas;
  const normalizar = l => {
    let n = l.trim().replace(/\s+/g, ' ').toLowerCase();
    if (REGEX_NUMERACAO_PAGINA.test(n)) n = n.replace(/\d+/g, '#');
    return n;
  };
  const protegida = l => l.trim().length < 8 || /\btotal\b/i.test(l) || /R\$/.test(l);
  // Índices das linhas de borda (topo e pé) de cada página, ignorando linhas vazias
  const bordas = paginas.map(t => {
    const idx = t.split('\n').map((l, i) => l.trim() ? i : -1).filter(i => i >= 0);
    return new Set([...idx.slice(0, LINHAS_BORDA_PAGINA), ...idx.slice(-LINHAS_BORDA_PAGINA)]);
  });
  const paginasPorLinha = {};
  paginas.forEach((t, p) => {
    t.split('\n').forEach((linha, i) => {
      if (!bordas[p].has(i) || protegida(linha)) return;
      (paginasPorLinha[normalizar(linha)] = paginasPorLinha[normalizar(linha)] || new Set()).add(p);
    });
  });
  const minimo = Math.max(3, Math.ceil(paginas.length * 0.6));
  const repetidas = new Set(Object.keys(paginasPorLinha).filter(l => paginasPorLinha[l].size >= minimo));
  if (!repetidas.size) return paginas;
  const jaMantidas = new Set();
  return paginas.map((t, p) => t.split('\n').filter((linha, i) => {
    if (!bordas[p].has(i) || protegida(linha)) return true;
    const n = normalizar(linha);
    if (!repetidas.has(n)) return true;
    if (jaMantidas.has(n)) return false;
    jaMantidas.add(n);
    return true;
  }).join('\n'));
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

  for (const id of ORDEM_PROVEDORES_IDS) {
    const info = PROVEDORES_INFO[id];
    if (!info || !info.temChave()) continue; // Ollama sempre "tem chave" (não precisa de uma)
    estados[id] = 'tentando';
    renderPainelProvedores(statusEl, estados, `Chamando ${info.nome}...`);
    try {
      // Ollama roda local — usa o prompt ORIGINAL, sem máscara (não há por quê mascarar
      // pra si mesmo). Todo o resto (nuvem) usa a versão mascarada.
      const promptDesteProvedor = id === 'ollama' ? prompt : promptMascarado;
      const r = await info.invocar(promptDesteProvedor, isChat, statusEl);
      estados[id] = 'ok';
      renderPainelProvedores(statusEl, estados, 'Concluído.');
      return id === 'ollama' ? r : desmascararTexto(r, mapa);
    } catch (e) {
      estados[id] = 'falhou';
      erros.push(`${info.nome}: ${e.message}`);
    }
  }
  renderPainelProvedores(statusEl, estados, 'Nenhum provedor respondeu.');
  if (!erros.length) throw new Error('Nenhum serviço de IA está habilitado com chave. Vá em "Motor de IA" e ligue ao menos um.');
  throw new Error('Todos os provedores de IA falharam:\n' + erros.join('\n'));
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
  const partes = textoIntegral.split(/--- DOC: (.+?) ---/).filter(p => p.trim().length > 0);
  const docs = [];
  for (let i = 0; i < partes.length; i += 2) {
    if (partes[i + 1] !== undefined) docs.push({ nome: partes[i].trim(), texto: partes[i + 1] });
  }
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

function conferirContasPorCodigo(textoIntegral) {
  try {
    return [...conferirSomasPorCodigo(textoIntegral), ...conferirValoresRotuladosPorCodigo(textoIntegral)];
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

async function rodarRaioX() {
  const st = document.getElementById('ia-status');
  const contadorEl = document.getElementById('contador-checagem');
  contadorEl.innerHTML = '';
  const p = processoAtual;
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
    const dadosExtraidos = montarDadosExtraidos(textoIntegralAtual);
    // Contas conferidas por código ANTES da IA — cobertura garantida, mesmo se a IA falhar.
    achadosCodigo = conferirContasPorCodigo(textoIntegralAtual);

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
invente achado pra preencher a resposta.

Retorne EXCLUSIVAMENTE um JSON válido, sem markdown:
{"cards": [{"tag": "Financeiro", "setor": "SFCG", "titulo": "Título", "evidencia": "trecho extraído (verbatim, o mais curto possível)", "explicacao": "motivo técnico, citando os valores/documentos exatos comparados", "sugestao": "o que fazer, em linguagem simples", "doc_origem": "doc", "verificar": true, "baseado_em_fonte_externa": false}]}

${achadosCodigo.length ? 'CONTAS JÁ CONFERIDAS POR CÓDIGO (NÃO repita estes achados — eles já serão mostrados ao analista):\n' + achadosCodigo.map(a => '- ' + a.titulo + ': ' + a.explicacao).join('\n') + '\n\n' : ''}TEXTO BRUTO DOS DOCUMENTOS (use para a regra 2 — texto duplicado/copiado/título divergente da tabela):
${textoIntegralAtual}`;
    const jsonStr = await invocarIAComFallback(prompt, false, st);
    const jsonObj = JSON.parse(jsonStr);
    const achadosIA = (jsonObj.cards || []).map(c => {
      // Trava reforçada: não confia só na IA marcar "verificar" certo pra achado de fonte externa.
      if (c.baseado_em_fonte_externa) c.verificar = true;
      return c;
    });
    window.achadosAtuais = [...achadosCodigo, ...achadosIA];
    contadorEl.innerHTML = `<span style="background:#f8d7da; color:#842029; padding:6px 12px; border-radius:20px;">${window.achadosAtuais.length} inconsistência(s)</span>`;
    renderizarCards(window.achadosAtuais);
    st.innerHTML = renderPainelMascaramento(window._ultimoMascaramentoDetalhes);
    await api('auditorias/salvar', { processo_id: p.id, tipo_checkpoint: 'GERAL', achados_json: JSON.stringify(window.achadosAtuais), raw_ia: jsonStr, executado_por: usuarioAtual.email });
  } catch (e) {
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
  }
}


function renderizarCards(cards) {
  const painel = document.getElementById('painel-cards');
  if (!cards || cards.length === 0) return painel.innerHTML = '<div class="alert alert-success">✓ Nenhum apontamento crítico detectado nesta checagem.</div>';
  let html = `<div style="margin-bottom:15px; text-align:right;"><button class="btn btn-secondary btn-sm" onclick="exportarRelatorioAchados()"><i class="ti ti-file-type-doc"></i> Exportar Relatório (.DOC)</button></div>`;
  cards.forEach((c, idx) => {
    const cardId = `rx-${idx}`;
    window.memoriaEvidencias[cardId] = { tag: c.tag, titulo: c.titulo, texto: c.explicacao + (c.sugestao ? `\n\n💡 O que fazer: ${c.sugestao}` : ''), doc: c.doc_origem };
    const ref = `${c.tag}: ${c.titulo}`;
    // Sem extensão na exibição — o que importa pra localizar no SEI é o identificador, não ".pdf" no final
    const nomeDocBruto = c.doc_origem && c.doc_origem !== 'undefined' ? c.doc_origem : 'Não identificado';
    const nomeDoc = nomeDocBruto.replace(/\.(pdf|docx?|xlsx?)$/i, '');
    const tagVerificar = (c.verificar === false ? '' : `<span style="font-size:0.68rem;background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:10px;font-weight:600;margin-left:6px;">⚠ VERIFICAR</span>`)
      + (c.conferido_por_codigo ? `<span title="Conta feita por regra fixa no código, não pela IA" style="font-size:0.68rem;background:#e7f5ff;color:#1864ab;padding:2px 8px;border-radius:10px;font-weight:600;margin-left:6px;">🔢 CONFERIDO POR CÓDIGO</span>` : '');
    html += `<div class="rx-card is-obice" id="${cardId}-div" data-referencia-achado="${escAttr(ref)}">
      <div class="rx-header" onclick="document.getElementById('${cardId}-div').classList.toggle('open')">
        <div><span class="rx-tag">${escHtml(c.tag)}</span> <span class="rx-title">${escHtml(c.titulo)}</span>${tagVerificar}</div>
      </div>
      <div class="rx-body">
        <div style="margin-bottom: 12px;">
            <span style="font-size:0.75rem; background:#fff3cd; color:#856404; padding:4px 8px; border-radius:4px; border: 1px solid #ffeeba; cursor:pointer;" onclick="navigator.clipboard.writeText('${escAttr(nomeDocBruto)}'); alert('ID do Documento copiado! Vá no SEI e cole para buscar.');" title="Clique para copiar o identificador completo">
               <i class="ti ti-file-type-pdf"></i> ID do Documento: <strong>${escHtml(nomeDoc)}</strong>${c.pagina ? ' — pág. ' + escHtml(c.pagina) : ''}
            </span>
        </div>
        ${c.evidencia ? `<div class="rx-evidence">${escHtml(c.evidencia)}</div>` : ''}
        <p><strong>Setor:</strong> ${escHtml(c.setor)}</p>
        <p>${escHtml(c.explicacao)}</p>
        ${c.sugestao ? `
        <div style="margin-top:10px; background:#e6fcf5; border-left:3px solid #12b886; border-radius:4px; padding:8px 12px;">
          <div style="font-size:0.72rem; font-weight:700; color:#087f5b; text-transform:uppercase; letter-spacing:0.4px; margin-bottom:3px;"><i class="ti ti-bulb"></i> O que fazer</div>
          <div style="font-size:0.85rem; color:#0b6157;">${escHtml(c.sugestao)}</div>
        </div>` : ''}
        <div style="margin-top:10px; display:flex; gap:10px; flex-wrap:wrap;">
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

async function fazerPerguntaAoProcesso() {
  const input = document.getElementById('chat-input');
  const history = document.getElementById('chat-history');
  const btn = document.getElementById('btn-perguntar');
  const pergunta = input.value.trim();
  if (!pergunta) return;
  if (!textoIntegralAtual || textoIntegralAtual.trim().length < 20) {
    history.innerHTML += `<div style="color:#c92a2a; font-size:0.85rem;">Nenhum documento importado neste processo ainda — importe antes de perguntar.</div>`;
    return;
  }

  if (history.innerHTML.includes('O histórico do chat aparecerá aqui')) history.innerHTML = '';
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
  const LIMIAR_FILTRAGEM = 400000;
  const contextoDocs = textoIntegralAtual.length > LIMIAR_FILTRAGEM
    ? extrairTrechosRelevantes(textoIntegralAtual, pergunta)
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
    api('consultas/salvar', { processo_id: processoAtual.id, pergunta, resposta, usuario: usuarioAtual.email })
      .catch(e => console.warn('Falha ao salvar consulta no histórico:', e.message));
  } catch (e) {
    history.innerHTML += `<div style="max-width:85%; align-self:flex-end;">${renderErroAmigavel(e.message)}</div>`;
  }
  if (btn) { btn.disabled = false; btn.innerHTML = '<i class="ti ti-send"></i> Perguntar'; }
  history.scrollTop = history.scrollHeight;
}

async function rodarRevisaoFinal() {
  const st = document.getElementById('status-revisao');
  const contadorEl = document.getElementById('contador-revisao');
  contadorEl.innerHTML = '';
  const txtAnalista = document.getElementById('editor-final').value.trim();
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
${textoIntegralAtual}
------------------------------------------------
TEXTO DO ANALISTA:
${txtAnalista}`;

  try {
    const jsonStr = await invocarIAComFallback(prompt, false, st);
    const rev = JSON.parse(jsonStr);
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

// Traduz o erro de UM serviço numa expressão curta. A Kimi tem três tipos de 429,
// com causas e soluções diferentes, por isso vêm separados.
function _motivoCurtoProvedor(m) {
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
  // Vem ANTES das outras regras: quando todos falham, cada um pode ter falhado por um
  // motivo diferente — resumir numa frase só ("limite atingido") escondia o resto.
  if (/Todos os provedores de IA falharam/i.test(msg)) {
    const porServico = msg.split('\n').slice(1).filter(l => l.includes(':')).map(l => {
      const i = l.indexOf(':');
      return `${l.slice(0, i).trim()}: ${_motivoCurtoProvedor(l.slice(i + 1))}`;
    });
    return { titulo: 'Nenhum serviço de IA respondeu agora.', sugestao: porServico.join(' · ') || 'Confira a configuração em "Motor de IA".' };
  }
  if (/Nenhum serviço de IA está habilitado/i.test(msg)) {
    return { titulo: 'Nenhum serviço de IA está ligado.', sugestao: 'Vá em "Motor de IA", cole uma chave e marque "Habilitado".' };
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
  if (/Todos os provedores de IA falharam/i.test(msg)) {
    return { titulo: 'Nenhum serviço de IA respondeu agora.', sugestao: 'Tente de novo em alguns minutos. Se persistir, confira a configuração em "Motor de IA".' };
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
function verificarIA() {
  const dot = document.getElementById('ai-dot');
  const txt = document.getElementById('ai-status-txt');
  if (!dot || !txt) return;
  const provedoresNuvem = [];
  if (GEMINI_KEY && GEMINI_KEY.trim() && GEMINI_ATIVO) provedoresNuvem.push('Gemini');
  if (GROQ_KEY && GROQ_KEY.trim() && GROQ_ATIVO) provedoresNuvem.push('Groq');
  if (KIMI_KEY && KIMI_KEY.trim() && KIMI_ATIVO) provedoresNuvem.push('Kimi');
  if (OPENROUTER_KEY && OPENROUTER_KEY.trim() && OPENROUTER_ATIVO) provedoresNuvem.push('OpenRouter');
  if (provedoresNuvem.length) {
    dot.className = 'ai-dot on';
    txt.innerText = 'IA conectada (' + provedoresNuvem.join(' + ') + ')';
  } else {
    dot.className = 'ai-dot off';
    txt.innerText = 'Nenhuma IA em nuvem configurada — só Ollama, se estiver rodando';
  }
}
