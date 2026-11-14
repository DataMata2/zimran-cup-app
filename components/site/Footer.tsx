import Link from "next/link";
import { DISCLAIMER_TEXT } from "@/components/kit/Disclaimer";
import { Wordmark } from "./Wordmark";

export function Footer() {
  return (
    <footer className="mt-auto border-t-3 border-ink bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-10 text-sm text-ink-2 sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:px-10">
        <div className="flex flex-col gap-3">
          <Wordmark className="text-xl" />
          <p className="max-w-md">
            {DISCLAIMER_TEXT} Federal and state estimated tax for US freelancers.
          </p>
        </div>
        <div className="flex max-w-xs flex-col gap-2 sm:items-end sm:text-right">
          <Link
            href="/how-we-check"
            className="-my-2.5 inline-flex min-h-11 items-center self-start rounded-sm font-bold text-ink underline decoration-2 underline-offset-4 hover:bg-sun-soft sm:self-end"
          >
            How we check our numbers
          </Link>
          <p>Not affiliated with the IRS. For anything unusual in your situation, ask a tax professional.</p>
        </div>
      </div>
    </footer>
  );
}
