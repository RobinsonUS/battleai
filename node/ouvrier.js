const { parentPort, workerData } = require('worker_threads');
const { chargeJeu } = require('./charge');

chargeJeu(workerData.racine);          // plus d'eval

const E = creeEntrainement(workerData.graine);

function poidsPlats() { return exporteCerveau(E.c).poids; }

function imposePoids(plat) {
  let o = 0;
  for (const k of CLES) {
    E.c[k].w.set(plat.subarray(o, o + E.c[k].w.length)); o += E.c[k].w.length;
    E.c[k].b.set(plat.subarray(o, o + E.c[k].b.length)); o += E.c[k].b.length;
  }
}

parentPort.on('message', (msg) => {
  try {
    if (msg.poids) imposePoids(new Float32Array(msg.poids));
    if (msg.tour) ajusteEntropie(msg.tour);
    const r = pasEntrainement(E);
    const p = poidsPlats();
    parentPort.postMessage({ stats: r, poids: p.buffer }, [p.buffer]);
  } catch (e) {
    parentPort.postMessage({ erreur: e.message + '\n' + e.stack });
  }
});

parentPort.postMessage({ pret: true, taille: poidsPlats().length });
