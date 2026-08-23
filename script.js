/* ---------- state ---------- */
let folders = [];
let deleted = [];
let currentParent = null;   // folder id we're viewing inside, null = root
let activeTab = 'home';
let activeFolderId = null;  // folder currently targeted by a menu/modal
let activeTrashId = null;   // trashed folder currently targeted by the trash menu/modal
let searchQuery = '';
let currentTheme = 'light';

/* tags */
let tags = [];              // {id, name, color}
let activeTagFilter = null; // which tag chip is selected on the Tags tab
let modalSelectedTagId = null; // tag currently chosen inside the tag modal (null = "No tag")
let creatingNewTag = false;    // whether the "new tag" form is open inside the tag modal

/* ---------- local persistence ---------- */
/* Everything the user creates or customizes (folders, colors, tags,
   saved/starred state, theme) is saved to the browser's localStorage so it's
   still there the next time this file is opened — including a plain double
   click / file:// open, no server or special host required. */
const STORAGE_KEY = 'notewise-state-v1';
let _saveQueued = false;

function saveState(){
  // debounce: several renders can fire in the same tick, only persist once
  if(_saveQueued) return;
  _saveQueued = true;
  setTimeout(()=>{
    _saveQueued = false;
    try{
      const state = { folders, deleted, tags, currentTheme };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }catch(err){
      console.error('Could not save Notewise state:', err);
    }
  }, 150);
}

async function loadState(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(!raw) return;
    const state = JSON.parse(raw);
    if(Array.isArray(state.folders)) folders = state.folders;
    if(Array.isArray(state.deleted)) deleted = state.deleted;
    if(Array.isArray(state.tags)) tags = state.tags;
    if(state.currentTheme){
      currentTheme = state.currentTheme;
      if(currentTheme==='light'){
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', currentTheme);
      }
    }
  }catch(err){
    // no saved state yet (first run) — keep the starter folders
  }
}

/* select mode */
let selectMode = false;
let selectedIds = new Set();
let pendingBulkDelete = false;

/* trash select mode */
let trashSelectMode = false;
let trashSelectedIds = new Set();
let pendingBulkPermaDelete = false;

/* manual sort mode */
let manualSortMode = false;
let manualSlots = []; // array of folder ids or null (dashed placeholder)
let manualDrag = null;

/* preset folder colors offered in the "Customize folder" picker */
const COLORS = [
  '#4f7294', // default blue
  '#3fa66b', // green
  '#d9534f', // red
  '#8e6bd8', // purple
  '#e08e3e', // orange
  '#d9b23f', // yellow
  '#e07ba0', // pink
  '#3fa6a0', // teal
  '#6b7280', // gray
  '#c85fd0', // magenta
  '#4f9fd8', // sky blue
  '#8a6a4f'  // brown
];
const DEFAULT_COLOR = '#4f7294';

/* preset folder cover images offered in the "Customize folder" picker */
const COVERS = [
  {id:'cover1', src:'Cover1.svg'},
  {id:'cover2', src:'Cover2.svg'},
  {id:'cover3', src:'Cover3.svg'},
  {id:'cover4', src:'Cover4.svg'},
  {id:'cover5', src:'Cover5.svg'},
  {id:'cover6', src:'Cover6.svg'},
  {id:'cover7', src:'Cover7.svg'},

];

/* ---------- helpers ---------- */
const $ = id => document.getElementById(id);
function uid(){ return 'f' + Math.random().toString(36).slice(2,9); }

/* ---------- color math (used by the folder color picker) ---------- */
function clampByte(v){ return Math.max(0, Math.min(255, v)); }
function hexToRgb(hex){
  hex = hex.replace('#','');
  if(hex.length === 3){ hex = hex.split('').map(c => c+c).join(''); }
  const num = parseInt(hex, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function rgbToHex(r,g,b){
  return '#' + [r,g,b].map(v => clampByte(Math.round(v)).toString(16).padStart(2,'0')).join('').toUpperCase();
}
/* softer version: mixes the chosen color toward white — used to derive the folder body shade from the tab color */
function softerColor(hex, amount = 0.28){
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255-r)*amount, g + (255-g)*amount, b + (255-b)*amount);
}

function toast(msg){
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>t.classList.remove('show'), 1800);
}

function closeAllPanels(){
  ['fabMenu','folderMenu','trashMenu','profilePanel','sortMenu','selectMenu'].forEach(id=>$(id).style.display='none');
  $('overlay').classList.remove('show');
}
function closeModals(){
  ['newFolderModal','renameModal','colorModal','moveModal','deleteModal','permaDeleteModal','settingsModal','tagModal','detailsModal'].forEach(id=>$(id).classList.remove('show'));
}

/* ---------- folder icon shape ---------- */
function folderIconSVG(f){
  if(f && f.cover){
    const c = COVERS.find(x=>x.id===f.cover);
    if(c) return `<img src="${c.src}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">`;
  }
  const topColor = (f && f.color) || DEFAULT_COLOR;
  const bodyColor = softerColor(topColor);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 810 809.999993">
    <path fill="${topColor}" d="M 734.667969 269.207031 L 732.605469 214.648438 C 732.605469 200.585938 721.207031 189.1875 707.257812 189.1875 L 345.089844 189.1875 C 341.457031 189.1875 338.058594 187.617188 335.628906 184.820312 L 305.925781 150.625 C 301.070312 145.167969 294.160156 141.890625 286.886719 141.890625 L 106.335938 141.890625 C 92.273438 141.890625 81 153.289062 81 167.351562 L 81 419.316406 L 735.035156 419.316406 L 735.035156 278.667969 Z M 734.667969 269.207031 "/>
    <path fill="#ffffff" d="M 699.15625 425.15625 L 116.875 425.15625 C 109.96875 425.15625 104.363281 419.550781 104.363281 412.644531 L 104.363281 227.449219 C 104.363281 220.539062 109.96875 214.9375 116.875 214.9375 L 699.15625 214.9375 C 706.066406 214.9375 711.671875 220.539062 711.671875 227.449219 L 711.671875 412.644531 C 711.679688 419.550781 706.078125 425.15625 699.15625 425.15625 Z M 699.15625 425.15625 "/>
    <path fill="${bodyColor}" d="M 735.035156 273.574219 L 735.035156 670.4375 C 735.035156 684.988281 723.269531 696.753906 708.839844 696.753906 L 107.195312 696.753906 C 92.765625 696.742188 81 684.976562 81 670.425781 L 81 273.5625 C 81 259.136719 92.765625 247.371094 107.195312 247.371094 L 708.851562 247.371094 C 721.820312 247.371094 732.617188 256.828125 734.675781 269.195312 C 734.910156 270.667969 735.035156 272.113281 735.035156 273.574219 Z M 735.035156 273.574219 "/>
  </svg>`;
}

const SAVED_BADGE_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#F5C518" stroke="#E3A70A" stroke-width="1" d="M12 2 14.7 8.1 21.4 8.8 16.3 13.2 17.8 19.8 12 16.3 6.2 19.8 7.7 13.2 2.6 8.8 9.3 8.1Z"/></svg>`;

/* ---------- tag icon ---------- */
function tagIconSVG(size){
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H4a2 2 0 0 0-2 2v8l10.6 10.6a2 2 0 0 0 2.8 0l7.2-7.2a2 2 0 0 0 0-2.8L12 2Z"/><circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none"/></svg>`;
}
function tagDotHTML(tagId){
  const t = tags.find(x=>x.id===tagId);
  if(!t) return '';
  return `<div class="folder-badge tag-badge" style="color:${t.color}">${tagIconSVG(10)}</div>`;
}

/* ---------- folder card builder ---------- */
function folderCardEl(f, opts){
  opts = opts || {};
  const el = document.createElement('div');
  el.className='folder-item';
  el.dataset.id = f.id;
  el.innerHTML = `
    <div class="folder-shape-wrap" data-open="${f.id}">
      ${folderIconSVG(f)}
      ${((f.tagId && !opts.hideTagDot) || (f.saved && !opts.hideSavedBadge)) ? `<div class="folder-badges">
        ${(f.tagId && !opts.hideTagDot) ? tagDotHTML(f.tagId) : ''}
        ${(f.saved && !opts.hideSavedBadge) ? `<div class="folder-badge saved-badge">${SAVED_BADGE_SVG}</div>` : ''}
      </div>` : ''}
      ${opts.selectMode ? `<div class="select-dot${selectedIds.has(f.id) ? ' checked' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 9 17 20 6"/></svg></div>` : ''}
    </div>
    <div class="folder-label" data-menu="${f.id}">
      <span>${escapeHtml(f.name)}</span>
      <button class="chev" tabindex="-1">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    </div>`;
  return el;
}

/* ---------- breadcrumb helper ---------- */
function updateBreadcrumb(){
  const parent = folders.find(f=>f.id===currentParent);
  $('crumbHome').textContent = 'Home';
  $('backBtn').style.display = parent ? 'flex' : 'none';
  $('crumbSep').style.display = parent ? 'inline' : 'none';
  $('crumbName').style.display = parent ? 'inline' : 'none';
  $('crumbName').textContent = parent ? parent.name : '';
  $('crumbHome').style.cursor = parent ? 'pointer' : 'default';
}

/* ---------- render ---------- */
function render(){
  closeAllPanels();
  saveState();

  // bottom nav state
  document.querySelectorAll('.navbtn').forEach(b=>{
    b.classList.toggle('active', b.dataset.tab===activeTab);
  });

  const modeActive = selectMode || manualSortMode || trashSelectMode;
  $('fabBtn').style.display = (modeActive || activeTab==='trash') ? 'none' : 'flex';
  $('bottomNav').style.display = modeActive ? 'none' : 'flex';
  $('breadcrumbSelectBtn').style.display = modeActive ? 'none' : 'flex';
  $('breadcrumbSortBtn').style.display = modeActive ? 'none' : 'flex';
  $('selectFooter').style.display = selectMode ? 'flex' : 'none';
  $('trashSelectFooter').style.display = trashSelectMode ? 'flex' : 'none';
  $('manualSortFooter').style.display = manualSortMode ? 'flex' : 'none';
  if(selectMode) updateSelectUI();
  if(trashSelectMode) updateTrashSelectUI();

  const grid = $('folderGrid');
  const empty = $('emptyState');

  if(manualSortMode){
    $('breadcrumb').style.display = 'flex';
    updateBreadcrumb();
    renderManualSort();
    return;
  }

  if(searchQuery){
    $('breadcrumb').style.display = 'none';
    const q = searchQuery.toLowerCase();
    const matches = folders.filter(f=>f.name.toLowerCase().includes(q));
    if(matches.length===0){
      grid.style.display='none';
      empty.style.display='block';
      empty.textContent = `No folders found for "${searchQuery}".`;
    } else {
      grid.style.display='grid';
      empty.style.display='none';
      grid.innerHTML='';
      matches.forEach(f=> grid.appendChild(folderCardEl(f)));
    }
    return;
  }

  if(activeTab !== 'home'){
    $('breadcrumb').style.display = 'none';
    grid.style.display = 'none';
    empty.style.display = 'block';
    if(activeTab==='saved'){
      if(folders.some(f=>f.saved)){
        renderSaved();
        return;
      }
      empty.textContent = 'No favorite notes and folders.';
    }
    if(activeTab==='tags'){
      renderTags();
      return;
    }
    if(activeTab==='trash'){
      if(deleted.length===0){
        empty.textContent = 'No deleted items yet!';
        trashSelectMode = false;
        trashSelectedIds = new Set();
      } else {
        empty.style.display='none';
        renderTrash();
        return;
      }
    }
    return;
  }

  // home tab
  grid.style.display = 'grid';
  const parent = folders.find(f=>f.id===currentParent);
  $('breadcrumb').style.display = 'flex';
  updateBreadcrumb();

  const visible = folders.filter(f=>f.parentId===currentParent);
  grid.innerHTML = '';

  if(visible.length===0 && !selectMode){
    grid.style.display='none';
    empty.style.display='block';
    empty.textContent = parent ? 'No saved notes and folders.' : 'Start making notes...';
  } else {
    grid.style.display='grid';
    empty.style.display='none';
    visible.forEach(f=> grid.appendChild(folderCardEl(f, {selectMode})));
  }
}

function renderTrash(){
  const grid = $('folderGrid');
  grid.style.display='grid';
  grid.innerHTML='';

  // trash gets a slim toolbar: no back/home nav, no sort, just Select
  $('breadcrumb').style.display = 'flex';
  $('backBtn').style.display = 'none';
  $('crumbSep').style.display = 'none';
  $('crumbName').style.display = 'none';
  $('crumbHome').textContent = 'Trash';
  $('crumbHome').style.cursor = 'default';
  $('breadcrumbSortBtn').style.display = 'none';
  $('breadcrumbSelectBtn').style.display = trashSelectMode ? 'none' : 'flex';

  deleted.forEach(f=>{
    const el = document.createElement('div');
    el.className='folder-item';
    el.dataset.id = f.id;
    el.innerHTML = `
      <div class="folder-shape-wrap" style="opacity:.55; cursor:default;">
        ${folderIconSVG(f)}
        ${trashSelectMode ? `<div class="select-dot${trashSelectedIds.has(f.id) ? ' checked' : ''}"><svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 9 17 20 6"/></svg></div>` : ''}
      </div>
      <div class="folder-label" data-trash-menu="${f.id}">
        <span style="opacity:.65;">${escapeHtml(f.name)}</span>
        <button class="chev" tabindex="-1">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </button>
      </div>`;
    grid.appendChild(el);
  });
}

function renderSaved(){
  const grid = $('folderGrid');
  const empty = $('emptyState');
  const saved = folders.filter(f=>f.saved);
  $('breadcrumb').style.display='none';
  if(saved.length===0){
    grid.style.display='none';
    empty.style.display='block';
    empty.textContent = 'No favorite notes and folders.';
  } else {
    grid.style.display='grid';
    empty.style.display='none';
    grid.innerHTML='';
    saved.forEach(f=> grid.appendChild(folderCardEl(f, {hideTagDot:true})));
  }
}

function renderTags(){
  const grid = $('folderGrid');
  const empty = $('emptyState');
  $('breadcrumb').style.display='none';

  if(tags.length===0){
    grid.style.display='none';
    empty.style.display='block';
    empty.textContent = 'No tags yet. Tag a folder to get started.';
    return;
  }

  if(!activeTagFilter || !tags.find(t=>t.id===activeTagFilter)){
    activeTagFilter = tags[0].id;
  }

  empty.style.display='none';
  grid.style.display='grid';
  grid.innerHTML='';

  const chipRow = document.createElement('div');
  chipRow.className='tag-chip-row';
  tags.forEach(t=>{
    const chip = document.createElement('button');
    const isActive = t.id===activeTagFilter;
    chip.className = 'tag-chip' + (isActive ? ' active' : '');
    chip.style.color = t.color;
    chip.style.background = t.color + (isActive ? '3d' : '20');
    chip.title = t.name;
    chip.innerHTML = `${tagIconSVG(16)}<span>${escapeHtml(t.name)}</span>`;
    chip.onclick = ()=>{ activeTagFilter = t.id; render(); };
    chipRow.appendChild(chip);
  });
  grid.appendChild(chipRow);

  const activeTag = tags.find(t=>t.id===activeTagFilter);
  const taggedFolders = folders.filter(f=>f.tagId===activeTagFilter);

  if(taggedFolders.length===0){
    const msg = document.createElement('div');
    msg.className='tag-empty-msg';
    msg.textContent = `No folders tagged "${activeTag.name}" yet.`;
    grid.appendChild(msg);
  } else {
    taggedFolders.forEach(f=> grid.appendChild(folderCardEl(f, {hideSavedBadge:true})));
  }
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

/* ---------- event delegation ---------- */
$('folderGrid').addEventListener('click', e=>{
  if(window.__justDragged) return;
  if(manualSortMode) return;
  if(selectMode){
    const item = e.target.closest('.folder-item');
    if(item && item.dataset.id) toggleSelect(item.dataset.id);
    return;
  }
  if(trashSelectMode){
    const item = e.target.closest('.folder-item');
    if(item && item.dataset.id) toggleTrashSelect(item.dataset.id);
    return;
  }
  const open = e.target.closest('[data-open]');
  const menuBtn = e.target.closest('[data-menu]');
  const trashMenuBtn = e.target.closest('[data-trash-menu]');
  if(menuBtn){
    e.stopPropagation();
    activeFolderId = menuBtn.dataset.menu;
    openFolderMenu(menuBtn);
    return;
  }
  if(trashMenuBtn){
    e.stopPropagation();
    activeTrashId = trashMenuBtn.dataset.trashMenu;
    openTrashMenu(trashMenuBtn);
    return;
  }
  if(open){
    currentParent = open.dataset.open;
    activeTab = 'home';
    clearSearch();
    render();
  }
});

$('backBtn').addEventListener('click', ()=>{
  const parent = folders.find(f=>f.id===currentParent);
  currentParent = parent ? parent.parentId : null;
  render();
});
$('crumbHome').addEventListener('click', ()=>{
  currentParent = null;
  render();
});
$('breadcrumbSelectBtn').addEventListener('click', e=>{
  e.stopPropagation();
  const willOpen = $('selectMenu').style.display !== 'block';
  closeAllPanels();
  if(willOpen) openSelectMenu();
});
$('breadcrumbSortBtn').addEventListener('click', e=>{
  e.stopPropagation();
  const willOpen = $('sortMenu').style.display !== 'block';
  closeAllPanels();
  if(willOpen) openSortMenu();
});

document.querySelectorAll('.navbtn').forEach(b=>{
  b.addEventListener('click', ()=>{
    activeTab = b.dataset.tab;
    if(activeTab==='home') currentParent = null;
    clearSearch();
    render();
  });
});

function clearSearch(){
  searchQuery = '';
  $('searchInput').value = '';
}

$('searchInput').addEventListener('input', e=>{
  searchQuery = e.target.value.trim();
  render();
});
$('searchInput').addEventListener('focus', ()=>{
  closeAllPanels();
});

$('fabBtn').addEventListener('click', e=>{
  e.stopPropagation();
  const willOpen = $('fabMenu').style.display !== 'block';
  closeAllPanels();
  if(willOpen){
    $('fabMenu').style.display='block';
    $('overlay').classList.add('show');
  }
});

$('avatarBtn').addEventListener('click', e=>{
  e.stopPropagation();
  const willOpen = $('profilePanel').style.display !== 'block';
  closeAllPanels();
  if(willOpen){
    $('profilePanel').style.display='block';
    $('overlay').classList.add('show');
  }
});

function openFolderMenu(anchorEl){
  closeAllPanels();
  const menu = $('folderMenu');
  // measure the menu's real width first (off-screen) so centering is accurate
  menu.style.visibility='hidden';
  menu.style.display='block';
  const menuWidth = menu.offsetWidth;

  const rect = anchorEl.getBoundingClientRect();
  const phoneRect = document.querySelector('.phone').getBoundingClientRect();
  const anchorCenter = (rect.left + rect.width/2) - phoneRect.left;

  let left = anchorCenter - (menuWidth/2);
  left = Math.max(10, Math.min(left, phoneRect.width - menuWidth - 10));

  menu.style.top = (rect.bottom - phoneRect.top + 6) + 'px';
  menu.style.left = left + 'px';
  menu.style.visibility='';
  $('overlay').classList.add('show');

  const f = folders.find(x=>x.id===activeFolderId);
  if(f) $('saveFolderBtnLabel').textContent = f.saved ? 'Unfavorite' : 'Favorite';
}

function openTrashMenu(anchorEl){
  closeAllPanels();
  const menu = $('trashMenu');
  // measure the menu's real width first (off-screen) so centering is accurate
  menu.style.visibility='hidden';
  menu.style.display='block';
  const menuWidth = menu.offsetWidth;

  const rect = anchorEl.getBoundingClientRect();
  const phoneRect = document.querySelector('.phone').getBoundingClientRect();
  const anchorCenter = (rect.left + rect.width/2) - phoneRect.left;

  let left = anchorCenter - (menuWidth/2);
  left = Math.max(10, Math.min(left, phoneRect.width - menuWidth - 10));

  menu.style.top = (rect.bottom - phoneRect.top + 6) + 'px';
  menu.style.left = left + 'px';
  menu.style.visibility='';
  $('overlay').classList.add('show');
}

/* ---------- breadcrumb "..." menu / sort menu ---------- */
function positionPanelRightAligned(panel, anchorEl){
  panel.style.visibility='hidden';
  panel.style.display='block';
  const menuWidth = panel.offsetWidth;
  const rect = anchorEl.getBoundingClientRect();
  const phoneRect = document.querySelector('.phone').getBoundingClientRect();
  let left = (rect.right - phoneRect.left) - menuWidth;
  left = Math.max(10, Math.min(left, phoneRect.width - menuWidth - 10));
  panel.style.top = (rect.bottom - phoneRect.top + 6) + 'px';
  panel.style.left = left + 'px';
  panel.style.visibility='';
}
function openSortMenu(){
  positionPanelRightAligned($('sortMenu'), $('breadcrumbSortBtn'));
  $('overlay').classList.add('show');
}
function openSelectMenu(){
  positionPanelRightAligned($('selectMenu'), $('breadcrumbSelectBtn'));
  $('overlay').classList.add('show');
}

/* ---------- select mode ---------- */
function enterSelectMode(){
  if(activeTab==='trash'){ enterTrashSelectMode(); return; }
  closeAllPanels();
  selectMode = true;
  selectedIds = new Set();
  render();
}
function selectAllItems(){
  if(activeTab==='trash'){ selectAllTrashItems(); return; }
  closeAllPanels();
  selectMode = true;
  const visible = folders.filter(f=>f.parentId===currentParent);
  selectedIds = new Set(visible.map(f=>f.id));
  render();
}
function exitSelectMode(){
  selectMode = false;
  selectedIds = new Set();
  render();
}
function toggleSelect(id){
  if(selectedIds.has(id)) selectedIds.delete(id); else selectedIds.add(id);
  updateSelectUI();
}
function updateSelectUI(){
  document.querySelectorAll('.folder-item').forEach(el=>{
    const dot = el.querySelector('.select-dot');
    if(dot) dot.classList.toggle('checked', selectedIds.has(el.dataset.id));
  });
  const disabled = selectedIds.size===0;
  $('selectMoveBtn').disabled = disabled;
  $('selectDeleteBtn').disabled = disabled;
}
$('selectCancelBtn').addEventListener('click', exitSelectMode);
$('selectMoveBtn').addEventListener('click', ()=>{ if(selectedIds.size) openBulkMoveModal(); });
$('selectDeleteBtn').addEventListener('click', ()=>{ if(selectedIds.size) openBulkDeleteModal(); });

/* ---------- trash select mode ---------- */
function enterTrashSelectMode(){
  closeAllPanels();
  trashSelectMode = true;
  trashSelectedIds = new Set();
  render();
}
function selectAllTrashItems(){
  closeAllPanels();
  trashSelectMode = true;
  trashSelectedIds = new Set(deleted.map(f=>f.id));
  render();
}
function exitTrashSelectMode(){
  trashSelectMode = false;
  trashSelectedIds = new Set();
  render();
}
function toggleTrashSelect(id){
  if(trashSelectedIds.has(id)) trashSelectedIds.delete(id); else trashSelectedIds.add(id);
  updateTrashSelectUI();
}
function updateTrashSelectUI(){
  document.querySelectorAll('.folder-item').forEach(el=>{
    const dot = el.querySelector('.select-dot');
    if(dot) dot.classList.toggle('checked', trashSelectedIds.has(el.dataset.id));
  });
  const disabled = trashSelectedIds.size===0;
  $('trashSelectRestoreBtn').disabled = disabled;
  $('trashSelectDeleteBtn').disabled = disabled;
}
$('trashSelectCancelBtn').addEventListener('click', exitTrashSelectMode);
$('trashSelectRestoreBtn').addEventListener('click', ()=>{ if(trashSelectedIds.size) bulkRestoreTrash(); });
$('trashSelectDeleteBtn').addEventListener('click', ()=>{ if(trashSelectedIds.size) openBulkPermaDeleteModal(); });
function bulkRestoreTrash(){
  const ids = new Set(trashSelectedIds);
  const restored = [];
  deleted = deleted.filter(f=>{
    if(ids.has(f.id)){ f.parentId = null; restored.push(f); return false; }
    return true;
  });
  folders.push(...restored);
  exitTrashSelectMode();
  toast(restored.length > 1 ? (restored.length + ' folders restored') : 'Folder restored');
}
function openBulkPermaDeleteModal(){
  closeAllPanels();
  pendingBulkPermaDelete = true;
  $('permaDeleteModal').classList.add('show');
}

function openBulkMoveModal(){
  closeAllPanels();
  moveNavContext = 'bulk';
  moveNavExclude = new Set(selectedIds);
  moveNavParent = null;
  moveNavPath = [];
  if(selectedIds.size===1){
    const only = folders.find(x=>x.id===[...selectedIds][0]);
    $('moveModalTitle').textContent = `Move ${only.name} to:`;
  } else {
    $('moveModalTitle').textContent = `Move ${selectedIds.size} folders to:`;
  }
  renderMoveGrid();
  $('moveModal').classList.add('show');
}
function doBulkMove(targetId){
  selectedIds.forEach(id=>{
    const f = folders.find(x=>x.id===id);
    if(f && f.id!==targetId && !isDescendantOf(targetId, f.id)) f.parentId = targetId;
  });
  closeModals();
  exitSelectMode();
  toast('Folders moved');
}
function openBulkDeleteModal(){
  closeAllPanels();
  pendingBulkDelete = true;
  $('deleteModal').classList.add('show');
}

/* ---------- sorting ---------- */
function sortByName(){
  closeAllPanels();
  const group = folders.filter(f=>f.parentId===currentParent).sort((a,b)=>a.name.localeCompare(b.name));
  const others = folders.filter(f=>f.parentId!==currentParent);
  folders = others.concat(group);
  render();
  toast('Sorted by name');
}
function sortByDate(){
  closeAllPanels();
  const group = folders.filter(f=>f.parentId===currentParent).sort((a,b)=>(a.createdAt||0)-(b.createdAt||0));
  const others = folders.filter(f=>f.parentId!==currentParent);
  folders = others.concat(group);
  render();
  toast('Sorted by date created');
}

/* ---------- sort manually ---------- */
function openManualSort(){
  closeAllPanels();
  const visible = folders.filter(f=>f.parentId===currentParent).map(f=>f.id);
  manualSlots = visible.concat([null,null,null]);
  manualSortMode = true;
  render();
}
function renderManualSort(){
  const grid = $('folderGrid');
  const empty = $('emptyState');
  empty.style.display='none';
  grid.style.display='grid';
  grid.innerHTML='';
  manualSlots.forEach((id,idx)=>{
    let el;
    if(id){
      const f = folders.find(x=>x.id===id);
      el = folderCardEl(f);
    } else {
      el = document.createElement('div');
      el.className='folder-item';
      el.innerHTML = `
        <div class="folder-shape-wrap dashed-slot">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
            <path d="M32 62 C32 54.3 38.3 48 46 48 H96 L108 61 H216 C221.5 61 226 65.5 226 71 V195 C226 202.7 219.7 209 212 209 H46 C38.3 209 32 202.7 32 195 Z" fill="none" stroke="#777777" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="12 10"/>
          </svg>
        </div>
        <div class="folder-label" style="visibility:hidden;">&nbsp;</div>`;
      el.classList.add('manual-empty');
    }
    el.classList.add('manual-slot');
    el.dataset.slot = idx;
    grid.appendChild(el);
  });
  attachManualDragHandlers();
}
function attachManualDragHandlers(){
  $('folderGrid').querySelectorAll('.manual-slot').forEach(el=>{
    el.addEventListener('pointerdown', onManualPointerDown);
  });
}
function onManualPointerDown(e){
  if(e.button !== undefined && e.button !== 0) return;
  const item = e.currentTarget;
  if(item.classList.contains('manual-empty')) return;
  manualDrag = {
    fromIdx: parseInt(item.dataset.slot,10),
    startX:e.clientX, startY:e.clientY, dragging:false, el:item, toIdx:null
  };
  document.addEventListener('pointermove', onManualPointerMove);
  document.addEventListener('pointerup', onManualPointerUp, {once:true});
}
function onManualPointerMove(e){
  if(!manualDrag) return;
  const dx = e.clientX - manualDrag.startX;
  const dy = e.clientY - manualDrag.startY;
  if(!manualDrag.dragging){
    if(Math.abs(dx) > 8 || Math.abs(dy) > 8){ startManualDrag(e); } else { return; }
  }
  e.preventDefault();
  moveManualGhost(e);
  updateManualHover(e);
}
function startManualDrag(e){
  manualDrag.dragging = true;
  const rect = manualDrag.el.getBoundingClientRect();
  const ghost = manualDrag.el.cloneNode(true);
  ghost.style.position='fixed';
  ghost.style.left = rect.left+'px';
  ghost.style.top = rect.top+'px';
  ghost.style.width = rect.width+'px';
  ghost.style.margin='0';
  ghost.style.pointerEvents='none';
  ghost.style.opacity='0.9';
  ghost.style.zIndex='999';
  ghost.style.transform='scale(1.05) rotate(-2deg)';
  ghost.style.transition='none';
  document.body.appendChild(ghost);
  manualDrag.ghost = ghost;
  manualDrag.offsetX = e.clientX - rect.left;
  manualDrag.offsetY = e.clientY - rect.top;
  manualDrag.el.style.opacity = '0.3';
}
function moveManualGhost(e){
  const g = manualDrag.ghost;
  if(!g) return;
  g.style.left = (e.clientX - manualDrag.offsetX)+'px';
  g.style.top = (e.clientY - manualDrag.offsetY)+'px';
}
function updateManualHover(e){
  document.querySelectorAll('.manual-slot.drag-over').forEach(x=>x.classList.remove('drag-over'));
  manualDrag.ghost.style.display='none';
  const under = document.elementFromPoint(e.clientX, e.clientY);
  manualDrag.ghost.style.display='';
  const targetItem = under ? under.closest('.manual-slot') : null;
  if(targetItem && parseInt(targetItem.dataset.slot,10) !== manualDrag.fromIdx){
    targetItem.classList.add('drag-over');
    manualDrag.toIdx = parseInt(targetItem.dataset.slot,10);
  } else {
    manualDrag.toIdx = null;
  }
}
function onManualPointerUp(e){
  document.removeEventListener('pointermove', onManualPointerMove);
  if(!manualDrag) return;
  document.querySelectorAll('.manual-slot.drag-over').forEach(x=>x.classList.remove('drag-over'));
  if(manualDrag.ghost) manualDrag.ghost.remove();
  if(manualDrag.el) manualDrag.el.style.opacity = '';
  if(manualDrag.dragging && manualDrag.toIdx !== null){
    const a = manualDrag.fromIdx, b = manualDrag.toIdx;
    const tmp = manualSlots[a];
    manualSlots[a] = manualSlots[b];
    manualSlots[b] = tmp;
    renderManualSort();
  }
  manualDrag = null;
}
$('manualSortCancelBtn').addEventListener('click', ()=>{
  manualSortMode = false;
  manualSlots = [];
  render();
});
$('manualSortSaveBtn').addEventListener('click', ()=>{
  const newOrder = manualSlots.filter(id=>id);
  const others = folders.filter(f=>f.parentId!==currentParent);
  const orderedCurrent = newOrder.map(id=>folders.find(f=>f.id===id));
  folders = others.concat(orderedCurrent);
  manualSortMode = false;
  manualSlots = [];
  render();
  toast('Order saved');
});

/* ---------- save / duplicate ---------- */
function toggleSaveFolder(){
  const f = folders.find(x=>x.id===activeFolderId);
  if(!f) return;
  f.saved = !f.saved;
  closeAllPanels();
  render();
  toast(f.saved ? 'Added to Favorites' : 'Removed from Favorites');
}

function duplicateFolder(){
  const f = folders.find(x=>x.id===activeFolderId);
  if(!f) return;
  const root = {...f, id: uid(), name: f.name + ' copy'};
  const newFolders = [root];
  (function collectChildren(origParentId, newParentId){
    folders.filter(x=>x.parentId===origParentId).forEach(child=>{
      const clone = {...child, id: uid(), parentId: newParentId};
      newFolders.push(clone);
      collectChildren(child.id, clone.id);
    });
  })(f.id, root.id);
  folders.push(...newFolders);
  closeAllPanels();
  render();
  toast('Folder duplicated');
}

/* ---------- settings / theme ---------- */
function applyTheme(t){
  currentTheme = t;
  if(t==='light'){
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', t);
  }
  updateSettingsModalSelection();
  saveState();
}
function updateSettingsModalSelection(){
  document.querySelectorAll('#modeGrid .mode-option').forEach(b=>{
    b.classList.toggle('selected', b.dataset.mode===currentTheme);
  });
}
function openSettingsModal(){
  closeAllPanels();
  updateSettingsModalSelection();
  $('settingsModal').classList.add('show');
}

$('overlay').addEventListener('click', closeAllPanels);

/* ---------- new folder (supports creating up to 10 at once) ---------- */
const NF_MAX = 10;
let nfTotal = 1;       // how many folders the user wants to create this round
let nfIndex = 0;       // which one (0-based) is currently being named
let nfNames = [''];
let nfCreatedIds = []; // ids of folders already committed this session (for Cancel rollback)
let nfAutoNames = false;

function openNewFolderModal(){
  closeAllPanels();
  nfTotal = 1;
  nfIndex = 0;
  nfNames = [''];
  nfCreatedIds = [];
  nfAutoNames = false;
  $('newFolderInput').value = '';
  $('newFolderInput').disabled = false;
  $('nfAutoToggle').checked = false;
  updateNewFolderUI();
  $('newFolderModal').classList.add('show');
  setTimeout(()=>$('newFolderInput').focus(), 50);
}

function updateNewFolderUI(){
  $('nfCountLabel').textContent = nfTotal;
  $('nfMinusBtn').disabled = nfTotal <= Math.max(1, nfIndex + 1);
  $('nfPlusBtn').disabled = nfTotal >= NF_MAX;

  const input = $('newFolderInput');
  const nextBtn = $('nfNextBtn');

  if(nfAutoNames){
    input.disabled = true;
    input.value = '';
    input.placeholder = 'Auto-generated';
    nextBtn.style.display = 'none';
  } else {
    input.disabled = false;
    input.placeholder = 'Folder name';
    if(nfTotal > 1){
      nextBtn.style.display = 'flex';
      // blocked whenever the folder currently being named is the last one queued up
      nextBtn.disabled = nfIndex >= nfTotal - 1;
    } else {
      nextBtn.style.display = 'none';
    }
  }
}

function nfChangeCount(delta){
  const newTotal = nfTotal + delta;
  const minAllowed = Math.max(1, nfIndex + 1); // can't drop below the folder currently being named
  if(newTotal < minAllowed || newTotal > NF_MAX) return;
  nfTotal = newTotal;
  while(nfNames.length < nfTotal) nfNames.push('');
  if(nfNames.length > nfTotal) nfNames.length = nfTotal;
  updateNewFolderUI();
}

function nfToggleAuto(){
  nfAutoNames = $('nfAutoToggle').checked;
  updateNewFolderUI();
}

function nfCreateCurrent(name){
  const f = {id:uid(), name, emoji:'', color: DEFAULT_COLOR, parentId: currentParent, saved:false, tagId:null, createdAt: Date.now()};
  folders.push(f);
  nfCreatedIds.push(f.id);
  return f;
}

function nfNext(){
  if(nfAutoNames || $('nfNextBtn').disabled) return;
  const name = $('newFolderInput').value.trim();
  if(!name){ toast('Give the folder a name'); return; }
  nfNames[nfIndex] = name;
  nfCreateCurrent(name);
  render(); // new folder appears on the home page right away, behind the modal
  nfIndex++;
  $('newFolderInput').value = nfNames[nfIndex] || '';
  updateNewFolderUI();
  setTimeout(()=>$('newFolderInput').focus(), 30);
}

function createFolder(){
  if(nfAutoNames){
    let createdCount = nfIndex; // already manually created before switching to Auto
    for(let i=nfIndex; i<nfTotal; i++){
      nfCreateCurrent('New folder ' + (i+1));
      createdCount++;
    }
    closeModals();
    render();
    toast(createdCount > 1 ? (createdCount + ' folders created') : 'Folder created');
    return;
  }

  const name = $('newFolderInput').value.trim();
  let createdCount = nfIndex;
  if(name){
    nfCreateCurrent(name);
    createdCount++;
  } else if(nfIndex === 0){
    toast('Give the folder a name');
    return;
  }
  // if the current field is left blank but earlier folders were already made,
  // Done just finishes up and keeps the ones already created.
  closeModals();
  render();
  toast(createdCount > 1 ? (createdCount + ' folders created') : 'Folder created');
}

function cancelNewFolder(){
  // any folders already committed during this multi-create session get removed
  if(nfCreatedIds.length){
    const idSet = new Set(nfCreatedIds);
    folders = folders.filter(f=>!idSet.has(f.id));
  }
  nfCreatedIds = [];
  closeModals();
  render();
}

$('newFolderInput').addEventListener('keydown', e=>{
  if(e.key!=='Enter') return;
  if(nfAutoNames){ createFolder(); return; }
  if(nfTotal > 1 && nfIndex < nfTotal - 1){ nfNext(); }
  else { createFolder(); }
});

/* ---------- rename ---------- */
function openRenameModal(){
  closeAllPanels();
  const f = folders.find(x=>x.id===activeFolderId);
  $('renameInput').value = f.name;
  $('renameModal').classList.add('show');
  setTimeout(()=>{$('renameInput').focus(); $('renameInput').select();}, 50);
}
function confirmRename(){
  const f = folders.find(x=>x.id===activeFolderId);
  const val = $('renameInput').value.trim();
  if(!val){ toast('Name cannot be empty'); return; }
  f.name = val;
  closeModals();
  render();
  toast('Folder renamed');
}
$('renameInput').addEventListener('keydown', e=>{ if(e.key==='Enter') confirmRename(); });

/* ---------- customize folder (color / cover) ---------- */
let cfPendingColor = DEFAULT_COLOR;
let cfPendingCover = null;   // cover id, or null when a plain color is chosen
let cfActiveTab = 'color';   // 'color' | 'cover' - which section is showing

function cfSwitchTab(tab){
  cfActiveTab = tab;
  $('cfTabColor').classList.toggle('active', tab==='color');
  $('cfTabCover').classList.toggle('active', tab==='cover');
  $('cfColorSection').style.display = tab==='color' ? 'block' : 'none';
  $('cfCoverSection').style.display = tab==='cover' ? 'block' : 'none';
}

function cfUpdatePreview(){
  if(cfPendingCover){
    $('cfPreviewSvg').innerHTML = folderIconSVG({cover: cfPendingCover});
    $('cfHexReadout').style.display = 'none';
    document.querySelectorAll('#coverRow .cover-option').forEach(op=>{
      op.classList.toggle('selected', op.dataset.cover === cfPendingCover);
    });
    document.querySelectorAll('#swatchRow .color-circle').forEach(sw=>sw.classList.remove('selected'));
    return;
  }
  const hex = cfPendingColor.toUpperCase();
  const bodyHex = softerColor(hex);
  $('cfPreviewSvg').innerHTML = folderIconSVG({color: hex});
  $('cfHexReadout').style.display = 'flex';
  $('cfHexTop').textContent = hex;
  $('cfHexBody').textContent = bodyHex;
  $('cfDotTop').style.background = hex;
  $('cfDotBody').style.background = bodyHex;
  $('cfCustomColor').value = hex;
  $('cfHexInput').value = hex;
  document.querySelectorAll('#swatchRow .color-circle').forEach(sw=>{
    sw.classList.toggle('selected', sw.dataset.color.toUpperCase() === hex);
  });
  document.querySelectorAll('#coverRow .cover-option').forEach(op=>op.classList.remove('selected'));
}
function cfPickColor(hex){
  cfPendingColor = hex.toUpperCase();
  cfPendingCover = null;
  cfUpdatePreview();
}
function cfPickCover(coverId){
  cfPendingCover = coverId;
  cfUpdatePreview();
}

function openColorModal(){
  closeAllPanels();
  const f = folders.find(x=>x.id===activeFolderId);
  cfPendingColor = (f.color || DEFAULT_COLOR).toUpperCase();
  cfPendingCover = f.cover || null;

  const colorRow = $('swatchRow');
  colorRow.innerHTML='';
  COLORS.forEach(c=>{
    const sw = document.createElement('div');
    sw.className = 'color-circle';
    sw.style.background = c;
    sw.dataset.color = c;
    sw.title = c;
    sw.onclick = ()=>cfPickColor(c);
    colorRow.appendChild(sw);
  });

  const coverRow = $('coverRow');
  coverRow.innerHTML='';
  COVERS.forEach(c=>{
    const op = document.createElement('div');
    op.className = 'cover-option';
    op.dataset.cover = c.id;
    op.innerHTML = `<img src="${c.src}" alt="">`;
    op.onclick = ()=>cfPickCover(c.id);
    coverRow.appendChild(op);
  });

  $('cfCustomColor').oninput = (e)=>cfPickColor(e.target.value);
  $('cfHexInput').onchange = (e)=>{
    let val = e.target.value.trim();
    if(!val.startsWith('#')) val = '#' + val;
    if(/^#([0-9A-Fa-f]{6})$/.test(val)){
      cfPickColor(val);
    } else {
      cfUpdatePreview();
    }
  };

  cfSwitchTab(cfPendingCover ? 'cover' : 'color');
  cfUpdatePreview();
  $('colorModal').classList.add('show');
}
function confirmColor(){
  const f = folders.find(x=>x.id===activeFolderId);
  if(cfPendingCover){
    f.cover = cfPendingCover;
  } else {
    f.color = cfPendingColor;
    delete f.cover;
  }
  closeModals();
  render();
  toast('Folder updated');
}

/* ---------- tag folder ---------- */
function openTagModal(){
  closeAllPanels();
  const f = folders.find(x=>x.id===activeFolderId);
  modalSelectedTagId = f ? (f.tagId || null) : null;
  creatingNewTag = false;
  $('newTagInput').value = '';
  $('tagCreateForm').style.display = 'none';
  renderTagListRow();
  $('tagModal').classList.add('show');
}

function renderTagListRow(){
  const row = $('tagListRow');
  row.innerHTML = '';

  const checkSVG = `<svg class="check" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 12 9 17 20 6"/></svg>`;

  // "No tag" option
  const noneRow = document.createElement('div');
  noneRow.className = 'tag-row' + (modalSelectedTagId===null && !creatingNewTag ? ' selected' : '');
  noneRow.innerHTML = `<span class="dot" style="background:#c9ced6;"></span><span class="name">No tag</span>${checkSVG}`;
  noneRow.onclick = ()=>{
    modalSelectedTagId = null;
    creatingNewTag = false;
    $('tagCreateForm').style.display = 'none';
    renderTagListRow();
  };
  row.appendChild(noneRow);

  // existing tags
  tags.forEach(t=>{
    const r = document.createElement('div');
    r.className = 'tag-row' + (modalSelectedTagId===t.id && !creatingNewTag ? ' selected' : '');
    r.innerHTML = `<span class="dot" style="background:${t.color}"></span><span class="name">${escapeHtml(t.name)}</span>${checkSVG}`;
    r.onclick = ()=>{
      modalSelectedTagId = t.id;
      creatingNewTag = false;
      $('tagCreateForm').style.display = 'none';
      renderTagListRow();
    };
    row.appendChild(r);
  });

  // "new tag" toggle
  const addRow = document.createElement('div');
  addRow.className = 'tag-add-row' + (creatingNewTag ? ' selected' : '');
  addRow.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg><span>New tag</span>`;
  addRow.onclick = ()=>{
    creatingNewTag = true;
    renderTagListRow();
    $('tagCreateForm').style.display = 'block';
    buildTagSwatches();
    setTimeout(()=>{ $('newTagInput').focus(); }, 50);
  };
  row.appendChild(addRow);
}

function buildTagSwatches(){
  const row = $('tagSwatchRow');
  row.innerHTML = '';
  COLORS.forEach((c,i)=>{
    const sw = document.createElement('div');
    sw.className = 'swatch' + (i===0 ? ' selected' : '');
    sw.style.background = c;
    sw.dataset.color = c;
    sw.onclick = ()=>{
      row.querySelectorAll('.swatch').forEach(s=>s.classList.remove('selected'));
      sw.classList.add('selected');
    };
    row.appendChild(sw);
  });
}

function confirmTag(){
  const f = folders.find(x=>x.id===activeFolderId);
  if(!f) return;

  if(creatingNewTag){
    const name = $('newTagInput').value.trim();
    if(!name){ toast('Give the tag a name'); return; }
    const sel = document.querySelector('#tagSwatchRow .swatch.selected');
    const color = sel ? sel.dataset.color : COLORS[0];
    const newTag = {id: uid(), name, color};
    tags.push(newTag);
    f.tagId = newTag.id;
    activeTagFilter = newTag.id;
  } else {
    f.tagId = modalSelectedTagId;
  }

  closeModals();
  render();
  toast(f.tagId ? 'Folder tagged' : 'Tag removed');
}
$('newTagInput').addEventListener('keydown', e=>{ if(e.key==='Enter') confirmTag(); });

/* ---------- move (folder browser) ---------- */
let moveNavContext = null;      // 'single' | 'bulk'
let moveNavParent = null;       // id of the folder currently open in the picker (move target); null = top level
let moveNavPath = [];           // [{id,name}, ...] breadcrumb trail for the picker
let moveNavExclude = new Set(); // folder id(s) that can't be navigated into or chosen as the target

function openMoveModal(){
  closeAllPanels();
  const f = folders.find(x=>x.id===activeFolderId);
  moveNavContext = 'single';
  moveNavExclude = new Set([f.id]);
  moveNavParent = null;
  moveNavPath = [];
  $('moveModalTitle').textContent = `Move ${f.name} to:`;
  renderMoveGrid();
  $('moveModal').classList.add('show');
}

function moveNavInto(folder){
  moveNavPath.push({id:folder.id, name:folder.name});
  moveNavParent = folder.id;
  renderMoveGrid();
}
function moveNavBack(){
  moveNavPath.pop();
  moveNavParent = moveNavPath.length ? moveNavPath[moveNavPath.length-1].id : null;
  renderMoveGrid();
}
function renderMoveGrid(){
  const list = $('moveList');
  list.innerHTML = '';

  const nested = moveNavPath.length > 0;
  $('moveBackBtn').style.display = nested ? 'flex' : 'none';
  $('moveCrumbLabel').textContent = nested ? moveNavPath[moveNavPath.length-1].name : 'Home';

  const children = folders.filter(x=>
    x.parentId === moveNavParent &&
    !moveNavExclude.has(x.id) &&
    ![...moveNavExclude].some(id=>isDescendantOf(x.id, id))
  );

  if(!children.length){
    const empty = document.createElement('div');
    empty.className = 'move-empty';
    empty.textContent = 'No folders here';
    list.appendChild(empty);
  }

  children.forEach(target=>{
    const tile = document.createElement('div');
    tile.className = 'move-tile';
    tile.innerHTML = `<span class="move-tile-icon">${folderIconSVG(target)}</span><span class="move-tile-label">${escapeHtml(target.name)}</span>`;
    tile.onclick = ()=> moveNavInto(target);
    list.appendChild(tile);
  });
}

function confirmMoveHere(){
  if(moveNavContext==='single') doMove(moveNavParent);
  else if(moveNavContext==='bulk') doBulkMove(moveNavParent);
}

function doMove(targetId){
  const f = folders.find(x=>x.id===activeFolderId);
  f.parentId = targetId;
  closeModals();
  render();
  toast('Folder moved');
}

/* ---------- details ---------- */
function openDetailsModal(){
  closeAllPanels();
  const f = folders.find(x=>x.id===activeFolderId);
  if(!f) return;

  const created = new Date(f.createdAt);
  const dateStr = `${created.getDate()}/${created.getMonth()+1}/${created.getFullYear()}`;
  let hours = created.getHours();
  const minutes = created.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12; if(hours === 0) hours = 12;
  const timeStr = `${hours}:${String(minutes).padStart(2,'0')} ${ampm}`;

  const itemCount = folders.filter(x=>x.parentId===f.id).length;
  const itemsStr = `${itemCount} ${itemCount===1 ? 'item' : 'items'}`;

  $('detailsFolderName').textContent = f.name;
  $('detailsDate').textContent = dateStr;
  $('detailsTime').textContent = timeStr;
  $('detailsItems').textContent = itemsStr;

  $('detailsModal').classList.add('show');
}

/* ---------- delete ---------- */
function openDeleteModal(){
  closeAllPanels();
  pendingBulkDelete = false;
  $('deleteModal').classList.add('show');
}
function confirmDelete(){
  if(pendingBulkDelete){
    selectedIds.forEach(id=>{
      const idx = folders.findIndex(x=>x.id===id);
      if(idx>-1){
        const [f] = folders.splice(idx,1);
        deleted.push(f);
      }
    });
    pendingBulkDelete = false;
    closeModals();
    exitSelectMode();
    toast('Folders deleted');
    return;
  }
  const idx = folders.findIndex(x=>x.id===activeFolderId);
  if(idx>-1){
    const [f] = folders.splice(idx,1);
    deleted.push(f);
  }
  closeModals();
  render();
  toast('Folder deleted');
}

/* ---------- trash actions ---------- */
function restoreActiveTrashItem(){
  closeAllPanels();
  const idx = deleted.findIndex(d=>d.id===activeTrashId);
  if(idx>-1){
    const [f] = deleted.splice(idx,1);
    f.parentId = null;
    folders.push(f);
    toast('Folder restored');
    render();
  }
  activeTrashId = null;
}
function openPermaDeleteModal(){
  closeAllPanels();
  pendingBulkPermaDelete = false;
  $('permaDeleteModal').classList.add('show');
}
function confirmPermaDelete(){
  if(pendingBulkPermaDelete){
    const ids = new Set(trashSelectedIds);
    deleted = deleted.filter(d=>!ids.has(d.id));
    pendingBulkPermaDelete = false;
    closeModals();
    exitTrashSelectMode();
    toast('Folders deleted forever');
    return;
  }
  const idx = deleted.findIndex(d=>d.id===activeTrashId);
  if(idx>-1) deleted.splice(idx,1);
  activeTrashId = null;
  closeModals();
  render();
  toast('Folder deleted forever');
}

/* click outside modal closes it */
document.querySelectorAll('.modal-back').forEach(m=>{
  m.addEventListener('click', e=>{
    if(e.target !== m) return;
    if(m.id === 'newFolderModal'){ cancelNewFolder(); }
    else { closeModals(); }
  });
});

/* ---------- keyboard-aware modal positioning ---------- */
// Primary method: visualViewport, where supported (most modern mobile browsers).
(function setupKeyboardHandling(){
  if(!window.visualViewport) return;
  const vv = window.visualViewport;
  function onResize(){
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    // only nudge the modal up meaningfully once the keyboard is actually open
    document.documentElement.style.setProperty('--kb-offset', kb > 60 ? kb + 'px' : '0px');
  }
  vv.addEventListener('resize', onResize);
  vv.addEventListener('scroll', onResize);
  onResize();
})();

// Fallback / universal method: works in webviews (like Acode's preview) where
// visualViewport doesn't report the keyboard's height change. Whenever a modal
// input gets focus, scroll it into the visible middle of the screen directly.
document.querySelectorAll('.modal input[type=text]').forEach(input=>{
  input.addEventListener('focus', ()=>{
    setTimeout(()=>{
      input.scrollIntoView({block:'center', behavior:'smooth'});
    }, 300);
  });
});

/* ---------- drag & drop: reorder + move into folder ---------- */
let dragState = null;

function attachDragHandlers(){
  $('folderGrid').addEventListener('pointerdown', onDragPointerDown);
}

function onDragPointerDown(e){
  if(e.button !== undefined && e.button !== 0) return;
  if(activeTab !== 'home' || searchQuery || selectMode || manualSortMode) return; // only reorder while browsing folders normally
  const item = e.target.closest('.folder-item');
  if(!item) return;
  dragState = {
    id: item.dataset.id,
    startX: e.clientX,
    startY: e.clientY,
    dragging: false,
    el: item
  };
  document.addEventListener('pointermove', onDragPointerMove);
  document.addEventListener('pointerup', onDragPointerUp, {once:true});
}

function onDragPointerMove(e){
  if(!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  if(!dragState.dragging){
    if(Math.abs(dx) > 8 || Math.abs(dy) > 8){
      startDragging(e);
    } else {
      return;
    }
  }
  e.preventDefault();
  moveGhost(e);
  updateHover(e);
}

function startDragging(e){
  dragState.dragging = true;
  const rect = dragState.el.getBoundingClientRect();
  const ghost = dragState.el.cloneNode(true);
  ghost.style.position='fixed';
  ghost.style.left = rect.left+'px';
  ghost.style.top = rect.top+'px';
  ghost.style.width = rect.width+'px';
  ghost.style.margin='0';
  ghost.style.pointerEvents='none';
  ghost.style.opacity='0.9';
  ghost.style.zIndex='999';
  ghost.style.transform='scale(1.05) rotate(-2deg)';
  ghost.style.transition='none';
  document.body.appendChild(ghost);
  dragState.ghost = ghost;
  dragState.offsetX = e.clientX - rect.left;
  dragState.offsetY = e.clientY - rect.top;
  dragState.el.style.opacity = '0.3';
  dragState.hoverTarget = null;
  dragState.hoverHistory = [];
  dragState.suppressNestId = null;
}

function moveGhost(e){
  const g = dragState.ghost;
  if(!g) return;
  g.style.left = (e.clientX - dragState.offsetX)+'px';
  g.style.top = (e.clientY - dragState.offsetY)+'px';
}

function updateHover(e){
  document.querySelectorAll('.folder-item.drag-over').forEach(x=>x.classList.remove('drag-over'));
  dragState.ghost.style.display='none';
  const under = document.elementFromPoint(e.clientX, e.clientY);
  dragState.ghost.style.display='';
  const targetItem = under ? under.closest('.folder-item') : null;
  const targetId = (targetItem && targetItem.dataset.id !== dragState.id) ? targetItem.dataset.id : null;

  if(targetId !== dragState.hoverTarget){
    dragState.hoverTarget = targetId;
    dragState.hoverHistory = targetId ? [{x:e.clientX, t:Date.now()}] : [];
  } else if(targetId){
    dragState.hoverHistory.push({x:e.clientX, t:Date.now()});
    if(dragState.hoverHistory.length > 14) dragState.hoverHistory.shift();
    checkShake();
  }

  if(targetId && dragState.suppressNestId !== targetId){
    targetItem.classList.add('drag-over');
  }
}

function checkShake(){
  const hist = dragState.hoverHistory;
  if(hist.length < 6) return;
  const now = Date.now();
  const recent = hist.filter(p=> now-p.t < 700);
  if(recent.length < 6) return;
  let reversals = 0;
  for(let i=2;i<recent.length;i++){
    const d1 = recent[i-1].x - recent[i-2].x;
    const d2 = recent[i].x - recent[i-1].x;
    if(Math.abs(d1) > 6 && Math.abs(d2) > 6 && (d1>0) !== (d2>0)) reversals++;
  }
  if(reversals >= 2 && dragState.suppressNestId !== dragState.hoverTarget){
    const targetId = dragState.hoverTarget;
    dragState.suppressNestId = targetId;
    document.querySelectorAll('.folder-item.drag-over').forEach(x=>x.classList.remove('drag-over'));
    const target = folders.find(f=>f.id===targetId);
    if(target){
      // bump the target folder to the 2nd position among its siblings
      const idx = folders.indexOf(target);
      folders.splice(idx,1);
      const remainingSiblings = folders.filter(f=>f.parentId===target.parentId);
      let insertAt;
      if(remainingSiblings.length===0){
        insertAt = folders.length;
      } else {
        insertAt = folders.indexOf(remainingSiblings[0]) + 1;
      }
      folders.splice(insertAt, 0, target);
      render();
      toast(target.name + ' moved to 2nd position');
      const el = document.querySelector(`.folder-item[data-id="${dragState.id}"]`);
      if(el){ dragState.el = el; el.style.opacity = '0.3'; }
    }
  }
}

function onDragPointerUp(e){
  document.removeEventListener('pointermove', onDragPointerMove);
  if(!dragState) return;
  if(dragState.dragging){
    finishDrag(e);
  }
  dragState = null;
}

function isDescendantOf(candidateId, ancestorId){
  let cur = folders.find(f=>f.id===candidateId);
  while(cur){
    if(cur.id===ancestorId) return true;
    cur = folders.find(f=>f.id===cur.parentId);
  }
  return false;
}

function finishDrag(e){
  document.querySelectorAll('.folder-item.drag-over').forEach(x=>x.classList.remove('drag-over'));
  if(dragState.ghost) dragState.ghost.remove();
  const draggedEl = document.querySelector(`.folder-item[data-id="${dragState.id}"]`);
  if(draggedEl) draggedEl.style.opacity = '';

  const dragged = folders.find(f=>f.id===dragState.id);
  if(!dragged) return;

  const under = document.elementFromPoint(e.clientX, e.clientY);
  const targetItem = under ? under.closest('.folder-item') : null;
  const targetId = targetItem ? targetItem.dataset.id : null;

  window.__justDragged = true;
  setTimeout(()=>{ window.__justDragged = false; }, 0);

  if(targetId && targetId !== dragged.id && dragState.suppressNestId !== targetId){
    const target = folders.find(f=>f.id===targetId);
    if(target && !isDescendantOf(target.id, dragged.id)){
      dragged.parentId = target.id;
      const idx = folders.indexOf(dragged);
      folders.splice(idx,1);
      folders.push(dragged);
      render();
      toast('Moved into ' + target.name);
      return;
    }
  }

  reorderDrop(dragged, e);
  render();
}

function reorderDrop(dragged, e){
  const siblingEls = Array.from(document.querySelectorAll('.folder-item[data-id]')).filter(el=>{
    if(el.dataset.id === dragged.id) return false;
    const f = folders.find(x=>x.id===el.dataset.id);
    return f && f.parentId === dragged.parentId;
  });
  let insertBeforeId = null;
  for(const el of siblingEls){
    const r = el.getBoundingClientRect();
    const sameRow = e.clientY >= r.top && e.clientY <= r.bottom;
    if(e.clientY < r.top || (sameRow && e.clientX < r.left + r.width/2)){
      insertBeforeId = el.dataset.id;
      break;
    }
  }
  const idx = folders.indexOf(dragged);
  folders.splice(idx,1);
  if(insertBeforeId){
    const targetIdx = folders.findIndex(f=>f.id===insertBeforeId);
    folders.splice(targetIdx, 0, dragged);
  } else {
    let lastIdx = -1;
    folders.forEach((f,i)=>{ if(f.parentId===dragged.parentId) lastIdx = i; });
    folders.splice(lastIdx+1, 0, dragged);
  }
}

attachDragHandlers();
(async ()=>{
  await loadState();
  render();
})();
