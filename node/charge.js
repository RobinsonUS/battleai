// charge les fichiers de jeu dans le contexte courant, tels quels
const fs = require('fs');
const path = require('path');

function chargeJeu(racine) {
  const src = ['config', 'moteur', 'observation', 'cerveau',
               'recompense', 'collecte', 'gradients', 'entrainement'];
  let code = '';
  for (const f of src) code += fs.readFileSync(path.join(racine, 'js', f + '.js'), 'utf8') + '\n';
  return code;
}

module.exports = { chargeJeu };
