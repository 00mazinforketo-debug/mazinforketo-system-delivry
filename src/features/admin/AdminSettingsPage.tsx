import { ArrowLeft, Boxes, Database, FolderCog, Settings2, ShieldCheck, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AdminHeroCard } from '../../components/shared/AdminHeroCard';
import { Card } from '../../components/ui/Card';

const settingCards = [
  {
    to: '/admin/settings/business',
    title: 'ڕێکخستنی بزنس',
    description: 'ناوی بازرگانی، ناوچەکان، یادداشت و یاساکانی کارکردنی پێشوازی لێرە دەگۆڕدرێن.',
    icon: Settings2,
    tone: 'from-brand-50 via-white to-sky-50 border-brand-100 text-brand-900',
    badge: 'بازرگانی',
  },
  {
    to: '/admin/settings/catalog',
    title: 'ڕێکخستنی کاتالۆگ',
    description: 'شاراوەکردن و ڕێکخستنی پۆلەکان و خواردنەکان لە پەیجێکی تایبەتدا.',
    icon: FolderCog,
    tone: 'from-amber-50 via-white to-orange-50 border-amber-100 text-amber-900',
    badge: 'خواردن',
  },
  {
    to: '/admin/settings/storage',
    title: 'پوختەی پاراستن',
    description: 'هەڵگرتنی پاڵپشت، هێنان و دەرکردن و دۆخی پاراستن لە پەیجێکی جیاوازدا ببینە.',
    icon: Database,
    tone: 'from-stone-100 via-white to-stone-50 border-stone-200 text-stone-900',
    badge: 'پاراستن',
  },
  {
    to: '/admin/settings/maintenance',
    title: 'سڕینەوەی داتا',
    description: 'هەموو داواکاری و ئاگەدارکردنەوەکان لە پەیجی پاکسازیی تایبەتدا پاک بکە.',
    icon: Trash2,
    tone: 'from-rose-50 via-white to-pink-50 border-rose-100 text-rose-900',
    badge: 'پاکسازی',
  },
] as const;

const adminSettingStats = [
  {
    label: 'بەشەکان',
    value: settingCards.length,
    icon: Boxes,
    tone: 'from-violet-50 to-fuchsia-50 border-violet-100 text-violet-900',
    labelClassName: 'text-[10px]',
  },
  {
    label: 'بازرگانی + خواردن',
    value: 2,
    icon: FolderCog,
    tone: 'from-amber-50 to-orange-50 border-amber-100 text-amber-900',
    labelClassName: 'text-[10px]',
  },
  {
    label: 'پاراستن + پاکسازی',
    value: 2,
    icon: ShieldCheck,
    tone: 'from-emerald-50 to-teal-50 border-emerald-100 text-emerald-900',
    labelClassName: 'text-[10px]',
  },
] as const;

export const AdminSettingsPage = () => (
  <section className="space-y-6">
    <AdminHeroCard
      eyebrow="ناوەندی ڕێکخستن"
      icon={Settings2}
      title="ناوەندی ڕێکخستنی ئادمێن"
      description="هەموو پەیجەکانی بازرگانی، خواردن، پاراستن و پاکسازی لە خوارەوە کۆکراونەتەوە. هەر دوگمەیەک تۆ دەبات بۆ پەیجی تایبەتی خۆی."
      stats={adminSettingStats}
      statsGridClassName="grid-cols-3"
    />

    <Card className="space-y-4 border-stone-200 bg-gradient-to-br from-white via-stone-50 to-brand-50/50">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.24em] text-stone-400">بەشەکان</p>
        <h2 className="mt-2 text-2xl font-black text-stone-900">بەشە سەرەکییەکان</h2>
        <p className="mt-2 text-sm leading-7 text-stone-600">بەشەکانی خوارەوە لە یەک شێوازی یەکگرتوو ڕێکخراون و هەر یەکەیان پەیجی جیاوازی خۆی هەیە.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {settingCards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className={`group rounded-[2rem] border bg-gradient-to-br p-5 shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 ${card.tone}`}
          >
            <div className="flex items-center justify-between">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-[1.2rem] bg-white/80 shadow-sm">
                <card.icon className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-stone-700">{card.badge}</span>
                <ArrowLeft className="h-5 w-5 text-stone-400 transition group-hover:-translate-x-1" />
              </div>
            </div>
            <h2 className="mt-5 text-xl font-black">{card.title}</h2>
            <p className="mt-2 text-sm leading-7 text-stone-600">{card.description}</p>
          </Link>
        ))}
      </div>
    </Card>
  </section>
);
