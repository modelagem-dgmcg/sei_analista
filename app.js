// ============================================================
// SEI ANALISTA v21.0 — app.js
// ============================================================

// ==================== REGISTRO DE AUTORIA ====================
// © 2026 Secretaria de Estado de Saúde de Pernambuco (SES-PE) — DGMCG/GGPCG.
// Desenvolvido por Antonio Cleuton Eufrasio Vieira, Analista Administrativo - CTD,
// VERSÃO: atualize BUILD_DATE sempre que entregar um arquivo novo — é o que confirma
// que o código novo está rodando, sem abrir DevTools.
const BUILD_VERSION = '2026-09-28 v21.4';
const BUILD_DATE    = '28/09/2026 14h30';
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
          ${alertas.slice(0,6).map(blocoAlerta).join('')}${qtdAlertas > 6 ? `<div style="font-size:0.75rem; color:var(--text-muted); padding:4px 0;">+${qtdAlertas-6} alerta(s) — veja a sidebar</div>` : ''}
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
      ${achados.length ? achados.map(ac => `<div style="font-size:0.85rem; margin-bottom:4px;">• <strong>${escHtml(ac.tipo)}</strong>:${escHtml(ac.descricao)}</div>`).join('') : '<div style="font-size:0.85rem; color:var(--text-muted);">Nenhum achado nesta checagem.</div>'}
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

// Funções utilitárias de extração numérica para a Checagem
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
