const CHAT_URL = 'http://localhost:3142/api/chat';

async function sendContinue() {
  console.log('📡 Sending continue instruction to NOVA Studio...');
  const message = "Excellent work on index.html and styles.css! Now, please continue with the next steps:\n1. Create public/app.js to implement the frontend logic (loading tasks from GET /api/tasks, adding tasks, toggling completion, editing details in the modal, and deleting tasks, with beautiful toast notifications).\n2. Create the test script 'test_api.cjs' to perform automated HTTP calls verifying the CRUD endpoints.\n3. Run 'node test_api.cjs' using your command_run tool to verify the entire system, and then let me know you are done!";
  
  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await response.json();
    console.log(`✅ API Chat Response:`, data);
  } catch (err) {
    console.error('❌ Failed to send prompt:', err.message);
  }
}

sendContinue();
