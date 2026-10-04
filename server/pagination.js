// Page/limit parsing shared by list endpoints. Every list has a hard cap so a
// client can never ask for the whole collection in one response.
//
//   const { page, limit, skip } = pageParams(req.query, { defaultLimit: 20 });
//   const [items, total] = await Promise.all([Model.find(q).sort(s).skip(skip).limit(limit).lean(), Model.countDocuments(q)]);
//   res.json({ items, ...pageInfo(total, page, limit) });

export const MAX_PAGE_SIZE = 100;

export function pageParams(query = {}, { defaultLimit = 20, maxLimit = MAX_PAGE_SIZE } = {}) {
    const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
    const limit = Math.min(maxLimit, Math.max(1, Number.parseInt(query.limit, 10) || defaultLimit));
    return { page, limit, skip: (page - 1) * limit };
}

export const pageInfo = (total, page, limit) => ({
    total, page, limit, pages: Math.max(1, Math.ceil(total / limit)), hasMore: page * limit < total,
});
