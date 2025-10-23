// Call this when user submits email on last intro screen
async function submitEnroll() {
  const emailEl = document.getElementById('email');
  const email = emailEl.value && emailEl.value.trim();
  const statusEl = document.getElementById('status');

  // Obtain Telegram WebApp user if available
  const tg = window.Telegram && window.Telegram.WebApp;
  const user = (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;

  if (!email) {
    statusEl.textContent = "Please enter a valid email.";
    return;
  }

  statusEl.textContent = "Submitting…";

  const payload = {
    email,
    // include both fields to be safe
    telegramId: user?.id ?? null,
    telegram_id: user?.id ?? null,
    username: user?.username ?? null,
    first_name: user?.first_name ?? null,
    last_name: user?.last_name ?? null
  };

  try {
    const res = await fetch('https://tusdt-worker.macrotiser-pk.workers.dev/enroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      console.error('Enroll failed:', json);
      statusEl.textContent = json.error ? `${json.error}` : 'Something went wrong. Try again.';
      if (json.detail) statusEl.textContent += ` (${json.detail})`;
      return;
    }

    // Success
    statusEl.textContent = "✅ You're pre-enrolled!";
    // optionally show user details
    console.log('Enrolled user:', json.user ?? json);
  } catch (err) {
    console.error('Network error:', err);
    statusEl.textContent = 'Network error — try again.';
  }
}
