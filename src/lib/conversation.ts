import type { Business, LeadStatus, ConversationState } from '@/types';
import { formatDate, formatDateLong, formatTimeRange } from '@/lib/datetime';

export interface Qualification {
  initial_issue?: string;
  service_type?: string;
  issue?: string;
  urgency?: string;
  zip?: string;
  preferred_time?: string;
  unrecognized_count?: number;
  zip_in_service_area?: boolean;
  escalation_reason?: string;
  offered_slot_ids?: string[];
  booking_invalid_count?: number;
}

const SAFETY_RE = /\b(?:gas|smoke|smoking|fire|spark|sparks|sparking|flood|flooding|flooded|carbon\s+monoxide)\b/i;

const HUMAN_REQUEST_RES: RegExp[] = [
  /\b(?:talk|speak|chat|connect|transfer)\s+(?:me\s+)?(?:to|with)\s+(?:a|an|the)?\s*(?:real|live)?\s*(?:human|person|agent|representative|rep|manager|supervisor|someone|somebody|operator)\b/i,
  /\b(?:real|live)\s+(?:human|person|agent)\b/i,
  /\b(?:human|agent|representative|operator)\s+please\b/i,
  /\bi\s+(?:want|need)\s+(?:a|an)?\s*(?:real|live)?\s*(?:human|agent|representative|operator)\b/i,
  /\bcall\s+me\b/i,
  /\b(?:human|agent|representative|operator)\b/i,
];

const NONE_WORK_RE = /\b(?:none|neither)\b|\bnone\s+of\s+(?:those|these)\b|\bno\s+option\b|\b(?:different|other|another)\s+time\b|\b(?:does\s+not|doesn'?t|do\s+not|don'?t)\s+work\b|\bnot\s+work\b|\bany\s+other\b/i;

export function containsSafetyKeyword(text: string): boolean {
  return SAFETY_RE.test(text);
}

export function containsHumanRequest(text: string): boolean {
  return HUMAN_REQUEST_RES.some((re) => re.test(text));
}

export function containsNoneWorkRequest(text: string): boolean {
  return NONE_WORK_RE.test(text);
}

export function extractZip(text: string): string | null {
  const match = text.match(/\b\d{5}\b/);
  return match ? match[0] : null;
}

export function extractChoice(text: string): number | null {
  const t = text.trim().toLowerCase().replace(/[.!,?]+$/g, '').replace(/\s+/g, ' ');
  if (/^[123]$/.test(t)) return parseInt(t, 10);
  const labeled = t.match(/^(?:option|#|number|choice)\s*([123])$/);
  if (labeled) return parseInt(labeled[1], 10);
  const word = t.match(/^(first|second|third)(?:\s+one)?$/);
  if (word) return { first: 1, second: 2, third: 3 }[word[1]] ?? null;
  return null;
}

export function getRecoveryMessage(businessName: string): string {
  return `Hi, this is ${businessName}. We noticed we missed your call. Can you tell us what issue you're having so we can help?`;
}

export function getSafetyMessage(businessName: string): string {
  return `Your safety comes first. Please leave the area and contact your local emergency services if you're in danger. A team member from ${businessName} will follow up with you right away.`;
}

export function getHumanEscalationMessage(businessName: string): string {
  return `No problem — I'll have a team member from ${businessName} follow up with you personally.`;
}

export function getUnrecognizedEscalationMessage(businessName: string): string {
  return `I'm having trouble understanding your response. I'll have a team member from ${businessName} follow up with you directly.`;
}

export function getOutsideServiceAreaMessage(): string {
  return `Thanks. That location may be outside our service area, so a team member will follow up to confirm.`;
}

export function getNoAvailabilityMessage(): string {
  return `We don't have an open time right now, so a team member will follow up.`;
}

export function getNeedsOtherTimeMessage(businessName: string): string {
  return `No problem — a team member from ${businessName} will follow up to find a time that works for you.`;
}

export function getBookingInvalidRetryMessage(options: string[]): string {
  return `I didn't catch which option you meant. Here are the available times again:\n${options.join('\n')}\n${getReplyInstruction(options.length)}`;
}

export function getSlotTakenMessage(options: string[]): string {
  return `Sorry, that time is no longer available. Here are the current open times:\n${options.join('\n')}\n${getReplyInstruction(options.length)}`;
}

export function getReplyInstruction(count: number): string {
  if (count <= 1) return 'Reply 1 to choose it.';
  if (count === 2) return 'Reply 1 or 2 to choose one.';
  return 'Reply 1, 2, or 3 to choose one.';
}

export function getBookingConfirmationMessage(dateStr: string, timeStr: string): string {
  return `You're all set! Your appointment is scheduled for ${dateStr} from ${timeStr}. We look forward to helping you then.`;
}

export function getCurrentQuestion(qual: Qualification): number {
  if (!qual.issue) return 1;
  if (!qual.urgency) return 2;
  if (!qual.zip) return 3;
  if (!qual.preferred_time) return 4;
  return 0;
}

export function getQuestionMessage(questionNum: number): string {
  switch (questionNum) {
    case 1:
      return 'Can you tell us what issue you\'re having so we can help?';
    case 2:
      return 'Thanks for sharing that. How soon do you need this taken care of? (For example: emergency, within a few days, or whenever you can fit me in.)';
    case 3:
      return 'Got it. What\'s your zip code or area? We want to make sure we cover your location.';
    case 4:
      return 'Great. What time of day works best for you? (Morning, afternoon, or evening?)';
    default:
      return 'Thanks for all that information! We\'ve got everything we need.';
  }
}

export function getSlotOptionsMessage(options: string[]): string {
  return `Here are some available appointment times:\n${options.join('\n')}\n${getReplyInstruction(options.length)}`;
}

export function getAutoOfferMessage(options: string[], prefix?: string): string {
  const head = prefix ? `${prefix}\n` : 'Thanks for all that information! Here are some available appointment times:\n';
  return `${head}${options.join('\n')}\n${getReplyInstruction(options.length)}`;
}

export function getDayUnavailablePrefix(dayRequest: string): string {
  const label = dayRequest.charAt(0).toUpperCase() + dayRequest.slice(1);
  return `${label} isn't available, but here are the next openings:`;
}

const DAY_KEYWORDS = ['today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'tues', 'thurs', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function detectDayRequest(text: string | undefined): string | null {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const kw of DAY_KEYWORDS) {
    if (new RegExp(`\\b${kw}\\b`).test(lower)) return kw;
  }
  return null;
}

export interface ProcessResult {
  systemReply: string;
  newQualification: Qualification;
  newState: ConversationState;
  newStatus: LeadStatus;
  additionalEvents: string[];
  /** Reason for escalation, included in the lead.escalated event payload */
  escalationReason: string | null;
  /** Set when the final qualification answer was recognized: the page should offer slots in the same step */
  autoOffer: boolean;
  /** Index (0-based) of the chosen slot from offered_slot_ids, or null if no booking choice */
  chosenSlotIndex: number | null;
}

export function processCustomerReply(
  text: string,
  qualification: Qualification,
  currentState: ConversationState,
  business: Business,
): ProcessResult {
  const bizName = business.name || 'our team';

  if (containsSafetyKeyword(text)) {
    return {
      systemReply: getSafetyMessage(bizName),
      newQualification: { ...qualification, unrecognized_count: 0, escalation_reason: 'safety keyword' },
      newState: 'ESCALATED',
      newStatus: 'contacted',
      additionalEvents: ['lead.escalated'],
      escalationReason: 'safety keyword',
      autoOffer: false,
      chosenSlotIndex: null,
    };
  }

  if (containsHumanRequest(text)) {
    return {
      systemReply: getHumanEscalationMessage(bizName),
      newQualification: { ...qualification, unrecognized_count: 0, escalation_reason: 'customer asked for human' },
      newState: 'ESCALATED',
      newStatus: 'contacted',
      additionalEvents: ['lead.escalated'],
      escalationReason: 'customer asked for human',
      autoOffer: false,
      chosenSlotIndex: null,
    };
  }

  if (currentState === 'BOOKING') {
    const offeredIds = qualification.offered_slot_ids || [];
    const invalidCount = qualification.booking_invalid_count || 0;

    if (containsNoneWorkRequest(text)) {
      return {
        systemReply: getNeedsOtherTimeMessage(bizName),
        newQualification: { ...qualification, escalation_reason: 'needs other time' },
        newState: 'ESCALATED',
        newStatus: 'contacted',
        additionalEvents: ['lead.escalated'],
        escalationReason: 'needs other time',
        autoOffer: false,
        chosenSlotIndex: null,
      };
    }

    const choice = extractChoice(text);
    if (choice !== null && choice >= 1 && choice <= offeredIds.length) {
      return {
        systemReply: '',
        newQualification: { ...qualification, booking_invalid_count: 0, escalation_reason: undefined },
        newState: 'BOOKING',
        newStatus: 'qualified',
        additionalEvents: [],
        escalationReason: null,
        autoOffer: false,
        chosenSlotIndex: choice - 1,
      };
    }

    const newInvalidCount = invalidCount + 1;
    if (newInvalidCount >= 2) {
      return {
        systemReply: getUnrecognizedEscalationMessage(bizName),
        newQualification: { ...qualification, booking_invalid_count: newInvalidCount, escalation_reason: 'invalid slot choice twice' },
        newState: 'ESCALATED',
        newStatus: 'contacted',
        additionalEvents: ['lead.escalated'],
        escalationReason: 'invalid slot choice twice',
        autoOffer: false,
        chosenSlotIndex: null,
      };
    }

    return {
      systemReply: '',
      newQualification: { ...qualification, booking_invalid_count: newInvalidCount, escalation_reason: undefined },
      newState: 'BOOKING',
      newStatus: 'qualified',
      additionalEvents: [],
      escalationReason: null,
      autoOffer: false,
      chosenSlotIndex: null,
    };
  }

  if (currentState !== 'QUALIFYING') {
    return {
      systemReply: `A team member from ${bizName} will follow up with you.`,
      newQualification: qualification,
      newState: currentState,
      newStatus: currentState === 'READY_TO_BOOK' ? 'qualified' : 'contacted',
      additionalEvents: [],
      escalationReason: null,
      autoOffer: false,
      chosenSlotIndex: null,
    };
  }

  const questionNum = getCurrentQuestion(qualification);
  const newQual: Qualification = { ...qualification, unrecognized_count: qualification.unrecognized_count || 0 };
  let recognized = false;

  switch (questionNum) {
    case 1:
      if (text.trim().length > 2) {
        newQual.issue = text.trim();
        recognized = true;
      }
      break;
    case 2:
      if (text.trim().length > 2) {
        newQual.urgency = text.trim();
        recognized = true;
      }
      break;
    case 3: {
      const zip = extractZip(text);
      if (zip) {
        newQual.zip = zip;
        const serviceZips = business.service_zips || [];

        if (serviceZips.length === 0) {
          newQual.zip_in_service_area = false;
          newQual.escalation_reason = 'service area not configured';
          return {
            systemReply: getOutsideServiceAreaMessage(),
            newQualification: newQual,
            newState: 'ESCALATED',
            newStatus: 'contacted',
            additionalEvents: ['lead.escalated'],
            escalationReason: 'service area not configured',
            autoOffer: false,
            chosenSlotIndex: null,
          };
        }

        const inArea = serviceZips.includes(zip);
        newQual.zip_in_service_area = inArea;

        if (!inArea) {
          newQual.escalation_reason = 'outside service area';
          return {
            systemReply: getOutsideServiceAreaMessage(),
            newQualification: newQual,
            newState: 'ESCALATED',
            newStatus: 'contacted',
            additionalEvents: ['lead.escalated'],
            escalationReason: 'outside service area',
            autoOffer: false,
            chosenSlotIndex: null,
          };
        }

        recognized = true;
      }
      break;
    }
    case 4:
      if (text.trim().length > 2) {
        newQual.preferred_time = text.trim();
        recognized = true;
      }
      break;
    default:
      recognized = true;
      break;
  }

  if (recognized) {
    newQual.unrecognized_count = 0;
    const nextQuestion = getCurrentQuestion(newQual);
    if (nextQuestion === 0) {
      // Qualification complete: the page offers slots in this same step (autoOffer)
      return {
        systemReply: '',
        newQualification: newQual,
        newState: 'READY_TO_BOOK',
        newStatus: 'qualified',
        additionalEvents: ['lead.qualified'],
        escalationReason: null,
        autoOffer: true,
        chosenSlotIndex: null,
      };
    }
    return {
      systemReply: getQuestionMessage(nextQuestion),
      newQualification: newQual,
      newState: 'QUALIFYING',
      newStatus: 'contacted',
      additionalEvents: [],
      escalationReason: null,
      autoOffer: false,
      chosenSlotIndex: null,
    };
  }

  newQual.unrecognized_count = (newQual.unrecognized_count || 0) + 1;
  if (newQual.unrecognized_count >= 2) {
    newQual.escalation_reason = 'unrecognized answer twice';
    return {
      systemReply: getUnrecognizedEscalationMessage(bizName),
      newQualification: newQual,
      newState: 'ESCALATED',
      newStatus: 'contacted',
      additionalEvents: ['lead.escalated'],
      escalationReason: 'unrecognized answer twice',
      autoOffer: false,
      chosenSlotIndex: null,
    };
  }

  const retryMessage =
    questionNum === 3
      ? "I didn't catch a zip code in that. Could you share your 5-digit zip code?"
      : `I didn't quite catch that. ${getQuestionMessage(questionNum)}`;
  return {
    systemReply: retryMessage,
    newQualification: newQual,
    newState: 'QUALIFYING',
    newStatus: 'contacted',
    additionalEvents: [],
    escalationReason: null,
    autoOffer: false,
    chosenSlotIndex: null,
  };
}

export interface SlotSelectionResult {
  slots: Array<{ id: string; start_time: string; end_time: string }>;
  preferenceMatched: boolean;
  dayRequest: string | null;
  dayMatched: boolean;
}

/**
 * Slots are created from local date/time inputs (combineDateAndTime) and displayed
 * with local toLocaleTimeString formatters, so classification uses the same local
 * basis via getHours(). This keeps "a slot shown as 9:00 AM is morning" true in
 * every timezone. Preference ranks but never filters: unmatched preferences fall
 * back to the earliest (or latest, for evening) open slots.
 */
export function selectSlotsForOffering(
  slots: Array<{ id: string; start_time: string; end_time: string }>,
  preferredTime: string | undefined,
  maxCount: number = 3,
): SlotSelectionResult {
  const now = new Date();
  const future = slots.filter((s) => new Date(s.start_time) > now);
  const sorted = future.sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

  const dayRequest = detectDayRequest(preferredTime);
  let dayMatched = false;
  if (dayRequest) {
    const dayFiltered = sorted.filter((s) => {
      const slotDate = new Date(s.start_time);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const slotDay = new Date(slotDate);
      slotDay.setHours(0, 0, 0, 0);
      const diffDays = Math.round((slotDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      if (dayRequest === 'today') return diffDays === 0;
      if (dayRequest === 'tomorrow') return diffDays === 1;
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const shortNames = ['sun', 'mon', 'tue', 'tues', 'wed', 'thu', 'thurs', 'fri', 'sat', 'sun'];
      const targetIdx = dayNames.indexOf(dayRequest);
      if (targetIdx >= 0) return slotDate.getDay() === targetIdx;
      return false;
    });
    if (dayFiltered.length >= 1) {
      dayMatched = true;
      return { slots: dedupeSlotsByWindow(dayFiltered.slice(0, maxCount)), preferenceMatched: true, dayRequest, dayMatched };
    }
  }

  if (preferredTime) {
    const lower = preferredTime.toLowerCase();
    let hourPref: 'morning' | 'afternoon' | 'evening' | null = null;
    if (/\bmorning\b/.test(lower)) hourPref = 'morning';
    else if (/\bafternoon\b/.test(lower)) hourPref = 'afternoon';
    else if (/\bevening\b/.test(lower) || /\bafter\s+3\b/.test(lower)) hourPref = 'evening';

    if (hourPref) {
      const filtered = sorted.filter((s) => {
        const h = new Date(s.start_time).getHours();
        if (hourPref === 'morning') return h < 12;
        if (hourPref === 'afternoon') return h >= 12 && h < 17;
        return h >= 15;
      });
      if (filtered.length >= 1) {
        return { slots: dedupeSlotsByWindow(filtered.slice(0, maxCount)), preferenceMatched: true, dayRequest, dayMatched };
      }
      // Evening with no matches: offer the latest available slots instead
      if (hourPref === 'evening' && sorted.length >= 1) {
        return { slots: dedupeSlotsByWindow(sorted.slice(-maxCount)), preferenceMatched: false, dayRequest, dayMatched };
      }
    }
  }

  return { slots: dedupeSlotsByWindow(sorted.slice(0, maxCount)), preferenceMatched: false, dayRequest, dayMatched };
}

// Two rows can describe the same window; the customer must never see the same
// time offered twice in one list.
function dedupeSlotsByWindow<T extends { start_time: string; end_time: string }>(slots: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const s of slots) {
    const key = `${s.start_time}|${s.end_time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function formatSlotOption(index: number, startTime: string, endTime: string): string {
  return `${index}. ${formatDate(startTime)}, ${formatTimeRange(startTime, endTime)}`;
}

export function formatSlotDate(startTime: string): string {
  return formatDateLong(startTime);
}

export function formatSlotTimeRange(startTime: string, endTime: string): string {
  return formatTimeRange(startTime, endTime);
}
