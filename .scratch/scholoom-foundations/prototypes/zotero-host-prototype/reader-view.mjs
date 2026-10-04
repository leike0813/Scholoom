// Minimal independent PDF view. Single-page rendering is serialized and bounded.
import {getDocument, GlobalWorkerOptions} from '/pdf.mjs';
GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
const request = async (method, params = {}) => {
  if (window.literatureClient) return window.literatureClient.request(method, params);
  const response = await fetch('/api', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({method, params})});
  const value = await response.json();
  if (!response.ok) throw Error(value.error);
  return value;
};
const state = {page: null, renderedText: '', target: null, navigation: null, renders: 0};
window.readingState = state;
let pdf, selected, queue = Promise.resolve();
const status = document.getElementById('status');
async function render(location) {
  const page = await pdf.getPage(location.page);
  const viewport = page.getViewport({scale: 0.8});
  const canvas = document.querySelector('canvas');
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  await page.render({canvasContext: canvas.getContext('2d'), viewport}).promise;
  const content = await page.getTextContent();
  state.renderedText = content.items.map(item => item.str || '').join(' ');
  const point = viewport.convertToViewportPoint(location.x, location.y);
  const roundtrip = viewport.convertToPdfPoint(...point);
  const marker = document.getElementById('position');
  marker.style.left = `${point[0]}px`; marker.style.top = `${point[1]}px`; marker.hidden = false;
  state.page = location.page; state.target = {pdf: location, viewport: point, roundtrip}; state.renders++;
  document.getElementById('page-label').textContent = `第 ${location.page} / ${pdf.numPages} 页`;
  status.textContent = '已定位';
}
function navigate(location) {
  queue = queue.then(() => render(location)).catch(error => {state.error = error.message; status.textContent = error.message;});
}
function project(navigation) {
  state.navigation = navigation;
  const outline = document.getElementById('outline'); outline.replaceChildren();
  const addOutline = nodes => nodes.forEach(node => {
    const button = document.createElement('button'); button.textContent = node.title;
    button.onclick = () => navigate(node.location); outline.append(button); addOutline(node.children);
  });
  addOutline(navigation.outline);
  const bookmarks = document.getElementById('bookmarks'); bookmarks.replaceChildren();
  for (const bookmark of navigation.bookmarks) {
    const button = document.createElement('button'); button.textContent = bookmark.title;
    button.onclick = () => {selected = bookmark; document.getElementById('bookmark-title').value = bookmark.title; navigate(bookmark.location);};
    bookmarks.append(button);
  }
}
document.getElementById('save-bookmark').onclick = async () => {
  try {
    if (!selected) throw Error('请先选择书签');
    const navigation = await request('renameBookmark', {bookmarkId: selected.id, title: document.getElementById('bookmark-title').value});
    project(navigation); status.textContent = '已保存'; state.savedBookmarkId = selected.id;
  } catch (error) {state.error = error.message; status.textContent = error.message;}
};
document.getElementById('reload').onclick = async () => {
  try {project(await request('readNavigation')); status.textContent = '已重新读取';}
  catch (error) {state.error = error.message; status.textContent = error.message;}
};
try {
  const source = await request('read'); document.getElementById('title').textContent = source.title;
  const material = await request('readMaterial');
  const bytes = Uint8Array.from(material.bytes);
  pdf = await getDocument({data: bytes}).promise; state.pageCount = pdf.numPages;
  project(await request('readNavigation'));
  await render(state.navigation.outline[0].location); state.ready = true;
} catch (error) {state.error = error.message; status.textContent = error.message;}
