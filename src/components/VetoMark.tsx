const VetoMark = ({ live = false, className = 'mt-0.5 h-6 w-6' }: { live?: boolean; className?: string }) => (
  <svg aria-hidden="true" className={`veto-activity-mark ${className} shrink-0 ${live ? 'is-live' : ''}`} viewBox="0 0 256 256" fill="none">
    <rect width="256" height="256" rx="52" fill="#0E1116" />
    <path d="M48 60H84L128 160L150 110H185.78L144 204H112Z" fill="#E3E7EE" />
    <path className="veto-activity-segment" d="M172 60H208L192.89 94H157.04Z" fill="#E5484D" />
  </svg>
);

export default VetoMark;
