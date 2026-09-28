// ============================================================
// SEI ANALISTA v21.0 — app.js
// ============================================================

// ==================== REGISTRO DE AUTORIA ====================
// © 2026 Secretaria de Estado de Saúde de Pernambuco (SES-PE) — DGMCG/GGPCG.
// Desenvolvido por Antonio Cleuton Eufrasio Vieira, Analista Administrativo - CTD,
const BUILD_VERSION = '2026-09-28 v21.7';
const BUILD_DATE    = '28/09/2026 16h00';
// matrícula 18515045.
console.log("%cSES-PE — DGMCG/GGPCG", "color: #364fc7; font-size: 16px; font-weight: bold;");
console.log("%cSEI Analista " + BUILD_VERSION, "color: #495057; font-size: 13px; font-weight: bold;");

let GEMINI_KEY     = localStorage.getItem('sei_gemini_key')     || '';
let GROQ_KEY       = localStorage.getItem('sei_groq_key')       || '';
let KIMI_KEY       = localStorage.getItem('sei_kimi_key')       || '';
let OPENROUTER_KEY = localStorage.getItem('sei_openrouter_key') || '';
let DEEPSEEK_KEY   = localStorage.getItem('sei_deepseek_key')   || '';
let OLLAMA_URL     = localStorage.getItem('sei_ollama_url')     || 'http://localhost:11434';
let OLLAMA_MODEL   = localStorage.getItem('sei_ollama_model')   || 'qwen2.5:7b';

function _lerHabilitado(chaveStorage) {
  const v = localStorage.getItem(chaveStorage);
  return v === null ? true : v === 'true';
}
let GEMINI_ATIVO     = _lerHabilitado('sei_gemini_ativo');
let GROQ_ATIVO       = _lerHabilitado('sei_groq_ativo');
let KIMI_ATIVO       = _lerHabilitado('sei_kimi_ativo');
let OPENROUTER_ATIVO = _lerHabilitado('sei_openrouter_ativo');
let DEEPSEEK_ATIVO   = _lerHabilitado('sei_deepseek_ativo');
let OLLAMA_ATIVO     = _lerHabilitado('sei_ollama_ativo');

let ORDEM_PROVEDORES_IDS = JSON.parse(localStorage.getItem('sei_ordem_provedores') || '["deepseek","gemini","groq","kimi","openrouter","ollama"]');

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
  rodape.innerHTML = `&copy; 2026 SES-PE — DGMCG/GGPCG. Desenvolvido por <strong>Cleuton Vieira</strong>. <span id='build-tag' style='color:#6c757d; margin-left:8px;' title='app.js / Code.gs'>app v${BUILD_VERSION} · backend …</span>`;
  rodape.style = "text-align: center; padding: 15px; font-size: 0.75rem; color: #adb5bd; margin-top: auto; border-top: 1px solid #dee2e6;";
  document.getElementById('content').parentElement.appendChild(rodape);
}

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
      if (!document.getElementById('area-alertas-sidebar')) {
        const sn = document.getElementById('sidebar-nome');
        if (sn?.parentElement) {
          const div = document.createElement('div');
          div.id = 'area-alertas-sidebar'; div.style.cssText = 'padding:6px 6px 2px;';
          sn.parentElement.insertBefore(div, sn.parentElement.firstChild);
        }
      }
      document.getElementById('sidebar-gerencia').textContent = usuarioAtual.gerencia;
      document.getElementById('sidebar-email').textContent = usuarioAtual.email;
      showView('dashboard', 'panorama');
      iniciarMonitoramentoNovosItens();
      carregarAlertasSidebar();
      setInterval(carregarAlertasSidebar, 300000);
      api('versao', {}).then(r => {
        const tag = document.getElementById('build-tag');
        if (tag && r.versao) tag.textContent = `app v${BUILD_VERSION} · backend v${r.versao}`;
      }).catch(() => {});
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
    dashboard_panorama: 'Panorama Geral',
    dashboard_entrada: 'Caixa de Entrada',
    dashboard_andamento: 'Processos em Andamento',
    dashboard_encaminhados: 'Processos Encaminhados (Acompanhamento)',
    dashboard_concluidos: 'Registro de Concluídos',
    dashboard_perguntas: 'Perguntas sobre achados',
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
          <span style="font-size:0.80rem; color:var(--text-muted);">Opcional — .pdf, .docx, .xlsx, .txt, .csv, .md, .pptx, .html (despacho SEI GOV), .png, .jpg ou .zip. Foto de documento/página escaneada é lida por OCR (mais lento). Confira tudo antes de salvar; a IA sugere, não afirma.</span>
        </div>
        <input type="file" id="np-arquivo" accept=".pdf,.docx,.doc,.xlsx,.xls,.txt,.csv,.md,.pptx,.ppt,.png,.jpg,.jpeg,.html,.htm,.zip" style="display:none" onchange="prePreencherDeArquivo(this.files[0])">
        <div id="np-status-preenchimento" style="margin-bottom:15px;"></div>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Dica: Cole o nome do arquivo (ex: SEI_230...) no campo abaixo e o sistema limpa o número, se não usar o preenchimento automático.</p>
        <div class="form-group"><label>Número SEI *</label><input id="np-sei" placeholder="Ex: 230000..." oninput="formatarSEI(this)"></div>
        <div class="form-group"><label>Título / Objeto *</label><input id="np-titulo" placeholder="Ex: 1º Termo Aditivo"></div>
        <div class="form-group"><label>Unidade</label><input id="np-unidade" placeholder="Ex: HRA"></div>
        <div class="form-group"><label>OSS</label><input id="np-oss" placeholder="Ex: ISG"></div>
        <div class="form-group"><label>Gerência</label><input id="np-gerencia" placeholder="Ex: GGPCG" value="${usuarioAtual?.gerencia || ''}"></div>
        <div class="form-group"><label>Tipo de documento</label>
          <select id="np-tipo-processo" style="width:100%;padding:8px;border:1px solid #ced4da;border-radius:6px;">
            <option value="">— Selecione —</option>
            <option>Contrato de Gestão</option><option>Aditivo</option><option>Apostilamento</option>
            <option>Renovação / Prorrogação</option><option>Rescisão</option><option>Distrato</option>
            <option>Ofício</option><option>Nota Técnica</option><option>Parecer</option><option>Outros</option>
          </select></div>
        <div class="form-group"><label>Data-limite <span style="color:var(--text-muted);font-size:0.8rem;">(opcional)</span></label>
          <input type="date" id="np-data-limite" style="width:100%;padding:8px;border:1px solid #ced4da;border-radius:6px;"></div>
        <button class="btn btn-primary" id="btn-criar-processo" onclick="salvarNovoProcesso()"><i class="ti ti-device-floppy"></i> Criar Processo na Bancada</button>
      </div>`;
  } else if (v === 'config') {
    const opcoesPrioridade = (id) => [1, 2, 3, 4, 5, 6].map(n =>
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
          pro próximo se o anterior der erro de verdade. "Habilitado" desliga o provedor
          sem apagar a chave.
        </p>
        <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:10px;">
          <select id="prio-deepseek" title="Ordem" style="width:52px; padding:8px 2px; border:1px solid #ced4da; border-radius:6px; font-weight:700; text-align:center;">${opcoesPrioridade('deepseek')}</select>
          <div class="form-group" style="flex:1; margin-bottom:0;"><label>DeepSeek</label><input type="password" id="cfg-deepseek" value="${DEEPSEEK_KEY}" placeholder="Chave em platform.deepseek.com...">${checkboxAtivo('deepseek', DEEPSEEK_ATIVO)}</div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:10px;">
          <select id="prio-gemini" title="Ordem" style="width:52px; padding:8px 2px; border:1px solid #ced4da; border-radius:6px; font-weight:700; text-align:center;">${opcoesPrioridade('gemini')}</select>
          <div class="form-group" style="flex:1; margin-bottom:0;"><label>Gemini</label><input type="password" id="cfg-gemini" value="${GEMINI_KEY}" placeholder="Chave do Google AI Studio...">${checkboxAtivo('gemini', GEMINI_ATIVO)}</div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:10px;">
          <select id="prio-groq" title="Ordem" style="width:52px; padding:8px 2px; border:1px solid #ced4da; border-radius:6px; font-weight:700; text-align:center;">${opcoesPrioridade('groq')}</select>
          <div class="form-group" style="flex:1; margin-bottom:0;"><label>Groq (grátis)</label><input type="password" id="cfg-groq" value="${GROQ_KEY}" placeholder="Chave grátis em console.groq.com...">${checkboxAtivo('groq', GROQ_ATIVO)}</div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:10px;">
          <select id="prio-kimi" title="Ordem" style="width:52px; padding:8px 2px; border:1px solid #ced4da; border-radius:6px; font-weight:700; text-align:center;">${opcoesPrioridade('kimi')}</select>
          <div class="form-group" style="flex:1; margin-bottom:0;"><label>Kimi (Moonshot AI)</label><input type="password" id="cfg-kimi" value="${KIMI_KEY}" placeholder="Chave em platform.moonshot.ai...">${checkboxAtivo('kimi', KIMI_ATIVO)}</div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:10px;">
          <select id="prio-openrouter" title="Ordem" style="width:52px; padding:8px 2px; border:1px solid #ced4da; border-radius:6px; font-weight:700; text-align:center;">${opcoesPrioridade('openrouter')}</select>
          <div class="form-group" style="flex:1; margin-bottom:0;"><label>OpenRouter (grátis)</label><input type="password" id="cfg-openrouter" value="${OPENROUTER_KEY}" placeholder="Chave grátis em openrouter.ai/keys...">${checkboxAtivo('openrouter', OPENROUTER_ATIVO)}</div>
        </div>
        <div style="display:flex; gap:10px; align-items:flex-start; margin-bottom:16px;">
          <select id="prio-ollama" title="Ordem" style="width:52px; padding:8px 2px; border:1px solid #ced4da; border-radius:6px; font-weight:700; text-align:center;">${opcoesPrioridade('ollama')}</select>
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

let caixaAtualAtiva = 'panorama';

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

let _msgConversaAtual = null;
let _msgContatosCache = null;

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
  listaEl.innerHTML = '<div style="padding:8px 10px; font-size:0.72rem; color:#adb5bd;"><span class="spinner" style="width:10px;height:10px;border-width:2px;margin:0 4px 0 0;"></span> Carregando...</div>';
  const res = await api('mensagens/contatos', { usuario: usuarioAtual.email });
  if (!res.ok) { listaEl.innerHTML = '<div style="padding:8px 10px; font-size:0.72rem; color:#f87171;">Erro ao carregar contatos.</div>'; return; }
  _msgContatosCache = res;
  let html = '';
  if (res.grupos?.length) {
    html += '<div style="padding:4px 10px 2px; font-size:0.65rem; font-weight:700; color:#adb5bd; text-transform:uppercase;">Grupos</div>';
    html += res.grupos.map(g => `
      <div onclick="abrirConversa('${escAttr(g.conversa_id)}','${escAttr(g.nome)}','grupo')"
           style="padding:6px 10px; cursor:pointer; font-size:0.78rem; display:flex; align-items:center; gap:6px;"
           onmouseenter="this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background=''">
        <i class="ti ti-users" style="color:#6f42c1; font-size:0.9rem;"></i>
        <span>${escHtml(g.nome)}</span>
      </div>`).join('');
  }
  if (res.individuais?.length) {
    html += '<div style="padding:4px 10px 2px; margin-top:4px; font-size:0.65rem; font-weight:700; color:#adb5bd; text-transform:uppercase;">Individual</div>';
    html += res.individuais.map(c => `
      <div onclick="abrirConversa('${escAttr(c.conversa_id)}','${escAttr(c.nome)}','dm')"
           style="padding:6px 10px; cursor:pointer; font-size:0.78rem; display:flex; align-items:center; gap:6px;"
           onmouseenter="this.style.background='rgba(255,255,255,0.05)'" onmouseleave="this.style.background=''">
        <i class="ti ti-user" style="color:#0b509e; font-size:0.9rem;"></i>
        <span>${escHtml(c.nome)}</span>
      </div>`).join('');
  }
  listaEl.innerHTML = html || '<div style="padding:8px 10px; font-size:0.72rem; color:#adb5bd;">Nenhum contato encontrado.</div>';
}

async function abrirConversa(conversaId, nome, tipo) {
  _msgConversaAtual = conversaId;
  const listaEl  = document.getElementById('msg-lista-contatos');
  const convEl    = document.getElementById('msg-conversa');
  const nomeEl    = document.getElementById('msg-conversa-nome');
  const histEl    = document.getElementById('msg-historico');
  if (!listaEl || !convEl || !nomeEl || !histEl) return;
  listaEl.style.display = 'none';
  convEl.style.display  = 'block';
  nomeEl.textContent    = nome;
  histEl.innerHTML      = '<div style="font-size:0.72rem; color:#adb5bd; text-align:center; padding:8px;">Carregando...</div>';
  const res = await api('mensagens/listar', { conversa_id: conversaId, usuario: usuarioAtual.email });
  if (!res.ok) { histEl.innerHTML = '<div style="font-size:0.72rem; color:#f87171; text-align:center; padding:8px;">Erro ao carregar mensagens.</div>'; return; }
  _renderMensagens(res.mensagens || []);
  document.getElementById('msg-input')?.focus();
}

function _renderMensagens(msgs) {
  const histEl = document.getElementById('msg-historico');
  if (!histEl) return;
  if (!msgs.length) { histEl.innerHTML = '<div style="font-size:0.72rem; color:#adb5bd; text-align:center; padding:8px;">Sem mensagens ainda. Diga olá!</div>'; return; }
  histEl.innerHTML = msgs.map(m => {
    const meu = String(m.de_usuario).toLowerCase() === String(usuarioAtual.email).toLowerCase();
    const hora = m.enviado_em ? new Date(m.enviado_em).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : '';
    return `<div style="
      max-width:90%; padding:5px 8px; border-radius:8px; font-size:0.76rem; line-height:1.4;
      align-self:${meu ? 'flex-end' : 'flex-start'};
      background:${meu ? '#0b509e' : 'rgba(255,255,255,0.12)'};
      color:#fff;">
      ${!meu ? `<div style="font-size:0.65rem; color:#93c5fd; margin-bottom:2px;">${escHtml(m.de_nome)}</div>` : ''}
      ${escHtml(m.texto)}
      <div style="font-size:0.62rem; color:rgba(255,255,255,0.5); text-align:right; margin-top:2px;">${hora}</div>
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
  if (!res.ok) { mostrarToast('Erro ao enviar mensagem: ' + (res.erro || '')); return; }
  const hist = await api('mensagens/listar', { conversa_id: _msgConversaAtual, usuario: usuarioAtual.email });
  if (hist.ok) _renderMensagens(hist.mensagens || []);
}

function voltarListaContatos() {
  _msgConversaAtual = null;
  document.getElementById('msg-lista-contatos').style.display = 'block';
  document.getElementById('msg-conversa').style.display = 'none';
}

const INTERVALO_MONITORAMENTO_MS = 45000;
let _alertasCache = [];

async function carregarAlertasSidebar() {
  if (!usuarioAtual) return;
  try { const res = await api('processos/alertas', { usuario: usuarioAtual.email });
    _alertasCache = (res.ok && res.alertas) ? res.alertas : []; }
  catch(e) { _alertasCache = []; }
  _renderAlertasSidebar();
}

function _renderAlertasSidebar() {
  const area = document.getElementById('area-alertas-sidebar');
  if (!area) return;
  if (!_alertasCache.length) { area.innerHTML = ''; return; }
  const cor    = a => COR_ALERTA[a.cor]   || '#868e96';
  const icone = a => ICONE_ALERTA[a.cor] || 'ti-bell';
  area.innerHTML = _alertasCache.slice(0,5).map(a =>
    `<a href='#' onclick="abrirProcesso('${escAttr(a.numero_sei||String(a.processo_id))}'); return false;"
        style='display:block;padding:6px 10px;margin-bottom:3px;border-left:3px solid ${cor(a)};background:rgba(0,0,0,0.15);border-radius:0 4px 4px 0;text-decoration:none;color:inherit;'>
      <div style='font-size:0.72rem;font-weight:600;color:${cor(a)};'><i class='ti ${icone(a)}'></i> ${escHtml(a.mensagem)}</div>
      <div style='font-size:0.7rem;color:#adb5bd;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'>${escHtml(a.titulo||a.numero_sei||'')}</div>
    </a>`).join('');
  if (_alertasCache.length > 5)
    area.insertAdjacentHTML('beforeend',`<div style='font-size:0.7rem;color:#adb5bd;padding:3px 10px;'>+${_alertasCache.length-5} alerta(s)</div>`);
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
        mostrarToast('Um colega pediu sua opinião sobre um achado. Veja na aba "Perguntas".');
      }
      _ultimaContagemAchadosPendentes = pendentesAtual;
    }
  } catch (e) {
    console.warn('Falha na checagem periódica de novos itens:', e.message);
  }
}

async function renderPanorama(content, abasHtml) {
  const [resEntrada, resAndamento, resEnc, resConc, resPerguntas, resAlertas] = await Promise.all([
    api('processos/listar', { responsavel: usuarioAtual.email, caixa: 'entrada' }),
    api('processos/listar', { responsavel: usuarioAtual.email, caixa: 'andamento' }),
    api('processos/listar', { responsavel: usuarioAtual.email, caixa: 'encaminhados' }),
    api('processos/listar', { responsavel: usuarioAtual.email, caixa: 'concluidos' }),
    api('achados/contar-pendentes', { usuario: usuarioAtual.email }),
    api('processos/alertas', { usuario: usuarioAtual.email })
  ]);
  const n = res => (res.ok && res.processos) ? res.processos.length : 0;
  const qtdEntrada     = n(resEntrada);
  const qtdAndamento   = n(resAndamento);
  const qtdEncaminhados = n(resEnc);
  const qtdConcluidos  = n(resConc);
  const qtdPerguntas   = (resPerguntas.ok && resPerguntas.pendentes) || 0;
  const alertas        = (resAlertas.ok && resAlertas.alertas) || [];
  const qtdAlertas     = alertas.length;

  const bloco = (icone, rotulo, qtd, caixa, cor, destaque) => `
    <div onclick="showView('dashboard','${caixa}')" style="
      cursor:pointer; padding:16px 20px; border-radius:10px; background:#fff;
      border:1px solid ${destaque ? cor : '#dee2e6'};
      border-left:4px solid ${cor};
      display:flex; align-items:center; gap:14px;
      transition:box-shadow .15s;"
      onmouseenter="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'"
      onmouseleave="this.style.boxShadow='none'">
      <div style="font-size:1.6rem; color:${cor}; line-height:1;"><i class="ti ${icone}"></i></div>
      <div>
        <div style="font-size:1.8rem; font-weight:700; color:${cor}; line-height:1;">${qtd}</div>
        <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">${rotulo}</div>
      </div>
    </div>`;

  const blocoAlerta = (a) => {
    const cores = { vermelho:'#dc3545', amarelo:'#f5c518', laranja:'#fd7e14', azul:'#0dcaf0' };
    const cor = cores[a.cor] || '#868e96';
    return `<div onclick="abrirProcesso('${escAttr(a.numero_sei||String(a.processo_id))}')" style="
      cursor:pointer; padding:8px 12px; border-radius:6px; background:#fff;
      border-left:3px solid ${cor}; border:1px solid ${cor}33;
      font-size:0.8rem; display:flex; gap:10px; align-items:flex-start;"
      onmouseenter="this.style.background='#f8f9fa'" onmouseleave="this.style.background='#fff'">
      <span style="color:${cor}; font-size:1rem; margin-top:1px;"><i class="ti ${COR_ALERTA[a.cor] ? ICONE_ALERTA[a.cor] : 'ti-bell'}"></i></span>
      <div>
        <div style="font-weight:600; color:${cor};">${escHtml(a.mensagem)}</div>
        <div style="color:var(--text-muted); font-size:0.75rem;">${escHtml(a.titulo||a.numero_sei||'')}</div>
      </div>
    </div>`;
  };

  content.innerHTML = abasHtml + `
    <div style="margin-bottom:20px;">
      <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:10px;">Panorama — ${new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</div>
      <div style="display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:10px; margin-bottom:18px;">
        ${bloco('ti-layout-dashboard', 'Panorama geral',  qtdEntrada+qtdAndamento, 'panorama', '#343a40', false)}
        ${bloco('ti-inbox',        'Na caixa de entrada',    qtdEntrada,      'entrada',     '#0b509e', qtdEntrada > 0)}
        ${bloco('ti-loader',       'Em andamento',           qtdAndamento,    'andamento',   '#6f42c1', false)}
        ${bloco('ti-share',        'Encaminhados',           qtdEncaminhados, 'encaminhados','#0d6efd', false)}
        ${bloco('ti-archive',      'Concluídos',             qtdConcluidos,   'concluidos',  '#198754', false)}
        ${bloco('ti-message-question', 'Perguntas pendentes', qtdPerguntas,   'perguntas',   '#fd7e14', qtdPerguntas > 0)}
      </div>
      ${qtdAlertas ? `
        <div style="font-size:0.72rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:.05em; margin-bottom:8px;">Alertas ativos (${qtdAlertas})</div>
        <div style="display:flex; flex-direction:column; gap:6px;">
          ${alertas.slice(0,6).map(blocoAlerta).join('')}
          ${qtdAlertas > 6 ? `<div style="font-size:0.75rem; color:var(--text-muted); padding:4px 0;">+${qtdAlertas-6} alerta(s) — veja a sidebar</div>` : ''}
        </div>` : `
        <div style="font-size:0.82rem; color:#2b8a3e;"><i class="ti ti-check"></i> Nenhum alerta no momento.</div>`}
    </div>`;
}

async function renderDashboard(caixa = 'panorama') {
  const content = document.getElementById('content');
  content.innerHTML = '<span class="spinner"></span> Carregando...';
  await atualizarContagensSidebar();
  const abasHtml = `
    <div style="display:flex; gap:8px; margin-bottom:16px; flex-wrap:wrap; border-bottom:1px solid #dee2e6; padding-bottom:12px;">
      <button class="btn btn-sm ${caixa === 'panorama' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','panorama')"><i class="ti ti-layout-dashboard"></i> Panorama</button>
      <button class="btn btn-sm ${caixa === 'entrada' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','entrada')"><i class="ti ti-inbox"></i> Entrada</button>
      <button class="btn btn-sm ${caixa === 'andamento' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','andamento')"><i class="ti ti-loader"></i> Andamento</button>
      <button class="btn btn-sm ${caixa === 'encaminhados' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','encaminhados')"><i class="ti ti-share"></i> Encaminhados</button>
      <button class="btn btn-sm ${caixa === 'concluidos' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','concluidos')"><i class="ti ti-archive"></i> Concluídos</button>
      <button class="btn btn-sm ${caixa === 'perguntas' ? 'btn-primary' : 'btn-secondary'}" onclick="showView('dashboard','perguntas')"><i class="ti ti-message-question"></i> Perguntas <span id="badge-perguntas"></span></button>
    </div>`;
  api('achados/contar-pendentes', { usuario: usuarioAtual.email }).then(r => {
    const b = document.getElementById('badge-perguntas');
    if (b && r.ok && r.pendentes > 0) b.innerHTML = `<span style="background:#ffc107; color:#000; padding:0 6px; border-radius:10px; font-size:0.7rem; font-weight:bold;">${r.pendentes}</span>`;
  }).catch(() => {});
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
        const lidoInfo = p.ultima_tramitacao.lido_em
          ? `<span style='color:#2b8a3e; margin-left:8px;'><i class='ti ti-eye-check'></i> Visto ${new Date(p.ultima_tramitacao.lido_em).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>`
          : `<span style='color:var(--text-muted); margin-left:8px;'><i class='ti ti-eye-off'></i> Ainda não aberto</span>`;
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
        Unidade: ${escHtml(proc.unidade)} | OSS: ${escHtml(proc.oss)} | Concluído em: ${proc.atualizado_em ? new Date(proc.atualizado_em).toLocaleDateString('pt-BR') : '—'}
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

async function testarConexaoProvedor(id) {
  const resultadoEl = document.getElementById('teste-' + id);
  if (resultadoEl) resultadoEl.innerHTML = '<span class="spinner" style="width:11px;height:11px;border-width:2px;margin:0;"></span> Testando...';

  if (id === 'gemini')     GEMINI_KEY     = (document.getElementById('cfg-gemini')?.value     || '').trim();
  if (id === 'groq')       GROQ_KEY       = (document.getElementById('cfg-groq')?.value       || '').trim();
  if (id === 'kimi')       KIMI_KEY       = (document.getElementById('cfg-kimi')?.value       || '').trim();
  if (id === 'openrouter') OPENROUTER_KEY = (document.getElementById('cfg-openrouter')?.value || '').trim();
  if (id === 'deepseek')   DEEPSEEK_KEY   = (document.getElementById('cfg-deepseek')?.value   || '').trim();
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
  GEMINI_KEY     = (document.getElementById('cfg-gemini')?.value     || '').trim();
  localStorage.setItem('sei_gemini_key', GEMINI_KEY);
  GROQ_KEY       = (document.getElementById('cfg-groq')?.value       || '').trim();
  localStorage.setItem('sei_groq_key', GROQ_KEY);
  KIMI_KEY       = (document.getElementById('cfg-kimi')?.value       || '').trim();
  localStorage.setItem('sei_kimi_key', KIMI_KEY);
  OPENROUTER_KEY = (document.getElementById('cfg-openrouter')?.value || '').trim();
  localStorage.setItem('sei_openrouter_key', OPENROUTER_KEY);
  DEEPSEEK_KEY   = (document.getElementById('cfg-deepseek')?.value   || '').trim();
  localStorage.setItem('sei_deepseek_key', DEEPSEEK_KEY);
  OLLAMA_URL     = (document.getElementById('cfg-ollama-url')?.value     || '').trim() || 'http://localhost:11434';
  localStorage.setItem('sei_ollama_url', OLLAMA_URL);
  OLLAMA_MODEL   = (document.getElementById('cfg-ollama-model')?.value   || '').trim() || 'qwen2.5:7b';
  localStorage.setItem('sei_ollama_model', OLLAMA_MODEL);

  GEMINI_ATIVO     = !!document.getElementById('ativo-gemini')?.checked;
  localStorage.setItem('sei_gemini_ativo', String(GEMINI_ATIVO));
  GROQ_ATIVO       = !!document.getElementById('ativo-groq')?.checked;
  localStorage.setItem('sei_groq_ativo', String(GROQ_ATIVO));
  KIMI_ATIVO       = !!document.getElementById('ativo-kimi')?.checked;
  localStorage.setItem('sei_kimi_ativo', String(KIMI_ATIVO));
  OPENROUTER_ATIVO = !!document.getElementById('ativo-openrouter')?.checked;
  localStorage.setItem('sei_openrouter_ativo', String(OPENROUTER_ATIVO));
  DEEPSEEK_ATIVO   = !!document.getElementById('ativo-deepseek')?.checked;
  localStorage.setItem('sei_deepseek_ativo', String(DEEPSEEK_ATIVO));
  OLLAMA_ATIVO     = !!document.getElementById('ativo-ollama')?.checked;
  localStorage.setItem('sei_ollama_ativo', String(OLLAMA_ATIVO));

  const idsBase = ['deepseek', 'gemini', 'groq', 'kimi', 'openrouter', 'ollama'];
  const comPrioridade = idsBase.map(id => ({ id, prioridade: Number(document.getElementById('prio-' + id)?.value) || 99 }));
  comPrioridade.sort((a, b) => a.prioridade - b.prioridade);
  ORDEM_PROVEDORES_IDS = comPrioridade.map(p => p.id);
  localStorage.setItem('sei_ordem_provedores', JSON.stringify(ORDEM_PROVEDORES_IDS));

  alert('Configurações de IA salvas!');
  verificarIA();
}

const REGEX_NUM_PROCESSO = /(\d{4,})\s*\.\s*(\d{5,6})\s*[\/_]\s*(\d{4})\s*-\s*(\d{2})/g;

function escolherNumeroProcesso(nomeArquivo, arquivosLidos) {
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

async function conferirImportacao(processoId, docsAntes, recebidos, falhas) {
  let noProcesso = null;
  try {
    const r = await api('documentos/listar', { processo_id: processoId });
    if (r.ok) noProcesso = (r.documentos || []).length - docsAntes;
  } catch (e) { /* sem confirmação do backend */ }
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
    let arquivosLidos;
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
      const bloco = String(jsonStr).match(/\{[\s\S]*\}/);
      if (!bloco) throw new Error('A IA respondeu sem o formato esperado.');
      const sugestao = JSON.parse(bloco[0]);
      if (sugestao.titulo)  { const el = document.getElementById('np-titulo');  el.value = sugestao.titulo;  _marcarComoSugerido(el); }
      if (sugestao.unidade) { const el = document.getElementById('np-unidade'); el.value = sugestao.unidade; _marcarComoSugerido(el); }
      if (sugestao.oss)     { const el = document.getElementById('np-oss');     el.value = sugestao.oss;     _marcarComoSugerido(el); }
    } catch (e) {
      const { sugestao } = _mensagemErroAmigavel(e.message);
      avisoIA = `Não consegui sugerir título, unidade e OSS (${sugestao}). Preencha manualmente.`;
    }
    const nomesLidos = arquivosLidos.map(a => a.nome).join(', ');
    const avisoSemNumero = !achouNumeroProcesso
      ? `<div style="margin-top:6px; color:#856404;"><i class="ti ti-alert-triangle"></i> Não achei um número de processo no formato SEI — preencha o campo manualmente.</div>`
      : `<div style="margin-top:6px;">Nº do processo: ${escHtml(escolha.origem)}.</div>`;
    status.innerHTML = `<div style="background:#d1e7dd; color:#0f5132; padding:8px 12px; border-radius:6px; font-size:0.82rem;">
      <i class="ti ti-check"></i> ${arquivosLidos.length > 1 ? `${arquivosLidos.length} arquivos lidos` : escHtml(nomesLidos)}. Confira os campos abaixo.
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
  const unidade = document.getElementById('np-unidade').value.trim();
  const oss = document.getElementById('np-oss').value.trim();
  const gerencia      = document.getElementById('np-gerencia').value.trim();
  const tipo_processo = document.getElementById('np-tipo-processo')?.value || '';
  const data_limite   = document.getElementById('np-data-limite')?.value   || '';
  if (!titulo) return alert('Preencha ao menos o Título/Objeto.');
  const btn = document.getElementById('btn-criar-processo');
  if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Criando...'; }
  const res = await api('processos/criar', {
    numero_sei: sei, titulo, unidade, oss, gerencia, tipo_processo, data_limite,
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

// Funções auxiliares de extração e suporte numérico para a Checagem
function extrairContexto(texto, termo, raio) {
  const idx = texto.indexOf(termo);
  if (idx === -1) return '';
  return texto.substring(Math.max(0, idx - raio), Math.min(texto.length, idx + termo.length + raio)).replace(/\s+/g, ' ').trim();
}
function extrairValoresMonetarios(texto) { return [...new Set(texto.match(/R\$\s?[\d.]+,\d{2}/g) || [])].slice(0, 25).map(v => ({ valor: v, contexto: extrairContexto(texto, v, 55) })); }
function extrairDatas(texto) { return [...new Set(texto.match(/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g) || [])].slice(0, 25).map(v => ({ valor: v, contexto: extrairContexto(texto, v, 55) })); }
function extrairNumerosProcesso(texto) {
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

// Funções de conferência por código
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
  const achados = limpa.match(/\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?|\d+(?:,\d{1,2})?/g) || [];
  return achados.map(_numeroBR).filter(n => n !== null);
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
      const colunas = mesmaQtd ? numsTotal.map((_, c) => c) : [null];
      colunas.forEach(c => {
        const valorTotal = c === null ? numsTotal[numsTotal.length - 1] : numsTotal[c];
        const soma = itens.reduce((acc, n) => acc + (c === null ? n[n.length - 1] : n[c]), 0);
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
          explicacao: `As ${itens.length} linhas logo acima do total somam ${_formatarBR(soma)}, mas o total informado é ${_formatarBR(valorTotal)} (diferença de ${_formatarBR(Math.abs(soma - valorTotal))}).`,
          sugestao: `Refaça a soma das linhas dessa tabela${pagina ? ' (página ' + pagina + ')' : ''} e corrija o valor errado.`,
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
      explicacao: `O mesmo tipo de valor aparece com ${distintos.length} números diferentes: ${lista}.`,
      sugestao: 'Confirme se a alteração decorre de aditivo ou apostilamento recente.',
      doc_origem: ocorrencias[0].doc, pagina: ocorrencias[0].pagina, verificar: true, conferido_por_codigo: true
    });
  });
  return achados;
}

function conferirContasPorCodigo(textoIntegral) {
  try {
    const todos = [...conferirSomasPorCodigo(textoIntegral), ...conferirValoresRotuladosPorCodigo(textoIntegral)];
    if (todos.length > 10) {
      todos[0].explicacao += ` (Atenção: a conferência encontrou ${todos.length} divergências no total; estão sendo mostradas as 10 primeiras).`;
    }
    return todos.slice(0, 10);
  } catch (e) {
    console.warn('Conferência de contas por código falhou:', e.message);
    return [];
  }
}

// Formatação do cronômetro em minutos e segundos (ex: "1m 24s")
function _formatarTempoDecorrido(segundos) {
  if (segundos < 60) return segundos + 's';
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${m}m ${s}s`;
}

async function rodarRaioX() {
  const st = document.getElementById('ia-status');
  const contadorEl = document.getElementById('contador-checagem');
  contadorEl.innerHTML = '';
  const p = processoAtual;
  if (!textoIntegralAtual || textoIntegralAtual.trim().length < 50) {
    return st.innerHTML = '<div class="alert alert-danger">Importe os documentos primeiro.</div>';
  }

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
        bannerTimer.textContent = _formatarTempoDecorrido(segundosDecorridos);
      }, 1000);
    }
  }

  let achadosCodigo = [];
  try {
    const dadosExtraidos = montarDadosExtraidos(textoIntegralAtual);
    achadosCodigo = conferirContasPorCodigo(textoIntegralAtual);

    let historicoUnidadeBloco = '';
    const historicoUnidadeAtivo = document.getElementById('chk-historico-unidade')?.checked;
    const statusFonteEl = document.getElementById('status-fonte-historico');
    if (statusFonteEl) statusFonteEl.innerHTML = '';
    
    if (!historicoUnidadeAtivo) {
      if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:var(--text-muted);">Cruzamento com o histórico da unidade desligado nesta checagem.</span>`;
    } else if (!p.unidade) {
      if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:var(--text-muted);">Processo sem "unidade" definida — não há como buscar no Drive.</span>`;
    } else {
      if (bannerDetalhe) bannerDetalhe.textContent += ' · Buscando contratos no Google Drive (LEIS E DECRETOS)...';
      st.innerHTML = `<span class="spinner"></span> Buscando contratos e aditivos antigos de "${escHtml(p.unidade)}" no Google Drive (LEIS E DECRETOS)...`;
      try {
        const resHist = await api('normas/buscar-por-unidade', { unidade: p.unidade });
        if (resHist.ok && resHist.encontrado) {
          const nomes = resHist.arquivos.map(a => a.nome).join(', ');
          if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:#2b8a3e;"><i class="ti ti-check"></i> Encontrado no Drive: <strong>${escHtml(nomes)}</strong></span>`;
          
          historicoUnidadeBloco = '\n\nREFERÊNCIA CONTRATUAL DA UNIDADE (fonte: Google Drive, pasta LEIS E DECRETOS)\n' +
            'IMPORTANTE: use este bloco para comparar cláusulas, valores, metas e datas com os documentos do processo atual.\n' +
            resHist.arquivos.map(a => {
              let bloco = `\n===== ${a.nome} (Drive) =====\n`;
              if (a.texto) {
                bloco += a.texto;
              } else {
                if (a.valores?.length) bloco += 'VALORES: ' + a.valores.map(v => v.valor).join(', ') + '\n';
                if (a.datas?.length)   bloco += 'DATAS: '   + a.datas.map(v => v.valor).join(', ')   + '\n';
                if (a.cep?.length)     bloco += 'CEP: '     + a.cep.map(v => v.valor).join(', ')     + '\n';
              }
              return bloco;
            }).join('\n');
        } else if (resHist.ok && !resHist.encontrado) {
          if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:#c92a2a;"><i class="ti ti-x"></i> Nenhum arquivo encontrado no Drive para "${escHtml(p.unidade)}"</span>`;
        } else {
          if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:#c92a2a;"><i class="ti ti-alert-triangle"></i> Falha ao consultar o Drive: ${escHtml(resHist.erro || 'erro desconhecido')}</span>`;
        }
      } catch (e) {
        if (statusFonteEl) statusFonteEl.innerHTML = `<span style="color:#c92a2a;"><i class="ti ti-alert-triangle"></i> Falha ao consultar o Drive: ${escHtml(e.message)}</span>`;
      }
    }

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
    if (bannerDetalhe) {
      const qtdDocs = (textoIntegralAtual.match(/--- DOC: /g) || []).length;
      bannerDetalhe.textContent = `${qtdDocs} documento(s) — Analisando com IA...`;
    }

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
  criarModal(`<h2 style="margin-bottom:12px; font-size:1.15rem;">Encaminhar Achado</h2>
    <div style="font-size:0.82rem; color:var(--text-muted); margin-bottom:10px;"><strong>Achado:</strong> ${escHtml(ref)}</div>
    <input type="hidden" id="enc-ach-referencia" value="${escAttr(ref)}">
    <label style="font-size:0.85rem;">Encaminhar para</label>
    <select id="enc-ach-destinatario" style="width:100%;padding:8px;margin-bottom:10px;border:1px solid #ced4da;border-radius:6px;">${opcoes}</select>
    <label style="font-size:0.85rem;">Sua pergunta</label>
    <textarea id="enc-ach-mensagem" placeholder="Escreva sua pergunta sobre este achado..." style="width:100%;min-height:70px;padding:8px;margin-bottom:10px;border:1px solid #ced4da;border-radius:6px;"></textarea>
    <div style="display:flex; gap:10px;">
      <button class="btn btn-secondary" style="flex:1;" onclick="fecharModal()"><i class="ti ti-x"></i> Cancelar</button>
      <button class="btn btn-primary" style="flex:1;" onclick="confirmarEncaminharAchado()"><i class="ti ti-send"></i> Enviar</button>
    </div>`, false);
}

async function renderPerguntasAchados() {
  const area = document.getElementById('area-perguntas');
  const res = await api('achados/meus', { usuario: usuarioAtual.email });
  if (!res.ok) {
    area.innerHTML = `<div class="alert alert-danger">Não foi possível carregar as perguntas: ${escHtml(res.erro || '')}.</div>`;
    return;
  }
  const recebidas = (res.recebidas || []).sort((a, b) => (a.resposta ? 1 : 0) - (b.resposta ? 1 : 0));
  const enviadas = res.enviadas || [];
  const linkProcesso = q => `<a href="#" onclick="abrirProcesso('${escAttr(q.numero_sei || q.processo_id)}'); return false;">${escHtml(q.numero_sei || 'processo ' + q.processo_id)}</a>${q.titulo_processo ? ' — ' + escHtml(q.titulo_processo) : ''}`;
  const cartao = (q, tipo) => {
    const pendente = !q.resposta;
    const cor = pendente ? (tipo === 'recebida' ? '#fff9db; border-left:3px solid #f5c518' : '#f8f9fa; border-left:3px solid #adb5bd') : '#e7f5ff; border-left:3px solid #339af0';
    const quem = tipo === 'recebida' ? `De <strong>${escHtml(q.de_usuario)}</strong>` : `Para <strong>${escHtml(q.para_usuario)}</strong>`;
    const resposta = q.resposta
      ? `<div style="margin-top:6px; color:#1864ab;"><strong>Resposta:</strong> ${escHtml(q.resposta)}</div>`
      : (tipo === 'recebida'
          ? `<textarea id="resp-caixa-${q.id}" placeholder="Sua resposta..." style="width:100%; margin-top:8px; padding:6px; border:1px solid #ced4da; border-radius:4px; min-height:50px;"></textarea>
             <button class="btn btn-primary btn-sm" style="margin-top:6px;" onclick="responderPerguntaNaCaixa(${q.id})">Responder</button>`
          : `<div style="margin-top:6px; color:var(--text-muted);"><i class="ti ti-clock"></i> Aguardando resposta.</div>`);
    return `<div style="background:${cor}; padding:10px 14px; border-radius:6px; margin-bottom:10px; font-size:0.85rem;">
      <div style="font-size:0.78rem; color:var(--text-muted);">${quem} · Processo ${linkProcesso(q)}</div>
      <div style="margin-top:4px;"><strong>Achado:</strong> ${escHtml(q.achado_referencia)}</div>
      <div style="margin-top:4px;"><strong>Pergunta:</strong> ${escHtml(q.mensagem || '(sem mensagem)')}</div>
      ${resposta}
    </div>`;
  };
  area.innerHTML = `
    <h3 style="font-size:1rem; margin-bottom:10px;">Recebidas</h3>
    ${recebidas.length ? recebidas.map(q => cartao(q, 'recebida')).join('') : '<p class="text-muted" style="font-size:0.85rem;">Nenhuma pergunta recebida.</p>'}
    <h3 style="font-size:1rem; margin:20px 0 10px;">Enviadas</h3>
    ${enviadas.length ? enviadas.map(q => cartao(q, 'enviada')).join('') : '<p class="text-muted" style="font-size:0.85rem;">Nenhuma pergunta enviada.</p>'}`;
}

async function responderPerguntaNaCaixa(id) {
  const campo = document.getElementById('resp-caixa-' + id);
  const resposta = (campo?.value || '').trim();
  if (!resposta) return alert('Escreva a resposta antes de enviar.');
  const res = await api('achados/responder', { id, resposta });
  if (!res.ok) return alert('A resposta NÃO foi enviada: ' + (res.erro || 'erro desconhecido'));
  mostrarToast('Resposta enviada.');
  renderPerguntasAchados();
}

async function confirmarEncaminharAchado() {
  const referencia = document.getElementById('enc-ach-referencia').value;
  const destinatario = document.getElementById('enc-ach-destinatario').value;
  const mensagem = document.getElementById('enc-ach-mensagem').value.trim();
  if (!mensagem) return alert('Escreva a pergunta antes de enviar.');
  const res = await api('achados/encaminhar', { processo_id: processoAtual.id, achado_referencia: referencia, de_usuario: usuarioAtual.email, para_usuario: destinatario, mensagem });
  if (!res.ok) { alert('A pergunta NÃO foi enviada: ' + (res.erro || 'erro desconhecido')); return; }
  fecharModal();
  mostrarToast('Pergunta enviada.');
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
  if (!blocosRelevantes.length) return textoIntegral.substring(0, 20000);

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
      intervaloTimer = setInterval(() => {
        segundosDecorridos++;
        bannerTimer.textContent = _formatarTempoDecorrido(segundosDecorridos);
      }, 1000);
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
  if (/chave.*not valid|API_KEY_INVALID/i.test(msg)) {
    return { titulo: 'Chave de IA inválida ou incorreta.', sugestao: 'Vá em "Motor de IA" e confira a chave.' };
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
  if (DEEPSEEK_KEY   && DEEPSEEK_KEY.trim()   && DEEPSEEK_ATIVO)   provedoresNuvem.push('DeepSeek');
  if (GEMINI_KEY     && GEMINI_KEY.trim()     && GEMINI_ATIVO)     provedoresNuvem.push('Gemini');
  if (GROQ_KEY       && GROQ_KEY.trim()       && GROQ_ATIVO)       provedoresNuvem.push('Groq');
  if (KIMI_KEY       && KIMI_KEY.trim()       && KIMI_ATIVO)       provedoresNuvem.push('Kimi');
  if (OPENROUTER_KEY && OPENROUTER_KEY.trim() && OPENROUTER_ATIVO) provedoresNuvem.push('OpenRouter');
  if (provedoresNuvem.length) {
    dot.className = 'ai-dot on';
    txt.innerText = 'IA conectada (' + provedoresNuvem.join(' + ') + ')';
  } else {
    dot.className = 'ai-dot off';
    txt.innerText = 'Nenhuma IA em nuvem configurada — só Ollama, se estiver rodando';
  }
}
