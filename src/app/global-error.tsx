'use client';
import { useI18n } from '@/i18n/react';
import { useEffect } from 'react';
import { reportFrontendError } from '@/features/runtime/frontend-diagnostics';

export default function GlobalError({ error, reset }: { error: unknown; reset: () => void }) {
  const { t, locale } = useI18n();

  useEffect(() => { reportFrontendError('react.boundary', error); }, [error]);
  return <html lang={locale}><body><main><h1>{t("Something went wrong")}</h1><p role="alert">{t("The application could not be displayed. Retry to recover.")}</p><button onClick={reset}>{t("Retry")}</button></main></body></html>;
}
