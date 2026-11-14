/** Placeholder with the plan's footprint while the saved answers load in the browser. */
export function PlanSkeleton() {
  const block = "rounded-sm bg-sunken";
  return (
    <div aria-hidden className="mx-auto w-full max-w-6xl px-5 pt-7 pb-16 sm:px-6 sm:pt-10">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)] lg:gap-x-10">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-4 rounded-lg border-3 border-ink bg-surface px-5 py-6 shadow-hard sm:px-8 sm:py-8">
            <div className={`${block} h-6 w-40 rounded-full`} />
            <div className={`${block} h-14 w-11/12 max-w-xl`} />
            <div className={`${block} h-14 w-2/3 max-w-md`} />
            <div className={`${block} mt-2 h-14 w-full max-w-xs rounded-md`} />
          </div>
          <div className="flex flex-col gap-3 rounded-lg border-3 border-ink bg-surface px-5 py-6 shadow-hard sm:px-8">
            <div className={`${block} h-14 w-full rounded-md`} />
            <div className={`${block} h-4 w-5/6 max-w-lg`} />
          </div>
        </div>
        <div className="h-96 rounded-lg border-3 border-ink bg-surface shadow-hard" />
      </div>
    </div>
  );
}
