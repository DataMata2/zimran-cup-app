import Link from "next/link";
import { HeaderAction } from "./HeaderAction";
import { Wordmark } from "./Wordmark";

export function Header() {
  return (
    <header className="border-b border-line/70">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="Penaltyproof home" className="-mx-1 rounded-sm px-1 py-1">
          <Wordmark />
        </Link>
        <HeaderAction />
      </div>
    </header>
  );
}
