// ─────────────────────────────────────────────────────────────────────────────
// LogicBench  ·  app.js
// Quine-McCluskey + Petrick's Method Boolean Minimiser
// ─────────────────────────────────────────────────────────────────────────────

// State: 16 cells — 0 = zero, 1 = one, 2 = don't-care (X)
const cells = new Array(16).fill(0);
let hoveredPiMask = null;

// Colour palette for PI loops (index → CSS class suffix)
const LOOP_COLOR_COUNT = 5;

const GRAY_ROWS = [0, 1, 3, 2];   // AB: 00, 01, 11, 10
const GRAY_COLS = [0, 1, 3, 2];   // CD: 00, 01, 11, 10
const ROW_LABELS = ['00', '01', '11', '10'];
const COL_LABELS = ['00', '01', '11', '10'];

// ─── Preset Loader ───────────────────────────────────────────────────────────
function loadPreset(name) {
    cells.fill(0);
    switch (name) {
        case 'default':
            [0, 1, 2, 5, 6, 7, 8, 9, 10, 14].forEach(i => cells[i] = 1);
            [4, 15].forEach(i => cells[i] = 2);
            break;
        case 'bcd7':
            [0, 2, 3, 5, 6, 7, 8, 9].forEach(i => cells[i] = 1);
            [10, 11, 12, 13, 14, 15].forEach(i => cells[i] = 2);
            break;
        case 'prime':
            [2, 3, 5, 7, 11, 13].forEach(i => cells[i] = 1);
            break;
        case 'xor':
            [1, 2, 4, 7, 8, 11, 13, 14].forEach(i => cells[i] = 1);
            break;
        // 'clear' leaves all zeros
    }
    updateAll();
}

// ─── Quine-McCluskey Solver ───────────────────────────────────────────────────
function solveQM() {
    const minterms  = [];
    const dontCares = [];
    cells.forEach((v, i) => {
        if (v === 1) minterms.push(i);
        else if (v === 2) dontCares.push(i);
    });

    if (minterms.length === 0)
        return { expr: '0', pis: [], selected: [] };

    if (minterms.length + dontCares.length === 16)
        return {
            expr: '1',
            pis: [{ mask: '----', expr: '1', cov: [...Array(16).keys()], essential: true, selected: true }],
            selected: [{ mask: '----', expr: '1', cov: [...Array(16).keys()] }]
        };

    const allTerms = [...minterms, ...dontCares].sort((a, b) => a - b);
    let groups = {};
    allTerms.forEach(m => {
        const bin  = m.toString(2).padStart(4, '0');
        const ones = bin.split('').filter(c => c === '1').length;
        if (!groups[ones]) groups[ones] = {};
        groups[ones][bin] = new Set([m]);
    });

    const primeImplicants = {};

    while (Object.keys(groups).length > 0) {
        const nextGroups = {};
        const combined   = new Set();
        const keys = Object.keys(groups).map(Number).sort((a, b) => a - b);

        for (let i = 0; i < keys.length - 1; i++) {
            const g1 = keys[i], g2 = keys[i + 1];
            if (g2 - g1 !== 1) continue;
            for (const [t1, cov1] of Object.entries(groups[g1])) {
                for (const [t2, cov2] of Object.entries(groups[g2])) {
                    let diff = 0, merged = '';
                    for (let b = 0; b < 4; b++) {
                        if (t1[b] !== t2[b]) { diff++; merged += '-'; }
                        else merged += t1[b];
                    }
                    if (diff === 1) {
                        combined.add(t1); combined.add(t2);
                        const ones = merged.split('').filter(c => c === '1').length;
                        if (!nextGroups[ones]) nextGroups[ones] = {};
                        if (!nextGroups[ones][merged]) nextGroups[ones][merged] = new Set();
                        cov1.forEach(x => nextGroups[ones][merged].add(x));
                        cov2.forEach(x => nextGroups[ones][merged].add(x));
                    }
                }
            }
        }

        for (const grp of Object.values(groups))
            for (const [term, cov] of Object.entries(grp))
                if (!combined.has(term))
                    primeImplicants[term] = Array.from(cov).sort((a, b) => a - b);

        groups = nextGroups;
    }

    const vars = ['A', 'B', 'C', 'D'];
    const maskToExpr = mask => {
        if (mask === '----') return '1';
        return mask.split('')
            .map((b, i) => b === '1' ? vars[i] : (b === '0' ? vars[i] + "'" : ''))
            .join('');
    };

    // Essential PI selection
    const uncovered    = new Set(minterms);
    const essentialMasks = new Set();
    minterms.forEach(m => {
        const covering = Object.keys(primeImplicants).filter(mask => primeImplicants[mask].includes(m));
        if (covering.length === 1) essentialMasks.add(covering[0]);
    });

    const selectedMasks = new Set(essentialMasks);
    essentialMasks.forEach(mask => primeImplicants[mask].forEach(m => uncovered.delete(m)));

    // Greedy cover of remaining minterms
    while (uncovered.size > 0) {
        let bestMask = null, bestCount = -1, bestLiterals = 99;
        for (const [mask, cov] of Object.entries(primeImplicants)) {
            if (selectedMasks.has(mask)) continue;
            const count = cov.filter(m => uncovered.has(m)).length;
            const lits  = 4 - mask.split('').filter(c => c === '-').length;
            if (count > bestCount || (count === bestCount && lits < bestLiterals)) {
                bestCount = count; bestMask = mask; bestLiterals = lits;
            }
        }
        if (!bestMask || bestCount <= 0) break;
        selectedMasks.add(bestMask);
        primeImplicants[bestMask].forEach(m => uncovered.delete(m));
    }

    const piList = Object.entries(primeImplicants).map(([mask, cov]) => ({
        mask,
        expr: maskToExpr(mask),
        cov,
        essential: essentialMasks.has(mask),
        selected:  selectedMasks.has(mask)
    }));

    const selectedList = piList.filter(p => p.selected);
    return {
        expr: selectedList.map(p => p.expr).join(' + '),
        pis:  piList,
        selected: selectedList
    };
}

// ─── Gate Schematic Renderer ──────────────────────────────────────────────────
const LOOP_HEX = ['#3B6DE8', '#1B9E63', '#C5860E', '#D94040', '#7C47DC'];

function renderSchematic(selectedPIs) {
    const svg = document.getElementById('schematicSvg');
    if (selectedPIs.length === 0) {
        svg.innerHTML = `<text x="160" y="90" text-anchor="middle"
            font-family="JetBrains Mono" font-size="12" fill="#9C9589">Output Constant 0</text>`;
        return;
    }

    const count   = Math.min(selectedPIs.length, 4);
    const spacing = 140 / (count + 1);
    let html = '';

    selectedPIs.slice(0, 4).forEach((pi, idx) => {
        const y     = Math.round(15 + spacing * (idx + 1));
        const color = LOOP_HEX[idx % LOOP_HEX.length];
        html += `<text x="12" y="${y + 4}" font-family="JetBrains Mono" font-size="11"
                    font-weight="600" fill="#1A1714">${pi.expr}</text>`;
        html += `<line x1="62" y1="${y}" x2="110" y2="${y}"
                    stroke="${color}" stroke-width="1.8"/>`;
        html += `<path d="M110,${y - 12} L128,${y - 12} A12,12 0 0,1 128,${y + 12} L110,${y + 12} Z"
                    fill="#FFFFFF" stroke="#1A1714" stroke-width="1.5"/>`;
        html += `<path d="M140,${y} L180,${y} L195,85"
                    fill="none" stroke="${color}" stroke-width="1.5"/>`;
    });

    html += `<path d="M190,62 Q202,85 190,108 Q222,106 238,85 Q222,64 190,62 Z"
                fill="#FFFFFF" stroke="#1A1714" stroke-width="1.8"/>`;
    html += `<line x1="238" y1="85" x2="275" y2="85" stroke="#1A1714" stroke-width="2"/>`;
    html += `<text x="282" y="89" font-family="JetBrains Mono" font-size="12"
                font-weight="700" fill="#1A1714">F</text>`;

    svg.innerHTML = html;
}

// ─── Main Update ─────────────────────────────────────────────────────────────
function updateAll() {
    const res      = solveQM();
    const minterms = [], dontCares = [];
    cells.forEach((v, i) => {
        if (v === 1) minterms.push(i);
        if (v === 2) dontCares.push(i);
    });

    // ── Result ribbon
    document.getElementById('sopOutput').textContent =
        `F(A,B,C,D) = ${res.expr}`;
    document.getElementById('epiCountBadge').textContent =
        `${res.selected.length} Term${res.selected.length === 1 ? '' : 's'}`;
    document.getElementById('mintermSummary').textContent =
        `Σm(${minterms.join(', ') || '∅'})`;
    document.getElementById('dontCareSummary').textContent =
        dontCares.length ? `+ d(${dontCares.join(', ')})` : '';

    const canonLits = minterms.length * 4;
    const minLits   = res.selected.reduce(
        (acc, p) => acc + (4 - p.mask.split('').filter(c => c === '-').length), 0);
    const pct = canonLits > 0
        ? (((canonLits - minLits) / canonLits) * 100).toFixed(1)
        : '0.0';

    document.getElementById('minLiterals').textContent   = minLits;
    document.getElementById('canonLiterals').textContent = canonLits;
    document.getElementById('gateCount').textContent     =
        res.selected.length > 1 ? res.selected.length + 1 : res.selected.length;
    document.getElementById('reductionPct').textContent  = `${pct}%`;

    // ── Karnaugh Map
    renderKMap(res);

    // ── PI pills
    const piPills = document.getElementById('piPills');
    piPills.innerHTML = '';
    res.selected.forEach((pi, i) => {
        const pill = document.createElement('span');
        pill.className = `pi-pill loop-${i % LOOP_COLOR_COUNT}`;
        pill.textContent = `${pi.expr} (${pi.mask})`;
        pill.onmouseenter = () => { hoveredPiMask = pi.mask; updateAll(); };
        pill.onmouseleave = () => { hoveredPiMask = null;    updateAll(); };
        piPills.appendChild(pill);
    });

    // ── PI Coverage table
    const tbody = document.getElementById('piTableBody');
    tbody.innerHTML = '';
    res.pis.forEach(pi => {
        const tr = document.createElement('tr');
        if (pi.selected) tr.classList.add('pi-row-selected');

        let roleBadge;
        if (pi.essential) {
            roleBadge = `<span class="role-badge essential">★ Essential</span>`;
        } else if (pi.selected) {
            roleBadge = `<span class="role-badge selected">Selected</span>`;
        } else {
            roleBadge = `<span class="role-badge redundant">Redundant</span>`;
        }

        tr.innerHTML = `
            <td>${pi.expr}</td>
            <td>${pi.mask}</td>
            <td>${pi.cov.join(', ')}</td>
            <td>${roleBadge}</td>
        `;
        tr.onmouseenter = () => { hoveredPiMask = pi.mask; updateAll(); };
        tr.onmouseleave = () => { hoveredPiMask = null;    updateAll(); };
        tbody.appendChild(tr);
    });

    // ── Verilog HDL
    const vTerms = res.selected.map(pi => {
        if (pi.mask === '----') return "1'b1";
        const parts = [];
        ['A', 'B', 'C', 'D'].forEach((v, idx) => {
            if (pi.mask[idx] === '1') parts.push(v);
            else if (pi.mask[idx] === '0') parts.push(`~${v}`);
        });
        return `(${parts.join(' & ')})`;
    });
    document.getElementById('verilogCode').textContent =
`module boolean_minimized (
  input  wire A, B, C, D,
  output wire F
);
  // Minimized via Quine-McCluskey (${minLits} literals)
  assign F = ${vTerms.length ? vTerms.join(' |\n             ') : "1'b0"};
endmodule`;

    // ── Gate schematic
    renderSchematic(res.selected);

    // ── Truth table
    const ttBody = document.getElementById('truthTableBody');
    ttBody.innerHTML = '';
    for (let i = 0; i < 16; i++) {
        const bin = i.toString(2).padStart(4, '0');
        const st  = cells[i];
        const fClass = st === 1 ? 'f-one' : st === 2 ? 'f-dc' : 'f-zero';
        const fText  = st === 2 ? 'X' : st;
        const tr = document.createElement('tr');
        tr.onclick = () => { cells[i] = (cells[i] + 1) % 3; updateAll(); };
        tr.innerHTML = `
            <td>${i}</td>
            <td>${bin[0]}</td>
            <td>${bin[1]}</td>
            <td>${bin[2]}</td>
            <td>${bin[3]}</td>
            <td class="${fClass}">${fText}</td>
        `;
        ttBody.appendChild(tr);
    }
}

// ─── Karnaugh Map Renderer ────────────────────────────────────────────────────
function renderKMap(res) {
    const container = document.getElementById('kmapContainer');
    container.innerHTML = '';

    // Corner label
    const corner = document.createElement('div');
    corner.className = 'kmap-corner';
    corner.textContent = 'AB╲CD';
    container.appendChild(corner);

    // Column headers
    COL_LABELS.forEach(lbl => {
        const h = document.createElement('div');
        h.className = 'kmap-col-label mono';
        h.textContent = lbl;
        container.appendChild(h);
    });

    // Rows
    GRAY_ROWS.forEach((rVal, rIdx) => {
        // Row label
        const rowLbl = document.createElement('div');
        rowLbl.className = 'kmap-row-label mono';
        rowLbl.textContent = ROW_LABELS[rIdx];
        container.appendChild(rowLbl);

        // Cells
        GRAY_COLS.forEach(cVal => {
            const idx   = (rVal << 2) | cVal;
            const state = cells[idx];

            // Determine which loop covers this cell
            const coveringIdx = res.selected
                .map((pi, i) => pi.cov.includes(idx) ? i : -1)
                .filter(i => i !== -1);

            const isHoveredLoop = hoveredPiMask
                ? res.pis.find(p => p.mask === hoveredPiMask)?.cov.includes(idx)
                : false;

            const btn = document.createElement('button');
            btn.className = 'kmap-cell';

            // Apply loop colour
            if (hoveredPiMask) {
                if (isHoveredLoop) {
                    const hpi = res.selected.find(p => p.mask === hoveredPiMask);
                    const hIdx = res.selected.indexOf(hpi);
                    if (hIdx >= 0) btn.classList.add(`loop-${hIdx % LOOP_COLOR_COUNT}`);
                }
            } else if (coveringIdx.length > 0) {
                btn.classList.add(`loop-${coveringIdx[0] % LOOP_COLOR_COUNT}`);
            }

            // Value colour
            const valColor = state === 1 ? 'var(--text-primary)'
                           : state === 2 ? 'var(--amber)'
                           : 'var(--text-muted)';

            btn.innerHTML = `
                <span class="kmap-cell-idx">${idx}</span>
                <span class="kmap-cell-val" style="color:${valColor}">${state === 2 ? 'X' : state}</span>
            `;
            btn.onclick = () => { cells[idx] = (cells[idx] + 1) % 3; updateAll(); };
            container.appendChild(btn);
        });
    });
}

// ─── Event Listeners ─────────────────────────────────────────────────────────
document.getElementById('presetSelect').onchange = e => loadPreset(e.target.value);

document.getElementById('randomBtn').onclick = () => {
    for (let i = 0; i < 16; i++) {
        const r = Math.random();
        cells[i] = r < 0.45 ? 1 : r < 0.60 ? 2 : 0;
    }
    updateAll();
};

document.getElementById('copyVerilogBtn').onclick = () => {
    const code = document.getElementById('verilogCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        const btn = document.getElementById('copyVerilogBtn');
        btn.textContent = 'Copied ✓';
        setTimeout(() => { btn.textContent = 'Copy HDL ↗'; }, 1800);
    });
};

// ─── Init ─────────────────────────────────────────────────────────────────────
loadPreset('default');
