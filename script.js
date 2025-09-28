/* script.js — adjusted to work with your provided index.html + style.css
   - index.html already loads GSAP, CustomEase, SplitType (globals via defer)
   - This file is a module; we import Tweakpane and expose it on window for consistency
*/

import { Pane } from "https://cdn.skypack.dev/tweakpane@4.0.4";
window.Pane = Pane;

/* ------------------------------ GSAP setup ------------------------------ */
if (!window.gsap || !window.CustomEase) {
  console.warn("[script.js] GSAP/CustomEase not found. Check vendor <script> tags in index.html.");
}
const { gsap, CustomEase } = window;
gsap.registerPlugin(CustomEase);
CustomEase.create("hop", "0.9, 0, 0.1, 1");

/* ------------------------------ DOM refs ------------------------------ */
const container = document.querySelector(".container");
const canvas = document.getElementById("canvas");
const overlay = document.getElementById("overlay");
const projectTitleElement = document.querySelector(".project-title p");

if (!container || !canvas || !overlay || !projectTitleElement) {
  console.warn("[script.js] Missing expected elements. Verify index.html structure.");
}

/* ------------------------------ Content ------------------------------ */
const items = [
  "Chromatic Loopscape","Solar Bloom","Neon Handscape","Echo Discs","Void Gaze",
  "Gravity Sync","Heat Core","Fractal Mirage","Nova Pulse","Sonic Horizon",
  "Dream Circuit","Lunar Mesh","Radiant Dusk","Pixel Drift","Vortex Bloom",
  "Shadow Static","Crimson Phase","Retro Cascade","Photon Fold","Zenith Flow"
];

// Replace with your own images if desired
const imageUrls = [
  "assets/image1.jpeg",
  "assets/image2.jpeg",
  "assets/image3.jpeg",
  "assets/image4.jpeg",
  "assets/image5.jpeg",
  "assets/image6.jpeg",
  "assets/image8.jpeg"
];

/* ------------------------------ Settings (split item vs page vignette) ------------------------------ */
const settings = {
  // Item sizes
  baseWidth: 400,
  smallHeight: 330,
  largeHeight: 500,
  itemGap: 65,

  // Motion
  hoverScale: 1.05,
  expandedScale: 0.4,     // % of viewport width
  dragEase: 0.075,
  momentumFactor: 200,
  bufferZone: 3,

  // Style
  borderRadius: 0,
  itemVignetteSize: 0,    // <- was "vignetteSize"

  // Page vignette (distinct from item vignette)
  pageVignetteStrength: 0.7,
  pageVignetteSize: 200,

  // Overlay
  overlayOpacity: 0.9,
  overlayEaseDuration: 0.8,

  // Animation
  zoomDuration: 0.6
};

let itemSizes = [
  { width: settings.baseWidth, height: settings.smallHeight },
  { width: settings.baseWidth, height: settings.largeHeight }
];
let itemGap = settings.itemGap;
let columns = 4;
const itemCount = items.length;

let cellWidth  = settings.baseWidth + settings.itemGap;
let cellHeight = Math.max(settings.smallHeight, settings.largeHeight) + settings.itemGap;

/* Drag state */
let isDragging = false;
let startX, startY;
let targetX = 0, targetY = 0;
let currentX = 0, currentY = 0;
let dragVelocityX = 0, dragVelocityY = 0;
let lastDragTime = 0;
let mouseHasMoved = false;

/* Virtualization */
let visibleItems = new Set();
let lastUpdateTime = 0;
let lastX = 0, lastY = 0;

/* Expansion */
let isExpanded = false;
let activeItem = null;
let activeItemId = null;
let canDrag = true;
let originalPosition = null;
let expandedItem = null;
let overlayAnimation = null;

/* Title split */
let titleSplit = null;

/* Tweakpane */
let paneInstance = null;

/* ------------------------------ CSS variables helpers ------------------------------ */
const setVar = (name, value) => document.documentElement.style.setProperty(name, value);

function updateBorderRadius() {
  setVar("--border-radius", `${settings.borderRadius}px`);
}
function updateItemVignetteSize() {
  setVar("--vignette-size", `${settings.itemVignetteSize}px`);
}
function updatePageVignette() {
  const strength = settings.pageVignetteStrength;
  const size = settings.pageVignetteSize;

  setVar("--page-vignette-size",         `${size * 1.5}px`);
  setVar("--page-vignette-color",        `rgba(0,0,0,${strength * 0.7})`);

  setVar("--page-vignette-strong-size",  `${size * 0.75}px`);
  setVar("--page-vignette-strong-color", `rgba(0,0,0,${strength * 0.85})`);

  setVar("--page-vignette-extreme-size", `${size * 0.4}px`);
  setVar("--page-vignette-extreme-color",`rgba(0,0,0,${strength})`);
}
function updateHoverScale() {
  setVar("--hover-scale", settings.hoverScale);
  document.querySelectorAll(".item img").forEach(img => {
    img.style.transition = "transform 0.3s ease";
  });
}

/* ------------------------------ Title animations ------------------------------ */
function setAndAnimateTitle(title) {
  if (!window.SplitType) return;
  if (titleSplit && titleSplit.revert) titleSplit.revert();
  projectTitleElement.textContent = title;
  titleSplit = new window.SplitType(projectTitleElement, { types: "words" });
  gsap.set(titleSplit.words, { y: "100%" });
}
function animateTitleIn() {
  if (!titleSplit) return;
  gsap.fromTo(titleSplit.words,
    { y: "100%", opacity: 0 },
    { y: "0%",   opacity: 1, duration: 1, stagger: 0.1, ease: "power3.out" }
  );
}
function animateTitleOut() {
  if (!titleSplit) return;
  gsap.to(titleSplit.words, { y: "-100%", opacity: 0, duration: 1, stagger: 0.1, ease: "power3.out" });
}

/* ------------------------------ Overlay animations ------------------------------ */
function animateOverlayIn() {
  if (overlayAnimation) overlayAnimation.kill();
  overlay.classList.add("active");
  overlayAnimation = gsap.to(overlay, {
    opacity: settings.overlayOpacity,
    duration: settings.overlayEaseDuration,
    ease: "power2.inOut",
    overwrite: true
  });
}
function animateOverlayOut() {
  if (overlayAnimation) overlayAnimation.kill();
  overlayAnimation = gsap.to(overlay, {
    opacity: 0,
    duration: settings.overlayEaseDuration,
    ease: "power2.inOut",
    onComplete: () => overlay.classList.remove("active")
  });
}

/* ------------------------------ Grid helpers ------------------------------ */
function getItemSize(row, col) {
  const sizeIndex = Math.abs((row * columns + col) % itemSizes.length);
  return itemSizes[sizeIndex];
}
function getItemId(col, row) {
  return `${col},${row}`;
}
function getItemPosition(col, row) {
  return { x: col * cellWidth, y: row * cellHeight };
}

/* ------------------------------ Virtualized render ------------------------------ */
function updateVisibleItems() {
  if (!canvas) return;

  const buffer = settings.bufferZone;
  const viewW = window.innerWidth * (1 + buffer);
  const viewH = window.innerHeight * (1 + buffer);

  const startCol = Math.floor((-currentX - viewW / 2) * 1 / cellWidth);
  const endCol   = Math.ceil( (-currentX + viewW * 1.5) * 1 / cellWidth);
  const startRow = Math.floor((-currentY - viewH / 2) * 1 / cellHeight);
  const endRow   = Math.ceil( (-currentY + viewH * 1.5) * 1 / cellHeight);

  const nowVisible = new Set();

  for (let row = startRow; row <= endRow; row++) {
    for (let col = startCol; col <= endCol; col++) {
      const id = getItemId(col, row);
      nowVisible.add(id);

      if (visibleItems.has(id)) continue;
      if (activeItemId === id && isExpanded) continue;

      const size = getItemSize(row, col);
      const pos  = getItemPosition(col, row);

      const item = document.createElement("div");
      item.className = "item";
      item.id = id;
      item.style.width  = `${size.width}px`;
      item.style.height = `${size.height}px`;
      item.style.left   = `${pos.x}px`;
      item.style.top    = `${pos.y}px`;
      item.dataset.col = col;
      item.dataset.row = row;
      item.dataset.width = size.width;
      item.dataset.height = size.height;

      const idx = Math.abs((row * columns + col) % itemCount);

      const imgWrap = document.createElement("div");
      imgWrap.className = "item-image-container";
      const img = document.createElement("img");
      img.src = imageUrls[idx % imageUrls.length];
      img.alt = items[idx];
      imgWrap.appendChild(img);
      item.appendChild(imgWrap);

      const cap = document.createElement("div");
      cap.className = "item-caption";
      const name = document.createElement("div");
      name.className = "item-name";
      name.textContent = items[idx];
      const num = document.createElement("div");
      num.className = "item-number";
      num.textContent = `#${String(idx + 1).padStart(5, "0")}`;
      cap.appendChild(name);
      cap.appendChild(num);
      item.appendChild(cap);

      item.addEventListener("click", () => {
        if (mouseHasMoved || isDragging) return;
        handleItemClick(item, idx);
      });

      canvas.appendChild(item);
      visibleItems.add(id);
    }
  }

  // cleanup
  visibleItems.forEach((id) => {
    if (!nowVisible.has(id) || (activeItemId === id && isExpanded)) {
      const el = document.getElementById(id);
      if (el && el.parentNode === canvas) canvas.removeChild(el);
      visibleItems.delete(id);
    }
  });
}

/* ------------------------------ Expand / Close ------------------------------ */
function handleItemClick(item, itemIndex) {
  if (isExpanded) {
    if (expandedItem) closeExpandedItem();
  } else {
    expandItem(item, itemIndex);
  }
}

function expandItem(item, itemIndex) {
  isExpanded = true;
  activeItem = item;
  activeItemId = item.id;
  canDrag = false;
  container.style.cursor = "auto";

  const imgSrc = item.querySelector("img").src;
  const titleIndex = itemIndex % items.length;
  const w = parseInt(item.dataset.width, 10);
  const h = parseInt(item.dataset.height, 10);

  setAndAnimateTitle(items[titleIndex]);

  // caption clone out
  const captionEl = item.querySelector(".item-caption");
  const nameEl = captionEl.querySelector(".item-name");
  const numberEl = captionEl.querySelector(".item-number");
  const nameText = nameEl.textContent;
  const numberText = numberEl.textContent;

  const captionClone = captionEl.cloneNode(true);
  captionClone.classList.add("caption-clone");
  const rectCap = captionEl.getBoundingClientRect();
  captionClone.style.left = `${rectCap.left}px`;
  captionClone.style.bottom = `${window.innerHeight - rectCap.bottom}px`;
  captionClone.style.width = `${rectCap.width}px`;
  captionClone.style.zIndex = "10002";
  document.body.appendChild(captionClone);

  captionEl.style.opacity = "0";

  const nameCloneSplit = new window.SplitType(captionClone.querySelector(".item-name"), { types: "words" });
  const numberCloneSplit = new window.SplitType(captionClone.querySelector(".item-number"), { types: "words" });

  gsap.to(nameCloneSplit.words,   { y: "100%", opacity: 0, duration: 0.6, stagger: 0.03, ease: "power3.in" });
  gsap.to(numberCloneSplit.words, {
    y: "100%", opacity: 0, duration: 0.6, stagger: 0.02, delay: 0.05, ease: "power3.in",
    onComplete: () => captionClone.remove()
  });

  const rect = item.getBoundingClientRect();
  originalPosition = {
    id: item.id, rect, imgSrc, width: w, height: h, nameText, numberText
  };

  animateOverlayIn();

  expandedItem = document.createElement("div");
  expandedItem.className = "expanded-item";
  expandedItem.style.width = `${w}px`;
  expandedItem.style.height = `${h}px`;
  expandedItem.style.zIndex = "10000";
  expandedItem.style.borderRadius = `var(--border-radius, 0px)`;

  const img = document.createElement("img");
  img.src = imgSrc;
  expandedItem.appendChild(img);
  expandedItem.addEventListener("click", closeExpandedItem);
  document.body.appendChild(expandedItem);

  // fade out others
  document.querySelectorAll(".item").forEach((el) => {
    if (el !== activeItem) gsap.to(el, { opacity: 0, duration: settings.overlayEaseDuration, ease: "power2.inOut" });
  });

  const viewportWidth = window.innerWidth;
  const targetWidth = viewportWidth * settings.expandedScale;
  const aspectRatio = h / w;
  const targetHeight = targetWidth * aspectRatio;

  gsap.delayedCall(0.5, animateTitleIn);

  gsap.fromTo(
    expandedItem,
    { width: w, height: h,
      x: rect.left + w / 2 - window.innerWidth / 2,
      y: rect.top  + h / 2 - window.innerHeight / 2 },
    { width: targetWidth, height: targetHeight, x: 0, y: 0,
      duration: settings.zoomDuration, ease: "hop" }
  );
}

function closeExpandedItem() {
  if (!expandedItem || !originalPosition) return;

  animateTitleOut();
  animateOverlayOut();

  // fade others back
  document.querySelectorAll(".item").forEach((el) => {
    if (el.id !== activeItemId) gsap.to(el, { opacity: 1, duration: settings.overlayEaseDuration, delay: 0.3, ease: "power2.inOut" });
  });

  const originalItem = document.getElementById(activeItemId);
  if (originalItem) {
    const captionEl = originalItem.querySelector(".item-caption");
    const nameEl = captionEl.querySelector(".item-name");
    const numberEl = captionEl.querySelector(".item-number");
    nameEl.textContent = originalPosition.nameText;
    numberEl.textContent = originalPosition.numberText;
    captionEl.style.opacity = "0";
  }

  const { rect, width: w, height: h } = originalPosition;

  gsap.to(expandedItem, {
    width: w, height: h,
    x: rect.left + w / 2 - window.innerWidth / 2,
    y: rect.top  + h / 2 - window.innerHeight / 2,
    duration: settings.zoomDuration, ease: "hop",
    onComplete: () => {
      // caption clone in
      if (originalItem) {
        const captionEl = originalItem.querySelector(".item-caption");
        const capRect = captionEl.getBoundingClientRect();

        const clone = document.createElement("div");
        clone.className = "caption-clone";
        clone.innerHTML = captionEl.innerHTML;
        clone.style.position = "fixed";
        clone.style.left = `${capRect.left}px`;
        clone.style.bottom = `${window.innerHeight - capRect.bottom}px`;
        clone.style.width = `${capRect.width}px`;
        clone.style.padding = "10px";
        clone.style.zIndex = "10002";
        document.body.appendChild(clone);

        const nameSplit = new window.SplitType(clone.querySelector(".item-name"), { types: "words" });
        const numSplit  = new window.SplitType(clone.querySelector(".item-number"), { types: "words" });
        gsap.set([nameSplit.words, numSplit.words], { y: "100%", opacity: 0 });
        gsap.to(nameSplit.words, { y: "0%", opacity: 1, duration: 0.7, stagger: 0.03, ease: "power3.out" });
        gsap.to(numSplit.words,  {
          y: "0%", opacity: 1, duration: 0.7, stagger: 0.02, delay: 0.05, ease: "power3.out",
          onComplete: () => { captionEl.style.opacity = "1"; clone.remove(); }
        });
      }

      expandedItem.remove();
      expandedItem = null;
      isExpanded = false;
      activeItem = null;
      originalPosition = null;
      activeItemId = null;
      canDrag = true;
      container.style.cursor = "grab";
      dragVelocityX = 0; dragVelocityY = 0;
    }
  });
}

/* ------------------------------ Drag + momentum ------------------------------ */
function animateLoop() {
  if (canDrag) {
    const ease = settings.dragEase;
    currentX += (targetX - currentX) * ease;
    currentY += (targetY - currentY) * ease;
    canvas.style.transform = `translate(${currentX}px, ${currentY}px)`;

    const now = Date.now();
    const dist = Math.hypot(currentX - lastX, currentY - lastY);
    if (dist > 100 || now - lastUpdateTime > 120) {
      updateVisibleItems();
      lastX = currentX; lastY = currentY;
      lastUpdateTime = now;
    }
  }
  requestAnimationFrame(animateLoop);
}

container.addEventListener("mousedown", (e) => {
  if (!canDrag) return;
  isDragging = true;
  mouseHasMoved = false;
  startX = e.clientX;
  startY = e.clientY;
  container.style.cursor = "grabbing";
});
window.addEventListener("mousemove", (e) => {
  if (!isDragging || !canDrag) return;
  const dx = e.clientX - startX;
  const dy = e.clientY - startY;
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) mouseHasMoved = true;

  const now = Date.now();
  const dt = Math.max(10, now - lastDragTime);
  lastDragTime = now;
  dragVelocityX = dx / dt;
  dragVelocityY = dy / dt;

  targetX += dx;
  targetY += dy;
  startX = e.clientX;
  startY = e.clientY;
});
window.addEventListener("mouseup", () => {
  if (!isDragging) return;
  isDragging = false;
  if (canDrag) {
    container.style.cursor = "grab";
    if (Math.abs(dragVelocityX) > 0.1 || Math.abs(dragVelocityY) > 0.1) {
      targetX += dragVelocityX * settings.momentumFactor;
      targetY += dragVelocityY * settings.momentumFactor;
    }
  }
});

/* touch */
container.addEventListener("touchstart", (e) => {
  if (!canDrag) return;
  isDragging = true;
  mouseHasMoved = false;
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener("touchmove", (e) => {
  if (!isDragging || !canDrag) return;
  const dx = e.touches[0].clientX - startX;
  const dy = e.touches[0].clientY - startY;
  if (Math.abs(dx) > 5 || Math.abs(dy) > 5) mouseHasMoved = true;

  targetX += dx;
  targetY += dy;
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
}, { passive: true });

window.addEventListener("touchend", () => {
  isDragging = false;
});

/* overlay click closes expanded */
overlay.addEventListener("click", () => { if (isExpanded) closeExpandedItem(); });

/* ------------------------------ Tweakpane ------------------------------ */
function initTweakpane() {
  if (!window.Pane) return;

  paneInstance = new window.Pane({
    title: "Gallery Settings",
    expanded: false
  });

  const el = paneInstance.element;
  el.style.position = "fixed";
  el.style.top = "10px";
  el.style.right = "10px";
  el.style.zIndex = "10000";

  // Item sizes
  const sizeFolder = paneInstance.addFolder({ title: "Item Sizes", expanded: false });
  sizeFolder.addBinding(settings, "baseWidth",   { min: 100, max: 600, step: 10 }).on("change", updateSettings);
  sizeFolder.addBinding(settings, "smallHeight", { min: 100, max: 400, step: 10 }).on("change", updateSettings);
  sizeFolder.addBinding(settings, "largeHeight", { min: 100, max: 600, step: 10 }).on("change", updateSettings);

  // Layout
  const layoutFolder = paneInstance.addFolder({ title: "Layout", expanded: false });
  layoutFolder.addBinding(settings, "itemGap",    { min: 0,   max: 100, step: 5  }).on("change", updateSettings);
  layoutFolder.addBinding(settings, "bufferZone", { min: 1,   max: 5,   step: 0.5}).on("change", updateSettings);

  // Style
  const styleFolder = paneInstance.addFolder({ title: "Style", expanded: false });
  styleFolder.addBinding(settings, "borderRadius",     { min: 0,  max: 16,  step: 1 }).on("change", updateBorderRadius);
  styleFolder.addBinding(settings, "itemVignetteSize", { min: 0,  max: 50,  step: 1 }).on("change", updateItemVignetteSize);

  // Page vignette
  const pageFolder = paneInstance.addFolder({ title: "Page Vignette", expanded: false });
  pageFolder.addBinding(settings, "pageVignetteStrength", { min: 0, max: 1,   step: 0.05 }).on("change", updatePageVignette);
  pageFolder.addBinding(settings, "pageVignetteSize",     { min: 0, max: 500, step: 10   }).on("change", updatePageVignette);

  // Overlay
  const overlayFolder = paneInstance.addFolder({ title: "Overlay Animation", expanded: false });
  overlayFolder.addBinding(settings, "overlayOpacity",       { min: 0,   max: 1,  step: 0.05 });
  overlayFolder.addBinding(settings, "overlayEaseDuration",  { min: 0.2, max: 2,  step: 0.1  });

  // Animation
  const animFolder = paneInstance.addFolder({ title: "Animation", expanded: false });
  animFolder.addBinding(settings, "hoverScale",    { min: 1,   max: 1.5, step: 0.05 }).on("change", updateHoverScale);
  animFolder.addBinding(settings, "expandedScale", { min: 0.2, max: 0.8, step: 0.05 });
  animFolder.addBinding(settings, "dragEase",      { min: 0.01,max: 0.2, step: 0.01 });
  animFolder.addBinding(settings, "momentumFactor",{ min: 50,  max: 500, step: 10   });
  animFolder.addBinding(settings, "zoomDuration",  { min: 0.2, max: 1.5, step: 0.1  });

  paneInstance.addButton({ title: "Reset View" }).on("click", () => { targetX = 0; targetY = 0; });

  // 'H' toggles pane and header/footer (to match your UI hint)
  window.addEventListener("keydown", (e) => {
    if ((e.key === "h" || e.key === "H") && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      el.style.display = (el.style.display === "none") ? "" : "none";
      document.body.classList.toggle("panel-collapsed");
    }
  });

  // Tooltip for the hint chip if present
  const hint = document.querySelector(".links-section .key-hint");
  if (hint) hint.setAttribute("title", "Press H to toggle panel");
}

/* ------------------------------ Settings recompute ------------------------------ */
function updateSettings() {
  itemSizes = [
    { width: settings.baseWidth, height: settings.smallHeight },
    { width: settings.baseWidth, height: settings.largeHeight }
  ];
  itemGap  = settings.itemGap;
  columns  = 4; // keep consistent

  cellWidth  = settings.baseWidth + settings.itemGap;
  cellHeight = Math.max(settings.smallHeight, settings.largeHeight) + settings.itemGap;

  // clear and re-render
  visibleItems.forEach((id) => {
    const node = document.getElementById(id);
    if (node && node.parentNode === canvas) canvas.removeChild(node);
  });
  visibleItems.clear();
  updateVisibleItems();

  // refresh styles
  updateBorderRadius();
  updateItemVignetteSize();
  updateHoverScale();
  updatePageVignette();
}

/* ------------------------------ Init & resize ------------------------------ */
function initializeStyles() {
  updateBorderRadius();
  updateItemVignetteSize();
  updateHoverScale();
  updatePageVignette();
}

window.addEventListener("resize", () => {
  if (isExpanded && expandedItem && originalPosition) {
    const vw = window.innerWidth;
    const targetWidth = vw * settings.expandedScale;
    const aspect = originalPosition.height / originalPosition.width;
    const targetHeight = targetWidth * aspect;
    gsap.to(expandedItem, { width: targetWidth, height: targetHeight, duration: 0.3, ease: "power2.out" });
  } else {
    updateVisibleItems();
  }
});

/* ------------------------------ Boot ------------------------------ */
initializeStyles();
updateVisibleItems();
animateLoop();
setTimeout(initTweakpane, 300);
