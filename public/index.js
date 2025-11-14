class ServerListApp {
  constructor() {
    this.token = localStorage.getItem('token');
    this.tempUsername = localStorage.getItem('tempUsername');
    this.init();
  }

  init() {
    document.addEventListener('DOMContentLoaded', () => {
      this.render();
      this.setupEventListeners();
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

        <!-- Server List -->
        <div class="w-60 bg-[#202225] flex flex-col">
          <div class="h-12 flex items-center px-4 text-white font-semibold border-b border-[#202225]">
            Home
          </div>
          
          <div id="serverList" class="flex-1 overflow-y-auto scroller px-2 py-2">
            <div class="text-gray-400 text-xs px-2 mb-1">YOUR SERVERS</div>
            <div id="serversContainer"></div>
          </div>
          
          <div class="bg-[#292B2F] h-14 flex items-center px-2">
            <div class="w-8 h-8 bg-blue-500 rounded-full mr-2"></div>
            <div class="flex-1 text-white text-sm font-medium">${this.tempUsername || 'User#1234'}</div>
            <i class="fas fa-cog text-gray-400 hover:text-white cursor-pointer"></i>
          </div>
        </div>

        <!-- Welcome Area -->
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center text-gray-400">
            <i class="fas fa-hashtag text-6xl mb-4"></i>
            <h2 class="text-2xl font-bold text-white mb-2">Select a server</h2>
            <p class="text-gray-400">Join a server or create your own to get started</p>
          </div>
        </div>
      </div>
    `;
    
    this.loadServers();
  }

  setupEventListeners() {
    document.getElementById('createServerBtn').addEventListener('click', () => {
      this.createServer();
    });
  }

  async loadServers() {
    try {
      const res = await fetch('/api/servers');
      if (res.ok) {
        const servers = await res.json();
        const container = document.getElementById('serversContainer');
        container.innerHTML = '';
        
        servers.forEach(server => {
          const serverElement = document.createElement('div');
          serverElement.className = 'w-12 h-12 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold cursor-pointer hover:bg-purple-600 transition-colors mb-2 mx-auto';
          serverElement.textContent = server.name.charAt(0);
          serverElement.addEventListener('click', () => {
            window.location.href = `/server/${server.id}/channel/general`;
          });
          container.appendChild(serverElement);
        });
      }
    } catch (e) {
      console.error('Failed to load servers');
    }
  }

  async createServer() {
    const name = prompt('Server name:');
    if (name) {
      if (this.token) {
        try {
          const res = await fetch('/api/servers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.token}`
            },
            body: JSON.stringify({ name })
          });
          
          if (res.ok) {
            const server = await res.json();
            window.location.href = `/server/${server.id}/channel/general`;
          } else {
            alert('Failed to create server');
          }
        } catch (e) {
          alert('Failed to create server');
        }
      } else {
        // For temp users, just redirect
        const serverId = name.toLowerCase().replace(/\s+/g, '-');
        window.location.href = `/server/${serverId}/channel/general`;
      }
    }
  }
}

new ServerListApp();
