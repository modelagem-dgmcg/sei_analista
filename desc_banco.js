// desc_banco.js — liga a tela de Descontos ao banco do Pareceres CTAI.
// Passo 3 (Parecer da CTAI): botão "Trazer do banco" preenche os dados do parecer e os apontamentos,
// e mostra o contexto: trimestre anterior (possível compensação), precedentes da unidade, art. 15-A e errata.
var DBANCO = { lista: null, erratas: [], busy: false };

function dbNorm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
function dbR2(x) { return Math.round((Number(x) + 1e-9) * 100) / 100; }
function dbBrl(x) { return typeof brl === 'function' ? brl(x) : 'R$ ' + dbR2(x).toFixed(2).replace('.', ','); }
function dbMes(m) { return typeof hMesBonito === 'function' ? hMesBonito(m) : String(m); }

async function dbCarregar(forcar) {
  if (DBANCO.lista && !forcar) return true;
  var r = await api('historico/listar');
  if (!r || r.ok === false) return false;
  DBANCO.lista = r.pareceres || []; DBANCO.erratas = r.erratas || [];
  if (typeof HIST !== 'undefined') { HIST.lista = DBANCO.lista; HIST.erratas = DBANCO.erratas; }
  return true;
}
var DB_STOP = { de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1, '-': 1, hospital: 1, upa: 1, upae: 1 };
function dbTokens(s) { return dbNorm(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(function (t) { return t && !DB_STOP[t]; }); }
// acha o parecer pela unidade (nome igual ou parecido: "Hospital Dom Helder Câmara" = "Hospital Metropolitano Sul Dom Hélder Câmara")
function dbAchar(unidade, ano, tri) {
  var u = dbNorm(unidade), mesmo = (DBANCO.lista || []).filter(function (p) { return Number(p.ano) === Number(ano) && Number(p.trimestre) === Number(tri); });
  var ex = mesmo.find(function (p) { return dbNorm(p.unidade) === u; }); if (ex) return ex;
  var tu = dbTokens(unidade); if (!tu.length) return null;
  var c = mesmo.filter(function (p) { var tp = dbTokens(p.unidade), curto = tu.length <= tp.length ? tu : tp, longo = tu.length <= tp.length ? tp : tu; return curto.length >= 2 && curto.every(function (t) { return longo.indexOf(t) > -1; }) && (p.tipo_unidade === 'OUTRO' || !DESC.atual || !DESC.atual.tipo || p.tipo_unidade === DESC.atual.tipo || true); });
  return c.length === 1 ? c[0] : null;
}
function dbAnteriores(unidade, ano, tri, n) {
  var u = dbNorm(unidade), per = Number(ano) * 10 + Number(tri);
  return (DBANCO.lista || []).filter(function (p) { return dbNorm(p.unidade) === u && (Number(p.ano) * 10 + Number(p.trimestre)) < per; })
    .sort(function (a, b) { return (Number(b.ano) * 10 + Number(b.trimestre)) - (Number(a.ano) * 10 + Number(a.trimestre)); }).slice(0, n || 4);
}
function dbRotTri(p) { return p.trimestre + 'º tri/' + p.ano; }

// Junta as linhas mensais do banco em um apontamento por indicador (como a ficha de descontos usa).
function dbMontarItens(det) {
  var grupos = {}, ordem = [];
  (det.apontamentos || []).forEach(function (a) {
    var k = a.tipo + '|' + a.tabela + '|' + a.indicador;
    if (!grupos[k]) { grupos[k] = { tipo: a.tipo === 'producao' ? 'producao' : 'qualidade', indicador: a.indicador, valor: 0, meses: [] }; ordem.push(k); }
    var v = Number(a.valor) || 0; grupos[k].valor += v; if (v > 0 && a.periodo && a.periodo !== 'trimestre') grupos[k].meses.push(a.periodo);
  });
  return ordem.map(function (k) {
    var g = grupos[k], it = { tipo: g.tipo, indicador: g.indicador, valor_apontado: String(dbR2(g.valor)), decisao: '' };
    if (g.tipo === 'producao') {
      var rs = (det.resultados || []).filter(function (r) { return r.grupo === 'producao' && dbNorm(r.indicador) === dbNorm(g.indicador); });
      if (rs.length) {
        var metas = rs.map(function (r) { return Number(r.meta); }).filter(function (x) { return !isNaN(x) && x > 0; });
        if (metas.length) it.meta_trimestre = String(metas.reduce(function (s, x) { return s + x; }, 0));
        rs.slice(0, 3).forEach(function (r, i) { if (r.resultado !== '' && r.resultado !== null) it['realizado_' + (i + 1)] = String(r.resultado); });
        var pc = rs.map(function (r) { return r.pct; }).filter(function (x) { return x !== '' && x !== null && !isNaN(Number(x)); });
        if (pc.length) it.pct_parecer = String(pc[0]);
      }
    } else if (g.meses.length) {
      it.indicador = g.indicador + ' (' + g.meses.map(dbMes).join(', ').toLowerCase() + ')';
    }
    return it;
  });
}

async function descPuxarBanco() {
  if (DBANCO.busy) return;
  descLerFicha();
  var a = DESC.atual;
  if (!String(a.unidade || '').trim() || !a.ano || !a.trimestre) { mostrarToast('Preencha a unidade, o ano e o trimestre no passo 1.'); return; }
  DBANCO.busy = true;
  try {
    if (!(await dbCarregar(true))) { mostrarToast('Não consegui abrir o banco do Pareceres CTAI.'); return; }
    var p = dbAchar(a.unidade, a.ano, a.trimestre);
    if (!p) { var disp = (DBANCO.lista || []).filter(function (x) { return Number(x.ano) === Number(a.ano) && Number(x.trimestre) === Number(a.trimestre); }).map(function (x) { return x.unidade; }).sort(); DESC._banco = { faltando: true, disp: disp }; mostrarToast('Não achei o parecer de ' + a.unidade + ' (' + a.trimestre + 'º tri/' + a.ano + ') no banco.'); descDesenhar(); return; }
    if (dbNorm(p.unidade) !== dbNorm(a.unidade)) { a.unidade = p.unidade; DESC.fichaCampos = null; DESC._fichaUnidade = ''; }
    if (DESC.itens.length && !confirm('Já há apontamentos lançados. Trocar pelos do parecer guardado no banco?')) return;
    var det = await api('historico/obter', { id: p.id });
    if (!det || det.ok === false) { mostrarToast((det && det.erro) || 'Erro ao ler o parecer no banco.'); return; }
    a.tipo = p.tipo_unidade && p.tipo_unidade !== 'OUTRO' ? p.tipo_unidade : a.tipo;
    if (p.oss) a.nome_oss = a.nome_oss || p.oss;
    if (p.contrato) a.contrato = a.contrato || p.contrato;
    a.parecer_numero = p.numero + '/' + p.ano_parecer;
    DESC.itens = dbMontarItens(det);
    // contexto: últimos trimestres da mesma unidade
    var ant = dbAnteriores(a.unidade, a.ano, a.trimestre, 4), dets = [];
    for (var i = 0; i < ant.length; i++) { var d = await api('historico/obter', { id: ant[i].id }); dets.push({ p: ant[i], d: (d && d.ok !== false) ? d : null }); }
    DESC._banco = { parecer: p, det: det, anteriores: dets };
    DESC._sujo = true;
    descDesenhar(); descMudou();
    mostrarToast('Apontamentos trazidos do parecer nº ' + p.numero + '/' + p.ano_parecer + '. Confira antes de seguir.');
  } finally { DBANCO.busy = false; }
}

function descHtmlBanco() {
  var a = DESC.atual, b = DESC._banco;
  var cab = '<div style="background:#eef6ff;border:1px solid #cfe2ff;border-radius:8px;padding:12px;margin-bottom:12px;"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;justify-content:space-between;"><div style="font-size:0.85rem;"><strong><i class="ti ti-database"></i> Banco dos pareceres da CTAI</strong><div style="color:#495057;margin-top:2px;">Traz o nº do parecer, a OSS, o contrato e os apontamentos do parecer de ' + dEsc(a.unidade || 'a unidade') + ' no ' + dEsc(a.trimestre || '?') + 'º trimestre de ' + dEsc(a.ano || '?') + ', sem digitar.</div></div><button class="btn btn-primary btn-sm" onclick="descPuxarBanco()"><i class="ti ti-download"></i> Trazer do banco</button></div>';
  if (!b) return cab + '</div>';
  if (b.faltando) return cab + '<div style="margin-top:8px;font-size:0.82rem;color:#842029;">Não achei o parecer desta unidade neste trimestre e ano. ' + (b.disp && b.disp.length ? 'No banco, para ' + dEsc(a.trimestre) + 'º tri/' + dEsc(a.ano) + ', há: ' + b.disp.map(dEsc).join('; ') + '.' : 'Não há nenhum parecer de ' + dEsc(a.trimestre) + 'º tri/' + dEsc(a.ano) + ' no banco. Carregue na tela "Pareceres CTAI" ou mude o ano/trimestre.') + '</div></div>';
  var p = b.parecer, h = [];
  // situação da soma / errata
  var st = typeof histStatusSoma === 'function' ? histStatusSoma(p) : { cod: p.confere === 'sim' ? 'ok' : 'aberta', txt: p.confere === 'sim' ? 'Confere' : 'Divergência de soma', cor: p.confere === 'sim' ? 'verde' : 'verm' };
  var cor = { verde: ['#d1e7dd', '#0f5132'], verm: ['#f8d7da', '#842029'], amar: ['#fff3cd', '#664d03'] }[st.cor] || ['#e9ecef', '#495057'];
  h.push('<div style="margin-top:10px;font-size:0.82rem;"><span style="background:' + cor[0] + ';color:' + cor[1] + ';padding:2px 8px;border-radius:10px;font-weight:600;">Soma dos descontos: ' + dEsc(st.txt) + '</span> ' + (st.det ? dEsc(st.det) + '. ' : '') + (st.cod !== 'ok' && p.problemas ? '<div style="margin-top:4px;color:#495057;">' + dEsc(p.problemas) + '. Confira o valor de cada apontamento antes de notificar a OSS.</div>' : '') + '</div>');
  // art. 15-A: texto do próprio parecer
  var n15 = (b.det.notas || []).filter(function (n) { return n.tipo === 'compensacao_15a'; });
  if (n15.length) h.push('<div style="margin-top:8px;font-size:0.82rem;"><strong>O parecer fala em compensação (art. 15-A):</strong> ' + dEsc(n15[0].texto) + '</div>');
  // trimestre anterior: produção apontada = possível compensação
  var tri1 = b.anteriores[0];
  if (tri1 && tri1.d) {
    var prodAnt = (tri1.d.apontamentos || []).filter(function (x) { return x.tipo === 'producao' && Number(x.valor) > 0; });
    var totAnt = Number(tri1.p.desc_total) || 0;
    h.push('<div style="margin-top:8px;font-size:0.82rem;"><strong>Trimestre anterior (' + dEsc(dbRotTri(tri1.p)) + ', parecer nº ' + dEsc(tri1.p.numero) + '/' + dEsc(tri1.p.ano_parecer) + '):</strong> total apontado ' + dbBrl(totAnt) + '. ' +
      (prodAnt.length ? 'Produção apontada que pode ser compensada neste trimestre: <ul style="margin:4px 0 0 18px;padding:0;">' + prodAnt.map(function (x) { return '<li>' + dEsc(x.indicador) + ' — ' + dbBrl(x.valor) + '</li>'; }).join('') + '</ul><span style="color:#6c757d;">A regra e o prazo de compensação seguem o contrato; o sistema só mostra o que foi apontado.</span>' : 'Sem desconto de produção no trimestre anterior.') + '</div>');
  } else h.push('<div style="margin-top:8px;font-size:0.82rem;color:#6c757d;">O trimestre anterior desta unidade ainda não está no banco.</div>');
  // precedentes por indicador
  var prec = {}, nTri = b.anteriores.filter(function (x) { return x.d; }).length;
  b.anteriores.forEach(function (x) { if (!x.d) return; var vistos = {}; (x.d.apontamentos || []).forEach(function (ap) { if (Number(ap.valor) > 0 && !vistos[dbNorm(ap.indicador)]) { vistos[dbNorm(ap.indicador)] = 1; var k = dbNorm(ap.indicador); (prec[k] = prec[k] || { nome: ap.indicador, tris: [] }).tris.push(dbRotTri(x.p)); } }); });
  var atuais = (b.det.apontamentos || []).filter(function (x) { return Number(x.valor) > 0; }), vis = {}, linhas = [];
  atuais.forEach(function (x) { var k = dbNorm(x.indicador); if (vis[k]) return; vis[k] = 1; var pr = prec[k]; linhas.push('<li>' + dEsc(x.indicador) + ': ' + (pr ? '<strong>já apontado em ' + pr.tris.length + ' dos últimos ' + nTri + ' trimestres</strong> (' + dEsc(pr.tris.join(', ')) + ')' : 'primeira vez nos últimos ' + nTri + ' trimestres guardados') + '</li>'); });
  if (linhas.length && nTri) h.push('<div style="margin-top:8px;font-size:0.82rem;"><strong>Reincidência (o mesmo indicador em trimestres anteriores):</strong><ul style="margin:4px 0 0 18px;padding:0;">' + linhas.join('') + '</ul></div>');
  return cab + h.join('') + '</div>';
}
