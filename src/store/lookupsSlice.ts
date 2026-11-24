import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { listAllEmployees, type Employee } from "@/lib/api/employees";
import { listLeadSources, listBranches, type LeadSource, type BranchOption } from "@/features/contacts/api/contacts";
import type { RootState } from "./index";

type AsyncState<T> = {
  status: "idle" | "loading" | "succeeded" | "failed";
  data: T[];
  error: string | null;
};

function idle<T>(): AsyncState<T> {
  return { status: "idle", data: [], error: null };
}

interface LookupsState {
  employees: AsyncState<Employee>;
  leadSources: AsyncState<LeadSource>;
  branches: AsyncState<BranchOption>;
}

const initialState: LookupsState = {
  employees: idle(),
  leadSources: idle(),
  branches: idle(),
};

export const fetchEmployees = createAsyncThunk(
  "lookups/fetchEmployees",
  async (token: string) => {
    const result = await listAllEmployees(token);
    return result.employees;
  },
);

export const fetchLeadSources = createAsyncThunk(
  "lookups/fetchLeadSources",
  (token: string) => listLeadSources(token),
);

export const fetchBranches = createAsyncThunk(
  "lookups/fetchBranches",
  (token: string) => listBranches(token),
);

const lookupsSlice = createSlice({
  name: "lookups",
  initialState,
  reducers: {
    resetLookups: () => initialState,
  },
  extraReducers: (builder) => {
    // employees
    builder
      .addCase(fetchEmployees.pending, (state) => { state.employees = { ...state.employees, status: "loading", error: null }; })
      .addCase(fetchEmployees.fulfilled, (state, action) => { state.employees = { status: "succeeded", data: action.payload, error: null }; })
      .addCase(fetchEmployees.rejected, (state, action) => { state.employees = { ...state.employees, status: "failed", error: action.error.message ?? "Failed to load employees" }; });

    // lead sources
    builder
      .addCase(fetchLeadSources.pending, (state) => { state.leadSources = { ...state.leadSources, status: "loading", error: null }; })
      .addCase(fetchLeadSources.fulfilled, (state, action) => { state.leadSources = { status: "succeeded", data: action.payload, error: null }; })
      .addCase(fetchLeadSources.rejected, (state, action) => { state.leadSources = { ...state.leadSources, status: "failed", error: action.error.message ?? "Failed to load lead sources" }; });

    // branches
    builder
      .addCase(fetchBranches.pending, (state) => { state.branches = { ...state.branches, status: "loading", error: null }; })
      .addCase(fetchBranches.fulfilled, (state, action) => { state.branches = { status: "succeeded", data: action.payload, error: null }; })
      .addCase(fetchBranches.rejected, (state, action) => { state.branches = { ...state.branches, status: "failed", error: action.error.message ?? "Failed to load branches" }; });
  },
});

export const { resetLookups } = lookupsSlice.actions;
export default lookupsSlice.reducer;

// Selectors
export const selectEmployees = (s: RootState) => s.lookups.employees.data;
export const selectEmployeesStatus = (s: RootState) => s.lookups.employees.status;
export const selectLeadSources = (s: RootState) => s.lookups.leadSources.data;
export const selectLeadSourcesStatus = (s: RootState) => s.lookups.leadSources.status;
export const selectBranches = (s: RootState) => s.lookups.branches.data;
export const selectBranchesStatus = (s: RootState) => s.lookups.branches.status;
