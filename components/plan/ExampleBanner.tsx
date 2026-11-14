import Link from "next/link";

/** Slim strip on top of the example persona's plan. */
export function ExampleBanner() {
  return (
    <div className="border-b-3 border-ink bg-sun">
      <p className="mx-auto w-full max-w-6xl px-5 py-3 text-sm font-medium text-ink sm:px-6">
        You&rsquo;re viewing an example.{" "}
        <Link href="/start" className="-my-3 inline-block rounded-sm py-3 font-bold text-ink underline decoration-2 underline-offset-4 hover:bg-ink/10">
          Start with your own numbers →
        </Link>
      </p>
    </div>
  );
}
