"use client";

import { motion } from "motion/react";
import { Sparkles } from "lucide-react";

export function Hero17() {
  return (
    <section className="w-full min-h-screen flex items-start lg:items-center py-12 px-4 sm:px-6 lg:px-8 bg-white dark:bg-neutral-950">
      <div className="max-w-[1400px] mx-auto w-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-14 xl:gap-20 items-center">
          <div className="flex flex-col gap-6 sm:gap-7">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 text-xs font-medium">
                <Sparkles className="w-3.5 h-3.5" />
                Free shipping this week
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-3xl sm:text-4xl md:text-5xl font-medium text-neutral-900 dark:text-white leading-[1.1] tracking-[-0.01em]"
            >
              Daily rituals for deeper
              <br />
              focus and calmer mornings.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="text-sm sm:text-base text-neutral-600 dark:text-neutral-400 leading-relaxed max-w-sm"
            >
              A small-batch tea, a hand-poured candle, and a linen-bound
              journal, crafted to slow your pace and make space for what
              actually matters.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="px-7 sm:px-8 py-3.5 rounded-full bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 font-medium text-sm sm:text-base cursor-pointer hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors duration-200 w-full sm:w-auto"
              >
                Shop the Ritual Set
              </motion.button>
            </motion.div>
          </div>

          <div className="flex flex-col gap-3">
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.25 }}
              className="w-full rounded-2xl overflow-hidden"
              style={{ aspectRatio: "16/10" }}
            >
              <img
                src="https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=1200&h=750&fit=crop"
                alt="Morning ritual setup"
                className="w-full h-full object-cover"
              />
            </motion.div>

            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  src: "https://images.unsplash.com/photo-1602928321679-560bb453f190?w=400&h=400&fit=crop",
                  alt: "Hand-poured candle",
                },
                {
                  src: "https://images.unsplash.com/photo-1564890369478-c89ca6d9cde9?w=400&h=400&fit=crop",
                  alt: "Small-batch tea",
                },
                {
                  src: "https://images.unsplash.com/photo-1517971071642-34a2d3ecc9cd?w=400&h=400&fit=crop",
                  alt: "Linen-bound journal",
                },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.45 + i * 0.08 }}
                  whileHover={{ scale: 1.02 }}
                  className="rounded-xl overflow-hidden aspect-square cursor-pointer"
                >
                  <img
                    src={item.src}
                    alt={item.alt}
                    className="w-full h-full object-cover"
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero17;
