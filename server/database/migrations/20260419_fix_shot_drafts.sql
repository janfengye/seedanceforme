ALTER TABLE shot_drafts ADD COLUMN version INTEGER DEFAULT 1;
UPDATE shot_drafts SET expires_at = datetime('now', '+30 days');
