import type { Metadata } from "next";

export const siteConfig = {
  name: "云雀教学 Agent",
  shortDescription: "AI 智能伴学，因材施教",
  description:
    "云雀教学 Agent 是科研级 AI 教学闭环系统：教师上传教案、AI 拆解知识点与学习路径，学生在分步引导中完成练习，系统基于信任分动态调整辅导策略。默认覆盖《数据库原理》课程。",
  url: "https://example.com",
  ogImage: "/og-image.png",
  creator: "@study-agent",
  authors: [
    {
      name: "云雀教学 Agent",
      url: "https://example.com",
    },
  ],
  keywords: [
    "云雀教学",
    "AI 伴学",
    "智能教学",
    "教学 Agent",
    "数据库原理",
    "自适应学习",
    "元认知辅导",
    "Next.js",
    "React",
  ],
} as const;

export const baseMetadata: Metadata = {
  metadataBase: new URL(siteConfig.url),
  title: {
    default: `${siteConfig.name} — ${siteConfig.shortDescription}`,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  applicationName: siteConfig.name,
  keywords: [...siteConfig.keywords],
  authors: [...siteConfig.authors],
  creator: siteConfig.creator,
  publisher: siteConfig.name,
  category: "technology",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteConfig.url,
    title: `${siteConfig.name} — ${siteConfig.shortDescription}`,
    description: siteConfig.description,
    siteName: siteConfig.name,
    images: [
      {
        url: siteConfig.ogImage,
        width: 1200,
        height: 630,
        alt: siteConfig.name,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${siteConfig.name} — ${siteConfig.shortDescription}`,
    description: siteConfig.description,
    images: [siteConfig.ogImage],
    creator: siteConfig.creator,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.svg",
  },
  manifest: "/site.webmanifest",
};

export function createMetadata({
  title,
  description,
  path = "/",
  image,
  noIndex = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}): Metadata {
  const url = `${siteConfig.url}${path}`;
  const ogImage = image ?? siteConfig.ogImage;
  const finalTitle = title ?? `${siteConfig.name} — ${siteConfig.shortDescription}`;
  const finalDesc = description ?? siteConfig.description;

  return {
    title: title ?? null,
    description: finalDesc,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: finalTitle,
      description: finalDesc,
      url,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: finalTitle,
        },
      ],
    },
    twitter: {
      title: finalTitle,
      description: finalDesc,
      images: [ogImage],
    },
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),
  };
}
