import React from 'react';
import { Package, Handshake, Star, GraduationCap } from 'lucide-react';

export const StatsBar: React.FC = () => {
  const stats = [
    {
      value: '182532+',
      label: 'DELIVERED ORDERS',
      icon: <Package className="w-9 h-9 text-[#d53867]" strokeWidth={1.5} />
    },
    {
      value: '60000+',
      label: 'HAPPY CLIENTS',
      icon: <Handshake className="w-9 h-9 text-[#d53867]" strokeWidth={1.5} />
    },
    {
      value: '4.8/5',
      label: 'CLIENT RATING',
      icon: <Star className="w-9 h-9 text-[#d53867] fill-yellow-400 stroke-[#d53867]" strokeWidth={1.5} />
    },
    {
      value: '4500+',
      label: 'PH.D. EXPERTS',
      icon: <GraduationCap className="w-9 h-9 text-[#d53867]" strokeWidth={1.5} />
    },
  ];

  return (
    <section className="py-16 md:py-20 bg-[#fff5f7] relative overflow-hidden">

      {/* Abstract background elements */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-white rounded-full blur-[80px] -translate-x-1/2 -translate-y-1/2"></div>

      {/* Dotted pattern absolute element on top right */}
      <div className="absolute top-10 right-10 opacity-10">
        <div className="w-32 h-24" style={{ backgroundImage: 'radial-gradient(#d53867 2px, transparent 2px)', backgroundSize: '12px 12px' }}></div>
      </div>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 relative z-10 w-full flex flex-col items-center">

        {/* Title */}
        <h2 className="text-[26px] md:text-[34px] font-bold text-[#2d2d2d] mb-3 text-center tracking-tight">
          These Numbers Speaks of Our Success Story
        </h2>

        {/* Decorative Divider */}
        <div className="relative w-64 h-[1px] bg-[#d53867]/30 flex justify-center mb-14">
          <div className="absolute top-1/2 -translate-y-1/2 w-10 h-1 bg-[#d53867]"></div>
        </div>

        {/* Stats Grid */}
        <div className="w-full flex flex-wrap lg:flex-nowrap justify-center gap-y-10 lg:gap-6 xl:gap-8 gap-x-6 xl:gap-x-10 px-4 md:px-8 pl-8 lg:pl-12 pt-4">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="bg-white rounded-r-[15px] rounded-br-[35px] shadow-[0_8px_25px_rgba(0,0,0,0.06)] relative flex items-center justify-center flex-col pt-6 pb-6 pl-10 pr-6 min-w-[200px] w-full max-w-[260px] lg:flex-1 lg:max-w-none border border-white"
            >

              {/* Overlapping Circle Badge */}
              <div className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-white rounded-full flex items-center justify-center border-4 border-[#fff5f7] shadow-[0_5px_15px_rgba(0,0,0,0.05)]">
                {stat.icon}
              </div>

              {/* Data Content */}
              <div className="flex flex-col items-center justify-center w-full min-h-[60px]">
                <span className="text-[26px] lg:text-[28px] xl:text-[32px] font-black text-[#d53867] leading-none mb-1 text-center">
                  {stat.value}
                </span>
                <span className="text-[11px] lg:text-[12px] font-bold text-[#333] uppercase tracking-wider text-center mt-1">
                  {stat.label}
                </span>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
