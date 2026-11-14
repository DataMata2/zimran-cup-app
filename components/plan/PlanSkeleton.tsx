/** Placeholder with the plan's footprint while the saved answers load in the browser. */
export function PlanSkeleton() {
  const block = "rounded-sm bg-sunken";
  return (
    <div aria-hidden className="mx-auto w-full max-w-6xl px-4 pt-6 pb-16 sm:px-6 sm:pt-10">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-x-14">
        <div className="flex flex-col gap-4">
          <div className={`${block} h-12 w-11/12 max-w-xl`} />
          <div className={`${block} h-12 w-2/3 max-w-md`} />
          <div className={`${block} mt-6 h-8 w-1/2 max-w-sm`} />
          <div className={`${block} h-4 w-5/6 max-w-lg`} />
        </div>
        <div className="h-96 rounded-lg border border-line bg-surface" />
      </div>
    </div>
  );
}
