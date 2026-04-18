-- Add task_config column for storing generation parameters (prompt, model, ratio, duration, etc.)
ALTER TABLE tasks ADD COLUMN task_config TEXT DEFAULT NULL;
