const CHAT_URL = 'http://localhost:3142/api/chat';

async function sendContinue() {
  console.log('📡 Sending massive continue request to Nova Studio...');
  const instruction = `
We are continuing the TaskFlow Pro implementation.
Current state (loaded from .nova-state.json):
- Index page (public/index.html) is created.
- Express server (server.js) is created.

Please write the complete public/styles.css file with gorgeous glassmorphic styles, implement the interactive public/app.js client-side script, create the API verification test script (test_api.cjs), and execute it. 

You now have a 30-step execution budget, so you can execute the entire workflow from styling, client scripting, testing, and debugging in a single run! Make it absolutely flawless and premium.
`;

  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: instruction.trim() })
    });
    const data = await res.json();
    console.log('✅ Response:', data);
  } catch (err) {
    console.error('❌ Failed to trigger:', err.message);
  }
}

sendContinue();
