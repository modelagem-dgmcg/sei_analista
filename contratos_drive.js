// contratos_drive.js — lê o contrato e os termos aditivos direto do Drive (pasta LEIS E DECRETOS) para cada processo de desconto
// e guarda no processo a "versão do contrato" usada (arquivo, data de alteração, aditivos aplicados) e a ficha lida.
// Carregado depois do descontos.js. Backend: Contratos.gs (rota contratos/ler).

function ctEsc(s) { return typeof dEsc === 'function' ? dEsc(s) : String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

function descCaixaContratoHtml() {
  var a = DESC.atual || {}, v = String(a.contrato_versao || '').trim();
  if (DESC._lendoContrato) return '<span style="color:#084298;">' + ctEsc(DESC._ctStatus || 'Lendo o contrato e os aditivos no Drive…') + '</span>';
  if (v) return '<strong>Contrato usado neste processo:</strong> ' + ctEsc(v) + '<div style="color:#6c757d;margin-top:3px;">Lido do Drive para este trimestre. Se o contrato mudar depois, este processo continua com a versão acima.</div>' + (DESC._ctStatus ? '<div style="color:#664d03;margin-top:3px;">' + ctEsc(DESC._ctStatus) + '</div>' : '');
  return '<span style="color:#664d03;">' + ctEsc(DESC._ctStatus || 'O contrato ainda não foi lido para este processo.') + '</span>';
}
function descHtmlVersaoContrato() {
  return '<div id="d_ct_box" style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:0.82rem;">' + descCaixaContratoHtml() + '</div>';
}
function descBotaoContratoDrive() {
  return '<div style="background:#eef6ff;border:1px solid #cfe2ff;border-radius:8px;padding:12px;margin-bottom:12px;"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;"><div style="font-size:0.85rem;"><strong><i class="ti ti-cloud-download"></i> Ler o contrato e os aditivos do Drive</strong><div style="color:#495057;margin-top:2px;">Lê o contrato desta unidade na pasta LEIS E DECRETOS, aplica os aditivos vigentes no trimestre e monta a ficha com a origem de cada valor.</div></div><button class="btn btn-primary btn-sm" onclick="descLerContratoDrive(false)"><i class="ti ti-download"></i> Ler do Drive</button></div></div>' + descHtmlVersaoContrato();
}
function ctAtualizarCaixa() { var e = document.getElementById('d_ct_box'); if (e) e.innerHTML = descCaixaContratoHtml(); }

async function descLerContratoDrive(auto) {
  if (DESC._lendoContrato) return false;
  if (typeof descLerFicha === 'function') descLerFicha();
  var a = DESC.atual;
  if (!a || !String(a.unidade || '').trim() || !a.ano || !a.trimestre) { if (!auto) mostrarToast('Preencha a unidade, o ano e o trimestre no passo 1.'); return false; }
  DESC._lendoContrato = true; DESC._ctStatus = 'Lendo o contrato e os aditivos no Drive…'; ctAtualizarCaixa();
  try {
    var r = await api('contratos/ler', { unidade: a.unidade, tipo: a.tipo, contrato: a.contrato, ano: a.ano, trimestre: a.trimestre }, { timeoutMs: 240000 });
    if (!r || r.ok === false) { DESC._ctStatus = (r && r.erro) || 'Não consegui ler o contrato no Drive.'; if (!auto) mostrarToast(DESC._ctStatus); return false; }
    if (typeof invocarIAComFallback !== 'function') { DESC._ctStatus = 'Li o contrato, mas a IA não está disponível para montar a ficha.'; return false; }
    DESC._ctStatus = 'A IA está montando a ficha com o contrato e ' + (r.aditivos || []).filter(function (x) { return x.aplicado; }).length + ' aditivo(s)…'; ctAtualizarCaixa();
    await descCarregarFicha(true);
    var chaves = Object.keys(DESC_FICHA_PADRAO).filter(function (k) { return k !== 'ficha_conferida'; }).map(function (k) { return k + ' = ' + DESC_FICHA_PADRAO[k].rot; }).join('\n');
    var pr = 'Leia o contrato de gestão e os termos aditivos abaixo e preencha a ficha de parâmetros da unidade. O texto traz o contrato original e depois cada termo aditivo, em ordem de data; quando um aditivo mudar uma regra, vale o valor do aditivo mais recente. Use SOMENTE o que está escrito no texto; NÃO invente número de cláusula nem valor. Campo não encontrado: não inclua na resposta.\n' +
      'Campos possíveis (chave = significado):\n' + chaves + '\n' +
      'Responda APENAS com JSON válido: {"contrato":"nº do contrato ou null","campos":[{"chave":"uma das chaves acima","valor":"o valor como está no contrato","origem":"contrato ou nº do termo aditivo, anexo e cláusula de onde o valor foi tirado"}]}\n\nTEXTO:\n' + String(r.texto || '').slice(0, 150000);
    var resp = await invocarIAComFallback(pr, true), s = typeof resp === 'string' ? resp : JSON.stringify(resp);
    var m = /\{[\s\S]*\}/.exec(s.replace(/```json|```/g, '')); if (!m) throw new Error('resposta da IA fora do formato');
    var o = JSON.parse(m[0]), lista = Array.isArray(o.campos) ? o.campos : [], n = 0;
    lista.forEach(function (x) {
      var c = (DESC.fichaCampos || []).find(function (y) { return y.chave === x.chave; }); if (!c || x.valor === null || x.valor === undefined || x.valor === '') return;
      var igual = String(c.valor).trim() === String(x.valor).trim();
      c.valor = String(x.valor); c.origem = String(x.origem || ''); if (!igual) c.confirmado = 'nao'; n++;
    });
    if (o.contrato && !a.contrato) a.contrato = String(o.contrato);
    a.contrato_versao = String(r.versao || '').slice(0, 1900);
    a.texto_ficha_contrato = JSON.stringify((DESC.fichaCampos || []).filter(function (c) { return c.chave !== 'ficha_conferida'; }).map(function (c) { return { chave: c.chave, valor: c.valor, origem: c.origem, confirmado: c.confirmado }; }));
    DESC._fichaSuja = true; DESC._sujo = true;
    await descSalvarFichaContrato(true);
    DESC._ctStatus = (r.avisos && r.avisos.length ? r.avisos.join(' ') + ' ' : '') + (n ? n + ' campo(s) da ficha preenchido(s). A administração confere a ficha.' : 'A IA não encontrou os parâmetros no texto; a ficha ficou com os valores padrão.');
    if (!auto) mostrarToast(n ? 'Ficha montada com o contrato do Drive. Confira.' : 'Li o contrato, mas a IA não achou os parâmetros.');
    return true;
  } catch (e) { DESC._ctStatus = 'Não consegui montar a ficha: ' + (e.message || e); if (!auto) mostrarToast(DESC._ctStatus); return false; }
  finally { DESC._lendoContrato = false; ctAtualizarCaixa(); if (typeof descMudou === 'function' && DESC._sujo) { var sj = document.getElementById('d_sujo'); if (sj) sj.textContent = 'Alterações não salvas'; } }
}
