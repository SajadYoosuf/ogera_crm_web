export type StaffState = "moving" | "stuck" | "location_disabled" | "connection_lost" | "signed_out";

export type StaffLocation = {
  userId: number;
  name: string;
  phone: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  recordedAt: string | null;
  state: StaffState;
  colorIndex: number;
  batteryLevel?: number | null;
  speed?: number | null;
};

export type RoutePoint = {
  latitude: number;
  longitude: number;
  address: string | null;
  recordedAt: string;
  state: "moving" | "stuck";
};

export type RouteStop = {
  latitude: number;
  longitude: number;
  arrivedAt: string;
  leftAt: string;
  dwellMs: number;
  address: string | null;
};

export type StaffRoute = {
  points: RoutePoint[];
  stops?: RouteStop[];
  distanceMeters: number;
  firstSeen?: string | null;
  lastSeen?: string | null;
};

const NOW = Date.now();
const isoOffset = (minsAgo: number) => new Date(NOW - minsAgo * 60_000).toISOString();

export const DEMO_STAFF: StaffLocation[] = [
  {
    userId: 101,
    name: "Mohammed Riyas",
    phone: "+91 98471 23456",
    latitude: 11.2612,
    longitude: 75.7694,
    address: "Beach Road, Vellayil, Kozhikode, Kerala 673032",
    recordedAt: isoOffset(2),
    state: "moving",
    colorIndex: 0,
    batteryLevel: 84,
    speed: 8.89, // ~32 km/h
  },
  {
    userId: 102,
    name: "Arjun Das",
    phone: "+91 97452 34567",
    latitude: 11.2655,
    longitude: 75.8361,
    address: "Cyberpark Road, Nellikode, Kozhikode, Kerala 673016",
    recordedAt: isoOffset(5),
    state: "moving",
    colorIndex: 1,
    batteryLevel: 68,
    speed: 6.67, // ~24 km/h
  },
  {
    userId: 103,
    name: "Suresh Nair",
    phone: "+91 94473 45678",
    latitude: 11.1197,
    longitude: 76.1214,
    address: "Court Road, Manjeri, Malappuram, Kerala 676121",
    recordedAt: isoOffset(12),
    state: "stuck",
    colorIndex: 2,
    batteryLevel: 91,
    speed: 0,
  },
  {
    userId: 104,
    name: "Pooja Menon",
    phone: "+91 95444 56789",
    latitude: 11.1738,
    longitude: 75.8647,
    address: "NH 66 Junction, Ramanattukara, Kozhikode, Kerala 673633",
    recordedAt: isoOffset(18),
    state: "stuck",
    colorIndex: 3,
    batteryLevel: 46,
    speed: 0,
  },
  {
    userId: 105,
    name: "Vishnu Kumar",
    phone: "+91 96455 67890",
    latitude: 11.1963,
    longitude: 75.8317,
    address: "Near Old Bridge, Feroke, Kozhikode, Kerala 673631",
    recordedAt: isoOffset(45),
    state: "location_disabled",
    colorIndex: 4,
    batteryLevel: 24,
    speed: 0,
  },
  {
    userId: 106,
    name: "Fahad P.",
    phone: "+91 99466 78901",
    latitude: 11.0003,
    longitude: 75.9984,
    address: "Changuvetty, Kottakkal, Malappuram, Kerala 676501",
    recordedAt: isoOffset(130),
    state: "connection_lost",
    colorIndex: 5,
    batteryLevel: 15,
    speed: 0,
  },
];

export const DEMO_ROUTES: Record<number, StaffRoute> = {
  101: {
    distanceMeters: 24800,
    firstSeen: isoOffset(360),
    lastSeen: isoOffset(2),
    stops: [
      {
        latitude: 11.1738,
        longitude: 75.8647,
        arrivedAt: isoOffset(290),
        leftAt: isoOffset(245),
        dwellMs: 45 * 60_000,
        address: "Client Site — Ramanattukara Commercial Complex",
      },
      {
        latitude: 11.2568,
        longitude: 75.7852,
        arrivedAt: isoOffset(150),
        leftAt: isoOffset(95),
        dwellMs: 55 * 60_000,
        address: "Dealer Meeting — Focus Mall, Mavoor Road, Kozhikode",
      },
    ],
    points: [
      {
        latitude: 11.145,
        longitude: 75.878,
        address: "Starting Point — Vallikkunnu Branch Office",
        recordedAt: isoOffset(360),
        state: "moving",
      },
      {
        latitude: 11.162,
        longitude: 75.871,
        address: "NH 66 Bypass, Towards Ramanattukara",
        recordedAt: isoOffset(330),
        state: "moving",
      },
      {
        latitude: 11.1738,
        longitude: 75.8647,
        address: "Client Site — Ramanattukara Commercial Complex",
        recordedAt: isoOffset(290),
        state: "stuck",
      },
      {
        latitude: 11.1963,
        longitude: 75.8317,
        address: "Feroke Bridge, NH 66",
        recordedAt: isoOffset(220),
        state: "moving",
      },
      {
        latitude: 11.221,
        longitude: 75.815,
        address: "Pantheeramkavu Junction, Kozhikode",
        recordedAt: isoOffset(180),
        state: "moving",
      },
      {
        latitude: 11.2568,
        longitude: 75.7852,
        address: "Dealer Meeting — Focus Mall, Mavoor Road, Kozhikode",
        recordedAt: isoOffset(150),
        state: "stuck",
      },
      {
        latitude: 11.2605,
        longitude: 75.776,
        address: "Mananchira Square, Kozhikode",
        recordedAt: isoOffset(45),
        state: "moving",
      },
      {
        latitude: 11.2612,
        longitude: 75.7694,
        address: "Beach Road, Vellayil, Kozhikode (Current Position)",
        recordedAt: isoOffset(2),
        state: "moving",
      },
    ],
  },
  102: {
    distanceMeters: 18200,
    firstSeen: isoOffset(300),
    lastSeen: isoOffset(5),
    stops: [
      {
        latitude: 11.248,
        longitude: 75.821,
        arrivedAt: isoOffset(210),
        leftAt: isoOffset(150),
        dwellMs: 60 * 60_000,
        address: "Architect Office — Medical College Road, Kozhikode",
      },
    ],
    points: [
      {
        latitude: 11.228,
        longitude: 75.805,
        address: "Morning Start — Mankavu, Kozhikode",
        recordedAt: isoOffset(300),
        state: "moving",
      },
      {
        latitude: 11.248,
        longitude: 75.821,
        address: "Architect Office — Medical College Road, Kozhikode",
        recordedAt: isoOffset(210),
        state: "stuck",
      },
      {
        latitude: 11.2655,
        longitude: 75.8361,
        address: "Cyberpark Road, Nellikode, Kozhikode (Current Position)",
        recordedAt: isoOffset(5),
        state: "moving",
      },
    ],
  },
  103: {
    distanceMeters: 9400,
    firstSeen: isoOffset(240),
    lastSeen: isoOffset(12),
    stops: [
      {
        latitude: 11.1197,
        longitude: 76.1214,
        arrivedAt: isoOffset(80),
        leftAt: isoOffset(12),
        dwellMs: 68 * 60_000,
        address: "Court Road, Manjeri, Malappuram — Partner Consultation",
      },
    ],
    points: [
      {
        latitude: 11.102,
        longitude: 76.105,
        address: "Pandikkad Road, Manjeri Outskirts",
        recordedAt: isoOffset(240),
        state: "moving",
      },
      {
        latitude: 11.1197,
        longitude: 76.1214,
        address: "Court Road, Manjeri, Malappuram (Current Position)",
        recordedAt: isoOffset(12),
        state: "stuck",
      },
    ],
  },
  104: {
    distanceMeters: 14100,
    firstSeen: isoOffset(310),
    lastSeen: isoOffset(18),
    stops: [
      {
        latitude: 11.1738,
        longitude: 75.8647,
        arrivedAt: isoOffset(110),
        leftAt: isoOffset(18),
        dwellMs: 92 * 60_000,
        address: "Consumer Onboarding — NH 66, Ramanattukara",
      },
    ],
    points: [
      {
        latitude: 11.155,
        longitude: 75.882,
        address: "Karippur Airport Junction",
        recordedAt: isoOffset(310),
        state: "moving",
      },
      {
        latitude: 11.1738,
        longitude: 75.8647,
        address: "NH 66 Junction, Ramanattukara (Current Position)",
        recordedAt: isoOffset(18),
        state: "stuck",
      },
    ],
  },
  105: {
    distanceMeters: 6200,
    firstSeen: isoOffset(200),
    lastSeen: isoOffset(45),
    stops: [],
    points: [
      {
        latitude: 11.205,
        longitude: 75.828,
        address: "Feroke Petta",
        recordedAt: isoOffset(200),
        state: "moving",
      },
      {
        latitude: 11.1963,
        longitude: 75.8317,
        address: "Near Old Bridge, Feroke (GPS turned off)",
        recordedAt: isoOffset(45),
        state: "stuck",
      },
    ],
  },
  106: {
    distanceMeters: 11300,
    firstSeen: isoOffset(340),
    lastSeen: isoOffset(130),
    stops: [],
    points: [
      {
        latitude: 11.035,
        longitude: 76.012,
        address: "Edarikode, Malappuram",
        recordedAt: isoOffset(340),
        state: "moving",
      },
      {
        latitude: 11.0003,
        longitude: 75.9984,
        address: "Changuvetty, Kottakkal (Device offline)",
        recordedAt: isoOffset(130),
        state: "stuck",
      },
    ],
  },
};

export async function getDemoLiveStaff(): Promise<StaffLocation[]> {
  // Simulates instant static load without API
  return [...DEMO_STAFF];
}

export async function getDemoStaffRoute(userId: number, _date?: string): Promise<StaffRoute> {
  const route = DEMO_ROUTES[userId];
  if (route) return { ...route };
  return {
    distanceMeters: 0,
    points: [],
    stops: [],
    firstSeen: null,
    lastSeen: null,
  };
}
