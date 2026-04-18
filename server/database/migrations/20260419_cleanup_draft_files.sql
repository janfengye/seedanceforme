-- Clean up orphaned draft files with old paths (written by old code to non-persistent /app/data/)
DELETE FROM shot_draft_files WHERE disk_path LIKE 'data/draft-files/%';
