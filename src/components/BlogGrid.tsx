import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { coverSrc, postDate, type BlogCard, type BlogList } from '../lib/blog';

// Homepage "Latest Blog": the newest posts published in Admin → Blog.
// Hidden until at least one post is published.
export const BlogGrid: React.FC = () => {
    const [posts, setPosts] = useState<BlogCard[]>([]);
    useEffect(() => {
        const ctrl = new AbortController();
        api<BlogList>('/blog?limit=5', { signal: ctrl.signal }).then(r => setPosts(r.posts)).catch(() => setPosts([]));
        return () => ctrl.abort();
    }, []);
    if (posts.length === 0) return null;

    const [featured, ...rest] = posts;
    const featuredImg = coverSrc(featured);

    return (
        <section className="py-20 md:py-24 bg-white relative">
            <div className="max-w-[1250px] mx-auto px-4 relative z-10">

                {/* Header */}
                <div className="text-center mb-12 flex flex-col items-center">
                    <h2 className="text-[26px] md:text-[34px] font-bold text-[#2d2d2d] mb-3 tracking-tight">
                        Latest Blog
                    </h2>
                    <p className="max-w-3xl mx-auto text-[#666] text-[13px] md:text-[14px]">
                        By our academic experts on university life, assignments, writing skills and tips.
                    </p>
                </div>

                {/* Grid Container */}
                <div className="flex flex-col lg:flex-row gap-6 lg:gap-8">

                    {/* Featured Left Card */}
                    <div className="flex-1 w-full flex">
                        <motion.div initial={{ opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="w-full flex">
                            <Link to={`/blog/${featured.slug}`} className="bg-white border border-gray-100 rounded-lg shadow-[0_4px_20px_rgb(0,0,0,0.06)] p-3 md:p-4 w-full flex flex-col group hover:shadow-md transition-shadow">
                                <div className="w-full h-[250px] md:h-[300px] border border-gray-100 rounded-md overflow-hidden relative mb-5 bg-[#f5f5f7]">
                                    {featuredImg
                                        ? <img loading="lazy" decoding="async" src={featuredImg} alt={featured.coverAlt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 origin-center" />
                                        : <div className="flex h-full items-center justify-center px-8 text-center text-2xl font-bold text-[#1d1d1f]/70">{featured.title}</div>}
                                </div>
                                <div className="px-2 flex-grow flex flex-col">
                                    <div className="text-[12px] text-gray-500 font-semibold mb-3">
                                        {postDate(featured.publishedAt)} &nbsp;&bull;&nbsp; {featured.readingMinutes} min read{featured.category ? <> &nbsp;&bull;&nbsp; {featured.category}</> : null}
                                    </div>
                                    <h3 className="text-xl md:text-[22px] font-bold text-[#2d2d2d] mb-4 leading-snug group-hover:text-[#fea520] transition-colors">{featured.title}</h3>
                                    {featured.excerpt && <p className="text-[#555] text-[13.5px] leading-relaxed mb-6 line-clamp-3">{featured.excerpt}</p>}
                                    <div className="mt-auto flex justify-end pb-2">
                                        <span className="text-[#fea520] font-semibold text-[13px] flex items-center gap-1.5 group-hover:underline">Read More <ArrowUpRight className="w-4 h-4" /></span>
                                    </div>
                                </div>
                            </Link>
                        </motion.div>
                    </div>

                    {/* Right: up to four more posts */}
                    {rest.length > 0 && (
                        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 content-start">
                            {rest.map((post, idx) => {
                                const img = coverSrc(post);
                                return (
                                    <motion.div key={post.slug} initial={{ opacity: 0, scale: 0.96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: 0.1 * idx }}>
                                        <Link to={`/blog/${post.slug}`} className="bg-white border border-gray-100 rounded-lg shadow-[0_4px_16px_rgb(0,0,0,0.05)] p-3 flex h-full flex-col group hover:shadow-md transition-all">
                                            <div className="w-full h-[140px] md:h-[160px] overflow-hidden rounded-md mb-3 relative border border-gray-100 bg-[#f5f5f7]">
                                                {img && <img loading="lazy" decoding="async" src={img} alt={post.coverAlt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />}
                                            </div>
                                            <div className="px-2 pb-2">
                                                <h4 className="font-bold text-[#2d2d2d] text-[14px] leading-tight line-clamp-3 group-hover:text-[#fea520] transition-colors">{post.title}</h4>
                                                <p className="mt-1.5 text-[11.5px] text-gray-500">{postDate(post.publishedAt)} · {post.readingMinutes} min read</p>
                                            </div>
                                        </Link>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Bottom View More Button */}
                <div className="mt-14 flex justify-center">
                    <Link to="/blog" className="bg-[#ffcb05] hover:bg-[#eebc04] text-[#2d2d2d] font-bold text-[14.5px] px-8 py-2.5 rounded shadow-sm transition-colors">
                        View More Blogs
                    </Link>
                </div>
            </div>
        </section>
    );
};
