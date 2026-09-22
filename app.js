// ============================================================
// SEI ANALISTA v21.0 — app.js
// Ajustes desta versão em relação à v20.6 (ver notas ao final do arquivo):
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
console.log("%cSES-PE — DGMCG/GGPCG", "color: #364fc7; font-size: 16px; font-weight: bold;");
console.log("%cDesenvolvido por Cleuton Vieira.", "color: #495057; font-size: 13px;");

let GEMINI_KEY = localStorage.getItem('sei_gemini_key') || '';
let GROQ_KEY = localStorage.getItem('sei_groq_key') || '';
let OPENROUTER_KEY = localStorage.getItem('sei_openrouter_key') || '';
let OLLAMA_URL = localStorage.getItem('sei_ollama_url') || 'http://localhost:11434';
let OLLAMA_MODEL = localStorage.getItem('sei_ollama_model') || 'qwen2.5:7b';

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
};

function injetarMarcaDagua() {
  const rodape = document.createElement('div');
  rodape.innerHTML = `&copy; 2026 SES-PE — DGMCG/GGPCG. Desenvolvido por <strong>Cleuton Vieira</strong>.`;
  rodape.style = "text-align: center; padding: 15px; font-size: 0.75rem; color: #adb5bd; margin-top: auto; border-top: 1px solid #dee2e6;";
  document.getElementById('content').parentElement.appendChild(rodape);
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
    const res = await api('auth/login', { email: usuario, senha_hash: hash });

    if (res.ok) {
      usuarioAtual = res.usuario;
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
    content.innerHTML = `
      <div style="max-width:600px;background:#fff;padding:24px;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:16px;">
          Ordem de uso: Gemini primeiro; se falhar, tenta Groq; se falhar, tenta OpenRouter (grátis); se
          falhar, tenta Ollama local. Cada etapa só é usada se a anterior der erro de verdade.
        </p>
        <div class="form-group"><label>1. Gemini (principal)</label><input type="password" id="cfg-gemini" value="${GEMINI_KEY}" placeholder="Chave do Google AI Studio..."></div>
        <div class="form-group"><label>2. Groq (fallback em nuvem — opcional)</label><input type="password" id="cfg-groq" value="${GROQ_KEY}" placeholder="Chave grátis em console.groq.com..."></div>
        <div class="form-group"><label>3. OpenRouter (fallback em nuvem — opcional)</label><input type="password" id="cfg-openrouter" value="${OPENROUTER_KEY}" placeholder="Chave grátis em openrouter.ai/keys..."></div>
        <div class="form-group"><label>4. Ollama (fallback local — opcional)</label>
          <input type="text" id="cfg-ollama-url" value="${OLLAMA_URL}" placeholder="http://localhost:11434" style="margin-bottom:6px;">
          <input type="text" id="cfg-ollama-model" value="${OLLAMA_MODEL}" placeholder="qwen2.5:7b">
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

// ==================== DASHBOARD MULTI-CAIXAS ====================
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

      // Verifica se há perguntas pendentes de achados direcionadas a este usuário
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
      } catch (e) {
        // Ignora falha pontual de checagem de achado na listagem
      }

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

// ==================== REGISTRO DE CONCLUÍDOS ====================
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

  OPENROUTER_KEY = (document.getElementById('cfg-openrouter')?.value || '').trim();
  localStorage.setItem('sei_openrouter_key', OPENROUTER_KEY);

  OLLAMA_URL = (document.getElementById('cfg-ollama-url')?.value || '').trim() || 'http://localhost:11434';
  localStorage.setItem('sei_ollama_url', OLLAMA_URL);

  OLLAMA_MODEL = (document.getElementById('cfg-ollama-model')?.value || '').trim() || 'qwen2.5:7b';
  localStorage.setItem('sei_ollama_model', OLLAMA_MODEL);

  alert('Configurações de IA salvas!');
  verificarIA();
}

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
    const amostra = texto.substring(0, 6000);
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
      console.warn('Sugestão de título/unidade/OSS via IA falhou:', e.message);
    }

    status.innerHTML = `<div style="background:#d1e7dd; color:#0f5132; padding:8px 12px; border-radius:6px; font-size:0.82rem;">
      <i class="ti ti-check"></i> ${escHtml(file.name)} lido. Confira os campos destacados abaixo antes de salvar.
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

  if (_arquivoPrePreenchido) {
    if (btn) btn.innerHTML = '<span class="spinner"></span> Anexando documento já lido...';
    processoAtual = res.processo;
    try {
      await salvarDocumentoNoBackend(_arquivoPrePreenchido.nome, _arquivoPrePreenchido.texto);
    } catch (e) {
      console.warn('Processo criado, mas falhou ao anexar o documento pré-lido:', e.message);
    }
    _arquivoPrePreenchido = null;
  }

  abrirProcesso(res.processo.numero_sei || String(res.processo.id));
}

// ==================== PAINEL DE EVIDÊNCIAS (MODO TELA DUPLA) ====================
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

// ==================== CONSTRUTOR DA TELA DE PROCESSO ====================
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
    docs.forEach(d => { docsHtml += `<li style="margin-bottom:3px;"><i class="ti ti-file-type-pdf" style="color:#dc3545; margin-right:5px;"></i> ${escHtml(d.nome_arquivo)}</li>`; });
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
        <input type="checkbox" id="chk-busca-externa"> "Buscar normas e decisões de tribunais na web (SES-PE, TCE, TCU)" — Pesquisa automática na internet por leis e jurisprudências. Recurso experimental e mais lento; o resultado pode estar desatualizado ou vir de fontes não oficiais, exigindo confirmação rigorosa antes de ser citado em um parecer.
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
      <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Cole sua minuta ou parecer abaixo. A IA cruza seu texto com os documentos originais do processo para apontar melhorias de mérito e consistência. A palavra final e a aprovação são sempre suas.</p>
      <textarea id="editor-final" placeholder="Cole o seu parecer do Word ou do SEI aqui para ser revisado..." style="width:100%; height:150px; padding:15px; border:1px solid #ced4da; border-radius:6px; font-family: inherit; font-size: 0.95rem; margin-bottom: 15px; outline:none; resize:vertical;"></textarea>
      <div style="display: flex; align-items: center; gap: 15px;">
          <button class="btn btn-warning" onclick="rodarRevisaoFinal()"><i class="ti ti-search"></i> Executar Análise Completa</button>
          <span id="contador-revisao" style="font-weight: bold; font-size: 0.95rem;"></span>
      </div>
      <div id="status-revisao" style="margin-top:15px;"></div>
    </div>
  `;
  content.innerHTML = html;

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

// ==================== ENCAMINHAR PROCESSO ====================
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

// ==================== UPLOAD ====================
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

const BLOCO_MAX_CHARS = 45000;
async function salvarDocumentoNoBackend(nomeArquivo, texto) {
  const res = await api('documentos/adicionar-completo', {
    processo_id: processoAtual.id, nome_arquivo: nomeArquivo, texto, adicionado_por: usuarioAtual.email
  });
  if (!res.ok) throw new Error('Falha ao salvar documento: ' + res.erro);
}

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

  if (nome.endsWith('.txt') || nome.endsWith('.csv') || nome.endsWith('.md')) {
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
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
            if (texto.trim().length > 20) { await salvarDocumentoNoBackend(filename, texto); importados++; }
            else avisos.push(`${filename}: nenhum texto extraído — NÃO importado`);
          } catch (e) { avisos.push(`${filename}: ${e.message}`); }
        }
        arquivosIgnorados.forEach(f => avisos.push(`${f}: tipo não suportado — NÃO importado`));
      } catch (e) {
        avisos.push(`${file.name}: não foi possível abrir o ZIP (${e.message})`);
      }

    } else if (EXTENSOES_SUPORTADAS.some(ext => nomeLower.endsWith(ext))) {
      status.innerHTML = `<span class="spinner"></span> Extraindo texto de ${escHtml(file.name)}...`;
      try {
        const buf = await file.arrayBuffer();
        const texto = await extrairTextoArquivo(file.name, buf);
        if (!texto.trim().length) throw new Error('nenhum texto extraído');
        await salvarDocumentoNoBackend(file.name, texto);
        importados++;
      } catch (e) {
        avisos.push(`${file.name}: ${e.message}`);
      }

    } else {
      avisos.push(`${file.name}: tipo não suportado — NÃO importado`);
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
const ORDEM_PROVEDORES = [
  { id: 'gemini', nome: 'Gemini' },
  { id: 'groq', nome: 'Groq' },
  { id: 'openrouter', nome: 'OpenRouter' },
  { id: 'ollama', nome: 'Ollama' }
];

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

function mascararBlocosQualificacao(texto) {
  const mapa = new Map();
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
      mapa.set(marcador, match + trechoCapturado);
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

  return { textoComBlocosMascarados, mapaBlocos: mapa };
}

function mascararDadosSensiveis(texto) {
  const mapa = new Map();
  const contador = { CPF: 0, RG: 0, EMAIL: 0, TELEFONE: 0, BANCARIO: 0 };

  const { textoComBlocosMascarados, mapaBlocos } = mascararBlocosQualificacao(texto);
  let textoMascarado = textoComBlocosMascarados;
  for (const [marcador, original] of mapaBlocos) mapa.set(marcador, original);

  function substituir(regex, tipo) {
    const marcadorPorValor = new Map();
    textoMascarado = textoMascarado.replace(regex, (match) => {
      if (marcadorPorValor.has(match)) return marcadorPorValor.get(match);
      contador[tipo]++;
      const marcador = `[${tipo}-${contador[tipo]}]`;
      marcadorPorValor.set(match, marcador);
      mapa.set(marcador, match);
      return marcador;
    });
  }

  substituir(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, 'CPF');
  substituir(/\b\d{1,2}\.\d{3}\.\d{3}-[\dxX]\b/g, 'RG');
  substituir(/[\w.+-]+@[\w-]+\.[\w.-]+/g, 'EMAIL');
  substituir(/\(\d{2}\)\s?9?\d{4}-?\d{4}\b/g, 'TELEFONE');
  substituir(/\b(?:ag[êe]ncia|conta corrente|c\/c)\s*:?\s*\d{3,10}-?\d?\b/gi, 'BANCARIO');

  return { textoMascarado, mapa, totalMascarado: mapa.size };
}

function desmascararTexto(texto, mapa) {
  if (!mapa || !mapa.size) return texto;
  let resultado = texto;
  for (const [marcador, original] of mapa) resultado = resultado.split(marcador).join(original);
  return resultado;
}

async function invocarIAComFallback(prompt, isChat = false, statusEl = null) {
  const erros = [];
  const estados = { gemini: 'pendente', groq: 'pendente', openrouter: 'pendente', ollama: 'pendente' };
  if (!GEMINI_KEY) estados.gemini = 'pulado';
  if (!GROQ_KEY) estados.groq = 'pulado';
  if (!OPENROUTER_KEY) estados.openrouter = 'pulado';

  const { textoMascarado: promptMascarado, mapa, totalMascarado } = mascararDadosSensiveis(prompt);

  if (GEMINI_KEY) {
    estados.gemini = 'tentando';
    renderPainelProvedores(statusEl, estados, 'Chamando Gemini...');
    try {
      const r = await invocarGeminiPremium(promptMascarado, isChat, statusEl);
      estados.gemini = 'ok';
      renderPainelProvedores(statusEl, estados, 'Concluído.');
      return desmascararTexto(r, mapa);
    } catch (e) {
      estados.gemini = 'falhou';
      erros.push('Gemini: ' + e.message);
    }
  }

  if (GROQ_KEY) {
    estados.groq = 'tentando';
    renderPainelProvedores(statusEl, estados, 'Chamando Groq...');
    try {
      const r = await invocarGroq(promptMascarado, isChat, statusEl);
      estados.groq = 'ok';
      renderPainelProvedores(statusEl, estados, 'Concluído.');
      return desmascararTexto(r, mapa);
    } catch (e) {
      estados.groq = 'falhou';
      erros.push('Groq: ' + e.message);
    }
  }

  if (OPENROUTER_KEY) {
    estados.openrouter = 'tentando';
    renderPainelProvedores(statusEl, estados, 'Chamando OpenRouter...');
    try {
      const r = await invocarOpenRouter(promptMascarado, isChat, statusEl);
      estados.openrouter = 'ok';
      renderPainelProvedores(statusEl, estados, 'Concluído.');
      return desmascararTexto(r, mapa);
    } catch (e) {
      estados.openrouter = 'falhou';
      erros.push('OpenRouter: ' + e.message);
    }
  }

  estados.ollama = 'tentando';
  renderPainelProvedores(statusEl, estados, 'Chamando Ollama local...');
  try {
    const r = await invocarOllama(prompt, isChat, statusEl);
    estados.ollama = 'ok';
    renderPainelProvedores(statusEl, estados, 'Concluído.');
    return r;
  } catch (e) {
    estados.ollama = 'falhou';
    erros.push('Ollama: ' + e.message);
  }

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
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
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
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
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

function exportarRelatorioAchados() {
  if (!window.achadosAtuais || window.achadosAtuais.length === 0) return alert('Nenhum achado para exportar.');
  const sei = processoAtual.numero_sei || String(processoAtual.id);
  let htmlReport = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'></head><body style="font-family:'Times New Roman',serif;font-size:12pt;"><h2>RELATÓRIO DE ACHADOS</h2><p>Processo: ${sei}</p><hr/>`;
  window.achadosAtuais.forEach((c, index) => {
    htmlReport += `<p><strong>${index + 1}. [${c.tag}] ${c.titulo}</strong><br/>Origem: ${c.doc_origem || ''}<br/>Explicação: ${c.explicacao}</p>`;
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
function extrairNumerosProcesso(texto) { return [...new Set(texto.match(/\d{4,}\.\d{5,6}\/\d{4}-\d{2}/g) || [])].slice(0, 10).map(v => ({ valor: v, contexto: extrairContexto(texto, v, 40) })); }
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
    const v = extrairValoresMonetarios(d.texto);
    return `\n--- ${d.nome} ---\n` + (v.length ? v.map(x => `• ${x.valor}`).join('\n') : '(sem valores)');
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
  try {
    const dadosExtraidos = montarDadosExtraidos(textoIntegralAtual);
    const prompt = `Audite os documentos da unidade ${p.unidade} e OSS ${p.oss}:\n${dadosExtraidos}\nRetorne JSON: {"cards": [{"tag": "Financeiro", "setor": "SFCG", "titulo": "Título", "evidencia": "trecho", "explicacao": "motivo", "doc_origem": "doc", "verificar": true}]}`;
    const jsonStr = await invocarIAComFallback(prompt, false, st);
    const jsonObj = JSON.parse(jsonStr);
    window.achadosAtuais = jsonObj.cards || [];
    contadorEl.innerHTML = `<span style="background:#f8d7da; color:#842029; padding:6px 12px; border-radius:20px;">${window.achadosAtuais.length} inconsistência(s)</span>`;
    renderizarCards(window.achadosAtuais);
    st.innerHTML = '';
    await api('auditorias/salvar', { processo_id: p.id, tipo_checkpoint: 'GERAL', achados_json: JSON.stringify(window.achadosAtuais), raw_ia: jsonStr, executado_por: usuarioAtual.email });
  } catch (e) {
    st.innerHTML = renderErroAmigavel(e.message);
  }
}

function renderizarCards(cards) {
  const painel = document.getElementById('painel-cards');
  if (!cards || cards.length === 0) return painel.innerHTML = '<div class="alert alert-success">✓ Nenhum apontamento.</div>';
  let html = `<div style="margin-bottom:15px; text-align:right;"><button class="btn btn-secondary btn-sm" onclick="exportarRelatorioAchados()"><i class="ti ti-file-type-doc"></i> Exportar Relatório (.DOC)</button></div>`;
  cards.forEach((c, idx) => {
    const cardId = `rx-${idx}`;
    window.memoriaEvidencias[cardId] = { tag: c.tag, titulo: c.titulo, texto: c.explicacao, doc: c.doc_origem };
    const ref = `${c.tag}: ${c.titulo}`;
    html += `<div class="rx-card is-obice" id="${cardId}-div" data-referencia-achado="${escAttr(ref)}">
      <div class="rx-header" onclick="document.getElementById('${cardId}-div').classList.toggle('open')">
        <div><span class="rx-tag">${escHtml(c.tag)}</span> <span class="rx-title">${escHtml(c.titulo)}</span></div>
      </div>
      <div class="rx-body">
        <p><strong>Setor:</strong> ${escHtml(c.setor)}</p>
        <p>${escHtml(c.explicacao)}</p>
        <div style="margin-top:10px; display:flex; gap:10px;">
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

async function fazerPerguntaAoProcesso() {
  const input = document.getElementById('chat-input');
  const history = document.getElementById('chat-history');
  const pergunta = input.value.trim();
  if (!pergunta) return;
  if (history.innerHTML.includes('O histórico')) history.innerHTML = '';
  history.innerHTML += `<div><strong>Você:</strong> ${escHtml(pergunta)}</div>`;
  input.value = '';
  try {
    const resposta = await invocarIAComFallback(pergunta, true);
    history.innerHTML += `<div><strong>IA:</strong> ${escHtml(resposta)}</div>`;
    api('consultas/salvar', { processo_id: processoAtual.id, pergunta, resposta, usuario: usuarioAtual.email });
  } catch (e) {
    history.innerHTML += `<div>Erro ao responder.</div>`;
  }
}

async function rodarRevisaoFinal() {
  const st = document.getElementById('status-revisao');
  const txt = document.getElementById('editor-final').value.trim();
  if (!txt) return st.innerHTML = '<div class="alert alert-danger">Cole seu parecer.</div>';
  st.innerHTML = 'Revisando...';
  try {
    const prompt = `Revise o parecer com base nos documentos:\n${textoIntegralAtual}\nParecer:\n${txt}\nRetorne JSON: {"criticas": [], "sugestao_linguagem_simples": ""}`;
    const jsonStr = await invocarIAComFallback(prompt, false, st);
    const rev = JSON.parse(jsonStr);
    st.innerHTML = `<div class="alert alert-warning">${(rev.criticas || []).join('<br/>')}</div>`;
    _ultimoTextoRevisadoHash = await sha256(txt);
  } catch (e) {
    st.innerHTML = renderErroAmigavel(e.message);
  }
}

function _mensagemErroAmigavel(msg) { return { titulo: 'Erro no processamento', sugestao: msg }; }
function renderErroAmigavel(msg) { return `<div class="alert alert-danger">${escHtml(msg)}</div>`; }
function _garantirEstiloPulso() {}
function escHtml(s) { return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }
function escAttr(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'"); }
function criarModal(h, comRodapePadrao = true) {
  fecharModal();
  const m = document.createElement('div');
  m.className = 'modal-overlay'; m.id = 'modal-ov';
  m.innerHTML = `<div class="modal">${h}${comRodapePadrao ? '<button onclick="fecharModal()">Fechar</button>' : ''}</div>`;
  document.body.appendChild(m);
}
function fecharModal() { document.getElementById('modal-ov')?.remove(); }
function verificarIA() {}