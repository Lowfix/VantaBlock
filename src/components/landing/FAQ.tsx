import { useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";
import { cn } from "../../lib/cn";

interface FAQItem {
  question: string;
  answer: string;
}

const faqs: FAQItem[] = [
  {
    question: "Why isn't there public pricing yet? Do I need an invite code?",
    answer:
      "Vantablock is currently running free of charge for a small group of friends while we build things out. There's no public pricing yet — the plans page shows every tier we'll support once pricing goes live, but for now, getting a server means getting an invite.",
  },
  {
    question: "Is hosting really free right now?",
    answer:
      "Yes — while we're in this early friends phase, servers are provisioned at no cost. That's not meant to be a permanent policy, just how things work while we're building things out. If and when that changes, you'd be notified before anything changes for your server.",
  },
  {
    question: "What hardware do you run?",
    answer:
      "Every plan runs on dedicated AMD Ryzen 9 9955HX cores (16 Zen 5 cores, up to 5.4GHz) with 96GB of DDR5 memory and NVMe SSD storage per node — no shared vCPU throttling, no oversold RAM. It's hardware chosen for one job: keeping your TPS at 20, even under modpacks and packed raids.",
  },
  {
    question: "How long does setup take?",
    answer:
      "Under a minute. Pick a version, choose Paper, Forge, Fabric, or Vanilla, and you're on the world selection screen — 60 second deploy time from request to a running server.",
  },
  {
    question: "Can I install modpacks and plugins?",
    answer:
      "Yes. Every plan supports Paper, Forge, and Fabric alongside Vanilla, with 1-click modpack installs and a plugin browser so you're not hand-uploading jars over FTP. Higher tiers add things like priority support and daily automated backups on top of that.",
  },
];

function FAQAccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-2xl border transition-colors duration-300",
        isOpen ? "border-accent-500/40 bg-panel-2" : "border-line bg-panel/60 hover:border-line-soft hover:bg-panel-2/60"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="text-[15px] font-semibold text-text-hi">{item.question}</span>
        <ChevronDown
          size={18}
          className={cn(
            "shrink-0 text-accent-400 transition-transform duration-300",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-5 text-[13.5px] leading-relaxed text-text-lo">{item.answer}</p>
        </div>
      </div>
    </div>
  );
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section id="faq" className="border-b border-line-soft py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-panel-2 text-accent-400">
            <HelpCircle size={22} />
          </div>
          <p className="mt-6 text-[13px] font-semibold uppercase tracking-wider text-accent-400">FAQ</p>
          <h2 className="mt-3 text-balance text-3xl font-bold tracking-tight text-text-hi sm:text-4xl">
            Questions people actually ask.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[15px] leading-relaxed text-text-md">
            Here's the short version of everything above, answered plainly.
          </p>
        </div>

        <div className="mt-12 space-y-3">
          {faqs.map((item, index) => (
            <FAQAccordionItem
              key={item.question}
              item={item}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex((current) => (current === index ? null : index))}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
