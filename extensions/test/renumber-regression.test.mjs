import test from 'node:test';
import assert from 'node:assert/strict';
import renumber from '../builtin/documentnode.renumber-headings/scripts/renumber.js';
const heading=(title,level,indexPath,children=[])=>({kind:'heading',title,level,indexPath,children});
async function execute(source,nodes){
 let result=source; const calls=[];
 await renumber({target:null,ui:{},doc:{
  outline(){calls.push('outline');return {version:'v1',nodes};},
  readSection(node){assert.equal(node,undefined);calls.push('read');return {markdown:source,version:'v1'};},
  replaceSection(node,text){assert.equal(node,undefined);calls.push('write');result=text;return {version:'v2'};}
 }});
 return {result,calls};
}
test('renumber preserves HTML, fences, CRLF and heading syntax with skipped levels',async()=>{
 const source='Preamble.\r\n\r\n<div>\r\n# unchanged HTML\r\n</div>\r\n\r\n# Old ###\r\n\r\n### Deep\r\n\r\n```md\r\n# untouched\r\n```\r\n\r\n### Sibling\r\n\r\nSetext\r\n------\r\n';
 const nodes=[heading('Old',1,'0',[heading('Deep',3,'0.0'),heading('Sibling',3,'0.1'),heading('Setext',2,'0.2')])];
 const expected=source.replace('# Old ###','# 1 Old ###').replace('### Deep','### 1.1 Deep').replace('### Sibling','### 1.2 Sibling').replace('Setext\r\n------','1.3 Setext\r\n------');
 const first=await execute(source,nodes);assert.equal(first.result,expected);assert.deepEqual(first.calls,['outline','read','write']);
 const second=await execute(expected,nodes);assert.equal(second.result,expected);assert.deepEqual(second.calls,['outline','read']);
});
test('empty heading without final newline becomes a stable numbered heading',async()=>{
 const nodes=[heading('',1,'0')];
 assert.equal((await execute('#',nodes)).result,'# 1');
 assert.equal((await execute('# 1',nodes)).result,'# 1');
});
test('renumber refuses a parser/outline mismatch before writing',async()=>{
 await assert.rejects(execute('# A\n',[heading('A',2,'0')]),/matched/);
});
