"use client";

/**
 * Thin re-export so the server root layout can import a client component
 * without adding "use client" to the layout file itself.
 *
 * Next.js requires "use client" to live in the file that uses browser APIs.
 * The root layout (app/layout.tsx) is a server component, so it cannot be
 * marked "use client". This wrapper lets us keep the layout as a server
 * component while still providing the AuthContext to all client components
 * beneath it.
 */
export { AuthProvider } from "@/context/AuthContext";
