/**
 * TALKIO – grupos.js
 * Group management utilities
 */
const Grupos = {
  sb: null, currentUser: null,

  init(supabaseClient, user) {
    this.sb = supabaseClient;
    this.currentUser = user;
  },

  async create(name, description, members, avatarFile = null) {
    const { data: conv, error } = await this.sb.from('conversations')
      .insert({ is_group: true, group_name: name, group_description: description, created_by: this.currentUser.id, updated_at: new Date().toISOString() })
      .select().single();
    if (error) return { error };

    const participants = [
      { conversation_id: conv.id, user_id: this.currentUser.id, role: 'admin' },
      ...members.map(uid => ({ conversation_id: conv.id, user_id: uid, role: 'member' })),
    ];
    await this.sb.from('conversation_participants').insert(participants);

    if (avatarFile) {
      const ext = avatarFile.name.split('.').pop();
      const path = `groups/${conv.id}.${ext}`;
      await this.sb.storage.from('media').upload(path, avatarFile, { upsert: true });
      const { data: { publicUrl } } = this.sb.storage.from('media').getPublicUrl(path);
      await this.sb.from('conversations').update({ group_avatar: publicUrl }).eq('id', conv.id);
    }

    await this.sb.from('notifications').insert(
      members.map(uid => ({ user_id: uid, type: 'group_invite', title: 'Novo grupo', body: `Você foi adicionado ao grupo "${name}"` }))
    );

    return { data: conv };
  },

  async addMembers(conversationId, userIds) {
    const rows = userIds.map(uid => ({ conversation_id: conversationId, user_id: uid, role: 'member' }));
    return this.sb.from('conversation_participants').upsert(rows, { onConflict: 'conversation_id,user_id' });
  },

  async removeMember(conversationId, userId) {
    return this.sb.from('conversation_participants').delete().eq('conversation_id', conversationId).eq('user_id', userId);
  },

  async promoteToAdmin(conversationId, userId) {
    return this.sb.from('conversation_participants').update({ role: 'admin' }).eq('conversation_id', conversationId).eq('user_id', userId);
  },

  async leave(conversationId, userId) {
    const { data: isAdmin } = await this.sb.from('conversation_participants').select('role').eq('conversation_id', conversationId).eq('user_id', userId).single();
    if (isAdmin?.role === 'admin') {
      const { data: others } = await this.sb.from('conversation_participants').select('user_id').eq('conversation_id', conversationId).neq('user_id', userId).limit(1);
      if (others?.length) await this.promoteToAdmin(conversationId, others[0].user_id);
    }
    return this.removeMember(conversationId, userId);
  },

  async update(conversationId, updates) {
    return this.sb.from('conversations').update(updates).eq('id', conversationId);
  },

  async delete(conversationId) {
    await this.sb.from('messages').delete().eq('conversation_id', conversationId);
    await this.sb.from('conversation_participants').delete().eq('conversation_id', conversationId);
    return this.sb.from('conversations').delete().eq('id', conversationId);
  },

  async getMembers(conversationId) {
    const { data } = await this.sb.from('conversation_participants')
      .select('*, profiles:user_id(id, full_name, avatar_url, status)')
      .eq('conversation_id', conversationId);
    return data || [];
  },

  async isAdmin(conversationId, userId) {
    const { data } = await this.sb.from('conversation_participants').select('role').eq('conversation_id', conversationId).eq('user_id', userId).single();
    return data?.role === 'admin';
  },
};
