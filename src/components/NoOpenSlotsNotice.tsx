import { CalendarPlus, Loader2 } from 'lucide-react';

interface NoOpenSlotsNoticeProps {
  onGenerate: () => void;
  generating: boolean;
}

/**
 * Notice shown on Leads and Dashboard when the business has no open future
 * availability slots, with a one-click generator for sample times.
 */
export default function NoOpenSlotsNotice({ onGenerate, generating }: NoOpenSlotsNoticeProps) {
  return (
    <div className="mb-6 flex items-start justify-between flex-wrap gap-3 rounded-xl bg-amber-50 border border-amber-300 px-4 py-3">
      <p className="text-sm text-amber-900">
        No open appointment times yet, so simulated customers can't be booked. Generate sample times or add your own on the Appointments page.
      </p>
      <button
        onClick={onGenerate}
        disabled={generating}
        className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-60 disabled:cursor-not-allowed shrink-0"
      >
        {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
        Generate sample times
      </button>
    </div>
  );
}
