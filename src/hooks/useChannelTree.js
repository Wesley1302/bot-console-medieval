import { useCallback, useEffect, useRef, useState } from 'react';
import { getChannels } from '../api/channels.api.js';

export function useChannelTree() {
  const [tree, setTree] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const generation = useRef(0);

  const refresh = useCallback(async () => {
    const currentGeneration = ++generation.current;
    setStatus('loading');
    setError('');
    try {
      const payload = await getChannels();
      if (currentGeneration !== generation.current) return;
      setTree(payload);
      setStatus('ready');
    } catch (requestError) {
      if (currentGeneration !== generation.current) return;
      setError(requestError.message);
      setStatus('error');
    }
  }, []);

  useEffect(() => { refresh(); return () => { generation.current += 1; }; }, [refresh]);
  return { tree, status, error, refresh };
}
