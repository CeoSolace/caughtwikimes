class ChannelApp {
  constructor() {
    this.socket = io();
    this.pathParts = location.pathname.split('/');
    this.serverId = this.pathParts[2];
    this.channelId = this.pathParts[4];
    this.peerId = null;
    this.userId = null;
    this.token = localStorage.getItem('token');
    this.tempUsername = localStorage.getItem('tempUsername');
    this.messageCache = new Map();
    this.pendingAttachments = [];
    this.replyTo = null;
    this.key = null;
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.render();
      this.setupAuth();
      this.setupEventListeners();
      this.setupSocket();
    });
  }

  render() {
    document.body.innerHTML = `
      <div class="h-screen flex">
        <!-- Server Sidebar -->
        <div class="w-18 bg-[#18191C] flex flex-col items-center py-3 space-y-2">
          <div class="w-12 h-12 bg-[#5865F2] rounded-full flex items-center justify-center text-white font-bold cursor-pointer hover:bg-[#4752c4] transition-colors">
            C
          </div>
          <div class="w-8 h-0.5 bg-gray-500 rounded-full"></div>
          <div id="createServerBtn" class="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center text-white font-bold cursor-pointer hover:bg-green-600 transition-colors">
            +
          </div>
        </div>

        <!-- Server Channels -->
        <div class="w-60 bg-[#202225] flex flex-col">
          <div id="serverName" class="h-12 flex items-center px-4 text-white font-semibold border-b border-[#202225]">
            Loading...
          </div>
          
          <div id="channelList" class="flex-1 overflow-y-auto scroller px-2 py-2">
            <div class="text-gray-400 text-xs px-2 mb-1">TEXT CHANNELS</div>
            <div id="textChannels"></div>
            <div class="text-gray-400 text-xs px-2 mb-1 mt-4">VOICE CHANNELS</div>
            <div id="voiceChannels"></div>
          </div>
          
          <div class="bg-[#292B2F] h-14 flex items-center px-2">
            <div id="userAvatar" class="w-8 h-8 bg-blue-500 rounded-full mr-2"></div>
            <div id="username" class="flex-1 text-white text-sm font-medium">Loading...</div>
            <i id="auditLogBtn" class="fas fa-history text-gray-400 hover:text-white cursor-pointer mr-2"></i>
            <i class="fas fa-cog text-gray-400 hover:text-white cursor-pointer"></i>
          </div>
        </div>

        <!-- Main Chat Area -->
        <div class="flex-1 flex flex-col">
          <!-- Chat Header -->
          <div class="h-12 bg-[#2B2D31] flex items-center px-4 text-white border-b border-[#202225]">
            <i class="fas fa-hashtag mr-1"></i>
            <span id="channelName" class="font-medium"># general</span>
          </div>
          
          <!-- Messages -->
          <div id="messages" class="flex-1 overflow-y-auto scroller p-4 space-y-4">
            <div class="text-center text-gray-500 text-xs py-4">This is the start of the chat</div>
          </div>
          
          <!-- Message Input -->
          <div class="p-4">
            <div class="bg-[#40444B] rounded-lg px-4 py-2 flex items-center">
              <i id="attachBtn" class="fas fa-plus text-gray-400 mr-3 cursor-pointer hover:text-white"></i>
              <input id="messageInput" type="text" placeholder="Message #general" class="flex-1 bg-transparent text-white outline-none"/>
              <i id="fileBtn" class="fas fa-paperclip text-gray-400 mr-3 cursor-pointer hover:text-white"></i>
              <i id="voiceBtn" class="fas fa-microphone text-gray-400 cursor-pointer hover:text-white"></i>
            </div>
          </div>
        </div>

        <!-- Audit Log Modal -->
        <div id="auditModal" class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div class="bg-[#36393F] rounded-lg p-6 w-1/2 max-w-2xl max-h-96 overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
              <h2 class="text-xl font-bold text-white">Audit Log</h2>
              <button id="closeModal" class="text-gray-400 hover:text-white">&times;</button>
            </div>
            <div id="auditLogContent" class="text-white">
              Loading audit logs...
            </div>
          </div>
        </div>
      </div>
    `;
    
    this.loadChannels();
    this.loadServerInfo();
  }

  setupAuth() {
    if (this.token) {
      this.socket.emit('auth', { token: this.token });
    } else if (this.tempUsername) {
      this.socket.emit('auth', { tempUsername: this.tempUsername });
      this.peerId = this.tempUsername;
      document.getElementById('username').textContent = this.tempUsername;
      document.getElementById('userAvatar').style.backgroundColor = '#4752c4';
    } else {
      window.location.href = '/';
    }
  }

  setupEventListeners() {
    document.getElementById('messageInput').addEventListener('keypress', e => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });

    document.getElementById('attachBtn').addEventListener('click', () => {
      this.showAttachmentOptions();
    });

    document.getElementById('fileBtn').addEventListener('click', () => {
      this.uploadFile();
    });

    document.getElementById('voiceBtn').addEventListener('click', () => {
      this.startVoiceCall();
    });

    document.getElementById('auditLogBtn').addEventListener('click', () => {
      this.showAuditLog();
    });

    document.getElementById('closeModal').addEventListener('click', () => {
      document.getElementById('auditModal').classList.add('hidden');
    });

    document.getElementById('createServerBtn').addEventListener('click', () => {
      const name = prompt('Server name:');
      if (name) {
        window.location.href = `/server/${name}/channel/general`;
      }
    });
  }

  setupSocket() {
    this.socket.on('h', h => {
      const container = document.getElementById('messages');
      container.innerHTML = '<div class="text-center text-gray-500 text-xs py-4">This is the start of the chat</div>';
      
      h.forEach(msg => {
        this.addMessage(msg.c, msg.s === this.peerId, msg.s, msg._id, msg.rep, msg.attachments || []);
      });
    });

    this.socket.on('m', msg => {
      if (msg.s === this.peerId) return;
      this.addMessage(msg.c, false, msg.s, msg._id, msg.rep, msg.attachments || []);
    });

    this.socket.on('o', n => {
      // Update online count
    });

    this.socket.on('t', ({ s, t }) => {
      // Typing indicator
    });

    this.socket.on('lm', lm => {
      // Last message
    });
  }

  async loadServerInfo() {
    document.getElementById('serverName').textContent = this.serverId;
    document.getElementById('channelName').textContent = `# ${this.channelId}`;
  }

  async loadChannels() {
    try {
      const res = await fetch(`/api/server/${this.serverId}/channels`);
      if (res.ok) {
        const channels = await res.json();
        const textContainer = document.getElementById('textChannels');
        const voiceContainer = document.getElementById('voiceChannels');
        
        textContainer.innerHTML = '';
        voiceContainer.innerHTML = '';
        
        channels.forEach(channel => {
          const element = document.createElement('div');
          element.className = 'text-white px-2 py-1 rounded cursor-pointer hover:bg-[#37393F] flex items-center mb-1';
          element.innerHTML = `
            <i class="fas ${channel.type === 'voice' ? 'fa-microphone' : 'fa-hashtag'} mr-1"></i>
            ${channel.name}
          `;
          element.addEventListener('click', () => {
            window.location.href = `/server/${this.serverId}/channel/${channel.name}`;
          });
          
          if (channel.type === 'voice') {
            voiceContainer.appendChild(element);
          } else {
            textContainer.appendChild(element);
          }
        });
      }
    } catch (e) {
      console.error('Failed to load channels');
    }
  }

  addMessage(text, isMe, sender, msgId, replyText, attachments) {
    const container = document.getElementById('messages');
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `flex ${isMe ? 'justify-end' : ''} mb-4`;
    
    if (!isMe) {
      messageDiv.innerHTML = `
        <div class="w-10 h-10 bg-blue-500 rounded-full mr-3 flex-shrink-0"></div>
        <div class="flex-1 max-w-[80%]">
          <div class="text-gray-100 font-medium text-sm">${sender}</div>
          <div class="text-gray-300 text-sm">${text}</div>
        </div>
      `;
    } else {
      messageDiv.innerHTML = `
        <div class="flex-1 max-w-[80%] text-right">
          <div class="text-gray-300 text-sm">${text}</div>
          <div class="text-gray-500 text-xs mt-1">Just now</div>
        </div>
        <div class="w-10 h-10 bg-green-500 rounded-full ml-3 flex-shrink-0"></div>
      `;
    }
    
    container.appendChild(messageDiv);
    container.scrollTop = container.scrollHeight;
  }

  sendMessage() {
    const input = document.getElementById('messageInput');
    const text = input.value.trim();
    if (!text) return;

    // Add to UI immediately
    this.addMessage(text, true, this.peerId, Date.now().toString(), null, []);
    
    // Send to server
    this.socket.emit('m', {
      c: text,
      i: '',
      rep: this.replyTo,
      attachments: this.pendingAttachments
    });

    input.value = '';
    this.pendingAttachments = [];
    this.replyTo = null;
  }

  showAttachmentOptions() {
    alert('Attachment options would open here');
  }

  uploadFile() {
    alert('File upload would open here');
  }

  startVoiceCall() {
    alert('Voice call would start here');
  }

  async showAuditLog() {
    const modal = document.getElementById('auditModal');
    const content = document.getElementById('auditLogContent');
    content.innerHTML = 'Loading audit logs...';
    modal.classList.remove('hidden');
    
    try {
      const res = await fetch(`/api/server/${this.serverId}/audit-logs`, {
        headers: {
          'Authorization': `Bearer ${this.token}`
        }
      });
      
      if (res.ok) {
        const logs = await res.json();
        if (logs.length === 0) {
          content.innerHTML = '<div class="text-gray-500">No audit logs found</div>';
        } else {
          content.innerHTML = logs.map(log => {
            const date = new Date(log.createdAt).toLocaleString();
            return `
              <div class="mb-3 p-3 bg-[#2F3136] rounded">
                <div class="text-white font-medium">${log.userId}</div>
                <div class="text-gray-300 text-sm">${log.action} ${log.targetId ? `(${log.targetId})` : ''}</div>
                <div class="text-gray-500 text-xs mt-1">${date}</div>
                ${log.details ? `<div class="text-gray-400 text-xs mt-1">Details: ${JSON.stringify(log.details)}</div>` : ''}
              </div>
            `;
          }).join('');
        }
      } else {
        content.innerHTML = '<div class="text-red-400">Failed to load audit logs</div>';
      }
    } catch (e) {
      content.innerHTML = '<div class="text-red-400">Error loading audit logs</div>';
    }
  }
}

new ChannelApp();
