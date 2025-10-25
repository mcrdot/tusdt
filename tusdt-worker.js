// tusdt-worker.js - Cloudflare Worker for Total USDT Telegram Mini App
import { createClient } from '@supabase/supabase-js'

// Environment variables will be injected by Cloudflare Workers
// Make sure to set these in your Cloudflare dashboard:
// - SUPABASE_URL: Your Supabase project URL
// - SUPABASE_KEY: Your Supabase service role key
// - TELEGRAM_BOT_TOKEN: Your Telegram bot token
// - TELEGRAM_BOT_USERNAME: Your Telegram bot username (without @)

export default {
  async fetch(request, env, ctx) {
    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Handle OPTIONS request (CORS preflight)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // Parse URL to get the path
    const url = new URL(request.url);
    const path = url.pathname;

    // Initialize Supabase client
    const supabase = createClient(
      env.SUPABASE_URL,
      env.SUPABASE_KEY
    );

    // Route handling
    if (path === '/auth' && request.method === 'POST') {
      try {
        // Parse request body
        const data = await request.json();
        const { telegram_id, username, first_name, last_name, email, initData } = data;

        // Validate required fields
        if (!telegram_id || !email) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Verify Telegram WebApp data if provided
        let isValidTelegramUser = false;
        if (initData && env.TELEGRAM_BOT_TOKEN) {
          isValidTelegramUser = await verifyTelegramWebAppData(initData, env.TELEGRAM_BOT_TOKEN);
          
          if (!isValidTelegramUser) {
            return new Response(
              JSON.stringify({ success: false, error: 'Invalid Telegram authentication' }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } else {
          // For development purposes, allow without verification
          // In production, you should always verify
          isValidTelegramUser = true;
        }

        // Check if user already exists in database
        const { data: existingUser, error: queryError } = await supabase
          .from('users')
          .select('*')
          .eq('telegram_id', telegram_id)
          .single();

        if (queryError && queryError.code !== 'PGRST116') { // PGRST116 is "no rows returned" error
          console.error('Database query error:', queryError);
          return new Response(
            JSON.stringify({ success: false, error: 'Database error' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Store the Telegram session data if initData is provided
        if (initData && isValidTelegramUser) {
          const parsedInitData = parseInitData(initData);
          const authDate = parsedInitData.auth_date;
          const hash = parsedInitData.hash;
          
          // Calculate expiration (24 hours from auth_date)
          const expiresAt = new Date((authDate * 1000) + (24 * 60 * 60 * 1000));
          
          if (existingUser) {
            // Store session for existing user
            await supabase
              .from('telegram_sessions')
              .insert([{
                user_id: existingUser.id,
                telegram_auth_date: authDate,
                telegram_hash: hash,
                telegram_init_data: initData,
                is_valid: true,
                expires_at: expiresAt.toISOString()
              }]);
          }
        }

        // If user exists, update their record
        if (existingUser) {
          const { error: updateError } = await supabase
            .from('users')
            .update({ 
              email,
              username: username || existingUser.username,
              first_name: first_name || existingUser.first_name,
              last_name: last_name || existingUser.last_name,
              updated_at: new Date().toISOString()
            })
            .eq('telegram_id', telegram_id);

          if (updateError) {
            console.error('Database update error:', updateError);
            return new Response(
              JSON.stringify({ success: false, error: 'Failed to update user' }),
              { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }

          // Log user activity
          await supabase
            .from('user_activities')
            .insert([{
              user_id: existingUser.id,
              activity_type: 'login',
              points_earned: 0,
              metadata: { source: 'web_app' }
            }]);

          return new Response(
            JSON.stringify({ success: true, existing: true }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If user doesn't exist, create a new record
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([
            {
              telegram_id,
              username,
              first_name,
              last_name,
              email,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ])
          .select()
          .single();

        if (insertError) {
          console.error('Database insert error:', insertError);
          return new Response(
            JSON.stringify({ success: false, error: 'Failed to create user' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Store session for new user if initData is provided
        if (initData && isValidTelegramUser && newUser) {
          const parsedInitData = parseInitData(initData);
          const authDate = parsedInitData.auth_date;
          const hash = parsedInitData.hash;
          
          // Calculate expiration (24 hours from auth_date)
          const expiresAt = new Date((authDate * 1000) + (24 * 60 * 60 * 1000));
          
          await supabase
            .from('telegram_sessions')
            .insert([{
              user_id: newUser.id,
              telegram_auth_date: authDate,
              telegram_hash: hash,
              telegram_init_data: initData,
              is_valid: true,
              expires_at: expiresAt.toISOString()
            }]);
            
          // Log user activity for new registration
          await supabase
            .from('user_activities')
            .insert([{
              user_id: newUser.id,
              activity_type: 'registration',
              points_earned: 100, // Bonus points for registration
              metadata: { source: 'web_app' }
            }]);
        }

        // Optional: Send a message to the user via Telegram Bot API
        if (env.TELEGRAM_BOT_TOKEN) {
          try {
            const message = `Thank you for pre-enrolling in Total USDT! You've earned 100 bonus points. We'll keep you updated on our launch.`;
            await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: telegram_id,
                text: message
              })
            });
          } catch (telegramError) {
            console.error('Failed to send Telegram message:', telegramError);
            // Continue execution even if Telegram message fails
          }
        }

        return new Response(
          JSON.stringify({ success: true, existing: false }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );

      } catch (error) {
        console.error('Server error:', error);
        return new Response(
          JSON.stringify({ success: false, error: 'Server error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Route for checking user points and balance
    if (path === '/user/stats' && request.method === 'POST') {
      try {
        const data = await request.json();
        const { telegram_id } = data;

        if (!telegram_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing telegram_id' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: user, error } = await supabase
          .from('users')
          .select('id, points, usdt_balance')
          .eq('telegram_id', telegram_id)
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ success: false, error: 'User not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ 
            success: true, 
            points: user.points,
            usdt_balance: user.usdt_balance
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, error: 'Server error' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Default response for unhandled routes
    return new Response(
      JSON.stringify({ success: false, error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
};

// Helper function to verify Telegram WebApp data
async function verifyTelegramWebAppData(initData, botToken) {
  try {
    const parsed = parseInitData(initData);
    const dataCheckString = Object.keys(parsed)
      .filter(key => key !== 'hash')
      .sort()
      .map(key => `${key}=${parsed[key]}`)
      .join('\n');

    // Convert bot token to bytes
    const encoder = new TextEncoder();
    const botTokenBytes = encoder.encode(botToken);
    
    // Create SHA-256 hash of the bot token
    const secretKeyBuffer = await crypto.subtle.digest('SHA-256', botTokenBytes);
    
    // Create HMAC key from the secret key
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      secretKeyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    // Sign the data check string
    const dataCheckBytes = encoder.encode(dataCheckString);
    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      cryptoKey,
      dataCheckBytes
    );
    
    // Convert signature to hex
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const hmac = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    return hmac === parsed.hash;
  } catch (e) {
    console.error('Error verifying Telegram data:', e);
    return false;
  }
}

// Helper function to parse initData string
function parseInitData(initDataString) {
  const result = {};
  const params = new URLSearchParams(initDataString);
  
  for (const [key, value] of params.entries()) {
    if (key === 'user') {
      result[key] = JSON.parse(value);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}