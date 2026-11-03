// =============================================================================
// icons.js — Ikon FontAwesome + warna (picker, badge, kompatibilitas data lama)
// Format simpan: "fa-solid fa-utensils|#F97316". Data lama (emoji / nama lucide) tetap terbaca.
// =============================================================================

export const COLORS = ['#F97316', '#EF4444', '#EC4899', '#A855F7', '#6366F1', '#3B82F6',
    '#06B6D4', '#14B8A6', '#10B981', '#84CC16', '#EAB308', '#64748B'];

// [nama ikon FontAwesome tanpa "fa-", emoji pengganti untuk <option>]
const GROUPS = [
    { label: 'Makan', icon: 'utensils', items: [['utensils', '🍽️'], ['burger', '🍔'], ['pizza-slice', '🍕'], ['mug-hot', '☕'], ['ice-cream', '🍦'], ['bowl-rice', '🍚'], ['fish', '🐟'], ['carrot', '🥕'], ['apple-whole', '🍎'], ['cookie-bite', '🍪'], ['wine-glass', '🍷'], ['bottle-water', '💧']] },
    { label: 'Belanja', icon: 'bag-shopping', items: [['cart-shopping', '🛒'], ['bag-shopping', '🛍️'], ['basket-shopping', '🧺'], ['store', '🏪'], ['shirt', '👕'], ['shoe-prints', '👟'], ['gift', '🎁'], ['gem', '💎'], ['glasses', '👓'], ['ring', '💍']] },
    { label: 'Transport', icon: 'car', items: [['car', '🚗'], ['motorcycle', '🏍️'], ['bus', '🚌'], ['train', '🚆'], ['plane', '✈️'], ['gas-pump', '⛽'], ['bicycle', '🚲'], ['taxi', '🚕'], ['ship', '🚢'], ['van-shuttle', '🚐']] },
    { label: 'Rumah', icon: 'house', items: [['house', '🏠'], ['bolt', '⚡'], ['droplet', '💧'], ['wifi', '🌐'], ['phone', '📱'], ['fire-flame-curved', '🔥'], ['file-invoice-dollar', '🧾'], ['couch', '🛋️'], ['broom', '🧹'], ['screwdriver-wrench', '🔧'], ['tv', '📺'], ['key', '🔑']] },
    { label: 'Sehat', icon: 'heart-pulse', items: [['heart-pulse', '🏥'], ['pills', '💊'], ['stethoscope', '🩺'], ['tooth', '🦷'], ['syringe', '💉'], ['hospital', '🏥'], ['dumbbell', '🏋️'], ['spa', '💆']] },
    { label: 'Kerja', icon: 'briefcase', items: [['briefcase', '💼'], ['graduation-cap', '🎓'], ['book', '📖'], ['book-open-reader', '📚'], ['laptop', '💻'], ['pen', '🖊️'], ['school', '🏫'], ['building', '🏢'], ['chalkboard-user', '🧑‍🏫']] },
    { label: 'Hiburan', icon: 'gamepad', items: [['gamepad', '🎮'], ['film', '🎬'], ['music', '🎵'], ['headphones', '🎧'], ['ticket', '🎟️'], ['futbol', '⚽'], ['camera', '📷'], ['palette', '🎨'], ['umbrella-beach', '🏖️'], ['guitar', '🎸'], ['dice', '🎲'], ['champagne-glasses', '🥂']] },
    { label: 'Uang', icon: 'wallet', items: [['wallet', '💰'], ['money-bill-wave', '💵'], ['piggy-bank', '🐷'], ['landmark', '🏦'], ['building-columns', '🏦'], ['chart-line', '📈'], ['arrow-trend-up', '📈'], ['coins', '🪙'], ['credit-card', '💳'], ['hand-holding-dollar', '💸'], ['sack-dollar', '💰'], ['vault', '🔐'], ['bullseye', '🎯'], ['scale-balanced', '⚖️']] },
    { label: 'Lainnya', icon: 'star', items: [['baby', '👶'], ['child', '🧒'], ['paw', '🐾'], ['heart', '❤️'], ['people-roof', '👨‍👩‍👧'], ['hands-praying', '🙏'], ['mosque', '🕌'], ['seedling', '🌱'], ['star', '⭐'], ['tag', '🏷️'], ['circle-plus', '➕'], ['ellipsis', '📦']] }
];
const EMOJI = new Map();
GROUPS.forEach(g => g.items.forEach(([n, e]) => EMOJI.set('fa-' + n, e)));
['sun', 'calendar-week', 'calendar-days', 'right-left', 'mobile-screen-button', 'receipt'].forEach(n => EMOJI.set('fa-' + n, '🏷️'));

const LEGACY = { briefcase: 'fa-briefcase', gift: 'fa-gift', 'trending-up': 'fa-arrow-trend-up', 'plus-circle': 'fa-circle-plus', 'shopping-cart': 'fa-cart-shopping', utensils: 'fa-utensils', car: 'fa-car', zap: 'fa-bolt', wifi: 'fa-wifi', 'heart-pulse': 'fa-heart-pulse', 'graduation-cap': 'fa-graduation-cap', 'gamepad-2': 'fa-gamepad', landmark: 'fa-landmark', wallet: 'fa-wallet', tag: 'fa-tag', 'more-horizontal': 'fa-ellipsis' };
const LEGACY_COLOR = { briefcase: '#6366F1', gift: '#EC4899', 'trending-up': '#10B981', 'plus-circle': '#14B8A6', 'shopping-cart': '#A855F7', utensils: '#F97316', car: '#3B82F6', zap: '#EAB308', wifi: '#06B6D4', 'heart-pulse': '#EF4444', 'graduation-cap': '#6366F1', 'gamepad-2': '#EC4899', landmark: '#64748B', wallet: '#10B981', tag: '#64748B', 'more-horizontal': '#64748B' };

const hash = (s) => { let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
export const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
};

/** Baca nilai ikon apa pun (FA baru, nama lucide lama, emoji) menjadi objek seragam. */
export function parseIcon(raw) {
    const v = String(raw ?? '').trim();
    if (v && /\p{Extended_Pictographic}/u.test(v)) return { kind: 'emoji', emoji: v, color: '#64748B' };
    let [cls, color] = (v || 'tag').split('|');
    cls = cls.trim().replace(/[^a-z0-9 -]/gi, '');
    color = color && /^#[0-9a-f]{6}$/i.test(color.trim()) ? color.trim() : null;
    if (!cls.startsWith('fa-')) {
        const key = cls;
        cls = 'fa-solid ' + (LEGACY[key] || 'fa-tag');
        color = color || LEGACY_COLOR[key] || null;
    } else if (!/^fa-(solid|regular|brands)\b/.test(cls)) {
        cls = 'fa-solid ' + cls;
    }
    const name = cls.split(/\s+/).pop();
    return { kind: 'fa', cls, name, color: color || COLORS[hash(name) % COLORS.length], emoji: EMOJI.get(name) || '🏷️' };
}

export const normalizeIcon = (raw) => { const p = parseIcon(raw); return p.kind === 'emoji' ? p.emoji : `${p.cls}|${p.color}`; };
export const emojiFor = (raw) => parseIcon(raw).emoji;
export const iconColor = (raw) => parseIcon(raw).color;

/** Kotak ikon berwarna (HTML string). */
export function iconBadge(raw, { size = 40 } = {}) {
    const p = parseIcon(raw);
    const inner = p.kind === 'emoji'
        ? `<span style="font-size:${Math.round(size * 0.5)}px;line-height:1">${p.emoji}</span>`
        : `<i class="${p.cls}" style="font-size:${Math.round(size * 0.4)}px"></i>`;
    return `<span class="ib" style="width:${size}px;height:${size}px;border-radius:${Math.round(size * 0.3)}px;background:${hexA(p.color, 0.16)};color:${p.color}">${inner}</span>`;
}

// Ikon bawaan budget per periode (supaya tiap budget tidak seragam)
const PERIOD_ICON = { daily: 'fa-solid fa-sun|#F59E0B', weekly: 'fa-solid fa-calendar-week|#3B82F6', monthly: 'fa-solid fa-calendar-days|#8B5CF6' };
export const periodIcon = (t) => PERIOD_ICON[t] || PERIOD_ICON.monthly;
/** Pilihan user > ikon kategori > ikon periode */
export const resolveBudgetIcon = (b) => b.icon || (b.category_id && b.category_icon ? b.category_icon : periodIcon(b.period_type));

// ---------------------------------------------------------------------------
// Picker ikon + warna
// ---------------------------------------------------------------------------
export function createIconPicker(root, { onChange } = {}) {
    if (!root) return null;
    let cls = 'fa-solid fa-tag', color = COLORS[5], group = 0;
    root.innerHTML = `
        <div class="space-y-3">
            <div class="flex items-center gap-3">
                <div data-ip="preview"></div>
                <div class="min-w-0"><p class="text-sm font-semibold text-slate-700">Pilih ikon &amp; warna</p>
                <p class="text-[11px] text-slate-400">Ketuk ikon, lalu pilih warna favorit</p></div>
            </div>
            <div data-ip="tabs" class="flex gap-1.5 overflow-x-auto pb-1"></div>
            <div data-ip="grid" class="grid grid-cols-6 sm:grid-cols-7 gap-1.5 max-h-44 overflow-y-auto p-0.5"></div>
            <div data-ip="colors" class="flex flex-wrap gap-2.5 pt-1"></div>
        </div>`;
    const $ip = (n) => root.querySelector(`[data-ip="${n}"]`);

    const paintTabs = () => {
        $ip('tabs').innerHTML = GROUPS.map((g, i) => `
            <button type="button" data-g="${i}" class="shrink-0 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${i === group ? 'bg-indigo-50 border-indigo-300 text-indigo-600' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}">
                <i class="fa-solid fa-${g.icon} mr-1"></i>${g.label}</button>`).join('');
    };
    const paintGrid = () => {
        $ip('grid').innerHTML = GROUPS[group].items.map(([n]) =>
            `<button type="button" data-c="fa-solid fa-${n}" title="${n}" class="ip-i h-10 rounded-lg border flex items-center justify-center text-base transition-colors"><i class="fa-solid fa-${n}"></i></button>`).join('');
        paintSelection();
    };
    const paintSelection = () => {
        $ip('preview').innerHTML = iconBadge(`${cls}|${color}`, { size: 40 });
        $ip('grid').querySelectorAll('.ip-i').forEach(b => {
            const on = b.dataset.c === cls;
            b.style.cssText = on ? `border-color:${color};background:${hexA(color, 0.16)};color:${color}` : '';
            b.className = `ip-i h-10 rounded-lg border flex items-center justify-center text-base transition-colors ${on ? '' : 'bg-white border-slate-200 text-slate-500 hover:bg-slate-50'}`;
        });
        $ip('colors').innerHTML = COLORS.map(c =>
            `<button type="button" data-col="${c}" aria-label="Warna ${c}" class="w-7 h-7 rounded-full transition-transform ${c === color ? 'scale-110' : ''}" style="background:${c};${c === color ? `box-shadow:0 0 0 2px #fff,0 0 0 4px ${c}` : ''}"></button>`).join('');
    };

    root.addEventListener('click', (e) => {
        const g = e.target.closest('[data-g]'), i = e.target.closest('[data-c]'), c = e.target.closest('[data-col]');
        if (g) { group = +g.dataset.g; paintTabs(); paintGrid(); return; }
        if (i) cls = i.dataset.c; else if (c) color = c.dataset.col; else return;
        paintSelection();
        if (onChange) onChange(`${cls}|${color}`);
    });

    paintTabs(); paintGrid();
    return {
        get: () => `${cls}|${color}`,
        set(raw) {
            const p = parseIcon(raw);
            if (p.kind === 'fa') { cls = p.cls; color = p.color; } else { cls = 'fa-solid fa-tag'; color = p.color; }
            const gi = GROUPS.findIndex(g => g.items.some(([n]) => 'fa-solid fa-' + n === cls));
            group = gi >= 0 ? gi : 0;
            paintTabs(); paintGrid();
        }
    };
}
