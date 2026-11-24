"use client";

import { useDispatch, useSelector } from "react-redux";
import type { AppDispatch, RootState } from "./index";

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector = <T>(selector: (s: RootState) => T): T => useSelector(selector);
