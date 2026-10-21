-- Average job value for dashboard revenue estimates
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS avg_job_value numeric NOT NULL DEFAULT 350;
ALTER TABLE businesses ADD CONSTRAINT avg_job_value_positive CHECK (avg_job_value > 0);

-- Index new foreign-key lookups used by dashboard queries
CREATE INDEX IF NOT EXISTS idx_events_lead_id ON events (lead_id);
CREATE INDEX IF NOT EXISTS idx_events_business_type ON events (business_id, event_type);
CREATE INDEX IF NOT EXISTS idx_calls_business_outcome ON calls (business_id, outcome);
CREATE INDEX IF NOT EXISTS idx_appointments_business_status ON appointments (business_id, status);
CREATE INDEX IF NOT EXISTS idx_leads_business_state ON leads (business_id, conversation_state);