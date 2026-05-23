const CHAT_URL = 'http://localhost:3142/api/chat';

async function triggerFinish() {
  console.log('📡 Sending final instruction to Nova Studio...');
  const instruction = `
Outstanding! The Vite React dashboard is now running persistently on http://localhost:3000.
The Express API and WebSocket servers are running persistently on http://localhost:3001.

Please do NOT run any dev servers. Simply run a final verification checks (e.g. check the contents of your source code or write a verification note) and state that the "Horizon DevOps & Server Command Center" platform is fully complete and operational!
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

triggerFinish();
