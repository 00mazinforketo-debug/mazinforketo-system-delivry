import { Code2, ExternalLink, Globe2, MonitorSmartphone, UserRound } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmployeeShell } from './EmployeeShell';

const aboutHighlights = [
  {
    title: 'سیستەم و وێب',
    description: 'دروستکردنی سیستەمە دیجیتاڵییەکان و وێب ئەپ بە شێوەی مۆدێرن و خاوێن.',
    icon: Globe2,
  },
  {
    title: 'مۆبایل ئەپ',
    description: 'گەشەپێدانی ئەپڵیکەیشن و چارەسەری کارگێڕی بۆ ئاندڕۆید و iOS.',
    icon: MonitorSmartphone,
  },
  {
    title: 'تکنەلۆژیا',
    description: 'شارەزایی لە بواری تەکنەلۆژیا و دروستکردنی چارەسەری گونجاو بۆ کاروبار.',
    icon: Code2,
  },
] as const;

export const EmployeeAboutPage = () => {
  return (
    <EmployeeShell>
      <section className="mx-auto max-w-5xl space-y-6">
        <Card className="overflow-hidden border-stone-200 bg-gradient-to-br from-white via-stone-50 to-brand-50/70">
        <div className="grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-center">
          <div className="flex flex-col items-center justify-center gap-4 text-center">
            <div className="flex h-56 w-56 items-center justify-center rounded-full bg-gradient-to-br from-brand-700 via-brand-800 to-olive-700 p-5 shadow-card">
              <div className="flex h-full w-full items-center justify-center rounded-full border border-white/20 bg-white/10 backdrop-blur-sm">
                <UserRound className="h-24 w-24 text-white/90" />
              </div>
            </div>
            <Badge className="border-brand-200 bg-white/80 text-brand-800">
              <span>دەربارە</span>
            </Badge>
          </div>

          <div className="space-y-6 text-right">
            <div className="space-y-3">
              <h1 className="text-3xl font-black leading-tight text-stone-900 sm:text-4xl">محمد جاسم عبدالرحمن</h1>
              <p className="max-w-3xl text-sm leading-8 text-stone-700 sm:text-base">
                شارەزایی هەیە لە بواری تەکنەلۆژیا، دروستکردنی سیستەم، وێب ئەپ و ئەپڵیکەیشنی
                مۆبایل. ئامانج بریتییە لە دابینکردنی چارەسەرێکی مۆدێرن، خاوێن و پڕۆفیشناڵ بۆ
                کاروبار و پڕۆژە جیاوازەکان.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              {aboutHighlights.map((item) => (
                <div key={item.title} className="rounded-[1.8rem] border border-white/80 bg-white/80 p-4 shadow-sm">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                    <item.icon className="h-5 w-5" />
                  </div>
                  <h2 className="mt-4 text-base font-black text-stone-900">{item.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-stone-600">{item.description}</p>
                </div>
              ))}
            </div>

            <div className="rounded-[2rem] border border-brand-100 bg-white/80 p-5">
              <p className="text-sm leading-8 text-stone-700 sm:text-base">
                بۆ زانیاری زیاتر و ئەگەر سیستەم، ئەپڵیکەیشن، وێب ئەپ یان هەر چارەسەرێکی
                تەکنەلۆژییان پێویستە، پەیوەندیمان پێ بکەن تا بە شێوەیەکی گونجاو بۆتان
                دروستی بکەین.
              </p>
            </div>

            <div className="flex justify-end">
              <a
                href="https://98ramyar.netlify.app"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-2xl bg-brand-700 px-5 py-3 text-sm font-black text-white transition hover:bg-brand-800"
              >
                <ExternalLink className="h-4 w-4" />
                <span>زانیاری زیاتر</span>
              </a>
            </div>
          </div>
        </div>
        </Card>
      </section>
    </EmployeeShell>
  );
};
