import { StructuredData } from "@/components/structured-data";
import { createMetadata } from "@/lib/metadata";
import { Hero } from "@/components/home/hero";
import { ValueProp } from "@/components/home/value-prop";
import { Agents } from "@/components/home/agents";
import { Pillars } from "@/components/home/pillars";
import { Scenarios } from "@/components/home/scenarios";
import { Faq } from "@/components/home/faq";
import { FinalCta } from "@/components/home/final-cta";
import { Footer } from "@/components/home/footer";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = createMetadata({
  description:
    "云雀教学 Agent —— 科研级 AI 教学闭环系统。教师上传教案，AI 拆解知识点与学习路径；学生在分步引导中完成练习，系统基于信任分动态调整辅导策略。",
  path: "/",
});

export default function HomePage(): ReactNode {
  return (
    <>
      <StructuredData />
      <main id="main-content" className="relative z-10 flex-1 bg-background">
        <Hero />
        <ValueProp />
        <Agents />
        <Pillars />
        <Scenarios />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </>
  );
}
