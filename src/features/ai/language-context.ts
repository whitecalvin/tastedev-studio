import {aiPath} from './security.ts';
export function sourceLanguage(path:string){aiPath(path);return /\.(?:[cm]?ts|tsx)$/i.test(path)?'typescript':/\.(?:[cm]?js|jsx)$/i.test(path)?'javascript':/\.rs$/i.test(path)?'rust':/\.pyi?$/i.test(path)?'python':'other';}
/** These are observed log excerpts, not validated source locations or root causes.
 * Related files/lines must still pass the existing read_file citation grounding. */
export function languageObservations(path:string,source:string,logs:string){
 const language=sourceLanguage(path),lines=logs.slice(0,12000).split('\n'),observations:{kind:'compiler'|'runtime';code?:string;text:string}[]=[];
 for(const line of lines){
  const rust=/\berror\[(E\d{4})\]/.exec(line),ts=/\berror (TS\d{3,6})\b/.exec(line);
  if(rust||ts)observations.push({kind:'compiler',code:(rust??ts)![1],text:line.slice(0,500)});
  else if(/Traceback \(most recent call last\)|\b(?:SyntaxError|TypeError|AssertionError|ValueError|ReferenceError)\b|panicked at/.test(line))observations.push({kind:'runtime',text:line.slice(0,500)});
  if(observations.length===20)break;
 }
 return{language,sourcePath:path,sourceLineCount:source.split('\n').length,observations,grounding:'Log observations only. Read source and search references before asserting locations or causes.',limited:logs.length>12000||observations.length===20};
}
