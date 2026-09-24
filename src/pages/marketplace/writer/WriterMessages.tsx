import React from 'react';
import { MessageSquare } from 'lucide-react';

export default function WriterMessages() {
    return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mb-6 text-blue-500">
                <MessageSquare className="w-12 h-12" />
            </div>
            <h2 className="text-3xl font-extrabold text-[#002147] mb-2">Messages</h2>
            <p className="text-gray-500 font-medium max-w-md">
                Direct messaging with clients will be available for assigned jobs only to ensure privacy and security.
            </p>
        </div>
    );
}
