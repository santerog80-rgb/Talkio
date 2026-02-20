/**
 * TALKIO – notificacoes.js
 */
const NotifManager = {
  sb: null, userId: null,

  async init(supabaseClient, userId) {
    this.sb = supabaseClient;
    this.userId = userId;
    await this.requestPermission();
    this.subscribe();
  },

  async requestPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') await Notification.requestPermission();
  },

  subscribe() {
    this.sb.channel('notifs:' + this.userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${this.userId}` }, ({ new: n }) => {
        this.showNative(n.title, n.body);
        this.updateBadge();
      })
      .subscribe();
  },

  showNative(title, body) {
    if (Notification.permission === 'granted' && document.hidden) {
      new Notification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-72.png', vibrate: [200, 100, 200] });
    }
  },

  async updateBadge() {
    const { count } = await this.sb.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', this.userId).eq('is_read', false);
    const badge = document.getElementById('notifBadge');
    if (badge) { badge.textContent = count || ''; badge.style.display = count ? 'flex' : 'none'; }
    if ('setAppBadge' in navigator && count) navigator.setAppBadge(count);
  },
};
