import type { Metadata } from "next";
import { PageHero } from "@/components/ui/PageHero";
import { coaches } from "@/data/coaches";

export const metadata: Metadata = {
  title: "Antrenörler — BlackBox",
  description: "BlackBox boks ve fight antrenör kadrosu.",
};

export default function CoachesPage() {
  return (
    <div>
      <PageHero
        eyebrow="Antrenörler"
        title="Kadromuzla Tanış"
        description="Her seviyeye uygun, sahada aktif tecrübeye sahip antrenör kadrosu."
      />

      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {coaches.map((coach) => (
            <div
              key={coach.slug}
              className="rounded-sm border border-brand-border bg-brand-surface p-6"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-yellow font-display text-lg text-brand-black">
                {coach.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")}
              </div>
              <h2 className="font-display mt-4 text-lg uppercase tracking-wide text-brand-white">
                {coach.name}
              </h2>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-yellow">
                {coach.role}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-brand-muted">
                {coach.bio}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                {coach.focus.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-sm border border-brand-border px-2 py-1 text-[11px] uppercase tracking-wide text-brand-muted"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
