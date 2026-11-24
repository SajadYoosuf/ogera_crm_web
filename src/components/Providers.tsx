"use client";

/**
 * Root providers wrapper. Nests Redux store and AuthContext so both are
 * available to every client component in the tree.
 */
import { Provider } from "react-redux";
import { AuthProvider } from "@/context/AuthContext";
import { store } from "@/store";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <Provider store={store}>
      <AuthProvider>{children}</AuthProvider>
    </Provider>
  );
}
