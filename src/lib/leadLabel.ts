import type { Lead } from '@/types';

export interface LeadDisplayLabel {
  label: string;
  color: string;
  subText?: string;
}

export function getLeadDisplayLabel(lead: Lead): LeadDisplayLabel {
  if (lead.conversation_state === 'NEW') {
    return { label: 'New', color: 'bg-ink-100 text-ink-700 ring-ink-200' };
  }
  if (
    lead.conversation_state === 'QUALIFYING' ||
    lead.conversation_state === 'READY_TO_BOOK' ||
    lead.conversation_state === 'BOOKING'
  ) {
    return { label: 'In conversation', color: 'bg-amber-100 text-amber-800 ring-amber-300' };
  }
  if (lead.status === 'booked') {
    return { label: 'Booked', color: 'bg-accent-100 text-accent-800 ring-accent-300' };
  }
  if (lead.conversation_state === 'ESCALATED') {
    const reason = lead.qualification?.escalation_reason;
    return {
      label: 'Needs follow-up',
      color: 'bg-rose-100 text-rose-800 ring-rose-300',
      subText: reason ? reason.replace(/_/g, ' ') : undefined,
    };
  }
  return { label: 'Closed', color: 'bg-ink-100 text-ink-500 ring-ink-200' };
}
