import { useEffect, useState } from "react";
import type { CommerceAuthClient } from "./auth";
import { fetchMediaPreview, managedMediaPublicId } from "./api";

type PreviewState = {
  client: CommerceAuthClient;
  storeId: string;
  key: string;
  sources: Record<string, string>;
  failed: string[];
};

// Blob URLs belong to this mounted merchant view. They are never saved to the
// product, exposed to public visitors, or retained after a store/session change.
export function useMerchantMedia(
  client: CommerceAuthClient,
  storeId: string,
  urls: string[]
) {
  const key = JSON.stringify([...new Set(urls.filter(Boolean))].sort());
  const [state, setState] = useState<PreviewState | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const requested: string[] = JSON.parse(key);
    const controller = new AbortController();
    const objectUrls: string[] = [];
    const sources = Object.fromEntries(requested.filter(url => !managedMediaPublicId(url)).map(url => [url, url]));
    setState({ client, storeId, key, sources, failed: [] });

    void Promise.all(requested.map(async url => {
      const publicId = managedMediaPublicId(url);
      if (!publicId) return;
      try {
        const blob = await fetchMediaPreview(client, storeId, publicId, controller.signal);
        if (controller.signal.aborted) return;
        const source = URL.createObjectURL(blob);
        objectUrls.push(source);
        setState(current => current && ({ ...current, sources: { ...current.sources, [url]: source } }));
      } catch {
        if (!controller.signal.aborted) {
          setState(current => current && ({ ...current, failed: [...current.failed, url] }));
        }
      }
    }));

    return () => {
      controller.abort();
      objectUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [client, storeId, key, attempt]);

  const current = state?.client === client && state.storeId === storeId && state.key === key ? state : null;
  return {
    sources: current?.sources ?? {},
    failed: current?.failed ?? [],
    retry: () => setAttempt(value => value + 1)
  };
}
