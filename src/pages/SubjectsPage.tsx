import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight } from 'lucide-react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { OrderModal } from '../components/OrderModal';
import { SignInModal } from '../components/SignInModal';
import { SideDrawer } from '../components/SideDrawer';
import { SubjectGrid, useCatalogTree } from '../components/catalog/SubjectsDirectory';

// /subjects — every published subject, straight from the admin catalogue.
export function SubjectsPage() {
    const { tree, state, retry } = useCatalogTree();
    const [orderOpen, setOrderOpen] = useState(false);
    const [signInOpen, setSignInOpen] = useState(false);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const subjects = tree?.subjects || [];

    useEffect(() => {
        const prevTitle = document.title;
        document.title = 'Subjects | AssignmentMinds';
        return () => { document.title = prevTitle; };
    }, []);

    return (
        <div className="flex min-h-screen flex-col bg-gray-50 font-sans">
            <Navbar onOpenOrder={() => setOrderOpen(true)} onOpenSignIn={() => setSignInOpen(true)} onOpenDrawer={() => setDrawerOpen(true)} activeSection="" onNavigate={() => { }} />
            <main className="flex-grow">
                <header className="bg-gradient-to-br from-[#000a1e] via-[#001330] to-[#002147] text-white">
                    <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 md:py-20 lg:px-8">
                        <nav aria-label="Breadcrumb"><ol className="flex items-center gap-1.5 text-sm text-white/60"><li><Link to="/" className="hover:text-white">Home</Link></li><li className="flex items-center gap-1.5"><ChevronRight className="h-3.5 w-3.5" /><span aria-current="page" className="text-white/90">Subjects</span></li></ol></nav>
                        <h1 className="mt-5 text-4xl font-bold tracking-tight md:text-5xl">Subjects</h1>
                        <p className="mt-4 max-w-2xl text-lg text-white/75">Expert help across every subject we cover — pick one to see its services, projects and pricing.</p>
                    </div>
                </header>
                <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
                    {state === 'loading' && <div className="flex justify-center py-20" role="status" aria-label="Loading"><span className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-[#002147]" /></div>}
                    {state === 'error' && (
                        <div className="py-16 text-center">
                            <p className="text-gray-600">We couldn’t load the subjects. Please try again.</p>
                            <button onClick={retry} className="mt-4 rounded-full bg-[#000a1e] px-6 py-3 font-semibold text-white">Try again</button>
                        </div>
                    )}
                    {state === 'ready' && (subjects.length ? <SubjectGrid subjects={subjects} maxServices={6} /> : (
                        <div className="py-16 text-center text-gray-500"><BookOpen className="mx-auto mb-3 h-10 w-10 opacity-40" /><p className="font-semibold">No subjects yet — check back soon.</p></div>
                    ))}
                </div>
            </main>
            <Footer onOpenOrder={() => setOrderOpen(true)} onOpenSignIn={() => setSignInOpen(true)} onNavigate={() => { }} />
            <SideDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} onProceedToOrder={() => setOrderOpen(true)} />
            <OrderModal isOpen={orderOpen} onClose={() => setOrderOpen(false)} />
            <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />
        </div>
    );
}
