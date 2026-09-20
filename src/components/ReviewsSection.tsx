import React from 'react';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, ArrowUp } from 'lucide-react';

export const ReviewsSection: React.FC = () => {

  const testimonials = [
    {
      text: "Instant Assignment Help is one of the best academic services which I have come across. The team associated with them is extremely supportive and",
      author: "Zoya",
      location: "UK",
      rating: 5
    },
    {
      text: "Searching for the best assignment writing service in the USA was my biggest concern. Then, one of my colleagues introduced me to Instant",
      author: "George Thomas",
      location: "San Francisco, USA",
      rating: 5
    },
    {
      text: "appreciation from my professor. Thanks a lot to the entire team! You guys whom I can trust for my assignments.",
      author: "Arlene Lloyd",
      location: "Liverpool, UK",
      rating: 5
    }
  ];

  return (
    <section className="py-20 bg-white relative">
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
          <button className="hidden sm:flex text-gray-500 hover:text-[#fea520] transition-colors p-2 shrink-0">
            <ChevronLeft className="w-8 h-8 font-light" strokeWidth={1} />
          </button>

          {/* Testimonial Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6 lg:gap-8 flex-1 max-w-[1100px] px-2 pt-6">
            {testimonials.map((review, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                className="bg-white border border-gray-100 rounded-[6px] shadow-[0_2px_15px_rgb(0,0,0,0.04)] px-6 lg:px-8 pb-8 pt-10 relative flex flex-col items-center text-center hover:shadow-[0_4px_20px_rgb(0,0,0,0.08)] transition-shadow"
              >
                {/* Pink Floating Quote Badge */}
                <div className="absolute -top-[1.2rem] left-1/2 -translate-x-1/2 bg-[#fea520] w-[2.4rem] h-[2.4rem] rounded-full flex items-center justify-center text-white shadow-sm border-[4px] border-white">
                  <span className="font-serif text-[2.5rem] leading-[0] translate-y-2.5">“</span>
                </div>

                {/* Text */}
                <p className="text-[13px] text-[#555] leading-relaxed mb-6 font-medium">
                  {review.text}
                </p>

                <div className="mt-auto flex flex-col items-center">
                  {/* Star Rating */}
                  <div className="flex gap-0.5 text-[#ff8c00] mb-3">
                    {[...Array(review.rating)].map((_, i) => (
                      <span key={i} className="text-[18px] leading-none">★</span>
                    ))}
                  </div>

                  {/* Author Info */}
                  <h4 className="font-bold text-[#2d2d2d] text-[13px] leading-tight">
                    {review.author}
                  </h4>
                  <p className="text-[11px] text-[#777] font-medium uppercase tracking-wide mt-1">
                    {review.location}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Right Chevron */}
          <button className="hidden sm:flex text-gray-500 hover:text-[#fea520] transition-colors p-2 shrink-0">
            <ChevronRight className="w-8 h-8 font-light" strokeWidth={1} />
          </button>

        </div>

      </div>

      {/* Floating Scroll To Top Button (Visual replication of the screenshot bottom-right UI) */}
      <div className="absolute right-4 bottom-4 md:right-8 lg:right-10 flex items-center justify-center w-10 h-10 bg-gray-500/80 hover:bg-gray-600 rounded-full text-white cursor-pointer transition-colors shadow-sm z-50">
        <ArrowUp className="w-5 h-5 pointer-events-none" strokeWidth={2.5} />
      </div>

    </section>
  );
};
