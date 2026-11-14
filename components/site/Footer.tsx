import { DISCLAIMER_TEXT } from "@/components/kit/Disclaimer";
import { Wordmark } from "./Wordmark";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-2 sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <Wordmark className="text-base" />
          <p className="max-w-md">
            {DISCLAIMER_TEXT} Federal and state estimated tax for US freelancers.
          </p>
        </div>
        <p className="max-w-xs sm:text-right">
          Not affiliated with the IRS. For anything unusual in your situation, ask a tax professional.
        </p>
      </div>
    </footer>
  );
}
