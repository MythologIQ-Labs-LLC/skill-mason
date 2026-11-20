#!/usr/bin/env node
// Build static Pages client. Nothing here runs Prism SDK native gate or writes a holo.
import {build} from 'esbuild';
import {mkdir,copyFile,rm,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildPublicFourArmTrial} from '../src/evaluation/public-four-arm-trial.mjs';
const dest=resolve('web-dist');
await rm(dest,{recursive:true,force:true});
await mkdir(resolve(dest,'assets'),{recursive:true});
const result=await build({
  entryPoints:{app:resolve('web/app.mjs'),trial:resolve('web/trial.mjs')},outdir:dest,
  bundle:true,platform:'browser',format:'esm',target:'es2022',
  minify:true,metafile:true,write:true,legalComments:'none'
});
if(!Object.keys(result.metafile.inputs).some(p=>p.includes('prism-code')))
  throw Error('Refusing Pages build without real bundled Prism runtime');
const trial=await buildPublicFourArmTrial();
if(trial.schema!=='qortara/public-four-arm-source-trial/1'||
   trial.state!=='SOURCE_PINNED_PREVIEW_NOT_AN_APPROVED_OR_HOST_TESTED_SKILL'||
   trial.taskCount!==8||trial.armTaskCount!==32||
   trial.answerOraclesIncluded!==false||trial.sourceRightsApproved!==false||
   trial.modelCalls!==0||trial.prismInvoked!==false||
   trial.hostSkillInstalled!==false||trial.productionEligible!==false||
   trial.arms?.baseline!==null||
   ['ci_only','release_only','combined'].some(a=>
    trial.arms?.[a]?.productionEligible!==false||
    trial.arms?.[a]?.sourceReuseRightsApproved!==false||
    !/^[a-f0-9]{64}$/.test(trial.arms?.[a]?.contentSha256??'')))
  throw Error('Refusing unpinned or authority-promoted browser trial packet');
if(trial.tasks.some(t=>Object.hasOwn(t,'oracle')||
  Object.hasOwn(t,'privateSyntheticCanaries')))
  throw Error('Refusing to publish answer keys or sensitive oracle data');

await Promise.all([
  copyFile('web/index.html',resolve(dest,'index.html')),
  copyFile('web/trial.html',resolve(dest,'trial.html')),
  copyFile('web/trial.css',resolve(dest,'trial.css')),
  copyFile('web/style.css',resolve(dest,'style.css')),
  copyFile('assets/brand/qortara-skills-icon.webp',resolve(dest,'assets/qortara-skills-icon.webp')),
  copyFile('assets/brand/qortara-skills-banner.webp',resolve(dest,'assets/qortara-skills-banner.webp'))
]);
await writeFile(resolve(dest,'four-arm-trial.json'),JSON.stringify(trial,null,2)+'\n');
await writeFile(resolve(dest,'.nojekyll'),'');
await writeFile(resolve(dest,'build-info.json'),JSON.stringify({
  schema:'qortara/pages-build/1',runtime:'prism-code@0.9.5',
  serverMcp:false,hasEmbeddedHolo:false,productionQualified:false
},null,2)+'\n');
console.log('Built GitHub Pages static client at '+dest);
