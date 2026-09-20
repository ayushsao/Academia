import { z } from 'zod';

export const signupSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name too long").regex(/^[a-zA-Z\\s]*$/, "Name can only contain letters and spaces"),
    email: z.string().email("Invalid email format"),
    password: z.string().min(12, "Password must be at least 12 characters"),
});

export const loginSchema = z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required")
});

export const adminLoginSchema = z.object({
    username: z.string().min(1, "Username is required"),
    password: z.string().min(1, "Password is required")
});

export const orderSchema = z.object({
    service: z.string().min(2),
    subject: z.string().min(2),
    academicLevel: z.string().optional(),
    pages: z.number().int().min(1).optional(),
    deadline: z.string().min(4), // date string
    topicTitle: z.string().min(2),
    instructions: z.string().optional(),
    files: z.array(z.string()).optional(),
    turnitinReport: z.boolean().optional(),
    topExpert: z.boolean().optional(),
    abstractPage: z.boolean().optional(),
    totalAmount: z.number().min(0).optional(),
    transactionId: z.string().optional()
}).strict(); // Reject extra fields

export const contactSchema = z.object({
    name: z.string().min(2).max(50),
    email: z.string().email(),
    phone: z.string().optional(),
    subject: z.string().min(2).max(100),
    message: z.string().min(10).max(2000)
}).strict();

// Middleware generator
export const validateInput = (schema) => (req, res, next) => {
    try {
        req.body = schema.parse(req.body);
        next();
    } catch (err) {
        return res.status(400).json({
            error: "Validation failed",
            details: err.errors.map(e => `${e.path.join('.')}: ${e.message}`)
        });
    }
};
