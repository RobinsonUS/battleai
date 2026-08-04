// Charge les fichiers de jeu dans la portee globale.
// eval() ne convient pas : les const et let y restent enfermes.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = ['config', 'moteur', 'observation', 'cerveau',
             'recompense', 'collecte', 'gradients', 'entrainement'];

function chargeJeu(racine) {
  let code = '';
  for (const f of SRC) {
    const p = path.join(racine, 'js', f + '.js');
    if (!fs.existsSync(p)) throw new Error('fichier manquant : ' + p);
    code += fs.readFileSync(p, 'utf8') + '\n';
  }

  // on recopie aussi les noms utiles sur globalThis, pour que les
  // modules CommonJS y accedent sans ambiguite
  const noms = ['N_CACHE', 'N_MOUV', 'N_VISEE', 'PAS_VISEE', 'PAS_DECISION',
                'CLES', 'creeCerveau', 'creeAgentIA', 'agitIA', 'propage',
                'masques', 'tireSoftmax', 'creeRng', 'creePartie', 'pas',
                'observe', 'tailleObservation', 'creeMemoire',
                'creeSession', 'avanceSession', 'collecteFournee',
                'statistiques', 'instantane', 'recompense', 'calculeAvantages',
                'creeGradients', 'videGradients', 'retropropageSegment',
                'perteSegment', 'verifieGradients',
                'creeEntrainement', 'pasEntrainement', 'creeAdam',
                'copieCerveau', 'exporteCerveau', 'importeCerveau'];

  code += '\n;' + JSON.stringify(noms) +
          '.forEach(function (n) { try { globalThis[n] = eval(n); } catch (e) {} });';

  vm.runInThisContext(code, { filename: 'jeu.js' });
}

module.exports = { chargeJeu };
