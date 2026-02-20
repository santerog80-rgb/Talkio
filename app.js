/**
 * TALKIO – app.js
 * Core application logic & Supabase utilities
 */
'use strict';

const TALKIO_CONFIG = {
  supabaseUrl: 'https://vagjwfceaefsmemgcdma.supabase.co',
  supabaseKey: 'sb_publishable_4_BgMG0lfghbLC-gRwo2DA_OLQ2EJPz',
  version: '1.0.0',
};

let sb = null;

function initSupabase() {
  if (typeof supabase === 'undefined') { console.error('Supabase SDK not loaded'); return null; }
  sb = supabase.createClient(TALKIO_CONFIG.supabaseUrl, TALKIO_CONFIG.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true },
    realtime: { params: { eventsPerSecond: 10 } },
  });
  return sb;
}

const Auth = {
  async getSession() { const { data: { session } } = await sb.auth.getSession(); return session; },
  async getUser() { const s = await this.getSession(); return s?.user || null; },
  async requireAuth(to = 'index.html') { const u = await this.getUser(); if (!u) { window.location.href = to; return null; } return u; },
  async signOut() { await Profile.setStatus('offline'); await sb.auth.signOut(); window.location.href = 'index.html'; },
};

const Profile = {
  cache: new Map(),
  async get(id) { if (this.cache.has(id)) return this.cache.get(id); const { data } = await sb.from('profiles').select('*').eq('id', id).single(); if (data) this.cache.set(id, data); return data; },
  async update(id, updates) { const { data, error } = await sb.from('profiles').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single(); if (data) this.cache.set(id, data); return { data, error }; },
  async setStatus(status) { const u = await Auth.getUser(); if (!u) return; await sb.from('profiles').update({ status, last_seen: new Date().toISOString() }).eq('id', u.id); this.cache.delete(u.id); },
  setupPresence(uid) { document.addEventListener('visibilitychange', () => this.setStatus(document.hidden ? 'away' : 'online')); window.addEventListener('beforeunload', () => this.setStatus('offline')); this.setStatus('online'); },
};

const Messages = {
  async send(convId, senderId, body, type = 'text', extra = {}) {
    const { data, error } = await sb.from('messages').insert({ conversation_id: convId, sender_id: senderId, body, message_type: type, is_read: false, ...extra }).select().single();
    if (!error) await sb.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', convId);
    return { data, error };
  },
  async list(convId, limit = 50) { const { data } = await sb.from('messages').select('*,profiles:sender_id(id,full_name,avatar_url)').eq('conversation_id', convId).order('created_at', { ascending: true }).limit(limit); return data || []; },
  subscribe(convId, cb) { return sb.channel('messages:' + convId).on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: 'conversation_id=eq.' + convId }, cb).subscribe(); },
};

const Utils = {
  GRADS: ['linear-gradient(135deg,#0077FF,#00C9FF)','linear-gradient(135deg,#FF3CAC,#784BA0)','linear-gradient(135deg,#00C9FF,#00E676)','linear-gradient(135deg,#FFB300,#FF3D00)','linear-gradient(135deg,#784BA0,#2B86C5)'],
  grad(id = '') { return this.GRADS[(id).split('').reduce((a, c) => a + c.charCodeAt(0), 0) % this.GRADS.length]; },
  initials(n = '') { return n.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase() || '??'; },
  esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
  fmt(iso) { if (!iso) return ''; const d = new Date(iso), diff = Date.now() - d; if (diff < 60000) return 'agora'; if (diff < 3600000) return Math.floor(diff / 60000) + 'min'; if (diff < 86400000) return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }); },
  debounce(fn, ms = 300) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; },
  toast(m, dur = 3000) { const w = document.querySelector('.toaster,#toaster'); if (!w) return; const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; w.appendChild(t); setTimeout(() => t.remove(), dur); },
};

const Theme = {
  apply(t = 'dark') { document.documentElement.setAttribute('data-theme', t); localStorage.setItem('talkio_theme', t); },
  load() { this.apply(localStorage.getItem('talkio_theme') || 'dark'); },
};

function initTalkio() { initSupabase(); Theme.load(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initTalkio);
else initTalkio();
