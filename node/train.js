const { Worker } = require('worker_threads');
const os = require('os');
const fs = require('fs');
const path = require('path');
const { chargeJeu } = require('./charge');

const RACINE = path.resolve(__dirname, '..');
chargeJeu(RACINE);

const N_OUVRIERS = Number(process.env.OUVRIERS) || Math.max(1, os.cpus().length - 1);
const N_TOURS    = Number(process.env.TOURS) || 5000;
const PERIODE_SAUVE = 10;

const modele = creeCerveau(1);
const depart = exporteCerveau(modele);
let plat = depart.poids;
const META = depart.meta;
const TAILLE = plat.length;

// reprise : si des poids existent, on repart de la
let tour = 0;
const fBin = path.join(RACINE, 'poids.bin');
const fJson = path.join(RACINE, 'poids.json');
if (fs.existsSync(fBin) && fs.existsSync(fJson)) {
  const meta = JSON.parse(fs.readFileSync(fJson, 'utf8'));
  const buf = fs.readFileSync(fBin);
  const anciens = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  if (anciens.length === TAILLE) {
    plat.set(anciens);
    tour = meta.tour || 0;
    console.log(`reprise au tour ${tour}`);
  } else {
    console.log('poids existants incompatibles, on repart de zero');
  }
}

console.log(`ouvriers ${N_OUVRIERS}   entrees ${tailleObservation()}   ` +
            `cache ${N_CACHE}   parametres ${TAILLE}`);

const ouvriers = [];
let prets = 0, recus = 0;
const somme = new Float32Array(TAILLE);
let statsTour = [];
let t0 = Date.now();

function sauve() {
  fs.writeFileSync(path.join(RACINE, 'poids.json'),
                   JSON.stringify({ ...META, tour }));
  fs.writeFileSync(path.join(RACINE, 'poids.bin'),
                   Buffer.from(plat.buffer, plat.byteOffset, plat.byteLength));
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

const depuis = tour;
for (let i = 0; i < N_OUVRIERS; i++) {
  const w = new Worker(path.join(__dirname, 'ouvrier.js'),
                       { workerData: { racine: RACINE, graine: 1000 + i * 7919 } });
  ouvriers.push(w);

  w.on('message', (m) => {
    if (m.erreur) { console.error('ouvrier :', m.erreur); process.exit(1); }

    if (m.pret) {
      if (++prets === N_OUVRIERS) lanceTour();
      return;
    }

    const p = new Float32Array(m.poids);
    for (let k = 0; k < TAILLE; k++) somme[k] += p[k];
    statsTour.push(m.stats);

    if (++recus === N_OUVRIERS) {
      // moyenne de ce que chacun a appris
      for (let k = 0; k < TAILLE; k++) plat[k] = somme[k] / N_OUVRIERS;

      const moy = (f) => statsTour.reduce((s, r) => s + f(r), 0) / statsTour.length;
      const dt = (Date.now() - t0) / 1000;
      const dec = statsTour.reduce((s, r) => s + r.decisions, 0);

      console.log(
        `#${String(tour).padStart(4)}  recomp ${moy(r => r.recompense).toFixed(4)}` +
        `  perte ${moy(r => r.perte).toFixed(3)}` +
        `  entrop ${moy(r => r.entropie).toFixed(3)}` +
        `  kl ${moy(r => r.kl).toFixed(4)}` +
        `  ${dec} dec  ${dt.toFixed(1)}s  ${(dec / dt).toFixed(0)} dec/s`);

      if (tour % PERIODE_SAUVE === 0) { sauve(); console.log('  poids sauves'); }
      if (tour >= depuis + N_TOURS) { sauve(); process.exit(0); }
      lanceTour();
    }
  });

  w.on('error', (e) => { console.error('ouvrier :', e); process.exit(1); });
}
