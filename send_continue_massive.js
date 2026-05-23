const CHAT_URL = 'http://localhost:3142/api/chat';

async function sendContinueMassive() {
  console.log('📡 Sending continue instruction for TaskFlow Pro building...');
  const message = "Excellent work on the database layer and backend routes! Now, let's proceed with the next steps:\n1. Create server.js: Write the main Express server connecting database, seeds, routes, static folder, and global error middleware.\n2. Create public/index.html: Write the markup for our premium dark glassmorphism dashboard, sidebar activity feeds, analytics metrics widgets, and modal dialogues.\n3. Create public/styles.css: Write the CSS variables, animations, scrollbars, and layouts for a top-tier neon dark theme.\nLet's get this coded!";
  
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

sendContinueMassive();
