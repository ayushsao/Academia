import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Consultant } from '../types';

interface ConsultantsSectionProps {
  onConsult: (consultant: Consultant) => void;
}

const WRITERS = [
  {
    id: 1,
    name: 'Olivia Power',
    image: 'https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=150',
    bio: 'I am Olivia Power, and I always wanted to make my career in teaching. Also, I always...',
    rating: 4,
    orders: '789+',
  },
  {
    id: 2,
    name: 'Joe Roberts',
    image: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150',
    bio: 'I have always loved programming, which is why I graduated in database management. I...',
    rating: 3,
    orders: '650+',
  },
  {
    id: 3,
    name: 'Emma Nelson',
    image: 'https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150',
    bio: 'I am Emma, and I graduated from a well-known university in the UK in Database...',
    rating: 5,
    orders: '890+',
  },
  {
    id: 4,
    name: 'Sarah Connor',
    image: 'https://images.pexels.com/photos/1130626/pexels-photo-1130626.jpeg?auto=compress&cs=tinysrgb&w=150',
    bio: 'I have a strong background in artificial intelligence and machine learning. I enjoy...',
    rating: 5,
    orders: '1205+',
  },
  {
    id: 5,
    name: 'David Smith',
    image: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150',
    bio: 'Specializing in historical research and literature, I help students craft compelling essays...',
    rating: 4,
    orders: '530+',
  }
];

export const ConsultantsSection: React.FC<ConsultantsSectionProps> = ({ onConsult }) => {
  const [currentIndex, setCurrentIndex] = useState(1);

  // Custom Next/Prev Logic for Circular Array behavior mapped to visual placement
  const nextSlide = () => {
    setCurrentIndex((prev) => (prev + 1) % WRITERS.length);
  };

  const prevSlide = () => {
    setCurrentIndex((prev) => (prev - 1 + WRITERS.length) % WRITERS.length);
  };

  useEffect(() => {
    const timer = setInterval(() => {
      nextSlide();
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  // Determine the correctly ordered array for rendering the 3 visible slides
  const getVisibleWriters = () => {
    const leftIndex = (currentIndex - 1 + WRITERS.length) % WRITERS.length;
    const centerIndex = currentIndex;
    const rightIndex = (currentIndex + 1) % WRITERS.length;

    return [
      { ...WRITERS[leftIndex], position: 'left' },
      { ...WRITERS[centerIndex], position: 'center' },
      { ...WRITERS[rightIndex], position: 'right' }
    ];
  };

  const visibleCards = getVisibleWriters();

  return (
    <section className="py-20 bg-white relative overflow-hidden text-center z-10">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 relative flex flex-col items-center">

        {/* Title */}
        <h2 className="text-[26px] md:text-[34px] font-bold text-[#2d2d2d] mb-4 text-center tracking-tight">
          Choose from the Most Qualified Academic Writers!
        </h2>

        {/* Decorative Divider */}
        <div className="relative w-72 h-[1px] bg-[#fea520]/30 flex justify-center mb-16">
          <div className="absolute top-1/2 -translate-y-1/2 w-12 h-1 bg-[#fea520]"></div>
        </div>

        {/* Carousel Container */}
        <div className="relative w-full max-w-[1100px] flex items-center justify-center min-h-[380px]">

          {/* Left Arrow Button */}
          <button
            onClick={prevSlide}
            className="absolute left-0 md:-left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#fea520] hover:bg-[#b02b52] rounded-full flex items-center justify-center text-white z-30 shadow-md transition-colors"
          >
            <ChevronLeft className="w-6 h-6 ml-0.5" />
          </button>

          {/* Cards Viewport */}
          <div className="flex items-center justify-center w-full gap-4 md:gap-8 px-12 perspective-1000 py-6 overflow-hidden">
            {visibleCards.map((writer, idx) => {
              const isCenter = writer.position === 'center';
              return (
                <div
                  key={`${writer.id}-${idx}`}
                  className={`transition-all duration-500 ease-in-out transform flex-shrink-0 bg-white rounded-xl shadow-[0_10px_35px_rgba(0,0,0,0.06)] border border-white p-6 flex flex-col w-[280px] md:w-[310px] ${isCenter ? 'scale-110 z-20 shadow-lg flex' : 'scale-95 z-10 opacity-70 hover:opacity-100 hidden md:flex'}`}
                >
                  {/* Header: Image & Name */}
                  <div className="flex items-center gap-4 mb-4 text-left">
                    <img loading="lazy" decoding="async"
                      src={writer.image}
                      alt={writer.name}
                      className="w-14 h-14 rounded-full object-cover shadow-sm border border-gray-100"
                    />
                    <div>
                      <h4 className="font-semibold text-[#fea520] text-[17px] mb-1">{writer.name}</h4>
                      <div className="flex items-center gap-1 bg-[#e4fae9] text-[#2ebd59] px-2.5 py-0.5 rounded-full text-xs font-bold w-max">
                        <Check className="w-3 h-3" />
                        Verified
                      </div>
                    </div>
                  </div>

                  {/* Bio */}
                  <p className="text-[13px] text-[#555] leading-relaxed text-left h-[60px] line-clamp-3 mb-4">
                    {writer.bio}
                  </p>

                  {/* Stats Box */}
                  <div className="bg-[#f8f9fa] rounded-lg p-3 flex justify-between items-center mb-5 w-full">
                    <div className="text-left">
                      <div className="flex mb-1">
                        {[...Array(5)].map((_, i) => (
                          <svg key={i} className={`w-4 h-4 ${i < writer.rating ? 'text-[#ffcb05]' : 'text-gray-300'}`} fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                      </div>
                      <span className="text-[11px] text-gray-500 font-medium">{writer.rating} Star Rating</span>
                    </div>
                    <div className="text-right flex flex-col items-end">
                      <div className="flex items-center gap-1 text-[#fea520] font-bold text-sm mb-0.5">
                        {/* Book Icon Match */}
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4v16a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2H6a2 2 0 00-2 2zm14 0v16H8V4h10z" /><path d="M10 6h6v2h-6zM10 10h6v2h-6zM10 14h6v2h-6zM6 4h1v16H6z" /></svg>
                        {writer.orders}
                      </div>
                      <span className="text-[11px] text-gray-500 font-medium">Order Completed</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2 mt-auto">
                    <button onClick={() => onConsult({ id: writer.id.toString(), name: writer.name, field: 'Academic Writer', university: '', rating: writer.rating, ordersCompleted: parseInt(writer.orders), bio: writer.bio, degrees: [], status: 'Available', image: writer.image })} className="flex-1 border border-gray-200 text-[#444] text-[13px] font-semibold py-2 rounded-md hover:bg-gray-50 transition-colors">
                      About Writer
                    </button>
                    <button onClick={() => onConsult({ id: writer.id.toString(), name: writer.name, field: 'Academic Writer', university: '', rating: writer.rating, ordersCompleted: parseInt(writer.orders), bio: writer.bio, degrees: [], status: 'Available', image: writer.image })} className="flex-1 bg-[#ffcb05] hover:bg-[#ffb600] text-[#000a1e] text-[13px] font-bold py-2 rounded-md transition-colors">
                      Hire Writer
                    </button>
                  </div>

                </div>
              );
            })}
          </div>

          {/* Right Arrow Button */}
          <button
            onClick={nextSlide}
            className="absolute right-0 md:-right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-[#fea520] hover:bg-[#b02b52] rounded-full flex items-center justify-center text-white z-30 shadow-md transition-colors"
          >
            <ChevronRight className="w-6 h-6 mr-0.5" />
          </button>

        </div>
      </div>
    </section>
  );
};
