const CHAT_URL = 'http://localhost:3142/api/chat';

async function triggerMassiveProject() {
  console.log('📡 Sending massive advanced project request to NOVA Studio...');
  
  const message = `Let's build a highly advanced, enterprise-grade project management application named "TaskFlow Pro" with live analytics and event broadcasting. The project must have a modular architecture:

1. Project Structure:
   - db/connection.js: SQLite connection manager using 'better-sqlite3'.
   - db/schema.js: Schema creator defining 'tasks' (id, title, description, priority [low, medium, high], status [backlog, in_progress, review, done], category, assignee, created_at, updated_at) and 'activities' (id, task_id, action_description, timestamp).
   - db/seed.js: Seeds the DB with 15 rich mock tasks and 10 mock activity history events.
   - services/taskService.js: Database abstraction layer containing transactional CRUD operations and activity logging.
   - services/analyticsService.js: Calculates complex metrics: workload distribution by assignee, task completion rate by category, productivity trends, and activity volume.
   - routes/tasks.js: Router for task CRUD with strict JSON input validation.
   - routes/analytics.js: Router for fetching computed dashboard analytics.
   - routes/events.js: Server-Sent Events (SSE) router establishing permanent connections for clients and streaming real-time JSON notifications when tasks are modified.
   - server.js: Express server stitching everything together, serving public assets, and handling errors globally.

2. Public Frontend (public/index.html, public/styles.css, public/app.js):
   - A breathtaking dark glassmorphism dashboard with smooth transitions, custom scrollbars, and neon accents.
   - Live Activity Feed Sidebar: Connects to the SSE endpoint (/api/events) and dynamically appends feed items in real time as events are broadcasted.
   - Analytics Panel: Renders professional gauges and charts directly using SVG or Canvas APIs to show task completion percentages and status counts without external libraries.
   - Task Board: Drag-and-drop simulation or rapid status switching tabs.
   - Interactivity: Modals for editing/deleting tasks with full form validations, status filter tabs, and toast feedback.

3. Automated Integration Test Suite (test_suite.cjs):
   - Automatically initializes the database.
   - Starts the Express application on a dynamic test port.
   - Establishes a client-side SSE listener to capture broadcasted activities.
   - Hits the REST endpoints to perform CRUD operations (create, update, delete, get analytics).
   - Asserts that correct events were broadcasted over the SSE connection for each action.
   - Prints a beautiful, formatted green/red test report in the console.

Please plan the architecture, create the modular folder structure, build the files with complete production-ready code (no placeholders), and run 'node test_suite.cjs' to verify the entire system works perfectly. Let me know when you are done!`;

  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await response.json();
    console.log(`✅ Request sent successfully! Server response:`, data);
  } catch (err) {
    console.error('❌ Failed to trigger request:', err.message);
  }
}

triggerMassiveProject();
