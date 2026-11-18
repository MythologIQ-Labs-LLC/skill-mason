#!/usr/bin/env node
// Build static Pages client. Nothing here runs Prism SDK native gate or writes a holo.
import {build} from 'esbuild';
import {mkdir,copyFile,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
const dest=resolve('web-dist');
await rm(dest,{recursive:true,force:true});
await mkdir(resolve(dest,'assets'),{recursive:true});
const result=await build({
  entryPoints:[resolve('web/app.mjs')],outfile:resolve(dest,'app.js'),
  bundle:true,platform:'browser',format:'esm',target:'es2022',
  minify:true,metafile:true,write:true,legalComments:'none'
});
if(!Object.keys(result.metafile.inputs).some(p=>p.includes('prism-code')))
  throw Error('Refusing Pages build without real bundled Prism runtime');
await Promise.all([
  copyFile('web/index.html',resolve(dest,'index.html')),
  copyFile('web/style.css',resolve(dest,'style.css')),
  copyFile('assets/brand/qortara-skills-icon.webp',resolve(dest,'assets/qortara-skills-icon.webp')),
  copyFile('assets/brand/qortara-skills-banner.webp',resolve(dest,'assets/qortara-skills-banner.webp'))
]);
await writeFile(resolve(dest,'.nojekyll'),'');
await writeFile(resolve(dest,'build-info.json'),JSON.stringify({
  schema:'qortara/pages-build/1',runtime:'prism-code@0.9.5',
  serverMcp:false,hasEmbeddedHolo:false,productionQualified:false
},null,2)+'\n');
console.log('Built GitHub Pages static client at '+dest);
