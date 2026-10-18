import test from 'node:test';
import assert from 'node:assert/strict';
import renumber from '../builtin/documentnode.renumber-headings/scripts/renumber.js';
const heading=(level,line,column=0,endLine=line+1)=>({level,line,column,endLine,plainText:'title',anchor:'title'});
async function execute(source,headings){
 let result=source; const calls=[];
 await renumber({target:null,ui:{},doc:{
  outline(){calls.push('outline');return {version:'v1',nodes:[],headings};},
  readSection(node){assert.equal(node,undefined);calls.push('read');return {markdown:source,version:'v1'};},
  replaceSection(node,text){assert.equal(node,undefined);calls.push('write');result=text;return {version:'v2'};}
 }});
 return {result,calls};
}
test('renumber preserves HTML, fences, CRLF and heading syntax with skipped levels',async()=>{
 const source='Preamble.\r\n\r\n<div>\r\n# unchanged HTML\r\n</div>\r\n\r\n# Old ###\r\n\r\n### Deep\r\n\r\n```md\r\n# untouched\r\n```\r\n\r\n### Sibling\r\n\r\nSetext\r\n------\r\n';
 const headings=[heading(1,6),heading(3,8),heading(3,14),heading(2,16,0,18)];
 const expected=source.replace('# Old ###','# 1 Old ###').replace('### Deep','### 1.1 Deep').replace('### Sibling','### 1.2 Sibling').replace('Setext\r\n------','1.3 Setext\r\n------');
 const first=await execute(source,headings);assert.equal(first.result,expected);assert.deepEqual(first.calls,['outline','read','write']);
 const second=await execute(expected,headings);assert.equal(second.result,expected);assert.deepEqual(second.calls,['outline','read']);
});
test('empty heading without final newline becomes a stable numbered heading',async()=>{
 assert.equal((await execute('#',[heading(1,0)])).result,'# 1');
 assert.equal((await execute('# 1',[heading(1,0)])).result,'# 1');
});
test('renumber refuses mismatched native source positions before writing',async()=>{
 await assert.rejects(execute('# A\n',[heading(2,0)]),/matched/);
 await assert.rejects(execute('# A\n',[heading(1,4)]),/matched/);
});
test('renumber uses native list, quote, footnote and multiline Setext source spans',async()=>{
 const source='# Top\n\n- ## List\n\n> ## Quote\n\nReference[^n].\n\n[^n]: ### Note\n\n> Multi\n> line\n> ====\n';
 // Source spans are captured by the native Comrak regression fixture.
 const headings=[heading(1,0),heading(2,2,2),heading(2,4,2),heading(3,8,6),heading(1,10,2,13)];
 const expected='# 1 Top\n\n- ## 1.1 List\n\n> ## 1.2 Quote\n\nReference[^n].\n\n[^n]: ### 1.2.1 Note\n\n> 2 Multi\n> line\n> ====\n';
 assert.equal((await execute(source,headings)).result,expected);
 assert.equal((await execute(expected,headings)).result,expected);
});
test('renumber handles a document whose only heading is inside a list',async()=>{
 assert.equal((await execute('- ## Inner',[heading(2,0,2)])).result,'- ## 1 Inner');
});
