import React, { useEffect, useState, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Trash2,
  AlertCircle,
  FileText,
  Bookmark,
  Sparkles,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useReadingStore } from '../../stores/readingStore';
import { useAppStore } from '../../stores/appStore';
import { t } from '../../i18n';
import { Button } from '../common/Button';
import { Book } from '../../types/reading';

export const BookLibrary: React.FC = () => {
  const { language, showToast } = useAppStore();
  const {
    books,
    isLoadingBooks,
    isImporting,
    loadBooks,
    importBook,
    openBook,
    deleteBook,
  } = useReadingStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedBookToDelete, setSelectedBookToDelete] = useState<Book | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [drmErrorModal, setDrmErrorModal] = useState<string | null>(null);

  useEffect(() => {
    loadBooks();
  }, []);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Read file as Base64 for clean IPC bridge across platforms
      const reader = new FileReader();
      reader.onload = async (event) => {
        const base64Data = event.target?.result as string;
        try {
          const imported = await importBook(file.name, base64Data);
          if (imported) {
            showToast(
              language === 'ar'
                ? `تم استيراد «${imported.title}» بنجاح (${imported.total_passages} مقطع)!`
                : `Successfully imported "${imported.title}" (${imported.total_passages} passages)!`
            );
          }
        } catch (err: any) {
          const msg = err?.message || String(err);
          if (msg.includes('DRM') || msg.includes('حقوق نشر')) {
            setDrmErrorModal(
              language === 'ar'
                ? 'هذا الملف محمي بحماية حقوق نشر (DRM) ولا يمكن استيراده. استورد فقط نسخاً غير محمية (كتب مجال عام، إصدارات DRM-free، أو محتوى من تأليفك).'
                : 'This file is protected by Digital Rights Management (DRM) and cannot be imported. Please import DRM-free editions only.'
            );
          } else if (msg.includes('ممسوحة ضوئياً') || msg.includes('EmptyExtraction')) {
            setDrmErrorModal(
              language === 'ar'
                ? 'هذا الملف يبدو صوراً ممسوحة ضوئياً ولا يحتوي على طبقة نص رقمية صالحة للقراءة في هذا الإصدار.'
                : 'This PDF appears to be a scanned image without an extractable text layer.'
            );
          } else {
            showToast(msg);
          }
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      showToast(err?.message || 'Failed to read file');
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteConfirm = async () => {
    if (!selectedBookToDelete) return;
    setIsDeleting(true);
    try {
      await deleteBook(selectedBookToDelete.id);
      showToast(
        language === 'ar'
          ? `تم حذف «${selectedBookToDelete.title}» بنجاح`
          : `Deleted "${selectedBookToDelete.title}"`
      );
      setSelectedBookToDelete(null);
    } catch (err: any) {
      showToast(err?.message || 'Failed to delete book');
    } finally {
      setIsDeleting(false);
    }
  };

  const getFormatBadge = (format: string) => {
    switch (format.toLowerCase()) {
      case 'epub':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300';
      case 'pdf':
        return 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300';
      case 'txt':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300';
      case 'mobi_drm_free':
      case 'mobi':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300';
      default:
        return 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Top Banner & Actions */}
      <div className="p-6 md:p-8 bg-gradient-to-r from-emerald-600/10 via-teal-600/10 to-indigo-600/10 dark:from-emerald-950/40 dark:via-teal-950/40 dark:to-indigo-950/40 border border-emerald-200/80 dark:border-emerald-800/80 rounded-3xl space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-600/20">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {language === 'ar' ? 'المكتبة والقراءة التفاعلية' : 'Interactive Reading Library'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {language === 'ar'
                  ? 'اقرأ قصصك وكتبك مقسمة لمقاطع ذكية، اضغط على أي كلمة لمعرفة معناها، وأضفها لبطاقات المراجعة في رزمة الكتاب'
                  : 'Read stories segmented into bite-sized passages, lookup words in context, and add flashcards directly to your book deck.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="file"
              ref={fileInputRef}
              accept=".epub,.pdf,.txt,.mobi,.azw3,.azw"
              onChange={handleFileSelected}
              className="hidden"
            />
            <Button
              variant="primary"
              size="md"
              icon={isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              disabled={isImporting}
              onClick={() => fileInputRef.current?.click()}
            >
              {isImporting
                ? language === 'ar'
                  ? 'جاري التحليل والتقطيع...'
                  : 'Importing & Segmenting...'
                : language === 'ar'
                ? 'استيراد كتاب جديد'
                : 'Import Book'}
            </Button>
          </div>
        </div>

        {/* DRM & Formats Info Bar */}
        <div className="pt-3 border-t border-emerald-200/50 dark:border-emerald-800/50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {language === 'ar' ? 'الصيغ المدعومة:' : 'Supported Formats:'}
            </span>
            <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">EPUB</span>
            <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300">PDF</span>
            <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">TXT</span>
            <span className="px-2 py-0.5 rounded-md font-mono text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">MOBI (DRM-Free)</span>
          </div>

          <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-medium text-[11px]">
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>
              {language === 'ar'
                ? 'الملفات المحمية بنظام DRM (كمشتريات كيندل العادية) غير مدعومة.'
                : 'DRM-protected files (e.g. standard Kindle purchases) are not supported.'}
            </span>
          </div>
        </div>
      </div>

      {/* Books Grid */}
      {isLoadingBooks ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-xs text-slate-400">
            {language === 'ar' ? 'جاري تحميل كتبك...' : 'Loading your library...'}
          </p>
        </div>
      ) : books.length === 0 ? (
        <div className="p-12 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
            <BookOpen className="w-8 h-8" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h4 className="text-base font-bold text-slate-800 dark:text-slate-200">
              {language === 'ar' ? 'مكتبتك فارغة حالياً' : 'Your Library is Empty'}
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {language === 'ar'
                ? 'استورد كتاباً أو قصة بصيغة EPUB أو PDF أو TXT للبدء في القراءة التفاعلية والاستماع الصوتي المباشر.'
                : 'Import an EPUB, PDF, or TXT story to experience interactive reading and synchronized TTS.'}
            </p>
          </div>
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={() => fileInputRef.current?.click()}
          >
            {language === 'ar' ? 'استيراد كتابك الأول الآن' : 'Import Your First Book'}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {books.map((book) => {
            const formatBadgeClass = getFormatBadge(book.source_format);
            const isCompleted = book.progress_percent >= 100;

            return (
              <div
                key={book.id}
                className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl overflow-hidden hover:border-emerald-500/80 hover:shadow-xl hover:shadow-emerald-950/5 transition-all group flex flex-col justify-between"
              >
                {/* Book Cover Area */}
                <div className="relative h-44 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900 flex items-center justify-center overflow-hidden">
                  {book.cover_base64 ? (
                    <img
                      src={`data:image/jpeg;base64,${book.cover_base64}`}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="text-center p-4 space-y-2">
                      <div className="w-12 h-12 rounded-2xl bg-white/80 dark:bg-slate-800/80 shadow-md flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 line-clamp-2 px-2">
                        {book.title}
                      </span>
                    </div>
                  )}

                  {/* Format Badge */}
                  <div className="absolute top-3 left-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono shadow-xs ${formatBadgeClass}`}>
                      {book.source_format.replace('_drm_free', '')}
                    </span>
                  </div>

                  {/* Delete Book Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBookToDelete(book);
                    }}
                    className="absolute top-3 right-3 p-1.5 rounded-xl bg-black/40 hover:bg-red-600 text-white backdrop-blur-xs transition-colors opacity-0 group-hover:opacity-100"
                    title={language === 'ar' ? 'حذف الكتاب' : 'Delete Book'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Book Metadata & Progress */}
                <div className="p-5 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                      {book.title}
                    </h4>
                    {book.author && (
                      <p className="text-xs text-slate-400 line-clamp-1">
                        {book.author}
                      </p>
                    )}
                    <p className="text-[11px] text-slate-400 flex items-center gap-1.5 pt-1">
                      <Bookmark className="w-3 h-3 text-slate-400" />
                      <span>
                        {book.total_passages} {language === 'ar' ? 'مقطع للقراءة' : 'passages'}
                      </span>
                    </p>
                  </div>

                  {/* Reading Progress */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      <span>{language === 'ar' ? 'نسبة الإنجاز:' : 'Progress:'}</span>
                      <span className="font-mono">{book.progress_percent}%</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-500 h-full transition-all duration-300 rounded-full"
                        style={{ width: `${book.progress_percent}%` }}
                      />
                    </div>

                    <Button
                      variant={isCompleted ? 'outline' : 'primary'}
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => openBook(book)}
                    >
                      {book.last_passage_index > 0
                        ? language === 'ar'
                          ? `متابعة (مقطع ${book.last_passage_index + 1})`
                          : `Continue (Passage ${book.last_passage_index + 1})`
                        : language === 'ar'
                        ? 'بدء القراءة'
                        : 'Start Reading'}
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {selectedBookToDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-950/60 text-red-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                {language === 'ar' ? 'تأكيد حذف الكتاب' : 'Delete Book Confirmation'}
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {language === 'ar'
                  ? `هل أنت متأكد من رغبتك في حذف «${selectedBookToDelete.title}» ومقاطعه بالكامل؟ البطاقات المنشأة مسبقاً ستبقى بأمان في طابور مراجعتك.`
                  : `Are you sure you want to delete "${selectedBookToDelete.title}"? Your created flashcards will remain safe in your review queue.`}
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedBookToDelete(null)}
              >
                {language === 'ar' ? 'إلغاء' : 'Cancel'}
              </Button>
              <Button
                variant="danger"
                size="sm"
                disabled={isDeleting}
                onClick={handleDeleteConfirm}
              >
                {isDeleting
                  ? language === 'ar'
                    ? 'جاري الحذف...'
                    : 'Deleting...'
                  : language === 'ar'
                  ? 'تأكيد الحذف'
                  : 'Delete Book'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* DRM Rejection / Scanned PDF Modal */}
      {drmErrorModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-900/80 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h4 className="font-bold text-base text-slate-900 dark:text-white">
                {language === 'ar' ? 'تعذّر استيراد الملف' : 'File Cannot Be Imported'}
              </h4>
              <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {drmErrorModal}
              </p>
            </div>
            <div className="flex justify-center pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setDrmErrorModal(null)}
              >
                {language === 'ar' ? 'حسناً، فهمت' : 'Understood'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
