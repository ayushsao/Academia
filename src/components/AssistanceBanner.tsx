import React from 'react';

interface AssistanceBannerProps {
    onOpenOrder: () => void;
}

export const AssistanceBanner: React.FC<AssistanceBannerProps> = ({ onOpenOrder }) => {
    const [phoneString, setPhoneString] = React.useState('');

    const handleChatClick = () => {
        let text = "Hello AssignmentMinds, I need some free assistance!";
        if (phoneString) {
            text = `Hello AssignmentMinds, I need some free assistance! You can reach me at: ${phoneString}`;
        }
        window.open(`https://wa.me/919263606941?text=${encodeURIComponent(text)}`, '_blank');
    };

    return (
        <section className="bg-white py-14 border-t border-gray-100">
            <div className="max-w-[1280px] mx-auto px-4 md:px-6">

                {/* Section Heading */}
                <div className="text-center mb-10 max-w-[1000px] mx-auto">
                    <h2 className="text-2xl md:text-3xl font-bold text-[#111] mb-5 tracking-tight relative inline-block">
                        Why AssignmentMinds Services?
                        {/* Perfect underline match to screenshot */}
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-[160%] h-[1px] bg-gray-300">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-1 bg-[#fea520]"></div>
                        </div>
                    </h2>
                    <p className="text-[#555] text-[14px] mt-6 leading-relaxed px-4 md:px-0">
                        Every student of any academic level dreams of scoring high grades in class and making an impression in front of their professor, but hardly any get that chance. This is when AssignmentMinds comes into the picture and aids students in scoring their dream grades through the best assignment writing service UK. The experienc...<button onClick={onOpenOrder} className="text-[#fea520] font-medium hover:underline ml-1">Know more</button>
                    </p>
                </div>

                {/* Dual Cards Row */}
                <div className="flex flex-col lg:flex-row gap-6 items-stretch pt-8">

                    {/* Left Card: Get Free Assistance */}
                    <div className="flex-[2] bg-gradient-to-r from-[#ffe4e9] via-[#ffceda] to-[#ffb6c7] rounded-[20px] relative flex flex-col sm:flex-row items-center border border-white/50 min-h-[200px] shadow-sm overflow-visible">

                        {/* Abstract circle in background */}
                        <div className="absolute top-0 right-10 w-64 h-64 bg-white/40 rounded-full blur-3xl pointer-events-none"></div>

                        {/* Image placeholder */}
                        <div className="w-[80%] sm:w-[260px] h-[280px] relative flex-shrink-0 -mt-16 self-end sm:self-auto sm:-mt-[90px] sm:ml-4 z-10 transition-transform hover:scale-105 duration-500">
                            <img loading="lazy" decoding="async"
                                src="https://images.pexels.com/photos/8372628/pexels-photo-8372628.jpeg?auto=compress&cs=tinysrgb&w=800"
                                alt="Student with phone"
                                className="w-full h-full object-cover object-top object-[center_10%] drop-shadow-2xl translate-y-3"
                                style={{ maskImage: 'linear-gradient(to top, transparent, black 12%)', WebkitMaskImage: 'linear-gradient(to top, transparent, black 12%)' }}
                            />
                        </div>

                        {/* Content */}
                        <div className="flex-1 py-10 px-6 sm:pr-8 relative z-20 text-center sm:text-left flex flex-col justify-center w-full lg:-ml-6">
                            <h3 className="text-3xl md:text-[40px] font-bold text-[#3a3a3a] mb-2 leading-tight tracking-tight">Get Free Assistance</h3>
                            <p className="text-xl md:text-[22px] text-[#444] mb-8 font-medium">and save time!</p>

                            <div className="flex flex-col sm:flex-row items-center gap-6 w-full max-w-lg mx-auto sm:mx-0">
                                {/* Transparent bottom-border form */}
                                <div className="flex-1 border-b border-[#333]/30 flex items-center pb-2 w-full">
                                    <div className="flex items-center gap-2 pr-4 border-r border-[#333]/30 mr-4 whitespace-nowrap cursor-pointer">
                                        <svg className="w-5 h-5 text-[#333]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" strokeWidth="2" /><path d="M12 18h.01" strokeWidth="2" strokeLinecap="round" /></svg>
                                        <span className="font-bold text-[14.5px] text-[#222]">Country <span className="text-[10px]">▼</span></span>
                                    </div>
                                    <input
                                        type="text"
                                        placeholder="WhatsApp Number Only"
                                        value={phoneString}
                                        onChange={(e) => setPhoneString(e.target.value)}
                                        className="w-full py-1 text-[14.5px] outline-none bg-transparent placeholder-gray-600 text-[#222]"
                                    />
                                </div>

                                {/* Green Button with white border */}
                                <button onClick={handleChatClick} className="bg-[#4cdf5b] hover:bg-[#3ec34d] text-white font-bold px-7 py-3 rounded-[12px] border-[4px] border-white flex items-center justify-center gap-2 transition-transform hover:-translate-y-1 shadow-md whitespace-nowrap">
                                    <svg className="w-5 h-5 fill-white" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.888-.788-1.488-1.761-1.665-2.059-.177-.298-.018-.46.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" /></svg>
                                    Chat Now
                                </button>
                            </div>
                            <p className="text-[13px] text-[#555] mt-6 font-medium">*Our experts are happy to help you anytime</p>
                        </div>
                    </div>

                    {/* Right Card: 25% OFF Deal */}
                    <div className="w-full lg:w-[350px] bg-gradient-to-b from-[#ffedf0] to-[#ffb6c7] rounded-[20px] p-8 md:p-10 relative overflow-hidden text-center flex flex-col justify-center border border-white/50 shadow-sm">

                        {/* Hanging Bulb SVG graphic in top right */}
                        <div className="absolute top-0 right-4 opacity-100 hover:scale-105 transition-transform origin-top">
                            <svg width="60" height="90" viewBox="0 0 100 150" fill="none">
                                <path d="M50 0 V60" stroke="#444" strokeWidth="2" />
                                <path d="M35 60 Q50 40 65 60 Q75 90 50 110 Q25 90 35 60 Z" fill="#333" />
                                {/* Light glow lines */}
                                <path d="M10 75 h10 M80 75 h10 M20 50 l8 8 M80 50 l-8 8" stroke="#ffb644" strokeWidth="3" strokeLinecap="round" />
                                <circle cx="50" cy="80" r="14" fill="#ffb644" />
                            </svg>
                        </div>

                        <div className="relative z-10 w-full h-full flex flex-col justify-center items-start text-left mt-2">
                            <span className="text-[#333] text-[17px] font-medium mb-1 tracking-wide">Extra</span>
                            <h3 className="text-[52px] md:text-[64px] font-black text-[#e83e58] leading-none mb-3 tracking-tighter">
                                25% <span className="text-[32px] md:text-[40px] font-bold">OFF</span>
                            </h3>
                            <p className="text-[#2d2d2d] text-[17px] font-medium mb-8">On Your First Purchase!</p>

                            <button onClick={onOpenOrder} className="bg-[#ffcb05] hover:bg-[#ffb600] text-[#000a1e] font-bold py-3.5 px-6 rounded-[12px] w-full text-[17px] shadow-sm hover:shadow-md transition-all">
                                Get Deal
                            </button>
                        </div>

                    </div>

                </div>
            </div>
        </section>
    );
};
