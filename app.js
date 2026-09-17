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

// 🛡️ PROTEÇÃO DE PROPRIEDADE INTELECTUAL
console.log("%c⚠️ PROPRIEDADE INTELECTUAL", "color: red; font-size: 24px; font-weight: bold;");
console.log("%cEste sistema foi arquitetado e desenvolvido por Antonio Cleuton Eufrasio Vieira. É estritamente proibida a cópia, clonagem, engenharia reversa ou uso comercial não autorizado deste código-fonte.", "color: #333; font-size: 14px;");

let GEMINI_KEY = localStorage.getItem('sei_gemini_key') || '';
let GROQ_KEY = localStorage.getItem('sei_groq_key') || '';
let OLLAMA_URL = localStorage.getItem('sei_ollama_url') || 'http://localhost:11434';
let OLLAMA_MODEL = localStorage.getItem('sei_ollama_model') || 'qwen2.5:7b';

// URL do Backend (Apps Script) — planilha compartilhada:
let API_URL = 'https://script.google.com/macros/s/AKfycbzzcJEAQPUCwY5YC2o1O5bj500pRE2mOFfZrLCy-e2kFzIgoDkebamJBgQK_yV2Ez0b/exec';

let usuarioAtual = null;
let processoAtual = null;      // { id, numero_sei, titulo, unidade, oss, gerencia, status, responsavel_atual, ... }
let textoIntegralAtual = '';   // texto consolidado dos documentos do processo aberto (vem do backend, não do localStorage)
let _ultimoTextoRevisadoHash = null; // hash do texto que passou pela Revisão Final — usado como aviso (não bloqueio) ao Finalizar
let _ultimaTramitacaoRecebida = null; // { de_usuario, para_usuario, data, observacao } — usado pelo botão "Devolver"
let painelEvidenciasWin = null;
window.memoriaEvidencias = {};
window.achadosAtuais = [];

window.onload = () => {
  verificarIA();
  injetarMarcaDagua();
};

function injetarMarcaDagua() {
  const rodape = document.createElement('div');
  rodape.innerHTML = `&copy; 2026 SEI Analista. Arquitetado por <strong>Antonio Cleuton Eufrasio Vieira</strong>.`;
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
        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Dica: Cole o nome do arquivo (ex: SEI_230...) e o sistema limpa o número.</p>
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
          Ordem de uso: Gemini primeiro; se falhar, tenta Groq; se falhar, tenta Ollama local.
          Cada etapa só é usada se a anterior der erro de verdade.
        </p>
        <div class="form-group"><label>1. Gemini (principal)</label><input type="password" id="cfg-gemini" value="${GEMINI_KEY}" placeholder="Chave do Google AI Studio..."></div>
        <div class="form-group"><label>2. Groq (fallback em nuvem — opcional)</label><input type="password" id="cfg-groq" value="${GROQ_KEY}" placeholder="Chave grátis em console.groq.com..."></div>
        <div class="form-group"><label>3. Ollama (fallback local — opcional)</label>
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
        ${botaoParar}
        ${botaoExcluir}
      </div>`;
    });
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

  const [resProc, resAud, resCons] = await Promise.all([
    api('processos/obter', { id }),
    api('auditorias/listar', { processo_id: id }),
    api('consultas/listar', { processo_id: id })
  ]);
  if (!resProc.ok) { content.innerHTML = `<div class="alert alert-danger">${escHtml(resProc.erro)}</div>`; return; }

  const proc = resProc.processo;
  const auditorias = resAud.auditorias || [];
  const consultas = resCons.consultas || [];

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

  OLLAMA_URL = (document.getElementById('cfg-ollama-url')?.value || '').trim() || 'http://localhost:11434';
  localStorage.setItem('sei_ollama_url', OLLAMA_URL);

  OLLAMA_MODEL = (document.getElementById('cfg-ollama-model')?.value || '').trim() || 'qwen2.5:7b';
  localStorage.setItem('sei_ollama_model', OLLAMA_MODEL);

  alert('Configurações de IA salvas!');
  verificarIA();
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

  abrirProcesso(res.processo.numero_sei || String(res.processo.id));
}

// ==================== PAINEL DE EVIDÊNCIAS (MODO TELA DUPLA) ====================
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
              .watermark { text-align: center; margin-top: 30px; font-size: 0.75rem; color: #adb5bd; border-top: 1px solid #dee2e6; padding-top: 15px; }
              .btn-remove { background: #ffe3e3; color: #e03131; border: 1px solid #ffc9c9; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 0.75rem; float: right; font-weight: bold; transition: 0.2s;}
              .btn-remove:hover { background: #fa5252; color: white;}
          </style>
      </head>
      <body>
          <h2>📌 Painel de Evidências</h2>
          <p style="font-size: 0.85rem; color: #6c757d; margin-bottom: 20px;">As informações que você alfinetar no Monitor 1 aparecerão aqui.</p>
          <div id="evidencias-container"></div>
          <div class="watermark">&copy; 2026 SEI Analista.<br>Arquitetura exclusiva por Antonio Cleuton Eufrasio Vieira.</div>
          <script>
              function removerEvidencia(id) { var el = document.getElementById(id); if(el) el.remove(); }
              function copiarDocID(texto) { navigator.clipboard.writeText(texto).then(() => alert('Documento Copiado: ' + texto + '\\n\\nCole na barra de pesquisa do SEI!')); }
          </script>
      </body>
      </html>
  `);
  painelEvidenciasWin.document.close();
}

function fixarEvidenciaDaMemoria(id) {
  const dados = window.memoriaEvidencias[id];
  if (!dados) return alert("Erro: Dados não encontrados na memória.");
  if (!painelEvidenciasWin || painelEvidenciasWin.closed) abrirPainelEvidencias();
  const doc = painelEvidenciasWin.document;
  if (doc.getElementById('ev-' + id)) { painelEvidenciasWin.focus(); return; }
  const container = doc.getElementById('evidencias-container');
  if (container) {
    let htmlDoc = dados.doc ? `<div class="evidencia-doc" onclick="copiarDocID('${dados.doc}')" title="Clique para copiar">📄 Origem: ${dados.doc}</div>` : '';
    const html = `
        <div class="evidencia-card" id="ev-${id}">
            <button class="btn-remove" onclick="removerEvidencia('ev-${id}')">Remover</button>
            <div class="evidencia-tag">${dados.tag}</div>
            <div class="evidencia-title">${dados.titulo}</div>
            ${htmlDoc}
            <div class="evidencia-text">${dados.texto}</div>
        </div>`;
    container.insertAdjacentHTML('afterbegin', html);
    painelEvidenciasWin.focus();
  }
}

// ==================== CONSTRUTOR DA TELA DE PROCESSO ====================
// Busca o processo no backend e monta o texto integral dos documentos a partir
// de lá (documentos/listar + conteudo/listar) — não mais do localStorage.
async function abrirProcesso(identificador) {
  const content = document.getElementById('content');
  if (!content) return;
  content.innerHTML = '<span class="spinner"></span> Carregando processo...';

  const resProc = await api('processos/obter', isNaN(identificador) ? { numero_sei: identificador } : { id: identificador });
  if (!resProc.ok) { content.innerHTML = `<div class="alert alert-danger">Processo não encontrado: ${escHtml(resProc.erro || '')}</div>`; return; }
  processoAtual = resProc.processo;
  _ultimoTextoRevisadoHash = null; // novo processo aberto — nenhuma revisão feita ainda nesta sessão

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
        <button class="btn btn-primary btn-sm" onclick="modalUploadZIP()"><i class="ti ti-cloud-upload"></i> Importar Arquivos (ZIP/PDF)</button>
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
        <input type="checkbox" id="chk-historico-unidade" checked> Cruzar com histórico contratual da unidade (pasta Drive "LEIS E DECRETOS") —
        fonte curada, mas o casamento é por nome de arquivo, então achados aqui também saem marcados "verificar"
      </label>
      <div id="status-fonte-historico" style="margin-top:4px; font-size:0.78rem;"></div>
      <label style="display:block; margin-top:6px; font-size:0.82rem; color:var(--text-muted);">
        <input type="checkbox" id="chk-busca-externa"> Buscar normas externas na web (leis/decretos/portarias da SES-PE) —
        <strong>experimental</strong>: mais lento, e todo achado baseado nisso é sempre marcado como "verificar" (a busca pode trazer versão desatualizada ou não oficial)
      </label>
      <div id="ia-status" style="margin-top:15px;"></div>
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
      <div style="display: flex; align-items: center; gap: 15px;">
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
function modalUploadZIP() {
  criarModal(`
    <h2 style="margin-bottom:15px; font-size:1.2rem;">Importar Arquivos</h2>
    <div class="dropzone" id="dz-upload"
         ondragover="event.preventDefault(); this.style.borderColor='var(--action-amber)'; this.style.backgroundColor='#fff3cd';"
         ondragleave="event.preventDefault(); this.style.borderColor='#ced4da'; this.style.backgroundColor='#f8f9fa';"
         ondrop="event.preventDefault(); this.style.borderColor='#ced4da'; this.style.backgroundColor='#f8f9fa'; document.getElementById('file-up').files = event.dataTransfer.files; processarUploadZIP(event.dataTransfer.files);"
         onclick="document.getElementById('file-up').click()">
      <i class="ti ti-cloud-download" style="font-size:2.5rem; margin-bottom:10px; color:var(--action-primary);"></i><br>
      <strong>Arraste o arquivo aqui</strong><br>
      <span style="font-size:0.85rem;">.ZIP, .PDF, .DOCX ou .XLSX — ou clique para selecionar</span>
    </div>
    <input type="file" id="file-up" accept=".zip,.pdf,.docx,.doc,.xlsx,.xls" style="display:none" onchange="processarUploadZIP(this.files)">
    <div id="up-status" style="margin-top:15px;"></div>
  `);
}

// Envia um documento já extraído para o backend, quebrando o texto em blocos
// (o Sheets tem limite prático de tamanho por célula).
const BLOCO_MAX_CHARS = 45000;
async function salvarDocumentoNoBackend(nomeArquivo, texto) {
  // Uma única chamada de rede — antes eram 1 (criar documento) + N (uma por bloco de
  // texto). A demora do upload nunca foi ler o arquivo (isso é local e instantâneo);
  // é a ida-e-volta ao Apps Script se repetindo várias vezes por documento.
  const res = await api('documentos/adicionar-completo', {
    processo_id: processoAtual.id, nome_arquivo: nomeArquivo, texto, adicionado_por: usuarioAtual.email
  });
  if (!res.ok) throw new Error('Falha ao salvar documento: ' + res.erro);
}

// Todo tipo de arquivo que o sistema sabe extrair — usado tanto pra upload direto
// quanto pra decidir o que processar dentro de um ZIP. Qualquer arquivo fora dessa
// lista, dentro de um ZIP, é EXPLICITAMENTE avisado como não importado — nunca some
// em silêncio (é exatamente esse tipo de perda que compromete a auditoria).
const EXTENSOES_SUPORTADAS = ['.pdf', '.docx', '.doc', '.xlsx', '.xls'];

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

  throw new Error('Tipo de arquivo não suportado.');
}

async function processarUploadZIP(files) {
  const status = document.getElementById('up-status');
  const file = files[0];
  if (!file) return;

  const nomeLower = file.name.toLowerCase();

  if (EXTENSOES_SUPORTADAS.some(ext => nomeLower.endsWith(ext))) {
    status.innerHTML = `<span class="spinner"></span> Extraindo texto de ${escHtml(file.name)}...`;
    try {
      const buf = await file.arrayBuffer();
      const texto = await extrairTextoArquivo(file.name, buf);
      if (!texto.trim().length) throw new Error('Nenhum texto extraído (pode ser um arquivo escaneado/imagem, sem OCR).');
      status.innerHTML = `<span class="spinner"></span> Gravando no servidor compartilhado...`;
      await salvarDocumentoNoBackend(file.name, texto);
      status.innerHTML = `<div class="alert alert-success">✓ Arquivo lido e gravado!</div>`;
      setTimeout(() => { fecharModal(); abrirProcesso(processoAtual.numero_sei || String(processoAtual.id)); }, 1200);
    } catch (e) {
      status.innerHTML = `<div class="alert alert-danger">Erro ao processar: ${escHtml(e.message)}</div>`;
    }

  } else if (nomeLower.endsWith('.zip')) {
    status.innerHTML = `<span class="spinner"></span> Mapeando arquivo ZIP...`;
    const zip = new JSZip();
    const contents = await zip.loadAsync(file);

    const todosArquivos = Object.keys(contents.files).filter(k => !contents.files[k].dir);
    const arquivosSuportados = todosArquivos.filter(k => EXTENSOES_SUPORTADAS.some(ext => k.toLowerCase().endsWith(ext)));
    const arquivosIgnorados = todosArquivos.filter(k => !arquivosSuportados.includes(k));

    let extraidos = 0;
    const avisos = [];

    for (const filename of arquivosSuportados) {
      extraidos++;
      status.innerHTML = `<span class="spinner"></span> Processando ${extraidos} de ${arquivosSuportados.length}: <strong>${escHtml(filename.substring(0, 25))}...</strong>`;
      try {
        const buf = await contents.files[filename].async("arraybuffer");
        const texto = await extrairTextoArquivo(filename, buf);
        if (texto.trim().length > 20) await salvarDocumentoNoBackend(filename, texto);
        else avisos.push(`${filename}: nenhum texto extraído (pode ser imagem/escaneado sem OCR) — NÃO importado`);
      } catch (e) { avisos.push(`${filename}: ${e.message}`); }
    }

    // Nunca silencia isso: se algo dentro do ZIP não pôde ser lido, a pessoa precisa saber.
    arquivosIgnorados.forEach(f => avisos.push(`${f}: tipo de arquivo não suportado — NÃO foi importado`));

    status.innerHTML = avisos.length
      ? `<div class="alert alert-warning"><strong>${extraidos} importado(s), ${avisos.length} aviso(s):</strong><br>${avisos.map(escHtml).join('<br>')}</div>`
      : `<div class="alert alert-success" style="background:#d1e7dd; color:#0f5132; padding:10px; border-radius:6px;">✓ Extração e gravação concluídas! (${arquivosSuportados.length} arquivo(s))</div>`;
    setTimeout(() => { fecharModal(); abrirProcesso(processoAtual.numero_sei || String(processoAtual.id)); }, avisos.length ? 4000 : 1800);
  } else {
    status.innerHTML = `<div class="alert alert-danger">Tipo de arquivo não suportado: ${escHtml(file.name)}</div>`;
  }
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

async function invocarIAComFallback(prompt, isChat = false, statusEl = null) {
  const erros = [];
  const estados = { gemini: 'pendente', groq: 'pendente', ollama: 'pendente' };
  if (!GEMINI_KEY) estados.gemini = 'pulado';
  if (!GROQ_KEY) estados.groq = 'pulado';

  if (GEMINI_KEY) {
    estados.gemini = 'tentando';
    renderPainelProvedores(statusEl, estados, 'Chamando Gemini...');
    try {
      const r = await invocarGeminiPremium(prompt, isChat, statusEl);
      estados.gemini = 'ok';
      renderPainelProvedores(statusEl, estados, 'Concluído.');
      return r;
    } catch (e) {
      estados.gemini = 'falhou';
      erros.push('Gemini: ' + e.message);
    }
  } else {
    erros.push('Gemini: chave não configurada');
  }

  if (GROQ_KEY) {
    estados.groq = 'tentando';
    renderPainelProvedores(statusEl, estados, 'Gemini não respondeu — chamando Groq...');
    try {
      const r = await invocarGroq(prompt, isChat, statusEl);
      estados.groq = 'ok';
      renderPainelProvedores(statusEl, estados, 'Concluído.');
      return r;
    } catch (e) {
      estados.groq = 'falhou';
      erros.push('Groq: ' + e.message);
    }
  } else {
    erros.push('Groq: chave não configurada');
  }

  estados.ollama = 'tentando';
  renderPainelProvedores(statusEl, estados, 'Gemini e Groq não responderam — chamando Ollama local...');
  try {
    const r = await invocarOllama(prompt, isChat, statusEl);
    estados.ollama = 'ok';
    renderPainelProvedores(statusEl, estados, 'Concluído.');
    return r;
  } catch (e) {
    estados.ollama = 'falhou';
    erros.push('Ollama: ' + e.message);
  }

  renderPainelProvedores(statusEl, estados, 'Nenhum provedor respondeu.');
  throw new Error('Todos os provedores de IA falharam:\n' + erros.join('\n'));
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

// === 1. CHECAGEM PREMIUM ===
async function rodarRaioX() {
  const st = document.getElementById('ia-status');
  const contadorEl = document.getElementById('contador-checagem');
  contadorEl.innerHTML = '';

  const p = processoAtual;
  if (!textoIntegralAtual || textoIntegralAtual.trim().length < 50) {
    return st.innerHTML = '<div class="alert alert-danger">Nenhum texto encontrado. Por favor, importe os documentos do processo primeiro.</div>';
  }

  st.innerHTML = `<span class="spinner"></span> Extraindo valores, datas, nº de processo e CEP (determinístico)...`;
  const dadosExtraidos = montarDadosExtraidos(textoIntegralAtual);

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
  const buscaExternaAtiva = document.getElementById('chk-busca-externa')?.checked;
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
7. IDENTIFICAÇÃO DO DOCUMENTO: identifique exatamente o nome do arquivo de onde extraiu cada evidência.
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

MUITO IMPORTANTE: se, após análise cuidadosa, não houver nenhuma inconsistência real e verificável, retorne
{"cards": []}. NUNCA invente um achado para preencher a resposta — retornar vazio é sempre preferível a um
achado forçado ou especulativo.

Retorne EXCLUSIVAMENTE um objeto JSON válido, sem markdown:
{"cards": [{"tag": "Financeiro", "setor": "SFCG", "titulo": "Título do Alerta", "evidencia": "trecho extraído (verbatim, o mais curto possível)", "explicacao": "motivo técnico, citando os valores/documentos exatos comparados", "doc_origem": "Nome do Arquivo de Origem", "verificar": true, "baseado_em_norma_externa": false, "baseado_em_historico_unidade": false}]}
${normasExternasBloco}

TEXTO BRUTO DOS DOCUMENTOS (use apenas para o item 8 — erros de digitação/redação):
${textoIntegralAtual}`;

  try {
    const jsonStr = await invocarIAComFallback(prompt, false, st);
    const jsonObj = JSON.parse(jsonStr);
    window.achadosAtuais = (jsonObj.cards || []).map(c => {
      // Trava reforçada: achado baseado em busca externa OU no histórico da unidade é SEMPRE
      // "verificar", mesmo que a IA (por erro) tenha marcado false — não confiamos só no prompt.
      if (c.baseado_em_norma_externa || c.baseado_em_historico_unidade) c.verificar = true;
      return c;
    });

    contadorEl.innerHTML = window.achadosAtuais.length > 0
      ? `<span style="background: #f8d7da; color: #842029; padding: 6px 12px; border-radius: 20px;"><i class="ti ti-alert-triangle"></i> ${window.achadosAtuais.length} inconsistência(s)</span>`
      : `<span style="background: #d1e7dd; color: #0f5132; padding: 6px 12px; border-radius: 20px;"><i class="ti ti-check"></i> Processo limpo nesta checagem.</span>`;

    renderizarCards(window.achadosAtuais);
    st.innerHTML = '';

    // Registra a checagem como auditoria no backend (mantém histórico e status do processo)
    await api('auditorias/salvar', {
      processo_id: p.id, tipo_checkpoint: 'GERAL',
      achados_json: JSON.stringify(window.achadosAtuais),
      raw_ia: jsonStr, executado_por: usuarioAtual.email
    });
  } catch (e) {
    st.innerHTML = renderErroAmigavel(e.message);
  }
}

function renderizarCards(cards) {
  const painel = document.getElementById('painel-cards');
  let html = '';
  if (!cards || cards.length === 0) return painel.innerHTML = '<div class="alert alert-success">✓ Nenhum apontamento crítico detectado nesta checagem.</div>';

  html += `<div style="margin-bottom: 15px; text-align: right;">
      <button class="btn btn-secondary btn-sm" onclick="exportarRelatorioAchados()" style="background-color: #6c757d; color: white;"><i class="ti ti-file-type-doc"></i> Exportar Relatório de Achados (.DOC)</button>
  </div>`;

  cards.forEach((c, idx) => {
    const cardId = `rx-${idx}`;
    window.memoriaEvidencias[cardId] = { tag: c.tag, titulo: c.titulo, texto: c.explicacao, doc: c.doc_origem };
    let nomeDoc = c.doc_origem && c.doc_origem !== 'undefined' ? c.doc_origem : 'Não identificado';
    const tagVerificar = c.verificar === false ? '' : `<span style="font-size:0.68rem;background:#fef9c3;color:#854d0e;padding:2px 8px;border-radius:10px;font-weight:600;margin-left:6px;">⚠ VERIFICAR</span>`;

    html += `
    <div class="rx-card is-obice" id="${cardId}-div">
      <div class="rx-header" onclick="document.getElementById('${cardId}-div').classList.toggle('open')">
        <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
            <div><span class="rx-tag">${escHtml(c.tag)}</span> <span class="rx-title">${escHtml(c.titulo)}</span>${tagVerificar}</div>
        </div>
      </div>
      <div class="rx-body">
        <div style="margin-bottom: 12px;">
            <span style="font-size:0.75rem; background:#fff3cd; color:#856404; padding:4px 8px; border-radius:4px; border: 1px solid #ffeeba; cursor:pointer;" onclick="navigator.clipboard.writeText('${escAttr(nomeDoc)}'); alert('ID do Documento copiado! Vá no SEI e cole para buscar.');" title="Clique para copiar">
               <i class="ti ti-file-type-pdf"></i> Origem: <strong>${escHtml(nomeDoc)}</strong> (clique para copiar)
            </span>
        </div>
        <div class="rx-evidence">${escHtml(c.evidencia)}</div>
        <p><strong>Setor:</strong> ${escHtml(c.setor)}</p>
        <p>${escHtml(c.explicacao)}</p>
        <div style="margin-top: 15px; display: flex; gap: 10px;">
          <button class="btn btn-sm" style="background-color: #0dcaf0; color: #000; border: none; font-weight: bold;" onclick="fixarEvidenciaDaMemoria('${cardId}')"><i class="ti ti-pin"></i> Fixar na Tela 2</button>
          <button class="btn btn-secondary btn-sm" style="background-color: #f8d7da; color: #842029; border: 1px solid #f5c2c7;" onclick="descartarCard('${cardId}-div')"><i class="ti ti-trash"></i> Ocultar</button>
        </div>
      </div>
    </div>`;
  });
  painel.innerHTML = html;
}

function descartarCard(idDiv) {
  const card = document.getElementById(idDiv);
  if (card) { card.style.transition = '0.3s ease'; card.style.opacity = '0'; setTimeout(() => card.remove(), 300); }
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
  const LIMIAR_FILTRAGEM = 400000;
  const contextoDocs = textoIntegralAtual.length > LIMIAR_FILTRAGEM
    ? extrairTrechosRelevantes(textoIntegralAtual, pergunta)
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
  if (!txtAnalista) return st.innerHTML = '<div class="alert alert-danger">Cole o seu parecer na caixa de texto primeiro.</div>';

  const p = processoAtual;
  st.innerHTML = `<span class="spinner"></span> Revisando cruzamento entre parecer e documentos...`;

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
${textoIntegralAtual}
------------------------------------------------
PARECER DO ANALISTA:
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
    st.innerHTML = htmlResultado;

    // Registra no histórico (fechava um buraco: só a Checagem salvava, a Revisão Final não)
    const achadosRevisao = (rev.criticas || []).map(c => ({ tipo: 'REVISAO_FINAL', descricao: c, documentos: '', verificar: true }));
    await api('auditorias/salvar', {
      processo_id: p.id, tipo_checkpoint: 'SAIDA',
      achados_json: JSON.stringify(achadosRevisao), raw_ia: jsonStr, executado_por: usuarioAtual.email
    });

    // Guarda o hash do texto revisado — é o que a trava do botão "Finalizar" confere depois
    _ultimoTextoRevisadoHash = await sha256(txtAnalista);

  } catch (e) { st.innerHTML = renderErroAmigavel(e.message); }
}

// ==================== UTILS ====================

// Traduz uma mensagem de erro técnica em algo que o funcionário entende: uma frase
// objetiva + uma sugestão do que fazer. O detalhe técnico continua acessível (link
// pequeno), só não fica exposto por padrão.
function _mensagemErroAmigavel(msg) {
  msg = String(msg || '');
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
  if (OLLAMA_URL) provedoresAtivos.push('Ollama'); // sempre "configurado" (URL tem padrão), só não garante que está rodando

  if (GEMINI_KEY || GROQ_KEY) {
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