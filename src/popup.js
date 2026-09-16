import { CHARACTER_GROUPS, LETTERS, TOTAL_CHARACTERS } from "./characters.js";

const tabs = document.querySelector("#letter-tabs");
const groups = document.querySelector("#character-groups");
const title = document.querySelector("#panel-title");
const count = document.querySelector("#character-count");
const status = document.querySelector("#copy-status");
const reference = document.querySelector("#letter-reference");

let selectedLetter = "A";
let feedbackTimer;
let activeCopiedButton;

function labelFor(record) {
  const points = record.codePoints.join(" + ");
  return `Copy ${record.name.toLowerCase()}, ${record.glyph}, ${points}`;
}

function createCharacterGroup(heading, records) {
  if (records.length === 0) return null;

  const section = document.createElement("section");
  section.className = "character-group";

  const groupTitle = document.createElement("h3");
  groupTitle.textContent = heading;
  section.append(groupTitle);

  const grid = document.createElement("div");
  grid.className = "character-grid";

  for (const record of records) {
    const button = document.createElement("button");
    button.className = "character-button";
    button.type = "button";
    button.dataset.glyph = record.glyph;
    button.setAttribute("aria-label", labelFor(record));

    const glyph = document.createElement("span");
    glyph.className = "glyph";
    glyph.textContent = record.glyph;
    glyph.setAttribute("aria-hidden", "true");

    const badge = document.createElement("span");
    badge.className = "copied-badge";
    badge.textContent = "Copied";
    badge.setAttribute("aria-hidden", "true");

    button.append(glyph, badge);
    button.addEventListener("click", () => copyCharacter(record.glyph, button));
    grid.append(button);
  }

  section.append(grid);
  return section;
}

function renderLetter(letter, options = {}) {
  selectedLetter = letter;
  const records = CHARACTER_GROUPS[letter];
  const lowercase = records.filter((record) => record.case === "lowercase");
  const uppercase = records.filter((record) => record.case === "uppercase");

  title.textContent = `${letter} with accents`;
  count.textContent = `${records.length} ${records.length === 1 ? "character" : "characters"}`;
  reference.href = `https://diacriticalmarks.com/letters/${letter.toLowerCase()}-with-accent/`;
  reference.textContent = `Full ${letter} reference`;

  groups.replaceChildren();
  const lowerGroup = createCharacterGroup("Lowercase", lowercase);
  const upperGroup = createCharacterGroup("Uppercase", uppercase);
  if (lowerGroup) groups.append(lowerGroup);
  if (upperGroup) groups.append(upperGroup);

  for (const tab of tabs.querySelectorAll(".letter-tab")) {
    const selected = tab.dataset.letter === letter;
    tab.setAttribute("aria-selected", String(selected));
    tab.tabIndex = selected ? 0 : -1;
  }

  if (options.focusPanel) {
    title.tabIndex = -1;
    title.focus({ preventScroll: true });
  }
}

function renderTabs() {
  for (const letter of LETTERS) {
    const button = document.createElement("button");
    button.className = "letter-tab";
    button.type = "button";
    button.role = "tab";
    button.dataset.letter = letter;
    button.textContent = letter;
    button.setAttribute("aria-label", `${letter}, ${CHARACTER_GROUPS[letter].length} characters`);
    button.setAttribute("aria-controls", "letter-panel");
    button.addEventListener("click", () => renderLetter(letter));
    button.addEventListener("keydown", handleTabKeydown);
    tabs.append(button);
  }
}

function handleTabKeydown(event) {
  const currentIndex = LETTERS.indexOf(event.currentTarget.dataset.letter);
  let nextIndex = null;

  if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % LETTERS.length;
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") nextIndex = (currentIndex - 1 + LETTERS.length) % LETTERS.length;
  if (event.key === "Home") nextIndex = 0;
  if (event.key === "End") nextIndex = LETTERS.length - 1;
  if (nextIndex === null) return;

  event.preventDefault();
  const nextLetter = LETTERS[nextIndex];
  renderLetter(nextLetter);
  tabs.querySelector(`[data-letter="${nextLetter}"]`).focus();
}

async function writeClipboard(value) {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("aria-hidden", "true");
    textarea.style.position = "fixed";
    textarea.style.left = "-10000px";
    textarea.style.top = "0";
    document.body.append(textarea);
    textarea.focus();
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    return copied;
  }
}

async function copyCharacter(value, button) {
  const scrollTop = document.scrollingElement.scrollTop;
  const copied = await writeClipboard(value);

  button.focus({ preventScroll: true });
  document.scrollingElement.scrollTop = scrollTop;

  clearTimeout(feedbackTimer);
  if (activeCopiedButton && activeCopiedButton !== button) {
    delete activeCopiedButton.dataset.copied;
  }

  if (!copied) {
    status.textContent = "Could not copy. Select the character and try again.";
    status.dataset.visible = "true";
    feedbackTimer = setTimeout(() => {
      status.textContent = "";
      delete status.dataset.visible;
    }, 2400);
    return;
  }

  activeCopiedButton = button;
  button.dataset.copied = "true";
  status.textContent = `Copied “${value}”`;
  status.dataset.visible = "true";

  feedbackTimer = setTimeout(() => {
    delete button.dataset.copied;
    status.textContent = "";
    delete status.dataset.visible;
    if (activeCopiedButton === button) activeCopiedButton = null;
  }, 1800);
}

renderTabs();
renderLetter(selectedLetter);
document.documentElement.dataset.totalCharacters = String(TOTAL_CHARACTERS);
