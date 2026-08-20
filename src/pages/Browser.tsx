import React from 'react';
import { CardBrowser } from '../components/browser/CardBrowser';
import { useAppStore } from '../stores/appStore';
import { t } from '../i18n';

export const Browser: React.FC = () => {
  const { language } = useAppStore();

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      <div>
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
          {t('navBrowser', language)}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">
          Fast full-text search, multi-field filtering, tag management, and batch editing
        </p>
      </div>

      <CardBrowser />
    </div>
  );
};
