function l(n){return n.replace(/[!"#$%&'()*+\-,./:;<=>?@[\\\]^_`{|}~]/gu,"\\$&")}function r(n){return n.flatMap(e=>[...e.kind==="heading"?[e]:[],...r(e.children)])}function a(n){let e=[];return n.map(t=>{if(t.plainText==null||t.anchor==null)throw new Error("MarkNode did not provide rendered heading metadata.");for(;e.length>0&&(e.at(-1)??0)>=(t.level??1);)e.pop();let o="  ".repeat(e.length);return e.push(t.level??1),`${o}- [${l(t.plainText)}](#${t.anchor})`}).join(`
`)}async function d({doc:n}){let e=n.outline(),t=r(e.nodes);if(t.length===0)return;let o=a(t),i=n.readSection().markdown;n.replaceSection(void 0,`${o}

${i}`)}export{d as default,a as tableOfContentsMarkdown};
