import { Types } from "mongoose";

export function id() {
  return new Types.ObjectId();
}

export function buildRole(overrides = {}) {
  return {
    _id: id(),
    name: "user",
    description: "Registrovani korisnik",
    permissions: ["view_dashboard", "manage_own_appointments"],
    isDefault: true,
    priority: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildUser(overrides = {}) {
  return {
    _id: id(),
    email: "korisnik@example.com",
    firstName: "Marko",
    lastName: "Markovic",
    phone: "0601234567",
    password: "$2b$12$hashedpasswordvaluehere",
    googleId: null,
    provider: "local",
    avatar: "",
    role: buildRole(),
    status: "active",
    confirmed: true,
    resetToken: null,
    resetTokenExpiration: null,
    confirmToken: null,
    confirmTokenExpiration: null,
    acceptance: true,
    lastLogin: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildEmployee(overrides = {}) {
  return {
    _id: id(),
    userId: buildUser(),
    expert: null,
    services: [],
    workingHours: [{ day: "monday", slots: [{ from: "09:00", to: "17:00" }] }],
    isActive: true,
    notes: "",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildExpert(overrides = {}) {
  return {
    _id: id(),
    firstName: "Ana",
    lastName: "Anic",
    slug: "ana-anic",
    title: "Terapeut",
    shortBio: "Kratka biografija",
    bio: "Duga biografija",
    image: { img: "/images/experts/ana.webp", imgDesc: "Ana Anic" },
    gallery: [],
    specializations: ["Masaza"],
    services: [],
    socialLinks: {},
    isActive: true,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildCategory(overrides = {}) {
  return {
    _id: id(),
    name: "Masaze",
    slug: "masaze",
    domain: "service",
    parent: null,
    shortDescription: "Sve vrste masaza",
    longDescription: "",
    featureImage: null,
    isIndexable: true,
    meta: { priority: 0, isActive: true },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildTag(overrides = {}) {
  return {
    _id: id(),
    name: "Opustanje",
    slug: "opustanje",
    domain: "service",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildServicePackageVariant(overrides = {}) {
  return {
    _id: id(),
    name: "60 minuta",
    slug: "60-minuta",
    sessions: 1,
    duration: 60,
    totalPrice: 3000,
    basePrice: null,
    badge: null,
    isBest: false,
    order: 0,
    isActive: true,
    ...overrides,
  };
}

export function buildService(overrides = {}) {
  return {
    _id: id(),
    name: "Klasicna masaza",
    slug: "klasicna-masaza",
    shortDescription: "Opustajuca masaza celog tela",
    longDescription: "",
    categories: [],
    tags: [],
    image: { img: "/images/services/masaza.webp", imgDesc: "Klasicna masaza" },
    gallery: [],
    videos: [],
    seoKeywords: [],
    defaultDuration: 60,
    highlight: false,
    ctaText: "Zakazi termin",
    features: [],
    packages: [buildServicePackageVariant()],
    comparisonColumns: [],
    comparisonTable: [],
    faq: [],
    employees: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildPackage(overrides = {}) {
  return {
    _id: id(),
    name: "Dan za sebe",
    slug: "dan-za-sebe",
    description: "Kombinovani paket usluga",
    shortDescription: "",
    items: [{ service: buildService(), sessions: 1 }],
    totalPrice: 8000,
    basePrice: null,
    totalDuration: 120,
    badge: null,
    isBest: false,
    order: 0,
    image: null,
    gallery: [],
    videos: [],
    seoKeywords: [],
    categories: [],
    tags: [],
    faq: [],
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildAppointment(overrides = {}) {
  const start = new Date("2026-08-10T10:00:00.000Z");
  return {
    _id: id(),
    user: buildUser(),
    service: buildService(),
    variant: { servicePackageId: id(), name: "60 minuta", duration: 60, price: 3000 },
    employee: null,
    startTime: start,
    endTime: new Date(start.getTime() + 60 * 60000),
    status: "pending",
    rejectedBy: null,
    rejectedAt: null,
    rejectionReason: "",
    confirmedBy: null,
    confirmedAt: null,
    assignedTo: buildEmployee(),
    assignedBy: "system",
    assignedAt: new Date(),
    cancelledBy: null,
    cancelledAt: null,
    cancellationReason: "",
    coupon: null,
    discountApplied: 0,
    finalPrice: 3000,
    note: "",
    contactSnapshot: { firstName: "Marko", lastName: "Markovic", email: "korisnik@example.com", phone: "0601234567" },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildCoupon(overrides = {}) {
  return {
    _id: id(),
    code: "DOBRODOSLI10",
    discountType: "percentage",
    discountValue: 10,
    minAppointmentValue: 0,
    maxUses: null,
    maxUsesPerUser: 1,
    usedCount: 0,
    usageHistory: [],
    applicableServices: [],
    validFrom: new Date("2026-01-01"),
    validUntil: new Date("2026-12-31"),
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildPost(overrides = {}) {
  return {
    _id: id(),
    title: "Kako da se opustite",
    slug: "kako-da-se-opustite",
    excerpt: "Kratak opis posta",
    content: [{ type: "paragraph", text: "Sadrzaj posta", order: 0 }],
    coverImage: { img: "/images/posts/opustanje.webp", imgDesc: "Opustanje" },
    gallery: [],
    categories: [],
    tags: [],
    author: buildUser(),
    status: "draft",
    publishedAt: null,
    seo: { title: "", description: "", keywords: [] },
    isIndexable: true,
    readingTimeMinutes: 1,
    views: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildContact(overrides = {}) {
  return {
    _id: id(),
    firstName: "Jovana",
    lastName: "Jovanovic",
    email: "jovana@example.com",
    phone: "0641234567",
    topic: "Pitanje o uslugama",
    message: "Zdravo, zanima me...",
    consent: true,
    status: "new",
    ip: "127.0.0.1",
    userAgent: "test-agent",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildSubscriber(overrides = {}) {
  return {
    _id: id(),
    email: "pretplatnik@example.com",
    status: "subscribed",
    unsubscribeToken: "abc123",
    subscribedAt: new Date(),
    unsubscribedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function buildTestimonial(overrides = {}) {
  return {
    _id: id(),
    name: "Milica",
    email: "milica@example.com",
    user: null,
    service: buildService(),
    rating: 5,
    message: "Odlicno iskustvo, preporucujem!",
    image: null,
    status: "pending",
    isFeatured: false,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export default {
  id,
  buildRole,
  buildUser,
  buildEmployee,
  buildExpert,
  buildCategory,
  buildTag,
  buildServicePackageVariant,
  buildService,
  buildPackage,
  buildAppointment,
  buildCoupon,
  buildPost,
  buildContact,
  buildSubscriber,
  buildTestimonial,
};