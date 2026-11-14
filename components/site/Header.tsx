import Link from "next/link";
import { HeaderAction } from "./HeaderAction";
import { HeaderNav } from "./HeaderNav";
import { Wordmark } from "./Wordmark";

export function Header() {
  return (
    <header>
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-6 lg:px-10">
        <Link href="/" aria-label="Penaltyproof home" className="-mx-1 inline-flex min-h-11 items-center rounded-sm px-1">
          <Wordmark />
        </Link>
        <div className="flex items-center gap-6">
          <HeaderNav />
          <HeaderAction />
        </div>
      </div>
    </header>
  );
}
