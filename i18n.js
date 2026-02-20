/**
 * TALKIO – i18n.js
 * Internationalization
 */
const I18n = {
  currentLang: localStorage.getItem('talkio_lang') || 'pt',
  strings: {
    pt: {
      appName: 'Talkio', tagline: 'Conecte-se com quem importa',
      chat: 'Chat', groups: 'Grupos', calls: 'Chamadas', status: 'Status', profile: 'Perfil',
      settings: 'Configurações', notifications: 'Notificações', contacts: 'Contatos',
      privacy: 'Privacidade', security: 'Segurança', logout: 'Sair',
      online: 'Online', away: 'Ausente', busy: 'Ocupado', offline: 'Offline',
      send: 'Enviar', cancel: 'Cancelar', save: 'Salvar', delete: 'Apagar', edit: 'Editar',
      loading: 'Carregando...', error: 'Ocorreu um erro', success: 'Feito!',
      noMessages: 'Sem mensagens. Diga olá! 👋',
      typeMessage: 'Escreva uma mensagem...',
      searchConversations: 'Buscar conversas...',
      newChat: 'Nova conversa', newGroup: 'Novo grupo',
      voice: 'Voz', video: 'Vídeo', mute: 'Mudo', speaker: 'Alto-falante',
      endCall: 'Encerrar', accept: 'Aceitar', decline: 'Recusar',
      reply: 'Responder', forward: 'Encaminhar', copy: 'Copiar', star: 'Favoritar',
      theme: 'Tema', language: 'Idioma', dark: 'Escuro', light: 'Claro',
      name: 'Nome', email: 'E-mail', phone: 'Telefone', bio: 'Bio',
      password: 'Senha', confirmPassword: 'Confirmar senha',
      signIn: 'Entrar', signUp: 'Criar conta', forgotPassword: 'Esqueci a senha',
      verifyEmail: 'Verificar e-mail', resendCode: 'Reenviar código',
      mediaShared: 'Mídia compartilhada', commonGroups: 'Grupos em comum',
      blockUser: 'Bloquear usuário', reportUser: 'Denunciar',
      deleteChat: 'Apagar conversa', deleteMessage: 'Apagar mensagem',
      messageDeleted: 'Mensagem apagada', youSent: 'Você enviou',
    },
    en: {
      appName: 'Talkio', tagline: 'Connect with those who matter',
      chat: 'Chat', groups: 'Groups', calls: 'Calls', status: 'Status', profile: 'Profile',
      settings: 'Settings', notifications: 'Notifications', contacts: 'Contacts',
      privacy: 'Privacy', security: 'Security', logout: 'Sign out',
      online: 'Online', away: 'Away', busy: 'Busy', offline: 'Offline',
      send: 'Send', cancel: 'Cancel', save: 'Save', delete: 'Delete', edit: 'Edit',
      loading: 'Loading...', error: 'An error occurred', success: 'Done!',
      noMessages: 'No messages yet. Say hi! 👋',
      typeMessage: 'Write a message...',
      searchConversations: 'Search conversations...',
      newChat: 'New conversation', newGroup: 'New group',
      voice: 'Voice', video: 'Video', mute: 'Mute', speaker: 'Speaker',
      endCall: 'End call', accept: 'Accept', decline: 'Decline',
      reply: 'Reply', forward: 'Forward', copy: 'Copy', star: 'Star',
      theme: 'Theme', language: 'Language', dark: 'Dark', light: 'Light',
      name: 'Name', email: 'Email', phone: 'Phone', bio: 'Bio',
      password: 'Password', confirmPassword: 'Confirm password',
      signIn: 'Sign in', signUp: 'Create account', forgotPassword: 'Forgot password',
      verifyEmail: 'Verify email', resendCode: 'Resend code',
      mediaShared: 'Shared media', commonGroups: 'Common groups',
      blockUser: 'Block user', reportUser: 'Report',
      deleteChat: 'Delete chat', deleteMessage: 'Delete message',
      messageDeleted: 'Message deleted', youSent: 'You sent',
    },
  },

  t(key) {
    return this.strings[this.currentLang]?.[key] || this.strings.pt[key] || key;
  },

  setLanguage(lang) {
    this.currentLang = lang;
    localStorage.setItem('talkio_lang', lang);
    this.applyToPage();
  },

  applyToPage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      el.textContent = this.t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = this.t(el.dataset.i18nPlaceholder);
    });
  },

  detectLanguage() {
    const saved = localStorage.getItem('talkio_lang');
    if (saved) return saved;
    const browser = navigator.language.startsWith('en') ? 'en' : 'pt';
    this.setLanguage(browser);
    return browser;
  },
};

I18n.detectLanguage();
