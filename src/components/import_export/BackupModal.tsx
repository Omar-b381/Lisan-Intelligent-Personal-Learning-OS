import React, { useState, useEffect } from 'react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { api } from '../../services/api';
import { useAppStore } from '../../stores/appStore';
import { BackupFileInfo } from '../../types/settings';
import { Database, Download, ShieldCheck } from 'lucide-react';

interface BackupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupModal: React.FC<BackupModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = useAppStore();
  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [isCreating, setIsCreating] = useState(false);

  const fetchBackups = async () => {
    try {
      const list = await api.listBackups();
      setBackups(list);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (isOpen) fetchBackups();
  }, [isOpen]);

  const handleCreateBackup = async () => {
    setIsCreating(true);
    try {
      const created = await api.createBackup();
      showToast(`Backup created: ${created.filename}`);
      fetchBackups();
    } catch (err: any) {
      alert(`Backup failed: ${err?.message || err}`);
    } finally {
      setIsCreating(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Local Database Backup Vault" maxWidth="md">
      <div className="space-y-5">
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
            Atomic, zero-downtime database snapshots are saved securely to your local AppData directory. Never risk losing your learning and review history.
          </p>
        </div>

        <Button
          variant="primary"
          icon={<Database className="w-4 h-4" />}
          className="w-full"
          disabled={isCreating}
          onClick={handleCreateBackup}
        >
          {isCreating ? 'Creating Snapshot...' : 'Create Snapshot Now'}
        </Button>

        {/* Existing Backups List */}
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
            Available Snapshots
          </h4>
          <div className="max-h-60 overflow-y-auto space-y-2">
            {backups.map((b) => (
              <div
                key={b.filename}
                className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs"
              >
                <div>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200 block">
                    {b.filename}
                  </span>
                  <span className="text-slate-400">
                    {formatSize(b.size_bytes)} &bull; {new Date(b.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}

            {backups.length === 0 && (
              <p className="text-center text-xs text-slate-400 py-4">
                No previous snapshots found.
              </p>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};
