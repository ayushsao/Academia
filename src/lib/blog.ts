import { absoluteMedia } from './catalogContent';

// Blog posts written in Admin → Blog (see server/routes/blog.js).
export type BlogCard = {
    slug: string; title: string; excerpt: string; category: string; tags: string[]; author: string;
    publishedAt: string; readingMinutes: number; cover: string | null; coverAlt: string;
};
export type BlogPostData = BlogCard & { content: string; updatedAt: string; seo: { title: string; description: string } };
export type BlogList = { total: number; page: number; limit: number; posts: BlogCard[]; categories: string[] };

export const coverSrc = (post: Pick<BlogCard, 'cover'>) => (post.cover ? absoluteMedia(post.cover) : null);
export const postDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
