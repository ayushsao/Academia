import React from 'react';
import { BookOpen, Star, GraduationCap } from 'lucide-react';
import { motion } from 'framer-motion';

interface CtaBannerProps {
    onOrderClick: () => void;
}

export const CtaBanner: React.FC<CtaBannerProps> = ({ onOrderClick }) => {

    // Generic avatar placeholder links (mix of students from Unsplash/Pexels)
    const avatars = [
        { src: "https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?auto=compress&cs=tinysrgb&w=150", size: "w-16 h-16", top: "15%", left: "8%" },
        { src: "https://images.pexels.com/photos/774909/pexels-photo-774909.jpeg?auto=compress&cs=tinysrgb&w=150", size: "w-10 h-10", top: "50%", left: "15%" },
        { src: "https://images.pexels.com/photos/1222271/pexels-photo-1222271.jpeg?auto=compress&cs=tinysrgb&w=150", size: "w-12 h-12", top: "20%", left: "20%" },
        { src: "https://images.pexels.com/photos/91227/pexels-photo-91227.jpeg?auto=compress&cs=tinysrgb&w=150", size: "w-20 h-20", top: "60%", left: "10%" },
        { src: "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=150", size: "w-14 h-14", top: "25%", right: "8%" },
        { src: "https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?auto=compress&cs=tinysrgb&w=150", size: "w-12 h-12", top: "70%", right: "12%" },
        { src: "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=150", size: "w-16 h-16", top: "55%", right: "20%" },
        { src: "https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=150", size: "w-[4.5rem] h-[4.5rem]", top: "15%", right: "16%" },
    ];

    return (
        <section className="w-full bg-white relative py-12 md:py-16 overflow-hidden flex flex-col items-center justify-center">

            {/* Center Content */}
            <div className="relative z-20 text-center px-4 flex flex-col items-center justify-center min-h-[160px]">
                <h2 className="text-[26px] md:text-[34px] font-extrabold text-[#1a1a2e] leading-snug tracking-tight mb-5">
                    Unlock our Cheap Assignment Help <br />to get high scores
                </h2>

                <button
                    onClick={onOrderClick}
                    className="btn-am-primary"
                >
                    GET HELP NOW
                </button>
            </div>

            {/* Left Desktop Floating Elements */}
            <div className="hidden lg:block absolute inset-0 pointer-events-none z-10 w-1/2 left-0">
                {avatars.slice(0, 4).map((av, idx) => (
                    <motion.img
                        key={`l-${idx}`}
                        initial={{ opacity: 0, scale: 0.5 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: idx * 0.1, type: "spring" }}
                        src={av.src}
                        className={`absolute object-cover rounded-full shadow-md border-2 border-white/60 ${av.size}`}
                        style={{ top: av.top, left: av.left }}
                        alt="Student"
                    />
                ))}

                {/* Decorative floating widgets (cap, star) */}
                <motion.div
                    animate={{ y: [0, -10, 0] }} transition={{ repeat: Infinity, duration: 4 }}
                    className="absolute top-[30%] left-[26%] bg-white w-10 h-10 rounded-full flex items-center justify-center shadow-sm"
                >
                    <Star className="w-5 h-5 text-[#ffcb05]" fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
                </motion.div>

                <motion.div
                    animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 3.5, delay: 1 }}
                    className="absolute bottom-[20%] left-[5%] text-[#6272a4] opacity-70 w-12 h-12"
                >
                    <GraduationCap className="w-full h-full" strokeWidth={1.75} aria-hidden="true" />
                </motion.div>
            </div>

            {/* Right Desktop Floating Elements */}
            <div className="hidden lg:block absolute inset-0 pointer-events-none z-10 w-1/2 left-1/2">
                {avatars.slice(4).map((av, idx) => (
                    <motion.img
                        key={`r-${idx}`}
                        initial={{ opacity: 0, scale: 0.5 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ delay: (idx + 4) * 0.1, type: "spring" }}
                        src={av.src}
                        className={`absolute object-cover rounded-full shadow-md border-2 border-white/60 ${av.size}`}
                        style={{ top: av.top, right: av.right }}
                        alt="Student"
                    />
                ))}

                {/* Decorative floating widgets (book, star) */}
                <motion.div
                    animate={{ y: [0, -8, 0] }} transition={{ repeat: Infinity, duration: 4.5, delay: 0.5 }}
                    className="absolute bottom-[40%] right-[25%] bg-white w-9 h-9 rounded-full flex items-center justify-center shadow-sm"
                >
                    <BookOpen className="w-4 h-4 text-[#002147]" />
                </motion.div>
            </div>

        </section>
    );
};

