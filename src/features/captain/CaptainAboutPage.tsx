import { ArrowRight, Bell, ClipboardList, ExternalLink, ShieldCheck, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { SUPPORT_LABEL, SUPPORT_URL } from '../../config/support';
import { CaptainShell } from './CaptainShell';

const aboutHighlights = [
  {
    title: 'سەفەری',
    description: 'بینینی هەموو داواکارییە سەفەرییەکان، گۆڕینی دۆخ و چوون بۆ وردەکارییەکان بە شێوەی خێرا.',
    icon: ClipboardList,
    tone: 'bg-brand-50 text-brand-900',
  },
  {
    title: 'گەیاندن',
    description: 'بەشی جیاواز بۆ گەیاندن کە بەجیا لە سەفەری ڕێکخراوە و کارکردنی ڕۆژانەی کاپتن ئاسانتر دەکات.',
    icon: Truck,
    tone: 'bg-sky-50 text-sky-900',
  },
  {
    title: 'ئاگەدارکردنەوە',
    description: 'هەموو پەیامە نوێکان و گۆڕانکاریی دۆخەکان لە لیستێکی یەکگرتوو بۆ بینینی خێرا کۆدەکرێنەوە.',
    icon: Bell,
    tone: 'bg-stone-100 text-stone-900',
  },
] as const;

export const CaptainAboutPage = () => {
  const navigate = useNavigate();

  return (
    <CaptainShell>
      <section className="mx-auto max-w-5xl space-y-6">
        <div className="flex justify-end">
          <Button variant="secondary" icon={<ArrowRight className="h-4 w-4" />} onClick={() => navigate(-1)}>
            گەڕانەوە
          </Button>
        </div>

        <Card className="overflow-hidden border-stone-200 bg-gradient-to-br from-white via-stone-50 to-sky-50/70">
          <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-center">
            <div className="flex flex-col items-center justify-center gap-4 text-center">
              <div className="flex h-56 w-56 items-center justify-center rounded-full bg-gradient-to-br from-sky-700 via-brand-800 to-olive-700 p-5 shadow-card">
                <div className="flex h-full w-full items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm">
                  <ShieldCheck className="h-24 w-24 text-white/90" />
                </div>
              </div>
              <Badge className="border-sky-200 bg-white/80 text-sky-800">
                <span>دەربارە</span>
              </Badge>
            </div>

            <div className="space-y-6 text-right">
              <div className="space-y-3">
                <h1 className="text-3xl font-black leading-tight text-stone-900 sm:text-4xl">دەربارەی داشبۆردی کاپتن</h1>
                <p className="max-w-3xl text-sm leading-8 text-stone-700 sm:text-base">
                  ئەم داشبۆردە بۆ بەڕێوەبردنی سەفەری و گەیاندن بە شێوەی مۆدێرن، ڕێکخراو و
                  هاوشێوەی بەشی کارمەند دروستکراوە، بەڵام بە داتاو کاردانەوەی تایبەت بە ڕۆڵی کاپتن.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {aboutHighlights.map((item) => (
                  <div key={item.title} className="rounded-[1.8rem] border border-white/80 bg-white/80 p-4 shadow-sm">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${item.tone}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <h2 className="mt-4 text-base font-black text-stone-900">{item.title}</h2>
                    <p className="mt-2 text-sm leading-7 text-stone-600">{item.description}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-[2rem] border border-sky-100 bg-white/85 p-5">
                <p className="text-sm leading-8 text-stone-700 sm:text-base">
                  ئەگەر پێویستت بە گەشەپێدان، نوێکردنەوەی سیستەم یان زانیاریی زیاتر هەیە، لە ڕێگای
                  پەیوەندیی خوارەوە دەتوانیت زیاتر بزانیت.
                </p>
              </div>

              <div className="flex justify-end">
                <a
                  href={SUPPORT_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-black text-white transition hover:bg-brand-800"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>{SUPPORT_LABEL}</span>
                </a>
              </div>
            </div>
          </div>
        </Card>
      </section>
    </CaptainShell>
  );
};
