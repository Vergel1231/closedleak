export interface Business {
  id: string;
  owner_id: string;
  name: string;
  phone: string;
  address: string;
  service_area: string;
  service_zips: string[];
  business_hours: Record<string, string>;
  supported_services: string[];
  avg_job_value: number;
  created_at: string;
}

export interface Customer {
  id: string;
  business_id: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  address: string;
  is_demo: boolean;
  created_at: string;
}

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'booked' | 'lost';

export type ConversationState = 'NEW' | 'QUALIFYING' | 'READY_TO_BOOK' | 'BOOKING' | 'ESCALATED' | 'CLOSED';

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

export interface Lead {
  id: string;
  business_id: string;
  customer_id: string | null;
  source: string;
  status: LeadStatus;
  conversation_state: ConversationState;
  qualification: Qualification | null;
  is_demo: boolean;
  created_at: string;
}

export interface Call {
  id: string;
  business_id: string;
  customer_id: string | null;
  lead_id: string | null;
  direction: string;
  phone_number: string;
  duration_seconds: number;
  outcome: string;
  is_demo: boolean;
  created_at: string;
}

export interface Message {
  id: string;
  business_id: string;
  customer_id: string | null;
  lead_id: string | null;
  direction: string;
  body: string;
  is_demo: boolean;
  created_at: string;
}

export type AppointmentStatus = 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show' | 'booked';

export interface Appointment {
  id: string;
  business_id: string;
  customer_id: string;
  lead_id: string | null;
  slot_id: string | null;
  scheduled_at: string;
  status: AppointmentStatus;
  notes: string;
  is_demo: boolean;
  created_at: string;
}

export interface AvailabilitySlot {
  id: string;
  business_id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
  created_at: string;
}

export interface Event {
  id: string;
  business_id: string;
  lead_id: string | null;
  customer_id: string | null;
  event_type: string;
  payload: Record<string, unknown>;
  is_demo: boolean;
  created_at: string;
}
