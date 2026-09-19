import React from 'react';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';

export const BlogGrid: React.FC = () => {

    // Abstract images from Pexels that fit the topic themes (business, tech, studying)
    const featuredImg = "https://images.pexels.com/photos/590016/pexels-photo-590016.jpeg?auto=compress&cs=tinysrgb&w=800";
    const smallCards = [
        {
            title: "50+ Commercial Law Dissertation Topics for 2026",
            img: "https://images.pexels.com/photos/5668772/pexels-photo-5668772.jpeg?auto=compress&cs=tinysrgb&w=600"
        },
        {
            title: "150+ Data Science Dissertation Topics for 2026",
            img: "https://images.pexels.com/photos/540518/pexels-photo-540518.jpeg?auto=compress&cs=tinysrgb&w=600"
        },
        {
            title: "Kotter's Change Model: Complete 8-Step Process with Case Study",
            img: "https://images.pexels.com/photos/7414284/pexels-photo-7414284.jpeg?auto=compress&cs=tinysrgb&w=600"
        },
        {
            title: "Rolfe Reflective Model: Complete Guide with Examples",
            img: "https://images.pexels.com/photos/6238050/pexels-photo-6238050.jpeg?auto=compress&cs=tinysrgb&w=600"
        }
    ];

    return (
        <section className="py-20 md:py-24 bg-white relative">
            <div className="max-w-[1250px] mx-auto px-4 relative z-10">

                {/* Header */}
                <div className="text-center mb-12 flex flex-col items-center">
                    <h2 className="text-[26px] md:text-[34px] font-bold text-[#2d2d2d] mb-3 tracking-tight">
                        Latest Blog
                    </h2>

                    <p className="max-w-3xl mx-auto text-[#666] text-[13px] md:text-[14px]">
                        By High Quality Assignment experts on university, academics, admission, assignment, <br className="hidden md:block" />
                        <span className="relative inline-block mt-1">
                            writing skills & tips, and many more
                            <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-[140px] h-[2px] bg-[#d53867]"></span>
                        </span>
                    </p>
                </div>

                {/* Grid Container */}
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">

                    {/* Featured Left Card */}
                    <div className="flex-1 w-full flex">
                        <motion.div
                            initial={{ opacity: 0, y: 15 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            className="bg-white border border-gray-100 rounded-lg shadow-[0_4px_20px_rgb(0,0,0,0.06)] p-3 md:p-4 w-full flex flex-col group cursor-pointer hover:shadow-md transition-shadow"
                        >
                            {/* Image container mimicking banner */}
                            <div className="w-full h-[250px] md:h-[300px] border border-gray-100 rounded-md overflow-hidden relative mb-5">
                                <img
                                    src={featuredImg}
                                    alt="ABM Research Topics"
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 origin-center"
                                />
                                {/* Emulated Infographic Text Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-r from-[#ffe0e6]/90 to-transparent flex flex-col justify-center p-6">
                                    <div className="w-12 h-12 bg-[#ffcc99] rounded-full flex items-center justify-center font-black text-xl mb-4">175+</div>
                                    <h3 className="text-2xl font-black text-[#a63a2c] bg-white w-fit px-2 py-0.5 rounded-sm">ABM Research Topics</h3>
                                    <h4 className="text-lg font-bold text-[#333] mt-1 bg-white/70 w-fit px-1">for Academic Success</h4>
                                </div>
                            </div>

                            <div className="px-2 flex-grow flex flex-col">
                                <div className="text-[12px] text-gray-500 font-semibold mb-3">
                                    17 Aug 2026 &nbsp;&bull;&nbsp; 23 minutes read &nbsp;&bull;&nbsp; 35629 Views
                                </div>
                                <h3 className="text-xl md:text-[22px] font-bold text-[#2d2d2d] mb-4 leading-snug group-hover:text-[#d53867] transition-colors">
                                    175+ Trending ABM Research Topics For Students
                                </h3>
                                <p className="text-[#555] text-[13.5px] leading-relaxed mb-6">
                                    To create an impact in your field of study, here are 175+ABM research topics for your next paper.
                                </p>

                                <div className="mt-auto flex justify-end pb-2">
                                    <button className="text-[#d53867] font-semibold text-[13px] flex items-center gap-1.5 hover:underline">
                                        Read More <ArrowUpRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right 2x2 Small Cards */}
                    <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                        {smallCards.map((card, idx) => (
                            <motion.div
                                key={idx}
                                initial={{ opacity: 0, scale: 0.96 }}
                                whileInView={{ opacity: 1, scale: 1 }}
                                viewport={{ once: true }}
                                transition={{ delay: 0.1 * idx }}
                                className="bg-white border border-gray-100 rounded-lg shadow-[0_4px_16px_rgb(0,0,0,0.05)] p-3 flex flex-col cursor-pointer group hover:shadow-md transition-all"
                            >
                                <div className="w-full h-[140px] md:h-[160px] overflow-hidden rounded-md mb-3 relative border border-gray-100">
                                    <img
                                        src={card.img}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                                        alt={card.title}
                                    />
                                </div>
                                <div className="px-2 pb-2">
                                    <h4 className="font-bold text-[#2d2d2d] text-[14px] leading-tight line-clamp-3 group-hover:text-[#d53867] transition-colors">
                                        {card.title}
                                    </h4>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                </div>

                {/* Bottom View More Button */}
                <div className="mt-14 flex justify-center">
                    <button className="bg-[#ffcb05] hover:bg-[#eebc04] text-[#2d2d2d] font-bold text-[14.5px] px-8 py-2.5 rounded shadow-sm transition-colors cursor-pointer">
                        View More Blogs
                    </button>
                </div>

            </div>
        </section>
    );
};
