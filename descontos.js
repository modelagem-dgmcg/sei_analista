// descontos.js — aba Descontos do Analista (tela). Carregado pelo index.html depois do app.js.
// ===== NÚCLEO DO PROCESSO DE DESCONTOS (regras puras; mesmo texto no servidor e na tela) =====
var DESC_PARAMETROS_PADRAO = {
  dias_defesa:          { valor: '10', confirmado: 'sim', nota: 'Dias úteis para defesa da OSS após a ciência (mapa do processo e Módulo 3).' },
  dias_ciencia_presumida:{ valor: '5',  confirmado: 'nao', nota: 'Sem ciência expressa, conta-se a ciência a partir do 5º dia útil do envio. Base normativa ainda não localizada (pergunta ao jurídico).' },
  dias_ciencia_ata:     { valor: '5',  confirmado: 'nao', nota: 'Dias úteis de ciência após o envio da Ata. Base normativa a confirmar.' },
  dias_recurso:         { valor: '10', confirmado: 'nao', nota: 'Prazo para a OSS pedir recurso após ciência da Ata. VALOR PROVISÓRIO: confirmar no contrato/decreto.' },
  feriados_extras:      { valor: '',   confirmado: 'nao', nota: 'Datas AAAA-MM-DD separadas por vírgula (feriados estaduais, pontos facultativos). O sistema já usa os feriados nacionais e a Sexta-feira Santa.' },
  base_legal:           { valor: 'Lei Estadual nº 15.210/2013 e Decreto Estadual nº 58.200/2025', confirmado: 'sim', nota: 'Citada nos textos gerados. Conferir a cláusula do contrato de cada unidade.' },
  limiar_producao_pct:  { valor: '85', confirmado: 'sim', nota: 'Atingimento mínimo da meta de produção; abaixo disso há apontamento (art. 15-A da Lei 15.210/2013, como nas decisões já tomadas).' },
  trimestres_compensacao:{ valor: '2', confirmado: 'nao', nota: 'Prazo de compensação sugerido: fim do 2º trimestre seguinte (deduzido de um caso: 4º tri/2024 → 30/06/2025). Confirmar no contrato.' },
  tolerancia_externa_pct:{ valor: '5', confirmado: 'nao', nota: 'Diferença (%) aceita entre o valor informado e a fonte externa (CNES/SIH/SIA) antes de gerar alerta.' }
};
var DESC_DECISOES = ['', 'acatado', 'nao_acatado'];
var DESC_ETAPAS = [
  'Parecer da CTAI recebido', 'Triagem (há desconto?)', 'Notificação enviada à OSS', 'Prazo de defesa',
  'Pré-julgamento técnico (Grupo Técnico / CASSCG)', 'Julgamento pela Comissão', 'Ata revisada',
  'Ata enviada à OSS e processo à GAFCG', 'Recurso', 'Execução do desconto (GAOCG: LE/OB)'
];

function dParse(s) {
  if (s === null || s === undefined || s === '') return null;
  if (s instanceof Date) return isNaN(s) ? null : new Date(Date.UTC(s.getFullYear(), s.getMonth(), s.getDate()));
  var t = String(s).trim(), m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])) : null;
}
function dIso(d) { return d ? d.toISOString().slice(0, 10) : ''; }
function dBr(s) { var d = dParse(s); return d ? dIso(d).split('-').reverse().join('/') : ''; }
function dAdd(d, n) { return new Date(d.getTime() + n * 86400000); }
function pascoa(ano) {
  var a = ano % 19, b = Math.floor(ano / 100), c = ano % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451),
      mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}
function feriadosDoAno(ano) {
  var fixos = ['01-01', '04-21', '05-01', '09-07', '10-12', '11-02', '11-15', '12-25'];
  if (ano >= 2024) fixos.push('11-20'); // Consciência Negra, nacional desde a Lei 14.759/2023
  var r = fixos.map(function (x) { return ano + '-' + x; });
  r.push(dIso(dAdd(pascoa(ano), -2)));
  return r;
}
function montarFeriados(anoIni, anoFim, extras) {
  var set = {};
  for (var a = anoIni; a <= anoFim; a++) feriadosDoAno(a).forEach(function (x) { set[x] = 1; });
  String(extras || '').split(/[,;\s]+/).forEach(function (x) { var d = dParse(x); if (d) set[dIso(d)] = 1; });
  return set;
}
function ehUtil(d, set) { var w = d.getUTCDay(); return w !== 0 && w !== 6 && !set[dIso(d)]; }
// Soma n dias úteis a partir de uma data (o dia da data não conta; o 1º dia útil é o seguinte).
function somarUteis(iso, n, extras) {
  var d = dParse(iso); if (!d || !(n >= 0)) return '';
  var set = montarFeriados(d.getUTCFullYear(), d.getUTCFullYear() + 2, extras), c = 0;
  while (c < n) { d = dAdd(d, 1); if (ehUtil(d, set)) c++; }
  return dIso(d);
}
function fimTrimestre(ano, tri) { return ano + '-' + ['03-31', '06-30', '09-30', '12-31'][(+tri || 1) - 1]; }
function num(v) {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  var s = String(v === null || v === undefined ? '' : v).replace(/[R$\s]/g, '');
  if (!s) return 0;
  if (s.indexOf(',') > -1) s = s.replace(/\./g, '').replace(',', '.');
  var n = parseFloat(s); return isFinite(n) ? n : 0;
}
function r2(x) { return Math.round((x + 1e-9) * 100) / 100; }
function brl(x) { return 'R$ ' + r2(x).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function paramsMapa(linhas) {
  var m = {}; Object.keys(DESC_PARAMETROS_PADRAO).forEach(function (k) { m[k] = DESC_PARAMETROS_PADRAO[k].valor; });
  (linhas || []).forEach(function (l) { if (l && l.chave && l.valor !== '' && l.valor !== undefined) m[l.chave] = String(l.valor); });
  return m;
}

// Contas (modelo da ficha do AppSheet). Decisão por apontamento:
//   "acatado"     = a DEFESA da OSS foi acatada: o apontamento cai (valor acatado abate o desconto);
//   "nao_acatado" = a defesa não foi acatada (ou não houve): o apontamento é mantido.
// Efetivado = apontado − compensado dentro do prazo (só produção) − acatado. Sem decisão, conta cheio e fica pendente.
function calcularTotais(itens, hoje) {
  var t = { prod: { apontado: 0, compensado: 0, acatado: 0, efetivado: 0, pendentes: 0 }, qual: { apontado: 0, acatado: 0, efetivado: 0, pendentes: 0 }, linhas: [] };
  (itens || []).forEach(function (it) {
    var prod = it.tipo === 'producao', ap = num(it.valor_apontado), comp = prod ? num(it.valor_compensado) : 0, dec = it.decisao || '';
    var prazo = dParse(it.prazo_compensacao), dcomp = dParse(it.data_compensacao);
    var compValida = comp > 0 && (!prazo || !dcomp || dcomp <= prazo) ? Math.min(comp, ap) : 0;
    var compForaPrazo = comp > 0 && prazo && dcomp && dcomp > prazo;
    var base = r2(ap - compValida), acat = 0;
    if (dec === 'acatado') acat = (it.valor_acatado !== undefined && it.valor_acatado !== '' && it.valor_acatado !== null) ? Math.min(num(it.valor_acatado), base) : base;
    var ef = r2(base - acat);
    var vencido = prod && prazo && hoje && dParse(hoje) > prazo && base > 0;
    var g = prod ? t.prod : t.qual;
    g.apontado += ap; g.acatado += acat; g.efetivado += ef; if (!dec) g.pendentes++;
    if (prod) g.compensado += compValida;
    t.linhas.push({ efetivado: ef, acatado: r2(acat), comp_valida: r2(compValida), comp_fora_prazo: !!compForaPrazo, fora_prazo_compensacao: !!vencido });
  });
  ['prod', 'qual'].forEach(function (k) { Object.keys(t[k]).forEach(function (f) { if (f !== 'pendentes') t[k][f] = r2(t[k][f]); }); });
  t.apontado = r2(t.prod.apontado + t.qual.apontado);
  t.efetivado = r2(t.prod.efetivado + t.qual.efetivado);
  t.pct_qualidade_sobre_producao = t.prod.apontado > 0 ? r2(t.qual.apontado / t.prod.apontado * 100) : null;
  return t;
}
// Produção: percentual do trimestre a partir dos meses informados e da meta (ou o % que consta no parecer).
function percProducao(it) {
  var m = [it.realizado_1, it.realizado_2, it.realizado_3].map(function (x) { return (x === '' || x === undefined || x === null) ? null : num(x); });
  var temMeses = m.every(function (x) { return x !== null; }), soma = temMeses ? m[0] + m[1] + m[2] : null, meta = num(it.meta_trimestre);
  var calc = (temMeses && meta > 0) ? r2(soma / meta * 100) : null;
  var parecer = (it.pct_parecer === '' || it.pct_parecer === undefined || it.pct_parecer === null) ? null : num(it.pct_parecer);
  return { meses: m, soma: soma, meta: meta || null, calculado: calc, parecer: parecer, pct: calc !== null ? calc : parecer, diverge: calc !== null && parecer !== null && Math.abs(calc - parecer) > 0.1 };
}
function prazoCompensacaoSugerido(ano, tri, n) {
  var idx = (+ano) * 4 + (+tri - 1) + (+n || 2), a = Math.floor(idx / 4), q = idx % 4 + 1;
  return fimTrimestre(a, q);
}
var DESC_MESES = [['janeiro', 'fevereiro', 'março'], ['abril', 'maio', 'junho'], ['julho', 'agosto', 'setembro'], ['outubro', 'novembro', 'dezembro']];

function calcularPrazos(rec, pm) {
  var ex = pm.feriados_extras, p = {};
  p.ciencia = rec.ciencia_data ? dIso(dParse(rec.ciencia_data)) : '';
  p.ciencia_presumida = false;
  if (!p.ciencia && rec.notificacao_envio) { p.ciencia = somarUteis(rec.notificacao_envio, +pm.dias_ciencia_presumida, ex); p.ciencia_presumida = true; }
  p.prazo_defesa = p.ciencia ? somarUteis(p.ciencia, +pm.dias_defesa, ex) : '';
  p.ciencia_ata = rec.ata_ciencia_data ? dIso(dParse(rec.ata_ciencia_data)) : '';
  p.ciencia_ata_presumida = false;
  if (!p.ciencia_ata && rec.ata_envio_oss) { p.ciencia_ata = somarUteis(rec.ata_envio_oss, +pm.dias_ciencia_ata, ex); p.ciencia_ata_presumida = true; }
  p.prazo_recurso = p.ciencia_ata ? somarUteis(p.ciencia_ata, +pm.dias_recurso, ex) : '';
  p.fim_trimestre = rec.ano && rec.trimestre ? fimTrimestre(+rec.ano, +rec.trimestre) : '';
  p.dias_ate_notificacao = (p.fim_trimestre && rec.notificacao_envio) ? Math.round((dParse(rec.notificacao_envio) - dParse(p.fim_trimestre)) / 86400000) : null;
  return p;
}
function sim(v) { return String(v || '').toLowerCase() === 'sim'; }
function nao(v) { return String(v || '').toLowerCase() === 'nao' || String(v || '').toLowerCase() === 'não'; }

function calcularFicha(rec, itens, pm, hoje, fm) {
  hoje = hoje || dIso(new Date());
  var t = calcularTotais(itens, hoje), p = calcularPrazos(rec, pm), H = dParse(hoje);
  var revisada = sim(rec.ata_revisada) || ((itens || []).length > 0 && (itens || []).every(function (x) { return sim(x.julgamento_revisado); }));
  var semDesconto = t.apontado === 0 && (itens || []).length === 0 ? null : t.apontado === 0;
  var prazoDefesaVencido = p.prazo_defesa && H > dParse(p.prazo_defesa);
  var temDefesa = sim(rec.defesa), semDefesa = nao(rec.defesa);
  var etapas = [
    { n: DESC_ETAPAS[0], feito: !!(rec.parecer_data || rec.parecer_sei) },
    { n: DESC_ETAPAS[1], feito: (itens || []).length > 0 },
    { n: DESC_ETAPAS[2], feito: !!rec.notificacao_envio, pula: semDesconto === true },
    { n: DESC_ETAPAS[3], feito: temDefesa || semDefesa || !!prazoDefesaVencido, pula: semDesconto === true },
    { n: DESC_ETAPAS[4], feito: !!rec.grupo_tecnico_data, pula: semDesconto === true || semDefesa },
    { n: DESC_ETAPAS[5], feito: !!rec.comissao_data, pula: semDesconto === true },
    { n: DESC_ETAPAS[6], feito: revisada, pula: semDesconto === true },
    { n: DESC_ETAPAS[7], feito: !!(rec.ata_envio_oss && rec.envio_gafcg), pula: semDesconto === true },
    { n: DESC_ETAPAS[8], feito: nao(rec.recurso) || !!rec.recurso_decisao_data || (!sim(rec.recurso) && !!p.prazo_recurso && H > dParse(p.prazo_recurso)), pula: semDesconto === true },
    { n: DESC_ETAPAS[9], feito: !!rec.execucao_data, pula: semDesconto === true }
  ];
  var prox = '';
  if (semDesconto === true && rec.situacao !== 'encerrado') prox = 'Sem desconto apontado: registrar e encerrar';
  else if (rec.situacao === 'encerrado') prox = 'Encerrado';
  else {
    var ini = 0; // se uma etapa posterior já foi cumprida, as anteriores são tidas como feitas (registros antigos)
    for (var k = etapas.length - 1; k >= 0; k--) { if (etapas[k].feito && !etapas[k].pula && k !== 1) { ini = k + 1; break; } }
    for (var i = ini; i < etapas.length; i++) {
      if (etapas[i].pula || etapas[i].feito) continue;
      var e = etapas[i].n;
      if (i === 0) prox = 'Registrar o parecer da CTAI';
      else if (i === 1) prox = 'Lançar os apontamentos do parecer';
      else if (i === 2) prox = 'Notificar a OSS' + (sim(rec.base_legal_conferida) ? '' : ' (conferir antes a base legal vigente)');
      else if (i === 3) prox = 'Aguardar defesa até ' + dBr(p.prazo_defesa);
      else if (i === 4) prox = 'Pré-julgamento técnico da defesa (Grupo Técnico / CASSCG)';
      else if (i === 5) prox = 'Levar à Comissão de Julgamento';
      else if (i === 6) prox = 'Aguardar revisão da Ata';
      else if (i === 7) prox = 'Enviar a Ata à OSS e o processo à GAFCG';
      else if (i === 8) prox = p.prazo_recurso ? 'Aguardar prazo de recurso até ' + dBr(p.prazo_recurso) : 'Registrar a ciência da Ata pela OSS';
      else if (i === 9) prox = 'Acompanhar a execução (LE/OB) com a GAOCG';
      if (i === 8 && sim(rec.recurso) && !rec.recurso_decisao_data) prox = 'Analisar o recurso e decidir';
      break;
    }
    if (!prox) prox = 'Encerrar o registro';
  }
  var alertas = [];
  function A(nivel, msg) { alertas.push({ nivel: nivel, msg: msg }); }
  t.linhas.forEach(function (l, i) {
    var it = itens[i];
    if (l.fora_prazo_compensacao) A('erro', 'Fora do prazo de compensação: ' + (it.indicador || 'apontamento de produção') + ' (prazo ' + dBr(it.prazo_compensacao) + ').');
    if (l.comp_fora_prazo) A('aviso', 'Compensação de "' + (it.indicador || 'produção') + '" feita depois do prazo; não foi abatida do valor.');
  });
  var lim = (fm && +fm.piso_producao_pct) || +pm.limiar_producao_pct || 85;
  if (fm && (itens || []).length && String(fm.ficha_conferida) !== 'sim') A('aviso', 'Ficha do contrato da unidade ainda não conferida: o piso de ' + lim + '% e os demais valores podem não ser os deste contrato (passo "Contrato e aditivos").');
  (itens || []).forEach(function (it) {
    if (it.tipo !== 'producao') return;
    var pp = percProducao(it);
    if (pp.pct !== null && pp.pct >= lim) A('erro', 'Apontamento de produção "' + (it.indicador || '') + '" com atingimento de ' + pp.pct + '% (meta mínima ' + lim + '%): conferir o parecer, o apontamento pode estar indevido.');
    if (pp.diverge) A('aviso', 'Produção "' + (it.indicador || '') + '": o percentual calculado (' + pp.calculado + '%) difere do que consta no parecer (' + pp.parecer + '%).');
  });
  if (rec.notificacao_envio && !sim(rec.base_legal_conferida)) A('aviso', 'Base legal da notificação não marcada como conferida com o contrato vigente.');
  if (p.ciencia_presumida) A('info', 'Prazo de defesa contado a partir de ciência presumida (' + dBr(p.ciencia) + '): sem ciência expressa da unidade.');
  if (prazoDefesaVencido && !temDefesa && !semDefesa && rec.notificacao_envio) A('aviso', 'Prazo de defesa venceu em ' + dBr(p.prazo_defesa) + ' e não há registro se houve defesa.');
  if (p.dias_ate_notificacao !== null && p.dias_ate_notificacao > 180) A('info', 'Notificação enviada ' + p.dias_ate_notificacao + ' dias depois do fim do trimestre.');
  if (t.apontado > 0 && !rec.sei_processo) A('aviso', 'Falta o número do processo SEI.');
  if (!rec.contrato) A('info', 'Falta o número do contrato de gestão (C.G).');
  if (t.prod.pendentes + t.qual.pendentes > 0 && (rec.comissao_data || revisada)) A('erro', 'Há apontamentos sem decisão (acatado / não acatado) e o julgamento já foi registrado.');
  if (rec.ata_envio_oss && !revisada) A('aviso', 'Ata enviada à OSS sem a revisão do julgamento marcada.');
  if (sim(rec.recurso) && !sim(rec.defesa) && !rec.recurso_decisao_data) A('info', 'Recurso registrado sem defesa prévia: conferir se cabe.');
  if (sim(rec.recurso) && rec.recurso_data && p.prazo_recurso && dParse(rec.recurso_data) > dParse(p.prazo_recurso)) A('aviso', 'Recurso apresentado depois do prazo (' + dBr(p.prazo_recurso) + ').');
  if (t.efetivado > 0 && rec.ata_envio_oss && !rec.execucao_data) A('info', 'Desconto de ' + brl(t.efetivado) + ' ainda sem registro de execução (LE/OB).');
  return { totais: t, prazos: p, etapas: etapas, proxima_acao: prox, alertas: alertas, a_descontar: t.efetivado };
}

// Compara o valor informado/apontado com a fonte externa (CNES, SIH, SIA).
function compararExterno(valorInformado, valorReferencia, tolPct) {
  var a = num(valorInformado), b = num(valorReferencia);
  if (valorReferencia === '' || valorReferencia === null || valorReferencia === undefined) return { ok: null, msg: 'Sem referência externa.' };
  var dif = a - b, pct = b !== 0 ? Math.abs(dif) / Math.abs(b) * 100 : (a === 0 ? 0 : 100);
  var ok = pct <= (+tolPct || 5);
  return { ok: ok, dif: r2(dif), pct: r2(pct), msg: ok ? 'Confere com a fonte externa (diferença de ' + r2(pct) + '%).' : 'Diverge da fonte externa em ' + r2(pct) + '% (informado ' + a + ', referência ' + b + ').' };
}

// ===== Textos (rascunhos para o servidor revisar; o que falta fica entre colchetes) =====
function _v(x, rot) { return (x === '' || x === null || x === undefined) ? '[' + rot + ']' : x; }
function _trimLabel(rec) { return _v(rec.trimestre, 'trimestre') + 'º trimestre de ' + _v(rec.ano, 'ano'); }
function _listaItens(itens, tipo, calc, comFundamento) {
  var out = [];
  (itens || []).forEach(function (it, i) {
    if (it.tipo !== tipo) return;
    var l = calc.totais.linhas[i];
    var dec = it.decisao === 'acatado' ? 'defesa acatada (apontamento afastado)' : it.decisao === 'nao_acatado' ? 'defesa não acatada (apontamento mantido)' : '[decisão pendente]';
    var s = '- ' + _v(it.indicador, 'indicador') + ': valor apontado ' + brl(num(it.valor_apontado));
    if (tipo === 'producao' && num(it.valor_compensado) > 0) s += '; compensado ' + brl(l.comp_valida) + (l.comp_fora_prazo ? ' (fora do prazo, não considerado)' : '');
    s += '; ' + dec + '; valor a descontar ' + brl(l.efetivado) + '.';
    if (comFundamento) {
      if (it.justificativa_decisao) s += '\n  ' + it.justificativa_decisao;
      if (it.resumo_defesa) s += '\n  Resumo do Recurso: ' + it.resumo_defesa;
      if (it.analise_tecnica) s += '\n  Análise Técnica e Probatória: ' + it.analise_tecnica;
      if (it.fundamentacao_juridica) s += '\n  Fundamentação Jurídica e Contratual: ' + it.fundamentacao_juridica;
    }
    out.push(s);
  });
  return out.length ? out.join('\n') : '- Nenhum apontamento.';
}
function gerarNotificacao(rec, itens, calc, pm) {
  var t = calc.totais;
  return [
    'NOTIFICAÇÃO Nº [número] — ' + _v(rec.unidade, 'unidade'),
    '',
    'Ao(À) ' + _v(rec.sigla_oss, 'OSS') + ', responsável pela gestão de ' + _v(rec.unidade, 'unidade') + ' (Contrato de Gestão nº ' + _v(rec.contrato, 'C.G') + ').',
    '',
    'Assunto: apontamentos de desempenho do ' + _trimLabel(rec) + ' — oportunidade de defesa.',
    '',
    'Com fundamento em ' + pm.base_legal + ' e nas cláusulas do Contrato de Gestão [conferir a base legal vigente na versão atual do contrato], e com base no ' + _refParecer(rec) + ', ficam notificadas as seguintes metas não cumpridas:',
    '',
    'Produção:', _listaItens(itens, 'producao', calc),
    '',
    'Qualidade:', _listaItens(itens, 'qualidade', calc),
    '',
    'Valor total apontado: ' + brl(t.apontado) + '.',
    '',
    'A OSS dispõe de ' + pm.dias_defesa + ' dias úteis, contados da ciência desta notificação, para apresentar defesa técnica, com os documentos que a sustentem. Prazo final estimado: ' + _v(dBr(calc.prazos.prazo_defesa), 'a calcular após a data de envio') + '.',
    'Metas de produção podem ser compensadas dentro do prazo contratual de compensação.',
    '',
    'Recife, ' + dBr(dIso(new Date())) + '.',
    '[Assinatura e cargo]'
  ].join('\n');
}
function gerarAta(rec, itens, calc, pm) {
  var t = calc.totais;
  return [
    'ATA DE JULGAMENTO DE DESCONTOS — ' + _v(rec.unidade, 'unidade') + ' — ' + _trimLabel(rec),
    '',
    'Processo SEI nº ' + _v(rec.sei_processo, 'nº do processo') + ' | Contrato de Gestão nº ' + _v(rec.contrato, 'C.G') + ' | OSS: ' + _v(rec.sigla_oss, 'OSS'),
    '',
    '1. Do procedimento',
    'Em ' + _v(dBr(rec.comissao_data), 'data da reunião') + ', reuniu-se a Comissão de Julgamento dos Descontos [composição conforme ato de designação: conferir] para deliberar sobre os apontamentos constantes do ' + _refParecer(rec) + ', nos termos de ' + pm.base_legal + '.',
    'A OSS foi notificada em ' + _v(dBr(rec.notificacao_envio), 'data da notificação') + ' e o prazo de defesa terminou em ' + _v(dBr(calc.prazos.prazo_defesa), 'prazo') + '. ' +
      (sim(rec.defesa) ? 'Foi apresentada defesa em ' + _v(dBr(rec.defesa_data), 'data da defesa') + ', analisada pelo Grupo Técnico de Avaliação em ' + _v(dBr(rec.grupo_tecnico_data), 'data') + '.' : nao(rec.defesa) ? 'Não foi apresentada defesa no prazo.' : '[informar se houve defesa]'),
    '',
    '2. Das decisões',
    'Produção:', _listaItens(itens, 'producao', calc, true),
    '',
    'Qualidade:', _listaItens(itens, 'qualidade', calc, true),
    '',
    '3. Do resumo',
    'Produção — apontado ' + brl(t.prod.apontado) + '; compensado ' + brl(t.prod.compensado) + '; defesas acatadas ' + brl(t.prod.acatado) + '; efetivado ' + brl(t.prod.efetivado) + '.',
    'Qualidade — apontado ' + brl(t.qual.apontado) + '; defesas acatadas ' + brl(t.qual.acatado) + '; efetivado ' + brl(t.qual.efetivado) + '.',
    'Valor total a ser descontado: ' + brl(t.efetivado) + '.',
    '',
    '4. Dos encaminhamentos',
    'Encaminhe-se a Ata à OSS, para ciência e eventual recurso no prazo de ' + pm.dias_recurso + ' dias úteis [prazo a confirmar], e o processo à GAFCG para as providências de execução do desconto.',
    '',
    'Recife, ' + dBr(dIso(new Date())) + '.',
    '[Assinaturas dos membros da Comissão]'
  ].join('\n');
}
function gerarAnaliseRecurso(rec, itens, calc, pm) {
  var t = calc.totais;
  return [
    'ANÁLISE DE RECURSO — ' + _v(rec.unidade, 'unidade') + ' — ' + _trimLabel(rec),
    '',
    'Processo SEI nº ' + _v(rec.sei_processo, 'nº do processo') + ' | Contrato de Gestão nº ' + _v(rec.contrato, 'C.G') + ' | OSS: ' + _v(rec.sigla_oss, 'OSS'),
    '',
    '1. Do histórico',
    'Ata de julgamento enviada à OSS em ' + _v(dBr(rec.ata_envio_oss), 'data') + ' (ciência ' + (calc.prazos.ciencia_ata_presumida ? 'presumida' : 'registrada') + ' em ' + _v(dBr(calc.prazos.ciencia_ata), 'data') + '). Prazo para recurso até ' + _v(dBr(calc.prazos.prazo_recurso), 'prazo') + '. Recurso apresentado em ' + _v(dBr(rec.recurso_data), 'data do recurso') + (rec.recurso_data && calc.prazos.prazo_recurso ? (dParse(rec.recurso_data) <= dParse(calc.prazos.prazo_recurso) ? ' (tempestivo).' : ' (INTEMPESTIVO).') : '.'),
    '',
    '2. Dos argumentos da OSS',
    '[resumir os argumentos do recurso, ponto a ponto]',
    '',
    '3. Da análise por apontamento',
    'Produção:', _listaItens(itens, 'producao', calc),
    '',
    'Qualidade:', _listaItens(itens, 'qualidade', calc),
    '[para cada apontamento: argumento da OSS, evidência apresentada, conferência com a fonte (relatório, CNES, SIH/SIA), conclusão]',
    '',
    '4. Da conclusão',
    'Valor a descontar antes do recurso: ' + brl(t.efetivado) + '. [Valor após o recurso: ______ ]',
    '[Decisão: manter / reformar a Ata, com fundamento em ' + pm.base_legal + ']',
    '',
    'Recife, ' + dBr(dIso(new Date())) + '.',
    '[Assinatura e cargo]'
  ].join('\n');
}

// ===== ANÁLISE AUTOMÁTICA DA DECISÃO (rascunho por regras, com base nas decisões já tomadas; o servidor confere e decide) =====
var DESC_BASE_JURIDICA = {
  producao_meta: 'A decisão fundamenta-se no artigo 10, inciso IV, e no artigo 15-A da Lei Estadual nº 15.210/2013, que vinculam os repasses financeiros ao alcance das metas pactuadas e disciplinam a compensação por produção excedente em caso de atingimento inferior a 85%.',
  prestacao_contas: 'A deliberação apoia-se no artigo 14, inciso I, e no artigo 18, inciso III, da Lei Estadual nº 15.210/2013, que impõem a prestação de contas mensal e cominam a sanção de multa e desconto por inexecução de obrigações contratuais.',
  comprovacao: 'A fundamentação jurídico-formal assenta-se no artigo 14, inciso II, e no artigo 18, inciso III, da Lei Estadual nº 15.210/2013, que estabelecem o dever de comprovação idônea dos resultados do contrato de gestão. Adicionalmente, fundamenta-se nos artigos 38, 47 e 49 do Decreto Estadual nº 58.200/2025, bem como na Cláusula [conferir: Décima Sexta no CG 024/2022] e na Tabela do Anexo Técnico II do Contrato de Gestão nº [C.G], que determinam a glosa direta na parcela variável em face do não envio ou envio ilegível de comprovantes das metas de qualidade.',
  qualidade_geral: 'A decisão fundamenta-se no artigo 18, inciso III, da Lei Estadual nº 15.210/2013 e nas cláusulas e no Anexo Técnico do Contrato de Gestão nº [C.G] [conferir os dispositivos aplicáveis a este indicador].'
};
function classificarIndicador(it) {
  var n = String(it.indicador || '').toLowerCase();
  if (it.tipo === 'producao') return 'producao_meta';
  if (/presta[cç][aã]o de contas|relat[oó]rio/.test(n)) return 'prestacao_contas';
  if (/educa[cç][aã]o permanente|comprova|ileg[ií]vel|document/.test(n)) return 'comprovacao';
  return 'qualidade_geral';
}
function _nomeOss(rec) { var n = String(rec.nome_oss || '').trim(), g = String(rec.sigla_oss || '').trim(); return n ? n + (g ? ' (' + g + ')' : '') : _v(g, 'OSS'); }
function _unidadeMedida(it) { var w = String(it.indicador || '').trim().split(/\s+/)[0].toLowerCase(); return /^(saídas|saidas|consultas|cirurgias|atendimentos|exames|partos|procedimentos|internações|internacoes)$/.test(w) ? w : 'registros'; }
function _refParecer(rec) { return 'Parecer Técnico CTAI nº ' + _v(rec.parecer_numero, 'nº do parecer') + (rec.parecer_sei ? ' (documento SEI ' + rec.parecer_sei + ')' : ''); }
function sugerirDecisao(rec, it, pm, hoje, fm) {
  var p = calcularPrazos(rec, pm), regra = classificarIndicador(it), av = [], sigla = _nomeOss(rec), tri = _trimLabel(rec);
  var temDefesa = sim(rec.defesa), semDefesa = nao(rec.defesa), r = { regra: regra, decisao: '', abertura: '', resumo: '', analise: '', juridica: DESC_BASE_JURIDICA[regra], avisos: av };
  if (!temDefesa && !semDefesa) { av.push('Informe na ficha se a OSS apresentou defesa; sem isso a decisão não pode ser sugerida.'); return r; }
  var pp = it.tipo === 'producao' ? percProducao(it) : null, lim = (fm && +fm.piso_producao_pct) || +pm.limiar_producao_pct || 85;
  if (fm && String(fm.ficha_conferida) !== 'sim') av.push('A ficha do contrato desta unidade ainda não foi conferida (passo 2): os valores usados podem não ser os deste contrato.');
  if (pp && pp.pct !== null && pp.pct >= lim) av.push('O atingimento (' + pp.pct + '%) está igual ou acima de ' + lim + '%: o apontamento parece indevido. Confira o parecer antes de decidir.');
  var base = r2(num(it.valor_apontado) - (it.tipo === 'producao' ? num(it.valor_compensado) : 0));
  if (it.tipo === 'producao' && num(it.valor_compensado) > 0) av.push('Há compensação informada; o valor a descontar considera só a compensação feita dentro do prazo.');
  // --- sem defesa ---
  if (semDefesa) {
    r.decisao = av.some(function (x) { return /parece indevido/.test(x); }) ? '' : 'nao_acatado';
    r.abertura = 'Defesa administrativa não encaminhada.';
    r.resumo = it.tipo === 'producao'
      ? 'A Organização Social de Saúde (OSS) ' + sigla + ' não encaminhou defesa administrativa ou recurso tempestivo referente ao não atingimento da meta apontada pela comissão no ' + tri + '. Constata-se a inércia formal da contratada, inexistindo justificativa protocolada para afastar o descumprimento apurado no período.'
      : 'A Organização Social contratada não apresentou defesa administrativa nem justificativa formal referente ao apontamento do indicador "' + _v(it.indicador, 'indicador') + '" no período.';
    if (regra === 'producao_meta') {
      var ms = DESC_MESES[(+rec.trimestre || 1) - 1], m = pp.meses, un = _unidadeMedida(it);
      var vals = m.every(function (x) { return x !== null; }) ? m[0] + ' ' + un + ' em ' + ms[0] + ', ' + m[1] + ' em ' + ms[1] + ' e ' + m[2] + ' em ' + ms[2] + ' de ' + _v(rec.ano, 'ano') : '[quantitativos mensais] de ' + _v(rec.ano, 'ano');
      r.analise = 'De acordo com o ' + _refParecer(rec) + ', a unidade registrou ' + vals + ', alcançando um percentual trimestral de ' + (pp.pct !== null ? String(pp.pct).replace('.', ',') + '%' : '[percentual]') + ' da meta. Diante da ausência de defesa administrativa ou de comprovação de excludentes de responsabilidade — como a inexistência de demanda validada pela contratante —, prevalece a verdade material dos registros oficiais, confirmando-se que a unidade não atingiu o patamar mínimo contratual de ' + lim + '% de execução. Em decorrência do descumprimento, mantém-se integralmente o apontamento de desconto.';
    } else if (regra === 'prestacao_contas') {
      r.analise = 'Conforme verificado pela Gerência de Acompanhamento Contábil Financeiro dos Contratos de Gestão e registrado no ' + _refParecer(rec) + ', o relatório referente à(s) competência(s) [informar] foi entregue fora do prazo estipulado. Sem justificativa ou prova de força maior, resta caracterizado o descumprimento do indicador de qualidade na(s) referida(s) competência(s). Dessa forma, ratifica-se o apontamento de desconto.';
    } else if (regra === 'comprovacao') {
      r.analise = 'A análise do ' + _refParecer(rec) + ' demonstrou que [descrever o problema: documentação ausente ou ilegível, competência e página] inviabilizou a aferição técnica do cumprimento do indicador "' + _v(it.indicador, 'indicador') + '" naquele período. Não houve defesa que o afastasse; ratifica-se o apontamento de desconto.';
    } else {
      r.analise = 'Conforme o ' + _refParecer(rec) + ', [descrever o descumprimento apurado]. Não houve defesa que o afastasse; ratifica-se o apontamento de desconto.';
    }
    return r;
  }
  // --- com defesa ---
  var tempestiva = (rec.defesa_data && p.prazo_defesa) ? dParse(rec.defesa_data) <= dParse(p.prazo_defesa) : null;
  r.abertura = 'Defesa administrativa apresentada' + (rec.defesa_data ? ' em ' + dBr(rec.defesa_data) : '') + (tempestiva === true ? ', dentro do prazo (até ' + dBr(p.prazo_defesa) + ').' : tempestiva === false ? ', FORA do prazo (venceu em ' + dBr(p.prazo_defesa) + ').' : '. [conferir a tempestividade]');
  if (tempestiva === false) { av.push('Defesa intempestiva: avalie, com o jurídico, se cabe não conhecê-la. A decisão sugerida mantém o apontamento, mas confirme.'); r.decisao = 'nao_acatado'; }
  r.resumo = '[Resumir os argumentos e as provas apresentados pela OSS ' + sigla + ' ponto a ponto. Dica: cole o texto da defesa no campo acima e use "Redigir com IA".]';
  r.analise = it.tipo === 'producao' && pp.pct !== null
    ? 'De acordo com o ' + _refParecer(rec) + ', o percentual trimestral apurado foi de ' + String(pp.pct).replace('.', ',') + '% da meta. [Confrontar cada argumento da defesa com os registros oficiais (CNES, SIH/SIA, relatórios assistenciais) e concluir se a meta foi ou não atingida.]'
    : 'De acordo com o ' + _refParecer(rec) + ', [descrever o apurado]. [Confrontar cada argumento da defesa com os documentos e concluir.]';
  av.push('Com defesa apresentada, a decisão de mérito é sua: o sistema só monta a estrutura e confere prazo, números e fontes externas.');
  return r;
}
// ===== FICHA DO CONTRATO DA UNIDADE (cada unidade é um caso: os valores vêm do contrato e dos aditivos dela) =====
// "padrao" é só o ponto de partida (o que mais aparece nos contratos). O que vier diferente no contrato vale e é destacado como "fora do padrão".
var DESC_FICHA_PADRAO = {
  ficha_conferida:        { rot: 'Ficha conferida com o contrato?', padrao: 'nao', dica: 'Marque "sim" depois de conferir cada valor abaixo com o contrato e os aditivos da unidade.' },
  piso_producao_pct:      { rot: 'Piso de produção (%)', padrao: '85', dica: 'Atingimento mínimo das metas de produção no trimestre para não haver desconto (art. 15-A da Lei 15.210/2013). Confira se o contrato repete ou muda esse piso.' },
  pct_fixo:               { rot: 'Parte fixa do repasse (%)', padrao: '70', dica: 'Percentual do repasse que não depende de meta.' },
  pct_producao:           { rot: 'Parte variável de produção (%)', padrao: '20', dica: 'Percentual do repasse ligado às metas de produção.' },
  pct_qualidade:          { rot: 'Parte variável de qualidade (%)', padrao: '10', dica: 'Percentual do repasse ligado aos indicadores de qualidade.' },
  dia_entrega_rm:         { rot: 'Dia-limite do relatório mensal', padrao: '20', dica: 'Dia do mês seguinte para a unidade entregar a prestação de contas (dia 20 na maioria; 25 em alguns contratos). Feriado prorroga para o dia útil seguinte.' },
  compensacao_trimestres: { rot: 'Prazo de compensação (trimestres)', padrao: '2', dica: 'Até quando a produção pode ser compensada (fim do 2º trimestre seguinte, na regra mais comum). Só vale para produção.' },
  clausula_demanda:       { rot: 'Cláusula de inexistência de demanda', padrao: '', dica: 'Número da cláusula que afasta o desconto de produção quando o ÚNICO motivo é a falta de demanda (ex.: Cláusula 6.3; Observação 2 do Anexo Técnico I). Vazio = não localizada neste contrato.' },
  clausula_sistemas:      { rot: 'Cláusula de alimentar os sistemas oficiais', padrao: '', dica: 'Número muda de contrato para contrato (ex.: 3.1.70 no CG 001/2022; 3.1.75 no CG 020/2022). Confira no contrato da unidade.' },
  valoracao_escala:       { rot: 'Tabela de valoração da escala', padrao: '', dica: 'Como as faltas viram desconto neste contrato (ex.: 0,04% do repasse por falta; 15 ou mais faltas no mês = 0% do indicador). Copie do Anexo Técnico II.' },
  excecoes_qualitativo:   { rot: 'Exceções previstas para indicadores de qualidade', padrao: '', dica: 'Só o que estiver escrito em aditivo ou nota técnica (ex.: reequilíbrio financeiro do TA 11; NT SES 38/2025 para perfil de alto risco). Sem documento formal, vale o art. 38 do Decreto 58.200/2025: qualidade não compensa.' },
  aditivos_metas:         { rot: 'Aditivos que mudam metas ou valores', padrao: '', dica: 'Liste número e assunto de cada termo aditivo que altera meta, indicador ou percentual (ex.: 6º TA: novo formulário de satisfação).' }
};
function fichaMapa(linhas) {
  var m = {}; Object.keys(DESC_FICHA_PADRAO).forEach(function (k) { m[k] = DESC_FICHA_PADRAO[k].padrao; });
  (linhas || []).forEach(function (l) { if (l && l.chave && DESC_FICHA_PADRAO[l.chave] && l.valor !== '' && l.valor !== undefined && l.valor !== null) m[l.chave] = String(l.valor); });
  return m;
}
// O que neste contrato foge do padrão dos demais: merece atenção na análise.
function fichaForaDaRegra(fm) {
  var out = [];
  function dif(chave, rot) { if (String(fm[chave]) !== String(DESC_FICHA_PADRAO[chave].padrao)) out.push(rot + ': neste contrato é ' + fm[chave] + ' (o comum é ' + DESC_FICHA_PADRAO[chave].padrao + ').'); }
  dif('piso_producao_pct', 'Piso de produção');
  dif('dia_entrega_rm', 'Dia-limite do relatório mensal');
  dif('compensacao_trimestres', 'Prazo de compensação');
  dif('pct_fixo', 'Parte fixa'); dif('pct_producao', 'Variável de produção'); dif('pct_qualidade', 'Variável de qualidade');
  if (String(fm.excecoes_qualitativo || '').trim()) out.push('Há exceção prevista para indicador de qualidade: ' + fm.excecoes_qualitativo + '. Só vale com o documento formal; sem ele, aplica-se o art. 38 do Decreto 58.200/2025 (qualidade não compensa).');
  if (String(fm.aditivos_metas || '').trim()) out.push('Aditivos que mudam metas ou valores: ' + fm.aditivos_metas + '. Confira se o trimestre analisado já está sob a regra nova.');
  return out;
}
// Família de conferência do apontamento (decide qual roteiro usar na leitura da defesa).
function classificarConferencia(it) {
  var n = String(it.indicador || '').toLowerCase();
  if (/escala/.test(n)) return 'escala';
  if (/cnes/.test(n)) return 'cnes';
  if (/queixa|ouvidoria/.test(n)) return 'queixas';
  if (/satisfa/.test(n)) return 'satisfacao';
  if (/educa[cç][aã]o/.test(n)) return 'educacao';
  if (/matricia|supervis/.test(n)) return 'matriciamento';
  if (/acolhimento|classifica[cç][aã]o de risco|accr/.test(n)) return 'accr';
  if (/presta[cç][aã]o de contas|relat[oó]rio/.test(n)) return 'prazo_entrega';
  if (it.tipo === 'producao') return 'producao';
  return 'qualidade_geral';
}
function _ou(v, falta) { v = String(v || '').trim(); return v ? v : '[' + falta + ']'; }
// Roteiro de conferência da defesa, por família, usando os valores do contrato da unidade (fm).
// Montado a partir das 32 análises reais de 2024; o sistema confere, quem decide é o analista.
function roteiroConferencia(it, fm) {
  fm = fm || fichaMapa([]);
  var fam = classificarConferencia(it), piso = fm.piso_producao_pct, r = { familia: fam, titulo: '', passos: [], decide: [] };
  if (fam === 'producao') {
    r.titulo = 'Produção: meta não atingida';
    r.passos = [
      'Calcule o atingimento do trimestre: ' + piso + '% ou mais afasta o desconto (confira os 3 meses e a meta acima).',
      'A defesa alega falta de demanda? Previsão neste contrato: ' + _ou(fm.clausula_demanda, 'não localizada na ficha do contrato') + '. Só vale se a falta de demanda for o ÚNICO motivo e os dados forem validados pela contratante.',
      'Confira a oferta mês a mês contra a meta: relatório de oferta, perda primária (vagas abertas não agendadas pela regulação) e absenteísmo dos pacientes.',
      'Procure motivo interno que derrube a alegação: vaga de especialidade sem profissional (TO, fono etc.), equipamento parado sem registro formal, suboferta ou escala incompleta no mesmo período.',
      'Meta tida como inexequível ou trocada de especialidade só muda a conta com termo aditivo formalizado; pedido de repactuação em andamento não basta.'
    ];
    r.decide = ['Costuma-se ACATAR: oferta igual ou maior que a meta em todos os meses, capacidade mantida e agendamento/absenteísmo fora do alcance da unidade (comprovados).',
      'Costuma-se NÃO ACATAR: faltou profissional ou estrutura, a oferta ficou abaixo da meta, ou a alegação de demanda não tem prova validada.'];
  } else if (fam === 'escala') {
    r.titulo = 'Escala (médica, odontológica ou outra)';
    r.passos = [
      'Confronte as faltas do BID (Boletim de Informação Diária) com o que a defesa afirma: o registro oficial prevalece sobre relatório interno.',
      'Substituição conta só se foi registrada na escala oficial; médico "intermediado"/PJ sem registro nominal não cobre a falta.',
      'Produção alta não compensa escala incompleta (art. 38, parágrafo único, do Decreto 58.200/2025).',
      'Aplique a valoração deste contrato: ' + _ou(fm.valoracao_escala, 'tabela de valoração não preenchida na ficha do contrato') + '.'
    ];
    r.decide = ['Costuma-se NÃO ACATAR: faltas admitidas, atestado sem substituto imediato, "escassez de mercado" ou remanejamento unilateral.',
      'Acatamento depende de previsão formal (ex.: distribuição aceita pela supervisão ou exceção escrita em aditivo).'];
  } else if (fam === 'cnes') {
    r.titulo = 'Profissionais cadastrados no CNES';
    r.passos = [
      'Exija a listagem nominal de quem atuou no mês (do relatório mensal): extrato do CNES sozinho não substitui a lista.',
      'Cruze nome a nome a lista com o extrato do CNES do mês, citando os profissionais pelas iniciais.',
      'Lista entregue só na defesa é extemporânea: não valida o período já apurado.',
      'Erro de grafia ou mudança de nome comprovada pode justificar; profissional que de fato não atuou no mês sai da conta.'
    ];
    r.decide = ['Pode haver acatamento por mês: acata nos meses em que a lista e o CNES batem; mantém nos demais.'];
  } else if (fam === 'queixas') {
    r.titulo = 'Resolução das queixas';
    r.passos = [
      'Compare, mês a mês, o número de queixas do relatório mensal com o registrado no SIMAS: divergência resolve-se pelo SIMAS.',
      'Confira se as resoluções foram enviadas com as tratativas e prazos: resposta genérica ("estamos averiguando", "mande mais detalhes") não é resolução.',
      'Prazo de resposta ao usuário: até 20 dias corridos (confira a cláusula deste contrato).'
    ];
    r.decide = ['Pode haver acatamento parcial por mês: acata no mês em que relatório e SIMAS convergem e as resoluções estão provadas; mantém nos demais.'];
  } else if (fam === 'satisfacao') {
    r.titulo = 'Satisfação do usuário';
    r.passos = [
      'Amostra: 10% ou mais dos atendimentos do mês. Abaixo disso, o indicador zera.',
      'Formulário: só vale o modelo contratual (resposta positiva = soma de 24 pontos ou mais nos itens). Modelo próprio ou "parecido" = indicador impossibilitado de análise.',
      'Dados no sistema oficial e no prazo: extrato de sistema paralelo (ex.: Smart Pixeon) apresentado só na defesa não tem valor probatório.',
      'Se o sistema oficial falhou, a unidade devia ter usado formulário físico (plano de contingência do contrato).'
    ];
    r.decide = ['Costuma-se NÃO ACATAR: amostra insuficiente, formulário fora do modelo ou dado só em sistema paralelo/extemporâneo.'];
  } else if (fam === 'educacao') {
    r.titulo = 'Educação permanente / educação na saúde';
    r.passos = [
      'Só conta capacitação técnica da própria equipe: campanha temática (Agosto Lilás, Outubro Rosa etc.), ação para paciente e reunião de equipe não entram.',
      'Confira o denominador: o nº de atividades previstas registrado no sistema. Erro no previsto pode derrubar o apontamento.',
      'O relatório específico do indicador tem de ter sido enviado no formato e prazo pactuados; realizar sem relatar conta como não cumprido.',
      'Atividade fora do plano aprovado previamente pela SES não valida o indicador.'
    ];
    r.decide = ['Costuma-se ACATAR: quando o denominador (previstas) foi contado errado pela fiscalização.',
      'Costuma-se NÃO ACATAR: campanhas no lugar de capacitação, relatório não enviado ou detalhamento só na defesa.'];
  } else if (fam === 'matriciamento') {
    r.titulo = 'Matriciamento / supervisão do cuidado nas UBS';
    r.passos = [
      'Confira a natureza das ações: só valem as modalidades do contrato (diretrizes clínicas, reuniões clínicas, cursos rápidos, atendimento conjunto, videoconferência, segunda opinião).',
      'Rotina interna da própria unidade (busca ativa, agendamento, atendimento ao usuário) não é matriciamento nem supervisão.',
      'Na supervisão, pelo menos 50% das ações têm de ocorrer dentro das UBS: confira onde cada ação aconteceu.'
    ];
    r.decide = ['Costuma-se NÃO ACATAR: ações registradas que são rotina assistencial, ou nenhuma ação nas UBS.'];
  } else if (fam === 'accr') {
    r.titulo = 'Acolhimento e classificação de risco';
    r.passos = [
      'Confira a consistência dos números do relatório: o denominador usado pela unidade bate com o total de atendimentos nas classificações?',
      'Recalcule o percentual com o denominador correto antes de aceitar o valor da defesa.',
      'Limitação do sistema (ex.: BPA aceita uma classificação por paciente) comprovada pode justificar percentuais um pouco abaixo de 100%.'
    ];
    r.decide = ['Acata quando a diferença vem de limitação comprovada do sistema ou de erro de cálculo da fiscalização; mantém quando os dados da própria unidade se contradizem.'];
  } else if (fam === 'prazo_entrega') {
    r.titulo = 'Prazo da prestação de contas / relatórios';
    r.passos = [
      'Confronte a data de entrega no SEI (documento e despacho da GAFCG) com o dia-limite deste contrato: dia ' + fm.dia_entrega_rm + ' do mês seguinte; feriado prorroga para o dia útil seguinte.',
      'Captura de tela não prova entrega; vale o registro no SEI ou no sistema oficial.',
      'Força maior documentada (ex.: falha geral comprovada) pode justificar atraso pequeno; problema no servidor interno da unidade não é força maior.'
    ];
    r.decide = ['Costuma-se ACATAR: entrega dentro do prazo recontado (feriado) ou força maior documentada.',
      'Costuma-se NÃO ACATAR: atraso confirmado sem prova de força maior.'];
  } else {
    r.titulo = 'Indicador de qualidade';
    r.passos = [
      'Qualidade é aferida mês a mês e não admite compensação por produção excedente (art. 38, parágrafo único, do Decreto 58.200/2025).',
      'Prova entregue só na defesa (não enviada no monitoramento) é extemporânea e não valida o período.',
      'Dado do sistema oficial prevalece sobre relatório interno da unidade.',
      'Exceção só com documento formal: ' + _ou(fm.excecoes_qualitativo, 'nenhuma exceção registrada na ficha deste contrato') + '.'
    ];
    r.decide = ['Costuma-se ACATAR: erro de cálculo ou de denominador da fiscalização, ou exceção prevista em aditivo/nota técnica.',
      'Costuma-se NÃO ACATAR: compensação temporal, prova extemporânea ou dado divergente do sistema oficial.'];
  }
  return r;
}

function textoFundamentacao(it) {
  var p = [];
  if (it.justificativa_decisao) p.push(it.justificativa_decisao);
  if (it.resumo_defesa) p.push('Resumo do Recurso:\n' + it.resumo_defesa);
  if (it.analise_tecnica) p.push('Análise Técnica e Probatória: \n' + it.analise_tecnica);
  if (it.fundamentacao_juridica) p.push('Fundamentação Jurídica e Contratual: \n' + it.fundamentacao_juridica);
  return p.join('\n\n');
}
// ===== FIM DO NÚCLEO =====

// ===== TELA: aba "Descontos" do Analista =====
var DESC = { lista: [], params: null, pmapa: null, aba: 'lista', atual: null, itens: [], eventos: [], filtro: { ano: '', tri: '', tipo: '', q: '' }, resumoRef: [], tela: null, fichaCampos: null };
var DESC_FONTES = [
  { fonte: 'CNES-LT', nome: 'CNES — Leitos', chaves: 'leitos_existentes, leitos_sus, leitos_uti', uso: 'Taxa de ocupação, leitos contratados x cadastrados.', onde: 'Arquivos LT (leitos) do CNES, por UF e mês, no FTP do DATASUS; ou TabNet > CNES > Leitos.' },
  { fonte: 'CNES-PF', nome: 'CNES — Profissionais', chaves: 'profissionais_total, medicos, enfermeiros', uso: 'Conferir médicos e demais profissionais cadastrados na unidade.', onde: 'Arquivos PF (profissionais) do CNES, por UF e mês; ou TabNet > CNES > Profissionais.' },
  { fonte: 'CNES-SR', nome: 'CNES — Serviços especializados', chaves: 'servicos_habilitados', uso: 'Serviços e habilitações da unidade.', onde: 'Arquivos SR do CNES.' },
  { fonte: 'SIH', nome: 'SIH/SUS — Internações', chaves: 'saidas, aih_aprovadas, valor_aih', uso: 'Saídas hospitalares, AIH aprovadas.', onde: 'Arquivos RD (AIH reduzida) do SIH, por UF e mês; ou TabNet > Hospitalares.' },
  { fonte: 'SIA', nome: 'SIA/SUS — Ambulatorial', chaves: 'consultas, procedimentos_aprovados', uso: 'Produção ambulatorial (consultas, exames).', onde: 'Arquivos PA (produção ambulatorial) do SIA, por UF e mês; ou TabNet > Ambulatorial.' }
];
var DESC_ROTULOS_DEC = { '': '— pendente —', acatado: 'Acatado (defesa acatada: apontamento afastado)', nao_acatado: 'Não acatado (apontamento mantido)' };

function dEsc(s) { return typeof escHtml === 'function' ? escHtml(s) : String(s === null || s === undefined ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function dIn(id, v, tipo, extra) { return '<input id="' + id + '" type="' + (tipo || 'text') + '" value="' + dEsc(tipo === 'date' ? dIso(dParse(v)) : v) + '" ' + (extra || '') + ' oninput="descMudou()" style="width:100%;padding:6px 8px;border:1px solid #ced4da;border-radius:4px;font-size:0.85rem;box-sizing:border-box;">'; }
function dSel(id, v, opcoes, extra) { return '<select id="' + id + '" onchange="descMudou()" ' + (extra || '') + ' style="width:100%;padding:6px 8px;border:1px solid #ced4da;border-radius:4px;font-size:0.85rem;box-sizing:border-box;">' + opcoes.map(function (o) { return '<option value="' + dEsc(o[0]) + '"' + (String(v || '') === String(o[0]) ? ' selected' : '') + '>' + dEsc(o[1]) + '</option>'; }).join('') + '</select>'; }
function dCampo(rot, html, dica) { return '<label style="display:block;font-size:0.78rem;color:#495057;font-weight:600;">' + dEsc(rot) + (dica ? '<span style="display:block;font-weight:400;color:#6c757d;font-size:0.74rem;">' + dEsc(dica) + '</span>' : '') + '<div style="margin-top:3px;">' + html + '</div></label>'; }
function dCartao(titulo, corpo, extraStyle) { return '<div style="background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:16px;margin-bottom:14px;box-shadow:0 1px 2px rgba(0,0,0,0.04);' + (extraStyle || '') + '"><h3 style="margin:0 0 12px;font-size:0.95rem;">' + dEsc(titulo) + '</h3>' + corpo + '</div>'; }
function dGrade(n, corpo) { return '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(' + (n || 180) + 'px,1fr));gap:12px;">' + corpo + '</div>'; }
function dPmapa() { return DESC.pmapa || paramsMapa([]); }
var SIM_NAO = [['', '—'], ['sim', 'Sim'], ['nao', 'Não']];

async function descCarregarBase() {
  const r = await api('descontos/listar');
  if (r.ok) DESC.lista = r.descontos || [];
  const p = await api('descontos/parametros');
  if (p.ok) { DESC.params = p.parametros; DESC.pmapa = paramsMapa(p.parametros); }
  return r;
}

async function renderDescontos() {
  const content = document.getElementById('content'); if (!content) return;
  content.innerHTML = '<p style="color:#6c757d;">Carregando descontos…</p>';
  const r = await descCarregarBase();
  if (!r.ok) { content.innerHTML = '<div style="background:#fff3cd;padding:14px;border-radius:6px;">Não consegui abrir os descontos: ' + dEsc(r.erro || 'erro') + '. Se for a primeira vez, confira se o Code.gs e o Descontos.gs foram colados e publicados em Nova versão.</div>'; return; }
  DESC.aba = 'lista'; descDesenhar();
}
function descAbas() {
  const ab = [['lista', 'Registros', 'ti-list'], ['painel', 'Painel', 'ti-chart-bar'], ['fontes', 'Fontes externas', 'ti-database-import'], ['params', 'Parâmetros', 'ti-adjustments']];
  return '<div style="display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap;">' + ab.map(function (a) { const at = DESC.aba === a[0] || (DESC.aba === 'ficha' && a[0] === 'lista'); return '<button class="btn btn-sm ' + (at ? 'btn-primary' : 'btn-secondary') + '" onclick="descIrAba(\'' + a[0] + '\')"><i class="ti ' + a[2] + '"></i> ' + a[1] + '</button>'; }).join('') + '</div>';
}
async function descIrAba(a) { DESC.aba = a; if (a === 'fontes') { const r = await api('descontos/ref-resumo'); DESC.resumoRef = r.ok ? r.resumo : []; const n = await api('descontos/necessidades'); DESC.falta = n.ok ? n.falta : []; } descDesenhar(); }
function descDesenhar() {
  const c = document.getElementById('content'); if (!c) return;
  let corpo = '';
  if (DESC.aba === 'lista') corpo = descHtmlLista();
  else if (DESC.aba === 'painel') corpo = descHtmlPainel();
  else if (DESC.aba === 'fontes') corpo = descHtmlFontes();
  else if (DESC.aba === 'params') corpo = descHtmlParams();
  else if (DESC.aba === 'ficha') corpo = DESC.modo === 'completa' ? descHtmlFicha() : descHtmlFluxo();
  c.innerHTML = (DESC.aba === 'ficha' ? '' : descAbas()) + corpo;
  if (DESC.aba === 'ficha') descRecalcular();
}

// ---------- LISTA ----------
function descFiltrar() {
  const f = DESC.filtro, q = (f.q || '').toLowerCase();
  return DESC.lista.filter(function (r) { return (!f.ano || String(r.ano) === f.ano) && (!f.tri || String(r.trimestre) === f.tri) && (!f.tipo || r.tipo === f.tipo) && (!q || [r.unidade, r.contrato, r.sigla_oss, r.sei_processo].join(' ').toLowerCase().indexOf(q) > -1); });
}
function descHtmlLista() {
  const anos = Array.from(new Set(DESC.lista.map(function (r) { return String(r.ano); }))).sort().reverse();
  const f = DESC.filtro, ls = descFiltrar();
  const filtros = '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:end;margin-bottom:14px;">' +
    '<div style="width:110px;">' + dCampo('Ano', '<select onchange="DESC.filtro.ano=this.value;descDesenhar()" style="width:100%;padding:6px;border:1px solid #ced4da;border-radius:4px;"><option value="">Todos</option>' + anos.map(function (a) { return '<option' + (f.ano === a ? ' selected' : '') + '>' + a + '</option>'; }).join('') + '</select>') + '</div>' +
    '<div style="width:110px;">' + dCampo('Trimestre', '<select onchange="DESC.filtro.tri=this.value;descDesenhar()" style="width:100%;padding:6px;border:1px solid #ced4da;border-radius:4px;"><option value="">Todos</option>' + [1, 2, 3, 4].map(function (t) { return '<option value="' + t + '"' + (f.tri === String(t) ? ' selected' : '') + '>' + t + 'º</option>'; }).join('') + '</select>') + '</div>' +
    '<div style="width:130px;">' + dCampo('Tipo', '<select onchange="DESC.filtro.tipo=this.value;descDesenhar()" style="width:100%;padding:6px;border:1px solid #ced4da;border-radius:4px;"><option value="">Todos</option>' + ['HOSPITAL', 'UPA', 'UPAE'].map(function (t) { return '<option' + (f.tipo === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>') + '</div>' +
    '<div style="flex:1;min-width:180px;">' + dCampo('Buscar', '<input value="' + dEsc(f.q) + '" oninput="DESC.filtro.q=this.value;clearTimeout(window._dq);window._dq=setTimeout(descDesenhar,300)" placeholder="unidade, contrato, OSS ou SEI" style="width:100%;padding:6px 8px;border:1px solid #ced4da;border-radius:4px;box-sizing:border-box;">') + '</div>' +
    '<button class="btn btn-primary" onclick="descAbrir(null)"><i class="ti ti-plus"></i> Novo desconto</button></div>';
  const totA = ls.reduce(function (s, r) { return s + (r.resumo ? r.resumo.apontado : 0); }, 0), totD = ls.reduce(function (s, r) { return s + (r.resumo ? r.resumo.a_descontar : 0); }, 0), nAl = ls.reduce(function (s, r) { return s + (r.resumo ? r.resumo.alertas_erro : 0); }, 0);
  const kpi = '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:14px;">' + [['Registros', ls.length], ['Total apontado', brl(totA)], ['Total a descontar', brl(totD)], ['Alertas graves', nAl]].map(function (k) { return '<div style="background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:10px 16px;min-width:140px;"><div style="font-size:0.72rem;color:#6c757d;">' + k[0] + '</div><div style="font-size:1.15rem;font-weight:700;">' + k[1] + '</div></div>'; }).join('') + '</div>';
  if (!ls.length) return filtros + '<div style="background:#fff;border:1px dashed #ced4da;border-radius:8px;padding:30px;text-align:center;color:#6c757d;">Nenhum registro ainda. Clique em <strong>Novo desconto</strong> para lançar o primeiro (por exemplo, o 1º trimestre de 2025).</div>';
  const grupos = {};
  ls.forEach(function (r) { const k = r.ano + ' · ' + r.trimestre + 'º trimestre'; (grupos[k] = grupos[k] || []).push(r); });
  const html = Object.keys(grupos).sort().reverse().map(function (k) {
    const linhas = grupos[k].sort(function (a, b) { return String(a.unidade).localeCompare(String(b.unidade)); }).map(function (r) {
      const s = r.resumo || {};
      return '<tr style="cursor:pointer;" onclick="descAbrir(' + r.id + ')"><td><strong>' + dEsc(r.unidade) + '</strong><div style="font-size:0.72rem;color:#6c757d;">' + dEsc(r.tipo || '') + ' · C.G ' + dEsc(r.contrato || '—') + ' · ' + dEsc(r.sigla_oss || '') + '</div></td>' +
        '<td style="font-size:0.78rem;">' + dEsc(r.sei_processo || '—') + '</td><td style="text-align:right;">' + brl(s.apontado || 0) + '</td><td style="text-align:right;font-weight:700;">' + brl(s.a_descontar || 0) + '</td>' +
        '<td style="font-size:0.8rem;">' + dEsc(s.proxima_acao || '') + '</td><td>' + (s.alertas_erro ? '<span class="badge-status" style="background:#f8d7da;color:#842029;">' + s.alertas_erro + ' grave(s)</span>' : s.alertas ? '<span class="badge-status" style="background:#fff3cd;color:#664d03;">' + s.alertas + ' aviso(s)</span>' : '<span class="badge-status">ok</span>') + '</td></tr>';
    }).join('');
    return '<h3 style="margin:18px 0 8px;font-size:0.95rem;">' + dEsc(k) + '</h3><div style="overflow-x:auto;background:#fff;border:1px solid #dee2e6;border-radius:8px;"><table style="width:100%;border-collapse:collapse;font-size:0.85rem;" class="desc-tab"><thead><tr style="background:#f8f9fa;text-align:left;"><th style="padding:8px;">Unidade</th><th>SEI</th><th style="text-align:right;">Apontado</th><th style="text-align:right;">A descontar</th><th>Próxima ação</th><th>Situação</th></tr></thead><tbody>' + linhas + '</tbody></table></div>';
  }).join('');
  return '<style>.desc-tab td,.desc-tab th{padding:8px;border-top:1px solid #eef0f2;vertical-align:top}.desc-tab tbody tr:hover{background:#f8f9fa}</style>' + filtros + kpi + html;
}

// ---------- PAINEL ----------
function descHtmlPainel() {
  const por = {}, acoes = {};
  DESC.lista.forEach(function (r) { const k = r.ano + '-T' + r.trimestre; const m = por[k] = por[k] || { n: 0, ap: 0, de: 0 }; m.n++; m.ap += r.resumo.apontado; m.de += r.resumo.a_descontar; const a = r.resumo.proxima_acao.replace(/ até .*/, ''); acoes[a] = (acoes[a] || 0) + 1; });
  const tr = Object.keys(por).sort().reverse().map(function (k) { return '<tr><td>' + k + '</td><td style="text-align:right;">' + por[k].n + '</td><td style="text-align:right;">' + brl(por[k].ap) + '</td><td style="text-align:right;font-weight:700;">' + brl(por[k].de) + '</td></tr>'; }).join('');
  const ac = Object.keys(acoes).sort(function (a, b) { return acoes[b] - acoes[a]; }).map(function (a) { return '<tr><td>' + dEsc(a) + '</td><td style="text-align:right;">' + acoes[a] + '</td></tr>'; }).join('');
  const venc = DESC.lista.filter(function (r) { return r.resumo.prazo_defesa && !r.defesa && dParse(r.resumo.prazo_defesa) >= dParse(dIso(new Date())) && dParse(r.resumo.prazo_defesa) <= dAdd(dParse(dIso(new Date())), 10); });
  return '<style>.desc-tab td,.desc-tab th{padding:8px;border-top:1px solid #eef0f2}</style>' +
    dCartao('Por trimestre', '<table class="desc-tab" style="width:100%;border-collapse:collapse;font-size:0.85rem;"><thead><tr style="text-align:left;"><th>Trimestre</th><th style="text-align:right;">Registros</th><th style="text-align:right;">Apontado</th><th style="text-align:right;">A descontar</th></tr></thead><tbody>' + (tr || '<tr><td colspan="4" style="color:#6c757d;">Sem dados.</td></tr>') + '</tbody></table>') +
    dCartao('O que cada registro está esperando', '<table class="desc-tab" style="width:100%;border-collapse:collapse;font-size:0.85rem;"><tbody>' + (ac || '<tr><td style="color:#6c757d;">Sem dados.</td></tr>') + '</tbody></table>') +
    dCartao('Prazos de defesa que vencem nos próximos 10 dias', venc.length ? venc.map(function (r) { return '<div style="padding:4px 0;font-size:0.85rem;">' + dEsc(r.unidade) + ' (' + r.ano + ' T' + r.trimestre + ') — vence em <strong>' + dBr(r.resumo.prazo_defesa) + '</strong></div>'; }).join('') : '<span style="color:#6c757d;font-size:0.85rem;">Nenhum.</span>');
}

// ---------- FICHA ----------
async function descAbrir(id) {
  if (id === null) { DESC.atual = { id: '', unidade: '', tipo: 'HOSPITAL', ano: new Date().getFullYear(), trimestre: 1, defesa: '', recurso: '', base_legal_conferida: '', ata_revisada: '' }; DESC.itens = []; DESC.eventos = []; }
  else { const r = await api('descontos/obter', { id: id }); if (!r.ok) { mostrarToast(r.erro || 'Erro ao abrir.'); return; } DESC.atual = r.desconto; DESC.itens = r.itens || []; DESC.eventos = r.eventos || []; }
  DESC.aba = 'ficha'; DESC._sujo = false; DESC.modo = 'fluxo'; DESC._defesa = ''; DESC.fichaCampos = null; DESC._fichaUnidade = ''; DESC._banco = null;
  if (DESC.atual.unidade) await descCarregarFicha();
  DESC.passo = id === null ? 0 : descPrimeiroPendente(); descEntrarPasso(); descDesenhar();
}
function descHtmlFicha() {
  const a = DESC.atual;
  const dados = dCartao('Identificação', dGrade(190,
    dCampo('Unidade', dIn('f_unidade', a.unidade)) + dCampo('Tipo', dSel('f_tipo', a.tipo, [['HOSPITAL', 'Hospital'], ['UPA', 'UPA'], ['UPAE', 'UPAE'], ['OUTRO', 'Outro']])) +
    dCampo('OSS (nome completo)', dIn('f_nome_oss', a.nome_oss, 'text', 'placeholder="ex.: Fundação Gestão Hospitalar Martiniano Fernandes"')) + dCampo('Sigla da OSS', dIn('f_sigla_oss', a.sigla_oss)) + dCampo('Contrato de Gestão (C.G)', dIn('f_contrato', a.contrato, 'text', 'placeholder="ex.: 024/2022"')) +
    dCampo('CNES', dIn('f_cnes', a.cnes, 'text', 'placeholder="7 dígitos"'), 'usado nas conferências externas') + dCampo('Ano', dIn('f_ano', a.ano, 'number')) +
    dCampo('Trimestre', dSel('f_trimestre', a.trimestre, [[1, '1º'], [2, '2º'], [3, '3º'], [4, '4º']])) + dCampo('Processo SEI', dIn('f_sei_processo', a.sei_processo, 'text', 'placeholder="0000000000.000000/0000-00"'))));
  const parecer = dCartao('1. Parecer da CTAI', dGrade(190, dCampo('Nº do parecer da CTAI', dIn('f_parecer_numero', a.parecer_numero, 'text', 'placeholder="ex.: 048/2025"')) + dCampo('Documento SEI do parecer', dIn('f_parecer_sei', a.parecer_sei), 'número do documento, não só o processo') + dCampo('Data do parecer', dIn('f_parecer_data', a.parecer_data, 'date'))));
  const notif = dCartao('2. Notificação e defesa', dGrade(190,
    dCampo('Base legal conferida com o contrato vigente?', dSel('f_base_legal_conferida', a.base_legal_conferida, SIM_NAO)) + dCampo('Data de envio da notificação', dIn('f_notificacao_envio', a.notificacao_envio, 'date')) +
    dCampo('Ciência expressa da OSS', dIn('f_ciencia_data', a.ciencia_data, 'date'), 'deixe vazio se não houve') + dCampo('Apresentou defesa?', dSel('f_defesa', a.defesa, SIM_NAO)) + dCampo('Data da defesa', dIn('f_defesa_data', a.defesa_data, 'date'))) + '<div id="d_prazos" style="margin-top:10px;"></div>');
  const julg = dCartao('3. Julgamento e Ata', dGrade(190,
    dCampo('Pré-julgamento (Grupo Técnico / CASSCG)', dIn('f_grupo_tecnico_data', a.grupo_tecnico_data, 'date')) + dCampo('Reunião da Comissão', dIn('f_comissao_data', a.comissao_data, 'date')) +
    dCampo('Ata revisada?', dSel('f_ata_revisada', a.ata_revisada, SIM_NAO)) + dCampo('Documento SEI da Ata', dIn('f_ata_sei', a.ata_sei)) +
    dCampo('Ata enviada à OSS em', dIn('f_ata_envio_oss', a.ata_envio_oss, 'date')) + dCampo('Ciência da Ata pela OSS', dIn('f_ata_ciencia_data', a.ata_ciencia_data, 'date'), 'vazio se não houve') + dCampo('Processo enviado à GAFCG em', dIn('f_envio_gafcg', a.envio_gafcg, 'date'))));
  const rec = dCartao('4. Recurso e execução', dGrade(190,
    dCampo('A OSS pediu recurso?', dSel('f_recurso', a.recurso, SIM_NAO)) + dCampo('Data do recurso', dIn('f_recurso_data', a.recurso_data, 'date')) + dCampo('Decisão do recurso em', dIn('f_recurso_decisao_data', a.recurso_decisao_data, 'date')) +
    dCampo('Execução (GAOCG)', dSel('f_execucao_tipo', a.execucao_tipo, [['', '—'], ['superavitario', 'Superavitário: deduz das parcelas'], ['deficitario', 'Deficitário: prestação de contas']])) +
    dCampo('Data da execução', dIn('f_execucao_data', a.execucao_data, 'date')) + dCampo('LE / OB', dIn('f_execucao_ref', a.execucao_ref))) +
    '<div style="margin-top:10px;">' + dCampo('Observações', '<textarea id="f_observacoes" oninput="descMudou()" rows="2" style="width:100%;padding:6px 8px;border:1px solid #ced4da;border-radius:4px;box-sizing:border-box;">' + dEsc(a.observacoes) + '</textarea>') + '</div>');
  const ev = DESC.eventos.length ? dCartao('Histórico', DESC.eventos.slice().reverse().map(function (e) { return '<div style="font-size:0.78rem;padding:2px 0;color:#495057;">' + dEsc(String(e.quando).slice(0, 16).replace('T', ' ')) + ' — ' + dEsc(e.usuario) + ' ' + dEsc(e.evento) + (e.detalhe ? ': ' + dEsc(e.detalhe) : '') + '</div>'; }).join('')) : '';
  return '<div style="margin-bottom:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><button class="btn btn-secondary btn-sm" onclick="descVoltar()"><i class="ti ti-arrow-left"></i> Voltar</button><button class="btn btn-secondary btn-sm" onclick="descLerFicha();DESC.modo=\'fluxo\';descEntrarPasso();descDesenhar()">Voltar ao passo a passo</button><button class="btn btn-primary btn-sm" onclick="descSalvar()"><i class="ti ti-device-floppy"></i> Salvar</button>' +
    '<button class="btn btn-secondary btn-sm" onclick="descTexto(\'notificacao\')">Gerar notificação</button><button class="btn btn-secondary btn-sm" onclick="descTexto(\'ata\')">Gerar Ata</button><button class="btn btn-secondary btn-sm" onclick="descTexto(\'recurso\')">Gerar análise de recurso</button><span id="d_sujo" style="font-size:0.78rem;color:#842029;"></span></div>' +
    '<div id="d_resumo"></div>' + dados + parecer + notif + dCartao('Apontamentos do parecer', '<div id="d_itens"></div><div style="margin-top:8px;display:flex;gap:8px;"><button class="btn btn-secondary btn-sm" onclick="descAddItem(\'producao\')">+ Produção</button><button class="btn btn-secondary btn-sm" onclick="descAddItem(\'qualidade\')">+ Qualidade</button><button class="btn btn-secondary btn-sm" onclick="descSugerirTodas()"><i class="ti ti-wand"></i> Sugerir decisão de todos</button></div><p style="font-size:0.74rem;color:#6c757d;margin:8px 0 0;">Acatado = a defesa da OSS foi acatada e o apontamento cai. Não acatado = a defesa não foi acatada (ou não houve) e o apontamento é mantido. Em produção, a compensação feita dentro do prazo também abate o valor.</p>') + julg + rec +
    '<div id="d_texto"></div>' + ev;
}
function descLerFicha() {
  const a = DESC.atual, g = function (id) { const e = document.getElementById('f_' + id); return e ? e.value : ''; };
  ['unidade', 'nome_oss', 'parecer_numero', 'tipo', 'sigla_oss', 'contrato', 'cnes', 'ano', 'trimestre', 'sei_processo', 'parecer_sei', 'parecer_data', 'base_legal_conferida', 'notificacao_envio', 'ciencia_data', 'defesa', 'defesa_data', 'grupo_tecnico_data', 'comissao_data', 'ata_revisada', 'ata_sei', 'ata_envio_oss', 'ata_ciencia_data', 'envio_gafcg', 'recurso', 'recurso_data', 'recurso_decisao_data', 'execucao_tipo', 'execucao_data', 'execucao_ref', 'observacoes'].forEach(function (c) { if (document.getElementById('f_' + c)) a[c] = g(c); });
  DESC.itens.forEach(function (it, i) { ['indicador', 'valor_apontado', 'valor_compensado', 'data_compensacao', 'prazo_compensacao', 'decisao', 'justificativa_decisao', 'fonte_externa', 'chave_externa', 'valor_informado', 'valor_referencia', 'valor_acatado', 'meta_trimestre', 'realizado_1', 'realizado_2', 'realizado_3', 'pct_parecer', 'resumo_defesa', 'analise_tecnica', 'fundamentacao_juridica', 'julgamento_revisado'].forEach(function (c) { const e = document.getElementById('i_' + c + '_' + i); if (e) it[c] = e.value; }); });
}
function descMudou() { DESC._sujo = true; const s = document.getElementById('d_sujo'); if (s) s.textContent = 'Alterações não salvas'; clearTimeout(window._dr); window._dr = setTimeout(descRecalcular, 250); }
function descAddItem(tipo) { descLerFicha(); DESC.itens.push({ tipo: tipo, indicador: '', valor_apontado: '', decisao: '' }); DESC._redesenharItens = true; descRecalcular(); descMudou(); }
function descRemItem(i) { descLerFicha(); DESC.itens.splice(i, 1); DESC._redesenharItens = true; descRecalcular(); descMudou(); }
function descRecalcular() {
  const a = DESC.atual; if (!a || DESC.aba !== 'ficha') return;
  if (!DESC._redesenharItens) descLerFicha(); // quando a lista vai ser redesenhada, o modelo em memória é a fonte da verdade
  const pm = dPmapa(), f = calcularFicha(a, DESC.itens, pm, null, descFichaMapaUnidade()), t = f.totais;
  // prazos
  const p = f.prazos, pz = document.getElementById('d_prazos');
  if (pz) pz.innerHTML = '<div style="font-size:0.82rem;background:#f8f9fa;border-radius:6px;padding:8px 10px;">' + (p.ciencia ? 'Ciência ' + (p.ciencia_presumida ? '<em>presumida</em>' : 'registrada') + ' em <strong>' + dBr(p.ciencia) + '</strong> · prazo de defesa até <strong>' + dBr(p.prazo_defesa) + '</strong> (' + pm.dias_defesa + ' dias úteis' + (pm.feriados_extras ? '' : '; só feriados nacionais') + ')' : 'Informe a data de envio da notificação para calcular o prazo.') + '</div>';
  // resumo
  const cor = { erro: '#f8d7da', aviso: '#fff3cd', info: '#e7f1ff' };
  const rs = document.getElementById('d_resumo');
  const aa = document.getElementById('d_alerta_ata'); if (aa) { const pend = DESC.itens.filter(function (x) { return !x.decisao; }).length; aa.innerHTML = pend ? '<div style="background:#f8d7da;border-radius:6px;padding:8px 12px;font-size:0.84rem;margin-bottom:10px;">' + pend + ' apontamento(s) ainda sem decisão. Volte ao passo 6 antes de gerar a Ata.</div>' : ''; }
  if (rs) rs.innerHTML = '<div style="background:#fff;border:1px solid #dee2e6;border-left:4px solid #5c636a;border-radius:8px;padding:14px;margin-bottom:14px;"><div style="display:flex;gap:22px;flex-wrap:wrap;margin-bottom:8px;">' +
    [['Produção apontada', brl(t.prod.apontado)], ['Compensado', brl(t.prod.compensado)], ['Qualidade apontada', brl(t.qual.apontado)], ['Valor a descontar', '<strong style="font-size:1.1rem;">' + brl(f.a_descontar) + '</strong>']].map(function (k) { return '<div><div style="font-size:0.7rem;color:#6c757d;">' + k[0] + '</div><div>' + k[1] + '</div></div>'; }).join('') + '</div>' +
    '<div style="font-size:0.85rem;"><strong>Próxima ação:</strong> ' + dEsc(f.proxima_acao) + '</div>' +
    (t.pct_qualidade_sobre_producao !== null ? '<div style="font-size:0.74rem;color:#6c757d;margin-top:2px;">Qualidade equivale a ' + t.pct_qualidade_sobre_producao + '% da produção apontada.</div>' : '') +
    (f.alertas.length ? '<div style="margin-top:8px;">' + f.alertas.map(function (x) { return '<div style="background:' + cor[x.nivel] + ';border-radius:4px;padding:5px 9px;font-size:0.8rem;margin-top:4px;">' + dEsc(x.msg) + '</div>'; }).join('') + '</div>' : '') + '</div>';
  // itens: só redesenha a lista quando a estrutura muda; senão atualiza os valores no lugar (não tira o cursor do campo)
  const box = document.getElementById('d_itens'); if (!box) return;
  if (!DESC._redesenharItens && box.children.length === DESC.itens.length && DESC.itens.length) {
    DESC.itens.forEach(function (it, i) { descAtualizarPct(i); const l = t.linhas[i] || {}, e = document.getElementById('i_efet_' + i); if (e) e.innerHTML = 'A descontar neste apontamento: <strong>' + brl(l.efetivado || 0) + '</strong>' + (l.fora_prazo_compensacao ? ' <span style="color:#842029;">· fora do prazo de compensação</span>' : '') + (l.comp_fora_prazo ? ' <span style="color:#664d03;">· compensação fora do prazo</span>' : ''); const m = document.getElementById('i_ext_msg_' + i); if (m && it.valor_referencia !== '' && it.valor_referencia !== undefined && !/Faltam|Não há/.test(m.textContent)) m.innerHTML = descMsgExterno(it); });
    return;
  }
  DESC._redesenharItens = false;
  if (!DESC.itens.length) { box.innerHTML = '<p style="color:#6c757d;font-size:0.85rem;margin:0;">Nenhum apontamento. Use os botões abaixo.</p>'; return; }
  const trim = [1, 2, 3].map(function (k) { return a.ano + '-' + String((+a.trimestre - 1) * 3 + k).padStart(2, '0'); });
  box.innerHTML = DESC.itens.map(function (it, i) { return descHtmlItem(it, i, t, DESC.modoItens || 'todos'); }).join('');
  DESC.itens.forEach(function (it, i) { descAtualizarPct(i); });
}
function descHtmlItem(it, i, t, modo) {
  const a = DESC.atual, l = t.linhas[i] || {}, prod = it.tipo === 'producao';
  const ta = function (id, v, rows) { return '<textarea id="i_' + id + '_' + i + '" rows="' + rows + '" oninput="descMudou()" style="width:100%;padding:6px 8px;border:1px solid #ced4da;border-radius:4px;font-size:0.85rem;box-sizing:border-box;">' + dEsc(v) + '</textarea>'; };
  const efet = '<div id="i_efet_' + i + '" style="font-size:0.8rem;margin-top:8px;">A descontar neste apontamento: <strong>' + brl(l.efetivado || 0) + '</strong>' + (l.fora_prazo_compensacao ? ' <span style="color:#842029;">· fora do prazo de compensação</span>' : '') + (l.comp_fora_prazo ? ' <span style="color:#664d03;">· compensação fora do prazo</span>' : '') + '</div>';
  const ext = '<details style="margin-top:8px;"><summary style="cursor:pointer;font-size:0.78rem;color:#495057;">Conferência com fonte externa (CNES, SIH, SIA)' + (it.fonte_externa ? ' — ' + dEsc(it.fonte_externa) : '') + '</summary><div style="margin-top:8px;">' + dGrade(150,
    dCampo('Fonte', dSel('i_fonte_externa_' + i, it.fonte_externa, [['', '—']].concat(DESC_FONTES.map(function (x) { return [x.fonte, x.nome]; })))) + dCampo('Chave do dado', dIn('i_chave_externa_' + i, it.chave_externa, 'text', 'placeholder="ex.: saidas"')) +
    dCampo('Valor informado pela unidade', dIn('i_valor_informado_' + i, it.valor_informado)) + dCampo('Valor na fonte', dIn('i_valor_referencia_' + i, it.valor_referencia)) +
    '<div style="align-self:end;"><button class="btn btn-secondary btn-sm" onclick="descBuscarRef(' + i + ')">Buscar nos dados importados</button></div>') +
    '<div id="i_ext_msg_' + i + '" style="font-size:0.8rem;margin-top:6px;">' + (it.valor_referencia !== '' && it.valor_referencia !== undefined ? descMsgExterno(it) : '') + '</div></div></details>';
  const sugPrazo = prod && !it.prazo_compensacao && a.ano && a.trimestre ? prazoCompensacaoSugerido(a.ano, a.trimestre, dPmapa().trimestres_compensacao) : '';
  const entrada = '<div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:8px;"><span class="rx-tag">' + (prod ? 'Produção' : 'Qualidade') + '</span><button class="btn btn-sm btn-secondary" onclick="descRemItem(' + i + ')" title="Remover"><i class="ti ti-trash"></i></button></div>' +
    dGrade(prod ? 150 : 190, dCampo('Indicador', dIn('i_indicador_' + i, it.indicador)) + dCampo('Valor apontado (R$)', dIn('i_valor_apontado_' + i, it.valor_apontado)) +
      (prod ? dCampo('Valor compensado (R$)', dIn('i_valor_compensado_' + i, it.valor_compensado)) + dCampo('Data da compensação', dIn('i_data_compensacao_' + i, it.data_compensacao, 'date')) + dCampo('Prazo para compensação', dIn('i_prazo_compensacao_' + i, it.prazo_compensacao, 'date')) : '')) +
    (prod ? '<div style="margin-top:10px;padding:10px;background:#f8f9fa;border-radius:6px;"><div style="font-size:0.78rem;font-weight:700;margin-bottom:6px;">Dados da meta (para conferir o atingimento)</div>' + dGrade(130,
      dCampo('Meta do trimestre', dIn('i_meta_trimestre_' + i, it.meta_trimestre)) + dCampo('Realizado mês 1', dIn('i_realizado_1_' + i, it.realizado_1)) + dCampo('Realizado mês 2', dIn('i_realizado_2_' + i, it.realizado_2)) + dCampo('Realizado mês 3', dIn('i_realizado_3_' + i, it.realizado_3)) + dCampo('% que consta no parecer', dIn('i_pct_parecer_' + i, it.pct_parecer))) +
      '<div id="i_pct_' + i + '" style="font-size:0.8rem;margin-top:6px;"></div>' + (sugPrazo ? '<div style="font-size:0.78rem;margin-top:4px;color:#495057;">Prazo de compensação sugerido: <strong>' + dBr(sugPrazo) + '</strong> (fim do ' + dPmapa().trimestres_compensacao + 'º trimestre seguinte; regra a confirmar) <button class="btn btn-secondary btn-sm" onclick="document.getElementById(\'i_prazo_compensacao_' + i + '\').value=\'' + sugPrazo + '\';descMudou()">Usar</button></div>' : '') + '</div>' : '');
  const textos = '<div style="margin-top:8px;">' + dCampo('Abertura da fundamentação', dIn('i_justificativa_decisao_' + i, it.justificativa_decisao)) + '</div><div style="margin-top:8px;">' + dCampo('Resumo do Recurso', ta('resumo_defesa', it.resumo_defesa, 3)) + '</div><div style="margin-top:8px;">' + dCampo('Análise Técnica e Probatória', ta('analise_tecnica', it.analise_tecnica, 5)) + '</div><div style="margin-top:8px;">' + dCampo('Fundamentação Jurídica e Contratual', ta('fundamentacao_juridica', it.fundamentacao_juridica, 4)) + '</div>';
  const botoesTexto = '<button class="btn btn-secondary btn-sm" onclick="descSugerir(' + i + ')"><i class="ti ti-wand"></i> Refazer proposta</button><button class="btn btn-secondary btn-sm" onclick="descIA(' + i + ')"><i class="ti ti-sparkles"></i> Redigir análise com IA</button><button class="btn btn-secondary btn-sm" onclick="descCopiarFund(' + i + ')"><i class="ti ti-copy"></i> Copiar texto completo</button>';
  const sel = function (v, rot, cor) { return '<button class="btn" style="flex:1;min-width:160px;padding:10px;font-weight:700;border:2px solid ' + (it.decisao === v ? cor : '#ced4da') + ';background:' + (it.decisao === v ? cor : '#fff') + ';color:' + (it.decisao === v ? '#fff' : '#495057') + ';" onclick="descDecidir(' + i + ',\'' + v + '\')">' + rot + '</button>'; };
  if (modo === 'entrada') return '<div style="border:1px solid #e9ecef;border-radius:6px;padding:10px;margin-bottom:10px;background:' + (l.fora_prazo_compensacao ? '#fff5f5' : '#fff') + ';">' + entrada + efet + ext + '</div>';
  const decisao = '<div id="i_avisos_' + i + '" style="margin:8px 0;">' + (it._avisos || []).map(function (x) { return '<div style="background:#fff3cd;border-radius:4px;padding:5px 9px;font-size:0.8rem;margin-top:4px;">' + dEsc(x) + '</div>'; }).join('') + '</div>' +
    '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0;">' + sel('acatado', 'Acatar a defesa (apontamento cai)', '#198754') + sel('nao_acatado', 'Não acatar (apontamento mantido)', '#842029') + '</div>' +
    (it.decisao === 'acatado' ? '<div style="max-width:260px;margin-bottom:8px;">' + dCampo('Valor acatado (R$)', dIn('i_valor_acatado_' + i, it.valor_acatado), 'vazio = tudo') + '</div>' : '') +
    '<details ' + (it._abrir ? 'open' : '') + ' style="margin-top:6px;"><summary style="cursor:pointer;font-size:0.82rem;font-weight:700;">Texto da decisão' + (it._proposto ? ' <span class="badge-status" style="background:#e7f1ff;color:#084298;">proposta automática: revise</span>' : '') + '</summary><div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' + botoesTexto + '</div>' + textos + '</details>' +
    '<div style="max-width:220px;margin-top:8px;">' + dCampo('Julgamento revisado?', dSel('i_julgamento_revisado_' + i, it.julgamento_revisado, SIM_NAO)) + '</div>' + efet;
  if (modo === 'decisao') return '<div style="border:1px solid #dee2e6;border-radius:8px;padding:14px;margin-bottom:12px;background:#fff;border-left:4px solid ' + (it.decisao === 'acatado' ? '#198754' : it.decisao === 'nao_acatado' ? '#842029' : '#ced4da') + ';"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;"><div><span class="rx-tag">' + (prod ? 'Produção' : 'Qualidade') + '</span> <strong>' + dEsc(it.indicador || '(sem nome)') + '</strong></div><div style="font-size:0.9rem;">Apontado: <strong>' + brl(num(it.valor_apontado)) + '</strong></div></div>' + (prod ? '<div id="i_pct_' + i + '" style="font-size:0.8rem;margin-top:4px;"></div>' : '') + decisao + '</div>';
  return '<div style="border:1px solid #e9ecef;border-radius:6px;padding:10px;margin-bottom:10px;background:#fff;">' + entrada + decisao.replace(efet, '') + efet + ext + '</div>';
}
function descAtualizarPct(i) {
  const it = DESC.itens[i], e = document.getElementById('i_pct_' + i); if (!e || it.tipo !== 'producao') return;
  const pp = percProducao(it), lim = +descFichaMapaUnidade().piso_producao_pct || +dPmapa().limiar_producao_pct || 85;
  e.innerHTML = pp.pct === null ? '<span style="color:#6c757d;">Informe a meta e os 3 meses (ou o % do parecer) para conferir.</span>' : 'Atingimento no trimestre: <strong>' + String(pp.pct).replace('.', ',') + '%</strong> ' + (pp.pct < lim ? '(abaixo de ' + lim + '%: apontamento cabível)' : '<span style="color:#842029;">(igual ou acima de ' + lim + '%: apontamento pode estar indevido)</span>') + (pp.diverge ? ' <span style="color:#664d03;">· difere do % do parecer (' + String(pp.parecer).replace('.', ',') + '%)</span>' : '');
}
function descSugerir(i, silencioso) {
  descLerFicha(); const it = DESC.itens[i], r = sugerirDecisao(DESC.atual, it, dPmapa(), null, descFichaMapaUnidade());
  const tem = it.resumo_defesa || it.analise_tecnica || it.justificativa_decisao;
  if (tem && !silencioso && !confirm('Já há texto de fundamentação neste apontamento. Substituir pelo rascunho sugerido?')) return;
  if (r.abertura || r.resumo || r.analise) { it.justificativa_decisao = r.abertura; it.resumo_defesa = r.resumo; it.analise_tecnica = r.analise; }
  it.fundamentacao_juridica = r.juridica;
  if (r.decisao) it.decisao = r.decisao;
  it._avisos = r.avisos; it._proposto = true; it._abrir = true;
  DESC._redesenharItens = true; descRecalcular();
  descMudou();
}
function descCopiarFund(i) { descLerFicha(); const t = textoFundamentacao(DESC.itens[i]); const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); mostrarToast('Texto copiado no formato da ficha.'); } catch (e) { mostrarToast('Não consegui copiar.'); } ta.remove(); }
function descSugerirTodas() { descLerFicha(); if (!DESC.itens.length) { mostrarToast('Não há apontamentos.'); return; } if (!confirm('Montar o rascunho de decisão de todos os apontamentos? Textos já escritos serão substituídos.')) return; DESC.itens.forEach(function (_, i) { descSugerir(i, true); }); }
async function descIA(i) {
  descLerFicha(); const a = DESC.atual, it = DESC.itens[i];
  if (typeof invocarIAComFallback !== 'function') { mostrarToast('A IA não está disponível nesta tela.'); return; }
  let defesa = DESC._defesa || '';
  if (!defesa && sim(a.defesa)) { defesa = prompt('Cole aqui o texto da defesa da OSS. Ele é enviado à IA; não inclua dados pessoais.', '') || ''; if (!defesa) return; DESC._defesa = defesa; }
  const fmIA = descFichaMapaUnidade();
  const base = sugerirDecisao(a, it, dPmapa(), null, fmIA), pp = it.tipo === 'producao' ? percProducao(it) : null;
  const prompt_ = 'Você ajuda a redigir a análise de uma decisão sobre desconto em Contrato de Gestão de saúde (SES-PE). Use SOMENTE os fatos abaixo; não invente números, artigos nem documentos. Se faltar informação, escreva [informar].\n\n' +
    'Unidade: ' + a.unidade + ' | OSS: ' + (a.sigla_oss || '[informar]') + ' | Contrato: ' + (a.contrato || '[informar]') + ' | Período: ' + a.trimestre + 'º trimestre de ' + a.ano + '\nIndicador (' + it.tipo + '): ' + it.indicador + ' | Valor apontado: ' + brl(num(it.valor_apontado)) + '\nParecer: ' + (a.parecer_numero ? 'Parecer Técnico CTAI nº ' + a.parecer_numero : '[informar]') + '\n' +
    (pp && pp.pct !== null ? 'Atingimento apurado: ' + pp.pct + '% da meta (mínimo ' + (fmIA.piso_producao_pct || dPmapa().limiar_producao_pct) + '% neste contrato)\n' : '') + (a.defesa_data ? 'Defesa apresentada em ' + a.defesa_data + ' (prazo até ' + (calcularPrazos(a, dPmapa()).prazo_defesa || '?') + ')\n' : '') +
    '\nTEXTO DA DEFESA DA OSS:\n' + (defesa || '(não houve defesa)') + '\n\nFUNDAMENTO JURÍDICO JÁ DEFINIDO (não altere):\n' + base.juridica + '\n\nResponda em português formal, exatamente neste formato:\nRESUMO: <resumo objetivo da defesa em até 5 linhas>\nANÁLISE: <análise técnica e probatória confrontando cada argumento com os fatos acima>\nSUGESTÃO: <ACATAR ou NÃO ACATAR a defesa, com uma frase de motivo>';
  mostrarToast('Consultando a IA…', 8000);
  let txt; try { txt = await invocarIAComFallback(prompt_, true); } catch (e) { mostrarToast('A IA não respondeu: ' + (e.message || e)); return; }
  txt = String(txt || ''); const m1 = /RESUMO:\s*([\s\S]*?)\n\s*AN[ÁA]LISE:/i.exec(txt), m2 = /AN[ÁA]LISE:\s*([\s\S]*?)\n\s*SUGEST[ÃA]O:/i.exec(txt), m3 = /SUGEST[ÃA]O:\s*([\s\S]*)$/i.exec(txt);
  if (!m1 || !m2) { mostrarToast('A IA respondeu fora do formato; nada foi alterado.'); return; }
  it.justificativa_decisao = base.abertura; it.resumo_defesa = m1[1].trim(); it.analise_tecnica = m2[1].trim(); it.fundamentacao_juridica = base.juridica;
  DESC._redesenharItens = true; descRecalcular();
  it._avisos = ['A IA sugere: ' + (m3 ? m3[1].trim() : '—') + '. A decisão é sua: ajuste os textos e escolha acatar ou não.']; it._abrir = true;
  DESC._redesenharItens = true; descRecalcular();
  descMudou();
}
function descMsgExterno(it) { const c = compararExterno(it.valor_informado !== '' && it.valor_informado !== undefined ? it.valor_informado : it.valor_apontado, it.valor_referencia, dPmapa().tolerancia_externa_pct); return '<span style="color:' + (c.ok === false ? '#842029' : '#0f5132') + ';">' + dEsc(c.msg) + '</span>'; }
async function descBuscarRef(i) {
  descLerFicha(); const it = DESC.itens[i], a = DESC.atual, m = document.getElementById('i_ext_msg_' + i);
  if (!a.cnes || !it.fonte_externa || !it.chave_externa) { m.innerHTML = 'Preencha o CNES da unidade, a fonte e a chave do dado.'; return; }
  const comps = [1, 2, 3].map(function (k) { return a.ano + '-' + String((+a.trimestre - 1) * 3 + k).padStart(2, '0'); });
  const r = await api('descontos/ref-consultar', { cnes: a.cnes, fonte: it.fonte_externa, chave: it.chave_externa, competencias: comps });
  if (!r.ok) { m.innerHTML = dEsc(r.erro); return; }
  const achadas = r.referencias.map(function (x) { return x.competencia; }), falta = comps.filter(function (c) { return achadas.indexOf(c) === -1; });
  if (!achadas.length) { m.innerHTML = '<span style="color:#842029;">Não há dado de ' + dEsc(it.fonte_externa) + ' para o CNES ' + dEsc(a.cnes) + ' em ' + comps.join(', ') + '. Baixe manualmente e importe na aba "Fontes externas".</span>'; return; }
  const soma = r.referencias.reduce(function (s, x) { return s + num(x.valor); }, 0);
  document.getElementById('i_valor_referencia_' + i).value = r2(soma);
  it.valor_referencia = r2(soma);
  m.innerHTML = (falta.length ? '<span style="color:#664d03;">Faltam competências: ' + falta.join(', ') + '. A soma abaixo é parcial.</span><br>' : '') + descMsgExterno(it);
  descMudou();
}
async function descSalvar(silencioso) {
  descLerFicha();
  const r = await api('descontos/salvar', { registro: DESC.atual, itens: DESC.itens });
  if (!r.ok) { mostrarToast(r.erro || 'Não salvou.'); return false; }
  DESC.atual.id = r.id; DESC._sujo = false; const s = document.getElementById('d_sujo'); if (s) s.textContent = ''; if (!silencioso) mostrarToast('Salvo.');
  return true;
}
async function descVoltar() { if (DESC._sujo && !confirm('Há alterações não salvas. Sair mesmo assim?')) return; DESC._sujo = false; await renderDescontos(); }
function descTexto(tipo) {
  descLerFicha(); const a = DESC.atual, pm = dPmapa(), f = calcularFicha(a, DESC.itens, pm, null, descFichaMapaUnidade());
  const campo = 'texto_' + tipo, existente = a[campo];
  let txt = existente;
  if (!txt || confirm('Já existe um texto salvo. Gerar de novo e substituir o rascunho na tela?')) txt = tipo === 'ata' ? gerarAta(a, DESC.itens, f, pm) : tipo === 'recurso' ? gerarAnaliseRecurso(a, DESC.itens, f, pm) : gerarNotificacao(a, DESC.itens, f, pm);
  a[campo] = txt;
  const nome = { notificacao: 'Notificação', ata: 'Ata de julgamento', recurso: 'Análise de recurso' }[tipo];
  document.getElementById('d_texto').innerHTML = dCartao(nome + ' (rascunho para revisão)', '<p style="font-size:0.78rem;color:#6c757d;margin:0 0 8px;">O texto é montado com os dados da ficha. O que não foi preenchido fica entre [colchetes]. Modelo provisório: ajuste ao padrão oficial da DGMCG.</p><textarea id="d_txt_area" rows="22" oninput="DESC.atual.' + campo + '=this.value;descMudou()" style="width:100%;padding:10px;border:1px solid #ced4da;border-radius:6px;font-family:Arial,sans-serif;font-size:0.88rem;line-height:1.5;box-sizing:border-box;">' + dEsc(txt) + '</textarea><div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-sm btn-primary" onclick="descSalvar()">Salvar texto</button><button class="btn btn-sm btn-secondary" onclick="descCopiarTexto()">Copiar</button><button class="btn btn-sm btn-secondary" onclick="descBaixarDoc(\'' + tipo + '\')">Baixar .doc</button></div>');
  document.getElementById('d_texto').scrollIntoView({ behavior: 'smooth' }); descMudou();
}
function descCopiarTexto() { const t = document.getElementById('d_txt_area'); if (!t) return; t.select(); try { document.execCommand('copy'); mostrarToast('Texto copiado.'); } catch (e) { mostrarToast('Selecione e copie manualmente.'); } }
function descBaixarDoc(tipo) {
  const t = (document.getElementById('d_txt_area') || {}).value || '', a = DESC.atual;
  const html = '<html><head><meta charset="utf-8"></head><body style="font-family:Arial;font-size:12pt">' + t.split('\n').map(function (l) { return '<p style="margin:0 0 6pt">' + (dEsc(l) || '&nbsp;') + '</p>'; }).join('') + '</body></html>';
  const blob = new Blob(['﻿', html], { type: 'application/msword' }), u = URL.createObjectURL(blob), el = document.createElement('a');
  el.href = u; el.download = tipo + '_' + String(a.unidade || 'unidade').replace(/[^\w]+/g, '_') + '_' + a.ano + 'T' + a.trimestre + '.doc'; document.body.appendChild(el); el.click(); el.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
}

// ---------- FLUXO GUIADO (passo a passo) ----------
// Unidades conhecidas (conferidas na tela do AppSheet, 4º tri/2024); o sistema também aprende com os registros já lançados.
var DESC_CATALOGO = [
  { unidade: 'Hospital Dom Malan', tipo: 'HOSPITAL', contrato: '027/2022' }, { unidade: 'Hospital Dom Helder Câmara', tipo: 'HOSPITAL', contrato: '018/2022' },
  { unidade: 'Hospital Miguel Arraes', tipo: 'HOSPITAL', contrato: '023/2022' }, { unidade: 'Hospital Pelópidas da Silveira', tipo: 'HOSPITAL', contrato: '017/2022' },
  { unidade: 'Hospital Mestre Vitalino', tipo: 'HOSPITAL', contrato: 'EMERGENCIAL' }, { unidade: 'Hospital Nossa Senhora das Graças', tipo: 'HOSPITAL', contrato: '024/2022', sigla_oss: 'FGH', nome_oss: 'Fundação Gestão Hospitalar Martiniano Fernandes', cnes: '' },
  { unidade: 'Hospital Regional Emília Câmara', tipo: 'HOSPITAL', contrato: '002/2017' }, { unidade: 'Hospital Ermírio Coutinho', tipo: 'HOSPITAL', contrato: '014/2022' },
  { unidade: 'Hospital João Murilo de Oliveira', tipo: 'HOSPITAL', contrato: '026/2022' }, { unidade: 'Hospital Regional Ruy de Barros Correia', tipo: 'HOSPITAL', contrato: '001/2016' },
  { unidade: 'Hospital Sílvio Magalhães', tipo: 'HOSPITAL', contrato: '019/2022' }, { unidade: 'Hospital Regional Fernando Bezerra', tipo: 'HOSPITAL', contrato: '002/2021' },
  { unidade: 'UPA Igarassu', tipo: 'UPA', contrato: '002/2022' }, { unidade: 'UPA Caxangá', tipo: 'UPA', contrato: '007/2022' }, { unidade: 'UPA Curado', tipo: 'UPA', contrato: '004/2022' },
  { unidade: 'UPA Engenho Velho', tipo: 'UPA', contrato: '010/2022' }, { unidade: 'UPA Ibura', tipo: 'UPA', contrato: '015/2022' }, { unidade: 'UPA Olinda', tipo: 'UPA', contrato: '001/2022' }
];
var DESC_PASSOS = [
  { id: 'unidade', nome: 'Unidade e período', ic: 'ti-building-hospital' }, { id: 'contrato', nome: 'Contrato e aditivos', ic: 'ti-file-certificate' },
  { id: 'parecer', nome: 'Parecer e apontamentos', ic: 'ti-file-analytics' },
  { id: 'notificacao', nome: 'Notificação à OSS', ic: 'ti-send' }, { id: 'defesa', nome: 'Defesa da OSS', ic: 'ti-shield-check' },
  { id: 'decisao', nome: 'Decisão: acatar ou não', ic: 'ti-scale' }, { id: 'ata', nome: 'Ata e envio', ic: 'ti-file-text' }, { id: 'fim', nome: 'Recurso e execução', ic: 'ti-flag-check' }
];
function descFichaMapaUnidade() { return fichaMapa(DESC.fichaCampos || []); }
function descStatusPassos() {
  const a = DESC.atual, it = DESC.itens, f = calcularFicha(a, it, dPmapa(), null, descFichaMapaUnidade()), p = f.prazos, hoje = dParse(dIso(new Date()));
  const decidido = it.length > 0 && it.every(function (x) { return x.decisao; });
  const revisada = sim(a.ata_revisada) || (it.length > 0 && it.every(function (x) { return sim(x.julgamento_revisado); }));
  return [
    !!(a.unidade && a.ano && a.trimestre && a.sei_processo),
    String(descFichaMapaUnidade().ficha_conferida) === 'sim',
    it.length > 0 && !!a.parecer_numero,
    !!a.notificacao_envio,
    sim(a.defesa) || nao(a.defesa) || (p.prazo_defesa && hoje > dParse(p.prazo_defesa)),
    decidido,
    revisada && !!a.ata_envio_oss && !!a.envio_gafcg,
    (nao(a.recurso) || !!a.recurso_decisao_data) && !!a.execucao_data
  ];
}
function descPrimeiroPendente() { const s = descStatusPassos(); const k = s.indexOf(false); return k === -1 ? s.length - 1 : k; }
function descHtmlFluxo() {
  const a = DESC.atual, st = descStatusPassos(), p = DESC.passo;
  const lateral = DESC_PASSOS.map(function (x, k) {
    const feito = st[k], atual = k === p;
    return '<a href="#" onclick="descIrPasso(' + k + ',true);return false;" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:8px;text-decoration:none;color:' + (atual ? '#fff' : '#343a40') + ';background:' + (atual ? '#5c636a' : 'transparent') + ';margin-bottom:2px;font-size:0.86rem;"><span style="width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:0.78rem;flex:none;background:' + (feito ? '#198754' : atual ? 'rgba(255,255,255,0.25)' : '#e9ecef') + ';color:' + (feito || atual ? '#fff' : '#6c757d') + ';">' + (feito ? '✓' : (k + 1)) + '</span>' + dEsc(x.nome) + '</a>';
  }).join('');
  const titulo = a.unidade ? '<div style="font-size:0.78rem;color:#6c757d;margin:0 0 8px 4px;">' + dEsc(a.unidade) + ' · ' + a.ano + ' T' + a.trimestre + '</div>' : '';
  const rodape = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px;"><button class="btn btn-secondary btn-sm" ' + (p === 0 ? 'disabled' : '') + ' onclick="descIrPasso(' + (p - 1) + ',true)"><i class="ti ti-arrow-left"></i> Passo anterior</button><button class="btn btn-secondary btn-sm" onclick="descSalvar()"><i class="ti ti-device-floppy"></i> Salvar</button>' +
    (p < DESC_PASSOS.length - 1 ? '<button class="btn btn-primary" onclick="descContinuar()">Salvar e continuar <i class="ti ti-arrow-right"></i></button>' : '<button class="btn btn-primary" onclick="descConcluir()"><i class="ti ti-check"></i> Salvar e concluir</button>') + '<span id="d_sujo" style="font-size:0.78rem;color:#842029;align-self:center;"></span></div>';
  return '<div style="margin-bottom:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;"><button class="btn btn-secondary btn-sm" onclick="descVoltar()"><i class="ti ti-arrow-left"></i> Lista</button><button class="btn btn-secondary btn-sm" onclick="descModoCompleto()">Ver ficha completa</button></div>' +
    '<div id="d_resumo"></div>' +
    '<div style="display:grid;grid-template-columns:minmax(200px,250px) 1fr;gap:18px;align-items:start;" class="desc-fluxo"><div style="background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:12px;position:sticky;top:8px;"><div style="font-size:0.72rem;color:#6c757d;font-weight:700;text-transform:uppercase;margin:0 0 6px 4px;">Fluxo do desconto</div>' + titulo + lateral + '</div>' +
    '<div><div style="background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:18px;margin-bottom:12px;"><h3 style="margin:0 0 4px;font-size:1.05rem;"><i class="ti ' + DESC_PASSOS[p].ic + '"></i> ' + (p + 1) + '. ' + DESC_PASSOS[p].nome + '</h3><div style="font-size:0.82rem;color:#6c757d;margin-bottom:14px;">' + descAjudaPasso(p) + '</div>' + descCorpoPasso(p) + '</div>' + rodape + '</div></div>' +
    '<style>@media(max-width:820px){.desc-fluxo{grid-template-columns:1fr !important}}</style>';
}
function descAjudaPasso(p) {
  return ['Informe a unidade e o trimestre. O restante preenche sozinho quando a unidade já é conhecida.',
    'Cada unidade é um caso: anexe o contrato e os aditivos para o sistema preencher a ficha de parâmetros (piso, prazos, cláusulas). Confira cada valor e a origem antes de seguir.',
    'Leia o parecer da CTAI e lance os apontamentos. Dá para trazê-los automaticamente do arquivo do parecer.',
    'Registre o envio da notificação; o prazo de defesa é calculado em dias úteis.',
    'A OSS apresentou defesa? Para cada apontamento, o sistema mostra o roteiro de conferência de dados do tipo daquele indicador.',
    'Para cada apontamento, acate a defesa ou não. A proposta de decisão já vem escrita; revise e ajuste.', 'Gere a Ata, revise o julgamento e registre os envios à OSS e à GAFCG.', 'Acompanhe o recurso da OSS e a execução do desconto (LE/OB) com a GAOCG.'][p];
}
function descCorpoPasso(p) {
  const a = DESC.atual;
  if (p === 0) return '<datalist id="d_lista_unid">' + descUnidadesConhecidas().map(function (x) { return '<option value="' + dEsc(x.unidade) + '">'; }).join('') + '</datalist>' + dGrade(200,
    dCampo('Unidade', dIn('f_unidade', a.unidade, 'text', 'list="d_lista_unid" onchange="descAutoUnidade()"'), 'comece a digitar o nome') + dCampo('Tipo', dSel('f_tipo', a.tipo, [['HOSPITAL', 'Hospital'], ['UPA', 'UPA'], ['UPAE', 'UPAE'], ['OUTRO', 'Outro']])) +
    dCampo('Ano', dIn('f_ano', a.ano, 'number')) + dCampo('Trimestre', dSel('f_trimestre', a.trimestre, [[1, '1º'], [2, '2º'], [3, '3º'], [4, '4º']])) +
    dCampo('Processo SEI do desconto', dIn('f_sei_processo', a.sei_processo, 'text', 'placeholder="0000000000.000000/0000-00"')) + dCampo('Contrato de Gestão (C.G)', dIn('f_contrato', a.contrato, 'text', 'placeholder="ex.: 024/2022"')) +
    dCampo('OSS (nome completo)', dIn('f_nome_oss', a.nome_oss, 'text', 'placeholder="ex.: Fundação Gestão Hospitalar Martiniano Fernandes"')) + dCampo('Sigla da OSS', dIn('f_sigla_oss', a.sigla_oss)) + dCampo('CNES', dIn('f_cnes', a.cnes, 'text', 'placeholder="7 dígitos"'), 'para as conferências externas'));
  if (p === 1) return descCorpoContrato();
  if (p === 2) return descHtmlBanco() + dGrade(200, dCampo('Nº do parecer da CTAI', dIn('f_parecer_numero', a.parecer_numero, 'text', 'placeholder="ex.: 048/2025"')) + dCampo('Documento SEI do parecer', dIn('f_parecer_sei', a.parecer_sei), 'número do documento, não só o processo') + dCampo('Data do parecer', dIn('f_parecer_data', a.parecer_data, 'date'))) +
    '<details style="margin:14px 0;background:#f8f9fa;border-radius:6px;padding:10px 12px;"><summary style="cursor:pointer;font-weight:700;font-size:0.88rem;"><i class="ti ti-wand"></i> Ler o parecer automaticamente (PDF, Word ou texto colado)</summary><div style="margin-top:10px;"><input type="file" id="d_parecer_arq" accept=".pdf,.docx,.doc,.txt,.html,.htm"><textarea id="d_parecer_txt" rows="3" placeholder="ou cole aqui o trecho do parecer com os apontamentos" style="width:100%;margin-top:8px;padding:8px;border:1px solid #ced4da;border-radius:4px;box-sizing:border-box;"></textarea><div style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="descLerParecer()">Ler apontamentos</button> <span id="d_parecer_st" style="font-size:0.8rem;color:#6c757d;"></span></div><div style="font-size:0.74rem;color:#6c757d;margin-top:6px;">A IA sugere os apontamentos e valores; confira cada um abaixo antes de seguir. Dados pessoais são mascarados antes do envio.</div></div></details>' +
    '<div id="d_itens"></div><div style="margin-top:8px;display:flex;gap:8px;"><button class="btn btn-secondary btn-sm" onclick="descAddItem(\'producao\')">+ Produção</button><button class="btn btn-secondary btn-sm" onclick="descAddItem(\'qualidade\')">+ Qualidade</button></div>';
  if (p === 3) return dGrade(200, dCampo('Base legal conferida com o contrato vigente?', dSel('f_base_legal_conferida', a.base_legal_conferida, SIM_NAO)) + dCampo('Data de envio da notificação', dIn('f_notificacao_envio', a.notificacao_envio, 'date')) + dCampo('Ciência expressa da OSS', dIn('f_ciencia_data', a.ciencia_data, 'date'), 'vazio se não houve')) +
    '<div id="d_prazos" style="margin-top:10px;"></div><div style="margin-top:12px;"><button class="btn btn-secondary btn-sm" onclick="descTexto(\'notificacao\')"><i class="ti ti-file-text"></i> Gerar a notificação</button></div><div id="d_texto"></div>';
  if (p === 4) return dGrade(200, dCampo('A OSS apresentou defesa?', dSel('f_defesa', a.defesa, SIM_NAO)) + dCampo('Data da defesa', dIn('f_defesa_data', a.defesa_data, 'date'))) + '<div id="d_prazos" style="margin-top:10px;"></div>' +
    (sim(a.defesa) ? '<div style="margin-top:12px;">' + dCampo('Texto da defesa da OSS (opcional; usado só para a IA analisar, não fica salvo)', '<textarea id="d_defesa_txt" rows="6" oninput="DESC._defesa=this.value" style="width:100%;padding:8px;border:1px solid #ced4da;border-radius:4px;box-sizing:border-box;">' + dEsc(DESC._defesa || '') + '</textarea>') + '<div style="margin-top:8px;"><button class="btn btn-secondary btn-sm" onclick="descIATodos()"><i class="ti ti-sparkles"></i> Analisar todos os apontamentos com IA</button></div></div>'
      : nao(a.defesa) ? '<div style="margin-top:12px;background:#e7f1ff;border-radius:6px;padding:10px;font-size:0.85rem;">Sem defesa: no próximo passo o sistema propõe manter todos os apontamentos, com o texto no padrão das decisões anteriores.</div>' : '') +
    descHtmlRoteiros();
  if (p === 5) {
    const t = calcularTotais(DESC.itens, dIso(new Date())), n = { ac: 0, na: 0, pe: 0 };
    DESC.itens.forEach(function (x) { if (x.decisao === 'acatado') n.ac++; else if (x.decisao === 'nao_acatado') n.na++; else n.pe++; });
    return '<div id="d_dec_resumo" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;"><span class="badge-status" style="background:#d1e7dd;color:#0f5132;">' + n.ac + ' defesa(s) acatada(s)</span><span class="badge-status" style="background:#f8d7da;color:#842029;">' + n.na + ' não acatado(s)</span><span class="badge-status">' + n.pe + ' pendente(s)</span></div>' +
      (DESC.itens.length ? '' : '<p style="color:#6c757d;">Sem apontamentos. Volte ao passo 3.</p>') + '<div id="d_itens"></div>' + (DESC.itens.length ? '<div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn btn-secondary btn-sm" onclick="descSugerirTodas()"><i class="ti ti-wand"></i> Refazer propostas de todos</button><button class="btn btn-secondary btn-sm" onclick="descRevisarTodos()"><i class="ti ti-checks"></i> Marcar todos como revisados</button></div>' : '');
  }
  if (p === 6) return '<div id="d_alerta_ata"></div>' + dGrade(200, dCampo('Julgamento revisado (Ata)?', dSel('f_ata_revisada', a.ata_revisada, SIM_NAO), 'ou marque revisado em cada apontamento') + dCampo('Reunião da Comissão', dIn('f_comissao_data', a.comissao_data, 'date')) + dCampo('Pré-julgamento (Grupo Técnico / CASSCG)', dIn('f_grupo_tecnico_data', a.grupo_tecnico_data, 'date')) +
    dCampo('Documento SEI da Ata', dIn('f_ata_sei', a.ata_sei)) + dCampo('Ata enviada à OSS em', dIn('f_ata_envio_oss', a.ata_envio_oss, 'date')) + dCampo('Ciência da Ata pela OSS', dIn('f_ata_ciencia_data', a.ata_ciencia_data, 'date'), 'vazio se não houve') + dCampo('Processo enviado à GAFCG em', dIn('f_envio_gafcg', a.envio_gafcg, 'date'))) +
    '<div id="d_prazos" style="margin-top:10px;"></div><div style="margin-top:12px;"><button class="btn btn-secondary btn-sm" onclick="descTexto(\'ata\')"><i class="ti ti-file-text"></i> Gerar a Ata</button></div><div id="d_texto"></div>';
  return dGrade(200, dCampo('A OSS pediu recurso?', dSel('f_recurso', a.recurso, SIM_NAO)) + dCampo('Data do recurso', dIn('f_recurso_data', a.recurso_data, 'date')) + dCampo('Decisão do recurso em', dIn('f_recurso_decisao_data', a.recurso_decisao_data, 'date')) +
    dCampo('Execução (GAOCG)', dSel('f_execucao_tipo', a.execucao_tipo, [['', '—'], ['superavitario', 'Superavitário: deduz das parcelas'], ['deficitario', 'Deficitário: prestação de contas']])) + dCampo('Data da execução', dIn('f_execucao_data', a.execucao_data, 'date')) + dCampo('LE / OB', dIn('f_execucao_ref', a.execucao_ref))) +
    '<div id="d_prazos" style="margin-top:10px;"></div>' + (sim(a.recurso) ? '<div style="margin-top:12px;"><button class="btn btn-secondary btn-sm" onclick="descTexto(\'recurso\')"><i class="ti ti-file-text"></i> Gerar a análise de recurso</button></div><div id="d_texto"></div>' : '') +
    '<div style="margin-top:12px;">' + dCampo('Observações', '<textarea id="f_observacoes" oninput="descMudou()" rows="2" style="width:100%;padding:6px 8px;border:1px solid #ced4da;border-radius:4px;box-sizing:border-box;">' + dEsc(a.observacoes) + '</textarea>') + '</div>';
}
// ---------- PASSO 2: CONTRATO E ADITIVOS (ficha de parâmetros da unidade) ----------
function descFichaLocalPadrao() { return Object.keys(DESC_FICHA_PADRAO).map(function (k) { return { chave: k, rot: DESC_FICHA_PADRAO[k].rot, dica: DESC_FICHA_PADRAO[k].dica, padrao: DESC_FICHA_PADRAO[k].padrao, valor: DESC_FICHA_PADRAO[k].padrao, origem: '', confirmado: 'nao', salvo: false }; }); }
async function descCarregarFicha(forcar) {
  const a = DESC.atual;
  if (!a || !String(a.unidade || '').trim()) { DESC.fichaCampos = null; return; }
  if (DESC.fichaCampos && DESC._fichaUnidade === a.unidade && !forcar) return;
  const r = await api('descontos/ficha-obter', { unidade: a.unidade });
  if (r.ok) { DESC.fichaCampos = r.campos; DESC._fichaContrato = r.contrato || a.contrato || ''; }
  else { DESC.fichaCampos = DESC.fichaCampos || descFichaLocalPadrao(); if (r.erro && /rota|Rota|não existe/.test(r.erro)) mostrarToast('O servidor ainda não tem as rotas da ficha do contrato: cole o Code.gs novo e publique Nova versão.'); }
  DESC._fichaUnidade = a.unidade; DESC._fichaSuja = false;
}
function descLerFichaDom() {
  (DESC.fichaCampos || []).forEach(function (c, i) {
    const v = document.getElementById('ff_valor_' + i), o = document.getElementById('ff_origem_' + i), cf = document.getElementById('ff_conf_' + i);
    if (v) c.valor = v.value; if (o) c.origem = o.value; if (cf) c.confirmado = cf.value;
  });
  const g = document.getElementById('ff_conferida'); if (g) { const c = (DESC.fichaCampos || []).find(function (x) { return x.chave === 'ficha_conferida'; }); if (c) c.valor = g.value; }
}
function descFichaMudou() { descLerFichaDom(); DESC._fichaSuja = true; const s = document.getElementById('d_ficha_st'); if (s) s.textContent = 'Ficha com alterações não salvas.'; }
async function descSalvarFichaContrato(silencioso) {
  descLerFichaDom(); const a = DESC.atual;
  if (!String(a.unidade || '').trim()) { mostrarToast('Informe a unidade no passo 1.'); return false; }
  const r = await api('descontos/ficha-salvar', { unidade: a.unidade, contrato: a.contrato || DESC._fichaContrato || '', campos: (DESC.fichaCampos || []).map(function (c) { return { chave: c.chave, valor: c.valor, origem: c.origem, confirmado: c.confirmado }; }) });
  if (!r.ok) { mostrarToast(r.erro || 'Não salvou a ficha. O Code.gs novo já foi colado e publicado?'); return false; }
  DESC.fichaCampos = r.campos; DESC._fichaSuja = false; const s = document.getElementById('d_ficha_st'); if (s) s.textContent = '';
  if (!silencioso) mostrarToast('Ficha do contrato salva para ' + a.unidade + '.');
  return true;
}
function descCorpoContrato() {
  const a = DESC.atual;
  if (!String(a.unidade || '').trim()) return '<div style="background:#fff3cd;border-radius:6px;padding:12px;font-size:0.86rem;">Informe a unidade no passo 1 para abrir a ficha do contrato dela.</div>';
  if (!DESC.fichaCampos) { descCarregarFicha().then(function () { if (DESC.passo === 1) descDesenhar(); }); return '<p style="color:#6c757d;">Carregando a ficha do contrato de ' + dEsc(a.unidade) + '…</p>'; }
  const fm = descFichaMapaUnidade(), fora = fichaForaDaRegra(fm);
  const conferida = (DESC.fichaCampos.find(function (x) { return x.chave === 'ficha_conferida'; }) || {}).valor === 'sim';
  const ia = '<details style="margin:0 0 14px;background:#f8f9fa;border-radius:6px;padding:10px 12px;" ' + (conferida ? '' : 'open') + '><summary style="cursor:pointer;font-weight:700;font-size:0.88rem;"><i class="ti ti-wand"></i> Preencher a ficha lendo o contrato e os aditivos (PDF ou Word)</summary><div style="margin-top:10px;"><input type="file" id="d_contrato_arq" multiple accept=".pdf,.docx,.doc,.txt,.html,.htm"><div style="font-size:0.74rem;color:#6c757d;margin-top:4px;">Pode anexar vários arquivos de uma vez (contrato + termos aditivos). A IA preenche a ficha e anota de onde tirou cada valor; ela não inventa cláusula: o que não achar fica em branco.</div><div style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="descLerContrato()">Ler e preencher a ficha</button> <span id="d_contrato_st" style="font-size:0.8rem;color:#6c757d;"></span></div></div></details>';
  const linhas = DESC.fichaCampos.map(function (c, i) {
    if (c.chave === 'ficha_conferida') return '';
    const foraP = String(c.valor) !== String(c.padrao) && ['piso_producao_pct', 'dia_entrega_rm', 'compensacao_trimestres', 'pct_fixo', 'pct_producao', 'pct_qualidade'].indexOf(c.chave) > -1;
    return '<tr' + (foraP ? ' style="background:#fff3cd;"' : '') + '><td style="min-width:190px;"><strong style="font-size:0.82rem;">' + dEsc(c.rot) + '</strong>' + (foraP ? '<div style="font-size:0.7rem;color:#664d03;font-weight:700;">fora do padrão: confira com atenção</div>' : '') + '<div style="font-size:0.7rem;color:#6c757d;">' + dEsc(c.dica) + '</div></td>' +
      '<td style="min-width:150px;"><input id="ff_valor_' + i + '" value="' + dEsc(c.valor) + '" oninput="descFichaMudou()" style="width:100%;padding:6px;border:1px solid #ced4da;border-radius:4px;box-sizing:border-box;font-size:0.82rem;"></td>' +
      '<td style="min-width:170px;"><input id="ff_origem_' + i + '" value="' + dEsc(c.origem) + '" oninput="descFichaMudou()" placeholder="documento e cláusula" style="width:100%;padding:6px;border:1px solid #ced4da;border-radius:4px;box-sizing:border-box;font-size:0.82rem;"></td>' +
      '<td style="width:120px;"><select id="ff_conf_' + i + '" onchange="descFichaMudou()" style="width:100%;padding:6px;font-size:0.82rem;"><option value="nao"' + (c.confirmado !== 'sim' ? ' selected' : '') + '>A conferir</option><option value="sim"' + (c.confirmado === 'sim' ? ' selected' : '') + '>Conferido</option></select></td></tr>';
  }).join('');
  const idxConf = DESC.fichaCampos.findIndex(function (x) { return x.chave === 'ficha_conferida'; });
  const rodFicha = '<div style="margin-top:12px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">' +
    '<label style="font-size:0.85rem;font-weight:700;">Ficha conferida com o contrato? <select id="ff_conferida" onchange="descFichaMudou()" style="padding:6px;margin-left:6px;"><option value="nao"' + (conferida ? '' : ' selected') + '>Ainda não</option><option value="sim"' + (conferida ? ' selected' : '') + '>Sim, conferi</option></select></label>' +
    '<button class="btn btn-primary btn-sm" onclick="descSalvarFichaContrato()"><i class="ti ti-device-floppy"></i> Salvar ficha do contrato</button><span id="d_ficha_st" style="font-size:0.78rem;color:#842029;"></span></div>' +
    '<p style="font-size:0.74rem;color:#6c757d;margin:8px 0 0;">A ficha fica guardada por unidade: nos próximos trimestres ela já vem preenchida. Em "Origem", diga de onde o valor veio (ex.: Anexo Técnico II do CG 020/2022; 6º Termo Aditivo), para qualquer pessoa conferir sem adivinhar.</p>';
  const avisoFora = fora.length ? '<div style="background:#fff3cd;border-radius:6px;padding:10px 12px;font-size:0.82rem;margin:0 0 12px;"><strong>O que neste contrato foge da regra geral:</strong>' + fora.map(function (x) { return '<div style="margin-top:4px;">• ' + dEsc(x) + '</div>'; }).join('') + '</div>' : '';
  return ia + avisoFora + '<div style="overflow-x:auto;background:#fff;border:1px solid #dee2e6;border-radius:8px;"><table style="width:100%;border-collapse:collapse;" class="desc-tab"><thead><tr style="background:#f8f9fa;text-align:left;font-size:0.76rem;"><th style="padding:8px;">Parâmetro</th><th>Valor neste contrato</th><th>Origem (documento e cláusula)</th><th>Situação</th></tr></thead><tbody>' + linhas + '</tbody></table></div>' + rodFicha +
    '<style>.desc-tab td{padding:8px;border-top:1px solid #eef0f2;vertical-align:top}</style>';
}
async function descLerContrato() {
  const st = document.getElementById('d_contrato_st'), arqs = (document.getElementById('d_contrato_arq') || {}).files;
  if (typeof invocarIAComFallback !== 'function') { st.textContent = 'A IA não está disponível.'; return; }
  if (!arqs || !arqs.length) { st.textContent = 'Anexe o contrato (e os aditivos, se houver).'; return; }
  try {
    let texto = '';
    for (let k = 0; k < arqs.length; k++) { st.textContent = 'Lendo ' + arqs[k].name + '…'; texto += '\n\n===== ARQUIVO: ' + arqs[k].name + ' =====\n' + await extrairTextoArquivo(arqs[k].name, await arqs[k].arrayBuffer(), null); }
    st.textContent = 'A IA está montando a ficha…';
    const chaves = Object.keys(DESC_FICHA_PADRAO).filter(function (k) { return k !== 'ficha_conferida'; }).map(function (k) { return k + ' = ' + DESC_FICHA_PADRAO[k].rot; }).join('\n');
    const pr = 'Leia o contrato de gestão (e termos aditivos) abaixo e preencha a ficha de parâmetros. Use SOMENTE o que está escrito no texto; NÃO invente número de cláusula nem valor. Campo não encontrado: não inclua na resposta.\n' +
      'Campos possíveis (chave = significado):\n' + chaves + '\n' +
      'Responda APENAS com JSON válido: {"contrato":"nº do contrato ou null","campos":[{"chave":"uma das chaves acima","valor":"o valor como está no contrato","origem":"arquivo, anexo e cláusula de onde o valor foi tirado"}]}\n\nTEXTO:\n' + texto.slice(0, 150000);
    const resp = await invocarIAComFallback(pr, true); let s = typeof resp === 'string' ? resp : JSON.stringify(resp);
    const m = /\{[\s\S]*\}/.exec(s.replace(/```json|```/g, '')); if (!m) throw new Error('resposta fora do formato');
    const o = JSON.parse(m[0]), lista = Array.isArray(o.campos) ? o.campos : [];
    descLerFichaDom();
    let n = 0;
    lista.forEach(function (x) { const c = (DESC.fichaCampos || []).find(function (y) { return y.chave === x.chave; }); if (!c || x.valor === null || x.valor === undefined || x.valor === '') return; c.valor = String(x.valor); c.origem = String(x.origem || ''); c.confirmado = 'nao'; n++; });
    if (o.contrato && !DESC.atual.contrato) DESC.atual.contrato = String(o.contrato);
    DESC._fichaSuja = true; descDesenhar();
    mostrarToast(n ? n + ' campo(s) preenchido(s) pela IA. Confira um a um, marque "Conferido" e salve a ficha.' : 'A IA não encontrou os parâmetros no texto. Preencha à mão com o contrato aberto.');
  } catch (e) { if (st) st.textContent = 'Não consegui ler: ' + (e.message || e) + '. Preencha a ficha à mão.'; }
}
// Roteiros de conferência da defesa, por apontamento (passo "Defesa da OSS").
function descHtmlRoteiros() {
  if (!DESC.itens.length) return '';
  const fm = descFichaMapaUnidade(), fora = fichaForaDaRegra(fm);
  const avisoFicha = String(fm.ficha_conferida) !== 'sim' ? '<div style="background:#fff3cd;border-radius:6px;padding:10px 12px;font-size:0.82rem;margin:14px 0 0;">A ficha do contrato desta unidade ainda não foi conferida (passo 2). Os roteiros abaixo usam os valores padrão; este contrato pode ser diferente.</div>' : '';
  const avisoFora = fora.length ? '<div style="background:#fff3cd;border-radius:6px;padding:10px 12px;font-size:0.82rem;margin:14px 0 0;"><strong>Atenção ao que foge da regra neste contrato:</strong>' + fora.map(function (x) { return '<div style="margin-top:4px;">• ' + dEsc(x) + '</div>'; }).join('') + '</div>' : '';
  const cartoes = DESC.itens.map(function (it, i) {
    const r = roteiroConferencia(it, fm);
    return '<details style="background:#fff;border:1px solid #dee2e6;border-radius:8px;padding:10px 14px;margin-top:10px;"><summary style="cursor:pointer;font-size:0.86rem;"><span class="rx-tag">' + (it.tipo === 'producao' ? 'Produção' : 'Qualidade') + '</span> <strong>' + dEsc(it.indicador || '(apontamento ' + (i + 1) + ')') + '</strong> — roteiro: ' + dEsc(r.titulo) + '</summary>' +
      '<div style="margin-top:10px;font-size:0.84rem;"><div style="font-weight:700;margin-bottom:4px;">O que conferir, na ordem:</div><ol style="margin:0 0 10px;padding-left:20px;">' + r.passos.map(function (x) { return '<li style="margin-bottom:4px;">' + dEsc(x) + '</li>'; }).join('') + '</ol>' +
      '<div style="background:#f8f9fa;border-radius:6px;padding:8px 10px;">' + r.decide.map(function (x) { return '<div style="margin-bottom:4px;">' + dEsc(x) + '</div>'; }).join('') + '<div style="font-size:0.74rem;color:#6c757d;margin-top:4px;">Padrões tirados das 32 análises reais de 2024. O contrato desta unidade manda; a decisão é do analista.</div></div></div></details>';
  }).join('');
  return '<div style="margin-top:16px;"><h4 style="margin:0 0 2px;font-size:0.92rem;"><i class="ti ti-list-check"></i> Conferência de dados, apontamento por apontamento</h4><div style="font-size:0.78rem;color:#6c757d;">Antes de decidir, siga o roteiro do tipo de cada indicador, comparando os documentos da defesa com os registros oficiais.</div>' + avisoFicha + avisoFora + cartoes + '</div>';
}

function descUnidadesConhecidas() {
  const m = {}; DESC_CATALOGO.forEach(function (x) { m[x.unidade.toLowerCase()] = x; });
  DESC.lista.forEach(function (r) { m[String(r.unidade).toLowerCase()] = { unidade: r.unidade, tipo: r.tipo, contrato: r.contrato, sigla_oss: r.sigla_oss, nome_oss: r.nome_oss, cnes: r.cnes }; });
  return Object.keys(m).map(function (k) { return m[k]; }).sort(function (x, y) { return x.unidade.localeCompare(y.unidade); });
}
function descAutoUnidade() {
  descLerFicha(); const a = DESC.atual, k = String(a.unidade || '').trim().toLowerCase(), c = descUnidadesConhecidas().find(function (x) { return x.unidade.toLowerCase() === k; });
  if (!c) return;
  ['tipo', 'contrato', 'sigla_oss', 'nome_oss', 'cnes'].forEach(function (f) { if (c[f] && !a[f]) a[f] = c[f]; });
  if (c.tipo) a.tipo = c.tipo;
  const old = DESC.lista.find(function (r) { return String(r.unidade).toLowerCase() === k && Number(r.ano) === Number(a.ano) && Number(r.trimestre) === Number(a.trimestre); });
  if (old && !a.id) mostrarToast('Já existe registro desta unidade neste trimestre. Abra pela lista para continuar.');
  DESC.fichaCampos = null; DESC._fichaUnidade = ''; // a ficha do contrato é por unidade: recarrega no passo 2
  descDesenhar(); descMudou();
}
async function descIrPasso(k, salvar) {
  if (k < 0 || k >= DESC_PASSOS.length) return;
  descLerFicha();
  if (salvar && DESC.passo === 1 && DESC._fichaSuja && DESC.atual.unidade) await descSalvarFichaContrato(true);
  if (salvar && DESC._sujo && DESC.atual.unidade && DESC.atual.ano && DESC.atual.trimestre) await descSalvar(true);
  DESC.passo = k; descEntrarPasso(); descDesenhar();
  window.scrollTo(0, 0); const c = document.getElementById('content'); if (c && c.scrollTo) c.scrollTo(0, 0);
}
function descEntrarPasso() {
  const k = DESC.passo; DESC.modoItens = k === 2 ? 'entrada' : k === 5 ? 'decisao' : 'todos'; DESC._redesenharItens = true;
  if (k === 1) descCarregarFicha().then(function () { if (DESC.passo === 1 && DESC.aba === 'ficha') descDesenhar(); });
  if (k === 5) { // já traz a proposta pronta
    DESC.itens.forEach(function (it) { if (!it.decisao && !it.resumo_defesa && !it.analise_tecnica) { const r = sugerirDecisao(DESC.atual, it, dPmapa(), null, descFichaMapaUnidade()); if (r.abertura || r.resumo || r.analise) { it.justificativa_decisao = r.abertura; it.resumo_defesa = r.resumo; it.analise_tecnica = r.analise; } it.fundamentacao_juridica = r.juridica; if (r.decisao) it.decisao = r.decisao; it._avisos = r.avisos; it._proposto = true; } });
  }
}
async function descContinuar() { descLerFicha(); if (DESC.passo === 1 && DESC._fichaSuja) await descSalvarFichaContrato(true); const ok = await descSalvar(); if (ok) descIrPasso(DESC.passo + 1, false); }
async function descConcluir() { descLerFicha(); const ok = await descSalvar(); if (ok) { DESC._sujo = false; await renderDescontos(); } }
function descModoCompleto() { descLerFicha(); DESC.modo = 'completa'; DESC.modoItens = 'todos'; DESC._redesenharItens = true; descDesenhar(); }
function descDecidir(i, v) { descLerFicha(); const it = DESC.itens[i]; it.decisao = it.decisao === v ? '' : v; DESC._redesenharItens = true; descRecalcular(); descAtualizarResumoDecisao(); descMudou(); }
function descAtualizarResumoDecisao() { const e = document.getElementById('d_dec_resumo'); if (!e) return; const n = { ac: 0, na: 0, pe: 0 }; DESC.itens.forEach(function (x) { if (x.decisao === 'acatado') n.ac++; else if (x.decisao === 'nao_acatado') n.na++; else n.pe++; }); e.innerHTML = '<span class="badge-status" style="background:#d1e7dd;color:#0f5132;">' + n.ac + ' defesa(s) acatada(s)</span><span class="badge-status" style="background:#f8d7da;color:#842029;">' + n.na + ' não acatado(s)</span><span class="badge-status">' + n.pe + ' pendente(s)</span>'; }
function descRevisarTodos() { descLerFicha(); DESC.itens.forEach(function (it) { it.julgamento_revisado = 'sim'; }); DESC._redesenharItens = true; descRecalcular(); descMudou(); }
async function descIATodos() { descLerFicha(); for (let i = 0; i < DESC.itens.length; i++) { await descIA(i); } mostrarToast('Análise da IA concluída. Revise no passo 6.'); }
async function descLerParecer() {
  const st = document.getElementById('d_parecer_st'), arq = (document.getElementById('d_parecer_arq') || {}).files, a = DESC.atual;
  if (typeof invocarIAComFallback !== 'function') { st.textContent = 'A IA não está disponível.'; return; }
  let texto = ((document.getElementById('d_parecer_txt') || {}).value || '').trim();
  try {
    if (arq && arq[0]) { st.textContent = 'Lendo o arquivo…'; texto = await extrairTextoArquivo(arq[0].name, await arq[0].arrayBuffer(), null); }
    if (!texto) { st.textContent = 'Anexe o parecer ou cole o trecho dos apontamentos.'; return; }
    st.textContent = 'A IA está lendo os apontamentos…';
    const pr = 'Do Parecer Técnico da CTAI abaixo, extraia os apontamentos de desconto do contrato de gestão (indicadores de PRODUÇÃO e de QUALIDADE não cumpridos). Use SOMENTE o que está no texto; se faltar um dado, use null. Não invente valores.\n' +
      'Responda APENAS com JSON válido neste formato: {"parecer_numero":"ex. 048/2025 ou null","apontamentos":[{"tipo":"producao ou qualidade","indicador":"nome do indicador","valor_apontado":numero em reais ou null,"meta_trimestre":numero ou null,"realizado":[mes1,mes2,mes3] ou null,"percentual":numero ou null}]}\n\nPARECER:\n' + texto.slice(0, 60000);
    const resp = await invocarIAComFallback(pr, true); let s = typeof resp === 'string' ? resp : JSON.stringify(resp);
    const m = /\{[\s\S]*\}/.exec(s.replace(/```json|```/g, '')); if (!m) throw new Error('resposta fora do formato');
    const o = JSON.parse(m[0]), lista = Array.isArray(o.apontamentos) ? o.apontamentos : [];
    if (!lista.length) { st.textContent = 'A IA não encontrou apontamentos. Lance à mão ou cole o trecho certo.'; return; }
    descLerFicha();
    if (o.parecer_numero && !a.parecer_numero) a.parecer_numero = String(o.parecer_numero);
    lista.forEach(function (x) { const r = x.realizado || []; DESC.itens.push({ tipo: x.tipo === 'qualidade' ? 'qualidade' : 'producao', indicador: x.indicador || '', valor_apontado: x.valor_apontado === null || x.valor_apontado === undefined ? '' : x.valor_apontado, meta_trimestre: x.meta_trimestre === null || x.meta_trimestre === undefined ? '' : x.meta_trimestre, realizado_1: r[0] === undefined || r[0] === null ? '' : r[0], realizado_2: r[1] === undefined || r[1] === null ? '' : r[1], realizado_3: r[2] === undefined || r[2] === null ? '' : r[2], pct_parecer: x.percentual === null || x.percentual === undefined ? '' : x.percentual, decisao: '' }); });
    DESC._redesenharItens = true; descDesenhar(); mostrarToast(lista.length + ' apontamento(s) lido(s). Confira os valores.'); descMudou();
  } catch (e) { st.textContent = 'Não consegui ler: ' + (e.message || e) + '. Lance os apontamentos à mão.'; }
}

// ---------- FONTES EXTERNAS ----------
function descHtmlFontes() {
  const tab = DESC_FONTES.map(function (f) { return '<tr><td><strong>' + f.fonte + '</strong><div style="font-size:0.72rem;color:#6c757d;">' + dEsc(f.nome) + '</div></td><td style="font-size:0.8rem;">' + dEsc(f.uso) + '</td><td style="font-size:0.78rem;">' + dEsc(f.chaves) + '</td><td style="font-size:0.78rem;">' + dEsc(f.onde) + '</td></tr>'; }).join('');
  const rs = DESC.resumoRef.length ? DESC.resumoRef.map(function (x) { return '<tr><td>' + dEsc(x.fonte) + '</td><td>' + dEsc(x.cnes) + '</td><td style="font-size:0.78rem;">' + x.competencias.join(', ') + '</td><td style="text-align:right;">' + x.linhas + '</td></tr>'; }).join('') : '<tr><td colspan="4" style="color:#6c757d;">Nada importado ainda.</td></tr>';
  return '<style>.desc-tab td,.desc-tab th{padding:8px;border-top:1px solid #eef0f2;vertical-align:top}</style>' +
    dCartao('Como estes dados chegam', '<p style="font-size:0.85rem;margin:0 0 8px;">Os dados do CNES, SIH e SIA são públicos, mas a maior parte vem em <strong>arquivos</strong> (.dbc) do DATASUS, não em API. O Analista ainda não está ligado a eles: por ora, baixe o arquivo, converta para planilha/CSV e importe aqui. Uma vez importado, o dado fica guardado e as conferências dos descontos o usam sozinhas.</p><div style="margin-bottom:8px;"><button class="btn btn-secondary btn-sm" onclick="descTestarApi()"><i class="ti ti-plug-connected"></i> Testar API do DATASUS a partir deste computador</button></div><div id="d_api_res" style="font-size:0.8rem;"></div>') +
    dCartao('Fontes que o processo usa', '<div style="overflow-x:auto;"><table class="desc-tab" style="width:100%;border-collapse:collapse;"><thead><tr style="text-align:left;"><th>Fonte</th><th>Para quê</th><th>Chaves sugeridas</th><th>Onde baixar</th></tr></thead><tbody>' + tab + '</tbody></table></div>') +
    dCartao('Importar dados (CSV)', '<p style="font-size:0.82rem;margin:0 0 8px;">Colunas: <code>fonte, cnes, competencia, chave, valor</code> (competência em AAAA-MM; separador vírgula ou ponto e vírgula). Uma linha por unidade, mês e chave. Reenviar a mesma combinação atualiza o valor.</p><input type="file" accept=".csv,.txt" onchange="descLerCsv(this.files[0])"><div style="margin:8px 0;"><button class="btn btn-secondary btn-sm" onclick="descModeloCsv()">Baixar modelo do CSV</button></div><div id="d_csv_prev"></div>') +
    dCartao('O que já foi importado', '<table class="desc-tab" style="width:100%;border-collapse:collapse;font-size:0.85rem;"><thead><tr style="text-align:left;"><th>Fonte</th><th>CNES</th><th>Competências</th><th style="text-align:right;">Linhas</th></tr></thead><tbody>' + rs + '</tbody></table>') +
    dCartao('O que falta baixar', descHtmlFalta());
}
function descHtmlFalta() {
  const f = DESC.falta || [];
  if (!f.length) return '<p style="font-size:0.85rem;margin:0;color:#0f5132;">Nada pendente: todo apontamento ligado a uma fonte externa tem os dados do trimestre importados (ou nenhum apontamento foi ligado a fonte ainda).</p>';
  return '<p style="font-size:0.82rem;margin:0 0 6px;">Estes dados são necessários para conferir apontamentos já lançados e ainda não foram importados. Baixe manualmente e importe acima:</p><table class="desc-tab" style="width:100%;border-collapse:collapse;font-size:0.82rem;"><thead><tr style="text-align:left;"><th>Unidade</th><th>Trimestre</th><th>Fonte</th><th>CNES</th><th>Chave</th><th>Competências que faltam</th></tr></thead><tbody>' + f.map(function (x) { return '<tr><td>' + dEsc(x.unidade) + '</td><td>' + x.ano + ' T' + x.trimestre + '</td><td>' + dEsc(x.fonte) + '</td><td>' + dEsc(x.cnes || 'informar o CNES') + '</td><td>' + dEsc(x.chave) + '</td><td>' + dEsc(x.competencias.join(', ')) + '</td></tr>'; }).join('') + '</tbody></table>';
}
async function descTestarApi() {
  const el = document.getElementById('d_api_res'); el.textContent = 'Testando…';
  const urls = ['https://apidadosabertos.saude.gov.br/cnes/estabelecimentos?limit=1', 'https://apidadosabertos.saude.gov.br/v1/cnes/estabelecimentos?limit=1', 'https://apidadosabertos.saude.gov.br/'];
  const out = [];
  for (const u of urls) {
    try { const c = new AbortController(); setTimeout(function () { c.abort(); }, 8000); const r = await fetch(u, { signal: c.signal }); out.push('<div>' + dEsc(u) + ' → HTTP ' + r.status + '</div>'); }
    catch (e) { out.push('<div>' + dEsc(u) + ' → não respondeu ao navegador (' + dEsc(e.name === 'AbortError' ? 'tempo esgotado' : 'bloqueio de rede ou de CORS') + ')</div>'); }
  }
  el.innerHTML = out.join('') + '<div style="margin-top:6px;color:#6c757d;">Se aparecer HTTP 200, a API pode ser usada direto do navegador; se for bloqueio, o caminho é importar arquivos ou pedir à ATI uma ponte no servidor.</div>';
}
function descModeloCsv() {
  const csv = 'fonte,cnes,competencia,chave,valor\nCNES-LT,2530538,2025-01,leitos_sus,120\nSIH,2530538,2025-01,saidas,540\n';
  const u = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })), a = document.createElement('a'); a.href = u; a.download = 'modelo_fontes_externas.csv'; a.click(); setTimeout(function () { URL.revokeObjectURL(u); }, 3000);
}
function descLerCsv(arq) {
  if (!arq) return; const rd = new FileReader();
  rd.onload = function () {
    const txt = String(rd.result).replace(/^﻿/, ''), linhas = txt.split(/\r?\n/).filter(function (l) { return l.trim(); });
    const sep = (linhas[0].match(/;/g) || []).length > (linhas[0].match(/,/g) || []).length ? ';' : ',';
    const cab = linhas[0].split(sep).map(function (x) { return x.trim().toLowerCase(); }), need = ['fonte', 'cnes', 'competencia', 'chave', 'valor'];
    const falt = need.filter(function (n) { return cab.indexOf(n) === -1; });
    if (falt.length) { document.getElementById('d_csv_prev').innerHTML = '<span style="color:#842029;">Faltam colunas: ' + falt.join(', ') + '.</span>'; return; }
    DESC._csv = linhas.slice(1).map(function (l) { const c = l.split(sep), o = {}; cab.forEach(function (h, i) { o[h] = (c[i] || '').trim(); }); return o; });
    DESC._csvNome = arq.name;
    document.getElementById('d_csv_prev').innerHTML = '<p style="font-size:0.82rem;">' + DESC._csv.length + ' linha(s) lida(s) de ' + dEsc(arq.name) + '. Primeira: ' + dEsc(JSON.stringify(DESC._csv[0] || {})) + '</p><button class="btn btn-primary btn-sm" onclick="descEnviarCsv()">Importar</button>';
  };
  rd.readAsText(arq, 'utf-8');
}
async function descEnviarCsv() {
  const L = DESC._csv || [], lote = 800; let n = 0, at = 0, ig = 0;
  for (let i = 0; i < L.length; i += lote) {
    const r = await api('descontos/ref-importar', { linhas: L.slice(i, i + lote), arquivo: DESC._csvNome }, { timeoutMs: 60000 });
    if (!r.ok) { mostrarToast(r.erro || 'Falhou.'); return; } n += r.novos; at += r.atualizados; ig += r.ignoradas;
  }
  mostrarToast('Importado: ' + n + ' novas, ' + at + ' atualizadas, ' + ig + ' ignoradas.'); DESC._csv = null; descIrAba('fontes');
}

// ---------- PARÂMETROS ----------
function descHtmlParams() {
  const adm = typeof usuarioAtual !== 'undefined' && usuarioAtual && usuarioAtual.perfil === 'admin';
  const linhas = (DESC.params || []).map(function (p, i) {
    return '<tr><td style="width:210px;"><strong>' + dEsc(p.chave) + '</strong></td><td style="width:260px;"><input id="p_valor_' + i + '" value="' + dEsc(p.valor) + '" ' + (adm ? '' : 'disabled') + ' style="width:100%;padding:6px;border:1px solid #ced4da;border-radius:4px;box-sizing:border-box;"></td><td style="width:130px;"><select id="p_conf_' + i + '" ' + (adm ? '' : 'disabled') + ' style="width:100%;padding:6px;"><option value="sim"' + (p.confirmado === 'sim' ? ' selected' : '') + '>Confirmado</option><option value="nao"' + (p.confirmado !== 'sim' ? ' selected' : '') + '>A confirmar</option></select></td><td style="font-size:0.78rem;color:#6c757d;">' + dEsc(p.nota) + '</td></tr>';
  }).join('');
  return '<style>.desc-tab td{padding:8px;border-top:1px solid #eef0f2;vertical-align:top}</style>' + dCartao('Prazos e regras', '<p style="font-size:0.82rem;margin:0 0 8px;">Valores usados nos cálculos. Os marcados "A confirmar" ainda não têm base normativa localizada; mude aqui quando a regra for confirmada.</p><div style="overflow-x:auto;"><table class="desc-tab" style="width:100%;border-collapse:collapse;"><tbody>' + linhas + '</tbody></table></div>' + (adm ? '<div style="margin-top:10px;"><button class="btn btn-primary btn-sm" onclick="descSalvarParams()">Salvar parâmetros</button></div>' : '<p style="font-size:0.78rem;color:#6c757d;">Só o administrador altera.</p>'));
}
async function descSalvarParams() {
  const lista = DESC.params.map(function (p, i) { return { chave: p.chave, valor: document.getElementById('p_valor_' + i).value, confirmado: document.getElementById('p_conf_' + i).value }; });
  const r = await api('descontos/parametros-salvar', { parametros: lista });
  if (!r.ok) { mostrarToast(r.erro || 'Não salvou.'); return; } DESC.params = r.parametros; DESC.pmapa = paramsMapa(r.parametros); mostrarToast('Parâmetros salvos.'); descDesenhar();
}
// ===== FIM DA TELA =====
