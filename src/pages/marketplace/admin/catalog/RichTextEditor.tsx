import React, { useEffect, useRef, useState } from 'react';
import { Bold, Italic, Underline, Heading2, Heading3, List, ListOrdered, Link2, Quote, RemoveFormatting, Code2, Pilcrow } from 'lucide-react';
import { cn } from '../../../../lib/utils';

// Lightweight rich text editor (contentEditable + execCommand, no extra
// dependency). The server sanitises whatever HTML is saved, so this only needs
// to produce sensible markup. Paste comes in as plain text to avoid Word junk.
export default function RichTextEditor({ value, onChange, label, placeholder = 'Start writing…', minHeight = 160, id }: {
    value: string; onChange: (html: string) => void; label: string; placeholder?: string; minHeight?: number; id?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [source, setSource] = useState(false);
    const [empty, setEmpty] = useState(!value);

    // Only push outside changes into the DOM; never while typing (keeps the caret).
    useEffect(() => {
        const el = ref.current;
        if (!el || source) return;
        if (el.innerHTML !== value && document.activeElement !== el) el.innerHTML = value || '';
        setEmpty(!el.textContent?.trim() && !/<(img|iframe|hr|li)/i.test(el.innerHTML));
    }, [value, source]);

    const emit = () => {
        const el = ref.current;
        if (!el) return;
        const html = el.innerHTML === '<br>' ? '' : el.innerHTML;
        setEmpty(!el.textContent?.trim());
        onChange(html);
    };
    const exec = (cmd: string, arg?: string) => {
        ref.current?.focus();
        document.execCommand(cmd, false, arg);
        emit();
    };
    const link = () => {
        const url = window.prompt('Link URL (https://…, /page, mailto:…)');
        if (url === null) return;
        if (!url.trim()) return exec('unlink');
        if (!/^(https?:\/\/|\/|mailto:|tel:)/i.test(url.trim())) { window.alert('Use a full https:// link, a site path like /subjects/law, mailto: or tel:'); return; }
        exec('createLink', url.trim());
    };

    const tools: { icon: React.ElementType; label: string; run: () => void }[] = [
        { icon: Pilcrow, label: 'Paragraph', run: () => exec('formatBlock', 'P') },
        { icon: Heading2, label: 'Heading', run: () => exec('formatBlock', 'H2') },
        { icon: Heading3, label: 'Subheading', run: () => exec('formatBlock', 'H3') },
        { icon: Bold, label: 'Bold', run: () => exec('bold') },
        { icon: Italic, label: 'Italic', run: () => exec('italic') },
        { icon: Underline, label: 'Underline', run: () => exec('underline') },
        { icon: List, label: 'Bulleted list', run: () => exec('insertUnorderedList') },
        { icon: ListOrdered, label: 'Numbered list', run: () => exec('insertOrderedList') },
        { icon: Quote, label: 'Quote', run: () => exec('formatBlock', 'BLOCKQUOTE') },
        { icon: Link2, label: 'Link', run: link },
        { icon: RemoveFormatting, label: 'Clear formatting', run: () => { exec('removeFormat'); exec('formatBlock', 'P'); } },
    ];

    return (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white focus-within:border-[#fea520] focus-within:ring-2 focus-within:ring-[#fea520]/20">
            <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 bg-gray-50 px-1.5 py-1" role="toolbar" aria-label={`${label} formatting`}>
                {tools.map(t => (
                    <button key={t.label} type="button" disabled={source} title={t.label} aria-label={t.label}
                        onMouseDown={e => e.preventDefault()} onClick={t.run}
                        className="rounded-md p-1.5 text-gray-600 hover:bg-white hover:text-[#000a1e] disabled:opacity-30">
                        <t.icon className="h-4 w-4" />
                    </button>
                ))}
                <button type="button" onClick={() => setSource(s => !s)} aria-pressed={source} title="Edit HTML"
                    className={cn('ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold', source ? 'bg-[#000a1e] text-white' : 'text-gray-500 hover:bg-white')}>
                    <Code2 className="h-3.5 w-3.5" /> HTML
                </button>
            </div>
            {source ? (
                <textarea id={id} aria-label={`${label} (HTML)`} value={value} onChange={e => onChange(e.target.value)} spellCheck={false}
                    className="block w-full resize-y bg-slate-900 px-3.5 py-3 font-mono text-xs leading-relaxed text-slate-100 focus:outline-none" style={{ minHeight }} />
            ) : (
                <div className="relative">
                    {empty && <span className="pointer-events-none absolute left-3.5 top-3 text-sm text-gray-400">{placeholder}</span>}
                    <div id={id} ref={ref} role="textbox" aria-multiline="true" aria-label={label} contentEditable suppressContentEditableWarning
                        onInput={emit} onBlur={emit}
                        onPaste={e => { e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain')); emit(); }}
                        className="cms-prose max-h-[60vh] overflow-y-auto px-3.5 py-3 text-sm focus:outline-none" style={{ minHeight }} />
                </div>
            )}
        </div>
    );
}
