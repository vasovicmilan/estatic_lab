import postRepo from "../repositories/post.repository.js";
import postService from "./post.service.js";
import productService from "./product.service.js";
import serviceService from "./service.service.js";
import packageService from "./package.service.js";
import orderService from "./order.service.js";
import resourceService from "./resource.service.js";

const EMPTY = { total: 0, data: [] };
const has = (permissions, p) => (permissions || []).includes(p);
const newest = { createdAt: -1 };

/** Everything the blog overview shows. */
export async function getBlogDashboard() {
  const [stats, scheduled, drafts, top, recent] = await Promise.all([
    postRepo.getPostStats(),
    postService.listPosts({ filters: { status: "scheduled" }, sort: { scheduledFor: 1 }, limit: 6 }),
    postService.listPosts({ filters: { status: "draft" }, sort: { updatedAt: -1 }, limit: 6 }),
    postService.listPosts({ filters: { status: "published" }, sort: { views: -1 }, limit: 6 }),
    postService.listPosts({ filters: { status: "published" }, sort: { publishedAt: -1 }, limit: 6 }),
  ]);
  return { stats, scheduled: scheduled.data, drafts: drafts.data, top: top.data, recent: recent.data };
}

/** Shop overview; orders only for roles that may open them. */
export async function getShopDashboard({ permissions } = {}) {
  const canOrders = has(permissions, "manage_orders");
  const [active, inactive, outOfStock, recent, pendingOrders] = await Promise.all([
    productService.listProducts({ filters: { isActive: true }, limit: 1 }),
    productService.listProducts({ filters: { isActive: false }, sort: newest, limit: 6 }),
    productService.listProducts({ filters: { isActive: true, inStock: false }, sort: newest, limit: 8 }),
    productService.listProducts({ filters: {}, sort: newest, limit: 6 }),
    canOrders ? orderService.findOrders({ role: "admin", filters: { status: "pending" }, limit: 6 }) : Promise.resolve(EMPTY),
  ]);
  return {
    canOrders,
    stats: { active: active.total, inactive: inactive.total, outOfStock: outOfStock.total, pendingOrders: pendingOrders.total },
    inactive: inactive.data,
    outOfStock: outOfStock.data,
    recent: recent.data,
    pendingOrders: pendingOrders.data,
  };
}

/** Services + packages overview; each half only for the permission that opens it. */
export async function getCatalogDashboard({ permissions } = {}) {
  const canServices = has(permissions, "manage_services");
  const canPackages = has(permissions, "manage_packages");
  const canResources = has(permissions, "manage_resources");
  const [servActive, servInactive, servRecent, pkgActive, pkgInactive, pkgRecent, resources] = await Promise.all([
    canServices ? serviceService.listServices({ filters: { isActive: true }, limit: 1 }) : EMPTY,
    canServices ? serviceService.listServices({ filters: { isActive: false }, sort: newest, limit: 6 }) : EMPTY,
    canServices ? serviceService.listServices({ filters: {}, sort: newest, limit: 6 }) : EMPTY,
    canPackages ? packageService.listPackages({ filters: { isActive: true }, limit: 1 }) : EMPTY,
    canPackages ? packageService.listPackages({ filters: { isActive: false }, sort: newest, limit: 6 }) : EMPTY,
    canPackages ? packageService.listPackages({ filters: {}, sort: newest, limit: 6 }) : EMPTY,
    canResources ? resourceService.listResources({ isActive: false, limit: 1 }) : EMPTY,
  ]);
  return {
    canServices,
    canPackages,
    canResources,
    stats: {
      activeServices: servActive.total,
      inactiveServices: servInactive.total,
      activePackages: pkgActive.total,
      inactivePackages: pkgInactive.total,
      inactiveResources: resources.total,
    },
    inactiveServices: servInactive.data,
    recentServices: servRecent.data,
    inactivePackages: pkgInactive.data,
    recentPackages: pkgRecent.data,
  };
}

export default { getBlogDashboard, getShopDashboard, getCatalogDashboard };
