import { ArrowLeft, FolderCog, Settings2, ShoppingCart, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { EmployeeShell } from './EmployeeShell';

export const EmployeeSettingsPage = () => (
  <EmployeeShell>
    <section className="space-y-6">
      <Card className="overflow-hidden border-stone-200 bg-gradient-to-br from-white via-stone-50 to-brand-50/70">
        <div className="mx-auto max-w-3xl space-y-5 text-center">
          <Badge className="border-brand-200 bg-brand-50 text-brand-800">
            <Settings2 className="h-3.5 w-3.5" />
            <span>ڕێخستن</span>
          </Badge>
          <div>
            <h1 className="text-3xl font-black text-stone-900">ناوەندی ڕێخستنی کارمەند</h1>
          </div>
        </div>
      </Card>

      <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[
          {
            to: '/employee/settings/checkout',
            title: 'ڕێخستنی تەواو کردنی داواکاری',
            description: 'جۆری ناردنی بنەڕەتی بۆ پەیجی تەواوکردنی داواکاری هەڵبژێرە.',
            icon: ShoppingCart,
            tone: 'bg-sky-50 text-sky-900',
          },
          {
            to: '/employee/settings/menu',
            title: 'بەڕێوبردنی مینو',
            description: 'پۆلەکان، خواردنەکان، و بۆکسی گەڕان بە ناوی خواردن لە پەیجێکی جیاوازدا.',
            icon: FolderCog,
            tone: 'bg-brand-50 text-brand-900',
          },
          {
            to: '/employee/settings/data',
            title: 'سڕینەوەی داتا',
            description: 'ئاگەدارکردنەوەکان، ئۆردەری سەفەری، و ئۆردەری گەیاندن تەنها لە لای خۆت پاک بکەرەوە.',
            icon: Trash2,
            tone: 'bg-rose-50 text-rose-900',
          },
        ].map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="rounded-4xl border border-white/80 bg-white/95 p-6 shadow-card transition hover:-translate-y-0.5 hover:border-brand-100"
          >
            <div className="flex items-center justify-between">
              <div className={`flex h-14 w-14 items-center justify-center rounded-3xl ${card.tone}`}>
                <card.icon className="h-6 w-6" />
              </div>
              <ArrowLeft className="h-5 w-5 text-stone-400" />
            </div>
            <h2 className="mt-5 text-xl font-black text-stone-900">{card.title}</h2>
            <p className="mt-2 text-sm leading-7 text-stone-600">{card.description}</p>
          </Link>
        ))}
      </div>
    </section>
  </EmployeeShell>
);
