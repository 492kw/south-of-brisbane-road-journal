#!/usr/bin/env node
/* Audit every journal article image at desktop and 390px before publication. */
const { chromium } = require('playwright');

const baseUrl = new URL(process.argv[2] || 'http://127.0.0.1:8000');
baseUrl.search = '';
baseUrl.hash = '';
baseUrl.pathname = baseUrl.pathname.replace(/\/?$/, '/');
const pages = [
  { path: '/', images: 16 },
  { path: '/trip2/', images: 12 },
];
const viewports = [
  { name: 'desktop', width: 1440, height: 1000, groupedWidth: 402 },
  { name: 'mobile390', width: 390, height: 844, groupedWidth: 350, isMobile: true },
];
const failures = [];

function fail(message) {
  failures.push(message);
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  let imageCount = 0;
  for (const viewport of viewports) {
    for (const pageSpec of pages) {
      const path = pageSpec.path;
      const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, isMobile: Boolean(viewport.isMobile), deviceScaleFactor: 1 });
      const page = await context.newPage();
      const consoleErrors = [];
      const pageErrors = [];
      const failedRequests = [];
      page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
      page.on('pageerror', error => pageErrors.push(String(error)));
      page.on('requestfailed', request => failedRequests.push(`${request.url()} (${request.failure()?.errorText || 'failed'})`));
      const url = new URL(baseUrl);
      url.pathname = `${baseUrl.pathname.replace(/\/$/, '')}${path}`;
      url.searchParams.set('image-audit', Date.now().toString());
      const response = await page.goto(url.href, { waitUntil: 'networkidle', timeout: 30000 });
      const expectedPath = url.pathname;
      if (!response || response.status() !== 200) fail(`${viewport.name} ${path}: expected HTTP 200`);
      if (new URL(page.url()).pathname !== expectedPath) fail(`${viewport.name} ${path}: resolved to ${new URL(page.url()).pathname}, expected ${expectedPath}`);
      await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += Math.max(300, innerHeight * 0.65)) {
          scrollTo(0, y);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        await new Promise(resolve => setTimeout(resolve, 500));
        scrollTo(0, 0);
      });
      await page.waitForFunction(() => [...document.querySelectorAll('#article .image-link img')].every(image => image.complete && image.naturalWidth > 0), null, { timeout: 30000 });
      const audit = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        images: [...document.querySelectorAll('#article .image-link img')].map((img, index) => {
          const rect = img.getBoundingClientRect();
          const group = img.closest('.diptych,.triptych,.feature-grid');
          return {
            index: index + 1,
            name: new URL(img.currentSrc || img.src, location.href).pathname.split('/').pop(),
            width: +rect.width.toFixed(1), height: +rect.height.toFixed(1),
            left: +rect.left.toFixed(1), right: +rect.right.toFixed(1),
            naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight,
            complete: img.complete, group: group?.className || null,
            isPanoramaFrame: img.closest('figure')?.classList.contains('panorama') || false,
          };
        }),
      }));
      imageCount += audit.images.length;
      if (audit.images.length !== pageSpec.images) fail(`${viewport.name} ${path}: ${audit.images.length} article images, expected ${pageSpec.images}`);
      if (audit.scrollWidth > audit.clientWidth) fail(`${viewport.name} ${path}: horizontal overflow ${audit.scrollWidth}/${audit.clientWidth}`);
      for (const image of audit.images) {
        if (!image.complete || image.naturalWidth <= 0 || image.width <= 0 || image.height <= 0) fail(`${viewport.name} ${path} ${image.name}: asset did not render`);
        if (image.left < -0.5 || image.right > audit.clientWidth + 0.5) fail(`${viewport.name} ${path} ${image.name}: image rectangle overflows viewport (${image.left}–${image.right}/${audit.clientWidth})`);
        const naturalRatio = image.naturalWidth / image.naturalHeight;
        const renderedRatio = image.width / image.height;
        if (image.isPanoramaFrame) {
          if (Math.abs(renderedRatio - (16 / 9)) / (16 / 9) > 0.01) fail(`${viewport.name} ${path} ${image.name}: unsafe panorama frame ratio`);
        } else if (Math.abs(naturalRatio - renderedRatio) / naturalRatio > 0.01) {
          fail(`${viewport.name} ${path} ${image.name}: distorted aspect ratio`);
        }
      }
      for (const groupName of ['diptych', 'triptych', 'feature-grid']) {
        const images = audit.images.filter(image => image.group?.split(' ').includes(groupName));
        if (!images.length) continue;
        const widths = images.map(image => image.width);
        if (Math.max(...widths) - Math.min(...widths) > 1) fail(`${viewport.name} ${path} .${groupName}: uneven widths ${widths.join(', ')}`);
        if (Math.abs(widths[0] - viewport.groupedWidth) > 2) fail(`${viewport.name} ${path} .${groupName}: ${widths[0]}px, expected approximately ${viewport.groupedWidth}px`);
      }
      for (const locator of await page.locator('#article .image-link img').all()) {
        await locator.scrollIntoViewIfNeeded();
        const selectedSource = await locator.evaluate(image => new URL(image.currentSrc || image.src, location.href).pathname);
        await locator.click();
        const open = await page.locator('dialog.lightbox').evaluate(dialog => dialog.open);
        const lightbox = await page.locator('dialog.lightbox img').evaluate(image => ({ source: new URL(image.currentSrc || image.src, location.href).pathname, loaded: image.complete && image.naturalWidth > 0 }));
        await page.keyboard.press('Escape');
        const closed = await page.locator('dialog.lightbox').evaluate(dialog => !dialog.open);
        if (!open || !lightbox.loaded || lightbox.source !== selectedSource || !closed) fail(`${viewport.name} ${path}: lightbox regression`);
      }
      if (consoleErrors.length) fail(`${viewport.name} ${path}: console errors: ${consoleErrors.join(' | ')}`);
      if (pageErrors.length) fail(`${viewport.name} ${path}: page errors: ${pageErrors.join(' | ')}`);
      if (failedRequests.length) fail(`${viewport.name} ${path}: failed requests: ${failedRequests.join(' | ')}`);
      console.log(`${viewport.name} ${path}: ${audit.images.length} images; grouped widths ${[...new Set(audit.images.filter(image => image.group).map(image => image.width))].join(', ')}px; no overflow/errors; lightbox passed`);
      await context.close();
    }
  }
  await browser.close();
  if (failures.length) {
    console.error(`\nIMAGE AUDIT FAILED:\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }
  console.log(`\nIMAGE AUDIT PASSED: ${imageCount} article-image renders checked across both posts, desktop and 390px mobile.`);
})().catch(error => { console.error(error); process.exit(1); });
