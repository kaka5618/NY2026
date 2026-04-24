import { HomeAuthStrip } from "@/components/HomeAuthStrip";
import { homePageContent } from "./content";
import DemoOne from "./demo";

/**
 * 首页视图组件（仅负责 UI 展示）。
 */
export function HomePageView() {
  return (
    <div className="relative min-h-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="pointer-events-none absolute right-0 top-0 z-30 p-3 md:p-5">
        <div className="pointer-events-auto">
          <HomeAuthStrip />
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 pb-10 pt-4 md:pb-12 md:pt-6">
        <header className="mx-auto max-w-lg text-center font-home">
          <p className="text-xs font-normal tracking-[0.22em] text-rose-200/80">
            {homePageContent.brand}
          </p>
          <h1 className="mt-4 flex flex-col items-center gap-0.5 text-[1.6rem] font-semibold leading-tight tracking-[0.06em] text-rose-50 md:text-[1.85rem]">
            <span className="block">{homePageContent.titleLine1}</span>
            <span className="block font-normal text-rose-100/95">
              {homePageContent.titleLine2}
            </span>
          </h1>
          <div className="mx-auto mt-5 max-w-[19rem] space-y-0 text-[13px] font-normal leading-relaxed text-slate-400/95 md:text-sm">
            <p>{homePageContent.subtitleLine1}</p>
            <p className="mt-2 border-t border-white/[0.08] pt-2">
              {homePageContent.subtitleLine2}
            </p>
          </div>
        </header>

        <div className="rounded-3xl bg-slate-900/50 p-3 ring-1 ring-white/10">
          <DemoOne />
        </div>

        <footer className="text-center text-xs font-light text-slate-500">
          <p>{homePageContent.footer}</p>
        </footer>
      </div>
    </div>
  );
}
