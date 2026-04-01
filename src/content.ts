const MAX_PROGRESS = 226;

const formatDuration = (duration: number): string => {
  if (!isNaN(duration)) {
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  } else {
    return "00:00";
  }
};

const getAudioElement = (): HTMLAudioElement | null => {
  return document.querySelector("audio[src*='bcbits.com']");
};

// ---------------------------------------------------------------------------
// Tralbum data helpers
// ---------------------------------------------------------------------------


interface TralbumCurrent {
  minimum_price: number | null;
  set_price: number | null;
  title: string;
  band_id: number;
  id: number;
}

interface TralbumData {
  item_type: string;
  current: TralbumCurrent;
  trackinfo?: { title_link?: string }[];
}

const getTralbumData = (): TralbumData | null => {
  const el = document.querySelector<HTMLElement>("[data-tralbum]");
  if (!el) return null;
  try {
    return JSON.parse(el.dataset.tralbum!) as TralbumData;
  } catch (e) {
    return null;
  }
};


// ---------------------------------------------------------------------------
// Buy-link replacement on album pages
// ---------------------------------------------------------------------------

interface TrackData {
  minimum_price: number | null;
  item_id: number;
  band_id: number;
}

const fetchTrackData = async (path: string): Promise<TrackData | null> => {
  try {
    const res = await fetch(path);
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, "text/html");
    const el = doc.querySelector<HTMLElement>("[data-tralbum]");
    if (!el) return null;
    const data = JSON.parse(el.dataset.tralbum!) as TralbumData;
    return {
      minimum_price: data.current.minimum_price,
      item_id: data.current.id,
      band_id: data.current.band_id,
    };
  } catch {
    return null;
  }
};

const getCartMeta = (): { fanId: number | null; clientId: string | null; syncNum: number } => {
  const fanEl = document.querySelector<HTMLElement>("[data-band-follow-info]");
  const cartEl = document.querySelector<HTMLElement>("[data-cart]");
  const fanId = fanEl ? (JSON.parse(fanEl.dataset.bandFollowInfo!).fan_id ?? null) : null;
  const syncNum = cartEl ? (JSON.parse(cartEl.dataset.cart!).sync_num ?? 0) : 0;
  const clientId = document.cookie.match(/cart_client_id=([^;]+)/)?.[1] ?? null;
  return { fanId, clientId, syncNum };
};

const updateCartSyncNum = (syncNum: number): void => {
  const cartEl = document.querySelector<HTMLElement>("[data-cart]");
  if (!cartEl) return;
  const cart = JSON.parse(cartEl.dataset.cart!);
  cart.sync_num = syncNum;
  cartEl.dataset.cart = JSON.stringify(cart);
};

const addToCart = async (itemId: number, bandId: number, price: number): Promise<void> => {
  const { fanId, clientId, syncNum } = getCartMeta();
  const params = new URLSearchParams({
    req: "add",
    local_id: String(Math.random()),
    item_type: "t",
    item_id: String(itemId),
    unit_price: String(price),
    quantity: "1",
    band_id: String(bandId),
    fan_id: String(fanId ?? ""),
    client_id: clientId ?? "",
    sync_num: String(syncNum),
    req_id: String(Math.random()),
  });
  const res = await fetch("/cart/cb", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
  const json = await res.json() as { error?: string; resync?: boolean; sync_num?: number };
  if (json.error) throw new Error(json.error);
  if (json.resync) throw new Error("cart resync, try again");
  if (json.sync_num != null) updateCartSyncNum(json.sync_num);
};

const replaceBuyLinks = (): void => {
  const data = getTralbumData();
  if (!data || !data.trackinfo) return;

  document.querySelectorAll("td.download-col .dl_link").forEach((cell) => {
    const link = cell.querySelector("a");
    if (!link) return;

    const href = link.getAttribute("href")?.split("?")[0] ?? "";

    const wrapper = document.createElement("span");
    wrapper.style.cssText = "display:inline-flex; align-items:center; gap:4px;";

    const priceInput = document.createElement("input");
    priceInput.type = "number";
    priceInput.min = "0";
    priceInput.step = "0.01";
    priceInput.value = "";
    priceInput.placeholder = "…";
    priceInput.style.cssText = "width:54px; font-size:12px;";

    const cartBtn = document.createElement("button");
    cartBtn.textContent = "🛒";
    cartBtn.title = "Add to cart";
    cartBtn.style.cssText = `
      background: none;
      border: 1px solid #ccc;
      border-radius: 3px;
      cursor: pointer;
      font-size: 13px;
      padding: 1px 4px;
      line-height: 1;
    `;
    let trackData: TrackData | null = null;

    cartBtn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const price = parseFloat(priceInput.value);
      if (isNaN(price) || !trackData) return;
      cartBtn.textContent = "⏳";
      cartBtn.disabled = true;
      try {
        await addToCart(trackData.item_id, trackData.band_id, price);
        cartBtn.textContent = "✓";
      } catch {
        cartBtn.textContent = "✗";
        cartBtn.disabled = false;
      }
    });

    wrapper.appendChild(priceInput);
    wrapper.appendChild(cartBtn);
    cell.innerHTML = "";
    cell.appendChild(wrapper);

    fetchTrackData(href).then((data) => {
      if (data) {
        trackData = data;
        if (data.minimum_price != null) {
          priceInput.min = String(data.minimum_price);
          priceInput.value = String(data.minimum_price);
        }
      }
    });
  });
};

// ---------------------------------------------------------------------------
// Player UI
// ---------------------------------------------------------------------------

const createPlayer = (): HTMLDivElement => {
  const newPlayer = document.createElement("div");
  newPlayer.id = "new-player";
  newPlayer.style.cssText = `
    position: fixed;
    bottom: 0;
    width: 100%;
    height: 10%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: white;
    flex: 1;
    flex-direction: column;
    z-index: 9999;
  `;

  document.body.style.paddingBottom = "10%";
  return newPlayer;
};

const createButton = (text: string, onClick: () => void): HTMLButtonElement => {
  const button = document.createElement("button");
  button.innerText = text;
  button.style.cssText = `
    min-width: 54px;
    min-height: 50px;
  `;
  button.onclick = onClick;
  return button;
};

const createToolbarButtons = (existingPlayer: Element, playButtonElement: Element): HTMLDivElement => {
  const toolbar = document.createElement("div");
  toolbar.classList.add("toolbar");
  toolbar.style.display = "flex";
  toolbar.style.alignItems = "center";

  const prevButton = createButton("⏮", () =>
    (existingPlayer.querySelector(".prevbutton") as HTMLElement).click()
  );
  const playButton = createButton(
    playButtonElement.classList.contains("playing") ? "⏸" : "▶",
    () => (playButtonElement as HTMLElement).click()
  );
  const nextButton = createButton("⏭", () =>
    (existingPlayer.querySelector(".nextbutton") as HTMLElement).click()
  );

  toolbar.append(prevButton, playButton, nextButton);
  return toolbar;
};

const createProgressInput = (): HTMLInputElement => {
  const progressInput = document.createElement("input");
  progressInput.type = "range";
  progressInput.min = "0";
  progressInput.max = MAX_PROGRESS.toString();
  progressInput.value = "0";
  progressInput.style.width = "450px";
  progressInput.addEventListener("input", () => {
    const audio = getAudioElement();
    if (audio) {
      const newTime = audio.duration * (Number(progressInput.value) / MAX_PROGRESS);
      audio.currentTime = newTime;
      audio.play();
    }
  });
  return progressInput;
};

const createRange = (): HTMLDivElement => {
  const range = document.createElement("div");
  range.classList.add("range");
  range.style.display = "flex";
  range.style.alignItems = "center";

  const currentTimeElement = document.createElement("div");
  const progressInput = createProgressInput();
  const totalDurationElement = document.createElement("div");

  range.append(currentTimeElement, progressInput, totalDurationElement);
  return range;
};

const observeProgressBar = (existingPlayer: Element, range: HTMLDivElement): void => {
  const progressBar = existingPlayer.querySelector<HTMLElement>(".ui-draggable")!;
  const observer = new MutationObserver(() => {
    const audio = getAudioElement();
    if (audio) {
      const widthPercent = parseFloat(progressBar.style.left);
      (range.children[1] as HTMLInputElement).value = String(widthPercent);
      range.children[0].textContent = formatDuration(audio.currentTime);
      range.children[2].textContent = formatDuration(audio.duration);
    }
  });
  observer.observe(progressBar, {
    attributes: true,
    attributeFilter: ["style"],
  });
};

const observePlayButton = (existingPlayButton: Element, newPlayButton: HTMLButtonElement): void => {
  const observer = new MutationObserver(() => {
    newPlayButton.innerText = existingPlayButton.classList.contains("playing")
      ? "⏸"
      : "▶";
  });
  observer.observe(existingPlayButton, {
    attributes: true,
    attributeFilter: ["class"],
  });
};

const createToolbar = (): void => {
  if (document.getElementById("new-player")) return;

  const existingPlayer = document.querySelector(".inline_player");
  if (!existingPlayer) return;

  const playButtonElement = existingPlayer.querySelector(".playbutton")!;
  const newPlayer = createPlayer();
  const toolbar = createToolbarButtons(existingPlayer, playButtonElement);
  const range = createRange();

  newPlayer.appendChild(toolbar);
  newPlayer.appendChild(range);
  document.body.appendChild(newPlayer);

  observeProgressBar(existingPlayer, range);
  observePlayButton(playButtonElement, toolbar.children[1] as HTMLButtonElement);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    createToolbar();
    replaceBuyLinks();
  });
} else {
  createToolbar();
  replaceBuyLinks();
}
