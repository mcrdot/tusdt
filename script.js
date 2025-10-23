// script.js — handles intro page scroll + Supabase enrollment via Cloudflare Worker

document.addEventListener('DOMContentLoaded', () => {
  const pages = document.querySelectorAll('.page');
  const scrollButtons = document.querySelectorAll('.scroll-btn');
  let currentPage = 1;

  // 🌀 Scroll function
  function goToPage(num) {
    const target = document.getElementById(`page${num}`);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth' });
      currentPage = num;
    }
  }

  // 🔘 Handle "Next" buttons
  scrollButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const next = btn.getAttribute('data-next');
      goToPage(next);
    });
  });

  // 🚀 Handle form submission on last page
  const form = document.getElementById('enroll-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await submitEnroll();
    });
  }
});

// 💾 Submit email + Telegram data to Worker
async function submitEnroll() {
  const emailEl = document.getElementById('email');
  const email = emailEl.value?.trim();
  const statusEl = document.getElementById('status');

  const tg = window.Telegram?.WebApp;
  const user = tg?.initDataUnsafe?.user || null;

  if (!email) {
    statusEl.textContent = "Please enter a valid email.";
    return;
  }

  statusEl.textContent = "Submitting…";

  const payload = {
    email,
    telegramId: user?.id ?? null,
    telegram_id: user?.id ?? null,
    username: user?.username ?? null,
    first_name: user?.first_name ?? null,
    last_name: user?.last_name ?? null
  };

  try {
    const res = await fetch('https://tusdt-worker.macrotiser-pk.workers.dev/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      console.error('Enroll failed:', json);
      statusEl.textContent = json.error
        ? `${json.error}`
        : '❌ Something went wrong. Try again.';
      if (json.detail) statusEl.textContent += ` (${json.detail})`;
      return;
    }

    // ✅ Success response
    statusEl.textContent = "✅ You're pre-enrolled!";
    console.log('Enrolled user:', json.user ?? json);
  } catch (err) {
    console.error('Network error:', err);
    statusEl.textContent = '🌐 Network error — please try again.';
  }
}
