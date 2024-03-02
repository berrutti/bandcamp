const MAX_PROGRESS = 226;

const formatDuration = (duration) => {
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

const getAudioElement = () => {
  if (!window.audioElement) {
    window.audioElement = document.querySelector("audio[src*='bcbits.com']");
  }
  return window.audioElement;
};

const createPlayer = () => {
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

  // Add bottom padding to the body equal to the height of the new player
  document.body.style.paddingBottom = "10%";
  return newPlayer;
};

const createButton = (text, onClick) => {
  const button = document.createElement("button");
  button.innerText = text;
  button.style.cssText = `
    min-width: 54px;
    min-height: 50px;
  `;
  button.onclick = onClick;
  return button;
};

const createToolbarButtons = (existingPlayer, playButtonElement) => {
  const toolbar = document.createElement("div");
  toolbar.classList.add("toolbar");
  toolbar.style.display = "flex";
  toolbar.style.alignItems = "center";

  const prevButton = createButton("⏮", () =>
    existingPlayer.querySelector(".prevbutton").click()
  );
  const playButton = createButton(
    playButtonElement.classList.contains("playing") ? "⏸" : "▶",
    () => {
      playButtonElement.click();
    }
  );
  const nextButton = createButton("⏭", () =>
    existingPlayer.querySelector(".nextbutton").click()
  );

  toolbar.append(prevButton, playButton, nextButton);
  return toolbar;
};

const createProgressInput = () => {
  const progressInput = document.createElement("input");
  progressInput.type = "range";
  progressInput.min = "0";
  progressInput.max = MAX_PROGRESS.toString();
  progressInput.value = "0";
  progressInput.style.width = "450px";
  progressInput.addEventListener("input", () => {
    const audio = getAudioElement();
    if (audio) {
      const newTime = audio.duration * (progressInput.value / MAX_PROGRESS);
      audio.currentTime = newTime;
      audio.play();
    }
  });
  return progressInput;
};

const createRange = () => {
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

const observeProgressBar = (existingPlayer, range) => {
  const progressBar = existingPlayer.querySelector(".ui-draggable");
  const observer = new MutationObserver(() => {
    const audio = getAudioElement();
    if (audio) {
      const leftStyle = progressBar.style.left;
      const widthPercent = parseFloat(leftStyle);
      range.children[1].value = widthPercent;
      range.children[0].textContent = formatDuration(audio.currentTime);
      range.children[2].textContent = formatDuration(audio.duration);
    }
  });
  observer.observe(progressBar, {
    attributes: true,
    attributeFilter: ["style"],
  });
};

const observePlayButton = (existingPlayButton, newPlayButton) => {
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

const createToolbar = () => {
  const existingPlayer = document.querySelector(".inline_player");
  const playButtonElement = existingPlayer.querySelector(".playbutton");
  const newPlayer = createPlayer();
  const toolbar = createToolbarButtons(existingPlayer, playButtonElement);
  const range = createRange();

  newPlayer.appendChild(toolbar);
  newPlayer.appendChild(range);
  document.body.appendChild(newPlayer);

  observeProgressBar(existingPlayer, range);
  observePlayButton(playButtonElement, toolbar.children[1]);
};

window.onload = createToolbar;
