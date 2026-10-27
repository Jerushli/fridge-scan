import { useEffect, useRef, useState } from "react";
import { Camera, Refrigerator, ShoppingBasket, ChefHat, Plus, Trash2, Check, X, RefreshCw, Sparkles, AlertCircle, Leaf, ArrowRight, Image as ImageIcon } from "lucide-react";
import React from 'react';

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, options);
  if (!response.ok) {
    let message = "Something went wrong. Please try again.";
    try { message = (await response.json()).error || message; } catch {}
    throw new Error(message);
  }
  if (response.status === 204) return null;
  return response.json();
}
const stockLabel = { available: "In stock", low: "Running low", empty: "Empty" };

export default function App() {
  const [tab, setTab] = useState("fridge");
  const [items, setItems] = useState([]);
  const [groceries, setGroceries] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [streamError, setStreamError] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [newName, setNewName] = useState("");
  const [modal, setModal] = useState(null);
  const [recipeDetail, setRecipeDetail] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  async function refresh() {
    try {
      const [i, g, r] = await Promise.all([api("/api/items"), api("/api/groceries"), api("/api/recipes")]);
      setItems(i.items); setGroceries(g.items); setRecipes(r.recipes);
    } catch (e) { setError(`${e.message} Is the backend running?`); }
  }
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    if (cameraOpen) {
      navigator.mediaDevices?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
        .then(stream => { streamRef.current = stream; if (videoRef.current) videoRef.current.srcObject = stream; })
        .catch(() => setStreamError("Camera access was blocked or unavailable. Allow camera permission, or use sample photos."));
    }
    return () => stopCamera();
  }, [cameraOpen]);
  function stopCamera() { streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; }
  function takePhoto() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return setStreamError("Camera is still starting. Try again in a moment.");
    if (photos.length >= 3) return setStreamError("You can capture up to 3 photos per scan.");
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(blob => {
      if (blob) setPhotos(old => [...old, { file: new File([blob], `fridge-${Date.now()}.jpg`, { type: "image/jpeg" }), url: URL.createObjectURL(blob) }]);
    }, "image/jpeg", 0.88);
    setStreamError("");
  }
  
  function handleFileUpload(event) {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = "";

    const validFiles = selectedFiles.filter(file =>
      file.type.startsWith("image/")
    );

    if (validFiles.length !== selectedFiles.length) {
      setStreamError("Please select image files only.");
    } else {
      setStreamError("");
    }

    setPhotos(old => {
      const availableSlots = 3 - old.length;
      const filesToAdd = validFiles.slice(0, availableSlots);

      if (validFiles.length > availableSlots) {
        setStreamError("You can select up to 3 photos in total.");
      }

      const newPhotos = filesToAdd.map(file => ({
        file,
        url: URL.createObjectURL(file)
      }));

      return [...old, ...newPhotos];
    });
  }

  function removePhoto(index) {
    setPhotos(old => { URL.revokeObjectURL(old[index].url); return old.filter((_, i) => i !== index); });
  }
  async function scan(source = "camera") {
    setBusy(true); setError(""); setNotice("");
    try {
      const form = new FormData(); form.append("source", source);
      if (source !== "sample") {
  photos.forEach(p => form.append("photos", p.file));
}
      const result = await api("/api/scan", { method: "POST", body: form });
      setItems(result.items); setNotice(result.notice || "Scan complete.");
      photos.forEach(p => URL.revokeObjectURL(p.url)); setPhotos([]);
      setCameraOpen(false); stopCamera(); await refresh();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }
  async function updateItem(item, changes) {
    try {
      const result = await api(`/api/items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) });
      setItems(old => old.map(i => i.id === item.id ? result.item : i)); setEditing(null); await refresh();
    } catch (e) { setError(e.message); }
  }
  async function addItem() {
    if (!newName.trim()) return;
    try {
      await api("/api/items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName, quantity: 1, unit: "item" }) });
      setNewName(""); await refresh();
    } catch (e) { setError(e.message); }
  }
  async function deleteItem(item) {
    try { await api(`/api/items/${item.id}`, { method: "DELETE" }); await refresh(); }
    catch (e) { setError(e.message); }
  }
  async function addGrocery(name, quantity = 1, unit = "item", source = "manual") {
    try {
      await api("/api/groceries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, quantity, unit, source }) });
      await refresh(); setModal(null);
    } catch (e) { setError(e.message); }
  }
  async function updateGrocery(item, changes) {
    try {
      await api(`/api/groceries/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(changes) }); await refresh();
    } catch (e) { setError(e.message); }
  }
  async function deleteGrocery(item) {
    try { await api(`/api/groceries/${item.id}`, { method: "DELETE" }); await refresh(); }
    catch (e) { setError(e.message); }
  }
  async function addLowStock() {
    try { const result = await api("/api/groceries/from-low-stock", { method: "POST" }); await refresh(); setNotice(`${result.added.length} low-stock item(s) added to your grocery list.`); setTab("groceries"); }
    catch (e) { setError(e.message); }
  }
  const lowCount = items.filter(i => i.stock_status !== "available").length;
  const readyCount = recipes.filter(r => r.readyToCook).length;

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#" onClick={e => { e.preventDefault(); setTab("fridge"); }}>
        <span className="brand-mark"><Refrigerator size={23}/></span>
        <span>fridge<span className="brand-light">scan</span><small>FRESH IDEAS, LESS WASTE</small></span>
      </a>
      <div className="topbar-right"><span className="privacy"><span className="privacy-dot"/> Photos aren't saved</span><div className="avatar">F</div></div>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> YOUR KITCHEN, ORGANIZED</div>
          <h1>Make something<br/><em>delicious.</em></h1>
          <p>See what's in your fridge, find your next favorite meal, and keep your grocery list one step ahead.</p>
          <div className="hero-actions"><button className="btn btn-dark" onClick={() => { setCameraOpen(true); setStreamError(""); }}><Camera size={17}/> Scan my fridge <ArrowRight size={16}/></button><button className="btn btn-quiet" onClick={() => scan("sample")} disabled={busy}><ImageIcon size={17}/> Try sample scan</button></div>
        </div>
        <div className="hero-art"><div className="art-orbit orbit-one"/><div className="art-orbit orbit-two"/><div className="food-emoji food-apple">🍎</div><div className="food-emoji food-broccoli">🥦</div><div className="food-emoji food-milk">🥛</div><div className="food-emoji food-cheese">🧀</div><div className="art-card"><span className="art-card-icon"><Leaf size={18}/></span><div><b>A little less waste.</b><small>A lot more delicious.</small></div><span className="art-check"><Check size={15}/></span></div></div>
      </section>

      <nav className="tabs" aria-label="Main navigation">
        <button className={tab === "fridge" ? "tab active" : "tab"} onClick={() => setTab("fridge")}><Refrigerator size={17}/> My fridge <span className="tab-count">{items.length}</span></button>
        <button className={tab === "recipes" ? "tab active" : "tab"} onClick={() => setTab("recipes")}><ChefHat size={17}/> Recipes <span className="tab-count">{recipes.length}</span></button>
        <button className={tab === "groceries" ? "tab active" : "tab"} onClick={() => setTab("groceries")}><ShoppingBasket size={17}/> Grocery list <span className="tab-count">{groceries.filter(g => !g.checked).length}</span></button>
      </nav>

      {error && <div className="alert alert-error"><AlertCircle size={18}/><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss"><X size={16}/></button></div>}
      {notice && <div className="alert alert-note"><Sparkles size={17}/><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16}/></button></div>}

      {cameraOpen && <section className="camera-panel">
        <div className="section-heading"><div><div className="eyebrow">STEP 01</div><h2>Let's take a look inside.</h2><p>Capture 1–3 clear photos of your fridge shelves and door.</p></div><button className="icon-button" onClick={() => { setCameraOpen(false); stopCamera(); }} aria-label="Close camera"><X/></button></div>
        <div className="camera-grid"><div className="camera-view">{streamError ? <div className="camera-error"><Camera size={28}/><p>{streamError}</p></div> : <video ref={videoRef} autoPlay playsInline muted/>}<span className="camera-count">{photos.length}/3 photos</span></div>
          <div className="capture-side"><button className="btn btn-dark" onClick={takePhoto} disabled={photos.length >= 3}><Camera size={17}/> Capture photo</button>
  <input
    ref={fileInputRef}
    type="file"
    accept="image/*"
    multiple
    hidden
    onChange={handleFileUpload}
  />

  <button
    className="btn btn-outline"
    onClick={() => fileInputRef.current?.click()}
    disabled={photos.length >= 3}
  >
    <ImageIcon size={17} /> Upload from device
  </button>
<p className="helper">Tip: use good lighting and photograph one shelf at a time.</p><div className="photo-strip">{photos.map((p, i) => <div className="photo-thumb" key={p.url}><img src={p.url} alt={`Captured fridge view ${i + 1}`}/><button onClick={() => removePhoto(i)} aria-label="Delete photo"><X size={14}/></button></div>)}</div><button className="btn btn-green" disabled={!photos.length || busy} onClick={() => scan("camera")}>{busy ? <RefreshCw className="spin" size={16}/> : <Sparkles size={16}/>} {busy ? "Analyzing…" : "Analyze my fridge"}</button></div>
        </div>
      </section>}

      {tab === "fridge" && <section className="content-section">
        <div className="section-heading"><div><div className="eyebrow">YOUR INVENTORY</div><h2>Inside your fridge <span className="heading-count">{items.length}</span></h2><p>Review what's here and what might need a restock.</p></div><button className="btn btn-outline" onClick={() => { setCameraOpen(true); setStreamError(""); }}><Camera size={16}/> New scan</button></div>
        <div className="summary-grid"><div className="summary-card"><span className="summary-icon sage"><Refrigerator size={19}/></span><div><strong>{items.length}</strong><small>Items found</small></div></div><div className="summary-card"><span className="summary-icon peach"><AlertCircle size={19}/></span><div><strong>{lowCount}</strong><small>Need attention</small></div></div><div className="summary-card"><span className="summary-icon lavender"><ChefHat size={19}/></span><div><strong>{readyCount}</strong><small>Recipes ready</small></div></div></div>
        <div className="inventory-toolbar"><h3>Fridge inventory</h3><span>{items.length} items</span></div>
        {items.length === 0 ? <div className="empty-state"><div className="empty-illustration">🥬</div><h3>Your fridge is a blank canvas.</h3><p>Scan your fridge or try a sample scan to see your ingredients here.</p><button className="btn btn-dark" onClick={() => scan("sample")} disabled={busy}><Sparkles size={16}/> Try sample scan</button></div> :
          <div className="inventory-list">{items.map(item => <div className="inventory-row" key={item.id}>
            <div className="ingredient-icon">{foodIcon(item.name)}</div>
            {editing?.id === item.id ? <div className="edit-fields"><input aria-label="Item name" value={editing.name} onChange={e => setEditing({...editing, name:e.target.value})}/><input aria-label="Quantity" type="number" min="0" step="0.5" value={editing.quantity} onChange={e => setEditing({...editing, quantity:e.target.value})}/><select aria-label="Stock status" value={editing.stockStatus} onChange={e => setEditing({...editing, stockStatus:e.target.value})}><option value="available">In stock</option><option value="low">Running low</option><option value="empty">Empty</option></select><button className="mini-action success" onClick={() => updateItem(item, editing)} aria-label="Save"><Check size={16}/></button><button className="mini-action" onClick={() => setEditing(null)} aria-label="Cancel"><X size={16}/></button></div> :
              <><div className="ingredient-info"><b>{item.name}</b><small>{item.quantity} {item.unit}</small></div><span className={`stock-badge ${item.stock_status}`}>{item.stock_status !== "available" && <span/>}{stockLabel[item.stock_status]}</span><div className="row-actions"><button className="mini-action" onClick={() => setEditing({ id:item.id, name:item.name, quantity:item.quantity, stockStatus:item.stock_status })} aria-label={`Edit ${item.name}`}>Edit</button><button className="mini-action" onClick={() => setModal({ type:"low", item })} aria-label={`Add ${item.name} to grocery list`}><ShoppingBasket size={16}/></button><button className="mini-action danger" onClick={() => deleteItem(item)} aria-label={`Delete ${item.name}`}><Trash2 size={16}/></button></div></>}
          </div>)}</div>}
        {items.length > 0 && <div className="inventory-footer"><div className="quick-add"><input placeholder="Add an item…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addItem()}/><button className="btn btn-outline" onClick={addItem}><Plus size={16}/> Add item</button></div><button className="btn btn-green" onClick={addLowStock}><ShoppingBasket size={17}/> Add low-stock to grocery list</button></div>}
      </section>}

      {tab === "recipes" && <section className="content-section">
        <div className="section-heading"><div><div className="eyebrow">MADE FOR WHAT YOU HAVE</div><h2>What's cooking?</h2><p>American-style favorites, matched to your confirmed fridge inventory.</p></div><span className="american-pill">🇺🇸 American-style only</span></div>
        {items.length === 0 ? <div className="empty-state"><div className="empty-illustration">🍳</div><h3>Let's find your next favorite.</h3><p>Scan your fridge first, and we'll match recipes to your ingredients.</p><button className="btn btn-dark" onClick={() => scan("sample")}><Sparkles size={16}/> Try sample scan</button></div> :
          <div className="recipe-grid">{recipes.map((recipe, idx) => <article className="recipe-card" key={recipe.id}><div className={`recipe-art recipe-art-${idx % 4}`}>{recipeEmoji(recipe.id)}<span className="recipe-style">AMERICAN CLASSIC</span></div><div className="recipe-body"><div className={recipe.readyToCook ? "recipe-status ready" : "recipe-status missing"}>{recipe.readyToCook ? <Check size={13}/> : <ShoppingBasket size={13}/>} {recipe.status}</div><h3>{recipe.name}</h3><p>{recipe.description}</p>{recipe.missingIngredients.length > 0 && <div className="missing-box"><b>Still needed</b><span>{recipe.missingIngredients.map(i => i.name).join(", ")}</span></div>}{recipe.lowStockIngredients.length > 0 && <div className="low-note">Running low: {recipe.lowStockIngredients.map(i => i.name).join(", ")}</div>}<button className="btn btn-outline recipe-cta" onClick={() => setRecipeDetail(recipe)}>View recipe <ArrowRight size={15}/></button></div></article>)}</div>}
      </section>}

      {tab === "groceries" && <section className="content-section">
        <div className="section-heading"><div><div className="eyebrow">YOUR NEXT STORE RUN</div><h2>Grocery list <span className="heading-count">{groceries.filter(g => !g.checked).length}</span></h2><p>Missing ingredients and low-stock essentials, all in one place.</p></div><button className="btn btn-outline" onClick={addLowStock}><Plus size={16}/> Add low-stock</button></div>
        <div className="grocery-add"><Plus size={18}/><input placeholder="Add milk, bread, anything…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && addGrocery(newName)}/><button className="btn btn-dark" onClick={() => addGrocery(newName)}>Add item</button></div>
        {groceries.length === 0 ? <div className="empty-state compact"><div className="empty-illustration">🛒</div><h3>Your list is looking nice and empty.</h3><p>Add an item or move low-stock ingredients here.</p></div> : <div className="grocery-list">{groceries.map(item => <div className={`grocery-row ${item.checked ? "is-checked" : ""}`} key={item.id}><button className="check-button" onClick={() => updateGrocery(item, { checked: !item.checked })} aria-label={item.checked ? "Mark as not bought" : "Mark as bought"}>{item.checked && <Check size={14}/>}</button><div className="grocery-info"><b>{item.name}</b><small>{item.quantity} {item.unit} · {item.source === "recipe" ? "Recipe ingredient" : item.source === "low-stock" ? "Low stock" : "Added by you"}</small></div><button className="mini-action" onClick={() => setModal({ type:"editGrocery", item })}>Edit</button><button className="mini-action danger" onClick={() => deleteGrocery(item)} aria-label={`Delete ${item.name}`}><Trash2 size={16}/></button></div>)}</div>}
      </section>}

      <footer className="footer"><span><Refrigerator size={16}/> Fridge Scan</span><span>Less waste. More good food. <span className="footer-heart">♥</span></span></footer>
    </main>

    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && setModal(null)}><div className="modal" role="dialog" aria-modal="true">
      <button className="modal-close" onClick={() => setModal(null)} aria-label="Close"><X size={18}/></button>
      {modal.type === "low" ? <><div className="modal-icon"><ShoppingBasket size={24}/></div><div className="eyebrow">GROCERY LIST</div><h2>Add to your shopping list?</h2><p><b>{modal.item.name}</b> is marked {modal.item.stock_status === "empty" ? "empty" : "running low"}. Would you like to add it to your grocery list?</p><div className="modal-actions"><button className="btn btn-outline" onClick={() => setModal(null)}>Not now</button><button className="btn btn-dark" onClick={() => addGrocery(modal.item.name, Math.max(1, modal.item.quantity), modal.item.unit, "low-stock")}>Add to grocery list</button></div></> :
      modal.type === "missing" ? <><div className="modal-icon"><ShoppingBasket size={24}/></div><div className="eyebrow">MISSING INGREDIENT</div><h2>Add it to your grocery list?</h2><p><b>{modal.ingredient.name}</b> is missing from your fridge. Add it so you can make {modal.recipe.name}.</p><div className="modal-actions"><button className="btn btn-outline" onClick={() => setModal(null)}>Maybe later</button><button className="btn btn-dark" onClick={() => addGrocery(modal.ingredient.name, modal.ingredient.quantity, modal.ingredient.unit, "recipe")}>Add ingredient</button></div></> :
      <><div className="eyebrow">EDIT GROCERY ITEM</div><h2>Make it your own.</h2><GroceryEditor item={modal.item} onCancel={() => setModal(null)} onSave={async changes => { await updateGrocery(modal.item, changes); setModal(null); }}/></>}
    </div></div>}

    {recipeDetail && <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && setRecipeDetail(null)}><div className="modal recipe-modal" role="dialog" aria-modal="true"><button className="modal-close" onClick={() => setRecipeDetail(null)} aria-label="Close"><X size={18}/></button><div className="recipe-detail-emoji">{recipeEmoji(recipeDetail.id)}</div><div className="eyebrow">AMERICAN-STYLE RECIPE</div><h2>{recipeDetail.name}</h2><p>{recipeDetail.description}</p><h3>Ingredients</h3><div className="detail-ingredients">{recipeDetail.ingredients.map(ingredient => { const missing = recipeDetail.missingIngredients.some(m => m.name === ingredient.name); const low = recipeDetail.lowStockIngredients.some(m => m.name === ingredient.name); return <div className="detail-ingredient" key={ingredient.name}><span>{ingredient.quantity} {ingredient.unit} {ingredient.name}</span>{missing ? <button className="mini-action success" onClick={() => setModal({ type:"missing", recipe:recipeDetail, ingredient })}>+ Add to list</button> : low ? <span className="stock-badge low">Running low</span> : <Check size={16} className="green-check"/>}</div>; })}</div><h3>Directions</h3><ol className="directions">{recipeDetail.instructions.map((step,i)=><li key={i}>{step}</li>)}</ol>{recipeDetail.missingIngredients.length > 0 && <button className="btn btn-dark full-btn" onClick={() => { setRecipeDetail(null); setModal({ type:"missing", recipe:recipeDetail, ingredient:recipeDetail.missingIngredients[0] }); }}>Add a missing ingredient</button>}</div></div>}
  </div>;
}

function GroceryEditor({ item, onCancel, onSave }) {
  const [name, setName] = useState(item.name);
  const [quantity, setQuantity] = useState(item.quantity);
  const [unit, setUnit] = useState(item.unit);
  return <form className="editor-form" onSubmit={e => { e.preventDefault(); onSave({ name, quantity: Number(quantity), unit }); }}><label>Name<input value={name} onChange={e => setName(e.target.value)} required/></label><div className="form-row"><label>Quantity<input type="number" min="0" step="0.5" value={quantity} onChange={e => setQuantity(e.target.value)} required/></label><label>Unit<input value={unit} onChange={e => setUnit(e.target.value)} required/></label></div><div className="modal-actions"><button type="button" className="btn btn-outline" onClick={onCancel}>Cancel</button><button className="btn btn-dark">Save changes</button></div></form>;
}
function foodIcon(name) {
  const n = name.toLowerCase();
  if (n.includes("egg")) return "🥚"; if (n.includes("milk")) return "🥛"; if (n.includes("cheese")) return "🧀";
  if (n.includes("tomato")) return "🍅"; if (n.includes("lettuce")) return "🥬"; if (n.includes("butter")) return "🧈";
  if (n.includes("bread")) return "🍞"; if (n.includes("beef")) return "🥩"; return "🥗";
}
function recipeEmoji(id) {
  return ({ "cheese-omelet":"🍳", "grilled-cheese":"🥪", "tomato-cheddar-salad":"🥗", cheeseburger:"🍔" })[id] || "🍽️";
}
