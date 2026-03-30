export const LoadingBlock = ({ label = 'بارکردنی داتا...' }: { label?: string }) => (
  <div className="flex min-h-[180px] items-center justify-center rounded-4xl border border-dashed border-stone-200 bg-white/70 p-6 text-sm text-stone-600">
    {label}
  </div>
);
