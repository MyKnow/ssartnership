import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
export const TOKEN_RATCHET_PATTERNS = {
  standardShadow: /\bshadow-(?:sm|md|lg|xl|2xl)\b/g,
  classHex: /\b(?:text|bg|border|ring|fill|stroke)-\[#[0-9a-fA-F]+\]/g,
  smallText: /\btext-\[(?:10|11)px\]/g,
  important: /(?:^|\s)![a-z][a-z-]+/g,
  arbitraryRadius: /\brounded(?:-[a-z]{1,2})?-\[[^\]]+\]/g,
  viewportHeight: /(?:\b(?:min-|max-)?h-screen\b|\b(?:100vh)\b)/g,
};
export function designTokenInventory(root) {
  const files=[];function walk(dir){ for(const item of readdirSync(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())walk(path);else if(/\.(?:ts|tsx)$/.test(item.name)&&!item.name.includes('.stories.')&&!/\/(?:email-content|icon|opengraph-image)\./.test(path))files.push(path);}}
  walk(join(root,'src'));
  const counts=Object.fromEntries(Object.keys(TOKEN_RATCHET_PATTERNS).map(k=>[k,0]));const unknown=[];
  const css=readFileSync(join(root,'src/app/globals.css'),'utf8');
  const radii=new Set(['none','xs','sm','md','lg','xl','2xl','3xl','4xl','full',...Array.from(css.matchAll(/--radius-([\w-]+)\s*:/g),m=>m[1])]);
  for(const path of files){const source=ts.createSourceFile(path,readFileSync(path,'utf8'),ts.ScriptTarget.Latest,true);
    function visit(node){if(ts.isStringLiteral(node)||ts.isNoSubstitutionTemplateLiteral(node)){
      const text=node.text;
      for(const [key,pattern] of Object.entries(TOKEN_RATCHET_PATTERNS)) counts[key]+=Array.from(text.matchAll(pattern)).length;
      for(const m of text.matchAll(/\brounded-([a-z0-9]+(?:-[a-z0-9]+)*)\b/g)){
        if (text.slice(m.index + m[0].length, m.index + m[0].length + 2) === "-[") continue;
        const name=m[1].replace(/^(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee)-/,'');
        if(!radii.has(name))unknown.push(`${relative(root,path)}:${source.getLineAndCharacterOfPosition(node.pos).line+1}: ${m[0]}`);
      }
    }ts.forEachChild(node,visit);}visit(source);
  }
  return {counts,unknown};
}
