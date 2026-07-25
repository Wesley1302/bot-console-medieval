import { useCallback, useEffect, useState } from 'react';
import { getDiscordStatus } from '../../api/status.api.js';
import { AutomationPanel } from '../automations/AutomationPanel.jsx';
import { ChannelTree } from '../channels/ChannelTree.jsx';
import { DownloadsPanel } from '../exports/DownloadsPanel.jsx';
import { ExportJobToast } from '../exports/ExportJobToast.jsx';
import { MessagePanel } from '../messages/MessagePanel.jsx';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';
import { MobileNav } from './MobileNav.jsx';
import { useChannelTree } from '../../hooks/useChannelTree.js';

export function AppShell({ children, operator }) {
  const [selectedChannel, setSelectedChannel] = useState(null);
  const { tree, status: channelStatus, error: channelError, refresh: refreshChannels } = useChannelTree();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeView, setActiveView] = useState('console');
  const [bot, setBot] = useState(null);
  const [exportJobId, setExportJobId] = useState('');
  const [downloadsRefreshKey, setDownloadsRefreshKey] = useState(0);
  const isChatView = activeView === 'console' && Boolean(selectedChannel?.messageable);

  useEffect(() => {
    let active = true;
    getDiscordStatus()
      .then((payload) => {
        if (active) setBot(payload.bot || null);
      })
      .catch(() => {
        if (active) setBot(null);
      });
    return () => {
      active = false;
    };
  }, []);

  function selectChannel(channel) {
    setSelectedChannel(channel);
    setSidebarOpen(false);
    if (activeView !== 'automations') {
      setActiveView('console');
    }
  }

  const handleExportStarted = useCallback((jobId) => {
    setExportJobId(jobId);
  }, []);

  const handleExportDone = useCallback(() => {
    setDownloadsRefreshKey((key) => key + 1);
  }, []);

  const activeThreads = tree?.activeThreads || [];

  const handleChangeView = useCallback((view) => {
    setActiveView(view);
    setSidebarOpen(false);
  }, []);

  const handleOpenChannels = useCallback(() => {
    setActiveView('console');
    setSidebarOpen(true);
  }, []);

  return (
    <div className="app-shell">
      <Sidebar bot={bot} open={sidebarOpen}>
        <ChannelTree
          selectedChannel={selectedChannel}
          tree={tree}
          status={channelStatus}
          error={channelError}
          onRefresh={refreshChannels}
          onExportStarted={handleExportStarted}
          onSelectChannel={selectChannel}
        />
      </Sidebar>
      <div className="app-main">
        <TopBar
          activeView={activeView}
          onChangeView={handleChangeView}
          operator={operator}
        />
        <main className={isChatView ? 'app-content app-content--chat' : 'app-content'}>
          {children || (activeView === 'downloads' ? (
            <DownloadsPanel refreshKey={downloadsRefreshKey} />
          ) : activeView === 'automations' ? (
            <AutomationPanel selectedChannel={selectedChannel} channelTree={tree} />
          ) : (
            <MessagePanel
              activeThreads={activeThreads}
              selectedChannel={selectedChannel}
              onBackToChannels={() => {
                setSelectedChannel(null);
                setSidebarOpen(true);
              }}
              onExportStarted={handleExportStarted}
              onSelectChannel={selectChannel}
            />
          ))}
        </main>
        <ExportJobToast jobId={exportJobId} onDone={handleExportDone} />
        <MobileNav
          activeView={activeView}
          compact={sidebarOpen || isChatView}
          channelsOpen={sidebarOpen}
          onChangeView={handleChangeView}
          onToggleChannels={handleOpenChannels}
        />
      </div>
    </div>
  );
}
