// Maitre : distribue les poids, recolte les poids appris par chaque
// ouvrier, en fait la moyenne, recommence. Un ouvrier par coeur.
const { Worker } = require('worker_threads');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { chargeJeu } = require('./charge');

const RACINE = path.resolve(__dirname, '..');
eval(chargeJeu(RACINE));

const N_OUVRIERS = Number(process.env.OUVRIERS) || Math.max(1, os.cpus().length - 1);
const N_TOURS    = Number(process.env.TOURS) || 5000;
const PERIODE_SAUVE = 10;

console.log(`ouvriers ${N_OUVRIERS}   entrees ${tailleObservation()}   cache ${N_CACHE}`);

const modele = creeCerveau(1);
let plat = exporteCerveau(modele).poids;
const TAILLE = plat.length;
console.log(`parametres ${TAILLE}`);

const ouvriers = [];
let prets = 0, tour = 0, recus = 0;
let somme = new Float32Array(TAILLE);
let statsTour = [];
let t0 = Date.now();

function sauve() {
  const ex = exporteCerveau(importeCerveau(null, plat));
  fs.writeFileSync(path.join(RACINE, 'poids.json'),
                   JSON.stringify({ ...ex.meta, tour }));
  fs.writeFileSync(path.join(RACINE, 'poids.bin'), Buffer.from(plat.buffer.slice(0)));
}

function lanceTour() {
  tour++;
  recus = 0;
  somme.fill(0);
  statsTour = [];
  t0 = Date.now();
  for (const w of ouvriers) {
    const copie = Float32Array.from(plat);
    w.postMessage({ poids: copie.buffer }, [copie.buffer]);
  }
}

for (let i = 0; i < N_OUVRIERS; i++) {
  const w = new Worker(path.join(__dirname, 'ouvrier.js'),
                       { workerData: { racine: RACINE, graine: 1000 + i * 7919 } });
  ouvriers.push(w);

  w.on('message', (m) => {
    if (m.pret) {
      if (++prets === N_OUVRIERS) lanceTour();
      return;
    }

    const p = new Float32Array(m.poids);
    for (let k = 0; k < TAILLE; k++) somme[k] += p[k];
    statsTour.push(m.stats);

    if (++recus === N_OUVRIERS) {
      // moyenne des poids appris par chacun
      for (let k = 0; k < TAILLE; k++) plat[k] = somme[k] / N_OUVRIERS;

      const moy = (f) => statsTour.reduce((s, r) => s + f(r), 0) / statsTour.length;
      const dt = (Date.now() - t0) / 1000;
      const dec = statsTour.reduce((s, r) => s + r.decisions, 0);

      console.log(
        `#${String(tour).padStart(4)}  recomp ${moy(r => r.recompense).toFixed(4)}` +
        `  perte ${moy(r => r.perte).toFixed(3)}` +
        `  entrop ${moy(r => r.entropie).toFixed(3)}` +
        `  kl ${moy(r => r.kl).toFixed(4)}` +
        `  ${dec} dec  ${dt.toFixed(1)}s` +
        `  ${(dec / dt).toFixed(0)} dec/s`);

      if (tour % PERIODE_SAUVE === 0) { sauve(); console.log('  poids sauves'); }
      if (tour >= N_TOURS) { sauve(); process.exit(0); }
      lanceTour();
    }
  });

  w.on('error', (e) => { console.error('ouvrier :', e); process.exit(1); });
}
