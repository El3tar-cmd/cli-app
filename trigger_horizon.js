const CHAT_URL = 'http://localhost:3142/api/chat';

async function sendPrompt() {
  console.log('📡 Triggering Horizon DevOps platform prompt in Nova Studio...');
  const promptText = `
Build a premium, high-end "Horizon DevOps & Server Command Center" SaaS platform. 
Requirements:
1. Backend: A Node.js/Express API with a database to manage servers, monitor mock CPU/RAM metrics, and handle deployment logs.
2. Frontend: A stunning, state-of-the-art React dashboard (Vite + Tailwind or modern CSS) using dark mode glassmorphism, animated server health charts, and mock real-time events.
3. Quality: Must feel like a production-ready, premium commercial dashboard.

Please start in PLAN mode, analyze the workspace, and write a comprehensive implementation plan.
`;

  try {
    const res = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: promptText.trim() })
    });
    const data = await res.json();
    console.log('✅ Response:', data);
  } catch (err) {
    console.error('❌ Failed to trigger:', err.message);
  }
}

sendPrompt();
