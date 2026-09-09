import VetoMark from './VetoMark';

export default function BusyIndicator({ label, icon = true }: { label: string; icon?: boolean }) {
  return <span role="status" className="inline-flex items-center justify-center gap-2 align-middle">
    {icon && <VetoMark live className="h-4 w-4" />}
    <span>{label}</span>
    <span aria-hidden="true" className="busy-dots"><i /><i /><i /></span>
  </span>;
}
