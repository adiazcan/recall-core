import { useEffect, useState } from 'react';
import { apiRequestBlob } from '../api/client';

const httpUrlPattern = /^https?:\/\//i;

export function useAuthorizedImageUrl(sourceUrl?: string | null): string | null {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    let objectUrl: string | null = null;

    if (!sourceUrl) {
      setResolvedUrl(null);
      return () => undefined;
    }

    if (httpUrlPattern.test(sourceUrl) || !sourceUrl.startsWith('/api/v1/')) {
      setResolvedUrl(sourceUrl);
      return () => undefined;
    }

    const fetchImage = async () => {
      try {
        const blob = await apiRequestBlob(sourceUrl);
        if (!isActive) {
          return;
        }
        objectUrl = URL.createObjectURL(blob);
        setResolvedUrl(objectUrl);
      } catch {
        if (isActive) {
          setResolvedUrl(null);
        }
      }
    };

    fetchImage();

    return () => {
      isActive = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [sourceUrl]);

  return resolvedUrl;
}
