import type { ToolIdentity } from '../../plugins/api';
import { FrontendTool } from '../plugins/FrontendPlugins';
import {useI18n} from '../../i18n/I18nContext';
import { PlainResultBody, Raw } from './ToolCards';
function GenericDetails({args,result}:{args?:Record<string,unknown>;result?:{text:string;success?:boolean}}){
 const entries=Object.entries(args??{});
 const nested=entries.some(([,value])=>typeof value==='object'&&value!==null);
 return <div className="min-w-0 space-y-2 p-3">{nested?<PlainResultBody text={JSON.stringify(args,null,2)}/>:<dl className="flex flex-wrap gap-2">{entries.slice(0,6).map(([key,value])=><div key={key} className="min-w-0 rounded border border-rule p-2"><dt className="text-dim">{key.replace(/([A-Z])/g,' $1').replace(/_/g,' ')}</dt><dd className="whitespace-pre-wrap break-words">{String(value).slice(0,1000)}{String(value).length>1000?'…':''}</dd></div>)}</dl>}{result?.success!==false&&result&&<PlainResultBody text={result.text}/>}</div>;
}
export default function ToolConversationDetails({args,result,...identity}: ToolIdentity & {args?:Record<string,unknown>;result?:{text:string;success?:boolean}}) {
 const {t}=useI18n();
 return <><FrontendTool {...identity} args={args} result={result} kind="conversation" fallback={<GenericDetails args={args} result={result}/>}/><div className="px-3 pb-2">{args&&<Raw label={t('tool.rawArguments')} text={JSON.stringify(args,null,2)}/>}{result&&<Raw label={t('tool.rawResult')} text={result.text}/>}</div></>;
}
