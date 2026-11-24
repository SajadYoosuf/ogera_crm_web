// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConvertLeadModal from "@/features/leads/components/ConvertLeadModal";
import type { useLeadConvert } from "@/features/leads/hooks/useLeadConvert";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

type Converter = ReturnType<typeof useLeadConvert>;

function converterWith(overrides: Partial<Converter>): Converter {
  return {
    isOpen: true,
    step: 1,
    pendingId: 1,
    lead: { first_name: "Asha", last_name: "Rao", phone: "9800000001", address: "Street" },
    form: { contact_type: "partner", partner_type: "", name: "Asha Rao", phone: "9800000001", address: "Street", district: "" },
    updateForm: vi.fn(),
    isConverting: false,
    convertError: "",
    result: null,
    partnerTypes: [],
    partnerTypesStatus: "ready",
    reloadPartnerTypes: vi.fn(),
    openModal: vi.fn(),
    closeModal: vi.fn(),
    nextStep: vi.fn(),
    prevStep: vi.fn(),
    confirm: vi.fn(),
    ...overrides,
  } as Converter;
}

afterEach(cleanup);

describe("ConvertLeadModal partner type", () => {
  it("offers the partner types from the API as a dropdown", () => {
    const updateForm = vi.fn();
    render(<ConvertLeadModal converter={converterWith({
      updateForm,
      partnerTypes: [
        { value: "plumber", label: "plumber" },
        { value: "electrician", label: "electrician" },
      ],
    })} />);

    const select = screen.getByRole("combobox", { name: "Partner type" }) as HTMLSelectElement;
    expect(Array.from(select.options).map((o) => o.value)).toEqual(["", "plumber", "electrician"]);

    fireEvent.change(select, { target: { value: "electrician" } });
    expect(updateForm).toHaveBeenCalledWith({ partner_type: "electrician" });
  });

  it("shows a retry action when the partner types fail to load", () => {
    const reloadPartnerTypes = vi.fn();
    render(<ConvertLeadModal converter={converterWith({ partnerTypesStatus: "error", reloadPartnerTypes })} />);

    expect(screen.getByText("Could not load partner types.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(reloadPartnerTypes).toHaveBeenCalledTimes(1);
  });

  it("explains when no partner types are set up yet", () => {
    render(<ConvertLeadModal converter={converterWith({ partnerTypesStatus: "ready", partnerTypes: [] })} />);

    expect(screen.getByText(/No partner types are set up yet/)).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Partner type" })).toBeNull();
  });
});
