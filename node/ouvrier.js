// Un ouvrier : collecte une fournee et applique PPO localement,
// puis renvoie ses poids. Le maitre les moyenne et redistribue.
const { parentPort, workerData } = require('worker_threads');
const { chargeJeu } = require('./charge');

eval(chargeJeu(workerData.racine));

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
  if (msg.poids) imposePoids(new Float32Array(msg.poids));
  const r = pasEntrainement(E);
  const p = poidsPlats();
  parentPort.postMessage({ stats: r, poids: p.buffer }, [p.buffer]);
});

parentPort.postMessage({ pret: true, taille: poidsPlats().length });
