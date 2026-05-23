const CHAT_URL = 'http://localhost:3142/api/chat';

async function triggerFrontend() {
  console.log('📡 Sending command to Nova Studio to build the frontend...');
  const instruction = `
Excellent job on building the backend!
I have successfully launched the backend Express server in the background for you. It is now listening persistently on http://localhost:3001.

Please do NOT try to run 'npm run dev' for the backend anymore. Instead, immediately proceed to Phase 2: Frontend of your PLAN.md:
1. Initialize the React app inside a folder called 'frontend' (using Vite + Tailwind + TypeScript).
2. Set up the glassmorphic styling, components, and live metrics gauges connecting to the ws://localhost:3001 WebSocket.
3. Make the dashboard design extremely gorgeous, dynamic, and commercial.
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

triggerFrontend();
