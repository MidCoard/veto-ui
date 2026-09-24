import React, {useState} from 'react';
import { useI18n } from '../../i18n/I18nContext';
import type { ToolIdentity } from '../../plugins/api';
import { FrontendTool } from '../plugins/FrontendPlugins';
export const PlainResultBody = ({text}:{text:string}) => <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded border border-rule bg-panel p-3 text-xs">{text}</pre>;
export const GenericToolCallCard = ({toolName,args}:{toolName?:string;args?:Record<string,unknown>}) => <div className="min-w-0 space-y-2"><p className="font-mono text-xs">{toolName}</p>{args&&<PlainResultBody text={JSON.stringify(args,null,2)}/>}</div>;
export function Raw({label,text}:{label:string;text:string}) {const [open,setOpen]=useState(false);return <details className="mt-2 text-xs text-dim" onToggle={event=>setOpen(event.currentTarget.open)}><summary>{label}</summary>{open&&<PlainResultBody text={text}/>}</details>;}
export function ToolCallCard({args,...identity}: ToolIdentity & {args?:Record<string,unknown>}) {
 const {t}=useI18n();
 return <div className="min-w-0"><FrontendTool {...identity} args={args} kind="call" fallback={<GenericToolCallCard {...identity} args={args}/>}/>{args&&<Raw label={t("tool.rawArguments")} text={JSON.stringify(args,null,2)}/>}</div>;
}
export function ToolResultBody({text,success,...identity}: ToolIdentity & {text:string;success?:boolean}) {
 const {t}=useI18n();
 return <div className="min-w-0"><FrontendTool {...identity} text={text} success={success} kind="result" fallback={<PlainResultBody text={text}/>}/><Raw label={t("tool.rawResult")} text={text}/></div>;
}
export const ToolCallRow=({tag,footer,className='',...props}: ToolIdentity & {tag:React.ReactNode;args?:Record<string,unknown>;footer?:React.ReactNode;className?:string}) => <div className={`flex gap-3 py-2 ${className}`}>{tag}<div className="min-w-0 flex-1"><ToolCallCard {...props}/>{footer}</div></div>;
