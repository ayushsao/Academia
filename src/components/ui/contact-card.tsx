import React from 'react';
import { cn } from '@/lib/utils';
import { LucideIcon } from 'lucide-react';

type ContactInfoProps = React.ComponentProps<'div'> & {
    icon: LucideIcon;
    label: string;
    value: string;
};

type ContactCardProps = React.ComponentProps<'div'> & {
    title?: string;
    description?: React.ReactNode;
    contactInfo?: ContactInfoProps[];
    formSectionClassName?: string;
};

export function ContactCard({
    title,
    description,
    contactInfo,
    className,
    formSectionClassName,
    children,
    ...props
}: ContactCardProps) {
    return (
        <div className="w-full max-w-[1100px] mx-auto px-4 py-8">
            {/* Header area */}
            {(title || description) && (
                <div className="text-center mb-10">
                    {title && (
                        <h1 className="text-3xl font-black md:text-[40px] text-[#000a1e] mb-4">
                            Contact <span className="text-[#fea520]">AssignmentMind</span> Team
                        </h1>
                    )}
                    {description && (
                        <p className="text-[#6c757d] max-w-2xl mx-auto text-sm md:text-base font-medium">
                            {description}
                        </p>
                    )}
                </div>
            )}

            <div
                className={cn(
                    'grid grid-cols-1 lg:grid-cols-[1fr_1.3fr] gap-0 rounded-[20px] overflow-visible bg-white relative',
                    className,
                )}
                {...props}
            >
                {/* Left Side: Contact Information */}
                <div className="bg-[#0b121e] z-10 text-white rounded-[24px] p-8 md:p-10 shadow-2xl relative overflow-hidden lg:my-6 lg:-mr-8 flex flex-col justify-center">
                    <div className="absolute top-[80%] left-[80%] w-[200px] h-[200px] bg-[#fea520]/20 rounded-full blur-[60px]" />
                    <h3 className="text-[22px] font-bold mb-8">Contact Information</h3>
                    <div className="space-y-6">
                        {contactInfo?.map((info, index) => (
                            <ContactInfo key={index} {...info} />
                        ))}
                    </div>
                </div>

                {/* Right Side: Form */}
                <div
                    className={cn(
                        'bg-white rounded-[24px] rounded-tl-none rounded-bl-none border border-gray-100 shadow-[0_4px_24px_rgba(0,0,0,0.02)] p-8 md:p-10 pt-10 md:pt-14 lg:pl-16',
                        formSectionClassName,
                    )}
                >
                    {children}
                </div>
            </div>
        </div>
    );
}

function ContactInfo({
    icon: Icon,
    label,
    value,
    className,
    ...props
}: ContactInfoProps) {
    return (
        <div className={cn('flex items-center gap-4', className)} {...props}>
            <div className="bg-[#ffffff10] rounded-xl p-3 shrink-0">
                <Icon className="h-[22px] w-[22px] text-[#fea520]" strokeWidth={1.5} />
            </div>
            <div>
                <p className="font-semibold text-gray-400 text-xs mb-0.5">{label}</p>
                <p className="font-bold text-white text-[15px]">{value}</p>
            </div>
        </div>
    );
}
