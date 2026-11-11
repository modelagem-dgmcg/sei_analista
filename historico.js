// historico.js — aba Histórico do Analista (tela + leitor dos pareceres). Carregado pelo index.html depois do descontos.js.
// ===== NÚCLEO DO HISTÓRICO: lê um parecer da CTAI (texto em blocos) e devolve os dados em tabela =====
// Entrada: blocos = [{t:'p', text}, {t:'tb', rows:[[células]]}]. Não usa IA: só regras sobre o modelo fixo do parecer.
var HIST_MESES = ['janeiro','fevereiro','marco','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
function hSemAcento(s) { return String(s === undefined || s === null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function hLimpa(s) { return String(s === undefined || s === null ? '' : s).replace(/\\([.\-_()#*])/g, '$1').replace(/\*\*/g, '').replace(/\s+/g, ' ').trim(); }
function hNum(s) {
  var t = String(s === undefined || s === null ? '' : s).replace(/R\$|%|\s/g, '');
  if (!/\d/.test(t)) return null;
  if (t.indexOf(',') > -1) t = t.replace(/\./g, '').replace(',', '.'); else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  var n = parseFloat(t); return isNaN(n) ? null : n;
}
function hMes(s) { var t = hSemAcento(s).toLowerCase().trim(); return HIST_MESES.indexOf(t) > -1 ? t : ''; }
function hStatus(s) {
  var t = hSemAcento(s).toLowerCase();
  if (/impossibilitad/.test(t)) return 'impossibilitado';
  if (/meta nao cumprida/.test(t)) return 'nao_cumprida';
  if (/meta cumprida/.test(t)) return 'cumprida';
  if (/^sem ocorrencia/.test(t.trim())) return 'sem_ocorrencia';
  return '';
}
function hMdParaBlocos(texto) {
  var blocos = [], atual = null;
  String(texto || '').split(/\r?\n/).forEach(function (l) {
    var t = l.trim();
    if (t.charAt(0) === '|') {
      if (/^\|[\s:\-|]+\|?$/.test(t)) return;
      var cel = t.replace(/^\|/, '').replace(/\|$/, '').split('|').map(hLimpa);
      if (!atual) { atual = { t: 'tb', rows: [] }; blocos.push(atual); }
      atual.rows.push(cel);
    } else { atual = null; if (t) blocos.push({ t: 'p', text: hLimpa(t.replace(/^#+\s*/, '')) }); }
  });
  return blocos;
}
function hHtmlParaBlocos(html) {
  var doc = new DOMParser().parseFromString(html, 'text/html'), blocos = [];
  Array.prototype.forEach.call(doc.body.children, function (el) {
    var tag = el.tagName.toLowerCase();
    if (tag === 'table') {
      var rows = Array.prototype.map.call(el.querySelectorAll('tr'), function (tr) { return Array.prototype.map.call(tr.children, function (td) { return hLimpa(td.textContent); }); });
      blocos.push({ t: 'tb', rows: rows });
    } else if (tag === 'ul' || tag === 'ol') { Array.prototype.forEach.call(el.querySelectorAll('li'), function (li) { var x = hLimpa(li.textContent); if (x) blocos.push({ t: 'p', text: x }); }); }
    else { var x = hLimpa(el.textContent); if (x) blocos.push({ t: 'p', text: x }); }
  });
  return blocos;
}
function hRowVazia(c) { return c.every(function (x) { return !x; }); }
function hNaoVazios(c) { return c.filter(function (x) { return x !== ''; }); }

function hLerQuadro(rows) {
  var saida = [], quadro = '', grupo = '', cab = null, atual = null, pend = '';
  var m0 = (rows[0] || []).filter(Boolean)[0] || ''; var mq = m0.match(/Quadro\s*0*(\d+)/i); quadro = mq ? mq[1] : '';
  rows.forEach(function (c) {
    var ne = hNaoVazios(c); if (!ne.length) return;
    var p = c[0] || '';
    if (/^Quadro\s*\d+/i.test(p) && ne.length === 1) return;
    if (ne.length === 1 && /^\d+\.\s/.test(p)) { grupo = /N[ãa]o valorad|Sem valora/i.test(p) ? 'nao_valorada' : /Qualitativ|Qualidade/i.test(p) ? 'qualidade' : /Quantitativ|Produ[çc]/i.test(p) ? 'producao' : grupo; return; }
    if (/^N\s*\.?\s*[º°o]\.?$/i.test(p)) { cab = c; return; }
    if (/^Objeto$/i.test(p)) { cab = c.slice(1); return; }
    if (/^\d+\.\d+$/.test(p) && /^Per[ií]odo$/i.test(c[1] || '')) { cab = ['Nº'].concat(c.slice(1)); pend = p; return; }
    if (!/^\d+\.\d+$/.test(p) && /^\d+\.\d+$/.test(c[1] || '') && hMes(c[2])) { c = c.slice(1); p = c[0]; }
    if (pend && hMes(p)) { c = [pend].concat(c); p = pend; pend = ''; }
    if (/^\d+\.\d+$/.test(p)) {
      var mes = hMes(c[1]);
      var iMeta = -1, iProd = -1, iPct = -1, iSt = -1;
      (cab || []).forEach(function (h, i) {
        if (/^Meta/i.test(h) && iMeta < 0) iMeta = i;
        if (/^Produ[çc][ãa]o (mensal|alcan)/i.test(hSemAcento(h) === h ? h : h) && iProd < 0) iProd = i;
        if (/^%\s*(trimestral|mensal)/i.test(h) && iPct < 0) iPct = i;
        if (/^Status/i.test(h) && iSt < 0) iSt = i;
      });
      var numerico = iMeta > -1 && iProd > -1 && hNum(c[iMeta]) !== null && /^\d/.test(String(c[iMeta]).replace(/\s/g, ''));
      var lin = { quadro: quadro, grupo: grupo, num: p, indicador: c[2] || '', mes: mes, meta: null, resultado: null, pct: null, status: '', detalhe: '', _numerico: numerico, _filhos: [] };
      if (numerico) { lin.meta = hNum(c[iMeta]); lin.resultado = hNum(c[iProd]); lin.pct = iPct > -1 ? hNum(c[iPct]) : null; lin.status = hStatus(iSt > -1 ? c[iSt] : ''); }
      else { var rest = c.slice(3).filter(Boolean); lin.detalhe = rest.map(function (x) { return x.length > 120 ? x.slice(0, 120) + '…' : x; }).join(' | ').slice(0, 400); var st = rest.map(hStatus).filter(Boolean); lin.status = st.length ? st[st.length - 1] : ''; var pc = rest.filter(function (x) { return /^\d+([.,]\d+)?%$/.test(x); }); lin.pct = pc.length ? hNum(pc[pc.length - 1]) : null; }
      atual = lin; saida.push(lin); return;
    }
    if (hMes(p) && atual) {
      var resto = c.slice(1).filter(Boolean);
      var lin2 = { quadro: quadro, grupo: grupo, num: atual.num, indicador: atual.indicador, mes: hMes(p), meta: null, resultado: null, pct: null, status: '', detalhe: '', _numerico: atual._numerico };
      if (atual._numerico) { lin2.meta = hNum(resto[0]); lin2.resultado = hNum(resto[1]); }
      else { lin2.detalhe = resto.map(function (x) { return x.length > 120 ? x.slice(0, 120) + '…' : x; }).join(' | ').slice(0, 400); var st2 = resto.map(hStatus).filter(Boolean); lin2.status = st2.length ? st2[st2.length - 1] : ''; var pc2 = resto.filter(function (x) { return /^\d+([.,]\d+)?%$/.test(x); }); lin2.pct = pc2.length ? hNum(pc2[pc2.length - 1]) : null; }
      saida.push(lin2);
    }
  });
  // numéricos: o % e a situação são do trimestre (aparecem só na 1ª linha): repete para os 3 meses
  var primeira = {};
  saida.forEach(function (l) { if (l._numerico && l.pct !== null && !primeira[l.num + '|' + l.quadro]) primeira[l.num + '|' + l.quadro] = { pct: l.pct, status: l.status }; });
  saida.forEach(function (l) { if (l._numerico) { var f = primeira[l.num + '|' + l.quadro]; if (f) { l.pct = f.pct; l.status = f.status; } } delete l._numerico; });
  return saida;
}
function hLerApontamento(rows, titulo) {
  var tipo = /Qualidade/i.test(titulo) ? 'qualidade' : /Produ[çc][ãa]o/i.test(titulo) ? 'producao' : '';
  var mt = String(titulo).match(/Tabela\s*0*(\d+)/i), tab = mt ? mt[1] : '';
  var itens = [], total = null, repasse = null, indic = '', iniciou = false;
  rows.forEach(function (c) {
    var p = c[0] || '', ne = hNaoVazios(c);
    var mr = p.match(/REPASSE MENSAL/i); if (mr && repasse === null) repasse = hNum(c[1]);
    if (/^INDICADOR$/i.test(p)) { iniciou = true; return; }
    if (!iniciou) return;
    if (/^TOTAL DE APONTAMENTO/i.test(p)) { total = hNum(c[1]); return; }
    var mes = hMes(p), tri = /^TRIMESTRE$/i.test(hSemAcento(p));
    if (mes || tri) { itens.push({ tabela: tab, tipo: tipo, indicador: indic, periodo: tri ? 'trimestre' : mes, pct_desconto: hNum(ne[1]), valor: hNum(ne[2]) }); }
    else if (ne.length >= 3) { indic = p; var per = hMes(c[1]) || (/TRIMESTRE/i.test(c[1]) ? 'trimestre' : hSemAcento(c[1]).toLowerCase()); itens.push({ tabela: tab, tipo: tipo, indicador: indic, periodo: per, pct_desconto: hNum(c[2]), valor: hNum(c[3]) }); }
  });
  return { tabela: tab, tipo: tipo, itens: itens, total: total, repasse: repasse };
}
function hLerTabela07(rows) {
  var r = { producao: null, qualidade: null, total: null };
  rows.forEach(function (c) { var p = hSemAcento(c[0] || '').toUpperCase(); if (p === 'PRODUCAO') r.producao = hNum(c[1]); else if (p === 'QUALIDADE') r.qualidade = hNum(c[1]); else if (p === 'TOTAL') r.total = hNum(c[1]); });
  return r;
}
function hLerParecer(blocos) {
  var ps = blocos.filter(function (b) { return b.t === 'p'; }).map(function (b) { return b.text; });
  var meta = { numero: '', ano_parecer: '', unidade: '', tipo_unidade: '', trimestre: '', ano: '', contrato: '', oss: '', repasse_mensal: null };
  var iT = -1; ps.some(function (t, i) { var m = t.match(/PARECER T[ÉE]CNICO(?:\s+[A-Z]{2,4})?\s+CTAI\s*N\s*\.?\s*[º°o]?\s*\.?\s*(\d+)\s*\/\s*(\d{4})/i) || t.match(/PARECER T[ÉE]CNICO\s*(?:[A-Z]{2,4}\s+)?N\s*\.?\s*[º°o]?\s*\.?\s*(\d+)\s*\/\s*(\d{4})/i); if (m) { meta.numero = m[1]; meta.ano_parecer = m[2]; iT = i; return true; } return false; });
  var iO = -1; for (var i = iT + 1; i < ps.length; i++) if (/^Objeto\s*:/i.test(ps[i])) { iO = i; break; }
  if (iT > -1 && iO > iT) {
    var cab = ps.slice(iT + 1, iO).join(' ');
    var mt = cab.match(/(\d)\s*[º°o]?\s*TRIMESTRE\s+DE\s+(\d{4})/i); if (mt) { meta.trimestre = mt[1]; meta.ano = mt[2]; }
    var un = cab.replace(/[-–—]?\s*\d\s*[º°o]?\s*TRIMESTRE\s+DE\s+\d{4}/i, '').replace(/\s+/g, ' ').trim().replace(/[-–—]\s*$/, '').trim();
    var partes = un.split(/\s[-–—]\s/); meta.unidade = hLimpa(/^UNIDADE\b/i.test(un) ? partes[partes.length - 1] : un);
  }
  if (!meta.trimestre) { var all = ps.slice(0, 8).join(' '); var m2 = all.match(/(\d)\s*[º°o]?\s*TRIMESTRE\s+DE\s+(\d{4})/i); if (m2) { meta.trimestre = m2[1]; meta.ano = m2[2]; } }
  var u = hSemAcento(meta.unidade).toUpperCase();
  meta.tipo_unidade = /^UPAE\b/.test(u) ? 'UPAE' : /^UPA\b/.test(u) ? 'UPA' : /HOSPITAL|^HOSP\b|HMV|HGV|HREC/.test(u) ? 'HOSPITAL' : 'OUTRO';
  var obj = iO > -1 ? ps[iO] : ps.slice(0, 12).join(' ');
  var mc = obj.match(/Contrato de Gest[ãa]o\s*n\s*\.?\s*[º°o]?\s*\.?\s*(\d{3}\/\d{4})/i); if (mc) meta.contrato = mc[1];
  ps.some(function (t) { var m = t.match(/^[-•\s]*Organiza[çc][ãa]o Social de Sa[úu]de(?:\s*\(OSS\))?\s*:\s*([^;]+?)\s*;?$/i); if (m) { meta.oss = hLimpa(m[1]); return true; } return false; });
  if (!meta.oss) { var mo = obj.match(/\(OSS\)\s+(.+?)(?:\.|$)/i); if (mo) meta.oss = hLimpa(mo[1]); }
  ps.some(function (t) { var m = t.match(/valor de repasse mensal atual [ée] de R\$\s*([\d.,]+)/i); if (m) { meta.repasse_mensal = hNum(m[1]); return true; } return false; });

  var resultados = [], apont = [], tab07 = null, totaisTab = [], repasseTab = null, ultimoP = '';
  blocos.forEach(function (b) {
    if (b.t === 'p') { ultimoP = b.text; return; }
    var rows = b.rows, primeira = (rows[0] || []).filter(Boolean)[0] || '';
    if (/^Quadro\s*\d+/i.test(primeira)) { hLerQuadro(rows).forEach(function (l) { resultados.push(l); }); return; }
    if (rows.some(function (c) { return /DESCONTOS TOTAIS/i.test(c[0] || ''); })) { tab07 = hLerTabela07(rows); return; }
    if (rows.some(function (c) { return /^INDICADOR$/i.test(c[0] || ''); })) {
      var a = hLerApontamento(rows, ultimoP); a.itens.forEach(function (x) { apont.push(x); }); totaisTab.push({ tabela: a.tabela, tipo: a.tipo, total: a.total, soma: a.itens.reduce(function (s, x) { return s + (x.valor || 0); }, 0) }); if (repasseTab === null) repasseTab = a.repasse;
    }
  });
  if (meta.repasse_mensal === null && repasseTab !== null) meta.repasse_mensal = repasseTab;

  var notas = [], secao = '', errCont = 0;
  ps.forEach(function (t) {
    var cabec = t.match(/^(\d{1,2})\.\s+\S/) && t.length < 170 && t.slice(0, 30) === t.slice(0, 30).toUpperCase() && /[A-ZÀ-Ú]{3}/.test(t);
    if (cabec) { secao = t.match(/^(\d{1,2})\./)[1]; return; }
    if (/^["“]?\s*\(?\.{0,3}\)?\s*Art\./i.test(t) || /^§/.test(t)) return;
    if (/^ERRATA\b/i.test(t) && t.length < 40) { errCont = 4; return; }
    if (errCont > 0 && t.length > 25) { errCont--; notas.push({ tipo: 'errata', texto: t.slice(0, 1200) }); return; }
    if (/\berrata\b|\bretifica(?:-se|mos|ç[ãa]o|r)\b/i.test(t) && t.length > 40) notas.push({ tipo: 'errata', texto: t.slice(0, 1200) });
    else if (/CTAI\s+notificar[áa]\s+a\s+contratada/i.test(t)) notas.push({ tipo: 'compensacao_15a', texto: t.slice(0, 1200) });
    else if (/gasto com pessoal/i.test(t) && /limite|70%|80%/i.test(t)) notas.push({ tipo: 'gasto_pessoal', texto: t.slice(0, 1200) });
    else if (secao === '8' && /^R\.\s/.test(t)) notas.push({ tipo: 'resposta_ctai', texto: t.slice(0, 1200) });
    else if (secao === '8' && /^0?\d{1,2}\.\s*\S/.test(t)) notas.push({ tipo: 'recomendacao_cma', texto: t.slice(0, 1200) });
    else if (secao === '8' && /^A CMA emitiu/i.test(t)) notas.push({ tipo: 'cma_sintese', texto: t.slice(0, 1200) });
    else if (secao === '9' && !/^Diante do exposto/i.test(t) && t.length > 30) notas.push({ tipo: 'orientacao_ctai', texto: t.slice(0, 1200) });
  });

  var soma = { producao: 0, qualidade: 0 };
  totaisTab.forEach(function (t) { if (t.tipo) soma[t.tipo] += (t.total !== null ? t.total : t.soma); });
  var prob = [];
  var tol = function (a, b) { return Math.abs((a || 0) - (b || 0)) <= 0.02; };
  if (!meta.numero) prob.push('Não achei o número do parecer.'); if (!meta.unidade) prob.push('Não achei o nome da unidade.'); if (!meta.trimestre) prob.push('Não achei o trimestre.');
  totaisTab.forEach(function (t) { if (t.total !== null && Math.abs(t.total - t.soma) > 0.035) prob.push('Tabela ' + t.tabela + ': soma das linhas (' + t.soma.toFixed(2) + ') difere do total da tabela (' + t.total.toFixed(2) + ').'); });
  if (tab07) {
    if (tab07.producao !== null && !tol(tab07.producao, soma.producao)) prob.push('Produção: soma dos apontamentos (' + soma.producao.toFixed(2) + ') difere da Tabela de totais (' + tab07.producao.toFixed(2) + ').');
    if (tab07.qualidade !== null && !tol(tab07.qualidade, soma.qualidade)) prob.push('Qualidade: soma dos apontamentos (' + soma.qualidade.toFixed(2) + ') difere da Tabela de totais (' + tab07.qualidade.toFixed(2) + ').');
  } else if (apont.length) prob.push('Não achei a tabela de totais dos descontos do parecer.');
  var totalParecer = tab07 && tab07.total !== null ? tab07.total : (soma.producao + soma.qualidade);
  return { meta: meta, resultados: resultados, apontamentos: apont, notas: notas, totais: { producao: tab07 ? tab07.producao : soma.producao, qualidade: tab07 ? tab07.qualidade : soma.qualidade, total: totalParecer, soma_producao: soma.producao, soma_qualidade: soma.qualidade },
    confere: prob.length === 0, estrutura_ok: !!(meta.numero && meta.unidade && meta.trimestre && meta.ano), problemas: prob, sem_desconto: apont.length === 0 };
}


// ===== TELA: Histórico dos pareceres da CTAI (banco) =====
var HIST = { aba: 'importar', fila: [], lista: [], carregou: false, filtro: { ano: '', tri: '', tipo: '', q: '' }, aberto: null, det: {}, salvando: false, anoCob: '' };
function hEsc(s) { return typeof escHtml === 'function' ? escHtml(s) : String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function hBrl(x) { var n = Number(x) || 0; return 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function hMesBonito(m) { var t = String(m || ''); if (t === 'trimestre') return 'Trimestre'; if (t === 'marco') t = 'março'; return t ? t.charAt(0).toUpperCase() + t.slice(1) : '—'; }
function hCartao(titulo, corpo) { return '<div style="background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:16px;margin-bottom:14px;box-shadow:0 1px 2px rgba(0,0,0,0.04);">' + (titulo ? '<h3 style="margin:0 0 12px;font-size:0.95rem;">' + hEsc(titulo) + '</h3>' : '') + corpo + '</div>'; }
function hEtq(txt, cor) { var c = { verde: ['#d1e7dd', '#0f5132'], verm: ['#f8d7da', '#842029'], amar: ['#fff3cd', '#664d03'], cinza: ['#e9ecef', '#495057'] }[cor || 'cinza']; return '<span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:0.72rem;font-weight:600;background:' + c[0] + ';color:' + c[1] + ';">' + hEsc(txt) + '</span>'; }
var HIST_STATUS = { cumprida: ['Cumprida', 'verde'], nao_cumprida: ['Não cumprida', 'verm'], impossibilitado: ['Impossibilitado de análise', 'amar'], sem_ocorrencia: ['Sem ocorrência', 'cinza'] };
var HIST_NOTAS = { errata: 'Errata (correção de parecer anterior)', compensacao_15a: 'Compensação (art. 15-A): unidade notificada', gasto_pessoal: 'Gasto com pessoal', recomendacao_cma: 'Recomendação da CMA', resposta_ctai: 'Resposta da CTAI à CMA', cma_sintese: 'Parecer da CMA sobre o trimestre anterior', orientacao_ctai: 'Orientação da CTAI à unidade' };

async function renderHistorico() {
  var c = document.getElementById('content'); if (!c) return;
  c.innerHTML = '<p style="color:#6c757d;">Carregando o histórico…</p>';
  var r = await api('historico/listar');
  if (!r || r.ok === false) { c.innerHTML = '<div style="background:#fff3cd;padding:14px;border-radius:6px;">Não consegui abrir o histórico: ' + hEsc((r && r.erro) || 'erro') + '. Se for a primeira vez, confira se o Code.gs e o Historico.gs foram colados e publicados em Nova versão.</div>'; return; }
  HIST.lista = r.pareceres || []; HIST.erratas = r.erratas || []; HIST.carregou = true; histDesenhar();
}
function histAbas() {
  var ab = [['importar', 'Importar pareceres', 'ti-upload'], ['consultar', 'Consultar', 'ti-search'], ['cobertura', 'O que já foi guardado', 'ti-grid-dots']];
  return '<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">' + ab.map(function (a) { return '<button class="btn btn-sm ' + (HIST.aba === a[0] ? 'btn-primary' : 'btn-secondary') + '" onclick="HIST.aba=\'' + a[0] + '\';histDesenhar()"><i class="ti ' + a[2] + '"></i> ' + a[1] + '</button>'; }).join('') + '</div>';
}
function histDesenhar() {
  var c = document.getElementById('content'); if (!c) return;
  var corpo = HIST.aba === 'importar' ? histHtmlImportar() : HIST.aba === 'consultar' ? histHtmlConsultar() : histHtmlCobertura();
  c.innerHTML = histAbas() + corpo;
}

// ---------- IMPORTAR ----------
function histHtmlImportar() {
  var caixa = hCartao('1. Solte os pareceres aqui', '<p style="margin:0 0 10px;font-size:0.85rem;color:#495057;">Arquivos Word (.docx) dos pareceres técnicos da CTAI, um ou vários de uma vez. O sistema lê as tabelas de resultados e de descontos, guarda tudo como foi emitido. Se a soma dos descontos não bater com o total do próprio parecer, isso fica sinalizado no banco (aba Consultar), junto com a errata de um parecer seguinte, se houver.</p>' +
    '<label style="display:block;border:2px dashed #adb5bd;border-radius:8px;padding:26px;text-align:center;cursor:pointer;background:#f8f9fa;" ondragover="event.preventDefault()" ondrop="event.preventDefault();histLer(event.dataTransfer.files)"><i class="ti ti-file-upload" style="font-size:1.6rem;"></i><div style="margin-top:6px;font-size:0.9rem;">Clique ou arraste os arquivos .docx (ou um .zip com eles)</div><input type="file" multiple accept=".docx,.md,.txt,.zip" style="display:none" onchange="histLer(this.files);this.value=\'\'"></label><div id="hist-prog" style="margin-top:8px;font-size:0.82rem;color:#6c757d;"></div>');
  if (!HIST.fila.length) return caixa;
  var existentes = {}; HIST.lista.forEach(function (p) { existentes[p.chave] = p; });
  var n = HIST.fila.filter(function (f) { return f.marcado; }).length;
  var cards = HIST.fila.map(function (f, i) {
    var r = f.r, m = r.meta, chave = [String(m.unidade).trim().toLowerCase(), Number(m.ano), Number(m.trimestre)].join('|');
    var jaTem = existentes[chave];
    var pe = r.problemas.filter(function (x) { return /^Não achei (o número|o nome|o trimestre)|^Este arquivo|^Não consegui/.test(x); });
    var prob = pe.length ? '<ul style="margin:6px 0 0 18px;padding:0;font-size:0.8rem;color:#842029;">' + pe.map(function (x) { return '<li>' + hEsc(x) + '</li>'; }).join('') + '</ul>' : '';
    return '<div style="border:1px solid ' + (r.estrutura_ok ? '#dee2e6' : '#f1aeb5') + ';border-radius:8px;padding:12px;margin-bottom:10px;background:' + (r.estrutura_ok ? '#fff' : '#fff8f8') + ';">' +
      '<div style="display:flex;gap:10px;align-items:flex-start;"><input type="checkbox" ' + (f.marcado ? 'checked' : '') + ' onchange="HIST.fila[' + i + '].marcado=this.checked;histDesenhar()" style="margin-top:4px;">' +
      '<div style="flex:1;min-width:0;"><div style="font-weight:700;">' + hEsc(m.unidade || '(unidade não encontrada)') + ' <span style="font-weight:400;color:#6c757d;">· ' + hEsc(m.trimestre || '?') + 'º trimestre de ' + hEsc(m.ano || '?') + ' · Parecer Técnico CTAI nº ' + hEsc(m.numero || '?') + '/' + hEsc(m.ano_parecer || '?') + '</span></div>' +
      '<div style="font-size:0.78rem;color:#6c757d;margin:2px 0 6px;">' + hEsc(m.tipo_unidade) + ' · Contrato de Gestão ' + hEsc(m.contrato || '—') + ' · ' + hEsc(m.oss || 'OSS não encontrada') + ' · arquivo ' + hEsc(f.nome) + '</div>' +
      '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">' + (r.estrutura_ok ? '' : hEtq('Não identifiquei o parecer', 'verm')) + (jaTem ? hEtq('Já está no banco — será substituído', 'amar') : '') + (r.sem_desconto ? hEtq('Sem desconto neste trimestre', 'cinza') : '') +
      '<span style="font-size:0.8rem;">Produção ' + hBrl(r.totais.producao) + ' · Qualidade ' + hBrl(r.totais.qualidade) + ' · <strong>Total ' + hBrl(r.totais.total) + '</strong></span></div>' + prob +
      '<div style="font-size:0.76rem;color:#6c757d;margin-top:6px;">' + r.resultados.length + ' linhas de resultado · ' + r.apontamentos.length + ' linhas de desconto · ' + r.notas.length + ' observações</div></div></div></div>';
  }).join('');
  var resumo = hCartao('2. Guarde no banco', cards + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button class="btn btn-primary" ' + (n && !HIST.salvando ? '' : 'disabled') + ' onclick="histGuardar()"><i class="ti ti-database-import"></i> Guardar ' + n + ' no banco</button><button class="btn btn-secondary" onclick="HIST.fila=[];histDesenhar()">Limpar lista</button><span id="hist-msg" style="font-size:0.84rem;"></span></div>');
  return caixa + resumo;
}
async function histLer(arquivos) {
  var lista = Array.prototype.slice.call(arquivos || []); if (!lista.length) return;
  var prog = function (t) { var e = document.getElementById('hist-prog'); if (e) e.textContent = t; };
  // zip: abre e usa só os .docx de dentro (ignora temporários e pastas)
  var expandida = [];
  for (var z = 0; z < lista.length; z++) {
    if (/\.zip$/i.test(lista[z].name) && typeof JSZip !== 'undefined') {
      prog('Abrindo ' + lista[z].name + '…');
      try {
        var zip = await JSZip.loadAsync(await lista[z].arrayBuffer());
        var nomes = Object.keys(zip.files).filter(function (n) { var b = n.split('/').pop(); return !zip.files[n].dir && /\.docx$/i.test(b) && b.indexOf('~$') !== 0; });
        for (var k = 0; k < nomes.length; k++) { var blob = await zip.files[nomes[k]].async('blob'); expandida.push(new File([blob], nomes[k].split('/').pop())); }
      } catch (e) { prog('Não consegui abrir o zip: ' + (e.message || e)); }
    } else expandida.push(lista[z]);
  }
  lista = expandida; if (!lista.length) { histDesenhar(); return; }
  for (var i = 0; i < lista.length; i++) {
    var f = lista[i]; prog('Lendo ' + (i + 1) + ' de ' + lista.length + ': ' + f.name + '…');
    try {
      var nome = f.name.toLowerCase(), blocos;
      if (/\.docx?$/.test(nome)) {
        if (typeof mammoth === 'undefined') throw new Error('A leitura de Word não está carregada nesta tela.');
        var res = await mammoth.convertToHtml({ arrayBuffer: await f.arrayBuffer() }); blocos = hHtmlParaBlocos(res.value);
      } else { blocos = hMdParaBlocos(await f.text()); }
      var r = hLerParecer(blocos);
      if (!r.meta.numero && !r.meta.unidade) { HIST.fila.push({ nome: f.name, r: { meta: r.meta, resultados: [], apontamentos: [], notas: [], totais: { producao: 0, qualidade: 0, total: 0 }, confere: false, problemas: ['Este arquivo não parece ser um parecer técnico da CTAI.'] }, marcado: false }); continue; }
      HIST.fila = HIST.fila.filter(function (x) { return x.nome !== f.name; });
      HIST.fila.push({ nome: f.name, r: r, marcado: !!r.estrutura_ok });
    } catch (e) { HIST.fila.push({ nome: f.name, r: { meta: { unidade: '', ano: '', trimestre: '' }, resultados: [], apontamentos: [], notas: [], totais: { producao: 0, qualidade: 0, total: 0 }, confere: false, problemas: ['Não consegui ler: ' + (e.message || e)] }, marcado: false }); }
  }
  prog(''); histDesenhar();
}
async function histGuardar() {
  if (HIST.salvando) return; var marc = HIST.fila.filter(function (f) { return f.marcado; }); if (!marc.length) return;
  HIST.salvando = true; histDesenhar();
  var msg = function (t, cor) { var e = document.getElementById('hist-msg'); if (e) { e.textContent = t; e.style.color = cor || '#495057'; } };
  var novos = 0, subst = 0, rej = [], falhou = false;
  for (var i = 0; i < marc.length; i += 1) {
    var lote = marc.slice(i, i + 1); msg('Guardando ' + (i + 1) + ' de ' + marc.length + ': ' + lote[0].nome + '…');
    var resp = await api('historico/importar', { pareceres: lote.map(function (f) { return Object.assign({}, f.r, { arquivo: f.nome }); }) }, { timeoutMs: 280000 });
    if (resp && resp.ok === false && /não respondeu/i.test(resp.erro || '')) { msg('Demorou; tentando de novo ' + (i + 1) + ' de ' + marc.length + '…'); resp = await api('historico/importar', { pareceres: lote.map(function (f) { return Object.assign({}, f.r, { arquivo: f.nome }); }) }, { timeoutMs: 280000 }); }
    if (!resp || resp.ok === false) { falhou = true; msg('Parou: ' + ((resp && resp.erro) || 'erro ao guardar') + '. O que já foi guardado continua no banco.', '#842029'); break; }
    novos += resp.novos; subst += resp.substituidos; (resp.rejeitados || []).forEach(function (x) { rej.push(x); });
    lote.forEach(function (f) { f.guardado = true; });
  }
  HIST.salvando = false;
  var l = await api('historico/listar'); if (l && l.pareceres) { HIST.lista = l.pareceres; HIST.erratas = l.erratas || []; }
  HIST.fila = HIST.fila.filter(function (f) { return !f.guardado; });
  histDesenhar();
  var e = document.getElementById('hist-msg'); if (e) { e.style.color = falhou ? '#842029' : '#0f5132'; e.textContent = falhou ? e.textContent : novos + ' novo(s), ' + subst + ' substituído(s)' + (rej.length ? ' · não guardados: ' + rej.join('; ') : '') + '.'; }
  if (!falhou) { var h = document.getElementById('hist-prog'); if (h) h.textContent = novos + ' novo(s) e ' + subst + ' substituído(s) guardados no banco.'; }
}

// ---------- CONSULTAR ----------
function histFiltrar() {
  var f = HIST.filtro, q = (f.q || '').toLowerCase();
  return HIST.lista.filter(function (p) { return (!f.ano || String(p.ano) === f.ano) && (!f.tri || String(p.trimestre) === f.tri) && (!f.tipo || p.tipo_unidade === f.tipo) && (!q || [p.unidade, p.contrato, p.oss, p.numero].join(' ').toLowerCase().indexOf(q) > -1); });
}
function histHtmlConsultar() {
  var anos = Array.from(new Set(HIST.lista.map(function (p) { return String(p.ano); }))).sort().reverse(), f = HIST.filtro;
  var sel = 'style="width:100%;padding:6px;border:1px solid #ced4da;border-radius:4px;"';
  var filtros = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:14px;">' +
    '<div style="width:110px;">' + dCampo('Ano', '<select onchange="HIST.filtro.ano=this.value;histDesenhar()" ' + sel + '><option value="">Todos</option>' + anos.map(function (a) { return '<option ' + (f.ano === a ? 'selected' : '') + '>' + a + '</option>'; }).join('') + '</select>') + '</div>' +
    '<div style="width:120px;">' + dCampo('Trimestre', '<select onchange="HIST.filtro.tri=this.value;histDesenhar()" ' + sel + '><option value="">Todos</option>' + [1, 2, 3, 4].map(function (t) { return '<option value="' + t + '" ' + (f.tri === String(t) ? 'selected' : '') + '>' + t + 'º</option>'; }).join('') + '</select>') + '</div>' +
    '<div style="width:130px;">' + dCampo('Tipo', '<select onchange="HIST.filtro.tipo=this.value;histDesenhar()" ' + sel + '><option value="">Todos</option>' + ['HOSPITAL', 'UPA', 'UPAE'].map(function (t) { return '<option ' + (f.tipo === t ? 'selected' : '') + '>' + t + '</option>'; }).join('') + '</select>') + '</div>' +
    '<div style="flex:1;min-width:180px;">' + dCampo('Buscar', '<input value="' + hEsc(f.q) + '" oninput="HIST.filtro.q=this.value;clearTimeout(window._hq);window._hq=setTimeout(histDesenhar,300)" placeholder="unidade, contrato, OSS ou nº do parecer" style="width:100%;padding:6px;border:1px solid #ced4da;border-radius:4px;">') + '</div></div>';
  var ls = histFiltrar().sort(function (a, b) { return (b.ano - a.ano) || (b.trimestre - a.trimestre) || String(a.unidade).localeCompare(String(b.unidade)); });
  if (!ls.length) return filtros + '<div style="background:#fff;border:1px dashed #ced4da;border-radius:8px;padding:30px;text-align:center;color:#6c757d;">Nenhum parecer guardado' + (HIST.lista.length ? ' com este filtro' : ' ainda. Use a aba <strong>Importar pareceres</strong>') + '.</div>';
  var tot = ls.reduce(function (s, p) { return s + (Number(p.desc_total) || 0); }, 0);
  var kpi = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;">' + [['Pareceres', ls.length], ['Total de descontos apontados', hBrl(tot)], ['Divergência de soma sem errata', ls.filter(function (p) { return histStatusSoma(p).cod === 'aberta'; }).length]].map(function (k) { return '<div style="background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:10px 16px;"><div style="font-size:0.72rem;color:#6c757d;">' + k[0] + '</div><div style="font-size:1.1rem;font-weight:700;">' + k[1] + '</div></div>'; }).join('') + '</div>';
  var linhas = ls.map(function (p) {
    var aberto = HIST.aberto === String(p.id);
    return '<tr style="cursor:pointer;" onclick="histAbrir(' + p.id + ')"><td><strong>' + hEsc(p.unidade) + '</strong><div style="font-size:0.72rem;color:#6c757d;">' + hEsc(p.tipo_unidade) + ' · C.G ' + hEsc(p.contrato || '—') + ' · ' + hEsc(p.oss || '') + '</div></td><td>' + p.ano + ' · ' + p.trimestre + 'º tri</td><td>nº ' + hEsc(p.numero) + '/' + hEsc(p.ano_parecer) + '</td><td style="text-align:right;">' + hBrl(p.desc_producao) + '</td><td style="text-align:right;">' + hBrl(p.desc_qualidade) + '</td><td style="text-align:right;font-weight:700;">' + hBrl(p.desc_total) + '</td><td>' + (function (s) { return hEtq(s.txt, s.cor) + (s.det ? '<div style="font-size:0.7rem;color:#6c757d;margin-top:2px;">' + hEsc(s.det) + '</div>' : ''); })(histStatusSoma(p)) + '</td></tr>' +
      (aberto ? '<tr><td colspan="7" style="background:#f8f9fa;">' + histHtmlDetalhe(String(p.id)) + '</td></tr>' : '');
  }).join('');
  return '<style>.hist-tab td,.hist-tab th{padding:8px;border-top:1px solid #eef0f2;vertical-align:top}.hist-tab tbody tr:hover{background:#f8f9fa}</style>' + filtros + kpi + '<div style="overflow-x:auto;background:#fff;border:1px solid #dee2e6;border-radius:8px;"><table class="hist-tab" style="width:100%;border-collapse:collapse;font-size:0.85rem;"><thead><tr style="text-align:left;"><th>Unidade</th><th>Período</th><th>Parecer CTAI</th><th style="text-align:right;">Produção</th><th style="text-align:right;">Qualidade</th><th style="text-align:right;">Total</th><th>Conferência</th></tr></thead><tbody>' + linhas + '</tbody></table></div>';
}
function histNormU(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }
// Situação da soma de um parecer: confere / divergência corrigida por errata de parecer seguinte / divergência sem errata
function histStatusSoma(p) {
  if (p.confere === 'sim') return { cod: 'ok', txt: 'Confere', cor: 'verde' };
  var un = histNormU(p.unidade), per = Number(p.ano) * 10 + Number(p.trimestre), num = String(p.numero || '').replace(/^0+/, '');
  var cand = (HIST.erratas || []).filter(function (e) { return histNormU(e.unidade) === un && (Number(e.ano) * 10 + Number(e.trimestre)) > per; });
  var casa = cand.filter(function (e) {
    var t = String(e.texto || ''), tl = t.toLowerCase();
    var porNum = num && (new RegExp('(^|\\D)0*' + num + '\\s*/\\s*' + (p.ano_parecer || '') + '|n[º°o.]*\\s*0*' + num + '(\\D|$)', 'i')).test(t);
    var porTri = new RegExp(p.trimestre + '\\s*[º°o]?\\s*trimestre', 'i').test(t) && (tl.indexOf(String(p.ano)) > -1 || true);
    return porNum || porTri;
  });
  if (casa.length) { var e = casa[0]; return { cod: 'corrigida', txt: 'Divergência corrigida por errata', cor: 'amar', det: 'errata no parecer nº ' + e.numero + '/' + e.ano_parecer + ' (' + e.trimestre + 'º tri ' + e.ano + ')' }; }
  if (cand.length) return { cod: 'aberta', txt: 'Divergência de soma', cor: 'verm', det: 'há errata posterior, mas não cita este parecer' };
  return { cod: 'aberta', txt: 'Divergência de soma', cor: 'verm', det: 'sem errata nos pareceres seguintes' };
}
async function histAbrir(id) {
  var k = String(id); if (HIST.aberto === k) { HIST.aberto = null; histDesenhar(); return; }
  HIST.aberto = k; if (!HIST.det[k]) { histDesenhar(); var r = await api('historico/obter', { id: id }); if (r && r.ok !== false) HIST.det[k] = r; }
  histDesenhar();
}
function histHtmlDetalhe(k) {
  var d = HIST.det[k]; if (!d) return '<p style="color:#6c757d;margin:6px;">Carregando…</p>';
  var ap = d.apontamentos.length ? '<table class="hist-tab" style="width:100%;border-collapse:collapse;font-size:0.82rem;"><thead><tr style="text-align:left;"><th>Tipo</th><th>Indicador</th><th>Período</th><th style="text-align:right;">% do repasse</th><th style="text-align:right;">Valor</th></tr></thead><tbody>' + d.apontamentos.map(function (a) { return '<tr><td>' + (a.tipo === 'qualidade' ? 'Qualidade' : 'Produção') + '</td><td>' + hEsc(a.indicador) + '</td><td>' + hEsc(hMesBonito(a.periodo)) + '</td><td style="text-align:right;">' + (a.pct_desconto === '' ? '—' : String(a.pct_desconto).replace('.', ',') + '%') + '</td><td style="text-align:right;">' + hBrl(a.valor) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p style="font-size:0.85rem;color:#6c757d;">Este parecer não apontou desconto.</p>';
  var por = {}; d.resultados.forEach(function (r) { var kk = r.quadro + '|' + r.num + '|' + r.indicador; (por[kk] = por[kk] || { r: r, st: {} }).st[r.status || '—'] = 1; });
  var prob = Object.keys(por).map(function (kk) { return por[kk]; }).filter(function (x) { return x.st.nao_cumprida || x.st.impossibilitado; });
  var res = prob.length ? '<ul style="margin:0 0 0 18px;padding:0;font-size:0.82rem;">' + prob.map(function (x) { var s = x.st.nao_cumprida ? HIST_STATUS.nao_cumprida : HIST_STATUS.impossibilitado; return '<li>' + hEsc(x.r.num + ' · ' + x.r.indicador) + ' ' + hEtq(s[0], s[1]) + '</li>'; }).join('') + '</ul>' : '<p style="font-size:0.85rem;color:#6c757d;">Nenhum indicador não cumprido ou impossibilitado de análise.</p>';
  var nt = d.notas.length ? d.notas.map(function (n) { return '<div style="font-size:0.82rem;margin-bottom:6px;"><strong>' + hEsc(HIST_NOTAS[n.tipo] || n.tipo) + ':</strong> ' + hEsc(n.texto) + '</div>'; }).join('') : '<p style="font-size:0.85rem;color:#6c757d;">Sem observações registradas.</p>';
  var rem = (typeof usuarioAtual !== 'undefined' && usuarioAtual && usuarioAtual.perfil === 'admin') ? '<button class="btn btn-sm btn-secondary" onclick="event.stopPropagation();histRemover(' + d.parecer.id + ')"><i class="ti ti-trash"></i> Remover do banco</button>' : '';
  return '<div onclick="event.stopPropagation()" style="padding:6px 4px;">' + (d.parecer.problemas ? '<div style="background:#f8d7da;color:#842029;padding:8px;border-radius:6px;font-size:0.82rem;margin-bottom:8px;">' + hEsc(d.parecer.problemas) + '</div>' : '') +
    '<h4 style="margin:6px 0;font-size:0.88rem;">Descontos apontados</h4>' + ap + '<h4 style="margin:12px 0 6px;font-size:0.88rem;">Indicadores não cumpridos ou impossibilitados de análise</h4>' + res + '<h4 style="margin:12px 0 6px;font-size:0.88rem;">Observações do parecer</h4>' + nt +
    '<div style="font-size:0.74rem;color:#6c757d;margin-top:8px;">Lido do arquivo ' + hEsc(d.parecer.arquivo) + ' por ' + hEsc(d.parecer.importado_por) + '. ' + rem + '</div></div>';
}
async function histRemover(id) {
  if (!confirm('Remover este parecer do banco? Os arquivos originais não são afetados.')) return;
  var r = await api('historico/remover', { id: id }); if (!r || r.ok === false) { alert((r && r.erro) || 'Não consegui remover.'); return; }
  HIST.aberto = null; var l = await api('historico/listar'); if (l && l.pareceres) { HIST.lista = l.pareceres; HIST.erratas = l.erratas || []; } histDesenhar();
}

// ---------- COBERTURA ----------
function histHtmlCobertura() {
  var anos = Array.from(new Set(HIST.lista.map(function (p) { return String(p.ano); }))).sort().reverse();
  if (!anos.length) return '<div style="background:#fff;border:1px dashed #ced4da;border-radius:8px;padding:30px;text-align:center;color:#6c757d;">Nada guardado ainda.</div>';
  var ano = HIST.anoCob && anos.indexOf(HIST.anoCob) > -1 ? HIST.anoCob : anos[0];
  var doAno = HIST.lista.filter(function (p) { return String(p.ano) === ano; }), un = {};
  doAno.forEach(function (p) { var u = un[p.unidade] = un[p.unidade] || { tipo: p.tipo_unidade, tri: {} }; u.tri[p.trimestre] = p; });
  var nomes = Object.keys(un).sort(function (a, b) { return (un[a].tipo + a).localeCompare(un[b].tipo + b); });
  var totTri = [0, 0, 0, 0], nTri = [0, 0, 0, 0];
  var linhas = nomes.map(function (n) { return '<tr><td><strong>' + hEsc(n) + '</strong> <span style="color:#6c757d;font-size:0.72rem;">' + hEsc(un[n].tipo) + '</span></td>' + [1, 2, 3, 4].map(function (t) { var p = un[n].tri[t]; if (!p) return '<td style="color:#adb5bd;text-align:center;">—</td>'; totTri[t - 1] += Number(p.desc_total) || 0; nTri[t - 1]++; return '<td style="text-align:center;' + (histStatusSoma(p).cod === 'aberta' ? 'background:#f8d7da;' : histStatusSoma(p).cod === 'corrigida' ? 'background:#fff3cd;' : '') + '">' + hBrl(p.desc_total) + '</td>'; }).join('') + '</tr>'; }).join('');
  var sel = '<select onchange="HIST.anoCob=this.value;histDesenhar()" style="padding:6px;border:1px solid #ced4da;border-radius:4px;">' + anos.map(function (a) { return '<option ' + (a === ano ? 'selected' : '') + '>' + a + '</option>'; }).join('') + '</select>';
  return '<style>.hist-tab td,.hist-tab th{padding:8px;border-top:1px solid #eef0f2}</style><div style="margin-bottom:12px;font-size:0.85rem;">Ano: ' + sel + ' &nbsp; Cada quadrinho mostra o valor total de desconto do parecer daquele trimestre. <span style="background:#f8d7da;padding:1px 6px;border-radius:3px;">Vermelho</span> = a soma dos descontos não bate com o total do parecer e nenhuma errata corrigiu. <span style="background:#fff3cd;padding:1px 6px;border-radius:3px;">Amarelo</span> = a soma não batia, mas um parecer seguinte trouxe errata. Quadrinho vazio = parecer ainda não carregado.</div>' +
    '<div style="overflow-x:auto;background:#fff;border:1px solid #dee2e6;border-radius:8px;"><table class="hist-tab" style="width:100%;border-collapse:collapse;font-size:0.85rem;"><thead><tr style="text-align:left;"><th>Unidade</th><th style="text-align:center;">1º tri</th><th style="text-align:center;">2º tri</th><th style="text-align:center;">3º tri</th><th style="text-align:center;">4º tri</th></tr></thead><tbody>' + linhas +
    '<tr style="font-weight:700;background:#f8f9fa;"><td>Pareceres guardados</td>' + nTri.map(function (n) { return '<td style="text-align:center;">' + n + '</td>'; }).join('') + '</tr><tr style="font-weight:700;background:#f8f9fa;"><td>Total de descontos</td>' + totTri.map(function (v) { return '<td style="text-align:center;">' + hBrl(v) + '</td>'; }).join('') + '</tr></tbody></table></div>';
}
