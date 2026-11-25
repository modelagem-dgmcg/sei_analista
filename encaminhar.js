// ============================================================
// encaminhar.js — "Enviar a outro sistema": leva um achado para outro sistema (hoje, o Analista CTAI).
// Fica DESLIGADO até a administração ligar no menu da planilha. Desligado, o botão nem aparece.
// Fluxo: salvar rascunho -> conferir -> validar (congela) -> o outro sistema busca e devolve o andamento.
// Usa só api(), criarModal(), fecharModal(), escHtml(), escAttr(), mostrarToast(), processoAtual e usuarioAtual do app.js.
// ============================================================
(function () {
  const ESTADOS = {
    rascunho: 'Rascunho: ainda não liberado',
    validado: 'Liberado: aguardando o outro sistema buscar',
    recebido: 'Recebido pelo outro sistema',
    em_analise: 'Em análise no outro sistema',
    procede: 'Procede',
    nao_procede: 'Não procede',
    respondido: 'Respondido',
    errata_publicada: 'Corrigido por errata',
    cancelado: 'Cancelado',
    substituido: 'Substituído por uma versão nova'
  };
  let estado = { ativo: false, destinos: [] };
  function _procAtual() { try { return processoAtual || {}; } catch (e) { return {}; } }

  async function encCarregarEstado() {
    try {
      const r = await api('encaminhar/destinos');
      estado = { ativo: !!r.ativo, destinos: r.destinos || [] };
    } catch (e) { estado = { ativo: false, destinos: [] }; }
  }

  // Identificador estável do achado dentro do processo (o mesmo achado gera sempre o mesmo código).
  function _codigoAchado(c) {
    const t = [_procAtual().id || '', c.tag, c.titulo, c.doc_origem || '', c.pagina || '', String(c.evidencia || '').slice(0, 60)].join('|');
    let h = 5381;
    for (let i = 0; i < t.length; i++) h = ((h << 5) + h + t.charCodeAt(i)) >>> 0;
    return (_procAtual().id || 'p') + ':' + h.toString(36);
  }

  function encBotaoSistema(cardId) {
    if (!estado.ativo || !estado.destinos.length) return '';
    return `<button class="btn btn-sm" style="background:#fff; color:#1864ab; border:1px solid #1864ab;" title="Leva este achado para outro sistema, depois que você conferir" onclick="enviarAchadoOutroSistema('${cardId}')"><i class="ti ti-share-3"></i> Enviar a outro sistema</button>`;
  }

  function _linha(rot, html) { return `<label style="display:block; font-size:0.78rem; font-weight:600; margin:8px 0 3px;">${rot}</label>${html}`; }

  async function enviarAchadoOutroSistema(cardId) {
    const c = (window.memoriaCards || {})[cardId];
    if (!c) { mostrarToast('Não achei este achado na tela. Atualize a checagem.'); return; }
    const p = _procAtual() || {};
    const origemId = _codigoAchado(c);
    let existentes = [];
    try { existentes = (await api('encaminhar/listar', { origem_tipo: 'achado-processo', origem_id: origemId })).encaminhamentos || []; } catch (e) { /* segue sem histórico */ }
    const atual = existentes.sort((a, b) => b.versao - a.versao)[0] || null;
    const doc = c.doc_origem && c.doc_origem !== 'undefined' ? String(c.doc_origem).replace(/\.(pdf|docx?|xlsx?)$/i, '') : '';
    const ini = atual && atual.estado === 'rascunho' ? atual : null;
    const v = (k, pad) => escHtml(ini ? ini[k] : pad);
    const dest = estado.destinos.map(d => `<option value="${escAttr(d.id)}">${escHtml(d.rotulo)}</option>`).join('');
    const hist = atual ? `<div style="font-size:0.8rem; background:#f1f3f5; border-radius:6px; padding:8px 10px; margin-bottom:8px;"><strong>Último envio (versão ${atual.versao}):</strong> ${escHtml(ESTADOS[atual.estado] || atual.estado)}${atual.resposta_texto ? `<br><strong>Resposta${atual.resposta_por ? ' de ' + escHtml(atual.resposta_por) : ''}:</strong> ${escHtml(atual.resposta_texto)}` : ''}</div>` : '';
    window._encContexto = { cardId, origemId, atual };
    criarModal(`<h2>Enviar a outro sistema</h2>
      ${hist}
      <p style="font-size:0.8rem; color:#495057; margin:0 0 6px;">O texto abaixo vai como está. Confira e edite antes de liberar. Nada sai até você validar.</p>
      ${_linha('Para qual sistema', `<select id="enc-sis-destino" style="width:100%;padding:8px;">${dest}</select>`)}
      ${_linha('Título', `<input id="enc-sis-titulo" style="width:100%;padding:8px;" maxlength="200" value="${v('titulo', (c.tag ? '[' + c.tag + '] ' : '') + (c.titulo || ''))}">`)}
      ${_linha('O que foi encontrado', `<textarea id="enc-sis-achado" rows="5" style="width:100%;padding:8px;" maxlength="4000">${v('achado', c.explicacao || '')}</textarea>`)}
      ${_linha('O que pedimos que seja feito', `<textarea id="enc-sis-prov" rows="2" style="width:100%;padding:8px;" maxlength="1500">${v('providencia', c.sugestao || '')}</textarea>`)}
      ${_linha('Gravidade', `<select id="enc-sis-grav" style="width:100%;padding:8px;">${['Alta', 'Média', 'Baixa'].map(g => `<option ${(ini ? ini.gravidade : 'Média') === g ? 'selected' : ''}>${g}</option>`).join('')}</select>`)}
      ${_linha('Valor em jogo, em reais (se houver)', `<input id="enc-sis-impacto" type="number" min="0" step="0.01" style="width:100%;padding:8px;" value="${ini && ini.impacto_reais ? ini.impacto_reais : ''}">`)}
      <p style="font-size:0.78rem; color:#495057; margin:8px 0 0;">Vão junto: o documento de origem${doc ? ' (' + escHtml(doc) + (c.pagina ? ', página ' + escHtml(c.pagina) : '') + ')' : ''} e o trecho citado, a unidade${p.unidade ? ' (' + escHtml(p.unidade) + ')' : ''} e o seu setor.</p>
      <label style="display:flex; gap:6px; align-items:flex-start; font-size:0.82rem; margin-top:10px;"><input type="checkbox" id="enc-sis-confirmo"> <span>Conferi o texto e os documentos citados, e posso liberar este envio.</span></label>
      <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:12px;">
        <button class="btn btn-sm btn-secondary" onclick="encSalvar(false)">Salvar rascunho</button>
        <button class="btn btn-sm btn-primary" onclick="encSalvar(true)">Validar e liberar</button>
        ${atual && ['rascunho', 'validado'].indexOf(atual.estado) > -1 ? `<button class="btn btn-sm" style="background:#fff;color:#8e1628;border:1px solid #8e1628;" onclick="encCancelarEnvio('${escAttr(atual.id)}')">Cancelar este envio</button>` : ''}
      </div>`);
  }

  async function encSalvar(validar) {
    const cx = window._encContexto; if (!cx) return;
    const c = (window.memoriaCards || {})[cx.cardId]; if (!c) return;
    const p = _procAtual() || {};
    const g = id => (document.getElementById(id) || {}).value || '';
    if (validar && !(document.getElementById('enc-sis-confirmo') || {}).checked) { mostrarToast('Marque a confirmação de que você conferiu.'); return; }
    const doc = c.doc_origem && c.doc_origem !== 'undefined' ? String(c.doc_origem).replace(/\.(pdf|docx?|xlsx?)$/i, '') : '';
    const corpo = {
      destino: g('enc-sis-destino'), origem_tipo: 'achado-processo', origem_id: cx.origemId,
      titulo: g('enc-sis-titulo'), achado: g('enc-sis-achado'), providencia: g('enc-sis-prov'), gravidade: g('enc-sis-grav'),
      impacto_reais: Number(g('enc-sis-impacto')) || 0,
      setor_origem: (usuarioAtual && usuarioAtual.gerencia) || '', unidade: p.unidade || '', contrato: '',
      trechos: [{ documento: doc, id_sei: '', onde: c.pagina ? 'página ' + c.pagina : '', texto: c.evidencia || '', link: '' }],
      documentos: doc ? [doc + (p.numero_sei ? ' (processo ' + p.numero_sei + ')' : '')] : []
    };
    try {
      const r = await api('encaminhar/criar', corpo);
      if (r.ok === false) { mostrarToast(r.erro || 'Não foi possível salvar.'); return; }
      if (validar) {
        const v = await api('encaminhar/validar', { id: r.id, confirmo: true });
        if (v.ok === false) { mostrarToast(v.erro || 'Não foi possível validar.'); return; }
        mostrarToast('Liberado. O outro sistema vai buscar este achado.');
      } else mostrarToast('Rascunho salvo. Nada foi liberado.');
      fecharModal();
    } catch (e) { mostrarToast('Não foi possível salvar agora. Tente de novo.'); }
  }

  async function encCancelarEnvio(id) {
    try {
      const r = await api('encaminhar/cancelar', { id });
      mostrarToast(r.ok === false ? (r.erro || 'Não foi possível cancelar.') : 'Envio cancelado.');
      if (r.ok !== false) fecharModal();
    } catch (e) { mostrarToast('Não foi possível cancelar agora.'); }
  }

  window.encCarregarEstado = encCarregarEstado;
  window.encBotaoSistema = encBotaoSistema;
  window.enviarAchadoOutroSistema = enviarAchadoOutroSistema;
  window.encSalvar = encSalvar;
  window.encCancelarEnvio = encCancelarEnvio;
})();
