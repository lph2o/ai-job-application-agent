-- Add steel_websocket_url for reconnection after human verification
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS steel_websocket_url text;
