import { chromium } from '@playwright/test';
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const assets=path.join(root,'docs/report/assets');
const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/demo.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {demoProject}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:2});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(state=>localStorage.setItem('guiye.workspace.v1',JSON.stringify(state)),{projects:[demoProject()],activeId:'demo',settings:{baseUrl:'https://api.deepseek.com',model:'deepseek-chat',prompt:'使用简体中文',correct:false,supplement:false}});
 await page.goto('http://127.0.0.1:1433/');
 await page.getByRole('heading',{name:'线性代数学习笔记',exact:true}).waitFor();
 await page.screenshot({path:path.join(assets,'app-overview.png')});
 for (const [name,file] of [['素材','app-sources'],['知识图谱','app-graph'],['知识文档','app-notes']]) {
  await page.locator('.page-nav').getByRole('button',{name:new RegExp(name)}).click();
  if(name==='知识图谱') await page.getByRole('button',{name:'矩阵对角化',exact:true}).click();
  if(name==='知识文档') await page.locator('.markdown-body').waitFor();
  await page.evaluate(()=>document.fonts.ready);
  await page.screenshot({path:path.join(assets,file+'.png')});
 }
 if(errors.length)throw new Error(errors.join('\n'));
 for(const name of ['architecture','organize-flow','rag-flow']){
  const diagram=await browser.newPage({deviceScaleFactor:2});
  await diagram.setContent('<style>body{margin:0}</style>'+fs.readFileSync(path.join(assets,name+'.svg'),'utf8'));
  await diagram.evaluate(()=>document.fonts.ready);
  await diagram.locator('svg').screenshot({path:path.join(assets,name+'.png')});
  await diagram.close();
 }
 console.log('Captured 4 current application screens and rendered 3 diagrams; no browser errors.');
}finally{await browser.close();}
