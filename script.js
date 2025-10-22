let currentPage = 1;
const totalPages = 4;

document.querySelectorAll('.scroll-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const next = parseInt(btn.dataset.next);
    scrollToPage(next);
  });
});

function scrollToPage(page) {
  if (page > totalPages) return;
  document.querySelector('#intro').style.transform = `translateY(-${(page - 1) * 100}vh)`;
  currentPage = page;
}

// Initialize Supabase
const SUPABASE_URL = "https://fbeulrndsfmeryazfgqg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZiZXVscm5kc2ZtZXJ5YXpmZ3FnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjExNTUxNjYsImV4cCI6MjA3NjczMTE2Nn0.ztQ7znArdJTbvJ32eHdnmKpmEi7zea2S1cVch-Nd3Ng";

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);

// Handle form submission
document.getElementById('enroll-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const status = document.getElementById('status');

  if (!email) {
    status.textContent = "❌ Please enter your email.";
    return;
  }

  status.textContent = "⏳ Submitting...";

  try {
    const { error } = await supabaseClient
      .from('pre_enrollments')
      .insert([{ email }]);

    if (error) throw error;
    status.textContent = "✅ Thank you! You’re pre-enrolled.";
    document.getElementById('email').value = "";
  } catch (err) {
    console.error(err);
    if (err.message.includes('duplicate')) {
      status.textContent = "⚠️ This email is already registered.";
    } else {
      status.textContent = "❌ Something went wrong. Try again later.";
    }
  }
});
