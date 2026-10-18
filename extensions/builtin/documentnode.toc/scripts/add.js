function a(n){return n.replace(/[!"#$%&'()*+\-,./:;<=>?@[\\\]^_`{|}~]/gu,"\\$&")}function l(n){let t=[];return n.map(e=>{if(e.plainText==null||e.anchor==null)throw new Error("MarkNode did not provide rendered heading metadata.");for(;t.length>0&&(t.at(-1)??0)>=(e.level??1);)t.pop();let o="  ".repeat(t.length);return t.push(e.level??1),`${o}- [${a(e.plainText)}](#${e.anchor})`}).join(`
`)}async function i({doc:n}){let e=n.outline().headings;if(e.length===0)return;let o=l(e),r=n.readSection().markdown;n.replaceSection(void 0,`${o}

${r}`)}export{i as default,l as tableOfContentsMarkdown};
