import WebSocket from 'ws';

const WS_URL = 'ws://localhost:3142';
const CHAT_URL = 'http://localhost:3142/api/chat';
const SETTINGS_URL = 'http://localhost:3142/api/settings';

console.log('🚀 Connecting to NOVA Studio WebSocket on port 3142...');
const ws = new WebSocket(WS_URL);

ws.on('open', async () => {
  console.log('✅ Connected! Configuring settings to AGENT mode...');
  
  try {
    const settingsResponse = await fetch(SETTINGS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'agent' })
    });
    const settingsResult = await settingsResponse.json();
    console.log(`⚙️ Settings API response:`, settingsResult);
  } catch (err) {
    console.error('❌ Failed to update settings:', err.message);
    ws.close();
    process.exit(1);
  }

  setTimeout(async () => {
    console.log('\n🌟 Sending the advanced web application request...');
    const message = "Let's build a clean and modern Task Management Web Application in our workspace. You need to structure this professionally with a clean architecture:\n1. Initialize a SQLite database using 'better-sqlite3' with a schema for tasks (id, title, description, status, created_at).\n2. Create an Express backend server ('server.js') that connects to the database and exposes RESTful CRUD endpoints (GET /api/tasks, POST /api/tasks, PUT /api/tasks/:id, DELETE /api/tasks/:id). Use proper JSON error handling and validation.\n3. Create a public frontend inside a 'public/' directory (index.html, styles.css, app.js). The UI should look highly professional, interactive, and responsive (using clean modern CSS with grid/flexbox, a beautiful dark/light palette, and smooth transitions) so that users can view, create, toggle status, and delete tasks.\n4. Write a script 'init_db.cjs' to create the database file and insert a few sample tasks.\n5. Write a validation script 'test_api.cjs' that performs HTTP requests to the backend server to verify that creating, reading, updating, and deleting a task works perfectly. Run this script using command_run to demonstrate that the complete architecture works. Plan the modules, write the files, and verify them. Let me know when you are done!";
    
    try {
      const response = await fetch(CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message })
      });
      const data = await response.json();
      console.log(`📡 API Chat Response status:`, data);
    } catch (err) {
      console.error('❌ Failed to send prompt:', err.message);
      ws.close();
      process.exit(1);
    }
  }, 2000);
});

ws.on('message', (rawData) => {
  const msg = JSON.parse(rawData.toString());
  
  if (msg.type === 'token') {
    process.stdout.write(msg.data);
  } else if (msg.type === 'tool_start') {
    console.log(`\n\n🛠️  [TOOL START] ${msg.data.name}`);
    console.log(`Arguments:`, JSON.stringify(msg.data.args, null, 2));
  } else if (msg.type === 'tool_end') {
    console.log(`\n\n✅ [TOOL END] ${msg.data.name} - Success: ${msg.data.success}`);
    if (msg.data.error) {
      console.error(`Error:`, msg.data.error);
    } else if (msg.data.output) {
      console.log(`Output Snippet:`, msg.data.output.slice(0, 300) + (msg.data.output.length > 300 ? '...' : ''));
    }
  } else if (msg.type === 'state') {
    console.log(`\n\n🧠 [COGNITIVE STATE SYNC]`);
    console.log(`Goal:`, msg.data.currentGoal);
    console.log(`Tasks Completed:`, msg.data.completedTasks);
    console.log(`Tasks Remaining:`, msg.data.todoTasks);
  }
});

ws.on('error', (err) => {
  console.error('❌ WebSocket Error:', err.message);
});

ws.on('close', () => {
  console.log('\n\n👋 WebSocket connection closed.');
  process.exit(0);
});

// Bounded timeout: 8 minutes (enough for a large multi-step task)
setTimeout(() => {
  console.log('\n\n⏱️ Test timed out.');
  ws.close();
  process.exit(0);
}, 480000);
