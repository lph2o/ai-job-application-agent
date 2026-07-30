import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local" });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("❌ Missing env vars. Check .env.local");
  process.exit(1);
}

// Admin client (bypasses RLS)
const adminClient = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const TEST_EMAIL = "alextest@jobbuddy.io";

async function main() {
  console.log("🧪 Testing Auto-Apply Flow\n");

  // Step 1: Find the test user by email
  console.log("📧 Step 1: Looking up test user:", TEST_EMAIL);
  const { data: { users }, error: lookupErr } = await adminClient.auth.admin.listUsers();
  
  if (lookupErr) {
    console.error("❌ List users failed:", lookupErr.message);
    process.exit(1);
  }
  
  const testUser = users.find(u => u.email === TEST_EMAIL);
  if (!testUser) {
    console.error("❌ Test user not found. Run the create-user script first.");
    process.exit(1);
  }
  
  const userId = testUser.id;
  console.log("✅ Found user. ID:", userId);

  // Step 2: Check if user has any jobs, if not create one
  console.log("\n📋 Step 2: Checking existing jobs...");
  const { data: existingJobs } = await adminClient
    .from("jobs")
    .select("id, title, company, job_url, platform, application_status")
    .eq("user_id", userId)
    .limit(10);

  let jobToApply;
  if (existingJobs && existingJobs.length > 0) {
    console.log(`✅ Found ${existingJobs.length} existing jobs`);
    existingJobs.forEach((j) => console.log(`   - ${j.title} at ${j.company} [${j.application_status}]`));
    jobToApply = existingJobs[0];
  } else {
    // Create a test job
    console.log("⚠️  No jobs found. Creating a test job...");
    const { data: newJob, error: createErr } = await adminClient
      .from("jobs")
      .insert({
        user_id: userId,
        title: "Senior Frontend Developer",
        company: "TestCorp AI",
        location: "Remote",
        job_url: "https://job-boards.greenhouse.io/graphcore/jobs/8653358002",
        platform: "greenhouse",
        description: "We're looking for a Senior Frontend Developer with React and TypeScript experience.",
        salary: "$120k - $180k",
        match_score: 85,
        application_status: "idle",
        applied_status: false,
      })
      .select("id, title, company, job_url, platform, application_status")
      .single();

    if (createErr) {
      console.error("❌ Failed to create test job:", createErr.message);
      process.exit(1);
    }
    console.log("✅ Test job created:", newJob.title, "at", newJob.company);
    jobToApply = newJob;
  }

  console.log("\n🎯 Target job:", jobToApply.title, "at", jobToApply.company);
  console.log("   URL:", jobToApply.job_url);
  console.log("   Platform:", jobToApply.platform);

  // Step 3: Set application_status to idle (reset)
  console.log("\n🔄 Step 3: Resetting job status to 'idle'...");
  await adminClient
    .from("jobs")
    .update({ application_status: "idle", application_error: null, unknown_form_fields: null })
    .eq("id", jobToApply.id);

  // Step 4: Dispatch Inngest event via dev server
  console.log("\n🚀 Step 4: Dispatching Inngest 'job/application.detect' event...");

  const eventPayload = [{
    name: "job/application.detect",
    data: {
      jobId: jobToApply.id,
      userId: userId,
      jobUrl: jobToApply.job_url,
    },
  }];

  // Send via Inngest dev server event API (port 8288)
  const eventKey = process.env.INNGEST_EVENT_KEY || "";
  const inngestResponse = await fetch(`http://localhost:8288/e/${eventKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(eventPayload),
  });

  console.log("   Inngest response status:", inngestResponse.status);
  const inngestBody = await inngestResponse.json();
  console.log("   Inngest response:", JSON.stringify(inngestBody).substring(0, 200));

  // Step 5: Wait for processing
  console.log("\n⏳ Step 5: Waiting for Inngest to process (10s)...");
  await new Promise((resolve) => setTimeout(resolve, 10000));

  // Step 6: Check job status
  console.log("\n📊 Step 6: Checking job status...");
  const { data: updatedJob } = await adminClient
    .from("jobs")
    .select("*")
    .eq("id", jobToApply.id)
    .single();

  if (updatedJob) {
    console.log("   Status:", updatedJob.application_status);
    console.log("   Error:", updatedJob.application_error || "none");
    console.log("   Unknown fields:", JSON.stringify(updatedJob.unknown_form_fields) || "none");
    console.log("   Applied:", updatedJob.applied_status);
    console.log("   Browserbase session:", updatedJob.browserbase_session_id || "none");
    console.log("   Debug URL:", updatedJob.browserbase_debug_url || "none");
  }

  // Step 7: Also check recent Inngest runs
  console.log("\n🔍 Step 7: Fetching recent Inngest runs...");
  try {
    const runsResponse = await fetch("http://localhost:8288/v0/runs?limit=5", {
      headers: { Authorization: `Bearer ${process.env.INNGEST_EVENT_KEY || ""}` },
    });
    if (runsResponse.ok) {
      const runs = await runsResponse.json();
      console.log("   Recent runs:", JSON.stringify(runs).substring(0, 500));
    } else {
      console.log("   Could not fetch runs (status:", runsResponse.status, ")");
    }
  } catch (e) {
    console.log("   Inngest runs endpoint error:", e.message);
  }

  console.log("\n✅ Test complete!");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
