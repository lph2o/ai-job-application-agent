-- Enable Row Level Security on jobs table
alter table jobs enable row level security;

-- Users can only read, insert, update, and delete their own jobs
create policy "Users can manage their own jobs"
  on jobs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
