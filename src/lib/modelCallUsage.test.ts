import { expect, it } from 'vitest';
import type { HistoryTurn, LlmUsage } from '../api/types';
import { modelCallUsage, modelCallUsageAnchors } from './modelCallUsage';
const turn = (n: number, input: number, agentId = 'primary', extra: Partial<LlmUsage> = {}): HistoryTurn => ({turnNumber:n, agentId, type:'ASSISTANT_RESPONSE', timestamp:'', payload:{model_call_id: `${agentId}-${n}`}, llmUsage:[{modelCallId:`${agentId}-${n}`, inputTokens:input, outputTokens:72, contextMaxTokens:200000, model:'m', provider:'p', ...extra}]});
it('derives the second user request from persisted history after reload', () => {
 const history = [turn(7,19291), turn(9,19436)];
 const usage = modelCallUsage(JSON.parse(JSON.stringify(history)));
 expect(usage.get('primary-9')?.displayInputTokens).toBe(145);
 expect(usage.get('primary-9')?.inputTokens).toBe(19436);
 expect(history[1].payload).not.toHaveProperty('llmUsage');
});
it('keeps agent histories and model changes separate', () => {
 const usage = modelCallUsage([turn(1,100),turn(1,500,'mate'),turn(2,130),turn(2,520,'mate'),turn(3,700,'primary',{model:'other'})]);
 expect(usage.get('primary-2')?.displayInputTokens).toBe(30);
 expect(usage.get('mate-2')?.displayInputTokens).toBe(20);
 expect(usage.get('primary-3')?.displayInputTokens).toBe(700);
});
it('does not use compaction calls or restored copies as previous conversation requests', () => {
 const copy=turn(4,999);copy.payload.restored_from_turn=1;
 const usage=modelCallUsage([turn(1,100),turn(2,1000,'primary',{purpose:'compaction'}),copy,turn(5,140)]);
 expect(usage.get('primary-5')?.displayInputTokens).toBe(40);
});
it('anchors one request on the last tool result', () => {
 const first=turn(1,100);
 const tool=(n:number,id:string,type:HistoryTurn['type']):HistoryTurn=>({turnNumber:n,type,timestamp:'',payload:{call_id:id,model_call_id:'primary-1'}});
 const records=[first,tool(2,'a','TOOL_CALL'),tool(3,'b','TOOL_CALL'),tool(4,'a','TOOL_RESPONSE'),tool(5,'b','TOOL_RESPONSE')];
 const anchors=modelCallUsageAnchors(records);expect(anchors.size).toBe(1);expect(anchors.has(records[4])).toBe(true);
});
