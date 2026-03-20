import {load} from "cheerio";
import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, "..");
const siteRoot = path.join(webRoot, "site");

const origin = "https://ephilium.com";
const ephiliumHosts = new Set([
  "ephilium.com",
  "www.ephilium.com",
  "www.ephilium.ai",
]);

const pageRoutes = [
  "/",
  "/about",
  "/resources",
  "/how-it-works",
  "/contact",
];

const localPages = new Set(pageRoutes);
const assetHosts = new Set(["cdn.b12.io", "code.jquery.com"]);
const assetFilePattern =
  /\.(?:avif|bmp|css|eot|gif|ico|jpeg|jpg|js|json|mp4|otf|png|svg|ttf|webm|webp|woff2?|xml)$/i;

const assetMap = new Map();

const getPageUrl = (route) => new URL(route === "/" ? "/" : route, origin).toString();

const toAbsoluteUrl = (value) => {
  if (!value) {
    return null;
  }

  if (
    value.startsWith("#") ||
    value.startsWith("data:") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("javascript:")
  ) {
    return null;
  }

  if (value.startsWith("//")) {
    return `https:${value}`;
  }

  try {
    return new URL(value, origin).toString();
  } catch {
    return null;
  }
};

const normalizePathname = (pathname) => pathname.replace(/\/+$/, "") || "/";

const isSameSiteAsset = (parsedUrl) => {
  return (
    ephiliumHosts.has(parsedUrl.hostname) &&
    (parsedUrl.pathname.startsWith("/assets/") ||
      assetFilePattern.test(parsedUrl.pathname))
  );
};

const isMirrorAsset = (value) => {
  const absoluteUrl = toAbsoluteUrl(value);
  if (!absoluteUrl) {
    return false;
  }

  const parsedUrl = new URL(absoluteUrl);
  return assetHosts.has(parsedUrl.hostname) || isSameSiteAsset(parsedUrl);
};

const buildLocalAssetUrl = (absoluteUrl) => {
  const parsedUrl = new URL(absoluteUrl);
  if (isSameSiteAsset(parsedUrl) && parsedUrl.pathname.startsWith("/assets/")) {
    return parsedUrl.pathname;
  }

  const sanitizedPath = parsedUrl.pathname.startsWith("/")
    ? parsedUrl.pathname.slice(1)
    : parsedUrl.pathname;
  return `/vendor/${parsedUrl.hostname}/${sanitizedPath}`;
};

const buildAssetFilePath = (localAssetUrl) => {
  return path.join(siteRoot, localAssetUrl.replace(/^\//, ""));
};

const ensureAsset = async (value) => {
  const absoluteUrl = toAbsoluteUrl(value);
  if (!absoluteUrl || assetMap.has(absoluteUrl)) {
    return;
  }

  const parsedUrl = new URL(absoluteUrl);
  const localAssetUrl = buildLocalAssetUrl(absoluteUrl);
  const assetFilePath = buildAssetFilePath(localAssetUrl);
  const candidateUrls = [absoluteUrl];

  if (isSameSiteAsset(parsedUrl)) {
    candidateUrls.push(`https://www.ephilium.ai${parsedUrl.pathname}${parsedUrl.search}`);
  }

  await mkdir(path.dirname(assetFilePath), {recursive: true});
  for (const candidateUrl of candidateUrls) {
    const response = await fetch(candidateUrl);
    if (!response.ok) {
      continue;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    await writeFile(assetFilePath, buffer);
    assetMap.set(absoluteUrl, localAssetUrl);
    assetMap.set(candidateUrl, localAssetUrl);
    return;
  }

  if (parsedUrl.pathname.startsWith("/assets/fonts/")) {
    console.warn(`Skipping missing font asset: ${absoluteUrl}`);
    return;
  }

  throw new Error(`Failed to download asset ${absoluteUrl}`);
};

const collectCssUrls = (text, targetSet) => {
  if (!text) {
    return;
  }

  const urlPattern = /url\(([^)]+)\)/g;
  for (const match of text.matchAll(urlPattern)) {
    const value = match[1]?.trim().replace(/^['"]|['"]$/g, "");
    if (value && isMirrorAsset(value)) {
      targetSet.add(value);
    }
  }
};

const collectAssetUrls = ($) => {
  const urls = new Set();

  $("[src]").each((_, element) => {
    const value = $(element).attr("src");
    if (value && isMirrorAsset(value)) {
      urls.add(value);
    }
  });

  $("[href]").each((_, element) => {
    const value = $(element).attr("href");
    if (value && isMirrorAsset(value)) {
      urls.add(value);
    }
  });

  $("[content]").each((_, element) => {
    const value = $(element).attr("content");
    if (value && isMirrorAsset(value)) {
      urls.add(value);
    }
  });

  $("[style]").each((_, element) => {
    collectCssUrls($(element).attr("style"), urls);
  });

  $("style").each((_, element) => {
    collectCssUrls($(element).html(), urls);
  });

  return [...urls];
};

const replaceMappedUrls = (text) => {
  if (!text) {
    return text;
  }

  let output = text;
  for (const [absoluteUrl, localAssetUrl] of assetMap.entries()) {
    output = output.split(absoluteUrl).join(localAssetUrl);
  }

  return output;
};

const rewriteNavigationUrl = (value) => {
  if (!value || isMirrorAsset(value)) {
    return value;
  }

  if (
    value.startsWith("#") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("javascript:") ||
    value.startsWith("data:")
  ) {
    return value;
  }

  const absoluteUrl = toAbsoluteUrl(value);
  if (!absoluteUrl) {
    return value;
  }

  const parsedUrl = new URL(absoluteUrl);
  if (!ephiliumHosts.has(parsedUrl.hostname)) {
    return value;
  }

  const normalizedPath = normalizePathname(parsedUrl.pathname);
  if (normalizedPath === "/" || normalizedPath === "/index") {
    return `/${parsedUrl.hash || ""}`;
  }

  if (localPages.has(normalizedPath)) {
    return `${normalizedPath}${parsedUrl.hash || ""}`;
  }

  return `https://ephilium.com${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
};

const removeExternalScripts = ($) => {
  $("script").each((_, element) => {
    const script = $(element);
    const src = script.attr("src") || "";
    const content = script.html() || "";
    const scriptBody = `${src}\n${content}`;

    if (
      scriptBody.includes("googletagmanager.com") ||
      scriptBody.includes("gtag(") ||
      scriptBody.includes("js.hsforms.net") ||
      scriptBody.includes("google.com/recaptcha") ||
      scriptBody.includes("cdn.b12.io/prod_traffic/global.js")
    ) {
      script.remove();
    }
  });
};

const rewriteDom = ($) => {
  $("[src]").each((_, element) => {
    const node = $(element);
    const value = node.attr("src");
    if (!value) {
      return;
    }

    if (isMirrorAsset(value)) {
      const absoluteUrl = toAbsoluteUrl(value);
      node.attr("src", assetMap.get(absoluteUrl) || value);
      return;
    }

    if (element.tagName === "iframe") {
      return;
    }

    node.attr("src", rewriteNavigationUrl(value));
  });

  $("[href]").each((_, element) => {
    const node = $(element);
    const value = node.attr("href");
    if (!value) {
      return;
    }

    if (isMirrorAsset(value)) {
      const absoluteUrl = toAbsoluteUrl(value);
      node.attr("href", assetMap.get(absoluteUrl) || value);
      return;
    }

    node.attr("href", rewriteNavigationUrl(value));
  });

  $("[content]").each((_, element) => {
    const node = $(element);
    const value = node.attr("content");
    if (!value || !isMirrorAsset(value)) {
      return;
    }

    const absoluteUrl = toAbsoluteUrl(value);
    node.attr("content", assetMap.get(absoluteUrl) || value);
  });

  $("body").append('\n<script src="/_local/local.js"></script>\n');
};

const writePage = async (route, html) => {
  const outputPath =
    route === "/"
      ? path.join(siteRoot, "index.html")
      : path.join(siteRoot, route.replace(/^\//, ""), "index.html");

  await mkdir(path.dirname(outputPath), {recursive: true});
  await writeFile(outputPath, html);
};

const mirrorPage = async (route) => {
  const response = await fetch(getPageUrl(route));
  if (!response.ok) {
    throw new Error(`Failed to fetch page ${route}: ${response.status}`);
  }

  const rawHtml = await response.text();
  const $ = load(rawHtml, {decodeEntities: false});

  removeExternalScripts($);

  const assetUrls = collectAssetUrls($);
  for (const assetUrl of assetUrls) {
    await ensureAsset(assetUrl);
  }

  rewriteDom($);

  $("style").each((_, element) => {
    const styleTag = $(element);
    styleTag.html(replaceMappedUrls(styleTag.html()));
  });

  $("[style]").each((_, element) => {
    const node = $(element);
    node.attr("style", replaceMappedUrls(node.attr("style")));
  });

  const html = "<!doctype html>\n" + replaceMappedUrls($.html());
  await writePage(route, html);
  console.log(`Mirrored ${route}`);
};

await mkdir(siteRoot, {recursive: true});

for (const route of pageRoutes) {
  await mirrorPage(route);
}
