const modes = {
  explain: { kicker: 'LET’S GET CURIOUS', title: 'What are we learning today?', hint: 'Ask a question, or paste a topic that’s been on your mind.', placeholder: 'For example: Explain photosynthesis like I’m new to biology…', button: 'Help me understand', loading: 'Finding a clear way to explain this…' },
  summarize: { kicker: 'FIND THE IMPORTANT BITS', title: 'Let’s make those notes clearer.', hint: 'Paste your notes and we’ll pull out the ideas worth keeping.', placeholder: 'Paste a chapter, lecture notes, or a long explanation…', button: 'Summarize my notes', loading: 'Finding the key ideas…' },
  quiz: { kicker: 'A LITTLE PRACTICE', title: 'Ready to see what stuck?', hint: 'Share a topic or notes and get a quick practice quiz.', placeholder: 'For example: Create a quiz about the causes of World War I…', button: 'Make my quiz', loading: 'Putting together your questions…' },
  flashcards: { kicker: 'MAKE IT MEMORABLE', title: 'Let’s make this one stick.', hint: 'Drop in a topic or notes to turn them into quick flashcards.', placeholder: 'For example: Make flashcards from my notes on cell biology…', button: 'Build my flashcards', loading: 'Creating your flashcards…' }
};
let selectedMode = 'explain';
const form = document.querySelector('#study-form');
const promptField = document.querySelector('#prompt');
const count = document.querySelector('#char-count');
const status = document.querySelector('#status');
const result = document.querySelector('#result');
const answer = document.querySelector('#answer');
const submit = document.querySelector('#submit-btn');
const submitLabel = document.querySelector('#submit-label');
const starter = document.querySelector('#starter');

function setMode(mode) {
  selectedMode = mode;
  document.querySelectorAll('.mode').forEach(button => {
    const active = button.dataset.mode === mode;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const copy = modes[mode];
  document.querySelector('#mode-kicker').textContent = copy.kicker;
  document.querySelector('#mode-title').textContent = copy.title;
  document.querySelector('#mode-hint').textContent = copy.hint;
  promptField.placeholder = copy.placeholder;
  submitLabel.textContent = copy.button;
  status.hidden = true;
}

document.querySelectorAll('.mode').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
promptField.addEventListener('input', () => { count.textContent = `${promptField.value.length.toLocaleString()} / 12,000`; });
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => { promptField.value = button.dataset.prompt; promptField.dispatchEvent(new Event('input')); promptField.focus(); }));

function showError(message) {
  status.className = 'status error';
  status.textContent = message;
  status.hidden = false;
}
function showLoading() {
  status.className = 'status loading';
  status.innerHTML = `<span class="spinner" aria-hidden="true"></span><span>${modes[selectedMode].loading}</span>`;
  status.hidden = false;
}
function renderMarkdown(text) {
  const safe = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const lines = safe.split('\n');
  let html = '', list = null;
  const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
  const inline = line => line.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`(.+?)`/g, '<code>$1</code>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    const heading = line.match(/^(#{1,3})\s+(.+)/);
    const bullet = line.match(/^[-*•]\s+(.+)/);
    const numbered = line.match(/^\d+[.)]\s+(.+)/);
    if (heading) { closeList(); const level = Math.min(heading[1].length + 1, 4); html += `<h${level}>${inline(heading[2])}</h${level}>`; }
    else if (bullet || numbered) {
      const type = bullet ? 'ul' : 'ol';
      if (list !== type) { closeList(); list = type; html += `<${type}>`; }
      html += `<li>${inline((bullet || numbered)[1])}</li>`;
    } else { closeList(); html += `<p>${inline(line)}</p>`; }
  }
  closeList();
  return html;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  const text = promptField.value.trim();
  result.hidden = true;
  if (!text) { showError('Add a topic or question to get started.'); promptField.focus(); return; }
  if (text.length > 12000) { showError('Please keep your prompt under 12,000 characters.'); return; }
  submit.disabled = true;
  showLoading();
  try {
    const response = await fetch('/api/study', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: text, mode: selectedMode }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Something went wrong. Please try again.');
    if (!data.answer || !data.answer.trim()) throw new Error('The AI returned an empty response. Try rephrasing your question.');
    answer.innerHTML = renderMarkdown(data.answer);
    status.hidden = true;
    result.hidden = false;
    starter.hidden = true;
    result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (error) {
    showError(error.message || 'Could not connect. Check your connection and try again.');
  } finally {
    submit.disabled = false;
  }
});

document.querySelector('#copy-btn').addEventListener('click', async event => {
  const button = event.currentTarget;
  try {
    await navigator.clipboard.writeText(answer.innerText);
    button.innerHTML = 'Copied <span>✓</span>';
    setTimeout(() => { button.innerHTML = 'Copy <span>↗</span>'; }, 1600);
  } catch { showError('Could not copy automatically. Select the response text and copy it instead.'); }
});
setMode('explain');
