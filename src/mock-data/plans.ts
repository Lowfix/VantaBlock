export interface Plan {
  id: string;
  ram: number;
  name: string;
  price: number;
  vCores: string;
  storage: string;
  players: string;
  featured?: boolean;
  features: string[];
}

export const plans: Plan[] = [
  {
    id: "sprout",
    ram: 2,
    name: "Sprout",
    price: 2.99,
    vCores: "2 vCores @ 5.4GHz",
    storage: "20GB NVMe SSD",
    players: "Up to 10 players",
    features: [
      "2GB DDR5 RAM",
      "AMD Ryzen 9 9955HX",
      "Unlimited SSD bandwidth",
      "1-click modpack install",
      "Free subdomain",
      "Standard DDoS protection",
    ],
  },
  {
    id: "sapling",
    ram: 4,
    name: "Sapling",
    price: 5.99,
    vCores: "2 vCores @ 5.4GHz",
    storage: "40GB NVMe SSD",
    players: "Up to 20 players",
    features: [
      "4GB DDR5 RAM",
      "AMD Ryzen 9 9955HX",
      "Unlimited SSD bandwidth",
      "1-click modpack install",
      "Free subdomain",
      "Standard DDoS protection",
    ],
  },
  {
    id: "thicket",
    ram: 6,
    name: "Thicket",
    price: 8.99,
    vCores: "2 vCores @ 5.4GHz",
    storage: "60GB NVMe SSD",
    players: "Up to 30 players",
    features: [
      "6GB DDR5 RAM",
      "AMD Ryzen 9 9955HX",
      "Unlimited SSD bandwidth",
      "1-click modpack install",
      "Free subdomain",
      "Advanced DDoS protection",
    ],
  },
  {
    id: "grove",
    ram: 8,
    name: "Grove",
    price: 11.99,
    vCores: "3 vCores @ 5.4GHz",
    storage: "80GB NVMe SSD",
    players: "Up to 45 players",
    featured: true,
    features: [
      "8GB DDR5 RAM",
      "AMD Ryzen 9 9955HX",
      "Unlimited SSD bandwidth",
      "1-click modpack install",
      "Free subdomain",
      "Advanced DDoS protection",
      "Daily automated backups",
    ],
  },
  {
    id: "woodland",
    ram: 10,
    name: "Woodland",
    price: 14.99,
    vCores: "3 vCores @ 5.4GHz",
    storage: "100GB NVMe SSD",
    players: "Up to 60 players",
    features: [
      "10GB DDR5 RAM",
      "AMD Ryzen 9 9955HX",
      "Unlimited SSD bandwidth",
      "1-click modpack install",
      "Priority support queue",
      "Advanced DDoS protection",
      "Daily automated backups",
    ],
  },
  {
    id: "redwood",
    ram: 12,
    name: "Redwood",
    price: 17.99,
    vCores: "3 vCores @ 5.4GHz",
    storage: "120GB NVMe SSD",
    players: "Up to 75 players",
    features: [
      "12GB DDR5 RAM",
      "AMD Ryzen 9 9955HX",
      "Unlimited SSD bandwidth",
      "1-click modpack install",
      "Priority support queue",
      "Advanced DDoS protection",
      "Daily automated backups",
    ],
  },
];
