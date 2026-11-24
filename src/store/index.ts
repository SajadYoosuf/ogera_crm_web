import { configureStore } from "@reduxjs/toolkit";
import lookupsReducer from "./lookupsSlice";

export const store = configureStore({
  reducer: { lookups: lookupsReducer },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
