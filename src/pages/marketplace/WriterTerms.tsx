import React from 'react';
import { Link } from 'react-router-dom';
import { MarketplaceNavbar as Navbar } from '../../components/writer/MarketplaceNavbar';
import { Footer } from '../../components/Footer';
import { Spinner } from '../../components/writer/WriterBits';
import { useMarketplaceContent, DEFAULT_MARKETPLACE_CONTENT } from '../../lib/marketplaceContent';
import { ContactStrip } from './BecomeWriter';

// Writer terms (Admin → Site Content → Terms). Plain text: blank lines separate paragraphs.
export default function WriterTerms() {
    const { data } = useMarketplaceContent();
    const contentData = data || DEFAULT_MARKETPLACE_CONTENT;
    const terms = contentData.content.terms;
    return (
        <div className="flex min-h-screen flex-col bg-[#f6f8fc] font-sans">
            <Navbar />
            <main className="flex-grow px-4 pb-24 pt-[110px] sm:px-6 lg:pt-[130px]">
                <article className="mx-auto max-w-3xl rounded-3xl border border-slate-200 bg-white p-6 sm:p-10">
                    {terms && (
                        <>
                            <h1 className="text-3xl font-extrabold tracking-tight text-[#0b1b33] sm:text-4xl">{terms.title}</h1>
                            {data.termsUpdatedAt && <p className="mt-2 text-sm text-slate-500">Last updated {new Date(data.termsUpdatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</p>}
                            <div className="mt-8 space-y-4 leading-relaxed text-slate-700">
                                {terms.body.split(/\n\s*\n/).map((para, i) => <p key={i} className="whitespace-pre-line">{para}</p>)}
                            </div>
                            <p className="mt-8 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">{data.disclaimer}</p>
                            <ContactStrip contact={data.content.contact} />
                            <p className="mt-8 text-sm"><Link to="/become-a-writer" className="font-semibold text-[#002147] hover:underline">← Become a writer</Link></p>
                        </>
                    )}
                </article>
            </main>
            <Footer />
        </div>
    );
}
