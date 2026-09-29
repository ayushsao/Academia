import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ChevronRight, ChevronLeft, ArrowUp, Star } from 'lucide-react';
import { REVIEWS } from '../data/mockData';

// Three reviews at a time from the same list as the /reviews page; the arrows page through them.
const PER_PAGE = 3;
const short = (text: string, max = 220) => (text.length > max ? `${text.slice(0, text.lastIndexOf(' ', max))}…` : text);

export const ReviewsSection: React.FC = () => {
  const pages = Math.max(1, Math.ceil(REVIEWS.length / PER_PAGE));
  const [page, setPage] = useState(0);
  const shown = REVIEWS.slice(page * PER_PAGE, page * PER_PAGE + PER_PAGE);
  const go = (step: number) => setPage(p => (p + step + pages) % pages);

  return (
    <section className="py-20 section-tint relative">
      <div className="max-w-[1250px] mx-auto px-4 relative">

        {/* Header */}
        <div className="text-center mb-16 flex flex-col items-center">
          <h2 className="text-[26px] md:text-[34px] font-bold text-[#2d2d2d] mb-4 tracking-tight">
            Student Testimonials
          </h2>

          <p className="max-w-3xl mx-auto text-[#666] text-[13px] md:text-[14px]">
            Find out what students from{' '}
            <span className="relative inline-block">
              all over the globe say
              <span className="absolute -bottom-1.5 left-0 w-full h-[1.5px] bg-[#fea520]"></span>
            </span>
            {' '}about our online academic writing services.
          </p>
        </div>

        {/* Carousel Container */}
        <div className="flex items-center justify-between xl:justify-center xl:gap-8">

          {/* Left Chevron */}
          <button type="button" onClick={() => go(-1)} aria-label="Previous reviews" className="hidden sm:flex text-gray-500 hover:text-[#fea520] transition-colors p-2 shrink-0">
            <ChevronLeft className="w-8 h-8 font-light" strokeWidth={1} />
          </button>

          {/* Testimonial Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 lg:gap-8 flex-1 max-w-[1100px] px-2 pt-6">
            {shown.map((review, idx) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="bg-white border border-gray-100 rounded-[6px] shadow-[0_2px_15px_rgb(0,0,0,0.04)] px-6 lg:px-8 pb-8 pt-10 relative flex flex-col items-center text-center hover:shadow-[0_4px_20px_rgb(0,0,0,0.08)] transition-shadow"
              >
                {/* Floating Quote Badge */}
                <div className="absolute -top-[1.2rem] left-1/2 -translate-x-1/2 bg-[#fea520] w-[2.4rem] h-[2.4rem] rounded-full flex items-center justify-center text-white shadow-sm border-[4px] border-white">
                  <span className="font-serif text-[2.5rem] leading-[0] translate-y-2.5">“</span>
                </div>

                {/* Text */}
                <p className="text-[13px] text-[#555] leading-relaxed mb-6 font-medium">
                  {short(review.text)}
                </p>

                <div className="mt-auto flex flex-col items-center">
                  {/* Star Rating */}
                  <div className="flex gap-0.5 text-[#ff8c00] mb-3" aria-label={`${review.rating} out of 5`}>
                    {[...Array(review.rating)].map((_, i) => (
                      <Star key={i} className="w-[18px] h-[18px]" fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
                    ))}
                  </div>

                  {/* Author Info */}
                  <h4 className="font-bold text-[#2d2d2d] text-[13px] leading-tight">
                    {review.author}
                  </h4>
                  {review.location && (
                    <p className="text-[11px] text-[#777] font-medium uppercase tracking-wide mt-1">
                      {review.location}
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right Chevron */}
          <button type="button" onClick={() => go(1)} aria-label="Next reviews" className="hidden sm:flex text-gray-500 hover:text-[#fea520] transition-colors p-2 shrink-0">
            <ChevronRight className="w-8 h-8 font-light" strokeWidth={1} />
          </button>

        </div>

        {/* Mobile arrows + link to all reviews */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button type="button" onClick={() => go(-1)} aria-label="Previous reviews" className="sm:hidden rounded-full border border-gray-300 p-2 text-gray-600"><ChevronLeft className="w-5 h-5" /></button>
          <span className="text-xs font-semibold text-gray-500">{page + 1} / {pages}</span>
          <button type="button" onClick={() => go(1)} aria-label="Next reviews" className="sm:hidden rounded-full border border-gray-300 p-2 text-gray-600"><ChevronRight className="w-5 h-5" /></button>
          <Link to="/reviews" className="text-[13px] font-bold text-[#e36100] hover:underline">Read all reviews →</Link>
        </div>

      </div>

      {/* Scroll to top */}
      <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Back to top"
        className="absolute right-4 bottom-4 md:right-8 lg:right-10 flex items-center justify-center w-10 h-10 bg-gray-500/80 hover:bg-gray-600 rounded-full text-white transition-colors shadow-sm z-50">
        <ArrowUp className="w-5 h-5 pointer-events-none" strokeWidth={2.5} />
      </button>

    </section>
  );
};
