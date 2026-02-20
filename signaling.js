/**
 * TALKIO – signaling.js
 * WebRTC Signaling via Supabase Realtime
 */
const Signaling = {
  sb: null, localUserId: null, peerConnection: null,
  onOffer: null, onAnswer: null, onIce: null, onCallEnd: null,

  init(supabaseClient, userId) {
    this.sb = supabaseClient;
    this.localUserId = userId;
    this.subscribeToSignals(userId);
  },

  async sendSignal(toUser, type, payload) {
    await this.sb.from('signaling').insert({ from_user: this.localUserId, to_user: toUser, type, payload });
  },

  subscribeToSignals(userId) {
    this.sb.channel('signaling:' + userId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signaling', filter: `to_user=eq.${userId}` }, ({ new: signal }) => {
        switch (signal.type) {
          case 'offer': this.onOffer?.(signal); break;
          case 'answer': this.onAnswer?.(signal); break;
          case 'ice-candidate': this.onIce?.(signal); break;
          case 'call-end': this.onCallEnd?.(signal); break;
          case 'call-reject': this.onCallEnd?.(signal); break;
        }
      })
      .subscribe();
  },

  async createOffer(toUser, stream) {
    const pc = this.createPeerConnection(toUser);
    stream.getTracks().forEach(t => pc.addTrack(t, stream));
    const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
    await pc.setLocalDescription(offer);
    await this.sendSignal(toUser, 'offer', { sdp: offer });
    this.peerConnection = pc;
    return pc;
  },

  async handleOffer(signal, stream) {
    const pc = this.createPeerConnection(signal.from_user);
    stream?.getTracks().forEach(t => pc.addTrack(t, stream));
    await pc.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await this.sendSignal(signal.from_user, 'answer', { sdp: answer });
    this.peerConnection = pc;
    return pc;
  },

  async handleAnswer(signal) {
    if (this.peerConnection) await this.peerConnection.setRemoteDescription(new RTCSessionDescription(signal.payload.sdp));
  },

  async handleIce(signal) {
    if (this.peerConnection && signal.payload?.candidate) {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate(signal.payload.candidate));
    }
  },

  createPeerConnection(remoteUserId) {
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }],
    });
    pc.onicecandidate = e => {
      if (e.candidate) this.sendSignal(remoteUserId, 'ice-candidate', { candidate: e.candidate });
    };
    pc.ontrack = e => { this.onRemoteTrack?.(e.streams[0]); };
    pc.onconnectionstatechange = () => { this.onConnectionState?.(pc.connectionState); };
    return pc;
  },

  async endCall(toUser) {
    await this.sendSignal(toUser, 'call-end', {});
    this.cleanup();
  },

  cleanup() {
    if (this.peerConnection) { this.peerConnection.close(); this.peerConnection = null; }
  },
};
