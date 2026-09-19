import type { ModelCallUsage } from '../lib/modelCallUsage';
import RequestUsage from './RequestUsage';
import ResponseUsage from './ResponseUsage';

export default function RoundUsage({ usage }: { usage?: ModelCallUsage }) {
  if (!usage) return null;
  return <span data-model-call-id={usage.modelCallId} className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
    <RequestUsage measurements={[usage]} />
    <ResponseUsage usage={usage} />
  </span>;
}
