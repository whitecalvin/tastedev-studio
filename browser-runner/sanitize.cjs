function sanitizer(values=[]){
 const secrets=values.filter(v=>typeof v==='string'&&v.length>0).sort((a,b)=>b.length-a.length);
 return function clean(value){
  if(typeof value==='string'){
   let text=value.replace(/\x1b\[[0-9;]*m/g,'');for(const secret of secrets)text=text.split(secret).join('[redacted]');
   text=text.replace(/https?:\/\/[^\s"<>]+/g,raw=>{try{const u=new URL(raw);u.username='';u.password='';u.search=u.search?'?[redacted]':'';u.hash='';return u.href;}catch{return '[url]';}});
   return text.replace(/(authorization|password|token|secret|api[_-]?key)(["']?\s*[:=]\s*["']?)(?:Bearer\s+)?[^\s,"'}]+/gi,'$1$2[redacted]').slice(0,8000);
  }
  if(Array.isArray(value))return value.slice(0,500).map(clean);
  if(value&&typeof value==='object'){const out={};for(const [k,v] of Object.entries(value)){out[k]=/^(headers|cookies|queryString)$/i.test(k)?[]:/postData/i.test(k)?undefined:/authorization|password|token|secret|cookie|^body$|sha1/i.test(k)?'[redacted]':clean(v);}return out;}
  return value;
 };
}
module.exports={sanitizer};
