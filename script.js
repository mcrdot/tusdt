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



// Particle background logic
(function() {
  const canvas = document.getElementById('bg-particles');
  const ctx = canvas.getContext('2d');
  let width, height;
  
  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  const particles = [];
  const colors = [getComputedStyle(document.documentElement).getPropertyValue('--usdt-green').trim(),
                  getComputedStyle(document.documentElement).getPropertyValue('--glow-gold').trim(),
                  getComputedStyle(document.documentElement).getPropertyValue('--neon-teal').trim()];

  function createParticle() {
    return {
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      size: Math.random() * 3 + 1,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: Math.random() * 0.5 + 0.2
    };
  }

  for (let i = 0; i < 80; i++) {
    particles.push(createParticle());
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > width) p.vx *= -1;
      if (p.y < 0 || p.y > height) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  }
  animate();
})();



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
