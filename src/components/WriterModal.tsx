import React from 'react';
import { X, CheckCircle, Star, Target, BookOpen, Award } from 'lucide-react';

export interface WriterData {
    name: string;
    deg: string;
    img: string;
    rating: string;
    completed: number;
    experience: string;
    about: string;
    subjects: string[];
}

interface WriterModalProps {
    writer: WriterData | null;
    isOpen: boolean;
    onClose: () => void;
    onHire: () => void;
}

export const WriterModal: React.FC<WriterModalProps> = ({ writer, isOpen, onClose, onHire }) => {
    if (!isOpen || !writer) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>

            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200">

                {/* Header Background */}
                <div className="h-32 bg-gradient-to-r from-[#000a1e] to-[#002147] relative">
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 text-white/50 hover:text-white bg-black/20 hover:bg-black/40 p-2 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Profile Content */}
                <div className="px-8 pb-8">
                    <div className="flex flex-col sm:flex-row gap-6 relative -mt-16 mb-6">
                        <div className="relative">
                            <img
                                src={`https://i.pravatar.cc/150?img=${writer.img}`}
                                alt={writer.name}
                                className="w-32 h-32 rounded-2xl border-4 border-white shadow-xl bg-gray-100 object-cover"
                            />
                            <div className="absolute -bottom-2 -right-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-1 rounded-lg border-2 border-white shadow-md flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> ONLINE
                            </div>
                        </div>

                        <div className="pt-16 sm:pt-20 flex-1">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-black text-[#000a1e] leading-tight">{writer.name}</h2>
                                    <p className="text-[#fea520] font-bold text-sm tracking-wide">{writer.deg}</p>
                                </div>
                                <div className="bg-[#fff9f0] px-3 py-1.5 rounded-lg border border-[#fea520]/20 flex items-center gap-1.5">
                                    <Star className="w-4 h-4 fill-[#fea520] text-[#fea520]" />
                                    <span className="font-extrabold text-[#000a1e]">{writer.rating}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-8">
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                            <div className="text-emerald-600 mb-1 flex justify-center"><CheckCircle className="w-6 h-6" /></div>
                            <p className="text-xl font-black text-[#000a1e]">{writer.completed}</p>
                            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Orders Completed</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                            <div className="text-blue-600 mb-1 flex justify-center"><Award className="w-6 h-6" /></div>
                            <p className="text-xl font-black text-[#000a1e]">{writer.experience}</p>
                            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Experience</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 shadow-sm text-center">
                            <div className="text-purple-600 mb-1 flex justify-center"><Target className="w-6 h-6" /></div>
                            <p className="text-xl font-black text-[#000a1e]">100%</p>
                            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Success Rate</p>
                        </div>
                    </div>

                    <div>
                        <h3 className="font-bold text-[#000a1e] flex items-center gap-2 mb-2">
                            <BookOpen className="w-5 h-5 text-gray-400" /> About Writer
                        </h3>
                        <p className="text-gray-600 text-sm leading-relaxed mb-6">
                            {writer.about}
                        </p>

                        <h3 className="font-bold text-[#000a1e] mb-3">Top Subjects</h3>
                        <div className="flex flex-wrap gap-2 mb-8">
                            {writer.subjects.map(sub => (
                                <span key={sub} className="bg-gray-100 text-gray-700 text-xs font-bold px-3 py-1.5 rounded-full">
                                    {sub}
                                </span>
                            ))}
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            onClose();
                            onHire();
                        }}
                        className="w-full bg-[#fea520] hover:bg-[#e36100] text-[#000a1e] font-black text-lg py-4 rounded-xl shadow-lg transition-transform hover:scale-[1.02] flex items-center justify-center gap-2"
                    >
                        Hire {writer.name.split(' ')[0]} Now
                    </button>
                </div>
            </div>
        </div>
    );
};
