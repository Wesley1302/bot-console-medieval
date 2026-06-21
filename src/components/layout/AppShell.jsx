import { useCallback, useState } from 'react';
import { AutomationPanel } from '../automations/AutomationPanel.jsx';
import { ChannelTree } from '../channels/ChannelTree.jsx';
import { DownloadsPanel } from '../exports/DownloadsPanel.jsx';
import { ExportJobToast } from '../exports/ExportJobToast.jsx';
import { MessagePanel } from '../messages/MessagePanel.jsx';
import { Sidebar } from './Sidebar.jsx';
import { TopBar } from './TopBar.jsx';
import { MobileNav } from './MobileNav.jsx';

export function AppShell({ children, onLogout, operator }) {
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [activeThreads, setActiveThreads] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeView, setActiveView] = useState('console');
  const [exportJobId, setExportJobId] = useState('');
  const [downloadsRefreshKey, setDownloadsRefreshKey] = useState(0);
  const isChatView = activeView === 'console' && Boolean(selectedChannel?.messageable);

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

  const handleTreeLoaded = useCallback((tree) => {
    setActiveThreads(tree?.activeThreads || []);
  }, []);

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
      <Sidebar open={sidebarOpen}>
        <ChannelTree
          selectedChannel={selectedChannel}
          onExportStarted={handleExportStarted}
          onSelectChannel={selectChannel}
          onTreeLoaded={handleTreeLoaded}
        />
      </Sidebar>
      <div className="app-main">
        <TopBar
          activeView={activeView}
          onChangeView={handleChangeView}
          onLogout={onLogout}
          operator={operator}
        />
        <main className={isChatView ? 'app-content app-content--chat' : 'app-content'}>
          {children || (activeView === 'downloads' ? (
            <DownloadsPanel refreshKey={downloadsRefreshKey} />
          ) : activeView === 'automations' ? (
            <AutomationPanel selectedChannel={selectedChannel} />
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
          onLogout={onLogout}
          onToggleChannels={handleOpenChannels}
        />
      </div>
    </div>
  );
}
