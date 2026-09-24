import React, { useState } from 'react';
import { X, Star, CheckCircle, Calendar, Clock, Video, MessageSquare, Award } from 'lucide-react';
import { Consultant } from '../types';

interface ConsultantModalProps {
  consultant: Consultant | null;
  onClose: () => void;
}

export const ConsultantModal: React.FC<ConsultantModalProps> = ({ consultant, onClose }) => {
  const [selectedDate, setSelectedDate] = useState<string>('2026-08-23');
  const [selectedTime, setSelectedTime] = useState<string>('14:00 BST');
  const [topic, setTopic] = useState<string>('Thesis Methodology & Literature Synthesis Audit');
  const [consultType, setConsultType] = useState<'video' | 'chat'>('video');
  const [isBooked, setIsBooked] = useState<boolean>(false);

  if (!consultant) return null;

  const timeSlots = ['10:00 BST', '12:30 BST', '14:00 BST', '16:30 BST', '19:00 BST'];

  const handleBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setIsBooked(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-[#000a1e]/60 backdrop-blur-md overflow-y-auto">
      <div className="bg-white rounded-[2rem] shadow-2xl border border-white/80 w-full max-w-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-[#000a1e] text-white p-6 sm:p-8 flex justify-between items-start relative">
          <div className="flex items-center gap-4">
            <img loading="lazy" decoding="async"
              src={consultant.image}
              alt={consultant.name}
              referrerPolicy="no-referrer"
              className="w-16 h-16 rounded-2xl object-cover border-2 border-[#fea520]"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold">{consultant.name}</h3>
                <span className="bg-[#fea520]/20 text-[#fea520] px-2 py-0.5 rounded text-[11px] font-bold">
                  {consultant.field}
                </span>
              </div>
              <p className="text-xs text-white/80 mt-0.5">{consultant.university}</p>
              <div className="flex items-center gap-2 mt-1 text-xs text-white/70">
                <span className="flex items-center gap-1 text-[#fea520]">
                  <Star className="w-3.5 h-3.5 fill-[#fea520]" /> {consultant.rating.toFixed(1)}/5
                </span>
                <span>•</span>
                <span>{consultant.ordersCompleted} Consultations</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8">
          {isBooked ? (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle className="w-9 h-9" />
              </div>
              <h4 className="text-2xl font-bold text-[#000a1e]">Consultation Confirmed!</h4>
              <p className="text-sm text-[#44474e] max-w-md mx-auto">
                A calendar invitation and a secure meeting link have been prepared for your session with {consultant.name}.
              </p>
              <div className="bg-[#eef4ff] p-4 rounded-xl text-xs text-[#002147] max-w-sm mx-auto space-y-1 text-left font-medium">
                <div><strong>Consultant:</strong> {consultant.name} ({consultant.field})</div>
                <div><strong>Scheduled Date:</strong> {selectedDate} at {selectedTime}</div>
                <div><strong>Format:</strong> {consultType === 'video' ? '1-on-1 HD Video Room' : 'Encrypted Real-Time Chat'}</div>
              </div>
              <button
                onClick={onClose}
                className="bg-[#000a1e] text-white px-6 py-2.5 rounded-xl font-bold text-xs hover:bg-[#002147] transition-all"
              >
                Close & Return
              </button>
            </div>
          ) : (
            <form onSubmit={handleBooking} className="space-y-5">
              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-bold text-[#44474e] uppercase mb-2">
                  Session Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setConsultType('video')}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${consultType === 'video'
                        ? 'bg-[#000a1e] text-white border-[#000a1e]'
                        : 'bg-[#eef4ff] text-[#44474e] border-[#d1e4ff]'
                      }`}
                  >
                    <Video className="w-4 h-4" /> 1-on-1 Live Video
                  </button>
                  <button
                    type="button"
                    onClick={() => setConsultType('chat')}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${consultType === 'chat'
                        ? 'bg-[#000a1e] text-white border-[#000a1e]'
                        : 'bg-[#eef4ff] text-[#44474e] border-[#d1e4ff]'
                      }`}
                  >
                    <MessageSquare className="w-4 h-4" /> Real-time Script Chat
                  </button>
                </div>
              </div>

              {/* Date & Time Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">
                    Select Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      value={selectedDate}
                      onChange={(e) => setSelectedDate(e.target.value)}
                      className="w-full bg-[#eef4ff] border border-[#d1e4ff] rounded-xl p-3 text-xs font-semibold text-[#000a1e]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">
                    Select Time Slot
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {timeSlots.slice(0, 3).map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setSelectedTime(slot)}
                        className={`p-2 rounded-lg text-[11px] font-bold border transition-all ${selectedTime === slot
                            ? 'bg-[#000a1e] text-white border-[#000a1e]'
                            : 'bg-[#eef4ff] text-[#44474e] border-[#d1e4ff]'
                          }`}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Consultation Topic */}
              <div>
                <label className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">
                  Focus Area / Paper Brief
                </label>
                <textarea
                  rows={3}
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full bg-[#eef4ff] border border-[#d1e4ff] rounded-xl p-3 text-xs text-[#000a1e] font-medium leading-relaxed"
                />
              </div>

              {/* Consultant Specialties */}
              <div>
                <label className="block text-xs font-bold text-[#44474e] uppercase mb-1.5">
                  Verified Specialties
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {consultant.specialties.map((spec, i) => (
                    <span key={i} className="px-2.5 py-1 bg-[#dbe9ff] text-[#002147] rounded-md text-[11px] font-semibold">
                      {spec}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-3 border-t border-[#d1e4ff] flex justify-between items-center">
                <div>
                  <span className="text-[11px] text-[#708ab5] block">Hourly Mentorship Rate</span>
                  <span className="text-xl font-bold text-[#000a1e]">£ {consultant.ratePerPage * 2} / hr</span>
                </div>
                <button
                  type="submit"
                  className="bg-[#000a1e] text-white hover:bg-[#002147] px-6 py-3 rounded-xl font-bold text-xs shadow-soft transition-all cursor-pointer"
                >
                  Confirm Consultation Slot
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
