"use client";

import Link from "next/link";
import { ArrowChip } from "@/components/arrow-chip";
import type { ReactNode } from "react";

const PRODUCT_LINKS = [
  { label: "四 Agent 闭环", href: "#agents" },
  { label: "核心能力", href: "#pillars" },
  { label: "适用场景", href: "#scenarios" },
  { label: "研究背景", href: "#approach" },
];

const ABOUT_LINKS = [
  { label: "常见问题", href: "#faq" },
  { label: "教师工作台", href: "/teacher" },
  { label: "学生端", href: "/student" },
  { label: "登录", href: "/login" },
];

const DOCS_LINKS = [
  { label: "信任分机制", href: "#pillars" },
  { label: "RAG 检索", href: "#pillars" },
  { label: "私有化部署", href: "#scenarios" },
];

const LEGAL_LINKS = [{ label: "《数据库原理》课程", href: "#approach" }];

export function Footer(): ReactNode {
  return (
    <footer
      id="contact"
      className="min-[851px]:sticky min-[851px]:bottom-0 z-0 bg-background text-foreground flex flex-col"
    >
      <div className="mx-auto w-full max-w-[1680px] px-6 lg:px-10 pt-24 lg:pt-32">
        <span className="inline-flex items-center rounded-md border border-foreground/[0.08] px-3.5 py-1.5 font-mono text-xs uppercase tracking-widest text-foreground/70">
          开始使用
        </span>
        <div className="mt-6 text-4xl sm:text-6xl lg:text-7xl xl:text-8xl font-medium tracking-tighter leading-[0.95] max-w-5xl">
          <p className="block">因材施教，</p>
          <p className="block text-foreground/55">从一次追问开始。</p>
        </div>

        <div className="mt-12">
          <Link href="/login" className="group inline-flex items-stretch gap-1">
            <span className="px-5 py-3 rounded-md bg-foreground text-background text-xs font-medium tracking-widest uppercase">
              立即登录
            </span>
            <ArrowChip className="bg-foreground text-background" />
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1680px] px-6 lg:px-10 mt-24 lg:mt-32 py-16 lg:py-20 grid grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8">
        <div className="col-span-2 lg:col-span-4">
          <Link
            href="/"
            className="inline-flex items-center gap-3 text-xl font-medium tracking-tight"
          >
            <span
              aria-hidden
              className="h-8 w-8 rounded-full border-2 border-foreground/70"
            />
            云雀教学 Agent
          </Link>
          <p className="mt-4 text-foreground/55 max-w-xs leading-relaxed">
            面向《数据库原理》等本科课程的自进化教学闭环——教案解析、分步练习、信任分辅导与班级洞察，四个
            Agent 各司其职。
          </p>
        </div>

        <FooterColumn title="产品" links={PRODUCT_LINKS} />
        <FooterColumn title="关于" links={ABOUT_LINKS} />
        <FooterColumn title="说明" links={DOCS_LINKS} />
      </div>

      <div className="mt-auto">
        <div className="mx-auto w-full max-w-[1680px] px-6 lg:px-10 py-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between text-sm text-foreground/55">
          <p>© 2026 云雀教学 Agent. 保留所有权利。</p>
          <div className="flex items-center gap-6">
            {LEGAL_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="hover:text-foreground transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

interface FooterColumnProps {
  title: string;
  links: ReadonlyArray<{ label: string; href: string }>;
}

function FooterColumn({ title, links }: FooterColumnProps): ReactNode {
  return (
    <div className="col-span-1 lg:col-span-2">
      <h4 className="font-mono text-xs uppercase tracking-widest text-foreground/55 mb-5">
        {title}
      </h4>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-foreground/85 hover:text-foreground transition-colors"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
