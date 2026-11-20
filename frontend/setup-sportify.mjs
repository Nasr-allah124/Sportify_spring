import { readFile, writeFile } from 'node:fs/promises';

const angularPath = new URL('./angular.json', import.meta.url);
const packagePath = new URL('./package.json', import.meta.url);
const angular = JSON.parse(await readFile(angularPath, 'utf8'));
const pkg = JSON.parse(await readFile(packagePath, 'utf8'));

function updateStyles(styles) {
  const existing = styles ?? [];
  const converted = existing.map(style => {
    if (style === 'src/styles.scss') return 'src/styles.css';
    if (typeof style === 'object' && style.input === 'src/styles.scss') {
      return { ...style, input: 'src/styles.css' };
    }
    return style;
  });

  const hasMain = converted.some(style =>
    style === 'src/styles.css' ||
    (typeof style === 'object' && style.input === 'src/styles.css')
  );

  return hasMain ? converted : [...converted, 'src/styles.css'];
}

let applications = 0;
for (const project of Object.values(angular.projects ?? {})) {
  if (project.projectType !== 'application') continue;
  applications++;

  const targets = project.architect ?? project.targets;
  if (!targets?.build) {
    throw new Error('La cible Angular build est introuvable.');
  }

  targets.build.options ??= {};
  targets.build.options.styles = updateStyles(targets.build.options.styles);

  if (targets.test?.options?.styles) {
    targets.test.options.styles = updateStyles(targets.test.options.styles);
  }

  project.schematics ??= {};
  project.schematics['@schematics/angular:component'] = {
    ...project.schematics['@schematics/angular:component'],
    style: 'css'
  };
}

if (applications === 0) {
  throw new Error('Aucune application trouvée dans angular.json.');
}

pkg.scripts ??= {};
pkg.scripts.start = 'ng serve --proxy-config proxy.conf.json';
await writeFile(angularPath, JSON.stringify(angular, null, 2) + '\n');
await writeFile(packagePath, JSON.stringify(pkg, null, 2) + '\n');
console.log('Sportify configuré. Lancez npm.cmd start.');
